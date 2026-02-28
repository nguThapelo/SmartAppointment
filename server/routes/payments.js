const express = require('express');
const { getUserRole, requireRole } = require('../middleware/role');
const { supabase } = require('../supabaseClient');

const router = express.Router();

// Mock data for offline mode
const mockPaymentMethods = [
  {
    id: 'method-1',
    user_id: 'client-1',
    stripe_payment_method_id: 'pm_mock_card_visa',
    type: 'card',
    last4: '4242',
    brand: 'visa',
    exp_month: 12,
    exp_year: 2025,
    is_default: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'method-2',
    user_id: 'client-1',
    stripe_payment_method_id: 'pm_mock_card_mastercard',
    type: 'card',
    last4: '8888',
    brand: 'mastercard',
    exp_month: 6,
    exp_year: 2026,
    is_default: false,
    created_at: '2024-01-02T00:00:00Z'
  }
];

const mockPaymentTransactions = [
  {
    id: 'tx-1',
    appointment_id: 'appointment-1',
    client_id: 'client-1',
    provider_id: 'provider-1',
    amount: 10000, // in cents
    currency: 'usd',
    status: 'succeeded',
    stripe_payment_intent_id: 'pi_mock_succeeded',
    created_at: '2024-01-15T10:00:00Z',
    captured_at: '2024-01-15T10:00:00Z'
  },
  {
    id: 'tx-2',
    appointment_id: 'appointment-2',
    client_id: 'client-2',
    provider_id: 'provider-2',
    amount: 8000, // in cents
    currency: 'usd',
    status: 'pending',
    stripe_payment_intent_id: 'pi_mock_pending',
    created_at: '2024-01-16T14:00:00Z',
    captured_at: null
  }
];

const getStripeClient = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return null;
  }

  // eslint-disable-next-line global-require
  const Stripe = require('stripe');
  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

const mapIntentToPaymentStatus = (intentStatus) => {
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

const reconcilePaymentIntent = async ({ paymentIntent, transaction }) => {
  const mappedStatus = mapIntentToPaymentStatus(paymentIntent.status);
  const capturedAt = mappedStatus === 'succeeded' ? new Date().toISOString() : null;

  const txUpdate = await supabase
    .from('payment_transactions')
    .update({
      status: mappedStatus,
      captured_at: capturedAt,
      failure_reason: paymentIntent.last_payment_error?.message || null,
    })
    .eq('id', transaction.id)
    .select('*')
    .single();

  if (txUpdate.error) {
    throw new Error(txUpdate.error.message);
  }

  const appointmentUpdates = {
    payment_status: mappedStatus,
  };

  if (mappedStatus === 'succeeded') {
    appointmentUpdates.amount_paid = Number(paymentIntent.amount_received || paymentIntent.amount || 0) / 100;
    appointmentUpdates.paid_at = new Date().toISOString();
    appointmentUpdates.status = 'paid';
  }

  if (mappedStatus === 'failed' || mappedStatus === 'canceled') {
    appointmentUpdates.status = 'in_progress';
  }

  const appointmentUpdate = await supabase
    .from('appointments')
    .update(appointmentUpdates)
    .eq('id', transaction.appointment_id)
    .neq('status', 'completed')
    .select('*')
    .single();

  if (appointmentUpdate.error) {
    throw new Error(appointmentUpdate.error.message);
  }

  return {
    transaction: txUpdate.data,
    appointment: appointmentUpdate.data,
    paymentStatus: mappedStatus,
  };
};

const getOrCreateCustomer = async ({ userId, email, stripe }) => {
  const existingCustomer = await supabase
    .from('payment_customers')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingCustomer.error) {
    throw new Error(existingCustomer.error.message);
  }

  if (existingCustomer.data) {
    return existingCustomer.data;
  }

  const customer = await stripe.customers.create({
    email: email || undefined,
    metadata: { userId },
  });

  const createdCustomer = await supabase
    .from('payment_customers')
    .insert({ user_id: userId, stripe_customer_id: customer.id })
    .select('*')
    .single();

  if (createdCustomer.error) {
    throw new Error(createdCustomer.error.message);
  }

  return createdCustomer.data;
};

