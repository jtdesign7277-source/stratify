import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!isMounted) return;
        setSession(data?.session ?? null);
        setUser(data?.session?.user ?? null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadSession();

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      data?.subscription?.unsubscribe();
    };
  }, []);

  const signIn = async ({ email, password }) => {
    setLoading(true);
    const result = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    return result;
  };

  const signUp = async ({ email, password, full_name, referral }) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name,
          referral,
        },
      },
    });

    const userId = data?.user?.id ?? data?.session?.user?.id;
    let profileError = null;

    if (!error && userId) {
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert(
          {
            id: userId,
            email,
            full_name: full_name || null,
            referral: referral || null,
            created_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
      profileError = upsertError;
    }

    setLoading(false);
    return { data, error: error || profileError };
  };

  const signOut = async () => {
    setLoading(true);
    const result = await supabase.auth.signOut();
    setLoading(false);
    return result;
  };

  const value = useMemo(
    () => ({
      session,
      user,
      isAuthenticated: Boolean(user),
      loading,
      signIn,
      signUp,
      signOut,
    }),
    [session, user, loading]
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
