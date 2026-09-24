import type { z } from "zod";
import { prisma } from "@/lib/db";
import { auditActor, isAdmin, type ServiceActor, type ServiceCtx } from "@/server/actors";
import { recordAudit } from "@/server/audit";
import { forbidden, notFound } from "@/server/errors";
import type {
  categoryCreateSchema,
  categoryUpdateSchema,
  subServiceCreateSchema,
  subServiceUpdateSchema,
} from "@/server/validation/booking";

// Service categories and sub-services. Everyone can browse ACTIVE entries;
// only admins see inactive ones or make changes.

function requireAdmin(actor: ServiceActor) {
  if (!isAdmin(actor)) throw forbidden();
}

export async function listCategories(actor: ServiceActor | null) {
  const includeInactive = actor ? isAdmin(actor) : false;
  const rows = await prisma.serviceCategory.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      subServices: {
        where: includeInactive ? {} : { isActive: true },
        orderBy: { name: "asc" },
        include: {
          _count: { select: { providerServices: { where: { isActive: true, provider: { isActive: true } } } } },
        },
      },
    },
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    isActive: c.isActive,
    subServices: c.subServices.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      defaultDuration: s.defaultDuration,
      isActive: s.isActive,
      providerCount: s._count.providerServices,
    })),
  }));
}

/** Free-text search over active sub-services, with the price range on offer. */
export async function searchServices(query: string) {
  const q = query.trim();
  const subs = await prisma.subService.findMany({
    where: {
      isActive: true,
      category: { isActive: true },
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { category: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    take: 25,
    orderBy: { name: "asc" },
    include: {
      category: { select: { name: true } },
      providerServices: {
        where: { isActive: true, provider: { isActive: true, deletedAt: null } },
        select: { rateCents: true, currency: true, pricingType: true },
      },
    },
  });
  return subs.map((s) => {
    const rates = s.providerServices.map((p) => p.rateCents);
    return {
      id: s.id,
      name: s.name,
      category: s.category.name,
      description: s.description,
      providerCount: s.providerServices.length,
      fromPriceCents: rates.length ? Math.min(...rates) : null,
      currency: s.providerServices[0]?.currency ?? "ZAR",
    };
  });
}

export async function getSubService(id: string) {
  const s = await prisma.subService.findFirst({
    where: { id, isActive: true, category: { isActive: true } },
    include: { category: { select: { id: true, name: true } } },
  });
  if (!s) throw notFound("Service");
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    defaultDuration: s.defaultDuration,
    category: s.category,
  };
}

export async function createCategory(actor: ServiceActor, input: z.infer<typeof categoryCreateSchema>, ctx: ServiceCtx = {}) {
  requireAdmin(actor);
  return prisma.$transaction(async (tx) => {
    const row = await tx.serviceCategory.create({ data: input });
    await recordAudit(tx, {
      ...auditActor(actor, ctx), action: "catalog.category_create", entityType: "ServiceCategory",
      entityId: row.id, outcome: "success", requestId: ctx.requestId,
    });
    return row;
  });
}

export async function updateCategory(actor: ServiceActor, id: string, input: z.infer<typeof categoryUpdateSchema>, ctx: ServiceCtx = {}) {
  requireAdmin(actor);
  return prisma.$transaction(async (tx) => {
    const row = await tx.serviceCategory.update({ where: { id }, data: input });
    await recordAudit(tx, {
      ...auditActor(actor, ctx), action: "catalog.category_update", entityType: "ServiceCategory",
      entityId: id, outcome: "success", requestId: ctx.requestId, detail: { fields: Object.keys(input) },
    });
    return row;
  });
}

export async function createSubService(actor: ServiceActor, input: z.infer<typeof subServiceCreateSchema>, ctx: ServiceCtx = {}) {
  requireAdmin(actor);
  return prisma.$transaction(async (tx) => {
    const row = await tx.subService.create({ data: input });
    await recordAudit(tx, {
      ...auditActor(actor, ctx), action: "catalog.subservice_create", entityType: "SubService",
      entityId: row.id, outcome: "success", requestId: ctx.requestId,
    });
    return row;
  });
}

export async function updateSubService(actor: ServiceActor, id: string, input: z.infer<typeof subServiceUpdateSchema>, ctx: ServiceCtx = {}) {
  requireAdmin(actor);
  return prisma.$transaction(async (tx) => {
    const row = await tx.subService.update({ where: { id }, data: input });
    await recordAudit(tx, {
      ...auditActor(actor, ctx), action: "catalog.subservice_update", entityType: "SubService",
      entityId: id, outcome: "success", requestId: ctx.requestId, detail: { fields: Object.keys(input) },
    });
    return row;
  });
}
