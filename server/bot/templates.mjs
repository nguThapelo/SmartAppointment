import { format } from 'date-fns';

// ── Helpers ──────────────────────────────────────────────────────────────────

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function fmtDate(dateStr) {
  return format(new Date(`${dateStr}T12:00`), 'EEE, MMM d');
}

function fmtDateLong(dateStr) {
  return format(new Date(`${dateStr}T12:00`), 'EEEE, MMMM d, yyyy');
}

function numbered(items) {
  return items.map((item, i) => `${i + 1}️⃣ ${item}`).join('\n');
}

// ── Main templates ────────────────────────────────────────────────────────────

export function mainMenu(serviceName, welcomeMsg) {
  return `${welcomeMsg || `👋 Hello! Welcome to *${serviceName}*!`}

What would you like to do?

1️⃣ Book an appointment
2️⃣ View my bookings
3️⃣ Reschedule a booking
4️⃣ Cancel a booking
5️⃣ Help

_Reply with a number to continue_ 🚀`;
}

export function serviceList(services) {
  const list = numbered(services.map((s) => `*${s.name}*${s.description ? ` — ${s.description}` : ''}`));
  return `📋 *Which service would you like?*\n\n${list}\n\n_Reply with a number to select._`;
}

export function dateList(dates, serviceName) {
  const list = numbered(dates.map(fmtDate));
  return `📅 *When would you like your ${serviceName}?*\n\nAvailable dates:\n${list}\n7️⃣ Show more dates\n\n_Reply with a number, or type a date (DD/MM/YYYY)._`;
}

export function timeList(slots, dateStr) {
  if (slots.length === 0) {
    return `😔 *No slots available on ${fmtDate(dateStr)}.*\n\nPlease try another date.\n\n_Reply *MENU* to start over._`;
  }
  const list = numbered(slots.map((s) => `*${s}*`));
  return `⏰ *Available times for ${fmtDate(dateStr)}:*\n\n${list}\n\n_Reply with a number to select your time._`;
}

export function askName() {
  return `👤 *What is your full name?*\n\n_Type your name and press send._`;
}

export function askEmail() {
  return `📧 *What is your email address?*\n\nWe'll send a confirmation to your email.\n\n_Type your email, or reply *skip* to continue without one._`;
}

export function bookingConfirmPrompt(session) {
  return `📝 *Please confirm your booking:*

📋 Service: *${session.serviceName}*
📅 Date:    *${fmtDateLong(session.date)}*
⏰ Time:    *${session.time}*
👤 Name:    *${session.name}*
📧 Email:   *${session.email || 'Not provided'}*

Reply *YES* to confirm ✅
Reply *NO* to cancel ❌`;
}

export function bookingConfirmed(booking) {
  return `🎉 *Booking Confirmed!*

Your confirmation code: *${booking.confirmation_code}*

📋 ${booking.service_name}
📅 ${fmtDateLong(booking.booking_date)}
⏰ ${booking.booking_time.substring(0, 5)}
${booking.customer_email ? `📧 Confirmation sent to ${booking.customer_email}` : ''}

To manage your booking:
• Reschedule: *RESCHEDULE ${booking.confirmation_code}*
• Cancel:      *CANCEL ${booking.confirmation_code}*

See you soon! 😊`;
}

export function myBookings(bookings) {
  if (bookings.length === 0) {
    return `📭 *You have no upcoming bookings.*\n\nReply *1* to book an appointment, or *MENU* to go back.`;
  }
  const list = bookings
    .map(
      (b, i) =>
        `${i + 1}. *${b.service_name}*\n   📅 ${fmtDate(b.booking_date)} ⏰ ${b.booking_time.substring(0, 5)}\n   🔑 ${b.confirmation_code} (${b.status})`,
    )
    .join('\n\n');
  return `📋 *Your Upcoming Bookings:*\n\n${list}\n\n_Reply *MENU* to go back._`;
}

export function askRescheduleCode() {
  return `🔄 *Please send your booking reference code.*\n\nExample: *WA-20260518-ABC12*\n\n_Reply *MENU* to go back._`;
}

export function askCancelCode() {
  return `❌ *Please send your booking reference code to cancel.*\n\nExample: *WA-20260518-ABC12*\n\n_Reply *MENU* to go back._`;
}

export function cancelConfirm(booking) {
  return `❌ *Cancel this booking?*\n\n📋 ${booking.service_name}\n📅 ${fmtDateLong(booking.booking_date)}\n⏰ ${booking.booking_time.substring(0, 5)}\n🔑 ${booking.confirmation_code}\n\nReply *YES* to cancel or *NO* to keep it.`;
}

export function bookingCancelled(code) {
  return `✅ *Booking ${code} has been cancelled.*\n\nSorry to see you go! Book again anytime by saying *Hi* 👋`;
}

export function rescheduleNewDate(booking, dates) {
  const list = numbered(dates.map(fmtDate));
  return `🔄 *Rescheduling: ${booking.confirmation_code}*\n📋 ${booking.service_name}\n\nChoose a new date:\n${list}\n\n_Reply with a number or type a date (DD/MM/YYYY)._`;
}

export function rescheduleNewTime(slots, dateStr) {
  if (slots.length === 0) {
    return `😔 *No slots available on ${fmtDate(dateStr)}.*\nPlease choose another date.\n\n_Reply *MENU* to start over._`;
  }
  const list = numbered(slots.map((s) => `*${s}*`));
  return `⏰ *New available times for ${fmtDate(dateStr)}:*\n\n${list}\n\n_Reply with a number to confirm._`;
}

export function rescheduleConfirmPrompt(booking, newDate, newTime) {
  return `🔄 *Confirm Reschedule?*\n\n❌ Was: ${fmtDateLong(booking.booking_date)} at ${booking.booking_time.substring(0, 5)}\n✅ New: *${fmtDateLong(newDate)}* at *${newTime}*\n\nReply *YES* to confirm or *NO* to cancel.`;
}

export function rescheduleDone(booking) {
  return `✅ *Booking Rescheduled!*\n\n📋 ${booking.service_name}\n📅 ${fmtDateLong(booking.booking_date)}\n⏰ ${booking.booking_time.substring(0, 5)}\n🔑 ${booking.confirmation_code}\n\nSee you then! 😊`;
}

export function helpMessage() {
  return `ℹ️ *How to use this bot:*

• Say *Hi* to start booking
• *MENU* — go back to main menu
• *MY BOOKINGS* — see your bookings
• *CANCEL <code>* — cancel a booking
• *RESCHEDULE <code>* — reschedule a booking

_Need more help? Contact us directly._`;
}

export function errorMessage(details) {
  return `😕 *Oops, something went wrong.*${details ? `\n\n${details}` : ''}\n\nReply *MENU* to start over or try again.`;
}

export function notFoundMessage(code) {
  return `❓ *Booking not found:* ${code}\n\nPlease check your reference code and try again.\n\nReply *MY BOOKINGS* to see your bookings, or *MENU* to go back.`;
}
