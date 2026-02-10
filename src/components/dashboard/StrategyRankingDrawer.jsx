import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, X, TrendingUp, TrendingDown, ChevronRight, 
  Loader2, BarChart3, Target, Zap, RefreshCw,
  ArrowUpRight, ArrowDownRight, Crown, Medal, Award
} from 'lucide-react';

// Strategy templates to run - matches your existing templates
const STRATEGY_TEMPLATES = [
  { 
    id: 'momentum', 
    name: 'Momentum Trend', 
    icon: '🚀',
    color: '#10b981',
    description: 'Long when Close > EMA(20) crossover'
  },
  { 
    id: 'rsi', 
    name: 'RSI Strategy', 
    icon: '📊',
    color: '#8b5cf6',
    description: 'Buy RSI < 30, sell RSI > 70'
  },
  { 
    id: 'meanreversion', 
    name: 'Mean Reversion', 
    icon: '🔄',
    color: '#06b6d4',
    description: 'Trade the bounce back to average'
  },
  { 
    id: 'breakout', 
    name: 'Breakout', 
    icon: '💥',
    color: '#f97316',
    description: 'Catch explosive moves on volume'
  },
  { 
    id: 'macd', 
    name: 'MACD Cross', 
    icon: '⚡',
    color: '#eab308',
    description: 'Signal line crossovers'
  },
  { 
    id: 'scalping', 
    name: 'Scalping', 
    icon: '🎯',
    color: '#ec4899',
    description: 'Quick in-and-out trades'
  },
];

// Rank badge component
const RankBadge = ({ rank }) => {
  if (rank === 1) return <Crown className="w-5 h-5 text-yellow-400" strokeWidth={1.5} />;
  if (rank === 2) return <Medal className="w-5 h-5 text-gray-300" strokeWidth={1.5} />;
  if (rank === 3) return <Award className="w-5 h-5 text-amber-600" strokeWidth={1.5} />;
  return <span className="text-sm text-white/30 font-mono w-5 text-center">{rank}</span>;
};

// Individual strategy result row
const StrategyRow = ({ result, rank, onSelect, isSelected }) => {
  const isProfit = result.totalPnL >= 0;
  const pnlColor = isProfit ? 'text-emerald-400' : 'text-red-400';
  const returnColor = isProfit ? 'text-emerald-400' : 'text-red-400';
  
  return (
    <motion.button
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.05 }}
      onClick={() => onSelect(result)}
      className={`w-full text-left p-3 rounded-lg border transition-all duration-200 group ${
        isSelected 
          ? 'bg-blue-500/10 border-blue-500/30' 
          : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.1]'
      }`}
    >
      {/* Top row: Rank + Name + P&L */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2.5">
          <RankBadge rank={rank} />
          <span className="text-lg">{result.icon}</span>
          <div>
            <div className="text-sm font-medium text-white/90">{result.name}</div>
            <div className="text-[11px] text-white/30">{result.description}</div>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-sm font-semibold font-mono ${pnlColor}`}>
            {isProfit ? '+' : ''}{result.totalPnL?.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
          </div>
          <div className={`text-[11px] font-mono ${returnColor}`}>
            {isProfit ? '+' : ''}{result.returnPct?.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 ml-[30px]">
        <div className="flex items-center gap-1">
          <Target className="w-3 h-3 text-white/20" strokeWidth={1.5} />
          <span className="text-[11px] text-white/40">
            {result.winRate?.toFixed(0)}% win
          </span>
        </div>
        <div className="flex items-center gap-1">
          <BarChart3 className="w-3 h-3 text-white/20" strokeWidth={1.5} />
          <span className="text-[11px] text-white/40">
            {result.trades} trades
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Zap className="w-3 h-3 text-white/20" strokeWidth={1.5} />
          <span className="text-[11px] text-white/40">
            {result.sharpe?.toFixed(2)} sharpe
          </span>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-white/10 ml-auto group-hover:text-white/30 transition-colors" strokeWidth={1.5} />
      </div>

      {/* P&L bar visualization */}
      <div className="mt-2 ml-[30px] h-1 bg-white/[0.03] rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(Math.abs(result.returnPct) * 5, 100)}%` }}
          transition={{ delay: rank * 0.05 + 0.3, duration: 0.5 }}
          className={`h-full rounded-full ${isProfit ? 'bg-emerald-500/50' : 'bg-red-500/50'}`}
        />
      </div>
    </motion.button>
  );
};

