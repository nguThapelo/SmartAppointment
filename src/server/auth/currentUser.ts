import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { forbidden, unauthorized } from "@/server/errors";
import { verifySession } from "./session";

/** The authenticated caller, as resolved from the DB — never from token claims. */
export interface Actor {
  id: string;
  role: Role;
  email: string;
  firstName: string;
  lastName: string;
  timezone: string;
  aiEnabled: boolean;
}

/**
 * Resolve the user behind a session token. Returns null for a missing, invalid,
 * expired or revoked token, or a deactivated/deleted user.
 */
export async function resolveActor(token: string | undefined): Promise<Actor | null> {
  const claims = await verifySession(token);
  if (!claims) return null;

  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: {
      id: true, role: true, email: true, firstName: true, lastName: true,
      timezone: true, aiEnabled: true, isActive: true, deletedAt: true, sessionVersion: true,
    },
  });
  if (!user || !user.isActive || user.deletedAt || user.sessionVersion !== claims.sv) return null;

  return {
    id: user.id,
    role: user.role,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    timezone: user.timezone,
    aiEnabled: user.aiEnabled,
  };
}

/** Throws 401 when there's no valid session, 403 when the role isn't allowed. */
export async function requireActor(token: string | undefined, roles?: readonly Role[]): Promise<Actor> {
  const actor = await resolveActor(token);
  if (!actor) throw unauthorized("SESSION_EXPIRED", "Your session has expired. Please sign in again.");
  if (roles && !roles.includes(actor.role)) throw forbidden();
  return actor;
}
