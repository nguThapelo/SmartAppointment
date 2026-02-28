import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import AdminDashboard from '@/components/Dashboard/AdminDashboard';

const AdminOperations = () => {
  const router = useRouter();
  const { isAuthenticated, loading, actualRole } = useAuth();

  useEffect(() => {
    if (!loading && (!isAuthenticated || actualRole !== 'admin')) {
      router.replace('/Dashboard');
    }
  }, [isAuthenticated, loading, actualRole, router]);

  if (!isAuthenticated || actualRole !== 'admin') {
    return null;
  }

  return <AdminDashboard mode="operations" />;
};

export default AdminOperations;
