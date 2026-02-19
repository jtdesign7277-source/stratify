import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, ChevronDown, ArrowUpRight, ArrowDownRight, RefreshCw, Activity } from 'lucide-react';

const STOCK_DATABASE = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'TSLA', name: 'Tesla, Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust' },
  { symbol: 'META', name: 'Meta Platforms, Inc.' },
  { symbol: 'AMD', name: 'Advanced Micro Devices' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.' },
  { symbol: 'COIN', name: 'Coinbase Global, Inc.' },
  { symbol: 'SOFI', name: 'SoFi Technologies, Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'PLTR', name: 'Palantir Technologies' },
  { symbol: 'HOOD', name: 'Robinhood Markets, Inc.' },
];

const fmt = (v, decimals = 2) => v != null ? Number(v).toFixed(decimals) : '—';
const fmtK = (v) => {
  if (v == null) return '—';
  if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
  if (v >= 1000) return (v / 1000).toFixed(1) + 'K';
  return v.toLocaleString();
};
const fmtMoney = (v) => {
  if (v == null) return '—';
  if (v >= 1000000) return '$' + (v / 1000000).toFixed(1) + 'M';
  if (v >= 1000) return '$' + (v / 1000).toFixed(1) + 'K';
  return '$' + v.toLocaleString();
};
const fmtTime = (t) => {
  if (!t) return '—';
  const d = new Date(t);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const OptionsPage = () => {
  const [symbol, setSymbol] = useState('TSLA');
  const [searchInput, setSearchInput] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [chain, setChain] = useState({ calls: [], puts: [], expirations: [], underlying: {} });
  const [selectedExpiration, setSelectedExpiration] = useState('');
  const [loading, setLoading] = useState(false);
  const [unusual, setUnusual] = useState([]);
  const [unusualLoading, setUnusualLoading] = useState(false);
  const [flow, setFlow] = useState([]);
  const [flowLoading, setFlowLoading] = useState(false);
  const [unusualSort, setUnusualSort] = useState('volumeOIRatio');
  const [expirationDropdownOpen, setExpirationDropdownOpen] = useState(false);

  const fetchChain = useCallback(async (sym, exp) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ symbol: sym });
      if (exp) params.set('expiration', exp);
      const res = await fetch(`/api/options/chain?${params}`);
      const data = await res.json();
      if (data.error) { console.error(data.error); return; }
      setChain(data);
      if (!exp && data.expirations?.length > 0) {
        setSelectedExpiration(data.expirations[0]);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  const fetchUnusual = useCallback(async () => {
    setUnusualLoading(true);
    try {
      const res = await fetch('/api/options/unusual?symbols=TSLA,NVDA,SPY,QQQ,META,AMD,AAPL,AMZN,COIN,SOFI');
      const data = await res.json();
      if (data.alerts) setUnusual(data.alerts);
    } catch (e) { console.error(e); }
    setUnusualLoading(false);
  }, []);

  const fetchFlow = useCallback(async (sym) => {
    setFlowLoading(true);
    try {
      const res = await fetch(`/api/options/flow?symbol=${sym}`);
      const data = await res.json();
      if (data.trades) setFlow(data.trades);
    } catch (e) { console.error(e); }
    setFlowLoading(false);
  }, []);

  useEffect(() => { fetchChain(symbol); fetchFlow(symbol); }, [symbol]);
  useEffect(() => { fetchUnusual(); const iv = setInterval(fetchUnusual, 30000); return () => clearInterval(iv); }, []);
  useEffect(() => { if (selectedExpiration) fetchChain(symbol, selectedExpiration); }, [selectedExpiration]);

  const searchResults = useMemo(() => {
    if (!searchInput) return [];
    const q = searchInput.toUpperCase();
    return STOCK_DATABASE.filter(s => s.symbol.includes(q) || s.name.toUpperCase().includes(q)).slice(0, 8);
  }, [searchInput]);

  // Build strike rows for chain table
  const strikeRows = useMemo(() => {
    const strikes = new Set();
    chain.calls.forEach(c => strikes.add(c.strike));
    chain.puts.forEach(p => strikes.add(p.strike));
    const sorted = [...strikes].sort((a, b) => a - b);
    const callMap = {};
    const putMap = {};
    chain.calls.forEach(c => { callMap[c.strike] = c; });
    chain.puts.forEach(p => { putMap[p.strike] = p; });
    return sorted.map(strike => ({ strike, call: callMap[strike] || null, put: putMap[strike] || null }));
  }, [chain]);

  const atmStrike = useMemo(() => {
    if (!chain.underlying?.price || strikeRows.length === 0) return null;
    const price = chain.underlying.price;
    let closest = strikeRows[0]?.strike;
    let diff = Math.abs(price - closest);
    strikeRows.forEach(r => { const d = Math.abs(price - r.strike); if (d < diff) { diff = d; closest = r.strike; } });
    return closest;
  }, [chain.underlying?.price, strikeRows]);

  const sortedUnusual = useMemo(() => {
    return [...unusual].sort((a, b) => (b[unusualSort] || 0) - (a[unusualSort] || 0));
  }, [unusual, unusualSort]);

  const handleSymbolSelect = (sym) => {
    setSymbol(sym);
    setSearchInput('');
    setSearchOpen(false);
    setSelectedExpiration('');
  };

  const underlying = chain.underlying || {};
  const isPositive = (underlying.change || 0) >= 0;

  return (
    <div className="w-full h-full overflow-y-auto bg-[#0b0b0b] text-white/80">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0b0b0b]/95 backdrop-blur border-b border-[#1f1f1f] px-4 py-3">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Search */}
          <div className="relative">
            <div className="flex items-center gap-2 border border-[#1f1f1f] rounded px-3 py-1.5 bg-[#111] w-56">
              <Search size={14} className="text-white/30" strokeWidth={1.5} />
              <input
                className="bg-transparent text-sm text-white outline-none w-full placeholder-white/30"
                placeholder="Search symbol..."
                value={searchOpen ? searchInput : symbol}
                onFocus={() => { setSearchOpen(true); setSearchInput(''); }}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && searchInput) handleSymbolSelect(searchInput.toUpperCase()); }}
                onBlur={() => setTimeout(() => setSearchOpen(false), 200)}
              />
            </div>
            {searchOpen && searchResults.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-72 bg-[#111] border border-[#1f1f1f] rounded shadow-xl z-30 max-h-64 overflow-y-auto">
                {searchResults.map(s => (
                  <button key={s.symbol} className="w-full text-left px-3 py-2 hover:bg-white/5 flex items-center gap-3 text-sm"
                    onMouseDown={() => handleSymbolSelect(s.symbol)}>
                    <span className="text-white font-mono font-medium w-12">{s.symbol}</span>
                    <span className="text-white/40 truncate">{s.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Price */}
          <div className="flex items-center gap-3">
            <span className="text-xl font-mono font-semibold text-white">{symbol}</span>
            {underlying.price && (
              <>
                <span className="text-lg font-mono text-white">${fmt(underlying.price)}</span>
                <span className={`text-sm font-mono flex items-center gap-0.5 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isPositive ? <ArrowUpRight size={13} strokeWidth={1.5} /> : <ArrowDownRight size={13} strokeWidth={1.5} />}
                  {isPositive ? '+' : ''}{fmt(underlying.change)} ({isPositive ? '+' : ''}{fmt(underlying.changePercent)}%)
                </span>
              </>
            )}
          </div>

          {/* Expiration selector */}
          {chain.expirations.length > 0 && (
            <div className="relative ml-auto">
              <button
                className="flex items-center gap-1.5 border border-[#1f1f1f] rounded px-3 py-1.5 text-sm text-white/70 hover:text-white bg-[#111]"
                onClick={() => setExpirationDropdownOpen(!expirationDropdownOpen)}
                onBlur={() => setTimeout(() => setExpirationDropdownOpen(false), 200)}
              >
                <span className="font-mono">{selectedExpiration || chain.expirations[0]}</span>
                <ChevronDown size={13} strokeWidth={1.5} />
              </button>
              {expirationDropdownOpen && (
                <div className="absolute top-full right-0 mt-1 bg-[#111] border border-[#1f1f1f] rounded shadow-xl z-30 max-h-64 overflow-y-auto min-w-[140px]">
                  {chain.expirations.map(exp => (
                    <button key={exp} className={`w-full text-left px-3 py-1.5 text-sm font-mono hover:bg-white/5 ${exp === selectedExpiration ? 'text-emerald-400' : 'text-white/60'}`}
                      onMouseDown={() => { setSelectedExpiration(exp); setExpirationDropdownOpen(false); }}>
                      {exp}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {loading && <RefreshCw size={14} className="text-white/30 animate-spin" strokeWidth={1.5} />}
        </div>
      </div>

      {/* Options Chain Table */}
      <div className="px-4 py-3">
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono border-collapse">
            <thead>
              <tr className="text-white/30 border-b border-[#1f1f1f]">
                <th colSpan={7} className="text-center text-emerald-400/60 py-2 text-[10px] tracking-wider uppercase">Calls</th>
                <th className="text-center py-2 text-white/50 text-[10px] tracking-wider uppercase">Strike</th>
                <th colSpan={7} className="text-center text-red-400/60 py-2 text-[10px] tracking-wider uppercase">Puts</th>
              </tr>
              <tr className="text-white/30 border-b border-[#1f1f1f]">
                {['Last', 'Chg', 'Bid', 'Ask', 'Vol', 'OI', 'IV'].map(h => (
                  <th key={'c-'+h} className="px-2 py-1.5 text-right text-[10px] font-normal">{h}</th>
                ))}
                <th className="px-3 py-1.5 text-center text-[10px] font-normal">Strike</th>
                {['Last', 'Chg', 'Bid', 'Ask', 'Vol', 'OI', 'IV'].map(h => (
                  <th key={'p-'+h} className="px-2 py-1.5 text-right text-[10px] font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {strikeRows.length === 0 && !loading && (
                <tr><td colSpan={15} className="text-center py-8 text-white/20">No options data available</td></tr>
              )}
              {strikeRows.map(row => {
                const isATM = row.strike === atmStrike;
                const isCallITM = underlying.price && row.strike < underlying.price;
                const isPutITM = underlying.price && row.strike > underlying.price;
                return (
                  <tr key={row.strike} className={`border-b border-[#0f0f0f] hover:bg-white/[0.02] ${isATM ? 'bg-yellow-500/[0.04]' : ''}`}>
                    {/* Call side */}
                    {renderOptionCells(row.call, isCallITM, 'call')}
                    {/* Strike */}
                    <td className={`px-3 py-1.5 text-center font-semibold ${isATM ? 'text-yellow-400' : 'text-white/60'}`}>
                      {fmt(row.strike)}
                    </td>
                    {/* Put side */}
                    {renderOptionCells(row.put, isPutITM, 'put')}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border-t border-[#1f1f1f]">
        {/* Unusual Activity */}
        <div className="border-r border-[#1f1f1f] p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-orange-400" fill="none" strokeWidth={1.5} />
              <span className="text-xs tracking-wider uppercase text-white/40">Unusual Activity</span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              {['volumeOIRatio', 'volume', 'premium'].map(k => (
                <button key={k} className={`${unusualSort === k ? 'text-emerald-400' : 'text-white/30'} hover:text-white/60`}
                  onClick={() => setUnusualSort(k)}>
                  {k === 'volumeOIRatio' ? 'V/OI' : k === 'volume' ? 'Vol' : '$'}
                </button>
              ))}
              {unusualLoading && <RefreshCw size={10} className="text-white/20 animate-spin" strokeWidth={1.5} />}
            </div>
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {sortedUnusual.length === 0 && <div className="text-white/20 text-xs py-4 text-center">No unusual activity detected</div>}
            {sortedUnusual.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] py-1.5 border-b border-[#0f0f0f] hover:bg-white/[0.02]">
                <span className={`w-5 text-center ${a.type === 'call' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {a.type === 'call' ? '🟢' : '🔴'}
                </span>
                <span className="text-white font-medium w-10">{a.symbol}</span>
                <span className="text-white/50 font-mono w-14 text-right">${fmt(a.strike)}</span>
                <span className="text-white/30 w-20 text-right">{a.expiration?.slice(5)}</span>
                <span className="text-white/50 font-mono w-20 text-right">{fmtK(a.volume)} / {fmtK(a.openInterest)}</span>
                <span className="text-orange-400 font-mono w-12 text-right">{a.volumeOIRatio}x</span>
                <span className="text-white/40 font-mono w-16 text-right">{fmtMoney(a.premium)}</span>
                {a.volume > 5000 && <span className="text-[9px] text-yellow-400/80 tracking-wider">SWEEP</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Options Flow */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-blue-400" fill="none" strokeWidth={1.5} />
              <span className="text-xs tracking-wider uppercase text-white/40">Options Flow — {symbol}</span>
            </div>
            <button className="text-white/20 hover:text-white/50" onClick={() => fetchFlow(symbol)}>
              <RefreshCw size={12} strokeWidth={1.5} className={flowLoading ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {flow.length === 0 && <div className="text-white/20 text-xs py-4 text-center">{flowLoading ? 'Loading...' : 'No large trades detected'}</div>}
            {flow.map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px] py-1.5 border-b border-[#0f0f0f] hover:bg-white/[0.02] font-mono">
                <span className="text-white/30 w-16">{fmtTime(t.time)}</span>
                <span className={`w-4 ${t.type === 'call' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {t.type === 'call' ? 'C' : 'P'}
                </span>
                <span className="text-white/50 w-14 text-right">${fmt(t.strike)}</span>
                <span className="text-white/30 w-20 text-right">{t.expiration?.slice(5)}</span>
                <span className="text-white/60 w-12 text-right">${fmt(t.price)}</span>
                <span className="text-white/50 w-10 text-right">x{t.size}</span>
                <span className="text-white/70 w-16 text-right font-medium">{fmtMoney(t.premium)}</span>
                <span className="text-white/20 w-8">{t.exchange}</span>
                <span className={`text-[9px] ${t.side === 'bullish' ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                  {t.side === 'bullish' ? '▲ BULL' : '▼ BEAR'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

function renderOptionCells(opt, isITM, type) {
  const bgClass = isITM ? (type === 'call' ? 'bg-emerald-500/[0.03]' : 'bg-red-500/[0.03]') : '';
  if (!opt) {
    return Array(7).fill(null).map((_, i) => <td key={i} className={`px-2 py-1.5 text-right text-white/10 ${bgClass}`}>—</td>);
  }
  const chgColor = (opt.change || 0) >= 0 ? 'text-emerald-400' : 'text-red-400';
  return (
    <>
      <td className={`px-2 py-1.5 text-right text-white/70 ${bgClass}`}>{fmt(opt.last)}</td>
      <td className={`px-2 py-1.5 text-right ${chgColor} ${bgClass}`}>{opt.change != null ? (opt.change >= 0 ? '+' : '') + fmt(opt.change) : '—'}</td>
      <td className={`px-2 py-1.5 text-right text-white/50 ${bgClass}`}>{fmt(opt.bid)}</td>
      <td className={`px-2 py-1.5 text-right text-white/50 ${bgClass}`}>{fmt(opt.ask)}</td>
      <td className={`px-2 py-1.5 text-right text-white/40 ${bgClass}`}>{fmtK(opt.volume)}</td>
      <td className={`px-2 py-1.5 text-right text-white/40 ${bgClass}`}>{fmtK(opt.openInterest)}</td>
      <td className={`px-2 py-1.5 text-right text-white/30 ${bgClass}`}>{opt.impliedVol ? opt.impliedVol + '%' : '—'}</td>
    </>
  );
}

export default OptionsPage;
