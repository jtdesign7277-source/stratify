import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion';
import EmojiPicker, { EmojiGlyph } from './EmojiPicker';
import { subscribeTwelveDataQuotes, subscribeTwelveDataStatus } from '../../services/twelveDataWebSocket';
import { cachedFetch, createDebouncedFn } from '../../utils/apiCache';
import {
  Heart, MessageCircle, Send, X, TrendingUp, BarChart3, Bell, BellOff, Brain,
  MoreHorizontal, Trash2, Loader2, Camera, SmilePlus, CalendarDays, Clock3,
  Copy, ExternalLink, ChevronDown, ChevronRight, Home, Flame, Newspaper, Globe,
  Compass, Users, Star, ArrowDown, ArrowLeftRight, PanelLeftClose, PanelRightClose, Sparkles,
  Plus, Wand2, Pencil,
  EyeOff, GripVertical, CornerDownLeft,
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

const MARKET_MOVER_SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'META', 'AMZN', 'AMD', 'GOOGL'];
const DEFAULT_TICKERS = [...MARKET_MOVER_SYMBOLS, 'BTC/USD', 'ETH/USD', 'SPY', 'QQQ'];
const AI_SEARCH_CLIENT_CACHE_TTL = 15 * 60 * 1000;
const AI_SEARCH_CLIENT_CACHE = new Map();
const AI_SEARCH_INFLIGHT = new Map();
const PROFILE_AVATAR_STYLES = ['bottts', 'avataaars', 'pixel-art', 'fun-emoji'];
const PROFILE_AVATAR_SEEDS_PER_STYLE = 24;
const PROFILE_AVATAR_BACKGROUND_COLORS = 'b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf';
const PROFILE_AVATAR_FALLBACK_COLOR = '#58a6ff';
const QUICK_POST_HASHTAGS = ['#earnings', '#momentum', '#macro', '#options', '#sentiment'];
const USER_AVATAR_SEED_STORAGE_KEY = 'stratify_user_avatar_seed';
const USER_AVATAR_URL_STORAGE_KEY = 'stratify_user_avatar_url';
const DISPLAY_NAME_STORAGE_KEY = 'stratify_display_name';
const HASHTAG_WEB_CACHE_STORAGE_KEY = 'stratify_hashtag_cache';
const HASHTAG_WEB_CACHE_TTL_MS = 2 * 60 * 60 * 1000;

const buildProfileAvatarUrl = (style, seed) => (
  `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}&size=128&radius=50&backgroundType=gradientLinear&backgroundColor=${PROFILE_AVATAR_BACKGROUND_COLORS}`
);

const PROFILE_PICKER_AVATAR_OPTIONS = PROFILE_AVATAR_STYLES.flatMap((style) => (
  Array.from(
    { length: PROFILE_AVATAR_SEEDS_PER_STYLE },
    (_, i) => buildProfileAvatarUrl(style, `stratify-${style}-${i + 1}`),
  )
));

const hashString = (value) => (
  String(value || '')
    .split('')
    .reduce((acc, char) => ((acc * 31) + char.charCodeAt(0)) >>> 0, 7)
);

const normalizeAvatarColor = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw}`;
  return null;
};

const getAvatarSeed = (user) => (
  String(
    user?.display_name
    || user?.author_name
    || user?.username
    || user?.handle
    || user?.email
    || user?.id
    || 'stratify-user'
  ).trim()
);

const buildCurrentUserAvatarUrl = (seed) => (
  `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(String(seed || 'Anonymous').trim() || 'Anonymous')}`
);

const readCurrentUserAvatar = (fallbackSeed = 'Anonymous') => {
  const safeFallbackSeed = String(fallbackSeed || 'Anonymous').trim() || 'Anonymous';
  if (typeof window === 'undefined') {
    return { seed: safeFallbackSeed, url: buildCurrentUserAvatarUrl(safeFallbackSeed) };
  }

  let storedSeed = '';
  let storedDisplayName = '';
  let storedUrl = '';
  try {
    storedSeed = String(window.localStorage.getItem(USER_AVATAR_SEED_STORAGE_KEY) || '').trim();
    storedDisplayName = String(window.localStorage.getItem(DISPLAY_NAME_STORAGE_KEY) || '').trim();
    storedUrl = String(window.localStorage.getItem(USER_AVATAR_URL_STORAGE_KEY) || '').trim();
  } catch {
    // localStorage sync is best effort only
  }

  const seed = storedSeed || storedDisplayName || safeFallbackSeed;
  const url = storedUrl || buildCurrentUserAvatarUrl(seed);
  return { seed, url };
};

const getResolvedAvatarUrl = (user) => {
  const rawAvatarUrl = String(user?.avatar_url || '').trim();
  if (rawAvatarUrl && !/ui-avatars\.com/i.test(rawAvatarUrl)) {
    return rawAvatarUrl;
  }

  if (PROFILE_PICKER_AVATAR_OPTIONS.length === 0) return '';
  const seed = getAvatarSeed(user).toLowerCase();
  const index = hashString(seed) % PROFILE_PICKER_AVATAR_OPTIONS.length;
  return PROFILE_PICKER_AVATAR_OPTIONS[index];
};

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

const extractHashtags = (text) => {
  const matches = String(text || '').match(/#[A-Za-z][A-Za-z0-9_-]*/g);
  return matches
    ? [...new Set(matches.map((tag) => String(tag || '').trim().toLowerCase().replace(/^#/, '')).filter(Boolean))]
    : [];
};

const highlightTickers = (text) => {
  return text.replace(
    /\$([A-Z]{1,6})/g,
    '<span class="text-[#58a6ff] font-semibold cursor-pointer hover:underline">$$$1</span>'
  );
};

const normalizeAiSearchQuery = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

const generateSuggestions = (query) => {
  if (!query || query.trim().length < 2) return [];
  const q = query.trim();
  return [
    q + ' stock news today',
    q + ' price prediction',
    q + ' earnings report',
    q + ' market analysis',
    'What is happening with ' + q + ' today?',
  ];
};

const POST_TYPE_CONFIG = {
  general: {
    label: 'General',
    icon: MessageCircle,
    placeholder: 'Quick post... use $ for ticker suggestions',
    badge: null,
  },
  pnl: {
    label: 'P&L',
    icon: TrendingUp,
    placeholder: 'Share your gains or losses...',
    badge: {
      backgroundColor: 'rgba(63,185,80,0.14)',
      borderColor: 'rgba(63,185,80,0.38)',
      color: '#3fb950',
    },
  },
  strategy: {
    label: 'Strategy',
    icon: Brain,
    placeholder: 'Drop a strategy or setup...',
    badge: {
      backgroundColor: 'rgba(163,113,247,0.16)',
      borderColor: 'rgba(163,113,247,0.38)',
      color: '#c297ff',
    },
  },
  trade: {
    label: 'Trade',
    icon: ArrowLeftRight,
    placeholder: 'Log a trade entry or exit...',
    badge: {
      backgroundColor: 'rgba(88,166,255,0.14)',
      borderColor: 'rgba(88,166,255,0.38)',
      color: '#58a6ff',
    },
  },
  alert: {
    label: 'Alert',
    icon: Bell,
    placeholder: 'Share a price alert or signal...',
    badge: {
      backgroundColor: 'rgba(240,136,62,0.16)',
      borderColor: 'rgba(240,136,62,0.4)',
      color: '#f0883e',
    },
  },
  earnings: {
    label: 'Earnings',
    icon: BarChart3,
    placeholder: 'Earnings play or reaction...',
    badge: {
      backgroundColor: 'rgba(210,153,34,0.16)',
      borderColor: 'rgba(210,153,34,0.42)',
      color: '#d29922',
    },
  },
  macro: {
    label: 'Macro',
    icon: Globe,
    placeholder: 'Macro take or market outlook...',
    badge: {
      backgroundColor: 'rgba(88,166,255,0.16)',
      borderColor: 'rgba(88,166,255,0.4)',
      color: '#58a6ff',
    },
  },
};

const POST_TYPE_ORDER = ['general', 'pnl', 'strategy', 'trade', 'alert', 'earnings', 'macro'];
const LEGACY_POST_TYPE_MAP = {
  post: 'general',
  pnl_share: 'pnl',
  strategy_share: 'strategy',
  trade_share: 'trade',
  alert_share: 'alert',
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
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
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

const SIDEBAR_ORDER_STORAGE_KEY = 'stratify-community-sidebar-order';
const SIDEBAR_VISIBILITY_STORAGE_KEY = 'stratify-community-sidebar-visibility';
const WATCHLIST_STORAGE_KEY = 'stratify-community-watchlist';
const PRICE_ALERTS_STORAGE_KEY = 'stratify_price_alerts';
const TODAYS_NEWS_REFRESH_MS = 10 * 60 * 1000;
const TODAYS_NEWS_CLIENT_CACHE_MS = 20 * 1000;
const TODAYS_NEWS_MAX_ROWS = 8;
const DEFAULT_SIDEBAR_SECTION_ORDER = ['watchlist', 'todays-news'];
const LEGACY_SIDEBAR_SECTION_ID_MAP = {
  'watch-movers': 'watchlist',
};
const SIDEBAR_SECTION_ID_SET = new Set(DEFAULT_SIDEBAR_SECTION_ORDER);
const SIDEBAR_SECTION_LABELS = {
  watchlist: 'Watchlist',
  'todays-news': 'Today\'s News',
};
const WATCHLIST_MAX_ROWS = 24;
const WATCHLIST_SEARCH_LIMIT = 10;
const TODAYS_NEWS_SOURCE_COLORS = ['#58a6ff', '#3fb950', '#f778ba', '#d29922', '#a371f7', '#f85149', '#58a6ff'];

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

const shareToX = (post) => {
  let text = post.content;
  const pnlValue = Number(post?.metadata?.pnl);
  if (sanitizePostType(post?.post_type) === 'pnl' && Number.isFinite(pnlValue)) {
    const ticker = post?.metadata?.ticker ? `$${post.metadata.ticker}` : 'my trade';
    text = `${ticker} ${formatSignedCurrency(pnlValue)}${Number.isFinite(Number(post?.metadata?.percent)) ? ` (${formatSignedPercent(Number(post.metadata.percent))})` : ''}\n\n${post.content}`;
  }
  text += '\n\nPowered by @StratifyTrading';
  console.log('Share to X clicked (placeholder)', { postId: post?.id, text });
};

const XLogoIcon = ({ className = 'h-3.5 w-3.5' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

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
        backgroundSize: '200% 100%',
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
  const initials = String(user?.display_name || user?.email || user?.author_name || '?')
    .split(/\s+/)
    .map((part) => part?.[0] || '')
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';
  const initialsStyle = initialsClassName ? undefined : { fontSize: size * 0.36 };
  const [imageFailed, setImageFailed] = useState(false);
  const resolvedAvatarUrl = getResolvedAvatarUrl(user);
  const hasImage = Boolean(resolvedAvatarUrl) && !imageFailed;
  const fallbackColor = normalizeAvatarColor(user?.avatar_color) || PROFILE_AVATAR_FALLBACK_COLOR;
  const sizeClass = size === 40
    ? 'w-10 h-10'
    : size === 32
      ? 'w-8 h-8'
      : size === 24
        ? 'w-6 h-6'
        : '';

  useEffect(() => {
    setImageFailed(false);
  }, [resolvedAvatarUrl]);

  if (hasImage) {
    return (
      <img
        src={resolvedAvatarUrl}
        alt={user?.display_name || user?.author_name || 'User'}
        onError={() => setImageFailed(true)}
        className={`rounded-full object-cover flex-shrink-0 border border-white/8 ${sizeClass}`.trim()}
        style={sizeClass ? undefined : { width: size, height: size }}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center flex-shrink-0 border border-white/8 ${sizeClass}`.trim()}
      style={sizeClass ? { backgroundColor: fallbackColor } : { width: size, height: size, backgroundColor: fallbackColor }}
    >
      <span className={`text-white font-bold ${initialsClassName}`.trim()} style={initialsStyle}>{initials}</span>
    </div>
  );
};

// ─── Post Type Badge ──────────────────────────────────────
const PostTypeBadge = ({ type }) => {
  const normalizedType = sanitizePostType(type);
  const config = POST_TYPE_CONFIG[normalizedType];
  if (!config?.badge) return null;
  const Icon = config.icon;
  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-[0.08em] border"
      style={config.badge}
    >
      <Icon size={12} strokeWidth={1.5} />
      <span>{config.label}</span>
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
  const ticker = String(metadata?.ticker || metadata?.symbol || '').trim().toUpperCase();
  const moveClass = isPositive ? 'text-[#3fb950]' : 'text-[#f85149]';

  return (
    <div className="mt-2">
      <div className="flex items-center gap-3 py-1.5 px-2 rounded-md bg-white/3 border border-white/6">
        <span className="text-xs font-medium text-white">
          {ticker ? `$${ticker}` : 'P&L'}
        </span>
        <span className={`text-sm font-semibold ${moveClass}`}>
          {formatSignedCurrency(pnlValue)}
        </span>
        <span className={`ml-auto text-xs font-medium ${moveClass}`}>
          {hasPercent ? formatSignedPercent(percentValue) : '--'}
        </span>
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

const FEED_HASHTAGS = ['#Earnings', '#Momentum', '#Macro', '#Options', '#Sentiment'];
const HASHTAG_WEB_MIN_VISIBLE_POSTS = 3;
const HASHTAG_WEB_MAX_RESULTS = 5;

const normalizeFeedHashtag = (value) => String(value || '').trim().toLowerCase().replace(/^#/, '');
const sanitizeHashtagLabel = (tag) => String(tag || '').trim().replace(/^#/, '');
const postMatchesFeedFilter = (post, activeFeedFilter) => {
  const tag = String(activeFeedFilter || '').toLowerCase().replace('#', '');
  if (!tag) return true;

  const contentMatch = post?.content && String(post.content).toLowerCase().includes(`#${tag}`);
  const hashtagsMatch = Array.isArray(post?.hashtags) && post.hashtags.some((h) => {
    const normalized = String(h || '').toLowerCase().replace(/^#/, '');
    return normalized === tag;
  });
  const typeMatch = post?.post_type && String(post.post_type).toLowerCase() === tag;
  return contentMatch || hashtagsMatch || typeMatch;
};

const BOT_HASHTAG_CONTEXT_BY_TAG = {
  earnings: [
    (symbol) => `$${symbol} earnings setup looks active with traders focused on EPS beats versus guidance quality.`,
    (symbol) => `Watching the earnings call for $${symbol}; one soft margin comment can erase a headline beat fast.`,
    (symbol) => `Quarterly results on $${symbol} are lining up for a volatility move right after management Q&A.`,
    (symbol) => `Positioning into $${symbol} with implied move in mind because earnings revisions keep shifting.`,
  ],
  momentum: [
    (symbol) => `$${symbol} is trying to hold trend above key moving averages with momentum flow still firm.`,
    (symbol) => `Breakout watch on $${symbol} if buyers keep pressing highs with steady relative strength.`,
    (symbol) => `Momentum scanner flagged $${symbol} again as volume expands into a higher-high structure.`,
    (symbol) => `Trend followers are leaning long $${symbol} while pullbacks stay shallow above support.`,
  ],
  macro: [
    () => 'Fed path remains the main driver as treasury yields grind higher into the next inflation print.',
    () => 'Macro tape is rate-sensitive right now with bond volatility spilling into broad equities.',
    () => 'CPI and payroll expectations are moving cross-asset positioning faster than single-name headlines.',
    () => 'Dollar strength and front-end yields are steering risk appetite across growth and cyclicals.',
  ],
  options: [
    (symbol) => `Options flow in $${symbol} is tilted toward calls while IV stays elevated ahead of catalysts.`,
    (symbol) => `Risk-defined spreads on $${symbol} look cleaner than stock here with skew still bid.`,
    (symbol) => `Gamma positioning on $${symbol} could accelerate any break if market makers start chasing deltas.`,
    (symbol) => `IV crush risk remains real on $${symbol} so premium buyers need the move quickly.`,
  ],
  sentiment: [
    (symbol) => `Sentiment around $${symbol} is shifting as social buzz picks up with contrarian desks getting interested.`,
    (symbol) => `Fear/greed tone is still cautious, which can fuel squeezes when sentiment flips too bearish.`,
    (symbol) => `Crowd positioning on $${symbol} looks one-sided; contrarian setups improve when everyone agrees.`,
    (symbol) => `Retail chatter is heating up again and sentiment momentum is turning before price confirms.`,
  ],
};

const getBotHashtagContextLine = (tag, symbol, index) => {
  const normalizedTag = normalizeFeedHashtag(tag);
  const options = BOT_HASHTAG_CONTEXT_BY_TAG[normalizedTag] || [];
  if (options.length === 0) return '';
  const template = options[index % options.length];
  if (typeof template === 'function') return String(template(symbol) || '').trim();
  return String(template || '').trim();
};

const normalizeHashtagWebTickers = (rows = []) => {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : [])
    .map((value) => String(value || '').trim().replace(/^\$/, '').toUpperCase())
    .map((value) => value.replace(/[^A-Z0-9./=-]/g, '').slice(0, 14))
    .filter(Boolean)
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    })
    .slice(0, 6);
};

const normalizeHashtagWebResults = (rows = []) => {
  const deduped = new Set();
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      headline: String(row?.headline || row?.title || '').replace(/\s+/g, ' ').trim(),
      summary: String(row?.summary || row?.description || '').replace(/\s+/g, ' ').trim(),
      source: String(row?.source || row?.publisher || row?.outlet || 'Web').replace(/\s+/g, ' ').trim() || 'Web',
      relatedTickers: normalizeHashtagWebTickers(row?.relatedTickers || row?.tickers || []),
    }))
    .filter((row) => row.headline)
    .filter((row) => {
      const key = row.headline.toLowerCase();
      if (deduped.has(key)) return false;
      deduped.add(key);
      return true;
    })
    .slice(0, HASHTAG_WEB_MAX_RESULTS);
};

