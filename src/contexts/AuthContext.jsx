import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    // If supabase isn't configured, skip auth
    if (!supabase) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const initializeSession = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        if (isMounted) {
          setUser(data?.session?.user ?? null);
          setLoading(false);
        }
      } catch (err) {
        console.error('Auth session error:', err);
        if (isMounted) setLoading(false);
      }
    };

    initializeSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signUp = async (email, password) => {
    if (!supabase) return { error: { message: 'Supabase not configured' } };
    setAuthLoading(true);
    const result = await supabase.auth.signUp({ email, password });
    setAuthLoading(false);
    return result;
  };

  const signIn = async (email, password) => {
    if (!supabase) return { error: { message: 'Supabase not configured' } };
    setAuthLoading(true);
    const result = await supabase.auth.signInWithPassword({ email, password });
    setAuthLoading(false);
    return result;
  };

  const signOut = async () => {
    if (!supabase) return { error: { message: 'Supabase not configured' } };
    setAuthLoading(true);
    const result = await supabase.auth.signOut();
    setAuthLoading(false);
    return result;
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      authLoading,
      signUp,
      signIn,
      signOut,
    }),
    [user, loading, authLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
