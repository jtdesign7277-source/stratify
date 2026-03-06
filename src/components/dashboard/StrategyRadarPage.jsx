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
import { Search } from 'lucide-react';
import gsap from 'gsap';
import CountUp from 'react-countup';

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
const HPZ_BEAR = '#ff5252';
const CHOCH_COLOR = '#00C2FF';
const BOS_COLOR = '#7B61FF';
const SOFT_GLASS_CARD_CLASS = 'dashboard-card bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl rounded-2xl border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-300 hover:from-white/[0.06] hover:to-white/[0.02] hover:shadow-[0_12px_40px_rgba(0,0,0,0.5)] hover:border-white/[0.1]';
const SOFT_GLASS_ACCENT_CLASS = 'dashboard-card bg-gradient-to-br from-emerald-500/[0.08] to-white/[0.02] backdrop-blur-xl rounded-2xl border border-emerald-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_20px_rgba(16,185,129,0.1)]';
const SOFT_GLASS_INSET_CLASS = 'bg-black/40 rounded-xl shadow-[inset_4px_4px_8px_rgba(0,0,0,0.5),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] border border-white/[0.04]';
const BUTTON_SPRING = { type: 'spring', stiffness: 500, damping: 30 };

const CRYPTO_TICKERS = new Set(['BTC/USD', 'ETH/USD', 'SOL/USD', 'XRP/USD', 'DOGE/USD', 'LINK/USD', 'ADA/USD', 'AVAX/USD', 'DOT/USD']);

