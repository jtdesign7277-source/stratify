import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Highcharts from 'highcharts/highstock';

const TD_API_KEY = import.meta.env.VITE_TWELVE_DATA_APIKEY || import.meta.env.VITE_TWELVEDATA_API_KEY || '';
const TD_REST = 'https://api.twelvedata.com';

const INTERVALS = [
  { label: '5m', value: '5min' },
  { label: '15m', value: '15min' },
  { label: '1h', value: '1h' },
  { label: '1D', value: '1day' },
];

const CANDLE_THEMES = [
  { label: 'Classic', up: '#22c55e', down: '#ef4444' },
  { label: 'Cyan / Magenta', up: '#06b6d4', down: '#ec4899' },
  { label: 'Blue / Orange', up: '#3b82f6', down: '#f97316' },
  { label: 'White / Red', up: '#e5e7eb', down: '#ef4444' },
  { label: 'Lime / Pink', up: '#84cc16', down: '#f43f5e' },
  { label: 'Gold / Purple', up: '#eab308', down: '#a855f7' },
];

const INTERVAL_MS = { '5min': 300000, '15min': 900000, '1h': 3600000, '1day': 86400000 };

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

async function fetchData(symbol, interval, outputsize) {
  const url = TD_REST + '/time_series?symbol=' + encodeURIComponent(symbol) + '&interval=' + encodeURIComponent(interval) + '&outputsize=' + outputsize + '&apikey=' + encodeURIComponent(TD_API_KEY) + '&format=JSON&order=ASC';
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok || (data && data.status === 'error')) return { ohlc: [], volume: [] };
  const ohlc = [], volume = [];
  (data.values || []).forEach(function(bar) {
    const ts = toMs(bar.datetime || bar.timestamp);
    const o = parseFloat(bar.open), h = parseFloat(bar.high), l = parseFloat(bar.low), c = parseFloat(bar.close);
    const v = parseInt(bar.volume, 10) || 0;
    if (!Number.isFinite(ts) || !Number.isFinite(o) || !Number.isFinite(h) || !Number.isFinite(l) || !Number.isFinite(c)) return;
    ohlc.push([ts, o, h, l, c]);
    volume.push({ x: ts, y: v, _o: o, _c: c });
  });
  ohlc.sort(function(a, b) { return a[0] - b[0]; });
  volume.sort(function(a, b) { return a.x - b.x; });
  return { ohlc: ohlc, volume: volume };
}

