import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth/page";
import { ServicesManager } from "./ServicesManager";

export const metadata: Metadata = { title: "Services & prices" };

export default async function ProviderServicesPage() {
  await requirePageUser(["PROVIDER"], "/provider/services");
  return <ServicesManager />;
}
