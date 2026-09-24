import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth/page";
import { AvailabilityEditor } from "./AvailabilityEditor";

export const metadata: Metadata = { title: "Availability" };

export default async function AvailabilityPage() {
  await requirePageUser(["PROVIDER"], "/provider/availability");
  return <AvailabilityEditor />;
}
