import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import { createChart, CandlestickSeries, ColorType, CrosshairMode, HistogramSeries, LineSeries, LineStyle } from 'lightweight-charts';
import { Activity, AlarmClock, BarChart2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsDown, ChevronsLeft, ChevronsRight, ChevronsUp, Clock, GripVertical, Newspaper, Pin, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { formatCurrency, formatPercent } from '../../lib/twelvedata';
import { getExtendedHoursStatus } from '../../lib/marketHours';
import OrderTicketPanel from './OrderTicketPanel';
import useTradingMode from '../../hooks/useTradingMode';
import { useNews, useSentiment } from '../../hooks/useMarketAux';
import { usePaperTrading } from '../../hooks/usePaperTrading';
import SentimentBadge from './SentimentBadge';
import ErrorBoundary from '../shared/AppErrorBoundary';
import MiniGamePill from '../shared/MiniGamePill';
import { createLineToolsPlugin } from 'lightweight-charts-line-tools-core';
import { LineToolTrendLine, LineToolHorizontalLine, LineToolVerticalLine, LineToolRay } from 'lightweight-charts-line-tools-lines';
import { LineToolRectangle } from 'lightweight-charts-line-tools-rectangle';
import { LineToolFibRetracement } from 'lightweight-charts-line-tools-fib-retracement';
import { LineToolParallelChannel } from 'lightweight-charts-line-tools-parallel-channel';
import DrawingToolbar from '../chart/DrawingToolbar';
import { VolumeProfilePlugin } from '../../plugins/VolumeProfilePlugin';
import { SessionHighlightPlugin } from '../../plugins/SessionHighlightPlugin';
import { PriceAlertsPlugin } from '../../plugins/PriceAlertsPlugin';
import { getStoredDrawings, saveDrawings } from '../../lib/chartDrawingsStorage';
import { CANDLE_PALETTES, CHART_DISPLAY_OPTIONS } from './ChartDisplayIcons';
import LiveOddsPanel from './LiveOddsPanel';
import CreateAlertModal from './CreateAlertModal';

function newsTimeAgo(dateStr) {
  if (!dateStr) return '';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function newsSourceLabel(source) {
  if (!source) return '';
  return source.replace(/^www\./, '').replace(/\.(com|org|net|co)$/, '').split('.').pop() || source;
}

const GENERIC_IMAGE_PATTERNS = [
  'investingcom_analysis_og',
  'smw-icon',
];
function isGenericSourceImage(url) {
  if (!url || typeof url !== 'string') return true;
  return GENERIC_IMAGE_PATTERNS.some((pattern) => url.includes(pattern));
}

const TWELVE_DATA_WS_URL = 'wss://ws.twelvedata.com/v1/quotes/price';
const API_BASE = String(import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
const withApiBase = (path) => `${API_BASE}${path}`;
const CHART_CANDLES_ENDPOINT = withApiBase('/api/chart/candles');

const WATCHLIST_STORAGE_KEY = 'stratify-trader-watchlist';
const WATCHLIST_ORDER_STORAGE_KEY = 'watchlist_order';
const WATCHLIST_COLLAPSED_STORAGE_KEY = 'stratify-trader-watchlist-collapsed';
const ACTIVE_MARKET_STORAGE_KEY = 'stratify-trader-active-market';
const CHART_TIMEFRAME_STORAGE_KEY = 'stratify-trader-chart-timeframe';
const CHART_VIEWPORT_STORAGE_KEY = 'stratify-trader-chart-viewport';
const PREVIOUS_CLOSE_CACHE_STORAGE_KEY = 'stratify-trader-prev-close-cache-v1';
const PREVIOUS_CLOSE_CACHE_TTL_MS = 1000 * 60 * 60 * 48;
const DEFAULT_WATCHLIST = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'SPY'];
const MAX_SYMBOL_SEARCH_RESULTS = 50;
const MARKET_PRIORITY = ['NASDAQ', 'NYSE', 'LSE', 'ASX', 'TSE', 'CRYPTO', 'INDEX'];
const DEFAULT_ACTIVE_MARKET = 'us';
const DEFAULT_CHART_TIMEFRAME = '1D';
const MAX_CHART_OUTPUTSIZE = '5000';
const MARKET_FILTERS = [
  { id: 'us', label: '🇺🇸 NYSE', exchanges: ['NASDAQ', 'NYSE'] },
  { id: 'london', label: '🇬🇧 LSE', exchanges: ['LSE'] },
  { id: 'sydney', label: '🇦🇺 ASX', exchanges: ['ASX'] },
];
const MARKET_FILTER_BY_ID = MARKET_FILTERS.reduce((accumulator, market) => {
  accumulator[market.id] = market;
  return accumulator;
}, {});
const MARKET_SYMBOLS = [
  { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', exchange: 'NASDAQ' },
  { symbol: 'META', name: 'Meta Platforms, Inc.', exchange: 'NASDAQ' },
  { symbol: 'TSLA', name: 'Tesla, Inc.', exchange: 'NASDAQ' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', exchange: 'NYSE' },
  { symbol: 'V', name: 'Visa Inc.', exchange: 'NYSE' },
  { symbol: 'SHEL', name: 'Shell plc', exchange: 'LSE' },
  { symbol: 'AZN', name: 'AstraZeneca PLC', exchange: 'LSE' },
  { symbol: 'HSBA', name: 'HSBC Holdings plc', exchange: 'LSE' },
  { symbol: 'BP', name: 'BP p.l.c.', exchange: 'LSE' },
  { symbol: 'BARC', name: 'Barclays PLC', exchange: 'LSE' },
  { symbol: 'LLOY', name: 'Lloyds Banking Group plc', exchange: 'LSE' },
  { symbol: 'BP.L', name: 'BP p.l.c.', exchange: 'LSE' },
  { symbol: 'VOD.LON', name: 'Vodafone Group Plc', exchange: 'LSE' },
  { symbol: 'BHP', name: 'BHP Group Limited', exchange: 'ASX' },
  { symbol: 'CBA', name: 'Commonwealth Bank of Australia', exchange: 'ASX' },
  { symbol: 'WBC', name: 'Westpac Banking Corporation', exchange: 'ASX' },
  { symbol: 'NAB', name: 'National Australia Bank Limited', exchange: 'ASX' },
  { symbol: 'ANZ', name: 'ANZ Group Holdings Limited', exchange: 'ASX' },
  { symbol: 'CSL', name: 'CSL Limited', exchange: 'ASX' },
  { symbol: '7203.T', name: 'Toyota Motor Corporation', exchange: 'TSE' },
  { symbol: '6758.T', name: 'Sony Group Corporation', exchange: 'TSE' },
  { symbol: 'BHP.AX', name: 'BHP Group Limited', exchange: 'ASX' },
  { symbol: 'CBA.AX', name: 'Commonwealth Bank of Australia', exchange: 'ASX' },
];
const MARKET_WATCHLIST_PRESETS = {
  us: ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META'],
  london: ['SHEL', 'AZN', 'HSBA', 'BP', 'BARC', 'LLOY'],
  sydney: ['BHP', 'CBA', 'WBC', 'NAB', 'ANZ', 'CSL'],
};
const UNIVERSAL_FALLBACK_SYMBOLS = [
  ...MARKET_SYMBOLS,
  { symbol: 'BTC/USD', name: 'Bitcoin / US Dollar', exchange: 'CRYPTO', type: 'Cryptocurrency' },
  { symbol: 'ETH/USD', name: 'Ethereum / US Dollar', exchange: 'CRYPTO', type: 'Cryptocurrency' },
  { symbol: 'SOL/USD', name: 'Solana / US Dollar', exchange: 'CRYPTO', type: 'Cryptocurrency' },
  { symbol: 'XRP/USD', name: 'XRP / US Dollar', exchange: 'CRYPTO', type: 'Cryptocurrency' },
  { symbol: 'SPX', name: 'S&P 500 Index', exchange: 'INDEX', type: 'Index' },
  { symbol: 'NDX', name: 'NASDAQ 100 Index', exchange: 'INDEX', type: 'Index' },
  { symbol: 'DJI', name: 'Dow Jones Industrial Average', exchange: 'INDEX', type: 'Index' },
  { symbol: 'VIX', name: 'CBOE Volatility Index', exchange: 'INDEX', type: 'Index' },
  { symbol: 'FTSE', name: 'FTSE 100 Index', exchange: 'INDEX', type: 'Index' },
  { symbol: 'AXJO', name: 'S&P/ASX 200 Index', exchange: 'INDEX', type: 'Index' },
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
const CHART_BG_THEMES = [
  { id: 'stratify', label: 'Stratify', color: '#060d18' },
  { id: 'deep', label: 'Deep', color: '#070e19' },
  { id: 'abyss', label: 'Abyss', color: '#080f1a' },
  { id: 'void', label: 'Void', color: '#0a0a0f' },
  { id: 'midnight', label: 'Midnight', color: '#0c1018' },
  { id: 'black', label: 'Black', color: '#000000' },
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
const TRADER_ORDER_TYPE_OPTIONS = [
  { value: 'market', label: 'Market' },
  { value: 'limit', label: 'Limit' },
  { value: 'stop', label: 'Stop' },
  { value: 'stop_limit', label: 'Stop Limit' },
  { value: 'trailing_stop', label: 'Trailing Stop' },
];
const NEWS_PANEL_MIN_HEIGHT = 80;
const NEWS_PANEL_MIN_CHART_SPACE = 60;
const WATCHLIST_PANEL_OPEN_WIDTH = 240;
const WATCHLIST_PANEL_COLLAPSED_WIDTH = 60;
const CRYPTO_PORTFOLIO_SYMBOLS = new Set(['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'LINK', 'ADA', 'AVAX', 'DOT']);
const GAME_PILL_SLOTS = [2, 3, 4, 5];
const ESPN_WORDMARK_URL = 'https://upload.wikimedia.org/wikipedia/commons/2/2f/ESPN_wordmark.svg';

const PAGE_TRANSITION = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
};

const sectionMotion = (index) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.1 + (index * 0.05), duration: 0.3 },
});

const listItemMotion = (index) => ({
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0 },
  transition: { delay: index * 0.03, duration: 0.25 },
});

const interactiveTransition = { type: 'spring', stiffness: 400, damping: 25 };
const watchlistRowContainerMotion = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
};
const watchlistRowItemMotion = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 400, damping: 30 } },
};
/* One-page look: panels share the same surface, dividers only (no card shadows) */
const UNIFIED_PANEL_STYLE = {
  background: 'transparent',
  border: 'none',
  boxShadow: 'none',
};
const UNIFIED_TOPBAR_STYLE = {
  background: 'transparent',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
  boxShadow: 'none',
  backdropFilter: 'blur(8px)',
};
const GLASS_SHELL_STYLE = UNIFIED_PANEL_STYLE;
const GLASS_TOPBAR_STYLE = UNIFIED_TOPBAR_STYLE;
// Soft-glass inset cards (stratify-platform + soft-glass-ui): depth + subtle gradient
const GLASS_INSET_CARD_CLASS =
  'rounded-xl border border-white/[0.06] bg-black/40 px-3 py-2.5 backdrop-blur-xl shadow-[inset_4px_4px_8px_rgba(0,0,0,0.5),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] transition-all duration-300';
// Order entry: one continuous panel — divider line only, no card box
const ORDER_ENTRY_SECTION_CLASS =
  'rounded-none border-0 border-t border-white/[0.06] bg-transparent pt-2.5 px-3 pb-2.5';
const GLASS_INSET_INPUT_CLASS = 'h-[36px] w-full rounded-lg border border-white/[0.14] bg-[#0b0b0b] px-3 text-[13px] font-semibold text-white outline-none backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors focus:border-emerald-500/55';

const modalBackdropMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2 },
};

const modalPanelMotion = {
  initial: { opacity: 0, scale: 0.95, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: 10 },
  transition: { type: 'spring', stiffness: 300, damping: 25 },
};

const UP_COLOR = '#34d399';
const DOWN_COLOR = '#ef4444';
const PRICE_LINE_BLUE = '#166534';
const TRADER_CANDLE_PALETTE_KEY = 'stratify-trader-candle-palette';
const TRADER_CHART_DISPLAY_KEY = 'stratify-trader-chart-display';
const VOLUME_UP = 'rgba(52, 211, 153, 0.2)';
const VOLUME_DOWN = 'rgba(239, 68, 68, 0.2)';
const DRAG_PREVIEW_SCALE_BY_DISTANCE = [
  { distance: 200, scale: 1 },
  { distance: 100, scale: 0.75 },
  { distance: 50, scale: 0.5 },
  { distance: 0, scale: 0.4 },
];
const TICKER_DRAG_STATE_EVENT = 'stratify:ticker-drag-state';

const hasGameTransferData = (transfer) => {
  const types = Array.from(transfer?.types || []);
  return types.includes('text/stratify-game')
    || types.includes('application/json')
    || types.includes('text/plain');
};

const parseGameDropPayload = (event) => {
  if (typeof window !== 'undefined') {
    const globalPayload = window.__stratifyDragPayload;
    if (globalPayload?.type === 'game' && globalPayload?.data) {
      return globalPayload;
    }
  }

  const transfer = event?.dataTransfer;
  if (!transfer) return null;

  const rawPayload = transfer.getData('text/stratify-game')
    || transfer.getData('application/json')
    || transfer.getData('text/plain');
  if (!rawPayload) return null;

  try {
    const parsed = JSON.parse(rawPayload);
    if (parsed?.type === 'game' && parsed?.data) return parsed;
    if (parsed?.id && parsed?.homeTeam && parsed?.awayTeam) {
      return { type: 'game', data: parsed };
    }
  } catch {}

  return null;
};

const clearGlobalDragPayload = () => {
  if (typeof window !== 'undefined') {
    delete window.__stratifyDragPayload;
  }
};

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

function PriceFlash({ price, prevPrice, children, className = 'font-mono font-medium' }) {
  const prevPriceRef = useRef(price);
  const controls = useAnimationControls();
  const lastPrice = Number.isFinite(prevPrice) ? prevPrice : prevPriceRef.current;
  const direction = Number.isFinite(price) && Number.isFinite(lastPrice)
    ? (price > lastPrice ? 'up' : price < lastPrice ? 'down' : 'flat')
    : 'flat';

  useEffect(() => {
    const flashColor = direction === 'up'
      ? '#10b981'
      : direction === 'down'
        ? '#ef4444'
        : '#ffffff';
    controls.set({ color: flashColor });
    controls.start({
      color: '#ffffff',
      transition: { type: 'spring', stiffness: 260, damping: 30 },
    });
    prevPriceRef.current = price;
  }, [controls, direction, price]);

  return (
    <motion.span animate={controls} className={className}>
      {children}
    </motion.span>
  );
}

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

const getPointDistanceToRect = (x, y, rect) => {
  const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
  const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
  return Math.hypot(dx, dy);
};

const getPinnedTickerDropTarget = (centerX, centerY, maxDistance = 130) => {
  if (typeof document === 'undefined') return null;
  if (!Number.isFinite(centerX) || !Number.isFinite(centerY)) return null;

  const tickerSlots = Array.from(document.querySelectorAll('[data-pill-slot]'))
    .map((element) => {
      const slot = Number(element?.getAttribute('data-pill-slot'));
      if (!Number.isInteger(slot) || slot < 2 || slot > 5) return null;
      return { slot, rect: element.getBoundingClientRect() };
    })
    .filter(Boolean);

  if (tickerSlots.length === 0) return null;

  const directMatch = tickerSlots.find(({ rect }) => (
    centerX >= rect.left
    && centerX <= rect.right
    && centerY >= rect.top
    && centerY <= rect.bottom
  ));
  if (directMatch) return { slot: directMatch.slot, distance: 0 };

  const closest = tickerSlots.reduce((best, current) => {
    const currentDistance = getPointDistanceToRect(centerX, centerY, current.rect);
    if (!best || currentDistance < best.distance) {
      return { slot: current.slot, distance: currentDistance };
    }
    return best;
  }, null);

  if (!closest || !Number.isFinite(closest.distance) || closest.distance > maxDistance) return null;
  return closest;
};

const getDraggedTickerCenter = (draggableId) => {
  if (typeof document === 'undefined' || !draggableId) return null;

  const draggableElements = Array.from(document.querySelectorAll('[data-rbd-draggable-id]')).filter(
    (element) => element.getAttribute('data-rbd-draggable-id') === draggableId
  );
  if (draggableElements.length === 0) return null;

  const draggingElement =
    draggableElements.find((element) => element.style?.position === 'fixed') ||
    draggableElements[draggableElements.length - 1];
  const rect = draggingElement.getBoundingClientRect();
  if (!Number.isFinite(rect.top) || !Number.isFinite(rect.height) || !Number.isFinite(rect.left) || !Number.isFinite(rect.width)) {
    return null;
  }
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
};

const saveChartViewport = (symbol, timeframeId, visibleRange) => {
  try {
    const key = `${symbol}-${timeframeId}`;
    const stored = JSON.parse(localStorage.getItem(CHART_VIEWPORT_STORAGE_KEY) || '{}');
    stored[key] = visibleRange;
    localStorage.setItem(CHART_VIEWPORT_STORAGE_KEY, JSON.stringify(stored));
  } catch {}
};

const loadChartViewport = (symbol, timeframeId) => {
  try {
    const key = `${symbol}-${timeframeId}`;
    const stored = JSON.parse(localStorage.getItem(CHART_VIEWPORT_STORAGE_KEY) || '{}');
    return stored[key] || null;
  } catch {}
  return null;
};

const normalizeSymbol = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^\$/, '')
    .replace(/\s+/g, '')
    .split(':')
    .pop();

const isCryptoPortfolioSymbol = (value) => {
  const normalized = normalizeSymbol(value);
  if (!normalized) return false;

  const compact = normalized.replace(/[^A-Z0-9]/g, '');
  if (CRYPTO_PORTFOLIO_SYMBOLS.has(compact)) return true;
  if (compact.endsWith('USD') && compact.length > 3) {
    return CRYPTO_PORTFOLIO_SYMBOLS.has(compact.slice(0, -3));
  }

  if (normalized.includes('/')) {
    const base = normalized.split('/')[0];
    return CRYPTO_PORTFOLIO_SYMBOLS.has(base);
  }

  return false;
};


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

const buildSearchResults = (entries, query) => {
  const normalizedQuery = String(query || '').trim();
  if (!normalizedQuery) return [];

  const deduped = [];
  const seenSymbols = new Set();

  entries.forEach((entry) => {
    const symbol = normalizeSymbol(entry?.symbol);
    if (!symbol || seenSymbols.has(symbol)) return;

    const normalizedEntry = {
      symbol,
      exchange: normalizeExchangeLabel(entry?.exchange),
      name: String(entry?.name || '').trim(),
      type: String(entry?.type || '').trim(),
    };

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

const toPaperSymbolKey = (value = '') =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const findPaperPosition = (positions, symbol) => {
  const rows = Array.isArray(positions) ? positions : [];
  const targetKey = toPaperSymbolKey(symbol);
  if (!targetKey) return null;
  return rows.find((position) => toPaperSymbolKey(position?.symbol) === targetKey) || null;
};

const formatPaperSymbol = (value = '') => {
  const normalized = normalizeSymbol(value);
  if (!normalized) return '$--';
  if (normalized.includes('/')) return `$${normalized.split('/')[0]}`;
  if (normalized.endsWith('USD') && normalized.length <= 6) return `$${normalized.slice(0, -3)}`;
  return `$${normalized}`;
};

const formatPaperCurrency = (value) => {
  const parsed = Number(value);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(parsed) ? parsed : 0);
};

const formatSignedPaperCurrency = (value) => {
  const parsed = Number(value);
  const amount = Number.isFinite(parsed) ? parsed : 0;
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
  return `${sign}${formatPaperCurrency(Math.abs(amount))}`;
};

const formatPaperQuantity = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '0';
  return parsed.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: parsed >= 1000 ? 2 : 6,
  });
};

const formatPaperTimestamp = (value) => {
  const parsed = new Date(value || Date.now());
  if (Number.isNaN(parsed.getTime())) return '--';
  return parsed.toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
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

const extractPremarketQuoteMetrics = (payload, fallbackPrice = null, fallbackPreviousClose = null) => {
  const explicitPreviousClose = toNumber(
    payload?.previous_close
    ?? payload?.previousClose
    ?? payload?.prev_close
    ?? payload?.prevClose
  );
  const previousClose = Number.isFinite(explicitPreviousClose)
    ? explicitPreviousClose
    : toNumber(fallbackPreviousClose);

  const preMarketPrice = toNumber(
    payload?.extended_price
    ?? payload?.extendedPrice
    ?? payload?.pre_market_price
    ?? payload?.preMarketPrice
    ?? payload?.premarket_price
    ?? payload?.premarketPrice
  );

  let preMarketChange = toNumber(
    payload?.extended_change
    ?? payload?.extendedChange
    ?? payload?.pre_market_change
    ?? payload?.preMarketChange
    ?? payload?.premarket_change
    ?? payload?.premarketChange
  );

  let preMarketChangePercent = toNumber(
    payload?.extended_percent_change
    ?? payload?.extendedPercentChange
    ?? payload?.pre_market_change_percent
    ?? payload?.preMarketChangePercent
    ?? payload?.premarket_change_percent
    ?? payload?.premarketChangePercent
  );

  const preMarketReferencePrice = Number.isFinite(preMarketPrice)
    ? preMarketPrice
    : toNumber(fallbackPrice);

  if (!Number.isFinite(preMarketChange) && Number.isFinite(preMarketReferencePrice) && Number.isFinite(previousClose)) {
    preMarketChange = preMarketReferencePrice - previousClose;
  }

  if (
    !Number.isFinite(preMarketChangePercent)
    && Number.isFinite(preMarketChange)
    && Number.isFinite(previousClose)
    && previousClose !== 0
  ) {
    preMarketChangePercent = (preMarketChange / previousClose) * 100;
  }

  if (
    !Number.isFinite(preMarketChange)
    && Number.isFinite(preMarketChangePercent)
    && Number.isFinite(previousClose)
  ) {
    preMarketChange = previousClose * (preMarketChangePercent / 100);
  }

  return {
    preMarketPrice: Number.isFinite(preMarketPrice) ? preMarketPrice : null,
    preMarketChange: Number.isFinite(preMarketChange) ? preMarketChange : null,
    preMarketChangePercent: Number.isFinite(preMarketChangePercent) ? preMarketChangePercent : null,
  };
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

const createQuoteValueLoadingState = () => ({
  price: true,
  day: true,
  preMarket: true,
});

const resolvePreviousCloseFromQuote = (quote = {}) => {
  const explicit = toNumber(
    quote?.previousClose
    ?? quote?.previous_close
    ?? quote?.prevClose
    ?? quote?.prev_close
  );
  if (Number.isFinite(explicit)) return explicit;

  const price = toNumber(quote?.price ?? quote?.close ?? quote?.last);
  const change = toNumber(quote?.change);
  if (Number.isFinite(price) && Number.isFinite(change)) {
    return price - change;
  }

  const percent = toNumber(
    quote?.changePercent
    ?? quote?.percentChange
    ?? quote?.percent_change
  );
  if (
    Number.isFinite(price)
    && Number.isFinite(percent)
    && percent !== -100
  ) {
    return price / (1 + (percent / 100));
  }

  return null;
};

const prunePreviousCloseCache = (cache = {}) => {
  const now = Date.now();
  const next = {};

  Object.entries(cache || {}).forEach(([rawSymbol, rawEntry]) => {
    const symbol = normalizeSymbol(rawSymbol);
    if (!symbol || !rawEntry || typeof rawEntry !== 'object') return;

    const previousClose = resolvePreviousCloseFromQuote(rawEntry);
    if (!Number.isFinite(previousClose)) return;

    const updatedAtSeconds = toUnixSeconds(rawEntry?.updatedAt ?? rawEntry?.timestamp);
    const updatedAt = Number.isFinite(updatedAtSeconds) ? updatedAtSeconds * 1000 : now;
    if (now - updatedAt > PREVIOUS_CLOSE_CACHE_TTL_MS) return;

    next[symbol] = {
      previousClose,
      name: String(rawEntry?.name || '').trim() || '',
      exchange: String(rawEntry?.exchange || '').trim() || '',
      updatedAt,
      timestamp: rawEntry?.timestamp || new Date(updatedAt).toISOString(),
    };
  });

  return next;
};

const loadPreviousCloseCache = () => {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(PREVIOUS_CLOSE_CACHE_STORAGE_KEY) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return prunePreviousCloseCache(parsed);
  } catch {
    return {};
  }
};

const persistPreviousCloseCache = (cache = {}) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PREVIOUS_CLOSE_CACHE_STORAGE_KEY, JSON.stringify(prunePreviousCloseCache(cache)));
  } catch {}
};