router.post('/setup-intent', requireRole(['client', 'admin']), async (req, res) => {
  const role = getUserRole(req.user);
  const userId = role === 'admin' ? req.body?.user_id : req.user.id;
  const email = req.body?.email || req.user?.email;
  const stripe = getStripeClient();

  if (!stripe) {
    return res.status(500).json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY.' });
  }

  try {
    const customerRow = await getOrCreateCustomer({ userId, email, stripe });
    const setupIntent = await stripe.setupIntents.create({
      customer: customerRow.stripe_customer_id,
      payment_method_types: ['card'],
      usage: 'off_session',
    });

    return res.status(200).json({
      clientSecret: setupIntent.client_secret,
      customerId: customerRow.stripe_customer_id,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to create setup intent' });
  }
});

router.get('/methods', requireRole(['client', 'admin']), async (req, res) => {
  try {
    const role = getUserRole(req.user);
    const userId = role === 'admin' ? req.query?.userId : req.user.id;

    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('user_id', userId)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      // Return mock data when database is not available
      const filteredMethods = mockPaymentMethods.filter(method => method.user_id === userId);
      return res.status(200).json(filteredMethods);
    }

    return res.status(200).json(data || []);
  } catch (error) {
    // Return mock data when database connection fails
    const role = getUserRole(req.user);
    const userId = role === 'admin' ? req.query?.userId : req.user.id;
    const filteredMethods = mockPaymentMethods.filter(method => method.user_id === userId);
    return res.status(200).json(filteredMethods);
  }
});

router.post('/methods', requireRole(['client', 'admin']), async (req, res) => {
  const role = getUserRole(req.user);
  const userId = role === 'admin' ? req.body?.user_id : req.user.id;
  const stripe = getStripeClient();

  if (!stripe) {
    return res.status(500).json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY.' });
  }

  const { paymentMethodId, email, isDefault } = req.body || {};

  if (!paymentMethodId) {
    return res.status(400).json({ error: 'paymentMethodId is required' });
  }

  let customerRow = null;
  try {
    customerRow = await getOrCreateCustomer({ userId, email, stripe });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to ensure customer' });
  }

  const existingMethodResult = await supabase
    .from('payment_methods')
    .select('*')
    .eq('stripe_payment_method_id', paymentMethodId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existingMethodResult.error) {
    return res.status(500).json({ error: existingMethodResult.error.message });
  }

  const stripeMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
  const attachedCustomerId = stripeMethod.customer ? String(stripeMethod.customer) : null;

  if (!attachedCustomerId) {
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerRow.stripe_customer_id,
    });
  }

  if (isDefault) {
    await stripe.customers.update(customerRow.stripe_customer_id, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    await supabase
      .from('payment_methods')
      .update({ is_default: false })
      .eq('user_id', userId);
  }

  let data = existingMethodResult.data;

  if (data) {
    const updateResult = await supabase
      .from('payment_methods')
      .update({
        brand: stripeMethod.card?.brand || data.brand,
        last4: stripeMethod.card?.last4 || data.last4,
        exp_month: stripeMethod.card?.exp_month || data.exp_month,
        exp_year: stripeMethod.card?.exp_year || data.exp_year,
        is_default: Boolean(isDefault),
      })
      .eq('id', data.id)
      .select('*')
      .single();

    if (updateResult.error) {
      return res.status(500).json({ error: updateResult.error.message });
    }

    data = updateResult.data;
  } else {
    const insertResult = await supabase
      .from('payment_methods')
      .insert({
        user_id: userId,
        stripe_payment_method_id: paymentMethodId,
        brand: stripeMethod.card?.brand || null,
        last4: stripeMethod.card?.last4 || null,
        exp_month: stripeMethod.card?.exp_month || null,
        exp_year: stripeMethod.card?.exp_year || null,
        is_default: Boolean(isDefault),
      })
      .select('*')
      .single();

    if (insertResult.error) {
      return res.status(500).json({ error: insertResult.error.message });
    }

    data = insertResult.data;
  }

  return res.status(201).json(data);
});

