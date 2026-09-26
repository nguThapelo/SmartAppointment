// AWS Lambda (Node.js 22) that runs Appointment Hub's scheduled jobs.
// Amplify Hosting has no cron, so EventBridge Scheduler invokes this function,
// which calls the app's secret-protected job endpoints. Both services stay
// inside the AWS always-free tier at this volume (~750 invocations/month).
//
// Setup (console only): docs/deploy/DEPLOY.md §10. Paste this file into the
// Lambda code editor as index.mjs.
//   Environment variables: APP_URL, CRON_SECRET (same value as in Amplify)
//   Schedule payload:      {"jobs": ["reconcile-payments"]}
//                          {"jobs": ["close-completed", "cleanup"]}

const JOBS = new Set(["reconcile-payments", "close-completed", "cleanup"]);

export const handler = async (event) => {
  const { APP_URL, CRON_SECRET } = process.env;
  if (!APP_URL || !CRON_SECRET) throw new Error("Set APP_URL and CRON_SECRET");

  const jobs = Array.isArray(event?.jobs) ? event.jobs : [];
  if (jobs.length === 0 || !jobs.every((j) => JOBS.has(j))) {
    throw new Error(`Unknown jobs: ${JSON.stringify(event?.jobs)}`);
  }

  const results = {};
  for (const job of jobs) {
    const res = await fetch(`${APP_URL.replace(/\/$/, "")}/api/cron/${job}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
      signal: AbortSignal.timeout(50_000),
    });
    const body = await res.text();
    console.log(JSON.stringify({ job, status: res.status, body: body.slice(0, 500) }));
    // Throwing marks the invocation failed, so it shows up in Lambda monitoring.
    if (!res.ok) throw new Error(`${job} failed with HTTP ${res.status}`);
    results[job] = res.status;
  }
  return results;
};
