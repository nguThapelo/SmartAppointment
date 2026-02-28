const { supabase } = require('../supabaseClient');

const getStripeClient = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return null;
  }

  // eslint-disable-next-line global-require
  const Stripe = require('stripe');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

const mapPaymentStatus = (intentStatus) => {
  if (intentStatus === 'succeeded') {
    return 'succeeded';
  }

  if (intentStatus === 'canceled') {
    return 'canceled';
  }

  if (intentStatus === 'requires_payment_method') {
    return 'failed';
  }

  if (intentStatus === 'processing') {
    return 'processing';
  }

  return 'pending';
};

const paymentsWebhookHandler = async (req, res) => {
  const stripe = getStripeClient();

  if (!stripe) {
    return res.status(500).json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY.' });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(500).json({ error: 'Missing STRIPE_WEBHOOK_SECRET' });
  }

  const signature = req.headers['stripe-signature'];
  if (!signature) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return res.status(400).json({ error: `Webhook signature verification failed: ${error.message}` });
  }

  const relevantEvents = new Set([
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
    'payment_intent.canceled',
    'payment_intent.processing',
  ]);

  if (!relevantEvents.has(event.type)) {
    return res.status(200).json({ received: true, ignored: event.type });
  }

  const paymentIntent = event.data.object;
  const mappedStatus = mapPaymentStatus(paymentIntent.status);

  const transactionResult = await supabase
    .from('payment_transactions')
    .update({
      status: mappedStatus,
      captured_at: mappedStatus === 'succeeded' ? new Date().toISOString() : null,
      failure_reason: paymentIntent.last_payment_error?.message || null,
    })
    .eq('stripe_payment_intent_id', paymentIntent.id)
    .select('*')
    .maybeSingle();

  if (transactionResult.error) {
    return res.status(500).json({ error: transactionResult.error.message });
  }

  const transaction = transactionResult.data;

  if (!transaction) {
    return res.status(200).json({ received: true, warning: 'No local transaction found for payment intent' });
  }

  const isSucceeded = mappedStatus === 'succeeded';
  const isFailed = mappedStatus === 'failed' || mappedStatus === 'canceled';

  const appointmentUpdates = {
    payment_status: mappedStatus,
  };

  if (isSucceeded) {
    appointmentUpdates.amount_paid = Number(paymentIntent.amount_received || paymentIntent.amount || 0) / 100;
    appointmentUpdates.paid_at = new Date().toISOString();
    appointmentUpdates.status = 'paid';
  }

  if (isFailed) {
    appointmentUpdates.status = 'in_progress';
  }

  const appointmentUpdateResult = await supabase
    .from('appointments')
    .update(appointmentUpdates)
    .eq('id', transaction.appointment_id)
    .neq('status', 'completed')
    .select('id,status,payment_status')
    .single();

  if (appointmentUpdateResult.error) {
    return res.status(500).json({ error: appointmentUpdateResult.error.message });
  }

  return res.status(200).json({ received: true, eventType: event.type });
};

module.exports = paymentsWebhookHandler;
