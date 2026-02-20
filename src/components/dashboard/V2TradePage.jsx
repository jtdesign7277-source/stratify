import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Highcharts from 'highcharts/highstock';
import AnnotationsAdvanced from 'highcharts/modules/annotations-advanced';
import StockTools from 'highcharts/modules/stock-tools';
import {
  ChevronsLeft,
  ChevronsRight,
  GripVertical,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { subscribeTwelveDataQuotes, subscribeTwelveDataStatus } from '../../services/twelveDataWebSocket';

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
const TD_WS = 'wss://ws.twelvedata.com/v1/quotes/price';

const MAX_SYMBOLS = 120;
const WATCHLIST_PANEL_KEY = 'stratify-v2trade-watchlist-panel';
const PANEL_STATES = ['open', 'small', 'closed'];
const WATCHLIST_PANEL_WIDTHS = { open: 340, small: 296, closed: 82 };

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

const DEFAULT_WATCHLIST = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'TSLA', name: 'Tesla, Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.' },
  { symbol: 'META', name: 'Meta Platforms, Inc.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust' },
];

const SEARCH_FALLBACK = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'TSLA', name: 'Tesla, Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.' },
  { symbol: 'META', name: 'Meta Platforms, Inc.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'GOOG', name: 'Alphabet Inc. Class C' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust' },
  { symbol: 'DIA', name: 'SPDR Dow Jones ETF' },
  { symbol: 'IWM', name: 'iShares Russell 2000 ETF' },
  { symbol: 'GLD', name: 'SPDR Gold Shares' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
  { symbol: 'BAC', name: 'Bank of America Corp.' },
  { symbol: 'WFC', name: 'Wells Fargo & Company' },
  { symbol: 'V', name: 'Visa Inc.' },
  { symbol: 'MA', name: 'Mastercard Inc.' },
  { symbol: 'PYPL', name: 'PayPal Holdings, Inc.' },
  { symbol: 'NFLX', name: 'Netflix, Inc.' },
  { symbol: 'AMD', name: 'Advanced Micro Devices, Inc.' },
  { symbol: 'INTC', name: 'Intel Corporation' },
  { symbol: 'AVGO', name: 'Broadcom Inc.' },
  { symbol: 'CRM', name: 'Salesforce, Inc.' },
  { symbol: 'ADBE', name: 'Adobe Inc.' },
  { symbol: 'ORCL', name: 'Oracle Corporation' },
  { symbol: 'PLTR', name: 'Palantir Technologies Inc.' },
  { symbol: 'UBER', name: 'Uber Technologies, Inc.' },
  { symbol: 'ABNB', name: 'Airbnb, Inc.' },
  { symbol: 'HOOD', name: 'Robinhood Markets, Inc.' },
  { symbol: 'COIN', name: 'Coinbase Global, Inc.' },
  { symbol: 'SHOP', name: 'Shopify Inc.' },
  { symbol: 'SNOW', name: 'Snowflake Inc.' },
  { symbol: 'PANW', name: 'Palo Alto Networks, Inc.' },
  { symbol: 'CRWD', name: 'CrowdStrike Holdings, Inc.' },
  { symbol: 'MU', name: 'Micron Technology, Inc.' },
  { symbol: 'SMCI', name: 'Super Micro Computer, Inc.' },
  { symbol: 'ARM', name: 'Arm Holdings plc' },
  { symbol: 'XOM', name: 'Exxon Mobil Corporation' },
  { symbol: 'CVX', name: 'Chevron Corporation' },
  { symbol: 'WMT', name: 'Walmart Inc.' },
  { symbol: 'COST', name: 'Costco Wholesale Corporation' },
  { symbol: 'UNH', name: 'UnitedHealth Group Incorporated' },
  { symbol: 'JNJ', name: 'Johnson & Johnson' },
  { symbol: 'LLY', name: 'Eli Lilly and Company' },
  { symbol: 'PG', name: 'Procter & Gamble Company' },
  { symbol: 'HD', name: 'Home Depot, Inc.' },
  { symbol: 'DIS', name: 'Walt Disney Company' },
  { symbol: 'BA', name: 'Boeing Company' },
  { symbol: 'NKE', name: 'NIKE, Inc.' },
  { symbol: 'T', name: 'AT&T Inc.' },
  { symbol: 'PFE', name: 'Pfizer Inc.' },
  { symbol: 'MRK', name: 'Merck & Co., Inc.' },
  { symbol: 'ABBV', name: 'AbbVie Inc.' },
  { symbol: 'KO', name: 'Coca-Cola Company' },
  { symbol: 'PEP', name: 'PepsiCo, Inc.' },
  { symbol: 'MCD', name: "McDonald's Corporation" },
  { symbol: 'LOW', name: "Lowe's Companies, Inc." },
  { symbol: 'GE', name: 'GE Aerospace' },
  { symbol: 'CAT', name: 'Caterpillar Inc.' },
  { symbol: 'DE', name: 'Deere & Company' },
  { symbol: 'F', name: 'Ford Motor Company' },
  { symbol: 'GM', name: 'General Motors Company' },
];

