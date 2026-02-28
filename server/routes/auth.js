const express = require('express');
const nodemailer = require('nodemailer');
const { supabase } = require('../supabaseClient');

const router = express.Router();

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const buildResetEmailHtml = ({ appName, resetLink }) => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #0f172a;">
      <h2 style="margin-bottom: 8px;">Reset your password</h2>
      <p style="margin: 0 0 16px;">A password reset was requested for your ${appName} account.</p>
      <p style="margin: 0 0 16px;">
        <a href="${resetLink}" style="display: inline-block; background: #0f172a; color: #ffffff; text-decoration: none; padding: 10px 16px; border-radius: 8px;">
          Reset password
        </a>
      </p>
      <p style="margin: 0 0 8px; font-size: 13px; color: #475569;">If you didn't request this, you can ignore this email.</p>
      <p style="margin: 0; font-size: 12px; color: #64748b;">Or open this link: ${resetLink}</p>
    </div>
  `;
};

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:8000';
    const redirectTo = `${appBaseUrl}/Login`;

    // Generate a secure Supabase recovery link using service role privileges.
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo,
      },
    });

    if (error || !data?.properties?.action_link) {
      return res.status(500).json({ error: 'Failed to generate recovery link' });
    }

    const transporter = createTransporter();
    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
    const appName = process.env.APP_NAME || 'SmartAppointment';

    if (!fromAddress) {
      return res.status(500).json({ error: 'SMTP_FROM or SMTP_USER must be configured' });
    }

    await transporter.sendMail({
      from: fromAddress,
      to: email,
      subject: `${appName} password reset`,
      html: buildResetEmailHtml({
        appName,
        resetLink: data.properties.action_link,
      }),
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to send password reset email' });
  }
});

module.exports = router;
