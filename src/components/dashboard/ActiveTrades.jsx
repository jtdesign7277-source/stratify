import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Share2, X, Pause, Play } from 'lucide-react';
import { PnLShareCard } from './PnLShareCard';
import { useAuth } from '../../context/AuthContext';

const API_URL = 'https://stratify-backend-production-3ebd.up.railway.app';

// Floating TradingView mini chart preview
const ChartPreview = ({ symbol, position }) => {
  const tvSymbol = `NASDAQ:${symbol}`;
  return (
    <div 
      className="fixed z-[100] bg-[#131722] border border-[#2a2e39] rounded-lg shadow-2xl overflow-hidden pointer-events-none"
      style={{ 
        top: Math.max(10, Math.min(position.y, window.innerHeight - 260)),
        left: Math.min(position.x + 20, window.innerWidth - 360),
        width: 340,
        height: 220
      }}
    >
      <div className="px-3 py-2 border-b border-[#2a2e39] flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-sm text-white font-medium">{symbol}</span>
        <span className="text-xs text-white/50">Live Chart</span>
      </div>
      <iframe
        src={`https://s.tradingview.com/widgetembed/?frameElementId=tv_widget&symbol=${encodeURIComponent(tvSymbol)}&interval=5&hidesidetoolbar=1&symboledit=0&saveimage=0&toolbarbg=131722&studies=[]&theme=dark&style=1&timezone=exchange&withdateranges=0&hideideas=1&hide_top_toolbar=1&hide_legend=1&allow_symbol_change=0`}
        className="w-full"
        style={{ height: 180 }}
        frameBorder="0"
        allowTransparency="true"
      />
    </div>
  );
};

const DEMO_STRATEGIES_SEED = [
  { id: 'nvda', symbol: 'NVDA', name: 'NVDA Momentum', status: 'Live', pnl: 1824.32, pnlPct: 2.8, heat: 88 },
  { id: 'aapl', symbol: 'AAPL', name: 'AAPL Mean Revert', status: 'Scaling', pnl: 642.15, pnlPct: 1.2, heat: 61 },
  { id: 'tsla', symbol: 'TSLA', name: 'TSLA Breakout', status: 'Cooling', pnl: -412.5, pnlPct: -0.9, heat: 92 },
  { id: 'spy', symbol: 'SPY', name: 'SPY Drift', status: 'Hedged', pnl: 318.22, pnlPct: 0.4, heat: 48 },
  { id: 'meta', symbol: 'META', name: 'META Scalper', status: 'Live', pnl: 956.80, pnlPct: 1.8, heat: 72 },
  { id: 'amzn', symbol: 'AMZN', name: 'AMZN Swing', status: 'Scaling', pnl: 1247.55, pnlPct: 2.1, heat: 55 },
];