const STORAGE_KEY = 'stratify-v2trade-prefs';
function loadPrefs() {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
function savePrefs(patch) {
  try { const cur = loadPrefs(); localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...cur, ...patch })); } catch {}
}

const normalizeSymbol = (value) =>
  String(value || '').trim().toUpperCase().replace(/^\$/, '').replace(/\s+/g, '').split(':')[0].split('.')[0];

const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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

const formatPrice = (value) => {
  const price = Number(value);
  if (!Number.isFinite(price)) return '--';
  if (price >= 1) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${price.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
};

const formatPercent = (value) => {
  const percent = Number(value);
  if (!Number.isFinite(percent)) return '--';
  return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
};

const formatTime = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleTimeString();
};

const loadPanelState = (key, fallback) => {
  if (typeof window === 'undefined') return fallback;
  try {
    const saved = String(localStorage.getItem(key) || '').trim();
    return PANEL_STATES.includes(saved) ? saved : fallback;
  } catch { return fallback; }
};

const getNextPanelState = (current) => {
  const index = PANEL_STATES.indexOf(current);
  if (index < 0) return PANEL_STATES[0];
  return PANEL_STATES[(index + 1) % PANEL_STATES.length];
};

async function fetchData(symbol, interval, outputsize) {
  const url = TD_REST + '/time_series?symbol=' + encodeURIComponent(symbol) + '&interval=' + encodeURIComponent(interval) + '&outputsize=' + outputsize + '&apikey=' + encodeURIComponent(TD_API_KEY) + '&format=JSON&order=ASC&prepost=true';
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
  return { ohlc, volume };
}

