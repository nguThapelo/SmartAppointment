import { Router } from 'express';
import { supabaseAdmin } from '../supabaseClient.mjs';
import { requireAuth, requireAdmin } from '../middleware/auth.mjs';
import { sendBookingConfirmation, sendBookingCancellation, sendBookingRescheduled } from '../services/emailService.mjs';
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent, getCalendarEvents } from '../services/calendarService.mjs';
import { getAvailableSlots } from '../services/bookingService.mjs';
import { format } from 'date-fns';

const router = Router();
router.use(requireAuth);

// GET /api/bot-bookings — list bookings with filters
router.get('/', async (req, res) => {
  const { serviceId, status, date, phone, search, limit = 50, offset = 0 } = req.query;

  let query = supabaseAdmin
    .from('whatsapp_bookings')
    .select('*, whatsapp_bot_services(name, phone_number, color)', { count: 'exact' })
    .order('booking_date', { ascending: false })
    .order('booking_time', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1);

  if (serviceId) query = query.eq('bot_service_id', serviceId);
  if (status)    query = query.eq('status', status);
  if (date)      query = query.eq('booking_date', date);
  if (phone)     query = query.ilike('customer_phone', `%${phone}%`);
  if (search)    query = query.or(`customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%,confirmation_code.ilike.%${search}%`);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ data, count });
});

// GET /api/bot-bookings/calendar — all bookings for a date range (calendar view)
router.get('/calendar', async (req, res) => {
  const { start, end, serviceId } = req.query;
  if (!start || !end) return res.status(400).json({ error: 'start and end date are required' });

  let query = supabaseAdmin
    .from('whatsapp_bookings')
    .select('*, whatsapp_bot_services(name, color)')
    .gte('booking_date', start)
    .lte('booking_date', end)
    .not('status', 'in', '(cancelled)');

  if (serviceId) query = query.eq('bot_service_id', serviceId);

  const { data, error } = await query.order('booking_date').order('booking_time');
  if (error) return res.status(500).json({ error: error.message });

  // Optionally enrich with Google Calendar events
  let calEvents = [];
  try {
    calEvents = await getCalendarEvents(
      new Date(start).toISOString(),
      new Date(`${end}T23:59:59`).toISOString(),
    );
  } catch (_) { /* ignore if calendar not configured */ }

  res.json({ bookings: data, calendarEvents: calEvents });
});

// GET /api/bot-bookings/slots — available time slots for a service + date
router.get('/slots', async (req, res) => {
  const { serviceId, date } = req.query;
  if (!serviceId || !date) return res.status(400).json({ error: 'serviceId and date are required' });

  const slots = await getAvailableSlots(serviceId, date);
  res.json({ slots });
});

// GET /api/bot-bookings/:id — single booking
router.get('/:id', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('whatsapp_bookings')
    .select('*, whatsapp_bot_services(name, phone_number, color), whatsapp_conversations(customer_phone, customer_name)')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Booking not found' });
  res.json(data);
});

// PUT /api/bot-bookings/:id — admin updates a booking (status, notes, date, time)
router.put('/:id', requireAdmin, async (req, res) => {
  const allowed = ['status', 'admin_notes', 'booking_date', 'booking_time', 'duration_minutes', 'service_name'];
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => allowed.includes(k)),
  );

  const { data: existing } = await supabaseAdmin
    .from('whatsapp_bookings')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (!existing) return res.status(404).json({ error: 'Booking not found' });

  const { data, error } = await supabaseAdmin
    .from('whatsapp_bookings')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  // Sync Google Calendar if date/time changed
  if ((updates.booking_date || updates.booking_time) && data.google_event_id) {
    updateCalendarEvent(data.google_event_id, data).catch(console.error);
  }

  res.json(data);
});

// POST /api/bot-bookings/:id/confirm — admin manually confirms a pending booking
router.post('/:id/confirm', requireAdmin, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('whatsapp_bookings')
    .update({ status: 'confirmed' })
    .eq('id', req.params.id)
    .select('*, whatsapp_bot_services(name)')
    .single();

  if (error) return res.status(400).json({ error: error.message });

  if (data.customer_email) {
    sendBookingConfirmation(data, data.whatsapp_bot_services?.name).catch(console.error);
  }

  res.json(data);
});

// POST /api/bot-bookings/:id/cancel — admin cancels a booking
router.post('/:id/cancel', requireAdmin, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('whatsapp_bookings')
    .update({ status: 'cancelled', admin_notes: req.body.reason || null })
    .eq('id', req.params.id)
    .select('*, whatsapp_bot_services(name)')
    .single();

  if (error) return res.status(400).json({ error: error.message });

  if (data.customer_email) {
    sendBookingCancellation(data, data.whatsapp_bot_services?.name).catch(console.error);
  }
  if (data.google_event_id) {
    deleteCalendarEvent(data.google_event_id).catch(console.error);
  }

  res.json(data);
});

// POST /api/bot-bookings/:id/reschedule — admin reschedules a booking
router.post('/:id/reschedule', requireAdmin, async (req, res) => {
  const { newDate, newTime } = req.body;
  if (!newDate || !newTime) return res.status(400).json({ error: 'newDate and newTime are required' });

  const { data: existing } = await supabaseAdmin
    .from('whatsapp_bookings')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (!existing) return res.status(404).json({ error: 'Booking not found' });

  const { data, error } = await supabaseAdmin
    .from('whatsapp_bookings')
    .update({ booking_date: newDate, booking_time: newTime, status: 'rescheduled' })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });

  if (data.customer_email) {
    sendBookingRescheduled(data, existing.booking_date, existing.booking_time, '').catch(console.error);
  }
  if (data.google_event_id) {
    updateCalendarEvent(data.google_event_id, data).catch(console.error);
  }

  res.json(data);
});

// POST /api/bot-bookings/:id/complete — mark as completed
router.post('/:id/complete', requireAdmin, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('whatsapp_bookings')
    .update({ status: 'completed' })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// GET /api/bot-bookings/stats/summary — global stats dashboard
router.get('/stats/summary', async (req, res) => {
  const today = format(new Date(), 'yyyy-MM-dd');

  const [allBookings, todayBookings, conversations] = await Promise.all([
    supabaseAdmin.from('whatsapp_bookings').select('id, status', { count: 'exact' }),
    supabaseAdmin.from('whatsapp_bookings').select('id, status').eq('booking_date', today),
    supabaseAdmin.from('whatsapp_conversations').select('id, status', { count: 'exact' }),
  ]);

  const all = allBookings.data || [];
  const tod = todayBookings.data || [];

  res.json({
    total:         allBookings.count || 0,
    confirmed:     all.filter((b) => ['confirmed', 'rescheduled'].includes(b.status)).length,
    pending:       all.filter((b) => b.status === 'pending').length,
    cancelled:     all.filter((b) => b.status === 'cancelled').length,
    completed:     all.filter((b) => b.status === 'completed').length,
    todayTotal:    tod.length,
    todayConfirmed: tod.filter((b) => ['confirmed', 'rescheduled'].includes(b.status)).length,
    conversations: conversations.count || 0,
  });
});

export default router;
