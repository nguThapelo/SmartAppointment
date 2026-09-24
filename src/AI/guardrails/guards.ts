import { prisma } from "@/lib/db";
import type { Actor } from "@/server/auth/currentUser";
import { AppError, forbidden, serviceUnavailable, unprocessable } from "@/server/errors";
import { log } from "@/server/log";
import { AI_LIMITS, aiEnabled, dailyGlobalLimit, dailyUserLimit } from "../config";

// Checks that run before any model call (ReportReviewAssist scopeGuard +
// TokenBudgetGuard, adapted): kill switches, input limits, and a daily
// request budget that keeps the free tier from being exhausted by one user.

export function sanitizeMessage(raw: string): string {
  const text = raw.replace(/\0/g, "").trim();
  if (!text) throw unprocessable("EMPTY_MESSAGE", "Type a message first");
  if (text.length > AI_LIMITS.maxUserMessageChars) {
    throw unprocessable("MESSAGE_TOO_LONG", `Please keep messages under ${AI_LIMITS.maxUserMessageChars} characters`);
  }
  return text;
}

export function assertAiAllowed(user: Actor) {
  if (!aiEnabled()) throw serviceUnavailable("The assistant is switched off right now");
  if (!user.aiEnabled) throw forbidden("The assistant has been disabled for your account");
}

const today = () => new Date(new Date().toISOString().slice(0, 10));

/** Count one request against the user's and the global daily budget; 429 when over. */
export async function reserveBudget(userId: string) {
  const day = today();
  const [mine, global] = await prisma.$transaction([
    prisma.aiUsage.upsert({
      where: { scope_day: { scope: userId, day } },
      create: { scope: userId, day, requests: 1 },
      update: { requests: { increment: 1 } },
    }),
    prisma.aiUsage.upsert({
      where: { scope_day: { scope: "global", day } },
      create: { scope: "global", day, requests: 1 },
      update: { requests: { increment: 1 } },
    }),
  ]);
  if (mine.requests > dailyUserLimit()) {
    log.metric("ai.budget_exceeded", { scope: "user" });
    throw new AppError(429, "AI_DAILY_LIMIT", "You've reached today's assistant limit. It resets tomorrow.");
  }
  if (global.requests > dailyGlobalLimit()) {
    log.metric("ai.budget_exceeded", { scope: "global" });
    throw new AppError(429, "AI_DAILY_LIMIT", "The assistant is very busy today. Please use the menus, or try again tomorrow.");
  }
}

export async function recordTokens(userId: string, input: number, output: number) {
  const day = today();
  await prisma.aiUsage.updateMany({
    where: { scope: { in: [userId, "global"] }, day },
    data: { inputTokens: { increment: input }, outputTokens: { increment: output } },
  });
}
