import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createChart, CandlestickSeries, ColorType, HistogramSeries } from 'lightweight-charts';
import { ChevronsLeft, ChevronsRight, GripVertical, Plus, Search, X } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { formatCurrency, formatPercent } from '../../lib/twelvedata';

const TWELVE_DATA_WS_URL = 'wss://ws.twelvedata.com/v1/quotes/price';
const TWELVE_DATA_REST_URL = 'https://api.twelvedata.com/time_series';
const TWELVE_DATA_QUOTE_URL = 'https://api.twelvedata.com/quote';
const TWELVE_DATA_SYMBOL_SEARCH_URL = 'https://api.twelvedata.com/symbol_search';

const WATCHLIST_STORAGE_KEY = 'stratify-trader-watchlist';
const WATCHLIST_COLLAPSED_STORAGE_KEY = 'stratify-trader-watchlist-collapsed';
const ACTIVE_MARKET_STORAGE_KEY = 'stratify-trader-active-market';
const CHART_TIMEFRAME_STORAGE_KEY = 'stratify-trader-chart-timeframe';
const DEFAULT_WATCHLIST = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'SPY'];
const MAX_SYMBOL_SEARCH_RESULTS = 8;
const MARKET_PRIORITY = ['NASDAQ', 'NYSE', 'LSE', 'TSE', 'ASX'];
const DEFAULT_ACTIVE_MARKET = 'us';
const DEFAULT_CHART_TIMEFRAME = '5M';
const MAX_CHART_OUTPUTSIZE = '5000';
const MARKET_FILTERS = [
  { id: 'us', label: '🇺🇸 US', exchanges: ['NASDAQ', 'NYSE'] },
  { id: 'london', label: '🇬🇧 London', exchanges: ['LSE'] },
  { id: 'tokyo', label: '🇯🇵 Tokyo', exchanges: ['TSE'] },
  { id: 'sydney', label: '🇦🇺 Sydney', exchanges: ['ASX'] },
];
const MARKET_FILTER_BY_ID = MARKET_FILTERS.reduce((accumulator, market) => {
  accumulator[market.id] = market;
  return accumulator;
}, {});
const MARKET_SYMBOLS = [
  { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
  { symbol: 'TSLA', name: 'Tesla, Inc.', exchange: 'NASDAQ' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', exchange: 'NYSE' },
  { symbol: 'V', name: 'Visa Inc.', exchange: 'NYSE' },
  { symbol: 'BP.L', name: 'BP p.l.c.', exchange: 'LSE' },
  { symbol: 'VOD.LON', name: 'Vodafone Group Plc', exchange: 'LSE' },
  { symbol: '7203.T', name: 'Toyota Motor Corporation', exchange: 'TSE' },
  { symbol: '6758.T', name: 'Sony Group Corporation', exchange: 'TSE' },
  { symbol: 'BHP.AX', name: 'BHP Group Limited', exchange: 'ASX' },
  { symbol: 'CBA.AX', name: 'Commonwealth Bank of Australia', exchange: 'ASX' },
];
const CHART_TIMEFRAME_OPTIONS = [
  { id: '1M', label: '1M', interval: '1min', outputsize: '320' },
  { id: '5M', label: '5M', interval: '5min', outputsize: '320' },
  { id: '15M', label: '15M', interval: '15min', outputsize: '320' },
  { id: '1H', label: '1H', interval: '1h', outputsize: '320' },
  { id: '1D', label: '1D', interval: '1day', outputsize: '320' },
  { id: '1Mo', label: '1Mo', interval: '1month', outputsize: '320' },
  { id: 'ALL', label: 'ALL', interval: '1week', outputsize: MAX_CHART_OUTPUTSIZE },
];
const CHART_TIMEFRAME_BY_ID = CHART_TIMEFRAME_OPTIONS.reduce((accumulator, option) => {
  accumulator[option.id] = option;
  return accumulator;
}, {});
const CHART_INTERVAL_SECONDS_BY_TIMEFRAME = {
  '1M': 60,
  '5M': 300,
  '15M': 900,
  '1H': 3600,
};
const RECONNECT_MIN_MS = 1200;
const RECONNECT_MAX_MS = 15000;
const NO_STREAM_DATA_TIMEOUT_MS = 5000;
const CLOSED_MARKET_POLL_INTERVAL_MS = 30000;

const UP_COLOR = '#34d399';
const DOWN_COLOR = '#ef4444';
const VOLUME_UP = 'rgba(52, 211, 153, 0.3)';
const VOLUME_DOWN = 'rgba(239, 68, 68, 0.3)';
const DRAG_PREVIEW_SCALE_BY_DISTANCE = [
  { distance: 200, scale: 1 },
  { distance: 100, scale: 0.75 },
  { distance: 50, scale: 0.5 },
  { distance: 0, scale: 0.4 },
];

const interpolate = (value, inputStart, inputEnd, outputStart, outputEnd) => {
  if (inputStart === inputEnd) return outputEnd;
  const progress = (value - inputStart) / (inputEnd - inputStart);
  return outputStart + progress * (outputEnd - outputStart);
};

const getDragPreviewScaleByDistance = (distance) => {
  const safeDistance = Number.isFinite(distance) ? Math.max(0, distance) : DRAG_PREVIEW_SCALE_BY_DISTANCE[0].distance;
  const [far, mid, near, dropZone] = DRAG_PREVIEW_SCALE_BY_DISTANCE;

  if (safeDistance >= far.distance) return far.scale;
  if (safeDistance >= mid.distance) {
    return interpolate(safeDistance, far.distance, mid.distance, far.scale, mid.scale);
  }
  if (safeDistance >= near.distance) {
    return interpolate(safeDistance, mid.distance, near.distance, mid.scale, near.scale);
  }
  return interpolate(safeDistance, near.distance, dropZone.distance, near.scale, dropZone.scale);
};

const getPinnedPillsDropZoneBounds = () => {
  if (typeof document === 'undefined') return null;
  const pillSlots = Array.from(document.querySelectorAll('[data-pill-slot]'));
  if (pillSlots.length === 0) return null;

  return pillSlots.reduce((bounds, slot) => {
    const rect = slot.getBoundingClientRect();
    if (!bounds) {
      return {
        top: rect.top,
        bottom: rect.bottom,
      };
    }

    return {
      top: Math.min(bounds.top, rect.top),
      bottom: Math.max(bounds.bottom, rect.bottom),
    };
  }, null);
};

const getDraggedTickerCenterY = (draggableId) => {
  if (typeof document === 'undefined' || !draggableId) return null;

  const draggableElements = Array.from(document.querySelectorAll('[data-rbd-draggable-id]')).filter(
    (element) => element.getAttribute('data-rbd-draggable-id') === draggableId
  );
  if (draggableElements.length === 0) return null;

  const draggingElement =
    draggableElements.find((element) => element.style?.position === 'fixed') ||
    draggableElements[draggableElements.length - 1];
  const rect = draggingElement.getBoundingClientRect();
  if (!Number.isFinite(rect.top) || !Number.isFinite(rect.height)) return null;
  return rect.top + rect.height / 2;
};

const normalizeSymbol = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^\$/, '')
    .replace(/\s+/g, '')
    .split(':')
    .pop();

const MARKET_NAME_BY_SYMBOL = MARKET_SYMBOLS.reduce((accumulator, entry) => {
  const normalized = normalizeSymbol(entry?.symbol);
  if (normalized) {
    accumulator[normalized] = String(entry?.name || '').trim() || normalized;
  }
  return accumulator;
}, {});

const normalizeExchangeLabel = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return 'Market';
  if (normalized === 'XNAS' || normalized.includes('NASDAQ')) return 'NASDAQ';
  if (normalized === 'XNYS' || normalized.includes('NYSE') || normalized.includes('NEW YORK')) return 'NYSE';
  if (normalized === 'XLON' || normalized === 'LON' || normalized.includes('LONDON') || normalized.includes('LSE')) return 'LSE';
  if (normalized === 'XTKS' || normalized === 'TYO' || normalized.includes('TOKYO') || normalized.includes('TSE')) return 'TSE';
  if (normalized === 'XASX' || normalized.includes('SYDNEY') || normalized.includes('ASX')) return 'ASX';
  return normalized;
};

