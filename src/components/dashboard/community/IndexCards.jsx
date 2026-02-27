import React, { useState, useEffect, useRef, useCallback } from 'react';

// ── Config ────────────────────────────────────────────────────────────────────

// Display order — keys must match what the serverless function returns
const INDICES = [
  { label: 'SPY',     subtitle: 'S&P 500 ETF',     key: 'SPY'     },
  { label: 'QQQ',     subtitle: 'NASDAQ 100 ETF',   key: 'QQQ'     },
  { label: 'DIA',     subtitle: 'Dow Jones ETF',    key: 'DIA'     },
  { label: 'BTC',     subtitle: 'Bitcoin',          key: 'BTC/USD' },
];

const REFRESH_INTERVAL_MS = 60_000;

// ── Data fetching — proxied through Vercel serverless function ────────────────

async function fetchAllIndices() {
  const res = await fetch('/api/community/indices');
  if (!res.ok) throw new Error(`indices HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data?.indices)) throw new Error('Unexpected response shape');

  const quotes = {};
  const sparklines = {};
  for (const item of data.indices) {
    quotes[item.key]    = item.quote    ?? null;
    sparklines[item.key] = item.sparkline ?? [];
  }
  return { quotes, sparklines };
}

// ── SVG Sparkline ─────────────────────────────────────────────────────────────

function Sparkline({ prices, openPrice, positive, height = 56 }) {
  if (!prices || prices.length < 2) return null;

  const w = 200;
  const h = height;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const toX = (i) => (i / (prices.length - 1)) * w;
  const toY = (v) => h - ((v - min) / range) * h * 0.85 - h * 0.075;

  // Smooth SVG path using cubic bezier control points
  const d = prices.reduce((acc, v, i) => {
    const x = toX(i);
    const y = toY(v);
    if (i === 0) return `M ${x} ${y}`;
    const prevX = toX(i - 1);
    const prevY = toY(prices[i - 1]);
    const cpX = (prevX + x) / 2;
    return `${acc} C ${cpX} ${prevY}, ${cpX} ${y}, ${x} ${y}`;
  }, '');

  // Close the fill area to the bottom
  const fillD = `${d} L ${toX(prices.length - 1)} ${h} L ${toX(0)} ${h} Z`;

  const color = positive ? '#22c55e' : '#ef4444';
  const fillId = `spark-fill-${positive ? 'pos' : 'neg'}-${Math.random().toString(36).slice(2, 7)}`;

  // Reference line at open price
  const openY = openPrice != null ? toY(openPrice) : null;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height: `${height}px` }}
    >
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.20" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Gradient fill */}
      <path d={fillD} fill={`url(#${fillId})`} />

      {/* Open-price reference dashed line */}
      {openY != null && (
        <line
          x1={0} y1={openY} x2={w} y2={openY}
          stroke={color}
          strokeWidth="1"
          strokeDasharray="4 4"
          opacity="0.30"
        />
      )}

      {/* Main line */}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Single Index Card ─────────────────────────────────────────────────────────

function IndexCard({ label, subtitle, symbol, quote, sparkline }) {
  if (!quote) {
    return (
      <div className="bg-[#161b22] border border-white/10 rounded-xl p-4 relative overflow-hidden flex flex-col gap-1">
        <div className="text-xs font-bold uppercase tracking-wide text-[#e6edf3]">{label}</div>
        {subtitle && <div className="text-[10px] text-[#7d8590]">{subtitle}</div>}
        <div className="text-xl font-bold font-mono text-[#7d8590]">—</div>
        <div className="h-[56px] mt-2" />
      </div>
    );
  }

  const { price, change, pct, open } = quote;
  const positive = pct >= 0;
  const arrow = positive ? '↗' : '↘';
  const pctColor = positive ? 'text-green-400' : 'text-red-400';
  const changeColor = positive ? 'text-green-400' : 'text-red-400';

  const fmtPrice = (n) => {
    if (!Number.isFinite(n)) return '—';
    if (n >= 1000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return n.toFixed(2);
  };

  const fmtChange = (n) => {
    if (!Number.isFinite(n)) return '—';
    const sign = n >= 0 ? '+' : '';
    return `${sign}${n.toFixed(2)}`;
  };

  const fmtPct = (n) => {
    if (!Number.isFinite(n)) return '—';
    const sign = n >= 0 ? '+' : '';
    return `${sign}${n.toFixed(2)}%`;
  };

  return (
    <div className="bg-[#161b22] border border-white/10 rounded-xl p-4 relative overflow-hidden flex flex-col">
      {/* Top row: label + % change */}
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs font-bold uppercase tracking-wide text-[#e6edf3]">{label}</span>
        <span className={`text-sm font-semibold ${pctColor} flex items-center gap-0.5`}>
          <span className="text-base leading-none">{arrow}</span>
          {fmtPct(pct)}
        </span>
      </div>

      {/* Subtitle */}
      {subtitle && <div className="text-[10px] text-[#7d8590] mb-1">{subtitle}</div>}

      {/* Price */}
      <div className="text-xl font-bold font-mono text-[#e6edf3] leading-tight mb-0.5">
        {fmtPrice(price)}
      </div>

      {/* Point change */}
      <div className={`text-sm font-mono ${changeColor} mb-2`}>
        {fmtChange(change)}
      </div>

      {/* Sparkline */}
      <div className="mt-auto -mx-4 -mb-4">
        <Sparkline prices={sparkline} openPrice={open} positive={positive} height={56} />
      </div>

      {/* Bottom gradient fade overlay */}
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-8"
        style={{ background: 'linear-gradient(to bottom, transparent, #161b22)' }}
      />
    </div>
  );
}

// ── Main IndexCards component ─────────────────────────────────────────────────

export default function IndexCards() {
  const [quotes, setQuotes] = useState({});       // { key: { price, change, pct, open } }
  const [sparklines, setSparklines] = useState({}); // { key: number[] }
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const timerRef = useRef(null);

  const loadData = useCallback(async () => {
    try {
      const { quotes: q, sparklines: s } = await fetchAllIndices();
      if (!mountedRef.current) return;
      setQuotes(q);
      setSparklines(s);
      setLoading(false);
    } catch {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadData();
    timerRef.current = setInterval(loadData, REFRESH_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(timerRef.current);
    };
  }, [loadData]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {INDICES.map(({ key }) => (
          <div key={key} className="bg-[#161b22] border border-white/10 rounded-xl p-4 animate-pulse">
            <div className="h-3 bg-white/8 rounded w-2/3 mb-2" />
            <div className="h-6 bg-white/6 rounded w-1/2 mb-1" />
            <div className="h-3 bg-white/4 rounded w-1/3 mb-3" />
            <div className="h-[56px] bg-white/4 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {INDICES.map(({ label, subtitle, key }) => (
        <IndexCard
          key={key}
          label={label}
          subtitle={subtitle}
          symbol={key}
          quote={quotes[key] ?? null}
          sparkline={sparklines[key] ?? []}
        />
      ))}
    </div>
  );
}
