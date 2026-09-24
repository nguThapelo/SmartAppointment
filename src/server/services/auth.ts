import type { z } from "zod";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/server/audit";
import type { Actor } from "@/server/auth/currentUser";
import {
  burnPasswordCheck,
  createOpaqueToken,
  hashPassword,
  sha256,
  verifyPassword,
} from "@/server/auth/password";
import { signSession } from "@/server/auth/session";
import { toUserDTO, type UserDTO } from "@/server/dto/user";
import { env } from "@/server/env";
import { AppError, conflict, unauthorized } from "@/server/errors";
import { log } from "@/server/log";
import { escapeHtml, sendEmail } from "@/server/services/email";
import type {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/server/validation/auth";

const RESET_TTL_MS = 30 * 60 * 1000;

interface Ctx {
  requestId?: string;
}

/** Self-service registration. Always creates a CLIENT (audit C-2). */
export async function register(input: z.infer<typeof registerSchema>, ctx: Ctx = {}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) throw conflict("EMAIL_TAKEN", "An account with this email already exists");

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: input.email,
        passwordHash: await hashPassword(input.password),
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone ?? null,
        role: "CLIENT",
      },
    });
    await recordAudit(tx, {
      actorType: "USER", actorId: created.id, actorRole: "CLIENT",
      action: "user.register", entityType: "User", entityId: created.id,
      outcome: "success", requestId: ctx.requestId,
    });
    return created;
  });

  const token = await signSession({ sub: user.id, sv: user.sessionVersion });
  return { user: toUserDTO(user), token };
}

/** Same error and same bcrypt cost for "no such user" and "wrong password". */
export async function login(input: z.infer<typeof loginSchema>, ctx: Ctx = {}) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const ok = user ? await verifyPassword(input.password, user.passwordHash) : await burnPasswordCheck(input.password);

  if (!user || !ok || !user.isActive || user.deletedAt) {
    await recordAudit(prisma, {
      actorType: "USER", actorId: user?.id ?? null,
      action: "auth.login", entityType: "User", entityId: user?.id ?? null,
      outcome: "denied", requestId: ctx.requestId,
    });
    log.metric("auth.login_failed", { requestId: ctx.requestId });
    throw unauthorized("INVALID_CREDENTIALS", "Incorrect email or password");
  }

  await recordAudit(prisma, {
    actorType: "USER", actorId: user.id, actorRole: user.role,
    action: "auth.login", entityType: "User", entityId: user.id,
    outcome: "success", requestId: ctx.requestId,
  });
  const token = await signSession({ sub: user.id, sv: user.sessionVersion });
  return { user: toUserDTO(user), token };
}

/** Revoke every session for this user (all devices). */
export async function logoutEverywhere(actor: Actor, ctx: Ctx = {}) {
  await prisma.user.update({ where: { id: actor.id }, data: { sessionVersion: { increment: 1 } } });
  await recordAudit(prisma, {
    actorType: "USER", actorId: actor.id, actorRole: actor.role,
    action: "auth.logout_all", entityType: "User", entityId: actor.id,
    outcome: "success", requestId: ctx.requestId,
  });
}

export async function getMe(actor: Actor): Promise<UserDTO> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
  return toUserDTO(user);
}

/** Changing a password revokes all other sessions and issues a fresh one. */
export async function changePassword(actor: Actor, input: z.infer<typeof changePasswordSchema>, ctx: Ctx = {}) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw new AppError(400, "WRONG_PASSWORD", "Your current password is incorrect");
  }
  const updated = await prisma.user.update({
    where: { id: actor.id },
    data: { passwordHash: await hashPassword(input.newPassword), sessionVersion: { increment: 1 } },
  });
  await recordAudit(prisma, {
    actorType: "USER", actorId: actor.id, actorRole: actor.role,
    action: "auth.password_change", entityType: "User", entityId: actor.id,
    outcome: "success", requestId: ctx.requestId,
  });
  return { token: await signSession({ sub: updated.id, sv: updated.sessionVersion }) };
}

/**
 * Always resolves the same way whether or not the email exists, so the
 * endpoint can't be used to discover accounts (audit H-9).
 */
export async function requestPasswordReset(input: z.infer<typeof forgotPasswordSchema>, ctx: Ctx = {}) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.isActive || user.deletedAt) return;

  const { token, tokenHash } = createOpaqueToken();
  await prisma.$transaction([
    // Only the newest link works.
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + RESET_TTL_MS) },
    }),
  ]);

  const link = `${env().APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: user.email,
    subject: "Reset your SmartAppointment password",
    text: `Hi ${user.firstName},\n\nUse this link to reset your password (valid for 30 minutes):\n${link}\n\nIf you didn't ask for this, ignore this email.`,
    html: `<p>Hi ${escapeHtml(user.firstName)},</p><p><a href="${escapeHtml(link)}">Reset your password</a> (valid for 30 minutes).</p><p>If you didn't ask for this, ignore this email.</p>`,
  });
  await recordAudit(prisma, {
    actorType: "USER", actorId: user.id, actorRole: user.role,
    action: "auth.password_reset_requested", entityType: "User", entityId: user.id,
    outcome: "success", requestId: ctx.requestId,
  });
}

export async function resetPassword(input: z.infer<typeof resetPasswordSchema>, ctx: Ctx = {}) {
  const tokenHash = sha256(input.token);
  const passwordHash = await hashPassword(input.password);

  const userId = await prisma.$transaction(async (tx) => {
    // Atomic single-use claim: only one request can flip usedAt from null.
    const claimed = await tx.passwordResetToken.updateMany({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) return null;
    const row = await tx.passwordResetToken.findUniqueOrThrow({ where: { tokenHash } });
    await tx.user.update({
      where: { id: row.userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    return row.userId;
  });

  if (!userId) throw new AppError(400, "INVALID_TOKEN", "This reset link is invalid or has expired");
  await recordAudit(prisma, {
    actorType: "USER", actorId: userId,
    action: "auth.password_reset", entityType: "User", entityId: userId,
    outcome: "success", requestId: ctx.requestId,
  });
}
