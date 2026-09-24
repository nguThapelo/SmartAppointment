import { randomInt } from "node:crypto";
import type { BookingChannel, BookingStatus, Prisma } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import type { z } from "zod";
import { prisma, type Tx } from "@/lib/db";
import { auditActor, type ServiceActor, type ServiceCtx } from "@/server/actors";
import { recordAudit } from "@/server/audit";
import { toBookingDTO, type BookingDTO, type BookingWithPeople } from "@/server/dto/booking";
import { AppError, conflict, forbidden, isSlotConflict, notFound, unprocessable } from "@/server/errors";
import { log } from "@/server/log";
import { assertBookableSlot } from "@/server/services/availability";
import { notifyBooking, type BookingEvent } from "@/server/services/notification";
import { priceFor } from "@/server/services/pricing";
import { decide, type BookingAction, type Party, type TransitionInput } from "@/server/state/booking.machine";
import type { bookingCreateSchema, bookingListSchema } from "@/server/validation/booking";

// All booking reads and writes. Every entry point takes a ServiceActor and
// resolves the caller's relationship ("party") to the booking itself — ids in
// input are never proof of access (audit H-3, IDOR). A booking the caller
// can't see is reported as "not found", so ids can't be probed for existence.

const PEOPLE = {
  provider: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
  client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
} satisfies Prisma.BookingInclude;

const REF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0/O, 1/I/L
const newReference = () =>
  `SA-${Array.from({ length: 6 }, () => REF_ALPHABET[randomInt(REF_ALPHABET.length)]).join("")}`;

// ── Visibility ──────────────────────────────────────────────────────────────

export function partyFor(
  actor: ServiceActor,
  b: { providerId: string; clientId: string | null; customerPhone: string | null; whatsappChannelId: string | null },
): Party | null {
  switch (actor.kind) {
    case "user": {
      const u = actor.user;
      if (u.role === "ADMIN") return "admin";
      if (u.role === "PROVIDER" && b.providerId === u.id) return "provider";
      if (u.role === "CLIENT" && b.clientId === u.id) return "client";
      return null;
    }
    case "whatsapp":
      return b.customerPhone === actor.phone && b.whatsappChannelId === actor.channelId ? "guest" : null;
    case "system":
      return "system";
    case "webhook":
      return "webhook";
  }
}

const byIdOrReference = (idOrRef: string): Prisma.BookingWhereInput =>
  /^SA-/i.test(idOrRef) ? { reference: idOrRef.toUpperCase() } : { id: idOrRef };

/** Load a booking the actor may see, with their relationship to it; 404 otherwise. */
export async function loadVisible(actor: ServiceActor, idOrRef: string, db: Tx | typeof prisma = prisma) {
  const b = await db.booking.findFirst({ where: byIdOrReference(idOrRef), include: PEOPLE });
  const party = b ? partyFor(actor, b) : null;
  if (!b || !party) throw notFound("Booking");
  return { booking: b as BookingWithPeople, party };
}

/** Prisma filter restricting a list to what the actor may see. */
function visibilityFilter(actor: ServiceActor): Prisma.BookingWhereInput {
  switch (actor.kind) {
    case "user":
      if (actor.user.role === "ADMIN") return {};
      if (actor.user.role === "PROVIDER") return { providerId: actor.user.id };
      return { clientId: actor.user.id };
    case "whatsapp":
      return { customerPhone: actor.phone, whatsappChannelId: actor.channelId };
    default:
      return {};
  }
}

// ── Reads ───────────────────────────────────────────────────────────────────

export async function getForActor(actor: ServiceActor, idOrRef: string): Promise<BookingDTO> {
  const { booking, party } = await loadVisible(actor, idOrRef);
  return toBookingDTO(booking, party);
}

