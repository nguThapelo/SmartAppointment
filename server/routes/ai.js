const express = require('express');

const router = express.Router();

router.post('/chat', async (req, res) => {
  try {
    const message = String(req.body?.message || '').toLowerCase();

    if (message.includes('availability')) {
      return res.status(200).json({
        reply:
          'You can check real-time availability by selecting a service category, sub-service, and provider in the booking form. I can then help you book instantly.',
      });
    }

    if (message.includes('book')) {
      return res.status(200).json({
        reply:
          'To book: choose category → sub-service → provider → date/time, then click Save. A unique appointment number is generated automatically.',
      });
    }

    return res.status(200).json({
      reply:
        'I can help with booking, provider availability, approval status, and confirmation guidance. Ask me what service you need and your preferred time.',
    });
  } catch (_error) {
    return res.status(500).json({ error: 'AI assistant failed to respond' });
  }
});

module.exports = router;
