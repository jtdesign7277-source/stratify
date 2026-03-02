import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { createChart, CandlestickSeries, ColorType, HistogramSeries } from 'lightweight-charts';
import { ChevronsDown, ChevronsLeft, ChevronsRight, ChevronsUp, GripVertical, Pin, Plus, RefreshCw, Search, Trash2 } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { formatCurrency, formatPercent } from '../../lib/twelvedata';
import { getExtendedHoursStatus } from '../../lib/marketHours';
import OrderTicketPanel from './OrderTicketPanel';
import useTradingMode from '../../hooks/useTradingMode';
import { useSentiment } from '../../hooks/useMarketAux';
import { usePaperTrading } from '../../hooks/usePaperTrading';
import SentimentBadge from './SentimentBadge';
import NewsFeedPanel from './NewsFeedPanel';
import ErrorBoundary from '../shared/AppErrorBoundary';
import MiniGamePill from '../shared/MiniGamePill';

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
const NEWS_PANEL_HEIGHT_STORAGE_KEY = 'stratify-news-panel-height';
const NEWS_PANEL_COLLAPSED_STORAGE_KEY = 'stratify-news-panel-collapsed';
const PREVIOUS_CLOSE_CACHE_TTL_MS = 1000 * 60 * 60 * 48;
const DEFAULT_WATCHLIST = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'SPY'];
const MAX_SYMBOL_SEARCH_RESULTS = 50;
const MARKET_PRIORITY = ['NASDAQ', 'NYSE', 'LSE', 'ASX', 'TSE', 'CRYPTO', 'INDEX'];
const DEFAULT_ACTIVE_MARKET = 'us';
const DEFAULT_CHART_TIMEFRAME = '5M';
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
const NEWS_PANEL_DEFAULT_HEIGHT = 280;
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
const GLASS_SHELL_STYLE = {
  background: 'linear-gradient(150deg, rgba(14,20,34,0.9) 0%, rgba(6,10,20,0.82) 100%)',
  border: '1px solid rgba(148,163,184,0.16)',
  boxShadow: '0 18px 42px rgba(2,6,23,0.55), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 28px rgba(56,189,248,0.08)',
};
const GLASS_TOPBAR_STYLE = {
  background: 'linear-gradient(150deg, rgba(10,16,28,0.9) 0%, rgba(6,10,20,0.82) 100%)',
  borderBottom: '1px solid rgba(148,163,184,0.16)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 30px rgba(2,6,23,0.35)',
  backdropFilter: 'blur(16px)',
};
const GLASS_INSET_CARD_CLASS = 'rounded-lg border border-white/[0.12] bg-white/[0.035] px-2.5 py-2 text-[11px] backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_12px_24px_rgba(2,6,23,0.32)]';
const GLASS_INSET_INPUT_CLASS = 'h-[36px] w-full rounded-lg border border-white/[0.14] bg-[linear-gradient(150deg,rgba(15,23,42,0.72),rgba(6,10,20,0.7))] px-3 text-[13px] font-semibold text-white outline-none backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.05),inset_0_-1px_0_rgba(15,23,42,0.45)] transition-colors focus:border-cyan-400/55';

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
const VOLUME_UP = 'rgba(52, 211, 153, 0.3)';
const VOLUME_DOWN = 'rgba(239, 68, 68, 0.3)';
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

const loadInitialNewsPanelHeight = () => {
  if (typeof window === 'undefined') return NEWS_PANEL_DEFAULT_HEIGHT;
  try {
    const saved = Number(localStorage.getItem(NEWS_PANEL_HEIGHT_STORAGE_KEY));
    if (Number.isFinite(saved) && saved > 0) return Math.round(saved);
  } catch {}
  return NEWS_PANEL_DEFAULT_HEIGHT;
};

const loadInitialNewsPanelCollapsed = () => {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(NEWS_PANEL_COLLAPSED_STORAGE_KEY) === 'true';
  } catch {}
  return false;
};

