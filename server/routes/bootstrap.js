const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars not set');
  return createClient(url, key, { auth: { persistSession: false } });
}

const isBootstrapEnabled = () => process.env.ENABLE_ADMIN_BOOTSTRAP === 'true';

router.post('/promote-admin', async (req, res) => {
  if (!isBootstrapEnabled()) {
    return res.status(404).json({ error: 'Bootstrap route is disabled' });
  }

  const providedSecret = req.headers['x-bootstrap-secret'];
  const expectedSecret = process.env.ADMIN_BOOTSTRAP_SECRET;

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return res.status(403).json({ error: 'Invalid bootstrap secret' });
  }

  const { email, userId } = req.body || {};
  if (!email && !userId) {
    return res.status(400).json({ error: 'Provide email or userId' });
  }

  let supabase;
  try { supabase = getAdminClient(); } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  let targetUser = null;

  if (userId) {
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error || !data?.user) return res.status(404).json({ error: 'User not found' });
    targetUser = data.user;
  } else {
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) return res.status(500).json({ error: error.message });
    targetUser = (data?.users || []).find((u) => u.email === email);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
  }

  const { data: updated, error: updateErr } = await supabase.auth.admin.updateUserById(
    targetUser.id,
    { user_metadata: { ...targetUser.user_metadata, role: 'admin' } },
  );

  if (updateErr) return res.status(500).json({ error: updateErr.message });

  return res.status(200).json({
    message: 'User promoted to admin',
    user: {
      id: updated.user.id,
      email: updated.user.email,
      role: updated.user.user_metadata?.role,
    },
    nextStep: 'Disable ENABLE_ADMIN_BOOTSTRAP and rotate ADMIN_BOOTSTRAP_SECRET',
  });
});

module.exports = router;
