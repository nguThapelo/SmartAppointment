import { createContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/library/supabaseClient';
import { apiInstance, setAuthToken } from '@/library/apiClient';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [impersonatedUser, setImpersonatedUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) {
        return;
      }
      setSession(data.session || null);
      setUser(data.session?.user || null);
      setAuthToken(data.session?.access_token);
      setLoading(false);
    };

    initSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
      setUser(nextSession?.user || null);
      setImpersonatedUser(null);
      setAuthToken(nextSession?.access_token);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async ({ email, password }) => {
    return supabase.auth.signInWithPassword({ email, password });  };

  const signUp = async ({ email, password, metadata }) => {
    const safeMetadata = {
      role: metadata?.role || 'client',
      services: metadata?.services || [],
      ...metadata,
    };

    return supabase.auth.signUp({
      email,
      password,
      options: { data: safeMetadata },
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setAuthToken(null);
  };

  const resetPassword = async (email) => {
    return apiInstance.post('/api/auth/forgot-password', { email });
  };

  const updatePassword = async (password) => {
    return supabase.auth.updateUser({ password });
  };

  const updateProfile = async (profileData) => {
    return supabase.auth.updateUser({ data: profileData });
  };

  const impersonateUser = (nextUser) => {
    if (!nextUser) {
      return;
    }

    setImpersonatedUser(nextUser);
  };

  const stopImpersonation = () => {
    setImpersonatedUser(null);
  };

  const actualRole = user?.user_metadata?.role || user?.app_metadata?.role || 'client';
  const effectiveUser = impersonatedUser || user;
  const effectiveRole = effectiveUser?.user_metadata?.role || effectiveUser?.app_metadata?.role || 'client';
//   console.log('AuthContext - User:', effectiveUser?.email, 'Effective Role:', effectiveRole);

  const value = useMemo(
    () => ({
      session,
      user: effectiveUser,
      actualUser: user,
      loading,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
      updateProfile,
      impersonateUser,
      stopImpersonation,
      isImpersonating: Boolean(impersonatedUser),
      impersonatedUser,
      isAuthenticated: Boolean(user),
      role: effectiveRole,
      actualRole,
    }),
    [session, user, effectiveUser, loading, impersonatedUser, effectiveRole, actualRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
