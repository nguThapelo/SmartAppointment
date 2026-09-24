import { userActor } from "@/server/actors";
import { id } from "@/server/validation/common";
import { channelUpdateSchema, updateChannel } from "@/server/whatsapp/service";
import { authed, json } from "@/server/withApi";

export const PATCH = authed<{ id: string }>({ roles: ["ADMIN"] }, async (ctx) => {
  const input = await ctx.body(channelUpdateSchema);
  return json(await updateChannel(userActor(ctx.actor), id.parse(ctx.params.id), input, { requestId: ctx.requestId }));
});
