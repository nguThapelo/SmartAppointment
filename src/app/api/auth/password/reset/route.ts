import { enforce, RATE_LIMITS } from "@/server/security/rateLimit";
import { resetPassword } from "@/server/services/auth";
import { resetPasswordSchema } from "@/server/validation/auth";
import { json, publicRoute } from "@/server/withApi";

export const POST = publicRoute({}, async (ctx) => {
  await enforce([[`reset:ip:${ctx.ip}`, RATE_LIMITS.forgotIp]]);
  const input = await ctx.body(resetPasswordSchema);
  await resetPassword(input, { requestId: ctx.requestId });
  return json({ ok: true });
});
