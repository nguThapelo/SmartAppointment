import Stripe from "stripe";
import type { CheckoutRequest, CheckoutSession, StripeGateway } from "@/server/integrations/stripe";

/** In-memory Stripe stand-in: records checkout creations, serves retrieves. */
export class FakeStripe implements StripeGateway {
  created: { req: CheckoutRequest; idempotencyKey: string }[] = [];
  sessions = new Map<string, CheckoutSession>();
  failNextCreate = false;
  private n = 0;

  async createCheckout(req: CheckoutRequest, idempotencyKey: string): Promise<CheckoutSession> {
    if (this.failNextCreate) {
      this.failNextCreate = false;
      throw new Error("stripe down");
    }
    this.created.push({ req, idempotencyKey });
    const id = `cs_test_${++this.n}_${Date.now()}`;
    const s: CheckoutSession = {
      id, url: `https://checkout.stripe.test/${id}`, status: "open", paymentStatus: "unpaid",
      amountTotal: req.amountCents, currency: req.currency.toLowerCase(), paymentIntentId: null,
      metadata: { paymentId: req.paymentId, bookingId: req.bookingId, reference: req.reference },
    };
    this.sessions.set(id, s);
    return s;
  }

  async retrieveCheckout(id: string): Promise<CheckoutSession> {
    const s = this.sessions.get(id);
    if (!s) throw new Error("no such session");
    return s;
  }

  complete(id: string) {
    const s = this.sessions.get(id)!;
    Object.assign(s, { status: "complete", paymentStatus: "paid", paymentIntentId: `pi_${id}` });
    return s;
  }
}

let evt = 0;
/** A Stripe webhook body + a valid Stripe-Signature for it (real HMAC). */
export function signedEvent(
  type: string,
  session: Partial<CheckoutSession> & { id: string },
  overrides: { eventId?: string; secret?: string } = {},
) {
  const payload = JSON.stringify({
    id: overrides.eventId ?? `evt_test_${++evt}_${Date.now()}`,
    object: "event",
    type,
    api_version: "2025-01-01",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: null,
    data: {
      object: {
        id: session.id,
        object: "checkout.session",
        status: session.status ?? "complete",
        payment_status: session.paymentStatus ?? "paid",
        amount_total: session.amountTotal ?? null,
        currency: session.currency ?? null,
        payment_intent: session.paymentIntentId ?? null,
        metadata: session.metadata ?? {},
      },
    },
  });
  const signer = new Stripe("sk_test_signer");
  const signature = signer.webhooks.generateTestHeaderString({
    payload,
    secret: overrides.secret ?? process.env.STRIPE_WEBHOOK_SECRET!,
  });
  return { payload, signature };
}