const buildPlaceholderQuoteFromCache = (symbol, cacheEntry, fallbackName = '') => {
  const normalized = normalizeSymbol(symbol);
  if (!normalized || !cacheEntry) return null;

  const previousClose = resolvePreviousCloseFromQuote(cacheEntry);
  if (!Number.isFinite(previousClose)) return null;

  const name = String(cacheEntry?.name || fallbackName || MARKET_NAME_BY_SYMBOL[normalized] || normalized).trim();
  const timestamp = cacheEntry?.timestamp || new Date(cacheEntry?.updatedAt || Date.now()).toISOString();

  return {
    symbol: normalized,
    name: name || normalized,
    exchange: String(cacheEntry?.exchange || '').trim() || undefined,
    price: previousClose,
    change: 0,
    changePercent: 0,
    preMarketPrice: null,
    preMarketChange: null,
    preMarketChangePercent: null,
    extended_price: null,
    extended_change: null,
    extended_percent_change: null,
    is_extended_hours: null,
    extendedPrice: null,
    extendedChange: null,
    extendedPercentChange: null,
    isExtendedHours: null,
    previousClose,
    timestamp,
    source: 'cache',
    isPlaceholder: true,
  };
};

const buildInitialQuotesFromCache = (watchlist = [], cache = {}) => {
  const next = {};

  (Array.isArray(watchlist) ? watchlist : []).forEach((rawSymbol) => {
    const symbol = normalizeSymbol(rawSymbol);
    if (!symbol || next[symbol]) return;

    const placeholder = buildPlaceholderQuoteFromCache(symbol, cache[symbol]);
    if (!placeholder) return;
    next[symbol] = placeholder;
  });

  return next;
};

const buildInitialValueLoadingBySymbol = (watchlist = []) => {
  const next = {};

  (Array.isArray(watchlist) ? watchlist : []).forEach((rawSymbol) => {
    const symbol = normalizeSymbol(rawSymbol);
    if (!symbol || next[symbol]) return;
    next[symbol] = createQuoteValueLoadingState();
  });

  return next;
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

const formatSignedDollar = (value) => {
  const amount = toNumber(value);
  if (amount === null) return '--';
  const precision = Math.abs(amount) >= 1 ? 2 : 4;
  const formatted = formatCurrency(Math.abs(amount), precision);
  return `${amount >= 0 ? '+' : '-'}${formatted}`;
};

const formatWatchlistChangeValue = ({ mode, percentValue, dollarValue }) => {
  if (mode === 'dollar') return formatSignedDollar(dollarValue);
  return formatSignedPercent(percentValue);
};

const getWatchlistChangeToneClass = (value) => {
  const numeric = toNumber(value);
  if (numeric === null) return 'text-white/45';
  return numeric >= 0 ? 'text-emerald-400' : 'text-red-400';
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
    const savedWatchlist = JSON.parse(localStorage.getItem(WATCHLIST_STORAGE_KEY) || '[]');
    const normalizedWatchlist = Array.isArray(savedWatchlist)
      ? [...new Set(savedWatchlist.map(normalizeSymbol).filter(Boolean))]
      : [];

    const baseWatchlist = normalizedWatchlist.length > 0 ? normalizedWatchlist : [...DEFAULT_WATCHLIST];

    const savedOrder = JSON.parse(localStorage.getItem(WATCHLIST_ORDER_STORAGE_KEY) || '[]');
    const normalizedOrder = Array.isArray(savedOrder)
      ? [...new Set(savedOrder.map(normalizeSymbol).filter(Boolean))]
      : [];

    if (normalizedOrder.length === 0) return baseWatchlist;

    const baseSet = new Set(baseWatchlist);
    const ordered = normalizedOrder.filter((symbol) => baseSet.has(symbol));
    const orderedSet = new Set(ordered);
    const remainder = baseWatchlist.filter((symbol) => !orderedSet.has(symbol));
    return [...ordered, ...remainder];
  } catch {
    return [...DEFAULT_WATCHLIST];
  }
};

