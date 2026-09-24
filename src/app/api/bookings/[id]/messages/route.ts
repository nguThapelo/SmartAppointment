import { userActor } from "@/server/actors";
import { enforce, RATE_LIMITS } from "@/server/security/rateLimit";
import { listMessages, messageSchema, messagesQuerySchema, postMessage } from "@/server/services/chat";
import { bookingKey } from "@/server/validation/common";
import { authed, json } from "@/server/withApi";

// Polled by the UI (`?after=<iso>`) — Amplify SSR has no websockets.
export const GET = authed<{ id: string }>({}, async (ctx) => {
  const { after } = ctx.query(messagesQuerySchema);
  return json({ data: await listMessages(userActor(ctx.actor), bookingKey.parse(ctx.params.id), after) });
});

export const POST = authed<{ id: string }>({ roles: ["CLIENT", "PROVIDER"] }, async (ctx) => {
  await enforce([[`write:${ctx.actor.id}`, RATE_LIMITS.write]]);
  const { body } = await ctx.body(messageSchema);
  return json(await postMessage(userActor(ctx.actor), bookingKey.parse(ctx.params.id), body), 201);
});
