import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, History, Sparkles, Trash2 } from 'lucide-react';

const HIDDEN_TRADES_STORAGE_KEY = 'stratify-history-hidden-trades';

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toTimestamp = (value) => {
  if (Number.isFinite(value)) return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatCurrency = (value) => `$${Math.abs(toNumber(value)).toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

const formatPnl = (value) => {
  const amount = toNumber(value);
  if (amount === 0) return '$0.00';
  return `${amount > 0 ? '+' : '-'}${formatCurrency(amount)}`;
};

const formatDate = (timestamp) => {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '—';
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

const formatTime = (timestamp) => {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '—';
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const normalizeTrade = (raw) => {
  if (!raw || typeof raw !== 'object') return null;

  const side = String(
    raw.side
      ?? raw.type
      ?? raw.order_side
      ?? raw.orderSide
      ?? raw.action
      ?? '',
  ).toLowerCase();

  if (!side) return null;

  const type = side.includes('sell') || side === 'short' ? 'sell' : 'buy';
  const symbol = String(raw.symbol ?? raw.ticker ?? raw.asset ?? '').trim().toUpperCase();
  if (!symbol) return null;

  const shares = Math.abs(toNumber(raw.shares ?? raw.qty ?? raw.quantity ?? raw.filled_qty ?? raw.filledQty));
  const price = toNumber(
    raw.price
      ?? raw.fillPrice
      ?? raw.avgPrice
      ?? raw.avg_entry_price
      ?? raw.avg_entry
      ?? raw.filled_avg_price
      ?? raw.filledAvgPrice,
  );

  if (shares <= 0 || price <= 0) return null;

  const timestamp = toTimestamp(
    raw.filled_at
      ?? raw.filledAt
      ?? raw.timestamp
      ?? raw.time
      ?? raw.submitted_at
      ?? raw.submittedAt
      ?? raw.created_at
      ?? raw.createdAt,
  ) ?? Date.now();

  const total = toNumber(raw.total ?? raw.notional ?? (shares * price));
  const status = String(raw.status ?? raw.order_status ?? raw.orderStatus ?? 'filled').toLowerCase();
  const id = String(raw.id ?? raw.orderId ?? raw.tradeId ?? '').trim() || `${symbol}-${type}-${timestamp}-${shares}`;

  return {
    id,
    type,
    symbol,
    shares,
    price,
    total: Math.abs(total),
    timestamp,
    status,
  };
};

const isCompletedTrade = (trade) => {
  const status = String(trade?.status || '').toLowerCase();
  if (!status) return true;
  return ['filled', 'partially_filled', 'completed', 'executed', 'closed', 'done'].some((flag) => status.includes(flag));
};

const normalizeStrategyType = (strategy) => String(
  strategy?.type
    ?? strategy?.strategyType
    ?? strategy?.templateId
    ?? strategy?.indicator
    ?? 'Custom',
).trim() || 'Custom';

const isStrategyActive = (strategy) => {
  const runStatus = String(strategy?.runStatus || '').toLowerCase();
  const status = String(strategy?.status || '').toLowerCase();

  if (runStatus === 'running' || runStatus === 'paused') return true;
  if (status === 'active' || status === 'live' || status === 'deployed' || status === 'paused') return true;
  return Boolean(strategy?.deployed);
};

const resolveStrategyReturn = (strategy) => {
  const candidates = [
    strategy?.paper?.pnl,
    strategy?.pnl,
    strategy?.totalReturn,
    strategy?.returnDollar,
    strategy?.backtestResults?.totalPnL,
  ];

  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return 0;
};

const normalizeStrategyRun = (strategy) => {
  if (!strategy || typeof strategy !== 'object') return null;
  const startedAt = toTimestamp(strategy.activatedAt ?? strategy.deployedAt ?? strategy.createdAt ?? strategy.timestamp);
  const fallbackStart = toTimestamp(strategy.updatedAt ?? strategy.savedAt);
  const active = isStrategyActive(strategy);
  const resolvedStart = startedAt ?? fallbackStart;
  if (!resolvedStart && !active) return null;
  if (!resolvedStart && active) return null;

  const endedAtRaw = toTimestamp(strategy.endedAt ?? strategy.stoppedAt ?? strategy.completedAt ?? strategy.endAt ?? strategy.updatedAt);
  const endedAt = active ? null : endedAtRaw;

  const id = String(strategy.id ?? `${strategy.name || 'strategy'}-${resolvedStart}`).trim();

  return {
    id,
    name: String(strategy.name || 'Untitled Strategy'),
    type: normalizeStrategyType(strategy),
    startedAt: resolvedStart,
    endedAt,
    active,
    totalReturn: resolveStrategyReturn(strategy),
  };
};

const getTradeRowKey = (trade) => (
  `${trade.id}-${trade.symbol}-${trade.type}-${trade.shares}-${trade.price}-${Math.floor(trade.timestamp / 1000)}`
);

const getStrategyRowKey = (strategy) => (
  `${strategy.id}-${strategy.startedAt}`
);

const HistoryPage = ({
  tradeHistory = [],
  savedStrategies = [],
  deployedStrategies = [],
  alpacaData = {},
  onDeleteTrade,
  onClearTradeHistory,
}) => {
  const [apiTrades, setApiTrades] = useState([]);
  const [hiddenTradeKeys, setHiddenTradeKeys] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(HIDDEN_TRADES_STORAGE_KEY);
      const parsed = JSON.parse(stored || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(HIDDEN_TRADES_STORAGE_KEY, JSON.stringify(hiddenTradeKeys));
    } catch {
      // ignore storage write errors
    }
  }, [hiddenTradeKeys]);

  useEffect(() => {
    let cancelled = false;

    const fetchTrades = async () => {
      const endpoints = [
        '/api/trades/orders?status=filled&limit=200',
        '/api/orders?status=filled&limit=200',
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint);
          if (!response.ok) continue;
          const payload = await response.json();
          const list = Array.isArray(payload)
            ? payload
            : (Array.isArray(payload?.orders) ? payload.orders : []);
          const normalized = list.map(normalizeTrade).filter(Boolean);
          if (!cancelled) {
            setApiTrades(normalized);
          }
          return;
        } catch {
          // Keep trying other endpoints.
        }
      }

      if (!cancelled) setApiTrades([]);
    };

    fetchTrades();

    return () => {
      cancelled = true;
    };
  }, []);

  const normalizedLocalTrades = useMemo(
    () => (Array.isArray(tradeHistory) ? tradeHistory.map(normalizeTrade).filter(Boolean) : []),
    [tradeHistory],
  );

  const normalizedBrokerTrades = useMemo(() => {
    const directOrders = Array.isArray(alpacaData?.orders) ? alpacaData.orders : [];
    const directTrades = Array.isArray(alpacaData?.trades) ? alpacaData.trades : [];
    return [...directOrders, ...directTrades].map(normalizeTrade).filter(Boolean);
  }, [alpacaData]);

  const trades = useMemo(() => {
    const byKey = new Map();

    [...apiTrades, ...normalizedBrokerTrades, ...normalizedLocalTrades].forEach((trade) => {
      const key = getTradeRowKey(trade);
      if (!byKey.has(key)) {
        byKey.set(key, trade);
        return;
      }

      const existing = byKey.get(key);
      if (toTimestamp(trade.timestamp) >= toTimestamp(existing.timestamp)) {
        byKey.set(key, trade);
      }
    });

    return [...byKey.values()].sort((a, b) => b.timestamp - a.timestamp);
  }, [apiTrades, normalizedBrokerTrades, normalizedLocalTrades]);

  const visibleTrades = useMemo(() => {
    if (hiddenTradeKeys.length === 0) return trades;
    const hidden = new Set(hiddenTradeKeys);
    return trades.filter((trade) => !hidden.has(getTradeRowKey(trade)));
  }, [trades, hiddenTradeKeys]);

  const tradeLogPnl = useMemo(() => {
    const sorted = [...visibleTrades]
      .filter(isCompletedTrade)
      .sort((a, b) => a.timestamp - b.timestamp);

    const lotsBySymbol = new Map();
    let realized = 0;

    sorted.forEach((trade) => {
      const symbol = trade.symbol;
      if (!lotsBySymbol.has(symbol)) lotsBySymbol.set(symbol, []);

      const lots = lotsBySymbol.get(symbol);
      if (trade.type === 'buy') {
        lots.push({ shares: trade.shares, price: trade.price });
        return;
      }

      let remaining = trade.shares;
      while (remaining > 0 && lots.length > 0) {
        const lot = lots[0];
        const matchedShares = Math.min(remaining, lot.shares);
        realized += matchedShares * (trade.price - lot.price);
        lot.shares -= matchedShares;
        remaining -= matchedShares;
        if (lot.shares <= 0) lots.shift();
      }
    });

    return Number(realized.toFixed(2));
  }, [visibleTrades]);

  const handleDeleteTrade = (trade) => {
    if (!trade) return;
    const rowKey = getTradeRowKey(trade);
    setHiddenTradeKeys((prev) => (prev.includes(rowKey) ? prev : [...prev, rowKey]));
    if (typeof onDeleteTrade === 'function') {
      onDeleteTrade(trade.id);
    }
  };

  const handleClearTrades = () => {
    if (!visibleTrades.length) return;
    const shouldClear = window.confirm('Delete all trade history rows from this page?');
    if (!shouldClear) return;

    const allKeys = visibleTrades.map((trade) => getTradeRowKey(trade));
    setHiddenTradeKeys((prev) => [...new Set([...prev, ...allKeys])]);
    if (typeof onClearTradeHistory === 'function') {
      onClearTradeHistory();
    }
  };

  const strategyRuns = useMemo(() => {
    const byKey = new Map();

    [...savedStrategies, ...deployedStrategies]
      .map(normalizeStrategyRun)
      .filter(Boolean)
      .forEach((strategy) => {
        const key = getStrategyRowKey(strategy);
        const existing = byKey.get(key);
        if (!existing) {
          byKey.set(key, strategy);
          return;
        }

        const keepCandidate = (
          Number(strategy.active) > Number(existing.active)
          || toTimestamp(strategy.startedAt) >= toTimestamp(existing.startedAt)
        );

        if (keepCandidate) byKey.set(key, strategy);
      });

    return [...byKey.values()].sort((a, b) => b.startedAt - a.startedAt);
  }, [savedStrategies, deployedStrategies]);

  const strategyPnl = useMemo(
    () => Number(strategyRuns.reduce((sum, run) => sum + toNumber(run.totalReturn), 0).toFixed(2)),
    [strategyRuns],
  );

  const totalPnl = Number((tradeLogPnl + strategyPnl).toFixed(2));
  const totalPnlColor = totalPnl > 0 ? 'text-emerald-400' : totalPnl < 0 ? 'text-red-400' : 'text-white/80';

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent text-white p-4 gap-4 overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl flex flex-col min-h-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1f1f1f] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Trade Log</h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/45">{visibleTrades.length} trades</span>
              {visibleTrades.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearTrades}
                  className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-300 hover:bg-red-500/15 transition-colors"
                >
                  <Trash2 className="h-3 w-3" strokeWidth={1.6} />
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            {visibleTrades.length === 0 ? (
              <div className="h-full flex items-center justify-center px-6 text-center">
                <div>
                  <History className="w-8 h-8 text-white/20 mx-auto mb-3" strokeWidth={1.5} />
                  <p className="text-sm text-white/65">
                    No trades yet. Start paper trading to see your trade history.
                  </p>
                </div>
              </div>
            ) : (
              <table className="w-full min-w-[980px] text-sm">
                <thead className="text-xs text-white/45 uppercase tracking-[0.1em]">
                  <tr className="border-b border-[#1f1f1f]">
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Symbol</th>
                    <th className="px-4 py-3 text-right">Shares</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Time</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTrades.map((trade) => {
                    const isBuy = trade.type === 'buy';
                    return (
                      <tr key={getTradeRowKey(trade)} className="border-b border-[#1f1f1f]/60 hover:bg-white/[0.02]">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isBuy ? (
                              <ArrowDownRight className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
                            ) : (
                              <ArrowUpRight className="w-4 h-4 text-red-400" strokeWidth={1.5} />
                            )}
                            <span className={`font-semibold text-xs uppercase ${isBuy ? 'text-emerald-400' : 'text-red-400'}`}>
                              {isBuy ? 'Buy' : 'Sell'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium">{trade.symbol}</td>
                        <td className="px-4 py-3 text-right font-mono">{trade.shares.toLocaleString('en-US', { maximumFractionDigits: 4 })}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(trade.price)}</td>
                        <td className="px-4 py-3 text-right font-mono">{formatCurrency(trade.total)}</td>
                        <td className="px-4 py-3 text-white/70">{formatDate(trade.timestamp)}</td>
                        <td className="px-4 py-3 text-white/55">{formatTime(trade.timestamp)}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-xs font-medium capitalize">
                            {String(trade.status || 'filled').replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteTrade(trade)}
                            className="inline-flex items-center justify-center rounded-md border border-red-500/25 bg-red-500/10 p-1.5 text-red-300 hover:bg-red-500/20 transition-colors"
                            title="Delete row"
                            aria-label={`Delete ${trade.symbol} trade row`}
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="px-4 py-3 border-t border-[#1f1f1f] flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.15em] text-white/45">Trade Log P&amp;L</span>
            <span className={`font-mono text-lg font-semibold ${tradeLogPnl > 0 ? 'text-emerald-400' : tradeLogPnl < 0 ? 'text-red-400' : 'text-white/80'}`}>
              {formatPnl(tradeLogPnl)}
            </span>
          </div>
        </div>

        <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl flex flex-col min-h-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1f1f1f] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Strategy Log</h2>
            <span className="text-xs text-white/45">{strategyRuns.length} runs</span>
          </div>

          <div className="flex-1 min-h-0 overflow-auto">
            {strategyRuns.length === 0 ? (
              <div className="h-full flex items-center justify-center px-6 text-center">
                <div>
                  <Sparkles className="w-8 h-8 text-white/20 mx-auto mb-3" strokeWidth={1.5} />
                  <p className="text-sm text-white/65">
                    No strategy history yet. Activate a strategy to start tracking.
                  </p>
                </div>
              </div>
            ) : (
              <table className="w-full min-w-[760px] text-sm">
                <thead className="text-xs text-white/45 uppercase tracking-[0.1em]">
                  <tr className="border-b border-[#1f1f1f]">
                    <th className="px-4 py-3 text-left">Strategy Name</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Date Started</th>
                    <th className="px-4 py-3 text-left">Date Ended</th>
                    <th className="px-4 py-3 text-right">Total Return</th>
                  </tr>
                </thead>
                <tbody>
                  {strategyRuns.map((strategy) => (
                    <tr key={getStrategyRowKey(strategy)} className="border-b border-[#1f1f1f]/60 hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-medium text-white/90">{strategy.name}</td>
                      <td className="px-4 py-3 text-white/70">{strategy.type}</td>
                      <td className="px-4 py-3 text-white/70">{formatDate(strategy.startedAt)}</td>
                      <td className="px-4 py-3">
                        {strategy.active ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-xs font-medium">
                            Active
                          </span>
                        ) : (
                          <span className="text-white/60">{formatDate(strategy.endedAt)}</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono font-semibold ${strategy.totalReturn > 0 ? 'text-emerald-400' : strategy.totalReturn < 0 ? 'text-red-400' : 'text-white/80'}`}>
                        {formatPnl(strategy.totalReturn)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="px-4 py-3 border-t border-[#1f1f1f] flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.15em] text-white/45">Strategy P&amp;L</span>
            <span className={`font-mono text-lg font-semibold ${strategyPnl > 0 ? 'text-emerald-400' : strategyPnl < 0 ? 'text-red-400' : 'text-white/80'}`}>
              {formatPnl(strategyPnl)}
            </span>
          </div>
        </div>
      </div>

      <div className="shrink-0 rounded-xl border border-[#1f1f1f] bg-[#111111] px-5 py-4">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-2">
          <div className="text-sm text-white/70">
            Trade Log P&amp;L: <span className={tradeLogPnl > 0 ? 'text-emerald-400' : tradeLogPnl < 0 ? 'text-red-400' : 'text-white/80'}>{formatPnl(tradeLogPnl)}</span>
            {' '}+ Strategy P&amp;L: <span className={strategyPnl > 0 ? 'text-emerald-400' : strategyPnl < 0 ? 'text-red-400' : 'text-white/80'}>{formatPnl(strategyPnl)}</span>
          </div>
          <div className={`text-2xl font-semibold font-mono ${totalPnlColor}`}>
            All-Time Total P&amp;L: {formatPnl(totalPnl)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;
