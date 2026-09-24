import { userActor } from "@/server/actors";
import { enforce, RATE_LIMITS } from "@/server/security/rateLimit";
import { id } from "@/server/validation/common";
import { replySchema, replyToConversation } from "@/server/whatsapp/service";
import { authed, json } from "@/server/withApi";

// Staff reply to a WhatsApp customer — scoped to channels the caller manages,
// rate-limited, and only inside Meta's 24h customer-service window.
export const POST = authed<{ id: string }>({ roles: ["ADMIN", "PROVIDER"] }, async (ctx) => {
  await enforce([[`write:${ctx.actor.id}`, RATE_LIMITS.write]]);
  const { body } = await ctx.body(replySchema);
  return json(await replyToConversation(userActor(ctx.actor), id.parse(ctx.params.id), body, { requestId: ctx.requestId }));
});
