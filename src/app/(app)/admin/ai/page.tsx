import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth/page";
import { AiActivity } from "./AiActivity";

export const metadata: Metadata = { title: "AI activity" };

export default async function AiActivityPage() {
  const user = await requirePageUser(["ADMIN"], "/admin/ai");
  return <AiActivity tz={user.timezone} />;
}
