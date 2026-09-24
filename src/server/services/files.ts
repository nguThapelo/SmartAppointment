import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { storageGateway } from "@/lib/s3";
import { auditActor, type ServiceActor, type ServiceCtx } from "@/server/actors";
import { recordAudit } from "@/server/audit";
import { forbidden, notFound, unprocessable } from "@/server/errors";
import { loadVisible } from "@/server/services/booking";

// Booking attachments (e.g. a prescription, a quote) stored in S3.
// Only people who can see the booking can upload to it or download from it.

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg"] as const;

export const uploadRequestSchema = z
  .object({
    fileName: z.string().trim().min(1).max(120),
    contentType: z.enum(ALLOWED_TYPES),
    size: z.number().int().positive().max(MAX_FILE_BYTES),
  })
  .strict();

export async function requestUpload(actor: ServiceActor, bookingKey: string, input: z.infer<typeof uploadRequestSchema>, ctx: ServiceCtx = {}) {
  if (actor.kind !== "user") throw forbidden();
  const { booking } = await loadVisible(actor, bookingKey);
  // The object key never contains the user's file name (no path tricks, no PII in keys).
  const key = `bookings/${booking.id}/${randomUUID()}`;
  const file = await prisma.fileAsset.create({
    data: { key, ownerId: actor.user.id, bookingId: booking.id, fileName: input.fileName, contentType: input.contentType, size: input.size },
  });
  const uploadUrl = await storageGateway().uploadUrl(key, input.contentType, input.size);
  await recordAudit(prisma, {
    ...auditActor(actor, ctx), action: "file.upload_requested", entityType: "FileAsset", entityId: file.id,
    outcome: "success", requestId: ctx.requestId, detail: { bookingId: booking.id, size: input.size },
  });
  return { fileId: file.id, uploadUrl, method: "PUT", headers: { "Content-Type": input.contentType } };
}

/** Called after the browser's PUT: checks the object really is there and matches what was approved. */
export async function confirmUpload(actor: ServiceActor, fileId: string) {
  if (actor.kind !== "user") throw forbidden();
  const file = await prisma.fileAsset.findFirst({ where: { id: fileId, ownerId: actor.user.id } });
  if (!file) throw notFound("File");
  if (file.uploadedAt) return { ok: true };
  const head = await storageGateway().head(file.key);
  if (!head || head.size !== file.size || (head.contentType && head.contentType !== file.contentType)) {
    throw unprocessable("UPLOAD_MISMATCH", "The upload didn't complete. Please try again.");
  }
  await prisma.fileAsset.update({ where: { id: file.id }, data: { uploadedAt: new Date() } });
  return { ok: true };
}

export async function listFiles(actor: ServiceActor, bookingKey: string) {
  const { booking } = await loadVisible(actor, bookingKey);
  const files = await prisma.fileAsset.findMany({
    where: { bookingId: booking.id, uploadedAt: { not: null } },
    include: { owner: { select: { firstName: true, role: true } } },
    orderBy: { createdAt: "asc" },
  });
  return files.map((f) => ({
    id: f.id, fileName: f.fileName, contentType: f.contentType, size: f.size,
    uploadedBy: { name: f.owner.firstName, role: f.owner.role },
    uploadedAt: f.uploadedAt!.toISOString(),
  }));
}

export async function downloadUrl(actor: ServiceActor, fileId: string) {
  const file = await prisma.fileAsset.findFirst({ where: { id: fileId, uploadedAt: { not: null } } });
  if (!file?.bookingId) throw notFound("File");
  await loadVisible(actor, file.bookingId); // same visibility as the booking; 404 otherwise
  return { url: await storageGateway().downloadUrl(file.key, file.fileName) };
}
