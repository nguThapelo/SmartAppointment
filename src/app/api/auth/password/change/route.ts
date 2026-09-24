import { withSession } from "@/server/auth/cookies";
import { changePassword } from "@/server/services/auth";
import { changePasswordSchema } from "@/server/validation/auth";
import { authed } from "@/server/withApi";

export const POST = authed({}, async (ctx) => {
  const input = await ctx.body(changePasswordSchema);
  const { token } = await changePassword(ctx.actor, input, { requestId: ctx.requestId });
  return withSession({ ok: true }, token);
});
