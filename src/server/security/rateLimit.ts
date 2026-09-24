import { prisma } from "@/lib/db";
import { tooManyRequests } from "@/server/errors";

// Fixed-window rate limiter backed by Postgres.
//
// peach-payment keeps buckets in process memory, which is right for one long-
// lived Node server. Amplify runs Next.js on many short-lived Lambda instances,
// so an in-memory counter would reset constantly and never limit anything.
// A single atomic upsert per check is cheap at portfolio traffic levels.

export interface RateLimitRule {
  limit: number;
  windowSeconds: number;
}

export const RATE_LIMITS = {
  loginIp: { limit: 20, windowSeconds: 15 * 60 },
  loginEmail: { limit: 10, windowSeconds: 15 * 60 },
  register: { limit: 5, windowSeconds: 60 * 60 },
  forgotIp: { limit: 5, windowSeconds: 60 * 60 },
  forgotEmail: { limit: 3, windowSeconds: 60 * 60 },
  ai: { limit: 10, windowSeconds: 60 },
  write: { limit: 60, windowSeconds: 60 },
  whatsappSender: { limit: 30, windowSeconds: 60 },
} satisfies Record<string, RateLimitRule>;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export async function hit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const windowMs = rule.windowSeconds * 1000;
  const newReset = new Date(Date.now() + windowMs);

  // Reset the window if it has expired, otherwise increment — atomically.
  const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
    VALUES (${key}, 1, ${newReset})
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimitBucket"."resetAt" <= now() THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= now() THEN EXCLUDED."resetAt" ELSE "RateLimitBucket"."resetAt" END
    RETURNING "count", "resetAt"`;

  const row = rows[0]!;
  const allowed = row.count <= rule.limit;
  return {
    allowed,
    remaining: Math.max(0, rule.limit - row.count),
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((row.resetAt.getTime() - Date.now()) / 1000)),
  };
}

/** Throws 429 when any of the given buckets is exhausted. */
export async function enforce(checks: Array<[key: string, rule: RateLimitRule]>) {
  for (const [key, rule] of checks) {
    const r = await hit(key, rule);
    if (!r.allowed) throw tooManyRequests(r.retryAfterSeconds);
  }
}

/**
 * Best-effort client IP. X-Forwarded-For's FIRST entry is client-controlled, so
 * trusting it would let anyone dodge IP limits by sending a fake header. The
 * LAST entry is the one the platform's edge (CloudFront in front of Amplify)
 * appended from the real connection. Limits that matter also key on email or
 * user id, so an imperfect IP never becomes the only control.
 */
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1]!;
  }
  return headers.get("x-real-ip") ?? "unknown";
}