export async function listForActor(actor: ServiceActor, q: z.infer<typeof bookingListSchema>) {
  const now = new Date();
  const where: Prisma.BookingWhereInput = {
    ...visibilityFilter(actor),
    ...(q.status ? { status: q.status } : {}),
    // "Upcoming" means still going ahead: cancelled/declined/no-show bookings are excluded
    // unless a status is asked for explicitly.
    ...(q.scope === "upcoming"
      ? { startsAt: { gte: now }, ...(q.status ? {} : { status: { notIn: ["CANCELLED", "DECLINED", "NO_SHOW"] as BookingStatus[] } }) }
      : q.scope === "past"
        ? { startsAt: { lt: now } }
        : {}),
  };
  const [total, rows] = await prisma.$transaction([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      include: PEOPLE,
      orderBy: { startsAt: q.scope === "past" ? "desc" : "asc" },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  return {
    total,
    page: q.page,
    pageSize: q.pageSize,
    data: rows.map((b) => toBookingDTO(b, partyFor(actor, b) ?? "client")),
  };
}

export async function historyForActor(actor: ServiceActor, idOrRef: string) {
  const { booking } = await loadVisible(actor, idOrRef);
  const rows = await prisma.bookingTransition.findMany({
    where: { bookingId: booking.id },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((t) => ({
    from: t.fromStatus, to: t.toStatus, action: t.action, actorType: t.actorType,
    reason: t.reason, at: t.createdAt.toISOString(),
  }));
}

// ── Create ──────────────────────────────────────────────────────────────────

export interface GuestDetails {
  name: string;
  phone: string;
  email?: string;
}

interface ResolvedCreate {
  channel: BookingChannel;
  clientId: string | null;
  guest: GuestDetails | null;
  whatsappChannelId: string | null;
  autoApprove: boolean;
  maxAdvanceDays?: number;
  ps: Prisma.ProviderServiceGetPayload<{ include: { provider: true; subService: true } }>;
  startsAt: Date;
  endsAt: Date;
  priceCents: number;
}

/** Every check that decides whether a booking may be created — shared by create and preview. */
async function resolveCreate(
  actor: ServiceActor,
  input: z.infer<typeof bookingCreateSchema>,
  guest?: GuestDetails,
  ctx: ServiceCtx = {},
): Promise<ResolvedCreate> {
  let channel: BookingChannel = ctx.viaAgent ? "AGENT" : "WEB";
  let clientId: string | null = null;
  let whatsappChannelId: string | null = null;
  let autoApprove = false;
  let maxAdvanceDays: number | undefined;
  let channelProviderId: string | null = null;

  if (actor.kind === "user") {
    if (actor.user.role === "CLIENT") {
      if (input.onBehalfOfClientId) throw forbidden("You can only book for yourself");
      clientId = actor.user.id;
    } else if (actor.user.role === "ADMIN") {
      if (!input.onBehalfOfClientId) throw unprocessable("CLIENT_REQUIRED", "Choose the client this booking is for");
      const client = await prisma.user.findFirst({
        where: { id: input.onBehalfOfClientId, role: "CLIENT", isActive: true, deletedAt: null },
      });
      if (!client) throw unprocessable("CLIENT_NOT_FOUND", "That client account doesn't exist");
      clientId = client.id;
    } else {
      throw forbidden("Providers can't create bookings");
    }
  } else if (actor.kind === "whatsapp") {
    if (!guest) throw unprocessable("GUEST_DETAILS_REQUIRED", "Name and phone are required");
    const wa = await prisma.whatsAppChannel.findFirst({ where: { id: actor.channelId, isActive: true } });
    if (!wa) throw notFound("Channel");
    channel = "WHATSAPP";
    whatsappChannelId = wa.id;
    autoApprove = wa.autoApprove;
    maxAdvanceDays = wa.maxAdvanceDays;
    channelProviderId = wa.providerId;
  } else {
    throw forbidden();
  }

  const ps = await prisma.providerService.findFirst({
    where: {
      id: input.providerServiceId,
      isActive: true,
      subService: { isActive: true, category: { isActive: true } },
      provider: { isActive: true, deletedAt: null, role: "PROVIDER" },
    },
    include: { provider: true, subService: true },
  });
  if (!ps) throw unprocessable("SERVICE_UNAVAILABLE", "That service isn't available");
  // A WhatsApp number books only its own provider's services.
  if (channelProviderId && ps.providerId !== channelProviderId) throw notFound("Service");

  const startsAt = new Date(input.startsAt);
  await assertBookableSlot(ps.id, startsAt, { maxAdvanceDays });

  return {
    channel, clientId, guest: guest ?? null, whatsappChannelId, autoApprove, maxAdvanceDays, ps,
    startsAt,
    endsAt: new Date(startsAt.getTime() + ps.durationMin * 60_000),
    priceCents: priceFor(ps),
  };
}

export interface BookingPreview {
  serviceName: string;
  providerName: string;
  startsAt: string;
  localTime: string;
  durationMin: number;
  priceCents: number;
  currency: string;
  paymentMode: string;
}

/** Validate a booking request without creating it (used by the AI confirm flow). */
export async function previewCreate(
  actor: ServiceActor,
  input: z.infer<typeof bookingCreateSchema>,
  guest?: GuestDetails,
  ctx: ServiceCtx = {},
): Promise<BookingPreview> {
  const r = await resolveCreate(actor, input, guest, ctx);
  return {
    serviceName: r.ps.subService.name,
    providerName: `${r.ps.provider.firstName} ${r.ps.provider.lastName}`,
    startsAt: r.startsAt.toISOString(),
    localTime: formatInTimeZone(r.startsAt, r.ps.provider.timezone, "EEE d MMM yyyy, HH:mm"),
    durationMin: r.ps.durationMin,
    priceCents: r.priceCents,
    currency: r.ps.currency,
    paymentMode: r.ps.paymentMode,
  };
}

export async function create(
  actor: ServiceActor,
  input: z.infer<typeof bookingCreateSchema>,
  ctx: ServiceCtx = {},
  guest?: GuestDetails,
): Promise<BookingDTO> {
  const r = await resolveCreate(actor, input, guest, ctx);

  let created: BookingWithPeople | undefined;
  for (let attempt = 0; attempt < 3 && !created; attempt++) {
    try {
      created = await prisma.$transaction(async (tx) => {
        const b = await tx.booking.create({
          data: {
            reference: newReference(),
            channel: r.channel,
            status: "PENDING",
            providerId: r.ps.providerId,
            clientId: r.clientId,
            customerName: r.guest?.name ?? null,
            customerPhone: r.guest?.phone ?? null,
            customerEmail: r.guest?.email ?? null,
            providerServiceId: r.ps.id,
            serviceName: r.ps.subService.name,
            startsAt: r.startsAt,
            endsAt: r.endsAt,
            priceCents: r.priceCents,
            currency: r.ps.currency,
            paymentMode: r.ps.paymentMode,
            notes: input.notes || null,
            whatsappChannelId: r.whatsappChannelId,
          },
          include: PEOPLE,
        });
        const who = auditActor(actor, ctx);
        await tx.bookingTransition.create({
          data: { bookingId: b.id, fromStatus: null, toStatus: "PENDING", action: "create", actorType: who.actorType, actorId: who.actorId },
        });
        await recordAudit(tx, {
          ...who, action: "booking.create", entityType: "Booking", entityId: b.id, outcome: "success",
          requestId: ctx.requestId, detail: { channel: r.channel, priceCents: r.priceCents },
        });
        return b;
      });
    } catch (err) {
      if (isSlotConflict(err)) {
        log.metric("booking.slot_conflict", { requestId: ctx.requestId });
        throw conflict("SLOT_TAKEN", "Sorry, that slot was just taken. Please pick another time.");
      }
      // Reference collision (1 in ~900M) — retry with a fresh one.
      if ((err as { code?: string }).code === "P2002" && attempt < 2) continue;
      throw err;
    }
  }

  let booking = created!;
  if (r.autoApprove) {
    const approved = await transition({ kind: "system" }, booking.id, "approve", {}, ctx, { notify: false });
    booking = { ...booking, status: approved.status };
    void notifyBooking(booking.id, "approved");
  } else {
    void notifyBooking(booking.id, "created");
  }
  const party = partyFor(actor, booking) ?? "client";
  return toBookingDTO(booking, party);
}

// ── Transitions ─────────────────────────────────────────────────────────────

const EVENT_FOR: Partial<Record<BookingAction, BookingEvent>> = {
  approve: "approved",
  decline: "declined",
  cancel: "cancelled",
  complete: "completed",
  paymentSucceeded: "paid",
};

function rejectDecision(d: Extract<ReturnType<typeof decide>, { ok: false }>, ctx: ServiceCtx): never {
  log.metric("booking.transition_rejected", { reason: d.reason, requestId: ctx.requestId });
  if (d.reason === "not_permitted") throw forbidden(d.message);
  if (d.reason === "illegal_state") throw conflict("INVALID_TRANSITION", d.message);
  throw unprocessable("TRANSITION_BLOCKED", d.message);
}

/**
 * Apply a state-machine action inside an existing transaction. Used directly by
 * the payment service so the payment record and booking status commit together.
 */
export async function applyTransitionTx(
  tx: Tx,
  actor: ServiceActor,
  bookingId: string,
  action: BookingAction,
  input: TransitionInput,
  ctx: ServiceCtx = {},
): Promise<{ from: BookingStatus; to: BookingStatus }> {
  const { booking, party } = await loadVisible(actor, bookingId, tx);
  const d = decide(action, booking, party, input);
  if (!d.ok) rejectDecision(d, ctx);

  const res = await tx.booking.updateMany({
    where: { id: booking.id, version: booking.version, status: booking.status },
    data: {
      status: d.to,
      version: { increment: 1 },
      ...(action === "decline" ? { declineReason: input.reason ?? null } : {}),
      ...(action === "cancel" ? { cancelReason: input.reason ?? null } : {}),
    },
  });
  if (res.count !== 1) throw conflict("CONCURRENT_UPDATE", "This booking was just changed by someone else. Please refresh.");

  const who = auditActor(actor, ctx);
  await tx.bookingTransition.create({
    data: {
      bookingId: booking.id, fromStatus: booking.status, toStatus: d.to, action,
      actorType: who.actorType, actorId: who.actorId, reason: input.reason ?? null,
    },
  });
  await recordAudit(tx, {
    ...who, action: `booking.${action}`, entityType: "Booking", entityId: booking.id, outcome: "success",
    requestId: ctx.requestId, detail: { from: booking.status, to: d.to },
  });
  return { from: booking.status, to: d.to };
}

export async function transition(
  actor: ServiceActor,
  idOrRef: string,
  action: BookingAction,
  input: TransitionInput = {},
  ctx: ServiceCtx = {},
  opts: { notify?: boolean } = {},
): Promise<BookingDTO> {
  const { booking } = await loadVisible(actor, idOrRef);
  try {
    await prisma.$transaction((tx) => applyTransitionTx(tx, actor, booking.id, action, input, ctx));
  } catch (err) {
    if (err instanceof AppError && (err.status === 403 || err.status === 409 || err.status === 422)) {
      await recordAudit(prisma, {
        ...auditActor(actor, ctx), action: `booking.${action}`, entityType: "Booking", entityId: booking.id,
        outcome: "denied", requestId: ctx.requestId, detail: { code: err.code, status: booking.status },
      });
    }
    throw err;
  }
  const event = EVENT_FOR[action];
  if (event && opts.notify !== false) void notifyBooking(booking.id, event);
  return getForActor(actor, booking.id);
}

/** Check a transition without applying it (AI confirm flow, UI hints). */
export async function previewTransition(actor: ServiceActor, idOrRef: string, action: BookingAction, input: TransitionInput = {}) {
  const { booking, party } = await loadVisible(actor, idOrRef);
  const d = decide(action, booking, party, input);
  if (!d.ok) rejectDecision(d, {});
  return { booking: toBookingDTO(booking, party), to: d.to };
}

// ── Reschedule ──────────────────────────────────────────────────────────────

async function resolveReschedule(actor: ServiceActor, idOrRef: string, newStart: Date) {
  const { booking, party } = await loadVisible(actor, idOrRef);
  const customer = party === "client" || party === "guest";
  const staff = party === "provider" || party === "admin";
  const allowed: BookingStatus[] = customer ? ["PENDING", "APPROVED"] : ["PENDING", "APPROVED", "PAID"];
  if (!customer && !staff) throw forbidden();
  if (!allowed.includes(booking.status)) {
    throw conflict("INVALID_TRANSITION", "This booking can't be rescheduled in its current state");
  }
  if (customer && booking.startsAt.getTime() <= Date.now()) {
    throw unprocessable("TRANSITION_BLOCKED", "This appointment has already started");
  }

  let maxAdvanceDays: number | undefined;
  if (booking.whatsappChannelId) {
    maxAdvanceDays = (await prisma.whatsAppChannel.findUnique({ where: { id: booking.whatsappChannelId } }))?.maxAdvanceDays;
  }
  await assertBookableSlot(booking.providerServiceId, newStart, { excludeBookingId: booking.id, maxAdvanceDays });

  // A customer moving an already-approved booking needs the provider to approve again.
  const nextStatus: BookingStatus = customer && booking.status === "APPROVED" ? "PENDING" : booking.status;
  const duration = booking.endsAt.getTime() - booking.startsAt.getTime();
  return { booking, party, nextStatus, newEnd: new Date(newStart.getTime() + duration) };
}

export async function previewReschedule(actor: ServiceActor, idOrRef: string, startsAt: string) {
  const r = await resolveReschedule(actor, idOrRef, new Date(startsAt));
  return { booking: toBookingDTO(r.booking, r.party), newStartsAt: new Date(startsAt).toISOString(), nextStatus: r.nextStatus };
}

export async function reschedule(actor: ServiceActor, idOrRef: string, startsAt: string, ctx: ServiceCtx = {}) {
  const newStart = new Date(startsAt);
  const r = await resolveReschedule(actor, idOrRef, newStart);
  try {
    await prisma.$transaction(async (tx) => {
      const res = await tx.booking.updateMany({
        where: { id: r.booking.id, version: r.booking.version },
        data: { startsAt: newStart, endsAt: r.newEnd, status: r.nextStatus, version: { increment: 1 } },
      });
      if (res.count !== 1) throw conflict("CONCURRENT_UPDATE", "This booking was just changed by someone else. Please refresh.");
      const who = auditActor(actor, ctx);
      await tx.bookingTransition.create({
        data: {
          bookingId: r.booking.id, fromStatus: r.booking.status, toStatus: r.nextStatus, action: "reschedule",
          actorType: who.actorType, actorId: who.actorId,
        },
      });
      await recordAudit(tx, {
        ...who, action: "booking.reschedule", entityType: "Booking", entityId: r.booking.id, outcome: "success",
        requestId: ctx.requestId,
        detail: { from: r.booking.startsAt.toISOString(), to: newStart.toISOString(), status: r.nextStatus },
      });
    });
  } catch (err) {
    if (isSlotConflict(err)) throw conflict("SLOT_TAKEN", "Sorry, that slot was just taken. Please pick another time.");
    throw err;
  }
  void notifyBooking(r.booking.id, "rescheduled");
  return getForActor(actor, r.booking.id);
}
