import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Activity } from 'lucide-react';
import { API_URL } from '../../config';

const CATEGORY_STYLES = {
  Sports: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  Politics: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  Economics: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  Crypto: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  Stocks: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  Other: 'bg-white/10 text-gray-300 border-white/10',
};

const formatVolume = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return '—';
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
  return `${Math.round(num)}`;
};

const toPercent = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num <= 1 ? num * 100 : num;
};

const inferCategory = (market) => {
  const base = `${market.category || ''} ${market.title || ''} ${market.ticker || ''}`.toUpperCase();
  if (base.includes('NFL') || base.includes('NBA') || base.includes('MLB') || base.includes('SPORT')) return 'Sports';
  if (base.includes('TRUMP') || base.includes('BIDEN') || base.includes('ELECTION') || base.includes('CONGRESS')) return 'Politics';
  if (base.includes('FED') || base.includes('CPI') || base.includes('GDP') || base.includes('RATE')) return 'Economics';
  if (base.includes('BTC') || base.includes('ETH') || base.includes('CRYPTO')) return 'Crypto';
  if (base.includes('AAPL') || base.includes('NVDA') || base.includes('TSLA') || base.includes('STOCK')) return 'Stocks';
  return market.category || 'Other';
};

const MarketCard = ({ market }) => {
  const yesPercent = toPercent(market.yesPercent ?? market.yes) ?? 50;
  const noPercent = toPercent(market.noPercent ?? market.no) ?? (100 - yesPercent);
  const volume = Number(market.volume || 0);
  const yesVolume = Number.isFinite(market.yesVolume) ? market.yesVolume : volume * (yesPercent / 100);
  const noVolume = Number.isFinite(market.noVolume) ? market.noVolume : volume - yesVolume;
  const category = inferCategory(market);
  const tagStyle = CATEGORY_STYLES[category] || CATEGORY_STYLES.Other;

  return (
    <div className="rounded-xl border border-[#1f2633] bg-[#101722] p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/40 hover:bg-[#121b2b]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">Kalshi</div>
          <h3 className="text-sm font-semibold text-white leading-snug line-clamp-2">{market.title}</h3>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] border ${tagStyle}`}>{category}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-2">
          <div className="text-[10px] uppercase tracking-wider text-emerald-200/80">Yes</div>
          <div className="text-lg font-semibold text-emerald-300">{Math.round(yesPercent)}%</div>
          <div className="text-[10px] text-emerald-200/70">Vol {formatVolume(yesVolume)}</div>
        </div>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-2">
          <div className="text-[10px] uppercase tracking-wider text-red-200/80">No</div>
          <div className="text-lg font-semibold text-red-300">{Math.round(noPercent)}%</div>
          <div className="text-[10px] text-red-200/70">Vol {formatVolume(noVolume)}</div>
        </div>
      </div>

      <div className="mt-3">
        <div className="h-2 rounded-full overflow-hidden border border-[#1f2633] bg-[#0b111b] flex">
          <div className="h-full bg-emerald-400" style={{ width: `${Math.max(0, Math.min(100, yesPercent))}%` }} />
          <div className="h-full bg-red-400" style={{ width: `${Math.max(0, 100 - Math.min(100, yesPercent))}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-white/40 uppercase tracking-widest">
          <span>Total Vol {formatVolume(volume)}</span>
          <span>{market.closeTime ? 'Closes ' + new Date(market.closeTime).toLocaleDateString() : 'Live'}</span>
        </div>
      </div>
    </div>
  );
};

const PredictionsPage = () => {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState('');

  const fetchMarkets = async () => {
    setLoading(true);
    try {
      const url = new URL(`${API_URL}/api/kalshi/markets`);
      url.searchParams.set('limit', '80');
      if (category && category !== 'All') url.searchParams.set('category', category);

      const res = await fetch(url.toString());
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || 'Failed to load markets');
      setMarkets(data.markets || []);
      setLastUpdate(new Date());
      setError('');
    } catch (err) {
      setError(err?.message || 'Unable to load Kalshi markets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarkets();
    const interval = setInterval(fetchMarkets, 30000);
    return () => clearInterval(interval);
  }, [category]);

  const categories = useMemo(() => {
    const set = new Set(['All']);
    markets.forEach((m) => set.add(inferCategory(m)));
    return Array.from(set);
  }, [markets]);

  const filteredMarkets = useMemo(() => {
    if (category === 'All') return markets;
    return markets.filter((m) => inferCategory(m) === category);
  }, [markets, category]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d0d12] p-4 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" strokeWidth={1.5} />
            <h1 className="text-xl font-semibold text-white">Kalshi Predictions</h1>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            {loading ? 'Updating live markets...' : lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : 'Live prediction markets'}
          </p>
        </div>
        <button
          onClick={fetchMarkets}
          disabled={loading}
          className="p-2 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-emerald-500/40 hover:bg-white/5 transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border transition-all ${
              category === cat
                ? 'border-emerald-400/60 text-emerald-200 bg-emerald-500/15'
                : 'border-white/10 text-gray-400 hover:text-white hover:border-emerald-500/40 hover:bg-white/5'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 text-sm px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {loading && markets.length === 0 ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-[#1f2633] bg-[#101722] p-3 animate-pulse">
              <div className="h-3 bg-white/10 rounded w-2/3 mb-2" />
              <div className="h-4 bg-white/10 rounded w-4/5" />
              <div className="mt-3 h-14 bg-white/5 rounded" />
            </div>
          ))
        ) : filteredMarkets.length === 0 ? (
          <div className="text-gray-500 text-sm">No markets found.</div>
        ) : (
          filteredMarkets.map((market) => (
            <MarketCard key={market.id} market={market} />
          ))
        )}
      </div>
    </div>
  );
};

export default PredictionsPage;
