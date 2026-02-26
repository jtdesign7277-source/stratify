import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion';
import EmojiPicker, { EmojiGlyph } from './EmojiPicker';
import { subscribeTwelveDataQuotes, subscribeTwelveDataStatus } from '../../services/twelveDataWebSocket';
import { cachedFetch, createDebouncedFn } from '../../utils/apiCache';
import {
  Heart, MessageCircle, Share2, Send, X, TrendingUp, BarChart3, Bell, Zap,
  MoreHorizontal, Trash2, Loader2, Camera, SmilePlus, CalendarDays, Clock3,
  Copy, ExternalLink, ChevronDown, ChevronRight, Home, Flame, Newspaper, Globe,
  Compass, Users, Star, Search, ArrowUp, ArrowDown, PanelLeftClose, PanelRightClose, Sparkles,
  Plus,
  Hash, Activity, Trophy, Eye, EyeOff, GripVertical,
} from 'lucide-react';

// ─── Theme Constants ─────────────────────────────────────
const T = {
  bg: '#0d1117',
  card: '#151b23',
  hover: '#1c2333',
  border: 'rgba(255,255,255,0.06)',
  text: '#e6edf3',
  muted: '#7d8590',
  green: '#3fb950',
  red: '#f85149',
  blue: '#58a6ff',
};

const DEFAULT_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'BTC/USD', 'ETH/USD', 'SPY', 'QQQ'];
const INDEX_SYMBOLS = [
  { symbol: 'ES=F', label: 'S&P Futures', short: 'ES' },
  { symbol: 'NQ=F', label: 'NASDAQ', short: 'NQ' },
  { symbol: 'YM=F', label: 'Dow', short: 'YM' },
  { symbol: 'VIX', label: 'VIX', short: 'VIX' },
  { symbol: 'BTC/USD', label: 'Bitcoin', short: 'BTC' },
];
const AI_SEARCH_CLIENT_CACHE_TTL = 15 * 60 * 1000;
const AI_SEARCH_CLIENT_CACHE = new Map();
const AI_SEARCH_INFLIGHT = new Map();
const SEARCH_MODE_SUGGESTION_TEMPLATES = [
  'What is happening with {topic} today?',
  'Bitcoin price analysis this week',
  'Fed interest rate decision impact on tech stocks',
  'Best performing ETFs February 2026',
  '{topic} earnings expectations',
];

// ─── Helpers ──────────────────────────────────────────────
const timeAgo = (date) => {
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const extractTickers = (text) => {
  const matches = text.match(/\$[A-Z]{1,6}/g);
  return matches ? [...new Set(matches.map((t) => t.replace('$', '')))] : [];
};

const highlightTickers = (text) => {
  return text.replace(
    /\$([A-Z]{1,6})/g,
    '<span class="text-[#58a6ff] font-semibold cursor-pointer hover:underline">$$$1</span>'
  );
};

const normalizeAiSearchQuery = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const getClientAiSearchCached = (queryKey) => {
  const entry = AI_SEARCH_CLIENT_CACHE.get(queryKey);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    AI_SEARCH_CLIENT_CACHE.delete(queryKey);
    return null;
  }
  return entry.data;
};

const setClientAiSearchCached = (queryKey, data) => {
  AI_SEARCH_CLIENT_CACHE.set(queryKey, {
    data,
    expiresAt: Date.now() + AI_SEARCH_CLIENT_CACHE_TTL,
  });
};

const sanitizeAiSentiment = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'bullish' || normalized === 'bearish' || normalized === 'neutral') return normalized;
  return 'neutral';
};

const sanitizeAiSources = (rows = []) => {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      title: String(row?.title || row?.name || row?.url || '').trim(),
      url: String(row?.url || '').trim(),
    }))
    .filter((row) => /^https?:\/\//i.test(row.url))
    .filter((row) => {
      if (seen.has(row.url)) return false;
      seen.add(row.url);
      return true;
    })
    .slice(0, 8);
};

const sanitizeAiTickers = (rows = []) => {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : [])
    .map((row) => String(row || '').trim().replace(/^\$/, '').toUpperCase())
    .map((row) => row.replace(/[^A-Z0-9./=-]/g, '').slice(0, 14))
    .filter(Boolean)
    .filter((row) => {
      if (seen.has(row)) return false;
      seen.add(row);
      return true;
    })
    .slice(0, 8);
};

const sanitizeAiSearchData = (raw, query) => {
  const summary = String(raw?.summary || '').trim();
  const keyPoints = (Array.isArray(raw?.keyPoints) ? raw.keyPoints : [])
    .map((point) => String(point || '').trim())
    .filter(Boolean)
    .slice(0, 8);

  return {
    summary: summary || `No summary available for "${query}".`,
    keyPoints,
    sources: sanitizeAiSources(raw?.sources || []),
    relatedTickers: sanitizeAiTickers(raw?.relatedTickers || []),
    sentiment: sanitizeAiSentiment(raw?.sentiment),
  };
};

const makeSearchSuggestionTopic = (message) => {
  const fromTicker = String(message || '').match(/\$([A-Za-z]{1,6})/);
  if (fromTicker?.[1]) return fromTicker[1].toUpperCase();

  const trimmed = normalizeAiSearchQuery(message);
  if (!trimmed) return 'NVDA';
  if (trimmed.length > 18) return 'NVDA';

  const fallback = trimmed.replace(/[^A-Za-z0-9./=-]/g, '').slice(0, 14);
  return fallback || 'NVDA';
};

const buildSearchModeSuggestions = (message = '') => {
  const topic = makeSearchSuggestionTopic(message);
  return SEARCH_MODE_SUGGESTION_TEMPLATES.map((template, idx) => ({
    id: `search-suggestion-${idx}`,
    text: template.replaceAll('{topic}', topic),
  }));
};

const POST_TYPE_CONFIG = {
  post: { label: null, icon: null, color: null },
  pnl_share: { label: 'P&L', icon: TrendingUp, color: 'emerald' },
  strategy_share: { label: 'Strategy', icon: Zap, color: 'cyan' },
  alert_share: { label: 'Alert', icon: Bell, color: 'amber' },
  trade_share: { label: 'Trade', icon: BarChart3, color: 'blue' },
};

const buildReactionSummary = (rows = [], currentUserId = null) => {
  const grouped = rows.reduce((acc, row) => {
    const emoji = row?.emoji;
    if (!emoji) return acc;
    if (!acc[emoji]) acc[emoji] = { emoji, count: 0, reacted: false };
    acc[emoji].count += 1;
    if (currentUserId && row.user_id === currentUserId) acc[emoji].reacted = true;
    return acc;
  }, {});
  return Object.values(grouped).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.emoji.localeCompare(b.emoji);
  });
};

const applyReactionState = (currentReactions = [], emoji, shouldReact) => {
  let changed = false;
  const next = currentReactions
    .map((reaction) => {
      if (reaction.emoji !== emoji) return reaction;
      changed = true;
      const nextCount = Math.max(0, (reaction.count || 0) + (shouldReact ? 1 : -1));
      if (nextCount === 0) return null;
      return { ...reaction, count: nextCount, reacted: shouldReact };
    })
    .filter(Boolean);
  if (!changed && shouldReact) next.push({ emoji, count: 1, reacted: true });
  return next.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.emoji.localeCompare(b.emoji);
  });
};

const sortByCreatedAtAsc = (rows = []) =>
  [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toMaybeFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatCurrency = (value) => `$${Math.abs(toFiniteNumber(value)).toLocaleString('en-US', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
})}`;

const formatSignedCurrency = (value) => `${toFiniteNumber(value) >= 0 ? '+' : '-'}${formatCurrency(value)}`;

const formatSignedPercent = (value, digits = 2) => {
  const amount = toFiniteNumber(value);
  return `${amount >= 0 ? '+' : ''}${amount.toFixed(digits)}%`;
};

const formatDateTime = (value) => {
  const timestamp = Number.isFinite(value) ? value : Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '\u2014';
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
};

const formatPrice = (value) => {
  const n = toFiniteNumber(value);
  if (n === 0) return '--';
  if (n >= 1000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
};

const normalizeTradeForSlip = (rawTrade) => {
  if (!rawTrade || typeof rawTrade !== 'object') return null;
  const symbol = String(rawTrade.symbol ?? rawTrade.ticker ?? '').trim().toUpperCase();
  if (!symbol) return null;
  const shares = Math.abs(toFiniteNumber(rawTrade.shares ?? rawTrade.qty ?? rawTrade.quantity ?? rawTrade.size ?? rawTrade.amount));
  const price = toFiniteNumber(rawTrade.price ?? rawTrade.fillPrice ?? rawTrade.avgPrice ?? rawTrade.executionPrice ?? rawTrade.cost ?? rawTrade.limitPrice);
  if (shares <= 0 || price <= 0) return null;
  const sideRaw = String(rawTrade.side ?? rawTrade.type ?? rawTrade.action ?? '').trim().toLowerCase();
  const side = sideRaw.includes('sell') || sideRaw.includes('short') || sideRaw.includes('close') ? 'sell' : 'buy';
  const timestamp = Number.isFinite(rawTrade.timestamp)
    ? rawTrade.timestamp
    : Date.parse(rawTrade.timestamp ?? rawTrade.time ?? rawTrade.date ?? rawTrade.created_at);
  if (!Number.isFinite(timestamp)) return null;
  return { id: String(rawTrade.id ?? `${symbol}-${side}-${timestamp}-${shares}`).trim(), symbol, side, shares, price, timestamp };
};

const buildClosedTradesForSlip = (tradeHistory = []) => {
  const normalized = (Array.isArray(tradeHistory) ? tradeHistory : []).map(normalizeTradeForSlip).filter(Boolean).sort((a, b) => a.timestamp - b.timestamp);
  const lotsBySymbol = new Map();
  const closedTrades = [];
  normalized.forEach((trade) => {
    if (!lotsBySymbol.has(trade.symbol)) lotsBySymbol.set(trade.symbol, []);
    const lots = lotsBySymbol.get(trade.symbol);
    if (trade.side === 'buy') { lots.push({ shares: trade.shares, price: trade.price, timestamp: trade.timestamp }); return; }
    let remaining = trade.shares;
    let matchedShares = 0;
    let totalEntryValue = 0;
    let openedAt = null;
    while (remaining > 0 && lots.length > 0) {
      const lot = lots[0];
      const sharesToMatch = Math.min(remaining, lot.shares);
      if (sharesToMatch <= 0) break;
      matchedShares += sharesToMatch;
      totalEntryValue += sharesToMatch * lot.price;
      openedAt = openedAt === null ? lot.timestamp : Math.min(openedAt, lot.timestamp);
      lot.shares -= sharesToMatch;
      remaining -= sharesToMatch;
      if (lot.shares <= 0) lots.shift();
    }
    if (matchedShares <= 0 || totalEntryValue <= 0) return;
    const exitValue = matchedShares * trade.price;
    const pnl = exitValue - totalEntryValue;
    const percent = (pnl / totalEntryValue) * 100;
    closedTrades.push({ id: `${trade.symbol}-${trade.timestamp}-${closedTrades.length}`, symbol: trade.symbol, shares: matchedShares, entryPrice: totalEntryValue / matchedShares, exitPrice: trade.price, pnl, percent, openedAt, closedAt: trade.timestamp });
  });
  return closedTrades.sort((a, b) => b.closedAt - a.closedAt);
};

const createSlipCaption = ({ trade, emojis = [], note = '' }) => {
  if (!trade) return '';
  const emojiPrefix = Array.isArray(emojis) && emojis.length > 0 ? `${emojis.join('')} ` : '';
  const lines = [];
  if (note?.trim()) lines.push(note.trim());
  lines.push(`${emojiPrefix}$${trade.symbol} ${formatSignedPercent(trade.percent)} \u2022 ${formatSignedCurrency(trade.pnl)}`);
  lines.push(`In ${formatCurrency(trade.entryPrice)} \u2192 Out ${formatCurrency(trade.exitPrice)} \u2022 ${trade.shares.toLocaleString('en-US', { maximumFractionDigits: 4 })} sh`);
  lines.push(`Opened ${formatDateTime(trade.openedAt)} \u2022 Closed ${formatDateTime(trade.closedAt)}`);
  lines.push('#StratifyPnl');
  return lines.join('\n');
};

const normalizePnlShareSnapshot = (post) => {
  const pnl = toMaybeFiniteNumber(post?.metadata?.pnl);
  if (pnl === null) return null;
  const percentRaw = toMaybeFiniteNumber(post?.metadata?.percent);
  const ticker = String(post?.metadata?.ticker || '').trim().toUpperCase();
  const author = post?.profiles?.display_name || post?.author_name || post?.metadata?.display_name || post?.metadata?.author_name || post?.metadata?.username || 'Trader';
  return {
    id: String(post?.id || '').trim() || `${ticker || 'TRADE'}-${post?.created_at || Date.now()}`,
    ticker: ticker || 'TRADE', pnl, percent: percentRaw, author, createdAt: post?.created_at || null,
    entryPrice: toMaybeFiniteNumber(post?.metadata?.entry_price ?? post?.metadata?.entryPrice),
    exitPrice: toMaybeFiniteNumber(post?.metadata?.exit_price ?? post?.metadata?.exitPrice),
    shares: toMaybeFiniteNumber(post?.metadata?.shares ?? post?.metadata?.qty ?? post?.metadata?.quantity),
    openedAt: post?.metadata?.opened_at ?? post?.metadata?.openedAt ?? null,
    closedAt: post?.metadata?.closed_at ?? post?.metadata?.closedAt ?? post?.created_at ?? null,
    note: String(post?.metadata?.note || '').trim(),
  };
};

const TRENDING_BATCH_SIZE = 4;
const TRENDING_ROTATE_MS = 5000;
const TRENDING_SUMMARY_EVERY_MS = 30000;
const TRENDING_SUMMARY_DURATION_MS = 10000;
const TRENDING_FLASH_MS = 1200;
const TRENDING_MAX_ROWS = 140;
const SIDEBAR_ORDER_STORAGE_KEY = 'stratify-community-sidebar-order';
const SIDEBAR_VISIBILITY_STORAGE_KEY = 'stratify-community-sidebar-visibility';
const WATCHLIST_STORAGE_KEY = 'stratify-community-watchlist';
const TODAYS_NEWS_REFRESH_MS = 10 * 60 * 1000;
const TODAYS_NEWS_CLIENT_CACHE_MS = 20 * 1000;
const TODAYS_NEWS_MAX_ROWS = 8;
const DEFAULT_SIDEBAR_SECTION_ORDER = ['market-pulse', 'market-movers', 'trending', 'todays-news', 'watchlist'];
const LEGACY_SIDEBAR_SECTION_ID_MAP = {
  'watch-movers': 'market-movers',
  'trending-slips': 'trending',
};
const SIDEBAR_SECTION_ID_SET = new Set(DEFAULT_SIDEBAR_SECTION_ORDER);
const SIDEBAR_SECTION_LABELS = {
  'market-pulse': 'Market Pulse',
  'market-movers': 'Market Movers',
  trending: 'Trending',
  'todays-news': 'Today\'s News',
  watchlist: 'Watchlist',
};
const WATCHLIST_MAX_ROWS = 24;
const WATCHLIST_SEARCH_LIMIT = 10;
const TODAYS_NEWS_SOURCE_COLORS = ['#58a6ff', '#3fb950', '#f778ba', '#d29922', '#a371f7', '#f85149', '#79c0ff'];

const normalizeSidebarSectionId = (value) => (
  LEGACY_SIDEBAR_SECTION_ID_MAP[String(value || '')] || String(value || '')
);

const normalizeSidebarSectionOrder = (rawOrder = []) => {
  const seen = new Set();
  const normalized = [];

  (Array.isArray(rawOrder) ? rawOrder : []).forEach((value) => {
    const id = normalizeSidebarSectionId(value);
    if (!SIDEBAR_SECTION_ID_SET.has(id) || seen.has(id)) return;
    seen.add(id);
    normalized.push(id);
  });

  DEFAULT_SIDEBAR_SECTION_ORDER.forEach((id) => {
    if (!seen.has(id)) normalized.push(id);
  });

  return normalized;
};

const normalizeSidebarSectionVisibility = (rawVisibility = {}) => (
  DEFAULT_SIDEBAR_SECTION_ORDER.reduce((acc, sectionId) => {
    const legacySectionId = Object.entries(LEGACY_SIDEBAR_SECTION_ID_MAP)
      .find(([, mapped]) => mapped === sectionId)?.[0];

    const nextValue = rawVisibility && typeof rawVisibility === 'object'
      ? rawVisibility[sectionId]
      : undefined;
    const legacyValue = rawVisibility && typeof rawVisibility === 'object' && legacySectionId
      ? rawVisibility[legacySectionId]
      : undefined;

    if (nextValue !== undefined) {
      acc[sectionId] = Boolean(nextValue);
      return acc;
    }

    if (legacyValue !== undefined) {
      acc[sectionId] = Boolean(legacyValue);
      return acc;
    }

    acc[sectionId] = true;
    return acc;
  }, {})
);

const normalizeTodaysNewsCategory = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'markets' || raw === 'market') return 'Markets';
  if (raw === 'crypto') return 'Crypto';
  if (raw === 'politics' || raw === 'policy') return 'Politics';
  if (raw === 'earnings') return 'Earnings';
  return 'News';
};

const normalizeTodaysNewsPostCount = (value) => {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return `${Math.round(value).toLocaleString('en-US')} posts`;
  }

  const raw = String(value || '').trim();
  if (!raw) return '0 posts';
  if (/\bposts?\b/i.test(raw)) return raw;

  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return raw;

  const parsed = Number(digits);
  if (!Number.isFinite(parsed)) return raw;
  return `${parsed.toLocaleString('en-US')} posts`;
};

const normalizeTodaysNewsSources = (rows = []) => {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : [])
    .map((row) => String(row?.name || row || '').trim())
    .filter(Boolean)
    .filter((name) => {
      const key = name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4)
    .map((name, idx) => ({
      name,
      initial: name.charAt(0).toUpperCase() || '?',
      color: TODAYS_NEWS_SOURCE_COLORS[idx % TODAYS_NEWS_SOURCE_COLORS.length],
    }));
};

