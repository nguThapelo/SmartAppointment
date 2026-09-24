import { userActor } from "@/server/actors";
import { addQuestion, questionSchema } from "@/server/services/feedback";
import { id } from "@/server/validation/common";
import { authed, json } from "@/server/withApi";

export const POST = authed<{ id: string }>({ roles: ["ADMIN", "PROVIDER"] }, async (ctx) => {
  const input = await ctx.body(questionSchema);
  return json(await addQuestion(userActor(ctx.actor), id.parse(ctx.params.id), input, { requestId: ctx.requestId }), 201);
});
