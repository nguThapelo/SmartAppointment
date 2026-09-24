import { userActor } from "@/server/actors";
import { removeOverride } from "@/server/services/availability";
import { id } from "@/server/validation/common";
import { authed, json } from "@/server/withApi";

export const DELETE = authed<{ id: string }>({ roles: ["PROVIDER", "ADMIN"] }, async (ctx) => {
  await removeOverride(userActor(ctx.actor), id.parse(ctx.params.id), { requestId: ctx.requestId });
  return json({ ok: true });
});
