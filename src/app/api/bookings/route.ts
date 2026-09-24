import { userActor } from "@/server/actors";
import { runIdempotent } from "@/server/security/idempotency";
import { enforce, RATE_LIMITS } from "@/server/security/rateLimit";
import { create, listForActor } from "@/server/services/booking";
import { bookingCreateSchema, bookingListSchema } from "@/server/validation/booking";
import { authed, json } from "@/server/withApi";

export const GET = authed({}, async (ctx) =>
  json(await listForActor(userActor(ctx.actor), ctx.query(bookingListSchema))),
);

// Clients book for themselves; admins may book on behalf of a client. The
// Idempotency-Key header makes double-clicks and retries safe.
export const POST = authed({ roles: ["CLIENT", "ADMIN"] }, async (ctx) => {
  await enforce([[`write:${ctx.actor.id}`, RATE_LIMITS.write]]);
  const input = await ctx.body(bookingCreateSchema);
  const result = await runIdempotent({
    scope: `booking.create:${ctx.actor.id}`,
    key: ctx.idempotencyKey,
    body: input,
    exec: async () => ({
      status: 201,
      body: await create(userActor(ctx.actor), input, { requestId: ctx.requestId }),
    }),
  });
  return json(result.body, result.status, result.replayed ? { "idempotent-replay": "true" } : undefined);
});
