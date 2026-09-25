import type { Role } from "@prisma/client";
import { z, type ZodTypeAny } from "zod";
import type { Actor } from "@/server/auth/currentUser";
import type { ServiceActor, ServiceCtx } from "@/server/actors";
import { prisma } from "@/lib/db";
import { forbidden, notFound } from "@/server/errors";
import { getSlots } from "@/server/services/availability";
import * as bookings from "@/server/services/booking";
import { getSubService, searchServices } from "@/server/services/catalog";
import { getLatestForActor, requestPayment } from "@/server/services/payment";
import { listProvidersForSubService, upsertOwnService } from "@/server/services/pricing";
import { clientSpending, listAuditEvents, platformMetrics, providerEarnings } from "@/server/services/reports";
import { listUsers, updateUser } from "@/server/services/users";
import type { BookingDTO } from "@/server/dto/booking";
import { formatInTimeZone } from "date-fns-tz";
import { HELP_TOPICS } from "../prompts/help";

// The assistant's tool catalogue (design §6.3).
//
// Rules every tool follows:
//   - The actor comes from the session, passed in by the executor. No tool
//     takes a user id, role, status or amount from the model.
//   - Bookings are referred to by their public reference (AH-XXXXXX); access
//     is decided by the booking service exactly as for the web UI.
//   - Results are minimal DTOs: no internal ids, emails, phone numbers,
//     notes or feedback text (untrusted free text is prompt-injection bait).
//   - WRITE tools implement preview() (all checks, no changes, returns a
//     server-written summary) and execute(). The executor only ever calls
//     preview(); execute() runs after the user confirms (orchestration/actions).

export type ToolKind = "read" | "write";

export interface ToolDef<S extends ZodTypeAny = ZodTypeAny> {
  name: string;
  description: string;
  kind: ToolKind;
  roles: readonly Role[];
  input: S;
  read?: (actor: ServiceActor, args: z.infer<S>, user: Actor) => Promise<unknown>;
  preview?: (actor: ServiceActor, args: z.infer<S>, user: Actor) => Promise<string>;
  execute?: (actor: ServiceActor, args: z.infer<S>, ctx: ServiceCtx, user: Actor) => Promise<unknown>;
}

const define = <S extends ZodTypeAny>(t: ToolDef<S>) => t;

const reference = z.string().regex(/^[A-Z]{2}-[0-9A-Z]{6}$/i).describe("Booking reference, e.g. AH-7K3P9Q");
const isoTime = z.string().datetime({ offset: true }).describe("Slot start time exactly as returned by getAvailability (ISO 8601)");
const ALL: Role[] = ["CLIENT", "PROVIDER", "ADMIN"];

const money = (cents: number, currency = "ZAR") => `${currency} ${(cents / 100).toFixed(2)}`;

/** What the model may see about a booking. */
function agentBooking(b: BookingDTO, tz: string) {
  return {
    reference: b.reference,
    status: b.status,
    service: b.serviceName,
    provider: b.provider.name,
    customer: b.customer.name,
    when: formatInTimeZone(new Date(b.startsAt), tz, "EEE d MMM yyyy, HH:mm"),
    price: money(b.priceCents, b.currency),
    paymentMode: b.paymentMode,
    channel: b.channel,
    actionsYouCanTake: b.availableActions,
  };
}

async function describeBooking(actor: ServiceActor, ref: string, tz: string) {
  const b = await bookings.getForActor(actor, ref);
  return `${b.serviceName} with ${b.provider.name} on ${formatInTimeZone(new Date(b.startsAt), tz, "EEE d MMM, HH:mm")} (${b.reference})`;
}

// ── Read tools ──────────────────────────────────────────────────────────────

const searchServicesTool = define({
  name: "searchServices",
  description: "Search the service catalogue by keyword. Returns services with how many providers offer them and the lowest price.",
  kind: "read",
  roles: ALL,
  input: z.object({ query: z.string().max(100).describe("Keywords, e.g. 'haircut'. Empty lists everything.") }).strict(),
  read: async (_a, { query }) =>
    (await searchServices(query)).map((s) => ({
      serviceId: s.id, name: s.name, category: s.category, providers: s.providerCount,
      fromPrice: s.fromPriceCents === null ? null : money(s.fromPriceCents, s.currency),
    })),
});

