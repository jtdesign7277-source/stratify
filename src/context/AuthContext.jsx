import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import supabase from '../lib/supabase';

const AuthContext = createContext(null);

const buildFallbackProfile = (user) => ({
  first_name: user?.user_metadata?.first_name || '',
  email: user?.email || '',
  avatar_url: user?.user_metadata?.avatar_url || '',
  subscription_plan: user?.user_metadata?.subscription_plan || 'Paper',
});

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);

  // If Supabase isn't configured, just render children without auth
  if (!supabase) {
    const noopValue = {
      user: null,
      session: null,
      loading: false,
      signIn: async () => ({ data: null, error: new Error('Supabase not configured') }),
      signUp: async () => ({ data: null, error: new Error('Supabase not configured') }),
      signOut: async () => ({ error: null }),
      updateProfile: async () => ({ data: null, error: new Error('Supabase not configured') }),
    };
    return (
      <AuthContext.Provider value={noopValue}>
        {children}
      </AuthContext.Provider>
    );
  }

  const loadProfile = useCallback(async (authUser) => {
    if (!authUser) {
      setProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('first_name, email, avatar_url, subscription_plan')
      .eq('id', authUser.id)
      .single();

    if (error || !data) {
      setProfile(buildFallbackProfile(authUser));
      return;
    }

    setProfile({
      first_name: data.first_name || '',
      email: data.email || authUser.email || '',
      avatar_url: data.avatar_url || '',
      subscription_plan: data.subscription_plan || 'Paper',
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initSession = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        if (!isMounted) return;
        const nextSession = data?.session ?? null;
        const nextUser = nextSession?.user ?? null;
        setSession(nextSession);
        setUser(nextUser);
        if (nextUser) {
          await loadProfile(nextUser);
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error('Auth init error:', err);
      }
      setLoading(false);
    };

    initSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!isMounted) return;
      const nextUser = nextSession?.user ?? null;
      setSession(nextSession);
      setUser(nextUser);
      if (nextUser) {
        await loadProfile(nextUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async ({ email, password }) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      return { data: null, error };
    }
    setSession(data.session ?? null);
    setUser(data.user ?? null);
    if (data.user) {
      await loadProfile(data.user);
    }
    setLoading(false);
    return { data, error: null };
  }, [loadProfile]);

  const signUp = useCallback(async ({ email, password, first_name }) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name },
      },
    });

    if (error) {
      setLoading(false);
      return { data: null, error };
    }

    const nextUser = data.user ?? null;
    setSession(data.session ?? null);
    setUser(nextUser);

    if (nextUser) {
      await supabase
        .from('profiles')
        .upsert({
          id: nextUser.id,
          first_name: first_name || '',
          email: email || nextUser.email || '',
          avatar_url: '',
          subscription_plan: 'Paper',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
      await loadProfile(nextUser);
    }

    setLoading(false);
    return { data, error: null };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    setLoading(false);
    return { error };
  }, []);

  const updateProfile = useCallback(async (updates) => {
    if (!user) {
      return { data: null, error: new Error('No authenticated user') };
    }

    const payload = {
      id: user.id,
      first_name: updates.first_name ?? profile?.first_name ?? '',
      email: updates.email ?? profile?.email ?? user.email ?? '',
      avatar_url: updates.avatar_url ?? profile?.avatar_url ?? '',
      subscription_plan: updates.subscription_plan ?? profile?.subscription_plan ?? 'Paper',
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select('first_name, email, avatar_url, subscription_plan')
      .single();

    if (!error) {
      setProfile({
        first_name: data?.first_name ?? payload.first_name,
        email: data?.email ?? payload.email,
        avatar_url: data?.avatar_url ?? payload.avatar_url,
        subscription_plan: data?.subscription_plan ?? payload.subscription_plan,
      });
    }

    return { data, error };
  }, [profile, user]);

  const value = useMemo(() => ({
    user: user ? { ...user, profile } : null,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
  }), [loading, profile, session, signIn, signOut, signUp, updateProfile, user]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('AuthProvider is missing. Wrap your component tree in <AuthProvider>.');
  }
  return context;
};

export default AuthContext;
