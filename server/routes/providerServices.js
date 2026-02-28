const express = require('express');
const { getUserRole, requireRole } = require('../middleware/role');
const { supabase } = require('../supabaseClient');

const router = express.Router();

// Mock data for offline mode
const mockProviderServices = [
  {
    id: 'service-1',
    provider_id: 'provider-1',
    category_id: 'cat-1',
    sub_service_id: 'sub-1',
    pricing_type: 'fixed',
    rate: 100,
    currency: 'USD',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    service_categories: { id: 'cat-1', name: 'Medical' },
    service_sub_services: { id: 'sub-1', name: 'General Practice' }
  },
  {
    id: 'service-2',
    provider_id: 'provider-1',
    category_id: 'cat-1',
    sub_service_id: 'sub-2',
    pricing_type: 'hourly',
    rate: 150,
    currency: 'USD',
    is_active: true,
    created_at: '2024-01-02T00:00:00Z',
    service_categories: { id: 'cat-1', name: 'Medical' },
    service_sub_services: { id: 'sub-2', name: 'Cardiology' }
  },
  {
    id: 'service-3',
    provider_id: 'provider-2',
    category_id: 'cat-2',
    sub_service_id: 'sub-3',
    pricing_type: 'fixed',
    rate: 80,
    currency: 'USD',
    is_active: true,
    created_at: '2024-01-03T00:00:00Z',
    service_categories: { id: 'cat-2', name: 'Dental' },
    service_sub_services: { id: 'sub-3', name: 'General Dentistry' }
  }
];

router.get('/', requireRole(['provider', 'admin']), async (req, res) => {
  try {
    const role = getUserRole(req.user);
    const { providerId } = req.query || {};

    let query = supabase
      .from('provider_services')
      .select('*, service_categories(id,name), service_sub_services(id,name)')
      .order('created_at', { ascending: false });

    if (role === 'provider') {
      query = query.eq('provider_id', req.user.id);
    } else if (providerId) {
      query = query.eq('provider_id', providerId);
    }

    const { data, error } = await query;

    if (error) {
      // Return mock data when database is not available
      let filteredServices = mockProviderServices;
      if (role === 'provider') {
        filteredServices = mockProviderServices.filter(service => service.provider_id === req.user.id);
      } else if (providerId) {
        filteredServices = mockProviderServices.filter(service => service.provider_id === providerId);
      }
      return res.status(200).json(filteredServices);
    }

    return res.status(200).json(data || []);
  } catch (error) {
    // Return mock data when database connection fails
    const role = getUserRole(req.user);
    const { providerId } = req.query || {};
    let filteredServices = mockProviderServices;
    if (role === 'provider') {
      filteredServices = mockProviderServices.filter(service => service.provider_id === req.user.id);
    } else if (providerId) {
      filteredServices = mockProviderServices.filter(service => service.provider_id === providerId);
    }
    return res.status(200).json(filteredServices);
  }
});

router.post('/', requireRole(['provider', 'admin']), async (req, res) => {
  const role = getUserRole(req.user);

  const payload = {
    provider_id: role === 'provider' ? req.user.id : req.body?.provider_id,
    category_id: req.body?.category_id,
    sub_service_id: req.body?.sub_service_id || null,
    pricing_type: req.body?.pricing_type || 'fixed',
    rate: req.body?.rate,
    currency: req.body?.currency || 'USD',
    is_active: req.body?.is_active ?? true,
  };

  const { data, error } = await supabase
    .from('provider_services')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json(data);
});

router.put('/:id', requireRole(['provider', 'admin']), async (req, res) => {
  const { id } = req.params;
  const role = getUserRole(req.user);

  let ownershipQuery = supabase.from('provider_services').select('provider_id').eq('id', id).single();
  const ownershipResult = await ownershipQuery;

  if (ownershipResult.error || !ownershipResult.data) {
    return res.status(404).json({ error: 'Pricing entry not found' });
  }

  if (role === 'provider' && ownershipResult.data.provider_id !== req.user.id) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const payload = {
    category_id: req.body?.category_id,
    sub_service_id: req.body?.sub_service_id || null,
    pricing_type: req.body?.pricing_type,
    rate: req.body?.rate,
    currency: req.body?.currency,
    is_active: req.body?.is_active,
  };

  const { data, error } = await supabase
    .from('provider_services')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json(data);
});

router.delete('/:id', requireRole(['provider', 'admin']), async (req, res) => {
  const { id } = req.params;
  const role = getUserRole(req.user);

  const ownershipResult = await supabase
    .from('provider_services')
    .select('provider_id')
    .eq('id', id)
    .single();

  if (ownershipResult.error || !ownershipResult.data) {
    return res.status(404).json({ error: 'Pricing entry not found' });
  }

  if (role === 'provider' && ownershipResult.data.provider_id !== req.user.id) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const { error } = await supabase.from('provider_services').delete().eq('id', id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(204).send();
});

module.exports = router;
