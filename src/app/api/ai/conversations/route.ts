import { listConversations } from "@/AI";
import { authed, json } from "@/server/withApi";

export const GET = authed({}, async (ctx) => json({ data: await listConversations(ctx.actor) }));
