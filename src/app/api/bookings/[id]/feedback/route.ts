import { userActor } from "@/server/actors";
import { runIdempotent } from "@/server/security/idempotency";
import { feedbackForBooking, submitFeedback, submitSchema } from "@/server/services/feedback";
import { bookingKey } from "@/server/validation/common";
import { authed, json } from "@/server/withApi";

export const GET = authed<{ id: string }>({}, async (ctx) =>
  json(await feedbackForBooking(userActor(ctx.actor), bookingKey.parse(ctx.params.id))),
);

export const POST = authed<{ id: string }>({ roles: ["CLIENT"] }, async (ctx) => {
  const key = bookingKey.parse(ctx.params.id);
  const input = await ctx.body(submitSchema);
  const result = await runIdempotent({
    scope: `feedback.submit:${ctx.actor.id}:${key}`,
    key: ctx.idempotencyKey,
    body: input,
    exec: async () => ({ status: 201, body: await submitFeedback(userActor(ctx.actor), key, input, { requestId: ctx.requestId }) }),
  });
  return json(result.body, result.status);
});