export default function V2TradePage({
  watchlist = [],
  onAddToWatchlist,
  onRemoveFromWatchlist,
  onReorderWatchlist,
}) {
  // --- Watchlist state ---
  const [watchlistPanelState, setWatchlistPanelState] = useState(() => loadPanelState(WATCHLIST_PANEL_KEY, 'small'));
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [quotesBySymbol, setQuotesBySymbol] = useState({});
  const [wlLoading, setWlLoading] = useState(false);
  const [wlError, setWlError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [streamStatus, setStreamStatus] = useState({ connected: false, connecting: false, error: null, retryCount: 0 });
  const [draggingSymbol, setDraggingSymbol] = useState(null);
  const [dragOverSymbol, setDragOverSymbol] = useState(null);
  const searchDebounceRef = useRef(null);
  const refreshInFlightRef = useRef(false);

  // --- Chart state ---
  const containerRef = useRef(null);
  const chartObjRef = useRef(null);
  const dragChartRef = useRef(null);
  const prefs = useMemo(loadPrefs, []);
  const [symbol, setSymbol] = useState(prefs.symbol || 'AAPL');
  const [interval, setInterval_] = useState(prefs.interval || '1day');
  const [theme, setTheme] = useState(CANDLE_THEMES.find(function(t) { return t.label === prefs.themeLabel; }) || CANDLE_THEMES[0]);
  const [showColors, setShowColors] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const [chartLoading, setChartLoading] = useState(true);
  const [hover, setHover] = useState({ o: null, h: null, l: null, c: null, v: null });
  const rightPad = useMemo(function() { return (INTERVAL_MS[interval] || 86400000) * 15; }, [interval]);

  // --- Watchlist panel persistence ---
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem(WATCHLIST_PANEL_KEY, watchlistPanelState);
  }, [watchlistPanelState]);

  // --- Normalize watchlist ---
  const normalizedWatchlist = useMemo(() => {
    const source = Array.isArray(watchlist) && watchlist.length > 0 ? watchlist : DEFAULT_WATCHLIST;
    const seen = new Set();
    return source
      .map((item) => {
        const sym = normalizeSymbol(typeof item === 'string' ? item : item?.symbol);
        if (!sym) return null;
        const name = typeof item === 'object' && item?.name ? item.name : sym;
        return { symbol: sym, name };
      })
      .filter((item) => {
        if (!item?.symbol || seen.has(item.symbol)) return false;
        seen.add(item.symbol);
        return true;
      });
  }, [watchlist]);

  const visibleWatchlist = useMemo(() => normalizedWatchlist.slice(0, MAX_SYMBOLS), [normalizedWatchlist]);
  const activeSymbols = useMemo(() => visibleWatchlist.map((item) => item.symbol), [visibleWatchlist]);

  const labelMap = useMemo(() => {
    const map = {};
    SEARCH_FALLBACK.forEach((item) => { map[item.symbol] = item.name; });
    visibleWatchlist.forEach((item) => { map[item.symbol] = item.name || map[item.symbol] || item.symbol; });
    return map;
  }, [visibleWatchlist]);

  // --- Refresh quotes via REST ---
  const refreshQuotes = useCallback(async ({ manual = false } = {}) => {
    if (activeSymbols.length === 0) { setQuotesBySymbol({}); return; }
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    if (manual) setIsRefreshing(true);
    setWlLoading(true);
    try {
      const response = await fetch('/api/watchlist/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: activeSymbols }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Failed to load watchlist quotes');
      const map = {};
      (Array.isArray(payload?.data) ? payload.data : []).forEach((row) => {
        const sym = normalizeSymbol(row?.symbol);
        if (!sym) return;
        map[sym] = {
          ...row, symbol: sym,
          name: row?.name || labelMap[sym] || sym,
          dayBaselinePrice: Number.isFinite(toNumber(row?.change))
            ? (toNumber(row?.price) ?? 0) - toNumber(row?.change)
            : (Number.isFinite(toNumber(row?.price)) && Number.isFinite(toNumber(row?.percentChange)) && toNumber(row?.percentChange) !== -100
                ? toNumber(row?.price) / (1 + toNumber(row?.percentChange) / 100) : null),
          source: 'rest',
        };
      });
      setQuotesBySymbol(map);
      setLastUpdated(new Date().toISOString());
      setWlError('');
    } catch (err) { setWlError(err?.message || 'Failed to refresh quotes'); }
    finally { setWlLoading(false); if (manual) setIsRefreshing(false); refreshInFlightRef.current = false; }
  }, [activeSymbols, labelMap]);

  useEffect(() => { refreshQuotes({ manual: false }); }, [refreshQuotes]);

  // --- Twelve Data WebSocket for watchlist quotes ---
  useEffect(() => {
    if (activeSymbols.length === 0) return undefined;
    const unsubQuotes = subscribeTwelveDataQuotes(activeSymbols, (update) => {
      const sym = normalizeSymbol(update?.symbol);
      if (!sym) return;
      setQuotesBySymbol((prev) => {
        const cur = prev[sym] || {};
        const nextPrice = toNumber(update?.price);
        const baseline = toNumber(cur?.dayBaselinePrice) ?? (
          Number.isFinite(toNumber(cur?.price)) && Number.isFinite(toNumber(cur?.percentChange)) && toNumber(cur?.percentChange) !== -100
            ? toNumber(cur?.price) / (1 + toNumber(cur?.percentChange) / 100) : null
        );
        const derivedPct = Number.isFinite(nextPrice) && Number.isFinite(baseline) && baseline !== 0
          ? ((nextPrice - baseline) / baseline) * 100 : null;
        const nextChange = Number.isFinite(nextPrice) && Number.isFinite(baseline) ? nextPrice - baseline : toNumber(update?.change) ?? toNumber(cur?.change);
        return {
          ...prev,
          [sym]: {
            ...cur, symbol: sym,
            name: cur?.name || labelMap[sym] || sym,
            price: Number.isFinite(nextPrice) ? nextPrice : cur?.price ?? null,
            change: nextChange,
            percentChange: Number.isFinite(toNumber(update?.percentChange)) ? toNumber(update?.percentChange)
              : Number.isFinite(derivedPct) ? derivedPct : cur?.percentChange ?? null,
            dayBaselinePrice: baseline,
            timestamp: update?.timestamp || new Date().toISOString(),
            source: 'ws',
          },
        };
      });
      setLastUpdated(new Date().toISOString());
    });
    const unsubStatus = subscribeTwelveDataStatus((status) => {
      setStreamStatus(status || { connected: false, connecting: false, error: null, retryCount: 0 });
      if (status?.error) setWlError(status.error);
    });
    return () => { unsubQuotes?.(); unsubStatus?.(); };
  }, [activeSymbols, labelMap]);

  // --- Search ---
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); setSearchLoading(false); return; }
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    const query = searchQuery.trim().toUpperCase();
    const activeSet = new Set(activeSymbols);
    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await fetch(`/api/global-markets/list?market=nyse&q=${encodeURIComponent(query)}&limit=40`, { cache: 'no-store' });
        const payload = await response.json().catch(() => ({}));
        const upstream = response.ok && Array.isArray(payload?.data)
          ? payload.data.map((item) => ({ symbol: normalizeSymbol(item?.symbol), name: item?.instrumentName || item?.name || item?.symbol, exchange: item?.exchange || '' }))
          : [];
        const fallback = SEARCH_FALLBACK.filter((item) => item.symbol.includes(query) || item.name.toUpperCase().includes(query));
        const merged = [...upstream, ...fallback]
          .filter((item) => item.symbol && !activeSet.has(item.symbol))
          .reduce((acc, item) => { if (!acc.some((e) => e.symbol === item.symbol)) acc.push(item); return acc; }, [])
          .slice(0, 20);
        setSearchResults(merged);
      } catch {
        setSearchResults(SEARCH_FALLBACK.filter((item) => item.symbol.includes(query) || item.name.toUpperCase().includes(query)).filter((item) => !activeSet.has(item.symbol)).slice(0, 20));
      } finally { setSearchLoading(false); }
    }, 220);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchQuery, activeSymbols]);

  // --- Select first symbol if none selected ---
  useEffect(() => {
    if (!activeSymbols.includes(symbol) && activeSymbols.length > 0) {
      setSymbol(activeSymbols[0]);
      savePrefs({ symbol: activeSymbols[0] });
    }
  }, [activeSymbols, symbol]);

  // --- Watchlist actions ---
  const addSymbolToWatchlist = useCallback((sym, name) => {
    const normalized = normalizeSymbol(sym);
    if (!normalized || activeSymbols.includes(normalized)) return;
    if (activeSymbols.length >= MAX_SYMBOLS) { setWlError(`Watchlist limit reached (${MAX_SYMBOLS} symbols)`); return; }
    onAddToWatchlist?.({ symbol: normalized, name: name || labelMap[normalized] || normalized });
    setSearchQuery('');
    setSearchResults([]);
    setWlError('');
  }, [activeSymbols, labelMap, onAddToWatchlist]);

  const handleDirectAdd = useCallback(() => {
    const normalized = normalizeSymbol(searchQuery);
    if (!normalized) return;
    const exactResult = searchResults.find((item) => item.symbol === normalized);
    addSymbolToWatchlist(normalized, exactResult?.name || labelMap[normalized]);
  }, [addSymbolToWatchlist, labelMap, searchQuery, searchResults]);

  const moveWatchlistSymbol = useCallback((src, tgt) => {
    const from = normalizeSymbol(src), to = normalizeSymbol(tgt);
    if (!from || !to || from === to || typeof onReorderWatchlist !== 'function') return;
    const fi = normalizedWatchlist.findIndex((item) => item.symbol === from);
    const ti = normalizedWatchlist.findIndex((item) => item.symbol === to);
    if (fi < 0 || ti < 0) return;
    const reordered = [...normalizedWatchlist];
    const [moved] = reordered.splice(fi, 1);
    if (!moved) return;
    reordered.splice(ti, 0, moved);
    onReorderWatchlist(reordered);
  }, [normalizedWatchlist, onReorderWatchlist]);

  const handleRowDragStart = useCallback((event, sym) => {
    const normalized = normalizeSymbol(sym);
    if (!normalized) return;
    setDraggingSymbol(normalized);
    setDragOverSymbol(normalized);
    try { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', normalized); } catch {}
  }, []);

  const handleRowDragOver = useCallback((event, sym) => {
    const normalized = normalizeSymbol(sym);
    if (!draggingSymbol || !normalized || draggingSymbol === normalized) return;
    event.preventDefault();
    setDragOverSymbol(normalized);
  }, [draggingSymbol]);

  const handleRowDrop = useCallback((event, sym) => {
    event.preventDefault();
    const tgt = normalizeSymbol(sym);
    let src;
    try { src = normalizeSymbol(event.dataTransfer.getData('text/plain')); } catch { src = ''; }
    const normalizedSrc = normalizeSymbol(draggingSymbol || src);
    if (normalizedSrc && tgt && normalizedSrc !== tgt) moveWatchlistSymbol(normalizedSrc, tgt);
    setDraggingSymbol(null);
    setDragOverSymbol(null);
  }, [draggingSymbol, moveWatchlistSymbol]);

  const handleRowDragEnd = useCallback(() => { setDraggingSymbol(null); setDragOverSymbol(null); }, []);

  const isWatchlistCollapsed = watchlistPanelState === 'closed';
  const cycleWatchlistPanel = () => setWatchlistPanelState((prev) => getNextPanelState(prev));

  // --- Select ticker from watchlist ---
  const selectTicker = useCallback((sym) => {
    setSymbol(sym);
    savePrefs({ symbol: sym });
  }, []);

  // --- Chart logic (identical to original) ---
  const loadChart = useCallback(async function() {
    setChartLoading(true);
    const result = await fetchData(symbol, interval, 500);
    const ohlc = result.ohlc;
    const volume = result.volume;
    if (ohlc.length) {
      const last = ohlc[ohlc.length - 1];
      setHover({ o: last[1], h: last[2], l: last[3], c: last[4], v: volume[volume.length - 1] ? volume[volume.length - 1].y : 0 });
    }
    if (chartObjRef.current) { chartObjRef.current.destroy(); chartObjRef.current = null; }
    if (!containerRef.current) { setChartLoading(false); return; }
    const up = theme.up, down = theme.down;
    var chart = Highcharts.stockChart(containerRef.current, {
      chart: { backgroundColor: 'transparent', style: { fontFamily: "'SF Pro Display', -apple-system, sans-serif" }, animation: false, spacing: [8, 8, 0, 8], panning: { enabled: false }, zooming: { type: undefined, mouseWheel: { enabled: false }, pinchType: 'x' } },
      credits: { enabled: false }, title: { text: '' },
      stockTools: { gui: { enabled: false } },
      navigation: { bindings: { verticalLine: { className: 'highcharts-verticalLine' }, infinityLine: { className: 'highcharts-infinityLine' }, crookedLine: { className: 'highcharts-crookedLine' }, parallelChannel: { className: 'highcharts-parallelChannel' }, fibonacci: { className: 'highcharts-fibonacci' } }, annotationsOptions: { shapeOptions: { stroke: '#22c55e', strokeWidth: 2 }, labelOptions: { style: { color: '#ffffff', fontSize: '11px' }, backgroundColor: 'rgba(0,0,0,0.6)', borderColor: '#22c55e' } } },
      navigator: { enabled: true, height: 40, outlineColor: '#334155', outlineWidth: 1, maskFill: 'rgba(34,197,94,0.08)', series: { color: '#3b82f6', lineWidth: 1 }, xAxis: { gridLineWidth: 0, labels: { style: { color: '#ffffffaa', fontSize: '10px' } } }, handles: { backgroundColor: '#3b82f6', borderColor: '#2563eb', width: 20, height: 34 } },
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
    setChartLoading(false);
  }, [symbol, interval, theme, rightPad]);

  useEffect(function() { loadChart(); }, [loadChart]);
  useEffect(function() { return function() { if (chartObjRef.current) { chartObjRef.current.destroy(); chartObjRef.current = null; } }; }, []);

  // Twelve Data WebSocket for live chart updates
  var wsRef = useRef(null);
  var [isLive, setIsLive] = useState(false);
  useEffect(function() {
    var liveIntervals = ['1min', '5min', '15min', '1h'];
    if (!liveIntervals.includes(interval) || !TD_API_KEY) { setIsLive(false); return; }
    var cancelled = false;
    var ws = new WebSocket(TD_WS + '?apikey=' + encodeURIComponent(TD_API_KEY));
    wsRef.current = ws;
    ws.onopen = function() { ws.send(JSON.stringify({ action: 'subscribe', params: { symbols: symbol } })); setIsLive(true); };
    ws.onmessage = function(e) {
      try {
        var m = JSON.parse(e.data);
        if (m.event !== 'price') return;
        var p = parseFloat(m.price);
        var chart = chartObjRef.current;
        if (!chart) return;
        var ps = chart.get('price');
        if (!ps || !ps.points || !ps.points.length) return;
        var lp = ps.points[ps.points.length - 1];
        if (!lp) return;
        var o = lp.open, h = Math.max(lp.high, p), l = Math.min(lp.low, p);
        lp.update({ open: o, high: h, low: l, close: p }, true, false);
        setHover(function(prev) { return { o: o, h: h, l: l, c: p, v: prev.v }; });
      } catch {}
    };
    ws.onclose = function() { if (!cancelled) setIsLive(false); };
    ws.onerror = function() { if (!cancelled) setIsLive(false); };
    return function() {
      cancelled = true;
      try { ws.send(JSON.stringify({ action: 'unsubscribe', params: { symbols: symbol } })); } catch {}
      try { ws.close(); } catch {}
      wsRef.current = null;
      setIsLive(false);
    };
  }, [symbol, interval]);

  // Custom pan/zoom/yscale handlers
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
      var inYAxis = px > chart.plotLeft + chart.plotWidth && px < rect.width && py >= chart.plotTop && py <= chart.plotTop + chart.plotHeight;
      if (inYAxis) {
        dragChartRef.current = { mode: 'yscale', sy: e.clientY, yMin: yAxis.min, yMax: yAxis.max, yCenter: (yAxis.min + yAxis.max) / 2, yRange: yAxis.max - yAxis.min };
        container.style.cursor = 'ns-resize'; e.preventDefault(); return;
      }
      if (px < chart.plotLeft || px > chart.plotLeft + chart.plotWidth || py < chart.plotTop || py > chart.plotTop + chart.plotHeight) return;
      dragChartRef.current = { mode: 'pan', sx: e.clientX, sy: e.clientY, xMin: xAxis.min, xMax: xAxis.max, yMin: yAxis.min, yMax: yAxis.max, dMin: xAxis.dataMin, dMax: xAxis.dataMax };
      container.style.cursor = 'grabbing'; e.preventDefault();
    };
    var onMove = function(e) {
      var d = dragChartRef.current; if (!d) return;
      var chart = getChart(); if (!chart) return;
      var yAxis = chart.yAxis && chart.yAxis[0];
      if (d.mode === 'yscale') {
        if (!yAxis) return;
        var dy = e.clientY - d.sy;
        var scaleFactor = Math.pow(1.005, dy);
        var newRange = d.yRange * scaleFactor;
        var minRange = d.yRange * 0.1, maxRange = d.yRange * 10;
        if (newRange < minRange) newRange = minRange;
        if (newRange > maxRange) newRange = maxRange;
        yAxis.setExtremes(d.yCenter - newRange / 2, d.yCenter + newRange / 2, true, false);
        e.preventDefault(); return;
      }
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
    var onUp = function() { if (!dragChartRef.current) return; dragChartRef.current = null; container.style.cursor = 'crosshair'; };
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
      var nMin = center - newRange * ratio, nMax = center + newRange * (1 - ratio);
      var minR = (INTERVAL_MS[interval] || 86400000) * 2;
      if (nMax - nMin < minR) { nMin = center - minR * ratio; nMax = center + minR * (1 - ratio); }
      var dMin = Number.isFinite(xAxis.dataMin) ? xAxis.dataMin : nMin;
      var dMax = (Number.isFinite(xAxis.dataMax) ? xAxis.dataMax : nMax) + rightPad;
      if (nMin < dMin) nMin = dMin;
      if (nMax > dMax) nMax = dMax;
      xAxis.setExtremes(nMin, nMax, false, false);
      var ps = chart.get('price'), yA = chart.yAxis && chart.yAxis[0];
      if (ps && ps.points && ps.points.length && yA) {
        var lo = Infinity, hi = -Infinity;
        for (var i = 0; i < ps.points.length; i++) { var p = ps.points[i]; if (p.x >= nMin && p.x <= nMax) { if (p.low < lo) lo = p.low; if (p.high > hi) hi = p.high; } }
        if (lo < Infinity) { var pad = (hi - lo) * 0.08 || hi * 0.02; yA.setExtremes(lo - pad, hi + pad, false, false); }
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
      dragChartRef.current = null;
    };
  }, [rightPad, interval]);

  // Close dropdowns on outside click
  useEffect(function() {
    var fn = function(e) { if (!e.target.closest('[data-dd]')) setShowColors(false); };
    document.addEventListener('mousedown', fn);
    return function() { document.removeEventListener('mousedown', fn); };
  }, []);

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
      while (chart.annotations && chart.annotations.length > 0) chart.removeAnnotation(chart.annotations[0]);
      setActiveTool(null);
      return;
    }
    if (activeTool === tool.type) {
      chart.navigationBindings && chart.navigationBindings.deselectAnnotation && chart.navigationBindings.deselectAnnotation();
      setActiveTool(null);
    } else {
      setActiveTool(tool.type);
      if (chart.navigationBindings) {
        var binding = chart.navigationBindings.boundClassNames && chart.navigationBindings.boundClassNames['highcharts-' + tool.type];
        if (binding) { chart.navigationBindings.selectedButtonElement = null; chart.navigationBindings.selectedButton = binding; }
      }
    }
  };

  var fmt = function(v) { return v == null ? '—' : '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var fmtV = function(v) { if (!v) return '—'; if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'; if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K'; return v; };

  const selectedName = labelMap[symbol] || symbol;

  return (
    <div className="h-full w-full bg-transparent flex overflow-hidden">
      <style>{`
        .highcharts-navigator-handle { cursor: ew-resize !important; }
        .highcharts-navigator-handle:active { cursor: grabbing !important; }
        .highcharts-navigator-handle rect { rx: 6; ry: 6; filter: drop-shadow(0 0 6px rgba(59,130,246,0.4)); }
        .highcharts-navigator-handle path { stroke: #ffffff !important; stroke-width: 2.5 !important; stroke-linecap: round !important; }
        .highcharts-navigator-mask-inside { fill: rgba(59,130,246,0.06) !important; }
        .highcharts-navigator-outline { stroke: #334155 !important; }
        .highcharts-navigator-handle:hover rect { fill: #2563eb !important; }
      `}</style>

      {/* ========== WATCHLIST SIDEBAR ========== */}
      <div
        className="relative z-10 flex flex-col border-r border-[#1f1f1f] transition-all duration-300 flex-shrink-0"
        style={{ width: WATCHLIST_PANEL_WIDTHS[watchlistPanelState] }}
      >
        <div className="flex items-center justify-between border-b border-[#1f1f1f] px-3 py-3">
          {!isWatchlistCollapsed ? (
            <div>
              <h1 className="text-base font-semibold text-white">Watchlist</h1>
              <p className="text-[11px] text-gray-400">Twelve Data live stream</p>
            </div>
          ) : <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">WL</span>}
          <button
            type="button"
            onClick={cycleWatchlistPanel}
            className="inline-flex items-center gap-1 rounded-md border border-emerald-500/35 bg-emerald-500/5 px-2 py-1 text-[11px] font-medium text-emerald-300 transition hover:bg-emerald-500/12 hover:text-emerald-200"
            title="Resize watchlist panel"
          >
            {isWatchlistCollapsed ? <ChevronsRight className="h-3.5 w-3.5" strokeWidth={1.5} /> : <ChevronsLeft className="h-3.5 w-3.5" strokeWidth={1.5} />}
            {!isWatchlistCollapsed && <span>{watchlistPanelState === 'open' ? 'Large' : 'Small'}</span>}
          </button>
        </div>

        {!isWatchlistCollapsed ? (
          <>
            <div className="relative z-20 border-b border-[#1f1f1f] px-3 py-3">
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                <Search className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (searchResults.length > 0) addSymbolToWatchlist(searchResults[0].symbol, searchResults[0].name);
                      else handleDirectAdd();
                    }
                  }}
                  placeholder="Search ticker or company"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
                />
                {searchQuery ? (
                  <button type="button" onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="rounded p-0.5 text-gray-500 hover:text-white">
                    <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                ) : null}
                <button type="button" onClick={handleDirectAdd} className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20">
                  <Plus className="h-3 w-3" strokeWidth={1.5} />
                  Add
                </button>
              </div>

              {searchQuery.trim() ? (
                <div className="absolute left-3 right-3 top-[100%] mt-1 max-h-72 overflow-y-auto rounded-lg border border-white/10 bg-[#060d18]/95 p-1 shadow-2xl" style={{ scrollbarWidth: 'none' }}>
                  {searchLoading ? (
                    <div className="px-2 py-2 text-xs text-gray-400">Searching symbols...</div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((result) => (
                      <button
                        key={result.symbol}
                        type="button"
                        onClick={() => addSymbolToWatchlist(result.symbol, result.name)}
                        className="flex w-full items-center justify-between rounded px-2 py-2 text-left hover:bg-blue-500/10"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white">${result.symbol}</div>
                          <div className="truncate text-[11px] text-gray-400">{result.name || result.symbol}</div>
                        </div>
                        <Plus className="h-3.5 w-3.5 text-blue-300" strokeWidth={1.5} />
                      </button>
                    ))
                  ) : (
                    <div className="px-2 py-2 text-xs text-gray-400">No symbols found</div>
                  )}
                </div>
              ) : null}

              <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
                <span>{activeSymbols.length}/{MAX_SYMBOLS} symbols</span>
                <span className={`inline-flex items-center gap-1 ${streamStatus.connected ? 'text-emerald-400' : streamStatus.connecting ? 'text-yellow-400' : 'text-gray-400'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${streamStatus.connected ? 'animate-pulse bg-emerald-400' : streamStatus.connecting ? 'bg-yellow-400' : 'bg-gray-500'}`} />
                  {streamStatus.connected ? 'Live' : streamStatus.connecting ? 'Connecting...' : 'Offline'}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] text-gray-500">Last tick: {formatTime(lastUpdated)}</span>
                <button
                  type="button"
                  onClick={() => refreshQuotes({ manual: true })}
                  className="inline-flex items-center gap-1 rounded border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-300 hover:bg-blue-500/20"
                >
                  <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} strokeWidth={1.5} />
                  {isRefreshing ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>

              {wlError ? (
                <div className="mt-2 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-300">{wlError}</div>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
              {wlLoading && visibleWatchlist.length === 0 ? (
                <div className="px-3 py-5 text-sm text-gray-400">Loading watchlist...</div>
              ) : null}

              {visibleWatchlist.map((item) => {
                const quote = quotesBySymbol[item.symbol] || {};
                const pct = Number(quote?.percentChange);
                const positive = Number.isFinite(pct) ? pct >= 0 : true;
                const rowActive = symbol === item.symbol;
                const rowDragging = draggingSymbol === item.symbol;
                const rowDropTarget = dragOverSymbol === item.symbol && draggingSymbol && draggingSymbol !== item.symbol;

                return (
                  <button
                    key={item.symbol}
                    type="button"
                    draggable
                    onDragStart={(e) => handleRowDragStart(e, item.symbol)}
                    onDragOver={(e) => handleRowDragOver(e, item.symbol)}
                    onDrop={(e) => handleRowDrop(e, item.symbol)}
                    onDragEnd={handleRowDragEnd}
                    onClick={() => selectTicker(item.symbol)}
                    className={`flex w-full items-center justify-between gap-1 border-b border-[#1f1f1f]/40 px-3 py-2 text-left transition-colors ${
                      rowActive ? 'bg-blue-500/10' : 'hover:bg-white/[0.03]'
                    } ${rowDragging ? 'cursor-grabbing opacity-70' : 'cursor-grab'} ${
                      rowDropTarget ? 'bg-cyan-500/10 ring-1 ring-inset ring-cyan-400/45' : ''
                    }`}
                  >
                    <span className="mr-1 text-gray-600">
                      <GripVertical className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </span>
                    <div className="min-w-0 flex-1 pr-1">
                      <div className="text-[13px] font-semibold text-white">${item.symbol}</div>
                      <div className="truncate text-[11px] text-gray-500">{item.name || labelMap[item.symbol] || item.symbol}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="min-w-[76px] text-right">
                        <div className="text-[13px] font-mono text-white">{formatPrice(quote?.price)}</div>
                        <div className={`text-[11px] font-medium ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                          {formatPercent(quote?.percentChange)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onRemoveFromWatchlist?.(item.symbol); }}
                        className="rounded p-1 text-gray-500 hover:bg-red-500/15 hover:text-red-400"
                        title="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="px-2 py-3 text-center text-[10px] text-gray-500">
            {activeSymbols.length}<br />symbols
          </div>
        )}
      </div>

      {/* ========== CHART AREA ========== */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Top bar: OHLCV + controls */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-[#1f1f1f]">
          <div className="flex items-center gap-4 text-base font-mono">
            <div>
              <span className="text-white font-bold text-xl">{symbol}</span>
              <span className="text-xs text-gray-400 ml-2">{selectedName !== symbol ? selectedName : ''}</span>
            </div>
            {isLive && <span className="flex items-center gap-1 text-xs text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />LIVE</span>}
            {(function() { var now = new Date(); var parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour12: false, hour: '2-digit', minute: '2-digit', weekday: 'short' }).formatToParts(now); var wd = (parts.find(function(p){return p.type==='weekday'})||{}).value||''; var hr = Number((parts.find(function(p){return p.type==='hour'})||{}).value||0); var mn = Number((parts.find(function(p){return p.type==='minute'})||{}).value||0); var mins = hr*60+mn; var isWeekend = wd==='Sat'||wd==='Sun'; if(isWeekend) return <span className="text-[10px] text-white/30 uppercase tracking-widest">Closed</span>; if(mins>=240&&mins<570) return <span className="text-[10px] text-amber-400/80 uppercase tracking-widest">Pre-Market</span>; if(mins>=570&&mins<960) return <span className="text-[10px] text-emerald-400/80 uppercase tracking-widest">Market Open</span>; if(mins>=960&&mins<1200) return <span className="text-[10px] text-blue-400/80 uppercase tracking-widest">After Hours</span>; return <span className="text-[10px] text-white/30 uppercase tracking-widest">Closed</span>; })()}
            <span className="text-white/40">O <span className="text-white/70">{fmt(hover.o)}</span></span>
            <span className="text-white/40">H <span className="text-emerald-400/80">{fmt(hover.h)}</span></span>
            <span className="text-white/40">L <span className="text-red-400/80">{fmt(hover.l)}</span></span>
            <span className="text-white/40">C <span className="text-white/70">{fmt(hover.c)}</span></span>
            <span className="text-white/40">V <span className="text-white/50">{fmtV(hover.v)}</span></span>
            {chartLoading && <span className="text-cyan-300 animate-pulse">Loading…</span>}
          </div>
          <div className="flex items-center gap-2">
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

        {/* Bottom controls: zoom + intervals */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1 py-2 border-t border-[#1f1f1f]">
          <div className="flex items-center gap-1">
            <button onClick={function() { handleZoom('in'); }} title="Zoom In" className="w-8 h-8 flex items-center justify-center rounded-lg text-lg font-bold text-emerald-400 bg-white/5 border border-white/10 hover:bg-emerald-500/10 hover:border-emerald-500/40 transition-all">+</button>
            <button onClick={function() { handleZoom('out'); }} title="Zoom Out" className="w-8 h-8 flex items-center justify-center rounded-lg text-lg font-bold text-emerald-400 bg-white/5 border border-white/10 hover:bg-emerald-500/10 hover:border-emerald-500/40 transition-all">−</button>
          </div>
          <div className="flex items-center gap-1">
            {INTERVALS.map(function(iv) {
              return (
                <button key={iv.label} onClick={function() { setInterval_(iv.value); savePrefs({ interval: iv.value }); }} className={'px-3 py-1 text-sm font-semibold rounded transition-colors ' + (interval === iv.value ? 'text-emerald-400' : 'text-gray-500 hover:text-white')}>
                  {iv.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
