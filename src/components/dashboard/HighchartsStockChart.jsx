import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import IndicatorsAll from 'highcharts/indicators/indicators-all';
import AnnotationsAdvanced from 'highcharts/modules/annotations-advanced';
import StockTools from 'highcharts/modules/stock-tools';

// Initialize modules safely
const initModule = (mod) => {
  try {
    const fn = mod?.default || mod;
    if (typeof fn === 'function') fn(Highcharts);
  } catch (e) {
    console.warn('Highcharts module init failed:', e);
  }
};
initModule(IndicatorsAll);
initModule(AnnotationsAdvanced);
initModule(StockTools);

// ─── Twelve Data Config ───
const TD_API_KEY = import.meta.env.VITE_TWELVE_DATA_API_KEY || import.meta.env.VITE_TWELVEDATA_API_KEY || '';
const TD_REST_BASE = 'https://api.twelvedata.com';
const TD_WS_URL = 'wss://ws.twelvedata.com/v1/quotes/price';

const toTimestampMs = (value) => {
  if (value == null) return null;

  if (typeof value === 'number') {
    return value > 10_000_000_000 ? value : value * 1000;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  let ts = Date.parse(normalized);
  if (!Number.isFinite(ts)) {
    ts = Date.parse(`${normalized}Z`);
  }
  return Number.isFinite(ts) ? ts : null;
};

// ─── Default Watchlist ───
const DEFAULT_WATCHLIST = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',
  'SPY', 'QQQ', 'DIA',
  'BTC/USD', 'ETH/USD', 'SOL/USD', 'XRP/USD', 'DOGE/USD',
];

// ─── Interval Mapping ───
const BOTTOM_INTERVALS_PRIMARY = [
  { label: '1m', value: '1min' },
  { label: '5m', value: '5min' },
  { label: '30m', value: '30min' },
  { label: '1h', value: '1h' },
  { label: 'D', value: '1day' },
  { label: 'W', value: '1week' },
  { label: 'M', value: '1month' },
];

const BOTTOM_INTERVALS_MORE = [
  { label: '15m', value: '15min' },
  { label: '4h', value: '4h' },
];

const RANGE_PRESETS_PRIMARY = [
  { label: '1D', value: '1D' },
  { label: '5D', value: '5D' },
  { label: '1M', value: '1M' },
];

const RANGE_PRESETS_MORE = [
  { label: '3M', value: '3M' },
  { label: '6M', value: '6M' },
  { label: '1Y', value: '1Y' },
  { label: 'ALL', value: 'ALL' },
];

const RIGHT_OFFSET_BARS = 20;
const INTERVAL_TO_MS = {
  '1min': 60_000,
  '5min': 300_000,
  '15min': 900_000,
  '30min': 1_800_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1day': 86_400_000,
  '1week': 604_800_000,
  '1month': 2_592_000_000,
};

const getIntervalMs = (value) => INTERVAL_TO_MS[String(value || '').trim()] || INTERVAL_TO_MS['1day'];

const CHART_TYPES = [
  { label: 'Candles', value: 'candlestick' },
  { label: 'OHLC', value: 'ohlc' },
  { label: 'Line', value: 'line' },
  { label: 'Area', value: 'area' },
];

const SIZE_PRESETS = [
  { label: 'S', value: 'small', height: '380px' },
  { label: 'M', value: 'medium', height: '480px' },
  { label: 'L', value: 'large', height: '560px' },
  { label: 'Fill', value: 'fill', height: '100%' },
];

// ─── Color Presets for Candles ───
const CANDLE_THEMES = [
  { label: 'Classic', up: '#22c55e', down: '#ef4444' },
  { label: 'Cyan / Magenta', up: '#06b6d4', down: '#ec4899' },
  { label: 'Blue / Orange', up: '#3b82f6', down: '#f97316' },
  { label: 'White / Red', up: '#e5e7eb', down: '#ef4444' },
  { label: 'Lime / Pink', up: '#84cc16', down: '#f43f5e' },
  { label: 'Gold / Purple', up: '#eab308', down: '#a855f7' },
];

// ─── Indicator Options ───
const INDICATOR_OPTIONS = [
  { label: 'SMA 20', id: 'sma20', type: 'sma', params: { period: 20 }, color: '#3b82f6' },
  { label: 'SMA 50', id: 'sma50', type: 'sma', params: { period: 50 }, color: '#f97316' },
  { label: 'SMA 200', id: 'sma200', type: 'sma', params: { period: 200 }, color: '#a855f7' },
  { label: 'EMA 12', id: 'ema12', type: 'ema', params: { period: 12 }, color: '#a78bfa' },
  { label: 'EMA 26', id: 'ema26', type: 'ema', params: { period: 26 }, color: '#f472b6' },
  { label: 'Bollinger Bands', id: 'bb', type: 'bb', params: { period: 20, standardDeviation: 2 }, color: '#6ee7b7' },
  { label: 'VWAP', id: 'vwap', type: 'vwap', params: {}, color: '#fbbf24' },
  { label: 'MACD', id: 'macd', type: 'macd', params: { shortPeriod: 12, longPeriod: 26, signalPeriod: 9 }, color: '#10b981' },
];

const TOP_INDICATOR_CHIPS = ['sma20', 'sma50', 'bb', 'vwap', 'macd'];

