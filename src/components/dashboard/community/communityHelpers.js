import {
  AI_SEARCH_CLIENT_CACHE,
  AI_SEARCH_CLIENT_CACHE_TTL,
  AI_SEARCH_INFLIGHT,
  BOT_HASHTAG_CONTEXT_BY_TAG,
  DISPLAY_NAME_STORAGE_KEY,
  FEED_HASHTAGS,
  FEED_HASHTAGS_ENABLED_STORAGE_KEY,
  HASHTAG_WEB_CACHE_STORAGE_KEY,
  HASHTAG_WEB_CACHE_TTL_MS,
  HASHTAG_WEB_MAX_RESULTS,
  LEGACY_POST_TYPE_MAP,
  MAX_VISIBLE_FEED_HASHTAGS,
  MOCK_AUTHORS,
  MOCK_BASE_SETUPS,
  MOCK_REACTION_POOL,
  POST_TYPE_ORDER,
  PROFILE_AVATAR_BACKGROUND_COLORS,
  PROFILE_AVATAR_FALLBACK_COLOR,
  PROFILE_AVATAR_STYLES,
  PROFILE_AVATAR_SEEDS_PER_STYLE,
  PROFILE_PICKER_AVATAR_OPTIONS,
  SLIP_EMOJI_PRESETS,
  USER_AVATAR_SEED_STORAGE_KEY,
  USER_AVATAR_URL_STORAGE_KEY,
} from './communityConstants';
import { ALL_FEED_HASHTAGS } from './communityConstants';

// ─── Avatar Helpers ───────────────────────────────────────
export const buildProfileAvatarUrl = (style, seed) => (
  `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}&size=128&radius=50&backgroundType=gradientLinear&backgroundColor=${PROFILE_AVATAR_BACKGROUND_COLORS}`
);

export const buildProfilePickerAvatarOptions = () =>
  PROFILE_AVATAR_STYLES.flatMap((style) =>
    Array.from(
      { length: PROFILE_AVATAR_SEEDS_PER_STYLE },
      (_, i) => buildProfileAvatarUrl(style, `stratify-${style}-${i + 1}`),
    )
  );

const _avatarOptions = buildProfilePickerAvatarOptions();

export const hashString = (value) => (
  String(value || '')
    .split('')
    .reduce((acc, char) => ((acc * 31) + char.charCodeAt(0)) >>> 0, 7)
);