const readStoredHashtagWebCache = () => {
  if (typeof window === 'undefined') return {};

  try {
    const saved = window.localStorage.getItem(HASHTAG_WEB_CACHE_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : {};
    const valid = {};
    const now = Date.now();

    Object.keys(parsed || {}).forEach((rawKey) => {
      const key = normalizeFeedHashtag(rawKey);
      if (!key) return;

      const entry = parsed?.[rawKey];
      const timestamp = Number(entry?.timestamp);
      if (!Number.isFinite(timestamp)) return;
      if (now - timestamp >= HASHTAG_WEB_CACHE_TTL_MS) return;

      valid[key] = {
        data: normalizeHashtagWebResults(entry?.data || []),
        timestamp,
      };
    });

    return valid;
  } catch {
    return {};
  }
};

const persistHashtagWebCache = (cache = {}) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HASHTAG_WEB_CACHE_STORAGE_KEY, JSON.stringify(cache || {}));
  } catch {
    // localStorage sync is best effort only
  }
};

const LEFT_RAIL_ITEMS = [
  { id: 'home', label: 'Home Flow', icon: Home },
  { id: 'hot', label: 'Momentum', icon: Flame },
  { id: 'news', label: 'Catalysts', icon: Newspaper },
  { id: 'ideas', label: 'Setups', icon: Compass },
  { id: 'squads', label: 'Rooms', icon: Users },
  { id: 'saved', label: 'Saved', icon: Star },
];

const CREATIVE_MOCK_AUTHOR_NAMES = [
  'FiboFalcon',
  'DayTradeKing',
  'MacroMaven',
  'VWAPViking',
  'VolatilityVera',
  'PremarketPulse',
  'EarningsEdge',
  'SectorSurfer',
  'MomentumMara',
  'OptionsSage',
  'DeltaDuke',
  'CatalystCobra',
];

const HUMAN_MOCK_AUTHOR_NAMES = [
  'Amy_4322',
  'Richard_55',
  'SammySosa88',
  'Lamar14',
  'Jeff_51',
  'Sarah.trades',
  'Mike_NYC',
  'ChrisB_2024',
  'DanielleK',
  'Marcus.J',
  'TraderTom99',
  'NikkiWolf',
];

const buildMockAuthorAvatarUrl = (name) => (
  buildProfileAvatarUrl('bottts', name)
);

const MOCK_AUTHORS = CREATIVE_MOCK_AUTHOR_NAMES
  .flatMap((name, index) => [name, HUMAN_MOCK_AUTHOR_NAMES[index]])
  .filter(Boolean)
  .map((name, index) => ({
    id: `u-${index + 1}`,
    name,
    email: `mock-user-${index + 1}@stratify.community`,
    avatar_url: buildMockAuthorAvatarUrl(name),
  }));

const MOCK_BASE_SETUPS = [
  { symbol: 'NVDA', post_type: 'trade', note: 'Took the opening range reclaim and scaled into strength above prior day high.' },
  { symbol: 'AAPL', post_type: 'strategy', note: 'Running a simple pullback play: first touch of VWAP after extension.' },
  { symbol: 'TSLA', post_type: 'alert', note: 'Put alert at 5-minute trendline break. Watching for failed bounce into resistance.' },
  { symbol: 'MSFT', post_type: 'general', note: 'Institutional bid looked sticky all session. Not forcing entries into chop.' },
  { symbol: 'AMD', post_type: 'trade', note: 'Broke premarket high with volume expansion. Tight stop under trigger candle.' },
  { symbol: 'SPY', post_type: 'macro', note: 'Breadth divergence while index prints highs. Staying selective on longs.' },
  { symbol: 'QQQ', post_type: 'strategy', note: 'Opening drive setup only if first pullback holds above opening print.' },
  { symbol: 'META', post_type: 'alert', note: 'Potential squeeze setup if call flow keeps hitting offer near highs.' },
  { symbol: 'AMZN', post_type: 'trade', note: 'Executed a continuation entry on one-minute consolidation breakout.' },
  { symbol: 'PLTR', post_type: 'general', note: 'Name is noisy but trend intact on higher timeframe. Waiting for cleaner R/R.' },
  { symbol: 'SMCI', post_type: 'alert', note: 'Halting risk elevated. Size down and respect volatility expansion.' },
  { symbol: 'GOOGL', post_type: 'strategy', note: 'Multi-day flag break candidate with clear invalidation below yesterday low.' },
  { symbol: 'NFLX', post_type: 'trade', note: 'Fade attempt failed. Reversed long once sellers could not push lower.' },
  { symbol: 'COIN', post_type: 'macro', note: 'Crypto beta still leading growth. Correlation with BTC remains tight.' },
  { symbol: 'AVGO', post_type: 'trade', note: 'Impulse up leg followed by orderly base. Entered on expansion candle close.' },
  { symbol: 'INTC', post_type: 'strategy', note: 'Mean-reversion only if weak open flushes into major daily support.' },
  { symbol: 'SNOW', post_type: 'earnings', note: 'Watching for relative strength flip against software basket.' },
  { symbol: 'CRM', post_type: 'earnings', note: 'Slow grind trend day. Let winners work and avoid over-trading midday.' },
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

const MODAL_BACKDROP_TRANSITION = {
  duration: 0.2,
  ease: 'easeOut',
};

const MODAL_PANEL_ENTER_TRANSITION = {
  type: 'spring',
  stiffness: 300,
  damping: 25,
  delay: 0.05,
};

const MODAL_PANEL_EXIT_TRANSITION = {
  duration: 0.15,
  ease: 'easeInOut',
};

const OVERLAY_PANEL_TRANSITION = {
  type: 'spring',
  stiffness: 320,
  damping: 26,
  mass: 0.75,
};

const modalSectionMotion = (index = 0) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: {
    delay: 0.1 + (index * 0.03),
    duration: 0.2,
    ease: 'easeOut',
  },
});

const COMMUNITY_PAGE_STYLES = `
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  @keyframes shimmerGradient {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  @keyframes premiumShimmer {
    0% { background-position: 0% 50%; }
    25% { background-position: 50% 100%; }
    50% { background-position: 100% 50%; }
    75% { background-position: 50% 0%; }
    100% { background-position: 0% 50%; }
  }

  @keyframes communityPulse {
    0%, 100% { opacity: 0.18; transform: scale(1); }
    50% { opacity: 0.34; transform: scale(1.08); }
  }

  @keyframes pulseGlow {
    0%, 100% { filter: drop-shadow(0 0 2px rgba(88,166,255,0.3)); }
    50% { filter: drop-shadow(0 0 8px rgba(88,166,255,0.6)); }
  }

  @keyframes alertBellRing {
    0% { transform: rotate(0deg); }
    20% { transform: rotate(16deg); }
    40% { transform: rotate(-12deg); }
    60% { transform: rotate(8deg); }
    80% { transform: rotate(-4deg); }
    100% { transform: rotate(0deg); }
  }

  .community-pulse {
    animation: communityPulse 3.6s ease-in-out infinite;
  }

  .alert-toast-bell {
    transform-origin: top center;
    animation: alertBellRing 0.8s ease-in-out 1;
  }

  #dashboard-topbar-ticker-tape-widget {
    min-height: 56px !important;
    padding-bottom: 16px !important;
    overflow: visible !important;
  }

  .community-minimal-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.1) transparent;
  }

  .community-minimal-scrollbar::-webkit-scrollbar {
    width: 4px;
    height: 4px;
  }

  .community-minimal-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.1);
    border-radius: 999px;
  }

  .community-minimal-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
`;

const SLIP_EMOJI_PRESETS = ['🚀', '💰', '🔥', '📈', '💯', '✅', '⚡', '🧠'];

const AI_REWRITE_STYLE_OPTIONS = [
  { id: 'sharpen', label: 'Sharpen', prompt: 'tighten and make concise' },
  { id: 'professional', label: 'Professional', prompt: 'formal, institutional tone' },
  { id: 'casual', label: 'Casual', prompt: 'relaxed trader slang' },
  { id: 'add-context', label: 'Add Context', prompt: 'Claude adds relevant market data' },
];

const AI_REWRITE_PERSONALITY_OPTIONS = [
  { id: 'confident', label: 'Confident', prompt: 'bold, high conviction, alpha energy' },
  { id: 'big-brain', label: 'Big Brain', prompt: 'analytical, high IQ, data-driven' },
  { id: 'hyped', label: 'Hyped', prompt: 'excited, bullish energy, exclamation points' },
  { id: 'angry', label: 'Angry', prompt: 'frustrated, pissed off, blunt and aggressive' },
  { id: 'chill', label: 'Chill', prompt: 'laid back, zen, unbothered' },
  { id: 'sarcastic', label: 'Sarcastic', prompt: 'witty, dry humor, sharp' },
  { id: 'motivational', label: 'Motivational', prompt: 'inspiring, rally the troops energy' },
  { id: 'degen', label: 'Degen', prompt: 'full WSB degen mode, YOLO energy' },
];

const AI_REWRITE_ACTION_ROW_VARIANTS = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
    },
  },
};

const AI_REWRITE_ACTION_ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 3 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.18,
      ease: 'easeOut',
    },
  },
};

const normalizeSymbolKey = (value) => {
  const raw = String(value || '').trim().toUpperCase().replace(/^\$+/, '');
  if (!raw) return '';
  if (raw.includes(':')) return raw.split(':').pop().replace(/^\$+/, '');
  return raw;
};

const normalizePriceAlertTicker = (value) => {
  const raw = String(value || '').trim().toUpperCase().replace(/\s+/g, '').replace(/^\$+/, '');
  const sanitized = raw.replace(/[^A-Z0-9./=-]/g, '').slice(0, 14);
  return sanitized ? `$${sanitized}` : '';
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
    const existing = next[symbol] || {};
    const price = toMaybeFiniteNumber(row?.price ?? row?.last ?? row?.close);
    const percentChange = toMaybeFiniteNumber(
      row?.dayChangePercent
      ?? row?.day_change_percent
      ?? row?.percentChange
      ?? row?.changePercent
      ?? row?.percent_change
    );
    const rawChange = toMaybeFiniteNumber(row?.change);
    const previousClose = toMaybeFiniteNumber(row?.previousClose ?? row?.previous_close);
    const existingPrice = toMaybeFiniteNumber(existing?.price ?? existing?.last ?? existing?.close);
    const existingPercent = toMaybeFiniteNumber(
      existing?.dayChangePercent
      ?? existing?.day_change_percent
      ?? existing?.percentChange
      ?? existing?.percent_change
    );
    const baselineFromExistingPercent = (
      Number.isFinite(existingPrice)
      && Number.isFinite(existingPercent)
      && existingPercent !== -100
    )
      ? existingPrice / (1 + (existingPercent / 100))
      : null;
    const baselineFromChange = (
      Number.isFinite(price)
      && Number.isFinite(rawChange)
    )
      ? price - rawChange
      : null;
    const baselineFromPercent = (
      Number.isFinite(price)
      && Number.isFinite(percentChange)
      && percentChange !== -100
    )
      ? price / (1 + (percentChange / 100))
      : null;
    const baseline = (
      previousClose
      ?? baselineFromChange
      ?? baselineFromPercent
      ?? toMaybeFiniteNumber(existing?.dayBaselinePrice)
      ?? toMaybeFiniteNumber(existing?.previousClose ?? existing?.previous_close)
      ?? baselineFromExistingPercent
    );
    const derivedChange = (
      Number.isFinite(rawChange)
        ? rawChange
        : (
          Number.isFinite(price)
          && Number.isFinite(baseline)
        )
          ? price - baseline
          : toMaybeFiniteNumber(existing?.change)
    );
    const derivedPercent = (
      Number.isFinite(percentChange)
        ? percentChange
        : (
          Number.isFinite(price)
          && Number.isFinite(baseline)
          && baseline !== 0
        )
          ? ((price - baseline) / baseline) * 100
          : toMaybeFiniteNumber(
            existing?.dayChangePercent
            ?? existing?.day_change_percent
            ?? existing?.percentChange
            ?? existing?.percent_change
          )
    );

    next[symbol] = {
      ...existing,
      symbol,
      name: row?.name || existing?.name || symbol,
      exchange: row?.exchange || existing?.exchange || null,
      price: price ?? existing?.price ?? null,
      percentChange: derivedPercent,
      percent_change: derivedPercent,
      dayChangePercent: derivedPercent,
      day_change_percent: derivedPercent,
      change: derivedChange,
      previousClose: baseline ?? existing?.previousClose ?? null,
      previous_close: baseline ?? existing?.previous_close ?? null,
      dayBaselinePrice: baseline ?? existing?.dayBaselinePrice ?? null,
      timestamp: row?.timestamp || row?.datetime || new Date().toISOString(),
      source: 'rest',
    };
  });
  return next;
};

