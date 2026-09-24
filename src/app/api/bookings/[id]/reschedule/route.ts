import { userActor } from "@/server/actors";
import { enforce, RATE_LIMITS } from "@/server/security/rateLimit";
import { reschedule } from "@/server/services/booking";
import { rescheduleSchema } from "@/server/validation/booking";
import { bookingKey } from "@/server/validation/common";
import { authed, json } from "@/server/withApi";

export const POST = authed<{ id: string }>({}, async (ctx) => {
  await enforce([[`write:${ctx.actor.id}`, RATE_LIMITS.write]]);
  const { startsAt } = await ctx.body(rescheduleSchema);
  return json(await reschedule(userActor(ctx.actor), bookingKey.parse(ctx.params.id), startsAt, { requestId: ctx.requestId }));
});
