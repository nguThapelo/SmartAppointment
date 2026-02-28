import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/hooks/useAuth';
import AdminDashboard from '@/components/Dashboard/AdminDashboard';
import ProviderDashboard from '@/components/Dashboard/ProviderDashboard';
import ClientDashboard from '@/components/Dashboard/ClientDashboard';

const Dashboard = () => {
  const router = useRouter();
  const { isAuthenticated, loading, role } = useAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/Login');
    }
  }, [isAuthenticated, loading, router]);

  if (!isAuthenticated) {
    return null;
  }

  if (role === 'admin') {
    return <AdminDashboard mode="dashboard" />;
  }

  if (role === 'provider') {
    return <ProviderDashboard />;
  }

  return <ClientDashboard />;
};

export default Dashboard;
