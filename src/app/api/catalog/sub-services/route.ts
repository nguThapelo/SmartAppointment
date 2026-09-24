import { userActor } from "@/server/actors";
import { createSubService } from "@/server/services/catalog";
import { subServiceCreateSchema } from "@/server/validation/booking";
import { authed, json } from "@/server/withApi";

export const POST = authed({ roles: ["ADMIN"] }, async (ctx) => {
  const input = await ctx.body(subServiceCreateSchema);
  return json(await createSubService(userActor(ctx.actor), input, { requestId: ctx.requestId }), 201);
});
