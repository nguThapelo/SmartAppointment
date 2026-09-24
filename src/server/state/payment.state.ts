import type { Payment, PaymentStatus, Prisma } from "@prisma/client";
import type { Tx } from "@/lib/db";

// The ONLY place a Payment's status changes (peach-payment models/payments.state.js).
//
// Webhooks, the reconcile job and the checkout flow all funnel through
// applyPaymentOutcome(), so a late, duplicate or out-of-order provider event
// can never move a payment backwards (e.g. SUCCEEDED → FAILED). Every call —
// including ignored ones — appends a PaymentEvent for the audit trail.

export const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  CREATED: ["PENDING", "FAILED"],
  PENDING: ["SUCCEEDED", "FAILED", "EXPIRED"],
  // A declined card can be retried inside the same Checkout session.
  FAILED: ["SUCCEEDED", "EXPIRED"],
  SUCCEEDED: ["REFUNDED"],
  EXPIRED: [],
  REFUNDED: [],
};

export const TERMINAL_PAYMENT: readonly PaymentStatus[] = ["SUCCEEDED", "EXPIRED", "REFUNDED"];

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus) {
  return from === to || PAYMENT_TRANSITIONS[from].includes(to);
}

export type PaymentOutcome = "pending" | "succeeded" | "failed" | "expired";

const TARGET: Record<PaymentOutcome, PaymentStatus> = {
  pending: "PENDING",
  succeeded: "SUCCEEDED",
  failed: "FAILED",
  expired: "EXPIRED",
};

export interface ApplyResult {
  changed: boolean;
  from: PaymentStatus;
  to: PaymentStatus;
  reason?: "no_change" | "illegal_transition";
}

export async function applyPaymentOutcome(
  tx: Tx,
  payment: Payment,
  outcome: PaymentOutcome,
  opts: { source: string; patch?: Prisma.PaymentUpdateInput; detail?: Prisma.InputJsonObject } = { source: "system" },
): Promise<ApplyResult> {
  const from = payment.status;
  const to = TARGET[outcome];
  const base = { paymentId: payment.id };

  if (from === to) {
    await tx.paymentEvent.create({ data: { ...base, type: "reconciled", detail: { outcome, from, source: opts.source, ...opts.detail } } });
    return { changed: false, from, to, reason: "no_change" };
  }
  if (!canTransitionPayment(from, to)) {
    await tx.paymentEvent.create({
      data: { ...base, type: "ignored", detail: { outcome, from, to, source: opts.source, reason: "illegal_transition", ...opts.detail } },
    });
    return { changed: false, from, to, reason: "illegal_transition" };
  }

  // Conditional update: if something else moved the payment meanwhile, we lose cleanly.
  const res = await tx.payment.updateMany({
    where: { id: payment.id, status: from },
    data: {
      status: to,
      ...(to === "SUCCEEDED" ? { paidAt: new Date() } : {}),
      ...((opts.patch ?? {}) as Prisma.PaymentUpdateManyMutationInput),
    },
  });
  if (res.count !== 1) {
    await tx.paymentEvent.create({ data: { ...base, type: "ignored", detail: { outcome, from, to, reason: "concurrent_update" } } });
    return { changed: false, from, to, reason: "illegal_transition" };
  }
  await tx.paymentEvent.create({ data: { ...base, type: to.toLowerCase(), detail: { from, source: opts.source, ...opts.detail } } });
  return { changed: true, from, to };
}
