"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ErrorNote, Skeleton } from "@/components/ui/feedback";
import { api, errorMessage } from "@/lib/api";
import { cx, isoDate } from "@/lib/format";

interface Slot {
  startsAt: string;
  endsAt: string;
  label: string;
}

/** Day strip + free times for one provider service. Times come from the server — the only bookable ones. */
export function SlotPicker({
  providerServiceId, tz, selected, onSelect, days = 14,
}: { providerServiceId: string; tz: string; selected: string | null; onSelect: (slot: Slot) => void; days?: number }) {
  const dates = Array.from({ length: days }, (_, i) => isoDate(i, tz));
  const open = useQuery({
    queryKey: ["open-dates", providerServiceId],
    queryFn: () => api<{ dates: string[] }>(`/api/availability/dates?providerServiceId=${encodeURIComponent(providerServiceId)}`),
  });
  const openSet = new Set(open.data?.dates ?? []);
  // Start on the first day that actually has free times, not on a (possibly full) today.
  const [picked, setPicked] = useState<string | null>(null);
  const date = picked ?? open.data?.dates[0] ?? dates[0]!;
  const setDate = setPicked;

  const slots = useQuery({
    queryKey: ["slots", providerServiceId, date],
    enabled: !open.isPending,
    queryFn: () => api<{ slots: Slot[] }>(`/api/availability/slots?providerServiceId=${encodeURIComponent(providerServiceId)}&date=${date}`),
  });

  return (
    <div className="space-y-4">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="listbox" aria-label="Choose a date">
        {dates.map((d) => {
          const dt = new Date(`${d}T12:00:00Z`);
          const full = open.isSuccess && !openSet.has(d);
          return (
            <button
              key={d}
              role="option"
              aria-selected={d === date}
              aria-label={full ? `${d}, fully booked` : d}
              onClick={() => setDate(d)}
              className={cx(
                "flex w-14 shrink-0 flex-col items-center rounded-xl border px-2 py-2 text-xs transition-colors",
                d === date
                  ? "border-brand-600 bg-brand-600 text-white"
                  : full
                    ? "border-ink-100 bg-ink-50 text-ink-300"
                    : "border-ink-200 bg-white text-ink-600 hover:border-ink-300",
              )}
            >
              <span>{dt.toLocaleDateString("en-ZA", { weekday: "short", timeZone: "UTC" })}</span>
              <span className="text-base font-semibold">{dt.getUTCDate()}</span>
              <span>{dt.toLocaleDateString("en-ZA", { month: "short", timeZone: "UTC" })}</span>
            </button>
          );
        })}
      </div>

      {open.isPending || slots.isPending ? (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-10" />)}</div>
      ) : slots.error ? (
        <ErrorNote message={errorMessage(slots.error)} />
      ) : slots.data.slots.length === 0 ? (
        <p className="rounded-lg bg-ink-50 px-3 py-4 text-center text-sm text-ink-500">No free times on this day — try another date.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="listbox" aria-label="Choose a time">
          {slots.data.slots.map((s) => (
            <button
              key={s.startsAt}
              role="option"
              aria-selected={selected === s.startsAt}
              onClick={() => onSelect(s)}
              className={cx(
                "h-10 rounded-lg border text-sm font-medium transition-colors",
                selected === s.startsAt ? "border-brand-600 bg-brand-50 text-brand-800" : "border-ink-200 bg-white text-ink-700 hover:border-brand-300",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
