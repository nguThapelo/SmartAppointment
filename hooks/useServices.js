import { useQuery } from '@tanstack/react-query';
import { apiInstance } from '@/library/apiClient';
import { serviceCatalog } from '@/library/serviceCatalog';
import { useAuth } from '@/hooks/useAuth';

export const useServices = () => {
  const { isAuthenticated, loading } = useAuth();

  return useQuery({
    queryKey: ['services'],
    enabled: !loading && isAuthenticated,
    queryFn: async () => {
      try {
        const response = await apiInstance.get('/api/services');
        return response.data || serviceCatalog;
      } catch (_error) {
        return serviceCatalog;
      }
    },
  });
};
