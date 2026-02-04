import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Share2 } from 'lucide-react';
import { PnLShareCard } from './PnLShareCard';

const strategiesSeed = [
  { id: 'nvda', symbol: 'NVDA', name: 'NVDA Momentum', status: 'Live', pnl: 1824.32, pnlPct: 2.8, heat: 88 },
  { id: 'aapl', symbol: 'AAPL', name: 'AAPL Mean Revert', status: 'Scaling', pnl: 642.15, pnlPct: 1.2, heat: 61 },
  { id: 'tsla', symbol: 'TSLA', name: 'TSLA Breakout', status: 'Cooling', pnl: -412.5, pnlPct: -0.9, heat: 92 },
  { id: 'spy', symbol: 'SPY', name: 'SPY Drift', status: 'Hedged', pnl: 318.22, pnlPct: 0.4, heat: 48 },
  { id: 'meta', symbol: 'META', name: 'META Scalper', status: 'Live', pnl: 956.80, pnlPct: 1.8, heat: 72 },
  { id: 'amzn', symbol: 'AMZN', name: 'AMZN Swing', status: 'Scaling', pnl: 1247.55, pnlPct: 2.1, heat: 55 },
];

const statusStyles = {
  Live: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  Scaling: 'border-sky-400/40 bg-sky-400/10 text-sky-200',
  Hedged: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  Cooling: 'border-red-400/40 bg-red-500/10 text-red-300',
};

const formatMoney = (value) =>
  `${value >= 0 ? '+' : ''}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

        {/* Strategy Cards Grid - 3x2, fills remaining space */}
        <div className="grid grid-cols-3 grid-rows-2 gap-3 flex-1">
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
                className="rounded-xl border border-[#1e1e2d] bg-[#0f0f16] p-3 hover:border-emerald-500/30 transition-all flex flex-col"
              >
                {/* Row 1: Ticker + Status + Share */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gray-500">
                    {strategy.symbol}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
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
                      className="w-8 h-8 rounded-lg bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all flex items-center justify-center group"
                    >
                      <Share2 className="w-4 h-4 text-gray-400 group-hover:text-emerald-400" />
                    </button>
                    <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${statusStyles[strategy.status]}`}>
                      {strategy.status}
                    </span>
                  </div>
                </div>

                {/* Row 2: Strategy Name */}
                <div className="text-sm font-semibold text-white mb-2 truncate">
                  {strategy.name}
                </div>

                {/* Row 3: P&L + Signal Bars */}
                <div className="flex items-center justify-between mb-2 flex-1">
                  <div className={`text-xl font-bold ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatMoney(strategy.pnl)}
                  </div>
                  <SignalBars health={health} />
                </div>

                {/* Row 4: Stats inline */}
                <div className="flex items-center justify-between text-[10px]">
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

      <PnLShareCard
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        strategyData={selectedStrategy}
      />
    </div>
  );
};

export default ActiveTrades;
