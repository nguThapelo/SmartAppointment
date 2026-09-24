import { userActor } from "@/server/actors";
import { listConversations } from "@/server/whatsapp/service";
import { authed, json } from "@/server/withApi";

export const GET = authed({ roles: ["ADMIN", "PROVIDER"] }, async (ctx) => json({ data: await listConversations(userActor(ctx.actor)) }));
