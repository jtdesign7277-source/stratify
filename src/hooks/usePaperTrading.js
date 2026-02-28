import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const API_BASE = String(import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
const withApiBase = (path) => `${API_BASE}${path}`;

const DEFAULT_PORTFOLIO = {
  cash_balance: 100000,
  starting_balance: 100000,
  positions: [],
  total_account_value: 100000,
  total_pnl: 0,
  total_pnl_percent: 0,
};

let sharedState = {
  portfolio: DEFAULT_PORTFOLIO,
  trades: [],
  loading: false,
  trading: false,
  error: '',
};

const listeners = new Set();
let hasInitialized = false;
let portfolioInFlight = null;
let tradesInFlight = null;

const notify = () => {
  listeners.forEach((listener) => {
    try {
      listener(sharedState);
    } catch {
      // Ignore subscriber errors.
    }
  });
};

const setSharedState = (updater) => {
  const nextState = typeof updater === 'function'
    ? updater(sharedState)
    : { ...sharedState, ...updater };
  sharedState = nextState;
  notify();
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeSymbol = (value = '') => String(value || '').trim().toUpperCase();

const normalizePortfolio = (payload = {}) => {
  const positions = Array.isArray(payload?.positions) ? payload.positions : [];

  return {
    cash_balance: toNumber(payload?.cash_balance, 0),
    starting_balance: toNumber(payload?.starting_balance, 100000),
    positions: positions.map((position) => ({
      ...position,
      symbol: normalizeSymbol(position?.symbol),
      quantity: toNumber(position?.quantity, 0),
      avg_cost_basis: toNumber(position?.avg_cost_basis, 0),
      current_price: toNumber(position?.current_price, 0),
      market_value: toNumber(position?.market_value, 0),
      pnl: toNumber(position?.pnl, 0),
      pnl_percent: toNumber(position?.pnl_percent, 0),
    })),
    total_account_value: toNumber(payload?.total_account_value, 0),
    total_pnl: toNumber(payload?.total_pnl, 0),
    total_pnl_percent: toNumber(payload?.total_pnl_percent, 0),
  };
};

const normalizeTrades = (payload) => {
  const rows = Array.isArray(payload?.trades) ? payload.trades : [];
  return rows.map((trade, index) => ({
    id: trade?.id || `${trade?.symbol || 'trade'}-${trade?.created_at || index}-${index}`,
    symbol: normalizeSymbol(trade?.symbol),
    side: String(trade?.side || '').toLowerCase() === 'sell' ? 'sell' : 'buy',
    quantity: toNumber(trade?.quantity, 0),
    price: toNumber(trade?.price, 0),
    total_cost: toNumber(trade?.total_cost, 0),
    created_at: trade?.created_at || null,
  }));
};

const parseApiError = async (response) => {
  try {
    const payload = await response.json();
    if (payload && typeof payload === 'object') {
      const message = String(payload.error || payload.message || '').trim();
      if (message) return message;
    }
  } catch {
    // ignore json parse errors
  }

  try {
    const text = String(await response.text()).trim();
    if (text) return text;
  } catch {
    // ignore text parse errors
  }

  return `Request failed (${response.status})`;
};

const getAuthHeaders = async () => {
  const { data } = await supabase.auth.getSession();
  const token = String(data?.session?.access_token || '').trim();
  if (!token) {
    throw new Error('Please sign in to use paper trading.');
  }

  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

const fetchPortfolioInternal = async ({ silent = false } = {}) => {
  if (portfolioInFlight) return portfolioInFlight;

  if (!silent) {
    setSharedState((state) => ({ ...state, loading: true, error: '' }));
  }

  portfolioInFlight = (async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(withApiBase('/api/paper-portfolio'), {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }
      const payload = await response.json().catch(() => ({}));
      const portfolio = normalizePortfolio(payload);
      setSharedState((state) => ({
        ...state,
        portfolio,
        loading: false,
        error: '',
      }));
      return portfolio;
    } catch (error) {
      const message = String(error?.message || 'Failed to load paper portfolio.');
      setSharedState((state) => ({
        ...state,
        loading: false,
        error: message,
      }));
      throw error;
    } finally {
      portfolioInFlight = null;
    }
  })();

  return portfolioInFlight;
};

const fetchTradesInternal = async ({ limit = 50, offset = 0, silent = false } = {}) => {
  if (tradesInFlight) return tradesInFlight;

  if (!silent) {
    setSharedState((state) => ({ ...state, loading: true, error: '' }));
  }

  tradesInFlight = (async () => {
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams({
        limit: String(Math.max(1, Number(limit) || 50)),
        offset: String(Math.max(0, Number(offset) || 0)),
      });
      const response = await fetch(withApiBase(`/api/paper-history?${params.toString()}`), {
        method: 'GET',
        headers,
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(await parseApiError(response));
      }
      const payload = await response.json().catch(() => ({}));
      const trades = normalizeTrades(payload);
      setSharedState((state) => ({
        ...state,
        trades,
        loading: false,
        error: '',
      }));
      return trades;
    } catch (error) {
      const message = String(error?.message || 'Failed to load paper trade history.');
      setSharedState((state) => ({
        ...state,
        loading: false,
        error: message,
      }));
      throw error;
    } finally {
      tradesInFlight = null;
    }
  })();

  return tradesInFlight;
};

const normalizeOrderQuantity = (quantity) => {
  const parsed = Number(quantity);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const executeTradeInternal = async (symbol, side, quantity) => {
  const normalizedSymbol = normalizeSymbol(symbol);
  const normalizedSide = String(side || '').toLowerCase() === 'sell' ? 'sell' : 'buy';
  const normalizedQuantity = normalizeOrderQuantity(quantity);

  if (!normalizedSymbol) {
    throw new Error('Symbol is required.');
  }
  if (!normalizedQuantity) {
    throw new Error('Quantity must be greater than 0.');
  }

  setSharedState((state) => ({
    ...state,
    trading: true,
    error: '',
  }));

  try {
    const headers = await getAuthHeaders();
    const response = await fetch(withApiBase('/api/paper-trade'), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        symbol: normalizedSymbol,
        side: normalizedSide,
        quantity: normalizedQuantity,
      }),
    });

    if (!response.ok) {
      throw new Error(await parseApiError(response));
    }

    const result = await response.json().catch(() => ({}));
    await Promise.allSettled([
      fetchPortfolioInternal({ silent: true }),
      fetchTradesInternal({ silent: true }),
    ]);

    setSharedState((state) => ({
      ...state,
      trading: false,
      error: '',
    }));

    return result;
  } catch (error) {
    const message = String(error?.message || 'Paper trade failed.');
    setSharedState((state) => ({
      ...state,
      trading: false,
      error: message,
    }));
    throw error;
  }
};

