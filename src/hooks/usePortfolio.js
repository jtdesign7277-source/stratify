import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { clearAlpacaCache, fetchAccount, fetchOrders, fetchPositions } from '../services/alpacaService';

const POLL_INTERVAL_MS = 30000;
const MODE_SWITCH_EVENT = 'stratify:trading-mode-switched';
const CACHE_CLEAR_EVENT = 'stratify:broker-cache-cleared';
const PAPER_MODE = 'paper';
const LIVE_MODE = 'live';

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeMode = (value) => (String(value || '').toLowerCase() === LIVE_MODE ? LIVE_MODE : PAPER_MODE);

const defaultAccountForMode = (mode) => (
  normalizeMode(mode) === LIVE_MODE
    ? {
        equity: 0,
        cash: 0,
        buying_power: 0,
        last_equity: 0,
        portfolio_value: 0,
        mode: LIVE_MODE,
      }
    : {
        equity: 100000,
        cash: 100000,
        buying_power: 100000,
        last_equity: 100000,
        portfolio_value: 100000,
        mode: PAPER_MODE,
      }
);

const normalizeAccount = (accountValue, mode) => {
  const defaults = defaultAccountForMode(mode);
  const candidate = accountValue && typeof accountValue === 'object' ? accountValue : {};
  const equity = toNumber(candidate.equity ?? candidate.portfolio_value, defaults.equity);
  const lastEquity = toNumber(candidate.last_equity, defaults.last_equity);
  return {
    ...defaults,
    ...candidate,
    equity,
    cash: toNumber(candidate.cash, defaults.cash),
    buying_power: toNumber(candidate.buying_power ?? candidate.buyingPower, defaults.buying_power),
    last_equity: lastEquity,
    portfolio_value: toNumber(candidate.portfolio_value, equity),
    daily_pnl: toNumber(candidate.daily_pnl, equity - lastEquity),
    mode: normalizeMode(candidate.mode || candidate.trading_mode || mode),
  };
};

const normalizePositions = (positionsValue) => {
  if (!Array.isArray(positionsValue)) return [];

  return positionsValue
    .map((position) => {
      const symbol = String(position.symbol || position.ticker || '').trim().toUpperCase();
      const shares = toNumber(position.qty ?? position.shares ?? position.quantity, 0);
      const avgEntry = toNumber(position.avg_entry_price ?? position.avgCost ?? position.avgEntryPrice, 0);
      const currentPrice = toNumber(position.current_price ?? position.currentPrice ?? position.price, avgEntry);
      if (!symbol || shares <= 0) return null;

      const marketValue = toNumber(position.market_value ?? shares * currentPrice, shares * currentPrice);
      const costBasis = toNumber(position.cost_basis ?? shares * avgEntry, shares * avgEntry);
      const unrealized = toNumber(position.unrealized_pl ?? marketValue - costBasis, marketValue - costBasis);
      return {
        ...position,
        symbol,
        qty: shares,
        shares,
        avg_entry_price: avgEntry,
        avgCost: avgEntry,
        current_price: currentPrice,
        currentPrice,
        market_value: marketValue,
        marketValue,
        cost_basis: costBasis,
        unrealized_pl: unrealized,
        unrealized_plpc: toNumber(position.unrealized_plpc, costBasis > 0 ? unrealized / costBasis : 0),
      };
    })
    .filter(Boolean);
};

const toTimestamp = (value) => {
  if (Number.isFinite(value)) return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
};

const normalizeTrade = (entry) => {
  if (!entry || typeof entry !== 'object') return null;

  const symbol = String(entry.symbol || '').trim().toUpperCase();
  const side = String(entry.side || '').toLowerCase() === 'sell' ? 'sell' : 'buy';
  const shares = toNumber(entry.shares ?? entry.qty ?? entry.filled_qty ?? entry.quantity, 0);
  const fallbackPrice = shares > 0 ? toNumber(entry.notional, 0) / shares : 0;
  const price = toNumber(
    entry.price ?? entry.filled_avg_price ?? entry.avg_price ?? entry.limit_price ?? entry.stop_price,
    fallbackPrice
  );

  if (!symbol || shares <= 0 || price <= 0) return null;

  return {
    ...entry,
    id: String(entry.id || entry.order_id || `${symbol}-${toTimestamp(entry.timestamp)}`),
    symbol,
    side,
    shares,
    qty: shares,
    price,
    total: toNumber(entry.total ?? shares * price, shares * price),
    timestamp: entry.timestamp || entry.filled_at || entry.submitted_at || Date.now(),
  };
};

