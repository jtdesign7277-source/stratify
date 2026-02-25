import { useState, useEffect, useMemo, useRef, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════
   STRATIFY — Strategy Template Detail Flow
   Templates Gallery → Click Card → Backtest Detail View
   ═══════════════════════════════════════════════════════════════ */

// ── Icons (thin pencil-line, strokeWidth 1.5) ──────────────────
const Icons = {
  ArrowLeft: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  ),
  TrendingUp: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  BarChart: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  ),
  Activity: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  Zap: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  Target: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  Layers: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  ),
  Play: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  ChevronDown: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  Clock: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  DollarSign: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  ),
  Check: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
};

// ── Strategy Templates Data ────────────────────────────────────
const TEMPLATES = [
  {
    id: "momentum",
    name: "Momentum Trend",
    icon: Icons.TrendingUp,
    color: "#22d3ee",
    description: "Ride the trend. Buy when price crosses above the 20 EMA, sell when it drops below.",
    logic: "Long when Close > EMA(20) crossover. Exit when Close < EMA(20) crossunder.",
    indicators: ["EMA 20"],
    difficulty: "Beginner",
    avgReturn: "+18.4%",
    winRate: "62%",
  },
  {
    id: "rsi-bounce",
    name: "RSI Bounce",
    icon: Icons.Activity,
    color: "#34d399",
    description: "Buy oversold dips, sell overbought peaks. Classic mean-reversion on RSI extremes.",
    logic: "Long when RSI(14) < 30. Exit when RSI(14) > 55.",
    indicators: ["RSI 14"],
    difficulty: "Beginner",
    avgReturn: "+24.1%",
    winRate: "68%",
  },
  {
    id: "macd-cross",
    name: "MACD Crossover",
    icon: Icons.BarChart,
    color: "#f59e0b",
    description: "Follow momentum shifts. Enter on MACD signal line cross, exit on reverse.",
    logic: "Long when MACD > Signal crossover. Exit when MACD < Signal crossunder.",
    indicators: ["MACD (12,26,9)"],
    difficulty: "Intermediate",
    avgReturn: "+15.7%",
    winRate: "58%",
  },
  {
    id: "mean-reversion",
    name: "Mean Reversion",
    icon: Icons.Target,
    color: "#a78bfa",
    description: "Buy stretched pullbacks, sell stretched rallies. Uses RSI bands for entry/exit.",
    logic: "Long when RSI(14) < 35. Exit when RSI(14) > 65.",
    indicators: ["RSI 14", "Bollinger Bands"],
    difficulty: "Intermediate",
    avgReturn: "+21.3%",
    winRate: "65%",
  },
  {
    id: "breakout",
    name: "Breakout Hunter",
    icon: Icons.Zap,
    color: "#f472b6",
    description: "Catch explosive moves. Enter on volume-confirmed breakout above resistance.",
    logic: "Long when Close > 20-day High with Volume > 1.5x Avg. Trail stop at 2 ATR.",
    indicators: ["Volume", "ATR", "20-day High"],
    difficulty: "Advanced",
    avgReturn: "+28.6%",
    winRate: "52%",
  },
  {
    id: "scalper",
    name: "Scalping Engine",
    icon: Icons.Layers,
    color: "#fb923c",
    description: "Quick in, quick out. High-frequency entries on micro momentum with tight stops.",
    logic: "Long when RSI(7) < 25 AND MACD histogram > 0. Exit at +1.5% or -0.8%.",
    indicators: ["RSI 7", "MACD", "VWAP"],
    difficulty: "Advanced",
    avgReturn: "+31.2%",
    winRate: "71%",
  },
];

const TICKERS = [
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "AAPL", name: "Apple" },
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "GOOGL", name: "Alphabet" },
  { symbol: "AMZN", name: "Amazon" },
  { symbol: "META", name: "Meta" },
  { symbol: "SPY", name: "S&P 500 ETF" },
  { symbol: "QQQ", name: "Nasdaq ETF" },
  { symbol: "BTC", name: "Bitcoin" },
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "SOL", name: "Solana" },
];

const PERIODS = ["1M", "3M", "6M", "1Y"];

