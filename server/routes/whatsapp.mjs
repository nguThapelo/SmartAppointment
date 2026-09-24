import { Router } from 'express';
import twilio from 'twilio';
import { processMessage } from '../bot/conversationFlow.mjs';

const router = Router();

/**
 * POST /api/whatsapp/webhook/:serviceId
 * Twilio calls this endpoint when a WhatsApp message is received.
 * Configure the webhook in Twilio console: https://your-domain.com/api/whatsapp/webhook/{serviceId}
 */
router.post('/webhook/:serviceId', async (req, res) => {
  const { serviceId } = req.params;

  // Validate Twilio signature (skip in dev if no auth token configured)
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (authToken && process.env.NODE_ENV === 'production') {
    const signature = req.headers['x-twilio-signature'] || '';
    const url       = `${process.env.NEXT_PUBLIC_APP_URL}/api/whatsapp/webhook/${serviceId}`;
    const isValid   = twilio.validateRequest(authToken, signature, url, req.body);
    if (!isValid) {
      return res.status(403).send('Forbidden: Invalid Twilio signature');
    }
  }

  const { From: from, Body: body, MessageSid: sid } = req.body;

  if (!from || !body) {
    return res.status(400).send('Missing required fields');
  }

  // Strip "whatsapp:" prefix from phone number
  const customerPhone = from.replace('whatsapp:', '');

  try {
    const reply = await processMessage({
      botServiceId:  serviceId,
      customerPhone,
      messageText:   body.trim(),
      messageSid:    sid,
    });

    // Respond with TwiML
    res.set('Content-Type', 'text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(reply)}</Message>
</Response>`);
  } catch (err) {
    console.error('[WhatsApp Webhook] Error:', err);
    res.set('Content-Type', 'text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Sorry, something went wrong. Please try again later.</Message>
</Response>`);
  }
});

/**
 * POST /api/whatsapp/send
 * Proactively send a WhatsApp message (admin-initiated).
 * Body: { to, message, fromNumber }
 */
router.post('/send', async (req, res) => {
  const { to, message, fromNumber } = req.body;
  if (!to || !message) return res.status(400).json({ error: 'Missing to or message' });

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return res.status(500).json({ error: 'Twilio not configured' });

  const client = twilio(accountSid, authToken);
  const from   = fromNumber || process.env.TWILIO_WHATSAPP_NUMBER;

  try {
    const msg = await client.messages.create({
      from: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
      to:   to.startsWith('whatsapp:')   ? to   : `whatsapp:${to}`,
      body: message,
    });
    res.json({ success: true, sid: msg.sid });
  } catch (err) {
    console.error('[WhatsApp Send] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

function escapeXml(str = '') {
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&apos;');
}

export default router;