export default function V2TradePage() {
  const containerRef = useRef(null);
  const chartObjRef = useRef(null);
  const dragRef = useRef(null);
  const [symbol, setSymbol] = useState('AAPL');
  const [interval, setInterval_] = useState('1day');
  const [theme, setTheme] = useState(CANDLE_THEMES[0]);
  const [showColors, setShowColors] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState({ o: null, h: null, l: null, c: null, v: null });
  const rightPad = useMemo(function() { return (INTERVAL_MS[interval] || 86400000) * 15; }, [interval]);

  const loadChart = useCallback(async function() {
    setLoading(true);
    const result = await fetchData(symbol, interval, 500);
    const ohlc = result.ohlc;
    const volume = result.volume;
    if (ohlc.length) {
      const last = ohlc[ohlc.length - 1];
      setHover({ o: last[1], h: last[2], l: last[3], c: last[4], v: volume[volume.length - 1] ? volume[volume.length - 1].y : 0 });
    }
    if (chartObjRef.current) { chartObjRef.current.destroy(); chartObjRef.current = null; }
    if (!containerRef.current) { setLoading(false); return; }
    const up = theme.up, down = theme.down;
    const cVol = volume.map(function(v) {
      return { x: v.x, y: v.y, color: v._c >= v._o ? up + '44' : down + '44', borderColor: v._c >= v._o ? up + '77' : down + '77' };
    });
    var chart = Highcharts.stockChart(containerRef.current, {
      chart: { backgroundColor: 'transparent', style: { fontFamily: "'SF Pro Display', -apple-system, sans-serif" }, animation: false, spacing: [8, 8, 0, 8], panning: { enabled: false }, zooming: { type: undefined, mouseWheel: { enabled: false }, pinchType: 'x' } },
      credits: { enabled: false }, title: { text: '' }, stockTools: { gui: { enabled: false } },
      navigator: { enabled: true, height: 28, outlineColor: '#1a233244', maskFill: 'rgba(59,130,246,0.06)', series: { color: '#3b82f6', lineWidth: 1 }, xAxis: { gridLineWidth: 0, labels: { style: { color: '#4a5568', fontSize: '9px' } } }, handles: { backgroundColor: '#22c55e', borderColor: '#16a34a', width: 8, height: 20 } },
      scrollbar: { enabled: true, barBackgroundColor: '#475569', barBorderColor: '#475569', barBorderRadius: 4, buttonArrowColor: '#22c55e', buttonBackgroundColor: '#14532d', buttonBorderColor: '#22c55e', rifleColor: '#22c55e', trackBackgroundColor: 'transparent', trackBorderColor: '#334155', trackBorderRadius: 4, height: 14, margin: 6 },
      rangeSelector: { enabled: false },
      xAxis: { gridLineWidth: 0, lineColor: '#1a233244', tickColor: '#1a233244', crosshair: { color: '#ffffff22', dashStyle: 'Dash', width: 1 }, labels: { style: { color: '#4a5568', fontSize: '10px' } }, overscroll: rightPad, minRange: Math.max((INTERVAL_MS[interval] || 86400000) * 2, 60000) },
      yAxis: [
        { labels: { align: 'right', x: -8, style: { color: '#8892a0bb', fontSize: '10px' }, formatter: function() { return '$' + this.value.toFixed(2); } }, height: '75%', gridLineWidth: 0, lineWidth: 0, crosshair: { color: '#ffffff22', dashStyle: 'Dash', width: 1 } },
        { labels: { enabled: false }, top: '77%', height: '23%', gridLineWidth: 0, lineWidth: 0 }
      ],
      tooltip: { enabled: false },
      plotOptions: {
        candlestick: { color: down, upColor: up, lineColor: down, upLineColor: up, lineWidth: 1, pointPadding: 0.15, groupPadding: 0.1 },
        column: { borderRadius: 0, borderWidth: 0 },
        series: { animation: false, states: { hover: { enabled: false }, inactive: { opacity: 1 } } }
      },
      series: [
        { type: 'candlestick', id: 'price', name: symbol, data: ohlc, yAxis: 0, zIndex: 5 },
        { type: 'column', id: 'volume', name: 'Volume', data: cVol, yAxis: 1, zIndex: 1, colorByPoint: true, borderWidth: 0 }
      ]
    });
    chartObjRef.current = chart;
    setLoading(false);
  }, [symbol, interval, theme, rightPad]);

  useEffect(function() { loadChart(); }, [loadChart]);
  useEffect(function() { return function() { if (chartObjRef.current) { chartObjRef.current.destroy(); chartObjRef.current = null; } }; }, []);

  useEffect(function() {
    var container = containerRef.current;
    if (!container) return;
    var getChart = function() { return chartObjRef.current; };
    var onDown = function(e) {
      if (e.button !== 0) return;
      var chart = getChart(); if (!chart) return;
      var xAxis = chart.xAxis && chart.xAxis[0], yAxis = chart.yAxis && chart.yAxis[0];
      if (!xAxis || !yAxis) return;
      var rect = container.getBoundingClientRect();
      var px = e.clientX - rect.left, py = e.clientY - rect.top;
      if (px < chart.plotLeft || px > chart.plotLeft + chart.plotWidth || py < chart.plotTop || py > chart.plotTop + chart.plotHeight) return;
      dragRef.current = { sx: e.clientX, sy: e.clientY, xMin: xAxis.min, xMax: xAxis.max, yMin: yAxis.min, yMax: yAxis.max, dMin: xAxis.dataMin, dMax: xAxis.dataMax };
      container.style.cursor = 'grabbing'; e.preventDefault();
    };
    var onMove = function(e) {
      var d = dragRef.current; if (!d) return;
      var chart = getChart(); if (!chart) return;
      var xAxis = chart.xAxis && chart.xAxis[0], yAxis = chart.yAxis && chart.yAxis[0];
      if (!xAxis || !yAxis) return;
      var xRange = d.xMax - d.xMin, yRange = d.yMax - d.yMin;
      if (xRange <= 0 || yRange <= 0) return;
      var dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      var xPx = xRange / Math.max(chart.plotWidth, 1), yPx = yRange / Math.max(chart.plotHeight, 1);
      var nxMin = d.xMin - dx * xPx, nxMax = d.xMax - dx * xPx;
      var right = d.dMax + rightPad;
      if (nxMin < d.dMin) { nxMax += d.dMin - nxMin; nxMin = d.dMin; }
      if (nxMax > right) { nxMin -= nxMax - right; nxMax = right; }
      var nyMin = d.yMin + dy * yPx, nyMax = d.yMax + dy * yPx;
      xAxis.setExtremes(nxMin, nxMax, false, false);
      yAxis.setExtremes(nyMin, nyMax, false, false);
      chart.redraw(false); e.preventDefault();
    };
    var onUp = function() { if (!dragRef.current) return; dragRef.current = null; container.style.cursor = 'crosshair'; };
    var onWheel = function(e) {
      var chart = getChart(); if (!chart) return;
      var rect = container.getBoundingClientRect();
      var px = e.clientX - rect.left, py = e.clientY - rect.top;
      if (px < chart.plotLeft || px > chart.plotLeft + chart.plotWidth || py < chart.plotTop || py > chart.plotTop + chart.plotHeight) return;
      e.preventDefault();
      var xAxis = chart.xAxis && chart.xAxis[0];
      if (!xAxis || !Number.isFinite(xAxis.min) || !Number.isFinite(xAxis.max)) return;
      var factor = e.deltaY > 0 ? 1.15 : 0.87;
      var xRange = xAxis.max - xAxis.min;
      var ratio = (px - chart.plotLeft) / Math.max(chart.plotWidth, 1);
      var center = xAxis.min + xRange * ratio;
      var newRange = xRange * factor;
      var minR = (INTERVAL_MS[interval] || 86400000) * 2;
      var nMin = center - newRange * ratio, nMax = center + newRange * (1 - ratio);
      if (nMax - nMin < minR) { nMin = center - minR * ratio; nMax = center + minR * (1 - ratio); }
      var dMin = Number.isFinite(xAxis.dataMin) ? xAxis.dataMin : nMin;
      var dMax = (Number.isFinite(xAxis.dataMax) ? xAxis.dataMax : nMax) + rightPad;
      if (nMin < dMin) nMin = dMin;
      if (nMax > dMax) nMax = dMax;
      xAxis.setExtremes(nMin, nMax, false, false);
      var ps = chart.get('price'), yAxis = chart.yAxis && chart.yAxis[0];
      if (ps && ps.points && ps.points.length && yAxis) {
        var lo = Infinity, hi = -Infinity;
        for (var i = 0; i < ps.points.length; i++) { var p = ps.points[i]; if (p.x >= nMin && p.x <= nMax) { if (p.low < lo) lo = p.low; if (p.high > hi) hi = p.high; } }
        if (lo < Infinity) { var pad = (hi - lo) * 0.08 || hi * 0.02; yAxis.setExtremes(lo - pad, hi + pad, false, false); }
      }
      chart.redraw(false);
    };
    container.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    container.addEventListener('wheel', onWheel, { passive: false });
    return function() {
      container.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      container.removeEventListener('wheel', onWheel);
      dragRef.current = null;
    };
  }, [rightPad, interval]);

  useEffect(function() {
    var fn = function(e) { if (!e.target.closest('[data-dd]')) { setShowColors(false); setShowSearch(false); } };
    document.addEventListener('mousedown', fn);
    return function() { document.removeEventListener('mousedown', fn); };
  }, []);

  var handleSearchSubmit = function(sym) { setSearch(''); setShowSearch(false); setSymbol(sym.toUpperCase()); };
  var fmt = function(v) { return v == null ? '—' : '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var fmtV = function(v) { if (!v) return '—'; if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'; if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K'; return v; };

  return (
    <div className="h-full w-full bg-transparent flex flex-col overflow-hidden">
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-4 text-base font-mono">
          <span className="text-white font-bold text-xl">{symbol}</span>
          <span className="text-white/40">O <span className="text-white/70">{fmt(hover.o)}</span></span>
          <span className="text-white/40">H <span className="text-emerald-400/80">{fmt(hover.h)}</span></span>
          <span className="text-white/40">L <span className="text-red-400/80">{fmt(hover.l)}</span></span>
          <span className="text-white/40">C <span className="text-white/70">{fmt(hover.c)}</span></span>
          <span className="text-white/40">V <span className="text-white/50">{fmtV(hover.v)}</span></span>
          {loading && <span className="text-cyan-300 animate-pulse">Loading…</span>}
        </div>
        <div className="flex items-center gap-1">
          <div className="relative" data-dd>
            <button onClick={function() { setShowSearch(!showSearch); }} className="px-3 py-1.5 rounded text-base text-gray-400 hover:text-white hover:bg-white/5 transition-colors">🔍</button>
            {showSearch && (
              <div className="absolute right-0 top-full mt-1 bg-black/90 border border-white/10 rounded-lg p-2 backdrop-blur-xl w-56 z-50">
                <input autoFocus value={search} onChange={function(e) { setSearch(e.target.value.toUpperCase()); }} onKeyDown={function(e) { if (e.key === 'Enter' && search.trim()) handleSearchSubmit(search.trim()); }} placeholder="Symbol (e.g. TSLA)" className="w-full bg-transparent text-white text-sm outline-none placeholder-gray-500 px-2 py-1.5 border border-white/10 rounded" />
                <div className="text-[10px] text-gray-500 mt-1 px-2">Press Enter to search</div>
              </div>
            )}
          </div>
          <div className="relative" data-dd>
            <button onClick={function() { setShowColors(!showColors); }} className="px-3 py-1.5 rounded text-base text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-sm" style={{ background: theme.up }} />
              <span className="w-3.5 h-3.5 rounded-sm" style={{ background: theme.down }} />
            </button>
            {showColors && (
              <div className="absolute right-0 top-full mt-1 bg-black/90 border border-white/10 rounded-lg p-2 backdrop-blur-xl w-44 z-50">
                {CANDLE_THEMES.map(function(t, i) {
                  return (
                    <button key={i} onClick={function() { setTheme(t); setShowColors(false); }} className={'w-full flex items-center gap-2 px-2 py-1.5 rounded text-[11px] transition-colors ' + (theme.label === t.label ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5')}>
                      <span className="w-3 h-3 rounded-sm" style={{ background: t.up }} />
                      <span className="w-3 h-3 rounded-sm" style={{ background: t.down }} />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 min-h-0 w-full" style={{ cursor: 'crosshair' }} />
      <div className="flex-shrink-0 flex items-center justify-center gap-1 py-2">
        {INTERVALS.map(function(iv) {
          return (
            <button key={iv.label} onClick={function() { setInterval_(iv.value); }} className={'px-3 py-1 text-[11px] font-semibold rounded-md transition-colors ' + (interval === iv.value ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'text-gray-500 border border-transparent hover:text-white hover:bg-white/5')}>
              {iv.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
