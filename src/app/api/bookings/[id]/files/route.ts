import { userActor } from "@/server/actors";
import { enforce, RATE_LIMITS } from "@/server/security/rateLimit";
import { listFiles, requestUpload, uploadRequestSchema } from "@/server/services/files";
import { bookingKey } from "@/server/validation/common";
import { authed, json } from "@/server/withApi";

export const GET = authed<{ id: string }>({}, async (ctx) =>
  json({ data: await listFiles(userActor(ctx.actor), bookingKey.parse(ctx.params.id)) }),
);

// Returns a 5-minute presigned PUT URL; the browser uploads straight to S3.
export const POST = authed<{ id: string }>({}, async (ctx) => {
  await enforce([[`write:${ctx.actor.id}`, RATE_LIMITS.write]]);
  const input = await ctx.body(uploadRequestSchema);
  return json(await requestUpload(userActor(ctx.actor), bookingKey.parse(ctx.params.id), input, { requestId: ctx.requestId }), 201);
});
