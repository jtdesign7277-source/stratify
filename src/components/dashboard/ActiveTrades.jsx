import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Share2, X } from 'lucide-react';
import { PnLShareCard } from './PnLShareCard';

const strategiesSeed = [
  { id: 'nvda', symbol: 'NVDA', name: 'NVDA Momentum', status: 'Live', pnl: 1824.32, pnlPct: 2.8, heat: 88 },
  { id: 'aapl', symbol: 'AAPL', name: 'AAPL Mean Revert', status: 'Scaling', pnl: 642.15, pnlPct: 1.2, heat: 61 },
  { id: 'tsla', symbol: 'TSLA', name: 'TSLA Breakout', status: 'Cooling', pnl: -412.5, pnlPct: -0.9, heat: 92 },
  { id: 'spy', symbol: 'SPY', name: 'SPY Drift', status: 'Hedged', pnl: 318.22, pnlPct: 0.4, heat: 48 },
  { id: 'meta', symbol: 'META', name: 'META Scalper', status: 'Live', pnl: 956.80, pnlPct: 1.8, heat: 72 },
  { id: 'amzn', symbol: 'AMZN', name: 'AMZN Swing', status: 'Scaling', pnl: 1247.55, pnlPct: 2.1, heat: 55 },
];

// Completed trades with entry and exit prices
const tradesByStrategy = {
  nvda: [
    { id: 'nvda-1', timestamp: '2026-02-05T15:42:00', qty: 30, entryPrice: 684.50, exitPrice: 689.25, pnl: 142.5 },
    { id: 'nvda-2', timestamp: '2026-02-05T14:18:00', qty: 20, entryPrice: 689.90, exitPrice: 694.80, pnl: 98.0 },
    { id: 'nvda-3', timestamp: '2026-02-05T13:05:00', qty: 25, entryPrice: 683.45, exitPrice: 681.10, pnl: -58.75 },
    { id: 'nvda-4', timestamp: '2026-02-05T11:44:00', qty: 18, entryPrice: 683.38, exitPrice: 687.40, pnl: 72.4 },
    { id: 'nvda-5', timestamp: '2026-02-04T15:12:00', qty: 40, entryPrice: 669.13, exitPrice: 672.30, pnl: 126.9 },
    { id: 'nvda-6', timestamp: '2026-02-04T13:36:00', qty: 24, entryPrice: 668.62, exitPrice: 666.90, pnl: -41.2 },
  ],
  aapl: [
    { id: 'aapl-1', timestamp: '2026-02-05T15:20:00', qty: 120, entryPrice: 195.70, exitPrice: 196.44, pnl: 88.2 },
    { id: 'aapl-2', timestamp: '2026-02-05T14:02:00', qty: 150, entryPrice: 195.33, exitPrice: 195.10, pnl: -34.5 },
    { id: 'aapl-3', timestamp: '2026-02-05T12:50:00', qty: 90, entryPrice: 196.62, exitPrice: 197.20, pnl: 52.1 },
    { id: 'aapl-4', timestamp: '2026-02-05T11:15:00', qty: 110, entryPrice: 194.56, exitPrice: 194.80, pnl: 26.7 },
    { id: 'aapl-5', timestamp: '2026-02-04T15:05:00', qty: 80, entryPrice: 198.32, exitPrice: 198.05, pnl: -21.9 },
    { id: 'aapl-6', timestamp: '2026-02-04T13:22:00', qty: 140, entryPrice: 193.31, exitPrice: 193.60, pnl: 41.3 },
  ],
  tsla: [
    { id: 'tsla-1', timestamp: '2026-02-05T15:48:00', qty: 60, entryPrice: 238.39, exitPrice: 236.80, pnl: -95.4 },
    { id: 'tsla-2', timestamp: '2026-02-05T14:27:00', qty: 45, entryPrice: 237.65, exitPrice: 238.60, pnl: 42.8 },
    { id: 'tsla-3', timestamp: '2026-02-05T13:02:00', qty: 50, entryPrice: 236.40, exitPrice: 235.10, pnl: -64.9 },
    { id: 'tsla-4', timestamp: '2026-02-05T11:36:00', qty: 70, entryPrice: 231.95, exitPrice: 232.40, pnl: 31.2 },
    { id: 'tsla-5', timestamp: '2026-02-04T15:28:00', qty: 40, entryPrice: 241.87, exitPrice: 239.90, pnl: -78.6 },
    { id: 'tsla-6', timestamp: '2026-02-04T12:54:00', qty: 65, entryPrice: 230.80, exitPrice: 231.70, pnl: 58.3 },
  ],
  spy: [
    { id: 'spy-1', timestamp: '2026-02-05T15:31:00', qty: 80, entryPrice: 496.56, exitPrice: 497.12, pnl: 44.8 },
    { id: 'spy-2', timestamp: '2026-02-05T14:10:00', qty: 75, entryPrice: 498.90, exitPrice: 498.60, pnl: -22.4 },
    { id: 'spy-3', timestamp: '2026-02-05T12:45:00', qty: 90, entryPrice: 495.97, exitPrice: 496.40, pnl: 38.7 },
    { id: 'spy-4', timestamp: '2026-02-05T11:05:00', qty: 70, entryPrice: 497.73, exitPrice: 497.90, pnl: 12.2 },
    { id: 'spy-5', timestamp: '2026-02-04T15:18:00', qty: 85, entryPrice: 495.81, exitPrice: 495.60, pnl: -18.1 },
    { id: 'spy-6', timestamp: '2026-02-04T13:40:00', qty: 65, entryPrice: 496.39, exitPrice: 496.80, pnl: 26.5 },
  ],
  meta: [
    { id: 'meta-1', timestamp: '2026-02-05T15:52:00', qty: 55, entryPrice: 410.44, exitPrice: 411.80, pnl: 74.6 },
    { id: 'meta-2', timestamp: '2026-02-05T14:33:00', qty: 60, entryPrice: 409.68, exitPrice: 409.20, pnl: -28.7 },
    { id: 'meta-3', timestamp: '2026-02-05T13:18:00', qty: 48, entryPrice: 411.33, exitPrice: 412.60, pnl: 61.1 },
    { id: 'meta-4', timestamp: '2026-02-05T11:58:00', qty: 62, entryPrice: 408.11, exitPrice: 408.70, pnl: 36.9 },
    { id: 'meta-5', timestamp: '2026-02-04T15:22:00', qty: 50, entryPrice: 413.49, exitPrice: 413.10, pnl: -19.3 },
    { id: 'meta-6', timestamp: '2026-02-04T12:30:00', qty: 68, entryPrice: 405.62, exitPrice: 406.40, pnl: 52.8 },
  ],
  amzn: [
    { id: 'amzn-1', timestamp: '2026-02-05T15:38:00', qty: 140, entryPrice: 177.88, exitPrice: 178.32, pnl: 62.4 },
    { id: 'amzn-2', timestamp: '2026-02-05T14:14:00', qty: 120, entryPrice: 178.70, exitPrice: 179.10, pnl: 48.3 },
    { id: 'amzn-3', timestamp: '2026-02-05T13:03:00', qty: 160, entryPrice: 177.81, exitPrice: 177.60, pnl: -33.6 },
    { id: 'amzn-4', timestamp: '2026-02-05T11:41:00', qty: 110, entryPrice: 178.65, exitPrice: 178.90, pnl: 27.1 },
    { id: 'amzn-5', timestamp: '2026-02-04T15:08:00', qty: 150, entryPrice: 175.86, exitPrice: 176.20, pnl: 51.5 },
    { id: 'amzn-6', timestamp: '2026-02-04T13:14:00', qty: 130, entryPrice: 175.79, exitPrice: 175.60, pnl: -24.9 },
  ],
};