function TraderOrderEntry({
  selectedSymbol,
  lastPrice,
  onSymbolChange,
  onOrderPlaced,
  tradingMode: _tradingMode = 'paper',
  canUseLiveTrading: _canUseLiveTrading = true,
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
  const recentTrades = useMemo(
    () => (Array.isArray(trades) ? trades.slice(0, 5) : []),
    [trades]
  );
  const holdings = useMemo(
    () => (Array.isArray(positions) ? positions.slice(0, 5) : []),
    [positions]
  );
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
  const selectedPositionSummary = hasSelectedPosition ? (
    <div className={GLASS_INSET_CARD_CLASS}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <div className="truncate text-slate-300">
            Position: {formatPaperQuantity(selectedPosition.quantity)} shares · Avg {formatPaperCurrency(selectedPosition.avg_cost_basis)}
          </div>
          <div className="truncate text-slate-400">
            Value: {formatPaperCurrency(selectedPositionValue)}
          </div>
          <div className={`truncate font-semibold ${selectedPositionPnlClass}`}>
            P&L: {formatSignedPaperCurrency(selectedPositionPnl)} ({selectedPositionPnlPercent > 0 ? '+' : ''}{selectedPositionPnlPercent.toFixed(2)}%)
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
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
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
                <label className="block text-[12px] font-semibold text-slate-300">Limit Price</label>
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
                <label className="block text-[12px] font-semibold text-slate-300">Stop Price</label>
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
                    className={`py-1 text-[12px] font-semibold transition-colors ${
                      trailType === 'dollars' ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-gray-500'
                    }`}
                  >
                    $
                  </button>
                  <button
                    type="button"
                    onClick={() => setTrailType('percent')}
                    className={`py-1 text-[12px] font-semibold transition-colors ${
                      trailType === 'percent' ? 'border-b-2 border-emerald-500 text-emerald-400' : 'text-gray-500'
                    }`}
                  >
                    %
                  </button>
                </div>
                <label className="block text-[12px] font-semibold text-slate-300">
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
              <div className="text-[12px] font-semibold text-slate-300">
                Est. Qty: {resolvedQuantity > 0 ? resolvedQuantity.toFixed(6) : '0.000000'} {selectedSymbol || '--'}
              </div>
            )}
            <div className="text-[11px] text-slate-400">
              Paper trades execute as market orders at the live quote.
            </div>
          </div>
        }
      />

      <div className="mt-1 min-h-0 flex-1 space-y-1.5 overflow-y-auto px-2 pb-2">
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

        <div className={GLASS_INSET_CARD_CLASS}>
          <div className="flex items-center justify-between">
            <span className="uppercase tracking-[0.12em] text-slate-400">Available Cash</span>
            <span className="font-semibold text-white">{buyingPowerDisplay}</span>
          </div>
        </div>

        <div className={GLASS_INSET_CARD_CLASS}>
          <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
            Holdings {holdings.length ? `(${holdings.length})` : '(0)'}
          </div>
          {holdings.length > 0 ? (
            <div className="mt-0.5 space-y-0.5">
              {holdings.map((position) => (
                <div key={`paper-holding-${position.symbol}`} className="flex items-center justify-between gap-2">
                  <span className="text-slate-300">
                    {formatPaperSymbol(position.symbol)} · {formatPaperQuantity(position.quantity)}
                  </span>
                  <span className={Number(position.pnl) >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                    {formatPaperCurrency(position.pnl)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className={GLASS_INSET_CARD_CLASS}>
          <div className="text-[10px] uppercase tracking-[0.12em] text-slate-500">
            Recent Trades {recentTrades.length ? `(${recentTrades.length})` : '(0)'}
          </div>
          {recentTrades.length > 0 ? (
            <div className="mt-0.5 space-y-0.5">
              {recentTrades.map((trade) => (
                <div key={`paper-trade-${trade.id}`} className="flex items-center justify-between gap-2">
                  <span className="text-slate-300">
                    {trade.side === 'buy' ? 'B' : 'S'} {formatPaperSymbol(trade.symbol)} {formatPaperQuantity(trade.quantity)}
                  </span>
                  <span className="text-slate-500">{formatPaperTimestamp(trade.created_at)}</span>
                </div>
              ))}
            </div>
          ) : null}
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
              className="w-[280px] space-y-4 rounded-2xl border border-white/8 shadow-2xl shadow-black/30 bg-[rgba(10,22,40,0.98)] p-5"
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
              className="w-[280px] space-y-4 rounded-2xl border border-white/8 bg-[rgba(10,22,40,0.98)] p-5 shadow-2xl shadow-black/30"
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
  const [chartTimeframe, setChartTimeframe] = useState(() => loadInitialChartTimeframe());
  const [activeMarket, setActiveMarket] = useState(() => loadInitialActiveMarket());
  const [isWatchlistCollapsed, setIsWatchlistCollapsed] = useState(() => loadInitialWatchlistCollapsed());
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(true);
  const [newsPanelHeight, setNewsPanelHeight] = useState(() => loadInitialNewsPanelHeight());
  const [isNewsPanelCollapsed, setIsNewsPanelCollapsed] = useState(() => loadInitialNewsPanelCollapsed());
  const [isResizingNewsPanel, setIsResizingNewsPanel] = useState(false);
  const [watchlistChangeDisplayModeBySymbol, setWatchlistChangeDisplayModeBySymbol] = useState({});
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
  const volumeSeriesRef = useRef(null);
  const lastBarRef = useRef(null);

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
  const dragPositionYRef = useRef(null);
  const dragPositionXRef = useRef(null);
  const chartAndNewsContainerRef = useRef(null);
  const newsPanelResizeStartYRef = useRef(0);
  const newsPanelResizeStartHeightRef = useRef(NEWS_PANEL_DEFAULT_HEIGHT);
  const newsPanelHeightRef = useRef(newsPanelHeight);
  const lastExpandedNewsPanelHeightRef = useRef(newsPanelHeight);
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
  const streamSubscriptionSymbols = useMemo(() => {
    const next = [...watchlistSymbols];
    if (isSearchDropdownOpen) {
      next.push(...searchResultSymbols);
    }
    return [...new Set(next)];
  }, [isSearchDropdownOpen, searchResultSymbols, watchlistSymbols]);
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
  const { portfolio: paperPortfolio } = usePaperTrading();
  const selectedTicker = selectedSymbol;
  const setSelectedTicker = setSelectedSymbol;
  const { sentimentMap } = useSentiment(watchlistSymbols);
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
  const clampNewsPanelHeight = useCallback((nextHeight, containerHeight) => {
    const safeContainerHeight = Number.isFinite(containerHeight) ? containerHeight : 0;
    const maxPanelHeight = Math.max(
      NEWS_PANEL_MIN_HEIGHT,
      Math.floor(safeContainerHeight - NEWS_PANEL_MIN_CHART_SPACE)
    );
    const clamped = Math.min(Math.max(nextHeight, NEWS_PANEL_MIN_HEIGHT), maxPanelHeight);
    return Math.round(clamped);
  }, []);

  useEffect(() => {
    newsPanelHeightRef.current = newsPanelHeight;
  }, [newsPanelHeight]);

  useEffect(() => {
    if (!isNewsPanelCollapsed) {
      lastExpandedNewsPanelHeightRef.current = newsPanelHeight;
    }
  }, [isNewsPanelCollapsed, newsPanelHeight]);

  const handleNewsPanelResizeStart = useCallback((event) => {
    if (isNewsPanelCollapsed) return;
    if (event.button !== 0) return;
    event.preventDefault();
    newsPanelResizeStartYRef.current = event.clientY;
    newsPanelResizeStartHeightRef.current = newsPanelHeight;
    setIsResizingNewsPanel(true);
  }, [isNewsPanelCollapsed, newsPanelHeight]);

  const toggleNewsPanelCollapsed = useCallback(() => {
    if (isNewsPanelCollapsed) {
      const containerHeight = chartAndNewsContainerRef.current?.getBoundingClientRect()?.height;
      const restoredHeight = clampNewsPanelHeight(lastExpandedNewsPanelHeightRef.current || NEWS_PANEL_DEFAULT_HEIGHT, containerHeight);
      setNewsPanelHeight(restoredHeight);
      newsPanelHeightRef.current = restoredHeight;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(NEWS_PANEL_HEIGHT_STORAGE_KEY, String(restoredHeight));
        } catch {}
      }
      setIsNewsPanelCollapsed(false);
      return;
    }

    lastExpandedNewsPanelHeightRef.current = newsPanelHeightRef.current || newsPanelHeight || NEWS_PANEL_DEFAULT_HEIGHT;
    setIsResizingNewsPanel(false);
    setIsNewsPanelCollapsed(true);
  }, [clampNewsPanelHeight, isNewsPanelCollapsed, newsPanelHeight]);

  useEffect(() => {
    if (!isResizingNewsPanel) return undefined;

    const handleMouseMove = (event) => {
      const containerHeight = chartAndNewsContainerRef.current?.getBoundingClientRect()?.height;
      if (!Number.isFinite(containerHeight) || containerHeight <= 0) return;

      const deltaY = event.clientY - newsPanelResizeStartYRef.current;
      const requestedHeight = newsPanelResizeStartHeightRef.current - deltaY;
      const nextHeight = clampNewsPanelHeight(requestedHeight, containerHeight);
      setNewsPanelHeight((previous) => (previous === nextHeight ? previous : nextHeight));
    };

    const handleMouseUp = () => {
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(NEWS_PANEL_HEIGHT_STORAGE_KEY, String(newsPanelHeightRef.current));
        } catch {}
      }
      setIsResizingNewsPanel(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [clampNewsPanelHeight, isResizingNewsPanel]);

  useEffect(() => {
    if (!chartAndNewsContainerRef.current || typeof ResizeObserver === 'undefined') return undefined;

    const container = chartAndNewsContainerRef.current;
    const syncHeightWithinBounds = () => {
      const containerHeight = container.getBoundingClientRect().height;
      if (!Number.isFinite(containerHeight) || containerHeight <= 0) return;
      setNewsPanelHeight((previous) => clampNewsPanelHeight(previous, containerHeight));
    };

    syncHeightWithinBounds();
    const observer = new ResizeObserver(() => {
      syncHeightWithinBounds();
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [clampNewsPanelHeight]);

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
    selectedSymbolRef.current = normalizeSymbol(selectedSymbol);
  }, [selectedSymbol]);

  useEffect(() => {
    chartTimeframeRef.current = chartTimeframe;
  }, [chartTimeframe]);

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
    localStorage.setItem(NEWS_PANEL_COLLAPSED_STORAGE_KEY, isNewsPanelCollapsed ? 'true' : 'false');
  }, [isNewsPanelCollapsed]);

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

    const timeScale = chart.timeScale();
    const handleVisibleRangeChange = () => {
      const visibleRange = timeScale.getVisibleRange();
      const symbol = selectedSymbolRef.current;
      if (visibleRange && symbol) {
        saveChartViewport(symbol, chartTimeframeRef.current, {
          from: visibleRange.from,
          to: visibleRange.to,
        });
      }
    };
    timeScale.subscribeVisibleTimeRangeChange(handleVisibleRangeChange);

    return () => {
      setChartReady(false);
      timeScale.unsubscribeVisibleTimeRangeChange(handleVisibleRangeChange);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      lastBarRef.current = null;
    };
  }, []);

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
  const pageBackgroundStyle = {
    background:
      'radial-gradient(circle at 12% 8%, rgba(34,197,94,0.08), transparent 36%), radial-gradient(circle at 86% 6%, rgba(56,189,248,0.08), transparent 34%), linear-gradient(180deg, #04070f 0%, #060b14 58%, #04070f 100%)',
  };
  const watchlistPanelStyle = {
    width: `${watchlistPanelWidth}px`,
    ...GLASS_SHELL_STYLE,
  };
  const chartPanelStyle = {
    ...GLASS_SHELL_STYLE,
  };
  const orderTicketStyle = {
    ...GLASS_SHELL_STYLE,
    boxShadow: '0 20px 44px rgba(2,6,23,0.56), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 26px rgba(16,185,129,0.1)',
  };

  return (
    <motion.div
      {...PAGE_TRANSITION}
      className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#060b14] text-[#e5e7eb]"
      style={pageBackgroundStyle}
    >
      <div className="pointer-events-none absolute inset-0 opacity-70" style={{ background: 'radial-gradient(circle at 50% 36%, rgba(14,165,233,0.07), transparent 46%)' }} />

      <div className="flex h-[68px] shrink-0 items-center justify-between px-4 py-3 backdrop-blur-xl" style={GLASS_TOPBAR_STYLE}>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenLiveScores}
            className={`relative h-8 flex items-center gap-2 pl-2.5 pr-3 rounded-full cursor-pointer transition-all ${
              isLiveScoresOpen
                ? 'border border-white/40 bg-white/10 shadow-[0_0_12px_rgba(255,255,255,0.1)]'
                : 'border border-white/20 bg-black/90 hover:border-white/40'
            }`}
            aria-label="Open live ESPN scores"
            title="Open live ESPN scores"
          >
            <div className="h-4 min-w-0 flex items-center justify-center">
              {espnLogoErrored ? (
                <span className="text-[11px] font-black italic tracking-tight text-[#E5252A]">ESPN</span>
              ) : (
                <img
                  src={ESPN_WORDMARK_URL}
                  alt="ESPN"
                  className="h-3 w-auto object-contain"
                  loading="lazy"
                  onError={() => setEspnLogoErrored(true)}
                />
              )}
            </div>
            <span className="text-white font-medium text-xs">Live</span>
          </button>
          <div className="flex items-center gap-1.5">
            {GAME_PILL_SLOTS.map((slot) => {
              const game = pinnedGames?.[slot] || null;
              const isDropActive = activeGameDropSlot === slot;
              return (
                <div
                  key={`trader-game-slot-${slot}`}
                  className={`relative h-8 rounded-full transition-all ${
                    game
                      ? 'border border-transparent'
                      : 'min-w-[72px] border border-dashed border-white/15 bg-white/[0.03]'
                  } ${
                    isDropActive ? 'ring-1 ring-emerald-400/75 border-emerald-400/60 bg-emerald-500/10' : ''
                  }`}
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
        <div className="flex items-center gap-4 text-right">
          <div>
            <h2 className="text-sm font-medium text-white">{selectedSymbol || 'Select a symbol'}</h2>
            <p className="mt-1 text-xs text-[#7c8087]">Candlestick chart · {selectedChartTimeframe.label}</p>
          </div>
          <div>
            <div className="flex items-center justify-end gap-1">
              <div className={`text-lg font-semibold tabular-nums ${selectedQuoteIsPlaceholder ? 'text-white/80' : 'text-white'}`}>
                {formatPrice(selectedQuote?.price)}
              </div>
              {selectedPriceLoading && (
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400/80 animate-pulse" title="Updating price" />
              )}
            </div>
            <div
              className={`flex items-center justify-end gap-1 text-xs font-medium tabular-nums ${
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

      <motion.div
        {...sectionMotion(0)}
        className="flex flex-1 min-h-0 gap-2 overflow-hidden p-2"
      >
        <aside
          className="flex h-full min-h-0 max-h-full shrink-0 flex-col overflow-hidden rounded-xl transition-[width] duration-200 ease-in-out backdrop-blur-xl"
          style={watchlistPanelStyle}
        >
          {isWatchlistCollapsed && (
            <div className="flex h-10 shrink-0 items-center justify-center border-b border-[#1f1f1f] px-1">
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
              <form onSubmit={addSymbol} className="shrink-0 border-b border-white/[0.09] px-4 py-3">
                <div className="mb-3 flex items-center justify-center gap-2">
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
                        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-[420px] overflow-y-auto rounded-xl border border-white/[0.14] bg-[rgba(10,16,30,0.93)] backdrop-blur-xl shadow-[0_16px_36px_rgba(2,6,23,0.5),0_0_18px_rgba(56,189,248,0.08)]">
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
              </form>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="flex shrink-0 items-center justify-between border-b border-white/[0.09] px-4 py-2 text-xs">
                  {watchlistView === 'watchlist' ? (
                    <>
                      <span className="text-[#9ca3af]">Stream: {streamLabel}</span>
                      {streamStatus.error ? (
                        <span className="text-red-400">{streamStatus.error}</span>
                      ) : (
                        <span className="text-emerald-400">{activeStreamSymbolCount} symbols</span>
                      )}
                    </>
                  ) : (
                    <>
                      <span className="text-[#9ca3af]">Paper Holdings</span>
                      <span className="text-emerald-400">{portfolioPositions.length} positions</span>
                    </>
                  )}
                </div>

                <div className="h-0 min-h-0 flex-1 overflow-y-auto watchlist-scrollable">
                  {watchlistView === 'watchlist' ? (
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
                              const secondarySession = quoteMarketOpen === true
                                ? 'live'
                                : extendedHoursStatus === 'pre-market'
                                  ? 'pre-market'
                                  : extendedHoursStatus === 'post-market'
                                    ? 'post-market'
                                    : 'live';
                              const usesExtendedMetric = secondarySession === 'pre-market' || secondarySession === 'post-market';
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
                              const isSelected = selectedSymbol === symbol;
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
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      className={`group relative flex items-center justify-between cursor-pointer transition-colors duration-150 border-b border-white/[0.05] ${
                                        isSelected ? 'bg-emerald-500/10 border-l border-l-emerald-500/30 shadow-[0_0_18px_rgba(16,185,129,0.1)]' : 'hover:bg-white/[0.06]'
                                      } px-3 py-2.5 ${
                                        snapshot.isDragging ? 'bg-[rgba(30,41,59,0.7)] shadow-lg ring-1 ring-emerald-500/40 opacity-50' : ''
                                      } ${
                                        isDropTarget ? 'border-t-2 border-[#58a6ff] bg-[#58a6ff]/10' : ''
                                      }`}
                                      style={getDragPreviewStyle(provided.draggableProps.style, snapshot.isDragging, symbol)}
                                      onClick={() => handleWatchlistSymbolSelect(symbol)}
                                    >
                                      <div
                                        {...provided.dragHandleProps}
                                        className={`mr-2 text-gray-600 hover:text-gray-400 ${
                                          snapshot.isDragging ? 'cursor-grabbing' : 'cursor-grab'
                                        }`}
                                      >
                                        <GripVertical className="w-4 h-4" />
                                      </div>

                                      <div className="flex-1 min-w-0 pr-2">
                                        <div className="flex items-center">
                                          <div className="text-[13px] font-semibold text-white">${symbol}</div>
                                          {(() => {
                                            if (!extendedHoursStatus) return null;
                                            return (
                                              <span
                                                className="ml-1.5 text-[10px]"
                                                title={extendedHoursStatus === 'pre-market' ? 'Pre-Market' : 'Post-Market'}
                                              >
                                                {extendedHoursStatus === 'pre-market' ? '☀️' : '🌙'}
                                              </span>
                                            );
                                          })()}
                                        </div>
                                        <div className="text-white/50 text-sm truncate">{companyName}</div>
                                      </div>

                                      <div className="ml-auto pr-1 text-right flex-shrink-0">
                                        <div className="flex items-center justify-end gap-1">
                                          <div className={`text-[12px] font-mono font-semibold ${isPlaceholder ? 'text-white/80' : 'text-white'}`}>
                                            {Number.isFinite(price) ? formatPrice(price) : '--'}
                                          </div>
                                          {isPriceLoading && (
                                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400/80 animate-pulse" title="Updating price" />
                                          )}
                                        </div>
                                        {Number.isFinite(price) && (
                                          <div className="flex flex-col items-end gap-1">
                                            <motion.button
                                              type="button"
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                toggleWatchlistChangeDisplayMode(symbol, 'day');
                                              }}
                                              whileHover={{ scale: 1.02 }}
                                              whileTap={{ scale: 0.98 }}
                                              transition={interactiveTransition}
                                              title={primaryMetricTitle}
                                              className={`text-xs font-semibold transition-opacity hover:opacity-80 ${
                                                getWatchlistChangeToneClass(secondaryReferenceChange)
                                              }`}
                                            >
                                              <span>{`${formatWatchlistChangeValue({
                                                mode: displayMode,
                                                percentValue: secondaryPercentChange,
                                                dollarValue: secondaryDollarChange,
                                              })}`}</span>
                                              {isPrimaryLoading && (
                                                <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse opacity-80" title="Updating day change" />
                                              )}
                                            </motion.button>
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
                  ) : (
                    <div className="min-h-full divide-y divide-white/[0.06]">
                      {portfolioPositions.length === 0 ? (
                        <div className="px-4 py-6 text-center text-white/50 text-sm">
                          No paper holdings yet. Execute a paper trade to populate this tab.
                        </div>
                      ) : (
                        portfolioPositions.map((position) => {
                          const isSelected = selectedSymbol === position.symbol;
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
            <div className="h-0 min-h-0 flex-1 overflow-y-auto watchlist-scrollable px-1 py-2 space-y-1">
              {watchlist.map((symbol, index) => {
                const quote = quotesBySymbol[symbol] || {};
                const changePercent = toNumber(quote?.changePercent) ?? 0;
                const valueLoading = quoteValueLoadingBySymbol[symbol] || createQuoteValueLoadingState();
                const isDayLoading = valueLoading.day === true;
                const isPositive = changePercent >= 0;
                const isSelected = selectedSymbol === symbol;

                return (
                  <motion.button
                    key={symbol}
                    onClick={() => handleWatchlistSymbolSelect(symbol)}
                    {...listItemMotion(index)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ ...listItemMotion(index).transition, ...interactiveTransition }}
                    className={`w-full py-2 px-1 rounded transition-colors ${
                      isSelected ? 'bg-emerald-500/10 border border-emerald-500/30' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="text-white font-semibold text-[13px]">{symbol}</div>
                    <div className="mt-0.5 flex items-center justify-center gap-1">
                      <div
                        className={`text-[10px] font-mono font-semibold ${
                          isPositive ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {isPositive ? '+' : ''}
                        {changePercent.toFixed(1)}%
                      </div>
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
                  </motion.button>
                );
              })}
            </div>
          )}
        </aside>

        <section className="flex flex-1 min-h-0 gap-2 overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl backdrop-blur-xl" style={chartPanelStyle}>
            <div className="shrink-0 border-b border-white/[0.09] px-4 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                  {CHART_TIMEFRAME_OPTIONS.map((timeframe) => {
                    const isActive = chartTimeframe === timeframe.id;
                    return (
                      <motion.button
                        key={timeframe.id}
                        type="button"
                        onClick={() => setChartTimeframe(timeframe.id)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        transition={interactiveTransition}
                        className={`h-7 shrink-0 border px-2.5 text-[11px] font-medium transition-colors ${
                          isActive
                            ? 'border-emerald-400 bg-emerald-500/10 text-emerald-400'
                            : 'border-white/[0.14] text-gray-300 hover:bg-white/[0.08] hover:text-white'
                        }`}
                        aria-pressed={isActive}
                      >
                        {timeframe.label}
                      </motion.button>
                    );
                  })}
                </div>
                <motion.button
                  type="button"
                  onClick={handleRefreshChart}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={interactiveTransition}
                  disabled={chartStatus.loading || !selectedSymbol}
                  className={`inline-flex h-7 shrink-0 items-center gap-1.5 border px-2.5 text-[11px] font-medium transition-colors ${
                    chartStatus.loading || !selectedSymbol
                      ? 'cursor-not-allowed border-white/[0.12] text-gray-500'
                      : 'border-white/[0.14] text-gray-300 hover:bg-white/[0.08] hover:text-white'
                  }`}
                  title="Refresh chart and reset viewport"
                  aria-label="Refresh chart"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${chartStatus.loading ? 'animate-spin' : ''}`} strokeWidth={1.8} />
                  Refresh
                </motion.button>
              </div>
            </div>

            <div ref={chartAndNewsContainerRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="relative flex-1 min-h-0 overflow-hidden">
                <div ref={chartContainerRef} className="h-full w-full" />

                {chartStatus.loading && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#060b14]/55 text-sm text-[#9ca3af]">
                    Loading candles...
                  </div>
                )}

                {!chartStatus.loading && chartStatus.error && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#060b14]/65 px-6 text-center text-sm text-[#9ca3af]">
                    {chartStatus.error}
                  </div>
                )}
              </div>

              <div
                role="separator"
                aria-orientation="horizontal"
                aria-label={isNewsPanelCollapsed ? 'Expand news panel' : 'Resize news panel'}
                onMouseDown={isNewsPanelCollapsed ? undefined : handleNewsPanelResizeStart}
                className={`relative flex h-[12px] shrink-0 items-center justify-center ${
                  isNewsPanelCollapsed ? '' : 'cursor-row-resize bg-white/[0.07] transition hover:bg-white/[0.12]'
                }`}
              >
                {!isNewsPanelCollapsed && (
                  <div className="flex items-center gap-1">
                    <span className="h-1 w-1 rounded-full bg-white/45" />
                    <span className="h-1 w-1 rounded-full bg-white/45" />
                    <span className="h-1 w-1 rounded-full bg-white/45" />
                  </div>
                )}

                <motion.button
                  type="button"
                  onMouseDown={(event) => {
                    event.stopPropagation();
                  }}
                  onClick={toggleNewsPanelCollapsed}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  transition={interactiveTransition}
                  className={`absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center transition-colors ${
                    isNewsPanelCollapsed
                      ? 'text-emerald-300 animate-pulse drop-shadow-[0_0_10px_rgba(16,185,129,0.65)]'
                      : 'text-emerald-300/70 hover:text-emerald-300'
                  }`}
                  title={isNewsPanelCollapsed ? 'Expand news panel' : 'Collapse news panel'}
                  aria-label={isNewsPanelCollapsed ? 'Expand news panel' : 'Collapse news panel'}
                >
                  {isNewsPanelCollapsed ? (
                    <ChevronsUp className="h-3.5 w-3.5" strokeWidth={1.7} />
                  ) : (
                    <ChevronsDown className="h-3.5 w-3.5" strokeWidth={1.7} />
                  )}
                </motion.button>
              </div>

              <div
                className="min-h-0 shrink-0 overflow-hidden transition-[height] duration-200"
                style={{ height: isNewsPanelCollapsed ? 0 : `${newsPanelHeight}px` }}
              >
                <div className="h-full overflow-y-auto">
                  <ErrorBoundary>
                    <NewsFeedPanel
                      selectedSymbol={selectedTicker}
                      onSymbolChange={setSelectedTicker}
                      className="h-full min-h-0 overflow-hidden"
                    />
                  </ErrorBoundary>
                </div>
              </div>
            </div>
          </div>

          <div
            className={`${isRightPanelCollapsed ? 'w-[42px]' : 'w-[296px]'} relative flex h-full min-h-0 shrink-0 flex-col overflow-hidden rounded-xl transition-all duration-200 z-10`}
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
                <div className="shrink-0 border-b border-white/[0.06] px-2.5 py-1.5">
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[10px] font-bold uppercase tracking-[0.16em]"
                      style={{ color: 'rgba(96, 165, 250, 0.85)' }}
                    >
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
                      className="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-white/10 cursor-pointer"
                      style={{ color: 'rgba(110, 231, 183, 0.65)' }}
                      title="Collapse order entry panel"
                      aria-label="Collapse order entry panel"
                    >
                      <ChevronsLeft className="h-4 w-4 text-emerald-300/70" strokeWidth={1.7} />
                    </motion.button>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-hidden">
                  <TraderOrderEntry
                    selectedSymbol={selectedSymbol}
                    lastPrice={selectedMarketPrice}
                    tradingMode={resolvedTradingMode}
                    canUseLiveTrading={resolvedCanUseLiveTrading}
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
