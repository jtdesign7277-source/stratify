import React, { useState, useEffect, useCallback, useMemo } from 'react';

// ── Formatters ──────────────────────────────────────────────
const fmtK = (v) => {
  if (v == null) return '—';
  if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
  if (v >= 1000) return (v / 1000).toFixed(1) + 'K';
  return v.toLocaleString();
};

const fmtPremium = (v) => {
  if (v == null) return '—';
  if (v >= 1000000) return '$' + (v / 1000000).toFixed(1) + 'M';
  if (v >= 1000) return '$' + (v / 1000).toFixed(0) + 'K';
  return '$' + v.toLocaleString();
};

const fmtExp = (d) => {
  if (!d) return '';
  const parts = d.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[parseInt(parts[1], 10) - 1] + ' ' + parseInt(parts[2], 10);
};

// ── Badge config ────────────────────────────────────────────
const BADGE_MAP = {
  'SWEEP':     { text: 'SWEEP',     color: 'text-yellow-400', border: 'border-yellow-400/30', bg: 'bg-yellow-400/5' },
  'BLOCK':     { text: 'BLOCK',     color: 'text-orange-400', border: 'border-orange-400/30', bg: 'bg-orange-400/5' },
  'UNUSUAL':   { text: 'UNUSUAL',   color: 'text-cyan-400',   border: 'border-cyan-400/30',   bg: 'bg-cyan-400/5' },
  'DARK POOL': { text: 'DARK POOL', color: 'text-purple-400', border: 'border-purple-400/30', bg: 'bg-purple-400/5' },
};

// ── Filter presets ──────────────────────────────────────────
const FILTERS = [
  { id: 'all',       label: 'All' },
  { id: 'calls',     label: 'Calls Only' },
  { id: 'puts',      label: 'Puts Only' },
  { id: 'sweeps',    label: 'Sweeps' },
  { id: 'prem100k',  label: '$100K+' },
  { id: 'prem500k',  label: '$500K+' },
  { id: 'prem1m',    label: '$1M+' },
];

const SORT_COLS = [
  { id: 'volumeOIRatio',   label: 'V/OI' },
  { id: 'volume',          label: 'Volume' },
  { id: 'estimatedPremium', label: 'Premium' },
  { id: 'openInterest',    label: 'OI' },
];