const statusStyles = {
  Live: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  Scaling: 'border-sky-400/40 bg-sky-400/10 text-sky-200',
  Hedged: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  Cooling: 'border-red-400/40 bg-red-500/10 text-red-300',
};

const formatMoney = (value) =>
  `${value >= 0 ? '+' : ''}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatPrice = (value) =>
  `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatTimestamp = (timestamp) =>
  new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

// Determine signal strength based on P&L % and heat
const getSignalHealth = (pnlPct, heat) => {
  if (pnlPct >= 2 && heat < 80) return 'PRINTING';
  if (pnlPct < 0 && heat > 85) return 'DANGER';
  if (pnlPct < 0 || heat > 80) return 'STRUGGLING';
  return 'NEUTRAL';
};

const signalConfig = {
  PRINTING: { bars: 5, color: '#10b981', animation: 'shimmer' },
  NEUTRAL: { bars: 3, color: '#06b6d4', animation: 'none' },
  STRUGGLING: { bars: 2, color: '#f59e0b', animation: 'none' },
  DANGER: { bars: 1, color: '#ef4444', animation: 'blink' },
};

// Signal Bars Component (like phone signal strength)
const SignalBars = ({ health }) => {
  const config = signalConfig[health];
  const barHeights = [6, 10, 14, 18, 22];
  
  return (
    <div className="flex items-end gap-[3px] h-6">
      {barHeights.map((height, i) => {
        const isLit = i < config.bars;
        const barStyle = {
          width: 4,
          height,
          borderRadius: 2,
          backgroundColor: isLit ? config.color : '#1e1e2d',
          boxShadow: isLit ? `0 0 8px ${config.color}80` : 'none',
        };
        
        if (isLit && config.animation === 'shimmer') {
          return (
            <motion.div
              key={i}
              style={barStyle}
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
            />
          );
        }
        
        if (isLit && config.animation === 'blink') {
          return (
            <motion.div
              key={i}
              style={barStyle}
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
          );
        }
        
        return <div key={i} style={barStyle} />;
      })}
    </div>
  );
};

