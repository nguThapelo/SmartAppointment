import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth/page";
import { EarningsView } from "./EarningsView";

export const metadata: Metadata = { title: "Earnings" };

export default async function EarningsPage() {
  await requirePageUser(["PROVIDER"], "/earnings");
  return <EarningsView />;
}
