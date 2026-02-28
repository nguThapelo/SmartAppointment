const express = require('express');
const { supabase } = require('../supabaseClient');

const router = express.Router();

// Mock data for offline mode
const mockProviders = [
  {
    id: 'provider-1',
    email: 'john.doe@example.com',
    firstName: 'John',
    lastName: 'Doe',
    services: [
      { category: 'Medical', subService: 'General Practice' },
      { category: 'Medical', subService: 'Cardiology' }
    ]
  },
  {
    id: 'provider-2',
    email: 'jane.smith@example.com',
    firstName: 'Jane',
    lastName: 'Smith',
    services: [
      { category: 'Dental', subService: 'General Dentistry' },
      { category: 'Dental', subService: 'Orthodontics' }
    ]
  },
  {
    id: 'provider-3',
    email: 'mike.johnson@example.com',
    firstName: 'Mike',
    lastName: 'Johnson',
    services: [
      { category: 'Therapy', subService: 'Physical Therapy' },
      { category: 'Therapy', subService: 'Massage Therapy' }
    ]
  }
];

router.get('/', async (req, res) => {
  try {
    const { category, subService } = req.query;
    const usersResult = await supabase.auth.admin.listUsers();

    if (usersResult.error) {
      // Return mock data when database is not available
      let filteredProviders = mockProviders;
      if (category || subService) {
        filteredProviders = mockProviders.filter(provider => {
          return provider.services.some(service => {
            const categoryMatch = category ? service.category === category : true;
            const subServiceMatch = subService ? service.subService === subService : true;
            return categoryMatch && subServiceMatch;
          });
        });
      }
      return res.status(200).json(filteredProviders);
    }

    const users = usersResult.data?.users || [];

    const providers = users
      .filter((user) => (user.user_metadata?.role || user.app_metadata?.role) === 'provider')
      .filter((user) => {
        if (!category && !subService) {
          return true;
        }

        const offered = user.user_metadata?.services || [];
        return offered.some((service) => {
          const categoryMatch = category ? service?.category === category : true;
          const subServiceMatch = subService ? service?.subService === subService : true;
          return categoryMatch && subServiceMatch;
        });
      })
      .map((user) => ({
        id: user.id,
        email: user.email,
        firstName: user.user_metadata?.firstName || '',
        lastName: user.user_metadata?.lastName || '',
        services: user.user_metadata?.services || [],
      }));

    return res.status(200).json(providers);
  } catch (_error) {
    // Return mock data when database connection fails
    let filteredProviders = mockProviders;
    if (req.query.category || req.query.subService) {
      filteredProviders = mockProviders.filter(provider => {
        return provider.services.some(service => {
          const categoryMatch = req.query.category ? service.category === req.query.category : true;
          const subServiceMatch = req.query.subService ? service.subService === req.query.subService : true;
          return categoryMatch && subServiceMatch;
        });
      });
    }
    return res.status(200).json(filteredProviders);
  }
});

module.exports = router;