export const normalizeAvatarColor = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw}`;
  return null;
};

export const getAvatarSeed = (user) => (
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

export const buildCurrentUserAvatarUrl = (seed) => (
  `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(String(seed || 'Anonymous').trim() || 'Anonymous')}`
);

export const readCurrentUserAvatar = (fallbackSeed = 'Anonymous') => {
  const safeFallbackSeed = String(fallbackSeed || 'Anonymous').trim() || 'Anonymous';
  if (typeof window === 'undefined') {
    return { seed: safeFallbackSeed, url: buildCurrentUserAvatarUrl(safeFallbackSeed) };
  }

  let storedSeed = '';
  let storedUrl = '';
  try {
    storedSeed = String(window.localStorage.getItem(USER_AVATAR_SEED_STORAGE_KEY) || '').trim();
    window.localStorage.getItem(DISPLAY_NAME_STORAGE_KEY);
    storedUrl = String(window.localStorage.getItem(USER_AVATAR_URL_STORAGE_KEY) || '').trim();
  } catch {
    // localStorage sync is best effort only
  }

  const seed = storedSeed || safeFallbackSeed;
  const url = storedUrl || buildCurrentUserAvatarUrl(seed);
  return { seed, url };
};

export const getResolvedAvatarUrl = (user) => {
  const rawAvatarUrl = String(user?.avatar_url || '').trim();
  if (rawAvatarUrl && !/ui-avatars\.com/i.test(rawAvatarUrl)) {
    return rawAvatarUrl;
  }

  if (_avatarOptions.length === 0) return '';
  const seed = getAvatarSeed(user).toLowerCase();
  const index = hashString(seed) % _avatarOptions.length;
  return _avatarOptions[index];
};

// ─── Text Helpers ─────────────────────────────────────────
export const timeAgo = (date) => {
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

export const extractTickers = (text) => {
  const matches = text.match(/\$[A-Z]{1,6}/g);
  return matches ? [...new Set(matches.map((t) => t.replace('$', '')))] : [];
};

export const extractHashtags = (text) => {
  const matches = String(text || '').match(/#[A-Za-z][A-Za-z0-9_-]*/g);
  return matches
    ? [...new Set(matches.map((tag) => String(tag || '').trim().toLowerCase().replace(/^#/, '')).filter(Boolean))]
    : [];
};

export const highlightTickers = (text) => {
  return text.replace(
    /\$([A-Z]{1,6})/g,
    '<span class="text-[#58a6ff] font-semibold cursor-pointer hover:underline">$$$1</span>'
  );
};

export const normalizeAiSearchQuery = (value) => String(value || '').trim().replace(/\s+/g, ' ');
export const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ─── AI Search Cache ──────────────────────────────────────
export const getClientAiSearchCached = (queryKey) => {
  const entry = AI_SEARCH_CLIENT_CACHE.get(queryKey);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    AI_SEARCH_CLIENT_CACHE.delete(queryKey);
    return null;
  }
  return entry.data;
};

export const setClientAiSearchCached = (queryKey, data) => {
  AI_SEARCH_CLIENT_CACHE.set(queryKey, {
    data,
    expiresAt: Date.now() + AI_SEARCH_CLIENT_CACHE_TTL,
  });
};

// ─── AI Search Sanitizers ─────────────────────────────────
export const sanitizeAiSentiment = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'bullish' || normalized === 'bearish' || normalized === 'neutral') return normalized;
  return 'neutral';
};

export const sanitizeAiSources = (rows = []) => {
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

export const sanitizeAiTickers = (rows = []) => {
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

export const sanitizeAiSearchData = (raw, query) => {
  const summary = String(raw?.summary || '').trim();
  const keyPoints = (Array.isArray(raw?.keyPoints) ? raw.keyPoints : [])
    .map((point) => String(point || '').trim())
    .filter(Boolean)
    .slice(0, 8);
  const relatedTickers = sanitizeAiTickers(raw?.relatedTickers || []);
  const tickerSnapshotsRaw = raw?.tickerSnapshots && typeof raw.tickerSnapshots === 'object'
    ? raw.tickerSnapshots
    : {};
  const tickerSnapshots = relatedTickers.reduce((acc, ticker) => {
    const row = tickerSnapshotsRaw[ticker];
    if (!row || typeof row !== 'object') return acc;
    acc[ticker] = {
      price: toMaybeFiniteNumber(row?.price),
      percentChange: toMaybeFiniteNumber(row?.percentChange),
      change: toMaybeFiniteNumber(row?.change),
      timestamp: row?.timestamp || null,
    };
    return acc;
  }, {});

  return {
    summary: summary || `No summary available for "${query}".`,
    keyPoints,
    sources: sanitizeAiSources(raw?.sources || []),
    relatedTickers,
    sentiment: sanitizeAiSentiment(raw?.sentiment),
    tickerSnapshots,
    generatedAt: String(raw?.generatedAt || '').trim() || null,
  };
};

const SUGGESTION_MAP = {
  earn:      ['earnings reports today', 'earnings surprises this week', 'earnings calendar upcoming', 'earnings beats and misses', 'earnings season analysis'],
  option:    ['options flow unusual activity', 'options expiration this week', 'options trading strategies', 'options volume leaders', 'options sentiment'],
  momentum:  ['momentum stocks today', 'momentum breakout setups', 'momentum sector rotation', 'momentum trading signals', 'momentum vs value'],
  macro:     ['macro economic outlook', 'macro fed rate decision', 'macro inflation data', 'macro treasury yields', 'macro GDP forecast'],
  sentiment: ['market sentiment today', 'sentiment fear greed index', 'sentiment retail vs institutional', 'sentiment social media', 'sentiment put call ratio'],
  dark:      ['dark pool activity', 'dark pool large trades', 'dark pool block orders', 'dark pool institutional flow', 'dark pool signals'],
  short:     ['short interest highest', 'short squeeze candidates', 'short interest changes', 'short selling activity', 'short interest by sector'],
  crypto:    ['crypto market today', 'crypto bitcoin analysis', 'crypto ethereum news', 'crypto regulation update', 'crypto whale activity'],
  premarket: ['premarket movers today', 'premarket gap ups', 'premarket gap downs', 'premarket earnings', 'premarket futures'],
};

export const generateSuggestions = (query) => {
  if (!query || query.trim().length < 2) return [];
  const q = query.trim().toLowerCase();
  const matchedKey = Object.keys(SUGGESTION_MAP).find((key) => q.includes(key));
  if (matchedKey) return SUGGESTION_MAP[matchedKey];
  const display = query.trim();
  return [
    `${display} stock news today`,
    `${display} price prediction`,
    `${display} market analysis`,
    `${display} earnings report`,
    `What is happening with ${display} today?`,
  ];
};

// ─── Reaction Helpers ─────────────────────────────────────
export const buildReactionSummary = (rows = [], currentUserId = null) => {
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

export const applyReactionState = (currentReactions = [], emoji, shouldReact) => {
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

export const sortByCreatedAtAsc = (rows = []) =>
  [...rows].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

// ─── Number Helpers ───────────────────────────────────────
export const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const toMaybeFiniteNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

// ─── Format Helpers ───────────────────────────────────────
export const formatCurrency = (value) => `$${Math.abs(toFiniteNumber(value)).toLocaleString('en-US', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
})}`;

export const formatSignedCurrency = (value) => `${toFiniteNumber(value) >= 0 ? '+' : '-'}${formatCurrency(value)}`;

export const formatSignedPercent = (value, digits = 2) => {
  const amount = toFiniteNumber(value);
  return `${amount >= 0 ? '+' : ''}${amount.toFixed(digits)}%`;
};

export const formatDateTime = (value) => {
  const timestamp = Number.isFinite(value) ? value : Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '\u2014';
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
};

export const formatPrice = (value) => {
  const n = toFiniteNumber(value);
  if (n === 0) return '--';
  if (n >= 1000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
};

// ─── Trade / Slip Helpers ─────────────────────────────────
export const normalizeTradeForSlip = (rawTrade) => {
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

export const buildClosedTradesForSlip = (tradeHistory = []) => {
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

export const createSlipCaption = ({ trade, emojis = [], note = '' }) => {
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

// ─── Quote Merging ────────────────────────────────────────
export const normalizeSymbolKey = (value) => {
  const raw = String(value || '').trim().toUpperCase().replace(/^\$+/, '');
  if (!raw) return '';
  if (raw.includes(':')) return raw.split(':').pop().replace(/^\$+/, '');
  return raw;
};

export const normalizePriceAlertTicker = (value) => {
  const raw = String(value || '').trim().toUpperCase().replace(/\s+/g, '').replace(/^\$+/, '');
  const sanitized = raw.replace(/[^A-Z0-9./=-]/g, '').slice(0, 14);
  return sanitized ? `$${sanitized}` : '';
};

export const mergeQuotesFromPayload = (rows = [], previous = {}) => {
  const next = { ...previous };
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const symbol = normalizeSymbolKey(row?.symbol);
    if (!symbol) return;
    const existing = next[symbol] || {};
    const price = toMaybeFiniteNumber(row?.price ?? row?.last ?? row?.close);
    const percentChange = toMaybeFiniteNumber(
      row?.dayChangePercent ?? row?.day_change_percent ?? row?.percentChange ?? row?.changePercent ?? row?.percent_change
    );
    const rawChange = toMaybeFiniteNumber(row?.change);
    const previousClose = toMaybeFiniteNumber(row?.previousClose ?? row?.previous_close);
    const existingPrice = toMaybeFiniteNumber(existing?.price ?? existing?.last ?? existing?.close);
    const existingPercent = toMaybeFiniteNumber(
      existing?.dayChangePercent ?? existing?.day_change_percent ?? existing?.percentChange ?? existing?.percent_change
    );
    const baselineFromExistingPercent = (
      Number.isFinite(existingPrice) && Number.isFinite(existingPercent) && existingPercent !== -100
    ) ? existingPrice / (1 + (existingPercent / 100)) : null;
    const baselineFromChange = (Number.isFinite(price) && Number.isFinite(rawChange)) ? price - rawChange : null;
    const baselineFromPercent = (
      Number.isFinite(price) && Number.isFinite(percentChange) && percentChange !== -100
    ) ? price / (1 + (percentChange / 100)) : null;
    const baseline = (
      previousClose ?? baselineFromChange ?? baselineFromPercent
      ?? toMaybeFiniteNumber(existing?.dayBaselinePrice)
      ?? toMaybeFiniteNumber(existing?.previousClose ?? existing?.previous_close)
      ?? baselineFromExistingPercent
    );
    const derivedChange = Number.isFinite(rawChange)
      ? rawChange
      : (Number.isFinite(price) && Number.isFinite(baseline))
        ? price - baseline
        : toMaybeFiniteNumber(existing?.change);
    const derivedPercent = Number.isFinite(percentChange)
      ? percentChange
      : (Number.isFinite(price) && Number.isFinite(baseline) && baseline !== 0)
        ? ((price - baseline) / baseline) * 100
        : toMaybeFiniteNumber(existing?.dayChangePercent ?? existing?.day_change_percent ?? existing?.percentChange ?? existing?.percent_change);

    next[symbol] = {
      ...existing, symbol,
      name: row?.name || existing?.name || symbol,
      exchange: row?.exchange || existing?.exchange || null,
      price: price ?? existing?.price ?? null,
      percentChange: derivedPercent, percent_change: derivedPercent,
      dayChangePercent: derivedPercent, day_change_percent: derivedPercent,
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

export const mergeStreamQuote = (existingQuote = {}, update = {}, symbol = '') => {
  const nextPrice = toMaybeFiniteNumber(update?.price ?? update?.last ?? update?.close);
  const rawPercent = toMaybeFiniteNumber(
    update?.dayChangePercent ?? update?.day_change_percent ?? update?.percentChange ?? update?.percent_change
    ?? update?.raw?.dayChangePercent ?? update?.raw?.day_change_percent ?? update?.raw?.percentChange ?? update?.raw?.percent_change
  );
  const rawChange = toMaybeFiniteNumber(update?.change ?? update?.raw?.change);
  const streamPreviousClose = toMaybeFiniteNumber(
    update?.raw?.previousClose ?? update?.raw?.previous_close ?? update?.previousClose ?? update?.previous_close
  );
  const existingPrice = toMaybeFiniteNumber(existingQuote?.price ?? existingQuote?.last ?? existingQuote?.close);
  const existingPercent = toMaybeFiniteNumber(
    existingQuote?.dayChangePercent ?? existingQuote?.day_change_percent ?? existingQuote?.percentChange ?? existingQuote?.percent_change
  );
  const baselineFromExistingPercent = (
    Number.isFinite(existingPrice) && Number.isFinite(existingPercent) && existingPercent !== -100
  ) ? existingPrice / (1 + (existingPercent / 100)) : null;
  const baselineFromExisting = (
    toMaybeFiniteNumber(existingQuote?.dayBaselinePrice)
    ?? toMaybeFiniteNumber(existingQuote?.previousClose ?? existingQuote?.previous_close)
    ?? baselineFromExistingPercent
  );
  const baselineFromChange = (Number.isFinite(nextPrice) && Number.isFinite(rawChange)) ? nextPrice - rawChange : null;
  const baselineFromPercent = (
    Number.isFinite(nextPrice) && Number.isFinite(rawPercent) && rawPercent !== -100
  ) ? nextPrice / (1 + (rawPercent / 100)) : null;
  const baseline = streamPreviousClose ?? baselineFromExisting ?? baselineFromChange ?? baselineFromPercent;

  const derivedChange = Number.isFinite(rawChange)
    ? rawChange
    : (Number.isFinite(nextPrice) && Number.isFinite(baseline))
      ? nextPrice - baseline
      : toMaybeFiniteNumber(existingQuote?.change);
  const derivedPercent = Number.isFinite(rawPercent)
    ? rawPercent
    : (Number.isFinite(nextPrice) && Number.isFinite(baseline) && baseline !== 0)
      ? ((nextPrice - baseline) / baseline) * 100
      : toMaybeFiniteNumber(existingQuote?.dayChangePercent ?? existingQuote?.day_change_percent ?? existingQuote?.percentChange ?? existingQuote?.percent_change);

  return {
    ...existingQuote, symbol,
    name: existingQuote?.name || symbol,
    price: Number.isFinite(nextPrice) ? nextPrice : existingQuote?.price ?? null,
    change: derivedChange,
    percentChange: derivedPercent, percent_change: derivedPercent,
    dayChangePercent: derivedPercent, day_change_percent: derivedPercent,
    previousClose: baseline ?? existingQuote?.previousClose ?? null,
    previous_close: baseline ?? existingQuote?.previous_close ?? null,
    dayBaselinePrice: baseline ?? existingQuote?.dayBaselinePrice ?? null,
    timestamp: update?.timestamp || new Date().toISOString(),
    source: 'ws',
  };
};

export const mentionSymbolsFromPosts = (rows = []) => {
  const symbols = new Set();
  (Array.isArray(rows) ? rows : []).forEach((post) => {
    extractTickers(post?.content || '').forEach((symbol) => symbols.add(normalizeSymbolKey(symbol)));
    const metadataTicker = normalizeSymbolKey(post?.metadata?.ticker || post?.metadata?.symbol);
    if (metadataTicker) symbols.add(metadataTicker);
  });
  return [...symbols].filter(Boolean);
};

// ─── Post Type Helpers ────────────────────────────────────
export const sanitizePostType = (type) => {
  const normalized = String(type || '').trim().toLowerCase();
  const mapped = LEGACY_POST_TYPE_MAP[normalized] || normalized;
  if (POST_TYPE_ORDER.includes(mapped)) return mapped;
  return 'general';
};

export const shareToX = (post) => {
  let text = String(post?.content || '').trim();
  const pnlValue = Number(post?.metadata?.pnl);
  if (sanitizePostType(post?.post_type) === 'pnl' && Number.isFinite(pnlValue)) {
    const ticker = post?.metadata?.ticker ? `$${post.metadata.ticker}` : 'my trade';
    const pnlStr = `${ticker} ${formatSignedCurrency(pnlValue)}${Number.isFinite(Number(post?.metadata?.percent)) ? ` ${formatSignedPercent(Number(post.metadata.percent))}` : ''}`;
    text = text ? `${pnlStr}: ${text}` : pnlStr;
  }
  shareTextToX(text);
};

export const shareTextToX = (rawText) => {
  const text = `${String(rawText || '').trim()} via @stratify_hq`.trim();
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent('https://stratifymarket.com/dashboard')}`;
  window.open(url, '_blank', 'noopener,noreferrer');
};

