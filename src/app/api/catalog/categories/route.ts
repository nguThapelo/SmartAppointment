import { userActor } from "@/server/actors";
import { createCategory, listCategories } from "@/server/services/catalog";
import { categoryCreateSchema } from "@/server/validation/booking";
import { authed, json, publicRoute } from "@/server/withApi";

export const GET = publicRoute({}, async (ctx) =>
  json({ data: await listCategories(ctx.actor ? userActor(ctx.actor) : null) }),
);

export const POST = authed({ roles: ["ADMIN"] }, async (ctx) => {
  const input = await ctx.body(categoryCreateSchema);
  return json(await createCategory(userActor(ctx.actor), input, { requestId: ctx.requestId }), 201);
});
