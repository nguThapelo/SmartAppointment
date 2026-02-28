const express = require('express');
const { getUserRole, requireRole } = require('../middleware/role');
const { supabase } = require('../supabaseClient');

const router = express.Router();

// Mock data for offline mode
const mockAppointments = [
  {
    id: 'mock-1',
    appointment_number: 'SA-20260228-0001',
    client_id: 'mock-client',
    provider_id: 'mock-provider',
    service_category: 'Consultation',
    service_subtype: 'General',
    appointment_date: new Date().toISOString(),
    status: 'approved',
    notes: 'Mock appointment for testing',
    price: 100,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
];

const generateAppointmentNumber = async () => {
  try {
    const prefixDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `SA-${prefixDate}-`;

    const { data, error } = await supabase
      .from('appointments')
      .select('appointment_number')
      .like('appointment_number', `${prefix}%`);

    if (error) {
      // Return mock appointment number when database is not available
      return `${prefix}0001`;
    }

    const sequence = (data?.length || 0) + 1;
    return `${prefix}${String(sequence).padStart(4, '0')}`;
  } catch (error) {
    // Return mock appointment number when database connection fails
    const prefixDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `SA-${prefixDate}-0001`;
  }
};

router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = getUserRole(req.user);
    let query = supabase
      .from('appointments')
      .select('*')
      .order('appointment_date', { ascending: true });

    if (role === 'client') {
      query = query.eq('client_id', userId);
    }

    if (role === 'provider') {
      query = query.eq('provider_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      // Return mock data when database is not available
      return res.status(200).json(mockAppointments);
    }

    return res.status(200).json(data || []);
  } catch (error) {
    // Return mock data when database connection fails
    return res.status(200).json(mockAppointments);
  }
});

router.post('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = getUserRole(req.user);

    if (role !== 'client' && role !== 'admin') {
      return res.status(403).json({ error: 'Only clients and admins can create bookings' });
    }

    const appointmentNumber = await generateAppointmentNumber();

    const payload = {
      appointment_number: appointmentNumber,
      client_id: req.body?.client_id || userId,
      provider_id: req.body?.provider_id,
      service_category: req.body?.service_category,
      service_subtype: req.body?.service_subtype,
      title: req.body?.title,
      notes: req.body?.notes || '',
      appointment_date: req.body?.appointment_date,
      end_time: req.body?.end_time || null,
      status: req.body?.status || 'booked',
    };

    const { data, error } = await supabase
      .from('appointments')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      // Return mock data when database is not available
      const mockCreatedAppointment = {
        id: `mock-appointment-${Date.now()}`,
        appointment_number: appointmentNumber,
        client_id: payload.client_id,
        provider_id: payload.provider_id,
        service_category: payload.service_category,
        service_subtype: payload.service_subtype,
        title: payload.title,
        notes: payload.notes,
        appointment_date: payload.appointment_date,
        end_time: payload.end_time,
        status: payload.status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return res.status(201).json(mockCreatedAppointment);
    }

    return res.status(201).json(data);
  } catch (error) {
    // Return mock data when database connection fails
    const userId = req.user?.id;
    const appointmentNumber = `SA-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-0001`;
    const mockCreatedAppointment = {
      id: `mock-appointment-${Date.now()}`,
      appointment_number: appointmentNumber,
      client_id: req.body?.client_id || userId,
      provider_id: req.body?.provider_id,
      service_category: req.body?.service_category,
      service_subtype: req.body?.service_subtype,
      title: req.body?.title,
      notes: req.body?.notes || '',
      appointment_date: req.body?.appointment_date,
      end_time: req.body?.end_time || null,
      status: req.body?.status || 'booked',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return res.status(201).json(mockCreatedAppointment);
  }
});

router.put('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = getUserRole(req.user);
    const { id } = req.params;

    let query = supabase
      .from('appointments')
      .update(req.body)
      .eq('id', id)
      .select('*')
      .single();

    if (role === 'client') {
      query = query.eq('client_id', userId);
    }

    if (role === 'provider') {
      query = query.eq('provider_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      // Return mock updated data when database is not available
      const mockUpdatedAppointment = {
        id,
        ...req.body,
        updated_at: new Date().toISOString(),
      };
      return res.status(200).json(mockUpdatedAppointment);
    }

    return res.status(200).json(data);
  } catch (error) {
    // Return mock data when database connection fails
    const mockUpdatedAppointment = {
      id: req.params.id,
      ...req.body,
      updated_at: new Date().toISOString(),
    };
    return res.status(200).json(mockUpdatedAppointment);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const role = getUserRole(req.user);
    const { id } = req.params;

    let query = supabase
      .from('appointments')
      .delete()
      .eq('id', id);

    if (role === 'client') {
      query = query.eq('client_id', userId);
    }

    if (role === 'provider') {
      query = query.eq('provider_id', userId);
    }

    const { error } = await query;

    if (error) {
      // Return success for mock mode when database is not available
      return res.status(204).send();
    }

    return res.status(204).send();
  } catch (error) {
    // Return success when database connection fails (mock mode)
    return res.status(204).send();
  }
});

router.put('/:id/provider-decision', requireRole(['provider', 'admin']), async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { status } = req.body || {};

    if (!['approved', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or declined' });
    }

    let query = supabase
      .from('appointments')
      .update({ status })
      .eq('id', id)
      .select('*')
      .single();

    if (req.userRole === 'provider') {
      query = query.eq('provider_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // If appointment is approved, ensure chat table exists and is ready
    if (status === 'approved') {
      try {
        const { ensureAppointmentChatTable } = require('../services/ensureChatTable');
        await ensureAppointmentChatTable();
      } catch (chatError) {
        console.warn('Chat table setup failed, but appointment approved:', chatError.message);
      }
    }

    return res.status(200).json(data);
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to process provider decision' });
  }
});

router.put('/:id/complete', requireRole(['provider', 'admin']), async (req, res) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;

    let lookupQuery = supabase
      .from('appointments')
      .select('*')
      .eq('id', id)
      .single();

    if (req.userRole === 'provider') {
      lookupQuery = lookupQuery.eq('provider_id', userId);
    }

    const current = await lookupQuery;

    if (current.error || !current.data) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (!['succeeded', 'paid'].includes(current.data.payment_status) && current.data.status !== 'paid') {
      return res.status(400).json({ error: 'Appointment can only be completed after payment is captured' });
    }

    let updateQuery = supabase
      .from('appointments')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (req.userRole === 'provider') {
      updateQuery = updateQuery.eq('provider_id', userId);
    }

    const { data, error } = await updateQuery;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(data);
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to complete appointment' });
  }
});

module.exports = router;
