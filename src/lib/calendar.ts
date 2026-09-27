// "Add to calendar" for bookings: Google and Outlook web links plus a standard
// .ics file (Apple Calendar, Outlook desktop, anything else). Pure functions,
// shared by the booking page and the confirmation emails — no calendar API,
// no OAuth, nothing to configure.

export interface CalendarEvent {
  /** Stable id, so re-adding a rescheduled booking updates rather than duplicates. */
  uid: string;
  title: string;
  start: Date | string;
  end: Date | string;
  description?: string;
  url?: string;
}

/** 2026-10-02T10:30:00.000Z → 20261002T103000Z (UTC "basic" format). */
function utcStamp(value: Date | string): string {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function details(ev: CalendarEvent): string {
  return [ev.description, ev.url].filter(Boolean).join("\n\n");
}

export function googleCalendarUrl(ev: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${utcStamp(ev.start)}/${utcStamp(ev.end)}`,
    details: details(ev),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function outlookCalendarUrl(ev: CalendarEvent): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: ev.title,
    startdt: new Date(ev.start).toISOString(),
    enddt: new Date(ev.end).toISOString(),
    body: details(ev),
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params}`;
}

/** RFC 5545 TEXT escaping. */
function icsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** RFC 5545 folding: lines longer than 75 octets continue on the next line after a space. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const len = new TextEncoder().encode(char).length;
    if (size + len > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += len;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function icsFile(ev: CalendarEvent, now: Date = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Appointment Hub//Bookings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${ev.uid}`,
    `DTSTAMP:${utcStamp(now)}`,
    `DTSTART:${utcStamp(ev.start)}`,
    `DTEND:${utcStamp(ev.end)}`,
    `SUMMARY:${icsText(ev.title)}`,
    ...(details(ev) ? [`DESCRIPTION:${icsText(details(ev))}`] : []),
    ...(ev.url ? [`URL:${ev.url}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Bookings worth putting in a calendar: agreed, not cancelled or finished. */
export const CALENDAR_STATUSES = ["APPROVED", "PAYMENT_PENDING", "PAID", "PAYMENT_FAILED"] as const;

export function bookingCalendarEvent(
  b: { reference: string; serviceName: string; startsAt: Date | string; endsAt: Date | string },
  opts: { withName: string; url: string },
): CalendarEvent {
  return {
    uid: `${b.reference}@appointmenthub`,
    title: `${b.serviceName} with ${opts.withName}`,
    start: b.startsAt,
    end: b.endsAt,
    description: `Appointment Hub booking ${b.reference}`,
    url: opts.url,
  };
}
