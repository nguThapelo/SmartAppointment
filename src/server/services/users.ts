import type { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import type { z } from "zod";
import { prisma } from "@/lib/db";
import { auditActor, isAdmin, type ServiceActor, type ServiceCtx } from "@/server/actors";
import { recordAudit } from "@/server/audit";
import { hashPassword } from "@/server/auth/password";
import { conflict, forbidden, notFound, unprocessable } from "@/server/errors";
import { requestPasswordReset } from "@/server/services/auth";
import type { adminUserCreateSchema, adminUserUpdateSchema, userListSchema } from "@/server/validation/booking";

// Admin-only user management. This is the ONLY place a role can change
// (audit C-1, C-2): registration always yields CLIENT, and nothing a user can
// write about themselves affects their role.

function requireAdmin(actor: ServiceActor) {
  if (!isAdmin(actor)) throw forbidden();
}

const adminUserView = (u: {
  id: string; email: string; firstName: string; lastName: string; phone: string | null;
  role: string; isActive: boolean; aiEnabled: boolean; createdAt: Date;
}) => ({
  id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, phone: u.phone,
  role: u.role, isActive: u.isActive, aiEnabled: u.aiEnabled, createdAt: u.createdAt.toISOString(),
});

export async function listUsers(actor: ServiceActor, q: z.infer<typeof userListSchema>) {
  requireAdmin(actor);
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(q.role ? { role: q.role } : {}),
    ...(q.q
      ? {
          OR: [
            { email: { contains: q.q, mode: "insensitive" } },
            { firstName: { contains: q.q, mode: "insensitive" } },
            { lastName: { contains: q.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [total, rows] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
  ]);
  return { total, page: q.page, pageSize: q.pageSize, data: rows.map(adminUserView) };
}

/**
 * Create an account (typically a provider). The admin never sets or sees a
 * password: the account gets an unusable random one and the user receives a
 * "set your password" link.
 */
export async function createUser(actor: ServiceActor, input: z.infer<typeof adminUserCreateSchema>, ctx: ServiceCtx = {}) {
  requireAdmin(actor);
  if (await prisma.user.findUnique({ where: { email: input.email } })) {
    throw conflict("EMAIL_TAKEN", "An account with this email already exists");
  }
  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: { ...input, phone: input.phone ?? null, passwordHash: await hashPassword(randomBytes(32).toString("hex")) },
    });
    await recordAudit(tx, {
      ...auditActor(actor, ctx), action: "user.create", entityType: "User", entityId: u.id,
      outcome: "success", requestId: ctx.requestId, detail: { role: input.role },
    });
    return u;
  });
  await requestPasswordReset({ email: user.email }, ctx);
  return adminUserView(user);
}

export async function updateUser(
  actor: ServiceActor,
  userId: string,
  input: z.infer<typeof adminUserUpdateSchema>,
  ctx: ServiceCtx = {},
) {
  requireAdmin(actor);
  const target = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!target) throw notFound("User");

  const self = actor.kind === "user" && actor.user.id === userId;
  if (self && ((input.role && input.role !== "ADMIN") || input.isActive === false)) {
    throw unprocessable("SELF_LOCKOUT", "You can't remove your own admin access");
  }
  const losesAdmin = (input.role !== undefined && input.role !== "ADMIN") || input.isActive === false;
  if (target.role === "ADMIN" && losesAdmin) {
    const admins = await prisma.user.count({ where: { role: "ADMIN", isActive: true, deletedAt: null } });
    if (admins <= 1) throw unprocessable("LAST_ADMIN", "At least one active admin is required");
  }

  const privilegeChange = (input.role && input.role !== target.role) || input.isActive === false;
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id: userId },
      data: {
        ...input,
        // Role or access change ⇒ revoke every existing session for that user.
        ...(privilegeChange ? { sessionVersion: { increment: 1 } } : {}),
      },
    });
    await recordAudit(tx, {
      ...auditActor(actor, ctx),
      action: input.role && input.role !== target.role ? "user.role_change" : "user.update",
      entityType: "User", entityId: userId, outcome: "success", requestId: ctx.requestId,
      detail: { fromRole: target.role, ...input },
    });
    return u;
  });
  return adminUserView(updated);
}
