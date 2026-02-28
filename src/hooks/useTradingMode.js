import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { isCreatorOverrideUser, isProStatus, normalizeSubscriptionStatus } from '../lib/subscriptionAccess';
import { clearAlpacaCache } from '../services/alpacaService';

const STORAGE_KEY = 'stratify-trading-mode';
const MODE_EVENT = 'stratify:trading-mode-changed';
const SWITCH_EVENT = 'stratify:trading-mode-switched';
const CACHE_CLEAR_EVENT = 'stratify:broker-cache-cleared';
const PAPER_MODE = 'paper';
const LIVE_MODE = 'live';

const normalizeMode = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === LIVE_MODE ? LIVE_MODE : PAPER_MODE;
};

const isMissingColumnError = (error, columnName) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes(String(columnName).toLowerCase()) && message.includes('column');
};

const readStoredMode = () => {
  if (typeof window === 'undefined') return PAPER_MODE;
  try {
    return normalizeMode(localStorage.getItem(STORAGE_KEY));
  } catch {
    return PAPER_MODE;
  }
};

const persistStoredMode = (mode) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, normalizeMode(mode));
  } catch {
    // Ignore localStorage write errors.
  }
};

const emitWindowEvent = (eventName, detail) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
};

const normalizeUserState = (value) => (value && typeof value === 'object' ? value : {});