// Completed trades with entry and exit prices (realistic current prices)
const DEMO_TRADES_BY_STRATEGY = {
  nvda: [
    { id: 'nvda-1', timestamp: '2026-02-05T15:42:00', qty: 30, entryPrice: 170.25, exitPrice: 171.88, pnl: 48.9 },
    { id: 'nvda-2', timestamp: '2026-02-05T14:18:00', qty: 20, entryPrice: 172.50, exitPrice: 174.30, pnl: 36.0 },
    { id: 'nvda-3', timestamp: '2026-02-05T13:05:00', qty: 25, entryPrice: 173.80, exitPrice: 172.15, pnl: -41.25 },
    { id: 'nvda-4', timestamp: '2026-02-05T11:44:00', qty: 18, entryPrice: 169.50, exitPrice: 171.20, pnl: 30.6 },
    { id: 'nvda-5', timestamp: '2026-02-04T15:12:00', qty: 40, entryPrice: 168.40, exitPrice: 171.55, pnl: 126.0 },
    { id: 'nvda-6', timestamp: '2026-02-04T13:36:00', qty: 24, entryPrice: 170.90, exitPrice: 169.18, pnl: -41.2 },
  ],
  aapl: [
    { id: 'aapl-1', timestamp: '2026-02-05T15:20:00', qty: 120, entryPrice: 227.10, exitPrice: 227.84, pnl: 88.8 },
    { id: 'aapl-2', timestamp: '2026-02-05T14:02:00', qty: 150, entryPrice: 228.03, exitPrice: 227.80, pnl: -34.5 },
    { id: 'aapl-3', timestamp: '2026-02-05T12:50:00', qty: 90, entryPrice: 226.42, exitPrice: 227.00, pnl: 52.2 },
    { id: 'aapl-4', timestamp: '2026-02-05T11:15:00', qty: 110, entryPrice: 225.86, exitPrice: 226.10, pnl: 26.4 },
    { id: 'aapl-5', timestamp: '2026-02-04T15:05:00', qty: 80, entryPrice: 228.32, exitPrice: 228.05, pnl: -21.6 },
    { id: 'aapl-6', timestamp: '2026-02-04T13:22:00', qty: 140, entryPrice: 224.51, exitPrice: 224.80, pnl: 40.6 },
  ],
  tsla: [
    { id: 'tsla-1', timestamp: '2026-02-05T15:48:00', qty: 60, entryPrice: 362.80, exitPrice: 361.21, pnl: -95.4 },
    { id: 'tsla-2', timestamp: '2026-02-05T14:27:00', qty: 45, entryPrice: 359.65, exitPrice: 360.60, pnl: 42.8 },
    { id: 'tsla-3', timestamp: '2026-02-05T13:02:00', qty: 50, entryPrice: 363.40, exitPrice: 362.10, pnl: -65.0 },
    { id: 'tsla-4', timestamp: '2026-02-05T11:36:00', qty: 70, entryPrice: 357.95, exitPrice: 358.40, pnl: 31.5 },
    { id: 'tsla-5', timestamp: '2026-02-04T15:28:00', qty: 40, entryPrice: 365.87, exitPrice: 363.90, pnl: -78.8 },
    { id: 'tsla-6', timestamp: '2026-02-04T12:54:00', qty: 65, entryPrice: 356.80, exitPrice: 357.70, pnl: 58.5 },
  ],
  spy: [
    { id: 'spy-1', timestamp: '2026-02-05T15:31:00', qty: 80, entryPrice: 600.56, exitPrice: 601.12, pnl: 44.8 },
    { id: 'spy-2', timestamp: '2026-02-05T14:10:00', qty: 75, entryPrice: 601.90, exitPrice: 601.60, pnl: -22.5 },
    { id: 'spy-3', timestamp: '2026-02-05T12:45:00', qty: 90, entryPrice: 599.97, exitPrice: 600.40, pnl: 38.7 },
    { id: 'spy-4', timestamp: '2026-02-05T11:05:00', qty: 70, entryPrice: 600.73, exitPrice: 600.90, pnl: 11.9 },
    { id: 'spy-5', timestamp: '2026-02-04T15:18:00', qty: 85, entryPrice: 599.81, exitPrice: 599.60, pnl: -17.9 },
    { id: 'spy-6', timestamp: '2026-02-04T13:40:00', qty: 65, entryPrice: 598.39, exitPrice: 598.80, pnl: 26.7 },
  ],
  meta: [
    { id: 'meta-1', timestamp: '2026-02-05T15:52:00', qty: 55, entryPrice: 698.44, exitPrice: 699.80, pnl: 74.8 },
    { id: 'meta-2', timestamp: '2026-02-05T14:33:00', qty: 60, entryPrice: 700.68, exitPrice: 700.20, pnl: -28.8 },
    { id: 'meta-3', timestamp: '2026-02-05T13:18:00', qty: 48, entryPrice: 696.33, exitPrice: 697.60, pnl: 61.0 },
    { id: 'meta-4', timestamp: '2026-02-05T11:58:00', qty: 62, entryPrice: 694.11, exitPrice: 694.70, pnl: 36.6 },
    { id: 'meta-5', timestamp: '2026-02-04T15:22:00', qty: 50, entryPrice: 702.49, exitPrice: 702.10, pnl: -19.5 },
    { id: 'meta-6', timestamp: '2026-02-04T12:30:00', qty: 68, entryPrice: 691.62, exitPrice: 692.40, pnl: 53.0 },
  ],
  amzn: [
    { id: 'amzn-1', timestamp: '2026-02-05T15:38:00', qty: 140, entryPrice: 232.88, exitPrice: 233.32, pnl: 61.6 },
    { id: 'amzn-2', timestamp: '2026-02-05T14:14:00', qty: 120, entryPrice: 233.70, exitPrice: 234.10, pnl: 48.0 },
    { id: 'amzn-3', timestamp: '2026-02-05T13:03:00', qty: 160, entryPrice: 234.01, exitPrice: 233.80, pnl: -33.6 },
    { id: 'amzn-4', timestamp: '2026-02-05T11:41:00', qty: 110, entryPrice: 231.65, exitPrice: 231.90, pnl: 27.5 },
    { id: 'amzn-5', timestamp: '2026-02-04T15:08:00', qty: 150, entryPrice: 230.86, exitPrice: 231.20, pnl: 51.0 },
    { id: 'amzn-6', timestamp: '2026-02-04T13:14:00', qty: 130, entryPrice: 232.79, exitPrice: 232.60, pnl: -24.7 },
  ],
};

