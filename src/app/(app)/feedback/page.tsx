import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth/page";
import { FeedbackCenter } from "./FeedbackCenter";

export const metadata: Metadata = { title: "Feedback" };

export default async function FeedbackPage() {
  const user = await requirePageUser(["PROVIDER", "ADMIN"], "/feedback");
  return <FeedbackCenter role={user.role} tz={user.timezone} />;
}