const toSearchKey = (value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

const scoreSearchEntry = (entry, query) => {
  const normalizedQuery = String(query || '').trim().toUpperCase();
  const queryKey = toSearchKey(normalizedQuery);
  const symbol = String(entry?.symbol || '').toUpperCase();
  const symbolKey = toSearchKey(symbol);
  const name = String(entry?.name || '').toUpperCase();

  if (!normalizedQuery) return 99;
  if (symbol === normalizedQuery || symbolKey === queryKey) return 0;
  if (symbol.startsWith(normalizedQuery) || symbolKey.startsWith(queryKey)) return 1;
  if (symbol.includes(normalizedQuery) || symbolKey.includes(queryKey)) return 2;
  if (name.startsWith(normalizedQuery)) return 3;
  if (name.includes(normalizedQuery)) return 4;
  return 99;
};

const buildSearchResults = (entries, query, watchlistSet = new Set(), allowedExchanges = null) => {
  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery) return [];

  const deduped = [];
  const seenSymbols = new Set();

  entries.forEach((entry) => {
    const symbol = normalizeSymbol(entry?.symbol);
    if (!symbol || seenSymbols.has(symbol) || watchlistSet.has(symbol)) return;

    const normalizedEntry = {
      symbol,
      exchange: normalizeExchangeLabel(entry?.exchange),
      name: String(entry?.name || '').trim(),
    };
    if (allowedExchanges && !allowedExchanges.has(normalizedEntry.exchange)) return;

    const score = scoreSearchEntry(normalizedEntry, normalizedQuery);
    if (score === 99) return;

    seenSymbols.add(symbol);
    deduped.push({
      ...normalizedEntry,
      score,
    });
  });

  deduped.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;

    const marketA = MARKET_PRIORITY.indexOf(a.exchange);
    const marketB = MARKET_PRIORITY.indexOf(b.exchange);
    const priorityA = marketA === -1 ? MARKET_PRIORITY.length : marketA;
    const priorityB = marketB === -1 ? MARKET_PRIORITY.length : marketB;
    if (priorityA !== priorityB) return priorityA - priorityB;

    return a.symbol.localeCompare(b.symbol);
  });

  return deduped.slice(0, MAX_SYMBOL_SEARCH_RESULTS).map(({ score, ...entry }) => entry);
};

const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseMarketOpen = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'open') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'closed') return false;
  return null;
};

const toUnixSeconds = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (value > 1e12) return Math.floor(value / 1000);
    if (value > 1e10) return Math.floor(value / 1000);
    return Math.floor(value);
  }

  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return toUnixSeconds(Number(raw));

  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  let parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) parsed = Date.parse(`${normalized}Z`);
  if (!Number.isFinite(parsed)) return null;
  return Math.floor(parsed / 1000);
};

const toCandleBar = (item, previousClose = null) => {
  const close = toNumber(item?.close);
  const time = toUnixSeconds(item?.datetime || item?.time || item?.timestamp);
  if (!Number.isFinite(close) || !Number.isFinite(time)) return null;

  const openValue = toNumber(item?.open);
  const highValue = toNumber(item?.high);
  const lowValue = toNumber(item?.low);
  const volumeValue = toNumber(item?.volume) ?? 0;

  const open = Number.isFinite(openValue)
    ? openValue
    : Number.isFinite(previousClose)
      ? previousClose
      : close;

  const high = Number.isFinite(highValue) ? highValue : Math.max(open, close);
  const low = Number.isFinite(lowValue) ? lowValue : Math.min(open, close);

  return {
    time,
    open,
    high,
    low,
    close,
    volume: volumeValue,
  };
};

const formatPrice = (value) => {
  const amount = toNumber(value);
  if (amount === null) return '--';
  if (Math.abs(amount) >= 1) return formatCurrency(amount, 2);
  return formatCurrency(amount, 4);
};

const formatSignedPercent = (value) => {
  const percent = toNumber(value);
  if (percent === null) return '--';
  const formatted = formatPercent(percent, 2);
  return percent >= 0 ? `+${formatted}` : formatted;
};

const getBucketTimeForTimeframe = (timeSeconds, timeframeId) => {
  if (!Number.isFinite(timeSeconds)) return Math.floor(Date.now() / 1000);

  if (timeframeId === '1Mo') {
    const date = new Date(timeSeconds * 1000);
    date.setUTCDate(1);
    date.setUTCHours(0, 0, 0, 0);
    return Math.floor(date.getTime() / 1000);
  }

  if (timeframeId === 'ALL') {
    const date = new Date(timeSeconds * 1000);
    const day = date.getUTCDay();
    const daysSinceMonday = (day + 6) % 7;
    date.setUTCDate(date.getUTCDate() - daysSinceMonday);
    date.setUTCHours(0, 0, 0, 0);
    return Math.floor(date.getTime() / 1000);
  }

  if (timeframeId === '1D') {
    const date = new Date(timeSeconds * 1000);
    date.setUTCHours(0, 0, 0, 0);
    return Math.floor(date.getTime() / 1000);
  }

  const bucketSeconds =
    CHART_INTERVAL_SECONDS_BY_TIMEFRAME[timeframeId] ||
    CHART_INTERVAL_SECONDS_BY_TIMEFRAME[DEFAULT_CHART_TIMEFRAME];
  return Math.floor(timeSeconds / bucketSeconds) * bucketSeconds;
};

const loadInitialWatchlist = () => {
  if (typeof window === 'undefined') return [...DEFAULT_WATCHLIST];
  try {
    const saved = JSON.parse(localStorage.getItem(WATCHLIST_STORAGE_KEY) || '[]');
    if (!Array.isArray(saved)) return [...DEFAULT_WATCHLIST];
    const normalized = saved.map(normalizeSymbol).filter(Boolean);
    const unique = [...new Set(normalized)];
    return unique.length > 0 ? unique : [...DEFAULT_WATCHLIST];
  } catch {
    return [...DEFAULT_WATCHLIST];
  }
};

