import { enforce, RATE_LIMITS } from "@/server/security/rateLimit";
import { requestPasswordReset } from "@/server/services/auth";
import { forgotPasswordSchema } from "@/server/validation/auth";
import { json, publicRoute } from "@/server/withApi";

// Always 200 with the same body, whether or not the email exists (audit H-9).
export const POST = publicRoute({}, async (ctx) => {
  const input = await ctx.body(forgotPasswordSchema);
  await enforce([
    [`forgot:ip:${ctx.ip}`, RATE_LIMITS.forgotIp],
    [`forgot:email:${input.email}`, RATE_LIMITS.forgotEmail],
  ]);
  await requestPasswordReset(input, { requestId: ctx.requestId });
  return json({ ok: true, message: "If that email has an account, a reset link is on its way." });
});
