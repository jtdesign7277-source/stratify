import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const STORAGE_KEY = 'stratify-portfolio';
const DEFAULT_CASH = 100000;
const PROFILE_COLUMN = 'portfolio_state';
const USER_STATE_KEY = 'portfolio_state';

const normalizeSymbol = (value) => {
  if (!value) return null;
  const raw = typeof value === 'object' ? (value.symbol ?? value.ticker ?? value.Symbol) : value;
  const normalized = String(raw || '').trim().toUpperCase();
  return normalized ? normalized : null;
};

const sanitizePositions = (positions) => {
  if (!Array.isArray(positions)) return [];
  const next = [];
  const seen = new Set();

  positions.forEach((position) => {
    const symbol = normalizeSymbol(position?.symbol);
    const shares = Number(position?.shares);
    const avgCost = Number(position?.avgCost);

    if (!symbol || !Number.isFinite(shares) || shares <= 0) return;
    if (seen.has(symbol)) return;
    seen.add(symbol);
    next.push({
      symbol,
      shares,
      avgCost: Number.isFinite(avgCost) && avgCost > 0 ? avgCost : 0,
    });
  });

  return next;
};

const normalizePortfolioState = (value) => {
  const candidate = value && typeof value === 'object' ? value : {};
  const cash = Number(candidate.cash);
  return {
    cash: Number.isFinite(cash) ? cash : DEFAULT_CASH,
    positions: sanitizePositions(candidate.positions),
  };
};

const getStorageKey = (userId) => (userId ? `${STORAGE_KEY}:${userId}` : STORAGE_KEY);

const loadPortfolioFromStorage = (userId) => {
  if (typeof window === 'undefined') {
    return { cash: DEFAULT_CASH, positions: [] };
  }

  const keys = userId ? [getStorageKey(userId), STORAGE_KEY] : [STORAGE_KEY];
  for (const key of keys) {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) continue;
      const parsed = JSON.parse(stored);
      return normalizePortfolioState(parsed);
    } catch {
      // Ignore malformed local payloads.
    }
  }

  return { cash: DEFAULT_CASH, positions: [] };
};

const savePortfolioToStorage = (portfolioState, userId) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify({
      cash: portfolioState.cash,
      positions: portfolioState.positions,
    }));
  } catch {
    // Ignore storage write errors (private mode, quota, SSR).
  }
};

const parseTrade = (trade) => {
  if (!trade || typeof trade !== 'object') return null;

  const symbol = normalizeSymbol(trade.symbol ?? trade.ticker ?? trade.Symbol);
  const rawShares = Number(trade.shares ?? trade.qty ?? trade.quantity ?? trade.size ?? 0);
  const price = Number(
    trade.price ?? trade.fillPrice ?? trade.avgPrice ?? trade.executionPrice ?? trade.cost ?? trade.limitPrice,
  );

  if (!symbol || !Number.isFinite(rawShares) || rawShares === 0) return null;
  if (!Number.isFinite(price) || price <= 0) return null;

  let shares = rawShares;
  const side = String(trade.side ?? trade.type ?? trade.action ?? '').toLowerCase();
  if (side === 'buy' || side === 'long' || side === 'open') {
    shares = Math.abs(rawShares);
  } else if (side === 'sell' || side === 'short' || side === 'close') {
    shares = -Math.abs(rawShares);
  }

  return { symbol, shares, price };
};

const applyTradeToState = (state, trade) => {
  const parsed = parseTrade(trade);
  if (!parsed) return state;

  const { symbol, shares, price } = parsed;
  const positions = [...state.positions];
  const index = positions.findIndex((position) => position.symbol === symbol);
  const existing = index >= 0 ? positions[index] : null;

  if (shares > 0) {
    const cost = shares * price;
    const prevShares = existing?.shares ?? 0;
    const prevAvgCost = existing?.avgCost ?? 0;
    const nextShares = prevShares + shares;
    const nextAvgCost = nextShares > 0 ? ((prevShares * prevAvgCost) + cost) / nextShares : price;
    const nextPosition = { symbol, shares: nextShares, avgCost: nextAvgCost };

    if (index >= 0) {
      positions[index] = nextPosition;
    } else {
      positions.push(nextPosition);
    }

    return {
      cash: state.cash - cost,
      positions,
    };
  }

  if (!existing || existing.shares <= 0) return state;

  const sellShares = Math.min(Math.abs(shares), existing.shares);
  if (sellShares === 0) return state;

  const proceeds = sellShares * price;
  const remainingShares = existing.shares - sellShares;

  if (remainingShares <= 0) {
    positions.splice(index, 1);
  } else {
    positions[index] = { ...existing, shares: remainingShares };
  }

  return {
    cash: state.cash + proceeds,
    positions,
  };
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'APPLY_TRADE':
      return applyTradeToState(state, action.trade);
    case 'HYDRATE':
      return normalizePortfolioState(action.state);
    default:
      return state;
  }
};

const getQuote = (prices, symbol) => {
  if (!prices) return null;
  if (prices instanceof Map) {
    return prices.get(symbol) || prices.get(normalizeSymbol(symbol));
  }
  if (typeof prices === 'object') {
    return prices[symbol] || prices[normalizeSymbol(symbol)];
  }
  return null;
};

const getCurrentPrice = (quote, fallback) => {
  const raw = quote?.price ?? quote?.last ?? quote?.lastPrice ?? quote?.currentPrice;
  const price = Number(raw);
  if (Number.isFinite(price) && price > 0) return price;
  return Number.isFinite(fallback) ? fallback : 0;
};

