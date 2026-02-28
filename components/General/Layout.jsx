import React from 'react';
import Navbar from '@/components/Navbar/Navbar';
import { useRouter } from 'next/router';
import AIAgentSidebar from '@/components/AI/AIAgentSidebar';

const Layout = ({ children }) => {
  const router = useRouter();
  const hideNavbar = router.pathname === '/Login' || router.pathname === '/Register';

  return (
    <div className="min-h-screen">
      {!hideNavbar && <Navbar />}
      <main className="app-shell">
        {children}
      </main>
      {!hideNavbar && <AIAgentSidebar />}
    </div>
  );
};

export default Layout;