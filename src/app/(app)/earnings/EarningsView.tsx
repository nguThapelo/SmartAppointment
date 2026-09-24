"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardHeader, PageHeader, Stat } from "@/components/ui/card";
import { EmptyState, ErrorNote, Loading } from "@/components/ui/feedback";
import { Select } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";
import { money } from "@/lib/format";

interface Summary {
  periodTotalCents: number;
  periodBookings: number;
  allTimeTotalCents: number;
  allTimeBookings: number;
  upcomingBookings: number;
  byService: { service: string; totalCents: number; bookings: number }[];
}

export function EarningsView() {
  const [days, setDays] = useState(30);
  const q = useQuery({ queryKey: ["earnings", days], queryFn: () => api<Summary>(`/api/reports/earnings?days=${days}`) });

  return (
    <>
      <PageHeader
        title="Earnings"
        description="Counted when a booking is paid, completed or closed."
        action={
          <>
            <label htmlFor="period" className="sr-only">Period</label>
            <Select id="period" value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-40">
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
              <option value={365}>Last 12 months</option>
            </Select>
          </>
        }
      />
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorNote message={errorMessage(q.error)} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="This period" value={money(q.data.periodTotalCents)} hint={`${q.data.periodBookings} bookings`} />
            <Stat label="All time" value={money(q.data.allTimeTotalCents)} hint={`${q.data.allTimeBookings} bookings`} />
            <Stat label="Upcoming" value={q.data.upcomingBookings} hint="Booked, not yet completed" />
          </div>
          <Card className="mt-6">
            <CardHeader title="By service" />
            {q.data.byService.length === 0 ? (
              <EmptyState title="No earnings in this period" />
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-400">
                  <tr><th className="px-5 py-3 font-medium">Service</th><th className="px-5 py-3 text-right font-medium">Bookings</th><th className="px-5 py-3 text-right font-medium">Total</th></tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {q.data.byService.map((s) => (
                    <tr key={s.service}>
                      <td className="px-5 py-3 text-ink-900">{s.service}</td>
                      <td className="px-5 py-3 text-right text-ink-600">{s.bookings}</td>
                      <td className="px-5 py-3 text-right font-medium text-ink-900">{money(s.totalCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </>
  );
}
