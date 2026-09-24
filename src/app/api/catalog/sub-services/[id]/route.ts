import { userActor } from "@/server/actors";
import { getSubService, updateSubService } from "@/server/services/catalog";
import { subServiceUpdateSchema } from "@/server/validation/booking";
import { id } from "@/server/validation/common";
import { authed, json, publicRoute } from "@/server/withApi";

export const GET = publicRoute<{ id: string }>({}, async (ctx) => json(await getSubService(id.parse(ctx.params.id))));

export const PATCH = authed<{ id: string }>({ roles: ["ADMIN"] }, async (ctx) => {
  const input = await ctx.body(subServiceUpdateSchema);
  return json(await updateSubService(userActor(ctx.actor), id.parse(ctx.params.id), input, { requestId: ctx.requestId }));
});
