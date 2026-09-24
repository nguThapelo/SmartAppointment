import { userActor } from "@/server/actors";
import { auditQuerySchema, listAuditEvents } from "@/server/services/reports";
import { authed, json } from "@/server/withApi";

export const GET = authed({ roles: ["ADMIN"] }, async (ctx) =>
  json({ data: await listAuditEvents(userActor(ctx.actor), ctx.query(auditQuerySchema)) }),
);
