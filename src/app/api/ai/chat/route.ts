import { z } from "zod";
import { runAgentTurn } from "@/AI";
import { enforce, RATE_LIMITS } from "@/server/security/rateLimit";
import { authed, json } from "@/server/withApi";

const chatSchema = z
  .object({
    message: z.string().max(4000),
    conversationId: z.string().max(40).optional(),
  })
  .strict();

// One assistant turn. The session user IS the actor for every tool the model
// calls; nothing in the body can change who the assistant acts as.
export const POST = authed({}, async (ctx) => {
  await enforce([[`ai:${ctx.actor.id}`, RATE_LIMITS.ai]]);
  const input = await ctx.body(chatSchema);
  return json(await runAgentTurn({ user: ctx.actor, message: input.message, conversationId: input.conversationId, requestId: ctx.requestId }));
});
