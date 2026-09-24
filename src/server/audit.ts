import type { Prisma, Role } from "@prisma/client";
import type { Db } from "@/lib/db";

export type ActorType = "USER" | "AGENT" | "WHATSAPP" | "SYSTEM" | "WEBHOOK";

export interface AuditInput {
  actorType: ActorType;
  actorId?: string | null;
  actorRole?: Role | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  outcome: "success" | "denied" | "failed";
  requestId?: string | null;
  /** Structured facts only (ids, statuses). Never free text, PII or secrets. */
  detail?: Prisma.InputJsonObject;
}

/**
 * Append an audit event. Pass the transaction client when the audited change is
 * itself transactional, so the change and its audit record commit together.
 */
export async function recordAudit(db: Db, input: AuditInput) {
  await db.auditEvent.create({
    data: {
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      actorRole: input.actorRole ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      outcome: input.outcome,
      requestId: input.requestId ?? null,
      detail: input.detail ?? {},
    },
  });
}
