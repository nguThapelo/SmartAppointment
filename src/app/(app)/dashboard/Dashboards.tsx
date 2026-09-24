"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight, BarChart3, Bot, CalendarCheck2, CalendarClock, CalendarPlus, ClipboardCheck, Coins, MessageCircle, Sparkles, Users, Wallet,
} from "lucide-react";
import { BookingList } from "@/components/bookings/BookingList";
import type { BookingDTO, Paged } from "@/components/bookings/types";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, Stat } from "@/components/ui/card";
import { ErrorNote, Loading, Notice, Skeleton } from "@/components/ui/feedback";
import { api, errorMessage } from "@/lib/api";
import { dateOnly, money, STATUS_LABEL, timeOnly } from "@/lib/format";

interface Props {
  firstName: string;
  tz: string;
  denied: boolean;
}

interface MoneySummary {
  periodTotalCents: number;
  periodBookings: number;
  allTimeTotalCents: number;
  upcomingBookings: number;
  byService: { service: string; totalCents: number; bookings: number }[];
}

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function Denied({ show }: { show: boolean }) {
  return show ? <div className="mb-4"><Notice tone="warning">That page isn’t available for your account.</Notice></div> : null;
}

/** Gradient hero at the top of each dashboard. */
function Welcome({ eyebrow, title, subtitle, actions }: { eyebrow: string; title: string; subtitle: string; actions?: ReactNode }) {
  return (
    <section className="relative mb-7 animate-fade-up overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f1a33] via-[#123a4d] to-[#0c6f63] p-7 text-white shadow-lift sm:p-8">
      <div className="absolute -right-16 -top-24 size-80 rounded-full bg-brand-400/30 blur-3xl" aria-hidden />
      <div className="absolute -bottom-24 left-1/3 size-72 rounded-full bg-accent-500/25 blur-3xl" aria-hidden />
      <div className="bg-dots absolute inset-0 opacity-20 invert" aria-hidden />
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-200">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 max-w-xl text-sm text-white/70">{subtitle}</p>
        </div>
        {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
      </div>
    </section>
  );
}

/** Frosted white button for use on the dark banner. */
function BannerLink({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-11 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur transition-all hover:-translate-y-px hover:bg-white hover:text-ink-900 hover:shadow-lift"
    >
      {icon}
      {children}
    </Link>
  );
}

const useBookings = (query: string) =>
  useQuery({ queryKey: ["bookings", "dash", query], queryFn: () => api<Paged<BookingDTO>>(`/api/bookings?${query}`) });

// ── Client ──────────────────────────────────────────────────────────────────

export function ClientDashboard({ firstName, tz, denied }: Props) {
  const upcoming = useBookings("scope=upcoming&pageSize=5");
  const spending = useQuery({ queryKey: ["spending"], queryFn: () => api<MoneySummary>("/api/reports/spending?days=365") });
  const next = upcoming.data?.data[0];

  return (
    <>
      <Denied show={denied} />
      <Welcome
        eyebrow="Your appointments"
        title={`${greeting()}, ${firstName}`}
        subtitle="Book in a few taps, keep track of what's coming up, and pay securely when your provider asks."
        actions={
          <>
            <ButtonLink href="/book" size="lg" icon={<CalendarPlus className="size-4" />}>Book an appointment</ButtonLink>
            <BannerLink href="/assistant" icon={<Sparkles className="size-4" />}>Ask AI</BannerLink>
          </>
        }
      />

      <div className="grid gap-5 md:grid-cols-3">
        <Card interactive className="md:col-span-2">
          <CardHeader title="Next appointment" icon={<CalendarCheck2 className="size-4" />} />
          <CardBody>
            {upcoming.isPending ? (
              <Skeleton className="h-16" />
            ) : next ? (
              <Link href={`/bookings/${next.reference}`} className="group flex items-center justify-between gap-4 rounded-xl p-2 transition hover:bg-ink-50">
                <div className="flex items-center gap-4">
                  <div className="grid w-16 shrink-0 place-items-center rounded-2xl bg-brand-50 py-2 text-brand-700 ring-1 ring-brand-100">
                    <span className="text-[11px] font-semibold uppercase">{new Intl.DateTimeFormat("en-ZA", { month: "short", timeZone: tz }).format(new Date(next.startsAt))}</span>
                    <span className="font-[family-name:var(--font-display)] text-2xl font-bold leading-none">{new Intl.DateTimeFormat("en-ZA", { day: "numeric", timeZone: tz }).format(new Date(next.startsAt))}</span>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-ink-900">{next.serviceName}</p>
                    <p className="text-sm text-ink-500">{dateOnly(next.startsAt, tz)} · {timeOnly(next.startsAt, tz)} · with {next.provider.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={next.status} />
                  <ArrowRight className="hidden size-4 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600 sm:block" />
                </div>
              </Link>
            ) : (
              <p className="text-sm text-ink-500">Nothing booked yet. <Link className="font-semibold text-brand-700 hover:underline" href="/book">Book something →</Link></p>
            )}
          </CardBody>
        </Card>
        <Stat
          label="Spent this year"
          value={spending.data ? money(spending.data.periodTotalCents) : "—"}
          hint={spending.data ? plural(spending.data.periodBookings, "paid booking") : undefined}
          icon={<Wallet className="size-5" />}
          tone="accent"
        />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Upcoming" icon={<CalendarClock className="size-4" />} action={<Link href="/bookings" className="text-sm font-semibold text-brand-700 hover:text-brand-800">View all</Link>} />
          {upcoming.isPending ? <Loading /> : upcoming.error ? <div className="p-5"><ErrorNote message={errorMessage(upcoming.error)} /></div> : <BookingList bookings={upcoming.data.data} tz={tz} empty="No upcoming bookings" />}
        </Card>
        <Card className="overflow-hidden">
          <CardHeader title="Other ways to book" icon={<Sparkles className="size-4" />} />
          <CardBody className="space-y-3">
            <div className="flex gap-3 rounded-xl bg-accent-50 p-3 ring-1 ring-accent-100">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-gradient text-white shadow-glow-accent"><Bot className="size-4" /></span>
              <p className="text-sm text-ink-700">Ask the assistant: <span className="font-medium">“Find me a massage on Saturday morning.”</span></p>
            </div>
            <div className="flex gap-3 rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-100">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white shadow-[0_8px_20px_-6px_rgb(16_185_129/0.5)]"><MessageCircle className="size-4" /></span>
              <p className="text-sm text-ink-700">Message a provider’s WhatsApp number and follow the menu.</p>
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

// ── Provider ────────────────────────────────────────────────────────────────

export function ProviderDashboard({ firstName, tz, denied }: Props) {
  const pending = useBookings("status=PENDING&scope=upcoming&pageSize=10");
  const upcoming = useBookings("scope=upcoming&pageSize=8");
  const earnings = useQuery({ queryKey: ["earnings", 30], queryFn: () => api<MoneySummary>("/api/reports/earnings?days=30") });
  const toReview = pending.data?.total ?? 0;

  return (
    <>
      <Denied show={denied} />
      <Welcome
        eyebrow="Provider workspace"
        title={`${greeting()}, ${firstName}`}
        subtitle={pending.isPending ? "Loading your day…" : toReview ? `You have ${plural(toReview, "booking request")} waiting for your approval.` : "You're all caught up — nothing waiting for approval."}
        actions={
          <>
            <BannerLink href="/provider/availability" icon={<CalendarClock className="size-4" />}>Set hours</BannerLink>
            <BannerLink href="/assistant" icon={<Sparkles className="size-4" />}>Ask AI</BannerLink>
          </>
        }
      />
      <div className="grid gap-5 sm:grid-cols-3">
        <Stat label="Requests to review" value={pending.data?.total ?? "—"} icon={<ClipboardCheck className="size-5" />} tone="amber" />
        <Stat label="Upcoming bookings" value={earnings.data?.upcomingBookings ?? "—"} icon={<CalendarCheck2 className="size-5" />} tone="sky" />
        <Stat
          label="Earned (30 days)"
          value={earnings.data ? money(earnings.data.periodTotalCents) : "—"}
          hint={<Link href="/earnings" className="font-semibold text-brand-700 hover:underline">See breakdown →</Link>}
          icon={<Coins className="size-5" />}
        />
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Waiting for your approval" icon={<ClipboardCheck className="size-4" />} />
          {pending.isPending ? <Loading /> : pending.error ? <div className="p-5"><ErrorNote message={errorMessage(pending.error)} /></div> : <BookingList bookings={pending.data.data} tz={tz} showCustomer empty="You're all caught up" />}
        </Card>
        <Card>
          <CardHeader title="Coming up" icon={<CalendarClock className="size-4" />} action={<Link href="/bookings" className="text-sm font-semibold text-brand-700 hover:text-brand-800">All bookings</Link>} />
          {upcoming.isPending ? <Loading /> : upcoming.error ? <div className="p-5"><ErrorNote message={errorMessage(upcoming.error)} /></div> : <BookingList bookings={upcoming.data.data} tz={tz} showCustomer empty="No upcoming bookings" />}
        </Card>
      </div>
    </>
  );
}

// ── Admin ───────────────────────────────────────────────────────────────────

interface Metrics {
  usersByRole: Record<string, number>;
  bookingsByStatus: Record<string, number>;
  bookingsByChannel: Record<string, number>;
  revenueCents: number;
  ai: { requests: number; inputTokens: number; outputTokens: number; toolCallOutcomes: Record<string, number> };
}

const BAR_TONES = ["from-brand-400 to-cyan-500", "from-accent-400 to-fuchsia-500", "from-sky-400 to-blue-600", "from-amber-400 to-orange-500", "from-emerald-400 to-green-600"];

function Bars({ data, labels }: { data: Record<string, number>; labels?: Record<string, string> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  if (!entries.length) return <p className="text-sm text-ink-400">No data yet.</p>;
  return (
    <ul className="space-y-3">
      {entries.map(([k, v], i) => (
        <li key={k} className="text-sm">
          <div className="mb-1.5 flex justify-between"><span className="text-ink-600">{labels?.[k] ?? k}</span><span className="font-semibold text-ink-900">{v}</span></div>
          <div className="h-2.5 overflow-hidden rounded-full bg-ink-100">
            <div className={`h-full rounded-full bg-gradient-to-r ${BAR_TONES[i % BAR_TONES.length]} transition-all duration-700`} style={{ width: `${(v / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function AdminOverview({ firstName, denied }: Props) {
  const m = useQuery({ queryKey: ["metrics", 30], queryFn: () => api<Metrics>("/api/admin/metrics?days=30") });
  const d = m.data;
  const users = d ? Object.values(d.usersByRole).reduce((a, b) => a + b, 0) : 0;
  const bookings = d ? Object.values(d.bookingsByStatus).reduce((a, b) => a + b, 0) : 0;

  return (
    <>
      <Denied show={denied} />
      <Welcome
        eyebrow="Platform overview · last 30 days"
        title={`${greeting()}, ${firstName}`}
        subtitle="Users, bookings, revenue and assistant activity across every channel."
        actions={
          <>
            <BannerLink href="/admin/users" icon={<Users className="size-4" />}>Users</BannerLink>
            <BannerLink href="/admin/audit" icon={<BarChart3 className="size-4" />}>Audit log</BannerLink>
          </>
        }
      />
      {m.isPending ? (
        <Loading label="Loading metrics" />
      ) : m.error || !d ? (
        <ErrorNote message={errorMessage(m.error)} />
      ) : (
        <>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Users" value={users} hint={`${d.usersByRole.PROVIDER ?? 0} providers · ${d.usersByRole.CLIENT ?? 0} clients`} icon={<Users className="size-5" />} tone="sky" />
            <Stat label="New bookings" value={bookings} icon={<CalendarCheck2 className="size-5" />} />
            <Stat label="Revenue" value={money(d.revenueCents)} hint="Paid and completed bookings" icon={<Coins className="size-5" />} tone="amber" />
            <Stat label="Assistant requests" value={d.ai.requests} hint={`${(d.ai.inputTokens + d.ai.outputTokens).toLocaleString()} tokens`} icon={<Sparkles className="size-5" />} tone="accent" />
          </div>
          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            <Card><CardHeader title="Bookings by status" icon={<ClipboardCheck className="size-4" />} /><CardBody><Bars data={d.bookingsByStatus} labels={STATUS_LABEL} /></CardBody></Card>
            <Card><CardHeader title="Bookings by channel" icon={<MessageCircle className="size-4" />} /><CardBody><Bars data={d.bookingsByChannel} labels={{ WEB: "Website", WHATSAPP: "WhatsApp", AGENT: "Assistant" }} /></CardBody></Card>
            <Card>
              <CardHeader title="Assistant tool calls" icon={<Bot className="size-4" />} action={<Link href="/admin/ai" className="text-sm font-semibold text-brand-700 hover:text-brand-800">Activity</Link>} />
              <CardBody>
                <Bars data={d.ai.toolCallOutcomes} labels={{ ok: "Succeeded", pending_confirmation: "Awaiting confirmation", denied: "Denied", invalid: "Invalid arguments", error: "Errors" }} />
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
