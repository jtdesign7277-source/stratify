import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { initNewUser } from '../lib/initNewUser';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const initializedUsersRef = useRef(new Set());

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

  useEffect(() => {
    if (!user?.id) return;
    if (initializedUsersRef.current.has(user.id)) return;

    initializedUsersRef.current.add(user.id);

    const ensureUserInitialized = async () => {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('initialized')
          .eq('id', user.id)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          throw error;
        }

        if (profile?.initialized !== true) {
          await initNewUser(user.id);
        }
      } catch (error) {
        initializedUsersRef.current.delete(user.id);
        console.error('[Auth] Failed to initialize user profile:', error);
      }
    };

    ensureUserInitialized();
  }, [user?.id]);

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

  const updateProfile = async ({ full_name }) => {
    const { data, error } = await supabase.auth.updateUser({
      data: { full_name },
    });
    if (!error && data?.user) {
      setUser(data.user);
    }
    return { data, error };
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
      updateProfile,
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