// Map template IDs to /api/backtest strategy names
const TEMPLATE_TO_STRATEGY = {
  momentum: "ema_crossover",
  "rsi-bounce": "rsi",
  "macd-cross": "macd",
  "mean-reversion": "rsi",
  breakout: "breakout",
  scalper: "macd",
};

const TEMPLATE_PARAMS = {
  momentum: { shortEmaPeriod: 9, longEmaPeriod: 20 },
  "rsi-bounce": { rsiPeriod: 14, entryThreshold: 30, exitThreshold: 55 },
  "macd-cross": {},
  "mean-reversion": { rsiPeriod: 14, entryThreshold: 35, exitThreshold: 65 },
  breakout: { breakoutPeriod: 20 },
  scalper: {},
};

const PERIOD_TO_MONTHS = { "1M": 1, "3M": 3, "6M": 6, "1Y": 12 };

// ── Fetch Real Backtest from Twelve Data via /api/backtest ─────
const fetchBacktest = async (ticker, templateId, period, capital) => {
  const strategy = TEMPLATE_TO_STRATEGY[templateId] || "rsi";
  const months = PERIOD_TO_MONTHS[period] || 3;
  const params = { ...(TEMPLATE_PARAMS[templateId] || {}), positionSize: capital, stopLoss: 3 };

  const res = await fetch("/api/backtest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol: ticker, strategy, months, interval: "1day", params }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Backtest failed (${res.status})`);
  }

  return res.json();
};

