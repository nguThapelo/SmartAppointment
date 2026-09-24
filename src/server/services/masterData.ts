import { z } from "zod";
import { prisma } from "@/lib/db";
import { auditActor, isAdmin, type ServiceActor, type ServiceCtx } from "@/server/actors";
import { recordAudit } from "@/server/audit";
import { forbidden } from "@/server/errors";

// Reusable reference values (e.g. "cancellation reasons", "languages") that
// admins manage and the UI renders as dropdowns.

export const masterTypeSchema = z
  .object({
    code: z.string().trim().regex(/^[a-z][a-z0-9_]{1,40}$/, "lower_snake_case code"),
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().max(300).optional(),
  })
  .strict();

export const masterItemSchema = z
  .object({
    typeCode: z.string().trim().max(41),
    label: z.string().trim().min(1).max(80),
    value: z.string().trim().min(1).max(80),
    sortOrder: z.number().int().min(0).max(1000).default(0),
    isActive: z.boolean().default(true),
  })
  .strict();

export async function listMasterData(actor: ServiceActor | null) {
  const all = actor ? isAdmin(actor) : false;
  const types = await prisma.masterDataType.findMany({
    where: all ? {} : { isActive: true },
    orderBy: { name: "asc" },
    include: { items: { where: all ? {} : { isActive: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] } },
  });
  return types.map((t) => ({
    code: t.code,
    name: t.name,
    description: t.description,
    isActive: t.isActive,
    items: t.items.map((i) => ({ id: i.id, label: i.label, value: i.value, sortOrder: i.sortOrder, isActive: i.isActive })),
  }));
}

export async function upsertType(actor: ServiceActor, input: z.infer<typeof masterTypeSchema>, ctx: ServiceCtx = {}) {
  if (!isAdmin(actor)) throw forbidden();
  const row = await prisma.masterDataType.upsert({
    where: { code: input.code },
    create: input,
    update: { name: input.name, description: input.description },
  });
  await recordAudit(prisma, {
    ...auditActor(actor, ctx), action: "masterdata.type_upsert", entityType: "MasterDataType",
    entityId: row.id, outcome: "success", requestId: ctx.requestId,
  });
  return row;
}

export async function upsertItem(actor: ServiceActor, input: z.infer<typeof masterItemSchema>, ctx: ServiceCtx = {}) {
  if (!isAdmin(actor)) throw forbidden();
  const type = await prisma.masterDataType.findUniqueOrThrow({ where: { code: input.typeCode } });
  const data = { label: input.label, value: input.value, sortOrder: input.sortOrder, isActive: input.isActive };
  const row = await prisma.masterDataItem.upsert({
    where: { typeId_value: { typeId: type.id, value: input.value } },
    create: { ...data, typeId: type.id },
    update: { label: data.label, sortOrder: data.sortOrder, isActive: data.isActive },
  });
  await recordAudit(prisma, {
    ...auditActor(actor, ctx), action: "masterdata.item_upsert", entityType: "MasterDataItem",
    entityId: row.id, outcome: "success", requestId: ctx.requestId,
  });
  return row;
}
