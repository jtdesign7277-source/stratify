import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
import { BarChart2, Clock, Search, ChevronsLeft, ChevronsRight, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { CANDLE_PALETTES, CHART_DISPLAY_OPTIONS } from './ChartDisplayIcons';
import { createLineToolsPlugin } from 'lightweight-charts-line-tools-core';
import { LineToolTrendLine, LineToolHorizontalLine, LineToolVerticalLine, LineToolRay } from 'lightweight-charts-line-tools-lines';
import { LineToolRectangle } from 'lightweight-charts-line-tools-rectangle';
import { LineToolFibRetracement } from 'lightweight-charts-line-tools-fib-retracement';
import { LineToolParallelChannel } from 'lightweight-charts-line-tools-parallel-channel';
import DrawingToolbar from '../chart/DrawingToolbar';
import { VolumeProfilePlugin } from '../../plugins/VolumeProfilePlugin';
import { SessionHighlightPlugin } from '../../plugins/SessionHighlightPlugin';
import gsap from 'gsap';
import CountUp from 'react-countup';
import useTwelveDataWS from '../xray/hooks/useTwelveDataWS';
import { normalizeSymbol as normalizeTicker } from '../../lib/twelvedata';

// ── Supabase Client ──────────────────────────────────────────────────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ── Constants ────────────────────────────────────────────────────────────────
const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1H', '2H', '4H', '1D'];
const TIMEFRAME_MAP = {
  '1m': '1min', '5m': '5min', '15m': '15min', '30m': '30min',
  '1H': '1h', '2H': '2h', '4H': '4h', '1D': '1day',
};
const BULL_COLOR = '#089981';
const BEAR_COLOR = '#f23645';
const HPZ_BULL = '#1de9b6';

const CANDLE_PALETTE_STORAGE_KEY = 'stratify-strategy-radar-candle-palette';
const CHART_DISPLAY_STORAGE_KEY = 'stratify-strategy-radar-chart-display';
const HPZ_BEAR = '#ff5252';
const CHOCH_COLOR = '#00C2FF';
const BOS_COLOR = '#7B61FF';
const SOFT_GLASS_CARD_CLASS = 'dashboard-card bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl rounded-2xl border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-300 hover:from-white/[0.06] hover:to-white/[0.02] hover:shadow-[0_12px_40px_rgba(0,0,0,0.5)] hover:border-white/[0.1]';
const SIGNAL_PANEL_BLEND_CLASS = 'overflow-hidden flex flex-col min-h-0 rounded-r-xl bg-[linear-gradient(135deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0)_100%),#0b0b0b]';
const SIGNAL_CARD_BLEND_CLASS = 'border border-white/[0.03] rounded py-3 px-3 transition-colors';
const SIGNAL_CARD_BLEND_ACTIVE_CLASS = 'border-emerald-500/20 bg-emerald-500/5';
const SOFT_GLASS_ACCENT_CLASS = 'dashboard-card bg-gradient-to-br from-emerald-500/[0.08] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-emerald-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_20px_rgba(16,185,129,0.1)]';
const SOFT_GLASS_INSET_CLASS = 'bg-black/40 rounded-xl shadow-[inset_4px_4px_8px_rgba(0,0,0,0.5),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] border border-white/[0.04]';
const BUTTON_SPRING = { type: 'spring', stiffness: 500, damping: 30 };
const GLASS_TOPBAR_STYLE = {
  background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%), #0a0a0a',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 30px rgba(0,0,0,0.35)',
  backdropFilter: 'blur(16px)',
};

const CRYPTO_TICKERS = new Set(['BTC/USD', 'ETH/USD', 'SOL/USD', 'XRP/USD', 'DOGE/USD', 'LINK/USD', 'ADA/USD', 'AVAX/USD', 'DOT/USD']);

const SIGNAL_DESCRIPTIONS = {
  msb_ob: {
    summary: 'Detects institutional order blocks combined with market structure breaks (MSB) for high-probability pullback entries. Identifies premium and discount zones using Fibonacci retracements with multi-timeframe confirmation.',
    triggers: 'BUY signals trigger when price breaks above a pivot high (bullish MSB) and revisits the order block zone. SELL signals trigger on bearish breaks below pivot lows.',
    stats: { win: '68', ret: '+28.7', pf: '1.9' },
  },
  smart_money: {
    summary: 'Professional-grade market structure and order-flow system that identifies institutional trading behavior through volatility-adaptive logic, multi-timeframe trend alignment, and volume-based confirmation. Uses original mathematical models to detect Change of Character (CHoCH), Break of Structure (BOS), cumulative volume dynamics, and trend convergence across seven timeframes to deliver high-probability signals with significantly reduced noise. Unlike basic indicator combinations, this is a unified framework: volatility adaptation, structure analysis, and volume confirmation continuously reinforce each other for precise, context-aware signals. Each component is mathematically linked so that volatility adjusts sensitivity in real time, multi-timeframe trends define directional bias, market structure determines timing, and volume confirms institutional participation while advanced filters eliminate low-quality setups.',
    triggers: 'Volatility adjusts signal sensitivity in real time; multi-timeframe trends define directional bias; market structure determines timing; volume confirms institutional participation. BUY on bullish CHoCH (price reverses up through a pivot level) or bullish BOS (continuation break above previous structure) with alignment. SELL on bearish equivalents. Advanced filters remove low-quality setups.',
    stats: { win: '72', ret: '+22.4', pf: '1.7' },
  },
};

// Built-in verified signals (always shown; toggle enables scanning)
const VERIFIED_SIGNALS = [
  {
    id: 'msb_ob',
    name: 'MSB / Order Block',
    strategy_type: 'msb_ob',
    subtitle: 'Order blocks + market structure breaks',
    description: SIGNAL_DESCRIPTIONS.msb_ob.summary,
    entry_logic: SIGNAL_DESCRIPTIONS.msb_ob.triggers,
    exit_logic: 'Exit on invalidation of order block or target hit.',
    risk_management: 'Stop loss below/above order block; position size from risk per trade.',
  },
  {
    id: 'smart_money',
    name: 'Smart Money',
    strategy_type: 'smart_money',
    subtitle: 'CHoCH & BOS · volatility-adaptive structure',
    description: SIGNAL_DESCRIPTIONS.smart_money.summary,
    entry_logic: SIGNAL_DESCRIPTIONS.smart_money.triggers,
    exit_logic: 'Exit on structure invalidation or when target is hit. Structure break against the trade invalidates the setup.',
    risk_management: 'Stop at recent structure level; volatility-adaptive position sizing; R-multiple targets with multi-timeframe confirmation.',
  },
];

function isCryptoTicker(ticker) {
  return CRYPTO_TICKERS.has(ticker) || /\/(USD|USDT|BTC)$/.test(ticker);
}

function getMarketStatus(ticker) {
  if (isCryptoTicker(ticker)) return { open: true, premarket: false, afterhours: false, label: 'Scanning', dotColor: 'bg-emerald-400' };
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = et.getDay();
  const mins = et.getHours() * 60 + et.getMinutes();
  const isWeekday = day >= 1 && day <= 5;
  if (!isWeekday) return { open: false, premarket: false, afterhours: false, label: 'Market Closed', dotColor: 'bg-orange-400' };
  if (mins >= 570 && mins < 960) return { open: true, premarket: false, afterhours: false, label: 'Scanning', dotColor: 'bg-emerald-400' };
  if (mins >= 240 && mins < 570) return { open: false, premarket: true, afterhours: false, label: 'Pre-Market', dotColor: 'bg-orange-400' };
  if (mins >= 960 && mins < 1200) return { open: false, premarket: false, afterhours: true, label: 'After-Hours', dotColor: 'bg-orange-400' };
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
  if (typeof chart?.addCandlestickSeries === 'function') return chart.addCandlestickSeries(options);
  if (typeof chart?.addSeries === 'function') return chart.addSeries(CandlestickSeries, options);
  throw new Error('Candlestick series API is unavailable.');
};

const addLineSeriesCompat = (chart, options) => {
  if (typeof chart?.addLineSeries === 'function') return chart.addLineSeries(options);
  if (typeof chart?.addSeries === 'function') return chart.addSeries(LineSeries, options);
  throw new Error('Line series API is unavailable.');
};

const addBaselineSeriesCompat = (chart, options) => {
  if (typeof chart?.addBaselineSeries === 'function') return chart.addBaselineSeries(options);
  if (typeof chart?.addSeries === 'function') return chart.addSeries(BaselineSeries, options);
  throw new Error('Baseline series API is unavailable.');
};

// ── Utilities ────────────────────────────────────────────────────────────────

