import { getMe } from "@/server/services/auth";
import { authed, json } from "@/server/withApi";

export const GET = authed({}, async (ctx) => json({ user: await getMe(ctx.actor) }));