// ─── Hashtag Feed Helpers ─────────────────────────────────
export const normalizeFeedHashtag = (value) => String(value || '').trim().toLowerCase().replace(/^#/, '');
export const sanitizeHashtagLabel = (tag) => String(tag || '').trim().replace(/^#/, '');

export const postMatchesFeedFilter = (post, activeFeedFilter) => {
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

export const getBotHashtagContextLine = (tag, symbol, index) => {
  const normalizedTag = normalizeFeedHashtag(tag);
  const options = BOT_HASHTAG_CONTEXT_BY_TAG[normalizedTag] || [];
  if (options.length === 0) return '';
  const template = options[index % options.length];
  if (typeof template === 'function') return String(template(symbol) || '').trim();
  return String(template || '').trim();
};

export const normalizeHashtagWebTickers = (rows = []) => {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : [])
    .map((value) => String(value || '').trim().replace(/^\$/, '').toUpperCase())
    .map((value) => value.replace(/[^A-Z0-9./=-]/g, '').slice(0, 14))
    .filter(Boolean)
    .filter((value) => { if (seen.has(value)) return false; seen.add(value); return true; })
    .slice(0, 6);
};

export const normalizeHashtagWebResults = (rows = []) => {
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

export const readStoredHashtagWebCache = () => {
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
      valid[key] = { data: normalizeHashtagWebResults(entry?.data || []), timestamp };
    });
    return valid;
  } catch {
    return {};
  }
};

