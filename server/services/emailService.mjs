import nodemailer from 'nodemailer';
import { format } from 'date-fns';

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
  port:   Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = `"${process.env.SMTP_FROM_NAME || 'SmartAppointment'}" <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`;

function baseTemplate(title, accentColor, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
    .header { background: ${accentColor}; padding: 32px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 24px; font-weight: 700; }
    .header p { color: rgba(255,255,255,.85); margin: 8px 0 0; font-size: 14px; }
    .body { padding: 32px; }
    .detail-row { display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
    .detail-row:last-child { border-bottom: none; }
    .detail-icon { font-size: 20px; flex-shrink: 0; }
    .detail-label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: .05em; }
    .detail-value { font-size: 15px; color: #111827; font-weight: 500; margin-top: 2px; }
    .code-box { background: #f9fafb; border: 2px dashed ${accentColor}; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0; }
    .code-box .code { font-size: 28px; font-weight: 800; color: ${accentColor}; letter-spacing: 2px; }
    .code-box .label { font-size: 12px; color: #6b7280; margin-top: 4px; }
    .btn { display: inline-block; background: ${accentColor}; color: #fff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 16px 0; }
    .footer { background: #f9fafb; padding: 20px 32px; text-align: center; font-size: 12px; color: #9ca3af; }
    .whatsapp-note { background: #dcf8c6; border-radius: 8px; padding: 12px 16px; font-size: 13px; color: #075e54; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="wrapper">
    ${bodyHtml}
    <div class="footer">
      &copy; ${new Date().getFullYear()} SmartAppointment &bull; Powered by WhatsApp Booking Bot<br/>
      <small>This email was sent automatically. Please do not reply to this email.</small>
    </div>
  </div>
</body>
</html>`;
}

export async function sendBookingConfirmation(booking, serviceName) {
  const dateStr = format(new Date(`${booking.booking_date}T00:00`), 'EEEE, MMMM d, yyyy');
  const timeStr = booking.booking_time.substring(0, 5);

  const html = baseTemplate('Booking Confirmed!', '#25D366', `
    <div class="header">
      <h1>✅ Booking Confirmed!</h1>
      <p>Your appointment has been successfully booked</p>
    </div>
    <div class="body">
      <p style="font-size:16px;color:#374151;">Hi <strong>${booking.customer_name}</strong>,</p>
      <p style="color:#6b7280;">Great news! Your booking with <strong>${serviceName}</strong> has been confirmed. Here are your details:</p>

      <div class="code-box">
        <div class="code">${booking.confirmation_code}</div>
        <div class="label">Your Booking Reference</div>
      </div>

      <div class="detail-row">
        <div class="detail-icon">📋</div>
        <div><div class="detail-label">Service</div><div class="detail-value">${booking.service_name}</div></div>
      </div>
      <div class="detail-row">
        <div class="detail-icon">📅</div>
        <div><div class="detail-label">Date</div><div class="detail-value">${dateStr}</div></div>
      </div>
      <div class="detail-row">
        <div class="detail-icon">⏰</div>
        <div><div class="detail-label">Time</div><div class="detail-value">${timeStr}</div></div>
      </div>
      <div class="detail-row">
        <div class="detail-icon">⌛</div>
        <div><div class="detail-label">Duration</div><div class="detail-value">${booking.duration_minutes} minutes</div></div>
      </div>

      <div class="whatsapp-note">
        💬 To reschedule or cancel, WhatsApp us and send:<br/>
        <strong>RESCHEDULE ${booking.confirmation_code}</strong> or <strong>CANCEL ${booking.confirmation_code}</strong>
      </div>
    </div>
  `);

  return transporter.sendMail({
    from: FROM,
    to:   booking.customer_email,
    subject: `✅ Booking Confirmed — ${booking.confirmation_code}`,
    html,
  });
}

export async function sendBookingRescheduled(booking, oldDate, oldTime, serviceName) {
  const newDateStr = format(new Date(`${booking.booking_date}T00:00`), 'EEEE, MMMM d, yyyy');
  const oldDateStr = format(new Date(`${oldDate}T00:00`), 'EEEE, MMMM d, yyyy');

  const html = baseTemplate('Booking Rescheduled', '#128C7E', `
    <div class="header" style="background:#128C7E;">
      <h1>🔄 Booking Rescheduled</h1>
      <p>Your appointment has been moved to a new time</p>
    </div>
    <div class="body">
      <p style="font-size:16px;color:#374151;">Hi <strong>${booking.customer_name}</strong>,</p>
      <p style="color:#6b7280;">Your booking has been successfully rescheduled. Here's what changed:</p>

      <div class="code-box" style="border-color:#128C7E;">
        <div class="code" style="color:#128C7E;">${booking.confirmation_code}</div>
        <div class="label">Booking Reference</div>
      </div>

      <div class="detail-row">
        <div class="detail-icon">❌</div>
        <div><div class="detail-label">Previous Date & Time</div><div class="detail-value" style="text-decoration:line-through;color:#9ca3af;">${oldDateStr} at ${oldTime.substring(0,5)}</div></div>
      </div>
      <div class="detail-row">
        <div class="detail-icon">✅</div>
        <div><div class="detail-label">New Date & Time</div><div class="detail-value">${newDateStr} at ${booking.booking_time.substring(0,5)}</div></div>
      </div>
      <div class="detail-row">
        <div class="detail-icon">📋</div>
        <div><div class="detail-label">Service</div><div class="detail-value">${booking.service_name}</div></div>
      </div>

      <div class="whatsapp-note">
        💬 Need to change again? WhatsApp us: <strong>RESCHEDULE ${booking.confirmation_code}</strong>
      </div>
    </div>
  `);

  return transporter.sendMail({
    from: FROM,
    to:   booking.customer_email,
    subject: `🔄 Booking Rescheduled — ${booking.confirmation_code}`,
    html,
  });
}

export async function sendBookingCancellation(booking, serviceName) {
  const dateStr = format(new Date(`${booking.booking_date}T00:00`), 'EEEE, MMMM d, yyyy');

  const html = baseTemplate('Booking Cancelled', '#EF4444', `
    <div class="header" style="background:#EF4444;">
      <h1>❌ Booking Cancelled</h1>
      <p>Your appointment has been cancelled</p>
    </div>
    <div class="body">
      <p style="font-size:16px;color:#374151;">Hi <strong>${booking.customer_name}</strong>,</p>
      <p style="color:#6b7280;">Your booking with <strong>${serviceName}</strong> has been cancelled.</p>

      <div class="detail-row">
        <div class="detail-icon">📋</div>
        <div><div class="detail-label">Service</div><div class="detail-value">${booking.service_name}</div></div>
      </div>
      <div class="detail-row">
        <div class="detail-icon">📅</div>
        <div><div class="detail-label">Was scheduled for</div><div class="detail-value">${dateStr} at ${booking.booking_time.substring(0,5)}</div></div>
      </div>
      <div class="detail-row">
        <div class="detail-icon">🔑</div>
        <div><div class="detail-label">Reference</div><div class="detail-value">${booking.confirmation_code}</div></div>
      </div>

      <div class="whatsapp-note">
        💬 Want to book again? Just WhatsApp us and say <strong>Hi</strong> to get started!
      </div>
    </div>
  `);

  return transporter.sendMail({
    from: FROM,
    to:   booking.customer_email,
    subject: `❌ Booking Cancelled — ${booking.confirmation_code}`,
    html,
  });
}

export async function sendAdminBookingAlert(booking, adminEmail) {
  const dateStr = format(new Date(`${booking.booking_date}T00:00`), 'EEEE, MMMM d, yyyy');

  return transporter.sendMail({
    from: FROM,
    to:   adminEmail,
    subject: `🆕 New Booking — ${booking.confirmation_code} (${booking.customer_name})`,
    html: baseTemplate('New Booking Alert', '#25D366', `
      <div class="header">
        <h1>🆕 New Booking!</h1>
        <p>A new booking was made through WhatsApp</p>
      </div>
      <div class="body">
        <div class="detail-row"><div class="detail-icon">👤</div><div><div class="detail-label">Customer</div><div class="detail-value">${booking.customer_name}</div></div></div>
        <div class="detail-row"><div class="detail-icon">📱</div><div><div class="detail-label">Phone</div><div class="detail-value">${booking.customer_phone}</div></div></div>
        <div class="detail-row"><div class="detail-icon">📧</div><div><div class="detail-label">Email</div><div class="detail-value">${booking.customer_email || 'Not provided'}</div></div></div>
        <div class="detail-row"><div class="detail-icon">📋</div><div><div class="detail-label">Service</div><div class="detail-value">${booking.service_name}</div></div></div>
        <div class="detail-row"><div class="detail-icon">📅</div><div><div class="detail-label">Date & Time</div><div class="detail-value">${dateStr} at ${booking.booking_time.substring(0,5)}</div></div></div>
        <div class="detail-row"><div class="detail-icon">🔑</div><div><div class="detail-label">Reference</div><div class="detail-value">${booking.confirmation_code}</div></div></div>
      </div>
    `),
  });
}

export { transporter };
