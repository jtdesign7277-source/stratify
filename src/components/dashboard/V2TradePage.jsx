import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, X, Trash2, ChevronsLeft, GripVertical, Pin } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import Highcharts from 'highcharts/highstock';
import DataModule from 'highcharts/modules/data';
import ExportingModule from 'highcharts/modules/exporting';
import ExportDataModule from 'highcharts/modules/export-data';
import AccessibilityModule from 'highcharts/modules/accessibility';
import AnnotationsAdvancedModule from 'highcharts/modules/annotations-advanced';
import StockToolsModule from 'highcharts/modules/stock-tools';
import HollowCandlestickModule from 'highcharts/modules/hollowcandlestick';
import IndicatorsModule from 'highcharts/indicators/indicators';
import IchimokuModule from 'highcharts/indicators/ichimoku-kinko-hyo';
import { subscribeTwelveDataQuotes, subscribeTwelveDataStatus } from '../../services/twelveDataWebSocket';
import { STOCK_DATABASE, DEFAULT_EQUITY_WATCHLIST } from './TradePage';
import { CHART_PRESETS, buildChartOptions } from './charts/chartPresets';

const V2_WATCHLIST_KEY = 'stratify-v2-trade-watchlist';
const V2_WATCHLIST_STATE_KEY = 'stratify-v2-trade-watchlist-state';
const V2_PINNED_TABS_KEY = 'stratify-v2-trade-pinned-tabs';

const stateWidths = { open: 384, small: 280, closed: 80 };
const LIVE_CHART_PRESETS = CHART_PRESETS.filter((preset) => preset.id !== 'order-book-live');
const PRESET_INTERVAL_MAP = {
  'dark-intraday-oval': '1min',
  'stock-tools-popup-events': '5min',
  'aapl-basic-exact': '1day',
  'candlestick-basic': '1day',
  'technical-annotations': '1day',
  'volume-proportional-width': '1day',
  'candlestick-volume-ikh': '1day',
  'styled-crosshair-candles': '1day',
};
const OHLC_ONLY_PRESETS = new Set([
  'aapl-basic-exact',
  'candlestick-basic',
  'technical-annotations',
  'dark-intraday-oval',
]);
const INTERVAL_MS = {
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

const initModule = (moduleFactory) => {
  try {
    const fn = moduleFactory?.default || moduleFactory;
    if (typeof fn === 'function') fn(Highcharts);
  } catch (error) {
    console.warn('[V.2_Trade] Highcharts module init failed:', error);
  }
};

initModule(DataModule);
initModule(ExportingModule);
initModule(ExportDataModule);
initModule(AccessibilityModule);
initModule(AnnotationsAdvancedModule);
initModule(StockToolsModule);
initModule(HollowCandlestickModule);
initModule(IndicatorsModule);
initModule(IchimokuModule);

if (typeof window !== 'undefined' && !window.Highcharts) {
  window.Highcharts = Highcharts;
}

const toNumber = (value) => {
  if (typeof value === 'number') return value;
  if (value == null) return NaN;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const getPresetInterval = (presetId) => PRESET_INTERVAL_MAP[presetId] || '1day';

const normalizeWsSymbol = (value) => String(value || '').trim().toUpperCase().replace(/^\$/, '').split(':')[0].split('.')[0];

const toTimestampMs = (value) => {
  if (value == null) return NaN;
  if (typeof value === 'number') return value > 10_000_000_000 ? value : value * 1000;
  const raw = String(value).trim();
  if (!raw) return NaN;
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  let ts = Date.parse(normalized);
  if (!Number.isFinite(ts)) ts = Date.parse(`${normalized}Z`);
  return ts;
};

const normalizeWatchlistItem = (item) => {
  if (!item) return null;
  if (typeof item === 'string') {
    const symbol = item.trim().toUpperCase();
    if (!symbol) return null;
    const stockInfo = STOCK_DATABASE.find((stock) => stock.symbol === symbol);
    return { symbol, name: stockInfo?.name || symbol };
  }
  const symbol = String(item.symbol || '').trim().toUpperCase();
  if (!symbol) return null;
  return {
    symbol,
    name: item.name || STOCK_DATABASE.find((stock) => stock.symbol === symbol)?.name || symbol,
  };
};

const normalizeWatchlist = (value) => {
  const source = Array.isArray(value) ? value : DEFAULT_EQUITY_WATCHLIST;
  const seen = new Set();
  const normalized = [];

  source.forEach((item) => {
    const next = normalizeWatchlistItem(item);
    if (!next || seen.has(next.symbol)) return;
    seen.add(next.symbol);
    normalized.push(next);
  });

  return normalized.length > 0
    ? normalized
    : DEFAULT_EQUITY_WATCHLIST.map((item) => normalizeWatchlistItem(item)).filter(Boolean);
};

const normalizePinnedTabs = (value) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const pinned = [];
  value.forEach((item) => {
    const symbol = String(item || '').trim().toUpperCase();
    if (!symbol || seen.has(symbol)) return;
    seen.add(symbol);
    pinned.push(symbol);
  });
  return pinned.slice(0, 5);
};

const loadWatchlist = () => {
  if (typeof window === 'undefined') return normalizeWatchlist(DEFAULT_EQUITY_WATCHLIST);
  try {
    const raw = localStorage.getItem(V2_WATCHLIST_KEY);
    return normalizeWatchlist(raw ? JSON.parse(raw) : DEFAULT_EQUITY_WATCHLIST);
  } catch {
    return normalizeWatchlist(DEFAULT_EQUITY_WATCHLIST);
  }
};

const loadWatchlistState = () => {
  if (typeof window === 'undefined') return 'small';
  const value = localStorage.getItem(V2_WATCHLIST_STATE_KEY);
  return ['open', 'small', 'closed'].includes(value) ? value : 'small';
};

const loadPinnedTabs = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(V2_PINNED_TABS_KEY);
    return normalizePinnedTabs(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
};

const saveWatchlist = (watchlist) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(V2_WATCHLIST_KEY, JSON.stringify(normalizeWatchlist(watchlist)));
};

