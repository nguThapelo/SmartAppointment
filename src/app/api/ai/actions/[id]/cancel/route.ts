import { cancelAction } from "@/AI";
import { id } from "@/server/validation/common";
import { authed, json } from "@/server/withApi";

export const POST = authed<{ id: string }>({}, async (ctx) => json(await cancelAction(ctx.actor, id.parse(ctx.params.id))));
