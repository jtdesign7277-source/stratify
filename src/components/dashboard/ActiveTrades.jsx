import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Share2 } from 'lucide-react';
import { PnLShareCard } from './PnLShareCard';

const strategiesSeed = [
  {
    id: 'nvda',
    symbol: 'NVDA',
    name: 'NVDA Momentum',
    status: 'Live',
    pnl: 1824.32,
    pnlPct: 2.8,
    heat: 88,
    spark: [12, 14, 16, 19, 22, 20, 25],
  },
  {
    id: 'aapl',
    symbol: 'AAPL',
    name: 'AAPL Mean Revert',
    status: 'Scaling',
    pnl: 642.15,
    pnlPct: 1.2,
    heat: 61,
    spark: [9, 11, 10, 12, 14, 13, 15],
  },
  {
    id: 'tsla',
    symbol: 'TSLA',
    name: 'TSLA Breakout',
    status: 'Cooling',
    pnl: -412.5,
    pnlPct: -0.9,
    heat: 92,
    spark: [20, 18, 16, 14, 13, 15, 12],
  },
  {
    id: 'spy',
    symbol: 'SPY',
    name: 'SPY Drift',
    status: 'Hedged',
    pnl: 318.22,
    pnlPct: 0.4,
    heat: 48,
    spark: [7, 8, 9, 8, 10, 9, 11],
  },
];

const statusStyles = {
  Live: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  Scaling: 'border-sky-400/40 bg-sky-400/10 text-sky-200',
  Hedged: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  Cooling: 'border-red-400/40 bg-red-500/10 text-red-300',
};

const formatMoney = (value) =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const buildSparkPath = (values, width = 120, height = 40) => {
  if (!values.length) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
};

