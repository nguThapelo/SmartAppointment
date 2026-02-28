import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiInstance } from '@/library/apiClient';
import { useAuth } from '@/hooks/useAuth';

const SETS_KEY = ['feedback-question-sets'];
const RESPONSES_KEY = ['feedback-responses'];

export const useFeedback = (questionSetId) => {
  const queryClient = useQueryClient();
  const { isAuthenticated, loading } = useAuth();

  const setsQuery = useQuery({
    queryKey: SETS_KEY,
    enabled: !loading && isAuthenticated,
    queryFn: async () => {
      const response = await apiInstance.get('/api/feedback/question-sets');
      return response.data || [];
    },
  });

  const questionsQuery = useQuery({
    queryKey: ['feedback-questions', questionSetId || 'none'],
    enabled: !loading && isAuthenticated,
    queryFn: async () => {
      if (!questionSetId) {
        return [];
      }
      const response = await apiInstance.get('/api/feedback/questions', {
        params: { questionSetId },
      });
      return response.data || [];
    },
  });

  const responsesQuery = useQuery({
    queryKey: RESPONSES_KEY,
    enabled: !loading && isAuthenticated,
    queryFn: async () => {
      const response = await apiInstance.get('/api/feedback/responses');
      return response.data || [];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: SETS_KEY });
    queryClient.invalidateQueries({ queryKey: RESPONSES_KEY });
    queryClient.invalidateQueries({ queryKey: ['feedback-questions'] });
  };

  const createSet = useMutation({
    mutationFn: async (payload) => {
      const response = await apiInstance.post('/api/feedback/question-sets', payload);
      return response.data;
    },
    onSuccess: invalidate,
  });

  const createQuestion = useMutation({
    mutationFn: async (payload) => {
      const response = await apiInstance.post('/api/feedback/questions', payload);
      return response.data;
    },
    onSuccess: invalidate,
  });

  const submitResponse = useMutation({
    mutationFn: async (payload) => {
      const response = await apiInstance.post('/api/feedback/responses', payload);
      return response.data;
    },
    onSuccess: invalidate,
  });

  return {
    questionSets: setsQuery.data || [],
    questions: questionsQuery.data || [],
    responses: responsesQuery.data || [],
    isLoading: setsQuery.isLoading || questionsQuery.isLoading || responsesQuery.isLoading,
    createQuestionSet: createSet.mutateAsync,
    createQuestion: createQuestion.mutateAsync,
    submitFeedbackResponse: submitResponse.mutateAsync,
    isSaving: createSet.isPending || createQuestion.isPending || submitResponse.isPending,
  };
};
