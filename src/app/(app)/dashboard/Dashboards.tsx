"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Bot, CalendarPlus, MessageCircle } from "lucide-react";
import { BookingList } from "@/components/bookings/BookingList";
import type { BookingDTO, Paged } from "@/components/bookings/types";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader, Stat } from "@/components/ui/card";
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

function Denied({ show }: { show: boolean }) {
  return show ? <div className="mb-4"><Notice tone="warning">That page isn’t available for your account.</Notice></div> : null;
}

const useBookings = (query: string) =>
  useQuery({ queryKey: ["bookings", "dash", query], queryFn: () => api<Paged<BookingDTO>>(`/api/bookings?${query}`) });

// ── Client ──────────────────────────────────────────────────────────────────

export function ClientDashboard({ firstName, tz, denied }: Props) {
  const upcoming = useBookings("scope=upcoming&pageSize=5");
  const spending = useQuery({ queryKey: ["spending"], queryFn: () => api<MoneySummary>("/api/reports/spending?days=365") });
  const next = upcoming.data?.data.find((b) => !["CANCELLED", "DECLINED"].includes(b.status));

  return (
    <>
      <Denied show={denied} />
      <PageHeader title={`${greeting()}, ${firstName}`} action={<ButtonLink href="/book" icon={<CalendarPlus className="size-4" />}>Book an appointment</ButtonLink>} />
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader title="Next appointment" />
          <CardBody>
            {upcoming.isPending ? (
              <Skeleton className="h-16" />
            ) : next ? (
              <Link href={`/bookings/${next.reference}`} className="flex items-center justify-between gap-4 rounded-lg p-2 hover:bg-ink-50">
                <div>
                  <p className="text-lg font-semibold text-ink-900">{next.serviceName}</p>
                  <p className="text-sm text-ink-500">{dateOnly(next.startsAt, tz)} at {timeOnly(next.startsAt, tz)} · with {next.provider.name}</p>
                </div>
                <StatusBadge status={next.status} />
              </Link>
            ) : (
              <p className="text-sm text-ink-500">Nothing booked. <Link className="text-brand-700 hover:underline" href="/book">Book something →</Link></p>
            )}
          </CardBody>
        </Card>
        <Stat label="Spent this year" value={spending.data ? money(spending.data.periodTotalCents) : "—"} hint={spending.data ? `${spending.data.periodBookings} paid booking${spending.data.periodBookings === 1 ? "" : "s"}` : undefined} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Upcoming" action={<Link href="/bookings" className="text-sm text-brand-700 hover:underline">View all</Link>} />
          {upcoming.isPending ? <Loading /> : upcoming.error ? <div className="p-5"><ErrorNote message={errorMessage(upcoming.error)} /></div> : <BookingList bookings={upcoming.data.data} tz={tz} empty="No upcoming bookings" />}
        </Card>
        <Card>
          <CardHeader title="Other ways to book" />
          <CardBody className="space-y-3 text-sm text-ink-600">
            <p className="flex gap-2"><Bot className="size-4 shrink-0 text-brand-600" /> Ask the assistant: “Find me a massage on Saturday morning.”</p>
            <p className="flex gap-2"><MessageCircle className="size-4 shrink-0 text-emerald-600" /> Message a provider’s WhatsApp number and follow the menu.</p>
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

  return (
    <>
      <Denied show={denied} />
      <PageHeader title={`${greeting()}, ${firstName}`} description="Here's what needs your attention." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Requests to review" value={pending.data?.total ?? "—"} />
        <Stat label="Upcoming bookings" value={earnings.data?.upcomingBookings ?? "—"} />
        <Stat label="Earned (30 days)" value={earnings.data ? money(earnings.data.periodTotalCents) : "—"} hint={<Link href="/earnings" className="text-brand-700 hover:underline">Details</Link>} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Waiting for your approval" />
          {pending.isPending ? <Loading /> : pending.error ? <div className="p-5"><ErrorNote message={errorMessage(pending.error)} /></div> : <BookingList bookings={pending.data.data} tz={tz} showCustomer empty="You're all caught up" />}
        </Card>
        <Card>
          <CardHeader title="Coming up" action={<Link href="/bookings" className="text-sm text-brand-700 hover:underline">All bookings</Link>} />
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

function Bars({ data, labels }: { data: Record<string, number>; labels?: Record<string, string> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  if (!entries.length) return <p className="text-sm text-ink-400">No data yet.</p>;
  return (
    <ul className="space-y-2">
      {entries.map(([k, v]) => (
        <li key={k} className="text-sm">
          <div className="mb-1 flex justify-between"><span className="text-ink-600">{labels?.[k] ?? k}</span><span className="font-medium text-ink-900">{v}</span></div>
          <div className="h-2 rounded-full bg-ink-100"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${(v / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

export function AdminOverview({ denied }: Props) {
  const m = useQuery({ queryKey: ["metrics", 30], queryFn: () => api<Metrics>("/api/admin/metrics?days=30") });
  if (m.isPending) return <Loading label="Loading metrics" />;
  if (m.error) return <ErrorNote message={errorMessage(m.error)} />;
  const d = m.data;
  const users = Object.values(d.usersByRole).reduce((a, b) => a + b, 0);
  const bookings = Object.values(d.bookingsByStatus).reduce((a, b) => a + b, 0);
  return (
    <>
      <Denied show={denied} />
      <PageHeader title="Platform overview" description="Last 30 days." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Users" value={users} hint={`${d.usersByRole.PROVIDER ?? 0} providers · ${d.usersByRole.CLIENT ?? 0} clients`} />
        <Stat label="New bookings" value={bookings} />
        <Stat label="Revenue" value={money(d.revenueCents)} hint="Paid and completed bookings" />
        <Stat label="Assistant requests" value={d.ai.requests} hint={`${(d.ai.inputTokens + d.ai.outputTokens).toLocaleString()} tokens`} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card><CardHeader title="Bookings by status" /><CardBody><Bars data={d.bookingsByStatus} labels={STATUS_LABEL} /></CardBody></Card>
        <Card><CardHeader title="Bookings by channel" /><CardBody><Bars data={d.bookingsByChannel} labels={{ WEB: "Website", WHATSAPP: "WhatsApp", AGENT: "Assistant" }} /></CardBody></Card>
        <Card>
          <CardHeader title="Assistant tool calls" action={<Link href="/admin/ai" className="text-sm text-brand-700 hover:underline">Activity</Link>} />
          <CardBody>
            <Bars data={d.ai.toolCallOutcomes} labels={{ ok: "Succeeded", pending_confirmation: "Awaiting confirmation", denied: "Denied", invalid: "Invalid arguments", error: "Errors" }} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
