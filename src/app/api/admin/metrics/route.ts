import { userActor } from "@/server/actors";
import { periodSchema, platformMetrics } from "@/server/services/reports";
import { authed, json } from "@/server/withApi";

export const GET = authed({ roles: ["ADMIN"] }, async (ctx) =>
  json(await platformMetrics(userActor(ctx.actor), ctx.query(periodSchema).days)),
);