const loadInitialWatchlistCollapsed = () => {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(WATCHLIST_COLLAPSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

const loadInitialActiveMarket = () => {
  if (typeof window === 'undefined') return DEFAULT_ACTIVE_MARKET;
  try {
    const saved = String(localStorage.getItem(ACTIVE_MARKET_STORAGE_KEY) || '').trim().toLowerCase();
    if (saved && MARKET_FILTER_BY_ID[saved]) return saved;
  } catch {}
  return DEFAULT_ACTIVE_MARKET;
};

const loadInitialChartTimeframe = () => {
  if (typeof window === 'undefined') return DEFAULT_CHART_TIMEFRAME;
  try {
    const saved = String(localStorage.getItem(CHART_TIMEFRAME_STORAGE_KEY) || '').trim();
    if (saved && CHART_TIMEFRAME_BY_ID[saved]) return saved;
  } catch {}
  return DEFAULT_CHART_TIMEFRAME;
};

export default function TraderPage() {
  const apiKey = import.meta.env.VITE_TWELVE_DATA_API_KEY;
  const initialWatchlist = useMemo(() => loadInitialWatchlist(), []);

  const [watchlist, setWatchlist] = useState(initialWatchlist);
  const [selectedSymbol, setSelectedSymbol] = useState(initialWatchlist[0] || DEFAULT_WATCHLIST[0]);
  const [symbolInput, setSymbolInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [quotesBySymbol, setQuotesBySymbol] = useState({});
  const [streamStatus, setStreamStatus] = useState({
    connected: false,
    connecting: false,
    retryCount: 0,
    error: '',
  });
  const [chartStatus, setChartStatus] = useState({
    loading: true,
    error: '',
  });
  const [chartReady, setChartReady] = useState(false);
  const [chartTimeframe, setChartTimeframe] = useState(() => loadInitialChartTimeframe());
  const [activeMarket, setActiveMarket] = useState(() => loadInitialActiveMarket());
  const [isWatchlistCollapsed, setIsWatchlistCollapsed] = useState(() => loadInitialWatchlistCollapsed());
  const [activeDragTicker, setActiveDragTicker] = useState('');
  const [dragPreviewScale, setDragPreviewScale] = useState(1);
  const [watchlistNamesBySymbol, setWatchlistNamesBySymbol] = useState(() =>
    initialWatchlist.reduce((accumulator, symbol) => {
      const normalized = normalizeSymbol(symbol);
      const fallbackName = MARKET_NAME_BY_SYMBOL[normalized];
      if (fallbackName) accumulator[normalized] = fallbackName;
      return accumulator;
    }, {})
  );

  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const lastBarRef = useRef(null);

  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const closedByUserRef = useRef(false);
  const subscribedSymbolsRef = useRef(new Set());
  const watchlistRef = useRef(new Set(initialWatchlist));
  const selectedSymbolRef = useRef(normalizeSymbol(selectedSymbol));
  const noStreamDataTimerRef = useRef(null);
  const restPollTimerRef = useRef(null);
  const wsHasReceivedPriceRef = useRef(false);
  const restFallbackActiveRef = useRef(false);
  const searchContainerRef = useRef(null);
  const searchRequestRef = useRef(0);
  const chartTimeframeRef = useRef(chartTimeframe);
  const dragPositionYRef = useRef(null);
  const activeMarketExchanges = useMemo(() => {
    const market = MARKET_FILTER_BY_ID[activeMarket] || MARKET_FILTER_BY_ID[DEFAULT_ACTIVE_MARKET];
    return new Set(market?.exchanges || MARKET_FILTER_BY_ID[DEFAULT_ACTIVE_MARKET].exchanges);
  }, [activeMarket]);
  const selectedChartTimeframe = CHART_TIMEFRAME_BY_ID[chartTimeframe] || CHART_TIMEFRAME_BY_ID[DEFAULT_CHART_TIMEFRAME];

  useEffect(() => {
    selectedSymbolRef.current = normalizeSymbol(selectedSymbol);
  }, [selectedSymbol]);

  useEffect(() => {
    chartTimeframeRef.current = chartTimeframe;
  }, [chartTimeframe]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(WATCHLIST_COLLAPSED_STORAGE_KEY, isWatchlistCollapsed ? 'true' : 'false');
  }, [isWatchlistCollapsed]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ACTIVE_MARKET_STORAGE_KEY, activeMarket);
  }, [activeMarket]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CHART_TIMEFRAME_STORAGE_KEY, chartTimeframe);
  }, [chartTimeframe]);

  useEffect(() => {
    const normalized = watchlist.map(normalizeSymbol).filter(Boolean);
    watchlistRef.current = new Set(normalized);

    if (normalized.length === 0) {
      setSelectedSymbol('');
      return;
    }

    if (!normalized.includes(normalizeSymbol(selectedSymbol))) {
      setSelectedSymbol(normalized[0]);
    }
  }, [watchlist, selectedSymbol]);

  useEffect(() => {
    if (!isSearchDropdownOpen || typeof window === 'undefined') return undefined;

    const handlePointerDown = (event) => {
      if (!searchContainerRef.current?.contains(event.target)) {
        setIsSearchDropdownOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [isSearchDropdownOpen]);

  useEffect(() => {
    const query = symbolInput.trim();
    if (!query) {
      searchRequestRef.current += 1;
      setSearchResults([]);
      setIsSearchLoading(false);
      setIsSearchDropdownOpen(false);
      return undefined;
    }

    const watchlistSet = new Set(watchlist.map(normalizeSymbol).filter(Boolean));
    const fallbackMatches = buildSearchResults(MARKET_SYMBOLS, query, watchlistSet, activeMarketExchanges);
    setSearchResults(fallbackMatches);
    setIsSearchDropdownOpen(true);

    if (!apiKey) {
      setIsSearchLoading(false);
      return undefined;
    }

    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        setIsSearchLoading(true);

        const params = new URLSearchParams({
          symbol: query,
          outputsize: String(MAX_SYMBOL_SEARCH_RESULTS),
          apikey: apiKey,
        });

        const response = await fetch(`${TWELVE_DATA_SYMBOL_SEARCH_URL}?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));

        if (controller.signal.aborted || searchRequestRef.current !== requestId) return;
        if (!response.ok || payload?.status === 'error') return;

        const apiMatches = Array.isArray(payload?.data)
          ? payload.data.map((item) => ({
              symbol: item?.symbol,
              exchange: item?.exchange || item?.mic_code || item?.exchange_timezone,
              name: item?.instrument_name || item?.name || item?.description,
            }))
          : [];

        const mergedResults = buildSearchResults(
          [...apiMatches, ...MARKET_SYMBOLS],
          query,
          watchlistSet,
          activeMarketExchanges
        );
        setSearchResults(mergedResults);
      } catch (error) {
        if (error?.name !== 'AbortError') {
          setSearchResults(fallbackMatches);
        }
      } finally {
        if (!controller.signal.aborted && searchRequestRef.current === requestId) {
          setIsSearchLoading(false);
        }
      }
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [activeMarketExchanges, apiKey, symbolInput, watchlist]);

  const selectedQuote = selectedSymbol ? quotesBySymbol[selectedSymbol] : null;
  const selectedQuoteIsPlaceholder = selectedQuote?.isPlaceholder === true;

  const fetchImmediateClosePlaceholder = useCallback(async (symbol) => {
    if (!apiKey) return;

    const normalized = normalizeSymbol(symbol);
    if (!normalized) return;

    try {
      const params = new URLSearchParams({
        symbol: normalized,
        apikey: apiKey,
      });

      const response = await fetch(`${TWELVE_DATA_QUOTE_URL}?${params.toString()}`, {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload?.status === 'error') return;
      if (payload?.code && String(payload.code) !== '200') return;

      const price = toNumber(payload?.close ?? payload?.previous_close);
      if (!Number.isFinite(price)) return;

      const previousClose = toNumber(payload?.previous_close);
      const rawChange = toNumber(payload?.change);
      const rawPercent = toNumber(payload?.percent_change ?? payload?.percentChange);
      const change = Number.isFinite(rawChange)
        ? rawChange
        : Number.isFinite(previousClose)
          ? price - previousClose
          : null;
      const changePercent = Number.isFinite(rawPercent)
        ? rawPercent
        : Number.isFinite(change) && Number.isFinite(previousClose) && previousClose !== 0
          ? (change / previousClose) * 100
          : null;
      const name = String(payload?.name || payload?.instrument_name || payload?.display_name || '').trim();

      setQuotesBySymbol((previous) => {
        const current = previous[normalized];
        const currentPrice = toNumber(current?.price);
        const hasRealPrice = Number.isFinite(currentPrice) && current?.isPlaceholder !== true;
        if (hasRealPrice) return previous;

        return {
          ...previous,
          [normalized]: {
            ...current,
            symbol: normalized,
            price,
            change,
            changePercent,
            isMarketOpen: parseMarketOpen(payload?.is_market_open),
            timestamp: payload?.timestamp || payload?.datetime || Date.now(),
            name: name || current?.name,
            source: 'placeholder',
            isPlaceholder: true,
          },
        };
      });

      if (name) {
        setWatchlistNamesBySymbol((previous) => {
          if (previous[normalized] === name) return previous;
          return {
            ...previous,
            [normalized]: name,
          };
        });
      }
    } catch {}
  }, [apiKey]);

  const clearNoStreamDataTimer = useCallback(() => {
    if (!noStreamDataTimerRef.current) return;
    clearTimeout(noStreamDataTimerRef.current);
    noStreamDataTimerRef.current = null;
  }, []);

  const stopRestFallbackPolling = useCallback(() => {
    restFallbackActiveRef.current = false;
    if (!restPollTimerRef.current) return;
    clearInterval(restPollTimerRef.current);
    restPollTimerRef.current = null;
  }, []);

  const fetchQuoteSnapshot = useCallback(async () => {
    if (!apiKey) return;

    const symbols = [...watchlistRef.current].map(normalizeSymbol).filter(Boolean);
    if (symbols.length === 0) return;

    const updates = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const params = new URLSearchParams({
            symbol,
            apikey: apiKey,
          });

          const response = await fetch(`${TWELVE_DATA_QUOTE_URL}?${params.toString()}`, {
            cache: 'no-store',
          });
          const payload = await response.json().catch(() => ({}));

          if (!response.ok || payload?.status === 'error') return null;
          if (payload?.code && String(payload.code) !== '200') return null;

          const price = toNumber(payload?.close ?? payload?.last ?? payload?.price);
          if (!Number.isFinite(price)) return null;

          const previousClose = toNumber(payload?.previous_close);
          const rawChange = toNumber(payload?.change);
          const rawPercent = toNumber(payload?.percent_change ?? payload?.percentChange);
          const change = Number.isFinite(rawChange)
            ? rawChange
            : Number.isFinite(previousClose)
              ? price - previousClose
              : null;
          const changePercent = Number.isFinite(rawPercent)
            ? rawPercent
            : Number.isFinite(change) && Number.isFinite(previousClose) && previousClose !== 0
              ? (change / previousClose) * 100
              : null;

          return {
            symbol,
            price,
            change,
            changePercent,
            isMarketOpen: parseMarketOpen(payload?.is_market_open),
            timestamp: payload?.timestamp || payload?.datetime || Date.now(),
            name: String(payload?.name || payload?.instrument_name || payload?.display_name || '').trim() || undefined,
            source: 'rest',
            isPlaceholder: false,
          };
        } catch {
          return null;
        }
      })
    );

    const validUpdates = updates.filter(Boolean);
    if (validUpdates.length === 0) return;

    setQuotesBySymbol((previous) => {
      const next = { ...previous };
      validUpdates.forEach((quote) => {
        next[quote.symbol] = {
          ...previous[quote.symbol],
          ...quote,
        };
      });
      return next;
    });
    setWatchlistNamesBySymbol((previous) => {
      let hasUpdate = false;
      const next = { ...previous };
      validUpdates.forEach((quote) => {
        const normalized = normalizeSymbol(quote?.symbol);
        const name = String(quote?.name || '').trim();
        if (!normalized || !name || next[normalized] === name) return;
        next[normalized] = name;
        hasUpdate = true;
      });
      return hasUpdate ? next : previous;
    });

    if (validUpdates.some((quote) => quote.isMarketOpen === true) && restFallbackActiveRef.current) {
      stopRestFallbackPolling();
      setStreamStatus((previous) => ({
        ...previous,
        error: '',
      }));
    }
  }, [apiKey, stopRestFallbackPolling]);

  const startRestFallbackPolling = useCallback(() => {
    if (restFallbackActiveRef.current) return;
    restFallbackActiveRef.current = true;

    void fetchQuoteSnapshot();
    restPollTimerRef.current = setInterval(() => {
      void fetchQuoteSnapshot();
    }, CLOSED_MARKET_POLL_INTERVAL_MS);
  }, [fetchQuoteSnapshot]);

  const applyPriceToChart = useCallback((symbol, price, timestamp) => {
    if (!Number.isFinite(price)) return;
    if (normalizeSymbol(symbol) !== selectedSymbolRef.current) return;
    if (!candleSeriesRef.current) return;

    const timeSeconds = toUnixSeconds(timestamp) || Math.floor(Date.now() / 1000);
    const bucketTime = getBucketTimeForTimeframe(timeSeconds, chartTimeframeRef.current);
    const previous = lastBarRef.current;

    if (!previous || !Number.isFinite(previous.time)) {
      const initialBar = {
        time: bucketTime,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 0,
      };
      lastBarRef.current = initialBar;
      candleSeriesRef.current.update(initialBar);
      volumeSeriesRef.current?.update({
        time: initialBar.time,
        value: 0,
        color: VOLUME_UP,
      });
      return;
    }

    if (bucketTime > previous.time) {
      const nextBar = {
        time: bucketTime,
        open: previous.close,
        high: price,
        low: price,
        close: price,
        volume: 0,
      };
      lastBarRef.current = nextBar;

      candleSeriesRef.current.update(nextBar);
      volumeSeriesRef.current?.update({
        time: nextBar.time,
        value: 0,
        color: nextBar.close >= nextBar.open ? VOLUME_UP : VOLUME_DOWN,
      });
      return;
    }

    if (bucketTime < previous.time) return;

    const updatedBar = {
      ...previous,
      close: price,
      high: Math.max(previous.high, price),
      low: Math.min(previous.low, price),
    };

    lastBarRef.current = updatedBar;
    candleSeriesRef.current.update(updatedBar);
    volumeSeriesRef.current?.update({
      time: updatedBar.time,
      value: Number.isFinite(updatedBar.volume) ? updatedBar.volume : 0,
      color: updatedBar.close >= updatedBar.open ? VOLUME_UP : VOLUME_DOWN,
    });
  }, []);

  useEffect(() => {
    if (!chartContainerRef.current) return undefined;

    const chart = createChart(chartContainerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#0b0b0b' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.03)' },
      },
      crosshair: {
        vertLine: { color: 'rgba(255,255,255,0.15)', width: 1 },
        horzLine: { color: 'rgba(255,255,255,0.15)', width: 1 },
      },
      rightPriceScale: {
        borderColor: '#1f1f1f',
        scaleMargins: { top: 0.08, bottom: 0.2 },
      },
      timeScale: {
        borderColor: '#1f1f1f',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 3,
        barSpacing: 5,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: UP_COLOR,
      downColor: DOWN_COLOR,
      wickUpColor: UP_COLOR,
      wickDownColor: DOWN_COLOR,
      borderUpColor: UP_COLOR,
      borderDownColor: DOWN_COLOR,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
      borderVisible: false,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    setChartReady(true);

    return () => {
      setChartReady(false);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      lastBarRef.current = null;
    };
  }, []);

  const loadCandles = useCallback(async (symbol, timeframeId = chartTimeframeRef.current) => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;

    const normalized = normalizeSymbol(symbol);
    const timeframeConfig = CHART_TIMEFRAME_BY_ID[timeframeId] || CHART_TIMEFRAME_BY_ID[DEFAULT_CHART_TIMEFRAME];
    if (!normalized) {
      candleSeriesRef.current.setData([]);
      volumeSeriesRef.current.setData([]);
      lastBarRef.current = null;
      setChartStatus({ loading: false, error: 'Add a ticker to load chart data.' });
      return;
    }

    if (!apiKey) {
      candleSeriesRef.current.setData([]);
      volumeSeriesRef.current.setData([]);
      lastBarRef.current = null;
      setChartStatus({ loading: false, error: 'Missing VITE_TWELVE_DATA_API_KEY.' });
      return;
    }

    setChartStatus({ loading: true, error: '' });

    try {
      const params = new URLSearchParams({
        symbol: normalized,
        interval: timeframeConfig.interval,
        outputsize: timeframeConfig.outputsize,
        format: 'JSON',
        apikey: apiKey,
      });

      const response = await fetch(`${TWELVE_DATA_REST_URL}?${params.toString()}`, {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload?.status === 'error') {
        throw new Error(payload?.message || payload?.code || 'Failed to load chart data.');
      }

      const values = Array.isArray(payload?.values) ? payload.values : [];
      let previousClose = null;
      const parsed = values
        .map((entry) => {
          const bar = toCandleBar(entry, previousClose);
          if (bar) previousClose = bar.close;
          return bar;
        })
        .filter(Boolean)
        .sort((a, b) => a.time - b.time);

      const deduped = [];
      parsed.forEach((bar) => {
        const latest = deduped[deduped.length - 1];
        if (latest && latest.time === bar.time) {
          deduped[deduped.length - 1] = bar;
          return;
        }
        deduped.push(bar);
      });

      if (deduped.length === 0) {
        candleSeriesRef.current.setData([]);
        volumeSeriesRef.current.setData([]);
        lastBarRef.current = null;
        setChartStatus({ loading: false, error: 'No candles returned for this symbol.' });
        return;
      }

      candleSeriesRef.current.setData(
        deduped.map((bar) => ({
          time: bar.time,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
        }))
      );

      volumeSeriesRef.current.setData(
        deduped.map((bar) => ({
          time: bar.time,
          value: Number.isFinite(bar.volume) ? bar.volume : 0,
          color: bar.close >= bar.open ? VOLUME_UP : VOLUME_DOWN,
        }))
      );

      chartRef.current?.timeScale().fitContent();
      lastBarRef.current = deduped[deduped.length - 1];
      setChartStatus({ loading: false, error: '' });
    } catch (error) {
      setChartStatus({
        loading: false,
        error: error?.message || 'Failed to load chart data.',
      });
    }
  }, [apiKey]);

  useEffect(() => {
    if (!chartReady) return;
    loadCandles(selectedSymbol, chartTimeframe);
  }, [chartReady, chartTimeframe, selectedSymbol, loadCandles]);

  useEffect(() => {
    const symbols = watchlist.map(normalizeSymbol).filter(Boolean);
    const nextWatchlistSet = new Set(symbols);
    watchlistRef.current = nextWatchlistSet;

    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const subscribed = subscribedSymbolsRef.current;
    const toSubscribe = symbols.filter((symbol) => !subscribed.has(symbol));
    const toUnsubscribe = [...subscribed].filter((symbol) => !nextWatchlistSet.has(symbol));

    if (toSubscribe.length > 0) {
      ws.send(
        JSON.stringify({
          action: 'subscribe',
          params: { symbols: toSubscribe.join(',') },
        })
      );
      toSubscribe.forEach((symbol) => subscribed.add(symbol));
    }

    if (toUnsubscribe.length > 0) {
      ws.send(
        JSON.stringify({
          action: 'unsubscribe',
          params: { symbols: toUnsubscribe.join(',') },
        })
      );
      toUnsubscribe.forEach((symbol) => subscribed.delete(symbol));
    }
  }, [watchlist]);

  useEffect(() => {
    if (!restFallbackActiveRef.current) return;
    void fetchQuoteSnapshot();
  }, [watchlist, fetchQuoteSnapshot]);

  useEffect(() => {
    if (!apiKey) {
      clearNoStreamDataTimer();
      stopRestFallbackPolling();
      setStreamStatus({
        connected: false,
        connecting: false,
        retryCount: 0,
        error: 'Missing VITE_TWELVE_DATA_API_KEY.',
      });
      return undefined;
    }

    closedByUserRef.current = false;

    const clearReconnectTimer = () => {
      if (!reconnectTimerRef.current) return;
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    };

    const dispatchPrice = (payload) => {
      const symbol = normalizeSymbol(payload?.symbol || payload?.meta?.symbol);
      if (!symbol) return;

      const price = toNumber(payload?.price ?? payload?.close ?? payload?.last);
      if (!Number.isFinite(price)) return;

      wsHasReceivedPriceRef.current = true;
      clearNoStreamDataTimer();
      if (restFallbackActiveRef.current) {
        stopRestFallbackPolling();
      }

      const rawChange = toNumber(payload?.change);
      const rawPercent = toNumber(payload?.percent_change ?? payload?.percentChange);

      setQuotesBySymbol((previous) => {
        const previousQuote = previous[symbol] || {};
        const previousPrice = toNumber(previousQuote?.price);

        const change = Number.isFinite(rawChange)
          ? rawChange
          : Number.isFinite(previousPrice)
            ? price - previousPrice
            : null;

        const changePercent = Number.isFinite(rawPercent)
          ? rawPercent
          : Number.isFinite(change) && Number.isFinite(price - change) && price - change !== 0
            ? (change / (price - change)) * 100
            : null;

        return {
          ...previous,
          [symbol]: {
            symbol,
            price,
            change,
            changePercent,
            isMarketOpen: true,
            timestamp: payload?.timestamp || payload?.datetime || Date.now(),
            name: String(payload?.name || payload?.instrument_name || payload?.display_name || previousQuote?.name || '').trim() || undefined,
            source: 'stream',
            isPlaceholder: false,
          },
        };
      });

      applyPriceToChart(symbol, price, payload?.timestamp || payload?.datetime);
    };

    const handlePayload = (payload) => {
      if (!payload) return;

      if (Array.isArray(payload)) {
        payload.forEach((entry) => handlePayload(entry));
        return;
      }

      if (payload?.event === 'price') {
        dispatchPrice(payload);
        return;
      }

      if (payload?.symbol && (payload?.price || payload?.close || payload?.last)) {
        dispatchPrice(payload);
        return;
      }

      if (payload?.event === 'error') {
        setStreamStatus((previous) => ({
          ...previous,
          error: payload?.message || 'Twelve Data stream error.',
        }));
      }
    };

    const scheduleReconnect = (connect) => {
      if (closedByUserRef.current || reconnectTimerRef.current) return;

      reconnectAttemptsRef.current += 1;
      const delay = Math.min(
        RECONNECT_MAX_MS,
        RECONNECT_MIN_MS * 2 ** Math.min(reconnectAttemptsRef.current - 1, 5),
      );

      setStreamStatus((previous) => ({
        ...previous,
        connected: false,
        connecting: false,
        retryCount: reconnectAttemptsRef.current,
      }));

      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, delay);
    };

    const connect = () => {
      if (closedByUserRef.current) return;

      setStreamStatus((previous) => ({
        ...previous,
        connecting: true,
        error: '',
      }));

      const ws = new WebSocket(`${TWELVE_DATA_WS_URL}?apikey=${apiKey}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (wsRef.current !== ws) return;

        reconnectAttemptsRef.current = 0;
        subscribedSymbolsRef.current.clear();
        wsHasReceivedPriceRef.current = false;
        clearNoStreamDataTimer();

        setStreamStatus({
          connected: true,
          connecting: false,
          retryCount: 0,
          error: '',
        });

        const symbols = [...watchlistRef.current];
        if (symbols.length > 0) {
          ws.send(
            JSON.stringify({
              action: 'subscribe',
              params: { symbols: symbols.join(',') },
            })
          );
          symbols.forEach((symbol) => subscribedSymbolsRef.current.add(symbol));
        }

        noStreamDataTimerRef.current = setTimeout(() => {
          if (closedByUserRef.current) return;
          if (wsRef.current !== ws) return;
          if (wsHasReceivedPriceRef.current) return;
          startRestFallbackPolling();
        }, NO_STREAM_DATA_TIMEOUT_MS);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data || '{}');
          handlePayload(payload);
        } catch {
          setStreamStatus((previous) => ({
            ...previous,
            error: 'Failed to parse Twelve Data message.',
          }));
        }
      };

      ws.onerror = () => {
        setStreamStatus((previous) => ({
          ...previous,
          error: 'Twelve Data websocket error.',
        }));
      };

      ws.onclose = () => {
        clearNoStreamDataTimer();
        if (wsRef.current === ws) wsRef.current = null;

        setStreamStatus((previous) => ({
          ...previous,
          connected: false,
          connecting: false,
        }));

        if (!closedByUserRef.current) {
          scheduleReconnect(connect);
        }
      };
    };

    connect();

    return () => {
      closedByUserRef.current = true;
      clearReconnectTimer();
      clearNoStreamDataTimer();
      stopRestFallbackPolling();
      subscribedSymbolsRef.current.clear();
      reconnectAttemptsRef.current = 0;

      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) {
        try {
          ws.close(1000, 'Trader page cleanup');
        } catch {}
      }
    };
  }, [
    apiKey,
    applyPriceToChart,
    clearNoStreamDataTimer,
    startRestFallbackPolling,
    stopRestFallbackPolling,
  ]);

  const addSymbolToWatchlist = useCallback((symbolValue, companyName = '') => {
    const normalized = normalizeSymbol(symbolValue);
    if (!normalized) return;
    const isExistingSymbol = watchlistRef.current.has(normalized);

    const normalizedName = String(companyName || '').trim() || MARKET_NAME_BY_SYMBOL[normalized] || '';
    if (normalizedName) {
      setWatchlistNamesBySymbol((previous) => {
        if (previous[normalized] === normalizedName) return previous;
        return {
          ...previous,
          [normalized]: normalizedName,
        };
      });
    }

    setWatchlist((previous) => {
      if (previous.includes(normalized)) return previous;
      return [normalized, ...previous];
    });
    setSelectedSymbol(normalized);
    setSymbolInput('');
    setSearchResults([]);
    setIsSearchLoading(false);
    setIsSearchDropdownOpen(false);

    if (!isExistingSymbol) {
      void fetchImmediateClosePlaceholder(normalized);
    }
  }, [fetchImmediateClosePlaceholder]);

  const addSymbol = (event) => {
    event.preventDefault();
    const topResult = searchResults[0];
    if (topResult?.symbol) {
      addSymbolToWatchlist(topResult.symbol, topResult.name);
      return;
    }
    addSymbolToWatchlist(symbolInput);
  };

  const removeSymbolFromWatchlist = useCallback((symbolToRemove) => {
    const normalized = normalizeSymbol(symbolToRemove);
    if (!normalized) return;

    setWatchlist((previous) => previous.filter((symbol) => symbol !== normalized));
    setWatchlistNamesBySymbol((previous) => {
      if (!previous[normalized]) return previous;
      const next = { ...previous };
      delete next[normalized];
      return next;
    });
  }, []);

  const resetDragPreview = useCallback(() => {
    dragPositionYRef.current = null;
    setActiveDragTicker('');
    setDragPreviewScale(1);
  }, []);

  const updateDragPreviewScale = useCallback((draggableId) => {
    const dragCenterY = getDraggedTickerCenterY(draggableId);
    if (!Number.isFinite(dragCenterY)) return;

    dragPositionYRef.current = dragCenterY;

    const dropZoneBounds = getPinnedPillsDropZoneBounds();
    if (!dropZoneBounds) {
      setDragPreviewScale((previous) => (previous === 1 ? previous : 1));
      return;
    }

    const distanceToDropZone =
      dragCenterY > dropZoneBounds.bottom
        ? dragCenterY - dropZoneBounds.bottom
        : dragCenterY < dropZoneBounds.top
          ? dropZoneBounds.top - dragCenterY
          : 0;

    const nextScale = getDragPreviewScaleByDistance(distanceToDropZone);
    setDragPreviewScale((previous) => (Math.abs(previous - nextScale) < 0.01 ? previous : nextScale));
  }, []);

  const handleDragStart = useCallback((start) => {
    const draggableId = String(start?.draggableId || '').trim();
    if (!draggableId) return;

    setActiveDragTicker(draggableId);
    setDragPreviewScale(1);
    dragPositionYRef.current = null;

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        updateDragPreviewScale(draggableId);
      });
      return;
    }

    updateDragPreviewScale(draggableId);
  }, [updateDragPreviewScale]);

  const handleDragUpdate = useCallback((update) => {
    const draggableId = String(update?.draggableId || '').trim();
    if (!draggableId) return;

    setActiveDragTicker((previous) => (previous === draggableId ? previous : draggableId));
    updateDragPreviewScale(draggableId);
  }, [updateDragPreviewScale]);

  const getDragPreviewStyle = useCallback((providedStyle, isDragging, symbol) => {
    if (!isDragging || symbol !== activeDragTicker) return providedStyle;

    const baseStyle = providedStyle || {};
    const baseTransform = baseStyle.transform || '';
    return {
      ...baseStyle,
      transform: `${baseTransform} scale(${dragPreviewScale})`.trim(),
      transformOrigin: 'center center',
    };
  }, [activeDragTicker, dragPreviewScale]);

  const handleDragEnd = useCallback((result) => {
    resetDragPreview();
    if (!result.destination) return;

    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;
    if (sourceIndex === destIndex) return;

    setWatchlist((previous) => {
      const reordered = Array.from(previous);
      const [removed] = reordered.splice(sourceIndex, 1);
      if (!removed) return previous;
      reordered.splice(destIndex, 0, removed);
      return reordered;
    });
  }, [resetDragPreview]);

  const streamLabel = streamStatus.connected
    ? 'Connected'
    : streamStatus.connecting
      ? 'Connecting...'
      : streamStatus.retryCount > 0
        ? `Reconnecting (${streamStatus.retryCount})`
        : 'Disconnected';

  return (
    <div className="h-full w-full bg-[#0b0b0b] text-[#e5e7eb]">
      <div
        className={`grid h-full min-h-0 grid-cols-1 transition-[grid-template-columns] duration-200 ease-in-out ${
          isWatchlistCollapsed ? 'lg:grid-cols-[60px_1fr]' : 'lg:grid-cols-[300px_1fr]'
        }`}
      >
        <aside className="flex min-h-0 flex-col overflow-hidden border-b border-[#1f1f1f] lg:border-b-0 lg:border-r">
          <div className={`border-b border-[#1f1f1f] py-3 ${isWatchlistCollapsed ? 'px-2' : 'px-4'}`}>
            <div className={`flex items-center ${isWatchlistCollapsed ? 'justify-center' : 'justify-between gap-3'}`}>
              {!isWatchlistCollapsed && (
                <div className="min-w-0">
                  <h2 className="text-sm font-medium text-white">Watchlist</h2>
                  <p className="mt-1 text-xs text-[#7c8087]">Search, add, and stream symbols in real time.</p>
                </div>
              )}
              <button
                type="button"
                onClick={() => setIsWatchlistCollapsed((previous) => !previous)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-[#1f1f1f] bg-[#0f1012] text-[#9ca3af] transition-colors hover:border-[#374151] hover:text-white"
                aria-label={isWatchlistCollapsed ? 'Expand watchlist' : 'Collapse watchlist'}
              >
                {isWatchlistCollapsed ? (
                  <ChevronsRight className="h-4 w-4" strokeWidth={1.8} />
                ) : (
                  <ChevronsLeft className="h-4 w-4" strokeWidth={1.8} />
                )}
              </button>
            </div>
          </div>

          {!isWatchlistCollapsed && (
            <>
              <form onSubmit={addSymbol} className="border-b border-[#1f1f1f] px-4 py-3">
                <div className="mb-3 grid grid-cols-4 gap-2">
                  {MARKET_FILTERS.map((market) => {
                    const isActive = activeMarket === market.id;
                    return (
                      <button
                        key={market.id}
                        type="button"
                        onClick={() => setActiveMarket(market.id)}
                        className={`h-8 border px-2 text-[11px] font-medium text-[#d1d5db] transition-colors ${
                          isActive
                            ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300'
                            : 'border-[#1f1f1f] bg-[#0b0b0b] hover:bg-white/5'
                        }`}
                      >
                        {market.label}
                      </button>
                    );
                  })}
                </div>
                <div ref={searchContainerRef} className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]" strokeWidth={1.5} />
                  <input
                    value={symbolInput}
                    onChange={(event) => setSymbolInput(event.target.value)}
                    onFocus={() => {
                      if (symbolInput.trim()) setIsSearchDropdownOpen(true);
                    }}
                    placeholder="Search symbols in selected market..."
                    autoComplete="off"
                    className="h-10 w-full border border-[#1f1f1f] bg-[#0b0b0b] pl-9 pr-3 text-sm text-white outline-none transition-colors focus:border-emerald-500/70"
                  />
                  {isSearchDropdownOpen && symbolInput.trim() && (
                    <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden border border-[#1f1f1f] bg-[#0f1012] shadow-[0_14px_30px_rgba(0,0,0,0.4)]">
                      {searchResults.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-[#7c8087]">
                          {isSearchLoading ? 'Searching symbols...' : 'No matching symbols.'}
                        </div>
                      ) : (
                        searchResults.map((result) => (
                          <button
                            key={`${result.symbol}-${result.exchange}`}
                            type="button"
                            onClick={() => addSymbolToWatchlist(result.symbol, result.name)}
                            className="flex h-10 w-full items-center justify-between border-b border-[#1f1f1f] px-3 text-left transition-colors last:border-b-0 hover:bg-white/[0.03]"
                          >
                            <span className="truncate text-sm text-white">
                              <span className="font-medium">{result.symbol}</span>
                              <span className="ml-1 text-[#7c8087]">· {result.exchange}</span>
                            </span>
                            <Plus className="h-4 w-4 text-emerald-400" strokeWidth={1.8} />
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </form>

              <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex items-center justify-between border-b border-[#1f1f1f] px-4 py-2 text-xs">
                  <span className="text-[#9ca3af]">Stream: {streamLabel}</span>
                  {streamStatus.error ? (
                    <span className="text-red-400">{streamStatus.error}</span>
                  ) : (
                    <span className="text-emerald-400">{watchlist.length} symbols</span>
                  )}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto scrollbar-hide">
                  <DragDropContext onDragStart={handleDragStart} onDragUpdate={handleDragUpdate} onDragEnd={handleDragEnd}>
                    <Droppable droppableId="watchlist">
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className="min-h-full">
                          {watchlist.length === 0 ? (
                            <div className="px-4 py-6 text-center text-white/50 text-sm">
                              Watchlist is empty. Search to add symbols.
                            </div>
                          ) : (
                            watchlist.map((symbol, index) => {
                              const quote = quotesBySymbol[symbol] || {};
                              const price = toNumber(quote?.price);
                              const change = toNumber(quote?.change) ?? 0;
                              const changePercent = toNumber(quote?.changePercent) ?? 0;
                              const isPositive = changePercent !== 0 ? changePercent >= 0 : change >= 0;
                              const isSelected = selectedSymbol === symbol;
                              const isPlaceholder = quote?.isPlaceholder === true;
                              const companyName = String(
                                quote?.name || watchlistNamesBySymbol[symbol] || MARKET_NAME_BY_SYMBOL[symbol] || symbol
                              ).trim();

                              return (
                                <Draggable key={symbol} draggableId={symbol} index={index}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      draggable="true"
                                      onDragStart={(event) => {
                                        event.dataTransfer.setData('text/plain', symbol);
                                        event.dataTransfer.effectAllowed = 'copy';
                                      }}
                                      className={`group relative flex items-center justify-between cursor-pointer transition-all transition-transform duration-150 border-b border-[#1f1f1f]/30 ${
                                        isSelected ? 'bg-emerald-500/5 border-l border-l-emerald-500/30' : 'hover:bg-white/5'
                                      } px-4 py-3 ${
                                        snapshot.isDragging ? 'bg-[#1a1a1a] shadow-lg ring-1 ring-emerald-500/40' : ''
                                      }`}
                                      style={getDragPreviewStyle(provided.draggableProps.style, snapshot.isDragging, symbol)}
                                      onClick={() => setSelectedSymbol(symbol)}
                                    >
                                      <div
                                        {...provided.dragHandleProps}
                                        className="mr-2 text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing"
                                      >
                                        <GripVertical className="w-4 h-4" />
                                      </div>

                                      <div className="flex-1 min-w-0 pr-4">
                                        <div className="text-white font-bold text-base">${symbol}</div>
                                        <div className="text-white/50 text-sm truncate">{companyName}</div>
                                      </div>

                                      <div className="ml-auto pr-3 text-right flex-shrink-0">
                                        <div className={`font-semibold text-base font-mono ${isPlaceholder ? 'text-white/80' : 'text-white'}`}>
                                          {Number.isFinite(price) ? formatPrice(price) : '...'}
                                        </div>
                                        {Number.isFinite(price) && !isPlaceholder && (
                                          <div className="flex flex-col items-end gap-1">
                                            <span
                                              className={`px-2 py-0.5 rounded text-xs font-semibold ${isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}
                                            >
                                              {`${isPositive ? '+' : ''}${changePercent.toFixed(2)}%`}
                                            </span>
                                          </div>
                                        )}
                                      </div>

                                      <button
                                        type="button"
                                        aria-label={`Remove ${symbol} from watchlist`}
                                        className="pointer-events-none ml-1 inline-flex h-8 w-8 items-center justify-center text-gray-400 opacity-0 transition-all duration-200 group-hover:pointer-events-auto group-hover:opacity-100 hover:text-red-400"
                                        onPointerDown={(event) => {
                                          event.stopPropagation();
                                        }}
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          removeSymbolFromWatchlist(symbol);
                                        }}
                                      >
                                        <X className="h-4 w-4" />
                                      </button>
                                    </div>
                                  )}
                                </Draggable>
                              );
                            })
                          )}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </DragDropContext>
                </div>
              </div>
            </>
          )}
          {isWatchlistCollapsed && (
            <div className="flex-1 overflow-y-auto px-1 py-2 space-y-1">
              {watchlist.map((symbol) => {
                const quote = quotesBySymbol[symbol] || {};
                const changePercent = toNumber(quote?.changePercent) ?? 0;
                const isPositive = changePercent >= 0;
                const isSelected = selectedSymbol === symbol;

                return (
                  <button
                    key={symbol}
                    onClick={() => setSelectedSymbol(symbol)}
                    className={`w-full py-2 px-1 rounded transition-colors ${
                      isSelected ? 'bg-emerald-500/10 border border-emerald-500/30' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="text-white font-semibold text-xs">{symbol}</div>
                    <div
                      className={`text-[10px] font-mono font-semibold mt-0.5 ${
                        isPositive ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {changePercent.toFixed(1)}%
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <section className="flex min-h-0 flex-col">
          <div className="flex items-center justify-between border-b border-[#1f1f1f] px-4 py-3">
            <div>
              <h2 className="text-sm font-medium text-white">{selectedSymbol || 'Select a symbol'}</h2>
              <p className="mt-1 text-xs text-[#7c8087]">Candlestick chart · {selectedChartTimeframe.label}</p>
            </div>
            <div className="text-right">
              <div className={`text-lg font-semibold tabular-nums ${selectedQuoteIsPlaceholder ? 'text-white/80' : 'text-white'}`}>
                {formatPrice(selectedQuote?.price)}
              </div>
              <div
                className={`text-xs font-medium tabular-nums ${
                  Number.isFinite(Number(selectedQuote?.changePercent))
                    ? Number(selectedQuote?.changePercent) >= 0
                      ? 'text-emerald-400'
                      : 'text-red-400'
                    : 'text-[#6b7280]'
                }`}
              >
                {formatSignedPercent(selectedQuote?.changePercent)}
              </div>
            </div>
          </div>

          <div className="border-b border-[#1f1f1f] px-4 py-2">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
              {CHART_TIMEFRAME_OPTIONS.map((timeframe) => {
                const isActive = chartTimeframe === timeframe.id;
                return (
                  <button
                    key={timeframe.id}
                    type="button"
                    onClick={() => setChartTimeframe(timeframe.id)}
                    className={`h-7 shrink-0 border px-2.5 text-[11px] font-medium transition-colors ${
                      isActive
                        ? 'border-emerald-400 bg-emerald-500/10 text-emerald-400'
                        : 'border-[#1f1f1f] text-gray-400 hover:bg-white/5 hover:text-white'
                    }`}
                    aria-pressed={isActive}
                  >
                    {timeframe.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative min-h-[260px] flex-1">
            <div ref={chartContainerRef} className="h-full w-full" />

            {chartStatus.loading && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#0b0b0b]/55 text-sm text-[#9ca3af]">
                Loading candles...
              </div>
            )}

            {!chartStatus.loading && chartStatus.error && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#0b0b0b]/65 px-6 text-center text-sm text-[#9ca3af]">
                {chartStatus.error}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
