"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarPlus, ChevronDown } from "lucide-react";
import type { BookingDTO } from "@/components/bookings/types";
import { Button } from "@/components/ui/button";
import { bookingCalendarEvent, CALENDAR_STATUSES, googleCalendarUrl, icsFile, outlookCalendarUrl } from "@/lib/calendar";

/** Google / Outlook / .ics menu for an agreed, upcoming booking. */
export function AddToCalendar({ booking, withName }: { booking: BookingDTO; withName: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Read once on mount: render stays pure, and a page left open doesn't need to re-check.
  const [now] = useState(() => Date.now());
  const [origin] = useState(() => (typeof window === "undefined" ? "" : window.location.origin));

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const upcoming = new Date(booking.endsAt).getTime() > now;
  if (!upcoming || !(CALENDAR_STATUSES as readonly string[]).includes(booking.status)) return null;

  const event = bookingCalendarEvent(booking, { withName, url: `${origin}/bookings/${booking.reference}` });

  function downloadIcs() {
    const blob = new Blob([icsFile(event)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${booking.reference}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }

  const item = "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-ink-700 hover:bg-ink-50 hover:text-ink-900";

  return (
    <div ref={ref} className="relative">
      <Button
        variant="secondary"
        icon={<CalendarPlus className="size-4" />}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Add to calendar <ChevronDown className="size-4 text-ink-400" />
      </Button>
      {open && (
        <div role="menu" className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-ink-200/70 bg-white p-1.5 shadow-lift">
          <a role="menuitem" className={item} href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
            Google Calendar
          </a>
          <a role="menuitem" className={item} href={outlookCalendarUrl(event)} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
            Outlook.com
          </a>
          <button role="menuitem" type="button" className={item} onClick={downloadIcs}>
            Apple / other (.ics)
          </button>
        </div>
      )}
    </div>
  );
}
