import { supabaseAdmin } from '../supabaseClient.mjs';
import { format, addMinutes, parseISO, startOfDay, endOfDay, addDays, isBefore } from 'date-fns';

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateBookingNumber() {
  const date   = format(new Date(), 'yyyyMMdd');
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `WA-${date}-${random}`;
}

/** Convert "HH:mm:ss" or "HH:mm" to minutes since midnight */
function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/** Return "HH:mm" string from minutes since midnight */
function minutesToTime(mins) {
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');
  return `${h}:${m}`;
}

// ── Available Slots ──────────────────────────────────────────────────────────

/**
 * Get available time slots for a bot service on a given date (YYYY-MM-DD).
 * Returns an array of "HH:mm" strings.
 */
export async function getAvailableSlots(botServiceId, date) {
  const dayOfWeek = new Date(`${date}T12:00`).getDay();

  // 1. Business hours for that day
  const { data: hours, error: hErr } = await supabaseAdmin
    .from('business_hours')
    .select('*')
    .eq('bot_service_id', botServiceId)
    .eq('day_of_week', dayOfWeek)
    .single();

  if (hErr || !hours?.is_open) return [];

  // 2. Check for override on this specific date
  const { data: override } = await supabaseAdmin
    .from('time_slot_overrides')
    .select('*')
    .eq('bot_service_id', botServiceId)
    .eq('override_date', date)
    .maybeSingle();

  if (override?.is_closed) return [];

  const openTime  = override?.open_time  || hours.open_time;
  const closeTime = override?.close_time || hours.close_time;
  const duration  = hours.slot_duration_minutes || 60;

  // 3. Generate all slots
  const openMins  = timeToMinutes(openTime);
  const closeMins = timeToMinutes(closeTime);
  const slots     = [];

  for (let m = openMins; m + duration <= closeMins; m += duration) {
    slots.push(minutesToTime(m));
  }

  if (slots.length === 0) return [];

  // 4. Remove already-booked slots
  const { data: booked } = await supabaseAdmin
    .from('whatsapp_bookings')
    .select('booking_time')
    .eq('bot_service_id', botServiceId)
    .eq('booking_date', date)
    .in('status', ['pending', 'confirmed']);

  const bookedSet = new Set((booked || []).map((b) => b.booking_time.substring(0, 5)));

  return slots.filter((s) => !bookedSet.has(s));
}

/**
 * Get the next N available days for a bot service, up to maxAdvanceDays ahead.
 * Returns an array of date strings (YYYY-MM-DD).
 */
export async function getAvailableDays(botServiceId, count = 7) {
  const { data: service } = await supabaseAdmin
    .from('whatsapp_bot_services')
    .select('max_advance_days')
    .eq('id', botServiceId)
    .single();

  const maxDays  = service?.max_advance_days || 30;
  const days     = [];
  const today    = new Date();
  let   checked  = 0;

  while (days.length < count && checked <= maxDays) {
    checked++;
    const candidate = addDays(today, checked);
    const dateStr   = format(candidate, 'yyyy-MM-dd');
    const slots     = await getAvailableSlots(botServiceId, dateStr);
    if (slots.length > 0) days.push(dateStr);
  }

  return days;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function createBooking(data) {
  const code = generateBookingNumber();

  const { data: booking, error } = await supabaseAdmin
    .from('whatsapp_bookings')
    .insert({
      bot_service_id:  data.botServiceId,
      conversation_id: data.conversationId || null,
      booking_number:  code,
      confirmation_code: code,
      customer_name:   data.customerName,
      customer_phone:  data.customerPhone,
      customer_email:  data.customerEmail || null,
      service_name:    data.serviceName,
      booking_date:    data.bookingDate,
      booking_time:    data.bookingTime,
      duration_minutes: data.durationMinutes || 60,
      notes:           data.notes || null,
      status:          'confirmed',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return booking;
}

export async function rescheduleBooking(bookingId, newDate, newTime) {
  const { data: existing, error: fErr } = await supabaseAdmin
    .from('whatsapp_bookings')
    .select('*')
    .eq('id', bookingId)
    .single();

  if (fErr || !existing) throw new Error('Booking not found');

  const { data: updated, error } = await supabaseAdmin
    .from('whatsapp_bookings')
    .update({
      booking_date:    newDate,
      booking_time:    newTime,
      status:          'rescheduled',
      rescheduled_from: bookingId,
    })
    .eq('id', bookingId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return { booking: updated, previous: { date: existing.booking_date, time: existing.booking_time } };
}

export async function cancelBooking(bookingId) {
  const { data, error } = await supabaseAdmin
    .from('whatsapp_bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getBookingByCode(code) {
  const { data, error } = await supabaseAdmin
    .from('whatsapp_bookings')
    .select('*, whatsapp_bot_services(name, phone_number)')
    .eq('confirmation_code', code.toUpperCase())
    .single();

  if (error) return null;
  return data;
}

export async function getBookingsByPhone(phone) {
  const { data } = await supabaseAdmin
    .from('whatsapp_bookings')
    .select('*')
    .eq('customer_phone', phone)
    .not('status', 'in', '(cancelled,completed)')
    .order('booking_date', { ascending: true })
    .limit(5);

  return data || [];
}