const normalizeTradeHistory = (payload) => {
  const list = Array.isArray(payload)
    ? payload
    : (Array.isArray(payload?.orders) ? payload.orders : []);

  return list
    .map(normalizeTrade)
    .filter(Boolean)
    .sort((a, b) => toTimestamp(b.timestamp) - toTimestamp(a.timestamp));
};

export function usePortfolio({ tradingMode = PAPER_MODE, pollIntervalMs = POLL_INTERVAL_MS } = {}) {
  const normalizedMode = normalizeMode(tradingMode);
  const [account, setAccount] = useState(() => defaultAccountForMode(normalizedMode));
  const [positions, setPositions] = useState([]);
  const [tradeHistory, setTradeHistory] = useState([]);
  const [brokerConnected, setBrokerConnected] = useState(normalizedMode === PAPER_MODE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchIdRef = useRef(0);

  const refresh = useCallback(async ({ forceFresh = false } = {}) => {
    const requestId = fetchIdRef.current + 1;
    fetchIdRef.current = requestId;

    if (forceFresh) {
      clearAlpacaCache();
    }

    if (requestId === 1 || forceFresh) {
      setLoading(true);
    }

    const [accountResult, positionsResult, ordersResult] = await Promise.allSettled([
      fetchAccount({ mode: normalizedMode, forceFresh }),
      fetchPositions({ mode: normalizedMode, forceFresh }),
      fetchOrders({ mode: normalizedMode, status: 'all', limit: 200, forceFresh }),
    ]);

    if (fetchIdRef.current !== requestId) return;

    if (accountResult.status === 'fulfilled') {
      setAccount(normalizeAccount(accountResult.value, normalizedMode));
      setBrokerConnected(true);
    } else {
      const status = accountResult.reason?.status;
      if (status === 401 && normalizedMode === LIVE_MODE) {
        setBrokerConnected(false);
      }
      setAccount(defaultAccountForMode(normalizedMode));
    }

    if (positionsResult.status === 'fulfilled') {
      setPositions(normalizePositions(positionsResult.value));
    } else {
      setPositions([]);
    }

    if (ordersResult.status === 'fulfilled') {
      setTradeHistory(normalizeTradeHistory(ordersResult.value));
    } else {
      setTradeHistory([]);
    }

    const firstError = [accountResult, positionsResult, ordersResult]
      .find((result) => result.status === 'rejected');

    setError(firstError?.reason || null);
    setLoading(false);
  }, [normalizedMode]);

  useEffect(() => {
    setAccount(defaultAccountForMode(normalizedMode));
    setPositions([]);
    setTradeHistory([]);
    setError(null);
    setBrokerConnected(normalizedMode === PAPER_MODE);
    refresh({ forceFresh: true });
  }, [normalizedMode, refresh]);

  useEffect(() => {
    const timer = setInterval(() => {
      refresh({ forceFresh: false });
    }, pollIntervalMs);
    return () => clearInterval(timer);
  }, [pollIntervalMs, refresh]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleModeSwitch = () => {
      refresh({ forceFresh: true });
    };

    const handleCacheClear = () => {
      refresh({ forceFresh: true });
    };

    window.addEventListener(MODE_SWITCH_EVENT, handleModeSwitch);
    window.addEventListener(CACHE_CLEAR_EVENT, handleCacheClear);
    return () => {
      window.removeEventListener(MODE_SWITCH_EVENT, handleModeSwitch);
      window.removeEventListener(CACHE_CLEAR_EVENT, handleCacheClear);
    };
  }, [refresh]);

  return useMemo(() => ({
    account,
    positions,
    tradeHistory,
    brokerConnected,
    loading,
    error,
    refresh: ({ forceFresh = true } = {}) => refresh({ forceFresh }),
    mode: normalizedMode,
  }), [account, brokerConnected, error, loading, normalizedMode, positions, refresh, tradeHistory]);
}

export default usePortfolio;