// ═════════════════════════════════════════════════════════════
// Component
// ═════════════════════════════════════════════════════════════
const OptionsPage = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [filter, setFilter] = useState('all');
  const [tickerFilter, setTickerFilter] = useState(null);
  const [sortCol, setSortCol] = useState('volumeOIRatio');
  const [sortDir, setSortDir] = useState('desc');

  // ── Fetch ───────────────────────────────────────────────
  const fetchFlow = useCallback(async () => {
    try {
      const res = await fetch('/api/options/flow');
      const data = await res.json();
      if (data.alerts) {
        setAlerts(data.alerts);
        setLastUpdate(new Date());
      }
    } catch (e) { console.error('Options flow fetch error:', e); }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFlow();
    const iv = setInterval(fetchFlow, 30000);
    return () => clearInterval(iv);
  }, [fetchFlow]);

  // ── Derived: ticker summary ─────────────────────────────
  const tickerSummary = useMemo(() => {
    const map = {};
    alerts.forEach(a => {
      if (!map[a.symbol]) map[a.symbol] = { symbol: a.symbol, count: 0, calls: 0, puts: 0, callPremium: 0, putPremium: 0 };
      map[a.symbol].count++;
      if (a.type === 'call') { map[a.symbol].calls++; map[a.symbol].callPremium += a.estimatedPremium || 0; }
      else { map[a.symbol].puts++; map[a.symbol].putPremium += a.estimatedPremium || 0; }
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [alerts]);

  // ── Derived: stats ──────────────────────────────────────
  const stats = useMemo(() => {
    let totalCalls = 0, totalPuts = 0, callPremium = 0, putPremium = 0, darkPool = 0;
    alerts.forEach(a => {
      if (a.type === 'call') { totalCalls++; callPremium += a.estimatedPremium || 0; }
      else { totalPuts++; putPremium += a.estimatedPremium || 0; }
      if (a.tradeType === 'DARK POOL') darkPool++;
    });
    const mostBullish = tickerSummary.reduce((best, t) => (!best || (t.calls - t.puts) > (best.calls - best.puts) ? t : best), null);
    const mostBearish = tickerSummary.reduce((best, t) => (!best || (t.puts - t.calls) > (best.puts - best.calls) ? t : best), null);
    return { totalCalls, totalPuts, callPremium, putPremium, darkPool, mostBullish, mostBearish };
  }, [alerts, tickerSummary]);

  // ── Derived: filtered & sorted alerts ───────────────────
  const filteredAlerts = useMemo(() => {
    let list = [...alerts];
    if (tickerFilter) list = list.filter(a => a.symbol === tickerFilter);
    switch (filter) {
      case 'calls':    list = list.filter(a => a.type === 'call'); break;
      case 'puts':     list = list.filter(a => a.type === 'put'); break;
      case 'sweeps':   list = list.filter(a => a.tradeType === 'SWEEP'); break;
      case 'prem100k': list = list.filter(a => (a.estimatedPremium || 0) >= 100000); break;
      case 'prem500k': list = list.filter(a => (a.estimatedPremium || 0) >= 500000); break;
      case 'prem1m':   list = list.filter(a => (a.estimatedPremium || 0) >= 1000000); break;
      default: break;
    }
    list.sort((a, b) => {
      const av = a[sortCol] ?? 0, bv = b[sortCol] ?? 0;
      return sortDir === 'desc' ? bv - av : av - bv;
    });
    return list;
  }, [alerts, filter, tickerFilter, sortCol, sortDir]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const callPutRatio = stats.totalPuts > 0 ? (stats.totalCalls / stats.totalPuts).toFixed(2) : '∞';

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[#0b0b0b] text-white/80">

      {/* ── Section 2: Top Tickers Summary Bar ─────────────── */}
      <div className="flex-shrink-0 border-b border-[#1f1f1f] px-4 py-2 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          <button
            onClick={() => setTickerFilter(null)}
            className={`text-[10px] px-2 py-1 rounded font-mono transition-colors ${
              !tickerFilter ? 'text-white bg-white/10' : 'text-white/30 hover:text-white/50'
            }`}
          >ALL</button>
          {tickerSummary.map(t => {
            const net = t.calls - t.puts;
            const sentColor = net > 0 ? 'text-emerald-400' : net < 0 ? 'text-red-400' : 'text-white/50';
            const isActive = tickerFilter === t.symbol;
            return (
              <button
                key={t.symbol}
                onClick={() => setTickerFilter(isActive ? null : t.symbol)}
                className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded font-mono transition-colors ${
                  isActive ? 'text-white bg-white/10' : 'text-white/40 hover:text-white/60 hover:bg-white/[0.03]'
                }`}
              >
                <span className={sentColor}>${t.symbol}</span>
                <span className="text-white/20">{t.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Section 3: Stats Cards ─────────────────────────── */}
      <div className="flex-shrink-0 border-b border-[#1f1f1f] px-4 py-2">
        <div className="flex items-center gap-6 text-[10px] font-mono flex-wrap">
          {/* Sentiment */}
          <div className="flex items-center gap-2">
            <span className="text-white/25 uppercase tracking-wider">Sentiment</span>
            <span className="text-emerald-400">{stats.totalCalls} calls</span>
            <span className="text-white/15">/</span>
            <span className="text-red-400">{stats.totalPuts} puts</span>
            <span className="text-white/20">({callPutRatio})</span>
          </div>
          {/* Premium */}
          <div className="flex items-center gap-2">
            <span className="text-white/25 uppercase tracking-wider">Premium</span>
            <span className="text-emerald-400">{fmtPremium(stats.callPremium)}</span>
            <span className="text-white/15">/</span>
            <span className="text-red-400">{fmtPremium(stats.putPremium)}</span>
          </div>
          {/* Most bullish/bearish */}
          {stats.mostBullish && (
            <div className="flex items-center gap-1">
              <span className="text-white/25 uppercase tracking-wider">Bull</span>
              <span className="text-emerald-400">${stats.mostBullish.symbol}</span>
            </div>
          )}
          {stats.mostBearish && (
            <div className="flex items-center gap-1">
              <span className="text-white/25 uppercase tracking-wider">Bear</span>
              <span className="text-red-400">${stats.mostBearish.symbol}</span>
            </div>
          )}
          {/* Dark Pool */}
          {stats.darkPool > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-white/25 uppercase tracking-wider">Dark Pool</span>
              <span className="text-purple-400">{stats.darkPool}</span>
            </div>
          )}
          {/* Last update */}
          <div className="ml-auto flex items-center gap-2">
            {lastUpdate && (
              <span className="text-white/15">
                Updated {lastUpdate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
            {loading && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/20 animate-spin">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            )}
            <span className="text-white/10">{filteredAlerts.length} alerts</span>
          </div>
        </div>
      </div>

      {/* ── Filter Bar ─────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-[#1f1f1f] px-4 py-1.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`text-[10px] px-2 py-0.5 rounded transition-colors font-mono ${
                  filter === f.id ? 'text-white bg-white/10' : 'text-white/25 hover:text-white/50'
                }`}
              >{f.label}</button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1 text-[9px] text-white/20">
            <span>Sort:</span>
            {SORT_COLS.map(s => (
              <button
                key={s.id}
                onClick={() => handleSort(s.id)}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  sortCol === s.id ? 'text-emerald-400 bg-emerald-400/5' : 'text-white/25 hover:text-white/40'
                }`}
              >
                {s.label}{sortCol === s.id ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Section 1: Live Flow Feed (main area) ──────────── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Column headers */}
        <div className="sticky top-0 z-10 bg-[#0b0b0b] border-b border-[#1f1f1f] px-4 py-1.5 flex items-center gap-2 text-[9px] text-white/20 uppercase tracking-wider font-mono">
          <span className="w-4"></span>
          <span className="w-12">Ticker</span>
          <span className="w-16">Strike</span>
          <span className="w-14">Exp</span>
          <span className="w-14 text-right">Last</span>
          <span className="w-14 text-right cursor-pointer hover:text-white/40" onClick={() => handleSort('volume')}>Vol</span>
          <span className="w-14 text-right cursor-pointer hover:text-white/40" onClick={() => handleSort('openInterest')}>OI</span>
          <span className="w-12 text-right cursor-pointer hover:text-white/40" onClick={() => handleSort('volumeOIRatio')}>V/OI</span>
          <span className="w-16 text-right cursor-pointer hover:text-white/40" onClick={() => handleSort('estimatedPremium')}>Premium</span>
          <span className="w-16 text-right">Type</span>
        </div>

        {/* Rows */}
        {filteredAlerts.length === 0 && !loading && (
          <div className="text-white/10 text-xs py-12 text-center">
            {alerts.length === 0 ? 'Loading unusual options flow...' : 'No alerts match current filters'}
          </div>
        )}
        {filteredAlerts.map((a, i) => {
          const isCall = a.type === 'call';
          const rowBg = isCall ? 'hover:bg-emerald-500/[0.03]' : 'hover:bg-red-500/[0.03]';
          const strikeStr = a.strike % 1 === 0 ? a.strike.toFixed(0) : a.strike.toFixed(1);
          const badge = a.tradeType && BADGE_MAP[a.tradeType] ? BADGE_MAP[a.tradeType]
            : a.volumeOIRatio >= 5 ? BADGE_MAP['UNUSUAL'] : null;

          return (
            <div
              key={`${a.contractSymbol}-${i}`}
              className={`flex items-center gap-2 px-4 py-2 border-b border-[#0a0a0a] transition-colors ${rowBg}`}
            >
              {/* Dot */}
              <span className="w-4 text-[11px] flex-shrink-0">{isCall ? '🟢' : '🔴'}</span>

              {/* Ticker */}
              <span className="w-12 text-[12px] font-semibold font-mono text-white flex-shrink-0">{a.symbol}</span>

              {/* Strike + C/P */}
              <span className={`w-16 text-[11px] font-mono flex-shrink-0 ${isCall ? 'text-emerald-400' : 'text-red-400'}`}>
                {strikeStr}{isCall ? 'C' : 'P'}
              </span>

              {/* Expiration */}
              <span className="w-14 text-[10px] text-white/30 font-mono flex-shrink-0">{fmtExp(a.expiration)}</span>

              {/* Last */}
              <span className="w-14 text-[11px] text-white/50 font-mono text-right flex-shrink-0">
                {a.last != null ? '$' + (a.last < 1 ? a.last.toFixed(2) : a.last.toFixed(2)) : '—'}
              </span>

              {/* Volume */}
              <span className={`w-14 text-[11px] font-mono text-right flex-shrink-0 ${
                a.volume >= 5000 ? 'text-white font-semibold' : a.volume >= 1000 ? 'text-white/70' : 'text-white/40'
              }`}>{fmtK(a.volume)}</span>

              {/* OI */}
              <span className="w-14 text-[11px] text-white/30 font-mono text-right flex-shrink-0">{fmtK(a.openInterest)}</span>

              {/* V/OI */}
              <span className={`w-12 text-[11px] font-mono font-semibold text-right flex-shrink-0 ${
                a.volumeOIRatio >= 20 ? 'text-red-400' : a.volumeOIRatio >= 10 ? 'text-orange-400' : a.volumeOIRatio >= 5 ? 'text-yellow-400' : 'text-white/40'
              }`}>
                {a.volumeOIRatio >= 999 ? '∞' : a.volumeOIRatio + 'x'}
              </span>

              {/* Premium */}
              <span className={`w-16 text-[11px] font-mono font-medium text-right flex-shrink-0 ${
                (a.estimatedPremium || 0) >= 1000000 ? 'text-white' : (a.estimatedPremium || 0) >= 100000 ? 'text-white/70' : 'text-white/40'
              }`}>{fmtPremium(a.estimatedPremium)}</span>

              {/* Badge */}
              <span className="w-16 flex justify-end flex-shrink-0">
                {badge && (
                  <span className={`text-[8px] tracking-wider font-semibold border rounded px-1.5 py-0.5 ${badge.color} ${badge.border} ${badge.bg}`}>
                    {badge.text}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OptionsPage;
