"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import type { Role } from "@prisma/client";
import { BookingList } from "@/components/bookings/BookingList";
import type { BookingDTO, Paged } from "@/components/bookings/types";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { ErrorNote, Loading } from "@/components/ui/feedback";
import { Select } from "@/components/ui/form";
import { api, errorMessage } from "@/lib/api";
import { cx, STATUS_LABEL } from "@/lib/format";

const SCOPES = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "all", label: "All" },
] as const;

export function BookingsBrowser({ role, tz }: { role: Role; tz: string }) {
  const [scope, setScope] = useState<(typeof SCOPES)[number]["value"]>("upcoming");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ["bookings", scope, status, page],
    queryFn: () => api<Paged<BookingDTO>>(`/api/bookings?scope=${scope}&page=${page}&pageSize=20${status ? `&status=${status}` : ""}`),
    placeholderData: keepPreviousData,
  });
  const pages = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.pageSize)) : 1;

  return (
    <>
      <PageHeader
        title={role === "CLIENT" ? "My bookings" : "Bookings"}
        description={role === "ADMIN" ? "Every booking on the platform." : role === "PROVIDER" ? "Bookings with you, from the web, WhatsApp and the assistant." : undefined}
        action={role === "CLIENT" ? <ButtonLink href="/book" icon={<CalendarPlus className="size-4" />}>New booking</ButtonLink> : undefined}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-ink-200 bg-white p-0.5" role="tablist" aria-label="Time">
          {SCOPES.map((s) => (
            <button
              key={s.value}
              role="tab"
              aria-selected={scope === s.value}
              onClick={() => { setScope(s.value); setPage(1); }}
              className={cx("rounded-md px-3 py-1.5 text-sm font-medium", scope === s.value ? "bg-ink-900 text-white" : "text-ink-600 hover:text-ink-900")}
            >
              {s.label}
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="status-filter">Status</label>
        <Select id="status-filter" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-48">
          <option value="">Any status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>
      <Card>
        {q.isPending ? (
          <Loading label="Loading bookings" />
        ) : q.error ? (
          <div className="p-5"><ErrorNote message={errorMessage(q.error)} /></div>
        ) : (
          <BookingList bookings={q.data.data} tz={tz} showCustomer={role !== "CLIENT"} empty={scope === "upcoming" ? "No upcoming bookings" : "No bookings found"} />
        )}
      </Card>
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span className="text-ink-500">Page {page} of {pages}</span>
          <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}
    </>
  );
}
