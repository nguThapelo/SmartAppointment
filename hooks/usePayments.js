import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiInstance } from '@/library/apiClient';
import { useAuth } from '@/hooks/useAuth';

const METHODS_KEY = ['payment-methods'];
const TRANSACTIONS_KEY = ['payment-transactions'];

export const usePayments = () => {
  const queryClient = useQueryClient();
  const { isAuthenticated, loading } = useAuth();

  const methodsQuery = useQuery({
    queryKey: METHODS_KEY,
    enabled: !loading && isAuthenticated,
    queryFn: async () => {
      const response = await apiInstance.get('/api/payments/methods');
      return response.data || [];
    },
  });

  const transactionsQuery = useQuery({
    queryKey: TRANSACTIONS_KEY,
    enabled: !loading && isAuthenticated,
    queryFn: async () => {
      const response = await apiInstance.get('/api/payments/transactions');
      return response.data || [];
    },
  });

  const createSetupIntent = useMutation({
    mutationFn: async (payload) => {
      const response = await apiInstance.post('/api/payments/setup-intent', payload || {});
      return response.data;
    },
  });

  const addMethod = useMutation({
    mutationFn: async (payload) => {
      const response = await apiInstance.post('/api/payments/methods', payload);
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: METHODS_KEY }),
  });

  const initiatePayment = useMutation({
    mutationFn: async (payload) => {
      const response = await apiInstance.post('/api/payments/initiate', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRANSACTIONS_KEY });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  const syncPaymentIntent = useMutation({
    mutationFn: async (paymentIntentId) => {
      const response = await apiInstance.post('/api/payments/sync-intent', { paymentIntentId });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRANSACTIONS_KEY });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  return {
    methods: methodsQuery.data || [],
    transactions: transactionsQuery.data || [],
    isLoading: methodsQuery.isLoading || transactionsQuery.isLoading,
    addPaymentMethod: addMethod.mutateAsync,
    createSetupIntent: createSetupIntent.mutateAsync,
    initiatePayment: initiatePayment.mutateAsync,
    syncPaymentIntent: syncPaymentIntent.mutateAsync,
    isSaving:
      addMethod.isPending ||
      initiatePayment.isPending ||
      createSetupIntent.isPending ||
      syncPaymentIntent.isPending,
  };
};
