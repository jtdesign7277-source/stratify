"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Play,
  Square,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Shield,
  Target,
  DollarSign,
  BarChart3,
  Zap,
} from "lucide-react";
import clsx from "clsx";

const STORAGE_KEY = "second-brain-active-strategies";

const DEFAULT_CONDITIONS = [
  {
    id: "entry-signal",
    label: "Entry Signal Confirmed",
    description: "Primary entry condition met (RSI, MACD, breakout, etc.)",
    icon: <TrendingUp className="h-4 w-4" />,
  },
  {
    id: "volume-check",
    label: "Volume Above Average",
    description: "Trading volume exceeds 20-day average",
    icon: <BarChart3 className="h-4 w-4" />,
  },
  {
    id: "trend-alignment",
    label: "Trend Alignment",
    description: "Trade direction aligns with higher timeframe trend",
    icon: <Zap className="h-4 w-4" />,
  },
  {
    id: "risk-reward",
    label: "Risk/Reward ≥ 2:1",
    description: "Potential reward is at least 2x the risk",
    icon: <Target className="h-4 w-4" />,
  },
  {
    id: "stop-loss-set",
    label: "Stop Loss Defined",
    description: "Stop loss level is set and within acceptable range",
    icon: <Shield className="h-4 w-4" />,
  },
  {
    id: "position-sized",
    label: "Position Size OK",
    description: "Position size within risk limits",
    icon: <DollarSign className="h-4 w-4" />,
  },
];

function loadActiveStrategies() {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveActiveStrategies(strategies) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(strategies));
}

