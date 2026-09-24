import type { Metadata } from "next";
import { requirePageUser } from "@/server/auth/page";
import { AdminOverview, ClientDashboard, ProviderDashboard } from "./Dashboards";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requirePageUser();
  const { denied } = await searchParams;
  const props = { firstName: user.firstName, tz: user.timezone, denied: denied === "1" };
  if (user.role === "ADMIN") return <AdminOverview {...props} />;
  if (user.role === "PROVIDER") return <ProviderDashboard {...props} />;
  return <ClientDashboard {...props} />;
}
