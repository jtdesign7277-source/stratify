import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const STORAGE_KEY = 'stratify-trade-history';
const PROFILE_COLUMN = 'trade_history';
const USER_STATE_KEY = 'trade_history';

const normalizeSymbol = (value) => {
  if (!value) return null;
  const raw = typeof value === 'object' ? (value.symbol ?? value.ticker ?? value.Symbol) : value;
  const normalized = String(raw || '').trim().toUpperCase();
  return normalized ? normalized : null;
};

const normalizeSide = (value) => {
  const raw = String(value ?? '').trim().toLowerCase();
  if (['buy', 'long', 'open'].includes(raw)) return 'buy';
  if (['sell', 'short', 'close'].includes(raw)) return 'sell';
  return null;
};

const normalizeStrategyId = (value) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
};

const normalizeTimestamp = (value) => {
  if (Number.isFinite(value)) return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `trade_${Date.now()}_${Math.random().toString(16).slice(2)}`;
};

const normalizeTrade = (trade, { preserveMeta = false } = {}) => {
  if (!trade || typeof trade !== 'object') return null;

  const symbol = normalizeSymbol(trade.symbol ?? trade.ticker ?? trade.Symbol);
  const rawShares = Number(trade.shares ?? trade.qty ?? trade.quantity ?? trade.size ?? trade.amount ?? 0);
  const price = Number(
    trade.price ?? trade.fillPrice ?? trade.avgPrice ?? trade.executionPrice ?? trade.cost ?? trade.limitPrice,
  );

  if (!symbol || !Number.isFinite(rawShares) || rawShares === 0) return null;
  if (!Number.isFinite(price) || price <= 0) return null;

  let side = normalizeSide(trade.side ?? trade.type ?? trade.action);
  if (!side) {
    side = rawShares < 0 ? 'sell' : 'buy';
  }

  const shares = Math.abs(rawShares);
  if (rawShares < 0 && side === 'buy') {
    side = 'sell';
  }

  const id = preserveMeta
    ? (String(trade.id ?? trade.tradeId ?? '').trim() || generateId())
    : generateId();
  const timestamp = preserveMeta
    ? (normalizeTimestamp(trade.timestamp ?? trade.time ?? trade.date) ?? Date.now())
    : Date.now();

  const total = shares * price;
  const strategyId = normalizeStrategyId(
    trade.strategyId ?? trade.strategyID ?? trade.strategy ?? trade.strategy_id,
  );

  const normalized = {
    id,
    symbol,
    side,
    shares,
    price,
    total,
    timestamp,
  };

  if (strategyId) {
    normalized.strategyId = strategyId;
  }

  return normalized;
};

const sanitizeTrades = (list) => {
  if (!Array.isArray(list)) return [];
  const next = [];

  list.forEach((item) => {
    const normalized = normalizeTrade(item, { preserveMeta: true });
    if (normalized) next.push(normalized);
  });

  return next;
};

const getStorageKey = (userId) => (userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY);

const loadTradesFromStorage = (userId) => {
  if (typeof window === 'undefined') return [];

  const keys = userId ? [getStorageKey(userId), STORAGE_KEY] : [STORAGE_KEY];
  for (const key of keys) {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) continue;
      const parsed = JSON.parse(stored);
      const list = Array.isArray(parsed) ? parsed : (parsed?.trades ?? parsed?.history ?? []);
      const sanitized = sanitizeTrades(list);
      if (sanitized.length > 0) return sanitized;
    } catch {
      // Ignore malformed storage payloads.
    }
  }
  return [];
};

const saveTradesToStorage = (trades, userId) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(trades));
  } catch {
    // Ignore storage write errors (private mode, quota, SSR).
  }
};

const isMissingColumnError = (error, columnName) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes(columnName.toLowerCase()) && message.includes('column');
};