const ActiveTrades = () => {
  const [totalPnl, setTotalPnl] = useState(4823.12);
  const [pnlDelta, setPnlDelta] = useState(0);
  const [strategies, setStrategies] = useState(strategiesSeed);
  const [shareOpen, setShareOpen] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const confettiCanvasRef = useRef(null);
  const confettiInstanceRef = useRef(null);

  const dailyTarget = 7500;
  const allocatedCapital = 180000;
  const capitalUsed = 0.72;
  const winRate = 67;

  const targetProgress = Math.min(Math.max(totalPnl / dailyTarget, 0), 1);
  const targetPercent = Math.round(targetProgress * 100);

  const winRing = useMemo(() => {
    const radius = 26;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - winRate / 100);
    return { radius, circumference, offset };
  }, [winRate]);

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
    if (pnlDelta > 280 || totalPnl >= dailyTarget) {
      confettiInstanceRef.current({
        particleCount: 40,
        spread: 75,
        startVelocity: 55,
        origin: { x: 0.8, y: 0.2 },
        colors: ['#10b981', '#34d399', '#facc15', '#22c55e'],
      });
    }
  }, [dailyTarget, pnlDelta, totalPnl]);

  const pnlAccent = totalPnl >= 0 ? 'text-emerald-500' : 'text-red-500';
  const pnlDeltaLabel = pnlDelta >= 0 ? `+${pnlDelta.toFixed(2)}` : pnlDelta.toFixed(2);

  return (
    <div className="relative min-h-screen bg-[#0a0a0f] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(59,130,246,0.14),transparent_45%)]" />
      <canvas ref={confettiCanvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 space-y-6 px-6 py-6"
      >
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <motion.div
            initial={{ scale: 0.98, opacity: 0.85 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-3xl border border-[#1e1e2d] bg-gradient-to-br from-[#141420] via-[#0e0e14] to-[#0a0a0f] p-6 shadow-[0_0_40px_rgba(16,185,129,0.2)]"
          >
            <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.35),transparent_60%)]" />
            <div className="relative z-10 space-y-4">
              <div className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-300/80">
                Total P&amp;L
              </div>
              <div className="flex flex-wrap items-end gap-4">
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={totalPnl.toFixed(2)}
                    initial={{ y: 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -12, opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className={`text-4xl font-semibold sm:text-5xl ${pnlAccent}`}
                  >
                    {formatMoney(totalPnl)}
                  </motion.span>
                </AnimatePresence>
                <motion.div
                  key={pnlDeltaLabel}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`text-sm font-semibold ${pnlDelta >= 0 ? 'text-emerald-300' : 'text-red-400'}`}
                >
                  {pnlDeltaLabel}
                </motion.div>
              </div>
              <div className="text-sm text-gray-400">
                Live strategies auto-compounding every 60 seconds.
              </div>
            </div>
          </motion.div>

          <div className="grid gap-4 sm:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="rounded-2xl border border-[#1e1e2d] bg-[#0f0f16] p-4"
            >
              <div className="text-xs uppercase tracking-[0.3em] text-gray-400">Allocated Capital</div>
              <div className="mt-3 text-2xl font-semibold text-white">
                {formatMoney(allocatedCapital)}
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between text-[0.7rem] text-gray-400">
                  <span>Utilized</span>
                  <span>{Math.round(capitalUsed * 100)}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full border border-[#1e1e2d] bg-[#10101a]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round(capitalUsed * 100)}%` }}
                    transition={{ duration: 0.8 }}
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-300"
                  />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="rounded-2xl border border-[#1e1e2d] bg-[#0f0f16] p-4"
            >
              <div className="text-xs uppercase tracking-[0.3em] text-gray-400">Win Rate</div>
              <div className="mt-4 flex items-center gap-4">
                <div className="relative h-16 w-16">
                  <svg viewBox="0 0 64 64" className="h-16 w-16">
                    <circle
                      cx="32"
                      cy="32"
                      r={winRing.radius}
                      stroke="#1e1e2d"
                      strokeWidth="6"
                      fill="none"
                    />
                    <motion.circle
                      cx="32"
                      cy="32"
                      r={winRing.radius}
                      stroke="#10b981"
                      strokeWidth="6"
                      fill="none"
                      strokeDasharray={winRing.circumference}
                      strokeDashoffset={winRing.offset}
                      strokeLinecap="round"
                      initial={{ strokeDashoffset: winRing.circumference }}
                      animate={{ strokeDashoffset: winRing.offset }}
                      transition={{ duration: 0.9, ease: 'easeOut' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold">
                    {winRate}%
                  </div>
                </div>
                <div className="text-sm text-gray-300">
                  Precision streak across 28 trades.
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="sm:col-span-2 rounded-2xl border border-[#1e1e2d] bg-[#0f0f16] p-4"
            >
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-gray-400">
                <span>Daily Target</span>
                <span>{targetPercent}%</span>
              </div>
              <div className="mt-3 text-sm text-gray-300">
                Goal: {formatMoney(dailyTarget)} · Remaining: {formatMoney(Math.max(dailyTarget - totalPnl, 0))}
              </div>
              <div className="mt-3 h-2 rounded-full border border-[#1e1e2d] bg-[#10101a]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${targetPercent}%` }}
                  transition={{ duration: 0.9, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-amber-300"
                />
              </div>
            </motion.div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {strategies.map((strategy, index) => {
            const isProfitable = strategy.pnl >= 0;
            const sparkPath = buildSparkPath(strategy.spark);
            const gradientId = `${strategy.id}-sparkline`;
            return (
              <motion.div
                key={strategy.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + index * 0.05, duration: 0.5 }}
                whileHover={{ y: -4, scale: 1.01 }}
                className={`relative overflow-hidden rounded-2xl border border-[#1e1e2d] bg-[#0f0f16] p-5 ${
                  isProfitable ? 'shadow-[0_0_35px_rgba(16,185,129,0.25)]' : ''
                }`}
              >
                <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.25),transparent_65%)]" />
                <div className="relative z-10 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[0.65rem] font-semibold uppercase tracking-[0.4em] text-gray-500">
                        {strategy.symbol}
                      </div>
                      <div className="mt-1 text-lg font-semibold">{strategy.name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedStrategy({
                            strategyName: strategy.name,
                            pnlAmount: strategy.pnl,
                            pnlPercent: strategy.pnlPct,
                            winRate: 67,
                            totalTrades: 28,
                            chartData: strategy.spark,
                          });
                          setShareOpen(true);
                        }}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/50 transition-all"
                        title="Share P&L"
                      >
                        <Share2 className="w-4 h-4 text-gray-400 hover:text-emerald-400" />
                      </button>
                      <div
                        className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                          statusStyles[strategy.status]
                        }`}
                      >
                        {strategy.status}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <div className="text-[0.7rem] uppercase tracking-[0.3em] text-gray-500">
                        P&amp;L
                      </div>
                      <div
                        className={`mt-2 text-2xl font-semibold ${
                          isProfitable ? 'text-emerald-500' : 'text-red-500'
                        }`}
                      >
                        {formatMoney(strategy.pnl)}
                      </div>
                      <div
                        className={`text-xs font-semibold ${
                          isProfitable ? 'text-emerald-300' : 'text-red-300'
                        }`}
                      >
                        {strategy.pnlPct > 0 ? '+' : ''}
                        {strategy.pnlPct}% today
                      </div>
                    </div>
                    <svg viewBox="0 0 120 40" className="h-12 w-32">
                      <defs>
                        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                          <stop
                            offset="0%"
                            stopColor={isProfitable ? '#10b981' : '#ef4444'}
                            stopOpacity="0.35"
                          />
                          <stop offset="100%" stopColor="#0a0a0f" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d={`${sparkPath} L 120 40 L 0 40 Z`}
                        fill={`url(#${gradientId})`}
                      />
                      <path
                        d={sparkPath}
                        fill="none"
                        stroke={isProfitable ? '#10b981' : '#ef4444'}
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="text-[0.65rem] uppercase tracking-[0.3em] text-gray-500">
                        Heat
                      </div>
                      <div className="mt-2 h-2 rounded-full border border-[#1e1e2d] bg-[#10101a]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500"
                          style={{ width: `${strategy.heat}%` }}
                        />
                      </div>
                    </div>
                    <div
                      className={`text-xs font-semibold ${
                        strategy.heat > 75 ? 'text-amber-200' : 'text-gray-300'
                      }`}
                    >
                      {strategy.heat}%
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
      
      <PnLShareCard 
        isOpen={shareOpen} 
        onClose={() => setShareOpen(false)} 
        strategyData={selectedStrategy} 
      />
    </div>
  );
};

export default ActiveTrades;
