import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// Keep paper trading on same-origin API routes by default.
// This prevents accidental routing to stale external backends that can 404.
const API_BASE = String(import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
const withApiBase = (path) => `${API_BASE}${path}`;

// Cache auth token at module level via onAuthStateChange — avoids getSession() which hangs in production
let _cachedAccessToken = null;
supabase.auth.onAuthStateChange((_event, session) => {
  _cachedAccessToken = session?.access_token || null;
});

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
const toSymbolKey = (value = '') => normalizeSymbol(value).replace(/[^A-Z0-9]/g, '');

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
  let payload = null;
  try {
    payload = await response.json();
    if (payload && typeof payload === 'object') {
      const message = String(payload.error || payload.message || '').trim();
      if (message) {
        return {
          message,
          code: String(payload.code || '').trim(),
          payload,
        };
      }
    }
  } catch {
    // ignore json parse errors
  }

  try {
    const text = String(await response.text()).trim();
    if (text) {
      return {
        message: text,
        code: '',
        payload: payload || null,
      };
    }
  } catch {
    // ignore text parse errors
  }

  return {
    message: `Request failed (${response.status})`,
    code: '',
    payload: payload || null,
  };
};

const getAuthHeaders = async () => {
  // Use cached token from onAuthStateChange (set at module level above)
  // Falls back to getSession() with timeout only if cache is empty
  let token = _cachedAccessToken;

  if (!token) {
    try {
      const result = await Promise.race([
        supabase.auth.getSession(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
      ]);
      token = result?.data?.session?.access_token || null;
      if (token) _cachedAccessToken = token;
    } catch {
      // getSession hung or timed out — token stays null
    }
  }

  token = String(token || '').trim();
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
        const parsedError = await parseApiError(response);
        throw new Error(parsedError.message);
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
        const parsedError = await parseApiError(response);
        throw new Error(parsedError.message);
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

const normalizeTradeInput = (input, sideArg, quantityArg, priceArg) => {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return {
      symbol: normalizeSymbol(input.symbol),
      side: String(input.side || '').toLowerCase() === 'sell' ? 'sell' : 'buy',
      quantity: toNumber(input.quantity, 0),
      price: toNumber(input.price, 0),
    };
  }

  return {
    symbol: normalizeSymbol(input),
    side: String(sideArg || '').toLowerCase() === 'sell' ? 'sell' : 'buy',
    quantity: toNumber(quantityArg, 0),
    price: toNumber(priceArg, 0),
  };
};

const calculateAvgCost = (oldQty, oldAvgCost, buyQty, buyPrice) => {
  const left = toNumber(oldQty, 0) * toNumber(oldAvgCost, 0);
  const right = toNumber(buyQty, 0) * toNumber(buyPrice, 0);
  const totalQty = toNumber(oldQty, 0) + toNumber(buyQty, 0);
  if (totalQty <= 0) return 0;
  return (left + right) / totalQty;
};

const recomputePortfolioTotals = (portfolio) => {
  const safePortfolio = portfolio && typeof portfolio === 'object' ? portfolio : DEFAULT_PORTFOLIO;
  const positions = Array.isArray(safePortfolio.positions) ? safePortfolio.positions : [];
  const cashBalance = toNumber(safePortfolio.cash_balance, 0);
  const startingBalance = toNumber(safePortfolio.starting_balance, 100000);
  const totalMarketValue = positions.reduce((sum, position) => sum + toNumber(position.market_value, 0), 0);
  const totalAccountValue = cashBalance + totalMarketValue;
  const totalPnl = totalAccountValue - startingBalance;
  const totalPnlPercent = startingBalance > 0 ? (totalPnl / startingBalance) * 100 : 0;

  return {
    ...safePortfolio,
    positions,
    cash_balance: cashBalance,
    starting_balance: startingBalance,
    total_account_value: totalAccountValue,
    total_pnl: totalPnl,
    total_pnl_percent: totalPnlPercent,
  };
};

const applyTradeToPortfolio = (portfolio, tradeInput) => {
  const normalizedTrade = normalizeTradeInput(tradeInput);
  const symbol = normalizedTrade.symbol;
  const side = normalizedTrade.side;
  const quantity = toNumber(normalizedTrade.quantity, 0);
  const price = toNumber(normalizedTrade.price, 0);
  if (!symbol || !quantity || !price) {
    return recomputePortfolioTotals(portfolio);
  }

  const base = portfolio && typeof portfolio === 'object' ? portfolio : DEFAULT_PORTFOLIO;
  const positions = Array.isArray(base.positions)
    ? base.positions.map((position) => ({
        ...position,
        symbol: normalizeSymbol(position?.symbol),
        quantity: toNumber(position?.quantity, 0),
        avg_cost_basis: toNumber(position?.avg_cost_basis, 0),
        current_price: toNumber(position?.current_price, 0),
        market_value: toNumber(position?.market_value, 0),
        pnl: toNumber(position?.pnl, 0),
        pnl_percent: toNumber(position?.pnl_percent, 0),
      }))
    : [];

  let nextCash = toNumber(base.cash_balance, 0);
  const matchIndex = positions.findIndex((position) => toSymbolKey(position.symbol) === toSymbolKey(symbol));

  if (side === 'buy') {
    const existing = matchIndex >= 0
      ? positions[matchIndex]
      : {
          symbol,
          quantity: 0,
          avg_cost_basis: 0,
          current_price: price,
          market_value: 0,
          pnl: 0,
          pnl_percent: 0,
        };

    const oldQty = toNumber(existing.quantity, 0);
    const oldAvg = toNumber(existing.avg_cost_basis, 0);
    const nextQty = oldQty + quantity;
    const nextAvg = calculateAvgCost(oldQty, oldAvg, quantity, price);
    const marketValue = nextQty * price;
    const costBasis = nextQty * nextAvg;
    const pnl = marketValue - costBasis;
    const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

    const nextPosition = {
      ...existing,
      symbol,
      quantity: nextQty,
      avg_cost_basis: nextAvg,
      current_price: price,
      market_value: marketValue,
      pnl,
      pnl_percent: pnlPercent,
    };

    if (matchIndex >= 0) {
      positions[matchIndex] = nextPosition;
    } else {
      positions.push(nextPosition);
    }

    nextCash -= quantity * price;
  } else {
    if (matchIndex < 0) {
      return recomputePortfolioTotals({ ...base, positions, cash_balance: nextCash });
    }

    const existing = positions[matchIndex];
    const oldQty = toNumber(existing.quantity, 0);
    if (oldQty <= 0) {
      return recomputePortfolioTotals({ ...base, positions, cash_balance: nextCash });
    }

    const sellQty = Math.min(quantity, oldQty);
    const remainingQty = oldQty - sellQty;
    nextCash += sellQty * price;

    if (remainingQty <= 0) {
      positions.splice(matchIndex, 1);
    } else {
      const avgCost = toNumber(existing.avg_cost_basis, 0);
      const marketValue = remainingQty * price;
      const costBasis = remainingQty * avgCost;
      const pnl = marketValue - costBasis;
      const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

      positions[matchIndex] = {
        ...existing,
        symbol,
        quantity: remainingQty,
        avg_cost_basis: avgCost,
        current_price: price,
        market_value: marketValue,
        pnl,
        pnl_percent: pnlPercent,
      };
    }
  }

  return recomputePortfolioTotals({
    ...base,
    positions,
    cash_balance: nextCash,
  });
};

const updatePositionPriceInternal = (symbol, newPrice) => {
  const normalizedSymbol = normalizeSymbol(symbol);
  const nextPrice = toNumber(newPrice, 0);
  if (!normalizedSymbol || !nextPrice || nextPrice <= 0) return;

  setSharedState((state) => {
    const currentPortfolio = state?.portfolio || DEFAULT_PORTFOLIO;
    const positions = Array.isArray(currentPortfolio.positions)
      ? currentPortfolio.positions.map((position) => ({ ...position }))
      : [];

    let changed = false;
    const nextPositions = positions.map((position) => {
      if (toSymbolKey(position?.symbol) !== toSymbolKey(normalizedSymbol)) {
        return position;
      }

      const quantity = toNumber(position?.quantity, 0);
      const avgCost = toNumber(position?.avg_cost_basis, 0);
      const marketValue = quantity * nextPrice;
      const costBasis = quantity * avgCost;
      const pnl = marketValue - costBasis;
      const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
      changed = true;

      return {
        ...position,
        current_price: nextPrice,
        market_value: marketValue,
        pnl,
        pnl_percent: pnlPercent,
      };
    });

    if (!changed) return state;

    const nextPortfolio = recomputePortfolioTotals({
      ...currentPortfolio,
      positions: nextPositions,
    });

    return {
      ...state,
      portfolio: nextPortfolio,
    };
  });
};

const executeTradeInternal = async (input, sideArg, quantityArg, priceArg) => {
  const trade = normalizeTradeInput(input, sideArg, quantityArg, priceArg);
  const { symbol, side, quantity, price } = trade;

  if (!symbol) {
    throw new Error('Symbol is required.');
  }
  if (!['buy', 'sell'].includes(side)) {
    throw new Error('Trade side must be buy or sell.');
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
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
        symbol,
        side,
        quantity,
        ...(Number.isFinite(price) && price > 0 ? { price } : {}),
      }),
    });

    if (!response.ok) {
      const parsedError = await parseApiError(response);
      if (parsedError.code === 'PRO_PLUS_PLAN_REQUIRED' && typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('stratify:pro-plus-required', {
            detail: parsedError.payload || { code: parsedError.code, message: parsedError.message },
          })
        );
      }
      throw new Error(parsedError.message);
    }

    const result = await response.json().catch(() => ({}));
    const resolvedPrice = toNumber(price, toNumber(result?.trade?.price, 0));

    setSharedState((state) => ({
      ...state,
      portfolio: applyTradeToPortfolio(state?.portfolio, {
        symbol,
        side,
        quantity,
        price: resolvedPrice,
      }),
    }));

    await Promise.allSettled([
      fetchPortfolioInternal({ silent: true }),
      fetchTradesInternal({ silent: true }),
    ]);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('paper-trade-executed'));
    }

    const normalizedResult = {
      success: result?.success !== false,
      error: String(result?.error || ''),
      trade: {
        symbol,
        side,
        quantity,
        price: resolvedPrice,
      },
      raw: result,
    };

    setSharedState((state) => ({
      ...state,
      trading: false,
      error: '',
    }));

    return normalizedResult;
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

  const currentPrice = toNumber(position?.current_price, 0);
  return executeTradeInternal({
    symbol: position.symbol || normalizedSymbol,
    side: 'sell',
    quantity,
    price: currentPrice,
  });
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

  const buy = useCallback((symbol, quantity, price) => executeTradeInternal({ symbol, side: 'buy', quantity, price }), []);
  const sell = useCallback((symbol, quantity, price) => executeTradeInternal({ symbol, side: 'sell', quantity, price }), []);
  const executeTrade = useCallback((input, side, quantity, price) => executeTradeInternal(input, side, quantity, price), []);
  const closePosition = useCallback((symbol) => closePositionInternal(symbol), []);
  const fetchPortfolio = useCallback((options = {}) => fetchPortfolioInternal(options), []);
  const fetchTrades = useCallback((options = {}) => fetchTradesInternal(options), []);
  const updatePositionPrice = useCallback((symbol, newPrice) => updatePositionPriceInternal(symbol, newPrice), []);

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
    updatePositionPrice,
  };
}

export default usePaperTrading;
