import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { env } from "@/server/env";
import { unauthorized } from "@/server/errors";
import { runJob, JOBS } from "@/server/services/jobs";
import { json, publicRoute } from "@/server/withApi";

// Scheduled jobs, triggered by EventBridge Scheduler → Lambda (Amplify has no cron;
// see infra/aws/scheduled-jobs-lambda.mjs):
//   POST /api/cron/<job>   Authorization: Bearer <CRON_SECRET>
const jobParam = z.enum(JOBS);

function authorised(header: string | null) {
  const secret = env().CRON_SECRET;
  if (!secret || !header?.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const POST = publicRoute<{ job: string }>({ skipOriginCheck: true }, async (ctx) => {
  if (!authorised(ctx.req.headers.get("authorization"))) {
    ctx.log.metric("cron.unauthorised");
    throw unauthorized("UNAUTHORISED", "Unauthorised");
  }
  const job = jobParam.parse(ctx.params.job);
  const result = await runJob(job, { requestId: ctx.requestId });
  return json({ job, result });
});
