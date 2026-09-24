import { withoutSession } from "@/server/auth/cookies";
import { publicRoute } from "@/server/withApi";

// Clears this browser's cookie. Use /api/auth/logout-all to revoke every device.
export const POST = publicRoute({}, async () => withoutSession({ ok: true }));
