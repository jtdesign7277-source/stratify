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
import { MousePointer2, TrendingUp, Minus, MoveRight, Square, GitBranch, Eraser, Search } from 'lucide-react';

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

function RadarSweep({ disabled, statusText }) {
  const color = disabled ? '#666' : '#00C2FF';
  return (
    <div className="flex flex-col items-center py-4">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 128 128" className="w-full h-full">
          <circle cx="64" cy="64" r="58" fill="none" stroke={color} strokeWidth="0.5" opacity="0.2" />
          <circle cx="64" cy="64" r="38" fill="none" stroke={color} strokeWidth="0.5" opacity="0.15" />
          <circle cx="64" cy="64" r="18" fill="none" stroke={color} strokeWidth="0.5" opacity="0.1" />
          <line x1="64" y1="4" x2="64" y2="124" stroke={color} strokeWidth="0.5" opacity="0.1" />
          <line x1="4" y1="64" x2="124" y2="64" stroke={color} strokeWidth="0.5" opacity="0.1" />
        </svg>
        {!disabled && (
          <motion.div
            className="absolute inset-0"
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          >
            <div
              className="absolute top-1/2 left-1/2 h-[1px] origin-left"
              style={{
                width: '58px',
                background: `linear-gradient(to right, ${color}cc, transparent)`,
              }}
            />
          </motion.div>
        )}
        <div
          className="absolute top-1/2 left-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ backgroundColor: color, boxShadow: disabled ? 'none' : `0 0 8px ${color}` }}
        />
      </div>
      <p className="text-xs text-gray-600 mt-4">{statusText || 'Scanning for setups...'}</p>
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

const DRAW_COLORS = ['#ffffff', '#089981', '#f23645', '#2962FF', '#FF9800'];
const PALETTE_COLORS = ['#ffffff', '#34d399', '#f87171', '#06b6d4', '#3b82f6', '#a78bfa', '#f97316', '#facc15'];

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

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

function DrawingToolbar({ activeTool, onToolChange }) {
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
                    onMouseDown={() => selectTicker(r.symbol)}
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
                      onMouseDown={() => selectTicker(t)}
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

function RadarChart({ candles, orderBlocks, msbEvents, signals, chochEvents = [], bosEvents = [], drawings = [], activeTool = 'crosshair', activeColor = '#ffffff', onAddDrawing, onRemoveDrawing, onUpdateDrawing }) {
  const chartContainerRef = useRef(null);
  const drawOverlayRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const markersRef = useRef(null);
  const obOverlaySeriesRef = useRef([]);
  const drawingSeriesRef = useRef([]);
  const drawingPriceLinesRef = useRef([]);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef(null);
  const previewSeriesRef = useRef([]);
  const previewPriceLinesRef = useRef([]);

  const [colorPalette, setColorPalette] = useState(null); // { x, y, drawingId }

  // Refs to avoid stale closures in event handlers
  const activeToolRef = useRef(activeTool);
  const activeColorRef = useRef(activeColor);
  const onAddDrawingRef = useRef(onAddDrawing);
  const onRemoveDrawingRef = useRef(onRemoveDrawing);
  const onUpdateDrawingRef = useRef(onUpdateDrawing);
  const drawingsRef = useRef(drawings);
  const candlesRef = useRef(candles);

  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { activeColorRef.current = activeColor; }, [activeColor]);
  useEffect(() => { onAddDrawingRef.current = onAddDrawing; }, [onAddDrawing]);
  useEffect(() => { onRemoveDrawingRef.current = onRemoveDrawing; }, [onRemoveDrawing]);
  useEffect(() => { onUpdateDrawingRef.current = onUpdateDrawing; }, [onUpdateDrawing]);
  useEffect(() => { drawingsRef.current = drawings; }, [drawings]);
  useEffect(() => { candlesRef.current = candles; }, [candles]);

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
      previewPriceLinesRef.current.forEach(pl => {
        try { candleSeries.removePriceLine(pl); } catch {}
      });
      previewSeriesRef.current.forEach(s => {
        try { chart.removeSeries(s); } catch {}
      });
      drawingPriceLinesRef.current.forEach(pl => {
        try { candleSeries.removePriceLine(pl); } catch {}
      });
      drawingSeriesRef.current.forEach(s => {
        try { chart.removeSeries(s); } catch {}
      });
      obOverlaySeriesRef.current.forEach((series) => {
        try { chart.removeSeries(series); } catch {}
      });
      obOverlaySeriesRef.current = [];
      drawingSeriesRef.current = [];
      drawingPriceLinesRef.current = [];
      previewSeriesRef.current = [];
      previewPriceLinesRef.current = [];
      chart.remove();
    };
  }, []);

  // Toggle chart scroll/scale when drawing tool changes
  useEffect(() => {
    if (!chartRef.current) return;
    const isDrawing = activeTool !== 'crosshair';
    chartRef.current.applyOptions({
      handleScroll: isDrawing ? false : { vertTouchDrag: false },
      handleScale: !isDrawing,
    });
  }, [activeTool]);

  // Mouse-based drawing interaction via overlay div
  useEffect(() => {
    const overlay = drawOverlayRef.current;
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    if (!overlay || !chart || !series) return;

    function getTimeFromX(x) {
      const ts = chart.timeScale();
      if (typeof ts.coordinateToTime === 'function') {
        return ts.coordinateToTime(x);
      }
      const logical = ts.coordinateToLogical(x);
      if (logical == null) return null;
      const idx = Math.round(logical);
      const c = candlesRef.current;
      if (idx >= 0 && idx < c.length) return c[idx].time;
      return null;
    }

    function getXFromTime(time) {
      const ts = chart.timeScale();
      if (typeof ts.timeToCoordinate === 'function') {
        return ts.timeToCoordinate(time);
      }
      const c = candlesRef.current;
      const idx = c.findIndex(candle => candle.time === time);
      if (idx < 0) return null;
      return ts.logicalToCoordinate(idx);
    }

    // Convert mouse event to chart coordinates using overlay bounding rect
    function getCoords(e) {
      const rect = overlay.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const time = getTimeFromX(x);
      const price = series.coordinateToPrice(y);
      if (time == null || !Number.isFinite(price)) return null;
      return { time, price, x, y };
    }

    function clearPreview() {
      previewPriceLinesRef.current.forEach(pl => {
        try { series.removePriceLine(pl); } catch {}
      });
      previewSeriesRef.current.forEach(s => {
        try { chart.removeSeries(s); } catch {}
      });
      previewPriceLinesRef.current = [];
      previewSeriesRef.current = [];
    }

    function renderPreview(start, end, tool, color) {
      clearPreview();
      if (!start || !end) return;

      if (tool === 'trendline') {
        const sorted = start.time <= end.time ? [start, end] : [end, start];
        const line = addLineSeriesCompat(chart, {
          color: hexToRgba(color, 0.5),
          lineWidth: 2,
          lineStyle: 2,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        });
        line.setData([
          { time: sorted[0].time, value: sorted[0].price },
          { time: sorted[1].time, value: sorted[1].price },
        ]);
        previewSeriesRef.current.push(line);
      } else if (tool === 'rectangle') {
        const top = Math.max(start.price, end.price);
        const bottom = Math.min(start.price, end.price);
        const t1 = Math.min(start.time, end.time);
        const t2 = Math.max(start.time, end.time);
        const fill = hexToRgba(color, 0.08);

        const zone = addBaselineSeriesCompat(chart, {
          baseValue: { type: 'price', price: bottom },
          topFillColor1: fill, topFillColor2: fill,
          topLineColor: 'rgba(0,0,0,0)',
          bottomFillColor1: 'rgba(0,0,0,0)', bottomFillColor2: 'rgba(0,0,0,0)',
          bottomLineColor: 'rgba(0,0,0,0)',
          lineWidth: 0, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
        });
        zone.setData([{ time: t1, value: top }, { time: t2, value: top }]);
        previewSeriesRef.current.push(zone);

        [top, bottom].forEach(price => {
          const bdr = addLineSeriesCompat(chart, {
            color: hexToRgba(color, 0.4), lineWidth: 1, lineStyle: 2,
            lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
          });
          bdr.setData([{ time: t1, value: price }, { time: t2, value: price }]);
          previewSeriesRef.current.push(bdr);
        });
      } else if (tool === 'fib') {
        const high = Math.max(start.price, end.price);
        const low = Math.min(start.price, end.price);
        const range = high - low;
        if (range > 0) {
          [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].forEach(level => {
            const pl = series.createPriceLine({
              price: high - range * level,
              color: hexToRgba(color, 0.4),
              lineWidth: 1,
              lineStyle: 2,
              axisLabelVisible: false,
              title: `${(level * 100).toFixed(1)}%`,
            });
            previewPriceLinesRef.current.push(pl);
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
      const tool = activeToolRef.current;
      if (!tool || tool === 'crosshair') return;
      if (e.button !== 0) return;

      e.preventDefault();
      e.stopPropagation();

      const coords = getCoords(e);
      if (!coords) return;

      if (tool === 'eraser') {
        const ds = drawingsRef.current;
        let bestId = null, bestDist = Infinity;
        ds.forEach(d => {
          if (d.type === 'hline' || d.type === 'hray') {
            const py = series.priceToCoordinate(d.points[0].price);
            if (py != null) {
              const dist = Math.abs(coords.y - py);
              if (dist < bestDist) { bestDist = dist; bestId = d.id; }
            }
          } else if (d.type === 'rectangle') {
            const [p1, p2] = d.points;
            const topY = series.priceToCoordinate(Math.max(p1.price, p2.price));
            const botY = series.priceToCoordinate(Math.min(p1.price, p2.price));
            const x1 = getXFromTime(Math.min(p1.time, p2.time));
            const x2 = getXFromTime(Math.max(p1.time, p2.time));
            if (topY != null && botY != null && x1 != null && x2 != null) {
              const insideX = coords.x >= Math.min(x1, x2) && coords.x <= Math.max(x1, x2);
              const insideY = coords.y >= Math.min(topY, botY) && coords.y <= Math.max(topY, botY);
              if (insideX && insideY) { bestDist = 0; bestId = d.id; }
            }
          } else if (d.type === 'trendline') {
            const [p1, p2] = d.points;
            const x1 = getXFromTime(p1.time), y1 = series.priceToCoordinate(p1.price);
            const x2 = getXFromTime(p2.time), y2 = series.priceToCoordinate(p2.price);
            if (x1 != null && y1 != null && x2 != null && y2 != null) {
              const dist = pointToSegmentDist(coords.x, coords.y, x1, y1, x2, y2);
              if (dist < bestDist) { bestDist = dist; bestId = d.id; }
            }
          } else if (d.type === 'fib') {
            const [p1, p2] = d.points;
            const high = Math.max(p1.price, p2.price);
            const low = Math.min(p1.price, p2.price);
            const range = high - low;
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
          onRemoveDrawingRef.current?.(bestId);
        }
        return;
      }

      if (tool === 'hline' || tool === 'hray') {
        onAddDrawingRef.current?.({
          id: Date.now(),
          type: tool,
          color: activeColorRef.current,
          points: [{ price: coords.price, time: coords.time }],
        });
        return;
      }

      // Drag tools: trendline, rectangle, fib
      isDraggingRef.current = true;
      dragStartRef.current = coords;
    }

    function onMouseMove(e) {
      if (!isDraggingRef.current || !dragStartRef.current) return;
      const coords = getCoords(e);
      if (!coords) return;
      renderPreview(dragStartRef.current, coords, activeToolRef.current, activeColorRef.current);
    }

    function onMouseUp(e) {
      if (!isDraggingRef.current || !dragStartRef.current) {
        isDraggingRef.current = false;
        return;
      }
      isDraggingRef.current = false;
      const start = dragStartRef.current;
      dragStartRef.current = null;
      clearPreview();

      const coords = getCoords(e);
      if (!coords) return;

      // Require minimum drag distance (5 pixels)
      if (Math.abs(coords.x - start.x) < 5 && Math.abs(coords.y - start.y) < 5) return;

      onAddDrawingRef.current?.({
        id: Date.now(),
        type: activeToolRef.current,
        color: activeColorRef.current,
        points: [
          { time: start.time, price: start.price },
          { time: coords.time, price: coords.price },
        ],
      });
    }

    function onContextMenu(e) {
      e.preventDefault();
      e.stopPropagation();
      const coords = getCoords(e);
      if (!coords) return;
      const ds = drawingsRef.current;
      let bestId = null, bestDist = Infinity;
      ds.forEach(d => {
        if (d.type === 'hline' || d.type === 'hray') {
          const py = series.priceToCoordinate(d.points[0].price);
          if (py != null) { const dist = Math.abs(coords.y - py); if (dist < bestDist) { bestDist = dist; bestId = d.id; } }
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
            if (coords.x >= Math.min(x1, x2) && coords.x <= Math.max(x1, x2) && coords.y >= Math.min(topY, botY) && coords.y <= Math.max(topY, botY)) {
              bestDist = 0; bestId = d.id;
            }
          }
        } else if (d.type === 'fib') {
          const [p1, p2] = d.points;
          const high = Math.max(p1.price, p2.price), low = Math.min(p1.price, p2.price), range = high - low;
          [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].forEach(level => {
            const py = series.priceToCoordinate(high - range * level);
            if (py != null) { const dist = Math.abs(coords.y - py); if (dist < bestDist) { bestDist = dist; bestId = d.id; } }
          });
        }
      });
      if (bestId != null && bestDist <= 15) {
        const rect = overlay.getBoundingClientRect();
        setColorPalette({ x: e.clientX - rect.left, y: e.clientY - rect.top, drawingId: bestId });
      }
    }

    overlay.addEventListener('mousedown', onMouseDown);
    overlay.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      overlay.removeEventListener('mousedown', onMouseDown);
      overlay.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      clearPreview();
      isDraggingRef.current = false;
      dragStartRef.current = null;
    };
  }, [activeTool]);

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

  // Render user drawings
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current) return;

    // Clean up previous drawing overlays
    drawingPriceLinesRef.current.forEach(pl => {
      try { candleSeriesRef.current.removePriceLine(pl); } catch {}
    });
    drawingSeriesRef.current.forEach(s => {
      try { chartRef.current.removeSeries(s); } catch {}
    });
    drawingPriceLinesRef.current = [];
    drawingSeriesRef.current = [];

    drawings.forEach(d => {
      if (d.type === 'hline') {
        const pl = candleSeriesRef.current.createPriceLine({
          price: d.points[0].price,
          color: d.color,
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
        });
        drawingPriceLinesRef.current.push(pl);
      } else if (d.type === 'hray') {
        // Horizontal ray — from click time to chart end
        const startTime = d.points[0].time;
        const chartEnd = candles.length > 0 ? candles[candles.length - 1].time : startTime;
        if (startTime && chartEnd) {
          const ray = addLineSeriesCompat(chartRef.current, {
            color: d.color, lineWidth: 1, lineStyle: 2,
            lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
          });
          ray.setData([
            { time: Math.min(startTime, chartEnd), value: d.points[0].price },
            { time: Math.max(startTime, chartEnd), value: d.points[0].price },
          ]);
          drawingSeriesRef.current.push(ray);
        }
      } else if (d.type === 'trendline') {
        const [p1, p2] = d.points;
        const sorted = p1.time <= p2.time ? [p1, p2] : [p2, p1];
        const line = addLineSeriesCompat(chartRef.current, {
          color: d.color,
          lineWidth: 2,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        });
        line.setData([
          { time: sorted[0].time, value: sorted[0].price },
          { time: sorted[1].time, value: sorted[1].price },
        ]);
        drawingSeriesRef.current.push(line);
      } else if (d.type === 'rectangle') {
        const [p1, p2] = d.points;
        const top = Math.max(p1.price, p2.price);
        const bottom = Math.min(p1.price, p2.price);
        const t1 = Math.min(p1.time, p2.time);
        const t2 = Math.max(p1.time, p2.time);
        const fill = hexToRgba(d.color, 0.15);

        const zone = addBaselineSeriesCompat(chartRef.current, {
          baseValue: { type: 'price', price: bottom },
          topFillColor1: fill, topFillColor2: fill,
          topLineColor: 'rgba(0,0,0,0)',
          bottomFillColor1: 'rgba(0,0,0,0)', bottomFillColor2: 'rgba(0,0,0,0)',
          bottomLineColor: 'rgba(0,0,0,0)',
          lineWidth: 0, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
        });
        zone.setData([{ time: t1, value: top }, { time: t2, value: top }]);
        drawingSeriesRef.current.push(zone);

        const topBdr = addLineSeriesCompat(chartRef.current, {
          color: d.color, lineWidth: 1, lineStyle: 0,
          lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
        });
        topBdr.setData([{ time: t1, value: top }, { time: t2, value: top }]);
        drawingSeriesRef.current.push(topBdr);

        const botBdr = addLineSeriesCompat(chartRef.current, {
          color: d.color, lineWidth: 1, lineStyle: 0,
          lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
        });
        botBdr.setData([{ time: t1, value: bottom }, { time: t2, value: bottom }]);
        drawingSeriesRef.current.push(botBdr);
      } else if (d.type === 'fib') {
        const [p1, p2] = d.points;
        const high = Math.max(p1.price, p2.price);
        const low = Math.min(p1.price, p2.price);
        const range = high - low;
        [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1].forEach(level => {
          const pl = candleSeriesRef.current.createPriceLine({
            price: high - range * level,
            color: d.color,
            lineWidth: 1,
            lineStyle: level === 0 || level === 1 ? 0 : 2,
            axisLabelVisible: false,
            title: `${(level * 100).toFixed(1)}%`,
          });
          drawingPriceLinesRef.current.push(pl);
        });
      }
    });
  }, [drawings]);

  return (
    <div className="w-full h-full relative" style={{ position: 'relative' }}>
      <div ref={chartContainerRef} className="w-full h-full" />
      {/* Transparent overlay for drawing — captures mouse when tool is active */}
      <div
        ref={drawOverlayRef}
        className="absolute inset-0"
        style={{
          cursor: activeTool !== 'crosshair' ? 'crosshair' : 'default',
          pointerEvents: activeTool !== 'crosshair' ? 'auto' : 'none',
          zIndex: 5,
        }}
        onClick={() => setColorPalette(null)}
      />
      {/* Right-click color palette */}
      {colorPalette && (
        <div
          className="absolute z-20 flex items-center gap-1 bg-[#1e222d] border border-white/[0.1] rounded-lg p-1.5 shadow-xl"
          style={{ left: colorPalette.x, top: colorPalette.y }}
        >
          {PALETTE_COLORS.map(c => (
            <button
              key={c}
              onClick={() => {
                onUpdateDrawingRef.current?.(colorPalette.drawingId, { color: c });
                setColorPalette(null);
              }}
              className="w-5 h-5 rounded-full transition-transform hover:scale-125"
              style={{ backgroundColor: c }}
            />
          ))}
          <div className="w-px h-4 bg-white/10 mx-0.5" />
          <button
            onClick={() => {
              onRemoveDrawingRef.current?.(colorPalette.drawingId);
              setColorPalette(null);
            }}
            className="w-5 h-5 flex items-center justify-center text-red-400 hover:text-red-300 transition-colors"
            title="Delete"
          >
            <Eraser size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SIGNAL CARD — Redesigned with quality gauge, price ladder, always-visible details
// ══════════════════════════════════════════════════════════════════════════════

function SignalCard({ signal, marketStatus }) {
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
  return (
    <div className="border border-white/6 rounded-lg p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <h3 className="text-xs font-semibold text-white truncate">{strategy.name}</h3>
            <span className="text-[10px] text-gray-600 truncate hidden sm:inline">{strategy.subtitle}</span>
          </div>
        </div>
        <button
          onClick={() => onToggle(strategy.id)}
          className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${enabled ? 'bg-emerald-500/30' : 'bg-white/10'}`}
        >
          <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${enabled ? 'left-4 bg-emerald-400' : 'left-0.5 bg-gray-500'}`} />
        </button>
      </div>
      {strategy.backtest_win_rate && (
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
  const [activeTool, setActiveTool] = useState('crosshair');
  const [activeColor, setActiveColor] = useState('#ffffff');

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

  const handleAddDrawing = useCallback((drawing) => {
    setDrawings(prev => {
      const next = [...prev, drawing];
      persistDrawings(selectedTicker, next);
      return next;
    });
  }, [selectedTicker]);

  const handleRemoveDrawing = useCallback((drawingId) => {
    setDrawings(prev => {
      const next = prev.filter(d => d.id !== drawingId);
      persistDrawings(selectedTicker, next);
      return next;
    });
  }, [selectedTicker]);

  const handleUpdateDrawing = useCallback((drawingId, updates) => {
    setDrawings(prev => {
      const next = prev.map(d => d.id === drawingId ? { ...d, ...updates } : d);
      persistDrawings(selectedTicker, next);
      return next;
    });
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
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading Strategy Radar...</div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-[#0a0a0f] text-white flex flex-col">
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
          onSelect={(t) => { setSelectedTicker(t); setActiveSignalIdx(0); }}
        />

        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-gray-500">
            {activeSignalCount} active signals
          </span>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT — Chart (60%) */}
        <div className="flex-[3] flex flex-col border-r border-white/6">
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
            </div>
          </div>

          {/* Chart */}
          <div className="flex-1 p-2 relative">
            <DrawingToolbar
              activeTool={activeTool}
              onToolChange={setActiveTool}
            />
            <RadarChart
              candles={candles}
              orderBlocks={orderBlocks}
              msbEvents={msbEvents}
              signals={currentTickerSignals}
              chochEvents={smResults.chochEvents}
              bosEvents={smResults.bosEvents}
              drawings={drawings}
              activeTool={activeTool}
              activeColor={activeColor}
              onAddDrawing={handleAddDrawing}
              onRemoveDrawing={handleRemoveDrawing}
              onUpdateDrawing={handleUpdateDrawing}
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
        </div>

        {/* RIGHT — Signals + Strategies (40%) */}
        <div className="flex-[2] min-h-0 overflow-y-auto relative">
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
              <RadarSweep
                disabled={!canScan}
                statusText={
                  !anyStrategyEnabled ? 'Toggle a strategy to start scanning'
                  : !marketStatus.open && !marketStatus.premarket && !marketStatus.afterhours
                    ? 'Market closed — signals update at next open'
                  : 'Scanning for setups...'
                }
              />
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
