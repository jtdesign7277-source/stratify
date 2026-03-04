import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  createChart,
  createSeriesMarkers,
  CrosshairMode,
  CandlestickSeries,
  LineSeries,
  BaselineSeries,
} from 'lightweight-charts';
import { createClient } from '@supabase/supabase-js';
import { createLiveDetector } from '../../utils/radarEngine';
import { createSmartMoneyDetector } from '../../utils/smartMoneyEngine';
import { motion, AnimatePresence } from 'framer-motion';
import { MousePointer2, TrendingUp, Minus, MoveRight, Square, GitBranch, Eraser, Search, RotateCcw, Maximize2, Minimize2 } from 'lucide-react';

// ── Supabase Client ──────────────────────────────────────────────────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ── Constants ────────────────────────────────────────────────────────────────
const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1H', '2H', '4H', '1D'];
const TIMEFRAME_MAP = {
  '1m': '1min',
  '5m': '5min',
  '15m': '15min',
  '30m': '30min',
  '1H': '1h',
  '2H': '2h',
  '4H': '4h',
  '1D': '1day',
};
const BULL_COLOR = '#089981';
const BEAR_COLOR = '#f23645';
const HPZ_BULL = '#1de9b6';
const HPZ_BEAR = '#ff5252';
const CHOCH_COLOR = '#00C2FF';
const BOS_COLOR = '#7B61FF';

