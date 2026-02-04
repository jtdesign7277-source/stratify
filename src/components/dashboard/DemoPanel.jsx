import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, ChevronRight, PlayCircle, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';

const seedStrategies = [
  {
    id: 'nvda-momentum',
    name: 'NVDA Momentum',
    description: 'Rides breakouts above 20-day highs with volume confirmation.',
    winRate: 62,
    totalReturn: 38.4,
    trades: 124,
  },
  {
    id: 'spy-mean-reversion',
    name: 'SPY Mean Reversion',
    description: 'Buys dips at 2σ Bollinger Band with time-based exits.',
    winRate: 58,
    totalReturn: 21.7,
    trades: 209,
  },
  {
    id: 'golden-cross',
    name: 'Golden Cross Swing',
    description: '50/200 MA trend filter with momentum scaling.',
    winRate: 54,
    totalReturn: 29.2,
    trades: 86,
  },
  {
    id: 'tsla-breakout',
    name: 'TSLA Breakout',
    description: 'Premarket range break with volatility stop.',
    winRate: 60,
    totalReturn: 41.9,
    trades: 97,
  },
];

const formatMoney = (value) => {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const DemoPanel = () => {
  const [strategies, setStrategies] = useState(seedStrategies);
  const [deployingId, setDeployingId] = useState(null);
  const [balance, setBalance] = useState(100000);
  const [pnl, setPnl] = useState(3245.18);
  const [pnlDelta, setPnlDelta] = useState(0);
  const [introComplete, setIntroComplete] = useState(false);
  const [showConfetti, setShowConfetti] = useState(true);

  const audioRef = useRef(null);
  const confettiCanvasRef = useRef(null);
  const confettiInstanceRef = useRef(null);
  const introTimeoutRef = useRef(null);
  const confettiIntervalRef = useRef(null);
  const fadeTimeoutRef = useRef(null);
  const fadeAnimationRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const delta = Number((Math.random() * 220 - 40).toFixed(2));
      setPnlDelta(delta);
      setPnl((prev) => Math.max(0, Number((prev + delta).toFixed(2))));
      setBalance((prev) => Number((prev + delta).toFixed(2)));
    }, 1800);

    return () => clearInterval(interval);
  }, []);

  const endIntro = useCallback(() => {
    setIntroComplete(true);
    setShowConfetti(false);

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    if (introTimeoutRef.current) {
      clearTimeout(introTimeoutRef.current);
    }
    if (confettiIntervalRef.current) {
      clearInterval(confettiIntervalRef.current);
    }
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
    }
    if (fadeAnimationRef.current) {
      cancelAnimationFrame(fadeAnimationRef.current);
    }
  }, []);

  useEffect(() => {
    const INTRO_DURATION = 9000;
    const FADE_DURATION = 1200;
    const FADE_START = INTRO_DURATION - FADE_DURATION;
    const canvas = confettiCanvasRef.current;

    if (canvas && !confettiInstanceRef.current) {
      confettiInstanceRef.current = confetti.create(canvas, {
        resize: true,
        useWorker: true,
      });
    }

    if (audioRef.current) {
      const audio = audioRef.current;
      audio.currentTime = 4;
      audio.volume = 0.85;
      audio.play().catch(() => {});
      fadeTimeoutRef.current = setTimeout(() => {
        const startVolume = audio.volume;
        const fadeStart = performance.now();
        const fadeStep = (now) => {
          const progress = Math.min((now - fadeStart) / FADE_DURATION, 1);
          audio.volume = Math.max(0, startVolume * (1 - progress));
          if (progress < 1) {
            fadeAnimationRef.current = requestAnimationFrame(fadeStep);
          }
        };
        fadeAnimationRef.current = requestAnimationFrame(fadeStep);
      }, FADE_START);
    }

    if (confettiInstanceRef.current) {
      const colors = ['#10b981', '#34d399', '#facc15', '#22c55e'];
      confettiIntervalRef.current = setInterval(() => {
        // Gentle falling confetti from top-left
        confettiInstanceRef.current({
          particleCount: 25,
          spread: 60,
          startVelocity: 10,
          gravity: 0.8,
          drift: 0.5,
          angle: 270,
          origin: { x: 0.15, y: -0.1 },
          colors,
        });

        // Gentle falling confetti from top-right
        confettiInstanceRef.current({
          particleCount: 25,
          spread: 60,
          startVelocity: 10,
          gravity: 0.8,
          drift: -0.5,
          angle: 270,
          origin: { x: 0.85, y: -0.1 },
          colors,
        });

        // Random center fall occasionally
        if (Math.random() > 0.5) {
          confettiInstanceRef.current({
            particleCount: 20,
            spread: 80,
            startVelocity: 8,
            gravity: 0.7,
            angle: 270,
            origin: { x: 0.5, y: -0.1 },
            colors,
          });
        }
      }, 400);
    }

    introTimeoutRef.current = setTimeout(() => {
      endIntro();
    }, INTRO_DURATION);

    return () => {
      if (introTimeoutRef.current) {
        clearTimeout(introTimeoutRef.current);
      }
      if (confettiIntervalRef.current) {
        clearInterval(confettiIntervalRef.current);
      }
      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
      }
      if (fadeAnimationRef.current) {
        cancelAnimationFrame(fadeAnimationRef.current);
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [endIntro]);

  const handleDeploy = (strategyId) => {
    if (deployingId) return;
    setDeployingId(strategyId);

    setTimeout(() => {
      setStrategies((prev) =>
        prev.map((strategy) =>
          strategy.id === strategyId
            ? {
                ...strategy,
                trades: strategy.trades + Math.floor(Math.random() * 4 + 1),
                totalReturn: Number((strategy.totalReturn + Math.random() * 2.2).toFixed(1)),
                winRate: Math.min(78, strategy.winRate + Math.floor(Math.random() * 2)),
              }
            : strategy
        )
      );
      setDeployingId(null);
    }, 1400);
  };

  const pnlAccent = pnlDelta >= 0 ? 'text-emerald-300' : 'text-red-400';
  const pnlDeltaLabel = pnlDelta >= 0 ? `+${pnlDelta.toFixed(2)}` : pnlDelta.toFixed(2);

  const heroStats = useMemo(
    () => [
      { label: 'Live strategies running', value: '18' },
      { label: 'Average fill speed', value: '42 ms' },
      { label: 'Auto risk checks', value: 'On' },
    ],
    []
  );

  const introScaleDuration = introComplete ? 0.01 : 9;

  return (
    <div
      className={`relative flex-1 h-full bg-[#0d0d12] text-white ${
        introComplete ? 'overflow-y-auto' : 'overflow-hidden'
      }`}
    >
      <style>{`
        @keyframes sb-shine {
          0% { transform: translateX(-140%); }
          55% { transform: translateX(140%); }
          100% { transform: translateX(140%); }
        }
      `}</style>
      <AnimatePresence>
        {!introComplete && showConfetti && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="pointer-events-none absolute inset-0 z-20"
          >
            <canvas ref={confettiCanvasRef} className="h-full w-full" />
          </motion.div>
        )}
      </AnimatePresence>

      {!introComplete && (
        <button
          type="button"
          onClick={endIntro}
          className="absolute right-6 top-6 z-30 inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200 transition hover:border-emerald-300 hover:text-white"
        >
          Skip Intro
        </button>
      )}

      <audio ref={audioRef} src="/green-intro.mp3" preload="auto" />

      <motion.div
        initial={{ scale: 0.5, opacity: 0.35 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: introScaleDuration, ease: [0.22, 1, 0.36, 1] }}
        className="px-6 py-6 space-y-6"
      >
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#141424] via-[#0f1017] to-[#0b0b12] p-6">
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.28),transparent_55%)]" />
          <div className="relative z-10 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                <Sparkles className="h-3.5 w-3.5" />
                Super Bowl Live Demo
              </div>
              <h1 className="text-3xl font-semibold leading-tight">
                Experience Stratify
              </h1>
              <p className="text-base text-gray-300">
                See how automated trading works - no signup required.
              </p>
              <div className="flex flex-wrap gap-4">
                <button className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-[#06140c] shadow-[0_0_20px_rgba(16,185,129,0.35)] transition hover:-translate-y-0.5">
                  Launch Live Demo
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:border-emerald-400/40 hover:text-white">
                  Watch the trades
                  <PlayCircle className="h-4 w-4" />
                </button>
              </div>
              <div className="relative overflow-hidden rounded-2xl border border-emerald-400/30 bg-gradient-to-br from-[#121420] via-[#0b0c12] to-[#05060a] p-4 shadow-[0_0_35px_rgba(16,185,129,0.18)] before:absolute before:-inset-y-8 before:-left-1/2 before:w-[180%] before:bg-[linear-gradient(120deg,transparent,rgba(252,211,77,0.28),rgba(16,185,129,0.35),transparent)] before:opacity-70 before:mix-blend-screen before:animate-[sb-shine_6s_ease-in-out_infinite]">
                <div className="relative z-10 flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[0.55rem] font-semibold uppercase tracking-[0.5em] text-emerald-300/70">
                      Exclusive Event Badge
                    </div>
                    <div className="mt-2 text-xl font-semibold tracking-[0.18em] text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-emerald-100 to-amber-200">
                      SUPER BOWL LX
                    </div>
                    <div className="mt-1 text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-amber-200/80">
                      FEBRUARY 9, 2026
                    </div>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-300/40 bg-amber-400/10 text-xl shadow-[0_0_20px_rgba(252,211,77,0.25)]">
                    🏈
                  </div>
                </div>
                <div className="relative z-10 mt-3 flex items-center gap-2 text-[0.65rem] text-emerald-200/70">
                  <span className="inline-flex h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.9)]" />
                  Premium access unlocked for game day trading.
                </div>
              </div>
            </div>
            <div className="grid gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.3em] text-gray-400">
                  Paper Account
                </div>
                <div className="mt-2 text-2xl font-semibold text-emerald-300">
                  {formatMoney(balance)}
                </div>
                <div className="mt-1 text-xs text-gray-400">
                  Buying power updates in real time
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {heroStats.map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-[0.65rem] text-gray-400">{stat.label}</div>
                    <div className="mt-2 text-base font-semibold">{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Live P&L */}
        <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
          <div className="rounded-2xl border border-white/10 bg-[#111118] p-4">
            <div className="text-sm font-semibold text-white/80">Live P&amp;L Ticker</div>
            <div className="mt-4 flex items-end gap-3">
              <div className="text-2xl font-semibold text-emerald-300">
                {formatMoney(pnl)}
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={pnlDeltaLabel}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className={`text-sm font-semibold ${pnlAccent}`}
                >
                  {pnlDeltaLabel}
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="mt-2 flex items-center gap-2 text-[0.7rem] text-gray-400">
              <ArrowUpRight className="h-3 w-3 text-emerald-400" />
              Profits auto-compound into balance every 60s
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#111118] p-4">
            <div className="text-sm font-semibold text-white/80">Live Demo Feed</div>
            <div className="mt-3 space-y-2 text-[0.8rem] text-gray-300">
              {[
                'NVDA Momentum closed +$412.50 on breakout',
                'SPY Mean Reversion re-entered after volatility dip',
                'Golden Cross Swing tightened trailing stop',
                'TSLA Breakout added position into strength',
              ].map((item) => (
                <div key={item} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  <span>{item}</span>
                  <span className="text-emerald-300">LIVE</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Strategy Cards */}
        <div className="grid gap-4 lg:grid-cols-2">
          {strategies.map((strategy) => {
            const isDeploying = deployingId === strategy.id;
            return (
              <motion.div
                key={strategy.id}
                layout
                className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#111118] p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-white">{strategy.name}</h3>
                    <p className="mt-1.5 text-xs text-gray-400">{strategy.description}</p>
                  </div>
                  <div className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                    Ready
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <div className="text-gray-500">Win rate</div>
                    <div className="text-emerald-300 font-semibold">{strategy.winRate}%</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Total return</div>
                    <div className="text-emerald-300 font-semibold">+{strategy.totalReturn}%</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Trades</div>
                    <div className="text-white font-semibold">{strategy.trades}</div>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-[0.65rem] text-gray-500">Auto-risk filters + smart sizing</div>
                  <button
                    onClick={() => handleDeploy(strategy.id)}
                    disabled={Boolean(deployingId)}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-[#06140c] transition hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
                  >
                    Deploy Strategy
                    <ArrowUpRight className="h-4 w-4" />
                  </button>
                </div>
                <AnimatePresence>
                  {isDeploying && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center bg-[#0d0d12]/80 backdrop-blur-sm"
                    >
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        className="rounded-2xl border border-emerald-400/40 bg-[#0f1412] px-6 py-4 text-center"
                      >
                        <div className="text-sm uppercase tracking-[0.3em] text-emerald-300">
                          Executing
                        </div>
                        <div className="mt-2 text-lg font-semibold text-white">
                          Sending orders...
                        </div>
                        <div className="mt-2 text-xs text-gray-400">
                          Simulated fill: 42 ms
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="rounded-3xl border border-white/10 bg-gradient-to-r from-emerald-500/20 via-[#0d0d12] to-[#0d0d12] p-5 text-center">
          <h2 className="text-xl font-semibold">Ready to trade for real?</h2>
          <p className="mt-1.5 text-xs text-gray-400">
            Unlock live execution, automations, and multi-broker routing.
          </p>
          <button className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-[#06140c] shadow-[0_0_25px_rgba(16,185,129,0.4)] transition hover:-translate-y-0.5">
            Sign up free
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default DemoPanel;
