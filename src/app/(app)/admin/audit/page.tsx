import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth/page";
import { AuditLog } from "./AuditLog";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage() {
  const user = await requirePageUser(["ADMIN"], "/admin/audit");
  return <AuditLog tz={user.timezone} />;
}
