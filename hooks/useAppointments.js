import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiInstance } from '@/library/apiClient';
import { supabase } from '@/library/supabaseClient';
import { useAuth } from '@/hooks/useAuth';

export const APPOINTMENTS_QUERY_KEY = ['appointments'];

const fetchAppointments = async () => {
  const response = await apiInstance.get('/api/appointments');
  return response.data || [];
};

export const useAppointments = () => {
  const queryClient = useQueryClient();
  const { user, role } = useAuth();

  const query = useQuery({
    queryKey: APPOINTMENTS_QUERY_KEY,
    queryFn: fetchAppointments,
    enabled: Boolean(user),
  });

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiInstance.post('/api/appointments', payload);
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APPOINTMENTS_QUERY_KEY }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }) => {
      const response = await apiInstance.put(`/api/appointments/${id}`, payload);
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APPOINTMENTS_QUERY_KEY }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await apiInstance.delete(`/api/appointments/${id}`);
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APPOINTMENTS_QUERY_KEY }),
  });

  const providerDecisionMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const response = await apiInstance.put(`/api/appointments/${id}/provider-decision`, { status });
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: APPOINTMENTS_QUERY_KEY }),
  });

  useEffect(() => {
    if (!user?.id) {
      return undefined;
    }

    const filterByRole =
      role === 'provider'
        ? `provider_id=eq.${user.id}`
        : role === 'client'
          ? `client_id=eq.${user.id}`
          : undefined;

    // Realtime invalidation keeps cards in sync across tabs and clients.
    const changesConfig = {
      event: '*',
      schema: 'public',
      table: 'appointments',
      ...(filterByRole ? { filter: filterByRole } : {}),
    };

    const channel = supabase
      .channel(`appointments:${user.id}`)
      .on('postgres_changes', changesConfig, () => {
        queryClient.invalidateQueries({ queryKey: APPOINTMENTS_QUERY_KEY });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user?.id, role]);

  return {
    ...query,
    createAppointment: createMutation.mutateAsync,
    updateAppointment: updateMutation.mutateAsync,
    deleteAppointment: deleteMutation.mutateAsync,
    providerDecision: providerDecisionMutation.mutateAsync,
    isSaving:
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending ||
      providerDecisionMutation.isPending,
  };
};
