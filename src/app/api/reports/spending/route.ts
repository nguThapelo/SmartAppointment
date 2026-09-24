import { userActor } from "@/server/actors";
import { clientSpending, periodSchema } from "@/server/services/reports";
import { authed, json } from "@/server/withApi";

export const GET = authed({ roles: ["CLIENT"] }, async (ctx) =>
  json(await clientSpending(userActor(ctx.actor), ctx.query(periodSchema).days)),
);