// ─── Drawing Tools ───
const DRAWING_TOOLS = [
  { label: 'Trend Line', icon: '⟋', type: 'crookedLine' },
  { label: 'Horiz Line', icon: '─', type: 'infinityLine' },
  { label: 'Vert Line', icon: '│', type: 'verticalLine' },
  { label: 'Parallel Ch.', icon: '═', type: 'parallelChannel' },
  { label: 'Ray / Speed', icon: '⟶', type: 'ray' },
  { label: 'Fib Retrace', icon: 'Fib', type: 'fibonacci' },
  { label: 'Rectangle', icon: '▭', type: 'rectangleAnnotation' },
  { label: 'Clear All', icon: '✕', type: 'clearAll' },
];

// ─── Fetch Historical Data ───
async function fetchHistoricalData(symbol, interval = '1day', outputsize = 500, apiKey = '') {
  const directUrl = `${TD_REST_BASE}/time_series?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&outputsize=${encodeURIComponent(outputsize)}&apikey=${encodeURIComponent(apiKey)}&format=JSON&order=ASC`;
  const fallbackUrl = `/api/lse/timeseries?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&outputsize=${encodeURIComponent(outputsize)}`;
  const res = await fetch(apiKey ? directUrl : fallbackUrl, { cache: 'no-store' });
  const data = await res.json();

  if (!res.ok || data?.status === 'error' || data?.error) {
    console.error('Twelve Data error:', data?.message || data?.error || `request failed (${res.status})`);
    return { ohlc: [], volume: [] };
  }

  const ohlc = [];
  const volume = [];

  if (data.values && Array.isArray(data.values)) {
    data.values.forEach((bar) => {
      const ts = toTimestampMs(bar.datetime || bar.timestamp || bar.time);
      const o = parseFloat(bar.open);
      const h = parseFloat(bar.high);
      const l = parseFloat(bar.low);
      const c = parseFloat(bar.close);
      const v = parseInt(bar.volume, 10) || 0;

      if (!Number.isFinite(ts) || !Number.isFinite(o) || !Number.isFinite(h) || !Number.isFinite(l) || !Number.isFinite(c)) {
        return;
      }

      const maxPrice = Math.max(o, h, l, c);
      const minPrice = Math.min(o, h, l, c);
      if (!Number.isFinite(maxPrice) || !Number.isFinite(minPrice) || minPrice <= 0) return;

      // Drop obviously broken bars that can crush axis scaling and hide candles.
      if (maxPrice / minPrice > 20) return;

      ohlc.push([ts, o, h, l, c]);
      volume.push({ x: ts, y: v, _o: o, _c: c });
    });
  }

  ohlc.sort((a, b) => a[0] - b[0]);
  volume.sort((a, b) => a.x - b.x);

  return { ohlc, volume };
}

// ─── Helpers ───
function fmtPrice(v) {
  if (v == null || isNaN(v)) return '—';
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
}

function fmtVol(v) {
  if (v == null || isNaN(v)) return '—';
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toString();
}