const mergeStreamQuote = (existingQuote = {}, update = {}, symbol = '') => {
  const nextPrice = toMaybeFiniteNumber(update?.price ?? update?.last ?? update?.close);
  const rawPercent = toMaybeFiniteNumber(
    update?.dayChangePercent
    ?? update?.day_change_percent
    ?? update?.percentChange
    ?? update?.percent_change
    ?? update?.raw?.dayChangePercent
    ?? update?.raw?.day_change_percent
    ?? update?.raw?.percentChange
    ?? update?.raw?.percent_change
  );
  const rawChange = toMaybeFiniteNumber(update?.change ?? update?.raw?.change);
  const streamPreviousClose = toMaybeFiniteNumber(
    update?.raw?.previousClose
    ?? update?.raw?.previous_close
    ?? update?.previousClose
    ?? update?.previous_close
  );
  const existingPrice = toMaybeFiniteNumber(existingQuote?.price ?? existingQuote?.last ?? existingQuote?.close);
  const existingPercent = toMaybeFiniteNumber(
    existingQuote?.dayChangePercent
    ?? existingQuote?.day_change_percent
    ?? existingQuote?.percentChange
    ?? existingQuote?.percent_change
  );
  const baselineFromExistingPercent = (
    Number.isFinite(existingPrice)
    && Number.isFinite(existingPercent)
    && existingPercent !== -100
  )
    ? existingPrice / (1 + (existingPercent / 100))
    : null;

  const baselineFromExisting = (
    toMaybeFiniteNumber(existingQuote?.dayBaselinePrice)
    ?? toMaybeFiniteNumber(existingQuote?.previousClose ?? existingQuote?.previous_close)
    ?? baselineFromExistingPercent
  );
  const baselineFromChange = (
    Number.isFinite(nextPrice)
    && Number.isFinite(rawChange)
  )
    ? nextPrice - rawChange
    : null;
  const baselineFromPercent = (
    Number.isFinite(nextPrice)
    && Number.isFinite(rawPercent)
    && rawPercent !== -100
  )
    ? nextPrice / (1 + (rawPercent / 100))
    : null;
  const baseline = streamPreviousClose ?? baselineFromExisting ?? baselineFromChange ?? baselineFromPercent;

  const derivedChange = (
    Number.isFinite(rawChange)
      ? rawChange
      : (
        Number.isFinite(nextPrice)
        && Number.isFinite(baseline)
      )
        ? nextPrice - baseline
        : toMaybeFiniteNumber(existingQuote?.change)
  );
  const derivedPercent = (
    Number.isFinite(rawPercent)
      ? rawPercent
      : (
        Number.isFinite(nextPrice)
        && Number.isFinite(baseline)
        && baseline !== 0
      )
        ? ((nextPrice - baseline) / baseline) * 100
        : toMaybeFiniteNumber(
          existingQuote?.dayChangePercent
          ?? existingQuote?.day_change_percent
          ?? existingQuote?.percentChange
          ?? existingQuote?.percent_change
        )
  );

  return {
    ...existingQuote,
    symbol,
    name: existingQuote?.name || symbol,
    price: Number.isFinite(nextPrice) ? nextPrice : existingQuote?.price ?? null,
    change: derivedChange,
    percentChange: derivedPercent,
    percent_change: derivedPercent,
    dayChangePercent: derivedPercent,
    day_change_percent: derivedPercent,
    previousClose: baseline ?? existingQuote?.previousClose ?? null,
    previous_close: baseline ?? existingQuote?.previous_close ?? null,
    dayBaselinePrice: baseline ?? existingQuote?.dayBaselinePrice ?? null,
    timestamp: update?.timestamp || new Date().toISOString(),
    source: 'ws',
  };
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
  const normalized = String(type || '').trim().toLowerCase();
  const mapped = LEGACY_POST_TYPE_MAP[normalized] || normalized;
  if (POST_TYPE_ORDER.includes(mapped)) return mapped;
  return 'general';
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
    const author = MOCK_AUTHORS[index % MOCK_AUTHORS.length];
    const createdAt = new Date(now - ((index * 19) + 4) * 60 * 1000).toISOString();
    const reactionRows = makeMockReactionRows(index);
    const shouldBePnl = index % 5 === 0 || index % 11 === 0;

    let postType = sanitizePostType(setup.post_type);
    let content = `${setup.note} Watching $${setup.symbol} into the next session.`;
    let metadata = {};

    if (shouldBePnl) {
      postType = 'pnl';
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
    } else if (postType === 'alert') {
      const trigger = Number((70 + ((index * 9.4) % 360)).toFixed(2));
      metadata = {
        ticker: setup.symbol,
        trigger_price: trigger,
        reason: index % 2 === 0 ? 'Breakout trigger' : 'Breakdown trigger',
      };
      content = `${setup.note} Alert set for $${setup.symbol} at ${formatCurrency(trigger)} with confirmation on volume.`;
    } else if (postType === 'strategy') {
      metadata = {
        ticker: setup.symbol,
        timeframe: index % 2 === 0 ? '5m' : '15m',
        risk_model: index % 3 === 0 ? '0.5R scout' : '1R standard',
      };
      content = `${setup.note} Strategy conditions: liquidity above average and trend alignment in $${setup.symbol}.`;
    } else if (postType === 'trade') {
      metadata = {
        ticker: setup.symbol,
        side: index % 4 === 0 ? 'sell' : 'buy',
        setup: index % 2 === 0 ? 'Opening range break' : 'VWAP reclaim',
      };
      content = `${setup.note} Shared execution details on $${setup.symbol} so the room can compare entries.`;
    } else if (postType === 'earnings') {
      metadata = {
        ticker: setup.symbol,
        timing: index % 2 === 0 ? 'after_close' : 'before_open',
      };
      content = `${setup.note} Earnings focus on $${setup.symbol}: mapping implied move versus expected reaction.`;
    } else if (postType === 'macro') {
      metadata = {
        ticker: setup.symbol,
        theme: index % 2 === 0 ? 'rates' : 'risk-on',
      };
      content = `${setup.note} Macro context is driving $${setup.symbol}; watching rates, breadth, and cross-asset flows.`;
    }

    const likesCount = (index % 17) + Math.floor(index / 2);
    const repliesCount = index % 6;
    const primaryTag = FEED_HASHTAGS[index % FEED_HASHTAGS.length];
    const secondaryPool = FEED_HASHTAGS.filter((tag) => tag !== primaryTag);
    const secondaryTag = secondaryPool.length > 0 && Math.random() < 0.36
      ? secondaryPool[(index + 1 + Math.floor(Math.random() * secondaryPool.length)) % secondaryPool.length]
      : null;
    const assignedFeedTags = [primaryTag, secondaryTag].filter(Boolean);
    const hashtagContextLine = getBotHashtagContextLine(primaryTag, setup.symbol, index);

    if (hashtagContextLine) {
      content = `${content} ${hashtagContextLine}`.replace(/\s+/g, ' ').trim();
    }

    content = `${content} ${assignedFeedTags.join(' ')}`.trim();

    const hashtags = [...new Set(
      assignedFeedTags
        .map((tag) => sanitizeHashtagLabel(tag))
        .filter(Boolean)
    )];

    return {
      id: `mock-post-${index + 1}`,
      user_id: `mock-user-${author.id}`,
      author_name: author.name,
      content,
      hashtags,
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
        avatar_url: author.avatar_url,
        email: author.email,
      },
      is_mock: true,
      mock_replies: repliesCount > 0
        ? Array.from({ length: Math.min(3, repliesCount) }).map((__, replyIdx) => {
            const replyAuthor = MOCK_AUTHORS[(index + replyIdx + 1) % MOCK_AUTHORS.length];
            return {
              id: `mock-reply-${index + 1}-${replyIdx + 1}`,
              user_id: `mock-user-${replyAuthor.id}`,
              author_name: replyAuthor.name,
              content: replyIdx % 2 === 0
                ? `Nice execution on $${setup.symbol}. Risk was clearly defined.`
                : `I had a similar read on $${setup.symbol}, appreciate the level callouts.`,
              created_at: new Date(new Date(createdAt).getTime() + (replyIdx + 1) * 8 * 60 * 1000).toISOString(),
              profiles: {
                id: `mock-user-${replyAuthor.id}`,
                display_name: replyAuthor.name,
                avatar_url: replyAuthor.avatar_url,
                email: replyAuthor.email,
              },
              community_reactions: makeMockReactionRows(index + replyIdx + 2),
            };
          })
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
  <AnimatePresence initial={false}>
    {open && (
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.95 }}
        transition={OVERLAY_PANEL_TRANSITION}
        className="absolute left-0 right-0 bottom-full mb-2 z-50"
      >
        <div
          className="rounded-2xl border shadow-2xl shadow-black/40 overflow-hidden"
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
  currentUserAvatarUrl,
  trackedSymbols,
  quoteMap,
  streamStatus,
  searchMode,
  onModeChange,
  onOpenComposer,
  onSend,
  onSearch,
}) => {
  const [message, setMessage] = useState('');
  const [selectedHashtags, setSelectedHashtags] = useState([]);
  const [debouncedMessage, setDebouncedMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const inputRef = useRef(null);
  const lookupRef = useRef(null);
  const prevSearchModeRef = useRef(searchMode);

  const tickerQuery = useMemo(() => {
    const match = message.match(/(?:^|\s)\$([A-Za-z0-9./=-]{1,14})$/);
    return match ? match[1].toUpperCase() : '';
  }, [message]);

  const searchSuggestions = useMemo(() => {
    return generateSuggestions(debouncedMessage).map((text, idx) => ({
      id: `search-suggestion-${idx}`,
      text,
    }));
  }, [debouncedMessage]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setDebouncedMessage(message);
    }, 200);
    return () => window.clearTimeout(timerId);
  }, [message]);

  useEffect(() => {
    const wasSearchMode = Boolean(prevSearchModeRef.current);
    if (wasSearchMode && !searchMode) {
      setMessage('');
      setDebouncedMessage('');
      setSuggestions([]);
      setSuggestionsLoading(false);
      setActiveSuggestion(0);
      setSelectedHashtags([]);
    }
    prevSearchModeRef.current = searchMode;
  }, [searchMode]);

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

  const applySuggestion = useCallback((item, options = {}) => {
    const triggerSearch = Boolean(options?.triggerSearch);
    if (searchMode) {
      const text = String(item?.text || '').trim();
      if (!text) return;
      setMessage(text);
      setDebouncedMessage(text);
      setActiveSuggestion(0);
      if (triggerSearch) {
        void onSearch?.(text);
      }
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
  }, [onSearch, searchMode]);

  const addHashtagToMessage = useCallback((value, hashtag) => {
    const input = inputRef.current;
    const safeValue = String(value || '');
    const safeHashtag = String(hashtag || '').trim();
    if (!safeHashtag) return safeValue;

    const start = Number.isInteger(input?.selectionStart) ? input.selectionStart : safeValue.length;
    const end = Number.isInteger(input?.selectionEnd) ? input.selectionEnd : start;
    const before = safeValue.slice(0, start);
    const after = safeValue.slice(end);
    const withLeadingSpace = before && !/\s$/.test(before) ? `${before} ` : before;
    const withTrailingSpace = after && !/^\s/.test(after) ? ` ${after}` : after;
    return `${withLeadingSpace}${safeHashtag}${withTrailingSpace}`;
  }, []);

  const removeHashtagFromMessage = useCallback((value, hashtag) => {
    const escaped = escapeRegExp(hashtag);
    return String(value || '')
      .replace(new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'g'), '$1')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/ +\n/g, '\n')
      .replace(/\n +/g, '\n')
      .trim();
  }, []);

  const toggleHashtag = useCallback((hashtag) => {
    const normalized = String(hashtag || '').trim().toLowerCase();
    if (!normalized) return;

    setSelectedHashtags((prev) => {
      const isActive = prev.includes(normalized);
      setMessage((currentValue) => (
        isActive
          ? removeHashtagFromMessage(currentValue, normalized)
          : addHashtagToMessage(currentValue, normalized)
      ));
      return isActive
        ? prev.filter((tag) => tag !== normalized)
        : [...prev, normalized];
    });

    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [addHashtagToMessage, removeHashtagFromMessage]);

  const send = async () => {
    const trimmed = searchMode ? normalizeAiSearchQuery(message) : String(message || '').trim();
    if (!trimmed) return;
    const ok = searchMode
      ? await onSearch?.(trimmed)
      : await onSend?.(trimmed, 'general');
    if (ok !== false) {
      setMessage('');
      setSuggestions([]);
      setActiveSuggestion(0);
      setDebouncedMessage('');
      if (!searchMode) setSelectedHashtags([]);
    }
  };

  const switchToPostMode = useCallback(() => {
    setMessage('');
    setDebouncedMessage('');
    setSuggestions([]);
    setSuggestionsLoading(false);
    setActiveSuggestion(0);
    setSelectedHashtags([]);
    onModeChange?.(false, { source: 'post-toggle' });
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [onModeChange]);

  const switchToSearchMode = useCallback(() => {
    onModeChange?.(true, { source: 'search-toggle' });
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [onModeChange]);

  const openAiRewriteComposer = useCallback(() => {
    if (searchMode) return;
    const draft = String(message || '');
    if (!draft.trim()) return;

    onOpenComposer?.('general', {
      prefilledText: draft,
      openAiRewritePanel: true,
    });

    setMessage('');
    setSuggestions([]);
    setActiveSuggestion(0);
    setDebouncedMessage('');
    setSelectedHashtags([]);
    setShowEmojiPicker(false);
  }, [message, onOpenComposer, searchMode]);

  const handlePrimaryAction = () => {
    void send();
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
  const hasMessage = Boolean(String(message || '').trim());
  const canUseAiRewriteTransfer = !searchMode && canUseInput && hasMessage;
  const suggestionOpen = searchMode
    ? searchSuggestions.length > 0
    : Boolean(tickerQuery);
  const suggestionRows = searchMode ? searchSuggestions : suggestions;
  const hintText = searchMode
    ? 'Enter to search, Shift+Enter for newline'
    : 'Enter to send, Shift+Enter for newline';
  const contextualStatus = statusText;
  const chatAvatarSeed = String(currentUser?.display_name || currentUser?.email || 'Anonymous Trader').trim() || 'Anonymous Trader';
  const chatAvatarUrl = String(
    currentUserAvatarUrl
    || currentUser?.avatar_url
    || buildCurrentUserAvatarUrl(chatAvatarSeed)
  ).trim();

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
            onPick={(item) => applySuggestion(item, { triggerSearch: true })}
          />

          <div
            className="rounded-xl border min-h-[98px] flex flex-col transition-colors duration-200"
            style={{
              backgroundColor: '#151b23',
              borderColor: 'rgba(255,255,255,0.06)',
            }}
          >
            <div className="flex flex-1 items-start gap-2.5 px-3.5 pt-3">
              <div className="mt-0.5 flex-shrink-0">
                <UserAvatar
                  user={{
                    ...(currentUser || {}),
                    display_name: chatAvatarSeed,
                    avatar_url: chatAvatarUrl,
                  }}
                  size={32}
                  initialsClassName="text-xs"
                />
              </div>
              <div className="mt-0.5 flex-shrink-0 flex items-center gap-1">
                <button
                  type="button"
                  onClick={switchToPostMode}
                  className={`p-1.5 rounded-lg cursor-pointer transition-all duration-200 ${searchMode ? 'text-[#7d8590] hover:text-[#e6edf3] hover:bg-white/5' : 'text-[#58a6ff] bg-[#58a6ff]/10'}`}
                  title="Post mode"
                >
                  <XLogoIcon className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={switchToSearchMode}
                  className={`p-1.5 rounded-lg cursor-pointer transition-all duration-200 ${searchMode ? 'text-[#58a6ff] bg-[#58a6ff]/10' : 'text-[#7d8590] hover:text-[#e6edf3] hover:bg-white/5'}`}
                  title="Search mode"
                >
                  <Globe className="w-4 h-4" strokeWidth={1.5} />
                </button>
              </div>
              <textarea
                ref={inputRef}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={searchMode ? 'Search stocks, crypto, news...' : 'Quick post... use $ for ticker suggestions'}
                className="flex-1 w-full bg-transparent text-sm resize-none outline-none leading-6 min-h-[56px] max-h-32"
                style={{ color: T.text }}
                disabled={!canUseInput}
              />
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5">
              {!searchMode ? (
                <div className="flex items-center gap-1.5">
                  {QUICK_POST_HASHTAGS.map((hashtag) => {
                    const active = selectedHashtags.includes(hashtag);
                    return (
                      <button
                        key={hashtag}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => toggleHashtag(hashtag)}
                        className={`bg-white/5 border border-white/8 rounded-full px-3 py-1 text-xs text-[#58a6ff] cursor-pointer hover:bg-white/10 transition-all duration-150 ${active ? 'bg-[#58a6ff]/15 border-[#58a6ff]/40 text-[#58a6ff]' : ''}`}
                        title={hashtag}
                      >
                        {hashtag}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <div className="ml-auto flex items-center gap-2">
                {!searchMode ? (
                  <button
                    type="button"
                    onClick={openAiRewriteComposer}
                    disabled={!canUseAiRewriteTransfer}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/20 text-white font-bold text-xs shadow-[0_0_12px_rgba(102,126,234,0.4)] transition-all duration-300 ${canUseAiRewriteTransfer ? 'hover:scale-105 hover:shadow-[0_0_20px_rgba(102,126,234,0.6)]' : 'opacity-40 pointer-events-none'}`}
                    style={{
                      background: 'linear-gradient(135deg, #667eea, #764ba2, #f093fb, #f5576c, #4facfe, #667eea)',
                      backgroundSize: '400% 400%',
                      animation: 'premiumShimmer 6s ease infinite',
                    }}
                    title="Open AI rewrite in composer"
                  >
                    <Wand2 strokeWidth={2} className="w-3.5 h-3.5 text-white" />
                    <span className="text-white">AI Rewrite</span>
                  </button>
                ) : null}

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker((open) => !open)}
                    className="inline-flex items-center justify-center transition-colors"
                    style={{ color: T.muted }}
                    title="Insert emoji"
                  >
                    <SmilePlus size={16} strokeWidth={1.5} className="h-4 w-4" />
                  </button>

                  <AnimatePresence initial={false}>
                    {showEmojiPicker && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={OVERLAY_PANEL_TRANSITION}
                      >
                        <EmojiPicker
                          align="right"
                          onClose={() => setShowEmojiPicker(false)}
                          onSelect={(emoji) => {
                            setMessage((prev) => `${prev}${emoji}`);
                            setShowEmojiPicker(false);
                            window.requestAnimationFrame(() => inputRef.current?.focus());
                          }}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  type="button"
                  onClick={handlePrimaryAction}
                  disabled={!canUseInput || !hasMessage}
                  className="inline-flex items-center gap-1.5 bg-[#58a6ff] text-black font-medium rounded-lg px-3 py-1.5 text-xs disabled:opacity-45 disabled:cursor-not-allowed transition-all duration-200 hover:bg-[#79b8ff] hover:scale-[1.02]"
                  title={searchMode ? 'Run AI search' : 'Publish quick post'}
                >
                  {searchMode ? (
                    <CornerDownLeft size={14} strokeWidth={1.9} className="h-3.5 w-3.5" />
                  ) : (
                    <Send size={14} strokeWidth={1.9} className="h-3.5 w-3.5" />
                  )}
                  <span>{searchMode ? 'Enter' : 'Post'}</span>
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
        borderLeftColor: '#58a6ff',
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

const ComposerTypePill = ({ active, icon: Icon, label, onClick, accent = T.blue }) => (
  <button
    type="button"
    onClick={onClick}
    className="px-2.5 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
    style={{
      borderColor: active ? accent : T.border,
      color: active ? accent : T.text,
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
  currentUserAvatarUrl,
  displayName,
  closedTrades = [],
  submitting = false,
  initialPostType = 'general',
  prefilledText = '',
  openAiRewritePanelOnOpen = false,
  onConsumePrefilledText,
  onSubmit,
}) => {
  const [content, setContent] = useState('');
  const [postType, setPostType] = useState('general');
  const [selectedTradeId, setSelectedTradeId] = useState('');
  const [selectedSlipEmojis, setSelectedSlipEmojis] = useState([]);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAiRewritePanel, setShowAiRewritePanel] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [selectedPersonality, setSelectedPersonality] = useState(null);
  const [selectedHashtags, setSelectedHashtags] = useState([]);
  const [isAiRewriteLoading, setIsAiRewriteLoading] = useState(false);
  const [aiRewriteError, setAiRewriteError] = useState('');
  const [originalDraft, setOriginalDraft] = useState('');
  const [hasAiRewriteResult, setHasAiRewriteResult] = useState(false);
  const [lastAiRewriteConfig, setLastAiRewriteConfig] = useState({ styleId: '', personalityId: '' });
  const [rewriteResultVersion, setRewriteResultVersion] = useState(0);
  const fileRef = useRef(null);
  const textareaRef = useRef(null);
  const hasInitializedOnOpenRef = useRef(false);
  const resetAiRewriteSelections = useCallback(() => {
    setSelectedStyle(null);
    setSelectedPersonality(null);
    setSelectedHashtags([]);
  }, []);
  const closeAiRewritePanel = useCallback(() => {
    setShowAiRewritePanel(false);
    resetAiRewriteSelections();
  }, [resetAiRewriteSelections]);
  const closeComposerModal = useCallback(() => {
    setShowAiRewritePanel(false);
    resetAiRewriteSelections();
    onClose?.();
  }, [onClose, resetAiRewriteSelections]);

  useEffect(() => {
    if (!open) {
      hasInitializedOnOpenRef.current = false;
      setShowAiRewritePanel(false);
      resetAiRewriteSelections();
      return;
    }
    if (hasInitializedOnOpenRef.current) return;
    hasInitializedOnOpenRef.current = true;

    const draftPrefill = String(prefilledText || '');
    const hasDraftPrefill = Boolean(draftPrefill.trim());

    setPostType(sanitizePostType(initialPostType));
    setSelectedTradeId(closedTrades[0]?.id || '');
    setSelectedSlipEmojis([]);
    setContent(hasDraftPrefill ? draftPrefill : '');
    setImageFile(null);
    setImagePreview('');
    setShowEmojiPicker(false);
    setShowAiRewritePanel(hasDraftPrefill && openAiRewritePanelOnOpen);
    resetAiRewriteSelections();
    setIsAiRewriteLoading(false);
    setAiRewriteError('');
    setOriginalDraft(hasDraftPrefill ? draftPrefill : '');
    setHasAiRewriteResult(false);
    setLastAiRewriteConfig({ styleId: '', personalityId: '' });
    setRewriteResultVersion(0);
    if (fileRef.current) fileRef.current.value = '';
    if (hasDraftPrefill) onConsumePrefilledText?.();
  }, [
    open,
    initialPostType,
    closedTrades,
    prefilledText,
    openAiRewritePanelOnOpen,
    onConsumePrefilledText,
    resetAiRewriteSelections,
  ]);

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
  const composerDisplayName = String(
    displayName || currentUser?.display_name || currentUser?.email?.split('@')[0] || 'Guest Trader'
  ).trim() || 'Guest Trader';
  const composerAvatarUrl = String(
    currentUserAvatarUrl
    || currentUser?.avatar_url
    || buildCurrentUserAvatarUrl(composerDisplayName)
  ).trim();

  const canAutofillSlip = postType === 'pnl' && selectedTrade;
  const hasComposerText = Boolean(content.trim());
  const hasAiRewriteSelection = Boolean(selectedStyle || selectedPersonality);
  const canOpenAiRewrite = !isAiRewriteLoading;
  const canRunAiRewrite = hasComposerText && !isAiRewriteLoading;
  const canRetryAiRewrite = Boolean(
    !isAiRewriteLoading
    && (lastAiRewriteConfig.styleId || lastAiRewriteConfig.personalityId)
    && (originalDraft || content.trim())
  );

  const toggleSlipEmoji = (emoji) => {
    setSelectedSlipEmojis((prev) => (
      prev.includes(emoji)
        ? prev.filter((value) => value !== emoji)
        : [...prev, emoji]
    ));
  };

  const addHashtagToContent = useCallback((value, hashtag) => {
    const safeValue = String(value || '');
    const safeHashtag = String(hashtag || '').trim();
    if (!safeHashtag) return safeValue;
    const hashtagPattern = new RegExp(`(^|\\s)${escapeRegExp(safeHashtag)}(?=\\s|$)`);
    if (hashtagPattern.test(safeValue)) return safeValue;
    const withSpace = safeValue && !/\s$/.test(safeValue) ? `${safeValue} ` : safeValue;
    return `${withSpace}${safeHashtag}`;
  }, []);

  const removeHashtagFromContent = useCallback((value, hashtag) => {
    const safeHashtag = String(hashtag || '').trim();
    if (!safeHashtag) return String(value || '');
    const escaped = escapeRegExp(safeHashtag);
    return String(value || '')
      .replace(new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'g'), '$1')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/ +\n/g, '\n')
      .replace(/\n +/g, '\n')
      .trim();
  }, []);

  const toggleRewriteHashtag = useCallback((hashtag) => {
    const safeHashtag = String(hashtag || '').trim();
    if (!safeHashtag) return;
    setSelectedHashtags((prev) => {
      const isActive = prev.includes(safeHashtag);
      setContent((currentValue) => (
        isActive
          ? removeHashtagFromContent(currentValue, safeHashtag)
          : addHashtagToContent(currentValue, safeHashtag)
      ));
      return isActive
        ? prev.filter((tag) => tag !== safeHashtag)
        : [...prev, safeHashtag];
    });
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }, [addHashtagToContent, removeHashtagFromContent]);

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

  const runAiRewrite = async ({
    sourceText = content,
    styleId = selectedStyle,
    personalityId = selectedPersonality,
    hashtags = selectedHashtags,
    preserveOriginal = false,
  } = {}) => {
    const textValue = String(sourceText || '').trim();
    if (!textValue) return;

    const baseOriginal = String(preserveOriginal ? (originalDraft || textValue) : textValue).trim();
    if (!preserveOriginal || !originalDraft) {
      setOriginalDraft(baseOriginal);
    }

    setAiRewriteError('');
    setIsAiRewriteLoading(true);
    setHasAiRewriteResult(false);

    try {
      const response = await fetch('/api/community/ai-rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textValue,
          style: styleId || 'default',
          personality: personalityId || 'default',
          hashtags: Array.isArray(hashtags) ? hashtags : [],
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(String(payload?.error || 'AI rewrite failed'));
      }

      const rewritten = String(payload?.rewritten || '').trim();
      if (!rewritten) throw new Error('AI rewrite returned empty content.');

      setContent(rewritten);
      setLastAiRewriteConfig({
        styleId: styleId || 'default',
        personalityId: personalityId || 'default',
      });
      setHasAiRewriteResult(true);
      setRewriteResultVersion((version) => version + 1);
    } catch (error) {
      setAiRewriteError(String(error?.message || 'AI rewrite failed. Try again.'));
      setHasAiRewriteResult(false);
    } finally {
      setIsAiRewriteLoading(false);
    }
  };

  const submit = async () => {
    const trimmed = content.trim();
    if (!trimmed && !imageFile && !(postType === 'pnl' && selectedTrade)) return;

    const metadata = {};
    let finalContent = trimmed;

    if (postType === 'pnl' && selectedTrade) {
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

    if (ok !== false) closeComposerModal();
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {open && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-2 sm:p-4">
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              transition: MODAL_BACKDROP_TRANSITION,
            }}
            exit={{
              opacity: 0,
              transition: {
                ...MODAL_BACKDROP_TRANSITION,
                delay: 0.15,
              },
            }}
            onClick={closeComposerModal}
            aria-hidden="true"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{
              opacity: 0,
              scale: 0.95,
              y: 10,
              transition: MODAL_PANEL_EXIT_TRANSITION,
            }}
            transition={MODAL_PANEL_ENTER_TRANSITION}
            className="relative z-[60] w-full max-w-2xl rounded-2xl border shadow-2xl shadow-black/40 overflow-hidden"
            style={{
              borderColor: T.border,
              background: 'linear-gradient(180deg, rgba(28,35,51,0.98) 0%, rgba(13,17,23,0.98) 100%)',
            }}
          >
            <motion.div
              {...modalSectionMotion(0)}
              className="px-4 py-3 border-b flex items-center justify-between"
              style={{ borderColor: T.border }}
            >
              <div>
                <div className="text-xs uppercase tracking-[0.14em] text-[#7d8590]">Community Composer</div>
                <h3 className="text-lg font-semibold text-[#e6edf3]">Create Post</h3>
              </div>
              <button
                type="button"
                onClick={closeComposerModal}
                className="h-8 w-8 inline-flex items-center justify-center"
                style={{ color: T.text }}
              >
                <X size={14} strokeWidth={1.5} className="h-4 w-4" />
              </button>
            </motion.div>

            <div className="p-4 space-y-3">
              <motion.div {...modalSectionMotion(1)} className="flex flex-wrap gap-2">
                <ComposerTypePill active={postType === 'general'} icon={MessageCircle} label="General" onClick={() => setPostType('general')} accent={T.blue} />
                <ComposerTypePill active={postType === 'trade'} icon={ArrowLeftRight} label="Trade" onClick={() => setPostType('trade')} accent={T.blue} />
                <ComposerTypePill active={postType === 'strategy'} icon={Brain} label="Strategy" onClick={() => setPostType('strategy')} accent="#c297ff" />
                <ComposerTypePill active={postType === 'alert'} icon={Bell} label="Alert" onClick={() => setPostType('alert')} accent="#f0883e" />
                <ComposerTypePill active={postType === 'pnl'} icon={TrendingUp} label="P&L" onClick={() => setPostType('pnl')} accent={T.green} />
                <ComposerTypePill active={postType === 'earnings'} icon={BarChart3} label="Earnings" onClick={() => setPostType('earnings')} accent="#d29922" />
                <ComposerTypePill active={postType === 'macro'} icon={Globe} label="Macro" onClick={() => setPostType('macro')} accent="#58a6ff" />
              </motion.div>

              {postType === 'pnl' && (
                <motion.div
                  {...modalSectionMotion(2)}
                  className="rounded-xl border p-3 space-y-2"
                  style={{ borderColor: T.border, backgroundColor: 'rgba(13,17,23,0.55)' }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <label className="text-[11px] uppercase tracking-[0.14em]" style={{ color: T.text }}>Closed Trade</label>
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
                    <div className="text-[11px] uppercase tracking-[0.14em] mb-1" style={{ color: T.text }}>Slip Emojis</div>
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
                </motion.div>
              )}

              <motion.div {...modalSectionMotion(3)} className="relative">
                <motion.div
                  key={`composer-rewrite-result-${rewriteResultVersion}`}
                  initial={rewriteResultVersion > 0 ? { opacity: 0 } : false}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="relative"
                >
                  <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder="Share your setup, thesis, or execution notes..."
                    rows={6}
                    disabled={isAiRewriteLoading}
                    className="w-full rounded-xl border px-3 py-2.5 resize-none outline-none text-sm leading-6 placeholder:text-[#7d8590] disabled:opacity-100"
                    style={{
                      borderColor: T.border,
                      backgroundColor: 'rgba(13,17,23,0.66)',
                      color: isAiRewriteLoading ? 'transparent' : T.text,
                      caretColor: isAiRewriteLoading ? 'transparent' : T.text,
                    }}
                  />

                  <AnimatePresence initial={false}>
                    {isAiRewriteLoading && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 pointer-events-none rounded-xl px-3 py-3"
                      >
                        <div className="space-y-2.5">
                          {['92%', '78%', '66%'].map((width, index) => (
                            <div
                              key={`rewrite-loading-line-${index}`}
                              className="relative h-[10px] overflow-hidden rounded-md animate-pulse"
                              style={{ width, backgroundColor: 'rgba(255,255,255,0.05)' }}
                            >
                              <div
                                className="absolute inset-0"
                                style={{
                                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%)',
                                  backgroundSize: '200% 100%',
                                  animation: 'shimmer 1.2s linear infinite',
                                  animationDelay: `${index * 0.12}s`,
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>

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
                      style={{ borderColor: T.border, color: T.text, backgroundColor: 'rgba(13,17,23,0.8)' }}
                    >
                      <Camera size={13} />
                      Add Image
                    </button>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowEmojiPicker((openState) => !openState)}
                        className="h-8 px-2.5 rounded-lg border text-xs inline-flex items-center gap-1.5"
                        style={{ borderColor: T.border, color: T.text, backgroundColor: 'rgba(13,17,23,0.8)' }}
                      >
                        <SmilePlus size={13} />
                        Emoji
                      </button>
                      <AnimatePresence initial={false}>
                        {showEmojiPicker && (
                          <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.95 }}
                            transition={OVERLAY_PANEL_TRANSITION}
                          >
                            <EmojiPicker
                              align="left"
                              onClose={() => setShowEmojiPicker(false)}
                              onSelect={(emoji) => {
                                setContent((prev) => `${prev}${emoji}`);
                                setShowEmojiPicker(false);
                              }}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (!canOpenAiRewrite) return;
                        setAiRewriteError('');
                        setShowAiRewritePanel(true);
                      }}
                      disabled={!canOpenAiRewrite}
                      className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-full border border-white/20 text-white font-bold text-xs tracking-wide shadow-[0_0_20px_rgba(102,126,234,0.5),0_0_40px_rgba(245,87,108,0.3),0_0_60px_rgba(79,172,254,0.2)] transition-all duration-300 ${canOpenAiRewrite ? 'hover:shadow-[0_0_30px_rgba(102,126,234,0.7),0_0_50px_rgba(245,87,108,0.4)] hover:scale-110 hover:brightness-110' : 'opacity-45 cursor-not-allowed'}`}
                      style={{
                        background: 'linear-gradient(135deg, #667eea, #764ba2, #f093fb, #f5576c, #4facfe, #667eea)',
                        backgroundSize: '400% 400%',
                        animation: 'premiumShimmer 6s ease infinite',
                      }}
                    >
                      <Wand2 strokeWidth={2} className="w-4 h-4 text-white" />
                      <span className="text-white">AI Rewrite</span>
                    </button>
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

                <AnimatePresence initial={false}>
                  {showAiRewritePanel && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                      className="mt-2 overflow-hidden"
                    >
                      <div className="relative bg-[#151b23] border border-white/6 rounded-xl p-3">
                        <button
                          type="button"
                          onClick={closeAiRewritePanel}
                          className="absolute top-2 right-2 inline-flex items-center justify-center text-[#e6edf3] hover:text-[#e6edf3] transition-colors"
                          aria-label="Close AI rewrite panel"
                        >
                          <X size={13} strokeWidth={1.5} />
                        </button>

                        <div className="text-xs text-[#e6edf3] mb-2">Choose a vibe:</div>

                        <div className="space-y-2">
                          <div>
                            <div className="text-xs text-[#e6edf3] mb-1">Hashtags:</div>
                            <div className="flex flex-wrap gap-2">
                              {FEED_HASHTAGS.map((hashtag) => {
                                const selected = selectedHashtags.includes(hashtag);
                                return (
                                  <button
                                    key={`rewrite-hashtag-${hashtag}`}
                                    type="button"
                                    onClick={() => toggleRewriteHashtag(hashtag)}
                                    className={`rounded-full px-3 py-1 text-xs cursor-pointer border hover:bg-white/10 transition-all duration-150 ${selected ? 'bg-[#58a6ff]/15 border-[#58a6ff]/40 text-[#58a6ff]' : 'bg-white/5 border-white/10 text-[#e6edf3]'}`}
                                  >
                                    {hashtag}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs text-[#e6edf3] mb-1">Style:</div>
                            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                              {AI_REWRITE_STYLE_OPTIONS.map((option) => {
                                const selected = selectedStyle === option.id;
                                return (
                                  <button
                                    key={`rewrite-style-${option.id}`}
                                    type="button"
                                    onClick={() => setSelectedStyle(selectedStyle === option.id ? null : option.id)}
                                    className={`flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs cursor-pointer transition-all duration-150 ${selected ? 'bg-[#58a6ff]/15 border border-[#58a6ff]/40 text-[#58a6ff] font-medium' : 'bg-white/5 border border-white/10 text-[#e6edf3] hover:bg-white/8 hover:border-white/15 cursor-pointer'}`}
                                    title={`${option.label} - ${option.prompt}`}
                                  >
                                    {option.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div>
                            <div className="text-xs text-[#e6edf3] mb-1">Personality:</div>
                            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                              {AI_REWRITE_PERSONALITY_OPTIONS.map((option) => {
                                const selected = selectedPersonality === option.id;
                                return (
                                  <button
                                    key={`rewrite-personality-${option.id}`}
                                    type="button"
                                    onClick={() => setSelectedPersonality(selectedPersonality === option.id ? null : option.id)}
                                    className={`flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs cursor-pointer transition-all duration-150 ${selected ? 'bg-[#58a6ff]/15 border border-[#58a6ff]/40 text-[#58a6ff] font-medium' : 'bg-white/5 border border-white/10 text-[#e6edf3] hover:bg-white/8 hover:border-white/15 cursor-pointer'}`}
                                    title={`${option.label} - ${option.prompt}`}
                                  >
                                    {option.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => void runAiRewrite()}
                          disabled={!canRunAiRewrite}
                          className={`mt-3 inline-flex items-center gap-1.5 bg-[#58a6ff] text-black font-medium text-xs px-4 py-1.5 rounded-lg hover:bg-[#79b8ff] transition-all ${hasAiRewriteSelection ? 'brightness-110 shadow-[0_0_16px_rgba(88,166,255,0.35)]' : ''} disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-[#58a6ff]`}
                        >
                          <Wand2 strokeWidth={1.5} className="h-3.5 w-3.5" />
                          Rewrite
                        </button>

                        {aiRewriteError ? (
                          <div className="mt-2 text-xs text-[#f85149]">{aiRewriteError}</div>
                        ) : null}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence initial={false}>
                  {hasAiRewriteResult && !isAiRewriteLoading && (
                    <motion.div
                      variants={AI_REWRITE_ACTION_ROW_VARIANTS}
                      initial="hidden"
                      animate="show"
                      exit="hidden"
                      className="flex items-center gap-4 mt-2 text-xs"
                    >
                      <motion.button
                        type="button"
                        variants={AI_REWRITE_ACTION_ITEM_VARIANTS}
                        onClick={() => {
                          closeAiRewritePanel();
                          setHasAiRewriteResult(false);
                          setAiRewriteError('');
                        }}
                        className="text-xs font-medium text-[#3fb950] hover:text-[#56d364] cursor-pointer transition-colors"
                      >
                        Accept
                      </motion.button>

                      <motion.button
                        type="button"
                        variants={AI_REWRITE_ACTION_ITEM_VARIANTS}
                        onClick={() => {
                          closeAiRewritePanel();
                          setHasAiRewriteResult(false);
                          setAiRewriteError('');
                          window.requestAnimationFrame(() => textareaRef.current?.focus());
                        }}
                        className="text-xs font-medium text-[#58a6ff] hover:brightness-110 cursor-pointer transition"
                      >
                        Edit
                      </motion.button>

                      <motion.button
                        type="button"
                        variants={AI_REWRITE_ACTION_ITEM_VARIANTS}
                        onClick={() => {
                          if (originalDraft) setContent(originalDraft);
                          closeAiRewritePanel();
                          setHasAiRewriteResult(false);
                          setAiRewriteError('');
                        }}
                        className="text-xs font-medium text-[#f85149] hover:text-[#ff7b72] cursor-pointer transition-colors"
                      >
                        Undo
                      </motion.button>

                      <motion.button
                        type="button"
                        variants={AI_REWRITE_ACTION_ITEM_VARIANTS}
                        onClick={() => void runAiRewrite({
                          sourceText: originalDraft || content,
                          styleId: lastAiRewriteConfig.styleId || selectedStyle,
                          personalityId: lastAiRewriteConfig.personalityId || selectedPersonality,
                          preserveOriginal: true,
                        })}
                        disabled={!canRetryAiRewrite}
                        className={`text-xs font-medium text-[#e6edf3] hover:text-[#e6edf3] transition-colors ${canRetryAiRewrite ? 'cursor-pointer' : 'cursor-not-allowed opacity-45'}`}
                      >
                        Retry
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {imagePreview && (
                  <div className="mt-3 relative inline-block">
                    <img src={imagePreview} alt="Composer preview" className="max-h-56 rounded-xl border" style={{ borderColor: T.border }} />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute top-2 right-2 h-7 w-7 inline-flex items-center justify-center"
                      style={{ color: T.text }}
                    >
                      <X size={13} strokeWidth={1.5} className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </motion.div>
            </div>

            <motion.div
              {...modalSectionMotion(4)}
              className="px-4 py-3 border-t flex items-center justify-between"
              style={{ borderColor: T.border }}
            >
              <div className="inline-flex items-center gap-2 text-xs" style={{ color: T.text }}>
                <UserAvatar
                  user={{
                    ...(currentUser || {}),
                    display_name: composerDisplayName,
                    avatar_url: composerAvatarUrl,
                  }}
                  size={24}
                  initialsClassName="text-[10px]"
                />
                <span>Posting as {composerDisplayName}</span>
              </div>

              <button
                type="button"
                onClick={() => void submit()}
                disabled={isAiRewriteLoading || submitting || (!content.trim() && !imageFile && !(postType === 'pnl' && selectedTrade))}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#58a6ff] text-black text-sm font-semibold shadow-lg shadow-[#58a6ff]/20 transition-all duration-200 hover:bg-[#79b8ff] hover:scale-105 disabled:opacity-45 disabled:cursor-not-allowed"
              >
                {submitting ? <Loader2 className="w-4 h-4 text-black animate-spin" /> : <Send className="w-4 h-4 text-black" />}
                Publish
              </button>
            </motion.div>
          </motion.div>
        </div>
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

      <AnimatePresence initial={false}>
        {showPicker && interactive && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={OVERLAY_PANEL_TRANSITION}
          >
            <EmojiPicker
              align={compact ? 'right' : 'left'}
              onClose={() => setShowPicker(false)}
              onSelect={(emoji) => {
                setShowPicker(false);
                void toggleReaction(emoji);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
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

const PostCard = ({ post, currentUser, currentUserAvatarUrl, onDelete, displayName }) => {
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(toFiniteNumber(post.likes_count ?? post.likes, 0));
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState([]);
  const [replyContent, setReplyContent] = useState('');
  const [replying, setReplying] = useState(false);
  const [localRepliesCount, setLocalRepliesCount] = useState(toFiniteNumber(post?.replies_count ?? post?.comments_count, 0));
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const isMock = Boolean(post?.is_mock);
  const resolvedDisplayName = String(
    displayName || currentUser?.display_name || currentUser?.email?.split('@')[0] || 'Trader'
  ).trim() || 'Trader';
  const resolvedReplyAvatar = String(
    currentUserAvatarUrl
    || currentUser?.avatar_url
    || buildCurrentUserAvatarUrl(resolvedDisplayName)
  ).trim();

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
        const sorted = sortByCreatedAtAsc(mockReplies);
        setReplies(sorted);
        setLocalRepliesCount((prev) => Math.max(prev, sorted.length));
        return;
      }

      let { data, error } = await supabase
        .from('community_replies')
        .select('*')
        .eq('post_id', post.id)
        .order('created_at', { ascending: true });

      if (error) {
        const fallback = await supabase
          .from('community_posts')
          .select('*, community_reactions(emoji, user_id), profiles:user_id(id, display_name, avatar_url, email)')
          .or(`parent_id.eq.${post.id},parent_post_id.eq.${post.id}`)
          .order('created_at', { ascending: true });
        data = fallback.data;
        error = fallback.error;
      }

      if (error) throw error;

      const mapped = (data || []).map((reply) => {
        const authorName = String(reply?.author_name || reply?.author || '').trim() || 'Trader';
        const replyAvatar = String(
          reply?.avatar_url
          || reply?.metadata?.bot_avatar_url
          || reply?.metadata?.avatar_url
          || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(authorName)}`
        ).trim();

        return {
          ...reply,
          author_name: authorName,
          avatar_url: replyAvatar,
          profiles: reply?.profiles
            ? {
              ...reply.profiles,
              display_name: reply.profiles.display_name || authorName,
              avatar_url: reply.profiles.avatar_url || replyAvatar,
            }
            : {
              id: reply?.user_id || `reply-profile-${authorName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
              display_name: authorName,
              avatar_url: replyAvatar,
              avatar_color: null,
              email: null,
            },
          reaction_summary: buildReactionSummary(reply.community_reactions || [], currentUser?.id),
        };
      });
      const sorted = sortByCreatedAtAsc(mapped);
      setReplies(sorted);
      setLocalRepliesCount((prev) => Math.max(prev, sorted.length));
    } catch {
      // keep existing replies in local state if fetch fails
    } finally {
      setLoadingReplies(false);
    }
  };

  const submitReply = async () => {
    if (replying) return;
    const trimmed = replyContent.trim();
    if (!trimmed) return;
    const createdAt = new Date().toISOString();
    const localReplyId = Date.now();
    const localReply = {
      id: localReplyId,
      author: resolvedDisplayName,
      author_name: resolvedDisplayName,
      avatar: resolvedReplyAvatar,
      avatar_url: resolvedReplyAvatar,
      content: trimmed,
      timestamp: 'just now',
      created_at: createdAt,
      user_id: currentUser?.id || `guest-${localReplyId}`,
      profiles: {
        id: currentUser?.id || `guest-${localReplyId}`,
        display_name: resolvedDisplayName,
        avatar_url: resolvedReplyAvatar,
        avatar_color: currentUser?.avatar_color || null,
        email: currentUser?.email || null,
      },
      community_reactions: [],
      reaction_summary: [],
      is_mock: isMock || !currentUser?.id,
    };

    setReplies((prev) => sortByCreatedAtAsc([...prev, localReply]));
    setReplyContent('');
    setShowReplies(true);
    setLocalRepliesCount((prev) => prev + 1);

    setReplying(true);

    try {
      if (isMock) {
        return;
      }

      const { data: inserted, error } = await supabase
        .from('community_replies')
        .insert({
          post_id: post.id,
          author_name: resolvedDisplayName,
          content: trimmed,
          created_at: createdAt,
        })
        .select('*')
        .single();

      if (error) throw error;

      const persistedReply = {
        ...localReply,
        ...inserted,
        id: inserted?.id || localReplyId,
        author_name: String(inserted?.author_name || resolvedDisplayName).trim() || resolvedDisplayName,
        avatar: localReply.avatar,
        avatar_url: localReply.avatar_url,
        content: String(inserted?.content || trimmed),
        created_at: inserted?.created_at || createdAt,
        timestamp: 'just now',
      };

      setReplies((prev) => sortByCreatedAtAsc(prev.map((row) => (
        row.id === localReplyId ? persistedReply : row
      ))));
    } catch {
      // optimistic reply already shown; keep local state if persistence fails
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

  const profile = {
    id: post?.profiles?.id || post?.user_id || post?.id || post?.author_name || null,
    display_name: post?.profiles?.display_name || post?.author_name,
    avatar_url: post?.profiles?.avatar_url || post?.metadata?.bot_avatar_url || post?.metadata?.avatar_url || post?.avatar_url || null,
    avatar_color: post?.profiles?.avatar_color || post?.avatar_color || post?.metadata?.bot_avatar_color || post?.metadata?.avatar_color || null,
    email: post?.profiles?.email || null,
  };

  const isOwner = currentUser?.id && currentUser.id === post.user_id;
  const profileForRender = isOwner
    ? { ...profile, display_name: resolvedDisplayName, avatar_url: resolvedReplyAvatar }
    : profile;
  const postAuthorLabel = profileForRender?.display_name || post.author_name || profileForRender?.email?.split('@')[0] || 'Trader';
  const repliesCount = Math.max(localRepliesCount, replies.length);
  const normalizedPostType = sanitizePostType(post?.post_type);

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
        <UserAvatar user={profileForRender} size={32} initialsClassName="text-xs" />

        <div className="flex-1 min-w-0">
          {normalizedPostType !== 'general' && (
            <div className="mb-1">
              <PostTypeBadge type={normalizedPostType} />
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold truncate">
                {postAuthorLabel}
              </span>
              <span className="text-xs" style={{ color: T.muted }}>•</span>
              <span className="text-xs" style={{ color: T.muted }}>{timeAgo(post.created_at)}</span>
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

              <AnimatePresence initial={false}>
                {showMenu && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={OVERLAY_PANEL_TRANSITION}
                    className="absolute right-0 top-8 z-20 w-36 rounded-2xl border py-1 shadow-2xl shadow-black/40"
                    style={{
                      borderColor: T.border,
                      backgroundColor: 'rgba(13,17,23,0.96)',
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
                      <XLogoIcon className="h-3.5 w-3.5" />
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

          {normalizedPostType === 'pnl' && <PnLCard metadata={post.metadata} />}

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
              <XLogoIcon className="h-3.5 w-3.5" />
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
                      const replyProfile = {
                        id: reply?.profiles?.id || reply?.user_id || reply?.id || reply?.author_name || reply?.author || null,
                        display_name: reply?.profiles?.display_name || reply.author_name || reply.author,
                        avatar_url: reply?.profiles?.avatar_url || reply?.metadata?.bot_avatar_url || reply?.metadata?.avatar_url || reply?.avatar_url || reply?.avatar || null,
                        avatar_color: reply?.profiles?.avatar_color || reply?.avatar_color || reply?.metadata?.bot_avatar_color || reply?.metadata?.avatar_color || null,
                        email: reply?.profiles?.email || null,
                      };
                      const isCurrentUserReply = currentUser?.id && reply?.user_id === currentUser.id;
                      const replyProfileForRender = isCurrentUserReply
                        ? { ...replyProfile, display_name: resolvedDisplayName, avatar_url: resolvedReplyAvatar }
                        : replyProfile;
                      return (
                        <div key={reply.id} className="flex gap-2">
                          <UserAvatar user={replyProfileForRender} size={24} initialsClassName="text-xs" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-medium" style={{ color: T.text }}>
                                {replyProfileForRender.display_name || reply.author_name || reply.author || 'Trader'}
                              </span>
                              <span style={{ color: T.muted }}>{reply?.timestamp || timeAgo(reply.created_at)}</span>
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

                <div className="mt-3 flex items-center gap-2">
                    <UserAvatar user={{
                      ...(currentUser || {}),
                      display_name: resolvedDisplayName,
                      avatar_url: resolvedReplyAvatar,
                    }} size={24} initialsClassName="text-xs" />
                    <input
                      value={replyContent}
                      onChange={(event) => setReplyContent(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' || event.shiftKey) return;
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.article>
  );
};

const LeftRail = ({
  collapsed,
  onToggleCollapse,
  filter,
  onFilter,
  priceAlerts,
  onTogglePriceAlert,
  onDeletePriceAlert,
  currentUser,
  avatarUrl,
  displayName,
  isEditingName,
  editName,
  setEditName,
  setIsEditingName,
  handleSaveName,
}) => {
  const [feedsOpen, setFeedsOpen] = useState(true);
  const [priceAlertsOpen, setPriceAlertsOpen] = useState(true);
  const profileAvatarSeed = displayName || 'Anonymous Trader';
  const profileAvatarUrl = String(avatarUrl || buildCurrentUserAvatarUrl(profileAvatarSeed)).trim();
  const profileUser = currentUser ? {
    ...currentUser,
    display_name: displayName || currentUser.display_name,
    avatar_url: profileAvatarUrl,
  } : {
    id: 'guest-user',
    display_name: displayName || 'Anonymous Trader',
    email: null,
    avatar_url: profileAvatarUrl,
    avatar_color: null,
  };

  return (
    <motion.aside
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.22 }}
      className={`hidden lg:flex lg:flex-shrink-0 ${collapsed ? 'w-[68px] items-center overflow-hidden' : 'w-[220px] overflow-y-auto'} h-full flex-col py-0 pb-10 border-r-2 border-[#58a6ff] rounded-none transition-all duration-200`}
      style={{
        backgroundColor: '#080d13',
      }}
    >
      <button
        type="button"
        onClick={onToggleCollapse}
        className={`h-8 w-8 inline-flex items-center justify-center transition-colors ${collapsed ? '' : 'self-end'}`}
        style={{ color: T.muted }}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <PanelRightClose size={15} /> : <PanelLeftClose size={15} />}
      </button>

      {!collapsed && (
        <>
          <div className="flex items-center gap-3 px-4 py-4 mb-3 border-b border-white/6">
            <img src={profileAvatarUrl} className="w-10 h-10 rounded-full bg-white/10" alt={displayName || 'Community Profile'} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                {isEditingName ? (
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onBlur={handleSaveName}
                    onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                    autoFocus
                    maxLength={24}
                    className="bg-white/5 border border-[#58a6ff]/40 rounded px-2 py-0.5 text-sm text-[#e6edf3] outline-none w-full"
                  />
                ) : (
                  <>
                    <span className="text-sm font-medium text-[#e6edf3] truncate transition-all duration-200">{displayName}</span>
                    <button type="button" onClick={() => { setEditName(displayName); setIsEditingName(true); }} className="text-[#7d8590] hover:text-[#58a6ff] transition">
                      <Pencil className="w-3 h-3" strokeWidth={1.5} />
                    </button>
                  </>
                )}
              </div>
              <span className="text-xs text-[#7d8590] transition-all duration-200">Community Profile</span>
            </div>
          </div>

          <div className="w-full pt-2">
            <button
              type="button"
              onClick={() => setFeedsOpen((prev) => !prev)}
              className="w-full px-3 pt-4 pb-1 inline-flex items-center justify-between"
            >
              <span className="text-[11px] uppercase tracking-widest text-[#7d8590] transition-all duration-200">FEEDS</span>
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
                    {FEED_HASHTAGS.map((hashtag) => {
                      const active = filter === hashtag;
                      return (
                        <div
                          key={hashtag}
                          onClick={() => onFilter?.(active ? null : hashtag)}
                          className={`px-3 py-1.5 text-sm text-[#7d8590] cursor-pointer hover:text-[#e6edf3] hover:bg-white/5 rounded-md transition-all duration-200${active ? ' text-[#58a6ff] bg-[#58a6ff]/10' : ''}`}
                        >
                          {hashtag}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="w-full pt-1">
            <button
              type="button"
              onClick={() => setPriceAlertsOpen((prev) => !prev)}
              className="w-full px-3 pt-4 pb-1 inline-flex items-center justify-between"
            >
              <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-[#7d8590] transition-all duration-200">
                <Bell className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>PRICE ALERTS</span>
              </span>
              {priceAlertsOpen ? <ChevronDown size={14} style={{ color: T.muted }} /> : <ChevronRight size={14} style={{ color: T.muted }} />}
            </button>

            <AnimatePresence initial={false}>
              {priceAlertsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-1">
                    {(Array.isArray(priceAlerts) ? priceAlerts : []).length === 0 ? (
                      <div className="px-3 py-1.5 text-xs text-[#7d8590] italic">No alerts set</div>
                    ) : (Array.isArray(priceAlerts) ? priceAlerts : []).map((alert) => {
                      const alertTargetPrice = toMaybeFiniteNumber(alert?.targetPrice);
                      const isTriggered = Boolean(alert?.triggered);
                      const rowTextColor = isTriggered ? 'text-[#7d8590]' : 'text-[#e6edf3]';
                      return (
                        <div
                          key={alert.id}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-white/5 transition group ${isTriggered ? 'text-[#7d8590]' : ''}`.trim()}
                        >
                          <span className={`text-xs font-medium ${rowTextColor}`}>{alert.ticker}</span>
                          <span className="text-xs text-[#7d8590]">{alert.direction === 'above' ? '↑' : '↓'}</span>
                          <span
                            className={`text-xs ${isTriggered ? 'line-through text-[#7d8590]' : 'text-[#7d8590]'}`.trim()}
                          >
                            ${Number.isFinite(alertTargetPrice) ? alertTargetPrice.toFixed(2) : '--'}
                          </span>
                          <div className="ml-auto flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onTogglePriceAlert?.(alert.id)}
                              title="Toggle alert"
                            >
                              {alert.active ? (
                                <Bell className="w-3 h-3 text-[#58a6ff]" fill="#58a6ff" strokeWidth={1.5} />
                              ) : (
                                <BellOff className="w-3 h-3 text-[#7d8590]" strokeWidth={1.5} />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeletePriceAlert?.(alert.id)}
                              className="opacity-0 group-hover:opacity-100 transition"
                            >
                              <X className="w-3 h-3 text-[#f85149]" strokeWidth={1.5} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="w-full border-t border-white/5 py-3">
            <div className="px-3 pt-4 pb-1 text-xs uppercase tracking-widest transition-all duration-200" style={{ color: T.muted }}>COMMUNITY LANES</div>
            <div className="space-y-0.5">
              {LEFT_RAIL_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (item.id === 'home') {
                        onFilter?.(null);
                      }
                    }}
                    className="w-full py-2 px-3 rounded-lg inline-flex items-center gap-3 text-sm font-normal transition-colors hover:bg-white/5"
                    style={{ color: T.text }}
                  >
                    <span className="inline-flex items-center gap-3">
                      <Icon className="h-4 w-4 text-[#7d8590]" strokeWidth={1.5} />
                      <span className="text-sm transition-all duration-200">{item.label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

        </>
      )}

      {collapsed ? (
        <div className="mt-auto w-full border-t border-white/5 px-3 py-3">
          <div className="w-full inline-flex items-center justify-center">
            <UserAvatar user={profileUser} size={40} initialsClassName="text-xs" />
          </div>
        </div>
      ) : null}
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
  className = '',
  bodyClassName = '',
}) => {
  const VisibilityIcon = onToggleVisibility ? X : EyeOff;

  return (
    <div
      className={`rounded-xl border overflow-hidden ${className}`.trim()}
      style={{ borderColor: T.border, backgroundColor: 'rgba(13,17,23,0.68)' }}
    >
      <div className="px-3 py-2.5 border-b flex items-center justify-between gap-2" style={{ borderColor: T.border }}>
        <div className="inline-flex items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            onPointerDown={(event) => {
              if (!onDragHandlePointerDown) return;
              event.preventDefault();
              onDragHandlePointerDown(event);
            }}
            className={`h-6 w-6 inline-flex items-center justify-center transition-colors ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
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
              className="h-6 w-6 inline-flex items-center justify-center"
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
            className="h-6 w-6 inline-flex items-center justify-center"
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
            className="overflow-hidden flex-1 min-h-0"
          >
            <div className={`p-3 ${bodyClassName}`.trim()}>{children}</div>
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
  wrapperClassName = '',
  sectionClassName = '',
  sectionBodyClassName = '',
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
        boxShadow: '0 0 12px rgba(88,166,255,0.3)',
        zIndex: 30,
      }}
      transition={{ type: 'spring', stiffness: 400, damping: 30, mass: 0.7 }}
      className={`list-none ${wrapperClassName}`.trim()}
      style={{ position: 'relative' }}
      onDragStart={() => onDragStateChange(sectionId)}
      onDragEnd={() => onDragStateChange(null)}
    >
      <SidebarSection
        {...sectionProps}
        isDragging={isDragging}
        onDragHandlePointerDown={(event) => dragControls.start(event)}
        className={sectionClassName}
        bodyClassName={sectionBodyClassName}
      >
        {children}
      </SidebarSection>
    </Reorder.Item>
  );
};

const RightSidebar = ({ quoteMap }) => {
  const [openSections, setOpenSections] = useState({
    watchlist: true,
    'todays-news': true,
  });
  const [sectionOrder, setSectionOrder] = useState(DEFAULT_SIDEBAR_SECTION_ORDER);
  const [sectionVisibility, setSectionVisibility] = useState(
    normalizeSidebarSectionVisibility(),
  );
  const [layoutPrefsHydrated, setLayoutPrefsHydrated] = useState(false);
  const [draggingSectionId, setDraggingSectionId] = useState(null);
  const [watchlistRows, setWatchlistRows] = useState([]);
  const [watchlistQuery, setWatchlistQuery] = useState('');
  const [watchlistResults, setWatchlistResults] = useState([]);
  const [watchlistSearchLoading, setWatchlistSearchLoading] = useState(false);
  const [watchlistQuoteMap, setWatchlistQuoteMap] = useState({});
  const [todaysNewsRows, setTodaysNewsRows] = useState([]);
  const [todaysNewsLoading, setTodaysNewsLoading] = useState(true);
  const [todaysNewsUpdatedAt, setTodaysNewsUpdatedAt] = useState(null);
  const [todaysNewsClockTick, setTodaysNewsClockTick] = useState(Date.now());
  const watchlistHydratedRef = useRef(false);
  const previousWatchlistSymbolsRef = useRef([]);
  const watchlistLookupRef = useRef(null);

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
    console.log('[CommunityPage][Watchlist] Subscribing Twelve Data symbols:', watchlistSymbols);

    const unsubscribeQuotes = subscribeTwelveDataQuotes(watchlistSymbols, (update) => {
      const symbol = normalizeSymbolKey(update?.symbol);
      if (!symbol) return;
      console.log('[CommunityPage][Watchlist] WS price update:', {
        symbol,
        price: update?.price,
        dayChangePercent: update?.dayChangePercent ?? update?.percentChange ?? null,
      });

      setWatchlistQuoteMap((prev) => ({
        ...prev,
        [symbol]: mergeStreamQuote(prev[symbol] || {}, update, symbol),
      }));
    });

    return () => {
      console.log('[CommunityPage][Watchlist] Unsubscribing Twelve Data symbols:', watchlistSymbols);
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

      const endpoints = ['/api/community/todays-news.js', '/api/community/todays-news'];
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
    const percent = toMaybeFiniteNumber(
      quote?.dayChangePercent
      ?? quote?.day_change_percent
      ?? quote?.percentChange
      ?? quote?.percent_change
      ?? quote?.changePercent
    );
    const percentColor = percent === null ? T.muted : (percent >= 0 ? '#3fb950' : '#f85149');

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
        <div className="text-right flex-shrink-0 leading-tight">
          <div className="text-xs font-mono" style={{ color: T.text }}>
            {price === null ? '--' : formatPrice(price)}
          </div>
          <div className="text-xs font-mono" style={{ color: percentColor }}>
            {percent === null ? '--' : formatSignedPercent(percent)}
          </div>
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
          wrapperClassName="flex-shrink-0"
          sectionClassName="flex flex-col"
        >
          <div className="max-h-[260px] overflow-y-auto pr-1 -mr-1">
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
          </div>
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
          <div className="flex flex-col gap-2">
            <div className="relative flex-shrink-0 sticky top-0 z-10" style={{ backgroundColor: 'rgba(13,17,23,0.9)' }}>
              <input
                type="text"
                value={watchlistQuery}
                onChange={(event) => setWatchlistQuery(event.target.value)}
                placeholder="Add ticker..."
                className="w-full bg-white/5 border border-white/6 rounded-lg text-xs py-1.5 px-3 outline-none focus:ring-1 focus:ring-white/20"
                style={{ color: T.text }}
                aria-label="Add watchlist ticker"
              />
              <AnimatePresence initial={false}>
                {hasWatchlistQuery && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={OVERLAY_PANEL_TRANSITION}
                    className="absolute left-0 right-0 top-full mt-1 rounded-2xl border overflow-hidden z-20 shadow-2xl shadow-black/40"
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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-1.5 pr-0.5 max-h-[350px] overflow-y-auto scroll-smooth community-minimal-scrollbar scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
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
      <div className="flex-1 min-h-0 pr-1 flex flex-col gap-3">
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
            className="flex-1 min-h-0 flex flex-col gap-3"
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
  const [filter, setFilter] = useState(null);
  const [searchMode, setSearchMode] = useState(false);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerSubmitting, setComposerSubmitting] = useState(false);
  const [composerInitialType, setComposerInitialType] = useState('general');
  const [composerPrefilledText, setComposerPrefilledText] = useState('');
  const [composerOpenRewritePanel, setComposerOpenRewritePanel] = useState(false);
  const [quoteMap, setQuoteMap] = useState({});
  const [streamStatus, setStreamStatus] = useState(BASE_STREAM_STATUS);
  const [aiSearchResults, setAiSearchResults] = useState([]);
  const [aiSearchPending, setAiSearchPending] = useState([]);
  const [hashtagWebResults, setHashtagWebResults] = useState([]);
  const [hashtagWebLoading, setHashtagWebLoading] = useState(false);
  const [hashtagWebTag, setHashtagWebTag] = useState('');
  const [hashtagWebError, setHashtagWebError] = useState('');
  const [hashtagWebCache, setHashtagWebCache] = useState(() => readStoredHashtagWebCache());
  const [priceAlerts, setPriceAlerts] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const parsed = JSON.parse(window.localStorage.getItem(PRICE_ALERTS_STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [priceAlertPopoverOpen, setPriceAlertPopoverOpen] = useState(false);
  const [priceAlertTickerInput, setPriceAlertTickerInput] = useState('');
  const [priceAlertTargetInput, setPriceAlertTargetInput] = useState('');
  const [priceAlertDirection, setPriceAlertDirection] = useState('above');
  const [alertToasts, setAlertToasts] = useState([]);
  const [displayName, setDisplayName] = useState(() => {
    if (typeof window === 'undefined') return 'Anonymous Trader';
    try {
      return window.localStorage.getItem(DISPLAY_NAME_STORAGE_KEY) || 'Anonymous Trader';
    } catch {
      return 'Anonymous Trader';
    }
  });
  const [currentUserAvatar, setCurrentUserAvatar] = useState(() => readCurrentUserAvatar('Anonymous Trader'));
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const activeDisplayName = String(
    displayName || currentUser?.display_name || currentUser?.email?.split('@')[0] || 'Anonymous Trader'
  ).trim().slice(0, 24) || 'Anonymous Trader';
  const activeAvatarSeed = String(
    currentUserAvatar?.seed || activeDisplayName || 'Anonymous Trader'
  ).trim() || 'Anonymous Trader';
  const activeAvatarUrl = String(
    currentUserAvatar?.url || buildCurrentUserAvatarUrl(activeAvatarSeed)
  ).trim() || buildCurrentUserAvatarUrl(activeAvatarSeed);
  const priceAlertPopoverRef = useRef(null);
  const alertToastTimersRef = useRef(new Map());

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

  const dismissAlertToast = useCallback((toastId) => {
    setAlertToasts((prev) => prev.filter((toast) => toast.id !== toastId));
    const timeoutId = alertToastTimersRef.current.get(toastId);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      alertToastTimersRef.current.delete(toastId);
    }
  }, []);

  const pushAlertToast = useCallback((alert, currentPrice) => {
    const toastId = `price-alert-toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const normalizedPrice = toMaybeFiniteNumber(currentPrice);
    setAlertToasts((prev) => ([
      ...prev,
      {
        id: toastId,
        ticker: alert.ticker,
        targetPrice: alert.targetPrice,
        direction: alert.direction,
        price: Number.isFinite(normalizedPrice) ? normalizedPrice : toMaybeFiniteNumber(alert.targetPrice),
      },
    ]));

    const timeoutId = window.setTimeout(() => {
      dismissAlertToast(toastId);
    }, 8000);
    alertToastTimersRef.current.set(toastId, timeoutId);
  }, [dismissAlertToast]);

  const playAlertSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.8);
      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 1320;
        osc2.type = 'sine';
        gain2.gain.setValueAtTime(0.12, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc2.start(ctx.currentTime);
        osc2.stop(ctx.currentTime + 0.6);
      }, 200);
    } catch (e) {
      console.log('Audio not available');
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(PRICE_ALERTS_STORAGE_KEY, JSON.stringify(priceAlerts));
    } catch {
      // localStorage sync is best effort only
    }
  }, [priceAlerts]);

  useEffect(() => {
    if (!priceAlertPopoverOpen) return undefined;

    const handlePointerDown = (event) => {
      if (priceAlertPopoverRef.current?.contains(event.target)) return;
      setPriceAlertPopoverOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [priceAlertPopoverOpen]);

  useEffect(() => {
    return () => {
      alertToastTimersRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      alertToastTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    persistHashtagWebCache(hashtagWebCache);
  }, [hashtagWebCache]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const syncAvatarFromStorage = () => {
      const nextAvatar = readCurrentUserAvatar(activeDisplayName);
      setCurrentUserAvatar((prev) => {
        if (prev?.seed === nextAvatar.seed && prev?.url === nextAvatar.url) return prev;
        return nextAvatar;
      });
    };

    syncAvatarFromStorage();
    window.addEventListener('storage', syncAvatarFromStorage);
    return () => {
      window.removeEventListener('storage', syncAvatarFromStorage);
    };
  }, [activeDisplayName]);

  useEffect(() => {
    let cancelled = false;

    const getUser = async () => {
      let localDisplayName = '';
      if (typeof window !== 'undefined') {
        try {
          localDisplayName = String(window.localStorage.getItem(DISPLAY_NAME_STORAGE_KEY) || '').trim().slice(0, 24);
          if (localDisplayName) setDisplayName(localDisplayName);
        } catch {
          localDisplayName = '';
        }
      }

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user || cancelled) return;

        let profile = null;
        try {
          const { data } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url, email')
            .eq('id', user.id)
            .maybeSingle();
          profile = data;
        } catch {
          profile = null;
        }

        if (cancelled) return;

        const remoteDisplayName = String(profile?.display_name || '').trim().slice(0, 24);
        const metadataDisplayName = String(user.user_metadata?.full_name || '').trim().slice(0, 24);
        const emailDisplayName = String(user.email?.split('@')[0] || '').trim().slice(0, 24);
        const resolvedDisplayName = remoteDisplayName
          || localDisplayName
          || metadataDisplayName
          || emailDisplayName
          || 'Anonymous Trader';

        setDisplayName(resolvedDisplayName);
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, resolvedDisplayName);
            const existingAvatarSeed = String(window.localStorage.getItem(USER_AVATAR_SEED_STORAGE_KEY) || '').trim();
            if (!existingAvatarSeed) {
              window.localStorage.setItem(USER_AVATAR_SEED_STORAGE_KEY, resolvedDisplayName);
            }

            const existingAvatarUrl = String(window.localStorage.getItem(USER_AVATAR_URL_STORAGE_KEY) || '').trim();
            const remoteAvatarUrl = String(profile?.avatar_url || user.user_metadata?.avatar_url || '').trim();
            if (!existingAvatarUrl && remoteAvatarUrl) {
              window.localStorage.setItem(USER_AVATAR_URL_STORAGE_KEY, remoteAvatarUrl);
            }
          } catch {
            // localStorage sync is best effort only
          }
        }

        const resolvedAvatar = readCurrentUserAvatar(resolvedDisplayName);
        setCurrentUserAvatar(resolvedAvatar);

        setCurrentUser({
          id: user.id,
          email: user.email,
          display_name: resolvedDisplayName,
          avatar_url: resolvedAvatar.url,
          avatar_color: user.user_metadata?.avatar_color || null,
        });
      } catch {
        // fall back to local storage name and anonymous browsing
      }
    };

    void getUser();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setCurrentUser((prev) => {
      if (!prev) return prev;
      const sameDisplayName = String(prev.display_name || '').trim() === activeDisplayName;
      const sameAvatarUrl = String(prev.avatar_url || '').trim() === activeAvatarUrl;
      if (sameDisplayName && sameAvatarUrl) return prev;
      return { ...prev, display_name: activeDisplayName, avatar_url: activeAvatarUrl };
    });
  }, [activeAvatarUrl, activeDisplayName]);

  const handleSaveName = useCallback(async () => {
    const trimmedInput = String(editName || '').trim();
    if (!trimmedInput) {
      setEditName(activeDisplayName);
      setIsEditingName(false);
      return;
    }

    const trimmedName = trimmedInput.slice(0, 24);
    setDisplayName(trimmedName);
    setIsEditingName(false);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(DISPLAY_NAME_STORAGE_KEY, trimmedName);
        window.localStorage.setItem(USER_AVATAR_SEED_STORAGE_KEY, trimmedName);
      } catch {
        // localStorage sync is best effort only
      }
      window.dispatchEvent(new Event('storage'));
    }

    try {
      if (currentUser?.id) {
        await supabase.from('profiles').upsert({
          id: currentUser.id,
          display_name: trimmedName,
        });
      }
    } catch {
      // best effort profile sync; UI should not block on failure
    }
  }, [activeDisplayName, currentUser?.id, editName]);

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
    const alertSymbols = (Array.isArray(priceAlerts) ? priceAlerts : [])
      .map((alert) => normalizeSymbolKey(String(alert?.ticker || '').replace(/^\$+/, '')))
      .filter(Boolean);
    const symbols = [...new Set([...alertSymbols, ...DEFAULT_TICKERS, ...mentionSymbolsFromPosts(posts)].map(normalizeSymbolKey).filter(Boolean))];
    return symbols.slice(0, 48);
  }, [posts, priceAlerts]);

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
    console.log('[CommunityPage] Subscribing Twelve Data symbols:', trackedSymbols);

    const unsubscribeQuotes = subscribeTwelveDataQuotes(trackedSymbols, (update) => {
      const symbol = normalizeSymbolKey(update?.symbol);
      if (!symbol) return;
      console.log('[CommunityPage] WS price update received:', {
        symbol,
        price: update?.price,
        dayChangePercent: update?.dayChangePercent ?? update?.percentChange ?? null,
      });

      setQuoteMap((prev) => {
        return {
          ...prev,
          [symbol]: mergeStreamQuote(prev[symbol] || {}, update, symbol),
        };
      });
    });

    const unsubscribeStatus = subscribeTwelveDataStatus((status) => {
      console.log('[CommunityPage] Twelve Data stream status:', status);
      setStreamStatus(status || BASE_STREAM_STATUS);
    });

    return () => {
      console.log('[CommunityPage] Unsubscribing Twelve Data symbols:', trackedSymbols);
      unsubscribeQuotes?.();
      unsubscribeStatus?.();
    };
  }, [trackedSymbols]);

  useEffect(() => {
    if (!quoteMap || Object.keys(quoteMap).length === 0) return;

    const triggeredAlerts = [];
    setPriceAlerts((prev) => {
      let changed = false;
      const next = prev.map((alert) => {
        if (!alert?.active || alert?.triggered) return alert;

        const symbol = normalizeSymbolKey(String(alert?.ticker || '').replace(/^\$+/, ''));
        const targetPrice = toMaybeFiniteNumber(alert?.targetPrice);
        if (!symbol || !Number.isFinite(targetPrice)) return alert;

        const quote = quoteMap?.[symbol];
        const currentPrice = toMaybeFiniteNumber(quote?.price ?? quote?.last ?? quote?.close);
        if (!Number.isFinite(currentPrice)) return alert;

        const direction = alert.direction === 'below' ? 'below' : 'above';
        const isTriggered = direction === 'above'
          ? currentPrice >= targetPrice
          : currentPrice <= targetPrice;

        if (!isTriggered) return alert;

        changed = true;
        const triggeredAlert = {
          ...alert,
          active: false,
          triggered: true,
          triggeredAt: new Date().toISOString(),
        };
        triggeredAlerts.push({ alert: triggeredAlert, currentPrice });
        return triggeredAlert;
      });

      return changed ? next : prev;
    });

    if (triggeredAlerts.length > 0) {
      playAlertSound();
      triggeredAlerts.forEach(({ alert, currentPrice }) => {
        pushAlertToast(alert, currentPrice);
      });
    }
  }, [quoteMap, playAlertSound, pushAlertToast]);

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
          avatar_url: activeAvatarUrl,
          avatar_color: null,
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
          author_name: activeDisplayName,
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
          display_name: activeDisplayName,
          avatar_url: activeAvatarUrl,
          avatar_color: currentUser.avatar_color || null,
          email: currentUser.email,
        },
        is_mock: false,
      });

      return true;
    } catch {
      const fallbackLocal = {
        id: `local-post-${Date.now()}`,
        user_id: currentUser.id,
        author_name: activeDisplayName,
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
          display_name: activeDisplayName,
          avatar_url: activeAvatarUrl,
          avatar_color: currentUser.avatar_color || null,
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
  }, [activeAvatarUrl, activeDisplayName, currentUser, prependPost]);

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
            filter: filter || 'all',
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

  const handleSetPriceAlert = useCallback(async () => {
    const ticker = normalizePriceAlertTicker(priceAlertTickerInput);
    const targetPrice = toMaybeFiniteNumber(priceAlertTargetInput);
    const direction = priceAlertDirection === 'below' ? 'below' : 'above';

    if (!ticker || !Number.isFinite(targetPrice) || targetPrice <= 0) return;

    const alert = {
      id: Date.now(),
      ticker,
      targetPrice: Number(targetPrice.toFixed(2)),
      direction,
      active: true,
      triggered: false,
      createdAt: new Date().toISOString(),
    };

    setPriceAlerts((prev) => [alert, ...prev]);
    setPriceAlertPopoverOpen(false);
    setPriceAlertTickerInput('');
    setPriceAlertTargetInput('');
    setPriceAlertDirection('above');

    try {
      await supabase.from('price_alerts').insert(alert);
    } catch {
      // fall back to local state + localStorage only
    }
  }, [priceAlertDirection, priceAlertTargetInput, priceAlertTickerInput]);

  const togglePriceAlert = useCallback((alertId) => {
    setPriceAlerts((prev) => prev.map((alert) => {
      if (alert.id !== alertId) return alert;
      if (alert.triggered || !alert.active) {
        return { ...alert, active: true, triggered: false };
      }
      return { ...alert, active: false };
    }));
  }, []);

  const deletePriceAlert = useCallback((alertId) => {
    setPriceAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
  }, []);

  const clearCenterFeedSearchResults = useCallback(() => {
    setAiSearchPending([]);
    setAiSearchResults([]);
    setHashtagWebTag('');
    setHashtagWebResults([]);
    setHashtagWebLoading(false);
    setHashtagWebError('');
  }, []);

  const shouldUseWebFallbackForFilter = useCallback((nextFilter) => {
    if (!nextFilter) return false;
    const matchedCount = posts.reduce(
      (count, post) => (postMatchesFeedFilter(post, nextFilter) ? count + 1 : count),
      0,
    );
    return matchedCount < HASHTAG_WEB_MIN_VISIBLE_POSTS;
  }, [posts]);

  const handleSearchModeChange = useCallback((nextMode) => {
    if (nextMode) {
      setSearchMode(true);
      return;
    }

    setSearchMode(false);
    setFilter(null);
    clearCenterFeedSearchResults();
  }, [clearCenterFeedSearchResults]);

  const handleFeedFilterChange = useCallback((nextFilter) => {
    const normalizedFilter = typeof nextFilter === 'string' && String(nextFilter).trim()
      ? String(nextFilter).trim()
      : null;

    setFilter(normalizedFilter);

    if (!normalizedFilter) {
      setSearchMode(false);
      clearCenterFeedSearchResults();
      return;
    }

    if (shouldUseWebFallbackForFilter(normalizedFilter)) {
      setSearchMode(true);
    }
  }, [clearCenterFeedSearchResults, shouldUseWebFallbackForFilter]);

  const activeFeedFilter = filter;
  const activeFeedTag = normalizeFeedHashtag(activeFeedFilter);

  const filteredPosts = useMemo(() => (
    activeFeedFilter
      ? posts.filter((post) => postMatchesFeedFilter(post, activeFeedFilter))
      : posts
  ), [activeFeedFilter, posts]);

  const shouldShowWebFallback = Boolean(activeFeedFilter) && filteredPosts.length < HASHTAG_WEB_MIN_VISIBLE_POSTS;
  const activeHashtagCacheEntry = activeFeedTag ? hashtagWebCache[activeFeedTag] : null;
  const hasCachedHashtagWebEntry = Boolean(activeHashtagCacheEntry);
  const hasActiveHashtagWebResults = shouldShowWebFallback
    && Boolean(activeFeedTag)
    && hashtagWebTag === activeFeedTag
    && hashtagWebResults.length > 0;
  const activeHashtagWebResults = hasActiveHashtagWebResults ? hashtagWebResults : [];
  const activeHashtagWebError = hashtagWebTag === activeFeedTag ? hashtagWebError : '';
  const isHashtagWebPending = shouldShowWebFallback
    && Boolean(activeFeedTag)
    && hashtagWebLoading
    && hashtagWebTag === activeFeedTag
    && !hasCachedHashtagWebEntry;
  const shouldShowSearchingWebMessage = shouldShowWebFallback
    && isHashtagWebPending
    && !hasCachedHashtagWebEntry;
  const shouldShowNoPostsMessage = filteredPosts.length === 0
    && (!shouldShowWebFallback || (!isHashtagWebPending && !hasActiveHashtagWebResults));

  useEffect(() => {
    let cancelled = false;
    const tag = activeFeedTag;

    if (!tag || filteredPosts.length >= HASHTAG_WEB_MIN_VISIBLE_POSTS) {
      setHashtagWebTag(tag);
      setHashtagWebResults([]);
      setHashtagWebLoading(false);
      setHashtagWebError('');
      return undefined;
    }

    setHashtagWebTag(tag);
    setHashtagWebError('');

    const cachedTimestamp = Number(activeHashtagCacheEntry?.timestamp);
    const isCachedFresh = Number.isFinite(cachedTimestamp)
      && (Date.now() - cachedTimestamp < HASHTAG_WEB_CACHE_TTL_MS);
    if (isCachedFresh) {
      setHashtagWebResults(normalizeHashtagWebResults(activeHashtagCacheEntry?.data || []));
      setHashtagWebLoading(false);
      return undefined;
    }

    if (activeHashtagCacheEntry && !isCachedFresh) {
      setHashtagWebCache((prev) => {
        if (!prev?.[tag]) return prev;
        const next = { ...prev };
        delete next[tag];
        persistHashtagWebCache(next);
        return next;
      });
    }

    setHashtagWebResults([]);
    setHashtagWebLoading(true);

    const runHashtagWebSearch = async () => {
      try {
        const requestOptions = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hashtag: `#${tag}` }),
        };

        let response = await fetch('/api/community/hashtag-search.js', requestOptions);
        if (response.status === 404) {
          response = await fetch('/api/community/hashtag-search', requestOptions);
        }

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(String(payload?.error || `Hashtag search failed (${response.status})`).trim());
        }

        const payload = await response.json().catch(() => ({}));
        const rows = normalizeHashtagWebResults(payload?.items || payload?.data || payload);
        if (cancelled) return;

        setHashtagWebResults(rows);
        setHashtagWebCache((prev) => {
          const updated = { ...prev, [tag]: { data: rows, timestamp: Date.now() } };
          persistHashtagWebCache(updated);
          return updated;
        });
      } catch (fetchError) {
        if (cancelled) return;
        setHashtagWebResults([]);
        setHashtagWebError(String(fetchError?.message || 'Unable to load web search results right now.'));
      } finally {
        if (!cancelled) setHashtagWebLoading(false);
      }
    };

    void runHashtagWebSearch();

    return () => {
      cancelled = true;
    };
  }, [activeFeedTag, activeHashtagCacheEntry, filteredPosts.length]);

  const consumeComposerPrefill = useCallback(() => {
    setComposerPrefilledText('');
    setComposerOpenRewritePanel(false);
  }, []);

  const closeComposer = useCallback(() => {
    setComposerOpen(false);
    consumeComposerPrefill();
  }, [consumeComposerPrefill]);

  const openComposer = (type = 'general', options = {}) => {
    const draftPrefill = String(options?.prefilledText || '');
    const shouldOpenRewritePanel = Boolean(
      options?.openAiRewritePanel && draftPrefill.trim(),
    );
    setComposerInitialType(type);
    setComposerPrefilledText(draftPrefill);
    setComposerOpenRewritePanel(shouldOpenRewritePanel);
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
              onFilter={handleFeedFilterChange}
              priceAlerts={priceAlerts}
              onTogglePriceAlert={togglePriceAlert}
              onDeletePriceAlert={deletePriceAlert}
              currentUser={currentUser}
              avatarUrl={activeAvatarUrl}
              displayName={activeDisplayName}
              isEditingName={isEditingName}
              editName={editName}
              setEditName={setEditName}
              setIsEditingName={setIsEditingName}
              handleSaveName={handleSaveName}
            />

            <div className="flex-1 min-w-0 min-h-0 overflow-y-hidden overflow-x-visible flex flex-col">
              <div className="flex-1 min-h-0 flex gap-3 pt-3 pr-4">
                <div className="w-[92px] flex-shrink-0" aria-hidden />

                <div className="flex-1 min-w-0 min-h-0 overflow-hidden">
                  <div className="mx-auto flex h-full w-full min-w-0 max-w-[750px] flex-col transition-all duration-200">
                    <div className="px-3 pb-2">
                      <div className="flex items-center justify-end">
                        <div className="relative" ref={priceAlertPopoverRef}>
                          <button
                            type="button"
                            onClick={() => setPriceAlertPopoverOpen((prev) => !prev)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-[#e6edf3] hover:bg-white/10 transition"
                          >
                            <Bell className="h-3.5 w-3.5 text-[#58a6ff]" strokeWidth={1.5} />
                            <span>Price Alert</span>
                          </button>

                          <AnimatePresence initial={false}>
                            {priceAlertPopoverOpen && (
                              <motion.div
                                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                                transition={{ duration: 0.16, ease: 'easeOut' }}
                                className="absolute top-full right-0 mt-2 z-50 bg-[#0d1117] border border-white/10 rounded-xl p-4 shadow-2xl shadow-black/50 w-[300px]"
                              >
                                <div className="relative">
                                  <div className="text-sm font-semibold text-[#e6edf3]">Set Price Alert</div>
                                  <button
                                    type="button"
                                    onClick={() => setPriceAlertPopoverOpen(false)}
                                    className="absolute -top-1 -right-1 inline-flex items-center justify-center text-[#7d8590] hover:text-[#e6edf3] transition-colors"
                                    aria-label="Close price alert"
                                  >
                                    <X className="w-3.5 h-3.5" strokeWidth={1.5} />
                                  </button>
                                </div>

                                <div className="mt-3 space-y-2.5">
                                  <input
                                    type="text"
                                    value={priceAlertTickerInput}
                                    onChange={(event) => setPriceAlertTickerInput(normalizePriceAlertTicker(event.target.value))}
                                    placeholder="$AAPL"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-[#e6edf3] outline-none"
                                  />

                                  <input
                                    type="number"
                                    value={priceAlertTargetInput}
                                    onChange={(event) => setPriceAlertTargetInput(event.target.value)}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter') {
                                        event.preventDefault();
                                        void handleSetPriceAlert();
                                      }
                                    }}
                                    placeholder="250.00"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-[#e6edf3] outline-none"
                                  />

                                  <div className="grid grid-cols-2 gap-2">
                                    {['above', 'below'].map((direction) => {
                                      const active = priceAlertDirection === direction;
                                      return (
                                        <button
                                          key={direction}
                                          type="button"
                                          onClick={() => setPriceAlertDirection(direction)}
                                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${active ? 'bg-[#58a6ff] text-black' : 'bg-white/5 text-[#7d8590]'}`.trim()}
                                        >
                                          {direction === 'above' ? 'Above' : 'Below'}
                                        </button>
                                      );
                                    })}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => void handleSetPriceAlert()}
                                    className="bg-[#58a6ff] text-black font-semibold rounded-lg px-4 py-2 text-sm w-full mt-3 hover:bg-[#79b8ff] transition"
                                  >
                                    Set Alert
                                  </button>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto px-3">
                      <div className="w-full space-y-2">
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
                        ) : (
                          <>
                            {shouldShowNoPostsMessage ? (
                              <div
                                className={activeFeedFilter ? 'h-full flex items-center justify-center text-sm' : (hasAiSearchCards ? 'rounded-lg border p-3 text-sm' : 'h-full flex items-center justify-center text-sm')}
                                style={{ color: T.muted, borderColor: !activeFeedFilter && hasAiSearchCards ? T.border : 'transparent', backgroundColor: !activeFeedFilter && hasAiSearchCards ? T.card : 'transparent' }}
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
                                    currentUserAvatarUrl={activeAvatarUrl}
                                    onDelete={handleDeletePost}
                                    displayName={activeDisplayName}
                                  />
                                ))}
                              </motion.div>
                            )}

                            {shouldShowWebFallback ? (
                              <div className="mt-3 border-t border-white/6 pt-3 space-y-2">
                                {shouldShowSearchingWebMessage ? (
                                  <div className="text-xs text-[#7d8590]">
                                    Searching the web for more...
                                  </div>
                                ) : null}
                                <div className="text-xs text-[#7d8590] uppercase tracking-wider">
                                  Trending on the web
                                </div>

                                {isHashtagWebPending ? (
                                  <div className="space-y-2">
                                    {Array.from({ length: 3 }).map((_, idx) => (
                                      <div
                                        key={`hashtag-web-loading-${idx}`}
                                        className="relative h-16 overflow-hidden rounded-lg bg-white/3"
                                      >
                                        <div
                                          className="absolute inset-0"
                                          style={{
                                            background: 'linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.02) 100%)',
                                            backgroundSize: '200% 100%',
                                            animation: 'shimmer 1.2s linear infinite',
                                          }}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                ) : hasActiveHashtagWebResults ? (
                                  <div className="space-y-2">
                                    {activeHashtagWebResults.map((result, idx) => (
                                      <div
                                        key={`hashtag-web-result-${idx}-${result.headline.slice(0, 24)}`}
                                        className="rounded-xl border border-white/6 bg-white/3 p-3"
                                      >
                                        <div className="text-sm font-medium text-[#e6edf3]">
                                          {result.headline}
                                        </div>
                                        <div className="mt-1 text-xs text-[#7d8590]">
                                          {result.summary}
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[#7d8590]">
                                          <span className="uppercase tracking-wide">{result.source}</span>
                                          {result.relatedTickers.length > 0 ? (
                                            <span>{result.relatedTickers.map((ticker) => `$${ticker}`).join(' • ')}</span>
                                          ) : null}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="rounded-lg border border-white/6 bg-white/3 px-3 py-2 text-xs text-[#7d8590]">
                                    {activeHashtagWebError || `No additional web discussions found for #${hashtagWebTag || activeFeedTag}.`}
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="px-3 pb-3 pt-3">
                      <ChatInputBar
                        currentUser={currentUser}
                        currentUserAvatarUrl={activeAvatarUrl}
                        trackedSymbols={trackedSymbols}
                        quoteMap={quoteMap}
                        streamStatus={streamStatus}
                        searchMode={searchMode}
                        onModeChange={handleSearchModeChange}
                        onOpenComposer={openComposer}
                        onSend={(content, postType) => createPost({ content, postType, metadata: {} })}
                        onSearch={runAiSearch}
                      />
                    </div>
                  </div>
                </div>

                <RightSidebar quoteMap={quoteMap} />
              </div>
            </div>
          </div>
        </div>

      </motion.div>

      <PostComposerModal
        open={composerOpen}
        onClose={closeComposer}
        currentUser={currentUser}
        currentUserAvatarUrl={activeAvatarUrl}
        displayName={activeDisplayName}
        closedTrades={closedTrades}
        submitting={composerSubmitting}
        initialPostType={composerInitialType}
        prefilledText={composerPrefilledText}
        openAiRewritePanelOnOpen={composerOpenRewritePanel}
        onConsumePrefilledText={consumeComposerPrefill}
        onSubmit={createPost}
      />

      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence initial={false}>
          {alertToasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0, transition: { type: 'spring', stiffness: 280, damping: 24 } }}
              exit={{ opacity: 0, x: 50, transition: { duration: 0.3 } }}
              className="bg-[#0d1117] border border-[#58a6ff]/30 rounded-xl px-4 py-3 shadow-2xl shadow-[#58a6ff]/10 flex items-center gap-3 min-w-[280px] pointer-events-auto"
            >
              <Bell className="w-5 h-5 text-[#58a6ff] alert-toast-bell" strokeWidth={1.5} />
              <div className="min-w-0">
                <div className="text-sm font-medium text-[#e6edf3] truncate">
                  {toast.ticker} hit ${Number.isFinite(toMaybeFiniteNumber(toast.price)) ? Number(toMaybeFiniteNumber(toast.price)).toFixed(2) : '--'}!
                </div>
                <div className="text-xs">
                  <span className={toast.direction === 'above' ? 'text-[#3fb950]' : 'text-[#f85149]'}>
                    {toast.direction === 'above' ? '↑ Above' : '↓ Below'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => dismissAlertToast(toast.id)}
                className="ml-auto text-[#7d8590] hover:text-[#e6edf3] transition"
                aria-label="Close alert notification"
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CommunityPage;
