import Stripe from "stripe";
import { env } from "@/server/env";
import { serviceUnavailable } from "@/server/errors";

// Narrow wrapper around the Stripe SDK. The rest of the app talks to this
// interface only, which (a) keeps Stripe types out of business logic and
// (b) lets tests swap in a fake gateway — no network, no real keys.
// Webhook verification always uses the real SDK (it's pure crypto).

export interface CheckoutRequest {
  paymentId: string;
  bookingId: string;
  reference: string;
  description: string;
  amountCents: number;
  currency: string;
  customerEmail: string | null;
  successUrl: string;
  cancelUrl: string;
  expiresAt: Date;
}

export interface CheckoutSession {
  id: string;
  url: string | null;
  status: "open" | "complete" | "expired";
  paymentStatus: "paid" | "unpaid" | "no_payment_required";
  amountTotal: number | null;
  currency: string | null;
  paymentIntentId: string | null;
  metadata: Record<string, string>;
}

export interface StripeGateway {
  createCheckout(req: CheckoutRequest, idempotencyKey: string): Promise<CheckoutSession>;
  retrieveCheckout(sessionId: string): Promise<CheckoutSession>;
}

let client: Stripe | undefined;
function sdk(): Stripe {
  const key = env().STRIPE_SECRET_KEY;
  if (!key) throw serviceUnavailable("Online payments aren't configured");
  client ??= new Stripe(key, { maxNetworkRetries: 2, timeout: 10_000 });
  return client;
}

export function toCheckoutSession(s: Stripe.Checkout.Session): CheckoutSession {
  return {
    id: s.id,
    url: s.url,
    status: (s.status ?? "open") as CheckoutSession["status"],
    // Anything Stripe adds in future is treated as "not paid".
    paymentStatus: s.payment_status === "paid" ? "paid" : s.payment_status === "no_payment_required" ? "no_payment_required" : "unpaid",
    amountTotal: s.amount_total,
    currency: s.currency,
    paymentIntentId: typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent?.id ?? null),
    metadata: (s.metadata ?? {}) as Record<string, string>,
  };
}

const realGateway: StripeGateway = {
  async createCheckout(req, idempotencyKey) {
    const metadata = { paymentId: req.paymentId, bookingId: req.bookingId, reference: req.reference };
    const session = await sdk().checkout.sessions.create(
      {
        mode: "payment",
        client_reference_id: req.bookingId,
        customer_email: req.customerEmail ?? undefined,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: req.currency.toLowerCase(),
              unit_amount: req.amountCents,
              product_data: { name: req.description },
            },
          },
        ],
        metadata,
        payment_intent_data: { metadata },
        success_url: req.successUrl,
        cancel_url: req.cancelUrl,
        expires_at: Math.floor(req.expiresAt.getTime() / 1000),
      },
      { idempotencyKey },
    );
    return toCheckoutSession(session);
  },
  async retrieveCheckout(sessionId) {
    return toCheckoutSession(await sdk().checkout.sessions.retrieve(sessionId));
  },
};

let gateway: StripeGateway = realGateway;
export const stripeGateway = () => gateway;

/** Test hook: replace the gateway (pass nothing to restore the real one). */
export function setStripeGatewayForTests(fake?: StripeGateway) {
  gateway = fake ?? realGateway;
}

/**
 * Verify a webhook's Stripe-Signature over the RAW body and parse the event.
 * Throws on a bad/missing signature or a timestamp older than 5 minutes
 * (Stripe's replay tolerance).
 */
export function verifyStripeWebhook(rawBody: string, signature: string | null): Stripe.Event {
  const secret = env().STRIPE_WEBHOOK_SECRET;
  if (!secret) throw serviceUnavailable("Stripe webhooks aren't configured");
  if (!signature) throw new Error("missing signature");
  // constructEvent is pure HMAC verification — any key works for the client here.
  const verifier = client ?? new Stripe(env().STRIPE_SECRET_KEY ?? "sk_test_verify_only");
  return verifier.webhooks.constructEvent(rawBody, signature, secret, 300);
}