// ── Chart Component ────────────────────────────────────────────
const BacktestChart = ({ data, result, template }) => {
  const ref = useRef(null);
  const [dims, setDims] = useState({ w: 800, h: 360 });
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver((e) => {
      const { width, height } = e[0].contentRect;
      if (width > 0 && height > 0) setDims({ w: width, h: height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const { w, h } = dims;
  const pad = { top: 24, right: 56, bottom: 28, left: 8 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  // Downsample
  const step = Math.max(1, Math.floor(data.length / 500));
  const sampled = useMemo(() => data.filter((_, i) => i % step === 0), [data, step]);

  const minP = Math.min(...sampled.map((d) => d.low)) * 0.985;
  const maxP = Math.max(...sampled.map((d) => d.high)) * 1.015;
  const rangeP = maxP - minP || 1;

  const x = (i) => pad.left + (i / (sampled.length - 1)) * cw;
  const y = (v) => pad.top + ch - ((v - minP) / rangeP) * ch;

  const pricePath = sampled.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.close)}`).join(" ");

  // Equity overlay (normalized to price range)
  const eqSampled = result.equity.filter((_, i) => i % step === 0);
  const eqMin = Math.min(...eqSampled);
  const eqMax = Math.max(...eqSampled);
  const eqRange = eqMax - eqMin || 1;
  const eqPath = eqSampled
    .map((v, i) => {
      const norm = minP + ((v - eqMin) / eqRange) * rangeP;
      return `${i === 0 ? "M" : "L"}${x(i)},${y(norm)}`;
    })
    .join(" ");

  // Trade markers (mapped to sampled indices)
  const tradeMarkers = result.trades
    .map((t) => ({ ...t, si: Math.round(t.index / step) }))
    .filter((t) => t.si >= 0 && t.si < sampled.length);

  // Y-axis
  const yTicks = 6;
  const yLabels = Array.from({ length: yTicks }, (_, i) => {
    const val = minP + (rangeP * i) / (yTicks - 1);
    return { val, yp: y(val) };
  });

  // X-axis months
  const monthLabels = {};
  sampled.forEach((d, i) => {
    const dt = new Date(d.date);
    const k = `${dt.getFullYear()}-${dt.getMonth()}`;
    if (!monthLabels[k]) monthLabels[k] = { label: dt.toLocaleDateString("en-US", { month: "short" }), xp: x(i) };
  });

  const handleMove = (e) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left - pad.left;
    const idx = Math.round((mx / cw) * (sampled.length - 1));
    setHover(Math.max(0, Math.min(sampled.length - 1, idx)));
  };

  const hd = hover != null ? sampled[hover] : null;
  const heq = hover != null ? eqSampled[Math.min(hover, eqSampled.length - 1)] : null;

  return (
    <div ref={ref} className="w-full h-full relative cursor-crosshair" onMouseMove={handleMove} onMouseLeave={() => setHover(null)}>
      {/* Hover tooltip */}
      {hd && (
        <div className="absolute top-2 left-3 flex items-center gap-4 text-xs z-10 pointer-events-none" style={{ fontFamily: "monospace" }}>
          <span style={{ color: "rgba(255,255,255,0.4)" }}>{new Date(hd.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
          <span style={{ color: "rgba(255,255,255,0.5)" }}>O {hd.open.toFixed(2)}</span>
          <span style={{ color: "#34d399" }}>H {hd.high.toFixed(2)}</span>
          <span style={{ color: "#f87171" }}>L {hd.low.toFixed(2)}</span>
          <span style={{ color: "rgba(255,255,255,0.9)" }}>C {hd.close.toFixed(2)}</span>
          {heq && (
            <span style={{ color: template.color }}>
              Equity ${heq.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          )}
        </div>
      )}

      <svg width={w} height={h}>
        <defs>
          <linearGradient id="pGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="eGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={template.color} stopOpacity="0.15" />
            <stop offset="100%" stopColor={template.color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yLabels.map(({ val, yp }, i) => (
          <g key={i}>
            <line x1={pad.left} y1={yp} x2={w - pad.right} y2={yp} stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
            <text x={w - pad.right + 5} y={yp + 3} fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="monospace">
              {val >= 1000 ? `$${(val / 1000).toFixed(1)}k` : `$${val.toFixed(0)}`}
            </text>
          </g>
        ))}

        {Object.values(monthLabels).map((m, i) => (
          <text key={i} x={m.xp} y={h - 6} fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="monospace" textAnchor="middle">
            {m.label}
          </text>
        ))}

        {/* Price area */}
        <path d={`${pricePath} L${x(sampled.length - 1)},${y(minP)} L${x(0)},${y(minP)} Z`} fill="url(#pGrad)" />
        <path d={pricePath} fill="none" stroke="#3b82f6" strokeWidth="1.5" opacity="0.7" />

        {/* Equity curve */}
        <path d={`${eqPath} L${x(eqSampled.length - 1)},${y(minP)} L${x(0)},${y(minP)} Z`} fill="url(#eGrad)" />
        <path d={eqPath} fill="none" stroke={template.color} strokeWidth="2" opacity="0.9" />

        {/* Trade markers */}
        {tradeMarkers.map((t, i) => (
          <g key={i}>
            {t.type === "BUY" ? (
              <>
                <circle cx={x(t.si)} cy={y(t.price)} r="3.5" fill={template.color} opacity="0.9" />
                <line x1={x(t.si)} y1={y(t.price) + 4} x2={x(t.si)} y2={y(t.price) + 12} stroke={template.color} strokeWidth="0.5" opacity="0.5" />
              </>
            ) : (
              <>
                <circle cx={x(t.si)} cy={y(t.price)} r="3.5" fill={t.pnl >= 0 ? "#34d399" : "#f87171"} opacity="0.9" />
                <line x1={x(t.si)} y1={y(t.price) - 4} x2={x(t.si)} y2={y(t.price) - 12} stroke={t.pnl >= 0 ? "#34d399" : "#f87171"} strokeWidth="0.5" opacity="0.5" />
              </>
            )}
          </g>
        ))}

        {/* Hover crosshair */}
        {hover != null && (
          <>
            <line x1={x(hover)} y1={pad.top} x2={x(hover)} y2={h - pad.bottom} stroke="rgba(255,255,255,0.25)" strokeWidth="0.5" strokeDasharray="3,3" />
            <circle cx={x(hover)} cy={y(sampled[hover].close)} r="3" fill="#3b82f6" stroke="#0f172a" strokeWidth="2" />
          </>
        )}
      </svg>
    </div>
  );
};

// ── Stat Card ──────────────────────────────────────────────────
const StatCard = ({ label, value, sub, color }) => (
  <div className="px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] backdrop-blur">
    <div className="text-[10px] mb-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</div>
    <div className="text-sm font-semibold tabular-nums" style={{ color: color || "rgba(255,255,255,0.9)", fontFamily: "monospace" }}>{value}</div>
    {sub && <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>{sub}</div>}
  </div>
);

// ── Dropdown ───────────────────────────────────────────────────
const Dropdown = ({ value, options, onChange, renderOption, width = "w-32" }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const label = renderOption ? renderOption(value) : value;

  return (
    <div ref={ref} className={`relative ${width}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-all bg-white/[0.04] border border-white/[0.06] backdrop-blur"
        style={{ color: "rgba(255,255,255,0.9)" }}
      >
        <span className="truncate">{label}</span>
        <Icons.ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} style={{ color: "rgba(255,255,255,0.4)" }} />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 w-full rounded-lg overflow-hidden z-50 max-h-60 overflow-y-auto bg-white/[0.04] border border-white/[0.08] backdrop-blur" style={{ boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}>
          {options.map((opt) => {
            const optVal = typeof opt === "object" ? opt.symbol || opt.value : opt;
            const optLabel = renderOption ? renderOption(opt) : optVal;
            return (
              <button
                key={optVal}
                onClick={() => { onChange(optVal); setOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm transition-all hover:bg-white/5"
                style={{ color: optVal === value ? "#34d399" : "rgba(255,255,255,0.5)" }}
              >
                {optLabel}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Templates Gallery ──────────────────────────────────────────
const TemplatesGallery = ({ onSelect }) => (
  <div>
    <div className="mb-6">
      <h2 className="text-xl font-semibold tracking-tight" style={{ color: "#e2e8f0" }}>Strategy Templates</h2>
      <p className="text-sm mt-1" style={{ color: "#475569" }}>Select a strategy to backtest on any ticker</p>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {TEMPLATES.map((t, i) => {
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t)}
            className="group text-left p-4 rounded-xl transition-all duration-300"
            style={{
              background: "#0a1628",
              border: "1px solid #1e293b",
              animationDelay: `${i * 60}ms`,
              animation: "fadeSlideIn 0.4s ease both",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = t.color + "50";
              e.currentTarget.style.boxShadow = `0 0 24px ${t.color}10`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#1e293b";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: t.color + "12" }}>
                <Icon className="w-4.5 h-4.5" style={{ color: t.color, width: 18, height: 18 }} />
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: t.color + "15", color: t.color }}>
                {t.difficulty}
              </span>
            </div>
            <h3 className="text-sm font-semibold mb-1" style={{ color: "#e2e8f0" }}>{t.name}</h3>
            <p className="text-xs leading-relaxed mb-3" style={{ color: "#64748b" }}>{t.description}</p>
            <div className="flex items-center gap-3 text-xs" style={{ color: "#475569" }}>
              <span>Avg <span style={{ color: "#34d399" }}>{t.avgReturn}</span></span>
              <span>•</span>
              <span>Win Rate <span style={{ color: "#94a3b8" }}>{t.winRate}</span></span>
            </div>
            <div className="mt-3 pt-3 flex items-center gap-1.5 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity" style={{ borderTop: `1px solid #1e293b`, color: t.color }}>
              <Icons.Play style={{ width: 12, height: 12 }} />
              Run Backtest
            </div>
          </button>
        );
      })}
    </div>
  </div>
);

// ── Strategy Detail View ───────────────────────────────────────
const StrategyDetail = ({ template, onBack, onActivate }) => {
  const [ticker, setTicker] = useState("TSLA");
  const [period, setPeriod] = useState("6M");
  const [capital, setCapital] = useState(100000);
  const [isRunning, setIsRunning] = useState(true);
  const [activated, setActivated] = useState(false);
  const [activating, setActivating] = useState(false);
  const [data, setData] = useState([]);
  const [dataSource, setDataSource] = useState("loading");
  const [fetchError, setFetchError] = useState(null);
  const [backtestResult, setBacktestResult] = useState(null);

  // Fetch candles + backtest when params change
  useEffect(() => {
    let cancelled = false;
    setIsRunning(true);
    setFetchError(null);
    setDataSource("loading");
    setBacktestResult(null);

    const months = PERIOD_TO_MONTHS[period] || 3;
    const candleCount = months * 22; // ~22 trading days per month

    Promise.all([
      fetch(`/api/chart/candles?symbol=${ticker}&interval=1day&outputsize=${candleCount}`).then((r) => r.json()),
      fetchBacktest(ticker, template.id, period, capital),
    ]).then(([candleData, btResult]) => {
      if (cancelled) return;
      const bars = (candleData?.values || []).map((b) => ({
        date: b.datetime,
        timestamp: new Date(b.datetime).getTime(),
        open: +b.open,
        high: +b.high,
        low: +b.low,
        close: +b.close,
        volume: b.volume || 0,
      }));
      setData(bars);
      setBacktestResult(btResult);
      setDataSource("twelvedata");
      setIsRunning(false);
    }).catch((err) => {
      if (cancelled) return;
      setFetchError(`Could not fetch data for $${ticker} (${period})`);
      setData([]);
      setBacktestResult(null);
      setDataSource("error");
      setIsRunning(false);
    });

    return () => { cancelled = true; };
  }, [ticker, period, template.id, capital]);

  // Adapt backtest result into the shape the chart/stats expect
  const result = useMemo(() => {
    if (!backtestResult || data.length === 0) return null;
    const bt = backtestResult;
    const s = bt.stats;

    // Build equity curve from trades
    const equity = [capital];
    let cumPnl = 0;
    const tradeExitDates = new Map();
    for (const t of bt.trades) {
      cumPnl += t.profit;
      tradeExitDates.set(t.exitDate, cumPnl);
    }
    let runningPnl = 0;
    for (let i = 1; i < data.length; i++) {
      const dateStr = data[i].date?.split("T")[0] || data[i].date;
      if (tradeExitDates.has(dateStr)) runningPnl = tradeExitDates.get(dateStr);
      equity.push(+(capital + runningPnl).toFixed(2));
    }

    // Map backtest trades to chart format
    const trades = [];
    for (const t of bt.trades) {
      const entryIdx = data.findIndex((d) => (d.date?.split("T")[0] || d.date) === t.entryDate);
      const exitIdx = data.findIndex((d) => (d.date?.split("T")[0] || d.date) === t.exitDate);
      if (entryIdx >= 0) trades.push({ type: "BUY", index: entryIdx, price: t.entryPrice, shares: t.shares, date: t.entryDate });
      if (exitIdx >= 0) trades.push({ type: "SELL", index: exitIdx, price: t.exitPrice, shares: t.shares, pnl: t.profit, date: t.exitDate });
    }

    // Build round trips
    const roundTrips = bt.trades.map((t, i) => ({
      id: i + 1, type: "LONG", entryDate: t.entryDate, exitDate: t.exitDate,
      entryPrice: t.entryPrice, exitPrice: t.exitPrice, shares: t.shares,
      openValue: +(t.shares * t.entryPrice).toFixed(2),
      closeValue: +(t.shares * t.exitPrice).toFixed(2),
      pnl: t.profit, pnlPct: t.returnPct, duration: `${t.holdingDays}d`,
    }));

    const finalEquity = equity[equity.length - 1];
    const pnl = s.totalProfit;
    const pctReturn = capital > 0 ? ((pnl / capital) * 100).toFixed(1) : "0";
    let peak = capital, maxDD = 0;
    equity.forEach((v) => { if (v > peak) peak = v; const dd = ((peak - v) / peak) * 100; if (dd > maxDD) maxDD = dd; });

    return {
      trades, roundTrips, equity, pnl, pctReturn, finalEquity,
      winRate: s.winRate, maxDD: maxDD.toFixed(1), sharpe: "—",
      totalTrades: s.totalTrades, wins: s.winners, losses: s.losers,
      bestTrade: s.totalTrades > 0 ? Math.max(...bt.trades.map((t) => t.profit)) : 0,
      worstTrade: s.totalTrades > 0 ? Math.min(...bt.trades.map((t) => t.profit)) : 0,
      avgTrade: s.totalTrades > 0 ? +(s.totalProfit / s.totalTrades).toFixed(2) : 0,
    };
  }, [backtestResult, data, capital]);

  const fmt = (v) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);

  const Icon = template.icon;
  const canActivate = !activated && !activating;

  const handleActivate = async () => {
    if (!canActivate) return;

    const strategyToActivate = {
      id: `template-${template.id}-${ticker}-${timeframe}-${period}`.toLowerCase(),
      name: `${template.name} · ${ticker}`,
      type: template.name,
      templateId: template.id,
      ticker,
      symbol: ticker,
      timeframe: "1D",
      period,
      capital,
      backtestAmount: capital,
      description: template.description,
      logic: template.logic,
      indicators: template.indicators,
      source: 'template',
      status: 'active',
      backtestResults: result ? {
        totalPnL: result.pnl,
        returnPercent: result.pctReturn,
        winRate: result.winRate,
        totalTrades: result.totalTrades,
      } : null,
    };

    setActivating(true);
    try {
      const didActivate = await onActivate?.(strategyToActivate);
      if (didActivate === false) return;
      setActivated(true);
    } finally {
      setActivating(false);
    }
  };

  return (
    <div style={{ animation: "fadeSlideIn 0.35s ease both" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg transition-all hover:bg-white/5 border border-white/[0.06] backdrop-blur"
          >
            <Icons.ArrowLeft className="w-4 h-4" style={{ color: "rgba(255,255,255,0.5)" }} />
          </button>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: template.color + "15" }}>
            <Icon style={{ color: template.color, width: 16, height: 16 }} />
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>{template.name}</h2>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{template.logic}</p>
          </div>
        </div>

        <button
          onClick={handleActivate}
          disabled={!canActivate}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
          style={{
            background: activated ? "#16a34a20" : `linear-gradient(135deg, ${template.color}, ${template.color}cc)`,
            color: activated ? "#34d399" : "#020817",
            border: activated ? "1px solid #16a34a40" : "none",
            opacity: canActivate ? 1 : 0.85,
          }}
        >
          {activated ? (
            <>
              <Icons.Check className="w-4 h-4" />
              Strategy Activated
            </>
          ) : activating ? (
            <>
              <div className="w-3.5 h-3.5 rounded-full border-2 border-[#020817] border-t-transparent animate-spin" />
              Activating...
            </>
          ) : (
            <>
              <Icons.Play className="w-3.5 h-3.5" />
              Activate Strategy
            </>
          )}
        </button>
      </div>

      {/* Config Bar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Dropdown
          value={ticker}
          options={TICKERS}
          onChange={setTicker}
          width="w-40"
          renderOption={(opt) => {
            if (typeof opt === "object") return `$${opt.symbol} — ${opt.name}`;
            const found = TICKERS.find((t) => t.symbol === opt);
            return found ? `$${found.symbol}` : opt;
          }}
        />
        <Dropdown value={period} options={PERIODS} onChange={setPeriod} width="w-20" />

        <div className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm bg-white/[0.03] border border-white/[0.06] backdrop-blur">
          <Icons.DollarSign className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.4)" }} />
          <input
            type="text"
            value={capital.toLocaleString()}
            onChange={(e) => {
              const v = parseInt(e.target.value.replace(/,/g, ""));
              if (!isNaN(v) && v > 0) setCapital(v);
            }}
            className="w-24 bg-transparent text-sm outline-none tabular-nums"
            style={{ color: "rgba(255,255,255,0.9)", fontFamily: "monospace" }}
          />
        </div>

        {isRunning && (
          <div className="flex items-center gap-2 px-3 py-2 text-xs" style={{ color: template.color }}>
            <div className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${template.color} transparent ${template.color} ${template.color}` }} />
            Running backtest...
          </div>
        )}

        <div className="ml-auto flex items-center gap-2 text-xs tabular-nums" style={{ fontFamily: "monospace" }}>
          <span className="px-1.5 py-0.5 rounded" style={{
            background: dataSource === "twelvedata" ? "#16a34a15" : dataSource === "error" ? "#ef444415" : "#3b82f615",
            color: dataSource === "twelvedata" ? "#34d399" : dataSource === "error" ? "#f87171" : "#60a5fa",
            border: `1px solid ${dataSource === "twelvedata" ? "#16a34a30" : dataSource === "error" ? "#ef444430" : "#3b82f630"}`,
          }}>
            {dataSource === "twelvedata" ? "TWELVE DATA" : dataSource === "error" ? "ERROR" : "LOADING"}
          </span>
          <span style={{ color: "rgba(255,255,255,0.25)" }}>{data.length.toLocaleString()} candles</span>
          <span style={{ color: "rgba(255,255,255,0.25)" }}>·</span>
          <span style={{ color: "rgba(255,255,255,0.25)" }}>1D × {period}</span>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-xl overflow-hidden mb-3 bg-white/[0.02] border border-white/[0.06] backdrop-blur" style={{ opacity: isRunning ? 0.5 : 1, transition: "opacity 0.3s" }}>
        <div className="h-[340px]">
          {data.length > 0 && result ? (
            <BacktestChart data={data} result={result} template={template} />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-6 h-6 mx-auto mb-2 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: `${template.color} transparent ${template.color} ${template.color}` }} />
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {fetchError || "Running backtest with Twelve Data..."}
                </span>
              </div>
            </div>
          )}
        </div>
        {/* Legend */}
        <div className="flex items-center gap-4 px-4 py-2 text-xs" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 rounded" style={{ background: "#3b82f6" }} />
            <span style={{ color: "rgba(255,255,255,0.4)" }}>Price</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 rounded" style={{ background: template.color }} />
            <span style={{ color: "rgba(255,255,255,0.4)" }}>Equity Curve</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: template.color }} />
            <span style={{ color: "rgba(255,255,255,0.4)" }}>Buy</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: "#34d399" }} />
            <span style={{ color: "rgba(255,255,255,0.4)" }}>Sell (profit)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: "#f87171" }} />
            <span style={{ color: "rgba(255,255,255,0.4)" }}>Sell (loss)</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      {result && (
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 mb-3">
        <StatCard label="Total P&L" value={`${result.pnl >= 0 ? "+" : ""}${fmt(result.pnl)}`} color={result.pnl >= 0 ? "#34d399" : "#f87171"} />
        <StatCard label="Return" value={`${result.pnl >= 0 ? "+" : ""}${result.pctReturn}%`} color={result.pnl >= 0 ? "#34d399" : "#f87171"} />
        <StatCard label="Final Value" value={fmt(result.finalEquity)} />
        <StatCard label="Win Rate" value={`${result.winRate}%`} color="rgba(255,255,255,0.5)" />
        <StatCard label="Trades" value={result.totalTrades} sub={`${result.wins}W / ${result.losses}L`} />
        <StatCard label="Max Drawdown" value={`-${result.maxDD}%`} color="#f87171" />
        <StatCard label="Sharpe Ratio" value={result.sharpe} color={parseFloat(result.sharpe) > 1 ? "#34d399" : "#f59e0b"} />
        <StatCard label="Best Trade" value={`+${fmt(result.bestTrade)}`} color="#34d399" />
      </div>
      )}
    </div>
  );
};

// ── Main App ───────────────────────────────────────────────────
export default function StrategyTemplateFlow({ initialTemplate, onBack: parentOnBack, onActivateStrategy }) {
  const [selected, setSelected] = useState(() => {
    if (initialTemplate) {
      return TEMPLATES.find(t => t.id === initialTemplate) || null;
    }
    return null;
  });

  return (
    <div
      className="min-h-screen w-full text-white"
      style={{
        background: "#0b0b0b",
        fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', ui-monospace, monospace",
      }}
    >

      <div className="relative z-10 p-4 lg:p-6 max-w-[1400px] mx-auto">
        {/* Content */}
        {selected ? (
          <StrategyDetail
            template={selected}
            onActivate={onActivateStrategy}
            onBack={() => { if (initialTemplate && parentOnBack) parentOnBack(); else setSelected(null); }}
          />
        ) : (
          <TemplatesGallery onSelect={setSelected} />
        )}
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        input[type="text"]:focus { outline: none; }
        ::-webkit-scrollbar { display: none; }
        ::-webkit-scrollbar-track { background: #0b0b0b; }
        ::-webkit-scrollbar-thumb { display: none; border-radius: 4px; }
      `}</style>
    </div>
  );
}
