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
import { motion, AnimatePresence } from 'framer-motion';

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

const DEFAULT_TICKERS = ['TSLA', 'NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'SPY', 'QQQ', 'BTC/USD', 'ETH/USD', 'SOL/USD'];

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
  const ts = typeof timestamp === 'string' ? Math.floor(new Date(timestamp).getTime() / 1000) : Number(timestamp);
  const seconds = Math.floor(Date.now() / 1000 - ts);
  if (seconds < 60) return `${Math.max(0, seconds)}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function QualityGauge({ score }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 90 ? '#00C2FF' : score >= 80 ? '#1de9b6' : score >= 60 ? '#089981' : '#eab308';

  return (
    <div className="relative w-[100px] h-[100px] flex-shrink-0">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <motion.circle
          cx="50" cy="50" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold font-mono" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

function RadarSweep() {
  return (
    <div className="flex flex-col items-center py-8">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 128 128" className="w-full h-full">
          <circle cx="64" cy="64" r="58" fill="none" stroke="#00C2FF" strokeWidth="0.5" opacity="0.2" />
          <circle cx="64" cy="64" r="38" fill="none" stroke="#00C2FF" strokeWidth="0.5" opacity="0.15" />
          <circle cx="64" cy="64" r="18" fill="none" stroke="#00C2FF" strokeWidth="0.5" opacity="0.1" />
          <line x1="64" y1="4" x2="64" y2="124" stroke="#00C2FF" strokeWidth="0.5" opacity="0.1" />
          <line x1="4" y1="64" x2="124" y2="64" stroke="#00C2FF" strokeWidth="0.5" opacity="0.1" />
        </svg>
        <motion.div
          className="absolute inset-0"
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        >
          <div
            className="absolute top-1/2 left-1/2 h-[1px] origin-left"
            style={{
              width: '58px',
              background: 'linear-gradient(to right, rgba(0,194,255,0.8), transparent)',
            }}
          />
        </motion.div>
        <div
          className="absolute top-1/2 left-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#00C2FF]"
          style={{ boxShadow: '0 0 8px #00C2FF' }}
        />
      </div>
      <p className="text-xs text-gray-600 mt-4">Scanning for setups...</p>
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

function RadarChart({ candles, orderBlocks, msbEvents, signals }) {
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
      obOverlaySeriesRef.current.forEach((series) => {
        try {
          chart.removeSeries(series);
        } catch {
          // ignore stale handles on teardown
        }
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
  }, [candles, orderBlocks, msbEvents, signals]);

  return (
    <div ref={chartContainerRef} className="w-full h-full" />
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SIGNAL CARD — Redesigned with quality gauge, price ladder, always-visible details
// ══════════════════════════════════════════════════════════════════════════════

function SignalCard({ signal }) {
  const dirColor = signal.direction === 'long' ? BULL_COLOR : BEAR_COLOR;
  const hpzColor = signal.direction === 'long' ? HPZ_BULL : HPZ_BEAR;
  const displayColor = signal.is_hpz ? hpzColor : dirColor;
  const rr = Math.abs(signal.entry_price - signal.stop_loss) > 0
    ? (Math.abs(signal.take_profit - signal.entry_price) / Math.abs(signal.entry_price - signal.stop_loss)).toFixed(1)
    : '—';

  return (
    <div className="border border-white/6 rounded-xl p-5 bg-white/[0.02]">
      {/* Header: Gauge + Ticker Info */}
      <div className="flex items-start gap-4">
        <QualityGauge score={signal.quality_score} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-lg font-bold text-white font-mono">{signal.ticker}</span>
            <span
              className="text-sm font-bold uppercase"
              style={{
                color: displayColor,
                textShadow: `0 0 10px ${displayColor}40`,
              }}
            >
              {signal.direction === 'long' ? '▲ LONG' : '▼ SHORT'}
            </span>
            {signal.is_hpz && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                style={{ color: hpzColor, backgroundColor: `${hpzColor}15` }}
              >
                HPZ
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="font-mono">{signal.timeframe}</span>
            <span>·</span>
            <span>{timeAgo(signal.detected_at || signal.time)}</span>
          </div>
        </div>
      </div>

      {/* Visual Price Ladder */}
      <div className="mt-4 py-3 space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-500 w-8 text-right">TP</span>
          <div className="flex-1 border-t border-dashed" style={{ borderColor: BULL_COLOR }} />
          <span className="text-xs font-mono font-medium" style={{ color: BULL_COLOR }}>${signal.take_profit.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-white/60 w-8 text-right font-medium">Entry</span>
          <div className="flex-1 border-t-2 border-white/70" />
          <span className="text-xs font-mono font-medium text-white">${signal.entry_price.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-500 w-8 text-right">SL</span>
          <div className="flex-1 border-t border-dashed border-red-400" />
          <span className="text-xs font-mono font-medium text-red-400">${signal.stop_loss.toFixed(2)}</span>
        </div>
        <div className="flex justify-end">
          <span className="text-[10px] font-mono font-bold" style={{ color: '#00C2FF' }}>R:R {rr}</span>
        </div>
      </div>

      {/* Always-visible Details */}
      <div className="border-t border-white/5 pt-3 space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">OB Zone</span>
          <span className="text-gray-300 font-mono">${signal.ob_bottom.toFixed(2)} – ${signal.ob_top.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">MSB Level</span>
          <span className="text-gray-300 font-mono">${signal.msb_level.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Momentum Z</span>
          <span className="text-gray-300 font-mono">{signal.momentum_z}</span>
        </div>
      </div>

      {/* Premium Confirm Trade */}
      <button
        onClick={(e) => e.stopPropagation()}
        className="w-full mt-4 py-2.5 text-xs font-semibold text-white rounded-lg transition-all hover:brightness-110"
        style={{
          background: `linear-gradient(135deg, ${displayColor}, ${displayColor}90)`,
          boxShadow: `0 0 20px ${displayColor}30`,
        }}
      >
        Confirm Trade
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// STRATEGY CARD — Verified strategy with toggle
// ══════════════════════════════════════════════════════════════════════════════

function StrategyCard({ strategy, enabled, onToggle }) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="border border-white/6 rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-white">{strategy.name}</h3>
          <p className="text-sm text-gray-500 mt-0.5">{strategy.subtitle}</p>
        </div>
        {/* Toggle switch */}
        <button
          onClick={() => onToggle(strategy.id)}
          className={`relative w-10 h-5 rounded-full transition-colors ${enabled ? 'bg-emerald-500/30' : 'bg-white/10'}`}
        >
          <div
            className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
              enabled ? 'left-5 bg-emerald-400' : 'left-0.5 bg-gray-500'
            }`}
          />
        </button>
      </div>

      {/* Backtest Proof Stats */}
      {strategy.backtest_win_rate && (
        <div className="flex items-center gap-4 mt-3 text-xs">
          <span className="text-gray-500">
            Win Rate <span style={{ color: BULL_COLOR }} className="font-mono">{strategy.backtest_win_rate}%</span>
          </span>
          <span className="text-gray-500">
            Return <span style={{ color: BULL_COLOR }} className="font-mono">+{strategy.backtest_return}%</span>
          </span>
          <span className="text-gray-500">
            PF <span className="text-gray-300 font-mono">{strategy.backtest_profit_factor}</span>
          </span>
        </div>
      )}

      <button
        onClick={() => setShowDetails(!showDetails)}
        className="text-sm text-gray-400 hover:text-gray-300 transition-colors mt-3"
      >
        {showDetails ? 'Hide details' : 'View details'}
      </button>

      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-white/5 space-y-5">
              <p className="text-sm text-gray-300 leading-relaxed">{strategy.description}</p>
              {strategy.entry_logic && (
                <div>
                  <span className="text-base text-white font-medium">Entry</span>
                  <p className="mt-1 text-sm text-gray-400 leading-relaxed">{strategy.entry_logic}</p>
                </div>
              )}
              {strategy.exit_logic && (
                <div>
                  <span className="text-base text-white font-medium">Exit</span>
                  <p className="mt-1 text-sm text-gray-400 leading-relaxed">{strategy.exit_logic}</p>
                </div>
              )}
              {strategy.risk_management && (
                <div>
                  <span className="text-base text-white font-medium">Risk</span>
                  <p className="mt-1 text-sm text-gray-400 leading-relaxed">{strategy.risk_management}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
    ? { label: 'Conservative', color: '#089981' }
    : riskScore < 0.66
      ? { label: 'Moderate', color: '#eab308' }
      : { label: 'Aggressive', color: '#f23645' };

  const slColor = slPct < 0.3 ? '#089981' : slPct < 0.7 ? '#eab308' : '#f23645';
  const tpColor = tpFillPct < 0.3 ? '#f23645' : tpFillPct < 0.7 ? '#eab308' : '#089981';
  const riskColor = riskPct < 0.3 ? '#089981' : riskPct < 0.7 ? '#eab308' : '#f23645';

  return (
    <div className="border border-white/6 rounded-xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs text-gray-500 uppercase tracking-widest font-medium">Settings</h3>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{
            color: riskProfile.color,
            backgroundColor: `${riskProfile.color}15`,
            border: `1px solid ${riskProfile.color}30`,
          }}
        >
          {riskProfile.label}
        </span>
      </div>

      {/* Stop Loss */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <label className="text-xs text-gray-400 flex-1">Stop Loss</label>
          <span className="text-xs font-mono font-semibold" style={{ color: slColor }}>{settings.stop_loss_multiplier}x</span>
        </div>
        <div className="relative h-6 flex items-center">
          <div className="absolute w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${slPct * 100}%`, backgroundColor: slColor }} />
          </div>
          <input
            type="range" min="0.1" max="2.0" step="0.1"
            value={settings.stop_loss_multiplier}
            onChange={e => onUpdate({ stop_loss_multiplier: parseFloat(e.target.value) })}
            className="relative w-full appearance-none bg-transparent cursor-pointer z-10
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2
              [&::-webkit-slider-thumb]:border-gray-600 [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:transition-transform [&:hover::-webkit-slider-thumb]:scale-110"
          />
        </div>
      </div>

      {/* Take Profit */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
          </svg>
          <label className="text-xs text-gray-400 flex-1">Take Profit</label>
          <span className="text-xs font-mono font-semibold" style={{ color: tpColor }}>{settings.take_profit_multiplier}x</span>
        </div>
        <div className="relative h-6 flex items-center">
          <div className="absolute w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${tpFillPct * 100}%`, backgroundColor: tpColor }} />
          </div>
          <input
            type="range" min="1.0" max="5.0" step="0.5"
            value={settings.take_profit_multiplier}
            onChange={e => onUpdate({ take_profit_multiplier: parseFloat(e.target.value) })}
            className="relative w-full appearance-none bg-transparent cursor-pointer z-10
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2
              [&::-webkit-slider-thumb]:border-gray-600 [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:transition-transform [&:hover::-webkit-slider-thumb]:scale-110"
          />
        </div>
      </div>

      {/* Risk Per Trade */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <svg viewBox="0 0 24 24" className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" />
          </svg>
          <label className="text-xs text-gray-400 flex-1">Risk Per Trade</label>
          <span className="text-xs font-mono font-semibold" style={{ color: riskColor }}>{(settings.risk_per_trade * 100).toFixed(1)}%</span>
        </div>
        <div className="relative h-6 flex items-center">
          <div className="absolute w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${riskPct * 100}%`, backgroundColor: riskColor }} />
          </div>
          <input
            type="range" min="0.5" max="5.0" step="0.5"
            value={settings.risk_per_trade * 100}
            onChange={e => onUpdate({ risk_per_trade: parseFloat(e.target.value) / 100 })}
            className="relative w-full appearance-none bg-transparent cursor-pointer z-10
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2
              [&::-webkit-slider-thumb]:border-gray-600 [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:transition-transform [&:hover::-webkit-slider-thumb]:scale-110"
          />
        </div>
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
  const [settings, setSettings] = useState({
    timeframe: '1H',
    stop_loss_multiplier: 0.5,
    take_profit_multiplier: 2.5,
    risk_per_trade: 0.02,
  });

  const detectorRef = useRef(null);
  const wsRef = useRef(null);

  // Load user settings and strategies on mount
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
      }

      const strats = await getVerifiedStrategies();
      setStrategies(strats);

      // Default enable all strategies
      const active = {};
      strats.forEach(s => { active[s.id] = true; });
      setActiveStrategies(active);

      setLoading(false);
    }
    init();
  }, []);

  // Fetch candles and run detection when ticker or timeframe changes
  useEffect(() => {
    async function loadAndDetect() {
      setLoading(true);
      setIsScanning(true);

      const candleData = await fetchCandles(selectedTicker, settings.timeframe);
      setCandles(candleData);

      if (candleData.length > 0) {
        const detector = createLiveDetector({
          stop_loss_multiplier: settings.stop_loss_multiplier,
          take_profit_multiplier: settings.take_profit_multiplier,
        });
        const results = detector.setCandles(candleData);
        detectorRef.current = detector;

        // Tag signals with ticker and timeframe
        const taggedSignals = results.signals.map(s => ({
          ...s,
          ticker: selectedTicker,
          timeframe: settings.timeframe,
        }));

        setOrderBlocks(results.orderBlocks);
        setMsbEvents(results.msbEvents);
        setPivots(results.pivots);

        // Merge with existing signals (no duplicates)
        setSignals(prev => {
          const existing = new Set(prev.map(s => `${s.ticker}-${s.detected_at}`));
          const newSignals = taggedSignals.filter(s => !existing.has(`${s.ticker}-${s.detected_at}`));
          return [...newSignals, ...prev].slice(0, 100);
        });
      }

      setIsScanning(false);
      setLoading(false);

      // Connect WebSocket for live updates
      connectWebSocket(selectedTicker, settings.timeframe);
    }

    loadAndDetect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [selectedTicker, settings.timeframe, settings.stop_loss_multiplier, settings.take_profit_multiplier]);

  // WebSocket connection to Twelve Data
  function connectWebSocket(ticker, timeframe) {
    if (wsRef.current) wsRef.current.close();

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

          if (detectorRef.current && price > 0) {
            // Build candle update from price tick
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

              // Check for new signals
              const taggedSignals = results.signals.map(s => ({
                ...s,
                ticker: selectedTicker,
                timeframe: settings.timeframe,
              }));

              setSignals(prev => {
                const existing = new Set(prev.map(s => `${s.ticker}-${s.detected_at}`));
                const newSignals = taggedSignals.filter(s => !existing.has(`${s.ticker}-${s.detected_at}`));
                return [...newSignals, ...prev].slice(0, 100);
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

  // Toggle strategy
  const handleToggleStrategy = useCallback((strategyId) => {
    setActiveStrategies(prev => ({
      ...prev,
      [strategyId]: !prev[strategyId],
    }));
  }, []);

  // Filter signals for current ticker
  const currentTickerSignals = useMemo(() =>
    signals.filter(s => s.ticker === selectedTicker),
    [signals, selectedTicker]
  );

  const activeSignalCount = useMemo(() =>
    signals.filter(s => s.status === 'active').length,
    [signals]
  );

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
            <span className={`w-1.5 h-1.5 rounded-full ${isScanning ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
            <span className="text-xs text-gray-500">
              {isScanning ? 'Scanning' : 'Idle'}
            </span>
          </div>
        </div>

        {/* Ticker selector */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {DEFAULT_TICKERS.slice(0, 8).map(t => (
            <button
              key={t}
              onClick={() => { setSelectedTicker(t); setActiveSignalIdx(0); }}
              className={`px-2 py-1 text-xs font-mono transition-colors whitespace-nowrap ${
                selectedTicker === t
                  ? 'text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              ${t}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
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
              <span className="text-xs text-gray-500">MSB + Order Block</span>
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
          <div className="flex-1 p-2">
            <RadarChart
              candles={candles}
              orderBlocks={orderBlocks}
              msbEvents={msbEvents}
              signals={currentTickerSignals}
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
          </div>
        </div>

        {/* RIGHT — Signals + Strategies (40%) */}
        <div className="flex-[2] min-h-0 overflow-y-auto">
          {/* Active Signals */}
          <div className="p-4 border-b border-white/6">
            <h2 className="text-xs text-gray-500 uppercase tracking-widest font-medium mb-3">
              Active Signals
            </h2>
            {currentTickerSignals.length > 0 ? (
              <>
                {/* Signal Navigation Strip */}
                <div className="flex gap-1 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
                  {currentTickerSignals.slice(0, 10).map((sig, i) => {
                    const isActive = activeSignalIdx === i;
                    const tabDirColor = sig.direction === 'long' ? BULL_COLOR : BEAR_COLOR;
                    return (
                      <button
                        key={i}
                        onClick={() => setActiveSignalIdx(i)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs whitespace-nowrap transition-all border-l-2 flex-shrink-0 ${
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

                {/* Signal Card with slide animation */}
                <AnimatePresence mode="wait">
                  {currentTickerSignals[activeSignalIdx] && (
                    <motion.div
                      key={activeSignalIdx}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.15 }}
                    >
                      <SignalCard signal={currentTickerSignals[activeSignalIdx]} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <RadarSweep />
            )}
          </div>

          {/* Settings */}
          <div className="p-4 border-b border-white/6">
            <RadarSettings settings={settings} onUpdate={handleSettingsUpdate} />
          </div>

          {/* Verified Strategies */}
          <div className="p-4">
            <div className="mb-3">
              <h2 className="text-xs text-gray-500 uppercase tracking-widest font-medium">
                Verified Strategies
              </h2>
              <p className="text-[10px] text-gray-700 mt-0.5">Backtested. Scored. Institutional-Grade.</p>
            </div>
            <div className="space-y-2">
              {strategies.map(strategy => (
                <StrategyCard
                  key={strategy.id}
                  strategy={strategy}
                  enabled={activeStrategies[strategy.id] || false}
                  onToggle={handleToggleStrategy}
                />
              ))}
            </div>
          </div>
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
