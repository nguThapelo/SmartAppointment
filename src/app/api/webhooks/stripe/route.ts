import { badRequest } from "@/server/errors";
import { verifyStripeWebhook } from "@/server/integrations/stripe";
import { handleStripeEvent } from "@/server/services/payment";
import { json, publicRoute } from "@/server/withApi";

// Stripe → us. Authenticated by the Stripe-Signature HMAC over the raw body
// (not by cookie/origin). Unsigned or tampered requests change nothing (audit H-4).
const MAX_WEBHOOK_BYTES = 256 * 1024;

export const POST = publicRoute({ skipOriginCheck: true }, async (ctx) => {
  const raw = await ctx.req.text();
  if (Buffer.byteLength(raw) > MAX_WEBHOOK_BYTES) throw badRequest("Payload too large");

  let event;
  try {
    event = verifyStripeWebhook(raw, ctx.req.headers.get("stripe-signature"));
  } catch {
    ctx.log.metric("payment.webhook_invalid");
    throw badRequest("Invalid signature");
  }

  const result = await handleStripeEvent(event, { requestId: ctx.requestId });
  ctx.log.info("stripe webhook", { eventType: event.type, result });
  return json({ received: true, result });
});
