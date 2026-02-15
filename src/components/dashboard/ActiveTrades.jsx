import React, { useEffect, useMemo, useState } from 'react';
import { Pause, Play, Square } from 'lucide-react';
import { getMarketStatus, getNextMarketOpen, isMarketOpen } from '../../lib/marketHours';

const formatMoney = (value = 0) => {
  const amount = Number(value) || 0;
  return `${amount >= 0 ? '+' : '-'}$${Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatPercent = (value = 0) => {
  const amount = Number(value) || 0;
  return `${amount >= 0 ? '+' : ''}${amount.toFixed(2)}%`;
};

const formatTimeActive = (startedAt, now) => {
  const start = Number(startedAt);
  if (!Number.isFinite(start) || start <= 0) return '0m';

  const elapsedMs = Math.max(0, now - start);
  const totalMinutes = Math.floor(elapsedMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const formatNextOpen = (nextOpen) => {
  if (!nextOpen) return '';
  const date = nextOpen instanceof Date ? nextOpen : new Date(nextOpen);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/New_York',
  });
};

const resolveStatus = (strategy) => {
  if (strategy?.pausedReason === 'market_closed' || strategy?.statusLabel === 'Paused - Market Closed') {
    return {
      label: 'Paused - Market Closed',
      className: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
      isPaused: true,
      isMarketPaused: true,
    };
  }

  const normalized = String(strategy?.runStatus || strategy?.status || '').toLowerCase();
  if (normalized === 'paused') {
    return {
      label: 'Paused',
      className: 'bg-slate-500/20 text-slate-300 border border-slate-400/30',
      isPaused: true,
      isMarketPaused: false,
    };
  }

  return {
    label: 'Active',
    className: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
    isPaused: false,
    isMarketPaused: false,
  };
};

const ActiveTrades = ({
  setActiveTab,
  strategies = [],
  setStrategies,
  onTogglePause,
  onStopStrategy,
  marketStatus,
  nextMarketOpen,
}) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const activeStrategies = useMemo(() => {
    if (!Array.isArray(strategies)) return [];
    return [...strategies]
      .filter((strategy) => strategy && typeof strategy === 'object')
      .sort((a, b) => Number(b.activatedAt || b.deployedAt || 0) - Number(a.activatedAt || a.deployedAt || 0));
  }, [strategies]);

  const resolvedMarketStatus = marketStatus || getMarketStatus();
  const resolvedNextOpen = nextMarketOpen || getNextMarketOpen();
  const marketOpen = isMarketOpen();

  const togglePauseFallback = (strategyId) => {
    if (!setStrategies) return;

    setStrategies((prev) => prev.map((strategy) => {
      if (String(strategy.id) !== String(strategyId)) return strategy;
      const status = resolveStatus(strategy);
      if (status.isMarketPaused) return strategy;

      if (status.isPaused) {
        return {
          ...strategy,
          status: marketOpen ? 'active' : 'paused',
          runStatus: marketOpen ? 'running' : 'paused',
          pausedReason: marketOpen ? null : 'market_closed',
          statusLabel: marketOpen ? 'Active' : 'Paused - Market Closed',
        };
      }

      return {
        ...strategy,
        status: 'paused',
        runStatus: 'paused',
        pausedReason: 'user',
        statusLabel: 'Paused',
      };
    }));
  };

  const stopFallback = (strategyId) => {
    if (!setStrategies) return;
    setStrategies((prev) => prev.filter((strategy) => String(strategy.id) !== String(strategyId)));
  };

  return (
    <div className="h-full bg-[#0b0b0b] text-white flex flex-col overflow-hidden">
      <div className="px-6 py-5 border-b border-[#1f1f1f] flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Active Strategies</h1>
          <p className="text-xs text-white/45 mt-1">
            Live paper-trading runtime with Alpaca market data and market-hours enforcement.
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.16em] text-white/45">Active Count</div>
          <div className="text-2xl font-semibold text-emerald-300">{activeStrategies.length}</div>
        </div>
      </div>

      {resolvedMarketStatus !== 'Open' && (
        <div className="mx-6 mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <div>Market is closed. Strategies will resume at market open.</div>
          <div className="text-xs text-amber-100/80 mt-1">
            Status: {resolvedMarketStatus}
            {formatNextOpen(resolvedNextOpen) ? ` • Next open: ${formatNextOpen(resolvedNextOpen)} ET` : ''}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto px-6 pb-6 pt-4">
        {activeStrategies.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center">
            <div className="text-sm text-white/70">No active strategies. Go to Strategies to activate your first one.</div>
            <button
              type="button"
              onClick={() => setActiveTab?.('strategies')}
              className="mt-4 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-medium hover:bg-emerald-500/30 transition-colors"
            >
              Activate a Strategy
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {activeStrategies.map((strategy) => {
              const status = resolveStatus(strategy);
              const pnl = Number(strategy?.paper?.pnl ?? strategy?.pnl ?? 0);
              const pnlPct = Number(strategy?.paper?.pnlPercent ?? strategy?.pnlPct ?? 0);
              const startedAt = strategy?.activatedAt || strategy?.deployedAt || Date.now();
              const isPnlPositive = pnl >= 0;

              return (
                <div
                  key={strategy.id}
                  className="rounded-xl border border-[#1f1f1f] bg-[#111111] px-4 py-3 grid grid-cols-[2fr_1.1fr_1fr_1fr_0.9fr_auto] gap-3 items-center"
                >
                  <div>
                    <div className="text-sm font-semibold text-white/95">{strategy.name || 'Untitled Strategy'}</div>
                    <div className="text-xs text-white/45 mt-0.5">{strategy.symbol || strategy.ticker || 'N/A'} • {strategy.type || strategy.strategyType || 'Custom'}</div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-[0.12em] text-white/35">Type</div>
                    <div className="text-xs text-white/80 mt-0.5">{strategy.type || strategy.strategyType || 'Custom'}</div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-[0.12em] text-white/35">Status</div>
                    <div className={`inline-flex mt-1 px-2 py-1 rounded-md text-[11px] font-medium ${status.className}`}>
                      {status.label}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-[0.12em] text-white/35">Current P&L</div>
                    <div className={`text-sm font-semibold mt-0.5 ${isPnlPositive ? 'text-emerald-300' : 'text-red-300'}`}>
                      {formatMoney(pnl)}
                    </div>
                    <div className={`text-[11px] ${isPnlPositive ? 'text-emerald-200/80' : 'text-red-200/80'}`}>
                      {formatPercent(pnlPct)}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-[0.12em] text-white/35">Time Active</div>
                    <div className="text-xs text-white/75 mt-0.5">{formatTimeActive(startedAt, now)}</div>
                  </div>

                  <div className="flex items-center gap-2 justify-end">
                    <button
                      type="button"
                      disabled={status.isMarketPaused}
                      onClick={() => {
                        if (onTogglePause) {
                          onTogglePause(strategy.id);
                          return;
                        }
                        togglePauseFallback(strategy.id);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-white/15 text-white/85 hover:bg-white/5 disabled:opacity-45 disabled:cursor-not-allowed"
                    >
                      {status.isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                      {status.isPaused ? 'Resume' : 'Pause'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (onStopStrategy) {
                          onStopStrategy(strategy.id);
                          return;
                        }
                        stopFallback(strategy.id);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-red-500/30 text-red-300 hover:bg-red-500/10"
                    >
                      <Square className="w-3.5 h-3.5" />
                      Stop
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveTrades;