export const persistHashtagWebCache = (cache = {}) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HASHTAG_WEB_CACHE_STORAGE_KEY, JSON.stringify(cache || {}));
  } catch {
    // localStorage sync is best effort only
  }
};

export const readEnabledFeedHashtags = () => {
  if (typeof window === 'undefined') return ALL_FEED_HASHTAGS.slice(0, MAX_VISIBLE_FEED_HASHTAGS).map(f => f.id);
  try {
    const saved = JSON.parse(window.localStorage.getItem(FEED_HASHTAGS_ENABLED_STORAGE_KEY));
    if (Array.isArray(saved) && saved.length > 0) return saved.slice(0, MAX_VISIBLE_FEED_HASHTAGS);
  } catch {}
  return ALL_FEED_HASHTAGS.slice(0, MAX_VISIBLE_FEED_HASHTAGS).map(f => f.id);
};

export const persistEnabledFeedHashtags = (ids) => {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(FEED_HASHTAGS_ENABLED_STORAGE_KEY, JSON.stringify(ids.slice(0, MAX_VISIBLE_FEED_HASHTAGS))); } catch {}
};

// ─── Mock Feed Generator ──────────────────────────────────
export const makeMockReactionRows = (index) => {
  const count = (index % 4) + 1;
  return Array.from({ length: count }).map((_, offset) => ({
    id: `mock-r-${index}-${offset}`,
    emoji: MOCK_REACTION_POOL[(index + (offset * 2)) % MOCK_REACTION_POOL.length],
    user_id: `mock-reactor-${(index * 5) + offset}`,
  }));
};