const normalizeTodaysNewsRows = (payload) => {
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.data)
        ? payload.data
        : [];

  const deduped = new Map();
  rows.forEach((row, idx) => {
    if (!row || typeof row !== 'object') return;
    const headline = String(row?.headline || row?.title || '').replace(/\s+/g, ' ').trim();
    if (!headline) return;

    const key = headline.toLowerCase();
    if (deduped.has(key)) return;

    deduped.set(key, {
      id: String(row?.id || `todays-news-${idx}-${headline.slice(0, 24)}`).trim(),
      headline,
      sources: normalizeTodaysNewsSources(row?.sources || row?.sourceNames || row?.source_names || []),
      category: normalizeTodaysNewsCategory(row?.category),
      postCount: normalizeTodaysNewsPostCount(row?.postCount ?? row?.post_count ?? row?.posts),
      summary: String(row?.summary || '').trim(),
      trendingLabel: String(row?.trendingLabel || row?.trending_label || 'Trending now').trim() || 'Trending now',
      url: /^https?:\/\//i.test(String(row?.url || row?.link || '').trim())
        ? String(row?.url || row?.link || '').trim()
        : '',
    });
  });

  return [...deduped.values()].slice(0, TODAYS_NEWS_MAX_ROWS);
};

const formatUpdatedMinutesAgo = (value, now = Date.now()) => {
  const timestamp = Number.isFinite(value) ? value : Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 'Updated just now';
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60000));
  return minutes <= 0 ? 'Updated just now' : `Updated ${minutes} min ago`;
};

const normalizeTrendingSnapshotPayload = (row) => {
  if (!row || typeof row !== 'object') return null;
  const pnl = toMaybeFiniteNumber(row?.pnl);
  if (pnl === null) return null;

  const ticker = String(row?.ticker || row?.symbol || '').trim().toUpperCase() || 'TRADE';
  const author = String(
    row?.author
      || row?.username
      || row?.display_name
      || row?.author_name
      || row?.metadata?.display_name
      || row?.metadata?.author_name
      || row?.metadata?.username
      || 'Trader'
  ).trim() || 'Trader';

  return {
    id: String(row?.id || `${ticker}-${row?.createdAt || row?.created_at || Date.now()}`).trim(),
    ticker,
    pnl,
    percent: toMaybeFiniteNumber(row?.percent),
    author,
    createdAt: row?.createdAt ?? row?.created_at ?? null,
    entryPrice: toMaybeFiniteNumber(row?.entryPrice ?? row?.entry_price),
    exitPrice: toMaybeFiniteNumber(row?.exitPrice ?? row?.exit_price),
    shares: toMaybeFiniteNumber(row?.shares ?? row?.qty ?? row?.quantity),
    openedAt: row?.openedAt ?? row?.opened_at ?? null,
    closedAt: row?.closedAt ?? row?.closed_at ?? row?.createdAt ?? row?.created_at ?? null,
    note: String(row?.note || '').trim(),
  };
};

const sanitizeTrendingSnapshots = (rows = []) => {
  const deduped = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const snapshot = normalizeTrendingSnapshotPayload(row);
    if (!snapshot?.id) return;
    deduped.set(String(snapshot.id), snapshot);
  });
  return [...deduped.values()];
};

const getSnapshotTimestamp = (snapshot) => {
  const candidates = [snapshot?.closedAt, snapshot?.createdAt, snapshot?.openedAt];
  for (const value of candidates) {
    if (Number.isFinite(value)) return value;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const isSameCalendarDay = (leftTimestamp, rightTimestamp) => {
  if (!Number.isFinite(leftTimestamp) || !Number.isFinite(rightTimestamp)) return false;
  const left = new Date(leftTimestamp);
  const right = new Date(rightTimestamp);
  return (
    left.getUTCFullYear() === right.getUTCFullYear()
    && left.getUTCMonth() === right.getUTCMonth()
    && left.getUTCDate() === right.getUTCDate()
  );
};

const isSnapshotFromToday = (snapshot, referenceTimestamp = Date.now()) => (
  isSameCalendarDay(getSnapshotTimestamp(snapshot), referenceTimestamp)
);

const sortSnapshotsByNewest = (rows = []) => (
  [...rows].sort((a, b) => getSnapshotTimestamp(b) - getSnapshotTimestamp(a))
);

const getTopWinningSnapshots = (rows = [], limit = 8) => (
  [...rows]
    .filter((item) => toFiniteNumber(item?.pnl) > 0)
    .sort((a, b) => toFiniteNumber(b?.pnl) - toFiniteNumber(a?.pnl))
    .slice(0, limit)
);

const getTopLosingSnapshots = (rows = [], limit = 8) => (
  [...rows]
    .filter((item) => toFiniteNumber(item?.pnl) < 0)
    .sort((a, b) => toFiniteNumber(a?.pnl) - toFiniteNumber(b?.pnl))
    .slice(0, limit)
);

const shareToX = (post) => {
  let text = post.content;
  const pnlValue = Number(post?.metadata?.pnl);
  if (post.post_type === 'pnl_share' && Number.isFinite(pnlValue)) {
    const ticker = post?.metadata?.ticker ? `$${post.metadata.ticker}` : 'my trade';
    text = `${ticker} ${formatSignedCurrency(pnlValue)}${Number.isFinite(Number(post?.metadata?.percent)) ? ` (${formatSignedPercent(Number(post.metadata.percent))})` : ''}\n\n${post.content}`;
  }
  text += '\n\nPowered by @StratifyTrading';
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank', 'width=550,height=420');
};

// ─── Shimmer Skeleton ─────────────────────────────────────
const ShimmerLine = ({ w = '100%', h = 14, rounded = 6, className = '' }) => (
  <div
    className={`relative overflow-hidden ${className}`}
    style={{ width: w, height: h, borderRadius: rounded, background: 'rgba(255,255,255,0.04)' }}
  >
    <div
      className="absolute inset-0"
      style={{
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)',
        animation: 'shimmer 1.6s ease-in-out infinite',
      }}
    />
  </div>
);

const ShimmerBlock = ({ lines = 3, className = '' }) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <ShimmerLine key={i} w={i === lines - 1 ? '60%' : '100%'} />
    ))}
  </div>
);

