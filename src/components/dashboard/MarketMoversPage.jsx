import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, RefreshCw, Volume2, Zap, BarChart3 } from 'lucide-react';

const CATEGORIES = [
  { id: 'gainers', label: 'Top Gainers', icon: TrendingUp, color: 'emerald' },
  { id: 'losers', label: 'Top Losers', icon: TrendingDown, color: 'red' },
  { id: 'volume', label: 'Most Active', icon: Volume2, color: 'blue' },
];

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

function StockCard({ stock, rank }) {
  const changePercent = Number(stock.percent_change || 0);
  const isPositive = changePercent >= 0;
  const colorClass = isPositive ? 'text-emerald-400' : 'text-red-400';
  const bgClass = isPositive ? 'bg-emerald-500/10' : 'bg-red-500/10';
  const borderClass = isPositive ? 'border-emerald-500/20' : 'border-red-500/20';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.03 }}
      className="group p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/20 transition-all"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-lg ${bgClass} border ${borderClass} flex items-center justify-center text-xs font-bold ${colorClass}`}>
            {rank}
          </div>
          <div>
            <div className="font-semibold text-white text-sm">{stock.symbol}</div>
            <div className="text-[11px] text-white/50 line-clamp-1">{stock.name || 'N/A'}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold text-white">{formatPrice(stock.price)}</div>
          <div className={`text-xs font-medium ${colorClass}`}>
            {formatPercent(changePercent)}
          </div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px]">
        <div className="text-white/50">
          <span className="text-white/70">Vol:</span> {formatVolume(stock.volume)}
        </div>
        <div className="text-white/50">
          <span className="text-white/70">Change:</span> {formatPrice(stock.change)}
        </div>
      </div>
    </motion.div>
  );
}

export default function MarketMoversPage() {
  const [activeCategory, setActiveCategory] = useState('gainers');
  const [movers, setMovers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchMovers = async (category) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/market-movers?type=${category}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${category}`);
      }
      const data = await response.json();
      setMovers(data.values || []);
      setLastUpdated(Date.now());
    } catch (err) {
      console.error('[MarketMovers] Fetch error:', err);
      setError(err.message);
      setMovers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovers(activeCategory);
    const interval = setInterval(() => fetchMovers(activeCategory), 300000); // Refresh every 5 minutes
    return () => clearInterval(interval);
  }, [activeCategory]);

  const activeTab = CATEGORIES.find(c => c.id === activeCategory);

  return (
    <div className="flex-1 flex flex-col bg-[#0b0b0b] overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-white/10 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-emerald-400" strokeWidth={1.5} />
              <h1 className="text-lg font-semibold text-white">Market Movers</h1>
            </div>
            <p className="text-xs text-white/50 mt-1">Real-time market activity across all exchanges</p>
          </div>
          <button
            onClick={() => fetchMovers(activeCategory)}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white text-xs transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            {loading ? 'Updating...' : 'Refresh'}
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 mt-4">
          {CATEGORIES.map(category => {
            const Icon = category.icon;
            const isActive = activeCategory === category.id;
            const colorMap = {
              emerald: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400',
              red: 'border-red-500/30 bg-red-500/15 text-red-400',
              blue: 'border-blue-500/30 bg-blue-500/15 text-blue-400',
            };

            return (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-xs font-medium transition-all ${
                  isActive
                    ? colorMap[category.color]
                    : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                {category.label}
              </button>
            );
          })}
        </div>

        {lastUpdated && !loading && (
          <div className="mt-3 text-[10px] text-white/40">
            Last updated: {new Date(lastUpdated).toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading && movers.length === 0 && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-white/30 animate-spin mx-auto" strokeWidth={1.5} />
              <p className="text-sm text-white/50 mt-3">Loading market data...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-center">
            <p className="text-sm text-red-400">Error: {error}</p>
            <button
              onClick={() => fetchMovers(activeCategory)}
              className="mt-3 px-4 py-2 rounded-lg border border-red-500/30 bg-red-500/20 text-xs text-red-300 hover:bg-red-500/30"
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && movers.length === 0 && (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Zap className="w-8 h-8 text-white/30 mx-auto" strokeWidth={1.5} />
              <p className="text-sm text-white/50 mt-3">No data available</p>
            </div>
          </div>
        )}

        {movers.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {movers.slice(0, 30).map((stock, index) => (
              <StockCard key={stock.symbol} stock={stock} rank={index + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
