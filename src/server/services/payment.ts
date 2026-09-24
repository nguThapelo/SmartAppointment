import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { auditActor, type ServiceActor, type ServiceCtx } from "@/server/actors";
import { recordAudit } from "@/server/audit";
import { env, isConfigured } from "@/server/env";
import { AppError, conflict, forbidden, serviceUnavailable } from "@/server/errors";
import { stripeGateway, toCheckoutSession, type CheckoutSession } from "@/server/integrations/stripe";
import { log } from "@/server/log";
import { applyTransitionTx, loadVisible, previewTransition } from "@/server/services/booking";
import { notifyBooking } from "@/server/services/notification";
import { applyPaymentOutcome, type PaymentOutcome } from "@/server/state/payment.state";

// Online payments via Stripe Checkout (test mode only — env.ts rejects live keys).
//
// Trust model (design §7.2, audit H-2/H-4):
//   - the amount always comes from the booking's price snapshot, never input
//   - a booking becomes PAID only from a verified Stripe event or a server-side
//     re-fetch of the session (reconcile) — never from the browser redirect
//   - every event is checked against OUR payment record (session id, amount,
//     currency) before it can change anything

const CHECKOUT_TTL_HOURS = 23; // Stripe allows up to 24h

export interface PaymentDTO {
  id: string;
  status: string;
  amountCents: number;
  currency: string;
  attempt: number;
  /** Only returned to the customer, and only while the checkout is open. */
  checkoutUrl: string | null;
  expiresAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

// ── Request payment (provider / admin) ──────────────────────────────────────

export async function requestPayment(actor: ServiceActor, bookingKey: string, ctx: ServiceCtx = {}) {
  if (!isConfigured.stripe()) throw serviceUnavailable("Online payments aren't configured");

  // Permission + state check up front (provider of this booking / admin, APPROVED or PAYMENT_FAILED, ONLINE).
  const { booking } = await previewTransition(actor, bookingKey, "requestPayment");
  const row = await prisma.booking.findUniqueOrThrow({
    where: { id: booking.id },
    include: { client: { select: { email: true } } },
  });

  const initiatedById = actor.kind === "user" ? actor.user.id : null;
  if (!initiatedById) throw forbidden();

  // 1) Reserve a payment row. The partial unique index allows only one open
  //    (CREATED/PENDING) payment per booking, so concurrent requests can't
  //    open two checkouts.
  const attempt = (await prisma.payment.count({ where: { bookingId: row.id } })) + 1;
  let payment;
  try {
    payment = await prisma.payment.create({
      data: {
        bookingId: row.id, attempt, status: "CREATED",
        amountCents: row.priceCents, currency: row.currency, initiatedById,
      },
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      throw conflict("PAYMENT_ALREADY_OPEN", "A payment request is already open for this booking");
    }
    throw err;
  }

  // 2) Create the Checkout session OUTSIDE any DB transaction (network call).
  //    The idempotency key ties it to our payment row, so a retry never creates two.
  let session: CheckoutSession;
  const expiresAt = new Date(Date.now() + CHECKOUT_TTL_HOURS * 3600_000);
  try {
    session = await stripeGateway().createCheckout(
      {
        paymentId: payment.id,
        bookingId: row.id,
        reference: row.reference,
        description: `${row.serviceName} · ${row.reference}`,
        amountCents: payment.amountCents,
        currency: payment.currency,
        customerEmail: row.client?.email ?? row.customerEmail,
        successUrl: `${env().APP_URL}/bookings/${row.reference}?payment=returned`,
        cancelUrl: `${env().APP_URL}/bookings/${row.reference}?payment=cancelled`,
        expiresAt,
      },
      `checkout:${payment.id}`,
    );
  } catch (err) {
    await prisma.$transaction((tx) =>
      applyPaymentOutcome(tx, payment, "failed", { source: "checkout_create", patch: { failureReason: "checkout_create_failed" } }),
    );
    log.error("stripe checkout create failed", { err, paymentId: payment.id, requestId: ctx.requestId });
    log.metric("payment.create_error", { requestId: ctx.requestId });
    throw serviceUnavailable("Couldn't start the payment right now. Please try again.");
  }

  // 3) Record the session and move the booking to PAYMENT_PENDING together.
  await prisma.$transaction(async (tx) => {
    await applyPaymentOutcome(tx, payment, "pending", {
      source: "checkout_create",
      patch: { stripeSessionId: session.id, checkoutUrl: session.url, expiresAt },
    });
    await applyTransitionTx(tx, actor, row.id, "requestPayment", {}, ctx);
    await recordAudit(tx, {
      ...auditActor(actor, ctx), action: "payment.request", entityType: "Payment", entityId: payment.id,
      outcome: "success", requestId: ctx.requestId, detail: { bookingId: row.id, amountCents: payment.amountCents, attempt },
    });
  });

  void notifyBooking(row.id, "payment_requested", session.url ? { link: session.url } : undefined);
  return getLatestForActor(actor, row.id);
}

// ── Read ────────────────────────────────────────────────────────────────────

export async function getLatestForActor(actor: ServiceActor, bookingKey: string): Promise<PaymentDTO | null> {
  const { booking, party } = await loadVisible(actor, bookingKey);
  const p = await prisma.payment.findFirst({ where: { bookingId: booking.id }, orderBy: { attempt: "desc" } });
  if (!p) return null;
  const isCustomer = party === "client" || party === "guest";
  const open = p.status === "PENDING" && (!p.expiresAt || p.expiresAt > new Date());
  return {
    id: p.id,
    status: p.status,
    amountCents: p.amountCents,
    currency: p.currency,
    attempt: p.attempt,
    checkoutUrl: isCustomer && open ? p.checkoutUrl : null,
    expiresAt: p.expiresAt?.toISOString() ?? null,
    paidAt: p.paidAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

// ── Provider events (webhook + reconcile) ───────────────────────────────────

function outcomeOf(session: CheckoutSession, eventType?: string): PaymentOutcome | null {
  if (eventType === "checkout.session.async_payment_failed") return "failed";
  if (session.status === "expired") return "expired";
  if (session.status === "complete" && session.paymentStatus === "paid") return "succeeded";
  if (session.status === "complete") return "pending"; // async method still settling
  return null; // still open — nothing to do
}

/**
 * Apply what Stripe says about a Checkout session. Cross-checks it against our
 * own payment row first: an event whose session id, amount or currency doesn't
 * match is rejected and flagged, never applied.
 */
export async function applyCheckoutSession(
  session: CheckoutSession,
  source: "webhook" | "reconcile",
  eventType?: string,
  ctx: ServiceCtx = {},
): Promise<{ applied: boolean; reason?: string }> {
  const payment = await prisma.payment.findFirst({
    where: { OR: [{ stripeSessionId: session.id }, ...(session.metadata.paymentId ? [{ id: session.metadata.paymentId }] : [])] },
  });
  if (!payment) return { applied: false, reason: "unknown_session" };

  const mismatch =
    payment.stripeSessionId !== session.id ||
    (session.amountTotal !== null && session.amountTotal !== payment.amountCents) ||
    (session.currency !== null && session.currency.toUpperCase() !== payment.currency.toUpperCase());
  if (mismatch) {
    log.metric("payment.webhook_mismatch", { paymentId: payment.id, requestId: ctx.requestId });
    await prisma.paymentEvent.create({
      data: {
        paymentId: payment.id, type: "rejected",
        detail: { reason: "session_mismatch", source, amountTotal: session.amountTotal, currency: session.currency },
      },
    });
    return { applied: false, reason: "mismatch" };
  }

  const outcome = outcomeOf(session, eventType);
  if (!outcome) return { applied: false, reason: "still_open" };

  const who = { kind: "webhook", provider: "stripe" } as const satisfies ServiceActor;
  let notify: "paid" | null = null;

  await prisma.$transaction(async (tx) => {
    const r = await applyPaymentOutcome(tx, payment, outcome, {
      source,
      patch: session.paymentIntentId ? { stripePaymentIntentId: session.paymentIntentId } : {},
      detail: { eventType: eventType ?? null },
    });
    if (!r.changed) return;

    const booking = await tx.booking.findUniqueOrThrow({ where: { id: payment.bookingId } });
    if (r.to === "SUCCEEDED") {
      if (booking.status === "PAYMENT_PENDING" || booking.status === "PAYMENT_FAILED") {
        await applyTransitionTx(tx, who, booking.id, "paymentSucceeded", {}, ctx);
        notify = "paid";
      } else {
        // Money arrived for a booking that was cancelled meanwhile: flag for a
        // manual refund in the Stripe dashboard (refunds are never automated).
        log.metric("payment.needs_refund", { paymentId: payment.id, bookingStatus: booking.status });
        await tx.paymentEvent.create({ data: { paymentId: payment.id, type: "needs_refund", detail: { bookingStatus: booking.status } } });
        await recordAudit(tx, {
          actorType: "WEBHOOK", actorId: "stripe", action: "payment.needs_refund", entityType: "Payment",
          entityId: payment.id, outcome: "failed", requestId: ctx.requestId, detail: { bookingStatus: booking.status },
        });
      }
    } else if ((r.to === "FAILED" || r.to === "EXPIRED") && booking.status === "PAYMENT_PENDING") {
      await applyTransitionTx(tx, who, booking.id, "paymentFailed", {}, ctx);
    }
  });

  if (notify) void notifyBooking(payment.bookingId, notify);
  return { applied: true };
}

/**
 * Verified Stripe event → our state. Dedupe is by event id (WebhookEvent row);
 * an event that previously FAILED to process is retried, one that succeeded is
 * acknowledged without reprocessing.
 */
export async function handleStripeEvent(event: Stripe.Event, ctx: ServiceCtx = {}): Promise<"processed" | "duplicate" | "ignored"> {
  const existing = await prisma.webhookEvent.findUnique({
    where: { provider_externalId: { provider: "stripe", externalId: event.id } },
  });
  if (existing?.processedAt) {
    log.metric("payment.webhook_duplicate", { eventId: event.id, requestId: ctx.requestId });
    return "duplicate";
  }
  const record =
    existing ??
    (await prisma.webhookEvent
      .create({ data: { provider: "stripe", externalId: event.id, signatureOk: true, type: event.type } })
      .catch(async (err) => {
        // Two deliveries racing: the other one owns processing.
        if ((err as { code?: string }).code === "P2002") return null;
        throw err;
      }));
  if (!record) return "duplicate";

  const HANDLED = new Set([
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
    "checkout.session.expired",
  ]);

  try {
    if (HANDLED.has(event.type)) {
      const session = toCheckoutSession(event.data.object as Stripe.Checkout.Session);
      await applyCheckoutSession(session, "webhook", event.type, ctx);
    }
    await prisma.webhookEvent.update({ where: { id: record.id }, data: { processedAt: new Date(), error: null } });
    return HANDLED.has(event.type) ? "processed" : "ignored";
  } catch (err) {
    await prisma.webhookEvent.update({
      where: { id: record.id },
      data: { error: err instanceof AppError ? err.code : "processing_failed" },
    });
    throw err;
  }
}

/**
 * Re-fetch sessions stuck in PENDING (missed/late webhooks) and apply the
 * truth from Stripe. Run hourly by the cron route.
 */
export async function reconcilePendingPayments(olderThanMinutes = 30, ctx: ServiceCtx = {}) {
  const stale = await prisma.payment.findMany({
    where: {
      status: "PENDING",
      stripeSessionId: { not: null },
      updatedAt: { lt: new Date(Date.now() - olderThanMinutes * 60_000) },
    },
    take: 50,
  });
  let applied = 0;
  for (const p of stale) {
    try {
      const session = await stripeGateway().retrieveCheckout(p.stripeSessionId!);
      if ((await applyCheckoutSession(session, "reconcile", undefined, ctx)).applied) applied++;
    } catch (err) {
      log.error("reconcile failed", { err, paymentId: p.id });
      log.metric("payment.reconcile_failed", { paymentId: p.id });
    }
  }
  return { checked: stale.length, applied };
}
