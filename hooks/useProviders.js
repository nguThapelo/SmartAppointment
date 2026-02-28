import { useQuery } from '@tanstack/react-query';
import { apiInstance } from '@/library/apiClient';
import { useAuth } from '@/hooks/useAuth';

export const useProviders = ({ category, subService }) => {
  const { isAuthenticated, loading } = useAuth();

  return useQuery({
    queryKey: ['providers', category, subService],
    enabled: !loading && isAuthenticated,
    queryFn: async () => {
      const response = await apiInstance.get('/api/providers', {
        params: {
          category,
          subService,
        },
      });

      return response.data || [];
    },
  });
};
