import { userActor } from "@/server/actors";
import { createSet, listSets, setCreateSchema } from "@/server/services/feedback";
import { authed, json } from "@/server/withApi";

export const GET = authed({}, async (ctx) => json({ data: await listSets(userActor(ctx.actor)) }));

// Admins create GLOBAL sets; providers create sets that apply to their own bookings.
export const POST = authed({ roles: ["ADMIN", "PROVIDER"] }, async (ctx) => {
  const input = await ctx.body(setCreateSchema);
  return json(await createSet(userActor(ctx.actor), input, { requestId: ctx.requestId }), 201);
});
