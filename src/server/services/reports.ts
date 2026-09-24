import type { BookingStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isAdmin, type ServiceActor } from "@/server/actors";
import { forbidden } from "@/server/errors";

// Aggregates for dashboards and the AI assistant. Every function scopes to the
// actor: providers see their own earnings, clients their own spending, admins
// the platform. Money counts only bookings that were actually paid or done.

const EARNED: BookingStatus[] = ["PAID", "COMPLETED", "CLOSED"];

export const periodSchema = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }).strict();

function since(days: number) {
  return new Date(Date.now() - days * 86400_000);
}

async function moneySummary(where: Prisma.BookingWhereInput, days: number) {
  const window = { ...where, startsAt: { gte: since(days) } };
  const [period, allTime, byService, upcoming] = await Promise.all([
    prisma.booking.aggregate({ where: { ...window, status: { in: EARNED } }, _sum: { priceCents: true }, _count: true }),
    prisma.booking.aggregate({ where: { ...where, status: { in: EARNED } }, _sum: { priceCents: true }, _count: true }),
    prisma.booking.groupBy({
      by: ["serviceName"],
      where: { ...window, status: { in: EARNED } },
      _sum: { priceCents: true },
      _count: true,
      orderBy: { _sum: { priceCents: "desc" } },
      take: 10,
    }),
    prisma.booking.count({ where: { ...where, startsAt: { gte: new Date() }, status: { in: ["PENDING", "APPROVED", "PAYMENT_PENDING", "PAID"] } } }),
  ]);
  return {
    periodDays: days,
    currency: "ZAR",
    periodTotalCents: period._sum.priceCents ?? 0,
    periodBookings: period._count,
    allTimeTotalCents: allTime._sum.priceCents ?? 0,
    allTimeBookings: allTime._count,
    upcomingBookings: upcoming,
    byService: byService.map((s) => ({ service: s.serviceName, totalCents: s._sum.priceCents ?? 0, bookings: s._count })),
  };
}

export async function providerEarnings(actor: ServiceActor, days = 30) {
  if (actor.kind !== "user" || actor.user.role !== "PROVIDER") throw forbidden();
  return moneySummary({ providerId: actor.user.id }, days);
}

export async function clientSpending(actor: ServiceActor, days = 30) {
  if (actor.kind !== "user" || actor.user.role !== "CLIENT") throw forbidden();
  return moneySummary({ clientId: actor.user.id }, days);
}

export async function platformMetrics(actor: ServiceActor, days = 30) {
  if (!isAdmin(actor)) throw forbidden();
  const from = since(days);
  const [usersByRole, bookingsByStatus, bookingsByChannel, revenue, aiToolOutcomes, aiUsage] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], where: { deletedAt: null }, _count: true }),
    prisma.booking.groupBy({ by: ["status"], where: { createdAt: { gte: from } }, _count: true }),
    prisma.booking.groupBy({ by: ["channel"], where: { createdAt: { gte: from } }, _count: true }),
    prisma.booking.aggregate({ where: { startsAt: { gte: from }, status: { in: EARNED } }, _sum: { priceCents: true } }),
    prisma.agentToolCall.groupBy({ by: ["outcome"], where: { createdAt: { gte: from } }, _count: true }),
    prisma.aiUsage.aggregate({ where: { scope: "global", day: { gte: from } }, _sum: { requests: true, inputTokens: true, outputTokens: true } }),
  ]);
  const count = <R extends { _count: number }>(rows: R[], key: (r: R) => string) =>
    Object.fromEntries(rows.map((r) => [key(r), r._count]));
  return {
    periodDays: days,
    usersByRole: count(usersByRole, (r) => r.role),
    bookingsByStatus: count(bookingsByStatus, (r) => r.status),
    bookingsByChannel: count(bookingsByChannel, (r) => r.channel),
    revenueCents: revenue._sum.priceCents ?? 0,
    currency: "ZAR",
    ai: {
      requests: aiUsage._sum.requests ?? 0,
      inputTokens: aiUsage._sum.inputTokens ?? 0,
      outputTokens: aiUsage._sum.outputTokens ?? 0,
      toolCallOutcomes: count(aiToolOutcomes, (r) => r.outcome),
    },
  };
}

export const auditQuerySchema = z
  .object({
    action: z.string().trim().max(60).optional(),
    entityId: z.string().trim().max(40).optional(),
    actorId: z.string().trim().max(40).optional(),
    outcome: z.enum(["success", "denied", "failed"]).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  })
  .strict();

export async function listAuditEvents(actor: ServiceActor, q: z.infer<typeof auditQuerySchema>) {
  if (!isAdmin(actor)) throw forbidden();
  const rows = await prisma.auditEvent.findMany({
    where: {
      ...(q.action ? { action: { startsWith: q.action } } : {}),
      ...(q.entityId ? { entityId: q.entityId } : {}),
      ...(q.actorId ? { actorId: q.actorId } : {}),
      ...(q.outcome ? { outcome: q.outcome } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: q.limit,
  });
  return rows.map((e) => ({
    id: e.id, at: e.createdAt.toISOString(), action: e.action, outcome: e.outcome,
    actorType: e.actorType, actorId: e.actorId, actorRole: e.actorRole,
    entityType: e.entityType, entityId: e.entityId, requestId: e.requestId, detail: e.detail,
  }));
}
