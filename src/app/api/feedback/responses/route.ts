import { userActor } from "@/server/actors";
import { listResponses } from "@/server/services/feedback";
import { authed, json } from "@/server/withApi";

export const GET = authed({}, async (ctx) => json(await listResponses(userActor(ctx.actor))));
