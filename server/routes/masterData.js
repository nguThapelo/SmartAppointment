const express = require('express');
const { requireRole } = require('../middleware/role');
const { supabase } = require('../supabaseClient');

const router = express.Router();

// Mock data for offline mode
const mockTypes = [
  {
    id: 'mock-type-1',
    code: 'STATUS',
    name: 'Appointment Status',
    description: 'Status values for appointments',
    is_active: true,
  }
];

const mockItems = [
  {
    id: 'mock-item-1',
    type_id: 'mock-type-1',
    code: 'APPROVED',
    name: 'Approved',
    description: 'Appointment has been approved',
    is_active: true,
  }
];

router.get('/types', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('master_data_types')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      // Return mock data when database is not available
      return res.status(200).json(mockTypes);
    }

    return res.status(200).json(data || []);
  } catch (error) {
    // Return mock data when database connection fails
    return res.status(200).json(mockTypes);
  }
});

router.post('/types', requireRole('admin'), async (req, res) => {
  const payload = {
    code: req.body?.code,
    name: req.body?.name,
    description: req.body?.description || null,
    is_active: req.body?.is_active ?? true,
  };

  const { data, error } = await supabase
    .from('master_data_types')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json(data);
});

router.put('/types/:id', requireRole('admin'), async (req, res) => {
  const { id } = req.params;

  const payload = {
    code: req.body?.code,
    name: req.body?.name,
    description: req.body?.description || null,
    is_active: req.body?.is_active,
  };

  const { data, error } = await supabase
    .from('master_data_types')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json(data);
});

router.delete('/types/:id', requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('master_data_types').delete().eq('id', id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(204).send();
});

router.get('/items', async (req, res) => {
  try {
    const { typeId } = req.query || {};

    let query = supabase
      .from('master_data_items')
      .select('*')
      .order('sort_order', { ascending: true });

    if (typeId) {
      query = query.eq('type_id', typeId);
    }

    const { data, error } = await query;

    if (error) {
      // Return mock data when database is not available
      return res.status(200).json(mockItems);
    }

    return res.status(200).json(data || []);
  } catch (error) {
    // Return mock data when database connection fails
    return res.status(200).json(mockItems);
  }
});

router.post('/items', requireRole('admin'), async (req, res) => {
  const payload = {
    type_id: req.body?.type_id,
    label: req.body?.label,
    value: req.body?.value,
    sort_order: req.body?.sort_order ?? 0,
    is_active: req.body?.is_active ?? true,
    metadata: req.body?.metadata || {},
  };

  const { data, error } = await supabase
    .from('master_data_items')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json(data);
});

router.put('/items/:id', requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const payload = {
    type_id: req.body?.type_id,
    label: req.body?.label,
    value: req.body?.value,
    sort_order: req.body?.sort_order ?? 0,
    is_active: req.body?.is_active,
    metadata: req.body?.metadata || {},
  };

  const { data, error } = await supabase
    .from('master_data_items')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json(data);
});

router.delete('/items/:id', requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('master_data_items').delete().eq('id', id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(204).send();
});

module.exports = router;