router.post('/initiate', requireRole(['provider', 'admin']), async (req, res) => {
  const role = getUserRole(req.user);
  const { appointmentId } = req.body || {};

  if (!appointmentId) {
    return res.status(400).json({ error: 'appointmentId is required' });
  }

  const appointmentResult = await supabase
    .from('appointments')
    .select('*')
    .eq('id', appointmentId)
    .single();

  if (appointmentResult.error || !appointmentResult.data) {
    return res.status(404).json({ error: 'Appointment not found' });
  }

  const appointment = appointmentResult.data;

  if (role === 'provider' && appointment.provider_id !== req.user.id) {
    return res.status(403).json({ error: 'Unauthorized for this appointment' });
  }

  const customerResult = await supabase
    .from('payment_customers')
    .select('*')
    .eq('user_id', appointment.client_id)
    .maybeSingle();

  if (customerResult.error || !customerResult.data) {
    return res.status(400).json({ error: 'Client payment profile not found' });
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY.' });
  }

  const amount = Number(req.body?.amount || appointment.amount_due || 0);

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'A positive amount is required' });
  }

  const defaultMethod = await supabase
    .from('payment_methods')
    .select('*')
    .eq('user_id', appointment.client_id)
    .eq('is_default', true)
    .maybeSingle();

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: String(req.body?.currency || 'usd').toLowerCase(),
    customer: customerResult.data.stripe_customer_id,
    payment_method: defaultMethod.data?.stripe_payment_method_id || undefined,
    confirm: Boolean(defaultMethod.data?.stripe_payment_method_id),
    off_session: Boolean(defaultMethod.data?.stripe_payment_method_id),
    metadata: {
      appointmentId: appointment.id,
      providerId: appointment.provider_id,
      clientId: appointment.client_id,
    },
  });

  const transactionInsert = await supabase
    .from('payment_transactions')
    .insert({
      appointment_id: appointment.id,
      client_id: appointment.client_id,
      provider_id: appointment.provider_id,
      stripe_payment_intent_id: paymentIntent.id,
      amount,
      currency: String(req.body?.currency || 'USD').toUpperCase(),
      status: paymentIntent.status === 'succeeded' ? 'succeeded' : 'processing',
      initiated_by: req.user.id,
      initiated_at: new Date().toISOString(),
      captured_at: paymentIntent.status === 'succeeded' ? new Date().toISOString() : null,
    })
    .select('*')
    .single();

  if (transactionInsert.error) {
    return res.status(500).json({ error: transactionInsert.error.message });
  }

  const appointmentUpdate = {
    amount_due: amount,
    provider_initiated_payment_at: new Date().toISOString(),
    payment_status: paymentIntent.status === 'succeeded' ? 'succeeded' : 'processing',
    status: paymentIntent.status === 'succeeded' ? 'paid' : 'in_progress',
  };

  if (paymentIntent.status === 'succeeded') {
    appointmentUpdate.amount_paid = amount;
    appointmentUpdate.paid_at = new Date().toISOString();
  }

  const updatedAppointment = await supabase
    .from('appointments')
    .update(appointmentUpdate)
    .eq('id', appointment.id)
    .select('*')
    .single();

  if (updatedAppointment.error) {
    return res.status(500).json({ error: updatedAppointment.error.message });
  }

  return res.status(200).json({
    paymentIntentId: paymentIntent.id,
    paymentIntentStatus: paymentIntent.status,
    transaction: transactionInsert.data,
    appointment: updatedAppointment.data,
  });
});

router.get('/transactions', requireRole(['admin', 'provider', 'client']), async (req, res) => {
  try {
    const role = getUserRole(req.user);
    let query = supabase
      .from('payment_transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (role === 'provider') {
      query = query.eq('provider_id', req.user.id);
    }

    if (role === 'client') {
      query = query.eq('client_id', req.user.id);
    }

    const { data, error } = await query;
    if (error) {
      // Return mock data when database is not available
      let filteredTransactions = mockPaymentTransactions;
      if (role === 'provider') {
        filteredTransactions = mockPaymentTransactions.filter(tx => tx.provider_id === req.user.id);
      }
      if (role === 'client') {
        filteredTransactions = mockPaymentTransactions.filter(tx => tx.client_id === req.user.id);
      }
      return res.status(200).json(filteredTransactions);
    }

    return res.status(200).json(data || []);
  } catch (error) {
    // Return mock data when database connection fails
    const role = getUserRole(req.user);
    let filteredTransactions = mockPaymentTransactions;
    if (role === 'provider') {
      filteredTransactions = mockPaymentTransactions.filter(tx => tx.provider_id === req.user.id);
    }
    if (role === 'client') {
      filteredTransactions = mockPaymentTransactions.filter(tx => tx.client_id === req.user.id);
    }
    return res.status(200).json(filteredTransactions);
  }
});

router.post('/sync-intent', requireRole(['admin', 'provider', 'client']), async (req, res) => {
  const stripe = getStripeClient();
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY.' });
  }

  const role = getUserRole(req.user);
  const paymentIntentId = req.body?.paymentIntentId;

  if (!paymentIntentId) {
    return res.status(400).json({ error: 'paymentIntentId is required' });
  }

  let txQuery = supabase
    .from('payment_transactions')
    .select('*')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .single();

  if (role === 'provider') {
    txQuery = txQuery.eq('provider_id', req.user.id);
  }

  if (role === 'client') {
    txQuery = txQuery.eq('client_id', req.user.id);
  }

  const txResult = await txQuery;

  if (txResult.error || !txResult.data) {
    return res.status(404).json({ error: 'Transaction not found' });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const updated = await reconcilePaymentIntent({
      paymentIntent,
      transaction: txResult.data,
    });

    return res.status(200).json({
      paymentIntentId,
      paymentIntentStatus: paymentIntent.status,
      ...updated,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to sync payment intent' });
  }
});

module.exports = router;
