import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Highcharts from 'highcharts/highstock';
import AnnotationsAdvanced from 'highcharts/modules/annotations-advanced';
import StockTools from 'highcharts/modules/stock-tools';

var initMod = function(mod) { try { var fn = mod && mod.default || mod; if (typeof fn === 'function') fn(Highcharts); } catch(e) { console.warn('HC mod:', e); } };
initMod(AnnotationsAdvanced);
initMod(StockTools);

const DRAWING_TOOLS = [
  { label: '─', title: 'Horizontal Line', type: 'infinityLine' },
  { label: '⟋', title: 'Trend Line', type: 'crookedLine' },
  { label: '│', title: 'Vertical Line', type: 'verticalLine' },
  { label: '═', title: 'Parallel Channel', type: 'parallelChannel' },
  { label: 'Fib', title: 'Fibonacci Retracement', type: 'fibonacci' },
  { label: '✕', title: 'Clear All', type: 'clearAll' },
];

const TD_API_KEY = import.meta.env.VITE_TWELVE_DATA_APIKEY || import.meta.env.VITE_TWELVEDATA_API_KEY || '';
const TD_REST = 'https://api.twelvedata.com';

const INTERVALS = [
  { label: '1m', value: '1min' },
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

const INTERVAL_MS = { '1min': 60000, '5min': 300000, '15min': 900000, '1h': 3600000, '1day': 86400000 };

const STORAGE_KEY = 'stratify-v2trade-prefs';
function loadPrefs() {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
function savePrefs(patch) {
  try { const cur = loadPrefs(); localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...cur, ...patch })); } catch {}
}

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
  const prefs = useMemo(loadPrefs, []);
  const [symbol, setSymbol] = useState(prefs.symbol || 'AAPL');
  const [interval, setInterval_] = useState(prefs.interval || '1day');
  const [theme, setTheme] = useState(CANDLE_THEMES.find(function(t) { return t.label === prefs.themeLabel; }) || CANDLE_THEMES[0]);
  const [showColors, setShowColors] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
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
    var chart = Highcharts.stockChart(containerRef.current, {
      chart: { backgroundColor: 'transparent', style: { fontFamily: "'SF Pro Display', -apple-system, sans-serif" }, animation: false, spacing: [8, 8, 0, 8], panning: { enabled: false }, zooming: { type: undefined, mouseWheel: { enabled: false }, pinchType: 'x' } },
      credits: { enabled: false }, title: { text: '' },
      stockTools: { gui: { enabled: false } },
      navigation: { bindings: { verticalLine: { className: 'highcharts-verticalLine' }, infinityLine: { className: 'highcharts-infinityLine' }, crookedLine: { className: 'highcharts-crookedLine' }, parallelChannel: { className: 'highcharts-parallelChannel' }, fibonacci: { className: 'highcharts-fibonacci' } }, annotationsOptions: { shapeOptions: { stroke: '#22c55e', strokeWidth: 2 }, labelOptions: { style: { color: '#ffffff', fontSize: '11px' }, backgroundColor: 'rgba(0,0,0,0.6)', borderColor: '#22c55e' } } },
      navigator: { enabled: true, height: 40, outlineColor: '#334155', outlineWidth: 1, maskFill: 'rgba(34,197,94,0.08)', series: { color: '#3b82f6', lineWidth: 1 }, xAxis: { gridLineWidth: 0, labels: { style: { color: '#ffffffaa', fontSize: '10px' } } }, handles: { backgroundColor: '#22c55e', borderColor: '#16a34a', width: 20, height: 34 } },
      scrollbar: { enabled: false },
      rangeSelector: { enabled: false },
      xAxis: { gridLineWidth: 0, lineColor: '#1a233244', tickColor: '#1a233244', crosshair: { color: '#ffffff22', dashStyle: 'Dash', width: 1 }, labels: { style: { color: '#ffffffcc', fontSize: '11px' } }, overscroll: rightPad, minRange: Math.max((INTERVAL_MS[interval] || 86400000) * 2, 60000) },
      yAxis: [
        { labels: { align: 'right', x: -8, style: { color: '#ffffffcc', fontSize: '11px', cursor: 'ns-resize' }, formatter: function() { return '$' + this.value.toFixed(2); } }, height: '100%', gridLineWidth: 0, lineWidth: 0, crosshair: { color: '#ffffff22', dashStyle: 'Dash', width: 1 } }
      ],
      tooltip: { enabled: false },
      plotOptions: {
        candlestick: { color: down, upColor: up, lineColor: down, upLineColor: up, lineWidth: 1, pointPadding: 0.15, groupPadding: 0.1 },
        column: { borderRadius: 0, borderWidth: 0 },
        series: { animation: false, states: { hover: { enabled: false }, inactive: { opacity: 1 } } }
      },
      series: [
        { type: 'candlestick', id: 'price', name: symbol, data: ohlc, yAxis: 0, zIndex: 5 }
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
      // Y-axis scale drag: click on the price labels area (right of plot)
      var inYAxis = px > chart.plotLeft + chart.plotWidth && px < rect.width && py >= chart.plotTop && py <= chart.plotTop + chart.plotHeight;
      if (inYAxis) {
        dragRef.current = { mode: 'yscale', sy: e.clientY, yMin: yAxis.min, yMax: yAxis.max, yCenter: (yAxis.min + yAxis.max) / 2, yRange: yAxis.max - yAxis.min };
        container.style.cursor = 'ns-resize'; e.preventDefault(); return;
      }
      // Normal chart pan: inside plot area
      if (px < chart.plotLeft || px > chart.plotLeft + chart.plotWidth || py < chart.plotTop || py > chart.plotTop + chart.plotHeight) return;
      dragRef.current = { mode: 'pan', sx: e.clientX, sy: e.clientY, xMin: xAxis.min, xMax: xAxis.max, yMin: yAxis.min, yMax: yAxis.max, dMin: xAxis.dataMin, dMax: xAxis.dataMax };
      container.style.cursor = 'grabbing'; e.preventDefault();
    };
    var onMove = function(e) {
      var d = dragRef.current; if (!d) return;
      var chart = getChart(); if (!chart) return;
      var yAxis = chart.yAxis && chart.yAxis[0];
      // Y-axis scale mode: drag up = compress (zoom out), drag down = expand (zoom in)
      if (d.mode === 'yscale') {
        if (!yAxis) return;
        var dy = e.clientY - d.sy;
        var scaleFactor = Math.pow(1.005, dy); // each pixel = 0.5% scale change
        var newRange = d.yRange * scaleFactor;
        var minRange = d.yRange * 0.1;
        var maxRange = d.yRange * 10;
        if (newRange < minRange) newRange = minRange;
        if (newRange > maxRange) newRange = maxRange;
        yAxis.setExtremes(d.yCenter - newRange / 2, d.yCenter + newRange / 2, true, false);
        e.preventDefault(); return;
      }
      // Normal pan mode
      var xAxis = chart.xAxis && chart.xAxis[0];
      if (!xAxis || !yAxis) return;
      var xRange = d.xMax - d.xMin, yRange = d.yMax - d.yMin;
      if (xRange <= 0 || yRange <= 0) return;
      var dx = e.clientX - d.sx, panDy = e.clientY - d.sy;
      var xPx = xRange / Math.max(chart.plotWidth, 1), yPx = yRange / Math.max(chart.plotHeight, 1);
      var nxMin = d.xMin - dx * xPx, nxMax = d.xMax - dx * xPx;
      var right = d.dMax + rightPad;
      if (nxMin < d.dMin) { nxMax += d.dMin - nxMin; nxMin = d.dMin; }
      if (nxMax > right) { nxMin -= nxMax - right; nxMax = right; }
      var nyMin = d.yMin + panDy * yPx, nyMax = d.yMax + panDy * yPx;
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

  var handleSearchSubmit = function(sym) { var s = sym.toUpperCase(); setSearch(''); setShowSearch(false); setSymbol(s); savePrefs({ symbol: s }); };

  var handleNudge = function(direction) {
    var chart = chartObjRef.current;
    if (!chart) return;
    var xAxis = chart.xAxis && chart.xAxis[0];
    if (!xAxis || !Number.isFinite(xAxis.min) || !Number.isFinite(xAxis.max)) return;
    var range = xAxis.max - xAxis.min;
    var step = range * 0.15;
    var dMin = Number.isFinite(xAxis.dataMin) ? xAxis.dataMin : xAxis.min;
    var dMax = (Number.isFinite(xAxis.dataMax) ? xAxis.dataMax : xAxis.max) + rightPad;
    var nMin, nMax;
    if (direction === 'left') { nMin = Math.max(dMin, xAxis.min - step); nMax = nMin + range; }
    else { nMax = Math.min(dMax, xAxis.max + step); nMin = nMax - range; }
    xAxis.setExtremes(nMin, nMax, true, false);
  };

  var handleZoom = function(direction) {
    var chart = chartObjRef.current;
    if (!chart) return;
    var xAxis = chart.xAxis && chart.xAxis[0];
    if (!xAxis || !Number.isFinite(xAxis.min) || !Number.isFinite(xAxis.max)) return;
    var xRange = xAxis.max - xAxis.min;
    var factor = direction === 'in' ? 0.6 : 1.6;
    var center = xAxis.min + xRange / 2;
    var newRange = xRange * factor;
    var minR = (INTERVAL_MS[interval] || 86400000) * 2;
    if (newRange < minR) newRange = minR;
    var dMin = Number.isFinite(xAxis.dataMin) ? xAxis.dataMin : xAxis.min;
    var dMax = (Number.isFinite(xAxis.dataMax) ? xAxis.dataMax : xAxis.max) + rightPad;
    var nMin = center - newRange / 2, nMax = center + newRange / 2;
    if (nMin < dMin) { nMin = dMin; nMax = Math.min(dMax, dMin + newRange); }
    if (nMax > dMax) { nMax = dMax; nMin = Math.max(dMin, dMax - newRange); }
    xAxis.setExtremes(nMin, nMax, false, false);
    // Auto-fit Y
    var ps = chart.get('price'), yAxis = chart.yAxis && chart.yAxis[0];
    if (ps && ps.points && ps.points.length && yAxis) {
      var lo = Infinity, hi = -Infinity;
      for (var i = 0; i < ps.points.length; i++) { var p = ps.points[i]; if (p.x >= nMin && p.x <= nMax) { if (p.low < lo) lo = p.low; if (p.high > hi) hi = p.high; } }
      if (lo < Infinity) { var pad = (hi - lo) * 0.08 || hi * 0.02; yAxis.setExtremes(lo - pad, hi + pad, false, false); }
    }
    chart.redraw(false);
  };

  var handleDrawingTool = function(tool) {
    var chart = chartObjRef.current;
    if (!chart) return;
    if (tool.type === 'clearAll') {
      // Remove all annotations
      while (chart.annotations && chart.annotations.length > 0) {
        chart.removeAnnotation(chart.annotations[0]);
      }
      setActiveTool(null);
      return;
    }
    // Toggle tool
    if (activeTool === tool.type) {
      // Deselect
      chart.navigationBindings && chart.navigationBindings.deselectAnnotation && chart.navigationBindings.deselectAnnotation();
      setActiveTool(null);
    } else {
      setActiveTool(tool.type);
      // Trigger the Highcharts navigation binding
      if (chart.navigationBindings) {
        var binding = chart.navigationBindings.boundClassNames && chart.navigationBindings.boundClassNames['highcharts-' + tool.type];
        if (binding) {
          chart.navigationBindings.selectedButtonElement = null;
          chart.navigationBindings.selectedButton = binding;
        }
      }
    }
  };
  var fmt = function(v) { return v == null ? '—' : '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var fmtV = function(v) { if (!v) return '—'; if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'; if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K'; return v; };

  return (
    <div className="h-full w-full bg-transparent flex flex-col overflow-hidden">
      <style>{`
        .highcharts-navigator-handle { cursor: ew-resize !important; }
        .highcharts-navigator-handle:active { cursor: grabbing !important; }
        .highcharts-navigator-handle rect { rx: 6; ry: 6; filter: drop-shadow(0 0 6px rgba(34,197,94,0.4)); }
        .highcharts-navigator-handle path { stroke: #ffffff !important; stroke-width: 2.5 !important; stroke-linecap: round !important; }
        .highcharts-navigator-mask-inside { fill: rgba(34,197,94,0.06) !important; }
        .highcharts-navigator-outline { stroke: #334155 !important; }
        .highcharts-navigator-handle:hover rect { fill: #16a34a !important; }
      `}</style>
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
        <div className="flex items-center gap-2">
          {/* Search tab */}
          <div className="relative flex items-center" data-dd>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5">
              <span className="text-base">🔍</span>
              <input
                value={search}
                onChange={function(e) { setSearch(e.target.value.toUpperCase()); }}
                onKeyDown={function(e) { if (e.key === 'Enter' && search.trim()) handleSearchSubmit(search.trim()); }}
                placeholder="Search symbol…"
                className="bg-transparent text-white text-sm font-medium outline-none placeholder-gray-500 w-32"
              />
            </div>
          </div>
          {/* Zoom buttons */}
          <div className="flex items-center gap-0.5">
            <button onClick={function() { handleZoom('in'); }} title="Zoom In" className="w-8 h-8 flex items-center justify-center rounded-lg text-lg font-bold text-emerald-400 bg-white/5 border border-white/10 hover:bg-emerald-500/10 hover:border-emerald-500/40 transition-all">+</button>
            <button onClick={function() { handleZoom('out'); }} title="Zoom Out" className="w-8 h-8 flex items-center justify-center rounded-lg text-lg font-bold text-emerald-400 bg-white/5 border border-white/10 hover:bg-emerald-500/10 hover:border-emerald-500/40 transition-all">−</button>
          </div>
          {/* Color picker */}
          <div className="relative" data-dd>
            <button onClick={function() { setShowColors(!showColors); }} className="px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white bg-white/5 border border-white/10 hover:border-white/20 transition-colors flex items-center gap-2">
              <span className="w-4 h-4 rounded" style={{ background: theme.up }} />
              <span className="w-4 h-4 rounded" style={{ background: theme.down }} />
              <span className="text-xs text-gray-400">Theme</span>
            </button>
            {showColors && (
              <div className="absolute right-0 top-full mt-1 bg-black/90 border border-white/10 rounded-lg p-2 backdrop-blur-xl w-48 z-50">
                {CANDLE_THEMES.map(function(t, i) {
                  return (
                    <button key={i} onClick={function() { setTheme(t); setShowColors(false); savePrefs({ themeLabel: t.label }); }} className={'w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ' + (theme.label === t.label ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5')}>
                      <span className="w-4 h-4 rounded" style={{ background: t.up }} />
                      <span className="w-4 h-4 rounded" style={{ background: t.down }} />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Chart + Drawing toolbar */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Drawing tools sidebar */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1 py-2 px-1 border-r border-white/10">
          {DRAWING_TOOLS.map(function(tool) {
            var isActive = activeTool === tool.type;
            var isClear = tool.type === 'clearAll';
            return (
              <button
                key={tool.type}
                title={tool.title}
                onClick={function() { handleDrawingTool(tool); }}
                className={'w-9 h-9 flex items-center justify-center rounded-lg text-sm font-bold transition-all ' + (isClear ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300' : isActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-[0_0_8px_rgba(34,197,94,0.3)]' : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent')}
              >
                {tool.label}
              </button>
            );
          })}
        </div>
        {/* Chart */}
        <div ref={containerRef} className="flex-1 min-h-0 min-w-0" style={{ cursor: activeTool ? 'crosshair' : 'default' }} />
      </div>
      <div className="flex-shrink-0 flex items-center justify-center gap-2 py-2">
        {INTERVALS.map(function(iv) {
          return (
            <button key={iv.label} onClick={function() { setInterval_(iv.value); savePrefs({ interval: iv.value }); }} className={'px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ' + (interval === iv.value ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'text-gray-500 border border-transparent hover:text-white hover:bg-white/5')}>
              {iv.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
