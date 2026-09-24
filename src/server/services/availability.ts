import { addDays, differenceInCalendarDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { z } from "zod";
import { prisma } from "@/lib/db";
import { auditActor, type ServiceActor, type ServiceCtx } from "@/server/actors";
import { recordAudit } from "@/server/audit";
import { forbidden, notFound, unprocessable } from "@/server/errors";
import { ACTIVE_STATUSES } from "@/server/state/booking.machine";
import type { availabilityRulesSchema, overrideCreateSchema } from "@/server/validation/booking";

// Weekly opening hours + date overrides per provider, and slot generation.
// Times are configured in the provider's timezone and stored/compared in UTC.

export const MIN_LEAD_MINUTES = 60;
export const MAX_ADVANCE_DAYS = 60;

export interface Slot {
  startsAt: string; // ISO UTC
  endsAt: string;
  label: string; // "HH:mm" in the provider's timezone
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h! * 60 + m!;
};
const toHHMM = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

/** Day of week (0 = Sunday) of a calendar date string, independent of any timezone. */
const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

export async function getSlots(
  providerServiceId: string,
  date: string,
  opts: { excludeBookingId?: string; now?: Date; maxAdvanceDays?: number } = {},
): Promise<Slot[]> {
  const now = opts.now ?? new Date();
  const ps = await prisma.providerService.findFirst({
    where: {
      id: providerServiceId,
      isActive: true,
      subService: { isActive: true, category: { isActive: true } },
      provider: { isActive: true, deletedAt: null, role: "PROVIDER" },
    },
    include: { provider: { select: { id: true, timezone: true } } },
  });
  if (!ps) throw notFound("Service");
  const tz = ps.provider.timezone;

  const today = formatInTimeZone(now, tz, "yyyy-MM-dd");
  const ahead = differenceInCalendarDays(new Date(`${date}T00:00:00Z`), new Date(`${today}T00:00:00Z`));
  if (ahead < 0 || ahead > (opts.maxAdvanceDays ?? MAX_ADVANCE_DAYS)) return [];

  const [rule, override] = await Promise.all([
    prisma.availabilityRule.findUnique({
      where: { providerId_dayOfWeek: { providerId: ps.providerId, dayOfWeek: weekday(date) } },
    }),
    prisma.availabilityOverride.findUnique({
      where: { providerId_date: { providerId: ps.providerId, date: new Date(`${date}T00:00:00Z`) } },
    }),
  ]);

  let opens: string | null = null;
  let closes: string | null = null;
  if (override) {
    if (!override.isClosed && override.opensAt && override.closesAt) {
      opens = override.opensAt;
      closes = override.closesAt;
    }
  } else if (rule?.isOpen) {
    opens = rule.opensAt;
    closes = rule.closesAt;
  }
  if (!opens || !closes) return [];

  const earliest = now.getTime() + MIN_LEAD_MINUTES * 60_000;
  const candidates: Slot[] = [];
  for (let m = toMinutes(opens); m + ps.durationMin <= toMinutes(closes); m += ps.durationMin) {
    const start = fromZonedTime(`${date}T${toHHMM(m)}:00`, tz);
    if (start.getTime() < earliest) continue;
    const end = new Date(start.getTime() + ps.durationMin * 60_000);
    candidates.push({ startsAt: start.toISOString(), endsAt: end.toISOString(), label: toHHMM(m) });
  }
  if (!candidates.length) return [];

  const dayStart = new Date(candidates[0]!.startsAt);
  const dayEnd = new Date(candidates.at(-1)!.endsAt);
  const busy = await prisma.booking.findMany({
    where: {
      providerId: ps.providerId,
      status: { in: [...ACTIVE_STATUSES] },
      startsAt: { lt: dayEnd },
      endsAt: { gt: dayStart },
      ...(opts.excludeBookingId ? { id: { not: opts.excludeBookingId } } : {}),
    },
    select: { startsAt: true, endsAt: true },
  });

  return candidates.filter((s) => {
    const a = new Date(s.startsAt).getTime();
    const b = new Date(s.endsAt).getTime();
    return !busy.some((x) => x.startsAt.getTime() < b && x.endsAt.getTime() > a);
  });
}

/**
 * Is `startsAt` exactly one of the free slots for this service? Bookings must
 * land on a generated slot, so a client can't book at 03:17 on a Sunday by
 * crafting the request by hand.
 */
export async function assertBookableSlot(
  providerServiceId: string,
  startsAt: Date,
  opts: { excludeBookingId?: string; maxAdvanceDays?: number } = {},
) {
  const ps = await prisma.providerService.findUnique({
    where: { id: providerServiceId },
    include: { provider: { select: { timezone: true } } },
  });
  if (!ps) throw notFound("Service");
  const date = formatInTimeZone(startsAt, ps.provider.timezone, "yyyy-MM-dd");
  const slots = await getSlots(providerServiceId, date, opts);
  if (!slots.some((s) => new Date(s.startsAt).getTime() === startsAt.getTime())) {
    throw unprocessable("SLOT_UNAVAILABLE", "That time isn't available. Please pick another slot.");
  }
}

/** The next few dates with at least one free slot (used by the WhatsApp bot and the agent). */
export async function nextAvailableDates(providerServiceId: string, count = 5, maxAdvanceDays = MAX_ADVANCE_DAYS) {
  const ps = await prisma.providerService.findUnique({
    where: { id: providerServiceId },
    include: { provider: { select: { timezone: true } } },
  });
  if (!ps) throw notFound("Service");
  const out: string[] = [];
  const start = new Date();
  for (let i = 0; i <= maxAdvanceDays && out.length < count; i++) {
    const date = formatInTimeZone(addDays(start, i), ps.provider.timezone, "yyyy-MM-dd");
    if ((await getSlots(providerServiceId, date, { maxAdvanceDays })).length) out.push(date);
  }
  return out;
}

// ── Managing hours (provider: own; admin: any) ──────────────────────────────

function targetProvider(actor: ServiceActor, providerIdForAdmin?: string) {
  if (actor.kind !== "user") throw forbidden();
  if (actor.user.role === "PROVIDER") return actor.user.id;
  if (actor.user.role === "ADMIN" && providerIdForAdmin) return providerIdForAdmin;
  throw forbidden();
}

export async function getRules(actor: ServiceActor, providerIdForAdmin?: string) {
  const providerId = targetProvider(actor, providerIdForAdmin);
  const [rules, overrides] = await Promise.all([
    prisma.availabilityRule.findMany({ where: { providerId }, orderBy: { dayOfWeek: "asc" } }),
    prisma.availabilityOverride.findMany({
      where: { providerId, date: { gte: new Date(new Date().toISOString().slice(0, 10)) } },
      orderBy: { date: "asc" },
    }),
  ]);
  return {
    rules: rules.map(({ dayOfWeek, isOpen, opensAt, closesAt }) => ({ dayOfWeek, isOpen, opensAt, closesAt })),
    overrides: overrides.map((o) => ({
      id: o.id, date: o.date.toISOString().slice(0, 10), isClosed: o.isClosed,
      opensAt: o.opensAt, closesAt: o.closesAt, reason: o.reason,
    })),
  };
}

/** Replace the weekly schedule. Days not listed become closed. */
export async function setRules(
  actor: ServiceActor,
  input: z.infer<typeof availabilityRulesSchema>,
  ctx: ServiceCtx = {},
  providerIdForAdmin?: string,
) {
  const providerId = targetProvider(actor, providerIdForAdmin);
  await prisma.$transaction(async (tx) => {
    await tx.availabilityRule.deleteMany({ where: { providerId } });
    await tx.availabilityRule.createMany({ data: input.rules.map((r) => ({ ...r, providerId })) });
    await recordAudit(tx, {
      ...auditActor(actor, ctx), action: "availability.set_rules", entityType: "User",
      entityId: providerId, outcome: "success", requestId: ctx.requestId,
      detail: { openDays: input.rules.filter((r) => r.isOpen).map((r) => r.dayOfWeek) },
    });
  });
  return getRules(actor, providerIdForAdmin);
}

export async function addOverride(
  actor: ServiceActor,
  input: z.infer<typeof overrideCreateSchema>,
  ctx: ServiceCtx = {},
  providerIdForAdmin?: string,
) {
  const providerId = targetProvider(actor, providerIdForAdmin);
  const date = new Date(`${input.date}T00:00:00Z`);
  const row = await prisma.availabilityOverride.upsert({
    where: { providerId_date: { providerId, date } },
    create: { providerId, date, isClosed: input.isClosed, opensAt: input.opensAt, closesAt: input.closesAt, reason: input.reason },
    update: { isClosed: input.isClosed, opensAt: input.opensAt ?? null, closesAt: input.closesAt ?? null, reason: input.reason ?? null },
  });
  await recordAudit(prisma, {
    ...auditActor(actor, ctx), action: "availability.override", entityType: "AvailabilityOverride",
    entityId: row.id, outcome: "success", requestId: ctx.requestId, detail: { date: input.date, isClosed: input.isClosed },
  });
  return row;
}

export async function removeOverride(actor: ServiceActor, overrideId: string, ctx: ServiceCtx = {}) {
  if (actor.kind !== "user" || (actor.user.role !== "PROVIDER" && actor.user.role !== "ADMIN")) throw forbidden();
  // Scoped delete: a provider can only remove their own overrides; admins any.
  const scope = actor.user.role === "ADMIN" ? {} : { providerId: actor.user.id };
  const res = await prisma.availabilityOverride.deleteMany({ where: { id: overrideId, ...scope } });
  if (res.count === 0) throw notFound("Override");
  await recordAudit(prisma, {
    ...auditActor(actor, ctx), action: "availability.override_remove", entityType: "AvailabilityOverride",
    entityId: overrideId, outcome: "success", requestId: ctx.requestId,
  });
}
