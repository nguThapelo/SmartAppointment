import { userActor } from "@/server/actors";
import { updateCategory } from "@/server/services/catalog";
import { categoryUpdateSchema } from "@/server/validation/booking";
import { id } from "@/server/validation/common";
import { authed, json } from "@/server/withApi";

export const PATCH = authed<{ id: string }>({ roles: ["ADMIN"] }, async (ctx) => {
  const input = await ctx.body(categoryUpdateSchema);
  return json(await updateCategory(userActor(ctx.actor), id.parse(ctx.params.id), input, { requestId: ctx.requestId }));
});
