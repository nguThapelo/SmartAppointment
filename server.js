require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const express = require('express');
const { createServer } = require('http');
const next = require('next');
const cookieParser = require('cookie-parser');
const passport = require('./server/passport');
const appointmentsRouter = require('./server/routes/appointments');
const authRouter = require('./server/routes/auth');
const servicesRouter = require('./server/routes/services');
const providersRouter = require('./server/routes/providers');
const adminRouter = require('./server/routes/admin');
const aiRouter = require('./server/routes/ai');
const bootstrapRouter = require('./server/routes/bootstrap');
const masterDataRouter = require('./server/routes/masterData');
const providerServicesRouter = require('./server/routes/providerServices');
const paymentsRouter = require('./server/routes/payments');
const paymentsWebhookHandler = require('./server/routes/paymentsWebhook');
const feedbackRouter = require('./server/routes/feedback');
const chatRouter = require('./server/routes/chat');
const { createChatSocketServer } = require('./server/socket/chatSocket');
const { ensureAppointmentChatTable } = require('./server/services/ensureChatTable');
const {
  requestEncryptionMiddleware,
  validateCSRFToken,
  issueCSRFToken,
} = require('./server/middleware/security');

const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT || 8000);
const app = next({ dev });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const server = express();
    const httpServer = createServer(server);

    // Stripe webhook must receive raw body for signature verification.
    server.post('/api/payments/webhook', express.raw({ type: 'application/json' }), paymentsWebhookHandler);

    server.use(express.json());
    server.use(cookieParser());
    server.use(passport.initialize());

    server.get('/api/security/csrf', issueCSRFToken);

    // One-time bootstrap route for first admin promotion.
    // Keep mounted before API security middleware to allow cURL/postman use during setup.
    server.use('/api/bootstrap', bootstrapRouter);

    server.use('/api', requestEncryptionMiddleware, validateCSRFToken);

    server.use('/api/auth', authRouter);

    server.use(
      '/api/services',
      passport.authenticate('supabase-bearer', { session: false }),
      servicesRouter
    );

    server.use(
      '/api/providers',
      passport.authenticate('supabase-bearer', { session: false }),
      providersRouter
    );

    server.use(
      '/api/appointments',
      passport.authenticate('supabase-bearer', { session: false }),
      appointmentsRouter
    );

    server.use(
      '/api/admin',
      passport.authenticate('supabase-bearer', { session: false }),
      adminRouter
    );

    server.use(
      '/api/master-data',
      passport.authenticate('supabase-bearer', { session: false }),
      masterDataRouter
    );

    server.use(
      '/api/provider-services',
      passport.authenticate('supabase-bearer', { session: false }),
      providerServicesRouter
    );

    server.use(
      '/api/payments',
      passport.authenticate('supabase-bearer', { session: false }),
      paymentsRouter
    );

    server.use(
      '/api/feedback',
      passport.authenticate('supabase-bearer', { session: false }),
      feedbackRouter
    );

    server.use(
      '/api/ai',
      passport.authenticate('supabase-bearer', { session: false }),
      aiRouter
    );

    server.use(
      '/api/chat',
      passport.authenticate('supabase-bearer', { session: false }),
      chatRouter
    );

    // Let Next.js process all page and API requests not handled above.
    server.all('*', (req, res) => handle(req, res));

    createChatSocketServer(httpServer);

    ensureAppointmentChatTable().catch((error) => {
      // eslint-disable-next-line no-console
      console.warn('Chat table ensure skipped/failed:', error?.message || error);
    });

    httpServer.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`> Ready on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Server startup failed', error);
    process.exit(1);
  });
