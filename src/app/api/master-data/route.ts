import { userActor } from "@/server/actors";
import { listMasterData, masterItemSchema, masterTypeSchema, upsertItem, upsertType } from "@/server/services/masterData";
import { authed, json } from "@/server/withApi";
import { z } from "zod";

export const GET = authed({}, async (ctx) => json({ data: await listMasterData(userActor(ctx.actor)) }));

const upsertSchema = z.union([
  z.object({ type: masterTypeSchema }).strict(),
  z.object({ item: masterItemSchema }).strict(),
]);

export const POST = authed({ roles: ["ADMIN"] }, async (ctx) => {
  const body = await ctx.body(upsertSchema);
  const actor = userActor(ctx.actor);
  const c = { requestId: ctx.requestId };
  return json("type" in body ? await upsertType(actor, body.type, c) : await upsertItem(actor, body.item, c), 201);
});