export const useTradeHistory = ({ onApplyTrade } = {}) => {
  const [trades, setTrades] = useState(() => loadTradesFromStorage(null));
  const [userId, setUserId] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const saveTimer = useRef(null);
  const lastSaved = useRef('');

  const saveToUserState = useCallback(async (targetUserId, payload, serializedPayload) => {
    if (!targetUserId || !supabase) return false;

    const profileLookup = await supabase
      .from('profiles')
      .select('user_state')
      .eq('id', targetUserId)
      .maybeSingle();

    if (profileLookup.error) {
      if (!isMissingColumnError(profileLookup.error, 'user_state')) {
        console.warn('[TradeHistorySync] Save error:', profileLookup.error.message);
      }
      return false;
    }

    const existingState = profileLookup.data?.user_state && typeof profileLookup.data.user_state === 'object'
      ? profileLookup.data.user_state
      : {};

    const nextUserState = {
      ...existingState,
      [USER_STATE_KEY]: payload,
    };

    const { error } = await supabase
      .from('profiles')
      .update({
        user_state: nextUserState,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetUserId);

    if (error) {
      console.warn('[TradeHistorySync] Save error:', error.message);
      return false;
    }

    lastSaved.current = serializedPayload;
    return true;
  }, []);

  const saveToSupabase = useCallback(async (targetUserId, payload, serializedPayload) => {
    if (!targetUserId || !supabase) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          [PROFILE_COLUMN]: payload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetUserId);

      if (error) {
        if (isMissingColumnError(error, PROFILE_COLUMN)) {
          await saveToUserState(targetUserId, payload, serializedPayload);
          return;
        }
        console.warn('[TradeHistorySync] Save error:', error.message);
        return;
      }

      lastSaved.current = serializedPayload;
    } catch (error) {
      console.warn('[TradeHistorySync] Save failed:', error);
    }
  }, [saveToUserState]);

  useEffect(() => {
    if (!supabase) {
      setLoaded(true);
      return undefined;
    }

    let cancelled = false;

    const syncAuth = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!cancelled) {
          setUserId(data?.user?.id || null);
        }
      } catch {
        if (!cancelled) setUserId(null);
      }
    };

    syncAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setUserId(session?.user?.id || null);
    });

    return () => {
      cancelled = true;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId || !supabase) {
      const localTrades = loadTradesFromStorage(null);
      setTrades(localTrades);
      lastSaved.current = JSON.stringify(localTrades);
      setLoaded(true);
      return;
    }

    let cancelled = false;

    const loadFromSupabase = async () => {
      setLoaded(false);
      const localTrades = loadTradesFromStorage(userId);

      try {
        let profileData = null;
        const query = await supabase
          .from('profiles')
          .select(`${PROFILE_COLUMN}, user_state`)
          .eq('id', userId)
          .maybeSingle();

        if (query.error) {
          if (!isMissingColumnError(query.error, PROFILE_COLUMN)) {
            console.warn('[TradeHistorySync] Load error:', query.error.message);
          }

          const fallback = await supabase
            .from('profiles')
            .select('user_state')
            .eq('id', userId)
            .maybeSingle();

          if (fallback.error) {
            console.warn('[TradeHistorySync] Fallback load error:', fallback.error.message);
            profileData = null;
          } else {
            profileData = fallback.data;
          }
        } else {
          profileData = query.data;
        }

        const remoteList = Array.isArray(profileData?.[PROFILE_COLUMN])
          ? profileData[PROFILE_COLUMN]
          : (Array.isArray(profileData?.user_state?.[USER_STATE_KEY])
            ? profileData.user_state[USER_STATE_KEY]
            : []);

        const remoteTrades = sanitizeTrades(remoteList);
        const useLocal = remoteTrades.length === 0 && localTrades.length > 0;
        const resolved = useLocal ? localTrades : remoteTrades;

        if (cancelled) return;

        setTrades(resolved);
        saveTradesToStorage(resolved, userId);
        const serialized = JSON.stringify(resolved);
        lastSaved.current = serialized;

        if (useLocal) {
          saveToSupabase(userId, resolved, serialized);
        }
      } catch (error) {
        if (cancelled) return;
        console.warn('[TradeHistorySync] Load failed:', error);
        setTrades(localTrades);
        saveTradesToStorage(localTrades, userId);
        lastSaved.current = JSON.stringify(localTrades);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };

    loadFromSupabase();

    return () => {
      cancelled = true;
    };
  }, [userId, saveToSupabase]);

  useEffect(() => {
    saveTradesToStorage(trades, userId);
    if (!loaded) return;

    const serialized = JSON.stringify(trades);
    if (serialized === lastSaved.current) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (!userId || !supabase) {
        lastSaved.current = serialized;
        return;
      }
      saveToSupabase(userId, trades, serialized);
    }, 1400);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [trades, userId, loaded, saveToSupabase]);

  const addTrade = useCallback(
    (trade) => {
      const normalized = normalizeTrade(trade);
      if (!normalized) return null;

      setTrades((prev) => [...prev, normalized]);

      if (typeof onApplyTrade === 'function') {
        onApplyTrade(normalized);
      }

      return normalized;
    },
    [onApplyTrade],
  );

  return {
    trades,
    addTrade,
    loaded,
  };
};