const listProvidersTool = define({
  name: "listProvidersForService",
  description: "List providers offering a service, with price, duration and payment mode. Use the returned optionId to check availability or book.",
  kind: "read",
  roles: ALL,
  input: z.object({ serviceId: z.string().max(40).describe("serviceId from searchServices") }).strict(),
  read: async (_a, { serviceId }) => {
    const service = await getSubService(serviceId);
    return {
      service: service.name,
      options: (await listProvidersForSubService(serviceId)).map((p) => ({
        optionId: p.providerServiceId, provider: p.providerName, price: money(p.priceCents, p.currency),
        durationMinutes: p.durationMin, paymentMode: p.paymentMode,
      })),
    };
  },
});

const availabilityTool = define({
  name: "getAvailability",
  description: "Free appointment slots for a provider's service on one date (provider's local time). Only these times can be booked.",
  kind: "read",
  roles: ALL,
  input: z
    .object({
      optionId: z.string().max(40).describe("optionId from listProvidersForService"),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("YYYY-MM-DD"),
    })
    .strict(),
  read: async (_a, { optionId, date }) => ({ date, slots: (await getSlots(optionId, date)).map((s) => ({ startsAt: s.startsAt, time: s.label })) }),
});

const listMyBookingsTool = define({
  name: "listMyBookings",
  description: "List bookings visible to the current user (clients: their own; providers: bookings with them; admins: all).",
  kind: "read",
  roles: ALL,
  input: z
    .object({
      status: z.enum(["PENDING", "APPROVED", "PAYMENT_PENDING", "PAID", "PAYMENT_FAILED", "COMPLETED", "CANCELLED", "DECLINED"]).optional(),
      scope: z.enum(["upcoming", "past", "all"]).optional(),
    })
    .strict(),
  read: async (actor, { status, scope }, user) => {
    const r = await bookings.listForActor(actor, { page: 1, pageSize: 20, status, scope: scope ?? "upcoming" });
    return { total: r.total, bookings: r.data.map((b) => agentBooking(b, user.timezone)) };
  },
});

const bookingDetailsTool = define({
  name: "getBookingDetails",
  description: "Details of one booking by reference, including which actions the current user can take on it.",
  kind: "read",
  roles: ALL,
  input: z.object({ reference }).strict(),
  read: async (actor, { reference: ref }, user) => agentBooking(await bookings.getForActor(actor, ref), user.timezone),
});

const paymentStatusTool = define({
  name: "getPaymentStatus",
  description: "Latest payment status for a booking, as recorded from the payment provider. Never guess payment status — use this.",
  kind: "read",
  roles: ALL,
  input: z.object({ reference }).strict(),
  read: async (actor, { reference: ref }) => {
    const p = await getLatestForActor(actor, ref);
    return p ? { status: p.status, amount: money(p.amountCents, p.currency), paidAt: p.paidAt, payLinkAvailable: Boolean(p.checkoutUrl) } : { status: "NO_PAYMENT_REQUESTED" };
  },
});

const earningsTool = define({
  name: "getMyEarnings",
  description: "The provider's earnings summary (paid/completed bookings) for the last N days.",
  kind: "read",
  roles: ["PROVIDER"],
  input: z.object({ days: z.number().int().min(1).max(365).optional() }).strict(),
  read: async (actor, { days }) => summarizeMoney(await providerEarnings(actor, days ?? 30)),
});

const spendingTool = define({
  name: "getMySpending",
  description: "The client's spending summary for the last N days.",
  kind: "read",
  roles: ["CLIENT"],
  input: z.object({ days: z.number().int().min(1).max(365).optional() }).strict(),
  read: async (actor, { days }) => summarizeMoney(await clientSpending(actor, days ?? 30)),
});

function summarizeMoney(s: Awaited<ReturnType<typeof providerEarnings>>) {
  return {
    periodDays: s.periodDays,
    periodTotal: money(s.periodTotalCents),
    periodBookings: s.periodBookings,
    allTimeTotal: money(s.allTimeTotalCents),
    upcomingBookings: s.upcomingBookings,
    byService: s.byService.map((x) => ({ service: x.service, total: money(x.totalCents), bookings: x.bookings })),
  };
}

const metricsTool = define({
  name: "getPlatformMetrics",
  description: "Platform-wide metrics for admins: users by role, bookings by status/channel, revenue, AI usage.",
  kind: "read",
  roles: ["ADMIN"],
  input: z.object({ days: z.number().int().min(1).max(365).optional() }).strict(),
  read: async (actor, { days }) => platformMetrics(actor, days ?? 30),
});

