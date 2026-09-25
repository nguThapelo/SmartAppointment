"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";
import { ChevronDown, ChevronsLeft, ChevronsRight, LogOut, Menu, Settings, Sparkles, X } from "lucide-react";
import type { Role } from "@prisma/client";
import { Logo, LogoMark } from "@/components/brand";
import { AssistantPanel } from "@/components/assistant/AssistantPanel";
import { IconButton } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
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

const ROLE_LABEL: Record<Role, string> = { CLIENT: "Client", PROVIDER: "Provider", ADMIN: "Administrator" };

function Avatar({ user, size = "md" }: { user: ShellUser; size?: "sm" | "md" }) {
  return (
    <span
      className={cx(
        "grid shrink-0 place-items-center rounded-full bg-brand-gradient font-semibold text-white shadow-glow ring-2 ring-white",
        size === "sm" ? "size-8 text-xs" : "size-10 text-sm",
      )}
      aria-hidden
    >
      {user.firstName[0]}
      {user.lastName[0]}
    </span>
  );
}

export function AppShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const items = NAV[user.role];
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const current = items.find((i) => isActive(i.href));

  async function signOut() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    // Full reload so no client state from the old session survives.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
  }

  const nav = (wide: boolean) => (
    <nav aria-label="Main" className={cx("flex flex-1 flex-col gap-1 px-3 py-2", wide ? "scroll-thin overflow-y-auto" : "overflow-visible")}>
      {items.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        const row = (
          <Link
            href={href}
            onClick={() => setMenuOpen(false)}
            aria-current={active ? "page" : undefined}
            aria-label={wide ? undefined : label}
            className={cx(
              "group relative flex h-11 items-center rounded-xl text-sm transition-all duration-150",
              wide ? "gap-3 px-2" : "justify-center",
              active ? "bg-brand-400/15 font-semibold text-white" : "font-medium text-white/60 hover:bg-white/[0.07] hover:text-white",
            )}
          >
            {active && <span className="absolute -left-3 top-2.5 bottom-2.5 w-1 rounded-r-full bg-brand-gradient" aria-hidden />}
            <span
              className={cx(
                "grid size-8 shrink-0 place-items-center rounded-lg transition-colors",
                active ? "bg-brand-400/25 text-brand-200 shadow-[0_0_18px_-2px_rgb(44_198_168/0.55)]" : "bg-white/[0.06] text-white/60 group-hover:text-white",
              )}
            >
              <Icon className="size-[18px]" aria-hidden />
            </span>
            {wide && <span className="truncate">{label}</span>}
          </Link>
        );
        return wide ? (
          <div key={href}>{row}</div>
        ) : (
          <Tooltip key={href} label={label} side="right" className="w-full [&>a]:w-full">
            {row}
          </Tooltip>
        );
      })}
    </nav>
  );

  const brand = (wide: boolean) => (
    <div className={cx("flex h-16 items-center", wide ? "justify-between px-5" : "justify-center")}>
      {wide ? <Logo href="/dashboard" tone="light" /> : <LogoMark />}
    </div>
  );

  const aiTile = (wide: boolean) => (
    <div className="px-3 pb-3">
      <button
        onClick={() => setAssistantOpen(true)}
        aria-label="Open the AI assistant"
        className={cx(
          "group relative w-full overflow-hidden rounded-2xl bg-accent-gradient text-left text-white shadow-glow-accent transition hover:brightness-110",
          wide ? "p-3.5" : "grid h-11 place-items-center",
        )}
      >
        <span className="absolute -right-6 -top-6 size-20 rounded-full bg-white/15 blur-sm" aria-hidden />
        {wide ? (
          <span className="relative flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-white/20"><Sparkles className="size-4" /></span>
            <span>
              <span className="block text-sm font-semibold">AI assistant</span>
              <span className="block text-xs text-white/75">Ask in plain language</span>
            </span>
          </span>
        ) : (
          <Sparkles className="relative size-4" aria-hidden />
        )}
      </button>
    </div>
  );

  return (
    <UserContext.Provider value={user}>
      <div className="flex min-h-screen bg-ink-50">
        {/* Desktop sidebar: full panel or icon rail */}
        <aside
          className={cx(
            "bg-sidebar-gradient sticky top-0 hidden h-screen shrink-0 flex-col border-r border-white/5 transition-[width] duration-200 lg:flex",
            expanded ? "w-[17rem]" : "w-[5.25rem]",
          )}
        >
          {brand(expanded)}
          {nav(expanded)}
          {aiTile(expanded)}
          <div className={cx("border-t border-white/[0.06] p-3", !expanded && "flex justify-center")}>
            <IconButton
              label={expanded ? "Collapse menu" : "Expand menu"}
              side="right"
              tone="light"
              onClick={() => setExpanded(!expanded)}
              icon={expanded ? <ChevronsLeft className="size-4" /> : <ChevronsRight className="size-4" />}
            />
          </div>
        </aside>

        {/* Mobile drawer */}
        {menuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm" onClick={() => setMenuOpen(false)} aria-hidden />
            <aside className="bg-sidebar-gradient absolute inset-y-0 left-0 flex w-72 animate-slide-in-left flex-col shadow-pop">
              <div className="flex h-16 items-center justify-between px-5">
                <Logo href="/dashboard" tone="light" />
                <IconButton label="Close menu" tone="light" side="left" onClick={() => setMenuOpen(false)} icon={<X className="size-5" />} />
              </div>
              {nav(true)}
              {aiTile(true)}
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Frosted app bar */}
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ink-200/60 bg-white/70 px-4 backdrop-blur-xl backdrop-saturate-150 sm:px-6 lg:px-8">
            <IconButton label="Open menu" className="lg:hidden" onClick={() => setMenuOpen(true)} icon={<Menu className="size-5" />} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-[family-name:var(--font-display)] text-[15px] font-semibold text-ink-900">{current?.label ?? "Appointment Hub"}</p>
            </div>
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 transition hover:bg-ink-100"
              >
                <Avatar user={user} size="sm" />
                <span className="hidden text-left sm:block">
                  <span className="block text-sm font-semibold leading-tight text-ink-900">{user.firstName} {user.lastName}</span>
                  <span className="block text-xs leading-tight text-ink-500">{ROLE_LABEL[user.role]}</span>
                </span>
                <ChevronDown className={cx("hidden size-4 text-ink-400 transition sm:block", profileOpen && "rotate-180")} aria-hidden />
              </button>
              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} aria-hidden />
                  <div role="menu" className="absolute right-0 top-12 z-50 w-64 animate-pop-in overflow-hidden rounded-2xl border border-ink-200/70 bg-white shadow-pop">
                    <div className="flex items-center gap-3 border-b border-ink-100 bg-hero-gradient px-4 py-3.5">
                      <Avatar user={user} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-900">{user.firstName} {user.lastName}</p>
                        <p className="truncate text-xs text-ink-500">{user.email}</p>
                      </div>
                    </div>
                    <div className="p-1.5">
                      <Link role="menuitem" href="/account" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-700 hover:bg-ink-50">
                        <Settings className="size-4 text-ink-400" /> Account settings
                      </Link>
                      <button role="menuitem" onClick={signOut} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50">
                        <LogOut className="size-4" /> Sign out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </header>

          <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-24 pt-7 sm:px-6 lg:px-8">{children}</main>
        </div>

        {/* Floating AI button (mobile + pages where the sidebar tile is hidden) */}
        {pathname !== "/assistant" && (
          <button
            onClick={() => setAssistantOpen(true)}
            className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full bg-accent-gradient px-5 py-3 text-sm font-semibold text-white shadow-glow-accent transition hover:-translate-y-0.5 hover:brightness-110 lg:hidden"
            aria-haspopup="dialog"
          >
            <Sparkles className="size-4" aria-hidden /> Ask AI
          </button>
        )}

        {assistantOpen && (
          <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="AI assistant">
            <div className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm" onClick={() => setAssistantOpen(false)} aria-hidden />
            <div className="absolute inset-y-0 right-0 flex w-full max-w-md animate-slide-in-right flex-col bg-white shadow-pop">
              <div className="relative overflow-hidden bg-accent-gradient px-5 py-4 text-white">
                <span className="absolute -right-10 -top-10 size-32 rounded-full bg-white/10" aria-hidden />
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-2xl bg-white/20 ring-1 ring-white/30"><Sparkles className="size-5" /></span>
                    <div>
                      <p className="font-[family-name:var(--font-display)] font-bold">AI assistant</p>
                      <p className="text-xs text-white/80">Only sees what you can see · asks before changing anything</p>
                    </div>
                  </div>
                  <IconButton label="Close assistant" tone="light" side="left" onClick={() => setAssistantOpen(false)} icon={<X className="size-5" />} />
                </div>
              </div>
              <AssistantPanel compact />
            </div>
          </div>
        )}
      </div>
    </UserContext.Provider>
  );
}
