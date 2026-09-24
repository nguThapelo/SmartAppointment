import { userActor } from "@/server/actors";
import { createUser, listUsers } from "@/server/services/users";
import { adminUserCreateSchema, userListSchema } from "@/server/validation/booking";
import { authed, json } from "@/server/withApi";

export const GET = authed({ roles: ["ADMIN"] }, async (ctx) =>
  json(await listUsers(userActor(ctx.actor), ctx.query(userListSchema))),
);

export const POST = authed({ roles: ["ADMIN"] }, async (ctx) => {
  const input = await ctx.body(adminUserCreateSchema);
  return json(await createUser(userActor(ctx.actor), input, { requestId: ctx.requestId }), 201);
});