const SIGNAL_DESCRIPTIONS = {
  msb_ob: {
    summary: 'Detects institutional order blocks combined with market structure breaks (MSB) for high-probability pullback entries. Identifies premium and discount zones using Fibonacci retracements with multi-timeframe confirmation.',
    triggers: 'BUY signals trigger when price breaks above a pivot high (bullish MSB) and revisits the order block zone. SELL signals trigger on bearish breaks below pivot lows.',
    stats: { win: '68', ret: '+28.7', pf: '1.9' },
  },
  smart_money: {
    summary: 'Identifies Change of Character (CHoCH) and Break of Structure (BOS) patterns used by institutional traders. Multi-timeframe trend alignment and RSI divergence filtering improve signal quality.',
    triggers: 'BUY signals fire on bullish CHoCH (price reverses up through a pivot level) or bullish BOS (continuation break above previous structure). SELL signals fire on bearish equivalents.',
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
    subtitle: 'CHoCH & BOS patterns',
    description: SIGNAL_DESCRIPTIONS.smart_money.summary,
    entry_logic: SIGNAL_DESCRIPTIONS.smart_money.triggers,
    exit_logic: 'Exit on structure invalidation or target.',
    risk_management: 'Stop at recent structure; R-multiple targets.',
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
    <div ref={containerRef} className="w-full max-w-md mx-4 relative flex-shrink min-w-0">
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

// ── Fetch Candles ────────────────────────────────────────────────────────────
async function fetchCandles(ticker, timeframe) {
  try {
    const res = await fetch(`/api/radar/candles?symbol=${ticker}&interval=${TIMEFRAME_MAP[timeframe]}`);
    const data = await res.json();
    if (!data.values) return [];
    return data.values
      .map(v => ({
        time: Math.floor(new Date(v.datetime).getTime() / 1000),
        open: parseFloat(v.open), high: parseFloat(v.high),
        low: parseFloat(v.low), close: parseFloat(v.close),
        volume: parseInt(v.volume || 0),
      }))
      .sort((a, b) => a.time - b.time);
  } catch (err) {
    console.error('Failed to fetch candles:', err);
    return [];
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// RADAR CHART
// ══════════════════════════════════════════════════════════════════════════════

function RadarChart({ candles, orderBlocks, msbEvents, signals, chochEvents, bosEvents, selectedTicker, selectedTimeframe }) {
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
        background: { type: 'solid', color: '#0a0a0f' },
        textColor: 'rgba(255,255,255,0.7)',
        fontSize: 12,
      },
      grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
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
    const candleSeries = addCandlestickSeriesCompat(chart, {
      upColor: BULL_COLOR, downColor: BEAR_COLOR,
      borderUpColor: BULL_COLOR, borderDownColor: BEAR_COLOR,
      wickUpColor: BULL_COLOR, wickDownColor: BEAR_COLOR,
    });
    candleSeriesRef.current = candleSeries;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth, height: chartContainerRef.current.clientHeight });
      }
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      obOverlaySeriesRef.current.forEach(s => { try { chart.removeSeries(s); } catch {} });
      obOverlaySeriesRef.current = [];
      chart.remove();
    };
  }, []);

  useEffect(() => {
    if (!candleSeriesRef.current || !candles.length) return;
    candleSeriesRef.current.setData(candles);

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

    // BUY/SELL signal markers (both MSB/OB and Smart Money)
    const activeTradeSignals = (Array.isArray(signals) ? signals : [])
      .filter(s => s.status === 'active');
    activeTradeSignals.forEach(s => {
        const time = Number(s.detected_at ?? s.time);
        if (!Number.isFinite(time)) return;
        const isLong = s.direction === 'long';
        const score = s.quality_score ? ` ${Math.round(s.quality_score)}` : '';
        markers.push({ time, position: isLong ? 'belowBar' : 'aboveBar', color: isLong ? '#00E676' : '#FF1744', shape: 'square', text: isLong ? `BUY${score}` : `SELL${score}` });
      });

    // CHoCH markers
    (chochEvents || []).slice(-5).forEach(ev => {
      const evTime = Number(ev.time);
      if (!Number.isFinite(evTime)) return;
      markers.push({ time: evTime, position: ev.direction === 'long' ? 'belowBar' : 'aboveBar', color: CHOCH_COLOR, shape: ev.direction === 'long' ? 'arrowUp' : 'arrowDown', text: 'CHoCH' });
    });

    // BOS markers
    (bosEvents || []).slice(-5).forEach(ev => {
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
    }

    // Entry / TP / SL horizontal dashed lines for active signals
    activeTradeSignals.slice(0, 3).forEach(s => {
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
    if (markersRef.current) {
      markersRef.current.setMarkers(markers);
    } else {
      markersRef.current = createSeriesMarkers(candleSeriesRef.current, markers);
    }

    if (chartRef.current) chartRef.current.timeScale().fitContent();
  }, [candles, orderBlocks, msbEvents, signals, chochEvents, bosEvents]);

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

  return <div ref={chartContainerRef} className="w-full h-full" />;
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

function StrategyCard({ strategy, enabled, onToggle, onViewDetails, isExpanded, onExpandToggle }) {
  const desc = SIGNAL_DESCRIPTIONS[strategy.strategy_type];
  const stats = desc?.stats || (strategy.backtest_win_rate ? { win: strategy.backtest_win_rate, ret: `+${strategy.backtest_return}`, pf: strategy.backtest_profit_factor } : null);

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`${enabled ? SOFT_GLASS_ACCENT_CLASS : SOFT_GLASS_CARD_CLASS} p-3`}
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
          className={`w-5 h-5 rounded-full border-2 transition-all flex-shrink-0 flex items-center justify-center ${enabled ? 'border-emerald-400' : 'border-white/20 hover:border-white/40'}`}>
          {enabled && <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />}
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
            {desc && (
              <p className="text-sm text-gray-400 leading-relaxed mt-2">{desc.summary}</p>
            )}
            {stats && (
              <div className="flex items-center gap-3 mt-2 text-sm">
                <span className="text-gray-500">Win <span style={{ color: BULL_COLOR }} className="font-mono">{String(stats.win)}%</span></span>
                <span className="text-gray-500">Ret <span style={{ color: BULL_COLOR }} className="font-mono">{String(stats.ret)}%</span></span>
                <span className="text-gray-500">PF <span className="text-gray-300 font-mono">{String(stats.pf)}</span></span>
                <motion.button
                  type="button"
                  onClick={() => onViewDetails(strategy)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  transition={BUTTON_SPRING}
                  className="text-sm text-gray-600 hover:text-gray-400 transition-colors ml-auto"
                >
                  details
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
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="absolute inset-0 z-20 bg-[#0a0a0f] overflow-y-auto"
    >
      <div className="p-6">
        <motion.button
          type="button"
          onClick={onClose}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          transition={BUTTON_SPRING}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </motion.button>
        <h2 className="text-sm font-bold text-white">{String(strategy.name || '')}</h2>
        <p className="text-sm text-gray-400 mt-1">{String(strategy.subtitle || '')}</p>
        <div className="mt-6 space-y-6">
          <p className="text-sm text-gray-300 leading-relaxed">{String(strategy.description || '')}</p>
          {strategy.entry_logic && <div><span className="text-sm font-semibold text-emerald-400">Entry</span><p className="mt-2 text-sm text-gray-300 leading-relaxed">{String(strategy.entry_logic)}</p></div>}
          {strategy.exit_logic && <div><span className="text-sm font-semibold text-emerald-400">Exit</span><p className="mt-2 text-sm text-gray-300 leading-relaxed">{String(strategy.exit_logic)}</p></div>}
          {strategy.risk_management && <div><span className="text-sm font-semibold text-emerald-400">Risk</span><p className="mt-2 text-sm text-gray-300 leading-relaxed">{String(strategy.risk_management)}</p></div>}
        </div>
      </div>
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
    <motion.div
      whileHover={{ y: -2, boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`${SOFT_GLASS_CARD_CLASS} p-3 space-y-3`}
    >
      <style>{`
        .radar-soft-slider::-webkit-slider-runnable-track {
          height: 6px;
          border-radius: 9999px;
          background: linear-gradient(to right, rgba(16,185,129,0.45), rgba(52,211,153,0.45));
        }
        .radar-soft-slider::-moz-range-track {
          height: 6px;
          border-radius: 9999px;
          background: linear-gradient(to right, rgba(16,185,129,0.45), rgba(52,211,153,0.45));
        }
        .radar-soft-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          background: #ffffff;
          border: 2px solid rgba(255,255,255,0.2);
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          margin-top: -4px;
          transition: transform 220ms cubic-bezier(0.22,1,0.36,1);
        }
        .radar-soft-slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 9999px;
          background: #ffffff;
          border: 2px solid rgba(255,255,255,0.2);
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          transition: transform 220ms cubic-bezier(0.22,1,0.36,1);
        }
        .radar-soft-slider:active::-webkit-slider-thumb,
        .radar-soft-slider.is-dragging::-webkit-slider-thumb,
        .radar-soft-slider:active::-moz-range-thumb,
        .radar-soft-slider.is-dragging::-moz-range-thumb {
          transform: scale(1.2);
        }
      `}</style>
      <div className="flex items-center justify-between">
        <h3 className="text-sm text-gray-500 uppercase tracking-widest font-semibold">Settings</h3>
        <span className="text-sm font-semibold" style={{ color: riskProfile.color }}>{riskProfile.label}</span>
      </div>
      <div>
        <div className="flex items-center gap-1.5 mb-1.5"><label className="text-sm text-gray-400 flex-1">Stop Loss</label><span className="text-sm font-mono font-semibold text-emerald-400">{settings.stop_loss_multiplier}x</span></div>
        <div className="relative h-5 flex items-center">
          <div className="absolute w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300" style={{ width: `${slPct * 100}%` }} />
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
        <div className="flex items-center gap-1.5 mb-1.5"><label className="text-sm text-gray-400 flex-1">Take Profit</label><span className="text-sm font-mono font-semibold text-emerald-400">{settings.take_profit_multiplier}x</span></div>
        <div className="relative h-5 flex items-center">
          <div className="absolute w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300" style={{ width: `${tpFillPct * 100}%` }} />
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
        <div className="flex items-center gap-1.5 mb-1.5"><label className="text-sm text-gray-400 flex-1">Risk Per Trade</label><span className="text-sm font-mono font-semibold text-emerald-400">{(settings.risk_per_trade * 100).toFixed(1)}%</span></div>
        <div className="relative h-5 flex items-center">
          <div className="absolute w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-300" style={{ width: `${riskPct * 100}%` }} />
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
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TREND STRENGTH MATRIX
// ══════════════════════════════════════════════════════════════════════════════

function TrendStrengthMatrix({ trendStrength, confidence, trendDetails }) {
  if (!trendDetails || trendDetails.length === 0) return null;
  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`${SOFT_GLASS_CARD_CLASS} p-3`}
    >
      <h3 className="text-sm text-gray-500 uppercase tracking-widest font-semibold mb-1.5">Trend Strength</h3>
      <div className="flex items-center gap-2 text-sm font-mono">
        {trendDetails.map((td, i) => (
          <span key={String(td.label || i)} className="flex items-center gap-0.5">
            <span className="text-gray-500">{String(td.label || '')}</span>
            <span style={{ color: td.direction === 1 ? '#34d399' : td.direction === -1 ? '#f87171' : '#666' }}>
              {td.direction === 1 ? '▲' : td.direction === -1 ? '▼' : '—'}
            </span>
          </span>
        ))}
      </div>
      <div className="text-sm text-gray-400 mt-1">
        {'Str: '}<span className="font-mono font-semibold" style={{ color: trendStrength >= 0 ? '#34d399' : '#f87171' }}>{trendStrength > 0 ? '+' : ''}{String(trendStrength)}%</span>
        {' · Conf: '}<span className="font-mono font-semibold text-white">{String(confidence)}%</span>
      </div>
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LIVE TICKER HEADER (WebSocket streaming price)
// ══════════════════════════════════════════════════════════════════════════════

const TD_WS_KEY = import.meta.env.VITE_TWELVE_DATA_WS_KEY
  || import.meta.env.VITE_TWELVE_DATA_API_KEY
  || import.meta.env.VITE_TWELVEDATA_API_KEY;

function LiveTickerHeader({ ticker }) {
  const [price, setPrice] = useState(null);
  const [prevClose, setPrevClose] = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const prevPriceRef = useRef(null);
  const renderPrevPriceRef = useRef(null);

  useEffect(() => {
    if (!ticker || !TD_WS_KEY) return;

    setPrice(null);
    setPrevClose(null);
    setConnected(false);
    prevPriceRef.current = null;

    const ws = new WebSocket(`wss://ws.twelvedata.com/v1/quotes/price?apikey=${TD_WS_KEY}`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ action: 'subscribe', params: { symbols: ticker } }));
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === 'price' && msg.symbol === ticker) {
          const p = parseFloat(msg.price);
          if (!Number.isFinite(p)) return;

          // Flash logic
          if (prevPriceRef.current !== null) {
            // price direction is consumed by renderPrevPriceRef for UI flash animation
          }
          prevPriceRef.current = p;
          setPrice(p);

          if (msg.day_change !== undefined) {
            // Derive previous close from price and day_change
            const dc = parseFloat(msg.day_change);
            if (Number.isFinite(dc)) setPrevClose(p - dc);
          } else if (prevClose === null) {
            setPrevClose(p); // fallback: treat first price as baseline
          }

        }
      } catch {}
    };

    ws.onerror = () => setConnected(false);
    ws.onclose = () => setConnected(false);

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'unsubscribe', params: { symbols: ticker } }));
      }
      ws.close();
      wsRef.current = null;
    };
  }, [ticker]);

  const change = price !== null && prevClose !== null ? price - prevClose : null;
  const changePct = change !== null && prevClose > 0 ? (change / prevClose) * 100 : null;
  const changeColor = change > 0 ? 'text-emerald-400' : change < 0 ? 'text-red-400' : 'text-gray-400';

  const flashDirection = Number.isFinite(price) && Number.isFinite(renderPrevPriceRef.current)
    ? (price > renderPrevPriceRef.current ? 'up' : price < renderPrevPriceRef.current ? 'down' : 'flat')
    : 'flat';

  useEffect(() => {
    if (Number.isFinite(price)) {
      renderPrevPriceRef.current = price;
    }
  }, [price]);

  return (
    <div className="px-5 py-3 border-b border-white/[0.06] flex items-center gap-3">
      <span className="text-white font-bold text-sm font-mono">${ticker}</span>
      {connected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />}
      {price !== null && (
        <>
          <motion.span
            key={`${ticker}-${price}`}
            initial={{
              color: flashDirection === 'up' ? '#10b981' : flashDirection === 'down' ? '#ef4444' : '#ffffff',
              scale: 1.05,
            }}
            animate={{ color: '#ffffff', scale: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 26 }}
            className="font-mono font-semibold text-sm"
          >
            ${price.toFixed(2)}
          </motion.span>
          {change !== null && (
            <span className={`text-sm font-mono ${changeColor}`}>
              {change >= 0 ? '+' : ''}{change.toFixed(2)}
              {changePct !== null && <span className="ml-1">{changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%</span>}
            </span>
          )}
        </>
      )}
      {price === null && connected && (
        <span className="text-sm text-gray-500 font-mono">streaming...</span>
      )}
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
  const [strategies, setStrategies] = useState([]);
  const [activeStrategies, setActiveStrategies] = useState({});
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeSignalIdx, setActiveSignalIdx] = useState(0);
  const [expandedStrategy, setExpandedStrategy] = useState(null);
  const [expandedCardId, setExpandedCardId] = useState(null);
  const [settings, setSettings] = useState({
    timeframe: '1H',
    stop_loss_multiplier: 0.5,
    take_profit_multiplier: 2.5,
    risk_per_trade: 0.02,
  });

  const [smResults, setSmResults] = useState({ chochEvents: [], bosEvents: [], trendStrength: 0, confidence: 50, trendDetails: [], divergences: [], liquidityZones: [] });

  const detectorRef = useRef(null);
  const smDetectorRef = useRef(null);
  const wsRef = useRef(null);

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
            timeframe: userSettings.timeframe || '1H',
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
        const anyEnabled = Object.values(merged).some(Boolean);
        if (!anyEnabled && VERIFIED_SIGNALS.length > 0) merged[VERIFIED_SIGNALS[0].id] = true;
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

  const handleToggleStrategy = useCallback(async (strategyId) => {
    setActiveStrategies(prev => {
      const next = { ...prev, [strategyId]: !prev[strategyId] };
      supabase.auth.getUser().then(({ data: { user } }) => { if (user) saveActiveStrategy(user.id, strategyId, next[strategyId]); });
      return next;
    });
  }, []);

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

  if (loading && candles.length === 0) {
    return (
      <div className="h-full bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-gray-500 text-sm">Loading Strategy Radar...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden bg-[#0a0a0f] text-white flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/6">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold tracking-wide">Strategy Radar</h1>
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${
              !anyStrategyEnabled ? 'bg-gray-600'
              : isScanning && marketStatus.open ? 'bg-emerald-400 animate-pulse'
              : anyStrategyEnabled ? 'bg-emerald-400'
              : String(marketStatus.dotColor || 'bg-gray-600')
            }`} />
            <span className="text-sm text-gray-500">
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

        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-sm text-gray-500">
            <CountUp key={`${selectedTicker}-${activeSignalCount}`} start={0} end={activeSignalCount} duration={0.9} useEasing />
            {' '}active signals
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT — Chart */}
        <div className="flex-[3] flex flex-col border-r border-white/6">
          <div className="flex items-center justify-end px-4 py-2 border-b border-white/6">
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

          <div className="flex-1 p-2 relative">
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
            />
          </div>

          <div className="flex items-center gap-4 px-4 py-2 border-t border-white/6 text-sm flex-wrap">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: BULL_COLOR }} /><span className="text-gray-500">Bullish OB</span></span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: BEAR_COLOR }} /><span className="text-gray-500">Bearish OB</span></span>
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

        {/* RIGHT — Signals + Strategies (one connected panel) */}
        <div className="flex-[2] min-h-0 overflow-y-auto relative p-2">
          <div className={`${SOFT_GLASS_CARD_CLASS} overflow-hidden flex flex-col min-h-0`}>
            <LiveTickerHeader ticker={selectedTicker} />

            <div className="p-3 border-b border-white/[0.06]">
              <h2 className="text-sm text-gray-500 uppercase tracking-widest font-semibold mb-2">Active Signals</h2>
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

            {enabledTypes.has('smart_money') && smResults.trendDetails && smResults.trendDetails.length > 0 && (
              <div className="p-3 border-b border-white/[0.06]">
                <TrendStrengthMatrix trendStrength={smResults.trendStrength} confidence={smResults.confidence} trendDetails={smResults.trendDetails} />
              </div>
            )}

            <div className="p-3 border-b border-white/[0.06]">
              <RadarSettings settings={settings} onUpdate={handleSettingsUpdate} />
            </div>

            <div className="p-3">
              <h2 className="text-sm text-gray-500 uppercase tracking-widest font-semibold mb-2">Verified Signals</h2>
              <div className="space-y-2">
                {strategies.map(strategy => (
                  <StrategyCard key={strategy.id} strategy={strategy} enabled={activeStrategies[strategy.id] || false} onToggle={handleToggleStrategy} onViewDetails={setExpandedStrategy} isExpanded={expandedCardId === strategy.id} onExpandToggle={() => setExpandedCardId(prev => prev === strategy.id ? null : strategy.id)} />
                ))}
              </div>
            </div>
          </div>

          <AnimatePresence>
            {expandedStrategy && (
              <StrategyDetailOverlay strategy={expandedStrategy} onClose={() => setExpandedStrategy(null)} />
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
