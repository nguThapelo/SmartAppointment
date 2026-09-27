import { describe, expect, it } from "vitest";
import { bookingCalendarEvent, googleCalendarUrl, icsFile, outlookCalendarUrl } from "@/lib/calendar";

const event = bookingCalendarEvent(
  { reference: "AH-Y6GPJN", serviceName: "Hair colour", startsAt: "2026-10-02T10:30:00.000Z", endsAt: "2026-10-02T12:00:00.000Z" },
  { withName: "Thandi Nkosi", url: "https://app.example/bookings/AH-Y6GPJN" },
);

describe("add to calendar", () => {
  it("builds a Google Calendar link with UTC times", () => {
    const url = new URL(googleCalendarUrl(event));
    expect(url.hostname).toBe("calendar.google.com");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("Hair colour with Thandi Nkosi");
    expect(url.searchParams.get("dates")).toBe("20261002T103000Z/20261002T120000Z");
    expect(url.searchParams.get("details")).toContain("https://app.example/bookings/AH-Y6GPJN");
  });

  it("builds an Outlook link with ISO times", () => {
    const url = new URL(outlookCalendarUrl(event));
    expect(url.searchParams.get("startdt")).toBe("2026-10-02T10:30:00.000Z");
    expect(url.searchParams.get("enddt")).toBe("2026-10-02T12:00:00.000Z");
  });

  it("produces a valid, stable .ics invite", () => {
    const ics = icsFile(event, new Date("2026-09-27T00:00:00Z"));
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("UID:AH-Y6GPJN@appointmenthub\r\n");
    expect(ics).toContain("DTSTART:20261002T103000Z\r\n");
    expect(ics).toContain("DTEND:20261002T120000Z\r\n");
    expect(ics).toContain("DTSTAMP:20260927T000000Z\r\n");
    // Every physical line is at most 75 octets (RFC 5545 folding).
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });

  it("escapes user text so it can't inject calendar properties", () => {
    const ics = icsFile({ ...event, title: "Cut; colour, style\nEND:VEVENT" });
    expect(ics).toContain("SUMMARY:Cut\\; colour\\, style\\nEND:VEVENT");
    expect(ics.match(/^END:VEVENT$/gm)).toHaveLength(1);
  });
});
