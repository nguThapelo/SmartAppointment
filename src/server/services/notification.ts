import { formatInTimeZone } from "date-fns-tz";
import { bookingCalendarEvent, CALENDAR_STATUSES, googleCalendarUrl, icsFile } from "@/lib/calendar";
import { prisma } from "@/lib/db";
import { env } from "@/server/env";
import { log } from "@/server/log";
import { sendEmail } from "@/server/services/email";

// Best-effort booking notifications, sent AFTER the database change commits.
// A failed email never rolls back or fails the booking action; it's logged.
// Plain-text only: booking notes and names are user-supplied, and plain text
// can't carry markup. WhatsApp delivery is added by the WhatsApp service.

export type BookingEvent =
  | "created"
  | "approved"
  | "declined"
  | "cancelled"
  | "rescheduled"
  | "payment_requested"
  | "paid"
  | "completed";

type Audience = "customer" | "provider";

const COPY: Record<BookingEvent, { to: Audience[]; subject: string; line: string }> = {
  created: { to: ["provider"], subject: "New booking request", line: "You have a new booking request to review." },
  approved: { to: ["customer"], subject: "Booking confirmed", line: "Your booking has been confirmed." },
  declined: { to: ["customer"], subject: "Booking declined", line: "Unfortunately your booking request was declined." },
  cancelled: { to: ["customer", "provider"], subject: "Booking cancelled", line: "This booking has been cancelled." },
  rescheduled: { to: ["customer", "provider"], subject: "Booking rescheduled", line: "This booking has a new time." },
  payment_requested: { to: ["customer"], subject: "Payment requested", line: "Your provider has requested payment for this booking." },
  paid: { to: ["customer", "provider"], subject: "Payment received", line: "Payment for this booking was received." },
  completed: { to: ["customer"], subject: "Thanks for your visit", line: "Your appointment is complete. We'd love your feedback." },
};

// Emails that carry an "Add to calendar" link and .ics invite: the moments a
// booking gets (or changes) a firm time. "created" counts when it was auto-approved.
const CALENDAR_EVENTS: BookingEvent[] = ["created", "approved", "rescheduled"];

export async function notifyBooking(bookingId: string, event: BookingEvent, extra?: { link?: string }) {
  try {
    const b = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        provider: { select: { email: true, firstName: true, lastName: true, timezone: true } },
        client: { select: { email: true, firstName: true, lastName: true } },
      },
    });
    if (!b) return;
    const copy = COPY[event];
    const when = formatInTimeZone(b.startsAt, b.provider.timezone, "EEE d MMM yyyy, HH:mm");
    const bookingUrl = `${env().APP_URL}/bookings/${b.reference}`;
    const providerName = `${b.provider.firstName} ${b.provider.lastName}`;
    const customerName = b.client ? `${b.client.firstName} ${b.client.lastName}` : (b.customerName ?? "Guest");
    const addToCalendar =
      CALENDAR_EVENTS.includes(event) && (CALENDAR_STATUSES as readonly string[]).includes(b.status);

    const recipients: { email: string; name: string; audience: Audience }[] = [];
    if (copy.to.includes("customer")) {
      // WhatsApp guests hear back in the chat when inside Meta's free 24h
      // window; otherwise (or if that fails) by email when they gave one.
      let reached = false;
      if (b.channel === "WHATSAPP") {
        const { notifyGuest } = await import("@/server/whatsapp/service");
        reached = await notifyGuest(
          b.id,
          `${copy.subject}: ${b.serviceName}, ${when} (${b.reference}).${extra?.link ? `\n\nPay here: ${extra.link}` : ""}`,
        );
      }
      const email = b.client?.email ?? b.customerEmail;
      if (!reached && email) recipients.push({ email, name: b.client?.firstName ?? b.customerName ?? "there", audience: "customer" });
    }
    if (copy.to.includes("provider")) recipients.push({ email: b.provider.email, name: b.provider.firstName, audience: "provider" });

    await Promise.all(
      recipients.map((r) => {
        const calendar = addToCalendar
          ? bookingCalendarEvent(b, { withName: r.audience === "customer" ? providerName : customerName, url: bookingUrl })
          : null;
        return sendEmail({
          to: r.email,
          subject: `${copy.subject} · ${b.reference}`,
          text: [
            `Hi ${r.name},`,
            "",
            copy.line,
            "",
            `Service:   ${b.serviceName}`,
            `When:      ${when}`,
            `Reference: ${b.reference}`,
            ...(extra?.link ? ["", `Pay here: ${extra.link}`] : []),
            ...(calendar ? ["", `Add to Google Calendar: ${googleCalendarUrl(calendar)}`, "(Or open the attached invite for Apple / Outlook.)"] : []),
            "",
            `View booking: ${bookingUrl}`,
          ].join("\n"),
          attachments: calendar
            ? [{ filename: `${b.reference}.ics`, content: icsFile(calendar), contentType: "text/calendar; charset=utf-8" }]
            : undefined,
        });
      }),
    );
  } catch (err) {
    log.error("booking notification failed", { err, bookingId, event });
  }
}
