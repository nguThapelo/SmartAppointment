import { withoutSession } from "@/server/auth/cookies";
import { logoutEverywhere } from "@/server/services/auth";
import { authed } from "@/server/withApi";

export const POST = authed({}, async (ctx) => {
  await logoutEverywhere(ctx.actor, { requestId: ctx.requestId });
  return withoutSession({ ok: true });
});
