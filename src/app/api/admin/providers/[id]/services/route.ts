import { userActor } from "@/server/actors";
import { listOwnServices, upsertOwnService } from "@/server/services/pricing";
import { providerServiceUpsertSchema } from "@/server/validation/booking";
import { id } from "@/server/validation/common";
import { authed, json } from "@/server/withApi";

// Admin view/edit of any provider's services & prices.
export const GET = authed<{ id: string }>({ roles: ["ADMIN"] }, async (ctx) =>
  json({ data: await listOwnServices(userActor(ctx.actor), id.parse(ctx.params.id)) }),
);

export const PUT = authed<{ id: string }>({ roles: ["ADMIN"] }, async (ctx) => {
  const input = await ctx.body(providerServiceUpsertSchema);
  return json(await upsertOwnService(userActor(ctx.actor), input, { requestId: ctx.requestId }, id.parse(ctx.params.id)));
});
