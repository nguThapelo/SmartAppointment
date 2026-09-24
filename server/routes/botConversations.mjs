import { Router } from 'express';
import { supabaseAdmin } from '../supabaseClient.mjs';
import { requireAuth } from '../middleware/auth.mjs';

const router = Router();
router.use(requireAuth);

// GET /api/bot-conversations — list conversations with filters
router.get('/', async (req, res) => {
  const { status, serviceId, search, limit = 50, offset = 0 } = req.query;

  let query = supabaseAdmin
    .from('whatsapp_conversations')
    .select('*, whatsapp_bot_services(name, color, phone_number)', { count: 'exact' })
    .order('last_message_at', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1);

  if (status)    query = query.eq('status', status);
  if (serviceId) query = query.eq('bot_service_id', serviceId);
  if (search)    query = query.or(`customer_phone.ilike.%${search}%,customer_name.ilike.%${search}%`);

  const { data, error, count } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/bot-conversations/:id — single conversation
router.get('/:id', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('whatsapp_conversations')
    .select('*, whatsapp_bot_services(name, phone_number, color)')
    .eq('id', req.params.id)
    .single();

  if (error) return res.status(404).json({ error: 'Conversation not found' });
  res.json(data);
});

// GET /api/bot-conversations/:id/messages — all messages for a conversation
router.get('/:id/messages', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('whatsapp_messages')
    .select('*')
    .eq('conversation_id', req.params.id)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/bot-conversations/stats/overview — aggregate stats
router.get('/stats/overview', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('whatsapp_conversations')
    .select('status', { count: 'exact' });

  if (error) return res.status(500).json({ error: error.message });

  const all = data || [];
  res.json({
    total:     all.length,
    active:    all.filter((c) => c.status === 'active').length,
    completed: all.filter((c) => c.status === 'completed').length,
    abandoned: all.filter((c) => c.status === 'abandoned').length,
  });
});

export default router;