const saveWatchlistState = (state) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(V2_WATCHLIST_STATE_KEY, state);
};

const savePinnedTabs = (tabs) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(V2_PINNED_TABS_KEY, JSON.stringify(normalizePinnedTabs(tabs)));
};

const buildQuote = (quote) => {
  if (!quote) return null;

  const price = toNumber(
    quote.price
    ?? quote.last
    ?? quote.trade?.p
    ?? quote.p,
  );
  if (!Number.isFinite(price)) return null;

  const prevClose = toNumber(quote.prevClose ?? quote.previousClose ?? quote.prev_close);
  const fallbackPrevClose = Number.isFinite(prevClose) ? prevClose : price;

  const rawChange = toNumber(quote.change);
  const change = Number.isFinite(rawChange) ? rawChange : price - fallbackPrevClose;

  const rawChangePercent = toNumber(quote.changePercent ?? quote.change_percent ?? quote.percentChange);
  const changePercent = Number.isFinite(rawChangePercent)
    ? rawChangePercent
    : fallbackPrevClose > 0
      ? (change / fallbackPrevClose) * 100
      : 0;

  return {
    symbol: quote.symbol,
    price,
    change,
    changePercent,
    prevClose: fallbackPrevClose,
    bid: toNumber(quote.bid),
    ask: toNumber(quote.ask),
    timestamp: quote.timestamp,
  };
};