const usersTool = define({
  name: "listUsers",
  description: "Find users (admins only). Emails are partially masked.",
  kind: "read",
  roles: ["ADMIN"],
  input: z.object({ query: z.string().max(100).optional(), role: z.enum(["ADMIN", "PROVIDER", "CLIENT"]).optional() }).strict(),
  read: async (actor, { query, role }) => {
    const r = await listUsers(actor, { page: 1, pageSize: 20, q: query, role });
    return {
      total: r.total,
      users: r.data.map((u) => ({
        name: `${u.firstName} ${u.lastName}`,
        email: u.email.replace(/^(.)[^@]*(@.*)$/, "$1***$2"),
        role: u.role,
        active: u.isActive,
      })),
    };
  },
});

const auditTool = define({
  name: "getAuditEvents",
  description: "Recent audit events (admins only), optionally filtered by action prefix such as 'booking.' or 'user.role_change'.",
  kind: "read",
  roles: ["ADMIN"],
  input: z.object({ action: z.string().max(60).optional(), limit: z.number().int().min(1).max(50).optional() }).strict(),
  read: async (actor, { action, limit }) =>
    (await listAuditEvents(actor, { action, limit: limit ?? 20 })).map((e) => ({
      at: e.at, action: e.action, outcome: e.outcome, actorType: e.actorType, actorRole: e.actorRole, entityType: e.entityType,
    })),
});

const helpTool = define({
  name: "getPlatformHelp",
  description: "How-to help for Appointment Hub features.",
  kind: "read",
  roles: ALL,
  input: z.object({ topic: z.enum(Object.keys(HELP_TOPICS) as [string, ...string[]]) }).strict(),
  read: async (_a, { topic }) => ({ topic, help: HELP_TOPICS[topic as keyof typeof HELP_TOPICS] }),
});

// ── Write tools (preview → user confirms → execute) ─────────────────────────

const createBookingTool = define({
  name: "createBookingRequest",
  description: "Prepare a booking request for the current client. Requires an optionId and a startsAt from getAvailability. The user must confirm it.",
  kind: "write",
  roles: ["CLIENT"],
  input: z.object({ optionId: z.string().max(40), startsAt: isoTime, notes: z.string().max(500).optional() }).strict(),
  preview: async (actor, a) => {
    const p = await bookings.previewCreate(actor, { providerServiceId: a.optionId, startsAt: a.startsAt, notes: a.notes }, undefined, { viaAgent: true });
    return `Book ${p.serviceName} with ${p.providerName} on ${p.localTime} (${p.durationMin} min) for ${money(p.priceCents, p.currency)}${p.paymentMode === "ON_SITE" ? ", paid on site" : ""}.`;
  },
  execute: async (actor, a, ctx) => {
    const b = await bookings.create(actor, { providerServiceId: a.optionId, startsAt: a.startsAt, notes: a.notes }, ctx);
    return { reference: b.reference, status: b.status };
  },
});

const transitionTool = (name: string, action: "approve" | "decline" | "cancel" | "complete" | "noShow", roles: Role[], verb: string, needsReason = false) =>
  define({
    name,
    description: `${verb} a booking by reference. The user must confirm it.${needsReason ? " A short reason is required." : ""}`,
    kind: "write",
    roles,
    input: needsReason
      ? z.object({ reference, reason: z.string().min(3).max(300) }).strict()
      : z.object({ reference, reason: z.string().max(300).optional() }).strict(),
    preview: async (actor, a, user) => {
      await bookings.previewTransition(actor, a.reference, action, { reason: a.reason });
      return `${verb} ${await describeBooking(actor, a.reference, user.timezone)}${a.reason ? ` — reason: "${a.reason}"` : ""}.`;
    },
    execute: async (actor, a, ctx) => {
      const b = await bookings.transition(actor, a.reference, action, { reason: a.reason }, ctx);
      return { reference: b.reference, status: b.status };
    },
  });

const rescheduleTool = define({
  name: "rescheduleBooking",
  description: "Move a booking to a new free slot (from getAvailability). Clients moving an approved booking need the provider to approve again. The user must confirm.",
  kind: "write",
  roles: ["CLIENT", "PROVIDER"],
  input: z.object({ reference, startsAt: isoTime }).strict(),
  preview: async (actor, a, user) => {
    const p = await bookings.previewReschedule(actor, a.reference, a.startsAt);
    const when = formatInTimeZone(new Date(p.newStartsAt), user.timezone, "EEE d MMM, HH:mm");
    return `Move ${await describeBooking(actor, a.reference, user.timezone)} to ${when}${p.nextStatus === "PENDING" && p.booking.status !== "PENDING" ? " (the provider will need to approve the new time)" : ""}.`;
  },
  execute: async (actor, a, ctx) => {
    const b = await bookings.reschedule(actor, a.reference, a.startsAt, ctx);
    return { reference: b.reference, status: b.status, startsAt: b.startsAt };
  },
});

