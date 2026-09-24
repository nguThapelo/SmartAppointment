import { prisma } from "@/lib/db";
import { SYSTEM, type ServiceCtx } from "@/server/actors";
import { log } from "@/server/log";
import { transition } from "@/server/services/booking";
import { reconcilePendingPayments } from "@/server/services/payment";

// Scheduled maintenance, triggered by GitHub Actions via /api/cron/<job>.
// Each job is bounded (take: N) so one run stays well inside Amplify's
// request timeout; the next run picks up anything left over.

export const JOBS = ["reconcile-payments", "close-completed", "cleanup"] as const;
export type Job = (typeof JOBS)[number];

const CLOSE_AFTER_DAYS = 14;

async function closeCompleted(ctx: ServiceCtx) {
  const due = await prisma.booking.findMany({
    where: {
      status: "COMPLETED",
      updatedAt: { lt: new Date(Date.now() - CLOSE_AFTER_DAYS * 86400_000) },
    },
    select: { id: true },
    take: 100,
  });
  let closed = 0;
  for (const b of due) {
    try {
      await transition(SYSTEM, b.id, "close", {}, ctx, { notify: false });
      closed++;
    } catch (err) {
      log.warn("close-completed skipped booking", { bookingId: b.id, err });
    }
  }
  return { due: due.length, closed };
}

async function cleanup() {
  const now = new Date();
  const [idem, buckets, actions, webhooks] = await prisma.$transaction([
    prisma.idempotencyKey.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: now } } }),
    prisma.agentPendingAction.updateMany({
      where: { status: "PENDING", expiresAt: { lt: now } },
      data: { status: "EXPIRED", resolvedAt: now },
    }),
    prisma.webhookEvent.deleteMany({ where: { processedAt: { not: null }, receivedAt: { lt: new Date(now.getTime() - 30 * 86400_000) } } }),
  ]);
  return { idempotencyKeys: idem.count, rateLimitBuckets: buckets.count, expiredAgentActions: actions.count, oldWebhooks: webhooks.count };
}

export async function runJob(job: Job, ctx: ServiceCtx = {}) {
  switch (job) {
    case "reconcile-payments":
      return reconcilePendingPayments(30, ctx);
    case "close-completed":
      return closeCompleted(ctx);
    case "cleanup":
      return cleanup();
  }
}