const toSymbolKey = (value = '') => normalizeSymbol(value).replace(/[^A-Z0-9]/g, '');

const findPositionBySymbol = (positions, symbol) => {
  const rows = Array.isArray(positions) ? positions : [];
  const targetKey = toSymbolKey(symbol);
  if (!targetKey) return null;

  return rows.find((position) => toSymbolKey(position?.symbol) === targetKey) || null;
};

const closePositionInternal = async (symbol) => {
  const normalizedSymbol = normalizeSymbol(symbol);
  if (!normalizedSymbol) {
    throw new Error('Symbol is required.');
  }

  let position = findPositionBySymbol(sharedState?.portfolio?.positions, normalizedSymbol);
  if (!position) {
    await fetchPortfolioInternal({ silent: true });
    position = findPositionBySymbol(sharedState?.portfolio?.positions, normalizedSymbol);
  }

  const quantity = toNumber(position?.quantity, 0);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`No open position found for ${normalizedSymbol}.`);
  }

  return executeTradeInternal(position.symbol || normalizedSymbol, 'sell', quantity);
};

export function usePaperTrading() {
  const [state, setState] = useState(sharedState);

  useEffect(() => {
    listeners.add(setState);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  useEffect(() => {
    if (hasInitialized) return;
    hasInitialized = true;

    setSharedState((current) => ({ ...current, loading: true, error: '' }));
    Promise.allSettled([
      fetchPortfolioInternal({ silent: true }),
      fetchTradesInternal({ silent: true }),
    ]).finally(() => {
      setSharedState((current) => ({ ...current, loading: false }));
    });
  }, []);

  const buy = useCallback((symbol, quantity) => executeTradeInternal(symbol, 'buy', quantity), []);
  const sell = useCallback((symbol, quantity) => executeTradeInternal(symbol, 'sell', quantity), []);
  const executeTrade = useCallback((symbol, side, quantity) => executeTradeInternal(symbol, side, quantity), []);
  const closePosition = useCallback((symbol) => closePositionInternal(symbol), []);
  const fetchPortfolio = useCallback((options = {}) => fetchPortfolioInternal(options), []);
  const fetchTrades = useCallback((options = {}) => fetchTradesInternal(options), []);

  return {
    portfolio: state.portfolio,
    trades: state.trades,
    loading: state.loading,
    trading: state.trading,
    error: state.error,
    buy,
    sell,
    closePosition,
    executeTrade,
    fetchPortfolio,
    fetchTrades,
  };
}
