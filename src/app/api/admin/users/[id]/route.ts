import { userActor } from "@/server/actors";
import { updateUser } from "@/server/services/users";
import { adminUserUpdateSchema } from "@/server/validation/booking";
import { id } from "@/server/validation/common";
import { authed, json } from "@/server/withApi";

export const PATCH = authed<{ id: string }>({ roles: ["ADMIN"] }, async (ctx) => {
  const input = await ctx.body(adminUserUpdateSchema);
  return json(await updateUser(userActor(ctx.actor), id.parse(ctx.params.id), input, { requestId: ctx.requestId }));
});
