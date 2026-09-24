import { userActor } from "@/server/actors";
import { listOwnServices, upsertOwnService } from "@/server/services/pricing";
import { providerServiceUpsertSchema } from "@/server/validation/booking";
import { authed, json } from "@/server/withApi";

// A provider's own services & prices. No provider id in the request: the
// service always targets the signed-in provider.
export const GET = authed({ roles: ["PROVIDER"] }, async (ctx) =>
  json({ data: await listOwnServices(userActor(ctx.actor)) }),
);

export const PUT = authed({ roles: ["PROVIDER"] }, async (ctx) => {
  const input = await ctx.body(providerServiceUpsertSchema);
  return json(await upsertOwnService(userActor(ctx.actor), input, { requestId: ctx.requestId }));
});
