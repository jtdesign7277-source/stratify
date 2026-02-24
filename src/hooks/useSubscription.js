import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { withTimeout } from '../lib/withTimeout';

const SUBSCRIPTION_CHECK_TIMEOUT_MS = 5000;
const PRO_STATUSES = new Set(['pro', 'elite', 'active', 'trialing', 'paid']);
const SUBSCRIPTION_STATUS_CACHE_PREFIX = 'stratify-subscription-status:';

const readCachedSubscriptionStatus = (userId) => {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${SUBSCRIPTION_STATUS_CACHE_PREFIX}${userId}`);
    if (!raw) return null;
    const normalized = String(raw).toLowerCase();
    return normalized || null;
  } catch {
    return null;
  }
};

const writeCachedSubscriptionStatus = (userId, status) => {
  if (!userId || !status || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${SUBSCRIPTION_STATUS_CACHE_PREFIX}${userId}`, String(status).toLowerCase());
  } catch {
    // ignore cache write failures
  }
};

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

      const normalizedStatus = String(data?.subscription_status ?? 'free').toLowerCase();
      setSubscriptionStatus(normalizedStatus);
      writeCachedSubscriptionStatus(userId, normalizedStatus);
    } catch (fetchError) {
      console.error('[Subscription] Failed to fetch subscription status:', fetchError);
      setError(fetchError);
      const cachedStatus = readCachedSubscriptionStatus(userId);
      setSubscriptionStatus(cachedStatus);
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
        const cachedStatus = readCachedSubscriptionStatus(currentUser?.id);
        if (cachedStatus) {
          setSubscriptionStatus(cachedStatus);
        }
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
      const cachedStatus = readCachedSubscriptionStatus(nextUser?.id);
      setSubscriptionStatus(cachedStatus);
      fetchSubscription(nextUser?.id);
    });

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, [fetchSubscription, loadUser, userOverride]);

  useEffect(() => {
    if (!user?.id) return undefined;

    const channel = supabase
      .channel(`subscription-profile-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const nextStatus = String(payload?.new?.subscription_status || 'free').toLowerCase();
          setSubscriptionStatus(nextStatus);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const isProUser = PRO_STATUSES.has(String(subscriptionStatus || '').toLowerCase());

  return {
    subscriptionStatus,
    isProUser,
    loading,
    error,
    refetch,
  };
}
