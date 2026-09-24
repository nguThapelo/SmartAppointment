import { userActor } from "@/server/actors";
import { channelCreateSchema, createChannel, listChannels } from "@/server/whatsapp/service";
import { authed, json } from "@/server/withApi";

export const GET = authed({ roles: ["ADMIN", "PROVIDER"] }, async (ctx) => json({ data: await listChannels(userActor(ctx.actor)) }));

export const POST = authed({ roles: ["ADMIN"] }, async (ctx) => {
  const input = await ctx.body(channelCreateSchema);
  return json(await createChannel(userActor(ctx.actor), input, { requestId: ctx.requestId }), 201);
});
