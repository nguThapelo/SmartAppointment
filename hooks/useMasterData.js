import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiInstance } from '@/library/apiClient';
import { useAuth } from '@/hooks/useAuth';

const TYPES_KEY = ['master-data-types'];
const ITEMS_KEY = ['master-data-items'];

export const useMasterData = (typeId) => {
  const queryClient = useQueryClient();
  const { isAuthenticated, loading } = useAuth();

  const typesQuery = useQuery({
    queryKey: TYPES_KEY,
    enabled: !loading && isAuthenticated,
    queryFn: async () => {
      const response = await apiInstance.get('/api/master-data/types');
      return response.data || [];
    },
  });

  const itemsQuery = useQuery({
    queryKey: [...ITEMS_KEY, typeId || 'all'],
    enabled: !loading && isAuthenticated,
    queryFn: async () => {
      const response = await apiInstance.get('/api/master-data/items', {
        params: typeId ? { typeId } : undefined,
      });
      return response.data || [];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: TYPES_KEY });
    queryClient.invalidateQueries({ queryKey: ITEMS_KEY });
  };

  const createType = useMutation({
    mutationFn: async (payload) => {
      const response = await apiInstance.post('/api/master-data/types', payload);
      return response.data;
    },
    onSuccess: invalidate,
  });

  const updateType = useMutation({
    mutationFn: async ({ id, payload }) => {
      const response = await apiInstance.put(`/api/master-data/types/${id}`, payload);
      return response.data;
    },
    onSuccess: invalidate,
  });

  const deleteType = useMutation({
    mutationFn: async (id) => apiInstance.delete(`/api/master-data/types/${id}`),
    onSuccess: invalidate,
  });

  const createItem = useMutation({
    mutationFn: async (payload) => {
      const response = await apiInstance.post('/api/master-data/items', payload);
      return response.data;
    },
    onSuccess: invalidate,
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, payload }) => {
      const response = await apiInstance.put(`/api/master-data/items/${id}`, payload);
      return response.data;
    },
    onSuccess: invalidate,
  });

  const deleteItem = useMutation({
    mutationFn: async (id) => apiInstance.delete(`/api/master-data/items/${id}`),
    onSuccess: invalidate,
  });

  return {
    types: typesQuery.data || [],
    items: itemsQuery.data || [],
    isLoading: typesQuery.isLoading || itemsQuery.isLoading,
    createType: createType.mutateAsync,
    updateType: updateType.mutateAsync,
    deleteType: deleteType.mutateAsync,
    createItem: createItem.mutateAsync,
    updateItem: updateItem.mutateAsync,
    deleteItem: deleteItem.mutateAsync,
    isSaving:
      createType.isPending ||
      updateType.isPending ||
      deleteType.isPending ||
      createItem.isPending ||
      updateItem.isPending ||
      deleteItem.isPending,
  };
};
