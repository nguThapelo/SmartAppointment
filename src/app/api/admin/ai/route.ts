import { recentToolCalls } from "@/AI";
import { authed, json } from "@/server/withApi";

// Assistant activity for admins: tool-call metadata only, never message content.
export const GET = authed({ roles: ["ADMIN"] }, async (ctx) => json({ data: await recentToolCalls(ctx.actor) }));
