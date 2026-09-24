import { userActor } from "@/server/actors";
import { setUpdateSchema, updateSet } from "@/server/services/feedback";
import { id } from "@/server/validation/common";
import { authed, json } from "@/server/withApi";

export const PATCH = authed<{ id: string }>({ roles: ["ADMIN", "PROVIDER"] }, async (ctx) => {
  const input = await ctx.body(setUpdateSchema);
  return json(await updateSet(userActor(ctx.actor), id.parse(ctx.params.id), input, { requestId: ctx.requestId }));
});
