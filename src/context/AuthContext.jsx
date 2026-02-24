import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { initNewUser } from '../lib/initNewUser';
import { withTimeout } from '../lib/withTimeout';

const AuthContext = createContext(null);
const SESSION_CHECK_TIMEOUT_MS = 12000;

const withSessionTimeout = (promise, operationName) =>
  withTimeout(
    promise,
    SESSION_CHECK_TIMEOUT_MS,
    `[Auth] ${operationName} timed out after ${SESSION_CHECK_TIMEOUT_MS}ms`
  );

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const initializedUsersRef = useRef(new Set());

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      try {
        const { data, error } = await withSessionTimeout(
          supabase.auth.getSession(),
          'Session check'
        );

        if (error) {
          throw error;
        }

        if (!isMounted) return;
        setSession(data?.session ?? null);
        setUser(data?.session?.user ?? null);
      } catch (error) {
        // Do not force-sign-out on transient failures or timeouts.
        // onAuthStateChange and subsequent checks can still recover the existing session.
        console.error('[Auth] Session check failed. Preserving current auth state:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
    });

    loadSession();

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
            paper_trading_balance: 100000,
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
