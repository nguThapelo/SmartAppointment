import { confirmAction } from "@/AI";
import { enforce, RATE_LIMITS } from "@/server/security/rateLimit";
import { id } from "@/server/validation/common";
import { authed, json } from "@/server/withApi";

// The human-in-the-loop step: only here does an assistant-proposed change run.
export const POST = authed<{ id: string }>({}, async (ctx) => {
  await enforce([[`write:${ctx.actor.id}`, RATE_LIMITS.write]]);
  return json(await confirmAction(ctx.actor, id.parse(ctx.params.id), ctx.requestId));
});