const ActiveTrades = () => {
  const [totalPnl, setTotalPnl] = useState(4823.12);
  const [pnlDelta, setPnlDelta] = useState(0);
  const [strategies, setStrategies] = useState(strategiesSeed);
  const [shareOpen, setShareOpen] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [tradePanelOpen, setTradePanelOpen] = useState(false);
  const [tradePanelStrategy, setTradePanelStrategy] = useState(null);
  const confettiCanvasRef = useRef(null);
  const confettiInstanceRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const delta = Number((Math.random() * 380 - 90).toFixed(2));
      setPnlDelta(delta);
      setTotalPnl((prev) => Number((prev + delta).toFixed(2)));
      setStrategies((prev) =>
        prev.map((strategy) => {
          const drift = Number((Math.random() * 120 - 45).toFixed(2));
          return strategy.id === 'tsla'
            ? { ...strategy, pnl: Number((strategy.pnl + drift).toFixed(2)) }
            : { ...strategy, pnl: Number((strategy.pnl + drift * 0.4).toFixed(2)) };
        })
      );
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (confettiCanvasRef.current && !confettiInstanceRef.current) {
      confettiInstanceRef.current = confetti.create(confettiCanvasRef.current, {
        resize: true,
        useWorker: true,
      });
    }
  }, []);

  useEffect(() => {
    if (!confettiInstanceRef.current) return;
    if (pnlDelta > 280 || totalPnl >= 7500) {
      confettiInstanceRef.current({
        particleCount: 40,
        spread: 75,
        startVelocity: 55,
        origin: { x: 0.8, y: 0.2 },
        colors: ['#10b981', '#34d399', '#facc15', '#22c55e'],
      });
    }
  }, [pnlDelta, totalPnl]);

  const pnlAccent = totalPnl >= 0 ? 'text-emerald-500' : 'text-red-500';
  const activeTrades = useMemo(() => {
    if (!tradePanelStrategy) return [];
    const trades = tradesByStrategy[tradePanelStrategy.id] || [];
    return [...trades].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [tradePanelStrategy]);

  return (
    <div className="relative h-screen bg-[#0a0a0f] text-white overflow-hidden flex flex-col">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.12),transparent_50%)]" />
      <canvas ref={confettiCanvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />

      <div className="relative z-10 px-5 py-4 flex flex-col flex-1">
        {/* Compact Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-400/70">Total P&L</div>
            <AnimatePresence mode="popLayout">
              <motion.div
                key={totalPnl.toFixed(0)}
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -8, opacity: 0 }}
                className={`text-3xl font-bold ${pnlAccent}`}
              >
                {formatMoney(totalPnl)}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Active</div>
            <div className="text-xl font-semibold text-white">{strategies.length}</div>
          </div>
        </div>

        {/* Strategy Cards Grid - Compact 3-column layout */}
        <div className="grid grid-cols-3 gap-2.5">
          {strategies.map((strategy, index) => {
            const isProfitable = strategy.pnl >= 0;
            const health = getSignalHealth(strategy.pnlPct, strategy.heat);

            return (
              <motion.div
                key={strategy.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04, duration: 0.3 }}
                whileHover={{ y: -2, scale: 1.01 }}
                onClick={() => {
                  setTradePanelStrategy(strategy);
                  setTradePanelOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setTradePanelStrategy(strategy);
                    setTradePanelOpen(true);
                  }
                }}
                role="button"
                tabIndex={0}
                className="rounded-lg border border-[#1e1e2d] bg-[#0f0f16] p-2.5 hover:border-emerald-500/30 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
              >
                {/* Row 1: Ticker + Status + Share */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-gray-500">
                    {strategy.symbol}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedStrategy({
                          strategyName: strategy.name,
                          pnlAmount: strategy.pnl,
                          pnlPercent: strategy.pnlPct,
                          winRate: 67,
                          totalTrades: 28,
                          chartData: [100, 102, 98, 105, 108, 104, 112],
                        });
                        setShareOpen(true);
                      }}
                      className="w-6 h-6 rounded bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/50 transition-all flex items-center justify-center group"
                    >
                      <Share2 className="w-3 h-3 text-gray-400 group-hover:text-emerald-400" fill="none" strokeWidth={1.5} />
                    </button>
                    <span className={`text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${statusStyles[strategy.status]}`}>
                      {strategy.status}
                    </span>
                  </div>
                </div>

                {/* Row 2: Strategy Name */}
                <div className="text-xs font-semibold text-white mb-1.5 truncate">
                  {strategy.name}
                </div>

                {/* Row 3: P&L + Signal Bars */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className={`text-base font-bold ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatMoney(strategy.pnl)}
                  </div>
                  <SignalBars health={health} />
                </div>

                {/* Row 4: Stats inline */}
                <div className="flex items-center justify-between text-[9px]">
                  <span className={isProfitable ? 'text-emerald-300' : 'text-red-300'}>
                    {strategy.pnlPct > 0 ? '+' : ''}{strategy.pnlPct}% today
                  </span>
                  <span className={strategy.heat > 75 ? 'text-amber-300' : 'text-gray-400'}>
                    Heat {strategy.heat}%
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {tradePanelOpen && tradePanelStrategy && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTradePanelOpen(false)}
            />
            <motion.aside
              className="fixed left-0 top-0 z-50 h-full w-full sm:w-[420px] bg-[#0f0f16] border-r border-[#1e1e2d] shadow-[0_0_45px_rgba(0,0,0,0.6)] flex flex-col"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 260, damping: 32 }}
            >
              <div className="px-5 pt-5 pb-4 border-b border-[#1e1e2d] bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_60%)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-400/70">
                      {tradePanelStrategy.symbol} Trades
                    </div>
                    <div className="text-lg font-semibold text-white">{tradePanelStrategy.name}</div>
                    <div className="mt-1 text-[11px] text-gray-400">
                      Most recent executions first. Scroll for older fills.
                    </div>
                  </div>
                  <button
                    onClick={() => setTradePanelOpen(false)}
                    className="w-9 h-9 rounded-lg border border-[#1e1e2d] bg-[#0a0a0f] hover:border-emerald-500/40 hover:bg-emerald-500/10 transition flex items-center justify-center"
                  >
                    <X className="w-4 h-4 text-gray-400 hover:text-emerald-300" fill="none" strokeWidth={1.5} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 pb-6 pt-4 space-y-3">
                {activeTrades.map((trade) => {
                  const pnlColor = trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400';
                  const isProfit = trade.pnl >= 0;

                  return (
                    <div
                      key={trade.id}
                      className="rounded-lg border border-[#1e1e2d] bg-[#0a0a0f] p-4 transition hover:border-emerald-500/30 hover:shadow-[0_0_18px_rgba(16,185,129,0.08)]"
                    >
                      {/* Header: Date + P&L */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-semibold text-white">{formatTimestamp(trade.timestamp)}</div>
                        <div className={`text-base font-bold ${pnlColor}`}>{formatMoney(trade.pnl)}</div>
                      </div>
                      
                      {/* Entry / Exit prices */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex-1 rounded-md bg-[#0f0f16] border border-[#1e1e2d] p-2.5">
                          <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Entry</div>
                          <div className="text-sm font-semibold text-white">{formatPrice(trade.entryPrice)}</div>
                        </div>
                        <div className="text-gray-500">→</div>
                        <div className="flex-1 rounded-md bg-[#0f0f16] border border-[#1e1e2d] p-2.5">
                          <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-1">Exit</div>
                          <div className={`text-sm font-semibold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>{formatPrice(trade.exitPrice)}</div>
                        </div>
                      </div>
                      
                      {/* Qty */}
                      <div className="text-xs text-gray-400">
                        Quantity: <span className="text-white font-medium">{trade.qty} shares</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <PnLShareCard
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        strategyData={selectedStrategy}
      />
    </div>
  );
};

export default ActiveTrades;
