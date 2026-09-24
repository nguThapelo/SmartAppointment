import { formatInTimeZone } from "date-fns-tz";
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

export async function notifyBooking(bookingId: string, event: BookingEvent, extra?: { link?: string }) {
  try {
    const b = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        provider: { select: { email: true, firstName: true, timezone: true } },
        client: { select: { email: true, firstName: true } },
      },
    });
    if (!b) return;
    const copy = COPY[event];
    const when = formatInTimeZone(b.startsAt, b.provider.timezone, "EEE d MMM yyyy, HH:mm");
    const bookingUrl = `${env().APP_URL}/bookings/${b.reference}`;

    const recipients: { email: string; name: string }[] = [];
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
      if (!reached && email) recipients.push({ email, name: b.client?.firstName ?? b.customerName ?? "there" });
    }
    if (copy.to.includes("provider")) recipients.push({ email: b.provider.email, name: b.provider.firstName });

    await Promise.all(
      recipients.map((r) =>
        sendEmail({
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
            "",
            `View booking: ${bookingUrl}`,
          ].join("\n"),
        }),
      ),
    );
  } catch (err) {
    log.error("booking notification failed", { err, bookingId, event });
  }
}
