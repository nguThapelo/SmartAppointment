import { userActor } from "@/server/actors";
import { addOverride } from "@/server/services/availability";
import { overrideCreateSchema } from "@/server/validation/booking";
import { authed, json } from "@/server/withApi";

export const POST = authed({ roles: ["PROVIDER"] }, async (ctx) => {
  const input = await ctx.body(overrideCreateSchema);
  return json(await addOverride(userActor(ctx.actor), input, { requestId: ctx.requestId }), 201);
});