// ─── Avatar Component ─────────────────────────────────────
const UserAvatar = ({ user, size = 40, initialsClassName = '' }) => {
  const initials = (user?.display_name || user?.email || '?')
    .split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  const initialsStyle = initialsClassName ? undefined : { fontSize: size * 0.36 };

  if (user?.avatar_url) {
    return (
      <img src={user.avatar_url} alt={user.display_name || 'User'}
        className="rounded-full object-cover flex-shrink-0" style={{ width: size, height: size }} />
    );
  }

  const colors = [
    'from-cyan-500 to-blue-600', 'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600', 'from-purple-500 to-pink-600',
    'from-red-500 to-rose-600', 'from-indigo-500 to-violet-600',
  ];
  const colorIdx = (user?.id || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;

  return (
    <div className={`rounded-full bg-gradient-to-br ${colors[colorIdx]} flex items-center justify-center flex-shrink-0`}
      style={{ width: size, height: size }}>
      <span className={`text-white font-bold ${initialsClassName}`.trim()} style={initialsStyle}>{initials}</span>
    </div>
  );
};

// ─── Post Type Badge ──────────────────────────────────────
const PostTypeBadge = ({ type, metadata }) => {
  const config = POST_TYPE_CONFIG[type];
  if (!config?.label) return null;
  const Icon = config.icon;
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-${config.color}-500/10 text-${config.color}-400 border border-${config.color}-500/20`}>
      <Icon size={12} strokeWidth={1.5} />
      <span>{config.label}</span>
      {metadata?.pnl !== undefined && (
        <span className={metadata.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
          {metadata.pnl >= 0 ? '+' : ''}${Math.abs(metadata.pnl).toLocaleString()}
        </span>
      )}
    </div>
  );
};

// ─── P&L Card ─────────────────────────────────────────────
const PnLCard = ({ metadata }) => {
  const pnlValue = Number(metadata?.pnl);
  if (!Number.isFinite(pnlValue)) return null;
  const isPositive = pnlValue >= 0;
  const percentValue = Number(metadata?.percent);
  const hasPercent = Number.isFinite(percentValue);
  const entryPrice = Number(metadata?.entry_price ?? metadata?.entryPrice);
  const exitPrice = Number(metadata?.exit_price ?? metadata?.exitPrice);
  const openedAt = metadata?.opened_at ?? metadata?.openedAt;
  const closedAt = metadata?.closed_at ?? metadata?.closedAt;
  const shares = Number(metadata?.shares ?? metadata?.qty ?? metadata?.quantity);
  const hasShares = Number.isFinite(shares) && shares > 0;
  const rawEmoji = metadata?.emoji;
  const emojis = Array.isArray(rawEmoji) ? rawEmoji : (rawEmoji ? [rawEmoji] : []);

  return (
    <div className={`mt-3 rounded-xl border overflow-hidden ${isPositive ? 'border-emerald-500/30 bg-emerald-500/[0.06]' : 'border-red-500/30 bg-red-500/[0.06]'}`}>
      <div className="p-2 border-b border-white/5 flex items-center justify-between">
        <div className="text-xs tracking-[0.14em] uppercase text-gray-500">Stratify Bet Slip</div>
        {emojis.length > 0 && <div className="text-lg leading-none">{emojis.join(' ')}</div>}
      </div>
      <div className="p-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-gray-500">
              {metadata?.ticker ? `$${metadata.ticker}` : 'Portfolio'}
            </div>
            <div className={`text-lg font-semibold font-mono ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatSignedCurrency(pnlValue)}
            </div>
          </div>
          {hasPercent && (
            <div className={`text-lg font-semibold font-mono ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatSignedPercent(percentValue)}
            </div>
          )}
        </div>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-300">
          {Number.isFinite(entryPrice) && (
            <div className="rounded-lg border border-white/10 bg-black/20 p-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-gray-500 mb-1">Entry</div>
              <div className="font-mono">{formatCurrency(entryPrice)}</div>
            </div>
          )}
          {Number.isFinite(exitPrice) && (
            <div className="rounded-lg border border-white/10 bg-black/20 p-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-gray-500 mb-1">Exit</div>
              <div className="font-mono">{formatCurrency(exitPrice)}</div>
            </div>
          )}
          {openedAt && (
            <div className="rounded-lg border border-white/10 bg-black/20 p-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-gray-500 mb-1">Bought</div>
              <div>{formatDateTime(openedAt)}</div>
            </div>
          )}
          {closedAt && (
            <div className="rounded-lg border border-white/10 bg-black/20 p-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-gray-500 mb-1">Sold</div>
              <div>{formatDateTime(closedAt)}</div>
            </div>
          )}
          {hasShares && (
            <div className="rounded-lg border border-white/10 bg-black/20 p-2 sm:col-span-2">
              <div className="text-[10px] uppercase tracking-[0.14em] text-gray-500 mb-1">Size</div>
              <div className="font-mono">{shares.toLocaleString('en-US', { maximumFractionDigits: 4 })} shares</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── CONTINUE_MARKER_2: more sub-components below ─────────
const __CONTINUE_2__ = true;

const BASE_STREAM_STATUS = {
  connected: false,
  connecting: false,
  error: null,
  retryCount: 0,
};

const POST_TYPE_ORDER = ['all', 'post', 'pnl_share', 'strategy_share', 'trade_share', 'alert_share'];

const POST_TYPE_FILTERS = [
  { id: 'all', label: 'For You', icon: Home },
  { id: 'post', label: 'General', icon: Globe },
  { id: 'pnl_share', label: 'P&L', icon: TrendingUp },
  { id: 'strategy_share', label: 'Strategies', icon: Sparkles },
  { id: 'trade_share', label: 'Trades', icon: BarChart3 },
  { id: 'alert_share', label: 'Alerts', icon: Bell },
];

const LEFT_RAIL_ITEMS = [
  { id: 'home', label: 'Home Flow', icon: Home },
  { id: 'hot', label: 'Momentum', icon: Flame },
  { id: 'news', label: 'Catalysts', icon: Newspaper },
  { id: 'ideas', label: 'Setups', icon: Compass },
  { id: 'squads', label: 'Rooms', icon: Users },
  { id: 'saved', label: 'Saved', icon: Star },
];

const QUICK_TAGS = ['#open', '#swing', '#scalp', '#earnings', '#risk', '#macro'];

const MOCK_AUTHORS = [
  { id: 'u-1', name: 'Maya Chen', email: 'maya@stratify.community' },
  { id: 'u-2', name: 'Arjun Patel', email: 'arjun@stratify.community' },
  { id: 'u-3', name: 'Elena Rossi', email: 'elena@stratify.community' },
  { id: 'u-4', name: 'Noah Brooks', email: 'noah@stratify.community' },
  { id: 'u-5', name: 'Sofia Kim', email: 'sofia@stratify.community' },
  { id: 'u-6', name: 'Liam Park', email: 'liam@stratify.community' },
  { id: 'u-7', name: 'Jordan Lee', email: 'jordan@stratify.community' },
  { id: 'u-8', name: 'Priya Nair', email: 'priya@stratify.community' },
  { id: 'u-9', name: 'Diego Alvarez', email: 'diego@stratify.community' },
  { id: 'u-10', name: 'Omar Khan', email: 'omar@stratify.community' },
  { id: 'u-11', name: 'Ivy Bennett', email: 'ivy@stratify.community' },
  { id: 'u-12', name: 'Rina Sato', email: 'rina@stratify.community' },
];

const MOCK_BASE_SETUPS = [
  { symbol: 'NVDA', post_type: 'trade_share', note: 'Took the opening range reclaim and scaled into strength above prior day high.' },
  { symbol: 'AAPL', post_type: 'strategy_share', note: 'Running a simple pullback play: first touch of VWAP after extension.' },
  { symbol: 'TSLA', post_type: 'alert_share', note: 'Put alert at 5-minute trendline break. Watching for failed bounce into resistance.' },
  { symbol: 'MSFT', post_type: 'post', note: 'Institutional bid looked sticky all session. Not forcing entries into chop.' },
  { symbol: 'AMD', post_type: 'trade_share', note: 'Broke premarket high with volume expansion. Tight stop under trigger candle.' },
  { symbol: 'SPY', post_type: 'post', note: 'Breadth divergence while index prints highs. Staying selective on longs.' },
  { symbol: 'QQQ', post_type: 'strategy_share', note: 'Opening drive setup only if first pullback holds above opening print.' },
  { symbol: 'META', post_type: 'alert_share', note: 'Potential squeeze setup if call flow keeps hitting offer near highs.' },
  { symbol: 'AMZN', post_type: 'trade_share', note: 'Executed a continuation entry on one-minute consolidation breakout.' },
  { symbol: 'PLTR', post_type: 'post', note: 'Name is noisy but trend intact on higher timeframe. Waiting for cleaner R/R.' },
  { symbol: 'SMCI', post_type: 'alert_share', note: 'Halting risk elevated. Size down and respect volatility expansion.' },
  { symbol: 'GOOGL', post_type: 'strategy_share', note: 'Multi-day flag break candidate with clear invalidation below yesterday low.' },
  { symbol: 'NFLX', post_type: 'trade_share', note: 'Fade attempt failed. Reversed long once sellers could not push lower.' },
  { symbol: 'COIN', post_type: 'post', note: 'Crypto beta still leading growth. Correlation with BTC remains tight.' },
  { symbol: 'AVGO', post_type: 'trade_share', note: 'Impulse up leg followed by orderly base. Entered on expansion candle close.' },
  { symbol: 'INTC', post_type: 'strategy_share', note: 'Mean-reversion only if weak open flushes into major daily support.' },
  { symbol: 'SNOW', post_type: 'alert_share', note: 'Watching for relative strength flip against software basket.' },
  { symbol: 'CRM', post_type: 'post', note: 'Slow grind trend day. Let winners work and avoid over-trading midday.' },
];

const MOCK_REACTION_POOL = ['🔥', '🚀', '💯', '📈', '💰', '👀', '🐂', '🐻', '✅', '⚡'];

const FEED_VARIANTS = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const CARD_VARIANTS = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] } },
};

const MODAL_SPRING = {
  type: 'spring',
  stiffness: 280,
  damping: 24,
  mass: 0.9,
};

const COMMUNITY_PAGE_STYLES = `
  @keyframes shimmer {
    0% { transform: translateX(-120%); }
    100% { transform: translateX(120%); }
  }

  @keyframes communityPulse {
    0%, 100% { opacity: 0.18; transform: scale(1); }
    50% { opacity: 0.34; transform: scale(1.08); }
  }

  .community-pulse {
    animation: communityPulse 3.6s ease-in-out infinite;
  }
`;

const SLIP_EMOJI_PRESETS = ['🚀', '💰', '🔥', '📈', '💯', '✅', '⚡', '🧠'];

const normalizeSymbolKey = (value) => {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return '';
  if (raw.includes(':')) return raw.split(':').pop();
  return raw;
};

const normalizeWatchlistEntry = (row) => {
  const symbol = normalizeSymbolKey(row?.symbol || row?.ticker || row?.code);
  if (!symbol) return null;
  const name = String(
    row?.name || row?.instrumentName || row?.instrument_name || row?.company_name || row?.description || symbol
  ).trim() || symbol;
  return { symbol, name };
};

const normalizeWatchlistEntries = (rows = []) => {
  const deduped = [];
  const seen = new Set();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const entry = normalizeWatchlistEntry(row);
    if (!entry || seen.has(entry.symbol)) return;
    seen.add(entry.symbol);
    deduped.push(entry);
  });

  return deduped.slice(0, WATCHLIST_MAX_ROWS);
};

const normalizeWatchlistSearchResults = (payload) => {
  const rows = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.results)
      ? payload.results
      : Array.isArray(payload?.symbols)
        ? payload.symbols
        : Array.isArray(payload)
          ? payload
          : [];
  return normalizeWatchlistEntries(rows).slice(0, WATCHLIST_SEARCH_LIMIT);
};

const mergeQuotesFromPayload = (rows = [], previous = {}) => {
  const next = { ...previous };
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const symbol = normalizeSymbolKey(row?.symbol);
    if (!symbol) return;
    const price = toMaybeFiniteNumber(row?.price ?? row?.last ?? row?.close);
    const percentChange = toMaybeFiniteNumber(row?.percentChange ?? row?.changePercent ?? row?.percent_change);
    const change = toMaybeFiniteNumber(row?.change);
    next[symbol] = {
      ...next[symbol],
      symbol,
      name: row?.name || next[symbol]?.name || symbol,
      exchange: row?.exchange || next[symbol]?.exchange || null,
      price: price ?? next[symbol]?.price ?? null,
      percentChange: percentChange ?? next[symbol]?.percentChange ?? null,
      change: change ?? next[symbol]?.change ?? null,
      timestamp: row?.timestamp || row?.datetime || new Date().toISOString(),
      source: 'rest',
    };
  });
  return next;
};

const mentionSymbolsFromPosts = (rows = []) => {
  const symbols = new Set();
  (Array.isArray(rows) ? rows : []).forEach((post) => {
    extractTickers(post?.content || '').forEach((symbol) => symbols.add(normalizeSymbolKey(symbol)));
    const metadataTicker = normalizeSymbolKey(post?.metadata?.ticker || post?.metadata?.symbol);
    if (metadataTicker) symbols.add(metadataTicker);
  });
  return [...symbols].filter(Boolean);
};

const sanitizePostType = (type) => {
  if (POST_TYPE_ORDER.includes(type)) return type;
  return 'post';
};

const makeMockReactionRows = (index) => {
  const count = (index % 4) + 1;
  return Array.from({ length: count }).map((_, offset) => ({
    id: `mock-r-${index}-${offset}`,
    emoji: MOCK_REACTION_POOL[(index + (offset * 2)) % MOCK_REACTION_POOL.length],
    user_id: `mock-reactor-${(index * 5) + offset}`,
  }));
};

const generateMockFeed = () => {
  const now = Date.now();
  const rows = Array.from({ length: 36 }).map((_, index) => {
    const setup = MOCK_BASE_SETUPS[index % MOCK_BASE_SETUPS.length];
    const author = MOCK_AUTHORS[(index * 3) % MOCK_AUTHORS.length];
    const createdAt = new Date(now - ((index * 19) + 4) * 60 * 1000).toISOString();
    const reactionRows = makeMockReactionRows(index);
    const shouldBePnl = index % 5 === 0 || index % 11 === 0;

    let postType = sanitizePostType(setup.post_type);
    let content = `${setup.note} Watching $${setup.symbol} into the next session.`;
    let metadata = {};

    if (shouldBePnl) {
      postType = 'pnl_share';
      const sign = index % 3 === 0 ? -1 : 1;
      const entryPrice = Number((40 + ((index * 7.25) % 420)).toFixed(2));
      const percent = Number((sign * (1.2 + ((index * 1.37) % 6.8))).toFixed(2));
      const exitPrice = Number((entryPrice * (1 + (percent / 100))).toFixed(2));
      const shares = Number((20 + ((index * 3.4) % 310)).toFixed(2));
      const pnl = Number(((exitPrice - entryPrice) * shares).toFixed(2));
      const openedAt = new Date(new Date(createdAt).getTime() - (6 + (index % 22)) * 60 * 60 * 1000).toISOString();
      const closedAt = createdAt;

      metadata = {
        ticker: setup.symbol,
        pnl,
        percent,
        entry_price: entryPrice,
        exit_price: exitPrice,
        shares,
        opened_at: openedAt,
        closed_at: closedAt,
        emoji: [SLIP_EMOJI_PRESETS[index % SLIP_EMOJI_PRESETS.length]],
      };

      content = createSlipCaption({
        trade: {
          symbol: setup.symbol,
          pnl,
          percent,
          entryPrice,
          exitPrice,
          shares,
          openedAt,
          closedAt,
        },
        emojis: metadata.emoji,
        note: index % 2 === 0
          ? 'Executed per plan with strict risk management.'
          : 'Stayed disciplined and took what the tape gave.',
      });
    } else if (postType === 'alert_share') {
      const trigger = Number((70 + ((index * 9.4) % 360)).toFixed(2));
      metadata = {
        ticker: setup.symbol,
        trigger_price: trigger,
        reason: index % 2 === 0 ? 'Breakout trigger' : 'Breakdown trigger',
      };
      content = `${setup.note} Alert set for $${setup.symbol} at ${formatCurrency(trigger)} with confirmation on volume.`;
    } else if (postType === 'strategy_share') {
      metadata = {
        ticker: setup.symbol,
        timeframe: index % 2 === 0 ? '5m' : '15m',
        risk_model: index % 3 === 0 ? '0.5R scout' : '1R standard',
      };
      content = `${setup.note} Strategy conditions: liquidity above average and trend alignment in $${setup.symbol}.`;
    } else if (postType === 'trade_share') {
      metadata = {
        ticker: setup.symbol,
        side: index % 4 === 0 ? 'sell' : 'buy',
        setup: index % 2 === 0 ? 'Opening range break' : 'VWAP reclaim',
      };
      content = `${setup.note} Shared execution details on $${setup.symbol} so the room can compare entries.`;
    }

    const likesCount = (index % 17) + Math.floor(index / 2);
    const repliesCount = index % 6;

    return {
      id: `mock-post-${index + 1}`,
      user_id: `mock-user-${author.id}`,
      author_name: author.name,
      content,
      image_url: null,
      ticker_mentions: extractTickers(content),
      post_type: postType,
      metadata,
      created_at: createdAt,
      likes_count: likesCount,
      replies_count: repliesCount,
      comments_count: repliesCount,
      community_reactions: reactionRows,
      reaction_summary: buildReactionSummary(reactionRows, null),
      profiles: {
        id: `mock-user-${author.id}`,
        display_name: author.name,
        avatar_url: null,
        email: author.email,
      },
      is_mock: true,
      mock_replies: repliesCount > 0
        ? Array.from({ length: Math.min(3, repliesCount) }).map((__, replyIdx) => ({
            id: `mock-reply-${index + 1}-${replyIdx + 1}`,
            user_id: `mock-user-${MOCK_AUTHORS[(index + replyIdx + 1) % MOCK_AUTHORS.length].id}`,
            author_name: MOCK_AUTHORS[(index + replyIdx + 1) % MOCK_AUTHORS.length].name,
            content: replyIdx % 2 === 0
              ? `Nice execution on $${setup.symbol}. Risk was clearly defined.`
              : `I had a similar read on $${setup.symbol}, appreciate the level callouts.`,
            created_at: new Date(new Date(createdAt).getTime() + (replyIdx + 1) * 8 * 60 * 1000).toISOString(),
            profiles: {
              id: `mock-user-${MOCK_AUTHORS[(index + replyIdx + 1) % MOCK_AUTHORS.length].id}`,
              display_name: MOCK_AUTHORS[(index + replyIdx + 1) % MOCK_AUTHORS.length].name,
              avatar_url: null,
              email: MOCK_AUTHORS[(index + replyIdx + 1) % MOCK_AUTHORS.length].email,
            },
            community_reactions: makeMockReactionRows(index + replyIdx + 2),
          }))
        : [],
    };
  });

  return rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

const SuggestionPopover = ({
  open,
  mode = 'post',
  loading,
  suggestions,
  activeIndex,
  onPick,
}) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 6, scale: 0.98 }}
        transition={{ duration: 0.16 }}
        className="absolute left-0 right-0 bottom-full mb-2 z-50"
      >
        <div
          className="rounded-xl border shadow-2xl overflow-hidden"
          style={{
            borderColor: T.border,
            background: 'linear-gradient(180deg, rgba(28,35,51,0.98) 0%, rgba(13,17,23,0.98) 100%)',
          }}
        >
          {loading ? (
            <div className="px-3 py-2.5 text-xs" style={{ color: T.muted }}>
              {mode === 'search' ? 'Preparing suggestions...' : 'Searching symbols...'}
            </div>
          ) : suggestions.length === 0 ? (
            <div className="px-3 py-2.5 text-xs" style={{ color: T.muted }}>
              {mode === 'search' ? 'No suggestions yet.' : 'No symbols found.'}
            </div>
          ) : mode === 'search' ? (
            <div className="max-h-64 overflow-y-auto">
              {suggestions.map((item, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={item.id || `${item.text}-${idx}`}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onPick?.(item)}
                    className="w-full px-3 py-2.5 text-left transition-colors text-sm"
                    style={{
                      backgroundColor: isActive ? 'rgba(88,166,255,0.12)' : 'transparent',
                      borderBottom: idx === suggestions.length - 1 ? 'none' : `1px solid ${T.border}`,
                      color: T.text,
                    }}
                  >
                    {item.text}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {suggestions.map((item, idx) => {
                const isActive = idx === activeIndex;
                const percent = toMaybeFiniteNumber(item?.percentChange);
                const isUp = percent !== null ? percent >= 0 : false;
                return (
                  <button
                    key={`${item.symbol}-${idx}`}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onPick?.(item)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors"
                    style={{
                      backgroundColor: isActive ? 'rgba(88,166,255,0.12)' : 'transparent',
                      borderBottom: idx === suggestions.length - 1 ? 'none' : `1px solid ${T.border}`,
                    }}
                  >
                    <div className="min-w-0 pr-3">
                      <div className="text-sm font-semibold" style={{ color: T.text }}>${item.symbol}</div>
                      <div className="text-[11px] truncate" style={{ color: T.muted }}>{item.name || item.symbol}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-mono" style={{ color: T.text }}>
                        {item.price !== null && item.price !== undefined ? formatPrice(item.price) : '--'}
                      </div>
                      <div className="text-[11px] font-mono" style={{ color: percent === null ? T.muted : (isUp ? T.green : T.red) }}>
                        {percent === null ? '--' : formatSignedPercent(percent)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

const ChatInputBar = ({
  currentUser,
  trackedSymbols,
  quoteMap,
  streamStatus,
  onSend,
  onSearch,
  onOpenComposer,
}) => {
  const [message, setMessage] = useState('');
  const [searchMode, setSearchMode] = useState(false);
  const [debouncedMessage, setDebouncedMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const inputRef = useRef(null);
  const lookupRef = useRef(null);

  const tickerQuery = useMemo(() => {
    const match = message.match(/(?:^|\s)\$([A-Za-z0-9./=-]{1,14})$/);
    return match ? match[1].toUpperCase() : '';
  }, [message]);

  const searchSuggestions = useMemo(() => {
    const query = normalizeAiSearchQuery(debouncedMessage);
    if (!query) return [];
    return buildSearchModeSuggestions(query);
  }, [debouncedMessage]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setDebouncedMessage(message);
    }, 500);
    return () => window.clearTimeout(timerId);
  }, [message]);

  useEffect(() => {
    if (searchMode) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return undefined;
    }

    let cancelled = false;

    const lookup = async (query) => {
      if (!query) {
        setSuggestions([]);
        setSuggestionsLoading(false);
        return;
      }

      const localUniverse = [...new Set([
        ...trackedSymbols,
        ...DEFAULT_TICKERS,
        ...Object.keys(quoteMap || {}),
      ].map(normalizeSymbolKey).filter(Boolean))];

      const localRows = localUniverse
        .filter((symbol) => symbol.includes(query))
        .slice(0, 8)
        .map((symbol) => ({
          symbol,
          name: symbol,
          price: toMaybeFiniteNumber(quoteMap?.[symbol]?.price),
          percentChange: toMaybeFiniteNumber(quoteMap?.[symbol]?.percentChange),
        }));

      let remoteRows = [];
      try {
        const payload = await cachedFetch(
          `/api/global-markets/list?market=nyse&q=${encodeURIComponent(query)}&limit=12`,
          { cache: 'no-store' },
          45_000,
        );

        const rows = Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload) ? payload : []);
        remoteRows = rows
          .map((row) => ({
            symbol: normalizeSymbolKey(row?.symbol),
            name: row?.instrumentName || row?.name || row?.symbol,
            price: toMaybeFiniteNumber(quoteMap?.[normalizeSymbolKey(row?.symbol)]?.price),
            percentChange: toMaybeFiniteNumber(quoteMap?.[normalizeSymbolKey(row?.symbol)]?.percentChange),
          }))
          .filter((row) => row.symbol);
      } catch {
        remoteRows = [];
      }

      if (cancelled) return;

      const merged = [...localRows, ...remoteRows]
        .reduce((acc, row) => {
          if (acc.some((entry) => entry.symbol === row.symbol)) return acc;
          acc.push(row);
          return acc;
        }, [])
        .slice(0, 10);

      setSuggestions(merged);
      setActiveSuggestion(0);
      setSuggestionsLoading(false);
    };

    lookupRef.current = createDebouncedFn((query) => {
      void lookup(query);
    }, 500);

    return () => {
      cancelled = true;
      lookupRef.current?.cancel?.();
    };
  }, [trackedSymbols, quoteMap, searchMode]);

  useEffect(() => {
    if (searchMode) return;
    if (!tickerQuery) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }
    setSuggestionsLoading(true);
    lookupRef.current?.call(tickerQuery);
  }, [tickerQuery, searchMode]);

  const applySuggestion = useCallback((item) => {
    if (searchMode) {
      const text = String(item?.text || '').trim();
      if (!text) return;
      setMessage(text);
      setActiveSuggestion(0);
      window.requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }

    if (!item?.symbol) return;
    setMessage((prev) => {
      const replaced = prev.replace(/(?:^|\s)\$[A-Za-z0-9./=-]{0,14}$/, (match) => {
        const prefix = match.startsWith(' ') ? ' ' : '';
        return `${prefix}$${item.symbol} `;
      });
      if (replaced !== prev) return replaced;
      return `${prev.trim()} $${item.symbol} `.trimStart();
    });
    setSuggestions([]);
    setActiveSuggestion(0);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [searchMode]);

  const send = async () => {
    const trimmed = normalizeAiSearchQuery(message);
    if (!trimmed) return;
    const ok = searchMode
      ? await onSearch?.(trimmed)
      : await onSend?.(trimmed);
    if (ok !== false) {
      setMessage('');
      setSuggestions([]);
      setActiveSuggestion(0);
      setDebouncedMessage('');
    }
  };

  const handleKeyDown = (event) => {
    const currentSuggestions = suggestionOpen ? suggestionRows : [];
    if (currentSuggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveSuggestion((prev) => (prev + 1) % currentSuggestions.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveSuggestion((prev) => (prev - 1 + currentSuggestions.length) % currentSuggestions.length);
        return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        applySuggestion(currentSuggestions[activeSuggestion] || currentSuggestions[0]);
        return;
      }
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  };

  const isOnline = streamStatus?.connected;
  const statusText = isOnline
    ? 'Live tape connected'
    : streamStatus?.connecting
      ? 'Connecting live tape...'
      : 'Live tape offline';
  const canUseInput = searchMode || Boolean(currentUser?.id);
  const suggestionOpen = searchMode
    ? Boolean(normalizeAiSearchQuery(debouncedMessage))
    : Boolean(tickerQuery);
  const suggestionRows = searchMode ? searchSuggestions : suggestions;
  const hintText = searchMode
    ? 'Enter to search, Shift+Enter for newline'
    : 'Enter to send, Shift+Enter for newline';
  const contextualStatus = statusText;

  return (
    <div className="max-w-3xl mx-auto w-full">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        className="relative"
      >
        <div className="relative">
          <SuggestionPopover
            open={suggestionOpen}
            mode={searchMode ? 'search' : 'post'}
            loading={searchMode ? false : suggestionsLoading}
            suggestions={suggestionRows}
            activeIndex={activeSuggestion}
            onPick={applySuggestion}
          />

          <div
            className="rounded-xl border px-3.5 pt-3 pb-2.5 min-h-[98px]"
            style={{
              backgroundColor: '#151b23',
              borderColor: 'rgba(255,255,255,0.06)',
            }}
          >
            <div className="flex items-start gap-2.5">
              <button
                type="button"
                onClick={() => setSearchMode((prev) => !prev)}
                className="h-7 w-7 flex-shrink-0 rounded-full border transition-colors"
                style={{
                  borderColor: T.border,
                  color: searchMode ? T.blue : T.muted,
                  backgroundColor: searchMode ? 'rgba(88,166,255,0.14)' : 'transparent',
                }}
                title={searchMode ? 'Switch to post mode' : 'Switch to search mode'}
              >
                <Search size={13} strokeWidth={1.5} className="mx-auto" />
              </button>
              <Activity size={16} className="mt-1 flex-shrink-0" style={{ color: isOnline ? T.green : T.muted }} />
              <textarea
                ref={inputRef}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={searchMode ? 'Search markets, news, stocks...' : (currentUser?.id ? 'Quick post... use $ for ticker suggestions' : 'Sign in to post in community')}
                className="flex-1 w-full bg-transparent text-sm resize-none outline-none leading-6 min-h-[24px] max-h-32"
                style={{ color: T.text }}
                disabled={!canUseInput}
              />
            </div>

            <div className="mt-2.5 flex items-center justify-between">
              <button
                type="button"
                onClick={onOpenComposer}
                className="h-7 w-7 rounded-full border transition-colors hover:bg-white/5"
                style={{ borderColor: T.border, color: T.muted }}
                title="Open composer"
              >
                <Plus size={12} className="mx-auto" />
              </button>

              <div className="relative flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={onOpenComposer}
                  className="h-8 px-3 rounded-full border text-xs font-medium transition-colors"
                  style={{ borderColor: T.border, color: T.text, backgroundColor: 'rgba(13,17,23,0.8)' }}
                  title="Open composer"
                >
                  Compose
                </button>
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker((open) => !open)}
                  className="h-8 w-8 rounded-full border transition-colors"
                  style={{ borderColor: T.border, color: T.muted, backgroundColor: 'rgba(13,17,23,0.8)' }}
                  title="Insert emoji"
                >
                  <SmilePlus size={13} className="mx-auto" />
                </button>

                {showEmojiPicker && (
                  <EmojiPicker
                    align="right"
                    onClose={() => setShowEmojiPicker(false)}
                    onSelect={(emoji) => {
                      setMessage((prev) => `${prev}${emoji}`);
                      setShowEmojiPicker(false);
                      window.requestAnimationFrame(() => inputRef.current?.focus());
                    }}
                  />
                )}

                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={!canUseInput || !message.trim()}
                  className="h-8 w-8 rounded-full border disabled:opacity-45 transition-all"
                  style={{
                    borderColor: T.border,
                    color: canUseInput && message.trim() ? T.text : T.muted,
                    backgroundColor: canUseInput && message.trim() ? 'rgba(88,166,255,0.14)' : 'transparent',
                  }}
                  title={searchMode ? 'Run AI search' : 'Send quick post'}
                >
                  <ArrowUp size={13} className="mx-auto" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-1.5 flex items-center justify-between">
          <div className="text-xs" style={{ color: '#7d8590' }}>{contextualStatus}</div>
          <div className="text-xs" style={{ color: '#7d8590' }}>{hintText}</div>
        </div>
      </motion.div>
    </div>
  );
};

const AiSearchLoadingCard = ({ query }) => (
  <motion.article
    layout
    className="rounded-lg border border-l-2 p-3 animate-pulse"
    style={{
      borderColor: T.border,
      borderLeftColor: T.blue,
      backgroundColor: T.card,
    }}
  >
    <div className="flex items-center gap-2 text-xs mb-2" style={{ color: T.blue }}>
      <Sparkles size={13} strokeWidth={1.5} />
      <span>Searching...</span>
      {query ? <span style={{ color: T.muted }}>"{query}"</span> : null}
    </div>
    <ShimmerBlock lines={3} />
  </motion.article>
);

const sentimentStyle = (sentiment) => {
  if (sentiment === 'bullish') return { label: 'Bullish', color: T.green, bg: 'rgba(63,185,80,0.12)' };
  if (sentiment === 'bearish') return { label: 'Bearish', color: T.red, bg: 'rgba(248,81,73,0.12)' };
  return { label: 'Neutral', color: T.muted, bg: 'rgba(125,133,144,0.16)' };
};

const AiSearchResultCard = ({
  result,
  onClear,
  onTickerClick,
}) => {
  const sentiment = sentimentStyle(result?.sentiment);

  return (
    <motion.article
      layout
      variants={CARD_VARIANTS}
      className="rounded-lg border border-l-2 p-3"
      style={{
        borderColor: T.border,
        borderLeftColor: '#3b82f6',
        backgroundColor: '#151b23',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs inline-flex items-center gap-1.5" style={{ color: T.blue }}>
            <Sparkles size={13} strokeWidth={1.5} />
            <span>AI Search Result</span>
          </div>
          <div className="text-xs mt-1 truncate" style={{ color: T.muted }}>
            "{result?.query || ''}"
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-xs transition-colors"
          style={{ color: T.muted }}
          onMouseEnter={(event) => { event.currentTarget.style.color = T.text; }}
          onMouseLeave={(event) => { event.currentTarget.style.color = T.muted; }}
        >
          Clear search
        </button>
      </div>

      <p className="mt-2 text-sm leading-relaxed" style={{ color: '#e6edf3' }}>
        {result?.summary}
      </p>

      {Array.isArray(result?.keyPoints) && result.keyPoints.length > 0 ? (
        <div className="mt-2 space-y-1">
          {result.keyPoints.map((point, index) => (
            <div key={`${result.id}-kp-${index}`} className="text-xs" style={{ color: '#c9d1d9' }}>
              - {point}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className="text-[11px] px-2 py-0.5 rounded-full border"
          style={{
            color: sentiment.color,
            borderColor: sentiment.color,
            backgroundColor: sentiment.bg,
          }}
        >
          {sentiment.label}
        </span>

        {(result.relatedTickers || []).map((ticker) => (
          <button
            key={`${result.id}-ticker-${ticker}`}
            type="button"
            onClick={() => onTickerClick?.(ticker)}
            className="text-xs px-2 py-0.5 rounded-full border transition-colors"
            style={{
              color: T.blue,
              borderColor: 'rgba(88,166,255,0.35)',
              backgroundColor: 'rgba(88,166,255,0.12)',
            }}
          >
            ${ticker}
          </button>
        ))}
      </div>

      {Array.isArray(result?.sources) && result.sources.length > 0 ? (
        <div className="mt-3 pt-2 border-t space-y-2" style={{ borderColor: T.border }}>
          <div className="text-[11px] uppercase tracking-[0.13em]" style={{ color: T.muted }}>Sources</div>
          {result.sources.map((source, index) => (
            <a
              key={`${result.id}-source-${index}`}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-lg border px-2.5 py-2 transition-colors"
              style={{ borderColor: T.border, backgroundColor: 'rgba(13,17,23,0.5)' }}
            >
              <div className="text-xs truncate" style={{ color: T.blue }}>{source.title || source.url}</div>
              <div className="text-[11px] truncate" style={{ color: T.muted }}>{source.url}</div>
            </a>
          ))}
        </div>
      ) : null}
    </motion.article>
  );
};

const PnlShowcaseOverlay = ({ snapshot, onClose }) => {
  const hideRef = useRef(null);

  useEffect(() => {
    if (!snapshot) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (hideRef.current) {
        clearTimeout(hideRef.current);
        hideRef.current = null;
      }
    };
  }, [snapshot, onClose]);

  return (
    <AnimatePresence>
      {snapshot ? (
        <motion.div
          initial={{ opacity: 0, y: 12, x: 12 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: 8, x: 8 }}
          className="fixed right-3 bottom-3 sm:right-5 sm:bottom-5 z-[120]"
        >
          <motion.div
            initial={{ scale: 0.98 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.98 }}
            transition={{ duration: 0.2 }}
            onMouseEnter={() => {
              if (hideRef.current) {
                clearTimeout(hideRef.current);
                hideRef.current = null;
              }
            }}
            onMouseLeave={() => {
              hideRef.current = setTimeout(() => onClose?.(), 140);
            }}
            className="w-[min(340px,calc(100vw-1rem))] rounded-xl border overflow-hidden"
            style={{
              borderColor: Number(snapshot?.pnl) >= 0 ? 'rgba(63,185,80,0.45)' : 'rgba(248,81,73,0.45)',
              background: Number(snapshot?.pnl) >= 0
                ? 'linear-gradient(145deg, rgba(22,36,28,0.96), rgba(13,17,23,0.97))'
                : 'linear-gradient(145deg, rgba(41,20,23,0.96), rgba(13,17,23,0.97))',
              boxShadow: '0 22px 52px rgba(0,0,0,0.46)',
            }}
          >
            <div className="px-3 py-2.5 border-b flex items-start justify-between" style={{ borderColor: T.border }}>
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em]" style={{ color: T.muted }}>Live Slip Spotlight</div>
                <div className="text-lg font-semibold">${snapshot.ticker}</div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="h-7 px-2 rounded-md border text-[10px]"
                style={{ borderColor: T.border, color: T.muted }}
              >
                CLOSE
              </button>
            </div>

            <div className="p-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border p-2" style={{ borderColor: T.border, backgroundColor: 'rgba(13,17,23,0.55)' }}>
                <div style={{ color: T.muted }} className="text-[10px] uppercase tracking-[0.13em]">P&L</div>
                <div className="font-semibold font-mono" style={{ color: Number(snapshot?.pnl) >= 0 ? T.green : T.red }}>
                  {formatSignedCurrency(snapshot?.pnl)}
                </div>
              </div>
              <div className="rounded-lg border p-2" style={{ borderColor: T.border, backgroundColor: 'rgba(13,17,23,0.55)' }}>
                <div style={{ color: T.muted }} className="text-[10px] uppercase tracking-[0.13em]">Return</div>
                <div className="font-semibold font-mono" style={{ color: Number(snapshot?.percent) >= 0 ? T.green : T.red }}>
                  {Number.isFinite(snapshot?.percent) ? formatSignedPercent(snapshot.percent) : '--'}
                </div>
              </div>
              <div className="rounded-lg border p-2" style={{ borderColor: T.border, backgroundColor: 'rgba(13,17,23,0.55)' }}>
                <div style={{ color: T.muted }} className="text-[10px] uppercase tracking-[0.13em]">Entry</div>
                <div className="font-mono">{Number.isFinite(snapshot?.entryPrice) ? formatCurrency(snapshot.entryPrice) : '--'}</div>
              </div>
              <div className="rounded-lg border p-2" style={{ borderColor: T.border, backgroundColor: 'rgba(13,17,23,0.55)' }}>
                <div style={{ color: T.muted }} className="text-[10px] uppercase tracking-[0.13em]">Exit</div>
                <div className="font-mono">{Number.isFinite(snapshot?.exitPrice) ? formatCurrency(snapshot.exitPrice) : '--'}</div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

const ComposerTypePill = ({ active, icon: Icon, label, onClick, accent = T.blue }) => (
  <button
    type="button"
    onClick={onClick}
    className="px-2.5 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
    style={{
      borderColor: active ? accent : T.border,
      color: active ? accent : T.muted,
      backgroundColor: active ? 'rgba(88,166,255,0.10)' : 'rgba(13,17,23,0.65)',
    }}
  >
    <Icon size={13} />
    {label}
  </button>
);

const PostComposerModal = ({
  open,
  onClose,
  currentUser,
  closedTrades = [],
  submitting = false,
  initialPostType = 'post',
  onSubmit,
}) => {
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState('post');
  const [selectedTradeId, setSelectedTradeId] = useState('');
  const [selectedSlipEmojis, setSelectedSlipEmojis] = useState([]);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setPostType(sanitizePostType(initialPostType));
    setSelectedTradeId(closedTrades[0]?.id || '');
    setSelectedSlipEmojis([]);
    setContent('');
    setImageFile(null);
    setImagePreview('');
    setShowEmojiPicker(false);
    if (fileRef.current) fileRef.current.value = '';
  }, [open, initialPostType, closedTrades]);

  useEffect(() => {
    if (!imagePreview) return undefined;
    return () => {
      try {
        URL.revokeObjectURL(imagePreview);
      } catch {}
    };
  }, [imagePreview]);

  const selectedTrade = useMemo(
    () => closedTrades.find((trade) => String(trade.id) === String(selectedTradeId)) || null,
    [closedTrades, selectedTradeId],
  );

  const canAutofillSlip = postType === 'pnl_share' && selectedTrade;

  const toggleSlipEmoji = (emoji) => {
    setSelectedSlipEmojis((prev) => (
      prev.includes(emoji)
        ? prev.filter((value) => value !== emoji)
        : [...prev, emoji]
    ));
  };

  const autofillFromTrade = () => {
    if (!selectedTrade) return;
    setContent(createSlipCaption({ trade: selectedTrade, emojis: selectedSlipEmojis }));
  };

  const handleSelectImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      window.alert('Image must be 5MB or smaller.');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    if (imagePreview) {
      try {
        URL.revokeObjectURL(imagePreview);
      } catch {}
    }
    setImagePreview('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const submit = async () => {
    const trimmed = content.trim();
    if (!trimmed && !imageFile && !(postType === 'pnl_share' && selectedTrade)) return;

    const metadata = {};
    let finalContent = trimmed;

    if (postType === 'pnl_share' && selectedTrade) {
      metadata.ticker = selectedTrade.symbol;
      metadata.pnl = Number(selectedTrade.pnl.toFixed(2));
      metadata.percent = Number(selectedTrade.percent.toFixed(2));
      metadata.shares = Number(selectedTrade.shares.toFixed(4));
      metadata.entry_price = Number(selectedTrade.entryPrice.toFixed(4));
      metadata.exit_price = Number(selectedTrade.exitPrice.toFixed(4));
      metadata.opened_at = new Date(selectedTrade.openedAt).toISOString();
      metadata.closed_at = new Date(selectedTrade.closedAt).toISOString();
      metadata.emoji = selectedSlipEmojis;
      if (!finalContent) {
        finalContent = createSlipCaption({ trade: selectedTrade, emojis: selectedSlipEmojis });
      }
    }

    const ok = await onSubmit?.({
      content: finalContent,
      postType,
      metadata,
      imageFile,
    });

    if (ok !== false) {
      onClose?.();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-2 sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            type="button"
            onClick={onClose}
            className="absolute inset-0"
            style={{ backgroundColor: 'rgba(0,0,0,0.62)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-label="Close composer"
          />

          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={MODAL_SPRING}
            className="relative z-10 w-full max-w-2xl rounded-2xl border overflow-hidden"
            style={{
              borderColor: T.border,
              background: 'linear-gradient(180deg, rgba(28,35,51,0.98) 0%, rgba(13,17,23,0.98) 100%)',
              boxShadow: '0 26px 58px rgba(0,0,0,0.48)',
            }}
          >
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: T.border }}>
              <div>
                <div className="text-xs uppercase tracking-[0.14em]" style={{ color: T.muted }}>Community Composer</div>
                <h3 className="text-base font-semibold">Create Post</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="h-8 w-8 rounded-lg border"
                style={{ borderColor: T.border, color: T.muted }}
              >
                <X size={14} className="mx-auto" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <ComposerTypePill active={postType === 'post'} icon={MessageCircle} label="Post" onClick={() => setPostType('post')} accent={T.blue} />
                <ComposerTypePill active={postType === 'trade_share'} icon={BarChart3} label="Trade" onClick={() => setPostType('trade_share')} accent={T.blue} />
                <ComposerTypePill active={postType === 'strategy_share'} icon={Zap} label="Strategy" onClick={() => setPostType('strategy_share')} accent={T.blue} />
                <ComposerTypePill active={postType === 'alert_share'} icon={Bell} label="Alert" onClick={() => setPostType('alert_share')} accent={T.blue} />
                <ComposerTypePill active={postType === 'pnl_share'} icon={TrendingUp} label="P&L" onClick={() => setPostType('pnl_share')} accent={T.green} />
              </div>

              {postType === 'pnl_share' && (
                <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: T.border, backgroundColor: 'rgba(13,17,23,0.55)' }}>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <label className="text-[11px] uppercase tracking-[0.14em]" style={{ color: T.muted }}>Closed Trade</label>
                      <select
                        value={selectedTradeId}
                        onChange={(event) => setSelectedTradeId(event.target.value)}
                        className="mt-1 w-full rounded-lg border px-2.5 py-1.5 text-sm bg-transparent outline-none"
                        style={{ borderColor: T.border, color: T.text }}
                      >
                        {closedTrades.length === 0 ? (
                          <option value="">No completed trades available</option>
                        ) : (
                          closedTrades.slice(0, 80).map((trade) => (
                            <option key={trade.id} value={trade.id}>
                              {trade.symbol} {formatSignedPercent(trade.percent)} {formatSignedCurrency(trade.pnl)}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={autofillFromTrade}
                      disabled={!canAutofillSlip}
                      className="sm:self-end h-9 px-3 rounded-lg border text-xs font-medium disabled:opacity-45"
                      style={{ borderColor: T.border, color: T.text, backgroundColor: 'rgba(13,17,23,0.8)' }}
                    >
                      Autofill Slip
                    </button>
                  </div>

                  <div>
                    <div className="text-[11px] uppercase tracking-[0.14em] mb-1" style={{ color: T.muted }}>Slip Emojis</div>
                    <div className="flex flex-wrap gap-1.5">
                      {SLIP_EMOJI_PRESETS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => toggleSlipEmoji(emoji)}
                          className="h-8 w-8 rounded-lg border text-sm"
                          style={{
                            borderColor: selectedSlipEmojis.includes(emoji) ? T.blue : T.border,
                            backgroundColor: selectedSlipEmojis.includes(emoji) ? 'rgba(88,166,255,0.15)' : 'rgba(13,17,23,0.8)',
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="relative">
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="Share your setup, thesis, or execution notes..."
                  rows={6}
                  className="w-full rounded-xl border px-3 py-2.5 resize-none outline-none text-sm leading-6"
                  style={{
                    borderColor: T.border,
                    backgroundColor: 'rgba(13,17,23,0.66)',
                    color: T.text,
                  }}
                />

                <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleSelectImage}
                    />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="h-8 px-2.5 rounded-lg border text-xs inline-flex items-center gap-1.5"
                      style={{ borderColor: T.border, color: T.muted, backgroundColor: 'rgba(13,17,23,0.8)' }}
                    >
                      <Camera size={13} />
                      Add Image
                    </button>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker((openState) => !openState)}
                        className="h-8 px-2.5 rounded-lg border text-xs inline-flex items-center gap-1.5"
                        style={{ borderColor: T.border, color: T.muted, backgroundColor: 'rgba(13,17,23,0.8)' }}
                      >
                        <SmilePlus size={13} />
                        Emoji
                      </button>
                      {showEmojiPicker && (
                        <EmojiPicker
                          align="left"
                          onClose={() => setShowEmojiPicker(false)}
                          onSelect={(emoji) => {
                            setContent((prev) => `${prev}${emoji}`);
                            setShowEmojiPicker(false);
                          }}
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {DEFAULT_TICKERS.slice(0, 5).map((ticker) => (
                      <button
                        key={ticker}
                        type="button"
                        onClick={() => setContent((prev) => `${prev}${prev.endsWith(' ') || !prev ? '' : ' '} $${ticker}`.trimStart())}
                        className="h-7 px-2 rounded-full border text-[11px]"
                        style={{ borderColor: T.border, color: T.blue, backgroundColor: 'rgba(88,166,255,0.08)' }}
                      >
                        ${ticker}
                      </button>
                    ))}
                  </div>
                </div>

                {imagePreview && (
                  <div className="mt-3 relative inline-block">
                    <img src={imagePreview} alt="Composer preview" className="max-h-56 rounded-xl border" style={{ borderColor: T.border }} />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute top-2 right-2 h-7 w-7 rounded-full border"
                      style={{ borderColor: T.border, backgroundColor: 'rgba(13,17,23,0.9)' }}
                    >
                      <X size={13} className="mx-auto" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="px-4 py-3 border-t flex items-center justify-between" style={{ borderColor: T.border }}>
              <div className="text-xs" style={{ color: T.muted }}>
                Posting as {currentUser?.display_name || currentUser?.email?.split('@')[0] || 'Guest Trader'}
              </div>

              <button
                type="button"
                onClick={() => void submit()}
                disabled={submitting || (!content.trim() && !imageFile && !(postType === 'pnl_share' && selectedTrade))}
                className="h-9 px-4 rounded-lg text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-45"
                style={{ backgroundColor: T.blue, color: '#08111f' }}
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Publish
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const ReactionBar = ({
  postId,
  currentUser,
  initialReactions = [],
  compact = false,
  inActionRow = false,
  isMock = false,
}) => {
  const [reactions, setReactions] = useState(initialReactions || []);
  const [showPicker, setShowPicker] = useState(false);
  const interactive = Boolean(currentUser?.id);

  useEffect(() => {
    setReactions(initialReactions || []);
    setShowPicker(false);
  }, [postId, initialReactions]);

  const toggleReaction = async (emoji) => {
    if (!interactive || !emoji) return;
    const active = reactions.find((reaction) => reaction.emoji === emoji);
    const shouldReact = !active?.reacted;
    const previous = [...reactions];
    setReactions((prev) => applyReactionState(prev, emoji, shouldReact));

    if (isMock) return;

    try {
      if (shouldReact) {
        const { error } = await supabase.from('community_reactions').insert({
          post_id: postId,
          user_id: currentUser.id,
          emoji,
        });
        if (error && error.code !== '23505') throw error;
      } else {
        const { error } = await supabase
          .from('community_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUser.id)
          .eq('emoji', emoji);
        if (error) throw error;
      }
    } catch {
      setReactions(previous);
    }
  };

  const trigger = (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setShowPicker((openState) => !openState)}
        disabled={!interactive}
        className={`inline-flex items-center gap-1 ${compact ? 'text-[11px]' : 'text-xs'} transition-colors ${interactive ? '' : 'cursor-not-allowed opacity-70'}`}
        style={{ color: interactive ? T.muted : 'rgba(125,133,144,0.5)' }}
      >
        <SmilePlus className={inActionRow ? 'h-3.5 w-3.5' : compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        {inActionRow ? <span>React</span> : null}
      </button>

      {showPicker && interactive && (
        <EmojiPicker
          align={compact ? 'right' : 'left'}
          onClose={() => setShowPicker(false)}
          onSelect={(emoji) => {
            setShowPicker(false);
            void toggleReaction(emoji);
          }}
        />
      )}
    </span>
  );

  if (inActionRow) {
    return (
      <>
        {trigger}
        {reactions.length > 0 ? (
          <div className="w-full mt-1 flex flex-wrap gap-1">
            <AnimatePresence initial={false}>
              {reactions.map((reaction) => (
                <motion.button
                  key={`${postId}-${reaction.emoji}`}
                  type="button"
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.16 }}
                  onClick={() => void toggleReaction(reaction.emoji)}
                  disabled={!interactive}
                  className="inline-flex items-center gap-0.5 text-xs"
                  style={{ color: reaction.reacted ? T.blue : T.muted }}
                >
                  <EmojiGlyph emoji={reaction.emoji} size={13} />
                  <span className="font-semibold">{reaction.count}</span>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className={compact ? 'mt-1' : 'mt-2'}>
      <div className="flex flex-wrap items-center gap-1.5">
        {trigger}
        <AnimatePresence initial={false}>
          {reactions.map((reaction) => (
            <motion.button
              key={`${postId}-${reaction.emoji}`}
              type="button"
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.16 }}
              onClick={() => void toggleReaction(reaction.emoji)}
              disabled={!interactive}
              className="inline-flex items-center gap-0.5 text-xs"
              style={{ color: reaction.reacted ? T.blue : T.muted }}
            >
              <EmojiGlyph emoji={reaction.emoji} size={13} />
              <span className="font-semibold">{reaction.count}</span>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

const PostCard = ({ post, currentUser, onDelete }) => {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(toFiniteNumber(post.likes_count ?? post.likes, 0));
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState([]);
  const [replyContent, setReplyContent] = useState('');
  const [replying, setReplying] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const isMock = Boolean(post?.is_mock);

  const initialReactions = useMemo(() => {
    if (Array.isArray(post?.reaction_summary)) return post.reaction_summary;
    return buildReactionSummary(post?.community_reactions || [], currentUser?.id);
  }, [post?.reaction_summary, post?.community_reactions, currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id || isMock) return;
    let cancelled = false;
    const checkLike = async () => {
      const { data } = await supabase
        .from('community_likes')
        .select('id')
        .eq('post_id', post.id)
        .eq('user_id', currentUser.id)
        .maybeSingle();
      if (!cancelled) setLiked(Boolean(data));
    };
    void checkLike();
    return () => {
      cancelled = true;
    };
  }, [post.id, currentUser?.id, isMock]);

  const toggleLike = async () => {
    if (!currentUser?.id) return;

    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikesCount((prev) => Math.max(0, prev + (nextLiked ? 1 : -1)));

    if (isMock) return;

    try {
      if (nextLiked) {
        const { error } = await supabase
          .from('community_likes')
          .insert({ post_id: post.id, user_id: currentUser.id });
        if (error && error.code !== '23505') throw error;
      } else {
        const { error } = await supabase
          .from('community_likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', currentUser.id);
        if (error) throw error;
      }
    } catch {
      setLiked(!nextLiked);
      setLikesCount((prev) => Math.max(0, prev + (nextLiked ? -1 : 1)));
    }
  };

  const loadReplies = async () => {
    if (loadingReplies) return;
    setLoadingReplies(true);

    try {
      if (isMock) {
        const mockReplies = (post.mock_replies || []).map((reply) => ({
          ...reply,
          reaction_summary: buildReactionSummary(reply.community_reactions || [], currentUser?.id),
        }));
        setReplies(sortByCreatedAtAsc(mockReplies));
        return;
      }

      const { data, error } = await supabase
        .from('community_posts')
        .select('*, community_reactions(emoji, user_id), profiles:user_id(id, display_name, avatar_url, email)')
        .or(`parent_id.eq.${post.id},parent_post_id.eq.${post.id}`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const mapped = (data || []).map((reply) => ({
        ...reply,
        reaction_summary: buildReactionSummary(reply.community_reactions || [], currentUser?.id),
      }));
      setReplies(sortByCreatedAtAsc(mapped));
    } catch {
      setReplies([]);
    } finally {
      setLoadingReplies(false);
    }
  };

  const submitReply = async () => {
    if (!currentUser?.id || !replyContent.trim() || replying) return;
    const trimmed = replyContent.trim();
    setReplying(true);

    try {
      if (isMock) {
        const syntheticReply = {
          id: `mock-reply-${post.id}-${Date.now()}`,
          user_id: currentUser.id,
          author_name: currentUser.display_name || currentUser.email?.split('@')[0] || 'Trader',
          content: trimmed,
          created_at: new Date().toISOString(),
          profiles: {
            id: currentUser.id,
            display_name: currentUser.display_name,
            avatar_url: currentUser.avatar_url,
            email: currentUser.email,
          },
          community_reactions: [],
          reaction_summary: [],
          is_mock: true,
        };
        setReplies((prev) => sortByCreatedAtAsc([...prev, syntheticReply]));
        setReplyContent('');
        setShowReplies(true);
        return;
      }

      const { data: inserted, error } = await supabase
        .from('community_posts')
        .insert({
          user_id: currentUser.id,
          author_name: currentUser.display_name || currentUser.email?.split('@')[0] || 'Trader',
          content: trimmed,
          parent_id: post.id,
          parent_post_id: post.id,
          ticker_mentions: extractTickers(trimmed),
        })
        .select('*, community_reactions(emoji, user_id), profiles:user_id(id, display_name, avatar_url, email)')
        .single();

      if (error) throw error;

      const mapped = {
        ...inserted,
        reaction_summary: buildReactionSummary(inserted.community_reactions || [], currentUser?.id),
      };
      setReplies((prev) => sortByCreatedAtAsc([...prev, mapped]));
      setReplyContent('');
      setShowReplies(true);
    } catch {
      // ignore transient reply failures to avoid blocking feed interaction
    } finally {
      setReplying(false);
    }
  };

  const toggleReplies = () => {
    if (!showReplies && replies.length === 0) {
      void loadReplies();
    }
    setShowReplies((open) => !open);
  };

  const profile = post?.profiles || {
    display_name: post.author_name,
    avatar_url: post?.metadata?.bot_avatar_url,
    email: null,
  };

  const isOwner = currentUser?.id && currentUser.id === post.user_id;
  const repliesCount = replies.length > 0
    ? replies.length
    : toFiniteNumber(post?.replies_count ?? post?.comments_count, 0);

  return (
    <motion.article
      variants={CARD_VARIANTS}
      layout
      className="rounded-lg border p-3"
      style={{
        borderColor: T.border,
        backgroundColor: T.card,
      }}
    >
      <div className="flex gap-2">
        <UserAvatar user={profile} size={32} initialsClassName="text-xs" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold truncate">
                {profile?.display_name || post.author_name || profile?.email?.split('@')[0] || 'Trader'}
              </span>
              <span className="text-xs" style={{ color: T.muted }}>•</span>
              <span className="text-xs" style={{ color: T.muted }}>{timeAgo(post.created_at)}</span>
              <PostTypeBadge type={post.post_type} metadata={post.metadata} />
            </div>

            <div className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowMenu((openState) => !openState)}
                className="h-6 w-6 inline-flex items-center justify-center"
                style={{ color: T.muted }}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>

              <AnimatePresence>
                {showMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="absolute right-0 top-8 z-20 w-36 rounded-lg border py-1"
                    style={{
                      borderColor: T.border,
                      backgroundColor: 'rgba(13,17,23,0.96)',
                      boxShadow: '0 10px 28px rgba(0,0,0,0.35)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        shareToX(post);
                        setShowMenu(false);
                      }}
                      className="w-full px-3 py-2 text-xs text-left inline-flex items-center gap-1.5"
                      style={{ color: T.text }}
                    >
                      <Share2 size={13} />
                      Share to X
                    </button>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => {
                          onDelete?.(post.id, isMock);
                          setShowMenu(false);
                        }}
                        className="w-full px-3 py-2 text-xs text-left inline-flex items-center gap-1.5"
                        style={{ color: T.red }}
                      >
                        <Trash2 size={13} />
                        Delete
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div
            className="mt-2 text-sm leading-relaxed break-words"
            style={{ color: T.text }}
            dangerouslySetInnerHTML={{ __html: highlightTickers(post.content || '') }}
          />

          {post.post_type === 'pnl_share' && <PnLCard metadata={post.metadata} />}

          {post.image_url && (
            <div className="mt-3">
              <img
                src={post.image_url}
                alt="Post attachment"
                className="max-h-96 rounded-xl border object-cover"
                style={{ borderColor: T.border }}
                loading="lazy"
              />
            </div>
          )}

          <div className="mt-2 pt-2 border-t flex flex-wrap items-center gap-2" style={{ borderColor: T.border }}>
            <button
              type="button"
              onClick={() => void toggleLike()}
              className="inline-flex items-center gap-1 text-xs"
              style={{ color: liked ? T.red : T.muted }}
            >
              <Heart className="h-3.5 w-3.5" fill={liked ? 'currentColor' : 'none'} />
              <span>Like</span>
              {likesCount > 0 ? <span className="text-xs" style={{ color: T.muted }}>{likesCount}</span> : null}
            </button>

            <button
              type="button"
              onClick={toggleReplies}
              className="inline-flex items-center gap-1 text-xs"
              style={{ color: T.muted }}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>Reply</span>
              {repliesCount > 0 ? <span className="text-xs" style={{ color: T.muted }}>{repliesCount}</span> : null}
            </button>

            <button
              type="button"
              onClick={() => shareToX(post)}
              className="inline-flex items-center gap-1 text-xs"
              style={{ color: T.muted }}
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>Share</span>
            </button>

            <ReactionBar
              postId={post.id}
              currentUser={currentUser}
              initialReactions={initialReactions}
              inActionRow
              isMock={isMock}
            />
          </div>

          <AnimatePresence initial={false}>
            {showReplies && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 pt-3 border-t overflow-hidden"
                style={{ borderColor: T.border }}
              >
                {loadingReplies ? (
                  <div className="py-3"><ShimmerBlock lines={2} /></div>
                ) : (
                  <div className="space-y-2">
                    {replies.map((reply) => {
                      const replyProfile = reply.profiles || {
                        display_name: reply.author_name,
                        avatar_url: null,
                        email: null,
                      };
                      return (
                        <div key={reply.id} className="flex gap-2">
                          <UserAvatar user={replyProfile} size={26} initialsClassName="text-xs" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-medium" style={{ color: T.text }}>
                                {replyProfile.display_name || reply.author_name || 'Trader'}
                              </span>
                              <span style={{ color: T.muted }}>{timeAgo(reply.created_at)}</span>
                            </div>
                            <div className="mt-0.5 text-xs break-words" style={{ color: T.text }} dangerouslySetInnerHTML={{ __html: highlightTickers(reply.content || '') }} />
                            <ReactionBar
                              postId={reply.id}
                              currentUser={currentUser}
                              initialReactions={reply.reaction_summary || buildReactionSummary(reply.community_reactions || [], currentUser?.id)}
                              compact
                              isMock={isMock || Boolean(reply?.is_mock)}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {currentUser?.id && (
                  <div className="mt-3 flex items-center gap-2">
                    <UserAvatar user={currentUser} size={24} initialsClassName="text-xs" />
                    <input
                      value={replyContent}
                      onChange={(event) => setReplyContent(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter') return;
                        event.preventDefault();
                        void submitReply();
                      }}
                      placeholder="Write a reply..."
                      className="flex-1 rounded-full border bg-transparent px-3 py-1.5 text-xs outline-none"
                      style={{ borderColor: T.border, color: T.text }}
                    />
                    <button
                      type="button"
                      onClick={() => void submitReply()}
                      disabled={replying || !replyContent.trim()}
                      className="h-7 w-7 inline-flex items-center justify-center disabled:opacity-45"
                      style={{ color: T.blue }}
                    >
                      {replying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.article>
  );
};

const FeedHeader = ({
  search,
  onSearch,
  onOpenComposer,
}) => {
  return (
    <div className="sticky top-0 z-20 border-b-2 border-blue-500 bg-[#0d1117] py-3">
      <div className="w-full px-3 flex items-center gap-2 bg-[#0d1117]">
        <div className="w-[92px] flex-shrink-0" aria-hidden />

        <div className="flex-1 min-w-0 px-1">
          <div className="relative max-w-md mx-auto">
            <Search size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: T.muted }} />
            <input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search for stocks, crypto, and more..."
              className="w-full rounded-full border py-1.5 pl-9 pr-4 text-sm outline-none"
              style={{ borderColor: T.border, backgroundColor: T.card, color: T.text }}
            />
          </div>
        </div>

        <div className="flex-shrink-0 flex items-center gap-1.5">
          <button
            type="button"
            className="h-7 px-2 rounded-md text-xs inline-flex items-center gap-1"
            style={{ color: T.muted }}
          >
            <Bell size={13} strokeWidth={1.5} />
            Price Alert
          </button>

          <button
            type="button"
            className="h-7 px-2 rounded-lg border text-xs inline-flex items-center gap-1"
            style={{ borderColor: 'rgba(255,255,255,0.08)', color: T.muted }}
          >
            <Share2 size={13} strokeWidth={1.5} />
            Share
          </button>

          <button
            type="button"
            onClick={onOpenComposer}
            className="h-7 px-2.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
            style={{ backgroundColor: T.blue, color: '#08111f' }}
          >
            <Send size={13} />
            New Post
          </button>
        </div>
      </div>
    </div>
  );
};

const LeftRail = ({ collapsed, onToggleCollapse, filter, onFilter }) => {
  const [feedsOpen, setFeedsOpen] = useState(true);

  return (
    <motion.aside
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22 }}
      className={`hidden lg:flex lg:flex-shrink-0 ${collapsed ? 'w-[68px] items-center' : 'w-[220px]'} h-full flex-col py-0 pb-10 overflow-y-auto border-r-2 border-blue-500 rounded-none`}
      style={{
        backgroundColor: '#080d13',
      }}
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        className={`h-8 w-8 rounded-md inline-flex items-center justify-center transition-colors hover:bg-white/5 ${collapsed ? '' : 'self-end'}`}
        style={{ color: T.muted }}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <PanelRightClose size={15} /> : <PanelLeftClose size={15} />}
      </button>

      {collapsed ? (
        <div className="w-full space-y-1 pt-2">
          {POST_TYPE_FILTERS.map((item) => {
            const active = filter === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onFilter(item.id)}
                className="w-full py-2 rounded-lg border-l-2 inline-flex items-center justify-center transition-colors hover:bg-white/5"
                style={{
                  borderLeftColor: active ? '#3b82f6' : 'transparent',
                  backgroundColor: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color: T.text,
                }}
                title={item.label}
              >
                <Icon size={16} strokeWidth={1.5} style={{ color: T.muted }} />
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <div className="w-full pt-2">
            <button
              type="button"
              onClick={() => setFeedsOpen((prev) => !prev)}
              className="w-full px-3 pt-4 pb-1 inline-flex items-center justify-between"
            >
              <span className="text-xs uppercase tracking-widest" style={{ color: T.muted }}>FEEDS</span>
              {feedsOpen ? <ChevronDown size={14} style={{ color: T.muted }} /> : <ChevronRight size={14} style={{ color: T.muted }} />}
            </button>

            <AnimatePresence initial={false}>
              {feedsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-0.5">
                    {POST_TYPE_FILTERS.map((item) => {
                      const active = filter === item.id;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onFilter(item.id)}
                          className="w-full py-2 px-3 rounded-lg border-l-2 inline-flex items-center gap-3 text-sm font-normal transition-colors hover:bg-white/5"
                          style={{
                            borderLeftColor: active ? '#3b82f6' : 'transparent',
                            backgroundColor: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                            color: T.text,
                          }}
                        >
                          <Icon size={16} strokeWidth={1.5} style={{ color: T.muted }} />
                          <span style={{ color: T.text }}>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="w-full border-t border-white/5 py-3">
            <div className="px-3 pt-4 pb-1 text-xs uppercase tracking-widest" style={{ color: T.muted }}>COMMUNITY LANES</div>
            <div className="space-y-0.5">
              {LEFT_RAIL_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="w-full py-2 px-3 rounded-lg inline-flex items-center gap-3 text-sm font-normal transition-colors hover:bg-white/5"
                    style={{ color: T.text }}
                  >
                    <span className="inline-flex items-center gap-3">
                      <Icon size={16} strokeWidth={1.5} style={{ color: T.muted }} />
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="w-full border-t border-white/5 py-3">
            <div className="px-3 pt-4 pb-1 text-xs uppercase tracking-widest" style={{ color: T.muted }}>QUICK TAGS</div>
            <div className="px-3 pt-1 flex flex-wrap gap-1.5">
              {QUICK_TAGS.map((tag) => (
                <span key={tag} className="rounded-full px-2.5 py-0.5 text-xs" style={{ color: T.muted, backgroundColor: 'rgba(255,255,255,0.05)' }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </motion.aside>
  );
};

const SidebarSection = ({
  title,
  icon: Icon,
  open,
  onToggle,
  onToggleVisibility,
  children,
  subtitle,
  headerMeta,
  onDragHandlePointerDown,
  isDragging = false,
}) => {
  const VisibilityIcon = onToggleVisibility ? X : EyeOff;

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: T.border, backgroundColor: 'rgba(13,17,23,0.68)' }}>
      <div className="px-3 py-2.5 border-b flex items-center justify-between gap-2" style={{ borderColor: T.border }}>
        <div className="inline-flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            onPointerDown={(event) => {
              if (!onDragHandlePointerDown) return;
              event.preventDefault();
              onDragHandlePointerDown(event);
            }}
            className={`h-6 w-6 rounded-md inline-flex items-center justify-center transition-colors hover:bg-white/5 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{ color: '#7d8590' }}
            title="Drag to reorder"
            aria-label={`Drag ${title}`}
          >
            <GripVertical size={16} strokeWidth={1.5} className="h-4 w-4" />
          </button>

          <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left">
            <div className="text-xs uppercase tracking-[0.14em] inline-flex items-center gap-1.5" style={{ color: T.muted }}>
              <Icon size={12} />
              <span>{title}</span>
              {headerMeta ? (
                <span className="normal-case tracking-normal text-xs" style={{ color: T.muted }}>
                  {headerMeta}
                </span>
              ) : null}
            </div>
            {subtitle ? <div className="text-[11px]" style={{ color: T.muted }}>{subtitle}</div> : null}
          </button>
        </div>

        <div className="inline-flex items-center gap-1.5">
          {onToggleVisibility ? (
            <button
              type="button"
              onClick={onToggleVisibility}
              className="h-6 w-6 rounded-md inline-flex items-center justify-center hover:bg-white/5"
              style={{ color: T.muted }}
              title="Hide section"
              aria-label={`Hide ${title}`}
            >
              <VisibilityIcon size={14} strokeWidth={1.5} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onToggle}
            className="h-6 w-6 rounded-md inline-flex items-center justify-center"
            style={{ color: T.muted }}
            title={open ? 'Collapse section' : 'Expand section'}
            aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
          >
            {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const DraggableSidebarSection = ({
  sectionId,
  isDragging,
  onDragStateChange,
  children,
  ...sectionProps
}) => {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      as="div"
      value={sectionId}
      dragListener={false}
      dragControls={dragControls}
      layout
      whileDrag={{
        scale: 1.02,
        boxShadow: '0 0 12px rgba(59,130,246,0.3)',
        zIndex: 30,
      }}
      transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 0.7 }}
      className="list-none"
      style={{ position: 'relative' }}
      onDragStart={() => onDragStateChange(sectionId)}
      onDragEnd={() => onDragStateChange(null)}
    >
      <SidebarSection
        {...sectionProps}
        isDragging={isDragging}
        onDragHandlePointerDown={(event) => dragControls.start(event)}
      >
        {children}
      </SidebarSection>
    </Reorder.Item>
  );
};

const RightSidebar = ({
  streamStatus,
  quoteMap,
  trackedSymbols,
  trendingSlips,
  topWins,
  topLosses,
  onSelectSnapshot,
}) => {
  const [openSections, setOpenSections] = useState({
    'market-pulse': true,
    'market-movers': true,
    trending: true,
    'todays-news': true,
    watchlist: true,
  });
  const [sectionOrder, setSectionOrder] = useState(DEFAULT_SIDEBAR_SECTION_ORDER);
  const [sectionVisibility, setSectionVisibility] = useState(
    normalizeSidebarSectionVisibility(),
  );
  const [layoutPrefsHydrated, setLayoutPrefsHydrated] = useState(false);
  const [draggingSectionId, setDraggingSectionId] = useState(null);
  const [trendPageIndex, setTrendPageIndex] = useState(0);
  const [trendMode, setTrendMode] = useState('live');
  const [trendFlashById, setTrendFlashById] = useState({});
  const [watchlistRows, setWatchlistRows] = useState([]);
  const [watchlistQuery, setWatchlistQuery] = useState('');
  const [watchlistResults, setWatchlistResults] = useState([]);
  const [watchlistSearchLoading, setWatchlistSearchLoading] = useState(false);
  const [watchlistQuoteMap, setWatchlistQuoteMap] = useState({});
  const [todaysNewsRows, setTodaysNewsRows] = useState([]);
  const [todaysNewsLoading, setTodaysNewsLoading] = useState(true);
  const [todaysNewsUpdatedAt, setTodaysNewsUpdatedAt] = useState(null);
  const [todaysNewsClockTick, setTodaysNewsClockTick] = useState(Date.now());
  const previousTrendingIdsRef = useRef([]);
  const trendFlashTimersRef = useRef(new Map());
  const watchlistHydratedRef = useRef(false);
  const previousWatchlistSymbolsRef = useRef([]);
  const watchlistLookupRef = useRef(null);

  const liveSlipRows = useMemo(
    () => sortSnapshotsByNewest(sanitizeTrendingSnapshots(trendingSlips)).slice(0, TRENDING_MAX_ROWS),
    [trendingSlips],
  );

  const pagedLiveRows = useMemo(() => {
    if (liveSlipRows.length === 0) return [];
    const pages = [];
    for (let i = 0; i < liveSlipRows.length; i += TRENDING_BATCH_SIZE) {
      pages.push(liveSlipRows.slice(i, i + TRENDING_BATCH_SIZE));
    }
    return pages;
  }, [liveSlipRows]);

  const activeLiveRows = pagedLiveRows[trendPageIndex] || [];
  const summaryWins = topWins.slice(0, 3);
  const summaryLosses = topLosses.slice(0, 3);
  const todaysNewsUpdatedLabel = useMemo(
    () => formatUpdatedMinutesAgo(todaysNewsUpdatedAt, todaysNewsClockTick),
    [todaysNewsUpdatedAt, todaysNewsClockTick],
  );
  const visibleSectionOrder = useMemo(
    () => sectionOrder.filter((sectionId) => sectionVisibility[sectionId]),
    [sectionOrder, sectionVisibility],
  );
  const hiddenSectionOrder = useMemo(
    () => sectionOrder.filter((sectionId) => !sectionVisibility[sectionId]),
    [sectionOrder, sectionVisibility],
  );
  const watchlistSymbols = useMemo(
    () => watchlistRows.map((row) => row.symbol).filter(Boolean),
    [watchlistRows],
  );
  const fetchWatchlistQuotes = useCallback(async (symbols) => {
    const targetSymbols = [...new Set((Array.isArray(symbols) ? symbols : [symbols]).map(normalizeSymbolKey).filter(Boolean))];
    if (targetSymbols.length === 0) return;

    try {
      const params = new URLSearchParams({ symbols: targetSymbols.join(',') });
      const response = await fetch(`/api/community/market-data?${params.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) return;

      const payload = await response.json().catch(() => ({}));
      const rows = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : [];
      if (rows.length === 0) return;

      setWatchlistQuoteMap((prev) => mergeQuotesFromPayload(rows, prev));
    } catch {
      // keep existing quote cache if bootstrap fetch fails
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const savedOrderRaw = window.localStorage.getItem(SIDEBAR_ORDER_STORAGE_KEY);
      if (savedOrderRaw) {
        setSectionOrder(normalizeSidebarSectionOrder(JSON.parse(savedOrderRaw)));
      }
    } catch {
      setSectionOrder(DEFAULT_SIDEBAR_SECTION_ORDER);
    }

    try {
      const savedVisibilityRaw = window.localStorage.getItem(SIDEBAR_VISIBILITY_STORAGE_KEY);
      if (savedVisibilityRaw) {
        setSectionVisibility(normalizeSidebarSectionVisibility(JSON.parse(savedVisibilityRaw)));
      }
    } catch {
      setSectionVisibility(normalizeSidebarSectionVisibility());
    }

    setLayoutPrefsHydrated(true);
  }, []);

  useEffect(() => {
    if (!layoutPrefsHydrated || typeof window === 'undefined') return;
    window.localStorage.setItem(SIDEBAR_ORDER_STORAGE_KEY, JSON.stringify(sectionOrder));
  }, [layoutPrefsHydrated, sectionOrder]);

  useEffect(() => {
    if (!layoutPrefsHydrated || typeof window === 'undefined') return;
    window.localStorage.setItem(SIDEBAR_VISIBILITY_STORAGE_KEY, JSON.stringify(sectionVisibility));
  }, [layoutPrefsHydrated, sectionVisibility]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedWatchlistRaw = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
      if (!savedWatchlistRaw) {
        watchlistHydratedRef.current = true;
        return;
      }
      const parsed = JSON.parse(savedWatchlistRaw);
      setWatchlistRows(normalizeWatchlistEntries(parsed));
    } catch {
      setWatchlistRows([]);
    } finally {
      watchlistHydratedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!watchlistHydratedRef.current || typeof window === 'undefined') return;
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlistRows));
  }, [watchlistRows]);

  useEffect(() => {
    if (watchlistSymbols.length === 0) {
      previousWatchlistSymbolsRef.current = [];
      return;
    }

    const previousSymbols = previousWatchlistSymbolsRef.current;
    const previousSet = new Set(previousSymbols);
    const addedSymbols = watchlistSymbols.filter((symbol) => !previousSet.has(symbol));
    const symbolsToBootstrap = previousSymbols.length === 0
      ? watchlistSymbols
      : (addedSymbols.length > 0 ? addedSymbols : watchlistSymbols);

    previousWatchlistSymbolsRef.current = watchlistSymbols;
    void fetchWatchlistQuotes(symbolsToBootstrap);
  }, [watchlistSymbols, fetchWatchlistQuotes]);

  useEffect(() => {
    if (watchlistSymbols.length === 0) return undefined;

    const unsubscribeQuotes = subscribeTwelveDataQuotes(watchlistSymbols, (update) => {
      const symbol = normalizeSymbolKey(update?.symbol);
      if (!symbol) return;

      setWatchlistQuoteMap((prev) => {
        const existing = prev[symbol] || {};
        const nextPrice = toMaybeFiniteNumber(update?.price);
        const nextPercent = toMaybeFiniteNumber(update?.percentChange);
        const nextChange = toMaybeFiniteNumber(update?.change);

        return {
          ...prev,
          [symbol]: {
            ...existing,
            symbol,
            name: existing?.name || symbol,
            price: nextPrice ?? existing?.price ?? null,
            percentChange: nextPercent ?? existing?.percentChange ?? null,
            change: nextChange ?? existing?.change ?? null,
            timestamp: update?.timestamp || new Date().toISOString(),
            source: 'ws',
          },
        };
      });
    });

    return () => {
      unsubscribeQuotes?.();
    };
  }, [watchlistSymbols]);

  useEffect(() => {
    let cancelled = false;

    const lookup = async (query) => {
      const trimmedQuery = String(query || '').trim();
      if (!trimmedQuery) {
        setWatchlistResults([]);
        setWatchlistSearchLoading(false);
        return;
      }

      let remoteRows = [];
      try {
        const params = new URLSearchParams({
          q: trimmedQuery,
          limit: String(WATCHLIST_SEARCH_LIMIT),
        });
        const payload = await cachedFetch(
          `/api/community/symbol-search?${params.toString()}`,
          { cache: 'no-store' },
          45_000,
        );
        remoteRows = normalizeWatchlistSearchResults(payload);
      } catch {
        try {
          const payload = await cachedFetch(
            `/api/global-markets/list?market=nyse&q=${encodeURIComponent(trimmedQuery)}&limit=${WATCHLIST_SEARCH_LIMIT}`,
            { cache: 'no-store' },
            45_000,
          );
          remoteRows = normalizeWatchlistSearchResults(payload);
        } catch {
          remoteRows = [];
        }
      }

      if (cancelled) return;

      const existingSymbols = new Set(watchlistRows.map((row) => row.symbol));
      const merged = remoteRows
        .reduce((acc, row) => {
          const entry = normalizeWatchlistEntry(row);
          if (!entry || acc.some((item) => item.symbol === entry.symbol)) return acc;
          acc.push(entry);
          return acc;
        }, [])
        .filter((row) => !existingSymbols.has(row.symbol))
        .slice(0, WATCHLIST_SEARCH_LIMIT);

      setWatchlistResults(merged);
      setWatchlistSearchLoading(false);
    };

    watchlistLookupRef.current = createDebouncedFn((query) => {
      void lookup(query);
    }, 320);

    return () => {
      cancelled = true;
      watchlistLookupRef.current?.cancel?.();
    };
  }, [watchlistRows]);

  useEffect(() => {
    const trimmedQuery = String(watchlistQuery || '').trim();
    if (!trimmedQuery) {
      setWatchlistResults([]);
      setWatchlistSearchLoading(false);
      return;
    }

    setWatchlistSearchLoading(true);
    watchlistLookupRef.current?.call(trimmedQuery);
  }, [watchlistQuery]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const fetchTodaysNews = async ({ silent = false } = {}) => {
      if (!silent) setTodaysNewsLoading(true);

      const endpoints = ['/api/community/todays-news', '/api/community/todays-news.js'];
      for (const endpoint of endpoints) {
        try {
          const payload = await cachedFetch(
            endpoint,
            { cache: 'no-store', signal: controller.signal },
            TODAYS_NEWS_CLIENT_CACHE_MS,
          );
          if (cancelled) return;

          const rows = normalizeTodaysNewsRows(payload?.data || payload);
          if (rows.length === 0) continue;

          setTodaysNewsRows(rows);
          setTodaysNewsUpdatedAt(
            payload?.generatedAt
              || payload?.updatedAt
              || payload?.generated_at
              || new Date().toISOString(),
          );
          setTodaysNewsClockTick(Date.now());
          setTodaysNewsLoading(false);
          return;
        } catch (error) {
          if (error?.name === 'AbortError') return;
        }
      }

      if (!cancelled) {
        setTodaysNewsLoading(false);
      }
    };

    void fetchTodaysNews();
    const refreshTimer = setInterval(() => {
      void fetchTodaysNews({ silent: true });
    }, TODAYS_NEWS_REFRESH_MS);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(refreshTimer);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTodaysNewsClockTick(Date.now());
    }, 60 * 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setTrendPageIndex((prev) => {
      if (pagedLiveRows.length === 0) return 0;
      return prev >= pagedLiveRows.length ? 0 : prev;
    });
  }, [pagedLiveRows.length]);

  useEffect(() => {
    if (!openSections.trending || trendMode !== 'live') return undefined;
    if (pagedLiveRows.length <= 1) return undefined;

    const timer = setInterval(() => {
      setTrendPageIndex((prev) => (prev + 1) % pagedLiveRows.length);
    }, TRENDING_ROTATE_MS);

    return () => clearInterval(timer);
  }, [openSections.trending, trendMode, pagedLiveRows.length]);

  useEffect(() => {
    if (!openSections.trending) {
      setTrendMode('live');
      return undefined;
    }

    let holdTimer = null;
    const cycleTimer = setInterval(() => {
      setTrendMode('summary');
      holdTimer = setTimeout(() => {
        setTrendMode('live');
      }, TRENDING_SUMMARY_DURATION_MS);
    }, TRENDING_SUMMARY_EVERY_MS);

    return () => {
      clearInterval(cycleTimer);
      if (holdTimer) clearTimeout(holdTimer);
    };
  }, [openSections.trending]);

  useEffect(() => {
    const previousIds = previousTrendingIdsRef.current;
    const nextIds = liveSlipRows.map((row) => String(row.id));
    if (previousIds.length === 0) {
      previousTrendingIdsRef.current = nextIds;
      return;
    }

    const previousSet = new Set(previousIds);
    const incomingRows = liveSlipRows.filter((row) => !previousSet.has(String(row.id))).slice(0, TRENDING_BATCH_SIZE);
    if (incomingRows.length > 0) {
      setTrendFlashById((prev) => {
        const next = { ...prev };
        incomingRows.forEach((row) => {
          next[String(row.id)] = toFiniteNumber(row?.pnl) >= 0 ? 'win' : 'loss';
        });
        return next;
      });

      incomingRows.forEach((row) => {
        const key = String(row.id);
        if (trendFlashTimersRef.current.has(key)) {
          clearTimeout(trendFlashTimersRef.current.get(key));
        }
        const timer = setTimeout(() => {
          setTrendFlashById((prev) => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
          });
          trendFlashTimersRef.current.delete(key);
        }, TRENDING_FLASH_MS);
        trendFlashTimersRef.current.set(key, timer);
      });
    }

    previousTrendingIdsRef.current = nextIds;
  }, [liveSlipRows]);

  useEffect(() => () => {
    trendFlashTimersRef.current.forEach((timer) => clearTimeout(timer));
    trendFlashTimersRef.current.clear();
  }, []);

  const toggleSection = (key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const toggleSectionVisibility = (sectionId) => {
    setSectionVisibility((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };
  const handleSectionReorder = (nextVisibleOrder) => {
    setSectionOrder((prevOrder) => {
      const normalizedPrevOrder = normalizeSidebarSectionOrder(prevOrder);
      const visibleSet = new Set(
        normalizedPrevOrder.filter((sectionId) => sectionVisibility[sectionId]),
      );
      const cleanedVisibleOrder = [];

      (Array.isArray(nextVisibleOrder) ? nextVisibleOrder : []).forEach((sectionId) => {
        const id = String(sectionId || '');
        if (!visibleSet.has(id) || cleanedVisibleOrder.includes(id)) return;
        cleanedVisibleOrder.push(id);
      });

      normalizedPrevOrder.forEach((sectionId) => {
        if (visibleSet.has(sectionId) && !cleanedVisibleOrder.includes(sectionId)) {
          cleanedVisibleOrder.push(sectionId);
        }
      });

      let visibleIndex = 0;
      return normalizedPrevOrder.map((sectionId) => {
        if (!sectionVisibility[sectionId]) return sectionId;
        const nextSectionId = cleanedVisibleOrder[visibleIndex];
        visibleIndex += 1;
        return nextSectionId || sectionId;
      });
    });
  };

  const renderQuoteRow = (symbol, label = symbol) => {
    const quote = quoteMap?.[normalizeSymbolKey(symbol)] || null;
    const percent = toMaybeFiniteNumber(quote?.percentChange);
    const moveColor = percent === null ? T.muted : (percent >= 0 ? T.green : T.red);

    return (
      <div
        key={symbol}
        className="rounded-lg border px-2.5 py-2 flex items-center justify-between"
        style={{ borderColor: T.border, backgroundColor: 'rgba(21,27,35,0.65)' }}
      >
        <div className="min-w-0 pr-2">
          <div className="text-xs font-semibold truncate">{label}</div>
          <div className="text-[11px]" style={{ color: T.muted }}>{symbol}</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs font-mono">{quote?.price !== undefined && quote?.price !== null ? formatPrice(quote.price) : '--'}</div>
          <div className="text-[11px] font-mono" style={{ color: moveColor }}>
            {percent === null ? '--' : formatSignedPercent(percent)}
          </div>
        </div>
      </div>
    );
  };

  const addWatchlistSymbol = (row) => {
    const nextEntry = normalizeWatchlistEntry(row);
    if (!nextEntry) return;

    setWatchlistRows((prev) => {
      if (prev.some((item) => item.symbol === nextEntry.symbol)) return prev;
      return [...prev, nextEntry].slice(0, WATCHLIST_MAX_ROWS);
    });
    void fetchWatchlistQuotes([nextEntry.symbol]);
    setWatchlistQuery('');
    setWatchlistResults([]);
    setWatchlistSearchLoading(false);
  };

  const renderWatchlistRow = (entry) => {
    const symbol = normalizeSymbolKey(entry?.symbol);
    if (!symbol) return null;

    const quote = watchlistQuoteMap?.[symbol] || quoteMap?.[symbol] || null;
    const price = toMaybeFiniteNumber(quote?.price);

    return (
      <div
        key={`watchlist-row-${symbol}`}
        className="rounded-lg border px-2.5 py-1.5 flex items-center justify-between gap-2"
        style={{ borderColor: T.border, backgroundColor: 'rgba(21,27,35,0.65)' }}
      >
        <div className="min-w-0">
          <div className="text-xs font-semibold truncate" style={{ color: T.text }}>{symbol}</div>
          <div className="text-xs truncate" style={{ color: T.muted }}>{entry?.name || symbol}</div>
        </div>
        <div className="text-xs font-mono flex-shrink-0" style={{ color: T.text }}>
          {price === null ? '--' : formatPrice(price)}
        </div>
      </div>
    );
  };

  const renderTodaysNewsSourceIcons = (sources = []) => (
    <div className="inline-flex items-center gap-1">
      {(Array.isArray(sources) ? sources : []).slice(0, 3).map((source, idx) => {
        const sourceName = String(source?.name || '').trim();
        const initial = String(source?.initial || sourceName.charAt(0) || '?').toUpperCase();
        const color = source?.color || TODAYS_NEWS_SOURCE_COLORS[idx % TODAYS_NEWS_SOURCE_COLORS.length];

        return (
          <span
            key={`todays-news-source-${sourceName || idx}`}
            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-semibold text-[#0d1117]"
            style={{ backgroundColor: color }}
            title={sourceName}
          >
            {initial}
          </span>
        );
      })}
    </div>
  );

  const renderTodaysNewsSkeletonRows = () => (
    <div className="divide-y divide-white/5">
      {Array.from({ length: 6 }).map((_, idx) => (
        <div key={`todays-news-skeleton-${idx}`} className="py-3 px-2 space-y-1.5">
          <ShimmerLine w="95%" h={13} />
          <ShimmerLine w="72%" h={11} />
          <div className="flex items-center gap-2 pt-1">
            <ShimmerLine w={16} h={16} rounded={999} />
            <ShimmerLine w={16} h={16} rounded={999} />
            <ShimmerLine w="30%" h={10} />
          </div>
        </div>
      ))}
    </div>
  );

  const renderDraggableSection = (sectionId) => {
    if (sectionId === 'market-pulse') {
      return (
        <DraggableSidebarSection
          key={sectionId}
          sectionId={sectionId}
          title="Market Pulse"
          subtitle={streamStatus?.connected ? 'Streaming live prices' : streamStatus?.connecting ? 'Connecting stream' : 'Fallback mode'}
          icon={Activity}
          open={openSections['market-pulse']}
          onToggle={() => toggleSection('market-pulse')}
          onToggleVisibility={() => toggleSectionVisibility('market-pulse')}
          isDragging={draggingSectionId === sectionId}
          onDragStateChange={setDraggingSectionId}
        >
          <div className="space-y-2">
            {INDEX_SYMBOLS.map((item) => renderQuoteRow(item.symbol, item.label))}
          </div>
        </DraggableSidebarSection>
      );
    }

    if (sectionId === 'market-movers') {
      return (
        <DraggableSidebarSection
          key={sectionId}
          sectionId={sectionId}
          title="Market Movers"
          subtitle="Top movers today"
          icon={Eye}
          open={openSections['market-movers']}
          onToggle={() => toggleSection('market-movers')}
          onToggleVisibility={() => toggleSectionVisibility('market-movers')}
          isDragging={draggingSectionId === sectionId}
          onDragStateChange={setDraggingSectionId}
        >
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {trackedSymbols.slice(0, 12).map((symbol) => renderQuoteRow(symbol, symbol))}
          </div>
        </DraggableSidebarSection>
      );
    }

    if (sectionId === 'trending') {
      return (
        <DraggableSidebarSection
          key={sectionId}
          sectionId={sectionId}
          title="Trending"
          subtitle="What the community is watching"
          icon={Trophy}
          open={openSections.trending}
          onToggle={() => toggleSection('trending')}
          onToggleVisibility={() => toggleSectionVisibility('trending')}
          isDragging={draggingSectionId === sectionId}
          onDragStateChange={setDraggingSectionId}
        >
          <AnimatePresence mode="wait" initial={false}>
            {trendMode === 'summary' ? (
              <motion.div
                key="trend-summary"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 18 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-2.5"
              >
                <div>
                  <div className="text-[11px] uppercase tracking-[0.14em] mb-1" style={{ color: T.green }}>Top Wins</div>
                  <div className="divide-y divide-white/5">
                    {summaryWins.length === 0 ? (
                      <div className="py-2 text-xs" style={{ color: T.muted }}>No winning slips yet.</div>
                    ) : summaryWins.map((row) => (
                      <button
                        key={`summary-win-${row.id}`}
                        type="button"
                        onClick={() => onSelectSnapshot?.(row)}
                        className="w-full py-2 text-left"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white truncate">${row.ticker}</div>
                            <div className="text-xs truncate" style={{ color: T.muted }}>{row.author}</div>
                          </div>
                          <span className="font-mono text-sm" style={{ color: T.green }}>{formatSignedCurrency(row.pnl)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] uppercase tracking-[0.14em] mb-1" style={{ color: T.red }}>Top Losses</div>
                  <div className="divide-y divide-white/5">
                    {summaryLosses.length === 0 ? (
                      <div className="py-2 text-xs" style={{ color: T.muted }}>No losing slips yet.</div>
                    ) : summaryLosses.map((row) => (
                      <button
                        key={`summary-loss-${row.id}`}
                        type="button"
                        onClick={() => onSelectSnapshot?.(row)}
                        className="w-full py-2 text-left"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white truncate">${row.ticker}</div>
                            <div className="text-xs truncate" style={{ color: T.muted }}>{row.author}</div>
                          </div>
                          <span className="font-mono text-sm" style={{ color: T.red }}>{formatSignedCurrency(row.pnl)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={`trend-live-${trendPageIndex}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="divide-y divide-white/5"
              >
                {activeLiveRows.length === 0 ? (
                  <div className="py-2 text-xs" style={{ color: T.muted }}>No live slips yet.</div>
                ) : activeLiveRows.map((row, index) => {
                  const flash = trendFlashById[String(row.id)] || null;
                  return (
                    <motion.button
                      key={`trend-live-row-${row.id}`}
                      type="button"
                      onClick={() => onSelectSnapshot?.(row)}
                      className="relative w-full py-2 text-left"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.05 }}
                    >
                      {flash ? (
                        <motion.span
                          key={`${row.id}-flash-${flash}`}
                          className="pointer-events-none absolute inset-0 rounded-sm border"
                          initial={{ opacity: 0.9 }}
                          animate={{ opacity: 0 }}
                          transition={{ duration: TRENDING_FLASH_MS / 1000 }}
                          style={{ borderColor: flash === 'win' ? T.green : T.red }}
                        />
                      ) : null}
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white truncate">${row.ticker}</div>
                          <div className="text-xs truncate" style={{ color: T.muted }}>{row.author}</div>
                        </div>
                        <span
                          className="font-mono text-sm flex-shrink-0"
                          style={{ color: toFiniteNumber(row?.pnl) >= 0 ? T.green : T.red }}
                        >
                          {formatSignedCurrency(row.pnl)}
                        </span>
                      </div>
                    </motion.button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </DraggableSidebarSection>
      );
    }

    if (sectionId === 'todays-news') {
      return (
        <DraggableSidebarSection
          key={sectionId}
          sectionId={sectionId}
          title="TODAY'S NEWS"
          subtitle="Trending on X and the web"
          icon={(iconProps) => <Newspaper {...iconProps} strokeWidth={1.5} />}
          headerMeta={todaysNewsUpdatedLabel}
          open={openSections['todays-news']}
          onToggle={() => toggleSection('todays-news')}
          onToggleVisibility={() => toggleSectionVisibility('todays-news')}
          isDragging={draggingSectionId === sectionId}
          onDragStateChange={setDraggingSectionId}
        >
          {todaysNewsLoading && todaysNewsRows.length === 0 ? (
            renderTodaysNewsSkeletonRows()
          ) : todaysNewsRows.length === 0 ? (
            <div className="py-2 px-2 text-xs" style={{ color: T.muted }}>
              No trending stories available right now.
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {todaysNewsRows.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.url) {
                      window.open(item.url, '_blank', 'noopener,noreferrer');
                    }
                  }}
                  className="w-full py-3 px-2 text-left hover:bg-white/[0.03] transition-colors"
                >
                  <div
                    className="text-sm font-semibold text-[#e6edf3]"
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {item.headline}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap min-w-0">
                    {renderTodaysNewsSourceIcons(item.sources)}
                    <span className="text-xs text-[#58a6ff]">{item.trendingLabel || 'Trending now'}</span>
                    <span className="text-xs text-[#7d8590]">{item.category}</span>
                    <span className="text-xs text-[#7d8590]">{item.postCount}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </DraggableSidebarSection>
      );
    }

    if (sectionId === 'watchlist') {
      const hasWatchlistQuery = String(watchlistQuery || '').trim().length > 0;

      return (
        <DraggableSidebarSection
          key={sectionId}
          sectionId={sectionId}
          title="Watchlist"
          subtitle="Your saved tickers"
          icon={(iconProps) => <Star {...iconProps} strokeWidth={1.5} />}
          open={openSections.watchlist}
          onToggle={() => toggleSection('watchlist')}
          onToggleVisibility={() => toggleSectionVisibility('watchlist')}
          isDragging={draggingSectionId === sectionId}
          onDragStateChange={setDraggingSectionId}
        >
          <div className="space-y-2">
            <div className="relative">
              <input
                type="text"
                value={watchlistQuery}
                onChange={(event) => setWatchlistQuery(event.target.value)}
                placeholder="Add ticker..."
                className="w-full bg-white/5 border border-white/6 rounded-lg text-xs py-1.5 px-3 outline-none focus:ring-1 focus:ring-white/20"
                style={{ color: T.text }}
                aria-label="Add watchlist ticker"
              />
              {hasWatchlistQuery ? (
                <div
                  className="absolute left-0 right-0 top-full mt-1 rounded-lg border overflow-hidden z-20"
                  style={{ borderColor: T.border, backgroundColor: 'rgba(13,17,23,0.98)' }}
                >
                  {watchlistSearchLoading ? (
                    <div className="px-3 py-2 text-xs" style={{ color: T.muted }}>Searching symbols...</div>
                  ) : watchlistResults.length === 0 ? (
                    <div className="px-3 py-2 text-xs" style={{ color: T.muted }}>No symbols found.</div>
                  ) : (
                    <div className="max-h-44 overflow-y-auto divide-y divide-white/5">
                      {watchlistResults.map((row) => (
                        <button
                          key={`watchlist-search-${row.symbol}`}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => addWatchlistSymbol(row)}
                          className="w-full px-3 py-2 text-left hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-xs font-semibold truncate" style={{ color: T.text }}>{row.symbol}</div>
                              <div className="text-xs truncate" style={{ color: T.muted }}>{row.name || row.symbol}</div>
                            </div>
                            <Plus size={12} strokeWidth={1.5} style={{ color: T.muted }} />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {watchlistRows.length === 0 ? (
                <div className="rounded-lg border px-2.5 py-2 text-xs" style={{ borderColor: T.border, color: T.muted }}>
                  Search above to add symbols.
                </div>
              ) : watchlistRows.map((row) => renderWatchlistRow(row))}
            </div>
          </div>
        </DraggableSidebarSection>
      );
    }

    return null;
  };

  return (
    <motion.aside
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22 }}
      className="hidden xl:flex w-[340px] h-full min-h-0 flex-col"
    >
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
        {hiddenSectionOrder.length > 0 ? (
          <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: T.border, backgroundColor: 'rgba(13,17,23,0.68)' }}>
            <div className="text-[11px] uppercase tracking-[0.14em]" style={{ color: T.muted }}>
              Hidden Sections
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {hiddenSectionOrder.map((sectionId) => (
                <button
                  key={`show-section-${sectionId}`}
                  type="button"
                  onClick={() => toggleSectionVisibility(sectionId)}
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs border hover:bg-white/5"
                  style={{ borderColor: T.border, color: T.muted }}
                  title={`Show ${SIDEBAR_SECTION_LABELS[sectionId] || sectionId}`}
                >
                  <EyeOff size={12} strokeWidth={1.5} />
                  <span>{SIDEBAR_SECTION_LABELS[sectionId] || sectionId}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {visibleSectionOrder.length === 0 ? (
          <div className="rounded-xl border px-3 py-4 text-xs" style={{ borderColor: T.border, color: T.muted, backgroundColor: 'rgba(13,17,23,0.68)' }}>
            All sidebar sections are hidden.
          </div>
        ) : (
          <Reorder.Group
            as="div"
            axis="y"
            values={visibleSectionOrder}
            onReorder={handleSectionReorder}
            className="space-y-3"
          >
            {visibleSectionOrder.map((sectionId) => renderDraggableSection(sectionId))}
          </Reorder.Group>
        )}
      </div>
    </motion.aside>
  );
};

// ─── Main Community Page ──────────────────────────────────
const CommunityPage = ({ tradeHistory = [] }) => {
  const [posts, setPosts] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerSubmitting, setComposerSubmitting] = useState(false);
  const [composerInitialType, setComposerInitialType] = useState('post');
  const [quoteMap, setQuoteMap] = useState({});
  const [streamStatus, setStreamStatus] = useState(BASE_STREAM_STATUS);
  const [showcaseTrade, setShowcaseTrade] = useState(null);
  const [aiSearchResults, setAiSearchResults] = useState([]);
  const [aiSearchPending, setAiSearchPending] = useState([]);
  const [cachedTrendingSlips, setCachedTrendingSlips] = useState([]);
  const [cachedTopWins, setCachedTopWins] = useState([]);
  const [cachedTopLosses, setCachedTopLosses] = useState([]);

  const mockFeed = useMemo(() => generateMockFeed(), []);

  const closedTrades = useMemo(
    () => buildClosedTradesForSlip(tradeHistory).slice(0, 140),
    [tradeHistory],
  );

  const prependPost = useCallback((post) => {
    if (!post?.id) return;
    setPosts((prev) => {
      if (prev.some((row) => row.id === post.id)) return prev;
      return [post, ...prev];
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const getUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user || cancelled) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, email')
          .eq('id', user.id)
          .maybeSingle();

        if (cancelled) return;

        setCurrentUser({
          id: user.id,
          email: user.email,
          display_name: profile?.display_name || user.user_metadata?.full_name || user.email?.split('@')[0],
          avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url,
        });
      } catch {
        // anonymous browsing is allowed for mock feed and read-only mode
      }
    };

    void getUser();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const fetchTrendingCache = async () => {
      const endpoints = ['/api/community/trending-slips.js', '/api/community/trending-slips'];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            cache: 'no-store',
            signal: controller.signal,
          });

          if (!response.ok) {
            if (response.status === 404) continue;
            return;
          }

          const payload = await response.json().catch(() => null);
          if (!payload || cancelled) return;

          const slips = sortSnapshotsByNewest(sanitizeTrendingSnapshots(payload?.slips || []));
          const wins = getTopWinningSnapshots(sanitizeTrendingSnapshots(payload?.topWins || []), 8);
          const losses = getTopLosingSnapshots(sanitizeTrendingSnapshots(payload?.topLosses || []), 8);

          if (cancelled) return;
          if (slips.length > 0) setCachedTrendingSlips(slips.slice(0, TRENDING_MAX_ROWS));
          if (wins.length > 0) setCachedTopWins(wins);
          if (losses.length > 0) setCachedTopLosses(losses);
          return;
        } catch (cacheError) {
          if (cacheError?.name === 'AbortError') return;
        }
      }
    };

    void fetchTrendingCache();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const hydratePosts = useCallback((rows) => {
    return (Array.isArray(rows) ? rows : []).map((post) => ({
      ...post,
      is_mock: Boolean(post?.is_mock),
      reaction_summary: buildReactionSummary(post.community_reactions || [], currentUser?.id),
    }));
  }, [currentUser?.id]);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      let { data: rows, error: queryError } = await supabase
        .from('community_posts')
        .select('*, community_reactions(emoji, user_id)')
        .is('parent_id', null)
        .is('parent_post_id', null)
        .order('created_at', { ascending: false })
        .limit(120);

      if (queryError && String(queryError.message || '').includes('community_reactions')) {
        const fallback = await supabase
          .from('community_posts')
          .select('*')
          .is('parent_id', null)
          .is('parent_post_id', null)
          .order('created_at', { ascending: false })
          .limit(120);
        rows = fallback.data;
        queryError = fallback.error;
      }

      if (queryError) throw queryError;

      const userIds = [...new Set((rows || []).map((row) => row.user_id).filter(Boolean))];
      let profilesMap = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, email')
          .in('id', userIds);

        profilesMap = (profiles || []).reduce((acc, profile) => {
          acc[profile.id] = profile;
          return acc;
        }, {});
      }

      const hydrated = hydratePosts((rows || []).map((post) => ({
        ...post,
        profiles: profilesMap[post.user_id] || null,
      })));

      if (hydrated.length === 0) {
        setPosts(mockFeed);
      } else {
        setPosts(hydrated);
      }
    } catch {
      setPosts(mockFeed);
      setError('Using offline mock feed while live community data is unavailable.');
    } finally {
      setLoading(false);
    }
  }, [hydratePosts, mockFeed]);

  useEffect(() => {
    void fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    const channel = supabase
      .channel('community-feed-rebuild-v2')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'community_posts',
          filter: 'parent_id=is.null',
        },
        async (payload) => {
          try {
            const insertedId = payload?.new?.id;
            if (!insertedId) return;

            const { data: inserted } = await supabase
              .from('community_posts')
              .select('*, community_reactions(emoji, user_id)')
              .eq('id', insertedId)
              .maybeSingle();

            if (!inserted) return;

            let profile = null;
            if (inserted.user_id) {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('id, display_name, avatar_url, email')
                .eq('id', inserted.user_id)
                .maybeSingle();
              profile = profileData;
            }

            prependPost({
              ...inserted,
              profiles: profile,
              reaction_summary: buildReactionSummary(inserted.community_reactions || [], currentUser?.id),
              is_mock: false,
            });
          } catch {
            // ignore realtime transient failures
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'community_posts',
        },
        (payload) => {
          const id = payload?.old?.id;
          if (!id) return;
          setPosts((prev) => prev.filter((post) => post.id !== id));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, prependPost]);

  const trackedSymbols = useMemo(() => {
    const set = new Set([...DEFAULT_TICKERS, ...INDEX_SYMBOLS.map((item) => item.symbol)]);
    mentionSymbolsFromPosts(posts).forEach((symbol) => set.add(symbol));
    return [...set].map(normalizeSymbolKey).filter(Boolean).slice(0, 48);
  }, [posts]);

  const previousTrackedSymbolsRef = useRef([]);

  const refreshQuotesFromCache = useCallback(async (symbols) => {
    const targetSymbols = [...new Set(
      (Array.isArray(symbols) ? symbols : [symbols]).map(normalizeSymbolKey).filter(Boolean)
    )];
    if (targetSymbols.length === 0) return;

    try {
      const params = new URLSearchParams({ symbols: targetSymbols.join(',') });
      const response = await fetch(`/api/community/market-data?${params.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) return;

      const payload = await response.json().catch(() => ({}));
      const rows = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : [];

      if (rows.length > 0) {
        setQuoteMap((prev) => mergeQuotesFromPayload(rows, prev));
      }
    } catch {
      // keep websocket data if cache bootstrap fails
    }
  }, []);

  useEffect(() => {
    if (trackedSymbols.length === 0) return;

    const previousSymbols = previousTrackedSymbolsRef.current;
    const previousSet = new Set(previousSymbols);
    const addedSymbols = trackedSymbols.filter((symbol) => !previousSet.has(symbol));
    const symbolsToBootstrap = previousSymbols.length === 0
      ? trackedSymbols
      : (addedSymbols.length > 0 ? addedSymbols : trackedSymbols);

    previousTrackedSymbolsRef.current = trackedSymbols;
    void refreshQuotesFromCache(symbolsToBootstrap);
  }, [trackedSymbols, refreshQuotesFromCache]);

  useEffect(() => {
    if (trackedSymbols.length === 0) return undefined;

    const unsubscribeQuotes = subscribeTwelveDataQuotes(trackedSymbols, (update) => {
      const symbol = normalizeSymbolKey(update?.symbol);
      if (!symbol) return;

      setQuoteMap((prev) => {
        const existing = prev[symbol] || {};
        const nextPrice = toMaybeFiniteNumber(update?.price);
        const nextPercent = toMaybeFiniteNumber(update?.percentChange);
        const nextChange = toMaybeFiniteNumber(update?.change);

        return {
          ...prev,
          [symbol]: {
            ...existing,
            symbol,
            name: existing?.name || symbol,
            price: nextPrice ?? existing?.price ?? null,
            percentChange: nextPercent ?? existing?.percentChange ?? null,
            change: nextChange ?? existing?.change ?? null,
            timestamp: update?.timestamp || new Date().toISOString(),
            source: 'ws',
          },
        };
      });
    });

    const unsubscribeStatus = subscribeTwelveDataStatus((status) => {
      setStreamStatus(status || BASE_STREAM_STATUS);
    });

    return () => {
      unsubscribeQuotes?.();
      unsubscribeStatus?.();
    };
  }, [trackedSymbols]);

  const createPost = useCallback(async ({ content, postType, metadata = {}, imageFile = null }) => {
    const trimmed = String(content || '').trim();
    if (!trimmed && !imageFile) return false;

    const safeType = sanitizePostType(postType);
    const nowIso = new Date().toISOString();

    if (!currentUser?.id) {
      const localPost = {
        id: `local-post-${Date.now()}`,
        user_id: 'local-user',
        author_name: 'Guest Trader',
        content: trimmed,
        image_url: null,
        ticker_mentions: extractTickers(trimmed),
        post_type: safeType,
        metadata,
        created_at: nowIso,
        likes_count: 0,
        replies_count: 0,
        community_reactions: [],
        reaction_summary: [],
        profiles: {
          id: 'local-user',
          display_name: 'Guest Trader',
          avatar_url: null,
          email: null,
        },
        is_mock: true,
      };
      prependPost(localPost);
      return true;
    }

    setComposerSubmitting(true);

    try {
      let imageUrl = null;

      if (imageFile) {
        const extension = String(imageFile.name || 'png').split('.').pop();
        const fileName = `${currentUser.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from('community-images')
          .upload(fileName, imageFile);

        if (!uploadError) {
          const {
            data: { publicUrl },
          } = supabase.storage.from('community-images').getPublicUrl(fileName);
          imageUrl = publicUrl;
        }
      }

      const { data: inserted, error: insertError } = await supabase
        .from('community_posts')
        .insert({
          user_id: currentUser.id,
          author_name: currentUser.display_name || currentUser.email?.split('@')[0] || 'Trader',
          content: trimmed,
          image_url: imageUrl,
          ticker_mentions: extractTickers(trimmed),
          post_type: safeType,
          metadata,
        })
        .select('*')
        .single();

      if (insertError) throw insertError;

      prependPost({
        ...inserted,
        community_reactions: [],
        reaction_summary: [],
        profiles: {
          id: currentUser.id,
          display_name: currentUser.display_name,
          avatar_url: currentUser.avatar_url,
          email: currentUser.email,
        },
        is_mock: false,
      });

      return true;
    } catch {
      const fallbackLocal = {
        id: `local-post-${Date.now()}`,
        user_id: currentUser.id,
        author_name: currentUser.display_name || currentUser.email?.split('@')[0] || 'Trader',
        content: trimmed,
        image_url: null,
        ticker_mentions: extractTickers(trimmed),
        post_type: safeType,
        metadata,
        created_at: nowIso,
        likes_count: 0,
        replies_count: 0,
        community_reactions: [],
        reaction_summary: [],
        profiles: {
          id: currentUser.id,
          display_name: currentUser.display_name,
          avatar_url: currentUser.avatar_url,
          email: currentUser.email,
        },
        is_mock: true,
      };
      prependPost(fallbackLocal);
      setError('Post saved locally. Supabase insert failed.');
      return true;
    } finally {
      setComposerSubmitting(false);
    }
  }, [currentUser, prependPost]);

  const handleDeletePost = async (postId, isMock) => {
    const confirmed = window.confirm('Delete this post?');
    if (!confirmed) return;

    setPosts((prev) => prev.filter((post) => post.id !== postId));

    if (isMock) return;

    try {
      await supabase.from('community_posts').delete().eq('id', postId);
    } catch {
      // no-op: optimistic local delete already applied
    }
  };

  const runAiSearch = useCallback(async (queryText) => {
    const trimmedQuery = normalizeAiSearchQuery(queryText);
    if (!trimmedQuery) return false;

    const queryKey = trimmedQuery.toLowerCase();
    const cached = getClientAiSearchCached(queryKey);
    if (cached) {
      setAiSearchResults((prev) => [{
        ...cached,
        id: `ai-search-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        query: trimmedQuery,
        createdAt: new Date().toISOString(),
      }, ...prev]);
      return true;
    }

    setAiSearchPending((prev) => (
      prev.some((row) => row.key === queryKey)
        ? prev
        : [{ key: queryKey, query: trimmedQuery }, ...prev]
    ));

    let request = AI_SEARCH_INFLIGHT.get(queryKey);
    if (!request) {
      request = fetch('/api/community/ai-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trimmedQuery,
          interests: {
            trackedSymbols: trackedSymbols.slice(0, 12),
            filter,
            signedIn: Boolean(currentUser?.id),
          },
        }),
      })
        .then(async (response) => {
          if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            const errorText = String(payload?.error || `AI search failed (${response.status})`).trim();
            throw new Error(errorText);
          }
          return response.json();
        })
        .finally(() => {
          AI_SEARCH_INFLIGHT.delete(queryKey);
        });

      AI_SEARCH_INFLIGHT.set(queryKey, request);
    }

    try {
      const payload = await request;
      const cleaned = sanitizeAiSearchData(payload?.data || payload, trimmedQuery);
      setClientAiSearchCached(queryKey, cleaned);

      setAiSearchResults((prev) => [{
        ...cleaned,
        id: `ai-search-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        query: trimmedQuery,
        createdAt: new Date().toISOString(),
      }, ...prev]);

      return true;
    } catch (searchError) {
      setError(String(searchError?.message || 'AI search is temporarily unavailable.'));
      return false;
    } finally {
      setAiSearchPending((prev) => prev.filter((row) => row.key !== queryKey));
    }
  }, [currentUser?.id, filter, trackedSymbols]);

  const clearAiSearchResult = useCallback((id) => {
    setAiSearchResults((prev) => prev.filter((row) => row.id !== id));
  }, []);

  const filteredPosts = useMemo(() => {
    let rows = [...posts];

    if (filter !== 'all') {
      rows = rows.filter((post) => sanitizePostType(post.post_type) === filter);
    }

    const query = search.trim().toLowerCase();
    if (query) {
      rows = rows.filter((post) => {
        const author = String(post?.profiles?.display_name || post?.author_name || '').toLowerCase();
        const content = String(post?.content || '').toLowerCase();
        const ticker = String(post?.metadata?.ticker || '').toLowerCase();
        return author.includes(query) || content.includes(query) || ticker.includes(query);
      });
    }

    return rows;
  }, [posts, filter, search]);

  const liveTodaySnapshots = useMemo(() => (
    sortSnapshotsByNewest(
      posts
        .filter((post) => !post?.is_mock)
        .map((post) => normalizePnlShareSnapshot(post))
        .filter(Boolean)
        .filter((snapshot) => isSnapshotFromToday(snapshot))
    ).slice(0, TRENDING_MAX_ROWS)
  ), [posts]);

  const trendingSlips = useMemo(() => (
    liveTodaySnapshots.length > 0
      ? liveTodaySnapshots
      : sortSnapshotsByNewest(cachedTrendingSlips).slice(0, TRENDING_MAX_ROWS)
  ), [liveTodaySnapshots, cachedTrendingSlips]);

  const topWins = useMemo(() => (
    liveTodaySnapshots.length > 0
      ? getTopWinningSnapshots(liveTodaySnapshots, 8)
      : (cachedTopWins.length > 0
          ? getTopWinningSnapshots(cachedTopWins, 8)
          : getTopWinningSnapshots(trendingSlips, 8))
  ), [liveTodaySnapshots, cachedTopWins, trendingSlips]);

  const topLosses = useMemo(() => (
    liveTodaySnapshots.length > 0
      ? getTopLosingSnapshots(liveTodaySnapshots, 8)
      : (cachedTopLosses.length > 0
          ? getTopLosingSnapshots(cachedTopLosses, 8)
          : getTopLosingSnapshots(trendingSlips, 8))
  ), [liveTodaySnapshots, cachedTopLosses, trendingSlips]);

  const openComposer = (type = 'post') => {
    setComposerInitialType(type);
    setComposerOpen(true);
  };
  const hasAiSearchCards = aiSearchPending.length > 0 || aiSearchResults.length > 0;

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ backgroundColor: T.bg, color: T.text }}>
      <style>{COMMUNITY_PAGE_STYLES}</style>

      <div className="pointer-events-none absolute inset-0" style={{
        backgroundImage: 'radial-gradient(circle at 8% 2%, rgba(88,166,255,0.16), transparent 38%), radial-gradient(circle at 92% 96%, rgba(63,185,80,0.14), transparent 42%), radial-gradient(circle at 44% 46%, rgba(248,81,73,0.08), transparent 52%)',
      }} />

      <motion.div className="relative z-10 h-full flex flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        {error ? (
          <div className="px-4 pt-2">
            <div className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'rgba(248,81,73,0.35)', color: T.red, backgroundColor: 'rgba(248,81,73,0.08)' }}>
              {error}
            </div>
          </div>
        ) : null}

        <div className="flex-1 min-h-0 py-0 pr-0 pl-0">
          <div className="h-full flex min-h-0">
            <LeftRail
              collapsed={leftCollapsed}
              onToggleCollapse={() => setLeftCollapsed((prev) => !prev)}
              filter={filter}
              onFilter={setFilter}
            />

            <div className="flex-1 min-w-0 min-h-0 overflow-y-hidden overflow-x-visible flex flex-col">
              <FeedHeader
                search={search}
                onSearch={setSearch}
                onOpenComposer={() => openComposer('post')}
              />

              <div className="flex-1 min-h-0 flex gap-3 pt-3 pr-4">
                <div className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col">
                  <div className="flex-1 min-h-0 overflow-y-auto px-3">
                    <div className="max-w-3xl mx-auto w-full space-y-2">
                      {aiSearchPending.map((pending) => (
                        <AiSearchLoadingCard key={`ai-search-pending-${pending.key}`} query={pending.query} />
                      ))}

                      {aiSearchResults.map((result) => (
                        <AiSearchResultCard
                          key={result.id}
                          result={result}
                          onClear={() => clearAiSearchResult(result.id)}
                          onTickerClick={(ticker) => {
                            void runAiSearch(`What is happening with ${ticker} today?`);
                          }}
                        />
                      ))}

                      {loading ? (
                        <>
                          {Array.from({ length: 6 }).map((_, index) => (
                            <div
                              key={`loading-${index}`}
                              className="rounded-lg border p-3"
                              style={{ borderColor: T.border, backgroundColor: T.card }}
                            >
                              <div className="flex gap-2">
                                <ShimmerLine w={32} h={32} rounded={999} />
                                <div className="flex-1 space-y-2">
                                  <ShimmerLine w="35%" h={11} />
                                  <ShimmerBlock lines={3} />
                                </div>
                              </div>
                            </div>
                          ))}
                        </>
                      ) : filteredPosts.length === 0 ? (
                        <div
                          className={hasAiSearchCards ? 'rounded-lg border p-3 text-sm' : 'h-full flex items-center justify-center text-sm'}
                          style={{ color: T.muted, borderColor: hasAiSearchCards ? T.border : 'transparent', backgroundColor: hasAiSearchCards ? T.card : 'transparent' }}
                        >
                          No posts match this filter.
                        </div>
                      ) : (
                        <motion.div variants={FEED_VARIANTS} initial="hidden" animate="show" className="space-y-2">
                          {filteredPosts.map((post) => (
                            <PostCard
                              key={post.id}
                              post={post}
                              currentUser={currentUser}
                              onDelete={handleDeletePost}
                            />
                          ))}
                        </motion.div>
                      )}
                    </div>
                  </div>

                  <div className="px-3 pb-3 pt-3">
                    <ChatInputBar
                      currentUser={currentUser}
                      trackedSymbols={trackedSymbols}
                      quoteMap={quoteMap}
                      streamStatus={streamStatus}
                      onOpenComposer={() => openComposer('post')}
                      onSend={(content) => createPost({ content, postType: 'post', metadata: {} })}
                      onSearch={runAiSearch}
                    />
                  </div>
                </div>

                <RightSidebar
                  streamStatus={streamStatus}
                  quoteMap={quoteMap}
                  trackedSymbols={trackedSymbols}
                  trendingSlips={trendingSlips}
                  topWins={topWins}
                  topLosses={topLosses}
                  onSelectSnapshot={setShowcaseTrade}
                />
              </div>
            </div>
          </div>
        </div>

      </motion.div>

      <PostComposerModal
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        currentUser={currentUser}
        closedTrades={closedTrades}
        submitting={composerSubmitting}
        initialPostType={composerInitialType}
        onSubmit={createPost}
      />

      <PnlShowcaseOverlay snapshot={showcaseTrade} onClose={() => setShowcaseTrade(null)} />
    </div>
  );
};

export default CommunityPage;
