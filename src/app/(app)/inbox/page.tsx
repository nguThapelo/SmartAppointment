import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth/page";
import { Inbox } from "./Inbox";

export const metadata: Metadata = { title: "WhatsApp" };

export default async function InboxPage() {
  const user = await requirePageUser(["PROVIDER", "ADMIN"], "/inbox");
  return <Inbox isAdmin={user.role === "ADMIN"} />;
}
