import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, BarChart3, Bitcoin, DollarSign, Flame, Globe, Radio, RefreshCw, Shield, TrendingDown, TrendingUp, Zap } from 'lucide-react';

const REFRESH_INTERVAL = 60000; // 1 min

const fmt = (v, decimals = 2) => {
  if (v == null || isNaN(v)) return '—';
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

const fmtLarge = (v) => {
  if (v == null || isNaN(v)) return '—';
  const n = Number(v);
  if (n >= 1000) return `$${(n / 1).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${fmt(n)}`;
};

const changeColor = (change) => {
  if (change > 0) return 'text-emerald-400';
  if (change < 0) return 'text-red-400';
  return 'text-zinc-500';
};

const changeBg = (change) => {
  if (change > 1.5) return 'bg-emerald-500/20 border-emerald-500/30';
  if (change > 0) return 'bg-emerald-500/8 border-emerald-500/15';
  if (change < -1.5) return 'bg-red-500/20 border-red-500/30';
  if (change < 0) return 'bg-red-500/8 border-red-500/15';
  return 'bg-zinc-800/30 border-zinc-700/30';
};

const heatColor = (change) => {
  if (change >= 2) return 'bg-emerald-500';
  if (change >= 1) return 'bg-emerald-600';
  if (change >= 0.5) return 'bg-emerald-700';
  if (change >= 0) return 'bg-emerald-900/60';
  if (change >= -0.5) return 'bg-red-900/60';
  if (change >= -1) return 'bg-red-700';
  if (change >= -2) return 'bg-red-600';
  return 'bg-red-500';
};

const Arrow = ({ change }) => {
  if (change > 0) return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />;
  if (change < 0) return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
  return null;
};

// Scanline effect CSS
const scanlineCSS = `
  .war-room-bg {
    position: relative;
    background: radial-gradient(ellipse at 50% 0%, rgba(16,185,129,0.03) 0%, transparent 60%),
                radial-gradient(ellipse at 80% 100%, rgba(239,68,68,0.02) 0%, transparent 50%),
                #050505;
  }
  .war-room-bg::before {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(255,255,255,0.008) 2px,
      rgba(255,255,255,0.008) 4px
    );
    pointer-events: none;
    z-index: 1;
  }
  .war-room-bg::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg, transparent, rgba(16,185,129,0.5), transparent);
    animation: warScan 4s linear infinite;
    z-index: 2;
  }
  @keyframes warScan {
    0% { transform: translateY(0); opacity: 0.6; }
    50% { opacity: 1; }
    100% { transform: translateY(100vh); opacity: 0.6; }
  }
  .war-glow {
    text-shadow: 0 0 20px rgba(16,185,129,0.3), 0 0 40px rgba(16,185,129,0.1);
  }
  .war-card {
    background: linear-gradient(135deg, rgba(10,10,10,0.9), rgba(15,15,15,0.95));
    border: 1px solid rgba(255,255,255,0.06);
    backdrop-filter: blur(20px);
    transition: all 0.2s;
  }
  .war-card:hover {
    border-color: rgba(255,255,255,0.12);
    box-shadow: 0 0 30px rgba(0,0,0,0.5);
  }
  .war-pulse {
    animation: warPulse 2s ease-in-out infinite;
  }
  @keyframes warPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  .heat-cell {
    transition: all 0.3s;
    cursor: default;
  }
  .heat-cell:hover {
    transform: scale(1.05);
    z-index: 10;
    box-shadow: 0 0 20px rgba(0,0,0,0.8);
  }
`;

export default function WarRoom({ onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [sophiaTake, setSophiaTake] = useState('');
  const intervalRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/war-room');
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      setData(json);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('War Room fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Sophia's latest take
  useEffect(() => {
    const fetchTake = async () => {
      try {
        const res = await fetch('/api/sophia-copilot');
        if (!res.ok) return;
        const alerts = await res.json();
        if (Array.isArray(alerts) && alerts.length > 0) {
          const latest = alerts.find((a) => a.alert_type === 'insight' || a.alert_type === 'morning');
          if (latest) setSophiaTake(latest.message);
        }
      } catch {}
    };
    fetchTake();
  }, []);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [fetchData]);

  const vixLevel = useMemo(() => {
    if (!data?.vix?.price) return { label: 'OFFLINE', color: 'text-zinc-600', bg: 'bg-zinc-800/50' };
    const p = data.vix.price;
    if (p > 30) return { label: 'EXTREME FEAR', color: 'text-red-400', bg: 'bg-red-500/15' };
    if (p > 20) return { label: 'ELEVATED', color: 'text-yellow-400', bg: 'bg-yellow-500/15' };
    if (p > 15) return { label: 'MODERATE', color: 'text-blue-400', bg: 'bg-blue-500/15' };
    return { label: 'CALM', color: 'text-emerald-400', bg: 'bg-emerald-500/15' };
  }, [data]);

  return (
    <div className="h-full w-full war-room-bg overflow-y-auto relative">
      <style>{scanlineCSS}</style>
      
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {onClose && (
              <button onClick={onClose} className="text-zinc-600 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            <div>
              <h1 className="text-3xl font-black text-white tracking-tighter war-glow flex items-center gap-3">
                <Shield className="w-7 h-7 text-emerald-400" />
                WAR ROOM
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 war-pulse" />
                  <span className="text-[10px] font-mono text-emerald-400/70 tracking-widest uppercase">LIVE FEED</span>
                </div>
                {lastUpdate && (
                  <span className="text-[10px] font-mono text-zinc-600">
                    UPD {lastUpdate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* VIX / Fear Gauge */}
            <div className={`px-3 py-1.5 rounded-lg border ${vixLevel.bg} border-white/5 flex items-center gap-2`}>
              <Activity className={`w-3.5 h-3.5 ${vixLevel.color}`} />
              <div>
                <div className={`text-[10px] font-mono tracking-wider ${vixLevel.color}`}>{vixLevel.label}</div>
                <div className="text-[9px] font-mono text-zinc-500">VOLATILITY INDEX</div>
              </div>
            </div>
            
            <button 
              onClick={fetchData}
              className="p-2 rounded-lg border border-white/5 bg-white/[0.02] text-zinc-500 hover:text-emerald-400 hover:border-emerald-500/20 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {loading && !data && (
          <div className="flex items-center justify-center h-64">
            <div className="text-emerald-400/50 font-mono text-sm war-pulse">ESTABLISHING FEED...</div>
          </div>
        )}

        {data && (
          <div className="space-y-4">
            {/* Row 1: Major Indices */}
            <div className="grid grid-cols-4 gap-3">
              {data.indices.map((idx) => (
                <div key={idx.symbol} className={`war-card rounded-xl p-4 border ${changeBg(idx.change)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-zinc-500 tracking-wider">{idx.name}</span>
                    <Arrow change={idx.change} />
                  </div>
                  <div className="text-2xl font-bold text-white font-mono tracking-tight">
                    {fmtLarge(idx.price)}
                  </div>
                  <div className={`text-lg font-bold font-mono ${changeColor(idx.change)}`}>
                    {idx.change > 0 ? '+' : ''}{fmt(idx.change)}%
                  </div>
                </div>
              ))}
            </div>

            {/* Row 2: Macro + Crypto + Sophia */}
            <div className="grid grid-cols-12 gap-3">
              {/* Macro Indicators */}
              <div className="col-span-4 war-card rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Globe className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-mono text-blue-400 tracking-wider">MACRO PULSE</span>
                </div>
                <div className="space-y-2.5">
                  {data.macro.map((m) => (
                    <div key={m.symbol} className="flex items-center justify-between">
                      <span className="text-xs font-mono text-zinc-400">{m.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold font-mono text-white">${fmt(m.price)}</span>
                        <span className={`text-xs font-mono font-bold ${changeColor(m.change)} min-w-[52px] text-right`}>
                          {m.change > 0 ? '+' : ''}{fmt(m.change)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sector Heatmap */}
              <div className="col-span-4 war-card rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Flame className="w-4 h-4 text-orange-400" />
                  <span className="text-xs font-mono text-orange-400 tracking-wider">SECTOR HEATMAP</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {data.sectors.map((s) => (
                    <div
                      key={s.symbol}
                      className={`heat-cell rounded-lg p-2 flex flex-col items-center justify-center ${heatColor(s.change)}`}
                      title={`${s.name}: ${s.change > 0 ? '+' : ''}${fmt(s.change)}%`}
                    >
                      <span className="text-[9px] font-mono text-white/90 font-bold">{s.symbol.replace('XL', '')}</span>
                      <span className="text-[10px] font-mono text-white/80 font-bold">
                        {s.change > 0 ? '+' : ''}{fmt(s.change, 1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Crypto + Fear */}
              <div className="col-span-4 space-y-3">
                {/* Crypto */}
                <div className="war-card rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Bitcoin className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-mono text-amber-400 tracking-wider">CRYPTO</span>
                  </div>
                  <div className="space-y-2">
                    {data.crypto.map((c) => (
                      <div key={c.symbol} className="flex items-center justify-between">
                        <span className="text-xs font-mono text-zinc-400">{c.name}</span>
                        <span className="text-sm font-bold font-mono text-white">
                          ${c.price ? Number(c.price).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* VIX Detail */}
                <div className={`war-card rounded-xl p-4 border ${vixLevel.bg}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className={`w-4 h-4 ${vixLevel.color}`} />
                    <span className={`text-xs font-mono tracking-wider ${vixLevel.color}`}>FEAR GAUGE</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`text-2xl font-black font-mono ${vixLevel.color}`}>
                      {fmt(data.vix.price, 1)}
                    </span>
                    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${vixLevel.bg} ${vixLevel.color}`}>
                      {vixLevel.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 3: Sophia's Take */}
            {sophiaTake && (
              <div className="war-card rounded-xl p-5 border border-emerald-500/10 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.03] to-transparent pointer-events-none" />
                <div className="relative flex items-start gap-3">
                  <div className="shrink-0 w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mt-0.5">
                    <Zap className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-mono text-emerald-400 tracking-wider">SOPHIA'S TAKE</span>
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 war-pulse" />
                    </div>
                    <p className="text-sm text-zinc-300 leading-relaxed font-light">{sophiaTake}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Row 4: All Sectors Detail */}
            <div className="war-card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-4 h-4 text-violet-400" />
                <span className="text-xs font-mono text-violet-400 tracking-wider">SECTOR BREAKDOWN</span>
              </div>
              <div className="space-y-1.5">
                {data.sectors.map((s) => {
                  const barWidth = Math.min(Math.abs(s.change || 0) * 15, 100);
                  const isPositive = (s.change || 0) >= 0;
                  return (
                    <div key={s.symbol} className="flex items-center gap-3">
                      <span className="text-xs font-mono text-zinc-500 w-28 shrink-0">{s.name}</span>
                      <div className="flex-1 h-5 bg-zinc-900/50 rounded-sm overflow-hidden relative">
                        <div
                          className={`absolute top-0 left-0 h-full rounded-sm transition-all duration-500 ${
                            isPositive ? 'bg-emerald-500/40' : 'bg-red-500/40'
                          }`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <span className={`text-xs font-mono font-bold ${changeColor(s.change)} w-14 text-right`}>
                        {(s.change || 0) > 0 ? '+' : ''}{fmt(s.change)}%
                      </span>
                      <span className="text-[10px] font-mono text-zinc-600 w-16 text-right">${fmt(s.price)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pb-4 flex items-center justify-center gap-3">
          <div className="w-1 h-1 rounded-full bg-emerald-500/30" />
          <span className="text-[10px] font-mono text-zinc-700 tracking-widest">STRATIFY WAR ROOM • CLASSIFIED</span>
          <div className="w-1 h-1 rounded-full bg-emerald-500/30" />
        </div>
      </div>
    </div>
  );
}
