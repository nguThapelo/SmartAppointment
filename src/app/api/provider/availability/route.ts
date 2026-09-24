import { userActor } from "@/server/actors";
import { getRules, setRules } from "@/server/services/availability";
import { availabilityRulesSchema } from "@/server/validation/booking";
import { authed, json } from "@/server/withApi";

export const GET = authed({ roles: ["PROVIDER"] }, async (ctx) => json(await getRules(userActor(ctx.actor))));

export const PUT = authed({ roles: ["PROVIDER"] }, async (ctx) => {
  const input = await ctx.body(availabilityRulesSchema);
  return json(await setRules(userActor(ctx.actor), input, { requestId: ctx.requestId }));
});