export default function useTradingMode() {
  const [tradingMode, setTradingMode] = useState(() => readStoredMode());
  const [userId, setUserId] = useState(null);
  const [isCreatorOverride, setIsCreatorOverride] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState('free');
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState(null);

  const applyMode = useCallback((nextMode, { persist = true, broadcast = true } = {}) => {
    const normalized = normalizeMode(nextMode);
    setTradingMode((previousMode) => {
      if (previousMode === normalized) return previousMode;
      return normalized;
    });

    if (persist) persistStoredMode(normalized);
    if (broadcast) {
      emitWindowEvent(MODE_EVENT, { mode: normalized });
    }
    return normalized;
  }, []);

  const clearCachedBrokerData = useCallback(() => {
    clearAlpacaCache();
    emitWindowEvent(CACHE_CLEAR_EVENT, { clearedAt: Date.now() });
  }, []);

  const loadProfileState = useCallback(async (targetUserId) => {
    if (!targetUserId) {
      setLoading(false);
      setSubscriptionStatus('free');
      applyMode(readStoredMode(), { persist: true, broadcast: false });
      return;
    }

    setLoading(true);
    setError(null);

    const primary = await supabase
      .from('profiles')
      .select('trading_mode, subscription_status')
      .eq('id', targetUserId)
      .maybeSingle();

    if (primary.error) {
      if (isMissingColumnError(primary.error, 'trading_mode')) {
        const fallback = await supabase
          .from('profiles')
          .select('subscription_status')
          .eq('id', targetUserId)
          .maybeSingle();

        if (fallback.error) {
          setError(fallback.error);
          setLoading(false);
          return;
        }

        setSubscriptionStatus(normalizeSubscriptionStatus(fallback.data?.subscription_status || 'free'));
        applyMode(PAPER_MODE, { persist: true, broadcast: false });
        setLoading(false);
        return;
      }

      setError(primary.error);
      setLoading(false);
      return;
    }

    const profileMode = normalizeMode(primary.data?.trading_mode || readStoredMode());
    const profileSubscription = normalizeSubscriptionStatus(primary.data?.subscription_status || 'free');

    applyMode(profileMode, { persist: true, broadcast: false });
    setSubscriptionStatus(profileSubscription);
    setLoading(false);
  }, [applyMode]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;

      const nextUser = session?.user ?? null;
      const nextUserId = nextUser?.id || null;
      setUserId(nextUserId);
      setIsCreatorOverride(isCreatorOverrideUser(nextUser));
      await loadProfileState(nextUserId);
    };

    bootstrap();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return;
      const nextUser = session?.user ?? null;
      const nextUserId = nextUser?.id || null;
      setUserId(nextUserId);
      setIsCreatorOverride(isCreatorOverrideUser(nextUser));
      await loadProfileState(nextUserId);
    });

    return () => {
      cancelled = true;
      authListener?.subscription?.unsubscribe();
    };
  }, [loadProfileState]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const onStorage = (event) => {
      if (event.key !== STORAGE_KEY) return;
      const nextMode = normalizeMode(event.newValue);
      setTradingMode(nextMode);
    };

    const onModeEvent = (event) => {
      const nextMode = normalizeMode(event?.detail?.mode);
      setTradingMode(nextMode);
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener(MODE_EVENT, onModeEvent);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(MODE_EVENT, onModeEvent);
    };
  }, []);

  useEffect(() => {
    if (!userId) return undefined;

    const channel = supabase
      .channel(`profiles-trading-mode-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const nextMode = normalizeMode(payload?.new?.trading_mode || PAPER_MODE);
          const nextStatus = normalizeSubscriptionStatus(payload?.new?.subscription_status || subscriptionStatus || 'free');
          applyMode(nextMode, { persist: true, broadcast: false });
          setSubscriptionStatus(nextStatus);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [applyMode, subscriptionStatus, userId]);

  const switchTradingMode = useCallback(async (nextMode, { source = 'ui' } = {}) => {
    const targetMode = normalizeMode(nextMode);
    const previousMode = normalizeMode(tradingMode);

    if (targetMode === previousMode) {
      return { ok: true, changed: false, mode: previousMode };
    }

    if (targetMode === LIVE_MODE && !isCreatorOverride && !isProStatus(subscriptionStatus)) {
      return {
        ok: false,
        changed: false,
        mode: previousMode,
        reason: 'upgrade_required',
      };
    }

    setSwitching(true);
    setError(null);

    applyMode(targetMode, { persist: true, broadcast: true });
    clearCachedBrokerData();

    if (!userId) {
      emitWindowEvent(SWITCH_EVENT, {
        previousMode,
        nextMode: targetMode,
        switchedAt: new Date().toISOString(),
        source,
      });
      setSwitching(false);
      return { ok: true, changed: true, mode: targetMode };
    }

    const switchedAt = new Date().toISOString();

    const profileLookup = await supabase
      .from('profiles')
      .select('user_state')
      .eq('id', userId)
      .maybeSingle();

    let userState = {};
    if (!profileLookup.error) {
      userState = normalizeUserState(profileLookup.data?.user_state);
      const previousSwitches = Array.isArray(userState.trading_mode_switches)
        ? userState.trading_mode_switches
        : [];
      userState.trading_mode_switches = [
        {
          from: previousMode,
          to: targetMode,
          switched_at: switchedAt,
          source,
        },
        ...previousSwitches,
      ].slice(0, 200);
    }

    let update = await supabase
      .from('profiles')
      .update({
        trading_mode: targetMode,
        user_state: userState,
        updated_at: switchedAt,
      })
      .eq('id', userId);

    if (update.error && isMissingColumnError(update.error, 'user_state')) {
      update = await supabase
        .from('profiles')
        .update({
          trading_mode: targetMode,
          updated_at: switchedAt,
        })
        .eq('id', userId);
    }

    if (update.error) {
      setError(update.error);
      applyMode(previousMode, { persist: true, broadcast: true });
      setSwitching(false);
      return { ok: false, changed: false, mode: previousMode, reason: 'persist_failed', error: update.error };
    }

    emitWindowEvent(SWITCH_EVENT, {
      previousMode,
      nextMode: targetMode,
      switchedAt,
      source,
    });

    setSwitching(false);
    return { ok: true, changed: true, mode: targetMode };
  }, [applyMode, clearCachedBrokerData, isCreatorOverride, subscriptionStatus, tradingMode, userId]);

  const refreshTradingMode = useCallback(async () => {
    if (!userId) return;
    await loadProfileState(userId);
  }, [loadProfileState, userId]);

  const state = useMemo(() => {
    const isPaper = tradingMode === PAPER_MODE;
    const isLive = tradingMode === LIVE_MODE;
    const isProUser = isCreatorOverride || isProStatus(subscriptionStatus);
    return {
      tradingMode,
      isPaper,
      isLive,
      loading,
      switching,
      error,
      isProUser,
      subscriptionStatus,
      hasCreatorOverride: isCreatorOverride,
      canUseLiveTrading: isProUser,
      switchTradingMode,
      refreshTradingMode,
      clearCachedBrokerData,
    };
  }, [
    clearCachedBrokerData,
    error,
    loading,
    refreshTradingMode,
    isCreatorOverride,
    subscriptionStatus,
    switchTradingMode,
    switching,
    tradingMode,
  ]);

  return state;
}

export const tradingModeConstants = {
  PAPER_MODE,
  LIVE_MODE,
  STORAGE_KEY,
};