const getDayChangePerShare = (quote, currentPrice) => {
  const change = Number(quote?.change);
  if (Number.isFinite(change)) return change;

  const open = Number(quote?.open);
  if (Number.isFinite(open) && Number.isFinite(currentPrice)) {
    return currentPrice - open;
  }

  return 0;
};

const isMissingColumnError = (error, columnName) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes(columnName.toLowerCase()) && message.includes('column');
};

const hasPortfolioData = (portfolioState) => {
  const state = normalizePortfolioState(portfolioState);
  return state.positions.length > 0 || Math.abs(state.cash - DEFAULT_CASH) > 0.0001;
};

export const usePortfolio = (prices = new Map()) => {
  const [state, dispatch] = useReducer(reducer, undefined, () => loadPortfolioFromStorage(null));
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
        console.warn('[PortfolioSync] Save error:', profileLookup.error.message);
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
      console.warn('[PortfolioSync] Save error:', error.message);
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
        console.warn('[PortfolioSync] Save error:', error.message);
        return;
      }

      lastSaved.current = serializedPayload;
    } catch (error) {
      console.warn('[PortfolioSync] Save failed:', error);
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
      const localState = loadPortfolioFromStorage(null);
      dispatch({ type: 'HYDRATE', state: localState });
      lastSaved.current = JSON.stringify(localState);
      setLoaded(true);
      return;
    }

    let cancelled = false;

    const loadFromSupabase = async () => {
      setLoaded(false);
      const localState = loadPortfolioFromStorage(userId);

      try {
        let profileData = null;
        const query = await supabase
          .from('profiles')
          .select(`${PROFILE_COLUMN}, user_state`)
          .eq('id', userId)
          .maybeSingle();

        if (query.error) {
          if (!isMissingColumnError(query.error, PROFILE_COLUMN)) {
            console.warn('[PortfolioSync] Load error:', query.error.message);
          }

          const fallback = await supabase
            .from('profiles')
            .select('user_state')
            .eq('id', userId)
            .maybeSingle();

          if (fallback.error) {
            console.warn('[PortfolioSync] Fallback load error:', fallback.error.message);
            profileData = null;
          } else {
            profileData = fallback.data;
          }
        } else {
          profileData = query.data;
        }

        const remoteRaw = profileData?.[PROFILE_COLUMN] && typeof profileData[PROFILE_COLUMN] === 'object'
          ? profileData[PROFILE_COLUMN]
          : (profileData?.user_state?.[USER_STATE_KEY] && typeof profileData.user_state[USER_STATE_KEY] === 'object'
            ? profileData.user_state[USER_STATE_KEY]
            : null);

        const remoteState = normalizePortfolioState(remoteRaw);
        const useLocal = !hasPortfolioData(remoteState) && hasPortfolioData(localState);
        const resolved = useLocal ? localState : remoteState;

        if (cancelled) return;

        dispatch({ type: 'HYDRATE', state: resolved });
        savePortfolioToStorage(resolved, userId);
        const serialized = JSON.stringify(resolved);
        lastSaved.current = serialized;

        if (useLocal) {
          saveToSupabase(userId, resolved, serialized);
        }
      } catch (error) {
        if (cancelled) return;
        console.warn('[PortfolioSync] Load failed:', error);
        dispatch({ type: 'HYDRATE', state: localState });
        savePortfolioToStorage(localState, userId);
        lastSaved.current = JSON.stringify(localState);
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
    const payload = {
      cash: state.cash,
      positions: state.positions,
    };

    savePortfolioToStorage(payload, userId);
    if (!loaded) return;

    const serialized = JSON.stringify(payload);
    if (serialized === lastSaved.current) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (!userId || !supabase) {
        lastSaved.current = serialized;
        return;
      }
      saveToSupabase(userId, payload, serialized);
    }, 1400);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state.cash, state.positions, userId, loaded, saveToSupabase]);

  const derived = useMemo(() => {
    let holdingsValue = 0;
    let todayPnL = 0;

    const positions = state.positions.map((position) => {
      const quote = getQuote(prices, position.symbol);
      const currentPrice = getCurrentPrice(quote, position.avgCost);
      const positionValue = currentPrice * position.shares;
      holdingsValue += positionValue;

      const pnl = (currentPrice - position.avgCost) * position.shares;
      const pnlPercent = position.avgCost > 0 ? ((currentPrice - position.avgCost) / position.avgCost) * 100 : 0;

      const dayChangePerShare = getDayChangePerShare(quote, currentPrice);
      todayPnL += dayChangePerShare * position.shares;

      return {
        ...position,
        currentPrice,
        pnl,
        pnlPercent,
      };
    });

    const totalValue = state.cash + holdingsValue;
    const baseValue = totalValue - todayPnL;
    const todayPnLPercent = baseValue > 0 ? (todayPnL / baseValue) * 100 : 0;

    return {
      positions,
      totalValue,
      todayPnL,
      todayPnLPercent,
    };
  }, [state.positions, state.cash, prices]);

  const applyTrade = useCallback((trade) => {
    dispatch({ type: 'APPLY_TRADE', trade });
  }, []);

  return {
    positions: derived.positions,
    cash: state.cash,
    totalValue: derived.totalValue,
    todayPnL: derived.todayPnL,
    todayPnLPercent: derived.todayPnLPercent,
    applyTrade,
    loaded,
  };
};

