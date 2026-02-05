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

const tradesByStrategy = {
  nvda: [
    { id: 'nvda-1', timestamp: '2026-02-05T15:42:00', action: 'BUY', price: 689.25, qty: 30, pnl: 142.5 },
    { id: 'nvda-2', timestamp: '2026-02-05T14:18:00', action: 'SELL', price: 694.8, qty: 20, pnl: 96.2 },
    { id: 'nvda-3', timestamp: '2026-02-05T13:05:00', action: 'BUY', price: 681.1, qty: 25, pnl: -58.75 },
    { id: 'nvda-4', timestamp: '2026-02-05T11:44:00', action: 'SELL', price: 687.4, qty: 18, pnl: 72.4 },
    { id: 'nvda-5', timestamp: '2026-02-04T15:12:00', action: 'BUY', price: 672.3, qty: 40, pnl: 126.9 },
    { id: 'nvda-6', timestamp: '2026-02-04T13:36:00', action: 'SELL', price: 666.9, qty: 24, pnl: -41.2 },
  ],
  aapl: [
    { id: 'aapl-1', timestamp: '2026-02-05T15:20:00', action: 'SELL', price: 196.44, qty: 120, pnl: 88.2 },
    { id: 'aapl-2', timestamp: '2026-02-05T14:02:00', action: 'BUY', price: 195.1, qty: 150, pnl: -34.5 },
    { id: 'aapl-3', timestamp: '2026-02-05T12:50:00', action: 'SELL', price: 197.2, qty: 90, pnl: 52.1 },
    { id: 'aapl-4', timestamp: '2026-02-05T11:15:00', action: 'BUY', price: 194.8, qty: 110, pnl: 26.7 },
    { id: 'aapl-5', timestamp: '2026-02-04T15:05:00', action: 'SELL', price: 198.05, qty: 80, pnl: -21.9 },
    { id: 'aapl-6', timestamp: '2026-02-04T13:22:00', action: 'BUY', price: 193.6, qty: 140, pnl: 41.3 },
  ],
  tsla: [
    { id: 'tsla-1', timestamp: '2026-02-05T15:48:00', action: 'BUY', price: 236.8, qty: 60, pnl: -95.4 },
    { id: 'tsla-2', timestamp: '2026-02-05T14:27:00', action: 'SELL', price: 238.6, qty: 45, pnl: 42.8 },
    { id: 'tsla-3', timestamp: '2026-02-05T13:02:00', action: 'SELL', price: 235.1, qty: 50, pnl: -64.9 },
    { id: 'tsla-4', timestamp: '2026-02-05T11:36:00', action: 'BUY', price: 232.4, qty: 70, pnl: 31.2 },
    { id: 'tsla-5', timestamp: '2026-02-04T15:28:00', action: 'SELL', price: 239.9, qty: 40, pnl: -78.6 },
    { id: 'tsla-6', timestamp: '2026-02-04T12:54:00', action: 'BUY', price: 231.7, qty: 65, pnl: 58.3 },
  ],
  spy: [
    { id: 'spy-1', timestamp: '2026-02-05T15:31:00', action: 'BUY', price: 497.12, qty: 80, pnl: 44.8 },
    { id: 'spy-2', timestamp: '2026-02-05T14:10:00', action: 'SELL', price: 498.6, qty: 75, pnl: -22.4 },
    { id: 'spy-3', timestamp: '2026-02-05T12:45:00', action: 'BUY', price: 496.4, qty: 90, pnl: 38.7 },
    { id: 'spy-4', timestamp: '2026-02-05T11:05:00', action: 'SELL', price: 497.9, qty: 70, pnl: 12.2 },
    { id: 'spy-5', timestamp: '2026-02-04T15:18:00', action: 'BUY', price: 495.6, qty: 85, pnl: -18.1 },
    { id: 'spy-6', timestamp: '2026-02-04T13:40:00', action: 'SELL', price: 496.8, qty: 65, pnl: 26.5 },
  ],
  meta: [
    { id: 'meta-1', timestamp: '2026-02-05T15:52:00', action: 'SELL', price: 411.8, qty: 55, pnl: 74.6 },
    { id: 'meta-2', timestamp: '2026-02-05T14:33:00', action: 'BUY', price: 409.2, qty: 60, pnl: -28.7 },
    { id: 'meta-3', timestamp: '2026-02-05T13:18:00', action: 'SELL', price: 412.6, qty: 48, pnl: 61.1 },
    { id: 'meta-4', timestamp: '2026-02-05T11:58:00', action: 'BUY', price: 408.7, qty: 62, pnl: 36.9 },
    { id: 'meta-5', timestamp: '2026-02-04T15:22:00', action: 'SELL', price: 413.1, qty: 50, pnl: -19.3 },
    { id: 'meta-6', timestamp: '2026-02-04T12:30:00', action: 'BUY', price: 406.4, qty: 68, pnl: 52.8 },
  ],
  amzn: [
    { id: 'amzn-1', timestamp: '2026-02-05T15:38:00', action: 'BUY', price: 178.32, qty: 140, pnl: 62.4 },
    { id: 'amzn-2', timestamp: '2026-02-05T14:14:00', action: 'SELL', price: 179.1, qty: 120, pnl: 48.3 },
    { id: 'amzn-3', timestamp: '2026-02-05T13:03:00', action: 'BUY', price: 177.6, qty: 160, pnl: -33.6 },
    { id: 'amzn-4', timestamp: '2026-02-05T11:41:00', action: 'SELL', price: 178.9, qty: 110, pnl: 27.1 },
    { id: 'amzn-5', timestamp: '2026-02-04T15:08:00', action: 'BUY', price: 176.2, qty: 150, pnl: 51.5 },
    { id: 'amzn-6', timestamp: '2026-02-04T13:14:00', action: 'SELL', price: 175.6, qty: 130, pnl: -24.9 },
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
              className="fixed right-0 top-0 z-50 h-full w-full sm:w-[420px] bg-[#0f0f16] border-l border-[#1e1e2d] shadow-[0_0_45px_rgba(0,0,0,0.6)] flex flex-col"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
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

              <div className="flex-1 overflow-y-auto px-5 pb-6 pt-4 space-y-2.5">
                {activeTrades.map((trade) => {
                  const pnlColor = trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400';
                  const actionColor = trade.action === 'BUY' ? 'text-emerald-300' : 'text-red-300';

                  return (
                    <div
                      key={trade.id}
                      className="rounded-lg border border-[#1e1e2d] bg-[#0a0a0f] p-3 transition hover:border-emerald-500/30 hover:shadow-[0_0_18px_rgba(16,185,129,0.08)]"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold text-white">{formatTimestamp(trade.timestamp)}</div>
                          <div className={`mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${actionColor}`}>
                            {trade.action}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-xs font-semibold ${pnlColor}`}>{formatMoney(trade.pnl)}</div>
                          <div className="text-[10px] text-gray-500">P&amp;L</div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
                        <span>Price {formatPrice(trade.price)}</span>
                        <span>Qty {trade.qty}</span>
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
