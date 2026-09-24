import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { config as dotenvConfig } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Load env files from project root
dotenvConfig({ path: resolve(root, '.env.local') });
dotenvConfig({ path: resolve(root, '.env') });

import { createRequire } from 'module';
import { createServer } from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';

const require = createRequire(import.meta.url);

// Next.js (CJS interop)
const next = require('next');

// Bootstrap route (CJS — promote first admin)
const bootstrapRouter = require('./routes/bootstrap.js');

// WhatsApp bot routes (all MJS)
import whatsappRouter         from './routes/whatsapp.mjs';
import botServicesRouter      from './routes/botServices.mjs';
import botBookingsRouter      from './routes/botBookings.mjs';
import botConversationsRouter from './routes/botConversations.mjs';
import businessHoursRouter    from './routes/businessHours.mjs';

const dev  = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT || 8000);

const nextApp = next({ dev, dir: root });
const handle  = nextApp.getRequestHandler();

nextApp.prepare().then(() => {
  const app        = express();
  const httpServer = createServer(app);

  // ── WhatsApp webhook — Twilio sends form-encoded data, no auth ────────────
  app.use('/api/whatsapp', express.urlencoded({ extended: false }), whatsappRouter);

  // ── Standard middleware ───────────────────────────────────────────────────
  app.use(express.json());
  app.use(cookieParser());

  // ── Bootstrap (promote first admin — disable once set up) ────────────────
  app.use('/api/bootstrap', bootstrapRouter);

  // ── WhatsApp bot admin API (JWT auth handled inside each router) ──────────
  app.use('/api/bot-services',      botServicesRouter);
  app.use('/api/bot-bookings',      botBookingsRouter);
  app.use('/api/bot-conversations', botConversationsRouter);
  app.use('/api/business-hours',    businessHoursRouter);

  // ── Next.js handles all page requests ────────────────────────────────────
  app.all('*', (req, res) => handle(req, res));

  httpServer.listen(port, () => {
    console.log(`\n🚀 WhatsApp Booking Bot ready → http://localhost:${port}`);
    console.log(`📱 Admin Dashboard            → http://localhost:${port}/bot`);
    console.log(`🔗 Webhook base               → http://localhost:${port}/api/whatsapp/webhook/<serviceId>\n`);
  });
}).catch((err) => {
  console.error('Server startup failed:', err);
  process.exit(1);
});
