import { useEffect, useMemo, useReducer } from 'react';

const STORAGE_KEY = 'stratify-portfolio';
const DEFAULT_CASH = 100000;

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

const buildInitialState = () => {
  const fallback = { cash: DEFAULT_CASH, positions: [] };
  if (typeof window === 'undefined') return fallback;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored);
    const cash = Number(parsed?.cash);
    const positions = sanitizePositions(parsed?.positions);
    return {
      cash: Number.isFinite(cash) ? cash : DEFAULT_CASH,
      positions,
    };
  } catch {
    return fallback;
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

export const usePortfolio = (prices = new Map()) => {
  const [state, dispatch] = useReducer(reducer, undefined, buildInitialState);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        cash: state.cash,
        positions: state.positions,
      }));
    } catch {
      // Ignore storage write errors (private mode, quota, SSR).
    }
  }, [state.cash, state.positions]);

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

  const applyTrade = (trade) => {
    dispatch({ type: 'APPLY_TRADE', trade });
  };

  return {
    positions: derived.positions,
    cash: state.cash,
    totalValue: derived.totalValue,
    todayPnL: derived.todayPnL,
    todayPnLPercent: derived.todayPnLPercent,
    applyTrade,
  };
};

export { usePortfolio };
