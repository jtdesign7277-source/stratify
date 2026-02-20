import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import IndicatorsAll from 'highcharts/indicators/indicators-all';

const initModule = (mod) => {
  try { const fn = mod?.default || mod; if (typeof fn === 'function') fn(Highcharts); } catch (e) { console.warn('HC module init:', e); }
};
initModule(IndicatorsAll);

const TD_API_KEY = import.meta.env.VITE_TWELVE_DATA_APIKEY || import.meta.env.VITE_TWELVEDATA_API_KEY || '';
const TD_REST = 'https://api.twelvedata.com';

const INTERVALS = [
  { label: '1m', value: '1min' },
  { label: '5m', value: '5min' },
  { label: '15m', value: '15min' },
  { label: '1h', value: '1h' },
  { label: '1D', value: '1day' },
  { label: '1M', value: '1month' },
  { label: '1Y', value: '1day', range: 365 },
];

const CANDLE_THEMES = [
  { label: 'Classic', up: '#22c55e', down: '#ef4444' },
  { label: 'Cyan / Magenta', up: '#06b6d4', down: '#ec4899' },
  { label: 'Blue / Orange', up: '#3b82f6', down: '#f97316' },
  { label: 'White / Red', up: '#e5e7eb', down: '#ef4444' },
  { label: 'Lime / Pink', up: '#84cc16', down: '#f43f5e' },
  { label: 'Gold / Purple', up: '#eab308', down: '#a855f7' },
];

const INTERVAL_MS = {
  '1min': 60_000, '5min': 300_000, '15min': 900_000,
  '1h': 3_600_000, '1day': 86_400_000, '1month': 2_592_000_000,
};

const toMs = (v) => {
  if (v == null) return null;
  if (typeof v === 'number') return v > 1e10 ? v : v * 1000;
  const s = String(v).trim();
  if (!s) return null;
  const n = s.includes('T') ? s : s.replace(' ', 'T');
  let ts = Date.parse(n);
  if (!Number.isFinite(ts)) ts = Date.parse(n + 'Z');
  return Number.isFinite(ts) ? ts : null;
};

async function fetchData(symbol, interval, outputsize = 500) {
  const url = `${TD_REST}/time_series?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&outputsize=${outputsize}&apikey=${encodeURIComponent(TD_API_KEY)}&format=JSON&order=ASC`;
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok || data?.status === 'error') return { ohlc: [], volume: [] };
  const ohlc = [], volume = [];
  (data.values || []).forEach((bar) => {
    const ts = toMs(bar.datetime || bar.timestamp);
    const o = parseFloat(bar.open), h = parseFloat(bar.high), l = parseFloat(bar.low), c = parseFloat(bar.close);
    const v = parseInt(bar.volume, 10) || 0;
    if (!Number.isFinite(ts) || [o,h,l,c].some(x => !Number.isFinite(x))) return;
    ohlc.push([ts, o, h, l, c]);
    volume.push({ x: ts, y: v, _o: o, _c: c });
  });
  ohlc.sort((a, b) => a[0] - b[0]);
  volume.sort((a, b) => a.x - b.x);
  return { ohlc, volume };
}