const requestPaymentTool = define({
  name: "requestPayment",
  description: "Send the client a payment link for an approved booking (online-paid services only). Amount is the booking's price. The user must confirm.",
  kind: "write",
  roles: ["PROVIDER"],
  input: z.object({ reference }).strict(),
  preview: async (actor, a, user) => {
    const { booking } = await bookings.previewTransition(actor, a.reference, "requestPayment");
    return `Request ${money(booking.priceCents, booking.currency)} from the client for ${await describeBooking(actor, a.reference, user.timezone)}.`;
  },
  execute: async (actor, a, ctx) => {
    const p = await requestPayment(actor, a.reference, ctx);
    return { status: p?.status ?? "PENDING" };
  },
});

const setPriceTool = define({
  name: "setServicePrice",
  description: "Set the current provider's price, duration and payment mode for a service they offer (or start offering it). The user must confirm.",
  kind: "write",
  roles: ["PROVIDER"],
  input: z
    .object({
      serviceId: z.string().max(40),
      pricingType: z.enum(["FIXED", "HOURLY"]),
      priceRand: z.number().min(0).max(100000).describe("Price in rand (ZAR)"),
      durationMinutes: z.number().int().min(5).max(720),
      paymentMode: z.enum(["ONLINE", "ON_SITE"]).optional(),
    })
    .strict(),
  preview: async (_actor, a) => {
    const s = await getSubService(a.serviceId);
    return `Set ${s.name} to ${money(Math.round(a.priceRand * 100))}${a.pricingType === "HOURLY" ? " per hour" : ""}, ${a.durationMinutes} min, ${a.paymentMode === "ON_SITE" ? "paid on site" : "paid online"}.`;
  },
  execute: async (actor, a, ctx) => {
    const r = await upsertOwnService(actor, {
      subServiceId: a.serviceId, pricingType: a.pricingType, rateCents: Math.round(a.priceRand * 100),
      durationMin: a.durationMinutes, paymentMode: a.paymentMode ?? "ONLINE", isActive: true,
    }, ctx);
    return { ok: true, rateCents: r.rateCents };
  },
});

const roleTool = define({
  name: "updateUserRole",
  description: "Change a user's role (admins only). Identify the user by exact email. The admin must confirm.",
  kind: "write",
  roles: ["ADMIN"],
  input: z.object({ email: z.string().email().max(254), role: z.enum(["ADMIN", "PROVIDER", "CLIENT"]) }).strict(),
  preview: async (actor, a) => {
    if (actor.kind !== "user" || actor.user.role !== "ADMIN") throw forbidden();
    const u = await prisma.user.findFirst({ where: { email: a.email.toLowerCase(), deletedAt: null } });
    if (!u) throw notFound("User");
    return `Change ${u.firstName} ${u.lastName} (${u.email}) from ${u.role} to ${a.role}. They will be signed out everywhere.`;
  },
  execute: async (actor, a, ctx) => {
    const u = await prisma.user.findFirst({ where: { email: a.email.toLowerCase(), deletedAt: null } });
    if (!u) throw notFound("User");
    const r = await updateUser(actor, u.id, { role: a.role }, ctx);
    return { role: r.role };
  },
});

export const TOOLS: Record<string, ToolDef> = Object.fromEntries(
  [
    searchServicesTool, listProvidersTool, availabilityTool, listMyBookingsTool, bookingDetailsTool, paymentStatusTool,
    earningsTool, spendingTool, metricsTool, usersTool, auditTool, helpTool,
    createBookingTool,
    transitionTool("approveBooking", "approve", ["PROVIDER"], "Approve"),
    transitionTool("declineBooking", "decline", ["PROVIDER"], "Decline", true),
    transitionTool("cancelBooking", "cancel", ["CLIENT", "PROVIDER"], "Cancel"),
    transitionTool("markCompleted", "complete", ["PROVIDER"], "Mark as completed"),
    transitionTool("markNoShow", "noShow", ["PROVIDER"], "Mark as no-show"),
    rescheduleTool, requestPaymentTool, setPriceTool, roleTool,
  // Widened to the common shape; the executor validates args with each tool's own schema.
  ].map((t) => [t.name, t as unknown as ToolDef]),
);

export function toolsForRole(role: Role): ToolDef[] {
  return Object.values(TOOLS).filter((t) => t.roles.includes(role));
}