export const generateMockFeed = (mockAuthors = MOCK_AUTHORS, mockBaseSetups = MOCK_BASE_SETUPS) => {
  const safeAuthors = Array.isArray(mockAuthors) && mockAuthors.length > 0 ? mockAuthors : MOCK_AUTHORS;
  const safeSetups = Array.isArray(mockBaseSetups) && mockBaseSetups.length > 0 ? mockBaseSetups : MOCK_BASE_SETUPS;
  const now = Date.now();
  const rows = Array.from({ length: 36 }).map((_, index) => {
    const setup = safeSetups[index % safeSetups.length];
    const author = safeAuthors[index % safeAuthors.length];
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
        ticker: setup.symbol, pnl, percent,
        entry_price: entryPrice, exit_price: exitPrice, shares,
        opened_at: openedAt, closed_at: closedAt,
        emoji: [SLIP_EMOJI_PRESETS[index % SLIP_EMOJI_PRESETS.length]],
      };

      content = createSlipCaption({
        trade: { symbol: setup.symbol, pnl, percent, entryPrice, exitPrice, shares, openedAt, closedAt },
        emojis: metadata.emoji,
        note: index % 2 === 0 ? 'Executed per plan with strict risk management.' : 'Stayed disciplined and took what the tape gave.',
      });
    } else if (postType === 'alert') {
      const trigger = Number((70 + ((index * 9.4) % 360)).toFixed(2));
      metadata = { ticker: setup.symbol, trigger_price: trigger, reason: index % 2 === 0 ? 'Breakout trigger' : 'Breakdown trigger' };
      content = `${setup.note} Alert set for $${setup.symbol} at ${formatCurrency(trigger)} with confirmation on volume.`;
    } else if (postType === 'strategy') {
      metadata = { ticker: setup.symbol, timeframe: index % 2 === 0 ? '5m' : '15m', risk_model: index % 3 === 0 ? '0.5R scout' : '1R standard' };
      content = `${setup.note} Strategy conditions: liquidity above average and trend alignment in $${setup.symbol}.`;
    } else if (postType === 'trade') {
      metadata = { ticker: setup.symbol, side: index % 4 === 0 ? 'sell' : 'buy', setup: index % 2 === 0 ? 'Opening range break' : 'VWAP reclaim' };
      content = `${setup.note} Shared execution details on $${setup.symbol} so the room can compare entries.`;
    } else if (postType === 'earnings') {
      metadata = { ticker: setup.symbol, timing: index % 2 === 0 ? 'after_close' : 'before_open' };
      content = `${setup.note} Earnings focus on $${setup.symbol}: mapping implied move versus expected reaction.`;
    } else if (postType === 'macro') {
      metadata = { ticker: setup.symbol, theme: index % 2 === 0 ? 'rates' : 'risk-on' };
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
      assignedFeedTags.map((tag) => sanitizeHashtagLabel(tag)).filter(Boolean)
    )];

    return {
      id: `mock-post-${index + 1}`,
      user_id: `mock-user-${author.id}`,
      author_name: author.name,
      content, hashtags,
      image_url: null,
      ticker_mentions: extractTickers(content),
      post_type: postType, metadata,
      created_at: createdAt,
      likes_count: likesCount, replies_count: repliesCount, comments_count: repliesCount,
      community_reactions: reactionRows,
      reaction_summary: buildReactionSummary(reactionRows, null),
      profiles: { id: `mock-user-${author.id}`, display_name: author.name, avatar_url: author.avatar_url, email: author.email },
      is_mock: true,
      mock_replies: repliesCount > 0
        ? Array.from({ length: Math.min(3, repliesCount) }).map((__, replyIdx) => {
            const replyAuthor = safeAuthors[(index + replyIdx + 1) % safeAuthors.length];
            return {
              id: `mock-reply-${index + 1}-${replyIdx + 1}`,
              user_id: `mock-user-${replyAuthor.id}`,
              author_name: replyAuthor.name,
              content: replyIdx % 2 === 0
                ? `Nice execution on $${setup.symbol}. Risk was clearly defined.`
                : `I had a similar read on $${setup.symbol}, appreciate the level callouts.`,
              created_at: new Date(new Date(createdAt).getTime() + (replyIdx + 1) * 8 * 60 * 1000).toISOString(),
              profiles: { id: `mock-user-${replyAuthor.id}`, display_name: replyAuthor.name, avatar_url: replyAuthor.avatar_url, email: replyAuthor.email },
              community_reactions: makeMockReactionRows(index + replyIdx + 2),
            };
          })
        : [],
    };
  });

  return rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};
