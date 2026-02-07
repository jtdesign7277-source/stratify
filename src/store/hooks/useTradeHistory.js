import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'stratify-trade-history';

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

  let shares = Math.abs(rawShares);
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

export const useTradeHistory = ({ onApplyTrade } = {}) => {
  const [trades, setTrades] = useState(() => {
    if (typeof window === 'undefined') return [];

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      const list = Array.isArray(parsed) ? parsed : (parsed?.trades ?? parsed?.history ?? []);
      return sanitizeTrades(list);
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
    } catch {
      // Ignore storage write errors (private mode, quota, SSR).
    }
  }, [trades]);

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
  };
};

export default useTradeHistory;
