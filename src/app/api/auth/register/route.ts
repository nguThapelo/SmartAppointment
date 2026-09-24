import { withSession } from "@/server/auth/cookies";
import { enforce, RATE_LIMITS } from "@/server/security/rateLimit";
import { register } from "@/server/services/auth";
import { registerSchema } from "@/server/validation/auth";
import { publicRoute } from "@/server/withApi";

export const POST = publicRoute({}, async (ctx) => {
  await enforce([[`register:${ctx.ip}`, RATE_LIMITS.register]]);
  const input = await ctx.body(registerSchema);
  const { user, token } = await register(input, { requestId: ctx.requestId });
  return withSession({ user }, token, 201);
});
