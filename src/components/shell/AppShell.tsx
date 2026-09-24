"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";
import { Bot, LogOut, Menu, X } from "lucide-react";
import type { Role } from "@prisma/client";
import { Logo } from "@/components/brand";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { api } from "@/lib/api";
import { cx } from "@/lib/format";
import { NAV } from "./nav";

export interface ShellUser {
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  timezone: string;
}

const UserContext = createContext<ShellUser | null>(null);
/** The signed-in user, for display only. Authorization always happens on the server. */
export const useUser = () => useContext(UserContext)!;

const ROLE_LABEL: Record<Role, string> = { CLIENT: "Client", PROVIDER: "Provider", ADMIN: "Admin" };

export function AppShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    // Full reload so no client state from the old session survives.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
  }

  const nav = (
    <nav aria-label="Main" className="flex flex-1 flex-col gap-0.5 px-3">
      {NAV[user.role].map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setMenuOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cx(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-brand-50 text-brand-800" : "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const userBox = (
    <div className="border-t border-ink-100 p-3">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <div className="grid size-9 place-items-center rounded-full bg-ink-100 text-sm font-semibold text-ink-600" aria-hidden>
          {user.firstName[0]}
          {user.lastName[0]}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink-900">{user.firstName} {user.lastName}</p>
          <p className="truncate text-xs text-ink-500">{ROLE_LABEL[user.role]} · {user.email}</p>
        </div>
        <button onClick={signOut} className="rounded-md p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700" aria-label="Sign out" title="Sign out">
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  );

  return (
    <UserContext.Provider value={user}>
      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-ink-200 bg-white lg:flex">
          <div className="px-6 py-5"><Logo href="/dashboard" /></div>
          {nav}
          {userBox}
        </aside>

        {/* Mobile drawer */}
        {menuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-ink-900/40" onClick={() => setMenuOpen(false)} aria-hidden />
            <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-xl">
              <div className="flex items-center justify-between px-6 py-5">
                <Logo href="/dashboard" />
                <button onClick={() => setMenuOpen(false)} aria-label="Close menu" className="rounded-md p-1 text-ink-500 hover:bg-ink-100">
                  <X className="size-5" />
                </button>
              </div>
              {nav}
              {userBox}
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
            <button onClick={() => setMenuOpen(true)} aria-label="Open menu" className="rounded-md p-1.5 text-ink-600 hover:bg-ink-100">
              <Menu className="size-5" />
            </button>
            <Logo href="/dashboard" />
            <span className="w-8" />
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pt-8">{children}</main>
        </div>

        {/* Assistant: floating button + slide-over, available on every page */}
        {pathname !== "/assistant" && (
          <button
            onClick={() => setAssistantOpen(true)}
            className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full bg-ink-900 px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-ink-800"
            aria-haspopup="dialog"
          >
            <Bot className="size-4" aria-hidden /> Ask the assistant
          </button>
        )}
        {assistantOpen && (
          <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Assistant">
            <div className="absolute inset-0 bg-ink-900/30" onClick={() => setAssistantOpen(false)} aria-hidden />
            <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
                <p className="flex items-center gap-2 font-semibold text-ink-900"><Bot className="size-4" /> Assistant</p>
                <button onClick={() => setAssistantOpen(false)} aria-label="Close assistant" className="rounded-md p-1 text-ink-500 hover:bg-ink-100">
                  <X className="size-5" />
                </button>
              </div>
              <AssistantPanel compact />
            </div>
          </div>
        )}
      </div>
    </UserContext.Provider>
  );
}