const statusStyles = {
  Live: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  Scaling: 'border-sky-400/40 bg-sky-400/10 text-sky-200',
  Hedged: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  Cooling: 'border-red-400/40 bg-red-500/10 text-red-300',
  Paused: 'border-gray-400/40 bg-gray-400/10 text-gray-300',
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

// Signal Bars Component - based on heat percentage
const SignalBars = ({ heat }) => {
  // Determine bars and color based on heat
  const getBarsAndColor = (heat) => {
    if (heat >= 80) return { bars: 5, color: '#10b981', animation: 'shimmer' }; // Green, full bars
    if (heat >= 60) return { bars: 4, color: '#10b981', animation: 'none' };    // Green
    if (heat >= 40) return { bars: 3, color: '#fbbf24', animation: 'none' };    // Amber
    if (heat >= 20) return { bars: 2, color: '#f59e0b', animation: 'none' };    // Orange
    return { bars: 1, color: '#ef4444', animation: 'blink' };                    // Red, low bars
  };
  
  const config = getBarsAndColor(heat);
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

const ActiveTrades = ({
  setActiveTab,
  strategies: propStrategies,
  setStrategies: propSetStrategies,
  enableDemoData = false,
}) => {
  const { user } = useAuth();
  const isControlled = Array.isArray(propStrategies);
  const displayName = user?.user_metadata?.full_name?.trim()
    || user?.user_metadata?.name?.trim()
    || user?.email?.split('@')[0]
    || 'trader';
  const [totalPnl, setTotalPnl] = useState(isControlled ? 0 : (enableDemoData ? 4823.12 : 0));
  const [pnlDelta, setPnlDelta] = useState(0);
  const [internalStrategies, setInternalStrategies] = useState(enableDemoData ? DEMO_STRATEGIES_SEED : []);
  
  // Use props when available (including empty arrays) to avoid demo fallback for real user data.
  const strategies = isControlled ? propStrategies : internalStrategies;
  const setStrategies = propSetStrategies || setInternalStrategies;
  const [shareOpen, setShareOpen] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [tradePanelOpen, setTradePanelOpen] = useState(false);
  const [tradePanelStrategy, setTradePanelStrategy] = useState(null);
  const [livePrices, setLivePrices] = useState({});
  const [hoverPreview, setHoverPreview] = useState(null);
  const hoverTimeout = useRef(null);
  const confettiCanvasRef = useRef(null);
  const confettiInstanceRef = useRef(null);

  useEffect(() => {
    if (isControlled) return;
    setInternalStrategies(enableDemoData ? DEMO_STRATEGIES_SEED : []);
    setTotalPnl(enableDemoData ? 4823.12 : 0);
    setPnlDelta(0);
  }, [enableDemoData, isControlled]);

  // Fetch live prices for all symbols
  useEffect(() => {
    const fetchPrices = async () => {
      const symbols = (Array.isArray(strategies) ? strategies : [])
        .map((s) => s?.symbol)
        .filter(Boolean);
      if (symbols.length === 0) {
        setLivePrices({});
        return;
      }

      const prices = {};
      
      await Promise.all(
        symbols.map(async (symbol) => {
          try {
            const res = await fetch(`${API_URL}/api/public/quote/${symbol}`);
            if (res.ok) {
              const data = await res.json();
              prices[symbol] = {
                price: data.price || data.regularMarketPrice || data.lastPrice,
                change: data.change || data.regularMarketChange,
                changePercent: data.changePercent || data.regularMarketChangePercent,
              };
            }
          } catch (err) {
            console.error(`Failed to fetch ${symbol}:`, err);
          }
        })
      );
      
      setLivePrices(prices);
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [strategies]);

  useEffect(() => {
    if (isControlled || !enableDemoData) return undefined;

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
  }, [enableDemoData, isControlled, setStrategies]);

  useEffect(() => {
    if (!isControlled) return;

    const aggregatePnl = strategies.reduce((sum, strategy) => {
      const pnl = Number(strategy?.pnl);
      return sum + (Number.isFinite(pnl) ? pnl : 0);
    }, 0);

    setTotalPnl(Number(aggregatePnl.toFixed(2)));
    setPnlDelta(0);
  }, [isControlled, strategies]);

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
  
  // Get live strategy data (updates in real-time)
  const liveStrategyData = useMemo(() => {
    if (!tradePanelStrategy) return null;
    return strategies.find(s => s.id === tradePanelStrategy.id) || tradePanelStrategy;
  }, [tradePanelStrategy, strategies]);
  
  const activeTrades = useMemo(() => {
    if (!tradePanelStrategy) return [];
    const strategyTrades = Array.isArray(tradePanelStrategy.trades) ? tradePanelStrategy.trades : [];
    if (strategyTrades.length > 0) {
      return [...strategyTrades].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
    if (!enableDemoData) return [];
    const trades = DEMO_TRADES_BY_STRATEGY[tradePanelStrategy.id] || [];
    return [...trades].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [enableDemoData, tradePanelStrategy]);

  return (
    <div className="relative h-screen bg-[#0b0b0b] text-white overflow-hidden flex flex-col">
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
            <div className="text-[10px] text-white/50 uppercase tracking-wider">Active</div>
            <div className="text-xl font-semibold text-white">{strategies.length}</div>
          </div>
        </div>

        {/* Strategy Cards Grid - Compact 3-column layout */}
        {strategies.length === 0 ? (
          <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.02] p-6 text-center text-sm text-white/60">
            No active strategies running
          </div>
        ) : (
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
                  onMouseEnter={(e) => {
                    clearTimeout(hoverTimeout.current);
                    const target = e.currentTarget;
                    hoverTimeout.current = setTimeout(() => {
                      const rect = target?.getBoundingClientRect();
                      if (!rect) return;
                      setHoverPreview({
                        symbol: strategy.symbol,
                        position: { x: rect.right, y: rect.top }
                      });
                    }, 500);
                  }}
                  onMouseLeave={() => {
                    clearTimeout(hoverTimeout.current);
                    setHoverPreview(null);
                  }}
                  role="button"
                  tabIndex={0}
                  className="group relative rounded-lg border border-[#1f1f1f] bg-[#0f0f16] p-2.5 hover:border-emerald-500/40 hover:shadow-[inset_-2px_0_12px_rgba(16,185,129,0.15)] transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                >
                {/* Bottom edge tab - click for details */}
                <div className="absolute -bottom-0 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-t-md bg-emerald-500/20 border border-b-0 border-emerald-500/30 opacity-0 group-hover:opacity-100 group-hover:-translate-y-0 translate-y-1 transition-all duration-200">
                  <span className="text-[9px] font-medium text-emerald-400 uppercase tracking-wider">Details</span>
                </div>
                {/* Row 1: Ticker + Status + Share */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/50">
                    {strategy.symbol}
                  </span>
                  <div className="flex items-center gap-1">
                    {/* Share button */}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                        setSelectedStrategy({
                          ticker: strategy.symbol,
                          strategyName: strategy.name,
                          timeframe: 'Feb 1 - Feb 5, 2026',
                          pnl: strategy.pnl,
                          pnlPercent: strategy.pnlPct,
                          winRate: 67,
                          trades: 28,
                          sharpe: 1.8,
                          maxDrawdown: 3.2,
                          profitFactor: 2.4,
                          bestTrade: Math.abs(strategy.pnl * 0.3),
                          worstTrade: -Math.abs(strategy.pnl * 0.15),
                          avgHoldTime: '1h 42m',
                          volume: Math.floor(Math.random() * 500000) + 100000,
                          chartData: [100, 102, 98, 105, 108, 104, 112, 115, 118, 120, 117, 124],
                          username: displayName,
                        });
                        setShareOpen(true);
                      }}
                      className="share-btn w-6 h-6 rounded bg-white/5 hover:bg-blue-500/20 border border-white/10 hover:border-blue-500/50 transition-all flex items-center justify-center z-10"
                      title="Share Stats"
                    >
                      <Share2 className="w-3 h-3 text-gray-400 group-hover:text-blue-400" fill="none" strokeWidth={2} />
                    </button>
                    {/* Pause button */}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                        setStrategies(prev => prev.map(s => 
                          s.id === strategy.id ? { ...s, status: s.status === 'Paused' ? 'Live' : 'Paused' } : s
                        ));
                      }}
                      className={`w-6 h-6 rounded border transition-all flex items-center justify-center z-10 ${
                        strategy.status === 'Paused' 
                          ? 'bg-amber-500/20 border-amber-500/50 hover:bg-amber-500/30' 
                          : 'bg-white/5 border-white/10 hover:bg-amber-500/20 hover:border-amber-500/50'
                      }`}
                      title={strategy.status === 'Paused' ? 'Resume' : 'Pause'}
                    >
                      {strategy.status === 'Paused' ? (
                        <Play className="w-3 h-3 text-amber-400" fill="currentColor" strokeWidth={0} />
                      ) : (
                        <Pause className="w-3 h-3 text-gray-400" fill="none" strokeWidth={2} />
                      )}
                    </button>
                    {/* Kill/Stop button */}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        event.preventDefault();
                        if (confirm(`Stop "${strategy.name}" and move to strategies?`)) {
                          setStrategies(prev => prev.filter(s => s.id !== strategy.id));
                        }
                      }}
                      className="w-6 h-6 rounded bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/50 transition-all flex items-center justify-center z-10"
                      title="Stop & Remove"
                    >
                      <X className="w-3 h-3 text-gray-400" strokeWidth={2} />
                    </button>
                    <span className={`text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${statusStyles[strategy.status]}`}>
                      {strategy.status}
                    </span>
                  </div>
                </div>

                {/* Row 2: Strategy Name + Live Price */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-xs font-semibold text-white truncate">
                    {strategy.name}
                  </div>
                  {livePrices[strategy.symbol] && (
                    <div className="text-xs font-mono text-gray-300">
                      ${livePrices[strategy.symbol].price?.toFixed(2)}
                    </div>
                  )}
                </div>

                {/* Row 3: P&L + Signal Bars */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className={`text-base font-bold ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatMoney(strategy.pnl)}
                  </div>
                  <SignalBars heat={strategy.heat} />
                </div>

                {/* Row 4: Stats inline */}
                <div className="flex items-center justify-between text-[9px]">
                  <span className={isProfitable ? 'text-emerald-300' : 'text-red-300'}>
                    {strategy.pnlPct > 0 ? '+' : ''}{strategy.pnlPct}% today
                  </span>
                  <span className={strategy.heat >= 60 ? 'text-emerald-400' : strategy.heat >= 30 ? 'text-amber-300' : 'text-red-400'}>
                    Heat {strategy.heat}%
                  </span>
                </div>
                </motion.div>
              );
            })}
          </div>
        )}
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
              className="fixed left-0 top-0 z-50 h-full w-full sm:w-[420px] bg-[#0f0f16] border-r border-[#1f1f1f] shadow-[0_0_45px_rgba(0,0,0,0.6)] flex flex-col"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 260, damping: 32 }}
            >
              {/* Sticky Header - stays fixed while scrolling */}
              <div className="flex-shrink-0 border-b border-[#1f1f1f] bg-[#0f0f16]">
                {/* Top row: Title + Close */}
                <div className="px-5 pt-5 pb-3 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_60%)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-400/70">
                        {tradePanelStrategy.symbol} Trades
                      </div>
                      <div className="text-lg font-semibold text-white">{tradePanelStrategy.name}</div>
                    </div>
                    <button
                      onClick={() => setTradePanelOpen(false)}
                      className="w-9 h-9 rounded-lg border border-[#1f1f1f] bg-[#0b0b0b] hover:border-emerald-500/40 hover:bg-emerald-500/10 transition flex items-center justify-center"
                    >
                      <X className="w-4 h-4 text-gray-400 hover:text-emerald-300" fill="none" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
                
                {/* P&L Summary - Live updating */}
                <div className="px-5 py-3 bg-[#0b0b0b] border-t border-[#1f1f1f]">
                  <div className="text-[10px] uppercase tracking-wider text-white/50 mb-1">Total Return</div>
                  <div className="flex items-baseline gap-5">
                    <AnimatePresence mode="popLayout">
                      <motion.div
                        key={liveStrategyData?.pnl?.toFixed(0)}
                        initial={{ y: 6, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -6, opacity: 0 }}
                        className={`text-2xl font-bold ${liveStrategyData?.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                      >
                        {formatMoney(liveStrategyData?.pnl || 0)}
                      </motion.div>
                    </AnimatePresence>
                    <span className={`text-sm font-medium ${liveStrategyData?.pnlPct >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                      ({liveStrategyData?.pnlPct >= 0 ? '+' : ''}{liveStrategyData?.pnlPct}%)
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 pb-6 pt-4 space-y-3">
                {activeTrades.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#1f1f1f] bg-[#0b0b0b] p-6 text-center text-sm text-white/50">
                    No completed trades for this strategy yet.
                  </div>
                ) : (
                  activeTrades.map((trade) => {
                    const pnlColor = trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400';
                    const isProfit = trade.pnl >= 0;

                    return (
                      <div
                        key={trade.id}
                        className="rounded-lg border border-[#1f1f1f] bg-[#0b0b0b] p-4 transition hover:border-emerald-500/30 hover:shadow-[0_0_18px_rgba(16,185,129,0.08)]"
                      >
                        {/* Header: Date + P&L */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-sm font-semibold text-white">{formatTimestamp(trade.timestamp)}</div>
                          <div className={`text-base font-bold ${pnlColor}`}>{formatMoney(trade.pnl)}</div>
                        </div>
                        
                        {/* Entry / Exit prices */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className="flex-1 rounded-md bg-[#0f0f16] border border-[#1f1f1f] p-2.5">
                            <div className="text-[11px] uppercase tracking-wider text-white/50 mb-1">Entry</div>
                            <div className="text-sm font-semibold text-white">{formatPrice(trade.entryPrice)}</div>
                          </div>
                          <div className="text-white/50">→</div>
                          <div className="flex-1 rounded-md bg-[#0f0f16] border border-[#1f1f1f] p-2.5">
                            <div className="text-[11px] uppercase tracking-wider text-white/50 mb-1">Exit</div>
                            <div className={`text-sm font-semibold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>{formatPrice(trade.exitPrice)}</div>
                          </div>
                        </div>
                        
                        {/* Qty + Ticker */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-400">
                            Quantity: <span className="text-white font-medium">{trade.qty} shares</span>
                          </span>
                          <motion.button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Store symbol and navigate to trade page
                              localStorage.setItem('stratify_chart_symbol', tradePanelStrategy.symbol);
                              if (setActiveTab) {
                                setActiveTab('trade');
                              } else {
                                // Fallback to TradingView if no navigation available
                                window.open(`https://www.tradingview.com/chart/?symbol=${tradePanelStrategy.symbol}`, '_blank');
                              }
                            }}
                            animate={{ opacity: [0.85, 1, 0.85] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                            className="text-xs font-bold tracking-wide text-sky-400 hover:text-sky-300 hover:underline transition"
                          >
                            ${tradePanelStrategy.symbol} ↗
                          </motion.button>
                        </div>
                      </div>
                    );
                  })
                )}
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

      {/* Floating TradingView Preview on hover */}
      {hoverPreview && (
        <ChartPreview 
          symbol={hoverPreview.symbol}
          position={hoverPreview.position}
        />
      )}
    </div>
  );
};

export default ActiveTrades;
