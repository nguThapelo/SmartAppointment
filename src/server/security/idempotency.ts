import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { AppError, badRequest, conflict, unprocessable } from "@/server/errors";

// Idempotency for side-effecting requests (ported from peach-payment
// lib/idempotency.js). The client sends `Idempotency-Key: <uuid>` and reuses it
// on every retry of the SAME logical action. The unique (scope, key) row is the
// atomic check-and-write:
//   - first caller takes the lock, runs `exec`, and the outcome is stored
//   - a concurrent caller with the same key gets 409 (still in progress)
//   - a later caller gets the stored response replayed
//   - the same key with a DIFFERENT body is rejected (422)
//   - permanent failures (4xx) are stored; transient ones (5xx) release the key

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STALE_LOCK_MS = 60_000;
const TTL_MS = 24 * 3600 * 1000;

export interface IdempotentResult {
  status: number;
  body: unknown;
  replayed: boolean;
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v as object)
        .sort()
        .map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

const hashBody = (body: unknown) =>
  createHash("sha256").update(JSON.stringify(sortKeys(body ?? {}))).digest("hex");

export async function runIdempotent(opts: {
  scope: string;
  key: string | null;
  body: unknown;
  exec: () => Promise<{ status: number; body: unknown }>;
}): Promise<IdempotentResult> {
  const { scope, key, body, exec } = opts;
  if (!key) throw badRequest("Missing Idempotency-Key header");
  if (!UUID_RE.test(key)) throw badRequest("Idempotency-Key must be a UUID");

  const requestHash = hashBody(body);
  const now = new Date();

  try {
    await prisma.idempotencyKey.create({
      data: {
        scope, key, requestHash, status: "in_progress",
        lockedAt: now, expiresAt: new Date(now.getTime() + TTL_MS),
      },
    });
  } catch (err) {
    if ((err as { code?: string }).code !== "P2002") throw err;

    const existing = await prisma.idempotencyKey.findUnique({ where: { scope_key: { scope, key } } });
    if (!existing) throw err;
    if (existing.requestHash !== requestHash) {
      throw unprocessable("IDEMPOTENCY_KEY_REUSED", "This request key was already used for a different request");
    }
    if (existing.status !== "in_progress") {
      return {
        status: existing.httpStatus ?? 200,
        body: existing.responseJson ? JSON.parse(existing.responseJson) : null,
        replayed: true,
      };
    }
    if (now.getTime() - existing.lockedAt.getTime() < STALE_LOCK_MS) {
      throw conflict("IDEMPOTENCY_IN_PROGRESS", "This request is already being processed");
    }
    // A crashed attempt left a stale lock — take it over.
    await prisma.idempotencyKey.update({ where: { id: existing.id }, data: { lockedAt: now } });
  }

  try {
    const result = await exec();
    await prisma.idempotencyKey.update({
      where: { scope_key: { scope, key } },
      data: { status: "completed", httpStatus: result.status, responseJson: JSON.stringify(result.body) },
    });
    return { ...result, replayed: false };
  } catch (err) {
    if (err instanceof AppError && err.status >= 400 && err.status < 500 && err.status !== 409 && err.status !== 429) {
      await prisma.idempotencyKey.update({
        where: { scope_key: { scope, key } },
        data: {
          status: "failed",
          httpStatus: err.status,
          responseJson: JSON.stringify({ error: err.publicMessage, code: err.code }),
        },
      });
    } else {
      await prisma.idempotencyKey.delete({ where: { scope_key: { scope, key } } }).catch(() => {});
    }
    throw err;
  }
}