const DEFAULT_TICKERS = ['TSLA', 'NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'SPY', 'QQQ', 'BTC/USD', 'ETH/USD', 'SOL/USD'];

const CRYPTO_TICKERS = new Set(['BTC/USD', 'ETH/USD', 'SOL/USD', 'XRP/USD', 'DOGE/USD', 'LINK/USD', 'ADA/USD', 'AVAX/USD', 'DOT/USD']);

function isCryptoTicker(ticker) {
  return CRYPTO_TICKERS.has(ticker) || /\/(USD|USDT|BTC)$/.test(ticker);
}

// Returns { open, premarket, afterhours, label, dotColor }
function getMarketStatus(ticker) {
  if (isCryptoTicker(ticker)) return { open: true, premarket: false, afterhours: false, label: 'Scanning', dotColor: 'bg-emerald-400' };
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay(); // 0=Sun, 6=Sat
  const mins = et.getHours() * 60 + et.getMinutes();
  const isWeekday = day >= 1 && day <= 5;
  if (!isWeekday) return { open: false, premarket: false, afterhours: false, label: 'Market Closed', dotColor: 'bg-orange-400' };
  if (mins >= 570 && mins < 960) return { open: true, premarket: false, afterhours: false, label: 'Scanning', dotColor: 'bg-emerald-400' }; // 9:30-16:00
  if (mins >= 240 && mins < 570) return { open: false, premarket: true, afterhours: false, label: 'Pre-Market', dotColor: 'bg-orange-400' }; // 4:00-9:30
  if (mins >= 960 && mins < 1200) return { open: false, premarket: false, afterhours: true, label: 'After-Hours', dotColor: 'bg-orange-400' }; // 16:00-20:00
  return { open: false, premarket: false, afterhours: false, label: 'Market Closed', dotColor: 'bg-orange-400' };
}

function getNextMarketOpen() {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay();
  const mins = et.getHours() * 60 + et.getMinutes();
  if (day >= 1 && day <= 5 && mins < 570) return 'today 9:30 AM ET';
  if ((day === 5 && mins >= 960) || day === 6 || day === 0) return 'Monday 9:30 AM ET';
  return 'tomorrow 9:30 AM ET';
}

const addCandlestickSeriesCompat = (chart, options) => {
  if (typeof chart?.addCandlestickSeries === 'function') {
    return chart.addCandlestickSeries(options);
  }
  if (typeof chart?.addSeries === 'function') {
    return chart.addSeries(CandlestickSeries, options);
  }
  throw new Error('Candlestick series API is unavailable in lightweight-charts.');
};

const addLineSeriesCompat = (chart, options) => {
  if (typeof chart?.addLineSeries === 'function') {
    return chart.addLineSeries(options);
  }
  if (typeof chart?.addSeries === 'function') {
    return chart.addSeries(LineSeries, options);
  }
  throw new Error('Line series API is unavailable in lightweight-charts.');
};

const addBaselineSeriesCompat = (chart, options) => {
  if (typeof chart?.addBaselineSeries === 'function') {
    return chart.addBaselineSeries(options);
  }
  if (typeof chart?.addSeries === 'function') {
    return chart.addSeries(BaselineSeries, options);
  }
  throw new Error('Baseline series API is unavailable in lightweight-charts.');
};

// ── Utilities ────────────────────────────────────────────────────────────────

function timeAgo(timestamp) {
  if (!timestamp) return '';
  // Handle ISO strings, unix seconds, or unix milliseconds
  let ms;
  if (typeof timestamp === 'string') {
    ms = new Date(timestamp).getTime();
  } else {
    const n = Number(timestamp);
    // If value is small enough to be unix seconds (before year 2100), convert to ms
    ms = n < 4102444800 ? n * 1000 : n;
  }
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function QualityGauge({ score }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 90 ? '#00C2FF' : score >= 80 ? '#1de9b6' : score >= 60 ? '#089981' : '#eab308';

  return (
    <div className="relative w-11 h-11 flex-shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <motion.circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold font-mono" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

async function loadActiveStrategies(userId) {
  const { data } = await supabase
    .from('radar_active_strategies')
    .select('strategy_id, enabled')
    .eq('user_id', userId);
  if (!data) return null;
  const map = {};
  data.forEach(r => { map[r.strategy_id] = r.enabled; });
  return map;
}

async function saveActiveStrategy(userId, strategyId, enabled) {
  await supabase
    .from('radar_active_strategies')
    .upsert({ user_id: userId, strategy_id: strategyId, enabled }, { onConflict: 'user_id,strategy_id' });
}

// ── Drawing Tools ────────────────────────────────────────────────────────────

const DRAW_TOOLS = [
  { id: 'crosshair', icon: MousePointer2, label: 'Crosshair', group: 0 },
  { id: 'hline', icon: Minus, label: 'Horizontal Line', group: 1 },
  { id: 'trendline', icon: TrendingUp, label: 'Trendline', group: 1 },
  { id: 'hray', icon: MoveRight, label: 'Horizontal Ray', group: 1 },
  { id: 'rectangle', icon: Square, label: 'Rectangle', group: 2 },
  { id: 'fib', icon: GitBranch, label: 'Fibonacci', group: 2 },
  { id: 'eraser', icon: Eraser, label: 'Eraser', group: 3 },
];

function loadDrawings(ticker) {
  try {
    const stored = localStorage.getItem(`radar_drawings_${ticker}`);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function persistDrawings(ticker, drawings) {
  try {
    localStorage.setItem(`radar_drawings_${ticker}`, JSON.stringify(drawings));
  } catch {}
}

function DrawingToolbar({ activeTool, onToolChange, onClearAll }) {
  const [clearFlash, setClearFlash] = useState(false);
  let lastGroup = -1;
  return (
    <div className="absolute left-2 top-1 z-20 inline-flex items-center w-fit bg-[#1e222d] border border-white/[0.08] rounded-lg px-1 py-0.5 backdrop-blur-sm">
      {DRAW_TOOLS.map(tool => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;
        const showDivider = lastGroup !== -1 && tool.group !== lastGroup;
        lastGroup = tool.group;
        return (
          <React.Fragment key={tool.id}>
            {showDivider && <div className="w-px h-5 bg-white/[0.08] mx-0.5" />}
            <button
              onClick={() => onToolChange(tool.id)}
              title={tool.label}
              className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
                isActive ? 'bg-white/[0.08] text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
              }`}
            >
              <Icon size={15} strokeWidth={1.5} />
            </button>
          </React.Fragment>
        );
      })}
      <div className="w-px h-5 bg-white/[0.08] mx-0.5" />
      <button
        onClick={() => {
          setClearFlash(true);
          onClearAll?.();
          setTimeout(() => setClearFlash(false), 200);
        }}
        title="Clear all drawings"
        className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
          clearFlash ? 'text-white' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
        }`}
      >
        <RotateCcw size={15} strokeWidth={1.5} />
      </button>
    </div>
  );
}

// ── Rainbow Search Bar CSS ───────────────────────────────────────────────────
const RAINBOW_STYLE_ID = 'radar-rainbow-css';
if (typeof document !== 'undefined' && !document.getElementById(RAINBOW_STYLE_ID)) {
  const style = document.createElement('style');
  style.id = RAINBOW_STYLE_ID;
  style.textContent = `
@keyframes rainbow-rotate {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
.radar-rainbow-border {
  background: linear-gradient(270deg, #34d399, #06b6d4, #3b82f6, #7c3aed, #ec4899, #ef4444, #f97316, #34d399);
  background-size: 400% 400%;
  animation: rainbow-rotate 6s ease infinite;
}
`;
  document.head.appendChild(style);
}

const RECENT_KEY = 'radar_recent_searches';

function loadRecentSearches() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').slice(0, 5); }
  catch { return []; }
}

function saveRecentSearch(ticker) {
  try {
    const prev = loadRecentSearches().filter(t => t !== ticker);
    localStorage.setItem(RECENT_KEY, JSON.stringify([ticker, ...prev].slice(0, 5)));
  } catch {}
}

function RadarSearchBar({ selectedTicker, onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [recentSearches, setRecentSearches] = useState(loadRecentSearches);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) { setResults([]); setIsOpen(query.length > 0 || isFocused); return; }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/radar/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
        setIsOpen(true);
        setHighlightIdx(-1);
      } catch {
        setResults([]);
      }
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  function selectTicker(ticker) {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    saveRecentSearch(ticker);
    setRecentSearches(loadRecentSearches());
    onSelect(ticker);
  }

  function handleKeyDown(e) {
    const totalItems = results.length + recentSearches.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(prev => (prev + 1) % (totalItems || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(prev => (prev - 1 + (totalItems || 1)) % (totalItems || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIdx >= 0 && highlightIdx < results.length) {
        selectTicker(results[highlightIdx].symbol);
      } else if (highlightIdx >= results.length && highlightIdx < totalItems) {
        selectTicker(recentSearches[highlightIdx - results.length]);
      } else if (results.length > 0) {
        selectTicker(results[0].symbol);
      } else if (query.trim().length > 0) {
        selectTicker(query.trim().toUpperCase());
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  }

  function getTypeColor(type) {
    const t = (type || '').toLowerCase();
    if (t.includes('crypto') || t.includes('digital')) return '#06b6d4';
    if (t.includes('etf') || t.includes('etp')) return '#7c3aed';
    return '#34d399';
  }

  function getTypeLabel(type) {
    const t = (type || '').toLowerCase();
    if (t.includes('crypto') || t.includes('digital')) return 'Crypto';
    if (t.includes('etf') || t.includes('etp')) return 'ETF';
    if (t.includes('index')) return 'Index';
    return 'Stock';
  }

  const showDropdown = isOpen && (results.length > 0 || (query.length < 2 && recentSearches.length > 0));

  return (
    <div ref={containerRef} className="w-[280px] mx-4 relative flex-shrink-0">
      {/* Search input wrapper */}
      <div className={`relative rounded-xl ${isFocused ? 'p-[1px] radar-rainbow-border' : ''}`}>
        <div
          className={`flex items-center gap-3 rounded-xl py-2.5 px-4 transition-all duration-200 ${
            isFocused
              ? 'bg-[#0a0a0f]'
              : 'bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] hover:shadow-[0_0_8px_rgba(255,255,255,0.03)]'
          }`}
        >
          <Search size={16} className="text-gray-500 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => { setIsFocused(true); setIsOpen(true); }}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder="Search any stock, ETF, crypto..."
            className="flex-1 bg-transparent text-base font-mono text-white placeholder:text-gray-600 placeholder:italic outline-none"
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]); }} className="text-gray-600 hover:text-gray-400 transition-colors">
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          )}
          <span className="text-xs font-mono text-gray-600 flex-shrink-0">{selectedTicker}</span>
        </div>
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full mt-1 z-50 overflow-hidden rounded-xl bg-[#0a0a0f]/95 backdrop-blur-xl border border-white/[0.08] shadow-2xl"
          >
            {/* Search results */}
            {results.length > 0 && (
              <div className="py-1">
                {results.map((r, i) => (
                  <button
                    key={r.symbol}
                    onMouseDown={(e) => { e.stopPropagation(); selectTicker(r.symbol); }}
                    onMouseEnter={() => setHighlightIdx(i)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      highlightIdx === i ? 'bg-white/[0.04]' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="text-sm font-mono font-bold text-white w-20 flex-shrink-0">{r.symbol}</span>
                    <span className="text-sm text-gray-400 flex-1 truncate">{r.name}</span>
                    <span className="text-xs text-gray-600 flex-shrink-0">{r.exchange}</span>
                    <span className="text-xs flex-shrink-0" style={{ color: getTypeColor(r.type) }}>{getTypeLabel(r.type)}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Recent searches */}
            {recentSearches.length > 0 && (
              <div className={results.length > 0 ? 'border-t border-white/[0.06]' : ''}>
                <div className="px-4 pt-2 pb-1">
                  <span className="text-[10px] text-gray-600 uppercase tracking-widest">Recent</span>
                </div>
                <div className="flex flex-wrap gap-1 px-4 pb-2.5">
                  {recentSearches.map((t, i) => (
                    <button
                      key={t}
                      onMouseDown={(e) => { e.stopPropagation(); selectTicker(t); }}
                      onMouseEnter={() => setHighlightIdx(results.length + i)}
                      className={`px-2.5 py-1 text-xs font-mono transition-colors rounded-md ${
                        highlightIdx === results.length + i ? 'text-white bg-white/[0.06]' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Error Boundary ───────────────────────────────────────────────────────────
class RadarErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-400 text-lg mb-2">Strategy Radar encountered an error</p>
            <p className="text-gray-500 text-sm">{this.state.error?.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 text-sm text-white bg-white/10 hover:bg-white/15 rounded-lg transition-colors"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Supabase Helpers ─────────────────────────────────────────────────────────
async function getUserSettings(userId) {
  const { data } = await supabase
    .from('radar_settings')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data;
}

async function upsertUserSettings(userId, settings) {
  const { data } = await supabase
    .from('radar_settings')
    .upsert({ user_id: userId, ...settings }, { onConflict: 'user_id' })
    .select()
    .single();
  return data;
}

async function getVerifiedStrategies() {
  const { data } = await supabase
    .from('radar_strategies')
    .select('*')
    .eq('is_active', true);
  return data || [];
}

async function saveSignal(userId, signal) {
  const { data } = await supabase
    .from('radar_signals')
    .insert({ user_id: userId, ...signal })
    .select()
    .single();
  return data;
}

async function getUserSignals(userId, limit = 50) {
  const { data } = await supabase
    .from('radar_signals')
    .select('*')
    .eq('user_id', userId)
    .order('detected_at', { ascending: false })
    .limit(limit);
  return data || [];
}

// ── Fetch Candles from Twelve Data via Vercel Serverless ─────────────────────
async function fetchCandles(ticker, timeframe) {
  try {
    const res = await fetch(`/api/radar/candles?symbol=${ticker}&interval=${TIMEFRAME_MAP[timeframe]}`);
    const data = await res.json();
    if (!data.values) return [];
    return data.values
      .map(v => ({
        time: Math.floor(new Date(v.datetime).getTime() / 1000),
        open: parseFloat(v.open),
        high: parseFloat(v.high),
        low: parseFloat(v.low),
        close: parseFloat(v.close),
        volume: parseInt(v.volume || 0),
      }))
      .sort((a, b) => a.time - b.time);
  } catch (err) {
    console.error('Failed to fetch candles:', err);
    return [];
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// RADAR CHART — TradingView Lightweight Charts with MSB/OB Overlays
// ══════════════════════════════════════════════════════════════════════════════

function RadarChart({ candles, orderBlocks, msbEvents, signals, chochEvents = [], bosEvents = [], onChartReady }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const markersRef = useRef(null);
  const obOverlaySeriesRef = useRef([]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: '#666',
        fontSize: 11,
        fontFamily: "'Inter', sans-serif",
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.03)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(255,255,255,0.1)', width: 1, style: 3 },
        horzLine: { color: 'rgba(255,255,255,0.1)', width: 1, style: 3 },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.06)',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.06)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });

    chartRef.current = chart;

    const candleSeries = addCandlestickSeriesCompat(chart, {
      upColor: BULL_COLOR,
      downColor: BEAR_COLOR,
      borderUpColor: BULL_COLOR,
      borderDownColor: BEAR_COLOR,
      wickUpColor: BULL_COLOR,
      wickDownColor: BEAR_COLOR,
    });
    candleSeriesRef.current = candleSeries;

    // Notify parent so it can manage drawings
    onChartReady?.({ chart, series: candleSeries, container: chartContainerRef.current });

    // Resize handler
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      obOverlaySeriesRef.current.forEach((s) => {
        try { chart.removeSeries(s); } catch {}
      });
      obOverlaySeriesRef.current = [];
      chart.remove();
    };
  }, []);

  // Update candle data + LuxAlgo-style OB/MSB overlays
  useEffect(() => {
    if (!candleSeriesRef.current || !candles.length) return;
    candleSeriesRef.current.setData(candles);

    const chartNow = Number(candles[candles.length - 1]?.time);
    const markers = [];

    // ── MSB markers — "MSB" text labels ──────────────────────────────
    msbEvents.forEach(msb => {
      markers.push({
        time: msb.time,
        position: msb.direction === 'long' ? 'belowBar' : 'aboveBar',
        color: msb.direction === 'long' ? BULL_COLOR : BEAR_COLOR,
        shape: msb.direction === 'long' ? 'arrowUp' : 'arrowDown',
        text: 'MSB',
      });
    });

    // ── Smart Money BUY/SELL signal markers (Pine Script style) ─────
    (Array.isArray(signals) ? signals : [])
      .filter(s => s.strategy_source === 'Smart Money' && s.status === 'active')
      .forEach(s => {
        const time = Number(s.detected_at ?? s.time);
        if (!Number.isFinite(time)) return;
        const isLong = s.direction === 'long';
        markers.push({
          time,
          position: isLong ? 'belowBar' : 'aboveBar',
          color: isLong ? '#00E676' : '#FF1744',
          shape: isLong ? 'arrowUp' : 'arrowDown',
          text: isLong ? 'BUY' : 'SELL',
        });
      });

    // ── CHoCH overlays — level line + zone + text marker (Pine Script style)
    chochEvents.slice(-5).forEach(ev => {
      const evBar = Number(ev.bar);
      const evTime = Number(ev.time);
      const level = Number(ev.level);
      if (!Number.isFinite(evBar) || !Number.isFinite(evTime) || !Number.isFinite(level)) return;

      // Text marker
      markers.push({
        time: evTime,
        position: ev.direction === 'long' ? 'belowBar' : 'aboveBar',
        color: CHOCH_COLOR,
        shape: ev.direction === 'long' ? 'arrowUp' : 'arrowDown',
        text: 'CHoCH',
      });

      if (chartRef.current) {
        // Level line spanning 2 bars before to 5 bars after
        const startIdx = Math.max(0, evBar - 2);
        const endIdx = Math.min(candles.length - 1, evBar + 5);
        const startTime = Number(candles[startIdx]?.time);
        const endTime = Number(candles[endIdx]?.time);
        if (Number.isFinite(startTime) && Number.isFinite(endTime) && startTime !== endTime) {
          const chLine = addLineSeriesCompat(chartRef.current, {
            color: CHOCH_COLOR, lineWidth: 2, lineStyle: 0,
            lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
          });
          chLine.setData([{ time: Math.min(startTime, endTime), value: level }, { time: Math.max(startTime, endTime), value: level }]);
          obOverlaySeriesRef.current.push(chLine);

          // Thin semi-transparent zone (0.1% above and below)
          const zoneHalf = level * 0.001;
          const chZone = addBaselineSeriesCompat(chartRef.current, {
            baseValue: { type: 'price', price: level - zoneHalf },
            topFillColor1: 'rgba(0,194,255,0.06)', topFillColor2: 'rgba(0,194,255,0.06)',
            topLineColor: 'rgba(0,0,0,0)',
            bottomFillColor1: 'rgba(0,0,0,0)', bottomFillColor2: 'rgba(0,0,0,0)',
            bottomLineColor: 'rgba(0,0,0,0)',
            lineWidth: 0, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
          });
          chZone.setData([{ time: Math.min(startTime, endTime), value: level + zoneHalf }, { time: Math.max(startTime, endTime), value: level + zoneHalf }]);
          obOverlaySeriesRef.current.push(chZone);
        }
      }
    });

    // ── BOS overlays — level line + zone + text marker (Pine Script style)
    bosEvents.slice(-5).forEach(ev => {
      const evBar = Number(ev.bar);
      const evTime = Number(ev.time);
      const level = Number(ev.level);
      if (!Number.isFinite(evBar) || !Number.isFinite(evTime) || !Number.isFinite(level)) return;

      markers.push({
        time: evTime,
        position: ev.direction === 'long' ? 'belowBar' : 'aboveBar',
        color: BOS_COLOR,
        shape: ev.direction === 'long' ? 'arrowUp' : 'arrowDown',
        text: 'BOS',
      });

      if (chartRef.current) {
        const startIdx = Math.max(0, evBar - 2);
        const endIdx = Math.min(candles.length - 1, evBar + 5);
        const startTime = Number(candles[startIdx]?.time);
        const endTime = Number(candles[endIdx]?.time);
        if (Number.isFinite(startTime) && Number.isFinite(endTime) && startTime !== endTime) {
          const bosLine = addLineSeriesCompat(chartRef.current, {
            color: '#E040FB', lineWidth: 2, lineStyle: 0,
            lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
          });
          bosLine.setData([{ time: Math.min(startTime, endTime), value: level }, { time: Math.max(startTime, endTime), value: level }]);
          obOverlaySeriesRef.current.push(bosLine);

          const zoneHalf = level * 0.001;
          const bosZone = addBaselineSeriesCompat(chartRef.current, {
            baseValue: { type: 'price', price: level - zoneHalf },
            topFillColor1: 'rgba(224,64,251,0.06)', topFillColor2: 'rgba(224,64,251,0.06)',
            topLineColor: 'rgba(0,0,0,0)',
            bottomFillColor1: 'rgba(0,0,0,0)', bottomFillColor2: 'rgba(0,0,0,0)',
            bottomLineColor: 'rgba(0,0,0,0)',
            lineWidth: 0, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
          });
          bosZone.setData([{ time: Math.min(startTime, endTime), value: level + zoneHalf }, { time: Math.max(startTime, endTime), value: level + zoneHalf }]);
          obOverlaySeriesRef.current.push(bosZone);
        }
      }
    });

    // ── Triggered/completed signal markers ───────────────────────────
    (Array.isArray(signals) ? signals : [])
      .filter((signal) => {
        const status = String(signal?.status || '').toLowerCase();
        return status === 'triggered' || status === 'completed' || status === 'closed' || status === 'filled';
      })
      .forEach((signal) => {
        const time = Number(signal?.detected_at ?? signal?.time);
        if (!Number.isFinite(time)) return;
        const isLong = String(signal?.direction || '').toLowerCase() === 'long';
        markers.push({
          time,
          position: isLong ? 'belowBar' : 'aboveBar',
          color: isLong ? BULL_COLOR : BEAR_COLOR,
          shape: isLong ? 'arrowUp' : 'arrowDown',
          text: '',
        });
      });

    // ── Clean up previous overlay series ─────────────────────────────
    if (chartRef.current) {
      obOverlaySeriesRef.current.forEach((s) => {
        try { chartRef.current.removeSeries(s); } catch {}
      });
      obOverlaySeriesRef.current = [];

      // ── OB Zone Rectangles (LuxAlgo style) ───────────────────────
      const sortedOBs = [...orderBlocks].sort((a, b) => Number(b?.msbBar ?? 0) - Number(a?.msbBar ?? 0));
      const activeOBs = sortedOBs.filter(ob => !ob?.mitigated).slice(0, 3);
      const mitigatedOBs = sortedOBs.filter(ob => ob?.mitigated).slice(0, 2);
      const displayOBs = [...activeOBs, ...mitigatedOBs];

      displayOBs.forEach(ob => {
        const obTop = Number(ob?.top);
        const obBottom = Number(ob?.bottom);
        const obStart = Number(ob?.time);
        if (!Number.isFinite(obTop) || !Number.isFinite(obBottom) || !Number.isFinite(obStart) || !Number.isFinite(chartNow)) return;

        const startTime = Math.min(obStart, chartNow);
        const endTime = Math.max(obStart, chartNow);
        const bullish = String(ob?.direction || '').toLowerCase() === 'long';
        const isMitigated = !!ob?.mitigated;

        // Zone fill + border colors
        const zoneFill = isMitigated
          ? 'rgba(100,100,100,0.08)'
          : bullish ? 'rgba(8,153,129,0.15)' : 'rgba(242,54,69,0.15)';
        const borderColor = isMitigated
          ? 'rgba(100,100,100,0.3)'
          : bullish ? 'rgba(8,153,129,0.6)' : 'rgba(242,54,69,0.6)';

        // Shaded zone — baseline series (base=bottom, value=top)
        const zone = addBaselineSeriesCompat(chartRef.current, {
          baseValue: { type: 'price', price: obBottom },
          topFillColor1: zoneFill,
          topFillColor2: zoneFill,
          topLineColor: 'rgba(0,0,0,0)',
          bottomFillColor1: 'rgba(0,0,0,0)',
          bottomFillColor2: 'rgba(0,0,0,0)',
          bottomLineColor: 'rgba(0,0,0,0)',
          lineWidth: 0,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        });
        zone.setData([
          { time: startTime, value: obTop },
          { time: endTime, value: obTop },
        ]);
        obOverlaySeriesRef.current.push(zone);

        // Top border (dashed)
        const topBorder = addLineSeriesCompat(chartRef.current, {
          color: borderColor,
          lineWidth: 1,
          lineStyle: 2,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        });
        topBorder.setData([
          { time: startTime, value: obTop },
          { time: endTime, value: obTop },
        ]);
        obOverlaySeriesRef.current.push(topBorder);

        // Bottom border (dashed)
        const bottomBorder = addLineSeriesCompat(chartRef.current, {
          color: borderColor,
          lineWidth: 1,
          lineStyle: 2,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        });
        bottomBorder.setData([
          { time: startTime, value: obBottom },
          { time: endTime, value: obBottom },
        ]);
        obOverlaySeriesRef.current.push(bottomBorder);

        // Quality score text marker on the OB candle
        if (!isMitigated && ob?.score != null) {
          markers.push({
            time: obStart,
            position: bullish ? 'belowBar' : 'aboveBar',
            color: bullish ? BULL_COLOR : BEAR_COLOR,
            shape: 'square',
            text: `${Math.round(ob.score)}%`,
          });
        }
      });

      // ── MSB Break Lines — short horizontal at pivot level ────────
      // For each MSB event, find the pivot candle and draw a segment
      msbEvents.slice(-10).forEach(msb => {
        const msbIdx = Number(msb.bar);
        const msbTime = Number(msb.time);
        const level = Number(msb.level);
        if (!Number.isFinite(msbIdx) || !Number.isFinite(msbTime) || !Number.isFinite(level)) return;

        // Find the pivot candle whose high/low matches the break level
        const lookback = Math.min(msbIdx, 20);
        let pivotIdx = Math.max(0, msbIdx - lookback);
        let bestDist = Infinity;
        for (let i = Math.max(0, msbIdx - lookback); i < msbIdx; i++) {
          const c = candles[i];
          if (!c) continue;
          const p = msb.direction === 'long' ? c.high : c.low;
          const d = Math.abs(p - level);
          if (d < bestDist) {
            bestDist = d;
            pivotIdx = i;
          }
        }

        const pivotTime = Number(candles[pivotIdx]?.time);
        if (!Number.isFinite(pivotTime) || pivotTime === msbTime) return;

        const lineColor = msb.direction === 'long' ? BULL_COLOR : BEAR_COLOR;
        const msbLine = addLineSeriesCompat(chartRef.current, {
          color: lineColor,
          lineWidth: 1,
          lineStyle: 0,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        });
        msbLine.setData([
          { time: Math.min(pivotTime, msbTime), value: level },
          { time: Math.max(pivotTime, msbTime), value: level },
        ]);
        obOverlaySeriesRef.current.push(msbLine);
      });
    }

    // Sort markers by time and apply via v5 createSeriesMarkers API
    markers.sort((a, b) => a.time - b.time);
    if (markersRef.current) {
      markersRef.current.setMarkers(markers);
    } else {
      markersRef.current = createSeriesMarkers(candleSeriesRef.current, markers);
    }

    // Fit content
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [candles, orderBlocks, msbEvents, signals, chochEvents, bosEvents]);

  return <div ref={chartContainerRef} className="w-full h-full" />;
}

// ══════════════════════════════════════════════════════════════════════════════
// SIGNAL CARD — Redesigned with quality gauge, price ladder, always-visible details
// ══════════════════════════════════════════════════════════════════════════════

function SignalCard({ signal, marketStatus, isPreview }) {
  const dirColor = signal.direction === 'long' ? BULL_COLOR : BEAR_COLOR;
  const hpzColor = signal.direction === 'long' ? HPZ_BULL : HPZ_BEAR;
  const displayColor = signal.is_hpz ? hpzColor : dirColor;
  const rr = Math.abs(signal.entry_price - signal.stop_loss) > 0
    ? (Math.abs(signal.take_profit - signal.entry_price) / Math.abs(signal.entry_price - signal.stop_loss)).toFixed(1)
    : '—';

  return (
    <div className="border border-white/6 rounded-lg p-2 bg-white/[0.02]">
      <div className="flex items-center gap-2">
        <QualityGauge score={signal.quality_score} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-white font-mono">{signal.ticker}</span>
            <span className="text-sm font-semibold uppercase" style={{ color: displayColor }}>
              {signal.direction === 'long' ? '▲ LONG' : '▼ SHORT'}
            </span>
            {signal.is_hpz && <span className="text-[10px] font-bold" style={{ color: '#00C2FF' }}>HPZ</span>}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
            {signal.strategy_source && <span>{signal.strategy_source}</span>}
            <span>·</span>
            <span className="font-mono">{signal.timeframe}</span>
            <span>·</span>
            <span>{timeAgo(signal.detected_at || signal.time)}</span>
          </div>
        </div>
      </div>

      <div className="mt-1.5 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-7 text-right">TP</span>
          <div className="flex-1 border-t border-dashed" style={{ borderColor: BULL_COLOR }} />
          <span className="text-xs font-mono" style={{ color: BULL_COLOR }}>${signal.take_profit.toFixed(2)}</span>
          <span className="text-[10px] font-mono text-emerald-400 w-12 text-right">R:R {rr}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/60 w-7 text-right">Entry</span>
          <div className="flex-1 border-t border-white/70" />
          <span className="text-xs font-mono text-white">${signal.entry_price.toFixed(2)}</span>
          <span className="w-12" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-7 text-right">SL</span>
          <div className="flex-1 border-t border-dashed border-red-400" />
          <span className="text-xs font-mono text-red-400">${signal.stop_loss.toFixed(2)}</span>
          <span className="w-12" />
        </div>
      </div>

      <div className="mt-1 pt-1 border-t border-white/5 text-[10px] text-gray-400 font-mono">
        OB ${signal.ob_bottom.toFixed(2)}–${signal.ob_top.toFixed(2)} | MSB ${signal.msb_level.toFixed(2)} | Z {signal.momentum_z}
      </div>

      {(() => {
        if (isPreview) return (
          <div className="w-full mt-1.5 py-1.5 text-[10px] text-gray-500 text-center font-mono">Market opens {getNextMarketOpen()}</div>
        );
        const t = signal.detected_at || signal.time;
        let sigMs = 0;
        if (typeof t === 'string') sigMs = new Date(t).getTime();
        else if (t) sigMs = Number(t) < 4102444800 ? Number(t) * 1000 : Number(t);
        const expired = !sigMs || Date.now() - sigMs > 4 * 60 * 60 * 1000;
        const ms = marketStatus || {};
        const marketClosed = !ms.open && !ms.premarket && !ms.afterhours;
        const extendedHours = ms.premarket || ms.afterhours;

        if (expired) return (
          <button disabled className="w-full mt-1.5 py-1.5 text-[10px] font-semibold text-gray-500 rounded bg-white/5 cursor-not-allowed">Expired</button>
        );
        if (marketClosed) return (
          <button disabled className="w-full mt-1.5 py-1.5 text-[10px] font-semibold text-gray-500 rounded bg-white/5 cursor-not-allowed">Market Closed</button>
        );
        if (extendedHours) return (
          <button onClick={(e) => e.stopPropagation()} className="w-full mt-1.5 py-1.5 text-[10px] font-semibold text-orange-400 rounded bg-white/5 transition-all hover:bg-white/10">Extended Hours</button>
        );
        return (
          <button onClick={(e) => e.stopPropagation()} className="w-full mt-1.5 py-1.5 text-[10px] font-semibold text-white rounded transition-all hover:brightness-110"
            style={{ background: `linear-gradient(135deg, ${displayColor}, ${displayColor}90)`, boxShadow: `0 0 20px ${displayColor}30` }}>
            Confirm Trade
          </button>
        );
      })()}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STRATEGY CARD — Verified strategy with toggle
// ══════════════════════════════════════════════════════════════════════════════

function StrategyCard({ strategy, enabled, onToggle, onViewDetails }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-white/6 rounded-lg p-1.5">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setExpanded(!expanded)} className="flex-1 min-w-0 text-left">
          <span className="text-xs font-semibold text-white truncate">{strategy.name}</span>
        </button>
        <button
          onClick={() => onToggle(strategy.id)}
          className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${enabled ? 'bg-emerald-500/30' : 'bg-white/10'}`}
        >
          <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${enabled ? 'left-4 bg-emerald-400' : 'left-0.5 bg-gray-500'}`} />
        </button>
      </div>
      {expanded && strategy.backtest_win_rate && (
        <div className="flex items-center gap-3 mt-1 text-[10px]">
          <span className="text-gray-500">Win <span style={{ color: BULL_COLOR }} className="font-mono">{strategy.backtest_win_rate}%</span></span>
          <span className="text-gray-500">Ret <span style={{ color: BULL_COLOR }} className="font-mono">+{strategy.backtest_return}%</span></span>
          <span className="text-gray-500">PF <span className="text-gray-300 font-mono">{strategy.backtest_profit_factor}</span></span>
          <button onClick={() => onViewDetails(strategy)} className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors ml-auto">details</button>
        </div>
      )}
    </div>
  );
}

function StrategyDetailOverlay({ strategy, onClose }) {
  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="absolute inset-0 z-20 bg-[#0a0a0f] overflow-y-auto"
    >
      <div className="p-6">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <h2 className="text-xl font-bold text-white">{strategy.name}</h2>
        <p className="text-base text-gray-400 mt-1">{strategy.subtitle}</p>

        <div className="mt-6 space-y-6">
          <p className="text-base text-gray-300 leading-relaxed">{strategy.description}</p>
          {strategy.entry_logic && (
            <div>
              <span className="text-lg font-semibold text-emerald-400">Entry</span>
              <p className="mt-2 text-base text-gray-300 leading-relaxed">{strategy.entry_logic}</p>
            </div>
          )}
          {strategy.exit_logic && (
            <div>
              <span className="text-lg font-semibold text-emerald-400">Exit</span>
              <p className="mt-2 text-base text-gray-300 leading-relaxed">{strategy.exit_logic}</p>
            </div>
          )}
          {strategy.risk_management && (
            <div>
              <span className="text-lg font-semibold text-emerald-400">Risk</span>
              <p className="mt-2 text-base text-gray-300 leading-relaxed">{strategy.risk_management}</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SETTINGS PANEL — User-configurable SL/TP/Risk/Timeframe
// ══════════════════════════════════════════════════════════════════════════════

function RadarSettings({ settings, onUpdate }) {
  // Risk profile calculation
  const slPct = (settings.stop_loss_multiplier - 0.1) / (2.0 - 0.1);
  const tpFillPct = (settings.take_profit_multiplier - 1.0) / (5.0 - 1.0);
  const riskPct = (settings.risk_per_trade * 100 - 0.5) / (5.0 - 0.5);
  const riskScore = (slPct + (1 - tpFillPct) + riskPct) / 3;

  const riskProfile = riskScore < 0.33
    ? { label: 'Conservative', color: '#34d399' }
    : riskScore < 0.66
      ? { label: 'Moderate', color: '#34d399' }
      : { label: 'Aggressive', color: '#f23645' };

  const SLIDER_FILL = '#10b981';

  const sliderClass = "relative w-full appearance-none bg-transparent cursor-pointer z-10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-gray-600 [&::-webkit-slider-thumb]:cursor-pointer";

  return (
    <div className="border border-white/6 rounded-lg p-2 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">Settings</h3>
        <span className="text-[10px] font-semibold" style={{ color: riskProfile.color }}>{riskProfile.label}</span>
      </div>

      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <label className="text-[10px] text-gray-400 flex-1">Stop Loss</label>
          <span className="text-[10px] font-mono font-semibold text-emerald-400">{settings.stop_loss_multiplier}x</span>
        </div>
        <div className="relative h-4 flex items-center">
          <div className="absolute w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${slPct * 100}%`, backgroundColor: SLIDER_FILL }} />
          </div>
          <input type="range" min="0.1" max="2.0" step="0.1" value={settings.stop_loss_multiplier}
            onChange={e => onUpdate({ stop_loss_multiplier: parseFloat(e.target.value) })} className={sliderClass} />
        </div>
      </div>

      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <label className="text-[10px] text-gray-400 flex-1">Take Profit</label>
          <span className="text-[10px] font-mono font-semibold text-emerald-400">{settings.take_profit_multiplier}x</span>
        </div>
        <div className="relative h-4 flex items-center">
          <div className="absolute w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${tpFillPct * 100}%`, backgroundColor: SLIDER_FILL }} />
          </div>
          <input type="range" min="1.0" max="5.0" step="0.5" value={settings.take_profit_multiplier}
            onChange={e => onUpdate({ take_profit_multiplier: parseFloat(e.target.value) })} className={sliderClass} />
        </div>
      </div>

      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <label className="text-[10px] text-gray-400 flex-1">Risk Per Trade</label>
          <span className="text-[10px] font-mono font-semibold text-emerald-400">{(settings.risk_per_trade * 100).toFixed(1)}%</span>
        </div>
        <div className="relative h-4 flex items-center">
          <div className="absolute w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${riskPct * 100}%`, backgroundColor: SLIDER_FILL }} />
          </div>
          <input type="range" min="0.5" max="5.0" step="0.5" value={settings.risk_per_trade * 100}
            onChange={e => onUpdate({ risk_per_trade: parseFloat(e.target.value) / 100 })} className={sliderClass} />
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TREND STRENGTH MATRIX — Multi-TF alignment from Smart Money engine
// ══════════════════════════════════════════════════════════════════════════════

function TrendStrengthMatrix({ trendStrength, confidence, trendDetails }) {
  if (!trendDetails || trendDetails.length === 0) return null;
  return (
    <div className="border border-white/6 rounded-lg p-2">
      <h3 className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-1">Trend Strength</h3>
      <div className="flex items-center gap-2 text-xs font-mono">
        {trendDetails.map(({ label, direction }) => (
          <span key={label} className="flex items-center gap-0.5">
            <span className="text-gray-500">{label}</span>
            <span style={{ color: direction === 1 ? '#34d399' : direction === -1 ? '#f87171' : '#666' }}>
              {direction === 1 ? '▲' : direction === -1 ? '▼' : '—'}
            </span>
          </span>
        ))}
      </div>
      <div className="text-[10px] text-gray-400 mt-1">
        Str: <span className="font-mono font-semibold" style={{ color: trendStrength >= 0 ? '#34d399' : '#f87171' }}>{trendStrength > 0 ? '+' : ''}{trendStrength}%</span>
        {' · '}
        Conf: <span className="font-mono font-semibold text-white">{confidence}%</span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE — StrategyRadarPage
// ══════════════════════════════════════════════════════════════════════════════

function StrategyRadarContent() {
  const [selectedTicker, setSelectedTicker] = useState('TSLA');
  const [candles, setCandles] = useState([]);
  const [signals, setSignals] = useState([]);
  const [orderBlocks, setOrderBlocks] = useState([]);
  const [msbEvents, setMsbEvents] = useState([]);
  const [pivots, setPivots] = useState({ highs: [], lows: [] });
  const [strategies, setStrategies] = useState([]);
  const [activeStrategies, setActiveStrategies] = useState({});
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeSignalIdx, setActiveSignalIdx] = useState(0);
  const [expandedStrategy, setExpandedStrategy] = useState(null);
  const [settings, setSettings] = useState({
    timeframe: '1H',
    stop_loss_multiplier: 0.5,
    take_profit_multiplier: 2.5,
    risk_per_trade: 0.02,
  });

  const [drawings, setDrawings] = useState([]);
  const [drawingTool, setDrawingTool] = useState('crosshair');

  // Chart instance refs for parent-managed drawing
  const chartInstanceRef = useRef(null); // { chart, series, container }
  const drawingObjectsRef = useRef([]); // [{ id, chartObjects: [] }]
  const isDrawingRef = useRef(false);
  const startPointRef = useRef(null);
  const previewObjectsRef = useRef([]);

  const [chartFullscreen, setChartFullscreen] = useState(false);

  const [smResults, setSmResults] = useState({ chochEvents: [], bosEvents: [], trendStrength: 0, confidence: 0, trendDetails: [], divergences: [], liquidityZones: [] });

  const detectorRef = useRef(null);
  const smDetectorRef = useRef(null);
  const wsRef = useRef(null);

  // Derive which engine types are enabled from strategies + activeStrategies
  const enabledTypes = useMemo(() => {
    const types = new Set();
    strategies.forEach(s => {
      if (activeStrategies[s.id]) types.add(s.strategy_type || 'msb_ob');
    });
    return types;
  }, [strategies, activeStrategies]);

  // Derived: is any strategy enabled?
  const anyStrategyEnabled = useMemo(() => Object.values(activeStrategies).some(Boolean), [activeStrategies]);

  // Market status for current ticker
  const marketStatus = useMemo(() => getMarketStatus(selectedTicker), [selectedTicker]);

  // Should scanning be active? Need at least one strategy ON, and market open or crypto
  const canScan = anyStrategyEnabled && (marketStatus.open || marketStatus.premarket || marketStatus.afterhours);

  // Load user settings, strategies, and toggle states on mount
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const userSettings = await getUserSettings(user.id);
        if (userSettings) {
          setSettings({
            timeframe: userSettings.timeframe || '1H',
            stop_loss_multiplier: parseFloat(userSettings.stop_loss_multiplier) || 0.5,
            take_profit_multiplier: parseFloat(userSettings.take_profit_multiplier) || 2.5,
            risk_per_trade: parseFloat(userSettings.risk_per_trade) || 0.02,
          });
        }
        const userSignals = await getUserSignals(user.id);
        setSignals(userSignals.map(s => ({ ...s, ticker: s.ticker })));

        // Load persisted toggle states
        const saved = await loadActiveStrategies(user.id);
        if (saved && Object.keys(saved).length > 0) {
          setActiveStrategies(prev => ({ ...prev, ...saved }));
        }
      }

      const strats = await getVerifiedStrategies();
      setStrategies(strats);

      // Default OFF — only enable if Supabase had them saved as ON
      setActiveStrategies(prev => {
        const merged = { ...prev };
        strats.forEach(s => { if (!(s.id in merged)) merged[s.id] = false; });
        return merged;
      });

      setLoading(false);
    }
    init();
  }, []);

  // Fetch candles always, run detection only when canScan
  useEffect(() => {
    let cancelled = false;

    // Close previous WS
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }

    if (!canScan) {
      detectorRef.current = null;
      smDetectorRef.current = null;
      setIsScanning(false);
      setOrderBlocks([]);
      setMsbEvents([]);
      setSmResults({ chochEvents: [], bosEvents: [], trendStrength: 0, confidence: 0, trendDetails: [], divergences: [], liquidityZones: [] });
    }

    async function loadAndDetect() {
      setLoading(true);

      const candleData = await fetchCandles(selectedTicker, settings.timeframe);
      if (cancelled) return;
      setCandles(candleData);

      if (!canScan) {
        setLoading(false);
        return;
      }

      setIsScanning(true);

      let allTaggedSignals = [];

      if (candleData.length > 0) {
        // MSB/OB engine
        if (enabledTypes.has('msb_ob')) {
          const detector = createLiveDetector({
            stop_loss_multiplier: settings.stop_loss_multiplier,
            take_profit_multiplier: settings.take_profit_multiplier,
          });
          const results = detector.setCandles(candleData);
          detectorRef.current = detector;

          allTaggedSignals.push(...results.signals.map(s => ({
            ...s,
            ticker: selectedTicker,
            timeframe: settings.timeframe,
            strategy_source: 'MSB/OB',
          })));

          setOrderBlocks(results.orderBlocks);
          setMsbEvents(results.msbEvents);
          setPivots(results.pivots);
        } else {
          detectorRef.current = null;
          setOrderBlocks([]);
          setMsbEvents([]);
          setPivots({ highs: [], lows: [] });
        }

        // Smart Money engine
        if (enabledTypes.has('smart_money')) {
          const smDetector = createSmartMoneyDetector({
            stop_loss_multiplier: settings.stop_loss_multiplier,
            take_profit_multiplier: settings.take_profit_multiplier,
          });
          const smRes = smDetector.setCandles(candleData);
          smDetectorRef.current = smDetector;

          allTaggedSignals.push(...smRes.signals.map(s => ({
            ...s,
            ticker: selectedTicker,
            timeframe: settings.timeframe,
            strategy_source: 'Smart Money',
          })));

          setSmResults({
            chochEvents: smRes.chochEvents,
            bosEvents: smRes.bosEvents,
            trendStrength: smRes.trendStrength,
            confidence: smRes.confidence,
            trendDetails: smRes.trendDetails,
            divergences: smRes.divergences,
            liquidityZones: smRes.liquidityZones,
          });
        } else {
          smDetectorRef.current = null;
          setSmResults({ chochEvents: [], bosEvents: [], trendStrength: 0, confidence: 0, trendDetails: [], divergences: [], liquidityZones: [] });
        }

        setSignals(prev => {
          const existing = new Set(prev.map(s => `${s.ticker}-${s.detected_at}-${s.strategy_source || ''}`));
          const newSignals = allTaggedSignals.filter(s => !existing.has(`${s.ticker}-${s.detected_at}-${s.strategy_source || ''}`));
          return [...newSignals, ...prev].slice(0, 100);
        });
      }

      setIsScanning(false);
      setLoading(false);

      connectWebSocket(selectedTicker, settings.timeframe);
    }

    loadAndDetect();

    return () => {
      cancelled = true;
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    };
  }, [selectedTicker, settings.timeframe, settings.stop_loss_multiplier, settings.take_profit_multiplier, canScan, enabledTypes]);

  // WebSocket connection to Twelve Data
  function connectWebSocket(ticker, timeframe) {
    if (wsRef.current) wsRef.current.close();
    if (!canScan) return;

    const ws = new WebSocket('wss://ws.twelvedata.com/v1/quotes/price');
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        action: 'subscribe',
        params: { symbols: ticker },
      }));
      setIsScanning(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === 'price' && msg.symbol === ticker) {
          const price = parseFloat(msg.price);
          const timestamp = Math.floor(msg.timestamp);

          if (price > 0) {
            let allNewSignals = [];

            // Update MSB/OB detector
            if (detectorRef.current) {
              const currentCandles = detectorRef.current.getCandles();
              const lastCandle = currentCandles[currentCandles.length - 1];
              if (lastCandle) {
                const updatedCandle = {
                  time: lastCandle.time,
                  open: lastCandle.open,
                  high: Math.max(lastCandle.high, price),
                  low: Math.min(lastCandle.low, price),
                  close: price,
                  volume: lastCandle.volume,
                };
                const results = detectorRef.current.addCandle(updatedCandle);
                setCandles(detectorRef.current.getCandles());
                setOrderBlocks(results.orderBlocks);
                setMsbEvents(results.msbEvents);
                allNewSignals.push(...results.signals.map(s => ({
                  ...s, ticker: selectedTicker, timeframe: settings.timeframe, strategy_source: 'MSB/OB',
                })));
              }
            }

            // Update Smart Money detector
            if (smDetectorRef.current) {
              const smCandles = smDetectorRef.current.getCandles();
              const smLast = smCandles[smCandles.length - 1];
              if (smLast) {
                const updatedCandle = {
                  time: smLast.time,
                  open: smLast.open,
                  high: Math.max(smLast.high, price),
                  low: Math.min(smLast.low, price),
                  close: price,
                  volume: smLast.volume,
                };
                const smRes = smDetectorRef.current.addCandle(updatedCandle);
                if (!detectorRef.current) setCandles(smDetectorRef.current.getCandles());
                setSmResults({
                  chochEvents: smRes.chochEvents,
                  bosEvents: smRes.bosEvents,
                  trendStrength: smRes.trendStrength,
                  confidence: smRes.confidence,
                  trendDetails: smRes.trendDetails,
                  divergences: smRes.divergences,
                  liquidityZones: smRes.liquidityZones,
                });
                allNewSignals.push(...smRes.signals.map(s => ({
                  ...s, ticker: selectedTicker, timeframe: settings.timeframe, strategy_source: 'Smart Money',
                })));
              }
            }

            if (allNewSignals.length > 0) {
              setSignals(prev => {
                const existing = new Set(prev.map(s => `${s.ticker}-${s.detected_at}-${s.strategy_source || ''}`));
                const newSigs = allNewSignals.filter(s => !existing.has(`${s.ticker}-${s.detected_at}-${s.strategy_source || ''}`));
                return [...newSigs, ...prev].slice(0, 100);
              });
            }
          }
        }
      } catch (err) {
        // Ignore parse errors from non-price messages
      }
    };

    ws.onerror = () => setIsScanning(false);
    ws.onclose = () => setIsScanning(false);
  }

  // Update settings and save to Supabase
  const handleSettingsUpdate = useCallback(async (updates) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await upsertUserSettings(user.id, newSettings);
    }
  }, [settings]);

  // Toggle strategy — persist to Supabase
  const handleToggleStrategy = useCallback(async (strategyId) => {
    setActiveStrategies(prev => {
      const next = { ...prev, [strategyId]: !prev[strategyId] };
      // Fire-and-forget save
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) saveActiveStrategy(user.id, strategyId, next[strategyId]);
      });
      return next;
    });
  }, []);

  // Load drawings from localStorage when ticker changes
  useEffect(() => {
    setDrawings(loadDrawings(selectedTicker));
  }, [selectedTicker]);

  // Receive chart/series/container from RadarChart
  const handleChartReady = useCallback(({ chart, series, container }) => {
    chartInstanceRef.current = { chart, series, container };
  }, []);

  // Toggle chart scroll/scale when drawing tool changes
  useEffect(() => {
    const inst = chartInstanceRef.current;
    if (!inst?.chart) return;
    if (drawingTool === 'crosshair') {
      // Fully restore chart interaction
      inst.chart.applyOptions({
        handleScroll: true,
        handleScale: true,
      });
    } else {
      inst.chart.applyOptions({
        handleScroll: false,
        handleScale: false,
      });
    }
  }, [drawingTool]);

  // Render drawings on chart whenever drawings or candles change
  useEffect(() => {
    const inst = chartInstanceRef.current;
    if (!inst?.chart || !inst?.series) return;
    const chart = inst.chart;
    const series = inst.series;

    // Clean up previous drawing objects
    drawingObjectsRef.current.forEach(obj => {
      obj.chartObjects.forEach(co => {
        try {
          if (co._isPriceLine) series.removePriceLine(co);
          else chart.removeSeries(co);
        } catch {}
      });
    });
    drawingObjectsRef.current = [];

    drawings.forEach(d => {
      const chartObjects = [];
      if (d.type === 'hline') {
        const pl = series.createPriceLine({
          price: d.points[0].price, color: d.color || '#ffffff',
          lineWidth: 1, lineStyle: 2, axisLabelVisible: true,
        });
        pl._isPriceLine = true;
        chartObjects.push(pl);
      } else if (d.type === 'hray') {
        const startTime = d.points[0].time;
        const endTime = d.points[1]?.time || (candles.length > 0 ? candles[candles.length - 1].time : startTime);
        if (startTime && endTime) {
          const ray = addLineSeriesCompat(chart, {
            color: d.color || '#ffffff', lineWidth: 1, lineStyle: 2,
            lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
          });
          ray.setData([
            { time: Math.min(startTime, endTime), value: d.points[0].price },
            { time: Math.max(startTime, endTime), value: d.points[0].price },
          ]);
          chartObjects.push(ray);
        }
      } else if (d.type === 'trendline') {
        const [p1, p2] = d.points;
        const sorted = p1.time <= p2.time ? [p1, p2] : [p2, p1];
        const line = addLineSeriesCompat(chart, {
          color: d.color || '#ffffff', lineWidth: 2,
          lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
        });
        line.setData([
          { time: sorted[0].time, value: sorted[0].price },
          { time: sorted[1].time, value: sorted[1].price },
        ]);
        chartObjects.push(line);
      } else if (d.type === 'rectangle') {
        const [p1, p2] = d.points;
        const top = Math.max(p1.price, p2.price);
        const bottom = Math.min(p1.price, p2.price);
        const t1 = Math.min(p1.time, p2.time);
        const t2 = Math.max(p1.time, p2.time);
        const zone = addBaselineSeriesCompat(chart, {
          baseValue: { type: 'price', price: bottom },
          topFillColor1: 'rgba(255,255,255,0.15)', topFillColor2: 'rgba(255,255,255,0.15)',
          topLineColor: 'rgba(0,0,0,0)',
          bottomFillColor1: 'rgba(0,0,0,0)', bottomFillColor2: 'rgba(0,0,0,0)',
          bottomLineColor: 'rgba(0,0,0,0)',
          lineWidth: 0, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
        });
        zone.setData([{ time: t1, value: top }, { time: t2, value: top }]);
        chartObjects.push(zone);
        [top, bottom].forEach(price => {
          const bdr = addLineSeriesCompat(chart, {
            color: d.color || '#ffffff', lineWidth: 1, lineStyle: 0,
            lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
          });
          bdr.setData([{ time: t1, value: price }, { time: t2, value: price }]);
          chartObjects.push(bdr);
        });
      } else if (d.type === 'fib') {
        const [p1, p2] = d.points;
        const high = Math.max(p1.price, p2.price);
        const low = Math.min(p1.price, p2.price);
        const range = high - low;
        if (range > 0) {
          [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].forEach(level => {
            const pl = series.createPriceLine({
              price: high - range * level, color: d.color || '#ffffff',
              lineWidth: 1, lineStyle: level === 0 || level === 1 ? 0 : 2,
              axisLabelVisible: false, title: `${(level * 100).toFixed(1)}%`,
            });
            pl._isPriceLine = true;
            chartObjects.push(pl);
          });
        }
      }
      drawingObjectsRef.current.push({ id: d.id, chartObjects });
    });
  }, [drawings, candles]);

  // Mouse events for drawing on chart container
  useEffect(() => {
    const inst = chartInstanceRef.current;
    if (!inst?.container || !inst?.chart || !inst?.series) return;
    if (drawingTool === 'crosshair') return; // no events needed

    const container = inst.container;
    const chart = inst.chart;
    const series = inst.series;

    function getTimeFromX(x) {
      const ts = chart.timeScale();
      if (typeof ts.coordinateToTime === 'function') return ts.coordinateToTime(x);
      const logical = ts.coordinateToLogical(x);
      if (logical == null) return null;
      const idx = Math.round(logical);
      if (idx >= 0 && idx < candles.length) return candles[idx].time;
      return null;
    }

    function getXFromTime(time) {
      const ts = chart.timeScale();
      if (typeof ts.timeToCoordinate === 'function') return ts.timeToCoordinate(time);
      const idx = candles.findIndex(c => c.time === time);
      if (idx < 0) return null;
      return ts.logicalToCoordinate(idx);
    }

    function getCoords(e) {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const time = getTimeFromX(x);
      const price = series.coordinateToPrice(y);
      if (time == null || !Number.isFinite(price)) return null;
      return { time, price, x, y };
    }

    function clearPreview() {
      previewObjectsRef.current.forEach(obj => {
        try {
          if (obj._isPriceLine) series.removePriceLine(obj);
          else chart.removeSeries(obj);
        } catch {}
      });
      previewObjectsRef.current = [];
    }

    function renderPreview(start, end, tool) {
      clearPreview();
      if (!start || !end) return;
      if (tool === 'trendline') {
        const sorted = start.time <= end.time ? [start, end] : [end, start];
        const line = addLineSeriesCompat(chart, {
          color: 'rgba(255,255,255,0.5)', lineWidth: 2, lineStyle: 2,
          lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
        });
        line.setData([
          { time: sorted[0].time, value: sorted[0].price },
          { time: sorted[1].time, value: sorted[1].price },
        ]);
        previewObjectsRef.current.push(line);
      } else if (tool === 'hray') {
        const sorted = start.time <= end.time ? [start, end] : [end, start];
        const line = addLineSeriesCompat(chart, {
          color: 'rgba(255,255,255,0.5)', lineWidth: 1, lineStyle: 2,
          lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
        });
        line.setData([
          { time: sorted[0].time, value: start.price },
          { time: sorted[1].time, value: start.price },
        ]);
        previewObjectsRef.current.push(line);
      } else if (tool === 'rectangle') {
        const top = Math.max(start.price, end.price);
        const bottom = Math.min(start.price, end.price);
        const t1 = Math.min(start.time, end.time);
        const t2 = Math.max(start.time, end.time);
        const zone = addBaselineSeriesCompat(chart, {
          baseValue: { type: 'price', price: bottom },
          topFillColor1: 'rgba(255,255,255,0.08)', topFillColor2: 'rgba(255,255,255,0.08)',
          topLineColor: 'rgba(0,0,0,0)',
          bottomFillColor1: 'rgba(0,0,0,0)', bottomFillColor2: 'rgba(0,0,0,0)',
          bottomLineColor: 'rgba(0,0,0,0)',
          lineWidth: 0, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
        });
        zone.setData([{ time: t1, value: top }, { time: t2, value: top }]);
        previewObjectsRef.current.push(zone);
        [top, bottom].forEach(price => {
          const bdr = addLineSeriesCompat(chart, {
            color: 'rgba(255,255,255,0.4)', lineWidth: 1, lineStyle: 2,
            lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
          });
          bdr.setData([{ time: t1, value: price }, { time: t2, value: price }]);
          previewObjectsRef.current.push(bdr);
        });
      } else if (tool === 'fib') {
        const high = Math.max(start.price, end.price);
        const low = Math.min(start.price, end.price);
        const range = high - low;
        if (range > 0) {
          [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].forEach(level => {
            const pl = series.createPriceLine({
              price: high - range * level, color: 'rgba(255,255,255,0.4)',
              lineWidth: 1, lineStyle: 2, axisLabelVisible: false,
              title: `${(level * 100).toFixed(1)}%`,
            });
            pl._isPriceLine = true;
            previewObjectsRef.current.push(pl);
          });
        }
      }
    }

    function pointToSegmentDist(px, py, x1, y1, x2, y2) {
      const dx = x2 - x1, dy = y2 - y1;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
      let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const projX = x1 + t * dx, projY = y1 + t * dy;
      return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
    }

    function onMouseDown(e) {
      if (e.button !== 0) return;
      const coords = getCoords(e);
      if (!coords) return;

      e.preventDefault();
      e.stopPropagation();

      if (drawingTool === 'eraser') {
        let bestId = null, bestDist = Infinity;
        drawings.forEach(d => {
          if (d.type === 'hline' || d.type === 'hray') {
            const py = series.priceToCoordinate(d.points[0].price);
            if (py != null) {
              const dist = Math.abs(coords.y - py);
              if (dist < bestDist) { bestDist = dist; bestId = d.id; }
            }
          } else if (d.type === 'trendline') {
            const [p1, p2] = d.points;
            const x1 = getXFromTime(p1.time), y1 = series.priceToCoordinate(p1.price);
            const x2 = getXFromTime(p2.time), y2 = series.priceToCoordinate(p2.price);
            if (x1 != null && y1 != null && x2 != null && y2 != null) {
              const dist = pointToSegmentDist(coords.x, coords.y, x1, y1, x2, y2);
              if (dist < bestDist) { bestDist = dist; bestId = d.id; }
            }
          } else if (d.type === 'rectangle') {
            const [p1, p2] = d.points;
            const topY = series.priceToCoordinate(Math.max(p1.price, p2.price));
            const botY = series.priceToCoordinate(Math.min(p1.price, p2.price));
            const x1 = getXFromTime(Math.min(p1.time, p2.time));
            const x2 = getXFromTime(Math.max(p1.time, p2.time));
            if (topY != null && botY != null && x1 != null && x2 != null) {
              if (coords.x >= Math.min(x1, x2) && coords.x <= Math.max(x1, x2) &&
                  coords.y >= Math.min(topY, botY) && coords.y <= Math.max(topY, botY)) {
                bestDist = 0; bestId = d.id;
              }
            }
          } else if (d.type === 'fib') {
            const [p1, p2] = d.points;
            const high = Math.max(p1.price, p2.price), low = Math.min(p1.price, p2.price), range = high - low;
            [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].forEach(level => {
              const py = series.priceToCoordinate(high - range * level);
              if (py != null) {
                const dist = Math.abs(coords.y - py);
                if (dist < bestDist) { bestDist = dist; bestId = d.id; }
              }
            });
          }
        });
        if (bestId != null && bestDist <= 10) {
          setDrawings(prev => {
            const next = prev.filter(d => d.id !== bestId);
            persistDrawings(selectedTicker, next);
            return next;
          });
        }
        return;
      }

      if (drawingTool === 'hline') {
        setDrawings(prev => {
          const next = [...prev, { id: Date.now(), type: 'hline', color: '#ffffff', points: [{ price: coords.price, time: coords.time }] }];
          persistDrawings(selectedTicker, next);
          return next;
        });
        return;
      }

      // Drag tools: trendline, hray, rectangle, fib
      isDrawingRef.current = true;
      startPointRef.current = coords;
    }

    function onMouseMove(e) {
      if (!isDrawingRef.current || !startPointRef.current) return;
      const coords = getCoords(e);
      if (!coords) return;
      renderPreview(startPointRef.current, coords, drawingTool);
    }

    function onMouseUp(e) {
      if (!isDrawingRef.current || !startPointRef.current) {
        isDrawingRef.current = false;
        return;
      }
      isDrawingRef.current = false;
      const start = startPointRef.current;
      startPointRef.current = null;
      clearPreview();

      const coords = getCoords(e);
      if (!coords) return;
      if (Math.abs(coords.x - start.x) < 5 && Math.abs(coords.y - start.y) < 5) return;

      const newDrawing = {
        id: Date.now(),
        type: drawingTool,
        color: '#ffffff',
        points: drawingTool === 'hray'
          ? [{ price: start.price, time: start.time }, { price: start.price, time: coords.time }]
          : [{ time: start.time, price: start.price }, { time: coords.time, price: coords.price }],
      };
      setDrawings(prev => {
        const next = [...prev, newDrawing];
        persistDrawings(selectedTicker, next);
        return next;
      });
    }

    container.addEventListener('mousedown', onMouseDown, { capture: true });
    container.addEventListener('mousemove', onMouseMove, { capture: true });
    container.addEventListener('mouseup', onMouseUp, { capture: true });

    return () => {
      container.removeEventListener('mousedown', onMouseDown, { capture: true });
      container.removeEventListener('mousemove', onMouseMove, { capture: true });
      container.removeEventListener('mouseup', onMouseUp, { capture: true });
      clearPreview();
      isDrawingRef.current = false;
      startPointRef.current = null;
    };
  }, [drawingTool, drawings, candles, selectedTicker]);

  // Clear all drawings handler
  const handleClearAllDrawings = useCallback(() => {
    // Remove all chart objects
    const inst = chartInstanceRef.current;
    if (inst?.chart && inst?.series) {
      drawingObjectsRef.current.forEach(obj => {
        obj.chartObjects.forEach(co => {
          try {
            if (co._isPriceLine) inst.series.removePriceLine(co);
            else inst.chart.removeSeries(co);
          } catch {}
        });
      });
      drawingObjectsRef.current = [];
    }
    setDrawings([]);
    persistDrawings(selectedTicker, []);
  }, [selectedTicker]);

  // Filter signals for current ticker — only last 48 hours
  const currentTickerSignals = useMemo(() => {
    const cutoff48h = Date.now() - 48 * 60 * 60 * 1000;
    return signals.filter(s => {
      if (s.ticker !== selectedTicker) return false;
      const t = s.detected_at || s.time;
      if (!t) return false;
      let ms;
      if (typeof t === 'string') ms = new Date(t).getTime();
      else ms = Number(t) < 4102444800 ? Number(t) * 1000 : Number(t);
      return Number.isFinite(ms) && ms > cutoff48h;
    });
  }, [signals, selectedTicker]);

  const activeSignalCount = useMemo(() => {
    const cutoff48h = Date.now() - 48 * 60 * 60 * 1000;
    return signals.filter(s => {
      if (s.status !== 'active') return false;
      const t = s.detected_at || s.time;
      if (!t) return false;
      let ms;
      if (typeof t === 'string') ms = new Date(t).getTime();
      else ms = Number(t) < 4102444800 ? Number(t) * 1000 : Number(t);
      return Number.isFinite(ms) && ms > cutoff48h;
    }).length;
  }, [signals]);

  if (loading && candles.length === 0) {
    return (
      <div className="h-full bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading Strategy Radar...</div>
      </div>
    );
  }

  // Resize chart after fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    setChartFullscreen(prev => !prev);
    setTimeout(() => {
      const inst = chartInstanceRef.current;
      if (inst?.chart && inst?.container) {
        inst.chart.applyOptions({
          width: inst.container.clientWidth,
          height: inst.container.clientHeight,
        });
      }
    }, 100);
  }, []);

  return (
    <div className="h-full overflow-hidden bg-[#0a0a0f] text-white flex flex-col">
      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/6">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold tracking-wide">Strategy Radar</h1>
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${
              !anyStrategyEnabled ? 'bg-gray-600'
              : isScanning && marketStatus.open ? 'bg-emerald-400 animate-pulse'
              : marketStatus.dotColor
            }`} />
            <span className="text-xs text-gray-500">
              {!anyStrategyEnabled ? 'Disabled'
                : isScanning && marketStatus.open ? 'Scanning'
                : marketStatus.label}
            </span>
          </div>
        </div>

        {/* Search bar */}
        <RadarSearchBar
          selectedTicker={selectedTicker}
          onSelect={(t) => {
            setDrawingTool('crosshair');
            isDrawingRef.current = false;
            startPointRef.current = null;
            chartInstanceRef.current = null;
            setSelectedTicker(t);
            setActiveSignalIdx(0);
          }}
        />

        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-gray-500">
            {activeSignalCount} active signals
          </span>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT — Chart */}
        <motion.div
          className="flex flex-col border-r border-white/6 min-w-0"
          animate={{ flex: chartFullscreen ? 20 : 3 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
        >
          {/* Chart header */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/6">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-white font-mono">${selectedTicker}</span>
              <span className="text-xs text-gray-500">
                {enabledTypes.size === 0 ? ''
                  : enabledTypes.has('smart_money') && enabledTypes.has('msb_ob') ? 'MSB + OB + CHoCH/BOS'
                  : enabledTypes.has('smart_money') ? 'CHoCH + BOS'
                  : 'MSB + Order Block'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {TIMEFRAMES.map(tf => (
                <button
                  key={tf}
                  onClick={() => handleSettingsUpdate({ timeframe: tf })}
                  className={`px-1 py-0.5 text-[11px] font-mono transition-colors ${
                    settings.timeframe === tf
                      ? 'text-[#00C2FF]'
                      : 'text-gray-600 hover:text-gray-400'
                  }`}
                >
                  {tf}
                </button>
              ))}
              <div className="w-px h-4 bg-white/10 mx-1" />
              <button
                onClick={toggleFullscreen}
                title={chartFullscreen ? 'Exit fullscreen' : 'Fullscreen chart'}
                className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {chartFullscreen
                  ? <Minimize2 size={14} strokeWidth={1.5} />
                  : <Maximize2 size={14} strokeWidth={1.5} />}
              </button>
            </div>
          </div>

          {/* Chart */}
          <div className="flex-1 p-2 relative">
            <DrawingToolbar
              activeTool={drawingTool}
              onToolChange={setDrawingTool}
              onClearAll={handleClearAllDrawings}
            />
            <RadarChart
              key={selectedTicker}
              candles={candles}
              orderBlocks={orderBlocks}
              msbEvents={msbEvents}
              signals={currentTickerSignals}
              chochEvents={smResults.chochEvents}
              bosEvents={smResults.bosEvents}
              onChartReady={handleChartReady}
            />
          </div>

          {/* OB Legend */}
          <div className="flex items-center gap-6 px-4 py-2 border-t border-white/6 text-[10px]">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: BULL_COLOR }} />
              <span className="text-gray-500">Bullish OB</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: BEAR_COLOR }} />
              <span className="text-gray-500">Bearish OB</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: HPZ_BULL }} />
              <span className="text-gray-500">High Probability Zone</span>
            </span>
            {enabledTypes.has('smart_money') && (
              <>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: CHOCH_COLOR }} />
                  <span className="text-gray-500">CHoCH</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: BOS_COLOR }} />
                  <span className="text-gray-500">BOS</span>
                </span>
              </>
            )}
          </div>
        </motion.div>

        {/* RIGHT — Full panel or collapsed strip */}
        <motion.div
          className="min-h-0 overflow-hidden relative"
          animate={{ flex: chartFullscreen ? 0 : 2, width: chartFullscreen ? 48 : 'auto', minWidth: chartFullscreen ? 48 : 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
        >
          {chartFullscreen ? (
            /* ── Collapsed strip ─────────────────────────────────── */
            <div className="w-12 h-full flex flex-col items-center py-2 gap-2 border-l border-white/6">
              <button
                onClick={toggleFullscreen}
                title="Restore panel"
                className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors"
              >
                <Minimize2 size={14} strokeWidth={1.5} />
              </button>
              <div className="w-6 h-px bg-white/10" />
              {/* Strategy toggles */}
              {strategies.map(strategy => (
                <button
                  key={strategy.id}
                  onClick={() => handleToggleStrategy(strategy.id)}
                  title={strategy.name}
                  className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                    activeStrategies[strategy.id] ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-gray-600'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${activeStrategies[strategy.id] ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                </button>
              ))}
              <div className="w-6 h-px bg-white/10" />
              {/* Signal count */}
              <span className="text-[10px] font-mono text-gray-500">{activeSignalCount}</span>
            </div>
          ) : (
            /* ── Full right panel ────────────────────────────────── */
            <div className="h-full overflow-y-auto">
              {/* Active Signals */}
              <div className="p-2 border-b border-white/6">
                <h2 className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-1.5">
                  Active Signals
                </h2>
                {currentTickerSignals.length > 0 ? (
                  <>
                    <div className="flex gap-0.5 mb-2 overflow-x-auto pb-0.5">
                      {currentTickerSignals.slice(0, 10).map((sig, i) => {
                        const isActive = activeSignalIdx === i;
                        const tabDirColor = sig.direction === 'long' ? BULL_COLOR : BEAR_COLOR;
                        return (
                          <button
                            key={i}
                            onClick={() => setActiveSignalIdx(i)}
                            className={`flex items-center gap-1 px-1.5 py-1 rounded text-[10px] whitespace-nowrap transition-all border-l-2 flex-shrink-0 ${
                              isActive ? 'bg-white/[0.04]' : 'bg-transparent hover:bg-white/[0.02]'
                            }`}
                            style={{ borderColor: isActive ? tabDirColor : 'transparent' }}
                          >
                            <span style={{ color: tabDirColor }}>{sig.direction === 'long' ? '▲' : '▼'}</span>
                            <span className={`font-mono ${isActive ? 'text-white' : 'text-gray-500'}`}>{sig.ticker}</span>
                            <span className="font-mono text-gray-600">{sig.quality_score}%</span>
                          </button>
                        );
                      })}
                    </div>

                    <AnimatePresence mode="wait">
                      {currentTickerSignals[activeSignalIdx] && (
                        <motion.div
                          key={activeSignalIdx}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -20 }}
                          transition={{ duration: 0.15 }}
                        >
                          <SignalCard signal={currentTickerSignals[activeSignalIdx]} marketStatus={marketStatus} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                ) : (
                  anyStrategyEnabled ? (
                    <div className="flex items-center gap-2 py-2">
                      <div className="relative">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                        <div className="absolute inset-0 w-2 h-2 bg-emerald-500 rounded-full animate-ping opacity-50" />
                      </div>
                      <span className="text-xs text-gray-500">
                        {!marketStatus.open && !marketStatus.premarket && !marketStatus.afterhours
                          ? 'Market closed — signals update at next open'
                          : 'Scanning for setups...'}
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 py-2">Toggle a strategy to start scanning</p>
                  )
                )}
              </div>

              {/* Trend Strength Matrix */}
              {enabledTypes.has('smart_money') && smResults.trendDetails.length > 0 && (
                <div className="p-2 border-b border-white/6">
                  <TrendStrengthMatrix
                    trendStrength={smResults.trendStrength}
                    confidence={smResults.confidence}
                    trendDetails={smResults.trendDetails}
                  />
                </div>
              )}

              {/* Settings */}
              <div className="p-2 border-b border-white/6">
                <RadarSettings settings={settings} onUpdate={handleSettingsUpdate} />
              </div>

              {/* Verified Strategies */}
              <div className="p-2">
                <h2 className="text-[10px] text-gray-500 uppercase tracking-wider font-medium mb-1.5">
                  Verified Strategies
                </h2>
                <div className="space-y-1.5">
                  {strategies.map(strategy => (
                    <StrategyCard
                      key={strategy.id}
                      strategy={strategy}
                      enabled={activeStrategies[strategy.id] || false}
                      onToggle={handleToggleStrategy}
                      onViewDetails={setExpandedStrategy}
                    />
                  ))}
                </div>
              </div>

              {/* Strategy Detail Overlay */}
              <AnimatePresence>
                {expandedStrategy && (
                  <StrategyDetailOverlay
                    strategy={expandedStrategy}
                    onClose={() => setExpandedStrategy(null)}
                  />
                )}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// Wrap in Error Boundary
export default function StrategyRadarPage() {
  return (
    <RadarErrorBoundary>
      <StrategyRadarContent />
    </RadarErrorBoundary>
  );
}
