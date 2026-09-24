import { prisma } from "@/lib/db";
import { json, publicRoute } from "@/server/withApi";

// Liveness + database reachability for smoke tests and uptime checks.
// Reveals nothing beyond "up" / "down".
export const GET = publicRoute({}, async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return json({ status: "ok", database: "ok" });
  } catch {
    return json({ status: "degraded", database: "unreachable" }, 503);
  }
});