export default function StrategyActivation({
  documentId,
  title,
}) {
  const [strategy, setStrategy] = useState(null);
  const [conditions, setConditions] = useState(
    DEFAULT_CONDITIONS.map((c) => ({ ...c, checked: false }))
  );
  const [symbol, setSymbol] = useState("NVDA");
  const [positionSize, setPositionSize] = useState(10000);
  const [maxDailyTrades, setMaxDailyTrades] = useState(10);
  const [stopLoss, setStopLoss] = useState(2);
  const [takeProfit, setTakeProfit] = useState(4);

  // Load existing strategy state from API + localStorage fallback
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/strategies?userId=local`);
        if (res.ok) {
          const data = await res.json();
          const existing = (data.strategies ?? []).find(
            (s) => s.documentId === documentId
          );
          if (existing) {
            setStrategy(existing);
            setSymbol(existing.symbol);
            setPositionSize(existing.positionSize);
            setMaxDailyTrades(existing.maxDailyTrades);
            setStopLoss(existing.stopLossPercent);
            setTakeProfit(existing.takeProfitPercent);
            setConditions(
              DEFAULT_CONDITIONS.map((c) => ({
                ...c,
                checked: existing.conditions.find(
                  (ec) => ec.id === c.id
                )?.checked ?? false,
              }))
            );
            return;
          }
        }
      } catch {}
      // Fallback to localStorage
      const all = loadActiveStrategies();
      const existing = all.find((s) => s.documentId === documentId);
      if (existing) {
        setStrategy(existing);
        setSymbol(existing.symbol);
        setPositionSize(existing.positionSize);
        setMaxDailyTrades(existing.maxDailyTrades);
        setStopLoss(existing.stopLossPercent);
        setTakeProfit(existing.takeProfitPercent);
        setConditions(
          DEFAULT_CONDITIONS.map((c) => ({
            ...c,
            checked: existing.conditions.find((ec) => ec.id === c.id)?.checked ?? false,
          }))
        );
      }
    }
    load();
  }, [documentId]);

  // Sync between cloned panels via custom events
  useEffect(() => {
    const handler = (e) => {
      const detail = e.detail;
      if (detail.documentId !== documentId) return;
      if (detail.conditions) setConditions(detail.conditions);
      if (detail.symbol !== undefined) setSymbol(detail.symbol);
      if (detail.positionSize !== undefined) setPositionSize(detail.positionSize);
      if (detail.maxDailyTrades !== undefined) setMaxDailyTrades(detail.maxDailyTrades);
      if (detail.stopLoss !== undefined) setStopLoss(detail.stopLoss);
      if (detail.takeProfit !== undefined) setTakeProfit(detail.takeProfit);
      if (detail.strategy !== undefined) setStrategy(detail.strategy);
    };
    window.addEventListener("strategy-sync", handler);
    return () => window.removeEventListener("strategy-sync", handler);
  }, [documentId]);

  const syncPanels = (updates) => {
    window.dispatchEvent(
      new CustomEvent("strategy-sync", {
        detail: { documentId, ...updates },
      })
    );
  };

  const toggleCondition = (id) => {
    setConditions((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c));
      syncPanels({ conditions: next });
      return next;
    });
  };

  const allChecked = conditions.every((c) => c.checked);
  const checkedCount = conditions.filter((c) => c.checked).length;
  const isActive = strategy?.status === "active" || strategy?.status === "executing";

  const handleActivate = useCallback(async () => {
    const payload = {
      userId: "local",
      documentId,
      title,
      symbol,
      positionSize,
      maxDailyTrades,
      stopLossPercent: stopLoss,
      takeProfitPercent: takeProfit,
      conditions: conditions.map((c) => ({
        id: c.id,
        label: c.label,
        checked: c.checked,
      })),
      status: "active",
    };

    // Save to API (server-side — cron can read this)
    try {
      const res = await fetch("/api/strategies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        setStrategy(data.strategy);
      }
    } catch {}

    // Also save to localStorage as fallback
    const newStrategy = {
      documentId,
      title,
      symbol,
      positionSize,
      maxDailyTrades,
      stopLossPercent: stopLoss,
      takeProfitPercent: takeProfit,
      conditions: conditions.map((c) => ({
        id: c.id,
        label: c.label,
        checked: c.checked,
      })),
      status: "active",
      activatedAt: new Date().toISOString(),
      trades: strategy?.trades ?? [],
    };
    const all = loadActiveStrategies().filter((s) => s.documentId !== documentId);
    all.push(newStrategy);
    saveActiveStrategies(all);
    if (!strategy) setStrategy(newStrategy);

    // Notify trade dashboard to refresh
    window.dispatchEvent(new Event("strategy-activated"));

    // Log activation to Second Brain
    fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `📊 Strategy Activated: ${title}`,
        content: `# Strategy Activated\n\n**${title}**\n- Symbol: $${symbol}\n- Position Size: $${positionSize.toLocaleString()}\n- Stop Loss: ${stopLoss}%\n- Take Profit: ${takeProfit}%\n- Max Daily Trades: ${maxDailyTrades}\n- Conditions: ${checkedCount}/${conditions.length} checked\n- Activated: ${new Date().toLocaleString()}\n\nTradeBot will begin monitoring on next market open.`,
        folder: "cron:trade-log",
      }),
    }).catch(() => {});
  }, [documentId, title, symbol, positionSize, maxDailyTrades, stopLoss, takeProfit, conditions, checkedCount, strategy]);

  const handleDeactivate = useCallback(async () => {
    // Remove from API
    try {
      await fetch(`/api/strategies?userId=local&documentId=${documentId}`, {
        method: "DELETE",
      });
    } catch {}

    // Remove from localStorage
    const all = loadActiveStrategies().filter((s) => s.documentId !== documentId);
    saveActiveStrategies(all);
    setStrategy(null);
    setConditions(DEFAULT_CONDITIONS.map((c) => ({ ...c, checked: false })));
    window.dispatchEvent(new Event("strategy-activated"));
  }, [documentId]);

  return (
    <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div
            className={clsx(
              "flex h-7 w-7 items-center justify-center rounded-lg border",
              isActive
                ? "bg-emerald-500/10 border-emerald-500/30"
                : "bg-zinc-800/50 border-zinc-700"
            )}
          >
            <Target
              className={clsx(
                "h-3.5 w-3.5",
                isActive ? "text-emerald-400" : "text-zinc-500"
              )}
            />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white">Strategy Activation</h3>
            <p className="text-[10px] text-zinc-500 leading-tight">
              {isActive
                ? "Live — TradeBot monitoring"
                : "Check conditions to activate"}
            </p>
          </div>
        </div>

        {/* Status badge */}
        {strategy && (
          <div
            className={clsx(
              "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
              strategy.status === "active" &&
                "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
              strategy.status === "executing" &&
                "bg-amber-500/10 text-amber-400 border border-amber-500/20",
              strategy.status === "paused" &&
                "bg-zinc-800 text-zinc-400 border border-zinc-700",
              strategy.status === "inactive" &&
                "bg-zinc-800 text-zinc-500 border border-zinc-700"
            )}
          >
            <span
              className={clsx(
                "h-1.5 w-1.5 rounded-full",
                strategy.status === "active" && "bg-emerald-400 animate-pulse",
                strategy.status === "executing" && "bg-amber-400 animate-pulse",
                strategy.status === "paused" && "bg-zinc-500",
                strategy.status === "inactive" && "bg-zinc-600"
              )}
            />
            {strategy.status.charAt(0).toUpperCase() + strategy.status.slice(1)}
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="border-b border-zinc-800 px-4 py-3 space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[9px] uppercase tracking-wide text-zinc-500">Symbol</label>
            <input
              value={symbol}
              onChange={(e) => { const v = e.target.value.toUpperCase(); setSymbol(v); syncPanels({ symbol: v }); }}
              disabled={isActive}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-xs font-mono text-amber-400 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-[9px] uppercase tracking-wide text-zinc-500">Size</label>
            <div className="relative mt-1">
              <span className="absolute left-2 top-1 text-xs text-zinc-500">$</span>
              <input
                type="number"
                value={positionSize}
                onChange={(e) => { const v = Number(e.target.value); setPositionSize(v); syncPanels({ positionSize: v }); }}
                disabled={isActive}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800/50 pl-5 pr-1 py-1 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
              />
            </div>
          </div>
          <div>
            <label className="text-[9px] uppercase tracking-wide text-zinc-500">Max/Day</label>
            <input
              type="number"
              value={maxDailyTrades}
              onChange={(e) => { const v = Number(e.target.value); setMaxDailyTrades(v); syncPanels({ maxDailyTrades: v }); }}
              disabled={isActive}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] uppercase tracking-wide text-zinc-500">Stop Loss %</label>
            <input
              type="number"
              value={stopLoss}
              onChange={(e) => { const v = Number(e.target.value); setStopLoss(v); syncPanels({ stopLoss: v }); }}
              disabled={isActive}
              step={0.5}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-xs text-red-400 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-[9px] uppercase tracking-wide text-zinc-500">Take Profit %</label>
            <input
              type="number"
              value={takeProfit}
              onChange={(e) => { const v = Number(e.target.value); setTakeProfit(v); syncPanels({ takeProfit: v }); }}
              disabled={isActive}
              step={0.5}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800/50 px-2 py-1 text-xs text-emerald-400 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
            />
          </div>
        </div>
      </div>

      {/* Conditions checklist */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            Pre-Trade Checklist
          </span>
          <span className="text-[10px] text-zinc-600">
            {checkedCount}/{conditions.length}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {conditions.map((condition) => (
            <button
              key={condition.id}
              type="button"
              onClick={() => !isActive && toggleCondition(condition.id)}
              disabled={isActive}
              className={clsx(
                "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition",
                condition.checked
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : "border-zinc-800 bg-zinc-900/30 hover:border-zinc-700",
                isActive && "opacity-60 cursor-default"
              )}
            >
              {/* Checkbox */}
              <div
                className={clsx(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",
                  condition.checked
                    ? "border-emerald-500 bg-emerald-500"
                    : "border-zinc-600 bg-zinc-800"
                )}
              >
                {condition.checked && (
                  <CheckCircle2 className="h-3 w-3 text-white" />
                )}
              </div>

              <div className="min-w-0">
                <span
                  className={clsx(
                    "text-[11px] font-medium leading-tight",
                    condition.checked ? "text-white" : "text-zinc-300"
                  )}
                >
                  {condition.label}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between border-t border-zinc-800 px-4 py-2.5">
        {!isActive ? (
          <>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              {!allChecked && (
                <>
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                  <span>Check all conditions to activate</span>
                </>
              )}
              {allChecked && (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">All conditions met — ready to activate</span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={handleActivate}
              disabled={!allChecked}
              className={clsx(
                "flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition",
                allChecked
                  ? "bg-emerald-600 text-white hover:bg-emerald-500"
                  : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
              )}
            >
              <Play className="h-4 w-4" />
              Activate Strategy
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400">
                TradeBot monitoring ${symbol} — paper trading
              </span>
              {strategy?.activatedAt && (
                <span className="text-zinc-600">
                  · since {new Date(strategy.activatedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleDeactivate}
              className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-5 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/20"
            >
              <Square className="h-4 w-4" />
              Stop Strategy
            </button>
          </>
        )}
      </div>

      {/* Trade log */}
      {strategy && strategy.trades.length > 0 && (
        <div className="border-t border-zinc-800 px-5 py-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2 block">
            Recent Trades
          </span>
          <div className="space-y-1">
            {strategy.trades.slice(-5).reverse().map((trade) => (
              <div
                key={trade.id}
                className="flex items-center justify-between rounded-md bg-zinc-800/30 px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={clsx(
                      "font-bold",
                      trade.action === "BUY" ? "text-emerald-400" : "text-red-400"
                    )}
                  >
                    {trade.action}
                  </span>
                  <span className="font-mono text-amber-400">${trade.symbol}</span>
                  <span className="text-zinc-400">
                    {trade.quantity} shares @ ${trade.price.toFixed(2)}
                  </span>
                </div>
                <span className="text-zinc-600">
                  {new Date(trade.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
