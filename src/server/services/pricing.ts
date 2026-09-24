import type { PricingType } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "@/lib/db";
import { auditActor, type ServiceActor, type ServiceCtx } from "@/server/actors";
import { recordAudit } from "@/server/audit";
import { forbidden, notFound, unprocessable } from "@/server/errors";
import type { providerServiceUpsertSchema } from "@/server/validation/booking";

// Provider-specific pricing for sub-services.

/** Price of one booking, computed server-side only (audit H-2, H-3). */
export function priceFor(ps: { pricingType: PricingType; rateCents: number; durationMin: number }): number {
  return ps.pricingType === "FIXED" ? ps.rateCents : Math.round((ps.rateCents * ps.durationMin) / 60);
}

/** Public listing: providers offering a sub-service. Names and prices only — no contact details. */
export async function listProvidersForSubService(subServiceId: string) {
  const rows = await prisma.providerService.findMany({
    where: {
      subServiceId,
      isActive: true,
      subService: { isActive: true, category: { isActive: true } },
      provider: { isActive: true, deletedAt: null, role: "PROVIDER" },
    },
    include: { provider: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { rateCents: "asc" },
  });
  return rows.map((r) => ({
    providerServiceId: r.id,
    providerId: r.provider.id,
    providerName: `${r.provider.firstName} ${r.provider.lastName}`,
    pricingType: r.pricingType,
    rateCents: r.rateCents,
    priceCents: priceFor(r),
    currency: r.currency,
    durationMin: r.durationMin,
    paymentMode: r.paymentMode,
  }));
}

/** Resolve which provider's pricing an actor may manage. */
function targetProvider(actor: ServiceActor, providerIdForAdmin?: string): string {
  if (actor.kind !== "user") throw forbidden();
  if (actor.user.role === "PROVIDER") return actor.user.id; // always self, whatever was asked
  if (actor.user.role === "ADMIN" && providerIdForAdmin) return providerIdForAdmin;
  throw forbidden();
}

export async function listOwnServices(actor: ServiceActor, providerIdForAdmin?: string) {
  const providerId = targetProvider(actor, providerIdForAdmin);
  const rows = await prisma.providerService.findMany({
    where: { providerId },
    include: { subService: { include: { category: { select: { name: true } } } } },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    subServiceId: r.subServiceId,
    serviceName: r.subService.name,
    category: r.subService.category.name,
    pricingType: r.pricingType,
    rateCents: r.rateCents,
    priceCents: priceFor(r),
    currency: r.currency,
    durationMin: r.durationMin,
    paymentMode: r.paymentMode,
    isActive: r.isActive,
  }));
}

export async function upsertOwnService(
  actor: ServiceActor,
  input: z.infer<typeof providerServiceUpsertSchema>,
  ctx: ServiceCtx = {},
  providerIdForAdmin?: string,
) {
  const providerId = targetProvider(actor, providerIdForAdmin);
  const provider = await prisma.user.findFirst({ where: { id: providerId, role: "PROVIDER", deletedAt: null } });
  if (!provider) throw notFound("Provider");
  const sub = await prisma.subService.findFirst({ where: { id: input.subServiceId, isActive: true } });
  if (!sub) throw unprocessable("SERVICE_UNAVAILABLE", "That service isn't available");

  return prisma.$transaction(async (tx) => {
    const row = await tx.providerService.upsert({
      where: { providerId_subServiceId: { providerId, subServiceId: input.subServiceId } },
      create: { ...input, providerId },
      update: input,
    });
    await recordAudit(tx, {
      ...auditActor(actor, ctx), action: "pricing.upsert", entityType: "ProviderService",
      entityId: row.id, outcome: "success", requestId: ctx.requestId,
      detail: { rateCents: input.rateCents, pricingType: input.pricingType, isActive: input.isActive },
    });
    return row;
  });
}
