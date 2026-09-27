import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { requirePageUser } from "@/server/auth/page";
import { isConfigured } from "@/server/env";

// Every page under (app) requires a signed-in user. Pages that need a
// specific role call requirePageUser(roles) themselves.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requirePageUser();
  return (
    <AppShell
      user={{ firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, timezone: user.timezone }}
      features={{ whatsapp: isConfigured.whatsapp() }}
    >
      {children}
    </AppShell>
  );
}
