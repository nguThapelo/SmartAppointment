import { Router } from 'express';
import { supabaseAdmin } from '../supabaseClient.mjs';
import { requireAuth, requireAdmin } from '../middleware/auth.mjs';

const router = Router();
router.use(requireAuth);

// GET /api/bot-services — list all bot services
router.get('/', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('whatsapp_bot_services')
    .select(`
      *,
      business_hours(*),
      whatsapp_bookings(count),
      whatsapp_conversations(count)
    `)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/bot-services/:id — get single service with full stats
router.get('/:id', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('whatsapp_bot_services')
    .select(`
      *,
      business_hours(*),
      time_slot_overrides(*)
    `)
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Service not found' });
  res.json(data);
});

// GET /api/bot-services/:id/stats — booking stats for a service
router.get('/:id/stats', async (req, res) => {
  const { id } = req.params;

  const [convResult, bookResult, msgResult] = await Promise.all([
    supabaseAdmin
      .from('whatsapp_conversations')
      .select('id, status', { count: 'exact' })
      .eq('bot_service_id', id),
    supabaseAdmin
      .from('whatsapp_bookings')
      .select('id, status, created_at', { count: 'exact' })
      .eq('bot_service_id', id),
    supabaseAdmin
      .from('whatsapp_messages')
      .select('id, direction, created_at', { count: 'exact' })
      .in(
        'conversation_id',
        (await supabaseAdmin.from('whatsapp_conversations').select('id').eq('bot_service_id', id)).data?.map((c) => c.id) || [],
      ),
  ]);

  const bookings = bookResult.data || [];
  const stats = {
    totalConversations: convResult.count || 0,
    totalBookings:      bookings.length,
    confirmedBookings:  bookings.filter((b) => ['confirmed', 'rescheduled'].includes(b.status)).length,
    pendingBookings:    bookings.filter((b) => b.status === 'pending').length,
    cancelledBookings:  bookings.filter((b) => b.status === 'cancelled').length,
    completedBookings:  bookings.filter((b) => b.status === 'completed').length,
    totalMessages:      msgResult.count || 0,
  };

  res.json(stats);
});

// GET /api/bot-services/:id/webhook-url — get the Twilio webhook URL for this service
router.get('/:id/webhook-url', async (req, res) => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 8000}`;
  res.json({ url: `${baseUrl}/api/whatsapp/webhook/${req.params.id}` });
});

// POST /api/bot-services — create a new bot service (admin only)
router.post('/', requireAdmin, async (req, res) => {
  const {
    name, description, phone_number, twilio_account_sid, twilio_auth_token,
    welcome_message, booking_duration_minutes, max_advance_days, timezone, color,
  } = req.body;

  if (!name || !phone_number) {
    return res.status(400).json({ error: 'name and phone_number are required' });
  }

  const { data, error } = await supabaseAdmin
    .from('whatsapp_bot_services')
    .insert({
      name, description, phone_number, twilio_account_sid, twilio_auth_token,
      welcome_message, booking_duration_minutes, max_advance_days, timezone, color,
      created_by: req.user.id,
    })
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// PUT /api/bot-services/:id — update a bot service (admin only)
router.put('/:id', requireAdmin, async (req, res) => {
  const allowed = [
    'name', 'description', 'phone_number', 'twilio_account_sid', 'twilio_auth_token',
    'welcome_message', 'booking_duration_minutes', 'max_advance_days', 'timezone',
    'color', 'is_active',
  ];
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([k]) => allowed.includes(k)),
  );

  const { data, error } = await supabaseAdmin
    .from('whatsapp_bot_services')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// DELETE /api/bot-services/:id — delete a bot service (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  const { error } = await supabaseAdmin
    .from('whatsapp_bot_services')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

export default router;
