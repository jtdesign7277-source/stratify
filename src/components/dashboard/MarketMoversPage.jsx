import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, RefreshCw, Volume2, BarChart3 } from 'lucide-react';

const CATEGORIES = [
  { id: 'gainers', label: 'Top Gainers', icon: TrendingUp, color: 'emerald' },
  { id: 'losers', label: 'Top Losers', icon: TrendingDown, color: 'red' },
  { id: 'volume', label: 'Most Active', icon: Volume2, color: 'blue' },
];

const PAGE_TRANSITION = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
};

const sectionMotion = (index) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.1 + (index * 0.05), duration: 0.3 },
});

const listItemMotion = (index) => ({
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0 },
  transition: { delay: index * 0.03, duration: 0.25 },
});

const interactiveTransition = { type: 'spring', stiffness: 400, damping: 25 };

function formatPrice(price) {
  if (!price) return '$0.00';
  return `$${Number(price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(percent) {
  if (!percent) return '0.00%';
  const num = Number(percent);
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
}

function formatVolume(volume) {
  if (!volume) return '0';
  if (volume >= 1000000000) return `${(volume / 1000000000).toFixed(1)}B`;
  if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
  if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
  return volume.toString();
}

function StockCard({ stock, rank, isLast }) {
  const changePercent = Number(stock.percent_change || 0);
  const isPositive = changePercent >= 0;
  const colorClass = isPositive ? 'text-emerald-400' : 'text-red-400';

  return (
    <motion.div
      {...listItemMotion(Math.max(0, rank - 1))}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ ...listItemMotion(Math.max(0, rank - 1)).transition, ...interactiveTransition }}
      className={`group px-3 py-2.5 hover:bg-white/[0.02] transition-all ${isLast ? '' : 'border-b border-[#1f1f1f]/40'}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white text-sm">{stock.symbol}</div>
          <div className="text-[11px] text-white/40 truncate mt-0.5">{stock.name || 'N/A'}</div>
        </div>
        <div className="text-right ml-3">
          <div className="text-sm font-semibold text-white">{formatPrice(stock.price)}</div>
          <div className={`text-[11px] font-medium ${colorClass}`}>
            {formatPercent(changePercent)}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function CategoryColumn({ category, data, loading, error }) {
  const Icon = category.icon;
  const colorMap = {
    emerald: 'text-emerald-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
  };
  const iconColor = colorMap[category.color];

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1f1f1f]">
        <Icon className={`w-4 h-4 ${iconColor}`} strokeWidth={1.5} />
        <h3 className="text-xs font-semibold text-white">{category.label}</h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 text-white/30 animate-spin" strokeWidth={1.5} />
          </div>
        )}

        {error && (
          <div className="px-3 py-4">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {!loading && !error && data.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <p className="text-xs text-white/30">No data</p>
          </div>
        )}

        {!loading && !error && data.length > 0 && (
          <>
            {data.slice(0, 15).map((stock, index, array) => (
              <StockCard
                key={stock.symbol}
                stock={stock}
                rank={index + 1}
                isLast={index === array.length - 1}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export default function MarketMoversPage() {
  const [gainers, setGainers] = useState([]);
  const [losers, setLosers] = useState([]);
  const [actives, setActives] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ gainers: null, losers: null, volume: null });
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchAllMovers = async () => {
    setLoading(true);
    setErrors({ gainers: null, losers: null, volume: null });

    const fetchCategory = async (type) => {
      try {
        const response = await fetch(`/api/market-movers?type=${type}`);
        if (!response.ok) throw new Error(`Failed to fetch ${type}`);
        const data = await response.json();
        return { type, data: data.values || [], error: null };
      } catch (err) {
        console.error(`[MarketMovers] ${type} error:`, err);
        return { type, data: [], error: err.message };
      }
    };

    const results = await Promise.all([
      fetchCategory('gainers'),
      fetchCategory('losers'),
      fetchCategory('volume'),
    ]);

    results.forEach(result => {
      if (result.type === 'gainers') {
        setGainers(result.data);
        if (result.error) setErrors(prev => ({ ...prev, gainers: result.error }));
      } else if (result.type === 'losers') {
        setLosers(result.data);
        if (result.error) setErrors(prev => ({ ...prev, losers: result.error }));
      } else if (result.type === 'volume') {
        setActives(result.data);
        if (result.error) setErrors(prev => ({ ...prev, volume: result.error }));
      }
    });

    setLastUpdated(Date.now());
    setLoading(false);
  };

  useEffect(() => {
    fetchAllMovers();
    const interval = setInterval(fetchAllMovers, 300000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div {...PAGE_TRANSITION} className="flex-1 flex flex-col bg-transparent overflow-hidden">
      {/* Header */}
      <motion.div {...sectionMotion(0)} className="flex-shrink-0 border-b border-white/10 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-400" strokeWidth={1.5} />
              <h1 className="text-lg font-semibold text-white">Market Movers</h1>
            </div>
            <p className="text-xs text-white/50 mt-1">Real-time market activity across all exchanges</p>
          </div>
          <motion.button
            onClick={fetchAllMovers}
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={interactiveTransition}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/8 bg-white/5 hover:bg-white/10 text-white text-xs shadow-lg shadow-black/30 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            {loading ? 'Updating...' : 'Refresh'}
          </motion.button>
        </div>

        <AnimatePresence initial={false}>
          {lastUpdated && !loading && (
            <motion.div {...sectionMotion(1)} className="mt-2 text-[10px] text-white/30">
              Last updated: {new Date(lastUpdated).toLocaleTimeString()}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Three Column Layout */}
      <motion.div {...sectionMotion(1)} className="flex-1 overflow-hidden px-6 py-4">
        <div className="grid grid-cols-3 gap-4 h-full">
          <motion.div {...sectionMotion(2)} className="border border-white/8 rounded-2xl shadow-lg shadow-black/30 overflow-hidden flex flex-col">
            <CategoryColumn
              category={CATEGORIES[0]}
              data={gainers}
              loading={loading}
              error={errors.gainers}
            />
          </motion.div>
          <motion.div {...sectionMotion(3)} className="border border-white/8 rounded-2xl shadow-lg shadow-black/30 overflow-hidden flex flex-col">
            <CategoryColumn
              category={CATEGORIES[1]}
              data={losers}
              loading={loading}
              error={errors.losers}
            />
          </motion.div>
          <motion.div {...sectionMotion(4)} className="border border-white/8 rounded-2xl shadow-lg shadow-black/30 overflow-hidden flex flex-col">
            <CategoryColumn
              category={CATEGORIES[2]}
              data={actives}
              loading={loading}
              error={errors.volume}
            />
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}