// Loading skeleton row
const SkeletonRow = ({ index }) => (
  <div className="w-full p-3 rounded-lg border border-white/[0.05] bg-white/[0.02]">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2.5">
        <div className="w-5 h-5 rounded bg-white/[0.05] animate-pulse" />
        <div className="w-6 h-6 rounded bg-white/[0.05] animate-pulse" />
        <div>
          <div className="w-24 h-3.5 rounded bg-white/[0.05] animate-pulse mb-1" />
          <div className="w-36 h-2.5 rounded bg-white/[0.03] animate-pulse" />
        </div>
      </div>
      <div className="text-right">
        <div className="w-16 h-3.5 rounded bg-white/[0.05] animate-pulse mb-1 ml-auto" />
        <div className="w-10 h-2.5 rounded bg-white/[0.03] animate-pulse ml-auto" />
      </div>
    </div>
    <div className="flex items-center gap-3 ml-[30px]">
      <div className="w-14 h-2.5 rounded bg-white/[0.03] animate-pulse" />
      <div className="w-14 h-2.5 rounded bg-white/[0.03] animate-pulse" />
      <div className="w-14 h-2.5 rounded bg-white/[0.03] animate-pulse" />
    </div>
  </div>
);

// Main drawer component
const StrategyRankingDrawer = ({ 
  isOpen, 
  onClose, 
  ticker = 'TSLA',
  timeframe = '1H',
  period = '6M',
  capital = 100000,
  onSelectStrategy,  // callback when user clicks a strategy to load it
  backtestEndpoint = '/api/backtest'  // your backtest API endpoint
}) => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('pnl'); // pnl, winrate, sharpe

  // Run all backtests when drawer opens
  const runAllBacktests = useCallback(async () => {
    setLoading(true);
    setResults([]);
    setProgress(0);
    setError(null);

    const allResults = [];
    
    for (let i = 0; i < STRATEGY_TEMPLATES.length; i++) {
      const strategy = STRATEGY_TEMPLATES[i];
      setProgress(((i + 1) / STRATEGY_TEMPLATES.length) * 100);
      
      try {
        // Call your existing backtest endpoint for each strategy
        const response = await fetch(backtestEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticker: ticker.replace('$', ''),
            strategy: strategy.id,
            timeframe,
            period,
            capital,
          }),
        });

        if (!response.ok) throw new Error(`Backtest failed for ${strategy.name}`);
        
        const data = await response.json();
        
        allResults.push({
          ...strategy,
          totalPnL: data.totalPnL ?? data.total_pnl ?? 0,
          returnPct: data.returnPct ?? data.return_pct ?? 0,
          winRate: data.winRate ?? data.win_rate ?? 0,
          trades: data.trades ?? data.num_trades ?? 0,
          sharpe: data.sharpe ?? data.sharpe_ratio ?? 0,
          maxDrawdown: data.maxDrawdown ?? data.max_drawdown ?? 0,
          bestTrade: data.bestTrade ?? data.best_trade ?? 0,
          finalValue: data.finalValue ?? data.final_value ?? capital,
          // Pass through full data so we can load it into the main view
          fullData: data,
        });

        // Update results progressively so user sees them appear
        setResults([...allResults].sort((a, b) => b.totalPnL - a.totalPnL));
      } catch (err) {
        console.error(`Backtest failed for ${strategy.name}:`, err);
        allResults.push({
          ...strategy,
          totalPnL: 0,
          returnPct: 0,
          winRate: 0,
          trades: 0,
          sharpe: 0,
          maxDrawdown: 0,
          bestTrade: 0,
          finalValue: capital,
          error: true,
          fullData: null,
        });
        setResults([...allResults].sort((a, b) => b.totalPnL - a.totalPnL));
      }
    }

    setLoading(false);
  }, [ticker, timeframe, period, capital, backtestEndpoint]);

  useEffect(() => {
    if (isOpen) {
      runAllBacktests();
    }
  }, [isOpen, runAllBacktests]);

  // Sort results
  const sortedResults = [...results].sort((a, b) => {
    if (sortBy === 'pnl') return b.totalPnL - a.totalPnL;
    if (sortBy === 'winrate') return b.winRate - a.winRate;
    if (sortBy === 'sharpe') return b.sharpe - a.sharpe;
    return 0;
  });

  // Summary stats
  const bestStrategy = sortedResults[0];
  const profitableCount = results.filter(r => r.totalPnL > 0).length;

  const handleSelect = (result) => {
    setSelectedId(result.id);
    if (onSelectStrategy) {
      onSelectStrategy(result);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-[420px] z-50 flex flex-col"
            style={{ 
              background: 'linear-gradient(180deg, #0a1628 0%, #060d18 100%)',
              borderLeft: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {/* Header */}
            <div className="flex-shrink-0 p-4 border-b border-white/[0.06]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500/20 to-amber-500/20 flex items-center justify-center">
                    <Trophy className="w-4 h-4 text-yellow-400" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white/90">Strategy Rankings</h2>
                    <p className="text-[11px] text-white/30">
                      All templates vs ${ticker} · {timeframe} · {period}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={runAllBacktests}
                    disabled={loading}
                    className="p-1.5 rounded-md hover:bg-white/[0.05] transition-colors disabled:opacity-30"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-white/40 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
                  </button>
                  <button 
                    onClick={onClose}
                    className="p-1.5 rounded-md hover:bg-white/[0.05] transition-colors"
                  >
                    <X className="w-4 h-4 text-white/40" strokeWidth={1.5} />
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              {loading && (
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-white/30">
                      Running backtests...
                    </span>
                    <span className="text-[11px] text-blue-400 font-mono">
                      {Math.round(progress)}%
                    </span>
                  </div>
                  <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full"
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              )}

              {/* Summary card - only show when done */}
              {!loading && bestStrategy && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg border border-yellow-500/10 bg-yellow-500/[0.03]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Crown className="w-4 h-4 text-yellow-400" strokeWidth={1.5} />
                      <span className="text-xs text-yellow-400/80 font-medium">Best Strategy</span>
                    </div>
                    <span className="text-xs text-white/30">
                      {profitableCount}/{results.length} profitable
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-sm text-white/90 font-medium">
                      {bestStrategy.icon} {bestStrategy.name}
                    </span>
                    <span className="text-sm font-semibold font-mono text-emerald-400">
                      +{bestStrategy.totalPnL?.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Sort tabs */}
              <div className="flex items-center gap-1 mt-3">
                {[
                  { key: 'pnl', label: 'Profit' },
                  { key: 'winrate', label: 'Win Rate' },
                  { key: 'sharpe', label: 'Sharpe' },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setSortBy(tab.key)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                      sortBy === tab.key
                        ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                        : 'text-white/30 hover:text-white/50 border border-transparent'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Results list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-white/10">
              {loading && results.length === 0 ? (
                // Skeleton loading
                Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonRow key={i} index={i} />
                ))
              ) : (
                sortedResults.map((result, index) => (
                  <StrategyRow
                    key={result.id}
                    result={result}
                    rank={index + 1}
                    onSelect={handleSelect}
                    isSelected={selectedId === result.id}
                  />
                ))
              )}

              {error && (
                <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/[0.05] text-center">
                  <p className="text-xs text-red-400">{error}</p>
                  <button 
                    onClick={runAllBacktests}
                    className="mt-2 text-[11px] text-blue-400 hover:underline"
                  >
                    Try again
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 p-3 border-t border-white/[0.06]">
              <div className="flex items-center justify-between text-[11px] text-white/20">
                <span>Powered by Alpaca historical data</span>
                <span>${ticker} · {timeframe} · {period} · ${capital.toLocaleString()}</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default StrategyRankingDrawer;
