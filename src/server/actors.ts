import type { Role } from "@prisma/client";
import type { Actor } from "@/server/auth/currentUser";
import type { ActorType } from "@/server/audit";

// Who is performing a service call. Services never take a user id from input
// to decide permissions — they take one of these, built by the caller from a
// verified source (session cookie, signed WhatsApp webhook, internal job).

export type ServiceActor =
  | { kind: "user"; user: Actor }
  | { kind: "whatsapp"; phone: string; channelId: string; name?: string }
  | { kind: "system" }
  | { kind: "webhook"; provider: "stripe" | "whatsapp" };

export interface ServiceCtx {
  requestId?: string;
  /** Set when the call was made by the AI agent on the user's behalf (after confirmation). */
  viaAgent?: boolean;
}

export const userActor = (user: Actor): ServiceActor => ({ kind: "user", user });
export const SYSTEM: ServiceActor = { kind: "system" };

export function roleOf(actor: ServiceActor): Role | null {
  return actor.kind === "user" ? actor.user.role : null;
}

export function isAdmin(actor: ServiceActor): boolean {
  return actor.kind === "user" && actor.user.role === "ADMIN";
}

/** Fields for AuditEvent / BookingTransition describing this actor. */
export function auditActor(actor: ServiceActor, ctx: ServiceCtx = {}) {
  let actorType: ActorType;
  switch (actor.kind) {
    case "user":
      actorType = ctx.viaAgent ? "AGENT" : "USER";
      return { actorType, actorId: actor.user.id, actorRole: actor.user.role };
    case "whatsapp":
      // Phone numbers are personal data; the audit trail stores the channel, not the number.
      return { actorType: "WHATSAPP" as const, actorId: actor.channelId, actorRole: null };
    case "system":
      return { actorType: "SYSTEM" as const, actorId: null, actorRole: null };
    case "webhook":
      return { actorType: "WEBHOOK" as const, actorId: actor.provider, actorRole: null };
  }
}
