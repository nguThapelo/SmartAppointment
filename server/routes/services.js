const express = require('express');
const { serviceCatalog } = require('../data/serviceCatalog');
const { requireRole } = require('../middleware/role');
const { supabase } = require('../supabaseClient');

const router = express.Router();

const normalizeRow = (row) => ({
  id: row.id,
  name: row.name,
  subServices: row.sub_services || [],
});

router.get('/', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('service_categories')
      .select('id,name,sub_services')
      .order('name', { ascending: true });

    if (error) {
      return res.status(200).json(serviceCatalog);
    }

    if (!data?.length) {
      return res.status(200).json(serviceCatalog);
    }

    return res.status(200).json(data.map(normalizeRow));
  } catch (_error) {
    return res.status(200).json(serviceCatalog);
  }
});

router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const payload = {
      name: req.body?.name,
      sub_services: req.body?.subServices || [],
    };

    const { data, error } = await supabase
      .from('service_categories')
      .insert(payload)
      .select('id,name,sub_services')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json(normalizeRow(data));
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to create service category' });
  }
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const payload = {
      name: req.body?.name,
      sub_services: req.body?.subServices || [],
    };

    const { data, error } = await supabase
      .from('service_categories')
      .update(payload)
      .eq('id', id)
      .select('id,name,sub_services')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json(normalizeRow(data));
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to update service category' });
  }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('service_categories')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(204).send();
  } catch (_error) {
    return res.status(500).json({ error: 'Failed to delete service category' });
  }
});

module.exports = router;
