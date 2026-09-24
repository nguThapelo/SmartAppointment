import { userActor } from "@/server/actors";
import { periodSchema, providerEarnings } from "@/server/services/reports";
import { authed, json } from "@/server/withApi";

export const GET = authed({ roles: ["PROVIDER"] }, async (ctx) =>
  json(await providerEarnings(userActor(ctx.actor), ctx.query(periodSchema).days)),
);
