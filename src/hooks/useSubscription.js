import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { withTimeout } from '../lib/withTimeout';

const SUBSCRIPTION_CHECK_TIMEOUT_MS = 5000;

const withSubscriptionTimeout = (promise, operationName) =>
  withTimeout(
    promise,
    SUBSCRIPTION_CHECK_TIMEOUT_MS,
    `[Subscription] ${operationName} timed out after ${SUBSCRIPTION_CHECK_TIMEOUT_MS}ms`
  );

export default function useSubscription(userOverride) {
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

    try {
      const { data, error: fetchError } = await withSubscriptionTimeout(
        supabase
          .from('profiles')
          .select('subscription_status')
          .eq('id', userId)
          .single(),
        'Subscription status lookup'
      );

      if (fetchError) {
        throw fetchError;
      }

      setSubscriptionStatus(data?.subscription_status ?? 'free');
    } catch (fetchError) {
      console.error('[Subscription] Failed to fetch subscription status:', fetchError);
      setError(fetchError);
      setSubscriptionStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUser = useCallback(async () => {
    if (typeof userOverride !== 'undefined') {
      const nextUser = userOverride ?? null;
      setUser(nextUser);
      return nextUser;
    }

    try {
      const { data, error: userError } = await withSubscriptionTimeout(
        supabase.auth.getUser(),
        'Current user lookup'
      );

      if (userError) {
        throw userError;
      }

      const nextUser = data?.user ?? null;
      setUser(nextUser);
      return nextUser;
    } catch (userError) {
      console.error('[Subscription] Failed to load user during subscription check:', userError);
      setError(userError);
      setUser(null);
      return null;
    }
  }, [userOverride]);

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
      setLoading(true);
      setError(null);
      const currentUser = await loadUser();
      if (isMounted) {
        await fetchSubscription(currentUser?.id);
      }
    };

    init();

    if (typeof userOverride !== 'undefined') {
      return () => {
        isMounted = false;
      };
    }

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
  }, [fetchSubscription, loadUser, userOverride]);

  const isProUser = subscriptionStatus === 'pro' || subscriptionStatus === 'elite';

  return {
    subscriptionStatus,
    isProUser,
    loading,
    error,
    refetch,
  };
}