const formatPrice = (price) => {
  if (!Number.isFinite(price)) return '...';
  return Number(price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const generateFallbackData = (points = 320) => {
  const data = [];
  const day = 24 * 60 * 60 * 1000;
  let close = 182;

  for (let i = points; i > 0; i -= 1) {
    const ts = Date.now() - i * day;
    const open = close + (Math.random() - 0.5) * 2.2;
    const high = Math.max(open, close) + Math.random() * 2.6;
    const low = Math.min(open, close) - Math.random() * 2.6;
    close = low + Math.random() * (high - low);
    const volume = Math.round(250000 + Math.random() * 1600000);
    data.push([
      ts,
      Number(open.toFixed(2)),
      Number(high.toFixed(2)),
      Number(low.toFixed(2)),
      Number(close.toFixed(2)),
      volume,
    ]);
  }

  return data;
};

const getFallbackDataForPreset = (presetId) => {
  const full = generateFallbackData();
  if (presetId === 'aapl-basic-exact' || presetId === 'candlestick-basic' || presetId === 'technical-annotations') {
    return full.map((row) => row.slice(0, 5));
  }
  return full;
};

if (!Highcharts.__stratifyVolumeWidthPluginInstalled) {
  Highcharts.addEvent(
    Highcharts.seriesTypes.column,
    'afterColumnTranslate',
    function applyVolumeWidthVariation() {
      const series = this;

      if (!series.options.baseVolume || !series.is('column') || !series.points) return;

      const volumeSeries = series.chart.get(series.options.baseVolume);
      const processedYData = volumeSeries?.getColumn('y', true);
      if (!volumeSeries || !processedYData) return;

      const maxVolume = volumeSeries.dataMax;
      const metrics = series.getColumnMetrics();
      const baseWidth = metrics?.width || 0;
      if (!maxVolume || !baseWidth) return;

      series.points.forEach((point, i) => {
        const volume = Number(processedYData[i] ?? 0);
        if (!Number.isFinite(volume) || !point.shapeArgs) return;

        const scale = Math.max(0.08, volume / maxVolume);
        const width = baseWidth * scale;

        point.shapeArgs.x = point.shapeArgs.x - (width / 2) + (point.shapeArgs.width / 2);
        point.shapeArgs.width = width;
      });
    },
  );

  Highcharts.__stratifyVolumeWidthPluginInstalled = true;
}

export default function V2TradePage() {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const initialWatchlistRef = useRef(loadWatchlist());

  const [watchlist, setWatchlist] = useState(() => initialWatchlistRef.current);
  const [watchlistState, setWatchlistState] = useState(() => loadWatchlistState());
  const [pinnedTabs, setPinnedTabs] = useState(() => loadPinnedTabs());
  const [dragOverTabs, setDragOverTabs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedTicker, setSelectedTicker] = useState(() => initialWatchlistRef.current[0]?.symbol || 'AAPL');
  const [showDollarChange, setShowDollarChange] = useState(false);

  const [activePresetId, setActivePresetId] = useState(LIVE_CHART_PRESETS[0]?.id || CHART_PRESETS[0].id);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quotesError, setQuotesError] = useState('');
  const [equityQuotes, setEquityQuotes] = useState({});
  const [equityLoading, setEquityLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);

  const activePreset = useMemo(
    () => LIVE_CHART_PRESETS.find((preset) => preset.id === activePresetId) || LIVE_CHART_PRESETS[0] || CHART_PRESETS[0],
    [activePresetId],
  );

  const activeSymbols = useMemo(
    () => watchlist.map((item) => item.symbol).filter(Boolean),
    [watchlist],
  );

  const selectedQuote = selectedTicker ? equityQuotes[selectedTicker] : null;
  const selectedStock = useMemo(
    () => STOCK_DATABASE.find((stock) => stock.symbol === selectedTicker) || watchlist.find((item) => item.symbol === selectedTicker),
    [selectedTicker, watchlist],
  );

  useEffect(() => {
    saveWatchlist(watchlist);
  }, [watchlist]);

  useEffect(() => {
    saveWatchlistState(watchlistState);
  }, [watchlistState]);

  useEffect(() => {
    savePinnedTabs(pinnedTabs);
  }, [pinnedTabs]);

  useEffect(() => {
    if (watchlist.length === 0) return;
    if (!watchlist.some((item) => item.symbol === selectedTicker)) {
      setSelectedTicker(watchlist[0]?.symbol || 'AAPL');
    }
  }, [watchlist, selectedTicker]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const inWatchlist = new Set(activeSymbols);

    const results = STOCK_DATABASE
      .filter((stock) => stock.symbol.toLowerCase().includes(query) || stock.name.toLowerCase().includes(query))
      .slice(0, 20)
      .map((stock) => ({
        ...stock,
        alreadyInWatchlist: inWatchlist.has(stock.symbol),
      }));

    setSearchResults(results);
  }, [searchQuery, activeSymbols]);

  const fetchSnapshot = useCallback(async () => {
    if (activeSymbols.length === 0) return;

    try {
      setQuotesError('');
      const symbols = activeSymbols.join(',');
      const response = await fetch(`/api/lse/quotes?symbols=${encodeURIComponent(symbols)}`, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`snapshot failed (${response.status})`);
      }

      const payload = await response.json();
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      const next = {};

      rows.forEach((row) => {
        const normalized = normalizeWsSymbol(row?.requestedSymbol || row?.symbol);
        if (!normalized) return;
        const parsed = buildQuote({ ...row, symbol: normalized });
        if (!parsed) return;
        next[normalized] = parsed;
      });

      if (Object.keys(next).length > 0) {
        setEquityQuotes((prev) => ({ ...prev, ...next }));
      }
      setEquityLoading(false);
    } catch (snapshotError) {
      console.warn('[V.2_Trade] Snapshot fetch failed:', snapshotError);
      setQuotesError('Quote snapshot unavailable');
      setEquityLoading(false);
    }
  }, [activeSymbols]);

  useEffect(() => {
    if (activeSymbols.length === 0) {
      setEquityQuotes({});
      setEquityLoading(false);
      return undefined;
    }

    setEquityLoading(true);
    fetchSnapshot();
    return undefined;
  }, [activeSymbols, fetchSnapshot]);

  useEffect(() => {
    const unsubscribeStatus = subscribeTwelveDataStatus((status) => {
      setWsConnected(Boolean(status?.connected));
    });

    if (activeSymbols.length === 0) {
      return () => {
        unsubscribeStatus?.();
      };
    }

    const unsubscribeQuotes = subscribeTwelveDataQuotes(activeSymbols, (update) => {
      const normalized = normalizeWsSymbol(update?.symbol);
      if (!normalized) return;

      const livePrice = toNumber(update?.price);
      if (!Number.isFinite(livePrice)) return;

      setEquityQuotes((prev) => {
        const previous = prev[normalized] || {};
        const previousPrevClose = toNumber(previous.prevClose);
        const feedChange = toNumber(update?.change);
        const feedPct = toNumber(update?.percentChange);
        const derivedPrevClose = Number.isFinite(previousPrevClose)
          ? previousPrevClose
          : Number.isFinite(feedChange)
            ? livePrice - feedChange
            : livePrice;
        const change = Number.isFinite(feedChange) ? feedChange : livePrice - derivedPrevClose;
        const changePercent = Number.isFinite(feedPct)
          ? feedPct
          : derivedPrevClose > 0
            ? (change / derivedPrevClose) * 100
            : 0;

        return {
          ...prev,
          [normalized]: {
            ...previous,
            symbol: normalized,
            price: livePrice,
            prevClose: derivedPrevClose,
            change,
            changePercent,
            timestamp: update?.timestamp || new Date().toISOString(),
          },
        };
      });
      setEquityLoading(false);
    });

    return () => {
      unsubscribeQuotes?.();
      unsubscribeStatus?.();
    };
  }, [activeSymbols]);

  const applyLiveTickToChart = useCallback((price, timestamp) => {
    const chart = chartRef.current;
    if (!chart) return;

    const candleSeries = chart.series.find((series) => ['candlestick', 'hollowcandlestick', 'ohlc'].includes(series.type));
    if (!candleSeries?.points?.length) return;

    const lastPoint = candleSeries.points[candleSeries.points.length - 1];
    if (!lastPoint) return;

    const lastClose = toNumber(lastPoint.close);
    if (!Number.isFinite(lastClose) || lastClose <= 0) return;
    const jumpRatio = Math.abs(price - lastClose) / lastClose;
    if (jumpRatio > 0.25) return;

    const interval = getPresetInterval(activePreset.id);
    const intervalMs = INTERVAL_MS[interval] || INTERVAL_MS['1day'];
    const tickTs = toTimestampMs(timestamp || Date.now());
    if (!Number.isFinite(tickTs)) return;
    const tickBucket = Math.floor(tickTs / intervalMs) * intervalMs;
    const lastBucket = Math.floor(Number(lastPoint.x) / intervalMs) * intervalMs;

    if (!Number.isFinite(lastBucket) || tickBucket < lastBucket) return;

    if (tickBucket > lastBucket) {
      const nextOpen = lastClose;
      const nextHigh = Math.max(nextOpen, price);
      const nextLow = Math.min(nextOpen, price);
      candleSeries.addPoint([tickBucket, nextOpen, nextHigh, nextLow, price], false, false, false);

      const volumeSeries = chart.series.find((series) => series.type === 'column');
      if (volumeSeries) {
        if (volumeSeries.options?.keys && Array.isArray(volumeSeries.options.keys) && volumeSeries.options.keys.includes('className')) {
          volumeSeries.addPoint([tickBucket, 0, price >= nextOpen ? 'highcharts-point-up' : 'highcharts-point-down'], false, false, false);
        } else {
          volumeSeries.addPoint([tickBucket, 0], false, false, false);
        }
      }
    } else {
      const nextOpen = toNumber(lastPoint.open);
      const nextHigh = Math.max(toNumber(lastPoint.high), price);
      const nextLow = Math.min(toNumber(lastPoint.low), price);
      lastPoint.update([lastPoint.x, nextOpen, nextHigh, nextLow, price], false, false);
    }

    chart.redraw(false);
  }, [activePreset.id]);

  useEffect(() => {
    if (!selectedTicker) return undefined;
    const unsubscribe = subscribeTwelveDataQuotes([selectedTicker], (update) => {
      const normalized = normalizeWsSymbol(update?.symbol);
      if (normalized !== selectedTicker) return;
      const livePrice = toNumber(update?.price);
      if (!Number.isFinite(livePrice)) return;
      applyLiveTickToChart(livePrice, update?.timestamp);
    });
    return () => unsubscribe?.();
  }, [selectedTicker, applyLiveTickToChart]);

  const loadChart = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }

      let data = null;
      let usingFallback = false;

      try {
        const interval = getPresetInterval(activePreset.id);
        const outputsize = interval === '1min' || interval === '5min' ? 700 : 500;
        const response = await fetch(
          `/api/lse/timeseries?symbol=${encodeURIComponent(selectedTicker)}&interval=${encodeURIComponent(interval)}&outputsize=${outputsize}`,
          { cache: 'no-store' }
        );

        if (!response.ok) {
          throw new Error(`timeseries failed (${response.status})`);
        }

        const payload = await response.json();
        const values = Array.isArray(payload?.values) ? payload.values : [];
        const normalized = values
          .map((row) => {
            const ts = toTimestampMs(row?.datetime);
            const open = toNumber(row?.open);
            const high = toNumber(row?.high);
            const low = toNumber(row?.low);
            const close = toNumber(row?.close);
            const volume = Number.isFinite(toNumber(row?.volume)) ? Number(row.volume) : 0;
            if (!Number.isFinite(ts) || !Number.isFinite(open) || !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) return null;
            return [ts, open, high, low, close, volume];
          })
          .filter(Boolean)
          .sort((a, b) => a[0] - b[0]);

        if (normalized.length > 0) {
          data = OHLC_ONLY_PRESETS.has(activePreset.id)
            ? normalized.map((row) => row.slice(0, 5))
            : normalized;
        }
      } catch (twelveDataError) {
        console.warn('[V.2_Trade] Twelve Data chart history failed:', twelveDataError);
      }

      if (!data && activePreset.dataUrl) {
        try {
          const response = await fetch(activePreset.dataUrl, { cache: 'no-store' });
          if (!response.ok) {
            throw new Error(`fetch failed (${response.status})`);
          }
          data = await response.json();
          usingFallback = true;
        } catch (fetchError) {
          console.warn('[V.2_Trade] Preset fetch failed, using local fallback data:', fetchError);
          data = getFallbackDataForPreset(activePreset.id);
          usingFallback = true;
        }
      }

      if (!containerRef.current) return;

      const options = buildChartOptions({
        presetId: activePreset.id,
        data,
      });

      if (selectedTicker) {
        const selectedTitle = `${selectedTicker} • ${activePreset.name}`;
        options.title = {
          ...(options.title || {}),
          text: selectedTitle,
        };

        if (Array.isArray(options.series) && options.series.length > 0) {
          options.series = options.series.map((series, index) => (
            index === 0
              ? {
                  ...series,
                  name: selectedTicker,
                }
              : series
          ));
        }
      }

      chartRef.current =
        activePreset.engine === 'chart'
          ? Highcharts.chart(containerRef.current, options)
          : Highcharts.stockChart(containerRef.current, options);

      if (usingFallback) {
        setError('Using fallback chart dataset. Live Twelve Data history unavailable for this preset.');
      }
    } catch (loadError) {
      console.error('[V.2_Trade] Failed to load chart:', loadError);
      setError('Failed to load chart data.');
    } finally {
      setLoading(false);
    }
  }, [activePreset, selectedTicker]);

  useEffect(() => {
    loadChart();
  }, [loadChart]);

  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, []);

  const cycleWatchlistState = () => {
    setWatchlistState((previous) => {
      if (previous === 'open') return 'small';
      if (previous === 'small') return 'closed';
      return 'open';
    });
  };

  const addPinnedTab = (symbol) => {
    if (!symbol) return;
    const normalized = String(symbol).toUpperCase();
    setPinnedTabs((previous) => {
      if (previous.includes(normalized) || previous.length >= 5) return previous;
      return [...previous, normalized];
    });
  };

  const removePinnedTab = (symbol) => {
    const normalized = String(symbol || '').toUpperCase();
    setPinnedTabs((previous) => previous.filter((item) => item !== normalized));
  };

  const handleTabDrop = (event) => {
    event.preventDefault();
    const symbol = event.dataTransfer.getData('text/plain');
    if (symbol) addPinnedTab(symbol);
    setDragOverTabs(false);
  };

  const handleAddStock = (stock) => {
    if (!stock?.symbol) return;
    const symbol = String(stock.symbol || '').toUpperCase();

    if (stock.alreadyInWatchlist || watchlist.some((item) => item.symbol === symbol)) {
      setSelectedTicker(symbol);
      setSearchQuery('');
      setSearchResults([]);
      return;
    }

    const next = {
      symbol,
      name: stock.name || STOCK_DATABASE.find((item) => item.symbol === symbol)?.name || symbol,
    };

    setWatchlist((previous) => [next, ...previous]);
    setSelectedTicker(symbol);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleRemoveStock = useCallback((symbol) => {
    const normalized = String(symbol || '').toUpperCase();
    if (!normalized) return;

    setWatchlist((previous) => previous.filter((item) => item.symbol !== normalized));
    setPinnedTabs((previous) => previous.filter((item) => item !== normalized));
  }, []);

  const handleSelectSymbol = useCallback((symbol) => {
    const normalized = String(symbol || '').toUpperCase();
    if (!normalized) return;
    setSelectedTicker(normalized);
  }, []);

  const handleDragEnd = useCallback((result) => {
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) return;

    setWatchlist((previous) => {
      const reordered = [...previous];
      const [moved] = reordered.splice(sourceIndex, 1);
      reordered.splice(destinationIndex, 0, moved);
      return reordered;
    });
  }, []);

  const handlePinSelectedTicker = () => {
    if (!selectedTicker) return;
    if (pinnedTabs.includes(selectedTicker)) {
      removePinnedTab(selectedTicker);
      return;
    }
    addPinnedTab(selectedTicker);
  };

  const scrollStyle = { scrollbarWidth: 'none', msOverflowStyle: 'none' };

  return (
    <div className="h-full w-full bg-transparent p-4">
      <div className="flex h-full w-full gap-4 rounded-xl border border-white/10 bg-black/30 p-3">
        <div
          className="flex flex-col border-r border-[#1f1f1f] flex-shrink-0 transition-all duration-300 ease-out rounded-lg bg-[#0a1628]/60"
          style={{ width: stateWidths[watchlistState] }}
        >
          <div className="border-b border-[#1f1f1f] relative">
            <div
              className={`flex-1 px-2 py-2 flex items-center gap-1 overflow-x-auto scrollbar-hide ${
                dragOverTabs ? 'bg-emerald-500/10 border-emerald-500/30' : ''
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOverTabs(true);
              }}
              onDragLeave={() => setDragOverTabs(false)}
              onDrop={handleTabDrop}
            >
              {pinnedTabs.map((symbol) => (
                <button
                  key={symbol}
                  onClick={() => handleSelectSymbol(symbol)}
                  className={`group flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                    selectedTicker === symbol
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-gray-800 text-gray-400 border border-[#2a2a2a] hover:border-gray-600 hover:text-white'
                  }`}
                  type="button"
                >
                  <span>{symbol}</span>
                  <X
                    className="w-3 h-3 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                    onClick={(event) => {
                      event.stopPropagation();
                      removePinnedTab(symbol);
                    }}
                  />
                </button>
              ))}
              {pinnedTabs.length < 5 && (
                <div className={`px-2 py-1 rounded border border-dashed text-xs transition-colors ${
                  dragOverTabs
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-[#2a2a2a] text-gray-600'
                }`}>
                  {dragOverTabs ? 'Drop here' : '+ Drag'}
                </div>
              )}
              <div className="w-8 flex-shrink-0" />
            </div>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
              <button
                onClick={cycleWatchlistState}
                className="p-1 hover:bg-gray-800 rounded transition-colors focus:outline-none"
                aria-label="Resize watchlist"
                type="button"
              >
                <ChevronsLeft
                  className={`w-5 h-5 transition-all duration-200 ${
                    watchlistState !== 'closed'
                      ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.7)]'
                      : 'text-gray-600'
                  }`}
                />
              </button>
            </div>
          </div>

          {watchlistState !== 'closed' && (
            <div className="p-3 border-b border-[#1f1f1f] relative">
              <div className="flex items-center gap-2 bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5">
                <Search className="w-4 h-4 text-white/50" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(String(event.target.value || '').toUpperCase())}
                  placeholder="Search symbol or company..."
                  className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm outline-none"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="text-white/50 hover:text-white" type="button">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {searchQuery && searchResults.length > 0 && (
                <div className="absolute left-3 right-3 top-full mt-1 bg-[#111111] border border-[#2a2a2a] rounded-lg overflow-hidden shadow-2xl z-50 max-h-96 overflow-y-auto scrollbar-hide" style={scrollStyle}>
                  {searchResults.map((stock) => {
                    const inWatchlist = Boolean(stock.alreadyInWatchlist);
                    return (
                      <div
                        key={stock.symbol}
                        className="flex items-center justify-between px-4 py-3 hover:bg-emerald-500/10 cursor-pointer border-b border-[#1f1f1f]/50 last:border-0 transition-colors"
                        onClick={() => handleAddStock(stock)}
                      >
                        <div className="flex-1">
                          <span className="text-white font-bold text-base">${stock.symbol}</span>
                          <span className="text-gray-400 text-sm ml-3">{stock.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {inWatchlist ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 text-emerald-300 font-medium">In Watchlist</span>
                          ) : null}
                          {inWatchlist ? (
                            <Plus className="w-5 h-5 text-emerald-400/50" strokeWidth={2} />
                          ) : (
                            <Plus className="w-5 h-5 text-emerald-400" strokeWidth={2} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {searchQuery && searchResults.length === 0 && (
                <div className="absolute left-3 right-3 top-full mt-1 bg-[#111111] border border-[#2a2a2a] rounded-lg p-4 text-center text-gray-400 text-sm z-50">
                  No results for "{searchQuery}"
                </div>
              )}

              <div className="flex items-center justify-between mt-2 text-[10px]">
                <span className="text-gray-500">{watchlist.length} symbols</span>
                <div className="flex items-center gap-2">
                  {wsConnected ? (
                    <>
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                      <span className="text-emerald-400 font-medium">LIVE STREAMING</span>
                    </>
                  ) : (
                    <span className="text-gray-500 font-medium">CONNECTING...</span>
                  )}
                  <button
                    type="button"
                    onClick={handlePinSelectedTicker}
                    className="text-emerald-400 opacity-40 hover:opacity-100"
                    title={selectedTicker ? `Pin ${selectedTicker}` : 'Pin'}
                  >
                    <Pin className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveStock(selectedTicker)}
                    className="text-emerald-400 opacity-40 hover:opacity-100"
                    title={selectedTicker ? `Remove ${selectedTicker}` : 'Remove'}
                    disabled={!selectedTicker}
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            </div>
          )}

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="v2-watchlist">
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="flex-1 overflow-auto scrollbar-hide"
                  style={scrollStyle}
                >
                  {equityLoading && Object.keys(equityQuotes).length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      <span className="ml-3 text-gray-400 text-sm">Loading prices...</span>
                    </div>
                  ) : null}

                  {watchlist.map((stock, index) => {
                    const quote = equityQuotes[stock.symbol] || {};
                    const price = toNumber(quote.price);
                    const change = toNumber(quote.change);
                    const changePercent = toNumber(quote.changePercent);
                    const isPositive = Number.isFinite(changePercent)
                      ? changePercent >= 0
                      : Number.isFinite(change)
                        ? change >= 0
                        : true;
                    const isSelected = selectedTicker === stock.symbol;

                    return (
                      <Draggable key={stock.symbol} draggableId={stock.symbol} index={index}>
                        {(dragProvided, snapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            draggable="true"
                            onDragStart={(event) => {
                              event.dataTransfer.setData('text/plain', stock.symbol);
                              event.dataTransfer.effectAllowed = 'copy';
                            }}
                            className={`relative flex items-center justify-between cursor-pointer transition-all border-b border-[#1f1f1f]/30 ${
                              isSelected ? 'bg-emerald-500/10 border-l-2 border-l-emerald-400' : 'hover:bg-white/5'
                            } ${watchlistState === 'closed' ? 'px-2 py-3' : 'px-4 py-3'} ${
                              snapshot.isDragging ? 'bg-[#1a1a1a] shadow-lg ring-1 ring-emerald-500/40' : ''
                            }`}
                            onClick={() => handleSelectSymbol(stock.symbol)}
                          >
                            {watchlistState === 'closed' ? (
                              <div className="w-full text-center">
                                <div className="text-white text-xs font-bold">${stock.symbol}</div>
                                <div className={`text-[10px] font-medium mt-0.5 ${Number.isFinite(price) ? (isPositive ? 'text-emerald-400' : 'text-red-400') : 'text-white/50'}`}>
                                  {Number.isFinite(price) ? `$${formatPrice(price)}` : '...'}
                                </div>
                              </div>
                            ) : (
                              <>
                                <div
                                  {...dragProvided.dragHandleProps}
                                  className="mr-2 text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing"
                                >
                                  <GripVertical className="w-4 h-4" />
                                </div>

                                <div className="flex-1 min-w-0 pr-4">
                                  <div className="text-white font-bold text-base">${stock.symbol}</div>
                                  <div className="text-white/50 text-sm truncate">{stock.name}</div>
                                </div>

                                <div className="ml-auto pr-3 text-right flex-shrink-0">
                                  <div className="text-white font-semibold text-base font-mono">
                                    {Number.isFinite(price) ? `$${formatPrice(price)}` : '...'}
                                  </div>
                                  {Number.isFinite(price) ? (
                                    <span
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        setShowDollarChange((previous) => !previous);
                                      }}
                                      className={`px-2 py-0.5 rounded text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity ${isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}
                                    >
                                      {showDollarChange
                                        ? `${isPositive ? '+' : ''}$${Math.abs(Number.isFinite(change) ? change : 0).toFixed(2)}`
                                        : `${isPositive ? '+' : ''}${Number.isFinite(changePercent) ? changePercent.toFixed(2) : '0.00'}%`}
                                    </span>
                                  ) : null}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {watchlistState !== 'closed' ? (
            <div className="p-3 border-t border-[#1f1f1f] flex items-center justify-between text-xs">
              <span className="text-gray-400">{watchlist.length} symbols</span>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
                <span className="text-emerald-400">Twelve Data</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#060d18]/70 p-3 flex flex-col">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <h2 className="text-sm font-semibold text-white truncate">${selectedTicker}</h2>
              <span className="text-xs text-gray-400 truncate">{selectedStock?.name || selectedTicker}</span>
              {Number.isFinite(toNumber(selectedQuote?.price)) ? (
                <span className={`text-xs font-semibold ${toNumber(selectedQuote?.changePercent) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  ${formatPrice(toNumber(selectedQuote?.price))} ({toNumber(selectedQuote?.changePercent).toFixed(2)}%)
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {loading ? <span className="text-xs text-cyan-300">Loading...</span> : null}
            </div>
          </div>

          <div className="mb-2 flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {LIVE_CHART_PRESETS.map((preset) => {
              const active = preset.id === activePresetId;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setActivePresetId(preset.id)}
                  className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-xs text-left transition ${
                    active
                      ? 'border-cyan-400/70 bg-cyan-500/15 text-cyan-200'
                      : 'border-white/10 bg-black/20 text-gray-300 hover:border-cyan-500/40 hover:text-white'
                  }`}
                  title={preset.description}
                >
                  {preset.name}
                </button>
              );
            })}
          </div>

          {error ? (
            <div className="mb-2 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</div>
          ) : null}

          {quotesError ? (
            <div className="mb-2 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">{quotesError}</div>
          ) : null}

          {activePreset.id === 'stock-tools-popup-events' ? (
            <>
              <div className="highcharts-popup-indicators hidden">
                <div className="popup-title">Indicators</div>
                <label className="popup-row">
                  <span>Type</span>
                  <select defaultValue="sma">
                    <option value="sma">SMA</option>
                    <option value="ema">EMA</option>
                    <option value="rsi">RSI</option>
                    <option value="macd">MACD</option>
                  </select>
                </label>
                <label className="popup-row">
                  <span>Period</span>
                  <input type="number" min="1" defaultValue="14" />
                </label>
                <div className="popup-actions">
                  <button type="button">Add indicator</button>
                  <button type="button" className="highcharts-close-popup">Close</button>
                </div>
              </div>
              <div className="highcharts-popup-annotations hidden">
                <div className="popup-title">Annotation</div>
                <label className="popup-row">
                  <span>Stroke width</span>
                  <input type="number" name="stroke-width" min="1" max="8" defaultValue="2" />
                </label>
                <label className="popup-row">
                  <span>Stroke color</span>
                  <input type="color" name="stroke" defaultValue="#3b82f6" />
                </label>
                <div className="popup-actions">
                  <button type="button">Update annotation</button>
                  <button type="button" className="highcharts-close-popup">Close</button>
                </div>
              </div>
            </>
          ) : null}

          <div ref={containerRef} id="v2-trade-container" className="flex-1 min-h-[520px] w-full" />
        </div>
      </div>
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        #v2-trade-container .highcharts-background {
          fill: transparent;
        }
        #v2-trade-container .highcharts-title,
        #v2-trade-container .highcharts-axis-title,
        #v2-trade-container .highcharts-axis-labels text,
        #v2-trade-container .highcharts-range-selector text {
          fill: #9d9da2 !important;
          color: #9d9da2 !important;
        }
        #v2-trade-container .highcharts-grid-line {
          stroke: #181816;
        }
        #v2-trade-container .highcharts-candlestick-series .highcharts-point-up {
          fill: #51af7b;
          stroke: #51af7b;
        }
        #v2-trade-container .highcharts-candlestick-series .highcharts-point-down {
          fill: #ff6e6e;
          stroke: #ff6e6e;
        }
        #v2-trade-container .highcharts-series.highcharts-column-series .highcharts-point-up {
          fill: #51af7b;
          stroke: #51af7b;
        }
        #v2-trade-container .highcharts-series.highcharts-column-series .highcharts-point-down {
          fill: #ff6e6e;
          stroke: #ff6e6e;
        }
        #v2-trade-container .highcharts-crosshair-custom {
          stroke: #4f86ff !important;
          stroke-width: 1px !important;
          stroke-dasharray: 3 3;
        }
        #v2-trade-container .highcharts-crosshair-custom-label text {
          fill: #d4d4d8 !important;
        }
        #v2-trade-container .highcharts-crosshair-custom-label rect {
          fill: rgba(0, 0, 0, 0.7);
          stroke: #34343a;
          stroke-width: 1px;
        }
        .highcharts-popup-indicators,
        .highcharts-popup-annotations {
          position: absolute;
          top: 84px;
          right: 18px;
          z-index: 40;
          width: 220px;
          border-radius: 8px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          background: rgba(6, 13, 24, 0.96);
          padding: 10px;
          color: #e2e8f0;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
        }
        .highcharts-popup-indicators.hidden,
        .highcharts-popup-annotations.hidden {
          display: none;
        }
        .popup-title {
          margin-bottom: 8px;
          font-size: 12px;
          font-weight: 600;
          color: #bae6fd;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .popup-row {
          display: grid;
          grid-template-columns: 1fr;
          gap: 4px;
          margin-bottom: 8px;
        }
        .popup-row span {
          font-size: 11px;
          color: #94a3b8;
        }
        .popup-row input,
        .popup-row select {
          border: 1px solid rgba(148, 163, 184, 0.35);
          border-radius: 6px;
          background: #0a1628;
          color: #e2e8f0;
          font-size: 12px;
          padding: 6px 8px;
        }
        .popup-actions {
          display: flex;
          gap: 8px;
        }
        .popup-actions button {
          border: 1px solid rgba(56, 189, 248, 0.45);
          border-radius: 6px;
          background: rgba(56, 189, 248, 0.12);
          color: #e0f2fe;
          font-size: 11px;
          font-weight: 600;
          padding: 6px 8px;
          cursor: pointer;
        }
        .popup-actions .highcharts-close-popup {
          border-color: rgba(239, 68, 68, 0.45);
          background: rgba(239, 68, 68, 0.12);
          color: #fecaca;
        }
      `}</style>
    </div>
  );
}