function timeAgo(timestamp) {
  if (!timestamp) return '';
  let ms;
  if (typeof timestamp === 'string') {
    ms = new Date(timestamp).getTime();
  } else {
    const n = Number(timestamp);
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
          fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold font-mono" style={{ color }}>{score}</span>
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

// ── Search Bar ───────────────────────────────────────────────────────────────
const RAINBOW_STYLE_ID = 'radar-rainbow-css';
if (typeof document !== 'undefined' && !document.getElementById(RAINBOW_STYLE_ID)) {
  const style = document.createElement('style');
  style.id = RAINBOW_STYLE_ID;
  style.textContent = `
@keyframes rainbow-rotate { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
.radar-rainbow-border { background: linear-gradient(270deg, #34d399, #06b6d4, #3b82f6, #7c3aed, #ec4899, #ef4444, #f97316, #34d399); background-size: 400% 400%; animation: rainbow-rotate 6s ease infinite; }
`;
  document.head.appendChild(style);
}

const RECENT_KEY = 'radar_recent_searches';
function loadRecentSearches() { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').slice(0, 5); } catch { return []; } }
function saveRecentSearch(ticker) { try { const prev = loadRecentSearches().filter(t => t !== ticker); localStorage.setItem(RECENT_KEY, JSON.stringify([ticker, ...prev].slice(0, 5))); } catch {} }

function RadarSearchBar({ selectedTicker, onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const [searched, setSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState(loadRecentSearches);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Debounced search — 300ms after typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < 2) {
      setResults([]);
      setSearched(false);
      setIsLoading(false);
      setIsOpen(isFocused && recentSearches.length > 0);
      return;
    }
    setIsLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/radar/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setResults([]);
      }
      setSearched(true);
      setIsLoading(false);
      setIsOpen(true);
      setHighlightIdx(-1);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  function selectTicker(ticker) {
    console.log('TICKER SELECTED:', ticker);
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setIsFocused(false);
    setSearched(false);
    saveRecentSearch(ticker);
    setRecentSearches(loadRecentSearches());
    if (inputRef.current) inputRef.current.blur();
    onSelect(ticker);
  }

  function handleKeyDown(e) {
    const totalItems = results.length + (query.length < 2 ? recentSearches.length : 0);
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx(prev => (prev + 1) % (totalItems || 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx(prev => (prev - 1 + (totalItems || 1)) % (totalItems || 1)); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIdx >= 0 && highlightIdx < results.length) selectTicker(results[highlightIdx].symbol);
      else if (query.length < 2 && highlightIdx >= results.length && highlightIdx < totalItems) selectTicker(recentSearches[highlightIdx - results.length]);
      else if (results.length > 0) selectTicker(results[0].symbol);
      else if (query.trim().length > 0) selectTicker(query.trim().toUpperCase());
    } else if (e.key === 'Escape') { setIsOpen(false); inputRef.current?.blur(); }
  }

  const showRecents = query.length < 2 && recentSearches.length > 0;
  const showNoResults = searched && query.length >= 2 && results.length === 0 && !isLoading;
  const showDropdown = isOpen && (results.length > 0 || showRecents || showNoResults);

  return (
    <div ref={containerRef} className="w-full max-w-[22rem] mx-4 relative flex-shrink min-w-0">
      <motion.div
        className="relative rounded-xl border bg-white/[0.03] px-4 py-2.5"
        animate={{
          borderColor: isFocused ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.06)',
          boxShadow: isFocused ? '0 0 20px rgba(16,185,129,0.1)' : '0 0 0 rgba(16,185,129,0)',
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        <div className="flex items-center gap-3 rounded-xl">
          <Search size={16} className={`${isFocused ? 'text-emerald-400' : 'text-gray-500'} flex-shrink-0 transition-colors duration-200`} />
          <input ref={inputRef} type="text" value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => { setIsFocused(true); setIsOpen(true); }}
            onBlur={() => setTimeout(() => setIsFocused(false), 150)}
            onKeyDown={handleKeyDown}
            placeholder="Search any stock, ETF, crypto..."
            className="min-w-0 flex-1 bg-transparent text-sm font-mono text-white placeholder:text-gray-600 placeholder:italic outline-none" />
          {isLoading && (
            <div className="h-4 w-4 flex-shrink-0 rounded-full border-2 border-white/20 border-t-emerald-400 animate-spin" />
          )}
          {!isLoading && query && (
            <motion.button
              type="button"
              onClick={() => { setQuery(''); setResults([]); setSearched(false); }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              transition={BUTTON_SPRING}
              className="text-gray-600 hover:text-gray-400 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </motion.button>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.15 } }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="absolute left-0 right-0 top-full mt-2 z-50 overflow-hidden rounded-2xl bg-[#0a0a0f] border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl max-h-80 overflow-y-auto"
          >
            {results.length > 0 && (
              <div>
                {results.map((r, i) => (
                  <button key={r.symbol}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); selectTicker(r.symbol); }}
                    onMouseEnter={() => setHighlightIdx(i)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer transition-all duration-150 ${highlightIdx === i ? 'bg-white/[0.04]' : 'hover:bg-white/[0.04]'}`}
                  >
                    <span className="text-sm text-white font-semibold font-mono w-20 flex-shrink-0">{r.symbol}</span>
                    <span className="text-sm text-gray-400 flex-1 truncate">{r.name}</span>
                    <span className="text-sm text-gray-500 flex-shrink-0">{r.exchange}</span>
                  </button>
                ))}
              </div>
            )}
            {showNoResults && (
              <div className="px-4 py-3 text-sm text-gray-500">No results found</div>
            )}
            {showRecents && (
              <div className={results.length > 0 ? 'border-t border-white/[0.06]' : ''}>
                <div className="px-4 pt-2 pb-1"><span className="text-sm text-gray-600 uppercase tracking-widest">Recent</span></div>
                <div className="flex flex-wrap gap-1 px-4 pb-2.5">
                  {recentSearches.map((t, i) => (
                    <button key={t}
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); selectTicker(t); }}
                      onMouseEnter={() => setHighlightIdx(results.length + i)}
                      className={`px-2.5 py-1 text-sm font-mono transition-all duration-150 rounded-md cursor-pointer ${highlightIdx === results.length + i ? 'text-white bg-white/[0.06]' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'}`}
                    >{t}</button>
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
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full bg-[#0a0a0f] flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-400 text-sm mb-2">Strategy Radar encountered an error</p>
            <p className="text-gray-500 text-sm">{String(this.state.error?.message || 'Unknown error')}</p>
            <motion.button
              type="button"
              onClick={() => window.location.reload()}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              transition={BUTTON_SPRING}
              className="mt-4 px-4 py-2 text-sm text-white border border-white/15 rounded-lg"
            >
              Reload
            </motion.button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Supabase Helpers ─────────────────────────────────────────────────────────
async function getUserSettings(userId) {
  const { data } = await supabase.from('radar_settings').select('*').eq('user_id', userId).single();
  return data;
}

async function upsertUserSettings(userId, settings) {
  const { data } = await supabase.from('radar_settings').upsert({ user_id: userId, ...settings }, { onConflict: 'user_id' }).select().single();
  return data;
}

async function getVerifiedStrategies() {
  const { data } = await supabase.from('radar_strategies').select('*').eq('is_active', true);
  return data || [];
}

async function saveSignal(userId, signal) {
  const { data } = await supabase.from('radar_signals').insert({ user_id: userId, ...signal }).select().single();
  return data;
}

async function getUserSignals(userId, limit = 50) {
  const { data } = await supabase.from('radar_signals').select('*').eq('user_id', userId).order('detected_at', { ascending: false }).limit(limit);
  return data || [];
}

// ── Fetch Candles (same pipeline as Trader chart for 5m and all timeframes) ───
async function fetchCandles(ticker, timeframe) {
  try {
    const interval = TIMEFRAME_MAP[timeframe] || '5min';
    const outputsize = interval === '1day' ? 365 : 500;
    const res = await fetch(`/api/chart/candles?symbol=${encodeURIComponent(ticker)}&interval=${interval}&outputsize=${outputsize}`);
    const data = await res.json();
    const values = Array.isArray(data?.values) ? data.values : [];
    if (values.length === 0) return [];
    return values
      .map(v => ({
        time: Math.floor(new Date(v.datetime).getTime() / 1000),
        open: parseFloat(v.open), high: parseFloat(v.high),
        low: parseFloat(v.low), close: parseFloat(v.close),
        volume: parseInt(v.volume || 0, 10) || 0,
      }))
      .filter(b => Number.isFinite(b.time) && Number.isFinite(b.close))
      .sort((a, b) => a.time - b.time);
  } catch (err) {
    console.error('Failed to fetch candles:', err);
    return [];
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// RADAR CHART
// ══════════════════════════════════════════════════════════════════════════════

function RadarChart({ candles, orderBlocks, msbEvents, signals, chochEvents, bosEvents, selectedTicker, selectedTimeframe, candleColors, chartDisplayMode = 'solid', volumeProfileRef, sessionHighlightRef }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const lineSeriesRef = useRef(null);
  const markersRef = useRef(null);
  const obOverlaySeriesRef = useRef([]);
  const drawingPriceLinesRef = useRef([]);
  const drawingTrendLinesRef = useRef([]);
  const drawingRectanglesRef = useRef([]);
  const drawingOrderRef = useRef([]);
  const drawingPendingPointRef = useRef(null);
  const draggingPriceLineRef = useRef(null);
  const drawingDragCleanupRef = useRef(null);
  const drawingPreviewSeriesRef = useRef(null);
  const drawingLastCrosshairRef = useRef(null);
  const drawingDragStartedRef = useRef(false);
  const drawingJustFinishedViaMouseupRef = useRef(false);
  const selectedTickerRef = useRef(selectedTicker);
  const lastCandlesFitKeyRef = useRef('');
  const lineToolsRef = useRef(null);
  const [activeTool, setActiveTool] = useState('cursor');

  useEffect(() => {
    selectedTickerRef.current = selectedTicker;
  }, [selectedTicker]);

  useEffect(() => {
    if (!chartContainerRef.current) return;
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      layout: {
        background: { type: 'solid', color: '#0b0b0b' },
        textColor: 'rgba(255,255,255,0.7)',
        fontSize: 12,
      },
      grid: { vertLines: { visible: false }, horzLines: { visible: false } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(255,255,255,0.1)', width: 1, style: 3 },
        horzLine: { color: 'rgba(255,255,255,0.1)', width: 1, style: 3 },
      },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.06)', scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: 'rgba(255,255,255,0.06)', timeVisible: true, secondsVisible: false },
      handleScroll: true,
      handleScale: true,
    });
    chartRef.current = chart;
    const up = candleColors?.up ?? BULL_COLOR;
    const down = candleColors?.down ?? BEAR_COLOR;
    const candleSeries = addCandlestickSeriesCompat(chart, {
      upColor: up, downColor: down,
      borderUpColor: up, borderDownColor: down,
      wickUpColor: up, wickDownColor: down,
    });
    candleSeriesRef.current = candleSeries;

    const lineToolsPlugin = createLineToolsPlugin(chart, candleSeries);
    lineToolsPlugin.registerLineTool('TrendLine', LineToolTrendLine);
    lineToolsPlugin.registerLineTool('HorizontalLine', LineToolHorizontalLine);
    lineToolsPlugin.registerLineTool('VerticalLine', LineToolVerticalLine);
    lineToolsPlugin.registerLineTool('Ray', LineToolRay);
    lineToolsPlugin.registerLineTool('Rectangle', LineToolRectangle);
    lineToolsPlugin.registerLineTool('FibRetracement', LineToolFibRetracement);
    lineToolsPlugin.registerLineTool('ParallelChannel', LineToolParallelChannel);
    lineToolsRef.current = lineToolsPlugin;

    const vp = new VolumeProfilePlugin(candleSeries, []);
    try {
      if (chart.panes && chart.panes()[0]) chart.panes()[0].attachPrimitive(vp);
    } catch (_) {}
    if (volumeProfileRef) volumeProfileRef.current = vp;

    const sh = new SessionHighlightPlugin({ showLabels: true });
    try {
      if (chart.panes && chart.panes()[0]) chart.panes()[0].attachPrimitive(sh);
    } catch (_) {}
    if (sessionHighlightRef) sessionHighlightRef.current = sh;

    const lineSeries = addLineSeriesCompat(chart, {
      color: up,
      lineWidth: 2,
      lastValueVisible: true,
      priceLineVisible: true,
      crosshairMarkerVisible: true,
      visible: false,
    });
    lineSeriesRef.current = lineSeries;

    const applySize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth, height: chartContainerRef.current.clientHeight });
      }
    };
    window.addEventListener('resize', applySize);
    // ResizeObserver: chart must adjust to container when right panel collapses/expands (no window resize)
    const containerEl = chartContainerRef.current;
    const ro = containerEl ? new ResizeObserver(() => applySize()) : null;
    if (ro && containerEl) ro.observe(containerEl);
    return () => {
      if (ro && containerEl) ro.unobserve(containerEl);
      ro?.disconnect();
      window.removeEventListener('resize', applySize);
      lineToolsPlugin.removeAllLineTools?.();
      if (volumeProfileRef) volumeProfileRef.current = null;
      if (sessionHighlightRef) sessionHighlightRef.current = null;
      obOverlaySeriesRef.current.forEach(s => { try { chart.removeSeries(s); } catch {} });
      obOverlaySeriesRef.current = [];
      drawingPriceLinesRef.current = [];
      drawingTrendLinesRef.current = [];
      drawingRectanglesRef.current = [];
      drawingPendingPointRef.current = null;
      chart.remove();
    };
  }, []);

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const lineSeries = lineSeriesRef.current;
    if (!candleColors) return;
    const up = candleColors.up ?? BULL_COLOR;
    const down = candleColors.down ?? BEAR_COLOR;
    const isHollow = chartDisplayMode === 'hollow';
    if (candleSeries) {
      candleSeries.applyOptions({
        upColor: isHollow ? 'rgba(10,10,15,0)' : up,
        downColor: isHollow ? 'rgba(10,10,15,0)' : down,
        borderUpColor: up,
        borderDownColor: down,
        wickUpColor: up,
        wickDownColor: down,
      });
    }
    if (lineSeries) {
      lineSeries.applyOptions({ color: up });
    }
  }, [candleColors?.up, candleColors?.down, chartDisplayMode]);

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const lineSeries = lineSeriesRef.current;
    if (!candleSeries || !candles.length) return;

    const isLineMode = chartDisplayMode === 'line';
    const lineData = candles.map(c => ({ time: c.time, value: Number(c.close) }));

    if (isLineMode && lineSeries) {
      lineSeries.setData(lineData);
      lineSeries.applyOptions({ visible: true });
      candleSeries.applyOptions({ visible: false });
    } else {
      candleSeries.setData(candles);
      candleSeries.applyOptions({ visible: true });
      if (lineSeries) lineSeries.applyOptions({ visible: false });
    }

    if (volumeProfileRef?.current && candles.length > 0) {
      volumeProfileRef.current.updateData(candles);
    }

    const chartNow = Number(candles[candles.length - 1]?.time);
    const markers = [];

    // MSB markers
    (msbEvents || []).forEach(msb => {
      markers.push({
        time: msb.time,
        position: msb.direction === 'long' ? 'belowBar' : 'aboveBar',
        color: msb.direction === 'long' ? BULL_COLOR : BEAR_COLOR,
        shape: msb.direction === 'long' ? 'arrowUp' : 'arrowDown',
        text: 'MSB',
      });
    });

    // BUY/SELL signal markers (both MSB/OB and Smart Money) — green BUY below bar, red SELL above bar
    const activeTradeSignals = (Array.isArray(signals) ? signals : [])
      .filter(s => s.status === 'active');
    activeTradeSignals.forEach(s => {
        const time = Number(s.detected_at ?? s.time);
        if (!Number.isFinite(time)) return;
        const isLong = s.direction === 'long';
        const score = s.quality_score ? ` ${Math.round(s.quality_score)}` : '';
        markers.push({ time, position: isLong ? 'belowBar' : 'aboveBar', color: isLong ? '#00E676' : '#FF1744', shape: 'square', text: isLong ? `BUY${score}` : `SELL${score}` });
      });

    // CHoCH markers (Smart Money) — show more when Smart Money is active
    (chochEvents || []).slice(-20).forEach(ev => {
      const evTime = Number(ev.time);
      if (!Number.isFinite(evTime)) return;
      markers.push({ time: evTime, position: ev.direction === 'long' ? 'belowBar' : 'aboveBar', color: CHOCH_COLOR, shape: ev.direction === 'long' ? 'arrowUp' : 'arrowDown', text: 'CHoCH' });
    });

    // BOS markers (Smart Money)
    (bosEvents || []).slice(-20).forEach(ev => {
      const evTime = Number(ev.time);
      if (!Number.isFinite(evTime)) return;
      markers.push({ time: evTime, position: ev.direction === 'long' ? 'belowBar' : 'aboveBar', color: BOS_COLOR, shape: ev.direction === 'long' ? 'arrowUp' : 'arrowDown', text: 'BOS' });
    });

    // Clean up previous overlays
    if (chartRef.current) {
      obOverlaySeriesRef.current.forEach(s => { try { chartRef.current.removeSeries(s); } catch {} });
      obOverlaySeriesRef.current = [];

      // OB Zone Rectangles
      const sortedOBs = [...(orderBlocks || [])].sort((a, b) => Number(b?.msbBar ?? 0) - Number(a?.msbBar ?? 0));
      const activeOBs = sortedOBs.filter(ob => !ob?.mitigated).slice(0, 3);
      const mitigatedOBs = sortedOBs.filter(ob => ob?.mitigated).slice(0, 2);

      [...activeOBs, ...mitigatedOBs].forEach(ob => {
        const obTop = Number(ob?.top);
        const obBottom = Number(ob?.bottom);
        const obStart = Number(ob?.time);
        if (!Number.isFinite(obTop) || !Number.isFinite(obBottom) || !Number.isFinite(obStart) || !Number.isFinite(chartNow)) return;

        const startTime = Math.min(obStart, chartNow);
        const endTime = Math.max(obStart, chartNow);
        const bullish = String(ob?.direction || '').toLowerCase() === 'long';
        const isMitigated = !!ob?.mitigated;

        const zoneFill = isMitigated ? 'rgba(100,100,100,0.08)' : bullish ? 'rgba(8,153,129,0.15)' : 'rgba(242,54,69,0.15)';
        const borderColor = isMitigated ? 'rgba(100,100,100,0.3)' : bullish ? 'rgba(8,153,129,0.6)' : 'rgba(242,54,69,0.6)';

        const zone = addBaselineSeriesCompat(chartRef.current, {
          baseValue: { type: 'price', price: obBottom },
          topFillColor1: zoneFill, topFillColor2: zoneFill, topLineColor: 'rgba(0,0,0,0)',
          bottomFillColor1: 'rgba(0,0,0,0)', bottomFillColor2: 'rgba(0,0,0,0)', bottomLineColor: 'rgba(0,0,0,0)',
          lineWidth: 0, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
        });
        zone.setData([{ time: startTime, value: obTop }, { time: endTime, value: obTop }]);
        obOverlaySeriesRef.current.push(zone);

        [obTop, obBottom].forEach(price => {
          const bdr = addLineSeriesCompat(chartRef.current, {
            color: borderColor, lineWidth: 1, lineStyle: 2,
            lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
          });
          bdr.setData([{ time: startTime, value: price }, { time: endTime, value: price }]);
          obOverlaySeriesRef.current.push(bdr);
        });

        if (!isMitigated && ob?.score != null) {
          markers.push({ time: obStart, position: bullish ? 'belowBar' : 'aboveBar', color: bullish ? BULL_COLOR : BEAR_COLOR, shape: 'square', text: `${Math.round(ob.score)}%` });
        }
      });

      // MSB break lines
      (msbEvents || []).slice(-10).forEach(msb => {
        const msbIdx = Number(msb.bar);
        const msbTime = Number(msb.time);
        const level = Number(msb.level);
        if (!Number.isFinite(msbIdx) || !Number.isFinite(msbTime) || !Number.isFinite(level)) return;

        const lookback = Math.min(msbIdx, 20);
        let pivotIdx = Math.max(0, msbIdx - lookback);
        let bestDist = Infinity;
        for (let i = Math.max(0, msbIdx - lookback); i < msbIdx; i++) {
          const c = candles[i];
          if (!c) continue;
          const p = msb.direction === 'long' ? c.high : c.low;
          const d = Math.abs(p - level);
          if (d < bestDist) { bestDist = d; pivotIdx = i; }
        }

        const pivotTime = Number(candles[pivotIdx]?.time);
        if (!Number.isFinite(pivotTime) || pivotTime === msbTime) return;

        const msbLine = addLineSeriesCompat(chartRef.current, {
          color: msb.direction === 'long' ? BULL_COLOR : BEAR_COLOR,
          lineWidth: 1, lineStyle: 0,
          lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
        });
        msbLine.setData([{ time: Math.min(pivotTime, msbTime), value: level }, { time: Math.max(pivotTime, msbTime), value: level }]);
        obOverlaySeriesRef.current.push(msbLine);
      });

      // CHoCH structure level lines (Smart Money) — horizontal dashed at structure level
      (chochEvents || []).slice(-15).forEach(ev => {
        const evBar = Number(ev.bar);
        const evTime = Number(ev.time);
        const level = Number(ev?.level);
        if (!Number.isFinite(evBar) || !Number.isFinite(evTime) || !Number.isFinite(level)) return;
        const startIdx = Math.max(0, evBar - 15);
        const startTime = Number(candles[startIdx]?.time);
        if (!Number.isFinite(startTime)) return;
        const chochLine = addLineSeriesCompat(chartRef.current, {
          color: CHOCH_COLOR,
          lineWidth: 1,
          lineStyle: 2,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        });
        chochLine.setData([{ time: startTime, value: level }, { time: evTime, value: level }]);
        obOverlaySeriesRef.current.push(chochLine);
      });

      // BOS structure level lines (Smart Money) — horizontal dashed at structure level
      (bosEvents || []).slice(-15).forEach(ev => {
        const evBar = Number(ev.bar);
        const evTime = Number(ev.time);
        const level = Number(ev?.level);
        if (!Number.isFinite(evBar) || !Number.isFinite(evTime) || !Number.isFinite(level)) return;
        const startIdx = Math.max(0, evBar - 15);
        const startTime = Number(candles[startIdx]?.time);
        if (!Number.isFinite(startTime)) return;
        const bosLine = addLineSeriesCompat(chartRef.current, {
          color: BOS_COLOR,
          lineWidth: 1,
          lineStyle: 2,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        });
        bosLine.setData([{ time: startTime, value: level }, { time: evTime, value: level }]);
        obOverlaySeriesRef.current.push(bosLine);
      });

      // Diagonal trend/speed lines: connect consecutive CHoCH events (cyan) and BOS events (purple)
      const chochArr = (chochEvents || []).slice(-12);
      for (let i = 0; i < chochArr.length - 1; i++) {
        const a = chochArr[i];
        const b = chochArr[i + 1];
        const t1 = Number(a?.time);
        const t2 = Number(b?.time);
        const p1 = Number(a?.level);
        const p2 = Number(b?.level);
        if (!Number.isFinite(t1) || !Number.isFinite(t2) || !Number.isFinite(p1) || !Number.isFinite(p2)) continue;
        const diag = addLineSeriesCompat(chartRef.current, {
          color: CHOCH_COLOR,
          lineWidth: 1,
          lineStyle: 2,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        });
        diag.setData([{ time: t1, value: p1 }, { time: t2, value: p2 }]);
        obOverlaySeriesRef.current.push(diag);
      }
      const bosArr = (bosEvents || []).slice(-12);
      for (let i = 0; i < bosArr.length - 1; i++) {
        const a = bosArr[i];
        const b = bosArr[i + 1];
        const t1 = Number(a?.time);
        const t2 = Number(b?.time);
        const p1 = Number(a?.level);
        const p2 = Number(b?.level);
        if (!Number.isFinite(t1) || !Number.isFinite(t2) || !Number.isFinite(p1) || !Number.isFinite(p2)) continue;
        const diag = addLineSeriesCompat(chartRef.current, {
          color: BOS_COLOR,
          lineWidth: 1,
          lineStyle: 2,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        });
        diag.setData([{ time: t1, value: p1 }, { time: t2, value: p2 }]);
        obOverlaySeriesRef.current.push(diag);
      }
    }

    // Entry / TP / SL horizontal dashed lines for active signals (more when Smart Money style)
    activeTradeSignals.slice(0, 8).forEach(s => {
      const sigTime = Number(s.detected_at ?? s.time);
      if (!Number.isFinite(sigTime) || !Number.isFinite(chartNow)) return;
      const entry = Number(s.entry_price);
      const tp = Number(s.take_profit);
      const sl = Number(s.stop_loss);
      const startT = Math.min(sigTime, chartNow);
      const endT = Math.max(sigTime, chartNow);
      if (Number.isFinite(entry)) {
        const entryLine = addLineSeriesCompat(chartRef.current, { color: 'rgba(255,255,255,0.6)', lineWidth: 1, lineStyle: 2, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false });
        entryLine.setData([{ time: startT, value: entry }, { time: endT, value: entry }]);
        obOverlaySeriesRef.current.push(entryLine);
      }
      if (Number.isFinite(tp)) {
        const tpLine = addLineSeriesCompat(chartRef.current, { color: '#00E676', lineWidth: 1, lineStyle: 2, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false });
        tpLine.setData([{ time: startT, value: tp }, { time: endT, value: tp }]);
        obOverlaySeriesRef.current.push(tpLine);
      }
      if (Number.isFinite(sl)) {
        const slLine = addLineSeriesCompat(chartRef.current, { color: '#FF1744', lineWidth: 1, lineStyle: 2, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false });
        slLine.setData([{ time: startT, value: sl }, { time: endT, value: sl }]);
        obOverlaySeriesRef.current.push(slLine);
      }
    });

    markers.sort((a, b) => a.time - b.time);
    const activeSeries = isLineMode && lineSeries ? lineSeries : candleSeries;
    markersRef.current = createSeriesMarkers(activeSeries, markers);

    // Only fit content when candle data changed (ticker/timeframe or new data), not when user toggles signals off/on
    const candlesKey = candles.length ? `${selectedTicker}-${selectedTimeframe}-${candles.length}-${candles[0]?.time}-${candles[candles.length - 1]?.time}` : '';
    if (chartRef.current && candlesKey && candlesKey !== lastCandlesFitKeyRef.current) {
      lastCandlesFitKeyRef.current = candlesKey;
      chartRef.current.timeScale().fitContent();
      // Force price scale (Y-axis) to fit new ticker so right-side prices update (e.g. HIMS $15 -> NVDA $177)
      try {
        const mainScale = chartRef.current?.priceScale?.('right');
        if (mainScale) {
          if (typeof mainScale.setAutoScale === 'function') mainScale.setAutoScale(true);
          else if (typeof mainScale.applyOptions === 'function') mainScale.applyOptions({ autoScale: true });
        }
      } catch (_) {}
      // After layout settles, resize chart so candles are clearly visible (same as Trader page)
      const t = setTimeout(() => {
        const container = chartContainerRef.current;
        const chart = chartRef.current;
        if (container && chart) {
          const w = container.clientWidth;
          const h = container.clientHeight;
          if (w > 0 && h > 0) {
            chart.applyOptions({ width: w, height: h });
            chart.timeScale().fitContent();
            try {
              const scale = chart.priceScale?.('right');
              if (scale && (typeof scale.setAutoScale === 'function')) scale.setAutoScale(true);
            } catch (_) {}
          }
        }
      }, 200);
      return () => clearTimeout(t);
    }
  }, [candles, orderBlocks, msbEvents, signals, chochEvents, bosEvents, selectedTicker, selectedTimeframe, chartDisplayMode]);

  useEffect(() => {
    if (!chartContainerRef.current || !candles.length) return;

    const run = () => {
      const container = chartContainerRef.current;
      if (!container) return;

      const linePath = container.querySelector('svg path');
      const fillArea = container.querySelector('svg path[fill], svg .highcharts-area');

      if (linePath && typeof linePath.getTotalLength === 'function') {
        const length = linePath.getTotalLength();
        linePath.style.strokeDasharray = `${length}`;
        linePath.style.strokeDashoffset = `${length}`;
        gsap.to(linePath, {
          strokeDashoffset: 0,
          duration: 0.8,
          ease: 'power2.out',
        });
      } else {
        const canvasLayer = container.querySelectorAll('canvas');
        if (canvasLayer.length > 0) {
          gsap.fromTo(canvasLayer, { opacity: 0.2 }, { opacity: 1, duration: 0.8, ease: 'power2.out' });
        }
      }

      if (fillArea) {
        gsap.fromTo(fillArea,
          { opacity: 0 },
          { opacity: 1, duration: 0.6, ease: 'power2.out', delay: 0.2 }
        );
      }
    };

    const raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
  }, [selectedTicker, selectedTimeframe, candles.length]);

  const handleToolSelect = (toolName) => {
    setActiveTool(toolName);
    if (!lineToolsRef.current) return;
    if (toolName === 'cursor') return;
    if (toolName === 'clear') {
      lineToolsRef.current.removeAllLineTools();
      setActiveTool('cursor');
      return;
    }
    lineToolsRef.current.addLineTool(toolName, []);
  };

  return (
    <div className="relative w-full h-full flex">
      <div className="flex gap-0 relative flex-1 min-w-0 min-h-0">
        <DrawingToolbar
          lineTools={lineToolsRef.current}
          activeTool={activeTool}
          onToolSelect={handleToolSelect}
        />
        <div ref={chartContainerRef} className="flex-1 min-w-0" />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SIGNAL CARD
// ══════════════════════════════════════════════════════════════════════════════

function SignalCard({ signal, marketStatus }) {
  const dirColor = signal.direction === 'long' ? BULL_COLOR : BEAR_COLOR;
  const hpzColor = signal.direction === 'long' ? HPZ_BULL : HPZ_BEAR;
  const displayColor = signal.is_hpz ? hpzColor : dirColor;
  const rr = Math.abs(signal.entry_price - signal.stop_loss) > 0
    ? (Math.abs(signal.take_profit - signal.entry_price) / Math.abs(signal.entry_price - signal.stop_loss)).toFixed(1)
    : '—';

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`${signal?.is_hpz ? SOFT_GLASS_ACCENT_CLASS : SOFT_GLASS_CARD_CLASS} p-2`}
    >
      <div className="flex items-center gap-2">
        <QualityGauge score={signal.quality_score} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white font-mono">{String(signal.ticker || '')}</span>
            <span className="text-sm font-semibold uppercase" style={{ color: displayColor }}>
              {signal.direction === 'long' ? 'LONG' : 'SHORT'}
            </span>
            {signal.is_hpz && <span className="text-sm font-bold text-emerald-400">HPZ</span>}
          </div>
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            {signal.strategy_source && <span>{String(signal.strategy_source)}</span>}
            <span>&middot;</span>
            <span className="font-mono">{String(signal.timeframe || '')}</span>
            <span>&middot;</span>
            <span>{timeAgo(signal.detected_at || signal.time)}</span>
          </div>
        </div>
      </div>

      <div className="mt-1.5 space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 w-10 text-right flex-shrink-0">TP</span>
          <div className="flex-1 border-t border-dashed" style={{ borderColor: BULL_COLOR }} />
          <span className="text-sm font-mono" style={{ color: BULL_COLOR }}>${Number(signal.take_profit).toFixed(2)}</span>
          <span className="text-sm font-mono text-emerald-400 w-10 text-right flex-shrink-0">R:R {rr}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-white/60 w-10 text-right flex-shrink-0">Entry</span>
          <div className="flex-1 border-t border-white/70" />
          <span className="text-sm font-mono text-white">${Number(signal.entry_price).toFixed(2)}</span>
          <span className="w-10 flex-shrink-0" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 w-10 text-right flex-shrink-0">SL</span>
          <div className="flex-1 border-t border-dashed border-red-400" />
          <span className="text-sm font-mono text-red-400">${Number(signal.stop_loss).toFixed(2)}</span>
          <span className="w-10 flex-shrink-0" />
        </div>
      </div>

      <div className="mt-1 pt-1 border-t border-white/5 text-sm text-gray-400 font-mono">
        {'OB '}${Number(signal.ob_bottom).toFixed(2)}{'–'}${Number(signal.ob_top).toFixed(2)}{' | MSB '}${Number(signal.msb_level).toFixed(2)}{' | Z '}{String(signal.momentum_z)}
      </div>

      {(() => {
        const ms = marketStatus || {};
        const t = signal.detected_at || signal.time;
        let sigMs = 0;
        if (typeof t === 'string') sigMs = new Date(t).getTime();
        else if (t) sigMs = Number(t) < 4102444800 ? Number(t) * 1000 : Number(t);
        const expired = !sigMs || Date.now() - sigMs > 4 * 60 * 60 * 1000;
        const marketClosed = !ms.open && !ms.premarket && !ms.afterhours;

        if (expired) {
          return (
            <motion.button
              type="button"
              disabled
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              transition={BUTTON_SPRING}
              className="w-full mt-1.5 py-1.5 text-sm font-semibold text-gray-500 rounded cursor-not-allowed border border-white/10"
            >
              Expired
            </motion.button>
          );
        }
        if (marketClosed) {
          return (
            <motion.button
              type="button"
              disabled
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              transition={BUTTON_SPRING}
              className="w-full mt-1.5 py-1.5 text-sm font-semibold text-gray-500 rounded cursor-not-allowed border border-white/10"
            >
              Market Closed
            </motion.button>
          );
        }
        return (
          <motion.button
            type="button"
            onClick={(e) => e.stopPropagation()}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            transition={BUTTON_SPRING}
            className="w-full mt-1.5 py-1.5 text-sm font-semibold text-white rounded transition-all hover:brightness-110"
            style={{ background: `linear-gradient(135deg, ${displayColor}, ${displayColor}90)`, boxShadow: `0 0 20px ${displayColor}30` }}>
            Confirm Trade
          </motion.button>
        );
      })()}
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STRATEGY CARD
// ══════════════════════════════════════════════════════════════════════════════

function StrategyCard({ strategy, enabled, onToggle, onViewDetails, isExpanded, onExpandToggle, blend }) {
  const desc = SIGNAL_DESCRIPTIONS[strategy.strategy_type];
  const stats = desc?.stats || (strategy.backtest_win_rate ? { win: strategy.backtest_win_rate, ret: `+${strategy.backtest_return}`, pf: strategy.backtest_profit_factor } : null);
  const cardClass = blend
    ? `${SIGNAL_CARD_BLEND_CLASS} ${enabled ? SIGNAL_CARD_BLEND_ACTIVE_CLASS : ''}`
    : `${enabled ? SOFT_GLASS_ACCENT_CLASS : SOFT_GLASS_CARD_CLASS} p-3`;

  return (
    <motion.div
      whileHover={blend ? undefined : { y: -2, boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}
      whileTap={{ scale: blend ? 1 : 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={cardClass}
    >
      <div className="flex items-center justify-between gap-2">
        <motion.button
          type="button"
          onClick={onExpandToggle}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          transition={BUTTON_SPRING}
          className="flex-1 min-w-0 flex items-center gap-2 text-left"
        >
          <span className="text-sm font-semibold text-white truncate">{String(strategy.name || '')}</span>
          <svg
            className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </motion.button>
        <motion.button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggle(strategy.id); }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          transition={BUTTON_SPRING}
          className={`h-3.5 w-3.5 rounded border flex-shrink-0 flex items-center justify-center transition-all ${enabled ? 'border-emerald-400 bg-[#0b0b0b]' : 'border-zinc-600 bg-[#0b0b0b] hover:border-zinc-500'}`}>
          {enabled && <Check className="h-2.5 w-2.5 text-emerald-400" strokeWidth={2.5} />}
        </motion.button>
      </div>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="overflow-hidden"
          >
            {strategy.subtitle && (
              <p className="text-sm text-gray-500 mt-2">{String(strategy.subtitle)}</p>
            )}
            {stats && (
              <div className="flex items-center gap-3 mt-2 text-sm flex-wrap">
                <span className="text-gray-500">Win <span style={{ color: BULL_COLOR }} className="font-mono">{String(stats.win)}%</span></span>
                <span className="text-gray-500">Ret <span style={{ color: BULL_COLOR }} className="font-mono">{String(stats.ret)}%</span></span>
                <span className="text-gray-500">PF <span className="text-gray-300 font-mono">{String(stats.pf)}</span></span>
                <motion.button
                  type="button"
                  onClick={() => onViewDetails(strategy)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  transition={BUTTON_SPRING}
                  className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors ml-auto"
                >
                  Read full description
                </motion.button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StrategyDetailOverlay({ strategy, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      style={{ backgroundColor: 'rgba(6,13,24,0.92)' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 8 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto scrollbar-hide bg-white/[0.05] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-[0_24px_64px_rgba(0,0,0,0.6),0_8px_24px_rgba(0,0,0,0.4)]"
      >
        <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-white">{String(strategy.name || '')}</h2>
              <p className="text-sm text-gray-400 mt-1">{String(strategy.subtitle || '')}</p>
            </div>
            <motion.button
              type="button"
              onClick={onClose}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
              transition={BUTTON_SPRING}
              className="text-gray-500 hover:text-white transition-colors flex-shrink-0"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </motion.button>
          </div>
          <div className="mt-6 space-y-6 text-base leading-relaxed">
            <p className="text-gray-300">{String(strategy.description || '')}</p>
            {strategy.entry_logic && <div><span className="text-sm font-semibold text-emerald-400">Entry</span><p className="mt-2 text-gray-300">{String(strategy.entry_logic)}</p></div>}
            {strategy.exit_logic && <div><span className="text-sm font-semibold text-emerald-400">Exit</span><p className="mt-2 text-gray-300">{String(strategy.exit_logic)}</p></div>}
            {strategy.risk_management && <div><span className="text-sm font-semibold text-emerald-400">Risk</span><p className="mt-2 text-gray-300">{String(strategy.risk_management)}</p></div>}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SETTINGS PANEL
// ══════════════════════════════════════════════════════════════════════════════

function RadarSettings({ settings, onUpdate }) {
  const [activeSlider, setActiveSlider] = useState('');
  const slPct = (settings.stop_loss_multiplier - 0.1) / (2.0 - 0.1);
  const tpFillPct = (settings.take_profit_multiplier - 1.0) / (5.0 - 1.0);
  const riskPct = (settings.risk_per_trade * 100 - 0.5) / (5.0 - 0.5);
  const riskScore = (slPct + (1 - tpFillPct) + riskPct) / 3;
  const riskProfile = riskScore < 0.33 ? { label: 'Conservative', color: '#34d399' } : riskScore < 0.66 ? { label: 'Moderate', color: '#34d399' } : { label: 'Aggressive', color: '#f23645' };
  const sliderClass = 'radar-soft-slider relative w-full appearance-none bg-transparent cursor-pointer z-10';

  return (
    <div className="space-y-4">
      <style>{`
        .radar-soft-slider::-webkit-slider-runnable-track {
          height: 5px;
          border-radius: 9999px;
          background: rgba(255,255,255,0.06);
        }
        .radar-soft-slider::-moz-range-track {
          height: 5px;
          border-radius: 9999px;
          background: rgba(255,255,255,0.06);
        }
        .radar-soft-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 12px;
          height: 12px;
          border-radius: 9999px;
          background: #ffffff;
          border: 1px solid rgba(255,255,255,0.15);
          margin-top: -3.5px;
          transition: transform 150ms ease, box-shadow 150ms ease;
        }
        .radar-soft-slider::-moz-range-thumb {
          width: 12px;
          height: 12px;
          border-radius: 9999px;
          background: #ffffff;
          border: 1px solid rgba(255,255,255,0.15);
          transition: transform 150ms ease, box-shadow 150ms ease;
        }
        .radar-soft-slider:active::-webkit-slider-thumb,
        .radar-soft-slider.is-dragging::-webkit-slider-thumb,
        .radar-soft-slider:active::-moz-range-thumb,
        .radar-soft-slider.is-dragging::-moz-range-thumb {
          transform: scale(1.15);
          box-shadow: 0 0 0 3px rgba(16,185,129,0.2);
        }
      `}</style>
      <div className="flex items-center justify-between">
        <h3 className="text-sm text-gray-500 uppercase tracking-widest font-semibold">Settings</h3>
        <span className="text-sm font-medium text-emerald-400/90">{riskProfile.label}</span>
      </div>
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5"><label className="text-sm text-gray-500 flex-1">Stop Loss</label><span className="text-sm font-mono font-medium text-emerald-400/90">{settings.stop_loss_multiplier}x</span></div>
          <div className="relative h-5 flex items-center">
          <div className="absolute w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500/80 transition-all duration-200" style={{ width: `${slPct * 100}%` }} />
          </div>
          <input
            type="range"
            min="0.1"
            max="2.0"
            step="0.1"
            value={settings.stop_loss_multiplier}
            onPointerDown={() => setActiveSlider('sl')}
            onPointerUp={() => setActiveSlider('')}
            onBlur={() => setActiveSlider('')}
            onChange={e => onUpdate({ stop_loss_multiplier: parseFloat(e.target.value) })}
            className={`${sliderClass} ${activeSlider === 'sl' ? 'is-dragging' : ''}`}
          />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1.5"><label className="text-sm text-gray-500 flex-1">Take Profit</label><span className="text-sm font-mono font-medium text-emerald-400/90">{settings.take_profit_multiplier}x</span></div>
          <div className="relative h-5 flex items-center">
          <div className="absolute w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500/80 transition-all duration-200" style={{ width: `${tpFillPct * 100}%` }} />
          </div>
          <input
            type="range"
            min="1.0"
            max="5.0"
            step="0.5"
            value={settings.take_profit_multiplier}
            onPointerDown={() => setActiveSlider('tp')}
            onPointerUp={() => setActiveSlider('')}
            onBlur={() => setActiveSlider('')}
            onChange={e => onUpdate({ take_profit_multiplier: parseFloat(e.target.value) })}
            className={`${sliderClass} ${activeSlider === 'tp' ? 'is-dragging' : ''}`}
          />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1.5"><label className="text-sm text-gray-500 flex-1">Risk Per Trade</label><span className="text-sm font-mono font-medium text-emerald-400/90">{(settings.risk_per_trade * 100).toFixed(1)}%</span></div>
          <div className="relative h-5 flex items-center">
          <div className="absolute w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500/80 transition-all duration-200" style={{ width: `${riskPct * 100}%` }} />
          </div>
          <input
            type="range"
            min="0.5"
            max="5.0"
            step="0.5"
            value={settings.risk_per_trade * 100}
            onPointerDown={() => setActiveSlider('risk')}
            onPointerUp={() => setActiveSlider('')}
            onBlur={() => setActiveSlider('')}
            onChange={e => onUpdate({ risk_per_trade: parseFloat(e.target.value) / 100 })}
            className={`${sliderClass} ${activeSlider === 'risk' ? 'is-dragging' : ''}`}
          />
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TREND STRENGTH MATRIX — pixel-accurate to reference (2×7 grid, purple grid, crystal ball)
// Colors: #1A1B24 bg, #5C2D70 grid, #BF5FFF TREND, #E0E0E0 timeframes/Predict, #FF3B30 down, #D4AF37 flat
// ══════════════════════════════════════════════════════════════════════════════

const TREND_PANEL_BG = '#1A1B24';
const TREND_GRID = '#5C2D70';
const TREND_HEADER_PURPLE = '#BF5FFF';
const TREND_TEXT_OFFWHITE = '#E0E0E0';
const TREND_DOWN = '#FF3B30';
const TREND_FLAT = '#D4AF37';
const TREND_UP = '#34d399';

function CrystalBallIcon({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="trend-crystal-shine" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E9D5FF" />
          <stop offset="50%" stopColor="#BF5FFF" />
          <stop offset="100%" stopColor="#9333EA" />
        </linearGradient>
        <linearGradient id="trend-crystal-base" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FCD34D" />
          <stop offset="100%" stopColor="#D4AF37" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="10" r="7" fill="url(#trend-crystal-shine)" stroke="#BF5FFF" strokeWidth="0.4" opacity={0.95} />
      <ellipse cx="12" cy="16.5" rx="5" ry="1.5" fill="url(#trend-crystal-base)" />
      <path d="M9 17 L15 17 L14 19 L10 19 Z" fill="url(#trend-crystal-base)" />
    </svg>
  );
}

function TrendStrengthMatrix({ trendStrength, confidence, trendDetails }) {
  if (!trendDetails || trendDetails.length === 0) return null;
  // Use trendDetails in API order (5m, 15m, 30m, 1H, 4H, 1D) so each arrow lines up under its header
  const displayLabels = ['5M', '15M', '30M', '1H', '4H', '1D'];
  const colWidth = 32;
  const labelColWidth = 72;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="overflow-hidden rounded shadow-[0_8px_24px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm transition-all duration-300"
      style={{
        background: TREND_PANEL_BG,
        border: `1px solid ${TREND_GRID}`,
        fontSize: '11px',
      }}
    >
      <table
        className="border-collapse"
        style={{ fontSize: 'inherit', borderColor: TREND_GRID, tableLayout: 'fixed', width: labelColWidth + 6 * colWidth }}
      >
        <colgroup>
          <col style={{ width: labelColWidth }} />
          {displayLabels.map((lbl) => (
            <col key={lbl} style={{ width: colWidth }} />
          ))}
        </colgroup>
        <tbody>
          <tr>
            <td
              className="py-1 pl-2 pr-2.5 font-semibold uppercase tracking-wide border-r border-b whitespace-nowrap align-middle overflow-hidden"
              style={{ color: TREND_HEADER_PURPLE, borderColor: TREND_GRID }}
            >
              <span className="inline-flex items-center gap-1.5">
                <CrystalBallIcon className="w-3.5 h-3.5 flex-shrink-0" />
                <span>TREND</span>
              </span>
            </td>
            {displayLabels.map((lbl) => (
              <td
                key={lbl}
                className="px-1 py-1 font-medium uppercase tracking-wide text-center border-r border-b align-middle"
                style={{ color: TREND_TEXT_OFFWHITE, borderColor: TREND_GRID }}
              >
                {lbl}
              </td>
            ))}
          </tr>
          <tr>
            <td
              className="px-2 py-1 font-medium border-r whitespace-nowrap align-middle"
              style={{ color: TREND_TEXT_OFFWHITE, borderColor: TREND_GRID }}
            >
              Predict
            </td>
            {trendDetails.map((d, i) => {
              const dir = d?.direction ?? 0;
              return (
                <td
                  key={d.label ?? i}
                  className="px-1 py-1 border-r last:border-r-0 text-center align-middle"
                  style={{ borderColor: TREND_GRID }}
                >
                  {dir === 1 && (
                    <ChevronUp className="w-3 h-3 inline-block" style={{ color: TREND_UP }} strokeWidth={2.5} />
                  )}
                  {dir === -1 && (
                    <ChevronDown className="w-3 h-3 inline-block" style={{ color: TREND_DOWN }} strokeWidth={2.5} />
                  )}
                  {dir === 0 && (
                    <span className="w-3 h-0.5 rounded-full inline-block align-middle" style={{ backgroundColor: TREND_FLAT }} />
                  )}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LIVE TICKER HEADER (Twelve Data WebSocket — price ticking next to ticker)
// ══════════════════════════════════════════════════════════════════════════════

function LiveTickerHeader({ ticker, connected, onCollapse }) {
  return (
    <div className="pl-2 pr-5 py-3 border-b border-white/[0.06] flex items-center gap-3 flex-wrap bg-[rgba(255,255,255,0.02)]">
      <button
        type="button"
        onClick={() => onCollapse?.()}
        className="-ml-0.5 flex-shrink-0 p-1 rounded-md text-emerald-400 hover:text-emerald-300 hover:bg-white/[0.06] transition-colors cursor-pointer"
        title="Collapse panel"
        aria-label="Collapse panel"
      >
        <ChevronsRight className="w-5 h-5" strokeWidth={2} />
      </button>
      <span className="text-white font-semibold text-sm">${ticker}</span>
      {connected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════

function StrategyRadarContent() {
  const [selectedTicker, setSelectedTicker] = useState('TSLA');
  const [fetchKey, setFetchKey] = useState(0);
  const [candles, setCandles] = useState([]);
  const [signals, setSignals] = useState([]);
  const [orderBlocks, setOrderBlocks] = useState([]);
  const [msbEvents, setMsbEvents] = useState([]);
  const [strategies, setStrategies] = useState(() => [...VERIFIED_SIGNALS]);
  const [activeStrategies, setActiveStrategies] = useState(() => {
    const initial = {};
    VERIFIED_SIGNALS.forEach(s => { initial[s.id] = false; });
    return initial;
  });
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeSignalIdx, setActiveSignalIdx] = useState(0);
  const [expandedStrategy, setExpandedStrategy] = useState(null);
  const [expandedCardId, setExpandedCardId] = useState(null);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [volumeProfileVisible, setVolumeProfileVisible] = useState(false);
  const volumeProfileRef = useRef(null);
  const sessionHighlightRef = useRef(null);
  const [sessionHighlightVisible, setSessionHighlightVisible] = useState(false);
  const [settings, setSettings] = useState({
    timeframe: '1D',
    stop_loss_multiplier: 0.5,
    take_profit_multiplier: 2.5,
    risk_per_trade: 0.02,
  });

  const [candlePaletteId, setCandlePaletteId] = useState(() => {
    if (typeof window === 'undefined') return 'classic';
    try {
      const saved = window.localStorage.getItem(CANDLE_PALETTE_STORAGE_KEY);
      return CANDLE_PALETTES.some(p => p.id === saved) ? saved : 'classic';
    } catch {
      return 'classic';
    }
  });

  const candleColors = useMemo(() => {
    const p = CANDLE_PALETTES.find(pa => pa.id === candlePaletteId) || CANDLE_PALETTES[0];
    return { up: p.up, down: p.down };
  }, [candlePaletteId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(CANDLE_PALETTE_STORAGE_KEY, candlePaletteId);
    } catch {}
  }, [candlePaletteId]);

  const [chartDisplayMode, setChartDisplayMode] = useState(() => {
    if (typeof window === 'undefined') return 'solid';
    try {
      const saved = window.localStorage.getItem(CHART_DISPLAY_STORAGE_KEY);
      return CHART_DISPLAY_OPTIONS.some(o => o.id === saved) ? saved : 'solid';
    } catch {
      return 'solid';
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(CHART_DISPLAY_STORAGE_KEY, chartDisplayMode);
    } catch {}
  }, [chartDisplayMode]);

  const [smResults, setSmResults] = useState({ chochEvents: [], bosEvents: [], trendStrength: 0, confidence: 50, trendDetails: [], divergences: [], liquidityZones: [] });

  const detectorRef = useRef(null);
  const smDetectorRef = useRef(null);
  const wsRef = useRef(null);

  // Twelve Data WebSocket: live price ticking next to ticker in signals window (ws-config API)
  const { prices, connected, subscribe, unsubscribe } = useTwelveDataWS();
  const prevTickerRef = useRef(null);
  useEffect(() => {
    const ticker = selectedTicker ? normalizeTicker(selectedTicker) : null;
    if (prevTickerRef.current && prevTickerRef.current !== ticker) {
      unsubscribe([prevTickerRef.current]);
    }
    prevTickerRef.current = ticker;
    if (ticker) subscribe([ticker]);
    return () => {
      if (ticker) unsubscribe([ticker]);
      prevTickerRef.current = null;
    };
  }, [selectedTicker, subscribe, unsubscribe]);

  const normalizedTicker = selectedTicker ? normalizeTicker(selectedTicker) : '';
  const tickerPriceData = normalizedTicker ? prices[normalizedTicker] : null;

  const enabledTypes = useMemo(() => {
    const types = new Set();
    strategies.forEach(s => {
      if (activeStrategies[s.id]) types.add(s.strategy_type || 'msb_ob');
    });
    return types;
  }, [strategies, activeStrategies]);

  const anyStrategyEnabled = useMemo(() => Object.values(activeStrategies).some(Boolean), [activeStrategies]);
  const marketStatus = useMemo(() => getMarketStatus(selectedTicker), [selectedTicker]);
  const canScan = anyStrategyEnabled && (marketStatus.open || marketStatus.premarket || marketStatus.afterhours);

  useEffect(() => {
    gsap.fromTo('.dashboard-card',
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.4, stagger: 0.06, ease: 'power2.out' },
    );
  }, [selectedTicker, activeSignalIdx, expandedCardId, strategies.length]);

  // Load user settings, strategies, toggle states
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const userSettings = await getUserSettings(user.id);
        if (userSettings) {
          setSettings({
            timeframe: userSettings.timeframe || '1D',
            stop_loss_multiplier: parseFloat(userSettings.stop_loss_multiplier) || 0.5,
            take_profit_multiplier: parseFloat(userSettings.take_profit_multiplier) || 2.5,
            risk_per_trade: parseFloat(userSettings.risk_per_trade) || 0.02,
          });
        }
        const userSignals = await getUserSignals(user.id);
        setSignals(userSignals.map(s => ({ ...s, ticker: s.ticker })));
        const saved = await loadActiveStrategies(user.id);
        if (saved && Object.keys(saved).length > 0) setActiveStrategies(prev => ({ ...prev, ...saved }));
      }
      setStrategies(VERIFIED_SIGNALS);
      setActiveStrategies(prev => {
        const merged = { ...prev };
        VERIFIED_SIGNALS.forEach(s => { if (!(s.id in merged)) merged[s.id] = false; });
        return merged;
      });
      setLoading(false);
    }
    init();
  }, []);

  // Fetch candles + run detection (always runs — even when market is closed)
  useEffect(() => {
    let cancelled = false;
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }

    if (!anyStrategyEnabled) {
      detectorRef.current = null;
      smDetectorRef.current = null;
      setIsScanning(false);
      setOrderBlocks([]);
      setMsbEvents([]);
      setSmResults({ chochEvents: [], bosEvents: [], trendStrength: 0, confidence: 50, trendDetails: [], divergences: [], liquidityZones: [] });
    }

    async function loadAndDetect() {
      setLoading(true);
      const candleData = await fetchCandles(selectedTicker, settings.timeframe);
      if (cancelled) return;
      setCandles(candleData);

      if (!anyStrategyEnabled) { setLoading(false); return; }

      let allTaggedSignals = [];

      if (candleData.length > 0) {
        if (enabledTypes.has('msb_ob')) {
          const detector = createLiveDetector({ stop_loss_multiplier: settings.stop_loss_multiplier, take_profit_multiplier: settings.take_profit_multiplier });
          const results = detector.setCandles(candleData);
          detectorRef.current = detector;
          allTaggedSignals.push(...results.signals.map(s => ({ ...s, ticker: selectedTicker, timeframe: settings.timeframe, strategy_source: 'MSB/OB' })));
          setOrderBlocks(results.orderBlocks);
          setMsbEvents(results.msbEvents);
        } else {
          detectorRef.current = null;
          setOrderBlocks([]);
          setMsbEvents([]);
        }

        if (enabledTypes.has('smart_money')) {
          const smDetector = createSmartMoneyDetector({ stop_loss_multiplier: settings.stop_loss_multiplier, take_profit_multiplier: settings.take_profit_multiplier });
          const smRes = smDetector.setCandles(candleData);
          smDetectorRef.current = smDetector;
          allTaggedSignals.push(...smRes.signals.map(s => ({ ...s, ticker: selectedTicker, timeframe: settings.timeframe, strategy_source: 'Smart Money' })));
          setSmResults({ chochEvents: smRes.chochEvents, bosEvents: smRes.bosEvents, trendStrength: smRes.trendStrength, confidence: smRes.confidence, trendDetails: smRes.trendDetails, divergences: smRes.divergences, liquidityZones: smRes.liquidityZones });
        } else {
          smDetectorRef.current = null;
          setSmResults({ chochEvents: [], bosEvents: [], trendStrength: 0, confidence: 50, trendDetails: [], divergences: [], liquidityZones: [] });
        }

        console.log(`[Radar] ${selectedTicker} detection complete:`, { signals: allTaggedSignals.length, orderBlocks: enabledTypes.has('msb_ob') ? 'yes' : 'no', smartMoney: enabledTypes.has('smart_money') ? 'yes' : 'no', candles: candleData.length });
        if (allTaggedSignals.length > 0) console.log('[Radar] Signals:', allTaggedSignals);

        setSignals(prev => {
          const existing = new Set(prev.map(s => `${s.ticker}-${s.detected_at}-${s.strategy_source || ''}`));
          const newSignals = allTaggedSignals.filter(s => !existing.has(`${s.ticker}-${s.detected_at}-${s.strategy_source || ''}`));
          return [...newSignals, ...prev].slice(0, 100);
        });
      }

      setLoading(false);
      // Only start live WebSocket scanning if market is open
      if (canScan) {
        setIsScanning(true);
        connectWebSocket(selectedTicker, settings.timeframe);
      } else {
        setIsScanning(false);
      }
    }

    loadAndDetect();
    return () => { cancelled = true; if (wsRef.current) { wsRef.current.close(); wsRef.current = null; } };
  }, [selectedTicker, fetchKey, settings.timeframe, settings.stop_loss_multiplier, settings.take_profit_multiplier, anyStrategyEnabled, enabledTypes]);

  function connectWebSocket(ticker, timeframe) {
    if (wsRef.current) wsRef.current.close();
    if (!canScan) return;

    const ws = new WebSocket('wss://ws.twelvedata.com/v1/quotes/price');
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ action: 'subscribe', params: { symbols: ticker } }));
      setIsScanning(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === 'price' && msg.symbol === ticker) {
          const price = parseFloat(msg.price);
          if (price > 0) {
            let allNewSignals = [];
            if (detectorRef.current) {
              const currentCandles = detectorRef.current.getCandles();
              const lastCandle = currentCandles[currentCandles.length - 1];
              if (lastCandle) {
                const results = detectorRef.current.addCandle({ time: lastCandle.time, open: lastCandle.open, high: Math.max(lastCandle.high, price), low: Math.min(lastCandle.low, price), close: price, volume: lastCandle.volume });
                setCandles(detectorRef.current.getCandles());
                setOrderBlocks(results.orderBlocks);
                setMsbEvents(results.msbEvents);
                allNewSignals.push(...results.signals.map(s => ({ ...s, ticker: selectedTicker, timeframe: settings.timeframe, strategy_source: 'MSB/OB' })));
              }
            }
            if (smDetectorRef.current) {
              const smCandles = smDetectorRef.current.getCandles();
              const smLast = smCandles[smCandles.length - 1];
              if (smLast) {
                const smRes = smDetectorRef.current.addCandle({ time: smLast.time, open: smLast.open, high: Math.max(smLast.high, price), low: Math.min(smLast.low, price), close: price, volume: smLast.volume });
                if (!detectorRef.current) setCandles(smDetectorRef.current.getCandles());
                setSmResults({ chochEvents: smRes.chochEvents, bosEvents: smRes.bosEvents, trendStrength: smRes.trendStrength, confidence: smRes.confidence, trendDetails: smRes.trendDetails, divergences: smRes.divergences, liquidityZones: smRes.liquidityZones });
                allNewSignals.push(...smRes.signals.map(s => ({ ...s, ticker: selectedTicker, timeframe: settings.timeframe, strategy_source: 'Smart Money' })));
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
      } catch {}
    };

    ws.onerror = () => setIsScanning(false);
    ws.onclose = () => setIsScanning(false);
  }

  const handleSettingsUpdate = useCallback(async (updates) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await upsertUserSettings(user.id, newSettings);
  }, [settings]);

  const handleToggleStrategy = useCallback((strategyId) => {
    const wasOff = !activeStrategies[strategyId];
    setActiveStrategies(prev => {
      const next = { ...prev, [strategyId]: !prev[strategyId] };
      supabase.auth.getUser().then(({ data: { user } }) => { if (user) saveActiveStrategy(user.id, strategyId, next[strategyId]); });
      return next;
    });
    if (wasOff) setFetchKey(k => k + 1);
  }, [activeStrategies]);

  const currentTickerSignals = useMemo(() => {
    const cutoff7d = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return signals.filter(s => {
      if (s.ticker !== selectedTicker) return false;
      const t = s.detected_at || s.time;
      if (!t) return false;
      let ms;
      if (typeof t === 'string') ms = new Date(t).getTime();
      else ms = Number(t) < 4102444800 ? Number(t) * 1000 : Number(t);
      return Number.isFinite(ms) && ms > cutoff7d;
    });
  }, [signals, selectedTicker]);

  const activeSignalCount = useMemo(() => {
    const cutoff7d = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return signals.filter(s => {
      if (s.status !== 'active') return false;
      const t = s.detected_at || s.time;
      if (!t) return false;
      let ms;
      if (typeof t === 'string') ms = new Date(t).getTime();
      else ms = Number(t) < 4102444800 ? Number(t) * 1000 : Number(t);
      return Number.isFinite(ms) && ms > cutoff7d;
    }).length;
  }, [signals]);

  // Count of verified signals toggled ON (shown in top right: "1 active signal" / "2 active signals")
  const enabledStrategyCount = useMemo(
    () => strategies.filter(s => activeStrategies[s.id]).length,
    [strategies, activeStrategies]
  );

  if (loading && candles.length === 0) {
    return (
      <div className="h-full bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading Strategy Radar...</div>
      </div>
    );
  }

  const lastCandle = candles.length > 0 ? candles[candles.length - 1] : null;
  const prevClose = tickerPriceData?.previous_close ?? (candles.length > 1 ? candles[candles.length - 2]?.close : lastCandle?.close);
  const displayPrice = tickerPriceData?.price ?? lastCandle?.close;
  const changePct = tickerPriceData?.change_percent ?? (Number.isFinite(displayPrice) && Number.isFinite(prevClose) && prevClose > 0
    ? ((displayPrice - prevClose) / prevClose) * 100
    : null);
  const timeframeLabel = settings.timeframe || '1D';

  return (
    <div className="h-full overflow-hidden bg-[#0a0a0f] text-white flex flex-col">
      {/* Top Bar — same look as Trader page: glass bar + ticker / Candlestick chart · timeframe / price / % */}
      <div className="flex h-[68px] shrink-0 items-center justify-between px-4 py-3 backdrop-blur-xl" style={GLASS_TOPBAR_STYLE}>
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold tracking-wide text-white">Strategy Radar</h1>
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${
              !anyStrategyEnabled ? 'bg-gray-600'
              : isScanning && marketStatus.open ? 'bg-emerald-400 animate-pulse'
              : anyStrategyEnabled ? 'bg-emerald-400'
              : String(marketStatus.dotColor || 'bg-gray-600')
            }`} />
            <span className="text-sm text-[#7c8087]">
              {!anyStrategyEnabled ? 'Disabled'
                : isScanning && marketStatus.open ? 'Scanning'
                : anyStrategyEnabled && !marketStatus.open ? `Analyzed · ${String(marketStatus.label || '')}`
                : String(marketStatus.label || '')}
            </span>
          </div>
        </div>

        <RadarSearchBar
          selectedTicker={selectedTicker}
          onSelect={(t) => { setSelectedTicker(t); setActiveSignalIdx(0); setFetchKey(k => k + 1); }}
        />

        <div className="flex items-center gap-4 text-right flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              <CountUp key={`enabled-${enabledStrategyCount}`} start={0} end={enabledStrategyCount} duration={0.9} useEasing />
              {' '}active signal{enabledStrategyCount !== 1 ? 's' : ''}
            </span>
          </div>
          <div>
            <h2 className="text-sm font-medium text-white">{selectedTicker || 'Select a symbol'}</h2>
            <p className="mt-1 text-xs text-[#7c8087]">Candlestick chart · {timeframeLabel}</p>
          </div>
          <div>
            <div className="flex items-center justify-end gap-1">
              <div className="text-lg font-semibold tabular-nums text-white">
                {Number.isFinite(displayPrice) ? `$${Number(displayPrice).toFixed(2)}` : '—'}
              </div>
            </div>
            <div
              className={`flex items-center justify-end gap-1 text-xs font-medium tabular-nums ${
                Number.isFinite(changePct)
                  ? changePct >= 0
                    ? 'text-emerald-400'
                    : 'text-red-400'
                  : 'text-[#6b7280]'
              }`}
            >
              <span>{Number.isFinite(changePct) ? (changePct >= 0 ? '+' : '') + Number(changePct).toFixed(2) + '%' : '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT — Chart */}
        <div className="flex-1 flex flex-col border-r border-white/6 min-w-0">
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/6 bg-[#0b0b0b]">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-gray-500 mr-0.5">Candles</span>
                {CANDLE_PALETTES.map(pal => {
                  const isActive = candlePaletteId === pal.id;
                  return (
                    <motion.button
                      key={pal.id}
                      type="button"
                      onClick={() => setCandlePaletteId(pal.id)}
                      whileTap={{ scale: 0.96 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className={`flex items-center gap-1 rounded border px-1.5 py-1 text-xs transition-colors ${isActive ? 'border-white/20 bg-white/10' : 'border-white/[0.06] bg-transparent hover:bg-white/[0.04] text-gray-500 hover:text-gray-300'}`}
                      title={pal.name}
                    >
                      <span className="w-3 h-3 rounded-[4px] flex-shrink-0 border border-white/10" style={{ backgroundColor: pal.up }} />
                      <span className="w-3 h-3 rounded-[4px] flex-shrink-0 border border-white/10" style={{ backgroundColor: pal.down }} />
                    </motion.button>
                  );
                })}
              </div>
                  <div className="flex items-center gap-1">
                {CHART_DISPLAY_OPTIONS.map(opt => {
                  const isActive = chartDisplayMode === opt.id;
                  const Icon = opt.Icon;
                  return (
                    <motion.button
                      key={opt.id}
                      type="button"
                      onClick={() => setChartDisplayMode(opt.id)}
                      whileTap={{ scale: 0.96 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className={`flex items-center justify-center rounded border w-7 h-7 transition-colors ${isActive ? 'border-white/20 bg-white/10 text-white' : 'border-white/[0.06] bg-transparent text-gray-500 hover:bg-white/[0.04] hover:text-gray-300'}`}
                      title={opt.name}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                    </motion.button>
                  );
                })}
              </div>
              <motion.button
                type="button"
                onClick={() => {
                  const next = !volumeProfileVisible;
                  setVolumeProfileVisible(next);
                  volumeProfileRef.current?.setVisible(next);
                }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className={`flex flex-col items-center justify-center shrink-0 transition-colors ${volumeProfileVisible ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'}`}
                title="Volume Profile"
              >
                <BarChart2 className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                <span className="text-[10px] mt-0.5">Vol Profile</span>
              </motion.button>
              <motion.button
                type="button"
                onClick={() => {
                  const next = !sessionHighlightVisible;
                  setSessionHighlightVisible(next);
                  sessionHighlightRef.current?.setVisible(next);
                }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className={`flex flex-col items-center justify-center shrink-0 transition-colors ${sessionHighlightVisible ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'}`}
                title="Session Highlighting"
              >
                <Clock className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                <span className="text-[10px] mt-0.5">Sessions</span>
              </motion.button>
            </div>
            <div className="flex items-center gap-1">
              {TIMEFRAMES.map(tf => (
                <motion.button
                  key={tf}
                  type="button"
                  onClick={() => handleSettingsUpdate({ timeframe: tf })}
                  whileTap={{ scale: 0.92 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className={`px-1 py-0.5 text-sm font-mono transition-colors ${settings.timeframe === tf ? 'text-[#00C2FF]' : 'text-gray-600 hover:text-gray-400'}`}>
                  {tf}
                </motion.button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-h-0 relative flex flex-col">
            <RadarChart
              key={selectedTicker}
              candles={candles}
              orderBlocks={orderBlocks}
              msbEvents={msbEvents}
              signals={currentTickerSignals}
              chochEvents={smResults.chochEvents}
              bosEvents={smResults.bosEvents}
              selectedTicker={selectedTicker}
              selectedTimeframe={settings.timeframe}
              candleColors={candleColors}
              chartDisplayMode={chartDisplayMode}
              volumeProfileRef={volumeProfileRef}
              sessionHighlightRef={sessionHighlightRef}
            />
            {/* Trend Strength widget: only when Smart Money signal is activated; never for MSB/OB or other strategies */}
            {activeStrategies['smart_money'] && smResults.trendDetails && smResults.trendDetails.length > 0 && (
              <div className="absolute bottom-10 right-20 z-10 pointer-events-none">
                <TrendStrengthMatrix trendStrength={smResults.trendStrength} confidence={smResults.confidence} trendDetails={smResults.trendDetails} />
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 px-4 py-2 border-t border-white/6 text-sm flex-wrap bg-[#0b0b0b]">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: candleColors.up }} /><span className="text-gray-500">Bullish OB</span></span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: candleColors.down }} /><span className="text-gray-500">Bearish OB</span></span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: HPZ_BULL }} /><span className="text-gray-500">High Probability Zone</span></span>
            {enabledTypes.has('smart_money') && (
              <>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: CHOCH_COLOR }} /><span className="text-gray-500">CHoCH</span></span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: BOS_COLOR }} /><span className="text-gray-500">BOS</span></span>
              </>
            )}
            <span className="flex items-center gap-1.5"><span className="w-5 border-t border-dashed border-white/60 flex-shrink-0" /><span className="text-gray-500">Entry</span></span>
            <span className="flex items-center gap-1.5"><span className="w-5 border-t border-dashed flex-shrink-0" style={{ borderColor: '#00E676' }} /><span className="text-gray-500">TP</span></span>
            <span className="flex items-center gap-1.5"><span className="w-5 border-t border-dashed flex-shrink-0" style={{ borderColor: '#FF1744' }} /><span className="text-gray-500">SL</span></span>
          </div>
        </div>

        {/* RIGHT — Signals + Strategies (collapsible, narrower).
            NOTE: Trading View chart (left) uses flex-1 + ResizeObserver so it adjusts to screen
            when this panel collapses/expands. NOTE: Chevron is green double-chevron to match site accent. */}
        <div className="flex-shrink-0 flex items-stretch border-l border-white/6">
          {rightPanelCollapsed ? (
            <motion.button
              type="button"
              initial={false}
              animate={{ width: 40 }}
              onClick={() => setRightPanelCollapsed(false)}
              className="flex flex-col items-center justify-start min-h-0 pt-4 pb-4 text-emerald-400 hover:text-emerald-300 hover:bg-white/[0.04] transition-colors"
              title="Expand panel"
            >
              <ChevronsLeft className="w-5 h-5 flex-shrink-0" strokeWidth={2} />
              <span className="text-[10px] uppercase tracking-wider rotate-0 hidden">Open</span>
            </motion.button>
          ) : (
            <motion.div
              initial={false}
              animate={{ width: 300 }}
              className="flex min-h-0 relative"
            >
              <div className="w-full min-h-0 overflow-y-auto relative p-2 pl-3 scrollbar-hide bg-[#111111]">
                <div className={SIGNAL_PANEL_BLEND_CLASS}>
                  <LiveTickerHeader
                    ticker={selectedTicker}
                    connected={connected}
                    onCollapse={() => setRightPanelCollapsed(true)}
                  />

            <div className="p-3 border-b border-white/[0.06]">
              <h2 className="text-sm text-[#7c8087] uppercase tracking-widest font-semibold mb-2">Active Signals</h2>
            {currentTickerSignals.length > 0 ? (
              <>
                <div className="flex gap-0.5 mb-2 overflow-x-auto pb-0.5">
                  {currentTickerSignals.slice(0, 10).map((sig, i) => {
                    const isActive = activeSignalIdx === i;
                    const tabDirColor = sig.direction === 'long' ? BULL_COLOR : BEAR_COLOR;
                    return (
                      <motion.button key={i} onClick={() => setActiveSignalIdx(i)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.96 }}
                        transition={BUTTON_SPRING}
                        className={`flex items-center gap-1 px-1.5 py-1 rounded text-sm whitespace-nowrap transition-all border-l-2 flex-shrink-0 ${isActive ? 'bg-white/[0.04]' : 'bg-transparent hover:bg-white/[0.02]'}`}
                        style={{ borderColor: isActive ? tabDirColor : 'transparent' }}>
                        <span style={{ color: tabDirColor }}>{sig.direction === 'long' ? '▲' : '▼'}</span>
                        <span className={`font-mono ${isActive ? 'text-white' : 'text-gray-500'}`}>{String(sig.ticker || '')}</span>
                        <span className="font-mono text-gray-600">{String(sig.quality_score || '')}%</span>
                      </motion.button>
                    );
                  })}
                </div>
                <AnimatePresence mode="wait">
                  {currentTickerSignals[activeSignalIdx] && (
                    <motion.div key={activeSignalIdx}
                      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.15 }}>
                      <SignalCard signal={currentTickerSignals[activeSignalIdx]} marketStatus={marketStatus} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              anyStrategyEnabled ? (
                <div className="flex items-center gap-2 py-3">
                  <div className="relative">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                    <div className="absolute inset-0 w-2 h-2 bg-emerald-500 rounded-full animate-ping opacity-50" />
                  </div>
                  <span className="text-sm text-gray-500">
                    {!marketStatus.open && !marketStatus.premarket && !marketStatus.afterhours
                      ? 'Market closed — signals update at next open'
                      : 'Scanning for setups...'}
                  </span>
                </div>
              ) : (
                <p className="text-sm text-gray-500 py-3">Toggle a strategy to start scanning</p>
              )
            )}
            </div>

            <div className="p-3 border-b border-white/[0.06]">
              <RadarSettings settings={settings} onUpdate={handleSettingsUpdate} />
            </div>

            <div className="p-3">
              <h2 className="text-sm text-[#7c8087] uppercase tracking-widest font-semibold mb-2">Verified Signals</h2>
              <div className="space-y-2">
                {strategies.map(strategy => (
                  <StrategyCard key={strategy.id} strategy={strategy} enabled={activeStrategies[strategy.id] || false} onToggle={handleToggleStrategy} onViewDetails={setExpandedStrategy} isExpanded={expandedCardId === strategy.id} onExpandToggle={() => setExpandedCardId(prev => prev === strategy.id ? null : strategy.id)} blend />
                ))}
              </div>
            </div>
          </div>
              </div>

              {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                  {expandedStrategy && (
                    <StrategyDetailOverlay strategy={expandedStrategy} onClose={() => setExpandedStrategy(null)} />
                  )}
                </AnimatePresence>,
                document.body
              )}
            </motion.div>
          )}
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
