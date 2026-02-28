const express = require('express');
const { supabase } = require('../supabaseClient');
const {
  ensureAppointmentChatTable,
  canEnsureAppointmentChatTable,
  getChatTableEnsureStatus,
} = require('../services/ensureChatTable');

const router = express.Router();

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

  let targetUser = null;

  if (userId) {
    const userResult = await supabase.auth.admin.getUserById(userId);
    if (userResult.error || !userResult.data?.user) {
      return res.status(404).json({ error: 'User not found' });
    }
    targetUser = userResult.data.user;
  } else {
    const usersResult = await supabase.auth.admin.listUsers();
    if (usersResult.error) {
      return res.status(500).json({ error: usersResult.error.message });
    }

    targetUser = (usersResult.data?.users || []).find((candidate) => candidate.email === email);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
  }

  const existingMetadata = targetUser.user_metadata || {};
  const nextMetadata = {
    ...existingMetadata,
    role: 'admin',
  };

  const updateResult = await supabase.auth.admin.updateUserById(targetUser.id, {
    user_metadata: nextMetadata,
  });

  if (updateResult.error) {
    return res.status(500).json({ error: updateResult.error.message });
  }

  return res.status(200).json({
    message: 'User promoted to admin',
    user: {
      id: updateResult.data.user.id,
      email: updateResult.data.user.email,
      role: updateResult.data.user.user_metadata?.role || 'client',
    },
    nextStep: 'Disable ENABLE_ADMIN_BOOTSTRAP and rotate ADMIN_BOOTSTRAP_SECRET',
  });
});

router.post('/ensure-chat-table', async (req, res) => {
  if (!isBootstrapEnabled()) {
    return res.status(404).json({ error: 'Bootstrap route is disabled' });
  }

  const providedSecret = req.headers['x-bootstrap-secret'];
  const expectedSecret = process.env.ADMIN_BOOTSTRAP_SECRET;

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return res.status(403).json({ error: 'Invalid bootstrap secret' });
  }

  if (!canEnsureAppointmentChatTable()) {
    return res.status(400).json({
      error: 'DATABASE_URL is not configured on the server. Cannot auto-create chat table.',
      status: getChatTableEnsureStatus(),
      hint: 'Apply supabase/migrations/20260228_appointment_chat.sql manually in your Supabase SQL editor.',
    });
  }

  try {
    await ensureAppointmentChatTable();
    return res.status(200).json({
      message: 'Chat table ensured and schema cache reloaded.',
      status: getChatTableEnsureStatus(),
    });
  } catch (error) {
    return res.status(500).json({
      error: error?.message || 'Failed to ensure chat table',
      status: getChatTableEnsureStatus(),
    });
  }
});

module.exports = router;
