import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function useSubscription() {
  const [user, setUser] = useState(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSubscription = useCallback(async (userId) => {
    if (!userId) {
      setSubscriptionStatus(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select('subscription_status')
      .eq('id', userId)
      .single();

    if (fetchError) {
      setError(fetchError);
      setSubscriptionStatus(null);
    } else {
      setSubscriptionStatus(data?.subscription_status ?? 'free');
    }

    setLoading(false);
  }, []);

  const loadUser = useCallback(async () => {
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError) {
      setError(userError);
    }
    setUser(data?.user ?? null);
    return data?.user ?? null;
  }, []);

  const refetch = useCallback(async () => {
    if (!user?.id) {
      setSubscriptionStatus(null);
      return;
    }
    await fetchSubscription(user.id);
  }, [fetchSubscription, user?.id]);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      const currentUser = await loadUser();
      if (isMounted) {
        await fetchSubscription(currentUser?.id);
      }
    };

    init();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      fetchSubscription(nextUser?.id);
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, [fetchSubscription, loadUser]);

  const isProUser = subscriptionStatus === 'pro' || subscriptionStatus === 'elite';

  return {
    subscriptionStatus,
    isProUser,
    loading,
    error,
    refetch,
  };
}
