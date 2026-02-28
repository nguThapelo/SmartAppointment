import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiInstance } from '@/library/apiClient';

const QUERY_KEY = ['provider-services'];

export const useProviderServices = () => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const response = await apiInstance.get('/api/provider-services');
      return response.data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiInstance.post('/api/provider-services', payload);
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const response = await apiInstance.put(`/api/provider-services/${id}`, payload);
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await apiInstance.delete(`/api/provider-services/${id}`);
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  return {
    data: query.data || [],
    isLoading: query.isLoading,
    createProviderService: createMutation.mutateAsync,
    updateProviderService: updateMutation.mutateAsync,
    deleteProviderService: deleteMutation.mutateAsync,
    isSaving: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
};
