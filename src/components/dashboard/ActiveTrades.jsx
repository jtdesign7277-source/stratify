import React, { useEffect, useMemo, useState } from 'react';
import { Pause, Play, Square } from 'lucide-react';
import { getMarketStatus, getNextMarketOpen, isMarketOpen } from '../../lib/marketHours';

const formatCurrency = (value = 0) => {
  const amount = Number(value) || 0;
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

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

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const sanitizeCurrencyInput = (value) => String(value || '').replace(/[^0-9.]/g, '');

const getStrategyAllocation = (strategy) => {
  const allocation = Number(strategy?.paper?.allocation ?? strategy?.allocation ?? 0);
  return Number.isFinite(allocation) && allocation > 0 ? allocation : 0;
};

const ActiveTrades = ({
  setActiveTab,
  strategies = [],
  setStrategies,
  onTogglePause,
  onStopStrategy,
  onAllocationChange,
  availableBalance = 0,
  totalPaperBalance = 100000,
  minimumAllocation = 100,
  marketStatus,
  nextMarketOpen,
}) => {
  const [now, setNow] = useState(Date.now());
  const [allocationDrafts, setAllocationDrafts] = useState({});
  const [allocationErrors, setAllocationErrors] = useState({});

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
  const totalAllocated = useMemo(
    () => activeStrategies.reduce((sum, strategy) => sum + getStrategyAllocation(strategy), 0),
    [activeStrategies],
  );
  const normalizedAvailableBalance = Math.max(0, Number(availableBalance) || 0);
  const normalizedPaperBalance = Math.max(0, Number(totalPaperBalance) || 0);
  const displayedAllocated = normalizedPaperBalance > 0
    ? Math.max(0, normalizedPaperBalance - normalizedAvailableBalance)
    : totalAllocated;

  useEffect(() => {
    setAllocationDrafts((prev) => {
      const next = { ...prev };
      let changed = false;
      activeStrategies.forEach((strategy) => {
        const id = String(strategy.id);
        const allocation = Math.round(getStrategyAllocation(strategy));
        if (next[id] !== String(allocation)) {
          next[id] = String(allocation);
          changed = true;
        }
      });
      Object.keys(next).forEach((id) => {
        if (!activeStrategies.some((strategy) => String(strategy.id) === id)) {
          delete next[id];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [activeStrategies]);

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

  const submitAllocation = (strategy) => {
    if (!onAllocationChange) return;

    const strategyId = String(strategy.id);
    const currentAllocation = getStrategyAllocation(strategy);
    const maxAllocation = Math.max(minimumAllocation, normalizedAvailableBalance + currentAllocation);
    const parsed = Number(sanitizeCurrencyInput(allocationDrafts[strategyId]));
    const rounded = Math.round(parsed);

    if (!Number.isFinite(rounded)) {
      setAllocationErrors((prev) => ({ ...prev, [strategyId]: 'Enter a valid dollar amount.' }));
      return;
    }

    if (rounded < minimumAllocation) {
      setAllocationErrors((prev) => ({
        ...prev,
        [strategyId]: `Minimum allocation is ${formatCurrency(minimumAllocation)}.`,
      }));
      return;
    }

    if (rounded > maxAllocation) {
      setAllocationErrors((prev) => ({
        ...prev,
        [strategyId]: `Maximum available is ${formatCurrency(maxAllocation)}.`,
      }));
      return;
    }

    const result = onAllocationChange(strategy.id, rounded);
    if (result?.success === false) {
      setAllocationErrors((prev) => ({
        ...prev,
        [strategyId]: result.message || 'Unable to update allocation.',
      }));
      return;
    }

    const resolvedAmount = Number(result?.allocation ?? rounded);
    setAllocationDrafts((prev) => ({ ...prev, [strategyId]: String(Math.round(resolvedAmount)) }));
    setAllocationErrors((prev) => {
      if (!prev[strategyId]) return prev;
      const next = { ...prev };
      delete next[strategyId];
      return next;
    });
  };

  return (
    <div className="h-full bg-transparent text-white flex flex-col overflow-hidden">
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
          <div className="mt-2 text-[10px] uppercase tracking-[0.16em] text-white/45">Available Balance</div>
          <div className="text-sm font-semibold text-emerald-200">{formatCurrency(normalizedAvailableBalance)}</div>
          <div className="text-[11px] text-white/45 mt-0.5">
            Allocated: {formatCurrency(displayedAllocated)}
          </div>
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
            <div className="text-sm text-white/70">No active strategies. Go to Terminal to activate your first one.</div>
            <button
              type="button"
              onClick={() => setActiveTab?.('terminal')}
              className="mt-4 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-medium hover:bg-emerald-500/30 transition-colors"
            >
              Open Terminal
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {activeStrategies.map((strategy) => {
              const status = resolveStatus(strategy);
              const pnl = Number(strategy?.paper?.pnl ?? strategy?.pnl ?? 0);
              const pnlPct = Number(strategy?.paper?.pnlPercent ?? strategy?.pnlPct ?? 0);
              const startedAt = strategy?.activatedAt || strategy?.deployedAt || Date.now();
              const allocation = getStrategyAllocation(strategy);
              const strategyId = String(strategy.id);
              const maxAllocation = Math.max(minimumAllocation, normalizedAvailableBalance + allocation);
              const sliderMax = Math.max(minimumAllocation, Math.floor(maxAllocation));
              const rawInput = allocationDrafts[strategyId] ?? String(Math.round(allocation));
              const parsedInput = Number(sanitizeCurrencyInput(rawInput));
              const sliderValue = clamp(
                Number.isFinite(parsedInput) ? Math.round(parsedInput) : Math.round(allocation || minimumAllocation),
                minimumAllocation,
                sliderMax,
              );
              const isPnlPositive = pnl >= 0;

              return (
                <div
                  key={strategy.id}
                  className="rounded-xl border border-[#1f1f1f] bg-[#111111] px-4 py-3 grid grid-cols-1 xl:grid-cols-[1.8fr_1fr_1fr_1.1fr_1.6fr_auto] gap-3 items-start xl:items-center"
                >
                  <div>
                    <div className="text-sm font-semibold text-white/95">{strategy.name || 'Untitled Strategy'}</div>
                    <div className="text-xs text-white/45 mt-0.5">{strategy.symbol || strategy.ticker || 'N/A'} • {strategy.type || strategy.strategyType || 'Custom'}</div>
                    <div className="mt-2 text-sm font-semibold text-emerald-300">
                      Allocated: {formatCurrency(allocation)}
                    </div>
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
                    <div className="text-[10px] uppercase tracking-[0.12em] text-white/35">Allocation</div>
                    <input
                      type="text"
                      value={rawInput}
                      onChange={(event) => {
                        const cleaned = sanitizeCurrencyInput(event.target.value);
                        setAllocationDrafts((prev) => ({ ...prev, [strategyId]: cleaned }));
                        setAllocationErrors((prev) => {
                          if (!prev[strategyId]) return prev;
                          const next = { ...prev };
                          delete next[strategyId];
                          return next;
                        });
                      }}
                      onBlur={() => submitAllocation(strategy)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') submitAllocation(strategy);
                      }}
                      className="mt-1 w-full rounded-md border border-white/15 bg-[#0b0b0b] px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500/40"
                    />
                    <input
                      type="range"
                      min={minimumAllocation}
                      max={sliderMax}
                      step={100}
                      value={sliderValue}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value);
                        setAllocationDrafts((prev) => ({ ...prev, [strategyId]: String(nextValue) }));
                        const result = onAllocationChange?.(strategy.id, nextValue);
                        if (result?.success === false) {
                          setAllocationErrors((prev) => ({
                            ...prev,
                            [strategyId]: result.message || 'Unable to update allocation.',
                          }));
                          return;
                        }
                        setAllocationErrors((prev) => {
                          if (!prev[strategyId]) return prev;
                          const next = { ...prev };
                          delete next[strategyId];
                          return next;
                        });
                      }}
                      className="mt-2 w-full accent-emerald-400"
                    />
                    <div className="mt-1 text-[10px] text-white/45">
                      Min {formatCurrency(minimumAllocation)} • Max {formatCurrency(maxAllocation)}
                    </div>
                    {allocationErrors[strategyId] && (
                      <div className="mt-1 text-[11px] text-red-300">{allocationErrors[strategyId]}</div>
                    )}
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-[0.12em] text-white/35">Time Active</div>
                    <div className="text-xs text-white/75 mt-0.5">{formatTimeActive(startedAt, now)}</div>
                  </div>

                  <div className="flex items-center gap-2 justify-end w-full xl:w-auto">
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
