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

  // Update candle data
  useEffect(() => {
    if (!candleSeriesRef.current || !candles.length) return;
    candleSeriesRef.current.setData(candles);

    // Build markers array
    const markers = [];

    // MSB markers — plain text labels on chart
    msbEvents.forEach(msb => {
      markers.push({
        time: msb.time,
        position: msb.direction === 'long' ? 'belowBar' : 'aboveBar',
        color: msb.direction === 'long' ? BULL_COLOR : BEAR_COLOR,
        shape: msb.direction === 'long' ? 'arrowUp' : 'arrowDown',
        text: 'MSB',
      });
    });

    // Completed/triggered signals — clean triangle entries only
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

    // Sort markers by time and apply via v5 createSeriesMarkers API
    markers.sort((a, b) => a.time - b.time);
    if (markersRef.current) {
      markersRef.current.setMarkers(markers);
    } else {
      markersRef.current = createSeriesMarkers(candleSeriesRef.current, markers);
    }

    // Active OB zone overlay — single latest non-mitigated block (clean chart)
    if (chartRef.current) {
      obOverlaySeriesRef.current.forEach((series) => {
        try {
          chartRef.current.removeSeries(series);
        } catch {
          // ignore stale series handles
        }
      });
      obOverlaySeriesRef.current = [];

      const latestActiveOb = [...orderBlocks]
        .filter((ob) => !ob?.mitigated)
        .sort((a, b) => Number(b?.msbBar ?? 0) - Number(a?.msbBar ?? 0))[0];

      if (latestActiveOb) {
        const obTop = Number(latestActiveOb?.top);
        const obBottom = Number(latestActiveOb?.bottom);
        const obStart = Number(latestActiveOb?.time);
        const chartNow = Number(candles[candles.length - 1]?.time ?? obStart);

        if (
          Number.isFinite(obTop) &&
          Number.isFinite(obBottom) &&
          Number.isFinite(obStart) &&
          Number.isFinite(chartNow)
        ) {
          const startTime = Math.min(obStart, chartNow);
          const endTime = Math.max(obStart, chartNow);
          const bullish = String(latestActiveOb?.direction || '').toLowerCase() === 'long';
          const zoneFill = bullish ? 'rgba(29,233,182,0.08)' : 'rgba(242,54,69,0.08)';
          const boundaryColor = bullish ? 'rgba(29,233,182,0.45)' : 'rgba(242,54,69,0.45)';

          // Shaded entry zone using baseline series between bottom (base) and top value
          const zoneSeries = addBaselineSeriesCompat(chartRef.current, {
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
          zoneSeries.setData([
            { time: startTime, value: obTop },
            { time: endTime, value: obTop },
          ]);
          obOverlaySeriesRef.current.push(zoneSeries);

          // Top boundary
          const topBoundarySeries = addLineSeriesCompat(chartRef.current, {
            color: boundaryColor,
            lineWidth: 1,
            lineStyle: 0,
            lastValueVisible: false,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
          });
          topBoundarySeries.setData([
            { time: startTime, value: obTop },
            { time: endTime, value: obTop },
          ]);
          obOverlaySeriesRef.current.push(topBoundarySeries);

          // Bottom boundary
          const bottomBoundarySeries = addLineSeriesCompat(chartRef.current, {
            color: boundaryColor,
            lineWidth: 1,
            lineStyle: 0,
            lastValueVisible: false,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
          });
          bottomBoundarySeries.setData([
            { time: startTime, value: obBottom },
            { time: endTime, value: obBottom },
          ]);
          obOverlaySeriesRef.current.push(bottomBoundarySeries);
        }
      }
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
// SIGNAL CARD — Individual detected signal
// ══════════════════════════════════════════════════════════════════════════════

function SignalCard({ signal, isNew }) {
  const [expanded, setExpanded] = useState(false);
  const dirColor = signal.direction === 'long' ? BULL_COLOR : BEAR_COLOR;
  const hpzColor = signal.direction === 'long' ? HPZ_BULL : HPZ_BEAR;
  const displayColor = signal.is_hpz ? hpzColor : dirColor;

  return (
    <motion.div
      initial={isNew ? { opacity: 0, y: -20 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onClick={() => setExpanded(!expanded)}
      className="border border-white/6 rounded-lg p-4 hover:bg-white/[0.02] transition-colors cursor-pointer"
    >
      {/* Top Row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="text-white font-semibold text-sm">${signal.ticker}</span>
          <span className="text-xs font-medium" style={{ color: displayColor }}>
            {signal.direction.toUpperCase()}
          </span>
          {signal.is_hpz && (
            <span className="text-xs font-medium" style={{ color: hpzColor }}>
              HPZ
            </span>
          )}
        </div>
        <span className="text-xs text-gray-600">{signal.timeframe}</span>
      </div>

      {/* Quality Score Bar */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${signal.quality_score}%`,
              backgroundColor: signal.quality_score > 80 ? hpzColor : signal.quality_score > 60 ? BULL_COLOR : '#eab308',
            }}
          />
        </div>
        <span className="text-xs font-mono" style={{ color: displayColor }}>
          {signal.quality_score}%
        </span>
      </div>

      {/* Price Levels */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">
          Entry <span className="text-gray-300 font-mono">${signal.entry_price.toFixed(2)}</span>
        </span>
        <span className="text-gray-500">
          SL <span className="text-red-400 font-mono">${signal.stop_loss.toFixed(2)}</span>
        </span>
        <span className="text-gray-500">
          TP <span className="font-mono" style={{ color: BULL_COLOR }}>${signal.take_profit.toFixed(2)}</span>
        </span>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-white/5 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">OB Zone</span>
                <span className="text-gray-300 font-mono">${signal.ob_bottom.toFixed(2)} - ${signal.ob_top.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">MSB Level</span>
                <span className="text-gray-300 font-mono">${signal.msb_level.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Momentum Z</span>
                <span className="text-gray-300 font-mono">{signal.momentum_z}</span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed mt-2">
                {signal.direction === 'long'
                  ? 'Bullish MSB detected. Price broke above pivot high with momentum confirmation. Order block demand zone identified below — waiting for pullback entry.'
                  : 'Bearish MSB detected. Price broke below pivot low with momentum confirmation. Order block supply zone identified above — waiting for pullback entry.'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm Trade */}
      <button
        onClick={(e) => e.stopPropagation()}
        className="w-full mt-3 py-2 text-xs font-medium text-emerald-400 border border-emerald-400/20 rounded-lg hover:bg-emerald-400/5 transition-colors"
      >
        Confirm Trade
      </button>
    </motion.div>
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
  return (
    <div className="border border-white/6 rounded-lg p-4 space-y-4">
      <h3 className="text-xs text-gray-500 uppercase tracking-widest font-medium">Settings</h3>

      {/* Stop Loss */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-gray-500">Stop Loss</label>
          <span className="text-xs text-gray-300 font-mono">{settings.stop_loss_multiplier}x</span>
        </div>
        <input
          type="range"
          min="0.1"
          max="2.0"
          step="0.1"
          value={settings.stop_loss_multiplier}
          onChange={e => onUpdate({ stop_loss_multiplier: parseFloat(e.target.value) })}
          className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
        />
        <div className="flex justify-between text-[10px] text-gray-600 mt-1">
          <span>0.1x</span>
          <span>2.0x</span>
        </div>
      </div>

      {/* Take Profit */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-gray-500">Take Profit</label>
          <span className="text-xs text-gray-300 font-mono">{settings.take_profit_multiplier}x</span>
        </div>
        <input
          type="range"
          min="1.0"
          max="5.0"
          step="0.5"
          value={settings.take_profit_multiplier}
          onChange={e => onUpdate({ take_profit_multiplier: parseFloat(e.target.value) })}
          className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
        />
        <div className="flex justify-between text-[10px] text-gray-600 mt-1">
          <span>1.0x</span>
          <span>5.0x</span>
        </div>
      </div>

      {/* Risk Per Trade */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-gray-500">Risk Per Trade</label>
          <span className="text-xs text-gray-300 font-mono">{(settings.risk_per_trade * 100).toFixed(1)}%</span>
        </div>
        <input
          type="range"
          min="0.5"
          max="5.0"
          step="0.5"
          value={settings.risk_per_trade * 100}
          onChange={e => onUpdate({ risk_per_trade: parseFloat(e.target.value) / 100 })}
          className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
        />
        <div className="flex justify-between text-[10px] text-gray-600 mt-1">
          <span>0.5%</span>
          <span>5.0%</span>
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
                <div className="flex items-center gap-1 mb-3">
                  {currentTickerSignals.slice(0, 10).map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveSignalIdx(i)}
                      className={`w-7 h-7 text-xs font-mono transition-colors ${
                        activeSignalIdx === i
                          ? 'text-white'
                          : 'text-gray-600 hover:text-gray-400'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                {currentTickerSignals[activeSignalIdx] && (
                  <SignalCard
                    signal={currentTickerSignals[activeSignalIdx]}
                    isNew={activeSignalIdx === 0}
                  />
                )}
              </>
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-600 text-xs">No active signals for ${selectedTicker}</div>
                <div className="text-gray-700 text-[10px] mt-1">Radar is scanning...</div>
              </div>
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
