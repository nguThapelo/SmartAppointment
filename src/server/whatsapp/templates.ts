import { formatInTimeZone } from "date-fns-tz";

// WhatsApp message copy (ported from the original bot's templates).
// Text + numbered options: works on every WhatsApp client and needs no
// Meta template approval, since every message is a reply inside the free
// 24-hour customer-service window.

const n = (i: number) => `${i + 1}.`;
const numbered = (items: string[]) => items.map((it, i) => `${n(i)} ${it}`).join("\n");
const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency }).format(cents / 100);

export const fmtDate = (date: string) => formatInTimeZone(new Date(`${date}T12:00:00Z`), "UTC", "EEE d MMM");
export const fmtWhen = (iso: string, tz: string) => formatInTimeZone(new Date(iso), tz, "EEE d MMM, HH:mm");

export const T = {
  mainMenu: (welcome: string) =>
    `${welcome}\n\nWhat would you like to do?\n\n1. Book an appointment\n2. My bookings\n3. Reschedule a booking\n4. Cancel a booking\n5. Help\n\n_Reply with a number._`,

  help: () =>
    "You can reply *MENU* at any time to start again.\n\nBookings made here are confirmed by message and, if you give an email, by email too. For anything else, contact the business directly.",

  serviceList: (services: { name: string; priceCents: number; currency: string; durationMin: number }[]) =>
    services.length
      ? `Which service would you like?\n\n${numbered(services.map((s) => `*${s.name}* — ${money(s.priceCents, s.currency)} (${s.durationMin} min)`))}\n\n_Reply with a number._`
      : "Sorry, there are no services available to book right now.",

  dateList: (dates: string[], service: string) =>
    dates.length
      ? `When would you like your *${service}*?\n\n${numbered(dates.map(fmtDate))}\n\n_Reply with a number._`
      : "Sorry, there are no open dates in the next few weeks. Reply *MENU* to go back.",

  timeList: (slots: { label: string }[], date: string) =>
    slots.length
      ? `Available times on *${fmtDate(date)}*:\n\n${numbered(slots.map((s) => s.label))}\n\n_Reply with a number._`
      : `No times left on ${fmtDate(date)}. Reply *MENU* to start again.`,

  askName: () => "What is your full name?",
  askEmail: () => "What email should we send the confirmation to?\n\n_Reply *skip* to continue without one._",

  confirm: (s: { service: string; when: string; price: string; name: string; email?: string | null }) =>
    `Please confirm your booking:\n\nService: *${s.service}*\nWhen: *${s.when}*\nPrice: *${s.price}*\nName: *${s.name}*\nEmail: *${s.email ?? "not provided"}*\n\nReply *YES* to confirm or *NO* to cancel.`,

  booked: (ref: string, approved: boolean) =>
    approved
      ? `✅ You're booked! Your reference is *${ref}*.\n\nReply *MENU* for more options.`
      : `📨 Request sent! Your reference is *${ref}*. We'll message you once it's confirmed.\n\nReply *MENU* for more options.`,

  myBookings: (items: string[]) =>
    items.length ? `Your upcoming bookings:\n\n${numbered(items)}\n\nReply *MENU* for more options.` : "You have no upcoming bookings. Reply *1* to book.",

  pickBooking: (items: string[], verb: string) =>
    items.length ? `Which booking do you want to ${verb}?\n\n${numbered(items)}\n\n_Reply with a number._` : "You have no upcoming bookings to change. Reply *MENU* to go back.",

  confirmCancel: (item: string) => `Cancel this booking?\n\n${item}\n\nReply *YES* to cancel or *NO* to keep it.`,
  cancelled: (ref: string) => `Your booking *${ref}* has been cancelled.`,
  confirmReschedule: (from: string, to: string) =>
    `Move your booking from *${from}* to *${to}*?\n\nReply *YES* to confirm or *NO* to keep the original time.`,
  rescheduled: (ref: string, when: string, needsApproval: boolean) =>
    needsApproval
      ? `Your booking *${ref}* has been moved to *${when}* and is waiting for the provider to confirm.`
      : `Your booking *${ref}* is now at *${when}*.`,

  slotTaken: () => "Sorry — that time was just taken. Here are the times still free:",
  invalidChoice: () => "Sorry, I didn't understand that. Please reply with one of the numbers shown, or *MENU*.",
  invalidEmail: () => "That doesn't look like an email address. Try again, or reply *skip*.",
  unsupported: () => "I can only read text messages. Reply *MENU* to see what I can do.",
  keptAsIs: () => "No problem — nothing was changed. Reply *MENU* for more options.",
  error: () => "Sorry, something went wrong on our side. Please try again in a moment, or reply *MENU*.",
  unavailable: () => "This booking line is currently unavailable. Please try again later.",
  tooFast: () => "You're sending messages very quickly — please wait a minute and try again.",
  money,
};