export default function TransparentChart({ symbol = 'AAPL', onSymbolChange }) {
  const chartRef = useRef(null);
  const dragRef = useRef(null);
  const [interval, setInterval_] = useState('1day');
  const [activeIdx, setActiveIdx] = useState(4); // 1D
  const [theme, setTheme] = useState(CANDLE_THEMES[0]);
  const [showColors, setShowColors] = useState(false);
  const [seed, setSeed] = useState({ ohlc: [], volume: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [hover, setHover] = useState({ o: null, h: null, l: null, c: null, v: null });

  const rightPad = useMemo(() => (INTERVAL_MS[interval] || 86_400_000) * 15, [interval]);

  // Load data
  const load = useCallback(async () => {
    setLoading(true);
    const preset = INTERVALS[activeIdx];
    const iv = preset.value;
    const size = preset.range ? preset.range : 500;
    const { ohlc, volume } = await fetchData(symbol, iv, size);
    setSeed({ ohlc, volume });
    if (ohlc.length) {
      const last = ohlc[ohlc.length - 1];
      const prev = ohlc.length > 1 ? ohlc[ohlc.length - 2] : last;
      setHover({ o: last[1], h: last[2], l: last[3], c: last[4], v: volume[volume.length - 1]?.y || 0 });
    }
    setLoading(false);
  }, [symbol, activeIdx]);

  useEffect(() => { load(); }, [load]);

  // Build chart options
  const opts = useMemo(() => {
    const { up, down } = theme;
    const cVol = seed.volume.map(v => ({
      x: v.x, y: v.y,
      color: v._c >= v._o ? up + '44' : down + '44',
      borderColor: v._c >= v._o ? up + '77' : down + '77',
    }));

    return {
      chart: {
        backgroundColor: 'transparent',
        style: { fontFamily: "'SF Pro Display', -apple-system, sans-serif" },
        height: '100%',
        animation: false,
        spacing: [0, 0, 0, 0],
        panning: { enabled: false },
        zooming: { type: undefined, mouseWheel: { enabled: false }, pinchType: 'x' },
      },
      credits: { enabled: false },
      title: { text: '' },
      stockTools: { gui: { enabled: false } },
      navigator: {
        enabled: true, height: 24,
        outlineColor: '#1a233266',
        maskFill: 'rgba(59,130,246,0.06)',
        series: { color: '#3b82f6', lineWidth: 1 },
        xAxis: { gridLineWidth: 0, labels: { style: { color: '#4a5568', fontSize: '9px' } } },
        handles: { backgroundColor: '#1f293788', borderColor: '#4a556888' },
      },
      scrollbar: { enabled: false },
      rangeSelector: { enabled: false },
      xAxis: {
        gridLineWidth: 0, lineColor: '#1a233255', tickColor: '#1a233255',
        crosshair: { color: '#ffffff22', dashStyle: 'Dash', width: 1 },
        labels: { style: { color: '#4a5568', fontSize: '10px' } },
        overscroll: rightPad,
        minRange: Math.max((INTERVAL_MS[interval] || 86_400_000) * 2, 60_000),
      },
      yAxis: [
        {
          labels: { align: 'right', x: -8, style: { color: '#8892a0bb', fontSize: '10px' }, formatter() { return '$' + this.value.toFixed(2); } },
          height: '75%', gridLineWidth: 0, lineWidth: 0,
          crosshair: { color: '#ffffff22', dashStyle: 'Dash', width: 1 },
        },
        { labels: { enabled: false }, top: '77%', height: '23%', gridLineWidth: 0, lineWidth: 0 },
      ],
      tooltip: { enabled: false },
      plotOptions: {
        candlestick: { color: down, upColor: up, lineColor: down, upLineColor: up, lineWidth: 1, pointPadding: 0.15, groupPadding: 0.1 },
        column: { borderRadius: 0, borderWidth: 0 },
        series: { animation: false, states: { hover: { enabled: false }, inactive: { opacity: 1 } } },
      },
      series: [
        { type: 'candlestick', id: 'price', name: symbol, data: seed.ohlc, yAxis: 0, zIndex: 5 },
        { type: 'column', id: 'volume', name: 'Volume', data: cVol, yAxis: 1, zIndex: 1, colorByPoint: true, borderWidth: 0 },
      ],
    };
  }, [seed, theme, symbol, rightPad, interval]);

  // Fit viewport after data loads
  useEffect(() => {
    if (seed.ohlc.length < 2) return;
    const chart = chartRef.current?.chart;
    if (!chart) return;
    chart.reflow();
    requestAnimationFrame(() => {
      const xAxis = chart.xAxis?.[0];
      if (!xAxis || !Number.isFinite(xAxis.dataMin) || !Number.isFinite(xAxis.dataMax)) return;
      xAxis.setExtremes(xAxis.dataMin, xAxis.dataMax + rightPad, true, false);
    });
  }, [seed, rightPad]);

  // Custom drag-to-pan + scroll-to-zoom
  useEffect(() => {
    const chart = chartRef.current?.chart;
    const container = chart?.container;
    if (!chart || !container) return;

    const onDown = (e) => {
      if (e.button !== 0) return;
      const xAxis = chart.xAxis?.[0], yAxis = chart.yAxis?.[0];
      if (!xAxis || !yAxis) return;
      const rect = container.getBoundingClientRect();
      const px = e.clientX - rect.left, py = e.clientY - rect.top;
      if (px < chart.plotLeft || px > chart.plotLeft + chart.plotWidth || py < chart.plotTop || py > chart.plotTop + chart.plotHeight) return;
      dragRef.current = { sx: e.clientX, sy: e.clientY, xMin: xAxis.min, xMax: xAxis.max, yMin: yAxis.min, yMax: yAxis.max, dMin: xAxis.dataMin, dMax: xAxis.dataMax };
      container.style.cursor = 'grabbing';
      e.preventDefault();
    };

    const onMove = (e) => {
      const d = dragRef.current;
      if (!d) return;
      const xAxis = chart.xAxis?.[0], yAxis = chart.yAxis?.[0];
      if (!xAxis || !yAxis) return;
      const xRange = d.xMax - d.xMin, yRange = d.yMax - d.yMin;
      if (xRange <= 0 || yRange <= 0) return;
      const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      const xPx = xRange / Math.max(chart.plotWidth, 1);
      const yPx = yRange / Math.max(chart.plotHeight, 1);
      let nxMin = d.xMin - dx * xPx, nxMax = d.xMax - dx * xPx;
      const right = d.dMax + rightPad;
      if (nxMin < d.dMin) { nxMax += d.dMin - nxMin; nxMin = d.dMin; }
      if (nxMax > right) { nxMin -= nxMax - right; nxMax = right; }
      let nyMin = d.yMin + dy * yPx, nyMax = d.yMax + dy * yPx;
      xAxis.setExtremes(nxMin, nxMax, false, false);
      yAxis.setExtremes(nyMin, nyMax, false, false);
      chart.redraw(false);
      e.preventDefault();
    };

    const onUp = () => { if (!dragRef.current) return; dragRef.current = null; container.style.cursor = 'crosshair'; };

    const onWheel = (e) => {
      const rect = container.getBoundingClientRect();
      const px = e.clientX - rect.left, py = e.clientY - rect.top;
      if (px < chart.plotLeft || px > chart.plotLeft + chart.plotWidth || py < chart.plotTop || py > chart.plotTop + chart.plotHeight) return;
      e.preventDefault();
      const xAxis = chart.xAxis?.[0];
      if (!xAxis || !Number.isFinite(xAxis.min) || !Number.isFinite(xAxis.max)) return;
      const factor = e.deltaY > 0 ? 1.15 : 0.87;
      const xRange = xAxis.max - xAxis.min;
      const ratio = (px - chart.plotLeft) / Math.max(chart.plotWidth, 1);
      const center = xAxis.min + xRange * ratio;
      const newRange = xRange * factor;
      const minR = (INTERVAL_MS[interval] || 86_400_000) * 2;
      let nMin = center - newRange * ratio, nMax = center + newRange * (1 - ratio);
      if (nMax - nMin < minR) { nMin = center - minR * ratio; nMax = center + minR * (1 - ratio); }
      const dMin = Number.isFinite(xAxis.dataMin) ? xAxis.dataMin : nMin;
      const dMax = (Number.isFinite(xAxis.dataMax) ? xAxis.dataMax : nMax) + rightPad;
      if (nMin < dMin) nMin = dMin;
      if (nMax > dMax) nMax = dMax;
      xAxis.setExtremes(nMin, nMax, false, false);
      // Auto-fit Y
      const ps = chart.get('price'), yAxis = chart.yAxis?.[0];
      if (ps?.points?.length && yAxis) {
        let lo = Infinity, hi = -Infinity;
        for (const p of ps.points) { if (p.x >= nMin && p.x <= nMax) { if (p.low < lo) lo = p.low; if (p.high > hi) hi = p.high; } }
        if (lo < Infinity) { const pad = (hi - lo) * 0.08 || hi * 0.02; yAxis.setExtremes(lo - pad, hi + pad, false, false); }
      }
      chart.redraw(false);
    };

    container.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      container.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      container.removeEventListener('wheel', onWheel);
      dragRef.current = null;
    };
  }, [rightPad, interval]);

  // Close dropdowns on outside click
  useEffect(() => {
    const fn = (e) => { if (!e.target.closest('[data-dd]')) { setShowColors(false); setShowSearch(false); } };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const handleSearchSubmit = (sym) => {
    setSearch('');
    setShowSearch(false);
    if (onSymbolChange) onSymbolChange(sym);
  };

  const fmt = (v) => v == null ? '—' : '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtV = (v) => { if (!v) return '—'; if (v >= 1e6) return (v/1e6).toFixed(1)+'M'; if (v >= 1e3) return (v/1e3).toFixed(1)+'K'; return v; };

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* OHLCV strip */}
      <div className="absolute top-2 left-3 z-10 flex items-center gap-3 text-[11px] font-mono">
        <span className="text-white/70 font-semibold">{symbol}</span>
        <span className="text-white/40">O <span className="text-white/70">{fmt(hover.o)}</span></span>
        <span className="text-white/40">H <span className="text-emerald-400/80">{fmt(hover.h)}</span></span>
        <span className="text-white/40">L <span className="text-red-400/80">{fmt(hover.l)}</span></span>
        <span className="text-white/40">C <span className="text-white/70">{fmt(hover.c)}</span></span>
        <span className="text-white/40">V <span className="text-white/50">{fmtV(hover.v)}</span></span>
      </div>

      {/* Toolbar */}
      <div className="absolute top-2 right-3 z-10 flex items-center gap-1">
        {/* Search */}
        <div className="relative" data-dd>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="px-2 py-1 rounded text-[11px] text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            🔍
          </button>
          {showSearch && (
            <div className="absolute right-0 top-full mt-1 bg-black/90 border border-white/10 rounded-lg p-2 backdrop-blur-xl w-56">
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter' && search.trim()) handleSearchSubmit(search.trim()); }}
                placeholder="Symbol (e.g. TSLA)"
                className="w-full bg-transparent text-white text-sm outline-none placeholder-gray-500 px-2 py-1.5 border border-white/10 rounded"
              />
              <div className="text-[10px] text-gray-500 mt-1 px-2">Press Enter to search</div>
            </div>
          )}
        </div>

        {/* Color picker */}
        <div className="relative" data-dd>
          <button
            onClick={() => setShowColors(!showColors)}
            className="px-2 py-1 rounded text-[11px] text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-1"
          >
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: theme.up }} />
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: theme.down }} />
          </button>
          {showColors && (
            <div className="absolute right-0 top-full mt-1 bg-black/90 border border-white/10 rounded-lg p-2 backdrop-blur-xl w-44">
              {CANDLE_THEMES.map((t, i) => (
                <button
                  key={i}
                  onClick={() => { setTheme(t); setShowColors(false); }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-[11px] transition-colors ${
                    theme.label === t.label ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className="w-3 h-3 rounded-sm" style={{ background: t.up }} />
                  <span className="w-3 h-3 rounded-sm" style={{ background: t.down }} />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0" style={{ cursor: 'crosshair' }}>
        {loading && seed.ohlc.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500 text-sm animate-pulse">Loading {symbol}…</div>
          </div>
        ) : (
          <HighchartsReact
            ref={chartRef}
            highcharts={Highcharts}
            constructorType="stockChart"
            options={opts}
            containerProps={{ style: { width: '100%', height: '100%' } }}
          />
        )}
      </div>

      {/* Bottom interval bar */}
      <div className="flex items-center justify-center gap-1 py-2 bg-transparent">
        {INTERVALS.map((iv, i) => (
          <button
            key={iv.label}
            onClick={() => { setActiveIdx(i); setInterval_(iv.value); }}
            className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-colors ${
              activeIdx === i
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                : 'text-gray-500 border border-transparent hover:text-white hover:bg-white/5'
            }`}
          >
            {iv.label}
          </button>
        ))}
      </div>
    </div>
  );
}
