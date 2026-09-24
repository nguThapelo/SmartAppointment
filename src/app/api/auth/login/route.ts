import { withSession } from "@/server/auth/cookies";
import { enforce, RATE_LIMITS } from "@/server/security/rateLimit";
import { login } from "@/server/services/auth";
import { loginSchema } from "@/server/validation/auth";
import { publicRoute } from "@/server/withApi";

export const POST = publicRoute({}, async (ctx) => {
  const input = await ctx.body(loginSchema);
  // Keyed by IP AND by email: an attacker rotating IPs is still capped per
  // account, and one noisy IP can't lock out a real user's email on its own.
  await enforce([
    [`login:ip:${ctx.ip}`, RATE_LIMITS.loginIp],
    [`login:email:${input.email}`, RATE_LIMITS.loginEmail],
  ]);
  const { user, token } = await login(input, { requestId: ctx.requestId });
  return withSession({ user }, token);
});
