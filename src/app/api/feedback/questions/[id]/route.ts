import { userActor } from "@/server/actors";
import { questionUpdateSchema, updateQuestion } from "@/server/services/feedback";
import { id } from "@/server/validation/common";
import { authed, json } from "@/server/withApi";

export const PATCH = authed<{ id: string }>({ roles: ["ADMIN", "PROVIDER"] }, async (ctx) => {
  const input = await ctx.body(questionUpdateSchema);
  return json(await updateQuestion(userActor(ctx.actor), id.parse(ctx.params.id), input, { requestId: ctx.requestId }));
});