// ═══════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════
export default function HighchartsStockChart({
  symbol: propSymbol = 'AAPL',
  onSymbolChange,
  watchlist = DEFAULT_WATCHLIST,
  defaultSize = 'fill',
}) {
  const chartRef = useRef(null);
  const wsRef = useRef(null);
  const containerRef = useRef(null);
  const dragStateRef = useRef(null);

  const [symbol, setSymbol] = useState(propSymbol);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [interval, setIv] = useState('1day');
  const [chartType, setChartType] = useState('candlestick');
  const [activeInd, setActiveInd] = useState([]);
  const [theme, setTheme] = useState(CANDLE_THEMES[0]);
  const [chartSize, setChartSize] = useState(defaultSize);
  const [isFs, setIsFs] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [seriesSeed, setSeriesSeed] = useState({ ohlc: [], volume: [] });
  const rightOffsetMs = useMemo(() => getIntervalMs(interval) * RIGHT_OFFSET_BARS, [interval]);

  // Dropdowns
  const [showSym, setShowSym] = useState(false);
  const [showInd, setShowInd] = useState(false);
  const [showDraw, setShowDraw] = useState(false);
  const [showColor, setShowColor] = useState(false);
  const [showSize, setShowSize] = useState(false);
  const [showRangeMore, setShowRangeMore] = useState(false);
  const [showIntervalMore, setShowIntervalMore] = useState(false);
  const [symSearch, setSymSearch] = useState('');
  const [activeRange, setActiveRange] = useState('1M');

  // OHLCV strip
  const [hover, setHover] = useState({ o: null, h: null, l: null, c: null, v: null, chg: null, pct: null });

  // Sync prop
  useEffect(() => { if (propSymbol && propSymbol !== symbol) setSymbol(propSymbol); }, [propSymbol]);

  // Close dropdowns
  useEffect(() => {
    const fn = (e) => {
      if (!e.target.closest('[data-dd]')) {
        setShowSym(false);
        setShowInd(false);
        setShowDraw(false);
        setShowColor(false);
        setShowSize(false);
        setShowRangeMore(false);
        setShowIntervalMore(false);
      }
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  // ─── Build Options ───
  const buildOpts = useCallback((ohlc, vol) => {
    const up = theme.up;
    const dn = theme.down;
    const cVol = vol.map((v) => ({ x: v.x, y: v.y, color: v._c >= v._o ? up + '44' : dn + '44', borderColor: v._c >= v._o ? up + '77' : dn + '77' }));
    const last = ohlc[ohlc.length - 1];
    const isUp = last ? last[4] >= last[1] : true;

    const series = [
      {
        type: chartType === 'line' ? 'line' : chartType === 'area' ? 'area' : chartType === 'ohlc' ? 'ohlc' : 'candlestick',
        id: 'price', name: symbol, data: ohlc, yAxis: 0, zIndex: 5,
        lastPrice: {
          enabled: true, color: isUp ? up : dn, dashStyle: 'Dash',
          label: { enabled: true, backgroundColor: isUp ? up : dn, style: { color: '#fff', fontWeight: '600', fontSize: '10px' }, padding: 3, borderRadius: 3 },
        },
      },
      { type: 'column', id: 'volume', name: 'Volume', data: cVol, yAxis: 1, zIndex: 1, colorByPoint: true, borderWidth: 0, borderRadius: 0 },
    ];

    activeInd.forEach((id) => {
      const ind = INDICATOR_OPTIONS.find((i) => i.id === id);
      if (!ind) return;
      series.push({ type: ind.type, id: ind.id, linkedTo: 'price', color: ind.color, params: ind.params, yAxis: 0, zIndex: 4, lineWidth: 1.2, enableMouseTracking: false, marker: { enabled: false } });
    });

    return {
      chart: {
        backgroundColor: '#000',
        style: { fontFamily: "'SF Pro Display', -apple-system, sans-serif" },
        height: '100%',
        animation: false,
        spacing: [0, 0, 0, 0],
        panning: { enabled: false, type: 'xy' },
        panKey: null,
        zooming: {
          type: 'xy',
          mouseWheel: { enabled: true, sensitivity: 1.2 },
          pinchType: 'xy',
        },
      },
      credits: { enabled: false }, title: { text: '' },
      stockTools: { gui: { enabled: false } },
      navigator: { enabled: true, height: 28, outlineColor: '#1a2332', maskFill: 'rgba(59,130,246,0.06)', series: { color: '#3b82f6', lineWidth: 1 }, xAxis: { gridLineWidth: 0, labels: { style: { color: '#4a5568', fontSize: '9px' } } }, handles: { backgroundColor: '#1f2937', borderColor: '#4a5568' } },
      scrollbar: { enabled: true, barBackgroundColor: '#475569', barBorderColor: '#475569', barBorderRadius: 4, buttonArrowColor: '#e2e8f0', buttonBackgroundColor: '#1f2937', buttonBorderColor: '#475569', rifleColor: '#e2e8f0', trackBackgroundColor: '#0b1220', trackBorderColor: '#334155', trackBorderRadius: 4, height: 14, margin: 6, liveRedraw: false },
      rangeSelector: { enabled: false },
      xAxis: {
        gridLineWidth: 0,
        lineColor: '#1a2332',
        tickColor: '#1a2332',
        crosshair: false,
        labels: { style: { color: '#4a5568', fontSize: '10px' } },
        minPadding: 0,
        maxPadding: 0.06,
        overscroll: rightOffsetMs,
        minRange: Math.max(getIntervalMs(interval) * 10, 60_000),
      },
      yAxis: [
        {
          labels: { align: 'right', x: -8, style: { color: '#8892a0', fontSize: '10px' }, formatter() { return '$' + this.value.toFixed(2); } },
          height: '75%',
          gridLineWidth: 0,
          lineWidth: 0,
          crosshair: false,
          startOnTick: false,
          endOnTick: false,
          scrollbar: {
            enabled: true,
            opposite: true,
            barBackgroundColor: '#475569',
            barBorderColor: '#475569',
            buttonBackgroundColor: '#1f2937',
            buttonBorderColor: '#475569',
            trackBackgroundColor: '#0b1220',
            trackBorderColor: '#334155',
            rifleColor: '#e2e8f0',
          },
          resize: { enabled: true },
        },
        { labels: { enabled: false }, top: '77%', height: '23%', offset: 0, gridLineWidth: 0, lineWidth: 0, crosshair: false },
      ],
      tooltip: { enabled: false },
      plotOptions: {
        candlestick: { color: dn, upColor: up, lineColor: dn, upLineColor: up, lineWidth: 1, pointPadding: 0.15, groupPadding: 0.1 },
        ohlc: { color: dn, upColor: up, lineWidth: 1.5 },
        line: { color: '#3b82f6', lineWidth: 1.5 },
        area: { color: '#3b82f6', fillColor: { linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 }, stops: [[0, 'rgba(59,130,246,0.3)'], [1, 'rgba(59,130,246,0)']] }, lineWidth: 1.5 },
        column: { borderRadius: 0, borderWidth: 0 },
        series: { animation: false, states: { hover: { enabled: false }, inactive: { opacity: 1 } } },
        sma: { lineWidth: 1.2, enableMouseTracking: false, marker: { enabled: false } },
        ema: { lineWidth: 1.2, enableMouseTracking: false, marker: { enabled: false } },
        bb: { lineWidth: 1, enableMouseTracking: false, marker: { enabled: false } },
        vwap: { lineWidth: 1.2, enableMouseTracking: false, marker: { enabled: false } },
      },
      series,
    };
  }, [symbol, chartType, activeInd, theme, rightOffsetMs, interval]);

  // ─── Load ───
  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { ohlc, volume } = await fetchHistoricalData(symbol, interval, 500, TD_API_KEY);
      if (ohlc.length === 0) {
        setSeriesSeed({ ohlc: [], volume: [] });
        setError('No data for $' + symbol);
        setLoading(false);
        return;
      }

      const last = ohlc[ohlc.length - 1];
      const prev = ohlc.length > 1 ? ohlc[ohlc.length - 2] : last;
      const lv = volume[volume.length - 1]?.y || 0;
      setHover({ o: last[1], h: last[2], l: last[3], c: last[4], v: lv, chg: last[4] - prev[4], pct: prev[4] ? ((last[4] - prev[4]) / prev[4]) * 100 : 0 });
      setSeriesSeed({ ohlc, volume });
      setLoading(false);
    } catch (err) {
      console.error(err);
      setSeriesSeed({ ohlc: [], volume: [] });
      setError('Failed to load data');
      setLoading(false);
    }
  }, [symbol, interval]);

  const applyRangePreset = useCallback((rangeValue, options = {}) => {
    const { persist = true } = options;
    const xAxis = chartRef.current?.chart?.xAxis?.[0];
    if (!xAxis) return;
    const dataMin = Number.isFinite(xAxis.dataMin) ? xAxis.dataMin : null;
    const dataMax = Number.isFinite(xAxis.dataMax) ? xAxis.dataMax : null;
    if (!Number.isFinite(dataMin) || !Number.isFinite(dataMax)) return;

    const end = dataMax + rightOffsetMs;
    const now = dataMax;
    const rangeMsMap = {
      '1D': 86_400_000,
      '5D': 5 * 86_400_000,
      '1M': 30 * 86_400_000,
      '3M': 90 * 86_400_000,
      '6M': 180 * 86_400_000,
      '1Y': 365 * 86_400_000,
    };

    if (rangeValue === 'ALL') {
      xAxis.setExtremes(dataMin, end, true, false, { trigger: 'range-preset' });
      if (persist) setActiveRange('ALL');
      return;
    }

    const windowMs = rangeMsMap[rangeValue];
    if (!Number.isFinite(windowMs)) return;
    const start = Math.max(dataMin, now - windowMs);
    xAxis.setExtremes(start, end, true, false, { trigger: 'range-preset' });
    if (persist) setActiveRange(rangeValue);
  }, [rightOffsetMs]);

  const fitChartViewport = useCallback((rangeValue = activeRange) => {
    const chart = chartRef.current?.chart;
    if (!chart) return;
    const yAxis = chart.yAxis?.[0];
    if (yAxis) {
      yAxis.setExtremes(null, null, false, false, { trigger: 'fit-y' });
    }
    applyRangePreset(rangeValue, { persist: false });
    chart.redraw(false);
  }, [activeRange, applyRangePreset]);

  const chartOptions = useMemo(
    () => buildOpts(seriesSeed.ohlc, seriesSeed.volume),
    [buildOpts, seriesSeed.ohlc, seriesSeed.volume]
  );
  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (seriesSeed.ohlc.length < 5) return;
    const chart = chartRef.current?.chart;
    const xAxis = chart?.xAxis?.[0];
    if (!xAxis) return;

    chart.reflow();
    requestAnimationFrame(() => fitChartViewport(activeRange));
  }, [seriesSeed.ohlc, symbol, interval, fitChartViewport, activeRange]);

  // ─── WebSocket ───
  useEffect(() => {
    const ok = ['1min', '5min', '15min', '30min', '1h'];
    if (!ok.includes(interval)) { setIsLive(false); return; }

    let cancelled = false;

    const connect = async () => {
      try {
        let socketUrl = '';

        if (TD_API_KEY) {
          socketUrl = `${TD_WS_URL}?apikey=${encodeURIComponent(TD_API_KEY)}`;
        } else {
          const cfgResponse = await fetch(`/api/lse/ws-config?symbols=${encodeURIComponent(symbol)}`, {
            cache: 'no-store',
          });
          const cfgPayload = await cfgResponse.json().catch(() => ({}));
          if (!cfgResponse.ok || !cfgPayload?.websocketUrl) {
            throw new Error(cfgPayload?.error || `ws-config failed (${cfgResponse.status})`);
          }
          socketUrl = cfgPayload.websocketUrl;
        }

        if (cancelled) return;

        const ws = new WebSocket(socketUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(JSON.stringify({ action: 'subscribe', params: { symbols: symbol } }));
          setIsLive(true);
        };

        ws.onmessage = (e) => {
          try {
            const m = JSON.parse(e.data);
            if (m.event !== 'price') return;

            const p = parseFloat(m.price);
            const chart = chartRef.current?.chart;
            if (!chart) return;

            const ps = chart.get('price');
            if (!ps?.points?.length) return;

            const lp = ps.points[ps.points.length - 1];
            if (!lp) return;

            const o = lp.open;
            const h = Math.max(lp.high, p);
            const l = Math.min(lp.low, p);
            lp.update({ open: o, high: h, low: l, close: p }, true, false);
            setHover((prev) => ({ ...prev, o, h, l, c: p, chg: p - o, pct: o ? ((p - o) / o) * 100 : 0 }));
          } catch {
            // Ignore malformed websocket payloads.
          }
        };

        ws.onclose = () => setIsLive(false);
        ws.onerror = () => setIsLive(false);
      } catch {
        setIsLive(false);
      }
    };

    connect();

    return () => {
      cancelled = true;
      try {
        wsRef.current?.send(JSON.stringify({ action: 'unsubscribe', params: { symbols: symbol } }));
      } catch {
        // Ignore close errors.
      }
      try {
        wsRef.current?.close();
      } catch {
        // Ignore close errors.
      }
      wsRef.current = null;
      setIsLive(false);
    };
  }, [symbol, interval]);

  // ─── Handlers ───
  const pickSymbol = (s) => { setSymbol(s); setShowSym(false); setSymSearch(''); onSymbolChange?.(s); };
  const searchSubmit = (e) => { e.preventDefault(); if (symSearch.trim()) pickSymbol(symSearch.trim().toUpperCase()); };
  const toggleInd = (id) => setActiveInd((p) => p.includes(id) ? p.filter((i) => i !== id) : [...p, id]);

  const handleDraw = (tool) => {
    const chart = chartRef.current?.chart;
    if (!chart) return;
    if (tool.type === 'clearAll') {
      if (chart.annotations) while (chart.annotations.length) chart.removeAnnotation(chart.annotations[0]);
    } else if (chart.navigationBindings) {
      chart.navigationBindings.selectedButton = tool.type;
    }
    setShowDraw(false);
  };

  const toggleFs = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) { containerRef.current.requestFullscreen(); setIsFs(true); }
    else { document.exitFullscreen(); setIsFs(false); }
  };

  useEffect(() => {
    const fn = () => {
      setIsFs(!!document.fullscreenElement);
      setTimeout(() => {
        chartRef.current?.chart?.reflow();
        fitChartViewport(activeRange);
      }, 120);
    };
    document.addEventListener('fullscreenchange', fn);
    return () => document.removeEventListener('fullscreenchange', fn);
  }, [fitChartViewport, activeRange]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const reflow = () => {
      chartRef.current?.chart?.reflow();
      fitChartViewport(activeRange);
    };
    const timer = setTimeout(reflow, 100);
    let observer;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      observer = new ResizeObserver(() => reflow());
      observer.observe(containerRef.current);
    }
    window.addEventListener('resize', reflow);
    return () => {
      clearTimeout(timer);
      observer?.disconnect();
      window.removeEventListener('resize', reflow);
    };
  }, [chartSize, isFs, fitChartViewport, activeRange]);

  useEffect(() => {
    const chart = chartRef.current?.chart;
    const container = chart?.container;
    if (!chart || !container) return undefined;

    const onMouseDown = (event) => {
      if (event.button !== 0) return;
      const xAxis = chart.xAxis?.[0];
      const yAxis = chart.yAxis?.[0];
      if (!xAxis || !yAxis) return;
      if (!Number.isFinite(xAxis.min) || !Number.isFinite(xAxis.max)) return;
      if (!Number.isFinite(yAxis.min) || !Number.isFinite(yAxis.max)) return;

      const rect = container.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const insidePlot =
        px >= chart.plotLeft &&
        px <= chart.plotLeft + chart.plotWidth &&
        py >= chart.plotTop &&
        py <= chart.plotTop + chart.plotHeight;
      if (!insidePlot) return;

      dragStateRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        xMin: xAxis.min,
        xMax: xAxis.max,
        yMin: yAxis.min,
        yMax: yAxis.max,
        dataMin: Number.isFinite(xAxis.dataMin) ? xAxis.dataMin : xAxis.min,
        dataMax: Number.isFinite(xAxis.dataMax) ? xAxis.dataMax : xAxis.max,
        yDataMin: Number.isFinite(yAxis.dataMin) ? yAxis.dataMin : yAxis.min,
        yDataMax: Number.isFinite(yAxis.dataMax) ? yAxis.dataMax : yAxis.max,
      };
      event.preventDefault();
    };

    const onMouseMove = (event) => {
      const drag = dragStateRef.current;
      if (!drag) return;
      const xAxis = chart.xAxis?.[0];
      const yAxis = chart.yAxis?.[0];
      if (!xAxis || !yAxis) return;

      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;

      const xRange = drag.xMax - drag.xMin;
      const yRange = drag.yMax - drag.yMin;
      if (!Number.isFinite(xRange) || xRange <= 0 || !Number.isFinite(yRange) || yRange <= 0) return;

      const xPerPx = xRange / Math.max(chart.plotWidth, 1);
      const yPerPx = yRange / Math.max(chart.plotHeight, 1);

      let nextXMin = drag.xMin - dx * xPerPx;
      let nextXMax = drag.xMax - dx * xPerPx;
      const rightLimit = drag.dataMax + rightOffsetMs;
      const leftLimit = drag.dataMin;

      if (nextXMin < leftLimit) {
        const shift = leftLimit - nextXMin;
        nextXMin += shift;
        nextXMax += shift;
      }
      if (nextXMax > rightLimit) {
        const shift = nextXMax - rightLimit;
        nextXMin -= shift;
        nextXMax -= shift;
      }

      let nextYMin = drag.yMin + dy * yPerPx;
      let nextYMax = drag.yMax + dy * yPerPx;
      const yPadding = yRange * 0.8;
      const yMinLimit = drag.yDataMin - yPadding;
      const yMaxLimit = drag.yDataMax + yPadding;

      if (nextYMin < yMinLimit) {
        const shift = yMinLimit - nextYMin;
        nextYMin += shift;
        nextYMax += shift;
      }
      if (nextYMax > yMaxLimit) {
        const shift = nextYMax - yMaxLimit;
        nextYMin -= shift;
        nextYMax -= shift;
      }

      xAxis.setExtremes(nextXMin, nextXMax, false, false, { trigger: 'manual-drag-pan' });
      yAxis.setExtremes(nextYMin, nextYMax, false, false, { trigger: 'manual-drag-pan' });
      chart.redraw(false);
      event.preventDefault();
    };

    const stopDragging = () => {
      if (!dragStateRef.current) return;
      dragStateRef.current = null;
      chart.redraw();
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', stopDragging);
    window.addEventListener('mouseleave', stopDragging);

    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', stopDragging);
      window.removeEventListener('mouseleave', stopDragging);
      dragStateRef.current = null;
    };
  }, [rightOffsetMs]);

  const handleZoom = useCallback((direction) => {
    const chart = chartRef.current?.chart;
    const xAxis = chart?.xAxis?.[0];
    if (!xAxis || !Number.isFinite(xAxis.min) || !Number.isFinite(xAxis.max)) return;

    const currentRange = xAxis.max - xAxis.min;
    if (!Number.isFinite(currentRange) || currentRange <= 0) return;

    const scale = direction === 'in' ? 0.72 : 1.4;
    const nextRange = Math.max(60_000, currentRange * scale);
    const center = xAxis.min + currentRange / 2;
    const dataMin = Number.isFinite(xAxis.dataMin) ? xAxis.dataMin : xAxis.min;
    const dataMax = Number.isFinite(xAxis.dataMax) ? xAxis.dataMax : xAxis.max;
    const paddedDataMax = dataMax + rightOffsetMs;

    let nextMin = center - nextRange / 2;
    let nextMax = center + nextRange / 2;
    if (nextMin < dataMin) {
      nextMin = dataMin;
      nextMax = Math.min(paddedDataMax, dataMin + nextRange);
    }
    if (nextMax > paddedDataMax) {
      nextMax = paddedDataMax;
      nextMin = Math.max(dataMin, paddedDataMax - nextRange);
    }

    xAxis.setExtremes(nextMin, nextMax, true, false, { trigger: 'zoom-button' });
  }, [rightOffsetMs]);

  const handleResetZoom = useCallback(() => {
    const xAxis = chartRef.current?.chart?.xAxis?.[0];
    if (!xAxis) return;
    const dataMin = Number.isFinite(xAxis.dataMin) ? xAxis.dataMin : null;
    const dataMax = Number.isFinite(xAxis.dataMax) ? xAxis.dataMax : null;
    if (Number.isFinite(dataMin) && Number.isFinite(dataMax)) {
      xAxis.setExtremes(dataMin, dataMax + rightOffsetMs, true, false, { trigger: 'reset-zoom' });
      return;
    }
    xAxis.setExtremes(null, null, true, false, { trigger: 'reset-zoom' });
  }, [rightOffsetMs]);

  const h = isFs ? '100vh' : (SIZE_PRESETS.find((s) => s.value === chartSize)?.height || '100%');
  const maxChartHeight = isFs ? '100vh' : 'calc(100vh - 330px)';
  const filteredWl = watchlist.filter((s) => s.toLowerCase().includes(symSearch.toLowerCase()));

  // ─── Styles ───
  const P = 'px-2 py-0.5 text-[10px] font-medium rounded cursor-pointer transition-all duration-100 select-none whitespace-nowrap';
  const PN = 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
  const PF = 'text-[#555] hover:text-[#888] hover:bg-white/[0.03] border border-transparent';
  const DD = { position: 'absolute', top: '100%', left: 0, marginTop: '4px', backgroundColor: '#0d1117', border: '1px solid #1f2937', borderRadius: '6px', padding: '4px', zIndex: 200, minWidth: '170px', boxShadow: '0 12px 40px rgba(0,0,0,0.7)', maxHeight: '320px', overflowY: 'auto' };
  const DI = (a) => ({ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '5px 10px', backgroundColor: a ? 'rgba(59,130,246,0.1)' : 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer', color: a ? '#60a5fa' : '#8892a0', fontSize: '11px', textAlign: 'left' });

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', width: '100%', height: h, maxHeight: maxChartHeight, backgroundColor: '#000', position: 'relative', overflow: 'hidden', borderRadius: isFs ? '0' : '6px', border: isFs ? 'none' : '1px solid #111827' }}>

      {/* ═══ TOP BAR ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 10px', backgroundColor: '#000', borderBottom: '1px solid #111827', flexShrink: 0 }}>

        {/* Symbol Picker */}
        <div style={{ position: 'relative' }} data-dd>
          <button onClick={() => setShowSym(!showSym)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 8px', backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: '5px', cursor: 'pointer', color: '#e5e7eb', fontSize: '13px', fontWeight: '700' }}>
            <span style={{ color: '#4a5568', fontSize: '11px' }}>$</span>{symbol}<span style={{ color: '#4a5568', fontSize: '8px', marginLeft: '2px' }}>▼</span>
          </button>
          {showSym && (
            <div style={{ ...DD, minWidth: '200px' }}>
              <form onSubmit={searchSubmit} style={{ padding: '4px' }}>
                <input autoFocus value={symSearch} onChange={(e) => setSymSearch(e.target.value)} placeholder="Search or type symbol..." style={{ width: '100%', padding: '6px 8px', backgroundColor: '#0a0f1a', border: '1px solid #1f2937', borderRadius: '4px', color: '#e5e7eb', fontSize: '11px', outline: 'none' }} />
              </form>
              <div style={{ borderTop: '1px solid #1a2332', margin: '4px 0' }} />
              {filteredWl.map((s) => (
                <button key={s} onClick={() => pickSymbol(s)} style={{ ...DI(s === symbol), fontWeight: s === symbol ? '600' : '400' }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)')} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = s === symbol ? 'rgba(59,130,246,0.1)' : 'transparent')}>
                  <span style={{ color: '#4a5568', fontSize: '9px', width: '10px' }}>$</span>{s}{s === symbol && <span style={{ marginLeft: 'auto', fontSize: '9px', color: '#3b82f6' }}>●</span>}
                </button>
              ))}
              {symSearch && !filteredWl.includes(symSearch.toUpperCase()) && (
                <button onClick={() => pickSymbol(symSearch.toUpperCase())} style={{ ...DI(false), color: '#3b82f6', fontWeight: '500' }}>Search "{symSearch.toUpperCase()}"</button>
              )}
            </div>
          )}
        </div>

        {/* Price */}
        <span style={{ color: '#e5e7eb', fontSize: '15px', fontWeight: '700', fontFamily: "'SF Mono', monospace" }}>{fmtPrice(hover.c)}</span>
        {hover.chg != null && <span style={{ color: hover.chg >= 0 ? '#22c55e' : '#ef4444', fontSize: '11px', fontWeight: '600', fontFamily: "'SF Mono', monospace" }}>{hover.chg >= 0 ? '+' : ''}{hover.chg?.toFixed(2)} ({hover.pct?.toFixed(2)}%)</span>}

        {isLive && <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '9px', color: '#22c55e', fontWeight: '600' }}><span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#22c55e', animation: 'pulse 2s infinite' }} />LIVE</div>}

        <div style={{ flex: 1 }} />

        {/* Size */}
        <div style={{ position: 'relative' }} data-dd>
          <button onClick={() => setShowSize(!showSize)} className={`${P} ${PF}`}>Size: {SIZE_PRESETS.find((s) => s.value === chartSize)?.label}</button>
          {showSize && (
            <div style={{ ...DD, minWidth: '100px', right: 0, left: 'auto' }}>
              {SIZE_PRESETS.map((s) => (
                <button key={s.value} onClick={() => { setChartSize(s.value); setShowSize(false); setTimeout(() => { chartRef.current?.chart?.reflow(); fitChartViewport(activeRange); }, 80); }} style={DI(chartSize === s.value)}>{s.label} <span style={{ color: '#4a5568', fontSize: '9px', marginLeft: 'auto' }}>{s.height}</span></button>
              ))}
            </div>
          )}
        </div>

        <button onClick={toggleFs} className={`${P} ${PF}`} title="Fullscreen">{isFs ? '⊡' : '⛶'}</button>
        <button onClick={() => handleZoom('in')} className={`${P} ${PF}`} title="Zoom in">＋</button>
        <button onClick={() => handleZoom('out')} className={`${P} ${PF}`} title="Zoom out">－</button>
        <button onClick={handleResetZoom} className={`${P} ${PF}`} title="Reset zoom">Reset</button>
      </div>

      {/* ═══ TOOLBAR ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '3px 10px', backgroundColor: '#000', borderBottom: '1px solid #0a0a0a', flexShrink: 0, flexWrap: 'wrap' }}>
        {TOP_INDICATOR_CHIPS.map((chipId) => {
          const chip = INDICATOR_OPTIONS.find((opt) => opt.id === chipId);
          if (!chip) return null;
          const active = activeInd.includes(chipId);
          return (
            <button key={chipId} onClick={() => toggleInd(chipId)} className={`${P} ${active ? PN : PF}`}>{chip.label}</button>
          );
        })}
        <div style={{ width: '1px', height: '12px', backgroundColor: '#1a2332', margin: '0 4px' }} />
        {CHART_TYPES.map((ct) => <button key={ct.value} onClick={() => setChartType(ct.value)} className={`${P} ${chartType === ct.value ? PN : PF}`}>{ct.label}</button>)}
        <div style={{ width: '1px', height: '12px', backgroundColor: '#1a2332', margin: '0 4px' }} />

        {/* Indicators */}
        <div style={{ position: 'relative' }} data-dd>
          <button onClick={() => setShowInd(!showInd)} className={`${P} ${activeInd.length ? PN : PF}`}>Indicators{activeInd.length ? ` (${activeInd.length})` : ''}</button>
          {showInd && (
            <div style={DD}>
              {INDICATOR_OPTIONS.map((ind) => (
                <button key={ind.id} onClick={() => toggleInd(ind.id)} style={DI(activeInd.includes(ind.id))} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)')} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = activeInd.includes(ind.id) ? 'rgba(59,130,246,0.1)' : 'transparent')}>
                  <span style={{ width: '12px', height: '3px', backgroundColor: ind.color, borderRadius: '2px', flexShrink: 0 }} />{ind.label}{activeInd.includes(ind.id) && <span style={{ marginLeft: 'auto', fontSize: '9px' }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Draw */}
        <div style={{ position: 'relative' }} data-dd>
          <button onClick={() => setShowDraw(!showDraw)} className={`${P} ${PF}`}>Draw</button>
          {showDraw && (
            <div style={DD}>
              {DRAWING_TOOLS.map((t) => (
                <button key={t.label} onClick={() => handleDraw(t)} style={{ ...DI(false), color: t.type === 'clearAll' ? '#ef4444' : '#8892a0' }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)')} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}>
                  <span style={{ width: '16px', textAlign: 'center', fontSize: '12px', flexShrink: 0 }}>{t.icon}</span>{t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Colors */}
        <div style={{ position: 'relative' }} data-dd>
          <button onClick={() => setShowColor(!showColor)} className={`${P} ${PF}`}>
            <span style={{ display: 'inline-flex', gap: '2px', alignItems: 'center' }}>
              <span style={{ width: '6px', height: '10px', backgroundColor: theme.up, borderRadius: '1px' }} />
              <span style={{ width: '6px', height: '10px', backgroundColor: theme.down, borderRadius: '1px' }} />
              Colors
            </span>
          </button>
          {showColor && (
            <div style={DD}>
              {CANDLE_THEMES.map((t) => (
                <button key={t.label} onClick={() => { setTheme(t); setShowColor(false); }} style={DI(theme.label === t.label)} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)')} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = theme.label === t.label ? 'rgba(59,130,246,0.1)' : 'transparent')}>
                  <span style={{ display: 'flex', gap: '2px' }}><span style={{ width: '8px', height: '14px', backgroundColor: t.up, borderRadius: '1px' }} /><span style={{ width: '8px', height: '14px', backgroundColor: t.down, borderRadius: '1px' }} /></span>{t.label}{theme.label === t.label && <span style={{ marginLeft: 'auto', fontSize: '9px' }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══ OHLCV STRIP ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '2px 12px', backgroundColor: '#000', flexShrink: 0, fontFamily: "'SF Mono', monospace", fontSize: '10px' }}>
        <span style={{ color: '#444' }}>O <span style={{ color: hover.c >= hover.o ? theme.up : theme.down }}>{fmtPrice(hover.o)}</span></span>
        <span style={{ color: '#444' }}>H <span style={{ color: theme.up }}>{fmtPrice(hover.h)}</span></span>
        <span style={{ color: '#444' }}>L <span style={{ color: theme.down }}>{fmtPrice(hover.l)}</span></span>
        <span style={{ color: '#444' }}>C <span style={{ color: hover.c >= hover.o ? theme.up : theme.down, fontWeight: '600' }}>{fmtPrice(hover.c)}</span></span>
        <span style={{ color: '#444' }}>V <span style={{ color: '#333' }}>{fmtVol(hover.v)}</span></span>
      </div>

      {/* ═══ CHART ═══ */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', zIndex: 50 }}>
            <div style={{ color: '#4a5568', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="12" height="12" viewBox="0 0 16 16" style={{ animation: 'spin 1s linear infinite' }}><circle cx="8" cy="8" r="6" stroke="#3b82f6" strokeWidth="2" fill="none" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round" /></svg>
              Loading ${symbol}...
            </div>
          </div>
        )}
        {error && !loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', zIndex: 50, gap: '6px' }}>
            <span style={{ color: '#ef4444', fontSize: '11px' }}>{error}</span>
            <button onClick={loadData} style={{ padding: '3px 10px', fontSize: '10px', backgroundColor: '#1f2937', color: '#9ca3af', border: '1px solid #374151', borderRadius: '4px', cursor: 'pointer' }}>Retry</button>
          </div>
        )}

        <HighchartsReact ref={chartRef} highcharts={Highcharts} constructorType="stockChart" options={chartOptions} containerProps={{ style: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 } }} />

        <div style={{ position: 'absolute', bottom: '36px', right: '10px', fontSize: '8px', color: '#151a24', letterSpacing: '0.04em', fontWeight: '500', pointerEvents: 'none', zIndex: 10 }}>MARKET DATA POWERED BY TWELVE DATA</div>
      </div>

      {/* ═══ BOTTOM RANGE / INTERVAL BAR ═══ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 10px', backgroundColor: '#000', borderTop: '1px solid #0f1722', flexShrink: 0, fontFamily: "'SF Mono', monospace" }}>
        <span style={{ color: '#4a5568', fontSize: '11px' }}>Range:</span>
        {RANGE_PRESETS_PRIMARY.map((item) => (
          <button
            key={item.value}
            onClick={() => applyRangePreset(item.value)}
            className={`${P} ${activeRange === item.value ? PN : PF}`}
          >
            {item.label}
          </button>
        ))}
        <div style={{ position: 'relative' }} data-dd>
          <button onClick={() => setShowRangeMore(!showRangeMore)} className={`${P} ${RANGE_PRESETS_MORE.some((o) => o.value === activeRange) ? PN : PF}`}>▼</button>
          {showRangeMore && (
            <div style={{ ...DD, minWidth: '90px' }}>
              {RANGE_PRESETS_MORE.map((item) => (
                <button
                  key={item.value}
                  onClick={() => {
                    applyRangePreset(item.value);
                    setShowRangeMore(false);
                  }}
                  style={DI(activeRange === item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ width: '1px', height: '14px', backgroundColor: '#1a2332', margin: '0 4px' }} />

        <span style={{ color: '#4a5568', fontSize: '11px' }}>Interval:</span>
        {BOTTOM_INTERVALS_PRIMARY.map((item) => (
          <button
            key={item.value}
            onClick={() => setIv(item.value)}
            className={`${P} ${interval === item.value ? PN : PF}`}
          >
            {item.label}
          </button>
        ))}
        <div style={{ position: 'relative' }} data-dd>
          <button onClick={() => setShowIntervalMore(!showIntervalMore)} className={`${P} ${BOTTOM_INTERVALS_MORE.some((o) => o.value === interval) ? PN : PF}`}>▼</button>
          {showIntervalMore && (
            <div style={{ ...DD, minWidth: '90px' }}>
              {BOTTOM_INTERVALS_MORE.map((item) => (
                <button
                  key={item.value}
                  onClick={() => {
                    setIv(item.value);
                    setShowIntervalMore(false);
                  }}
                  style={DI(interval === item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        .highcharts-range-selector-group{display:none!important}
        .highcharts-credits{display:none!important}
        .highcharts-scrollbar{opacity:1;transition:opacity .2s}
        .highcharts-scrollbar:hover{opacity:1}
        .highcharts-navigator-mask-inside{fill:rgba(59,130,246,.04)}
        .highcharts-navigator-outline{stroke:#1a2332}
        .highcharts-stock-tools-wrapper{display:none!important}
        .highcharts-bindings-wrapper{display:none!important}
        .highcharts-crosshair,.highcharts-crosshair-thin,.highcharts-axis-resizer{display:none!important}
        .highcharts-root,.highcharts-container{cursor:grab}
        .highcharts-root:active,.highcharts-container:active{cursor:grabbing}
        *::-webkit-scrollbar{width:4px}
        *::-webkit-scrollbar-track{background:#0d1117}
        *::-webkit-scrollbar-thumb{background:#1f2937;border-radius:4px}
      `}</style>
    </div>
  );
}