const loadInitialWatchlistCollapsed = () => {
  if (typeof window === 'undefined') return false;
  try {
    // Default to open (false) so watchlist is visible when user lands on Trader page
    const saved = localStorage.getItem(WATCHLIST_COLLAPSED_STORAGE_KEY);
    return saved === 'true';
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


function TraderOrderEntry({
  selectedSymbol,
  lastPrice,
  onSymbolChange,
  onOrderPlaced,
  tradingMode: _tradingMode = 'paper',
  canUseLiveTrading: _canUseLiveTrading = true,
  quotesBySymbol: quotesBySymbolProp = {},
  totalGainLossDollar: totalGainLossDollarProp,
  totalGainLossPercent: totalGainLossPercentProp,
}) {
  const {
    portfolio,
    trades,
    trading,
    error,
    executeTrade,
    closePosition,
    fetchPortfolio,
  } = usePaperTrading();
  const normalizedTradingMode = 'paper';
  const isLiveMode = false;

  const [side, setSide] = useState('buy');
  const [orderType, setOrderType] = useState('market');
  const [sizeMode, setSizeMode] = useState('shares');
  const [quantity, setQuantity] = useState('');
  const [dollarAmount, setDollarAmount] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [trailAmount, setTrailAmount] = useState('');
  const [trailType, setTrailType] = useState('dollars');
  const [timeInForce, setTimeInForce] = useState('day');
  const [confirmModal, setConfirmModal] = useState(false);
  const [confirmCloseModal, setConfirmCloseModal] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [inlineError, setInlineError] = useState('');
  const [successToast, setSuccessToast] = useState('');
  const liveMarketPrice = toNumber(lastPrice) ?? 0;

  const referencePrice = useMemo(() => {
    if (orderType === 'market' || orderType === 'trailing_stop') {
      return Number(lastPrice) || 0;
    }
    if (orderType === 'stop') {
      return parseFloat(stopPrice) || Number(lastPrice) || 0;
    }
    return parseFloat(limitPrice) || Number(lastPrice) || 0;
  }, [lastPrice, limitPrice, orderType, stopPrice]);

  const resolvedQuantity = useMemo(() => {
    if (sizeMode === 'shares') return parseFloat(quantity) || 0;
    const dollars = parseFloat(dollarAmount) || 0;
    if (!referencePrice || referencePrice <= 0) return 0;
    return dollars / referencePrice;
  }, [dollarAmount, quantity, referencePrice, sizeMode]);

  const notionalNumber = useMemo(() => {
    const parsed = parseFloat(dollarAmount);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [dollarAmount]);

  const estimatedTotal = useMemo(() => {
    if (sizeMode === 'dollars') return notionalNumber;
    return resolvedQuantity * referencePrice;
  }, [notionalNumber, referencePrice, resolvedQuantity, sizeMode]);

  const hasValidOrderSize = sizeMode === 'dollars' ? notionalNumber > 0 : resolvedQuantity > 0;
  const limitPriceNumber = Number(limitPrice);
  const stopPriceNumber = Number(stopPrice);
  const trailAmountNumber = Number(trailAmount);
  const requiresLimit = orderType === 'limit' || orderType === 'stop_limit';
  const requiresStop = orderType === 'stop' || orderType === 'stop_limit';
  const requiresTrail = orderType === 'trailing_stop';
  const positions = Array.isArray(portfolio?.positions) ? portfolio.positions : [];
  const selectedPosition = useMemo(
    () => findPaperPosition(positions, selectedSymbol),
    [positions, selectedSymbol]
  );
  const hasSelectedPosition = Number(selectedPosition?.quantity) > 0;
  const holdings = useMemo(
    () => (Array.isArray(positions) ? positions : []),
    [positions]
  );
  const { totalHoldingsValue, holdingsPercentOfAccount } = useMemo(() => {
    let total = 0;
    holdings.forEach((position) => {
      const qty = Number(position.quantity) || 0;
      const quote = quotesBySymbolProp[position.symbol] || quotesBySymbolProp[position.symbol?.trim?.()];
      const livePrice = toNumber(quote?.price ?? quote?.last ?? quote?.close ?? quote?.ask ?? quote?.bid);
      const price = Number.isFinite(livePrice) && livePrice > 0 ? livePrice : (Number(position.current_price) || Number(position.avg_cost_basis) || 0);
      total += qty * price;
    });
    const cash = toNumber(portfolio?.cash_balance, 0);
    const accountValue = total + cash;
    const percent = accountValue > 0 ? (total / accountValue) * 100 : 0;
    return { totalHoldingsValue: total, holdingsPercentOfAccount: percent };
  }, [holdings, portfolio?.cash_balance, quotesBySymbolProp]);

  const computedTotalGainLoss = useMemo(() => {
    let marketValue = 0;
    let costBasis = 0;
    (positions || []).forEach((position) => {
      const qty = Number(position.quantity) || 0;
      const avgCost = Number(position.avg_cost_basis) || 0;
      const quote = quotesBySymbolProp[position.symbol] || quotesBySymbolProp[position.symbol?.trim?.()];
      const livePrice = toNumber(quote?.price ?? quote?.last ?? quote?.close ?? quote?.ask ?? quote?.bid);
      const price = Number.isFinite(livePrice) && livePrice > 0 ? livePrice : (Number(position.current_price) || avgCost || 0);
      marketValue += qty * price;
      costBasis += qty * avgCost;
    });
    const dollar = marketValue - costBasis;
    const percent = costBasis > 0 ? (dollar / costBasis) * 100 : 0;
    return { totalGainLossDollar: dollar, totalGainLossPercent: percent };
  }, [positions, quotesBySymbolProp]);
  const totalGainLossDollar = Number.isFinite(totalGainLossDollarProp) ? totalGainLossDollarProp : computedTotalGainLoss.totalGainLossDollar;
  const totalGainLossPercent = Number.isFinite(totalGainLossPercentProp) ? totalGainLossPercentProp : computedTotalGainLoss.totalGainLossPercent;

  const buyingPowerDisplay = formatPaperCurrency(portfolio?.cash_balance);
  const availableCash = toNumber(portfolio?.cash_balance, 0);
  const selectedPositionQtyOwned = toNumber(selectedPosition?.quantity, 0);
  const executionPrice = liveMarketPrice > 0 ? liveMarketPrice : referencePrice;

  useEffect(() => {
    if (!successToast) return undefined;
    const timer = setTimeout(() => setSuccessToast(''), 2800);
    return () => clearTimeout(timer);
  }, [successToast]);

  const getValidationError = () => {
    if (!selectedSymbol) return 'Select a symbol first.';
    if (trading) return 'Trade is already executing.';
    if (!hasValidOrderSize || !Number.isFinite(resolvedQuantity) || resolvedQuantity <= 0) {
      return 'Quantity must be greater than 0.';
    }
    if (!Number.isFinite(executionPrice) || executionPrice <= 0) {
      return 'Live market price is unavailable.';
    }

    if (side === 'buy') {
      const totalCost = resolvedQuantity * executionPrice;
      if (totalCost > availableCash) {
        return `Insufficient cash. Available: ${formatPaperCurrency(availableCash)}`;
      }
      return '';
    }

    if (resolvedQuantity > selectedPositionQtyOwned) {
      return `Insufficient shares. Owned: ${formatPaperQuantity(selectedPositionQtyOwned)}.`;
    }

    return '';
  };

  const handleSubmit = () => {
    const validationError = getValidationError();
    if (validationError) {
      setInlineError(validationError);
      return;
    }
    setInlineError('');
    setConfirmModal(true);
  };

  const executeOrder = async () => {
    const validationError = getValidationError();
    if (validationError) {
      setInlineError(validationError);
      return;
    }

    setConfirmModal(false);

    try {
      const result = await executeTrade({
        symbol: selectedSymbol,
        side,
        quantity: resolvedQuantity,
        price: executionPrice,
      });

      await fetchPortfolio({ silent: true });

      setLastResult('filled');
      setTimeout(() => setLastResult(null), 3000);
      setInlineError('');
      const actionLabel = side === 'buy' ? 'Bought' : 'Sold';
      const totalCost = resolvedQuantity * executionPrice;
      setSuccessToast(
        `${actionLabel} ${formatPaperQuantity(resolvedQuantity)} ${formatPaperSymbol(selectedSymbol)} @ ${formatPaperCurrency(executionPrice)} · Total: ${formatPaperCurrency(totalCost)}`
      );
      onOrderPlaced?.(result);
      if (sizeMode === 'shares') {
        setQuantity('');
      } else {
        setDollarAmount('');
      }
    } catch (error) {
      console.error('Order submission error:', error);
      setInlineError(String(error?.message || 'Trade rejected.'));
      setLastResult('rejected');
      setTimeout(() => setLastResult(null), 3000);
    }
  };

  const requestClosePosition = () => {
    if (!selectedSymbol || !hasSelectedPosition || trading) return;
    setInlineError('');
    setConfirmCloseModal(true);
  };

  const handleClosePosition = async () => {
    if (!selectedSymbol || !hasSelectedPosition || trading) return;
    const closingSymbol = selectedPosition?.symbol || selectedSymbol;
    const closingQuantity = toNumber(selectedPosition?.quantity, 0);
    setConfirmCloseModal(false);
    try {
      await closePosition(closingSymbol);
      await fetchPortfolio({ silent: true });
      setLastResult('filled');
      setTimeout(() => setLastResult(null), 3000);
      setInlineError('');
      setSuccessToast(
        `Sold ${formatPaperQuantity(closingQuantity)} ${formatPaperSymbol(closingSymbol)} @ MARKET`
      );
      onOrderPlaced?.({ symbol: closingSymbol, side: 'sell', quantity: closingQuantity });
    } catch (closeError) {
      console.error('Close position failed:', closeError);
      setInlineError(String(closeError?.message || 'Close position failed.'));
      setLastResult('rejected');
      setTimeout(() => setLastResult(null), 3000);
    }
  };

  const selectedPositionSymbol = String(selectedPosition?.symbol || selectedSymbol || '').replace('/USD', '');
  const selectedPositionQty = Number(selectedPosition?.quantity || 0);
  const selectedPositionAvgCost = Number(
    selectedPosition?.avg_cost_basis
    ?? selectedPosition?.avg_entry_price
    ?? selectedPosition?.avgCost
    ?? 0
  );
  const selectedPositionLivePrice = liveMarketPrice > 0
    ? liveMarketPrice
    : Number(selectedPosition?.current_price || 0);
  const selectedPositionValue = selectedPositionQty > 0 && selectedPositionLivePrice > 0
    ? selectedPositionQty * selectedPositionLivePrice
    : Number(selectedPosition?.market_value || 0);
  const selectedPositionCostBasis = selectedPositionQty > 0 && selectedPositionAvgCost > 0
    ? selectedPositionQty * selectedPositionAvgCost
    : 0;
  const selectedPositionPnl = selectedPositionCostBasis > 0
    ? selectedPositionValue - selectedPositionCostBasis
    : Number(selectedPosition?.pnl || 0);
  const selectedPositionPnlPercent = selectedPositionCostBasis > 0
    ? (selectedPositionPnl / selectedPositionCostBasis) * 100
    : Number(selectedPosition?.pnl_percent || 0);
  const selectedPositionPnlClass = selectedPositionPnl >= 0 ? 'text-emerald-400' : 'text-red-400';
  const showSellAllButton = hasSelectedPosition && side === 'sell';
  // Display position: selected symbol's position if any, else first position so the card is never missing when user has positions (match Crypto)
  const displayPosition = selectedPosition || (positions?.length > 0 ? positions[0] : null);
  const displayPositionSymbol = displayPosition ? String(displayPosition?.symbol || '').replace('/USD', '') : '';
  const displayPositionQty = Number(displayPosition?.quantity || 0);
  const displayPositionAvgCost = Number(displayPosition?.avg_cost_basis ?? displayPosition?.avg_entry_price ?? displayPosition?.avgCost ?? 0);
  const displayPositionQuote = displayPosition ? (quotesBySymbolProp[displayPosition.symbol] || quotesBySymbolProp[displayPosition.symbol?.trim?.()]) : null;
  const displayPositionLivePrice = displayPosition
    ? (toNumber(displayPositionQuote?.price ?? displayPositionQuote?.last ?? displayPositionQuote?.close ?? displayPositionQuote?.ask ?? displayPositionQuote?.bid) || Number(displayPosition.current_price) || displayPositionAvgCost || 0)
    : 0;
  const displayPositionValue = displayPositionQty > 0 && displayPositionLivePrice > 0 ? displayPositionQty * displayPositionLivePrice : Number(displayPosition?.market_value || 0);
  const displayPositionCostBasis = displayPositionQty > 0 && displayPositionAvgCost > 0 ? displayPositionQty * displayPositionAvgCost : 0;
  const displayPositionPnl = displayPositionCostBasis > 0 ? displayPositionValue - displayPositionCostBasis : Number(displayPosition?.pnl || 0);
  const displayPositionPnlPercent = displayPositionCostBasis > 0 ? (displayPositionPnl / displayPositionCostBasis) * 100 : Number(displayPosition?.pnl_percent || 0);
  const displayPositionPnlClass = displayPositionPnl >= 0 ? 'text-emerald-400' : 'text-red-400';
  // Position summary card — same structure and text-[13px] as CryptoPage order entry (keep in sync)
  const selectedPositionSummary = displayPosition ? (
    <div className={`${GLASS_INSET_CARD_CLASS} text-[13px]`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <div className="truncate text-slate-300">
            Position: {formatPaperQuantity(displayPosition.quantity)} {displayPositionSymbol} · Avg {formatPaperCurrency(displayPosition.avg_cost_basis ?? displayPosition.avg_entry_price ?? displayPosition.avgCost)}
          </div>
          <div className="truncate text-slate-400">
            Value: {formatPaperCurrency(displayPositionValue)}
          </div>
          <div className={`truncate font-semibold ${displayPositionPnlClass}`}>
            P&L: {formatSignedPaperCurrency(displayPositionPnl)} ({displayPositionPnlPercent >= 0 ? '+' : ''}{displayPositionPnlPercent.toFixed(2)}%)
          </div>
        </div>
        {showSellAllButton ? (
          <button
            type="button"
            onClick={requestClosePosition}
            disabled={trading}
            className="shrink-0 rounded border border-red-500/30 px-2 py-0.5 text-[10px] font-semibold text-red-300 transition-colors hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {trading ? 'Executing...' : 'Sell All'}
          </button>
        ) : null}
      </div>
    </div>
  ) : null;

  const fieldClassName = GLASS_INSET_INPUT_CLASS;

  const handleSymbolSubmit = (input) => {
    const normalized = String(input || '')
      .replace(/^\$/, '')
      .replace(/[-/_]/g, '')
      .toUpperCase();
    if (!normalized) return;
    onSymbolChange?.(normalized);
  };

  return (
    <div className="relative flex min-h-0 flex-col">
      <OrderTicketPanel
        side={side}
        onSideChange={setSide}
        symbol={selectedSymbol ? `$${selectedSymbol}` : ''}
        onSymbolSubmit={handleSymbolSubmit}
        marketPrice={liveMarketPrice}
        positionSummary={selectedPositionSummary}
        quantity={quantity}
        onQuantityChange={setQuantity}
        orderType={orderType}
        onOrderTypeChange={setOrderType}
        orderTypeOptions={TRADER_ORDER_TYPE_OPTIONS}
        sizeMode={sizeMode}
        onSizeModeChange={setSizeMode}
        dollarAmount={dollarAmount}
        onDollarAmountChange={setDollarAmount}
        timeInForce={timeInForce}
        onTimeInForceChange={setTimeInForce}
        timeInForceOptions={[
          { value: 'day', label: 'DAY' },
          { value: 'gtc', label: 'GTC' },
          { value: 'ioc', label: 'IOC' },
        ]}
        tradingMode={normalizedTradingMode}
        estimatedCost={estimatedTotal}
        buyingPowerDisplay={buyingPowerDisplay}
        onReview={handleSubmit}
        reviewDisabled={trading || !selectedSymbol || !hasValidOrderSize}
        reviewLabel={trading ? 'Executing...' : `Review ${side.toUpperCase()} Order`}
        density="crypto"
        surfaceTone="black"
        stickyReviewFooter
        className="shrink-0"
        extraFields={
          <div className="space-y-1">
            {(orderType === 'limit' || orderType === 'stop_limit') && (
              <div className="space-y-1">
                <label className="block text-[13px] font-semibold text-slate-300">Limit Price</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={limitPrice}
                  onChange={(event) => setLimitPrice(event.target.value)}
                  placeholder={lastPrice ? Number(lastPrice).toFixed(2) : '0.00'}
                  className={fieldClassName}
                />
              </div>
            )}
            {(orderType === 'stop' || orderType === 'stop_limit') && (
              <div className="space-y-1">
                <label className="block text-[13px] font-semibold text-slate-300">Stop Price</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={stopPrice}
                  onChange={(event) => setStopPrice(event.target.value)}
                  placeholder="0.00"
                  className={fieldClassName}
                />
              </div>
            )}
            {orderType === 'trailing_stop' && (
              <div className="space-y-1">
                <div className="grid grid-cols-2 border-b border-white/10">
                  <button
                    type="button"
                    onClick={() => setTrailType('dollars')}
className={`py-1 text-[13px] font-semibold transition-colors ${
                    trailType === 'dollars' ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-gray-500'
                  }`}
                  >
                    $
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrailType('percent')}
className={`py-1 text-[13px] font-semibold transition-colors ${
                    trailType === 'percent' ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-gray-500'
                  }`}
                  >
                    %
                  </button>
                </div>
                <label className="block text-[13px] font-semibold text-slate-300">
                  {trailType === 'percent' ? 'Trail Amount (%)' : 'Trail Amount ($)'}
                </label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={trailAmount}
                  onChange={(event) => setTrailAmount(event.target.value)}
                  placeholder="0.00"
                  className={fieldClassName}
                />
              </div>
            )}
            {sizeMode === 'dollars' && (
              <div className="text-[13px] font-semibold text-slate-300">
                Est. Qty: {resolvedQuantity > 0 ? resolvedQuantity.toFixed(6) : '0.000000'} {selectedSymbol || '--'}
              </div>
            )}
            <div className="text-[11px] text-slate-400">
              Paper trades execute as market orders at the live quote.
            </div>
          </div>
        }
      />

      <div className="mt-1 min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-2">
        {lastResult && (
          <div
            className="animate-pulse rounded-lg py-2 text-center text-xs font-semibold"
            style={{
              background: lastResult === 'filled' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: lastResult === 'filled' ? '#22c55e' : '#ef4444',
              border: `1px solid ${lastResult === 'filled' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
            }}
          >
            {lastResult === 'filled' ? 'Order Filled' : lastResult === 'rejected' ? 'Order Rejected' : 'Connection Error'}
          </div>
        )}

        {error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-xs text-red-300">
            {error}
          </div>
        ) : null}

        {inlineError ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-xs text-red-300">
            {inlineError}
          </div>
        ) : null}

        {successToast ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2 text-xs text-emerald-300">
            {successToast}
          </div>
        ) : null}

        <div className={ORDER_ENTRY_SECTION_CLASS}>
          <div className="flex items-center justify-between py-0.5">
            <span className="text-[12px] font-medium uppercase tracking-[0.1em] text-slate-500">Available Cash</span>
            <span className="text-[14px] font-mono font-medium text-white">{buyingPowerDisplay}</span>
          </div>
          <div className="my-1.5 border-t border-white/[0.06]" />
          <div className="text-[12px] font-medium uppercase tracking-[0.1em] text-slate-500 pb-1">
            Holdings {holdings.length ? `(${holdings.length})` : '(0)'}
          </div>
          {holdings.length > 0 ? (
            <div className="min-h-0 max-h-[200px] overflow-y-auto overflow-x-hidden space-y-1 pr-0.5">
              {holdings.map((position) => {
                const qty = Number(position.quantity) || 0;
                const quote = quotesBySymbolProp[position.symbol] || quotesBySymbolProp[position.symbol?.trim?.()];
                const livePrice = toNumber(quote?.price ?? quote?.last ?? quote?.close ?? quote?.ask ?? quote?.bid);
                const price = Number.isFinite(livePrice) && livePrice > 0 ? livePrice : (Number(position.current_price) || Number(position.avg_cost_basis) || 0);
                const currentValue = qty * price;
                return (
                  <button
                    type="button"
                    key={`paper-holding-${position.symbol}`}
                    className="flex w-full items-center justify-between gap-2 shrink-0 rounded px-1 -mx-1 transition-colors hover:bg-white/[0.06] cursor-pointer"
                    onClick={() => handleSymbolSubmit(position.symbol)}
                  >
                    <span className="text-[13px] font-medium text-slate-300 truncate min-w-0">
                      {formatPaperSymbol(position.symbol)} · {formatPaperQuantity(position.quantity)}
                    </span>
                    <span className="text-[13px] font-mono font-medium text-emerald-400 shrink-0">
                      {formatPaperCurrency(currentValue)}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="mt-1.5 pt-1.5 flex items-center justify-between gap-2 border-t border-white/[0.06]">
            <span className="text-[12px] font-medium text-slate-500">Total gain / loss</span>
            <span className={`text-[13px] font-mono font-medium ${Number(totalGainLossDollar) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {Number(totalGainLossDollar) >= 0 ? '+' : ''}{formatPaperCurrency(totalGainLossDollar)} ({Number(totalGainLossPercent) >= 0 ? '+' : ''}{Number(totalGainLossPercent).toFixed(2)}%)
            </span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {confirmModal && (
          <motion.div
            {...modalBackdropMotion}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              {...modalPanelMotion}
              className="w-[280px] space-y-4 rounded-2xl border border-white/8 shadow-2xl shadow-black/30 bg-[rgba(10,10,10,0.98)] p-5"
            >
            <div className="text-center">
              <div className="mb-1 text-sm font-bold" style={{ color: '#e2e8f0' }}>
                Confirm {isLiveMode ? 'Live' : 'Paper'} Order
              </div>
              <div className="text-[11px]" style={{ color: 'rgba(148, 163, 184, 0.5)' }}>
                {side.toUpperCase()} {resolvedQuantity.toFixed(6)} {formatPaperSymbol(selectedSymbol)} @ MARKET
              </div>
              {sizeMode === 'dollars' && (
                <div className="mt-1 text-[10px]" style={{ color: 'rgba(148, 163, 184, 0.45)' }}>
                  From ${notionalNumber.toFixed(2)} notional
                </div>
              )}
            </div>
            <div className="text-center text-lg font-mono font-black" style={{ color: side === 'buy' ? '#22c55e' : '#ef4444' }}>
              ${estimatedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <motion.button
                type="button"
                onClick={() => setConfirmModal(false)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={interactiveTransition}
                className="rounded-lg border border-white/10 bg-white/5 py-2.5 text-xs font-semibold text-slate-400 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
              >
                Cancel
              </motion.button>
              <motion.button
                type="button"
                onClick={executeOrder}
                disabled={trading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={interactiveTransition}
                className="rounded-lg py-2.5 text-xs font-bold transition-colors"
                style={{
                  background: side === 'buy' ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)',
                  color: side === 'buy' ? '#22c55e' : '#ef4444',
                  border: side === 'buy' ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
                }}
              >
                {trading ? 'Executing...' : `Confirm ${side.toUpperCase()} (PAPER)`}
              </motion.button>
            </div>
            </motion.div>
          </motion.div>
        )}
        {confirmCloseModal && (
          <motion.div
            {...modalBackdropMotion}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              {...modalPanelMotion}
              className="w-[280px] space-y-4 rounded-2xl border border-white/8 bg-[rgba(10,10,10,0.98)] p-5 shadow-2xl shadow-black/30"
            >
              <div className="text-center">
                <div className="mb-1 text-sm font-bold text-red-300">
                  Close Position?
                </div>
                <div className="text-[11px] text-slate-400">
                  Sell all {formatPaperQuantity(selectedPosition?.quantity || 0)} {formatPaperSymbol(selectedPosition?.symbol || selectedSymbol)} at market?
                </div>
              </div>
              <div className="text-center font-mono text-lg font-black text-red-400">
                {formatPaperCurrency(selectedPositionValue)}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <motion.button
                  type="button"
                  onClick={() => setConfirmCloseModal(false)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={interactiveTransition}
                  className="rounded-lg border border-white/10 bg-white/5 py-2.5 text-xs font-semibold text-slate-400 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
                >
                  Cancel
                </motion.button>
                <motion.button
                  type="button"
                  onClick={handleClosePosition}
                  disabled={trading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={interactiveTransition}
                  className="rounded-lg border border-red-500/40 bg-red-500/25 py-2.5 text-xs font-bold text-red-300 transition-colors"
                >
                  {trading ? 'Executing...' : 'Confirm Sell All'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function TraderPage({
  onPinToTop,
  tradingMode: tradingModeOverride,
  canUseLiveTrading: canUseLiveTradingOverride,
  isLiveScoresOpen = false,
  onOpenLiveScores = () => {},
  pinnedGames = [],
  onGameDrop = () => {},
  onRemovePinnedGame = () => {},
  paperTotalGainLoss = null,
  yoloActive = false,
  onYoloClick,
}) {
  const tradingModeState = useTradingMode();
  const resolvedTradingMode = tradingModeOverride || tradingModeState.tradingMode;
  const resolvedCanUseLiveTrading = typeof canUseLiveTradingOverride === 'boolean'
    ? canUseLiveTradingOverride
    : tradingModeState.canUseLiveTrading;

  const apiKey =
    import.meta.env.VITE_TWELVE_DATA_API_KEY
    || import.meta.env.VITE_TWELVEDATA_API_KEY
    || import.meta.env.VITE_TWELVE_DATA_APIKEY
    || '';
  const initialWatchlist = useMemo(() => loadInitialWatchlist(), []);
  const initialPreviousCloseCache = useMemo(() => loadPreviousCloseCache(), []);

  const [watchlist, setWatchlist] = useState(initialWatchlist);
  const [selectedSymbol, setSelectedSymbol] = useState(initialWatchlist[0] || DEFAULT_WATCHLIST[0]);
  const [symbolInput, setSymbolInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [quotesBySymbol, setQuotesBySymbol] = useState(() =>
    buildInitialQuotesFromCache(initialWatchlist, initialPreviousCloseCache)
  );
  const [quoteValueLoadingBySymbol, setQuoteValueLoadingBySymbol] = useState(() =>
    buildInitialValueLoadingBySymbol(initialWatchlist)
  );
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
  const [chartTimeframe, setChartTimeframe] = useState('1D');
  const [chartBgTheme, setChartBgTheme] = useState(() => {
    try { return sessionStorage.getItem('stratify-chart-bg') || 'black'; } catch { return 'black'; }
  });
  const [bgThemeDropdownOpen, setBgThemeDropdownOpen] = useState(false);
  const [bgThemeDropdownPosition, setBgThemeDropdownPosition] = useState(null);
  const bgThemeDropdownRef = useRef(null);
  const bgThemeDropdownPanelRef = useRef(null);
  const [timeframeDropdownOpen, setTimeframeDropdownOpen] = useState(false);
  const [timeframeDropdownPosition, setTimeframeDropdownPosition] = useState(null);
  const timeframeDropdownRef = useRef(null);
  const timeframeDropdownPanelRef = useRef(null);
  const [candlePaletteId, setCandlePaletteId] = useState(() => {
    if (typeof window === 'undefined') return 'classic';
    try {
      const saved = window.localStorage.getItem(TRADER_CANDLE_PALETTE_KEY);
      return CANDLE_PALETTES.some(p => p.id === saved) ? saved : 'classic';
    } catch { return 'classic'; }
  });
  const [candlePaletteDropdownOpen, setCandlePaletteDropdownOpen] = useState(false);
  const [candlePaletteDropdownPosition, setCandlePaletteDropdownPosition] = useState(null);
  const candlePaletteDropdownRef = useRef(null);
  const candlePaletteDropdownPanelRef = useRef(null);
  useLayoutEffect(() => {
    if (candlePaletteDropdownOpen && candlePaletteDropdownRef.current) {
      const rect = candlePaletteDropdownRef.current.getBoundingClientRect();
      setCandlePaletteDropdownPosition({ top: rect.bottom + 4, left: rect.left });
    } else if (!candlePaletteDropdownOpen) {
      setCandlePaletteDropdownPosition(null);
    }
  }, [candlePaletteDropdownOpen]);
  useEffect(() => {
    if (!candlePaletteDropdownOpen) return;
    const onMouseDown = (e) => {
      const inTrigger = candlePaletteDropdownRef.current?.contains(e.target);
      const inPanel = candlePaletteDropdownPanelRef.current?.contains(e.target);
      if (!inTrigger && !inPanel) setCandlePaletteDropdownOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [candlePaletteDropdownOpen]);
  const [chartDisplayMode, setChartDisplayMode] = useState(() => {
    if (typeof window === 'undefined') return 'solid';
    try {
      const saved = window.localStorage.getItem(TRADER_CHART_DISPLAY_KEY);
      return CHART_DISPLAY_OPTIONS.some(o => o.id === saved) ? saved : 'solid';
    } catch { return 'solid'; }
  });
  const candleColors = useMemo(() => {
    const p = CANDLE_PALETTES.find(pa => pa.id === candlePaletteId) || CANDLE_PALETTES[0];
    return { up: p.up, down: p.down };
  }, [candlePaletteId]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(TRADER_CANDLE_PALETTE_KEY, candlePaletteId);
      window.localStorage.setItem(TRADER_CHART_DISPLAY_KEY, chartDisplayMode);
    } catch {}
  }, [candlePaletteId, chartDisplayMode]);
  const [activeMarket, setActiveMarket] = useState(() => loadInitialActiveMarket());
  // Watchlist starts open by default when user lands on Trader page (saved preference still applied on load via effect)
  const [isWatchlistCollapsed, setIsWatchlistCollapsed] = useState(false);
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(true);
  // News panel: 3-state cycle — 'peek' (1/3) → 'open' (60%) → 'closed' → 'peek'
  const [isNewsOpen, setIsNewsOpen] = useState(true);
  const [newsArticleExpanded, setNewsArticleExpanded] = useState(false);
  const [drawerArticle, setDrawerArticle] = useState(null);
  const [rightPanelTab, setRightPanelTab] = useState('article');
  const [isArticleOpen, setIsArticleOpen] = useState(false);
  const [selectedGames, setSelectedGames] = useState([]);
  const [isArticleDrawerExtendedToChartTop, setIsArticleDrawerExtendedToChartTop] = useState(false);
  const [isBottomPanelExpanded, setIsBottomPanelExpanded] = useState(false);
  const [chartViewportHeight, setChartViewportHeight] = useState(0);
  const [hydratedArticlesByUrl, setHydratedArticlesByUrl] = useState({});
  const [articleHydrationLoadingUrl, setArticleHydrationLoadingUrl] = useState('');
  const [articleHydrationErrorsByUrl, setArticleHydrationErrorsByUrl] = useState({});
  const newsListScrollRef = useRef(null);
  const articleBodyScrollRef = useRef(null);
  const articleHydrationInFlightRef = useRef(new Set());

  const scrollArticleBody = useCallback((delta) => {
    const el = articleBodyScrollRef.current;
    if (el) {
      el.scrollTop = Math.max(0, Math.min(el.scrollTop + delta, el.scrollHeight - el.clientHeight));
    }
  }, []);

  useEffect(() => {
    if (!drawerArticle) return;
    const t = setTimeout(() => {
      const el = articleBodyScrollRef.current;
      if (el) el.scrollTop = 0;
    }, 0);
    return () => clearTimeout(t);
  }, [drawerArticle]);

  const hydrateArticleBody = useCallback(async (article) => {
    const articleUrl = String(article?.url || '').trim();
    if (!articleUrl) return;
    if (hydratedArticlesByUrl[articleUrl]) return;
    if (articleHydrationInFlightRef.current.has(articleUrl)) return;

    articleHydrationInFlightRef.current.add(articleUrl);
    setArticleHydrationLoadingUrl(articleUrl);

    try {
      const response = await fetch(`/api/article?url=${encodeURIComponent(articleUrl)}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || `Article API ${response.status}`);
      }

      const normalized = {
        title: String(payload?.title || article?.title || '').trim(),
        source: String(payload?.source || article?.source || '').trim(),
        publishedAt: payload?.publishedAt || article?.publishedAt || article?.published_at || null,
        image: payload?.image || article?.imageUrl || article?.image_url || null,
        content: String(payload?.content || '').trim(),
        paragraphs: Array.isArray(payload?.paragraphs)
          ? payload.paragraphs.map((paragraph) => String(paragraph || '').trim()).filter(Boolean)
          : [],
      };

      setHydratedArticlesByUrl((previous) => ({
        ...previous,
        [articleUrl]: normalized,
      }));
      setArticleHydrationErrorsByUrl((previous) => {
        if (!previous[articleUrl]) return previous;
        const next = { ...previous };
        delete next[articleUrl];
        return next;
      });
    } catch (error) {
      console.error('[TraderPage] Failed to hydrate article body:', error);
      setArticleHydrationErrorsByUrl((previous) => ({
        ...previous,
        [articleUrl]: 'Could not load full article text. Showing preview content.',
      }));
    } finally {
      articleHydrationInFlightRef.current.delete(articleUrl);
      setArticleHydrationLoadingUrl((current) => (current === articleUrl ? '' : current));
    }
  }, [hydratedArticlesByUrl]);

  useEffect(() => {
    if (!drawerArticle) return;
    hydrateArticleBody(drawerArticle);
  }, [drawerArticle, hydrateArticleBody]);
  const [watchlistChangeDisplayModeBySymbol, setWatchlistChangeDisplayModeBySymbol] = useState({});
  const [hoveredWatchlistSymbol, setHoveredWatchlistSymbol] = useState(null);
  const [activeDragTicker, setActiveDragTicker] = useState('');
  const [dragPreviewScale, setDragPreviewScale] = useState(1);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [activeGameDropSlot, setActiveGameDropSlot] = useState(null);
  const [espnLogoErrored, setEspnLogoErrored] = useState(false);
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
  const lineSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const lastBarRef = useRef(null);
  const lastCandleDataRef = useRef([]);
  const highLowPriceLinesRef = useRef([]);
  const updateHighLowLinesRef = useRef(null);
  const drawingPriceLinesRef = useRef([]);
  const drawingTrendLinesRef = useRef([]);
  const drawingRectanglesRef = useRef([]);
  const drawingPendingPointRef = useRef(null);
  const selectedDrawingToolRef = useRef(null);
  const setSelectedDrawingToolRef = useRef(null);
  const draggingPriceLineRef = useRef(null);
  const drawingDragCleanupRef = useRef(null);
  const drawingPreviewSeriesRef = useRef(null);
  const drawingLastCrosshairRef = useRef(null);
  const drawingDragStartedRef = useRef(false);
  const drawingJustFinishedViaMouseupRef = useRef(false);
  const [selectedDrawingTool, setSelectedDrawingTool] = useState(null);
  const lineToolsRef = useRef(null);
  const [activeTool, setActiveTool] = useState('cursor');
  const volumeProfileRef = useRef(null);
  const [volumeProfileVisible, setVolumeProfileVisible] = useState(false);
  const [showHighLow, setShowHighLow] = useState(() => {
    try { return sessionStorage.getItem('stratify-chart-highlow') !== 'false'; } catch { return true; }
  });
  const showHighLowRef = useRef(showHighLow);
  const sessionHighlightRef = useRef(null);
  const [sessionHighlightVisible, setSessionHighlightVisible] = useState(false);
  const priceAlertsRef = useRef(null);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [hasAlerts, setHasAlerts] = useState(false);
  const [alertPopup, setAlertPopup] = useState(null);

  useEffect(() => {
    if (!alertPopup) return;
    const ms = alertPopup.variant === 'triggered' ? 5000 : 4000;
    const t = setTimeout(() => setAlertPopup(null), ms);
    return () => clearTimeout(t);
  }, [alertPopup]);

  useEffect(() => {
    selectedDrawingToolRef.current = selectedDrawingTool;
  }, [selectedDrawingTool]);
  useEffect(() => {
    setSelectedDrawingToolRef.current = setSelectedDrawingTool;
  }, []);
  useEffect(() => {
    drawingPendingPointRef.current = null;
    if (drawingDragCleanupRef.current) {
      drawingDragCleanupRef.current();
      drawingDragCleanupRef.current = null;
    }
  }, [selectedDrawingTool]);

  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const closedByUserRef = useRef(false);
  const subscribedSymbolsRef = useRef(new Set());
  const streamSubscriptionRef = useRef(new Set(initialWatchlist));
  const watchlistRef = useRef(new Set(initialWatchlist));
  const selectedSymbolRef = useRef(normalizeSymbol(selectedSymbol));
  const previousCloseCacheRef = useRef(initialPreviousCloseCache);
  const noStreamDataTimerRef = useRef(null);
  const restPollTimerRef = useRef(null);
  const wsHasReceivedPriceRef = useRef(false);
  const restFallbackActiveRef = useRef(false);
  const searchContainerRef = useRef(null);
  const searchRequestRef = useRef(0);
  const chartTimeframeRef = useRef(chartTimeframe);
  const chartRequestIdRef = useRef(0);
  const chartResizeTimerRef = useRef(null);
  const dragPositionYRef = useRef(null);
  const dragPositionXRef = useRef(null);
  const chartAndNewsContainerRef = useRef(null);
  const chartViewportRef = useRef(null);
  const lastDragEndRef = useRef(0);
  const selectedChartTimeframe = CHART_TIMEFRAME_BY_ID[chartTimeframe] || CHART_TIMEFRAME_BY_ID[DEFAULT_CHART_TIMEFRAME];
  const watchlistSymbols = useMemo(
    () => [...new Set(watchlist.map(normalizeSymbol).filter(Boolean))],
    [watchlist]
  );
  const watchlistPanelWidth = isWatchlistCollapsed
    ? WATCHLIST_PANEL_COLLAPSED_WIDTH
    : WATCHLIST_PANEL_OPEN_WIDTH;
  const searchResultSymbols = useMemo(
    () => [...new Set(searchResults.map((result) => normalizeSymbol(result?.symbol)).filter(Boolean))],
    [searchResults]
  );
  const { portfolio: paperPortfolio } = usePaperTrading();
  const streamSubscriptionSymbols = useMemo(() => {
    const next = [...watchlistSymbols];
    if (isSearchDropdownOpen) {
      next.push(...searchResultSymbols);
    }
    // Include paper holdings so Order Entry holdings panel gets real-time values
    const positions = Array.isArray(paperPortfolio?.positions) ? paperPortfolio.positions : [];
    positions.forEach((p) => {
      const sym = normalizeSymbol(p?.symbol);
      if (sym) next.push(sym);
    });
    return [...new Set(next)];
  }, [isSearchDropdownOpen, paperPortfolio?.positions, searchResultSymbols, watchlistSymbols]);
  const streamSubscriptionKey = useMemo(
    () => [...streamSubscriptionSymbols].sort().join(','),
    [streamSubscriptionSymbols]
  );
  const searchResultSymbolSetKey = useMemo(
    () => [...searchResultSymbols].sort().join(','),
    [searchResultSymbols]
  );
  const watchlistSymbolSetKey = useMemo(
    () => [...new Set(watchlist.map(normalizeSymbol).filter(Boolean))].sort().join(','),
    [watchlist]
  );
  const selectedTicker = selectedSymbol;
  const setSelectedTicker = setSelectedSymbol;
  const { sentimentMap } = useSentiment(watchlistSymbols);
  const { articles: newsArticles, loading: newsLoading, error: newsError, refetch: refetchNews } = useNews(selectedSymbol, { limit: 15 });
  const [watchlistView, setWatchlistView] = useState('watchlist');
  const portfolioPositions = useMemo(() => {
    const positions = Array.isArray(paperPortfolio?.positions) ? paperPortfolio.positions : [];
    return positions
      .map((position) => {
        const symbol = normalizeSymbol(position?.symbol);
        const quantity = toNumber(position?.quantity) ?? 0;
        const marketValue = toNumber(position?.market_value)
          ?? ((toNumber(position?.current_price) ?? 0) * quantity);
        const pnlPercent = toNumber(position?.pnl_percent) ?? 0;
        const companyName = String(
          watchlistNamesBySymbol[symbol] || MARKET_NAME_BY_SYMBOL[symbol] || symbol
        ).trim();

        return {
          symbol,
          quantity,
          marketValue,
          pnlPercent,
          companyName,
        };
      })
      .filter((position) => position.symbol && position.quantity > 0)
      .sort((a, b) => (b.marketValue - a.marketValue));
  }, [paperPortfolio?.positions, watchlistNamesBySymbol]);
  const newsPanelHeight = isNewsOpen ? 300 : 0;

  const toggleNewsPanelCollapsed = useCallback(() => {
    if (drawerArticle && isNewsOpen) {
      setIsArticleDrawerExtendedToChartTop((previous) => !previous);
      return;
    }
    setIsNewsOpen(prev => !prev);
  }, [drawerArticle, isNewsOpen]);

  useEffect(() => {
    if (!drawerArticle) {
      setIsArticleDrawerExtendedToChartTop(false);
    }
  }, [drawerArticle]);

  useEffect(() => {
    if (!isNewsOpen) {
      setIsArticleDrawerExtendedToChartTop(false);
    }
  }, [isNewsOpen]);

  useEffect(() => {
    const node = chartViewportRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;

    const updateHeight = () => {
      setChartViewportHeight(node.getBoundingClientRect().height || 0);
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // When article drawer opens (chart compressed to 50%), resize chart to fill the left half so it doesn't hug the right
  useEffect(() => {
    const shouldCompressChart = Boolean(drawerArticle && isNewsOpen && isArticleDrawerExtendedToChartTop);
    if (!shouldCompressChart || !chartRef.current || !chartContainerRef.current || typeof window === 'undefined') return undefined;

    const timer = window.setTimeout(() => {
      try {
        const container = chartContainerRef.current;
        const chart = chartRef.current;
        if (!container || !chart) return;
        const { width, height } = container.getBoundingClientRect();
        if (width > 0 && height > 0) {
          chart.resize(width, height);
          chart.timeScale().fitContent();
        }
      } catch {}
    }, 280);

    return () => window.clearTimeout(timer);
  }, [drawerArticle, isNewsOpen, isArticleDrawerExtendedToChartTop]);

  // When article drawer closes, force chart to resize and restore view so it returns to the same state as before opening
  useEffect(() => {
    if (drawerArticle != null || !chartRef.current || !chartContainerRef.current) return undefined;

    const timer = window.setTimeout(() => {
      try {
        const container = chartContainerRef.current;
        const chart = chartRef.current;
        if (!container || !chart) return;
        const { width, height } = container.getBoundingClientRect();
        if (width > 0 && height > 0) {
          chart.resize(width, height);
          chart.timeScale().fitContent();
        }
      } catch {}
    }, 280);

    return () => window.clearTimeout(timer);
  }, [drawerArticle]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const previousBodyOverflowY = document.body.style.overflowY;
    const previousHtmlOverflowY = document.documentElement.style.overflowY;

    document.body.style.overflowY = 'hidden';
    document.documentElement.style.overflowY = 'hidden';

    return () => {
      document.body.style.overflowY = previousBodyOverflowY;
      document.documentElement.style.overflowY = previousHtmlOverflowY;
    };
  }, []);

  const syncWatchlistValueLoadingState = useCallback((symbols) => {
    const normalizedSymbols = [...new Set((Array.isArray(symbols) ? symbols : []).map(normalizeSymbol).filter(Boolean))];

    setQuoteValueLoadingBySymbol((previous) => {
      let hasChanges = Object.keys(previous).length !== normalizedSymbols.length;
      const next = {};

      normalizedSymbols.forEach((symbol) => {
        if (previous[symbol]) {
          next[symbol] = previous[symbol];
          return;
        }

        next[symbol] = createQuoteValueLoadingState();
        hasChanges = true;
      });

      return hasChanges ? next : previous;
    });
  }, []);

  const markQuoteValuesLoaded = useCallback((updates = []) => {
    if (!Array.isArray(updates) || updates.length === 0) return;

    setQuoteValueLoadingBySymbol((previous) => {
      let hasChanges = false;
      const next = { ...previous };

      updates.forEach((item) => {
        const symbol = normalizeSymbol(item?.symbol);
        if (!symbol) return;

        const loadPrice = item?.price === true;
        const loadDay = item?.day === true;
        const loadPreMarket = item?.preMarket === true;
        if (!loadPrice && !loadDay && !loadPreMarket) return;

        const current = next[symbol] || createQuoteValueLoadingState();
        const updated = { ...current };

        if (loadPrice && updated.price !== false) updated.price = false;
        if (loadDay && updated.day !== false) updated.day = false;
        if (loadPreMarket && updated.preMarket !== false) updated.preMarket = false;

        if (
          updated.price !== current.price
          || updated.day !== current.day
          || updated.preMarket !== current.preMarket
        ) {
          next[symbol] = updated;
          hasChanges = true;
        } else if (!next[symbol]) {
          next[symbol] = current;
        }
      });

      return hasChanges ? next : previous;
    });
  }, []);

  const markQuoteValuesPending = useCallback((symbol) => {
    const normalized = normalizeSymbol(symbol);
    if (!normalized) return;

    setQuoteValueLoadingBySymbol((previous) => {
      const current = previous[normalized];
      if (current && current.price && current.day && current.preMarket) return previous;
      return {
        ...previous,
        [normalized]: createQuoteValueLoadingState(),
      };
    });
  }, []);

  const cachePreviousCloseQuotes = useCallback((quotes = []) => {
    if (!Array.isArray(quotes) || quotes.length === 0) return;

    const now = Date.now();
    const currentCache = previousCloseCacheRef.current || {};
    const nextCache = { ...currentCache };
    let hasChanges = false;

    quotes.forEach((quote) => {
      const symbol = normalizeSymbol(quote?.symbol);
      if (!symbol) return;

      const previousClose = resolvePreviousCloseFromQuote(quote);
      if (!Number.isFinite(previousClose)) return;

      const existing = currentCache[symbol];
      const name = String(quote?.name || existing?.name || MARKET_NAME_BY_SYMBOL[symbol] || symbol).trim();
      const exchange = String(quote?.exchange || existing?.exchange || '').trim();
      const timestamp = quote?.timestamp || existing?.timestamp || new Date(now).toISOString();

      if (
        existing
        && toNumber(existing?.previousClose) === previousClose
        && String(existing?.name || '') === name
        && String(existing?.exchange || '') === exchange
      ) {
        return;
      }

      nextCache[symbol] = {
        previousClose,
        name,
        exchange,
        timestamp,
        updatedAt: now,
      };
      hasChanges = true;
    });

    if (!hasChanges) return;

    const pruned = prunePreviousCloseCache(nextCache);
    previousCloseCacheRef.current = pruned;
    persistPreviousCloseCache(pruned);
  }, []);

  const hydrateQuotesFromCache = useCallback((symbols = []) => {
    const normalizedSymbols = [...new Set((Array.isArray(symbols) ? symbols : []).map(normalizeSymbol).filter(Boolean))];
    if (normalizedSymbols.length === 0) return;

    setQuotesBySymbol((previous) => {
      let hasChanges = false;
      const next = { ...previous };

      normalizedSymbols.forEach((symbol) => {
        const current = previous[symbol];
        const currentPrice = toNumber(current?.price);
        const hasLivePrice = Number.isFinite(currentPrice) && current?.isPlaceholder !== true;
        if (hasLivePrice) return;

        const placeholder = buildPlaceholderQuoteFromCache(
          symbol,
          previousCloseCacheRef.current?.[symbol],
          current?.name || watchlistNamesBySymbol[symbol] || MARKET_NAME_BY_SYMBOL[symbol] || symbol
        );
        if (!placeholder) return;

        const samePrice = toNumber(current?.price) === placeholder.price;
        const sameName = String(current?.name || '') === String(placeholder?.name || '');
        if (samePrice && sameName && current?.isPlaceholder === true) return;

        next[symbol] = {
          ...current,
          ...placeholder,
          source: 'cache',
          isPlaceholder: true,
        };
        hasChanges = true;
      });

      return hasChanges ? next : previous;
    });
  }, [watchlistNamesBySymbol]);

  const toggleWatchlistChangeDisplayMode = useCallback((symbol, metric) => {
    const normalized = normalizeSymbol(symbol);
    if (!normalized) return;
    if (metric !== 'day' && metric !== 'preMarket') return;

    setWatchlistChangeDisplayModeBySymbol((previous) => {
      const currentMode = previous?.[normalized]?.[metric] === 'dollar' ? 'dollar' : 'percent';
      const nextMode = currentMode === 'percent' ? 'dollar' : 'percent';

      return {
        ...previous,
        [normalized]: {
          ...previous[normalized],
          [metric]: nextMode,
        },
      };
    });
  }, []);

  useEffect(() => {
    const normalized = normalizeSymbol(selectedSymbol);
    selectedSymbolRef.current = normalized;
    priceAlertsRef.current?.setSymbol?.(normalized);
  }, [selectedSymbol]);

  useEffect(() => {
    chartTimeframeRef.current = chartTimeframe;
  }, [chartTimeframe]);

  useLayoutEffect(() => {
    if (timeframeDropdownOpen && timeframeDropdownRef.current) {
      const rect = timeframeDropdownRef.current.getBoundingClientRect();
      setTimeframeDropdownPosition({ top: rect.bottom + 4, left: rect.left });
    } else if (!timeframeDropdownOpen) {
      setTimeframeDropdownPosition(null);
    }
  }, [timeframeDropdownOpen]);
  useEffect(() => {
    if (!timeframeDropdownOpen) return;
    const onMouseDown = (e) => {
      const inTrigger = timeframeDropdownRef.current?.contains(e.target);
      const inPanel = timeframeDropdownPanelRef.current?.contains(e.target);
      if (!inTrigger && !inPanel) setTimeframeDropdownOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [timeframeDropdownOpen]);

  useLayoutEffect(() => {
    if (bgThemeDropdownOpen && bgThemeDropdownRef.current) {
      const rect = bgThemeDropdownRef.current.getBoundingClientRect();
      setBgThemeDropdownPosition({ top: rect.bottom + 4, left: rect.left });
    } else if (!bgThemeDropdownOpen) {
      setBgThemeDropdownPosition(null);
    }
  }, [bgThemeDropdownOpen]);
  useEffect(() => {
    if (!bgThemeDropdownOpen) return;
    const onMouseDown = (e) => {
      const inTrigger = bgThemeDropdownRef.current?.contains(e.target);
      const inPanel = bgThemeDropdownPanelRef.current?.contains(e.target);
      if (!inTrigger && !inPanel) setBgThemeDropdownOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [bgThemeDropdownOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const serializedWatchlist = JSON.stringify(watchlist);
    localStorage.setItem(WATCHLIST_STORAGE_KEY, serializedWatchlist);
    localStorage.setItem(WATCHLIST_ORDER_STORAGE_KEY, serializedWatchlist);
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
    syncWatchlistValueLoadingState(normalized);
    hydrateQuotesFromCache(normalized);

    if (normalized.length === 0) {
      setSelectedSymbol('');
      return;
    }

    if (!normalized.includes(normalizeSymbol(selectedSymbol))) {
      setSelectedSymbol(normalized[0]);
    }
  }, [watchlist, selectedSymbol, hydrateQuotesFromCache, syncWatchlistValueLoadingState]);

  useEffect(() => {
    streamSubscriptionRef.current = new Set(streamSubscriptionSymbols);
  }, [streamSubscriptionSymbols]);

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

    const fallbackMatches = buildSearchResults(UNIVERSAL_FALLBACK_SYMBOLS, query);
    const manualSymbol = normalizeSymbol(query);
    const manualEntry = manualSymbol
      ? {
          symbol: manualSymbol,
          exchange: 'CUSTOM',
          name: `Add $${manualSymbol}`,
          type: 'Manual',
        }
      : null;
    setSearchResults([]);
    setIsSearchDropdownOpen(true);
    setIsSearchLoading(true);

    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        let apiMatches = [];

        try {
          const response = await fetch(
            withApiBase(`/api/symbol-search?query=${encodeURIComponent(query)}&q=${encodeURIComponent(query)}`),
            {
              cache: 'no-store',
              signal: controller.signal,
            }
          );
          const payload = await response.json().catch(() => ({ data: [] }));

          if (controller.signal.aborted || searchRequestRef.current !== requestId) return;

          if (response.ok) {
            const rows = Array.isArray(payload?.data) ? payload.data : [];
            apiMatches = rows.map((item) => ({
              symbol: item?.symbol,
              exchange: item?.exchange,
              name: item?.name || item?.instrument_name || item?.description,
              type: item?.type || item?.instrument_type || item?.asset_type,
            }));
          }
        } catch {}

        if (apiMatches.length === 0) {
          try {
            const legacyResponse = await fetch(
              withApiBase(`/api/stock/search?q=${encodeURIComponent(query)}`),
              {
                cache: 'no-store',
                signal: controller.signal,
              }
            );
            const legacyPayload = await legacyResponse.json().catch(() => ({}));
            if (legacyResponse.ok) {
              const legacyRows = Array.isArray(legacyPayload?.results) ? legacyPayload.results : [];
              apiMatches = legacyRows.map((item) => ({
                symbol: item?.symbol,
                exchange: item?.exchange,
                name: item?.name || item?.description,
                type: item?.type || item?.quoteType || item?.asset_type,
              }));
            }
          } catch {}
        }

        if (apiMatches.length === 0 && apiKey) {
          const directResponse = await fetch(
            `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(query)}&outputsize=120&apikey=${encodeURIComponent(apiKey)}`,
            {
              cache: 'no-store',
              signal: controller.signal,
            }
          );

          const directPayload = await directResponse.json().catch(() => ({}));
          if (directResponse.ok && directPayload?.status !== 'error') {
            const directRows = Array.isArray(directPayload?.data) ? directPayload.data : [];
            apiMatches = directRows.map((item) => ({
              symbol: item?.symbol,
              exchange: item?.exchange,
              name: item?.instrument_name || item?.name || item?.description,
              type: item?.instrument_type || item?.type || item?.asset_type,
            }));
          }
        }

        if (controller.signal.aborted || searchRequestRef.current !== requestId) return;

        const mergedResults = buildSearchResults(
          [...apiMatches, ...UNIVERSAL_FALLBACK_SYMBOLS, ...(manualEntry ? [manualEntry] : [])],
          query
        );
        if (mergedResults.length > 0) {
          setSearchResults(mergedResults);
        } else if (manualEntry) {
          setSearchResults([manualEntry]);
        } else {
          setSearchResults(fallbackMatches);
        }
      } catch (error) {
        if (error?.name !== 'AbortError') {
          if (manualEntry) {
            setSearchResults([...fallbackMatches, manualEntry]);
          } else {
            setSearchResults(fallbackMatches);
          }
        }
      } finally {
        if (!controller.signal.aborted && searchRequestRef.current === requestId) {
          setIsSearchLoading(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [apiKey, symbolInput]);

  const selectedQuote = selectedSymbol ? quotesBySymbol[selectedSymbol] : null;
  const selectedQuoteIsPlaceholder = selectedQuote?.isPlaceholder === true;
  const selectedValueLoading = selectedSymbol ? quoteValueLoadingBySymbol[selectedSymbol] : null;
  const selectedPriceLoading = selectedValueLoading?.price === true;
  const selectedDayLoading = selectedValueLoading?.day === true;
  const selectedMarketPrice = useMemo(() => {
    const price = toNumber(
      selectedQuote?.price
      ?? selectedQuote?.last
      ?? selectedQuote?.close
      ?? selectedQuote?.ask
      ?? selectedQuote?.bid,
    );
    return Number.isFinite(price) ? price : 0;
  }, [selectedQuote]);

  const applyCachedClosePlaceholder = useCallback((symbol, fallbackName = '') => {
    const normalized = normalizeSymbol(symbol);
    if (!normalized) return;

    const placeholder = buildPlaceholderQuoteFromCache(
      normalized,
      previousCloseCacheRef.current?.[normalized],
      fallbackName || watchlistNamesBySymbol[normalized] || MARKET_NAME_BY_SYMBOL[normalized] || normalized
    );
    if (!placeholder) return;

    setQuotesBySymbol((previous) => {
      const current = previous[normalized];
      const currentPrice = toNumber(current?.price);
      const hasRealPrice = Number.isFinite(currentPrice) && current?.isPlaceholder !== true;
      if (hasRealPrice) return previous;

      return {
        ...previous,
        [normalized]: {
          ...current,
          ...placeholder,
          source: 'cache',
          isPlaceholder: true,
        },
      };
    });
  }, [watchlistNamesBySymbol]);

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

  const fetchQuoteSnapshot = useCallback(async (symbolsOverride = null) => {
    const symbols = (
      Array.isArray(symbolsOverride) && symbolsOverride.length > 0
        ? symbolsOverride
        : [...watchlistRef.current]
    )
      .map(normalizeSymbol)
      .filter(Boolean);
    if (symbols.length === 0) return;

    try {
      const params = new URLSearchParams({ symbols: symbols.join(',') });
      const response = await fetch(withApiBase(`/api/stocks?${params.toString()}`), { cache: 'no-store' });
      const payload = await response.json().catch(() => []);
      if (!response.ok) return;

      const rows = Array.isArray(payload) ? payload : [];
      const updates = rows
        .map((row) => {
          const symbol = normalizeSymbol(row?.symbol);
          if (!symbol) return null;

          const price = toNumber(row?.price ?? row?.last ?? row?.close);
          if (!Number.isFinite(price)) return null;

          const raw = row?.raw || row;
          const previousClose = resolvePreviousCloseFromQuote({
            previousClose: row?.previousClose ?? raw?.previous_close ?? raw?.previousClose,
            previous_close: raw?.previous_close,
            price,
            change: row?.change,
            changePercent: row?.changePercent ?? row?.percentChange,
          });
          const rawChange = toNumber(row?.change);
          const rawPercent = toNumber(
            row?.changePercent ?? row?.percentChange ?? raw?.percent_change ?? raw?.percentChange
          );
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
          const preMarketMetrics = extractPremarketQuoteMetrics(raw, price, previousClose);
          const rowPreMarketPrice = toNumber(row?.preMarketPrice);
          const rowPreMarketChange = toNumber(row?.preMarketChange);
          const rowPreMarketChangePercent = toNumber(row?.preMarketChangePercent);
          const rowExtendedPrice = toNumber(
            row?.extended_price
            ?? row?.extendedPrice
            ?? raw?.extended_price
            ?? raw?.extendedPrice
          );
          const rowExtendedChange = toNumber(
            row?.extended_change
            ?? row?.extendedChange
            ?? raw?.extended_change
            ?? raw?.extendedChange
          );
          const rowExtendedChangePercent = toNumber(
            row?.extended_percent_change
            ?? row?.extendedPercentChange
            ?? raw?.extended_percent_change
            ?? raw?.extendedPercentChange
          );
          const derivedPreMarketChange = Number.isFinite(rowPreMarketChange)
            ? rowPreMarketChange
            : Number.isFinite(preMarketMetrics.preMarketChange)
              ? preMarketMetrics.preMarketChange
              : null;
          const derivedPreMarketChangePercent = Number.isFinite(rowPreMarketChangePercent)
            ? rowPreMarketChangePercent
            : Number.isFinite(preMarketMetrics.preMarketChangePercent)
              ? preMarketMetrics.preMarketChangePercent
              : Number.isFinite(derivedPreMarketChange) && Number.isFinite(previousClose) && previousClose !== 0
                ? (derivedPreMarketChange / previousClose) * 100
                : null;
          const derivedPreMarketPrice = Number.isFinite(rowPreMarketPrice)
            ? rowPreMarketPrice
            : Number.isFinite(preMarketMetrics.preMarketPrice)
              ? preMarketMetrics.preMarketPrice
              : null;
          const derivedExtendedChange = Number.isFinite(rowExtendedChange)
            ? rowExtendedChange
            : Number.isFinite(preMarketMetrics.preMarketChange)
              ? preMarketMetrics.preMarketChange
              : null;
          const derivedExtendedChangePercent = Number.isFinite(rowExtendedChangePercent)
            ? rowExtendedChangePercent
            : Number.isFinite(preMarketMetrics.preMarketChangePercent)
              ? preMarketMetrics.preMarketChangePercent
              : Number.isFinite(derivedExtendedChange) && Number.isFinite(previousClose) && previousClose !== 0
                ? (derivedExtendedChange / previousClose) * 100
                : null;
          const derivedExtendedPrice = Number.isFinite(rowExtendedPrice)
            ? rowExtendedPrice
            : Number.isFinite(preMarketMetrics.preMarketPrice)
              ? preMarketMetrics.preMarketPrice
              : null;
          const derivedIsExtendedHours = parseMarketOpen(
            row?.is_extended_hours
            ?? row?.isExtendedHours
            ?? raw?.is_extended_hours
            ?? raw?.isExtendedHours
          );

          return {
            symbol,
            price,
            change,
            changePercent,
            preMarketPrice: derivedPreMarketPrice,
            preMarketChange: derivedPreMarketChange,
            preMarketChangePercent: derivedPreMarketChangePercent,
            extended_price: derivedExtendedPrice,
            extended_change: derivedExtendedChange,
            extended_percent_change: derivedExtendedChangePercent,
            is_extended_hours: derivedIsExtendedHours,
            extendedPrice: derivedExtendedPrice,
            extendedChange: derivedExtendedChange,
            extendedPercentChange: derivedExtendedChangePercent,
            isExtendedHours: derivedIsExtendedHours,
            previousClose: Number.isFinite(previousClose) ? previousClose : null,
            isMarketOpen: parseMarketOpen(row?.isMarketOpen ?? raw?.is_market_open),
            timestamp: row?.tradeTimestamp || row?.timestamp || raw?.timestamp || raw?.datetime || Date.now(),
            name: String(row?.name || raw?.name || raw?.instrument_name || raw?.display_name || '').trim() || undefined,
            exchange: String(row?.exchange || raw?.exchange || '').trim() || undefined,
            source: 'rest',
            isPlaceholder: false,
          };
        })
        .filter(Boolean);

      if (updates.length === 0) return;

      setQuotesBySymbol((previous) => {
        const next = { ...previous };
        updates.forEach((quote) => {
          next[quote.symbol] = {
            ...previous[quote.symbol],
            ...quote,
          };
        });
        return next;
      });

      setQuoteValueLoadingBySymbol((previous) => {
        let hasChanges = false;
        const next = { ...previous };

        updates.forEach((quote) => {
          const symbol = normalizeSymbol(quote?.symbol);
          if (!symbol) return;

          const current = next[symbol] || createQuoteValueLoadingState();
          if (!current.price && !current.day && !current.preMarket) {
            if (!next[symbol]) next[symbol] = current;
            return;
          }

          next[symbol] = {
            ...current,
            price: false,
            day: false,
            preMarket: false,
          };
          hasChanges = true;
        });

        return hasChanges ? next : previous;
      });

      cachePreviousCloseQuotes(updates);

      setWatchlistNamesBySymbol((previous) => {
        let hasUpdate = false;
        const next = { ...previous };
        updates.forEach((quote) => {
          const normalized = normalizeSymbol(quote?.symbol);
          const name = String(quote?.name || '').trim();
          if (!normalized || !name || next[normalized] === name) return;
          next[normalized] = name;
          hasUpdate = true;
        });
        return hasUpdate ? next : previous;
      });

      if (updates.some((quote) => quote.isMarketOpen === true) && restFallbackActiveRef.current) {
        stopRestFallbackPolling();
        setStreamStatus((previous) => ({
          ...previous,
          error: '',
        }));
      }
    } catch {}
  }, [cachePreviousCloseQuotes, stopRestFallbackPolling]);

  const handleWatchlistSymbolSelect = useCallback((symbolValue) => {
    if (Date.now() - lastDragEndRef.current < 300) return;
    const normalized = normalizeSymbol(symbolValue);
    if (!normalized) return;
    selectedSymbolRef.current = normalized;
    setSelectedSymbol(normalized);
    void fetchQuoteSnapshot([normalized]);
  }, [fetchQuoteSnapshot]);

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
      if (priceAlertsRef.current) {
        priceAlertsRef.current.updatePrice(price);
      }
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
      if (priceAlertsRef.current) {
        priceAlertsRef.current.updatePrice(price);
      }
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
    if (priceAlertsRef.current) {
      priceAlertsRef.current.updatePrice(price);
    }
  }, []);

  useEffect(() => {
    if (!chartContainerRef.current) return undefined;

    const chart = createChart(chartContainerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: (CHART_BG_THEMES.find((t) => t.id === chartBgTheme) || CHART_BG_THEMES[0]).color },
        textColor: '#4c7aaf',
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(255,255,255,0.12)', width: 1, style: 3 },
        horzLine: { color: 'rgba(255,255,255,0.12)', width: 1, style: 3 },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.06, bottom: 0.1 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 3,
        barSpacing: 6,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: UP_COLOR,
      downColor: DOWN_COLOR,
      wickUpColor: UP_COLOR,
      wickDownColor: DOWN_COLOR,
      borderUpColor: UP_COLOR,
      borderDownColor: DOWN_COLOR,
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineColor: PRICE_LINE_BLUE,
      priceLineWidth: 1,
      priceLineStyle: LineStyle.Dashed,
    });

    const lineToolsPlugin = createLineToolsPlugin(chart, candleSeries);
    lineToolsPlugin.registerLineTool('TrendLine', LineToolTrendLine);
    lineToolsPlugin.registerLineTool('HorizontalLine', LineToolHorizontalLine);
    lineToolsPlugin.registerLineTool('VerticalLine', LineToolVerticalLine);
    lineToolsPlugin.registerLineTool('Ray', LineToolRay);
    lineToolsPlugin.registerLineTool('Rectangle', LineToolRectangle);
    lineToolsPlugin.registerLineTool('FibRetracement', LineToolFibRetracement);
    lineToolsPlugin.registerLineTool('ParallelChannel', LineToolParallelChannel);
    lineToolsRef.current = lineToolsPlugin;

    const lineSeries = chart.addSeries(LineSeries, {
      color: UP_COLOR,
      lineWidth: 2,
      lastValueVisible: true,
      priceLineVisible: true,
      crosshairMarkerVisible: true,
      visible: false,
    });
    lineSeriesRef.current = lineSeries;

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.92, bottom: 0 },
      borderVisible: false,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    setChartReady(true);

    const vp = new VolumeProfilePlugin(candleSeries, []);
    try {
      if (chart.panes && chart.panes()[0]) chart.panes()[0].attachPrimitive(vp);
    } catch (_) {}
    vp.setVisible?.(false);
    volumeProfileRef.current = vp;

    const sh = new SessionHighlightPlugin({ showLabels: true });
    try {
      if (chart.panes && chart.panes()[0]) chart.panes()[0].attachPrimitive(sh);
    } catch (_) {}
    sessionHighlightRef.current = sh;

    const pa = new PriceAlertsPlugin(selectedSymbolRef.current, {
      series: candleSeries,
      persist: true,
      onTriggered: (alert) => {
        console.log(`[Stratify] Alert triggered: ${alert.direction} ${alert.price}`);
        setAlertPopup({ message: `Price alert! $${Number(alert.price).toFixed(2)} ${alert.direction}`, variant: 'triggered' });
      },
    });
    try {
      if (chart.panes && chart.panes()[0]) chart.panes()[0].attachPrimitive(pa);
    } catch (_) {}
    priceAlertsRef.current = pa;

    const timeScale = chart.timeScale();

    const updateHighLowLines = () => {
      const series = candleSeriesRef.current;
      const data = lastCandleDataRef.current;
      const ts = chartRef.current?.timeScale();
      if (!series || !data || data.length === 0 || !ts) return;

      // Remove previous high/low lines
      highLowPriceLinesRef.current.forEach((line) => {
        try { series.removePriceLine(line); } catch {}
      });
      highLowPriceLinesRef.current = [];

      // If High/Low is toggled off, just clear and return
      if (!showHighLowRef.current) return;

      const visibleRange = ts.getVisibleRange();
      if (!visibleRange) return;

      const visibleBars = data.filter(
        (b) => b.time >= visibleRange.from && b.time <= visibleRange.to
      );
      if (visibleBars.length === 0) return;

      const periodHigh = Math.max(...visibleBars.map((b) => b.high));
      const periodLow = Math.min(...visibleBars.map((b) => b.low));

      const highLine = series.createPriceLine({
        price: periodHigh,
        color: PRICE_LINE_BLUE,
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: 'High',
        axisLabelColor: PRICE_LINE_BLUE,
        axisLabelTextColor: '#ffffff',
      });

      const lowLine = series.createPriceLine({
        price: periodLow,
        color: PRICE_LINE_BLUE,
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: 'Low',
        axisLabelColor: PRICE_LINE_BLUE,
        axisLabelTextColor: '#ffffff',
      });

      highLowPriceLinesRef.current = [highLine, lowLine];
    };
    updateHighLowLinesRef.current = updateHighLowLines;

    const handleVisibleRangeChange = () => {
      const visibleRange = timeScale.getVisibleRange();
      const symbol = selectedSymbolRef.current;
      if (visibleRange && symbol) {
        saveChartViewport(symbol, chartTimeframeRef.current, {
          from: visibleRange.from,
          to: visibleRange.to,
        });
      }
      updateHighLowLines();
    };
    timeScale.subscribeVisibleTimeRangeChange(handleVisibleRangeChange);
    timeScale.subscribeVisibleLogicalRangeChange(updateHighLowLines);

    return () => {
      setChartReady(false);
      timeScale.unsubscribeVisibleTimeRangeChange(handleVisibleRangeChange);
      timeScale.unsubscribeVisibleLogicalRangeChange(updateHighLowLines);
      lineToolsPlugin.removeAllLineTools?.();
      volumeProfileRef.current = null;
      if (sessionHighlightRef.current) sessionHighlightRef.current = null;
      priceAlertsRef.current = null;
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      lineSeriesRef.current = null;
      volumeSeriesRef.current = null;
      lastBarRef.current = null;
      drawingPriceLinesRef.current = [];
      drawingTrendLinesRef.current = [];
      drawingRectanglesRef.current = [];
      drawingPendingPointRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;
    const theme = CHART_BG_THEMES.find((t) => t.id === chartBgTheme) || CHART_BG_THEMES[0];
    chartRef.current.applyOptions({
      layout: { background: { type: ColorType.Solid, color: theme.color } },
    });
    try { sessionStorage.setItem('stratify-chart-bg', chartBgTheme); } catch {}
  }, [chartBgTheme]);

  useEffect(() => {
    showHighLowRef.current = showHighLow;
    try { sessionStorage.setItem('stratify-chart-highlow', showHighLow ? 'true' : 'false'); } catch {}
    updateHighLowLinesRef.current?.();
  }, [showHighLow]);

  useEffect(() => {
    const handler = () => {
      priceAlertsRef.current?.loadFromStorage?.();
    };
    window.addEventListener('stratify-chart-alerts-updated', handler);
    return () => window.removeEventListener('stratify-chart-alerts-updated', handler);
  }, []);

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const lineSeries = lineSeriesRef.current;
    if (!candleSeries) return;
    const up = candleColors?.up ?? UP_COLOR;
    const down = candleColors?.down ?? DOWN_COLOR;
    const isHollow = chartDisplayMode === 'hollow';
    const isLineMode = chartDisplayMode === 'line';
    candleSeries.applyOptions({
      upColor: isHollow ? 'rgba(11,11,11,0)' : up,
      downColor: isHollow ? 'rgba(11,11,11,0)' : down,
      borderUpColor: up,
      borderDownColor: down,
      wickUpColor: up,
      wickDownColor: down,
      visible: !isLineMode,
    });
    if (lineSeries) {
      lineSeries.applyOptions({ color: up, visible: isLineMode });
      if (isLineMode && lastCandleDataRef.current.length > 0) {
        lineSeries.setData(lastCandleDataRef.current.map((bar) => ({ time: bar.time, value: bar.close })));
      }
    }
  }, [candleColors?.up, candleColors?.down, chartDisplayMode]);

  const clearDrawingLines = useCallback((opts) => {
    const skipSave = opts?.skipSave === true;
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    if (!series) return;
    // Remove every custom price line from the series (fixes stuck lines when our refs were lost)
    try {
      const allPriceLines = series.priceLines?.() ?? [];
      allPriceLines.forEach((line) => {
        try {
          series.removePriceLine(line);
        } catch (_) {}
      });
    } catch (_) {}
    drawingPriceLinesRef.current = [];
    drawingTrendLinesRef.current.forEach((s) => {
      try {
        if (chart) chart.removeSeries(s);
      } catch (_) {}
    });
    drawingTrendLinesRef.current = [];
    drawingRectanglesRef.current.forEach((s) => {
      try {
        if (chart) chart.removeSeries(s);
      } catch (_) {}
    });
    drawingRectanglesRef.current = [];
    drawingPendingPointRef.current = null;
    if (!skipSave) {
      const sym = selectedSymbolRef.current;
      if (sym) saveDrawings('trader', sym, { horizontal: [], trends: [], rectangles: [] });
    }
  }, []);

  const handleToolSelect = (toolName) => {
    setActiveTool(toolName);
    if (!lineToolsRef.current) return;
    if (toolName === 'cursor') return;
    if (toolName === 'clear') {
      lineToolsRef.current.removeAllLineTools();
      setActiveTool('cursor');
      return;
    }
    lineToolsRef.current.addLineTool(toolName, []);
  };

  // Drawing tools: one stable handler reads current tool from ref so all tools work; proper unsubscribe
  const drawingClickHandler = useCallback((param) => {
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    const tool = selectedDrawingToolRef.current;
    if (!chart || !series || !tool || !param?.point) return;
    const timeScale = chart.timeScale();
    const price = series.coordinateToPrice(param.point.y);
    const time = timeScale.coordinateToTime(param.point.x);
    if (price == null || !Number.isFinite(price) || time == null) return;
    const numPrice = Number(price);

    if (tool === 'horizontal') {
      const lines = drawingPriceLinesRef.current;
      const hitPx = 10;
      for (let i = 0; i < lines.length; i++) {
        const pl = lines[i];
        const linePrice = pl.options().price;
        const lineY = series.priceToCoordinate(linePrice);
        if (lineY != null && Math.abs(lineY - param.point.y) <= hitPx) {
          draggingPriceLineRef.current = pl;
          const onMove = (moveParam) => {
            if (!draggingPriceLineRef.current || !moveParam?.point) return;
            const p = candleSeriesRef.current?.coordinateToPrice(moveParam.point.y);
            if (p != null && Number.isFinite(p)) draggingPriceLineRef.current.applyOptions({ price: Number(p) });
          };
          const onUp = () => {
            if (drawingDragCleanupRef.current) drawingDragCleanupRef.current();
            drawingDragCleanupRef.current = null;
            const sym = selectedSymbolRef.current;
            if (sym) {
              const prices = drawingPriceLinesRef.current.map((pl) => pl.options().price);
              const stored = getStoredDrawings('trader', sym);
              saveDrawings('trader', sym, { ...stored, horizontal: prices });
            }
            draggingPriceLineRef.current = null;
          };
          chart.subscribeCrosshairMove(onMove);
          const removeListeners = () => {
            try { chart.unsubscribeCrosshairMove(onMove); } catch (_) {}
            window.removeEventListener('mouseup', onUp);
          };
          drawingDragCleanupRef.current = removeListeners;
          window.addEventListener('mouseup', onUp, { once: true });
          return;
        }
      }
      const line = series.createPriceLine({
        price: numPrice,
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        color: '#10b981',
      });
      drawingPriceLinesRef.current.push(line);
      const sym = selectedSymbolRef.current;
      if (sym) {
        const stored = getStoredDrawings('trader', sym);
        saveDrawings('trader', sym, { ...stored, horizontal: [...stored.horizontal, numPrice] });
      }
      setSelectedDrawingToolRef.current?.(null);
      return;
    }

    if (tool === 'trend' || tool === 'line-segment') {
      if (drawingJustFinishedViaMouseupRef.current) {
        drawingJustFinishedViaMouseupRef.current = false;
        return;
      }
      const pending = drawingPendingPointRef.current;
      if (!pending) {
        drawingPendingPointRef.current = { time, price: numPrice };
        drawingLastCrosshairRef.current = { time, value: numPrice };
        drawingDragStartedRef.current = false;
        const previewOpts = {
          color: '#10b981',
          lineWidth: 1,
          lineStyle: LineStyle.Solid,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        };
        const previewSeries = chart.addSeries(LineSeries, previewOpts);
        previewSeries.setData([
          { time, value: numPrice },
          { time, value: numPrice },
        ]);
        drawingPreviewSeriesRef.current = previewSeries;
        const container = chartContainerRef.current;
        const onMove = (e) => {
          const p = drawingPendingPointRef.current;
          const s = candleSeriesRef.current;
          const ts = chart.timeScale();
          if (!p || !s || !container) return;
          const rect = container.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const movePrice = s.coordinateToPrice(y);
          const moveTime = ts.coordinateToTime(x);
          if (movePrice == null || !Number.isFinite(movePrice) || moveTime == null) return;
          drawingDragStartedRef.current = true;
          drawingLastCrosshairRef.current = { time: moveTime, value: Number(movePrice) };
          const prev = drawingPreviewSeriesRef.current;
          if (prev) prev.setData([{ time: p.time, value: p.price }, { time: moveTime, value: Number(movePrice) }]);
        };
        const onUp = () => {
          const cleanup = drawingDragCleanupRef.current;
          if (cleanup) cleanup();
          drawingDragCleanupRef.current = null;
          const prev = drawingPreviewSeriesRef.current;
          if (prev) {
            try { chart.removeSeries(prev); } catch (_) {}
            drawingPreviewSeriesRef.current = null;
          }
          const p = drawingPendingPointRef.current;
          const last = drawingLastCrosshairRef.current;
          if (drawingDragStartedRef.current && p && last) {
            const lineSeries = chart.addSeries(LineSeries, {
              color: '#10b981',
              lineWidth: 1,
              lineStyle: LineStyle.Solid,
              lastValueVisible: false,
              priceLineVisible: false,
              crosshairMarkerVisible: false,
            });
            lineSeries.setData([{ time: p.time, value: p.price }, { time: last.time, value: last.value }]);
            drawingTrendLinesRef.current.push(lineSeries);
            const symTrend = selectedSymbolRef.current;
            if (symTrend) {
              const stored = getStoredDrawings('trader', symTrend);
              saveDrawings('trader', symTrend, {
                ...stored,
                trends: [...stored.trends, { points: [{ time: p.time, value: p.price }, { time: last.time, value: last.value }] }],
              });
            }
            setSelectedDrawingToolRef.current?.(null);
            drawingJustFinishedViaMouseupRef.current = true;
            drawingPendingPointRef.current = null;
          }
        };
        window.addEventListener('mousemove', onMove, { passive: true });
        window.addEventListener('mouseup', onUp, { once: true });
        drawingDragCleanupRef.current = () => {
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
        };
        return;
      }
      const lineSeries = chart.addSeries(LineSeries, {
        color: '#10b981',
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
      });
      lineSeries.setData([
        { time: pending.time, value: pending.price },
        { time, value: numPrice },
      ]);
      drawingTrendLinesRef.current.push(lineSeries);
      const symTrend = selectedSymbolRef.current;
      if (symTrend) {
        const stored = getStoredDrawings('trader', symTrend);
        saveDrawings('trader', symTrend, {
          ...stored,
          trends: [...stored.trends, { points: [{ time: pending.time, value: pending.price }, { time, value: numPrice }] }],
        });
      }
      drawingPendingPointRef.current = null;
      setSelectedDrawingToolRef.current?.(null);
      return;
    }

    if (tool === 'rectangle') {
      const pending = drawingPendingPointRef.current;
      if (!pending) {
        drawingPendingPointRef.current = { time, price: numPrice };
        return;
      }
      const t1 = pending.time;
      const t2 = time;
      const p1 = pending.price;
      const p2 = numPrice;
      const rectOpts = {
        color: '#10b981',
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
      };
      const top = chart.addSeries(LineSeries, rectOpts);
      top.setData([{ time: t1, value: p1 }, { time: t2, value: p1 }]);
      const bottom = chart.addSeries(LineSeries, rectOpts);
      bottom.setData([{ time: t2, value: p2 }, { time: t1, value: p2 }]);
      const tOff = typeof t1 === 'number' && typeof t2 === 'number' ? 1 : 0;
      const right = chart.addSeries(LineSeries, rectOpts);
      right.setData([{ time: t2, value: p1 }, { time: t2 + tOff, value: p2 }]);
      const left = chart.addSeries(LineSeries, rectOpts);
      left.setData([{ time: t1, value: p2 }, { time: t1 + tOff, value: p1 }]);
      drawingRectanglesRef.current.push(top, right, bottom, left);
      const symRect = selectedSymbolRef.current;
      if (symRect) {
        const stored = getStoredDrawings('trader', symRect);
        saveDrawings('trader', symRect, {
          ...stored,
          rectangles: [...stored.rectangles, { t1, t2, p1, p2 }],
        });
      }
      drawingPendingPointRef.current = null;
      setSelectedDrawingToolRef.current?.(null);
    }
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !chartReady) return;
    chart.subscribeClick(drawingClickHandler);
    return () => {
      try {
        chart.unsubscribeClick(drawingClickHandler);
      } catch (_) {}
    };
  }, [chartReady, drawingClickHandler]);

  // Restore persisted drawings when chart is ready or symbol changes
  useEffect(() => {
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    if (!chartReady || !chart || !series || !selectedSymbol) return;
    clearDrawingLines({ skipSave: true });
    const stored = getStoredDrawings('trader', selectedSymbol);
    const lineOpts = {
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    };
    (stored.horizontal || []).forEach((price) => {
      const line = series.createPriceLine({
        price: Number(price),
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        color: '#10b981',
      });
      drawingPriceLinesRef.current.push(line);
    });
    (stored.trends || []).forEach(({ points }) => {
      if (!Array.isArray(points) || points.length < 2) return;
      const lineSeries = chart.addSeries(LineSeries, {
        color: '#10b981',
        ...lineOpts,
      });
      lineSeries.setData(points.map((p) => ({ time: p.time, value: p.value })));
      drawingTrendLinesRef.current.push(lineSeries);
    });
    (stored.rectangles || []).forEach(({ t1, t2, p1, p2 }) => {
      const rectOpts = { color: '#10b981', ...lineOpts };
      const top = chart.addSeries(LineSeries, rectOpts);
      top.setData([{ time: t1, value: p1 }, { time: t2, value: p1 }]);
      const bottom = chart.addSeries(LineSeries, rectOpts);
      bottom.setData([{ time: t2, value: p2 }, { time: t1, value: p2 }]);
      const tOff = typeof t1 === 'number' && typeof t2 === 'number' ? 1 : 0;
      const right = chart.addSeries(LineSeries, rectOpts);
      right.setData([{ time: t2, value: p1 }, { time: t2 + tOff, value: p2 }]);
      const left = chart.addSeries(LineSeries, rectOpts);
      left.setData([{ time: t1, value: p2 }, { time: t1 + tOff, value: p1 }]);
      drawingRectanglesRef.current.push(top, right, bottom, left);
    });
  }, [chartReady, selectedSymbol, clearDrawingLines]);

  const resetChartSeries = useCallback(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;
    candleSeriesRef.current.setData([]);
    volumeSeriesRef.current.setData([]);
    lastBarRef.current = null;
  }, []);

  const loadCandles = useCallback(async (
    symbol,
    timeframeId = chartTimeframeRef.current,
    options = {},
  ) => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;
    const { forceFitContent = false, clearBeforeLoad = true } = options;

    const requestId = chartRequestIdRef.current + 1;
    chartRequestIdRef.current = requestId;
    const normalized = normalizeSymbol(symbol);
    const timeframeConfig = CHART_TIMEFRAME_BY_ID[timeframeId] || CHART_TIMEFRAME_BY_ID[DEFAULT_CHART_TIMEFRAME];
    if (!normalized) {
      resetChartSeries();
      setChartStatus({ loading: false, error: 'Add a ticker to load chart data.' });
      return;
    }

    setChartStatus({ loading: true, error: '' });
    if (clearBeforeLoad) {
      resetChartSeries();
    }

    try {
      const params = new URLSearchParams({
        symbol: normalized,
        interval: timeframeConfig.interval,
        outputsize: timeframeConfig.outputsize,
        format: 'JSON',
      });

      const response = await fetch(`${CHART_CANDLES_ENDPOINT}?${params.toString()}`, {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));

      if (requestId !== chartRequestIdRef.current) return;

      if (!response.ok || payload?.status === 'error') {
        throw new Error(payload?.error || payload?.message || payload?.code || 'Failed to load chart data.');
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

      if (requestId !== chartRequestIdRef.current) return;

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
        resetChartSeries();
        setChartStatus({ loading: false, error: 'No candles returned for this symbol.' });
        return;
      }

      const isLineMode = chartDisplayMode === 'line';
      const lineData = deduped.map((bar) => ({ time: bar.time, value: bar.close }));

      candleSeriesRef.current.setData(
        deduped.map((bar) => ({
          time: bar.time,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
        }))
      );

      lastCandleDataRef.current = deduped;
      if (lineSeriesRef.current) {
        lineSeriesRef.current.setData(lineData);
        lineSeriesRef.current.applyOptions({ visible: isLineMode });
      }
      candleSeriesRef.current.applyOptions({ visible: !isLineMode });

      if (volumeProfileRef.current && deduped.length > 0) {
        volumeProfileRef.current.updateData(deduped);
      }

      volumeSeriesRef.current.setData(
        deduped.map((bar) => ({
          time: bar.time,
          value: Number.isFinite(bar.volume) ? bar.volume : 0,
          color: bar.close >= bar.open ? VOLUME_UP : VOLUME_DOWN,
        }))
      );

      // Force price scale (Y-axis) to fit new ticker's data so right-side prices update (e.g. HIMS $15 -> NVDA $177)
      try {
        const mainScale = chartRef.current?.priceScale?.('right');
        if (mainScale) {
          if (typeof mainScale.setAutoScale === 'function') mainScale.setAutoScale(true);
          else if (typeof mainScale.applyOptions === 'function') mainScale.applyOptions({ autoScale: true });
        }
      } catch (_) {}

      // Restore saved viewport if available, otherwise fit content
      const savedViewport = forceFitContent ? null : loadChartViewport(normalized, timeframeId);
      if (savedViewport && chartRef.current) {
        try {
          chartRef.current.timeScale().setVisibleRange({
            from: savedViewport.from,
            to: savedViewport.to,
          });
        } catch {}
      } else {
        chartRef.current?.timeScale().fitContent();
      }
      lastBarRef.current = deduped[deduped.length - 1];
      setChartStatus({ loading: false, error: '' });
      // After layout settles, resize chart so candles are clearly visible (fixes "chart very small" on first load)
      if (chartResizeTimerRef.current) clearTimeout(chartResizeTimerRef.current);
      chartResizeTimerRef.current = setTimeout(() => {
        chartResizeTimerRef.current = null;
        try {
          const container = chartContainerRef.current;
          const chart = chartRef.current;
          if (container && chart) {
            const { width, height } = container.getBoundingClientRect();
            if (width > 0 && height > 0) {
              chart.resize(width, height);
              chart.timeScale().fitContent();
              const mainScale = chart.priceScale?.('right');
              if (mainScale && (typeof mainScale.setAutoScale === 'function')) mainScale.setAutoScale(true);
            }
          }
        } catch {}
        // Update high/low lines after layout settles
        updateHighLowLinesRef.current?.();
      }, 200);
    } catch (error) {
      if (requestId !== chartRequestIdRef.current) return;
      setChartStatus({
        loading: false,
        error: error?.message || 'Failed to load chart data.',
      });
    }
  }, [resetChartSeries]);

  useEffect(() => {
    if (!chartReady) return;
    void loadCandles(selectedSymbol, chartTimeframe, { clearBeforeLoad: true });
  }, [chartReady, chartTimeframe, selectedSymbol, loadCandles]);

  const handleRefreshChart = useCallback(() => {
    if (!chartReady) return;
    const normalized = normalizeSymbol(selectedSymbolRef.current || selectedSymbol);
    if (!normalized) return;
    void loadCandles(normalized, chartTimeframeRef.current, {
      forceFitContent: true,
      clearBeforeLoad: true,
    });
    void fetchQuoteSnapshot([normalized]);
  }, [chartReady, fetchQuoteSnapshot, loadCandles, selectedSymbol]);

  useEffect(() => {
    if (chartReady && priceAlertsRef.current) {
      setHasAlerts(priceAlertsRef.current.getAlertCount() > 0);
    }
  }, [chartReady]);

  useEffect(() => {
    const symbols = streamSubscriptionSymbols;
    const nextStreamSet = new Set(symbols);

    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const subscribed = subscribedSymbolsRef.current;
    const toSubscribe = symbols.filter((symbol) => !subscribed.has(symbol));
    const toUnsubscribe = [...subscribed].filter((symbol) => !nextStreamSet.has(symbol));

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
  }, [streamSubscriptionKey, streamSubscriptionSymbols]);

  useEffect(() => {
    if (!watchlistSymbolSetKey) return;
    void fetchQuoteSnapshot();
  }, [watchlistSymbolSetKey, fetchQuoteSnapshot]);

  useEffect(() => {
    if (!isSearchDropdownOpen) return;
    if (!searchResultSymbolSetKey) return;
    void fetchQuoteSnapshot(searchResultSymbols);
  }, [fetchQuoteSnapshot, isSearchDropdownOpen, searchResultSymbolSetKey, searchResultSymbols]);

  useEffect(() => {
    if (!apiKey) {
      clearNoStreamDataTimer();
      stopRestFallbackPolling();
      setStreamStatus({
        connected: false,
        connecting: false,
        retryCount: 0,
        error: 'Add VITE_TWELVE_DATA_API_KEY to .env for live prices',
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
      const rawExtendedChange = toNumber(payload?.extended_change ?? payload?.extendedChange);
      const rawExtendedPercentChange = toNumber(
        payload?.extended_percent_change ?? payload?.extendedPercentChange
      );
      const rawExtendedPrice = toNumber(payload?.extended_price ?? payload?.extendedPrice);
      const rawIsExtendedHours = parseMarketOpen(payload?.is_extended_hours ?? payload?.isExtendedHours);
      const currentExtendedHoursStatus = getExtendedHoursStatus();
      const inPreMarketSession = currentExtendedHoursStatus === 'pre-market';
      const inPostMarketSession = currentExtendedHoursStatus === 'post-market';
      const inExtendedHoursSession = inPreMarketSession || inPostMarketSession;
      const marketOpenFromPayload = parseMarketOpen(
        payload?.is_market_open
        ?? payload?.isMarketOpen
        ?? payload?.market_open
        ?? payload?.marketOpen
      );
      const cachedPreviousClose = toNumber(previousCloseCacheRef.current?.[symbol]?.previousClose);
      const streamPreviousClose = resolvePreviousCloseFromQuote({
        ...payload,
        previousClose: payload?.previous_close ?? payload?.previousClose ?? cachedPreviousClose,
        previous_close: payload?.previous_close ?? cachedPreviousClose,
        price,
        change: rawChange,
        changePercent: rawPercent,
      });
      const streamPremarketMetrics = extractPremarketQuoteMetrics(payload, price, cachedPreviousClose);

      setQuotesBySymbol((previous) => {
        const previousQuote = previous[symbol] || {};
        const previousPrice = toNumber(previousQuote?.price);
        const previousCloseFromState = resolvePreviousCloseFromQuote(previousQuote);
        const previousClose = Number.isFinite(streamPreviousClose)
          ? streamPreviousClose
          : Number.isFinite(previousCloseFromState)
            ? previousCloseFromState
            : cachedPreviousClose;
        const preMarketMetrics = extractPremarketQuoteMetrics(payload, price, previousClose);

        const previousDayChange = toNumber(previousQuote?.change);
        const previousDayChangePercent = toNumber(previousQuote?.changePercent);
        const derivedDayChange = Number.isFinite(previousClose)
          ? price - previousClose
          : Number.isFinite(previousPrice)
            ? price - previousPrice
            : null;
        const derivedDayChangePercent = Number.isFinite(derivedDayChange) && Number.isFinite(previousClose) && previousClose !== 0
          ? (derivedDayChange / previousClose) * 100
          : null;

        const change = Number.isFinite(rawChange)
          ? rawChange
          : Number.isFinite(previousDayChange)
            ? previousDayChange
            : derivedDayChange;

        const changePercent = Number.isFinite(rawPercent)
          ? rawPercent
          : Number.isFinite(previousDayChangePercent)
            ? previousDayChangePercent
            : derivedDayChangePercent;
        const derivedPreMarketChange = Number.isFinite(preMarketMetrics.preMarketChange)
          ? preMarketMetrics.preMarketChange
          : inPreMarketSession && Number.isFinite(previousClose)
            ? price - previousClose
            : toNumber(previousQuote?.preMarketChange);
        const derivedPreMarketChangePercent = Number.isFinite(preMarketMetrics.preMarketChangePercent)
          ? preMarketMetrics.preMarketChangePercent
          : Number.isFinite(derivedPreMarketChange) && Number.isFinite(previousClose) && previousClose !== 0
            ? (derivedPreMarketChange / previousClose) * 100
            : toNumber(previousQuote?.preMarketChangePercent);
        const derivedPreMarketPrice = Number.isFinite(preMarketMetrics.preMarketPrice)
          ? preMarketMetrics.preMarketPrice
          : inPreMarketSession
            ? price
            : toNumber(previousQuote?.preMarketPrice);
        const derivedExtendedChange = Number.isFinite(rawExtendedChange)
          ? rawExtendedChange
          : Number.isFinite(preMarketMetrics.preMarketChange)
            ? preMarketMetrics.preMarketChange
            : toNumber(previousQuote?.extended_change ?? previousQuote?.extendedChange ?? previousQuote?.preMarketChange);
        const derivedExtendedChangePercent = Number.isFinite(rawExtendedPercentChange)
          ? rawExtendedPercentChange
          : Number.isFinite(preMarketMetrics.preMarketChangePercent)
            ? preMarketMetrics.preMarketChangePercent
            : Number.isFinite(derivedExtendedChange) && Number.isFinite(previousClose) && previousClose !== 0
              ? (derivedExtendedChange / previousClose) * 100
              : toNumber(previousQuote?.extended_percent_change ?? previousQuote?.extendedPercentChange ?? previousQuote?.preMarketChangePercent);
        const derivedExtendedPrice = Number.isFinite(rawExtendedPrice)
          ? rawExtendedPrice
          : Number.isFinite(preMarketMetrics.preMarketPrice)
            ? preMarketMetrics.preMarketPrice
            : toNumber(previousQuote?.extended_price ?? previousQuote?.extendedPrice ?? previousQuote?.preMarketPrice);
        const derivedIsExtendedHours = rawIsExtendedHours !== null
          ? rawIsExtendedHours
          : parseMarketOpen(previousQuote?.is_extended_hours ?? previousQuote?.isExtendedHours);

        return {
          ...previous,
          [symbol]: {
            ...previousQuote,
            symbol,
            price,
            change,
            changePercent,
            preMarketPrice: derivedPreMarketPrice,
            preMarketChange: derivedPreMarketChange,
            preMarketChangePercent: derivedPreMarketChangePercent,
            extended_price: derivedExtendedPrice,
            extended_change: derivedExtendedChange,
            extended_percent_change: derivedExtendedChangePercent,
            is_extended_hours: derivedIsExtendedHours,
            extendedPrice: derivedExtendedPrice,
            extendedChange: derivedExtendedChange,
            extendedPercentChange: derivedExtendedChangePercent,
            isExtendedHours: derivedIsExtendedHours,
            previousClose: Number.isFinite(previousClose)
              ? previousClose
              : toNumber(previousQuote?.previousClose),
            isMarketOpen: marketOpenFromPayload !== null
              ? marketOpenFromPayload
              : typeof previousQuote?.isMarketOpen === 'boolean'
                ? previousQuote.isMarketOpen
                : !inExtendedHoursSession,
            timestamp: payload?.timestamp || payload?.datetime || Date.now(),
            name: String(payload?.name || payload?.instrument_name || payload?.display_name || previousQuote?.name || '').trim() || undefined,
            source: 'stream',
            isPlaceholder: false,
          },
        };
      });

      markQuoteValuesLoaded([
        {
          symbol,
          price: true,
          day: true,
          preMarket: inPreMarketSession
            || Number.isFinite(streamPremarketMetrics.preMarketChange)
            || Number.isFinite(streamPremarketMetrics.preMarketChangePercent),
        },
      ]);

      if (Number.isFinite(streamPreviousClose)) {
        cachePreviousCloseQuotes([
          {
            symbol,
            previousClose: streamPreviousClose,
            name: payload?.name || payload?.instrument_name || payload?.display_name || symbol,
            exchange: payload?.exchange,
            timestamp: payload?.timestamp || payload?.datetime || Date.now(),
          },
        ]);
      }

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

        const symbols = [...streamSubscriptionRef.current];
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
    cachePreviousCloseQuotes,
    clearNoStreamDataTimer,
    markQuoteValuesLoaded,
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

    applyCachedClosePlaceholder(normalized, normalizedName);
    if (!isExistingSymbol) {
      markQuoteValuesPending(normalized);
    }
    void fetchQuoteSnapshot([normalized]);
  }, [applyCachedClosePlaceholder, fetchQuoteSnapshot, markQuoteValuesPending]);

  const openPortfolioPositionForTrade = useCallback((symbolValue, companyName = '') => {
    const normalized = normalizeSymbol(symbolValue);
    if (!normalized) return;
    addSymbolToWatchlist(normalized, companyName);
    setIsRightPanelCollapsed(false);
  }, [addSymbolToWatchlist]);

  const addSymbol = (event) => {
    event.preventDefault();
    const topResult = searchResults[0];
    if (topResult?.symbol) {
      addSymbolToWatchlist(topResult.symbol, topResult.name);
      return;
    }
    addSymbolToWatchlist(symbolInput);
  };

  const handleMarketSelect = useCallback((marketId) => {
    const normalizedMarketId = String(marketId || '').trim().toLowerCase();
    if (!MARKET_FILTER_BY_ID[normalizedMarketId]) return;

    setActiveMarket(normalizedMarketId);

    const presetSymbols = (MARKET_WATCHLIST_PRESETS[normalizedMarketId] || [])
      .map(normalizeSymbol)
      .filter(Boolean);
    if (presetSymbols.length === 0) return;

    const uniquePresetSymbols = [...new Set(presetSymbols)];
    setWatchlist(uniquePresetSymbols);
    setSelectedSymbol(uniquePresetSymbols[0]);
    setWatchlistNamesBySymbol((previous) => {
      const next = { ...previous };
      uniquePresetSymbols.forEach((symbol) => {
        if (!next[symbol] && MARKET_NAME_BY_SYMBOL[symbol]) {
          next[symbol] = MARKET_NAME_BY_SYMBOL[symbol];
        }
      });
      return next;
    });

    setSymbolInput('');
    setSearchResults([]);
    setIsSearchLoading(false);
    setIsSearchDropdownOpen(false);
  }, []);

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

  const pinSymbolToTopPills = useCallback((symbolToPin) => {
    const normalized = normalizeSymbol(symbolToPin);
    if (!normalized || typeof onPinToTop !== 'function') return;
    onPinToTop(normalized);
  }, [onPinToTop]);

  const emitTickerDragState = useCallback((detail = {}) => {
    if (typeof window === 'undefined') return;
    try {
      window.dispatchEvent(new CustomEvent(TICKER_DRAG_STATE_EVENT, { detail }));
    } catch {}
  }, []);

  const resetDragPreview = useCallback(() => {
    dragPositionXRef.current = null;
    dragPositionYRef.current = null;
    setActiveDragTicker('');
    setDragPreviewScale(1);
    setDragOverIndex(null);
    emitTickerDragState({ active: false, symbol: '', slot: null });
  }, [emitTickerDragState]);

  const updateDragPreviewScale = useCallback((draggableId) => {
    const dragCenter = getDraggedTickerCenter(draggableId);
    const dragCenterY = Number(dragCenter?.y);
    const dragCenterX = Number(dragCenter?.x);
    if (!Number.isFinite(dragCenterY)) {
      emitTickerDragState({ active: true, symbol: draggableId, slot: null });
      return;
    }

    dragPositionYRef.current = dragCenterY;
    dragPositionXRef.current = Number.isFinite(dragCenterX) ? dragCenterX : null;

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
    const dropTarget = getPinnedTickerDropTarget(dragCenterX, dragCenterY, 120);
    emitTickerDragState({
      active: true,
      symbol: draggableId,
      slot: dropTarget?.slot ?? null,
      x: Number.isFinite(dragCenterX) ? dragCenterX : null,
      y: Number.isFinite(dragCenterY) ? dragCenterY : null,
    });
  }, [emitTickerDragState]);

  const handleDragStart = useCallback((start) => {
    const draggableId = String(start?.draggableId || '').trim();
    if (!draggableId) return;

    setActiveDragTicker(draggableId);
    setDragPreviewScale(1);
    setDragOverIndex(null);
    dragPositionXRef.current = null;
    dragPositionYRef.current = null;
    emitTickerDragState({ active: true, symbol: draggableId, slot: null });

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        updateDragPreviewScale(draggableId);
      });
      return;
    }

    updateDragPreviewScale(draggableId);
  }, [emitTickerDragState, updateDragPreviewScale]);

  const handleDragUpdate = useCallback((update) => {
    const draggableId = String(update?.draggableId || '').trim();
    if (!draggableId) return;

    setActiveDragTicker((previous) => (previous === draggableId ? previous : draggableId));
    const nextDropIndex = Number.isInteger(update?.destination?.index) ? update.destination.index : null;
    setDragOverIndex(nextDropIndex);
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
    lastDragEndRef.current = Date.now();
    const draggedSymbol = String(result?.draggableId || '').trim();
    const lastDragCenterY = Number(dragPositionYRef.current);
    const lastDragCenterX = Number(dragPositionXRef.current);

    // Check if dragged to pinned pills zone at top
    if (!result.destination) {
      let centerY = Number.isFinite(lastDragCenterY) ? lastDragCenterY : null;
      let centerX = Number.isFinite(lastDragCenterX) ? lastDragCenterX : null;

      if ((!Number.isFinite(centerY) || !Number.isFinite(centerX)) && draggedSymbol) {
        const draggedElement = document.querySelector(`[data-rbd-draggable-id="${draggedSymbol}"]`);
        if (draggedElement) {
          const rect = draggedElement.getBoundingClientRect();
          centerY = Number.isFinite(rect.top) && Number.isFinite(rect.height) ? rect.top + rect.height / 2 : centerY;
          centerX = Number.isFinite(rect.left) && Number.isFinite(rect.width) ? rect.left + rect.width / 2 : centerX;
        }
      }

      const dropTarget = getPinnedTickerDropTarget(centerX, centerY, 120);
      if (dropTarget?.slot && draggedSymbol) {
        // Dropped near mini-pill zone: map to one of slots 2-5.
        const dropSlot = dropTarget.slot;
        if (typeof onPinToTop === 'function') {
          onPinToTop(draggedSymbol, dropSlot);
        }
        resetDragPreview();
        return;
      }
      resetDragPreview();
      return;
    }

    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;
    if (sourceIndex === destIndex) {
      resetDragPreview();
      return;
    }

    setWatchlist((previous) => {
      const reordered = Array.from(previous);
      const [removed] = reordered.splice(sourceIndex, 1);
      if (!removed) return previous;
      reordered.splice(destIndex, 0, removed);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(WATCHLIST_ORDER_STORAGE_KEY, JSON.stringify(reordered));
        } catch {}
      }
      return reordered;
    });
    resetDragPreview();
  }, [onPinToTop, resetDragPreview]);

  useEffect(() => () => {
    emitTickerDragState({ active: false, symbol: '', slot: null });
  }, [emitTickerDragState]);

  const streamLabel = streamStatus.connected
    ? 'Connected'
    : streamStatus.connecting
      ? 'Connecting...'
      : streamStatus.retryCount > 0
        ? `Reconnecting (${streamStatus.retryCount})`
        : 'Disconnected';
  const activeStreamSymbolCount = streamSubscriptionSymbols.length;
  const extendedHoursStatus = getExtendedHoursStatus();
  const watchlistPanelStyle = {
    width: `${watchlistPanelWidth}px`,
    ...GLASS_SHELL_STYLE,
    borderRight: '1px solid rgba(255,255,255,0.06)',
  };
  const chartPanelStyle = {
    ...GLASS_SHELL_STYLE,
  };
  const orderTicketStyle = {
    ...UNIFIED_PANEL_STYLE,
    borderLeft: '1px solid rgba(255,255,255,0.06)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  };
  const isMediumArticleDrawerLayout = Boolean(drawerArticle && isNewsOpen && !isArticleDrawerExtendedToChartTop);

  return (
    <motion.div
      {...PAGE_TRANSITION}
      className="relative flex h-full min-h-0 w-full flex-col overflow-hidden text-[#e5e7eb]" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%), #0a0a0a' }}
    >
      {!isMediumArticleDrawerLayout ? (
      <div className="flex h-[76px] shrink-0 items-center justify-between gap-8 px-6 py-3 backdrop-blur-xl" style={GLASS_TOPBAR_STYLE}>
        <div className="flex flex-1 min-w-0 items-center gap-4">
          <button
            type="button"
            onClick={onOpenLiveScores}
            className={`relative h-9 flex items-center gap-2.5 pl-3 pr-3.5 rounded-full cursor-pointer transition-all shrink-0 ${
              isLiveScoresOpen
                ? 'border border-white/40 bg-white/10 shadow-[0_0_12px_rgba(255,255,255,0.1)]'
                : 'border border-white/20 bg-black/90 hover:border-white/40'
            }`}
            aria-label="Open live ESPN scores"
            title="Open live ESPN scores"
          >
            <div className="h-4 min-w-0 flex items-center justify-center">
              {espnLogoErrored ? (
                <span className="text-[10px] font-black italic tracking-tight text-[#E5252A]">ESPN</span>
              ) : (
                <img
                  src={ESPN_WORDMARK_URL}
                  alt="ESPN"
                  className="h-2.5 w-auto object-contain"
                  loading="lazy"
                  onError={() => setEspnLogoErrored(true)}
                />
              )}
            </div>
            <span className="text-white font-medium text-xs">Live</span>
          </button>
          <div className="flex items-center gap-2">
            {GAME_PILL_SLOTS.map((slot) => {
              const game = pinnedGames?.[slot] || null;
              const isDropActive = activeGameDropSlot === slot;
              const isSelected = game && selectedGames.some((g) => String(g.espnId) === String(game.id));
              return (
                <div
                  key={`trader-game-slot-${slot}`}
                  className={`relative h-9 rounded-full transition-all ${
                    game
                      ? 'border border-transparent'
                      : 'min-w-[80px] border border-dashed border-white/15 bg-white/[0.03]'
                  } ${
                    isDropActive ? 'ring-1 ring-emerald-400/75 border-emerald-400/60 bg-emerald-500/10' : ''
                  } ${isSelected ? 'ring-1 ring-emerald-400/40 brightness-125' : ''}`}
                  onClick={game ? (e) => {
                    e.stopPropagation();
                    setSelectedGames((prev) => {
                      const has = prev.some((g) => String(g.espnId) === String(game.id));
                      if (has) return prev.filter((g) => String(g.espnId) !== String(game.id));
                      return [...prev, { espnId: game.id, homeAbbrev: game.homeTeam, awayAbbrev: game.awayTeam }];
                    });
                  } : undefined}
                  onDragEnter={(event) => {
                    if (!hasGameTransferData(event.dataTransfer)) return;
                    event.preventDefault();
                    setActiveGameDropSlot(slot);
                  }}
                  onDragOver={(event) => {
                    if (!hasGameTransferData(event.dataTransfer)) return;
                    event.preventDefault();
                    event.stopPropagation();
                    if (event.dataTransfer) {
                      event.dataTransfer.dropEffect = 'copy';
                    }
                    if (activeGameDropSlot !== slot) {
                      setActiveGameDropSlot(slot);
                    }
                  }}
                  onDragLeave={() => {
                    if (activeGameDropSlot === slot) {
                      setActiveGameDropSlot(null);
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const payload = parseGameDropPayload(event);
                    setActiveGameDropSlot(null);
                    if (payload?.type === 'game' && payload?.data) {
                      onGameDrop(payload.data, slot);
                    }
                    clearGlobalDragPayload();
                  }}
                >
                  {game ? (
                    <MiniGamePill
                      game={game}
                      onRemove={() => onRemovePinnedGame(slot)}
                    />
                  ) : (
                    <div className="h-full w-full px-2.5 flex items-center justify-center text-white/30 pointer-events-none">
                      <Plus className="h-3 w-3" strokeWidth={2} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-6 text-right">
          <div>
            <h2 className="text-base font-semibold text-white">{selectedSymbol || 'Select a symbol'}</h2>
            <p className="mt-0.5 text-sm text-[#9ca3af]">Candlestick chart · {selectedChartTimeframe.label}</p>
          </div>
          <div>
            <div className="flex items-center justify-end gap-1.5">
              <div className={`text-xl font-semibold tabular-nums ${selectedQuoteIsPlaceholder ? 'text-white/80' : 'text-white'}`}>
                {formatPrice(selectedQuote?.price)}
              </div>
              {selectedPriceLoading && (
                <span className="h-2 w-2 rounded-full bg-slate-400/80 animate-pulse" title="Updating price" />
              )}
            </div>
            <div
              className={`flex items-center justify-end gap-1.5 text-sm font-medium tabular-nums ${
                Number.isFinite(Number(selectedQuote?.changePercent))
                  ? Number(selectedQuote?.changePercent) >= 0
                    ? 'text-emerald-400'
                    : 'text-red-400'
                  : 'text-[#6b7280]'
              }`}
            >
              <span>{formatSignedPercent(selectedQuote?.changePercent)}</span>
              {selectedDayLoading && (
                <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse opacity-80" title="Updating day change" />
              )}
            </div>
          </div>
        </div>
      </div>
      ) : null}

      <motion.div
        {...sectionMotion(0)}
        className="flex flex-1 min-h-0 min-w-0 overflow-x-auto overflow-y-hidden"
      >
        <aside
          className="flex h-full min-h-0 max-h-full shrink-0 flex-col overflow-hidden border-r border-white/[0.06] transition-[width] duration-200 ease-in-out"
          style={watchlistPanelStyle}
        >
          {isWatchlistCollapsed && (
            <div className="flex h-10 shrink-0 items-center justify-center border-b border-white/[0.06] px-1">
              <motion.button
                type="button"
                onClick={() => setIsWatchlistCollapsed(false)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={interactiveTransition}
                className="inline-flex h-8 w-8 items-center justify-center border border-transparent bg-transparent text-emerald-300 hover:text-emerald-200"
                aria-label="Expand watchlist"
              >
                <ChevronsRight className="h-4 w-4 animate-pulse drop-shadow-[0_0_10px_rgba(16,185,129,0.65)]" strokeWidth={1.8} />
              </motion.button>
            </div>
          )}

          {!isWatchlistCollapsed && (
            <>
              <form onSubmit={addSymbol} className="shrink-0">
                <div className="flex h-10 shrink-0 items-center justify-center border-b border-white/[0.06] px-3">
                  <div className="flex items-center gap-2">
                    <motion.button
                      type="button"
                      onClick={() => setWatchlistView('watchlist')}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      transition={interactiveTransition}
                      className={`text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                        watchlistView === 'watchlist' ? 'text-emerald-300' : 'text-[#9ca3af] hover:text-white'
                      }`}
                    >
                      Watchlist
                    </motion.button>
                    <span className="text-white/40">|</span>
                    <motion.button
                      type="button"
                      onClick={() => setWatchlistView('portfolio')}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      transition={interactiveTransition}
                      className={`text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                        watchlistView === 'portfolio' ? 'text-emerald-300' : 'text-[#9ca3af] hover:text-white'
                      }`}
                    >
                      Portfolio ({portfolioPositions.length})
                    </motion.button>
                  </div>
                </div>
                <div className="px-3 py-3">
                {watchlistView === 'watchlist' ? (
                  <>
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
                        {MARKET_FILTERS.map((market, index) => (
                          <div key={market.id} className="flex items-center gap-1">
                            <motion.button
                              type="button"
                              onClick={() => handleMarketSelect(market.id)}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              transition={interactiveTransition}
                              className={`text-[11px] font-medium whitespace-nowrap transition-colors ${
                                activeMarket === market.id
                                  ? 'text-emerald-300'
                                  : 'text-[#d1d5db] hover:text-white'
                              }`}
                            >
                              {market.label}
                            </motion.button>
                            {index < MARKET_FILTERS.length - 1 && (
                              <span className="text-white/50 px-2">|</span>
                            )}
                          </div>
                        ))}
                      </div>
                      <motion.button
                        type="button"
                        onClick={() => setIsWatchlistCollapsed(true)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        transition={interactiveTransition}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center border border-transparent bg-transparent text-emerald-300/70 hover:text-emerald-300"
                        aria-label="Collapse watchlist"
                      >
                        <ChevronsLeft className="h-4 w-4" strokeWidth={1.8} />
                      </motion.button>
                    </div>
                    <div ref={searchContainerRef} className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]" strokeWidth={1.5} />
                      <input
                        value={symbolInput}
                        onChange={(event) => setSymbolInput(event.target.value)}
                        onFocus={() => {
                          if (symbolInput.trim()) setIsSearchDropdownOpen(true);
                        }}
                        placeholder="Search here"
                        autoComplete="off"
                        className="h-10 w-full rounded-xl border border-white/[0.14] bg-white/[0.04] pl-9 pr-10 text-sm text-white outline-none transition-colors backdrop-blur-sm focus:border-emerald-400/70"
                      />
                      <motion.button
                        type="button"
                        aria-label={`Pin ${selectedSymbol || 'selected symbol'} to top mini pill`}
                        title="Double-click to pin selected ticker to top mini pills"
                        className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center text-emerald-300/45 transition-colors hover:text-emerald-300"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        transition={interactiveTransition}
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                        onDoubleClick={(event) => {
                          event.stopPropagation();
                          pinSymbolToTopPills(selectedSymbol || watchlist[0]);
                        }}
                      >
                        <Pin className="h-3 w-3" />
                      </motion.button>
                      {isSearchDropdownOpen && symbolInput.trim() && (
                        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-[420px] overflow-y-auto rounded-xl border border-white/[0.14] bg-[rgba(10,10,10,0.95)] backdrop-blur-xl shadow-[0_16px_36px_rgba(0,0,0,0.5)]">
                          {isSearchLoading ? (
                            <div className="px-3 py-2 text-xs text-[#7c8087]">Searching...</div>
                          ) : searchResults.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-[#7c8087]">No matching symbols.</div>
                          ) : (
                            searchResults.map((result, index) => {
                              const normalized = normalizeSymbol(result?.symbol);
                              const liveQuote = normalized ? quotesBySymbol[normalized] : null;
                              const livePrice = toNumber(liveQuote?.price);
                              const liveChangePercent = toNumber(liveQuote?.changePercent);

                              return (
                                <motion.button
                                  key={`${result.symbol}-${result.exchange}`}
                                  type="button"
                                  {...listItemMotion(index)}
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  transition={{ ...listItemMotion(index).transition, ...interactiveTransition }}
                                  onClick={() => addSymbolToWatchlist(result.symbol, result.name)}
                                  className="flex h-10 w-full items-center justify-between gap-2 border-b border-white/[0.06] px-3 text-left transition-colors last:border-b-0 hover:bg-white/[0.06]"
                                >
                                  <span className="truncate text-sm text-white">
                                    <span className="font-medium">${result.symbol}</span>
                                    <span className="ml-1 text-[#7c8087]">
                                      {'\u2014'} {result.name || result.symbol} ({result.exchange || 'Market'}{result.type ? ` · ${result.type}` : ''})
                                    </span>
                                  </span>
                                  <div className="ml-2 flex shrink-0 items-center gap-2">
                                    {Number.isFinite(livePrice) && (
                                      <span className="text-[11px] font-mono text-white/85">{formatPrice(livePrice)}</span>
                                    )}
                                    {Number.isFinite(liveChangePercent) && (
                                      <span
                                        className={`text-[10px] font-semibold ${
                                          liveChangePercent >= 0 ? 'text-emerald-400' : 'text-red-400'
                                        }`}
                                      >
                                        {formatSignedPercent(liveChangePercent)}
                                      </span>
                                    )}
                                    <Plus className="h-4 w-4 text-emerald-400" strokeWidth={1.8} />
                                  </div>
                                </motion.button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div>
                    <div className="mb-2 flex justify-end">
                      <motion.button
                        type="button"
                        onClick={() => setIsWatchlistCollapsed(true)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        transition={interactiveTransition}
                        className="inline-flex h-7 w-7 items-center justify-center border border-transparent bg-transparent text-emerald-300/70 hover:text-emerald-300"
                        aria-label="Collapse watchlist"
                      >
                        <ChevronsLeft className="h-4 w-4" strokeWidth={1.8} />
                      </motion.button>
                    </div>
                    <div className="rounded border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-2 text-[11px] text-emerald-300">
                      Double-click any holding below to load it in Order Entry and open the ticket.
                    </div>
                  </div>
                )}
                </div>
              </form>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                {watchlistView !== 'watchlist' && (
                  <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-white/[0.06] px-3 py-2 text-xs">
                    <span className="text-[#9ca3af]">Paper Holdings</span>
                    <span className="text-emerald-400">{portfolioPositions.length} positions</span>
                  </div>
                )}

                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-hide watchlist-scrollable">
                  {watchlistView === 'watchlist' ? (
                    <DragDropContext onDragStart={handleDragStart} onDragUpdate={handleDragUpdate} onDragEnd={handleDragEnd}>
                      <Droppable
                        droppableId="watchlist"
                        getContainerForClone={() => document.body}
                        renderClone={(provided, snapshot, rubric) => {
                          const symbol = watchlist[rubric.source.index];
                          if (!symbol) return null;
                          const quote = quotesBySymbol[symbol] || {};
                          const price = toNumber(quote?.price);
                          const changePercent = toNumber(quote?.changePercent);
                          const companyName = String(
                            quote?.name || watchlistNamesBySymbol[symbol] || MARKET_NAME_BY_SYMBOL[symbol] || symbol
                          ).trim();
                          const changeClass = Number.isFinite(changePercent) && changePercent >= 0 ? 'text-emerald-400' : 'text-red-400';
                          return (
                            <li
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={{
                                ...provided.draggableProps.style,
                                width: watchlistPanelWidth - 24,
                                minWidth: 180,
                              }}
                              className="list-none flex items-stretch rounded-lg border border-white/10 bg-[#0f1419] shadow-xl"
                            >
                              <div className="mr-2 shrink-0 flex items-center justify-center self-stretch text-gray-400 py-2.5 pl-1">
                                <GripVertical className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
                              </div>
                              <div className="flex flex-1 min-w-0 items-center justify-between py-2.5 pr-3 border-b border-white/[0.05]">
                                <div className="flex-1 min-w-0 pr-2">
                                  <div className="text-[13px] font-semibold text-white">${symbol}</div>
                                  <div className="text-white/50 text-sm truncate">{companyName}</div>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <div className="text-[12px] font-mono font-semibold text-white">
                                    {Number.isFinite(price) ? formatPrice(price) : '--'}
                                  </div>
                                  <div className={`text-xs font-semibold ${changeClass}`}>
                                    {Number.isFinite(changePercent)
                                      ? (changePercent >= 0 ? '+' : '') + formatPercent(changePercent, 2)
                                      : '--'}
                                  </div>
                                </div>
                              </div>
                            </li>
                          );
                        }}
                      >
                        {(provided) => (
                          <ul
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className="min-h-full list-none p-0 m-0"
                          >
                            {watchlist.length === 0 ? (
                              <div className="px-4 py-6 text-center text-white/50 text-sm">
                                Watchlist is empty. Search to add symbols.
                              </div>
                            ) : (
                              watchlist.map((symbol, index) => {
                              const quote = quotesBySymbol[symbol] || {};
                              const price = toNumber(quote?.price);
                              const dayChange = toNumber(quote?.change);
                              const dayChangePercent = toNumber(quote?.changePercent);
                              const extendedChange = toNumber(
                                quote?.extended_change
                                ?? quote?.extendedChange
                                ?? quote?.preMarketChange
                                ?? quote?.pre_market_change
                              );
                              const extendedChangePercent = toNumber(
                                quote?.extended_percent_change
                                ?? quote?.extendedPercentChange
                                ?? quote?.preMarketChangePercent
                                ?? quote?.pre_market_change_percent
                              );
                              const previousClose = resolvePreviousCloseFromQuote(quote);
                              const liveDollarChange = Number.isFinite(dayChange)
                                ? dayChange
                                : Number.isFinite(price) && Number.isFinite(previousClose)
                                  ? price - previousClose
                                  : null;
                              const livePercentChange = Number.isFinite(dayChangePercent)
                                ? dayChangePercent
                                : Number.isFinite(liveDollarChange) && Number.isFinite(previousClose) && previousClose !== 0
                                  ? (liveDollarChange / previousClose) * 100
                                  : null;
                              const quoteMarketOpen = parseMarketOpen(quote?.isMarketOpen ?? quote?.is_market_open);
                              const shouldShowExtendedPercent = extendedHoursStatus != null && quoteMarketOpen === false && Number.isFinite(extendedChangePercent);
                              const secondarySession = quoteMarketOpen === true
                                ? 'live'
                                : extendedHoursStatus === 'pre-market'
                                  ? 'pre-market'
                                  : extendedHoursStatus === 'post-market'
                                    ? 'post-market'
                                    : 'live';
                              const usesExtendedMetric = shouldShowExtendedPercent;
                              const secondaryDollarChange = usesExtendedMetric
                                ? (Number.isFinite(extendedChange) ? extendedChange : liveDollarChange)
                                : liveDollarChange;
                              const secondaryPercentChange = usesExtendedMetric
                                ? (Number.isFinite(extendedChangePercent) ? extendedChangePercent : livePercentChange)
                                : livePercentChange;
                              const secondaryReferenceChange = Number.isFinite(secondaryPercentChange)
                                ? secondaryPercentChange
                                : secondaryDollarChange;
                              const displayMode = watchlistChangeDisplayModeBySymbol[symbol]?.day || 'percent';
                              const primaryMetricTitle = secondarySession === 'pre-market'
                                ? 'Premarket change (% / $)'
                                : secondarySession === 'post-market'
                                  ? 'Post-market change (% / $)'
                                  : 'Live change (% / $)';
                              const stock = quote;
                              const isExtended = extendedHoursStatus != null && !(stock?.is_market_open ?? stock?.isMarketOpen) && (stock?.extended_percent_change != null || stock?.extendedPercentChange != null);
                              const displayPercent = isExtended
                                ? (parseFloat(stock?.extended_percent_change ?? stock?.extendedPercentChange) || 0).toFixed(2)
                                : (parseFloat(stock?.percent_change ?? stock?.changePercent) || 0).toFixed(2);
                              const isPositive = parseFloat(displayPercent) >= 0;
                              const percentColor = isPositive ? 'text-emerald-400' : 'text-red-400';
                              const normalizedSymbol = normalizeSymbol(symbol);
                              const isSelected =
                                normalizeSymbol(selectedSymbol) === normalizedSymbol
                                && watchlist.findIndex((s) => normalizeSymbol(s) === normalizedSymbol) === index;
                              const isPlaceholder = quote?.isPlaceholder === true;
                              const valueLoading = quoteValueLoadingBySymbol[symbol] || createQuoteValueLoadingState();
                              const isPriceLoading = valueLoading.price === true;
                              const isPrimaryLoading = usesExtendedMetric
                                ? valueLoading.preMarket === true
                                : valueLoading.day === true;
                              const companyName = String(
                                quote?.name || watchlistNamesBySymbol[symbol] || MARKET_NAME_BY_SYMBOL[symbol] || symbol
                              ).trim();
                              const isDropTarget = Number.isInteger(dragOverIndex)
                                && dragOverIndex === index
                                && Boolean(activeDragTicker)
                                && activeDragTicker !== symbol;

                              return (
                                <Draggable key={symbol} draggableId={symbol} index={index}>
                                  {(provided, snapshot) => (
                                    <li
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      style={getDragPreviewStyle(provided.draggableProps.style, snapshot.isDragging, symbol)}
                                      className="list-none flex items-stretch"
                                    >
                                      {/* Drag handle first so it receives pointer events before any wrapper; no motion here so dnd can start drag */}
                                      <div
                                        {...provided.dragHandleProps}
                                        data-drag-handle
                                        className={`ml-2 mr-2 shrink-0 flex items-center justify-center self-stretch text-gray-500 hover:text-gray-300 select-none ${
                                          snapshot.isDragging ? 'cursor-grabbing' : 'cursor-grab'
                                        }`}
                                        title="Drag to reorder"
                                        aria-label="Drag to reorder"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <GripVertical className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
                                      </div>
                                      <div
                                        role="button"
                                        tabIndex={0}
                                        className={`group relative flex flex-1 min-w-0 items-center justify-between cursor-pointer border-b border-white/[0.05] ${
                                          isSelected ? 'bg-emerald-500/10 border-l border-l-emerald-500/30 shadow-[0_0_18px_rgba(16,185,129,0.1)]' : ''
                                        } px-2 py-2.5 hover:bg-white/[0.04] ${
                                          snapshot.isDragging ? 'bg-[rgba(20,20,20,0.7)] shadow-lg ring-1 ring-emerald-500/40 opacity-50' : ''
                                        } ${
                                          isDropTarget ? 'border-t-2 border-[#58a6ff] bg-[#58a6ff]/10' : ''
                                        }`}
                                        onClick={(e) => {
                                          if (e.target.closest('[data-drag-handle]')) return;
                                          handleWatchlistSymbolSelect(symbol);
                                        }}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleWatchlistSymbolSelect(symbol); } }}
                                        onMouseEnter={() => setHoveredWatchlistSymbol(symbol)}
                                        onMouseLeave={() => setHoveredWatchlistSymbol((current) => (current === symbol ? null : current))}
                                      >

                                      <div className="flex-1 min-w-0 pr-2">
                                        <div className="flex items-center">
                                          <div
                                            className="text-[13px] font-semibold text-white"
                                            style={{
                                              fontVariationSettings: hoveredWatchlistSymbol === symbol ? '"wght" 650' : '"wght" 500',
                                              transition: 'font-variation-settings 200ms ease',
                                            }}
                                          >
                                            ${symbol}
                                          </div>
                                        </div>
                                        <div className="text-white/50 text-sm truncate">{companyName}</div>
                                      </div>

                                      <div className="ml-auto pr-1 text-right flex-shrink-0">
                                        <div className="flex items-center justify-end gap-1">
                                          <PriceFlash
                                            price={price}
                                            className={`text-[12px] font-mono font-semibold ${isPlaceholder ? 'text-white/80' : 'text-white'}`}
                                          >
                                            {Number.isFinite(price) ? formatPrice(price) : '--'}
                                          </PriceFlash>
                                          {isPriceLoading && (
                                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400/80 animate-pulse" title="Updating price" />
                                          )}
                                        </div>
                                        {Number.isFinite(price) && (
                                          <div className="flex flex-col items-end gap-1">
                                            <div className="flex items-center gap-1">
                                              {isExtended && <span className="text-sm">{extendedHoursStatus === 'pre-market' ? '☀️' : '🌙'}</span>}
                                              <span className={`${percentColor} font-mono text-sm`}>
                                                {isPositive ? '+' : ''}{displayPercent}%
                                              </span>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                      <div className="mr-1 flex-shrink-0">
                                        <SentimentBadge
                                          score={sentimentMap[symbol]?.sentiment}
                                          totalDocs={sentimentMap[symbol]?.totalDocs}
                                          compact={true}
                                        />
                                      </div>

                                      <div
                                        className="pointer-events-none ml-0.5 inline-flex items-center gap-0.5 opacity-0 transition-all duration-200 group-hover:pointer-events-auto group-hover:opacity-100"
                                      >
                                        <motion.button
                                          type="button"
                                          aria-label={`Remove ${symbol} from watchlist`}
                                          className="inline-flex h-6 w-6 items-center justify-center text-gray-400 transition-colors hover:text-red-400"
                                          whileHover={{ scale: 1.02 }}
                                          whileTap={{ scale: 0.98 }}
                                          transition={interactiveTransition}
                                          onPointerDown={(event) => {
                                            event.stopPropagation();
                                          }}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            removeSymbolFromWatchlist(symbol);
                                          }}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </motion.button>
                                      </div>
                                    </div>
                                  </li>
                                  )}
                                </Draggable>
                              );
                              })
                            )}
                            {provided.placeholder}
                          </ul>
                        )}
                      </Droppable>
                    </DragDropContext>
                  ) : (
                    <div className="min-h-full divide-y divide-white/[0.06]">
                      {portfolioPositions.length === 0 ? (
                        <div className="px-4 py-6 text-center text-white/50 text-sm">
                          No paper holdings yet. Execute a paper trade to populate this tab.
                        </div>
                      ) : (
                        portfolioPositions.map((position) => {
                          const isSelected = normalizeSymbol(selectedSymbol) === normalizeSymbol(position.symbol);
                          const pnlIsPositive = position.pnlPercent >= 0;
                          const isCryptoPosition = isCryptoPortfolioSymbol(position.symbol);

                          return (
                            <motion.button
                              key={`portfolio-position-${position.symbol}`}
                              type="button"
                              onClick={() => handleWatchlistSymbolSelect(position.symbol)}
                              onDoubleClick={() => openPortfolioPositionForTrade(position.symbol, position.companyName)}
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                              transition={interactiveTransition}
                              className={`w-full px-4 py-3 text-left transition-colors ${
                                isSelected ? 'bg-emerald-500/10 border-l border-l-emerald-500/30 shadow-[0_0_18px_rgba(16,185,129,0.1)]' : 'hover:bg-white/[0.06]'
                              }`}
                              title="Double-click to open order entry"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-[13px] font-semibold text-white">
                                    {formatPaperSymbol(position.symbol)}
                                  </div>
                                  <div className="truncate text-[11px] text-[#7c8087]">
                                    {position.companyName || position.symbol}
                                  </div>
                                  <div className="mt-1 text-[11px] text-[#c9ced6]">
                                    {formatPaperQuantity(position.quantity)} shares
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[12px] font-mono font-semibold text-white">
                                    {formatPaperCurrency(position.marketValue)}
                                  </div>
                                  {!isCryptoPosition ? (
                                    <div className={`text-[11px] font-semibold ${pnlIsPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                      {formatSignedPercent(position.pnlPercent)}
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </motion.button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
          {isWatchlistCollapsed && (
            <motion.ul
              variants={watchlistRowContainerMotion}
              initial="hidden"
              animate="show"
              className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-hide watchlist-scrollable px-1 py-2 space-y-1"
            >
              {watchlist.map((symbol) => {
                const quote = quotesBySymbol[symbol] || {};
                const changePercent = toNumber(quote?.changePercent) ?? 0;
                const valueLoading = quoteValueLoadingBySymbol[symbol] || createQuoteValueLoadingState();
                const isDayLoading = valueLoading.day === true;
                const isPositive = changePercent >= 0;
                const isSelected = normalizeSymbol(selectedSymbol) === normalizeSymbol(symbol);

                return (
                  <motion.li key={symbol} variants={watchlistRowItemMotion} className="list-none">
                    <motion.div
                      whileHover={{ x: 2, backgroundColor: 'rgba(255,255,255,0.04)' }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      onMouseEnter={() => setHoveredWatchlistSymbol(symbol)}
                      onMouseLeave={() => setHoveredWatchlistSymbol((current) => (current === symbol ? null : current))}
                      className={`rounded transition-colors ${
                        isSelected ? 'bg-emerald-500/10 border border-emerald-500/30' : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleWatchlistSymbolSelect(symbol)}
                        className="w-full py-2 px-1"
                      >
                        <div
                          className="text-white font-semibold text-[13px]"
                          style={{
                            fontVariationSettings: hoveredWatchlistSymbol === symbol ? '"wght" 650' : '"wght" 500',
                            transition: 'font-variation-settings 200ms ease',
                          }}
                        >
                          {symbol}
                        </div>
                        <div className="mt-0.5 flex items-center justify-center gap-1">
                          <PriceFlash
                            price={changePercent}
                            className={`text-[10px] font-mono font-semibold ${
                              isPositive ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {isPositive ? '+' : ''}
                            {changePercent.toFixed(1)}%
                          </PriceFlash>
                          {isDayLoading && (
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400/80 animate-pulse" title="Updating day change" />
                          )}
                        </div>
                        <div className="mt-1 flex justify-center">
                          <SentimentBadge
                            score={sentimentMap[symbol]?.sentiment}
                            totalDocs={sentimentMap[symbol]?.totalDocs}
                            compact={true}
                          />
                        </div>
                      </button>
                    </motion.div>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </aside>

        <section className="flex min-w-0 flex-1 min-h-0 overflow-hidden">
          <div className="flex min-w-0 min-h-0 flex-1 flex-col overflow-visible" style={chartPanelStyle}>
            <div className="shrink-0 border-b border-white/[0.06] bg-[#0b0b0b] px-4 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
                  <div className="flex items-center gap-1.5 shrink-0 relative">
                    <span className="text-[10px] uppercase tracking-wider text-gray-500 mr-0.5">Candles</span>
                    <div className="relative" ref={candlePaletteDropdownRef}>
                      <motion.button
                        type="button"
                        onClick={() => setCandlePaletteDropdownOpen((o) => !o)}
                        whileTap={{ scale: 0.96 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs transition-all duration-300 ${candlePaletteDropdownOpen ? 'border-white/20 bg-white/10 shadow-[0_2px_8px_rgba(0,0,0,0.3)]' : 'border-white/[0.06] bg-transparent hover:bg-white/[0.06] hover:shadow-[0_2px_8px_rgba(0,0,0,0.3)] text-gray-400 hover:text-gray-300'}`}
                        title="Candle color palette"
                      >
                        {(() => {
                          const pal = CANDLE_PALETTES.find((p) => p.id === candlePaletteId) || CANDLE_PALETTES[0];
                          return (
                            <>
                              <span className="w-3 h-3 rounded-[4px] flex-shrink-0 border border-white/10" style={{ backgroundColor: pal.up }} />
                              <span className="w-3 h-3 rounded-[4px] flex-shrink-0 border border-white/10" style={{ backgroundColor: pal.down }} />
                              <span className="max-w-[4rem] truncate">{pal.name}</span>
                              <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${candlePaletteDropdownOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
                            </>
                          );
                        })()}
                      </motion.button>
                      {candlePaletteDropdownOpen && candlePaletteDropdownPosition && createPortal(
                        <div
                          ref={candlePaletteDropdownPanelRef}
                          className="min-w-[7rem] rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-white/[0.02] py-1 backdrop-blur-2xl shadow-[0_24px_64px_rgba(0,0,0,0.6),0_8px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]"
                          style={{
                            position: 'fixed',
                            top: candlePaletteDropdownPosition.top,
                            left: candlePaletteDropdownPosition.left,
                            zIndex: 9999,
                          }}
                        >
                          {CANDLE_PALETTES.map((pal) => (
                            <button
                              key={pal.id}
                              type="button"
                              onClick={() => {
                                setCandlePaletteId(pal.id);
                                setCandlePaletteDropdownOpen(false);
                              }}
                              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-white/[0.08] ${candlePaletteId === pal.id ? 'bg-white/10 text-white' : 'text-gray-400'}`}
                            >
                              <span className="w-3 h-3 rounded-[4px] flex-shrink-0 border border-white/10" style={{ backgroundColor: pal.up }} />
                              <span className="w-3 h-3 rounded-[4px] flex-shrink-0 border border-white/10" style={{ backgroundColor: pal.down }} />
                              <span>{pal.name}</span>
                            </button>
                          ))}
                        </div>,
                        document.body
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {CHART_DISPLAY_OPTIONS.map((opt) => {
                      const isActive = chartDisplayMode === opt.id;
                      const Icon = opt.Icon;
                      return (
                        <motion.button
                          key={opt.id}
                          type="button"
                          onClick={() => setChartDisplayMode(opt.id)}
                          whileTap={{ scale: 0.96 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          className={`flex items-center justify-center rounded-lg border w-7 h-7 transition-all duration-300 ${isActive ? 'border-white/20 bg-white/10 text-white shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)]' : 'border-white/[0.06] bg-transparent text-gray-500 hover:bg-white/[0.06] hover:text-gray-300 hover:shadow-[0_2px_8px_rgba(0,0,0,0.3)]'}`}
                          title={opt.name}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                        </motion.button>
                      );
                    })}
                  </div>
                  <motion.button
                    type="button"
                    onClick={() => {
                      const next = !volumeProfileVisible;
                      setVolumeProfileVisible(next);
                      volumeProfileRef.current?.setVisible(next);
                    }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className={`flex flex-col items-center justify-center shrink-0 transition-colors ${volumeProfileVisible ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'}`}
                    title="Volume Profile"
                  >
                    <BarChart2 className={`h-4 w-4 shrink-0 ${volumeProfileVisible ? 'text-emerald-400' : ''}`} strokeWidth={1.5} />
                    <span className="text-[10px] mt-0.5">Vol Profile</span>
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => {
                      const next = !sessionHighlightVisible;
                      setSessionHighlightVisible(next);
                      sessionHighlightRef.current?.setVisible(next);
                    }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className={`flex flex-col items-center justify-center shrink-0 transition-colors ${sessionHighlightVisible ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'}`}
                    title="Session Highlighting"
                  >
                    <Clock className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                    <span className="text-[10px] mt-0.5">Sessions</span>
                  </motion.button>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <motion.button
                      type="button"
                      onClick={() => setAlertModalOpen(true)}
                      whileTap={{ scale: 0.96 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="flex flex-col items-center justify-center shrink-0 transition-colors text-gray-500 hover:text-white"
                      title="Create alert"
                    >
                      <span className="relative inline-flex items-center justify-center">
                        <AlarmClock className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                        <Plus className="absolute w-2.5 h-2.5 shrink-0" strokeWidth={2.5} style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
                      </span>
                      <span className="text-[10px] mt-0.5">Alert</span>
                    </motion.button>
                  </span>
                  <CreateAlertModal
                    open={alertModalOpen}
                    onClose={() => setAlertModalOpen(false)}
                    symbol={selectedSymbol}
                    defaultPrice={selectedMarketPrice ?? ''}
                    getAlerts={() => priceAlertsRef.current?.getAlerts() ?? []}
                    getAllAlerts={() => PriceAlertsPlugin.getAllAlertsFromStorage()}
                    onAlertToggle={(sym, price, direction, enabled) => {
                      PriceAlertsPlugin.setAlertEnabledInStorage(sym, price, direction, enabled);
                      if (selectedSymbol && String(sym).toUpperCase() === String(selectedSymbol).toUpperCase()) {
                        priceAlertsRef.current?.loadFromStorage?.();
                        setHasAlerts(priceAlertsRef.current?.getAlertCount() > 0);
                      }
                      window.dispatchEvent(new CustomEvent('stratify-chart-alerts-updated'));
                    }}
                    onCreate={(price, direction, hoursOrEod, options) => {
                      if (priceAlertsRef.current) {
                        priceAlertsRef.current.addAlert(price, direction, hoursOrEod, options);
                        setHasAlerts(true);
                        setAlertPopup({ message: `Alert set at $${Number(price).toFixed(2)} (${direction})`, variant: 'set' });
                        window.dispatchEvent(new CustomEvent('stratify-chart-alerts-updated'));
                      }
                    }}
                  />
                  <div className="relative shrink-0" ref={timeframeDropdownRef}>
                    <motion.button
                      type="button"
                      onClick={() => setTimeframeDropdownOpen((o) => !o)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      transition={interactiveTransition}
                      className={`flex h-7 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition-all duration-300 ${
                        timeframeDropdownOpen
                          ? 'border-emerald-400/60 text-emerald-400 bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.15),inset_0_1px_0_rgba(255,255,255,0.05)]'
                          : 'border-white/[0.06] text-gray-300 hover:bg-white/[0.06] hover:text-white hover:shadow-[0_2px_8px_rgba(0,0,0,0.3)]'
                      }`}
                      aria-expanded={timeframeDropdownOpen}
                    >
                      <span>{(CHART_TIMEFRAME_BY_ID[chartTimeframe] || CHART_TIMEFRAME_BY_ID[DEFAULT_CHART_TIMEFRAME])?.label ?? chartTimeframe}</span>
                      <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${timeframeDropdownOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
                    </motion.button>
                    {timeframeDropdownOpen && timeframeDropdownPosition && createPortal(
                      <div
                        ref={timeframeDropdownPanelRef}
                        className="min-w-[5rem] rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-white/[0.02] py-1 backdrop-blur-2xl shadow-[0_24px_64px_rgba(0,0,0,0.6),0_8px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]"
                        style={{
                          position: 'fixed',
                          top: timeframeDropdownPosition.top,
                          left: timeframeDropdownPosition.left,
                          zIndex: 9999,
                        }}
                      >
                        {CHART_TIMEFRAME_OPTIONS.map((tf) => (
                          <button
                            key={tf.id}
                            type="button"
                            onClick={() => {
                              setChartTimeframe(tf.id);
                              setTimeframeDropdownOpen(false);
                            }}
                            className={`flex w-full items-center justify-center px-3 py-1.5 text-[11px] font-medium transition-colors hover:bg-white/[0.08] ${chartTimeframe === tf.id ? 'bg-white/10 text-emerald-400' : 'text-gray-400'}`}
                          >
                            {tf.label}
                          </button>
                        ))}
                      </div>,
                      document.body
                    )}
                  </div>
                  <div className="relative shrink-0" ref={bgThemeDropdownRef}>
                    <motion.button
                      type="button"
                      onClick={() => setBgThemeDropdownOpen((o) => !o)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      transition={interactiveTransition}
                      className={`flex h-7 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition-all duration-300 ${
                        bgThemeDropdownOpen
                          ? 'border-emerald-400/60 text-emerald-400 bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.15),inset_0_1px_0_rgba(255,255,255,0.05)]'
                          : 'border-white/[0.06] text-gray-300 hover:bg-white/[0.06] hover:text-white hover:shadow-[0_2px_8px_rgba(0,0,0,0.3)]'
                      }`}
                      aria-expanded={bgThemeDropdownOpen}
                    >
                      <span className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: (CHART_BG_THEMES.find((t) => t.id === chartBgTheme) || CHART_BG_THEMES[0]).color }} />
                      <span>{(CHART_BG_THEMES.find((t) => t.id === chartBgTheme) || CHART_BG_THEMES[0]).label}</span>
                      <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${bgThemeDropdownOpen ? 'rotate-180' : ''}`} strokeWidth={2} />
                    </motion.button>
                    {bgThemeDropdownOpen && bgThemeDropdownPosition && createPortal(
                      <div
                        ref={bgThemeDropdownPanelRef}
                        className="min-w-[7rem] rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-white/[0.02] py-1 backdrop-blur-2xl shadow-[0_24px_64px_rgba(0,0,0,0.6),0_8px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]"
                        style={{
                          position: 'fixed',
                          top: bgThemeDropdownPosition.top,
                          left: bgThemeDropdownPosition.left,
                          zIndex: 9999,
                        }}
                      >
                        {CHART_BG_THEMES.map((theme) => (
                          <button
                            key={theme.id}
                            type="button"
                            onClick={() => {
                              setChartBgTheme(theme.id);
                              setBgThemeDropdownOpen(false);
                            }}
                            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-white/[0.08] ${chartBgTheme === theme.id ? 'bg-white/10 text-emerald-400' : 'text-gray-400'}`}
                          >
                            <span className="w-3 h-3 rounded-full flex-shrink-0 border border-white/20" style={{ backgroundColor: theme.color }} />
                            <span>{theme.label}</span>
                          </button>
                        ))}
                      </div>,
                      document.body
                    )}
                  </div>
                  <motion.button
                    type="button"
                    onClick={() => setShowHighLow((v) => !v)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={interactiveTransition}
                    className={`flex h-7 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition-all duration-300 ${
                      showHighLow
                        ? 'border-emerald-400/60 text-emerald-400 bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.15),inset_0_1px_0_rgba(255,255,255,0.05)]'
                        : 'border-white/[0.06] text-gray-300 hover:bg-white/[0.06] hover:text-white hover:shadow-[0_2px_8px_rgba(0,0,0,0.3)]'
                    }`}
                    title={showHighLow ? 'Hide High/Low lines' : 'Show High/Low lines'}
                  >
                    H/L
                  </motion.button>
                  {onYoloClick && (
                    <motion.button
                      type="button"
                      onClick={onYoloClick}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      transition={interactiveTransition}
                      className={`flex h-7 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold tracking-[0.15em] transition-all duration-300 ${
                        yoloActive
                          ? 'border-red-500/40 text-red-400 bg-red-500/10 shadow-[0_0_12px_rgba(239,68,68,0.15)]'
                          : 'border-white/[0.06] text-gray-500 hover:bg-white/[0.06] hover:text-gray-300 hover:shadow-[0_2px_8px_rgba(0,0,0,0.3)]'
                      }`}
                      title={yoloActive ? 'YOLO is active — click to stop' : 'Activate YOLO copy trading'}
                    >
                      {yoloActive ? 'YOLO ON' : 'YOLO'}
                    </motion.button>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <motion.button
                    type="button"
                    onClick={handleRefreshChart}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={interactiveTransition}
                    disabled={chartStatus.loading || !selectedSymbol}
                    className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition-all duration-300 ${
                      chartStatus.loading || !selectedSymbol
                        ? 'cursor-not-allowed border-white/[0.06] text-gray-500'
                        : 'border-white/[0.06] text-gray-300 hover:bg-white/[0.06] hover:text-white hover:shadow-[0_2px_8px_rgba(0,0,0,0.3)]'
                    }`}
                    title="Refresh chart and reset viewport"
                    aria-label="Refresh chart"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${chartStatus.loading ? 'animate-spin' : ''}`} strokeWidth={1.8} />
                    Refresh
                  </motion.button>
                </div>
              </div>
            </div>

            <div
              ref={chartAndNewsContainerRef}
              className="flex min-h-0 flex-1 flex-col"
              style={{ minHeight: 0 }}
            >
              {/* Chart — takes all remaining space above the news bar; z-0 so news bar stays on top and clickable in all browsers */}
              <div
                ref={chartViewportRef}
                className="relative z-0 min-h-0"
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  width: drawerArticle && isNewsOpen && isArticleDrawerExtendedToChartTop ? '50%' : '100%',
                  alignSelf: 'flex-start',
                  transition: 'width 220ms ease',
                }}
              >
                {alertPopup && (
                  <div
                    className="fixed left-1/2 top-[120px] z-[10000] -translate-x-1/2 pointer-events-none"
                    role="alert"
                  >
                    <div
                      className={`rounded-2xl px-5 py-3 shadow-xl border backdrop-blur-md min-w-[200px] text-center ${
                        alertPopup.variant === 'triggered'
                          ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
                          : 'bg-white/10 border-white/20 text-white'
                      }`}
                      style={{
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)',
                      }}
                    >
                      <div className="text-sm font-semibold">{alertPopup.message}</div>
                      {alertPopup.variant === 'triggered' && (
                        <div className="text-[10px] text-emerald-400/80 mt-0.5">Alert triggered</div>
                      )}
                    </div>
                    <div
                      className={`absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[10px] ${
                        alertPopup.variant === 'triggered' ? 'border-t-emerald-500/30' : 'border-t-white/10'
                      }`}
                    />
                  </div>
                )}
                <div className="flex gap-0 relative flex-1 min-w-0 min-h-0 h-full">
                  <DrawingToolbar
                    lineTools={lineToolsRef.current}
                    activeTool={activeTool}
                    onToolSelect={handleToolSelect}
                  />
                  <div ref={chartContainerRef} className="flex-1 min-w-0" />
                </div>

                {chartStatus.loading && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm text-sm text-gray-400">
                    <div className="rounded-xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.05)] px-4 py-2">
                      Loading candles...
                    </div>
                  </div>
                )}

                {!chartStatus.loading && chartStatus.error && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm px-6 text-center text-sm">
                    <div className="rounded-xl bg-gradient-to-br from-red-500/[0.1] to-red-900/[0.05] backdrop-blur-xl border border-red-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_16px_rgba(239,68,68,0.08)] px-4 py-2 text-red-200">
                      {chartStatus.error}
                    </div>
                  </div>
                )}
              </div>

              {/* News / Sportsbook toggle bar — same line: News left, Sportsbook right (above Live Lines); both open/toggle panel */}
              {!drawerArticle && (
              <div
                className="relative z-[420] flex h-9 shrink-0 items-center justify-between px-3 pointer-events-auto w-full border-t border-white/[0.06]"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  borderBottom: isNewsOpen ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}
              >
                <button
                  type="button"
                  onClick={toggleNewsPanelCollapsed}
                  className="flex items-center gap-2 transition-colors hover:bg-white/[0.03] cursor-pointer rounded py-1 px-1 -mx-1"
                >
                  <Newspaper className="w-3.5 h-3.5 text-white" strokeWidth={1.5} />
                  <span className="text-xs font-medium text-white">News</span>
                  <span className="text-xs text-gray-500 font-mono">
                    {selectedTicker ? `$${selectedTicker}` : ''}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={toggleNewsPanelCollapsed}
                  className="flex items-center gap-2 transition-colors hover:bg-white/[0.03] cursor-pointer rounded py-1 px-2"
                  aria-label="Open Sportsbook panel"
                >
                  <span className="text-xs font-medium text-white">Sportsbook</span>
                  <ChevronsDown
                    className="h-4 w-4 text-gray-500 transition-transform duration-300"
                    style={{ transform: isNewsOpen ? 'rotate(0deg)' : 'rotate(180deg)' }}
                    strokeWidth={1.7}
                  />
                </button>
              </div>
              )}

              {/* News panel — shrunk when no article; full height when article open */}
              <div
                className="relative z-20 shrink-0 isolate"
                style={{
                  height: isNewsOpen ? (drawerArticle ? 'min(520px, 50vh)' : isBottomPanelExpanded ? 'min(520px, 50vh)' : '200px') : '0px',
                  transition: 'height 0.35s ease',
                  pointerEvents: 'auto',
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    flexDirection: "row",
                    overflow: "hidden",
                    background: "transparent",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    borderTop: "1px solid rgba(255,255,255,0.04)",
                    width: "100%",
                    boxShadow: "none",
                  }}
                >
                  {/* Left: article list — fixed 50% width; same soft-glass look as Live Lines panel */}
                  <div
                    className="flex flex-col h-full min-h-0 overflow-hidden"
                    style={{
                      width: "50%",
                      flexShrink: 0,
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
                      backdropFilter: 'blur(8px)',
                      WebkitBackdropFilter: 'blur(8px)',
                      borderRight: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                  <ErrorBoundary><div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    {/* Scrollable article list — no duplicate header (ticker/News shown elsewhere) */}
                    <div
                      ref={newsListScrollRef}
                      className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-hide pointer-events-auto touch-pan-y px-3 pt-3 pb-3"
                      style={{
                        touchAction: 'pan-y',
                        flex: '1 1 0%',
                        minHeight: 0,
                        ...(isNewsOpen && !drawerArticle && !isBottomPanelExpanded ? { maxHeight: '184px' } : {}),
                      }}
                    >
                      {newsLoading && !newsArticles?.length ? (
                        <div className="flex items-center justify-center py-12 gap-2">
                          <div className="w-6 h-6 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                          <span className="text-xs text-gray-500">Loading news...</span>
                        </div>
                      ) : newsError ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-2">
                          <span className="text-xs text-red-400/80 text-center">Failed to load news</span>
                          <button type="button" onClick={() => refetchNews()} className="text-xs text-blue-400 hover:underline">Try again</button>
                        </div>
                      ) : !newsArticles?.length ? (
                        <div className="flex items-center justify-center py-8">
                          <span className="text-xs text-gray-500">No articles for ${selectedTicker || '—'}</span>
                        </div>
                      ) : (
                        <div className="divide-y divide-white/[0.06]">
                          {(newsArticles || []).map((article) => {
                            const score = article.sentiment ?? article.sentiment_score ?? null;
                            const timeAgo = newsTimeAgo(article.publishedAt ?? article.published_at);
                            const sourceLabel = newsSourceLabel(article.source);
                            const thumbUrl = article.image || article.imageUrl || article.image_url || null;
                            return (
                              <button
                                key={article.uuid || article.url || article.title}
                                type="button"
                                onClick={() => {
                                  setDrawerArticle(article);
                                  setRightPanelTab('article');
                                  setNewsArticleExpanded(true);
                                  setIsArticleOpen(true);
                                }}
                                className="w-full text-left group flex gap-3 py-3 hover:bg-white/[0.03] transition-colors cursor-pointer"
                              >
                                {thumbUrl ? (
                                  <img
                                    src={thumbUrl}
                                    alt=""
                                    className="w-14 h-14 rounded-lg object-cover flex-shrink-0 bg-white/5"
                                    loading="lazy"
                                    onError={(e) => { e.target.style.display = 'none'; }}
                                  />
                                ) : null}
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-medium text-white leading-snug group-hover:text-white break-words line-clamp-2">
                                    {article.title}
                                  </h4>
                                  <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                                    <span className="uppercase tracking-wide">{sourceLabel}</span>
                                    <span>·</span>
                                    <span>{timeAgo}</span>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div></ErrorBoundary>
                  </div>

                  {/* Right: article drawer — fixed 50%; fills height so article body can scroll */}
                  <div
                    style={{
                      width: "50%",
                      flexShrink: 0,
                      minWidth: 0,
                      position: "relative",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      height: "100%",
                    }}
                  >
                <AnimatePresence>
                  {drawerArticle ? (() => {
                    const articles = newsArticles || [];
                    const drawerKey = (a) => a?.uuid || a?.url || a?.title || '';
                    const currentIndex = articles.findIndex((a) => drawerKey(a) === drawerKey(drawerArticle));
                    const prevArticle = currentIndex > 0 ? articles[currentIndex - 1] : null;
                    const nextArticle = currentIndex >= 0 && currentIndex < articles.length - 1 ? articles[currentIndex + 1] : null;
                    const drawerUrl = String(drawerArticle?.url || '').trim();
                    const hydratedArticle = drawerUrl ? hydratedArticlesByUrl[drawerUrl] : null;
                    const drawerSource = newsSourceLabel(hydratedArticle?.source || drawerArticle.source);
                    const drawerPublishedAt = hydratedArticle?.publishedAt || drawerArticle.publishedAt || drawerArticle.published_at;
                    const drawerTitle = hydratedArticle?.title || drawerArticle.title;
                    const drawerImage = hydratedArticle?.image || drawerArticle.imageUrl || drawerArticle.image_url;
                    const drawerParagraphs = Array.isArray(hydratedArticle?.paragraphs)
                      ? hydratedArticle.paragraphs.filter(Boolean)
                      : [];
                    const drawerBody = String(
                      hydratedArticle?.content
                      || drawerArticle.description
                      || drawerArticle.content
                      || drawerArticle.snippet
                      || ''
                    ).trim();
                    const drawerError = drawerUrl ? articleHydrationErrorsByUrl[drawerUrl] : '';
                    const isHydrating = Boolean(drawerUrl && articleHydrationLoadingUrl === drawerUrl);
                    const effectiveChartHeight = chartViewportHeight || chartViewportRef.current?.getBoundingClientRect?.().height || 0;
                    const drawerTopOffset = isArticleDrawerExtendedToChartTop
                      ? -Math.max(0, effectiveChartHeight + 32)
                      : 0;
                    return (
                    <motion.div
                      key={drawerKey(drawerArticle)}
                      initial={{ x: 40, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: 40, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
                      style={{ position: "absolute", top: drawerTopOffset, right: 0, bottom: 0, left: 0, display: "flex", flexDirection: "column", overflow: "hidden", zIndex: 200, background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)", backdropFilter: "blur(24px)", borderLeft: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 8px 24px rgba(0,0,0,0.4)" }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", flex: "1 1 0%", minHeight: 0, overflow: "hidden" }}>
                        <div className="border-b border-white/[0.06] flex h-10 shrink-0 items-center justify-between gap-2 overflow-hidden px-3">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => setRightPanelTab('article')}
                              className={`relative text-xs font-medium px-3 py-1.5 cursor-pointer ${rightPanelTab === 'article' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                              aria-label="Article"
                            >
                              <Newspaper className="w-3.5 h-3.5 inline-block mr-1.5 align-middle" strokeWidth={1.5} />
                              <span>Article</span>
                              {rightPanelTab === 'article' && (
                                <motion.div layoutId="article-tab-indicator" className="absolute bottom-0 left-0 right-0 border-b-2 border-emerald-400" style={{ marginBottom: -1 }} />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setRightPanelTab('liveLines')}
                              className={`relative text-xs font-medium px-3 py-1.5 cursor-pointer ${rightPanelTab === 'liveLines' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                              aria-label="Live Lines"
                            >
                              <Activity className="w-3.5 h-3.5 inline-block mr-1.5 align-middle" strokeWidth={1.5} />
                              <span>Live Lines</span>
                              {rightPanelTab === 'liveLines' && (
                                <motion.div layoutId="article-tab-indicator" className="absolute bottom-0 left-0 right-0 border-b-2 border-emerald-400" style={{ marginBottom: -1 }} />
                              )}
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDrawerArticle(null); setNewsArticleExpanded(false); setIsArticleOpen(false); setIsArticleDrawerExtendedToChartTop(false); setIsBottomPanelExpanded(false); }}
                            className="p-2 rounded-md hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer shrink-0"
                            aria-label="Close"
                          >
                            <X className="w-5 h-5" strokeWidth={1.8} />
                          </button>
                        </div>
                        {rightPanelTab === 'article' ? (
                        <>
                        <div className="flex shrink-0 items-center justify-between gap-2 p-3 border-b border-white/[0.06]">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (prevArticle) setDrawerArticle(prevArticle); }}
                              disabled={!prevArticle}
                              className="p-2 rounded-md hover:bg-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                              aria-label="Previous article"
                            >
                              <ChevronLeft className="w-4 h-4" strokeWidth={1.8} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (nextArticle) setDrawerArticle(nextArticle); }}
                              disabled={!nextArticle}
                              className="p-2 rounded-md hover:bg-white/10 text-gray-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                              aria-label="Next article"
                            >
                              <ChevronRight className="w-4 h-4" strokeWidth={1.8} />
                            </button>
                            <span className="text-[11px] text-gray-500 ml-1">
                              {currentIndex >= 0 ? `${currentIndex + 1} / ${articles.length}` : '—'}
                            </span>
                          </div>
                        </div>
                        <div
                          ref={(el) => { if (el) articleBodyScrollRef.current = el; }}
                          style={{ flex: "1 1 0%", minHeight: 0, overflowY: "auto", overflowX: "hidden", padding: "0 16px 32px", fontSize: "15px", lineHeight: 1.8, touchAction: "pan-y", WebkitOverflowScrolling: "touch" }}
                        >
                          <p className="text-[11px] uppercase tracking-wide text-gray-500">
                            {drawerSource} · {newsTimeAgo(drawerPublishedAt)}
                          </p>
                          <h2 className="mt-1.5 text-white font-bold whitespace-normal break-words leading-tight" style={{ fontSize: '20px', overflowWrap: 'anywhere' }}>
                            {drawerTitle}
                          </h2>
                          {(() => {
                            const score = drawerArticle.sentiment ?? drawerArticle.sentiment_score ?? null;
                            if (score === null || score === undefined) return null;
                            const label = score >= 0.2 ? 'Bullish' : score <= -0.2 ? 'Bearish' : 'Neutral';
                            const colorClass = score >= 0.2 ? 'text-emerald-400' : score <= -0.2 ? 'text-red-400' : 'text-gray-400';
                            return <p className={`mt-2 text-sm ${colorClass}`}>{label}</p>;
                          })()}
                          {(() => {
                            const imgUrl = drawerImage;
                            if (!imgUrl || isGenericSourceImage(imgUrl)) return null;
                            return (
                              <img
                                src={imgUrl}
                                alt=""
                                className="mt-3 w-full rounded-lg object-cover max-h-[220px]"
                              />
                            );
                          })()}
                          {isHydrating && !drawerParagraphs.length && !drawerBody ? (
                            <div className="mt-4 flex items-center gap-2 text-sm text-gray-400">
                              <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                              Loading full article...
                            </div>
                          ) : null}
                          {drawerError ? (
                            <p className="mt-3 text-xs text-amber-300/80">{drawerError}</p>
                          ) : null}
                          {drawerParagraphs.length > 0 ? (
                            <div className="mt-4 space-y-4 text-gray-300 whitespace-pre-line break-words" style={{ fontSize: '15px', lineHeight: 1.8, overflowWrap: 'anywhere' }}>
                              {drawerParagraphs.map((paragraph, index) => (
                                <p key={`${drawerUrl || 'article'}-paragraph-${index}`}>{paragraph}</p>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-4 text-gray-300 whitespace-pre-line break-words" style={{ fontSize: '15px', lineHeight: 1.8, overflowWrap: 'anywhere' }}>
                              {drawerBody || 'No additional article text available for this source.'}
                            </div>
                          )}

                        </div>
                        </>
                        ) : (
                          <div style={{ flex: "1 1 0%", minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                            <LiveOddsPanel selectedGames={selectedGames} isArticleOpen={isArticleOpen} />
                          </div>
                        )}
                      </div>
                    </motion.div>
                    );
                  })() : null}
                </AnimatePresence>
                {!drawerArticle && (
                  <LiveOddsPanel
                    selectedGames={selectedGames}
                    isArticleOpen={isArticleOpen}
                    onLiveLinesExpand={() => setIsBottomPanelExpanded(true)}
                    onLiveLinesCollapse={() => setIsBottomPanelExpanded(false)}
                    isBottomPanelExpanded={isBottomPanelExpanded}
                  />
                )}
                  </div>
              </div>
            </div>
          </div>
          </div>

          <div
            className={`${isRightPanelCollapsed ? 'w-[42px]' : 'w-[296px]'} relative flex h-full min-h-0 shrink-0 flex-col overflow-hidden transition-all duration-200 z-10`}
            style={orderTicketStyle}
          >
            {isRightPanelCollapsed ? (
              <div className="flex h-full flex-col items-center gap-2 py-2">
                <motion.button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('Expand button clicked, current state:', isRightPanelCollapsed);
                    setIsRightPanelCollapsed(false);
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={interactiveTransition}
                  className="h-7 w-7 rounded-md text-xs font-bold transition-colors cursor-pointer hover:text-emerald-200 pointer-events-auto relative z-20"
                  style={{
                    color: 'rgba(110, 231, 183, 0.92)',
                    background: 'transparent',
                  }}
                  title="Expand order entry panel"
                  aria-label="Expand order entry panel"
                >
                  <ChevronsLeft className="mx-auto h-3.5 w-3.5 pointer-events-none animate-pulse drop-shadow-[0_0_10px_rgba(16,185,129,0.65)]" strokeWidth={1.7} />
                </motion.button>
                <div
                  className="text-[9px] font-bold uppercase tracking-[0.2em]"
                  style={{
                    color: 'rgba(110, 231, 183, 0.75)',
                    writingMode: 'vertical-rl',
                    textOrientation: 'mixed',
                  }}
                >
                  Order
                </div>
              </div>
            ) : (
              <>
                <div className="shrink-0 px-2.5 py-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-400">
                      Order Entry
                    </span>
                    <motion.button
                      type="button"
                      onClick={() => {
                        console.log('Collapse button clicked, current state:', isRightPanelCollapsed);
                        setIsRightPanelCollapsed(true);
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      transition={interactiveTransition}
                      className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-white/10 cursor-pointer text-emerald-400/70 hover:text-emerald-400"
                      title="Collapse order entry panel"
                      aria-label="Collapse order entry panel"
                    >
                      <ChevronsLeft className="h-4 w-4 text-emerald-300/70" strokeWidth={1.7} />
                    </motion.button>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-hide">
                  <TraderOrderEntry
                    selectedSymbol={selectedSymbol}
                    lastPrice={selectedMarketPrice}
                    tradingMode={resolvedTradingMode}
                    canUseLiveTrading={resolvedCanUseLiveTrading}
                    quotesBySymbol={quotesBySymbol}
                    totalGainLossDollar={paperTotalGainLoss?.dollar}
                    totalGainLossPercent={paperTotalGainLoss?.percent}
                    onSymbolChange={(symbolInput) => {
                      const normalized = normalizeSymbol(symbolInput);
                      if (!normalized) return;
                      const nextSymbol = watchlist.find((symbol) => normalizeSymbol(symbol) === normalized);
                      if (nextSymbol) {
                        handleWatchlistSymbolSelect(nextSymbol);
                      }
                    }}
                    onOrderPlaced={() => {
                      void fetchQuoteSnapshot();
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </section>
      </motion.div>
    </motion.div>
  );
}
