import { Router } from 'express';
import { supabaseAdmin } from '../supabaseClient.mjs';
import { requireAuth, requireAdmin } from '../middleware/auth.mjs';

const router = Router();
router.use(requireAuth);

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// GET /api/business-hours/:serviceId — get full week schedule
router.get('/:serviceId', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('business_hours')
    .select('*')
    .eq('bot_service_id', req.params.serviceId)
    .order('day_of_week');

  if (error) return res.status(500).json({ error: error.message });

  // Fill in any missing days (should be seeded by trigger, but just in case)
  const map = Object.fromEntries((data || []).map((r) => [r.day_of_week, r]));
  const full = Array.from({ length: 7 }, (_, i) => map[i] || {
    bot_service_id:       req.params.serviceId,
    day_of_week:          i,
    day_name:             DAY_NAMES[i],
    is_open:              false,
    open_time:            '09:00',
    close_time:           '17:00',
    slot_duration_minutes: 60,
  });

  res.json(full.map((r) => ({ ...r, day_name: DAY_NAMES[r.day_of_week] })));
});

// PUT /api/business-hours/:serviceId — update entire week schedule
router.put('/:serviceId', requireAdmin, async (req, res) => {
  const { serviceId } = req.params;
  const { hours } = req.body; // Array of { day_of_week, is_open, open_time, close_time, slot_duration_minutes }

  if (!Array.isArray(hours)) {
    return res.status(400).json({ error: 'hours must be an array of day configs' });
  }

  const upserts = hours.map((h) => ({
    bot_service_id:       serviceId,
    day_of_week:          h.day_of_week,
    is_open:              h.is_open,
    open_time:            h.open_time || '09:00',
    close_time:           h.close_time || '17:00',
    slot_duration_minutes: h.slot_duration_minutes || 60,
  }));

  const { data, error } = await supabaseAdmin
    .from('business_hours')
    .upsert(upserts, { onConflict: 'bot_service_id,day_of_week' })
    .select();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// PATCH /api/business-hours/:serviceId/:dayOfWeek — update a single day
router.patch('/:serviceId/:dayOfWeek', requireAdmin, async (req, res) => {
  const { serviceId, dayOfWeek } = req.params;
  const allowed = ['is_open', 'open_time', 'close_time', 'slot_duration_minutes'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));

  const { data, error } = await supabaseAdmin
    .from('business_hours')
    .update(updates)
    .eq('bot_service_id', serviceId)
    .eq('day_of_week', Number(dayOfWeek))
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// ── Time Slot Overrides ──────────────────────────────────────────────────────

// GET /api/business-hours/:serviceId/overrides — list overrides
router.get('/:serviceId/overrides', async (req, res) => {
  const { from, to } = req.query;
  let query = supabaseAdmin
    .from('time_slot_overrides')
    .select('*')
    .eq('bot_service_id', req.params.serviceId)
    .order('override_date');

  if (from) query = query.gte('override_date', from);
  if (to)   query = query.lte('override_date', to);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// POST /api/business-hours/:serviceId/overrides — add an override
router.post('/:serviceId/overrides', requireAdmin, async (req, res) => {
  const { override_date, is_closed, open_time, close_time, reason } = req.body;
  if (!override_date) return res.status(400).json({ error: 'override_date is required' });

  const { data, error } = await supabaseAdmin
    .from('time_slot_overrides')
    .upsert(
      { bot_service_id: req.params.serviceId, override_date, is_closed, open_time, close_time, reason },
      { onConflict: 'bot_service_id,override_date' },
    )
    .select()
    .single();

  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// DELETE /api/business-hours/:serviceId/overrides/:overrideId — remove an override
router.delete('/:serviceId/overrides/:overrideId', requireAdmin, async (req, res) => {
  const { error } = await supabaseAdmin
    .from('time_slot_overrides')
    .delete()
    .eq('id', req.params.overrideId)
    .eq('bot_service_id', req.params.serviceId);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ success: true });
});

export default router;
