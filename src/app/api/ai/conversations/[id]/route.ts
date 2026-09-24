import { deleteConversation, getConversation } from "@/AI";
import { id } from "@/server/validation/common";
import { authed, json } from "@/server/withApi";

export const GET = authed<{ id: string }>({}, async (ctx) => json(await getConversation(ctx.actor, id.parse(ctx.params.id))));

export const DELETE = authed<{ id: string }>({}, async (ctx) => {
  await deleteConversation(ctx.actor, id.parse(ctx.params.id));
  return json({ ok: true });
});
