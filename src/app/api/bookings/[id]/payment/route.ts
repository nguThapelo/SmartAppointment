import { userActor } from "@/server/actors";
import { runIdempotent } from "@/server/security/idempotency";
import { enforce, RATE_LIMITS } from "@/server/security/rateLimit";
import { getLatestForActor, requestPayment } from "@/server/services/payment";
import { bookingKey } from "@/server/validation/common";
import { authed, json } from "@/server/withApi";

// GET: latest payment status for anyone who can see the booking. The pay link
// is only included for the customer. Status comes from our DB, which only the
// Stripe webhook / reconcile job update — never from the browser.
export const GET = authed<{ id: string }>({}, async (ctx) =>
  json({ payment: await getLatestForActor(userActor(ctx.actor), bookingKey.parse(ctx.params.id)) }),
);

// POST: provider (or admin) requests payment → Stripe Checkout link for the client.
export const POST = authed<{ id: string }>({ roles: ["PROVIDER", "ADMIN"] }, async (ctx) => {
  await enforce([[`write:${ctx.actor.id}`, RATE_LIMITS.write]]);
  const key = bookingKey.parse(ctx.params.id);
  const result = await runIdempotent({
    scope: `payment.request:${ctx.actor.id}:${key}`,
    key: ctx.idempotencyKey,
    body: { booking: key },
    exec: async () => ({
      status: 201,
      body: { payment: await requestPayment(userActor(ctx.actor), key, { requestId: ctx.requestId }) },
    }),
  });
  return json(result.body, result.status);
});
