import { createHash } from 'node:crypto';
import { Redis } from '@upstash/redis';

export const config = { maxDuration: 30 };

const CACHE_TTL_SECONDS = 75;
const RATE_LIMIT_PER_MINUTE = 30;
const RATE_LIMIT_KEY_PREFIX = 'ai-search:ratelimit';
const MARKETAUX_BASE_URL = 'https://api.marketaux.com/v1/news/all';
const TWELVE_DATA_QUOTE_URL = 'https://api.twelvedata.com/quote';

const MOMENTUM_FALLBACK_SYMBOLS = [
  'NVDA', 'AAPL', 'MSFT', 'META', 'AMZN', 'TSLA', 'AMD', 'AVGO', 'NFLX', 'PLTR', 'SMCI', 'COIN',
];

/** Diverse pool so Ideas refresh always has 8+ candidates (avoids returning only the user’s holding). */
const IDEAS_DIVERSITY_SYMBOLS = [
  'SPY', 'QQQ', 'NVDA', 'AAPL', 'MSFT', 'META', 'AMZN', 'TSLA', 'AMD', 'GOOGL', 'MSTR', 'COIN', 'PLTR', 'NFLX', 'AVGO', 'SMH', 'IWM', 'XLF',
];

let redisClient = null;
let redisDisabled = false;

function getRedisClient() {
  if (redisDisabled) return null;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (redisClient) return redisClient;
  try {
    redisClient = new Redis({ url, token });
    return redisClient;
  } catch (error) {
    redisDisabled = true;
    redisClient = null;
    console.error('[community/ai-search] Redis init failed:', error);
    return null;
  }
}

function normalizeQuery(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function hashQuery(query) {
  return createHash('sha256').update(normalizeQuery(query).toLowerCase()).digest('hex').slice(0, 40);
}

function makeCacheKey(query, refreshNonce) {
  const base = hashQuery(query);
  const nonce = refreshNonce != null && String(refreshNonce).trim() !== ''
    ? String(refreshNonce).trim()
    : '';
  return nonce ? `ai-search:v2:{${base}}:${nonce}` : `ai-search:v2:{${base}}`;
}

function toNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) return null;
    const parsed = Number(normalized.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSymbol(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^\$+/, '')
    .replace(/[^A-Z0-9./=-]/g, '')
    .slice(0, 14);
}

function normalizeEntitySymbol(entity = {}) {
  const raw = normalizeSymbol(entity?.symbol || entity?.code || '');
  if (!raw) return '';
  const type = String(entity?.type || '').toLowerCase();
  if (!raw.includes('/') && (type.includes('crypto') || type === 'cryptocurrency')) {
    return `${raw}/USD`;
  }
  return raw;
}

function normalizeUrl(url) {
  return String(url || '')
    .trim()
    .toLowerCase()
    .replace(/[?#].*$/, '');
}

function relativeTime(value) {
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return '';
  const minutes = Math.floor((Date.now() - ts) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatSignedPercent(value, digits = 2) {
  const n = toNumber(value);
  if (!Number.isFinite(n)) return 'n/a';
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`;
}

function formatPrice(value) {
  const n = toNumber(value);
  if (!Number.isFinite(n)) return 'n/a';
  if (n >= 1000) return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

function sanitizeSummary(text, fallback) {
  const summary = String(text || '').trim();
  if (summary) return summary;
  return fallback;
}

function getDateDaysAgo(daysBack = 1) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - Math.max(0, Number(daysBack) || 0));
  return date.toISOString().slice(0, 10);
}

function trimText(value, limit = 220) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1).trim()}…`;
}

async function checkRateLimit(redis) {
  if (!redis) return { allowed: true, count: null };
  try {
    const minuteBucket = Math.floor(Date.now() / 60000);
    const key = `${RATE_LIMIT_KEY_PREFIX}:${minuteBucket}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 60);
    return { allowed: count <= RATE_LIMIT_PER_MINUTE, count };
  } catch {
    return { allowed: true, count: null };
  }
}

function parseMarketauxArticles(payload) {
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const seen = new Set();
  const normalized = [];

  for (const row of rows) {
    const url = String(row?.url || '').trim();
    const title = trimText(row?.title, 220);
    const key = normalizeUrl(url) || title.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const tickers = [...new Set(
      (Array.isArray(row?.entities) ? row.entities : [])
        .map((entity) => normalizeEntitySymbol(entity))
        .filter(Boolean)
    )].slice(0, 8);

    normalized.push({
      id: row?.uuid || url || `${title}-${normalized.length}`,
      title: title || 'Untitled',
      description: trimText(row?.description || row?.snippet || '', 280),
      url,
      source: String(row?.source || row?.source_domain || 'News').trim(),
      sourceDomain: String(row?.source_domain || '').trim(),
      publishedAt: row?.published_at || null,
      timeAgo: relativeTime(row?.published_at),
      tickers,
    });
  }

  return normalized;
}

async function fetchMarketauxNews(query, { daysBack = 1, limit = 30 } = {}) {
  const apiToken = String(process.env.MARKETAUX_API_KEY || '').trim();
  if (!apiToken) {
    throw new Error('MARKETAUX_API_KEY is missing.');
  }

  const params = new URLSearchParams({
    search: query,
    filter_entities: 'true',
    language: 'en',
    published_after: getDateDaysAgo(daysBack),
    sort: 'published_desc',
    limit: String(limit),
    api_token: apiToken,
  });

  const response = await fetch(`${MARKETAUX_BASE_URL}?${params.toString()}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = String(payload?.message || payload?.error || `Marketaux error ${response.status}`).trim();
    throw new Error(reason);
  }

  return parseMarketauxArticles(payload);
}

function parseQuoteResponse(payload, requestedSymbols = []) {
  const parsed = {};

  const toRow = (symbolKey, row = {}) => {
    const symbol = normalizeSymbol(row?.symbol || symbolKey);
    if (!symbol) return null;
    const price = toNumber(row?.close ?? row?.price ?? row?.last);
    const percentChange = toNumber(
      row?.percent_change
      ?? row?.percentChange
      ?? row?.changePercent
      ?? row?.day_change_percent
      ?? row?.dayChangePercent
    );
    const change = toNumber(row?.change);
    const previousClose = toNumber(row?.previous_close ?? row?.previousClose);
    const timestamp = row?.timestamp ?? row?.datetime ?? null;
    return {
      symbol,
      price,
      percentChange,
      change,
      previousClose,
      timestamp,
    };
  };

  const isLeafQuote = payload && typeof payload === 'object' && (
    payload?.symbol || payload?.price || payload?.close || payload?.last
  );

  if (isLeafQuote) {
    const fallback = requestedSymbols[0] || '';
    const row = toRow(fallback, payload);
    if (row) parsed[row.symbol] = row;
    return parsed;
  }

  if (payload && typeof payload === 'object') {
    Object.entries(payload).forEach(([key, value]) => {
      if (!value || typeof value !== 'object') return;
      if (!(value?.symbol || value?.price || value?.close || value?.last)) return;
      const row = toRow(key, value);
      if (row) parsed[row.symbol] = row;
    });
  }

  return parsed;
}

async function fetchTwelveDataQuotes(symbols = []) {
  const apiKey = String(
    process.env.TWELVEDATA_API_KEY
    || process.env.TWELVE_DATA_API_KEY
    || ''
  ).trim();

  const normalized = [...new Set((Array.isArray(symbols) ? symbols : []).map(normalizeSymbol).filter(Boolean))].slice(0, 40);
  if (!apiKey || normalized.length === 0) return {};

  const params = new URLSearchParams({
    symbol: normalized.join(','),
    apikey: apiKey,
  });

  try {
    const response = await fetch(`${TWELVE_DATA_QUOTE_URL}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.status === 'error') return {};
    return parseQuoteResponse(payload, normalized);
  } catch {
    return {};
  }
}

function extractTickerCounts(articles = []) {
  const map = new Map();
  for (const article of articles) {
    const symbols = Array.isArray(article?.tickers) ? article.tickers : [];
    for (const symbolRaw of symbols) {
      const symbol = normalizeSymbol(symbolRaw);
      if (!symbol) continue;
      const current = map.get(symbol) || { count: 0, latestArticle: null };
      current.count += 1;
      if (!current.latestArticle) current.latestArticle = article;
      map.set(symbol, current);
    }
  }
  return map;
}

function computeSentiment(relatedTickers = [], quoteBySymbol = {}) {
  const values = relatedTickers
    .map((symbol) => toNumber(quoteBySymbol[normalizeSymbol(symbol)]?.percentChange))
    .filter((value) => Number.isFinite(value));
  if (values.length === 0) return 'neutral';
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (avg >= 0.25) return 'bullish';
  if (avg <= -0.25) return 'bearish';
  return 'neutral';
}

function buildKeyPoints({ query, isMomentum, relatedTickers, quoteBySymbol, tickerMeta, fallbackArticles }) {
  const points = [];

  for (const symbol of relatedTickers) {
    const normalized = normalizeSymbol(symbol);
    const quote = quoteBySymbol[normalized] || null;
    const article = tickerMeta.get(normalized)?.latestArticle || fallbackArticles.find((row) => (
      Array.isArray(row?.tickers) && row.tickers.includes(normalized)
    ));

    const headline = article?.title ? trimText(article.title, 120) : '';
    const sourcePart = article?.source ? `${article.source}${article?.timeAgo ? `, ${article.timeAgo}` : ''}` : '';

    if (quote && Number.isFinite(toNumber(quote.price))) {
      const line = `$${normalized} ${formatSignedPercent(quote.percentChange)} at $${formatPrice(quote.price)}`
        + (headline ? ` — ${headline}` : '')
        + (sourcePart ? ` (${sourcePart})` : '');
      points.push(line);
      continue;
    }

    if (headline) {
      points.push(`$${normalized} in current headlines — ${headline}${sourcePart ? ` (${sourcePart})` : ''}`);
    }
  }

  if (points.length === 0) {
    const fallback = fallbackArticles[0];
    if (fallback?.title) {
      points.push(`${isMomentum ? 'Momentum scan' : 'Search'} for "${query}" found: ${trimText(fallback.title, 150)} (${fallback.source || 'source unknown'})`);
    }
  }

  return points.slice(0, 8);
}

function buildTickerSnapshots(relatedTickers = [], quoteBySymbol = {}) {
  const snapshots = {};
  for (const symbolRaw of relatedTickers) {
    const symbol = normalizeSymbol(symbolRaw);
    if (!symbol) continue;
    const quote = quoteBySymbol[symbol];
    if (!quote) continue;
    snapshots[symbol] = {
      price: toNumber(quote.price),
      percentChange: toNumber(quote.percentChange),
      change: toNumber(quote.change),
      timestamp: quote.timestamp || null,
    };
  }
  return snapshots;
}

function seededShuffle(arr, seed) {
  if (!arr.length || seed == null || String(seed).trim() === '') return arr;
  const s = String(seed);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    h = (Math.imul(31, h) + i) | 0;
    const j = Math.abs(h) % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function chooseRelatedTickers({ isMomentum, tickerMeta, interests, quoteBySymbol, refreshNonce }) {
  const fromNews = [...tickerMeta.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([symbol]) => symbol);

  const tracked = [...new Set(
    (Array.isArray(interests?.trackedSymbols) ? interests.trackedSymbols : [])
      .map((symbol) => normalizeSymbol(symbol))
      .filter(Boolean)
  )];

  const hasPortfolioInterests = Array.isArray(interests?.trackedSymbols) && interests.trackedSymbols.length > 0;
  let candidates = [...new Set([
    ...fromNews,
    ...tracked,
    ...(isMomentum ? MOMENTUM_FALLBACK_SYMBOLS : []),
    ...(hasPortfolioInterests ? IDEAS_DIVERSITY_SYMBOLS : []),
  ])].slice(0, 40);

  if (candidates.length === 0) return [];

  if (refreshNonce != null && String(refreshNonce).trim() !== '') {
    candidates = seededShuffle(candidates, String(refreshNonce));
  }

  if (isMomentum) {
    let ranked = candidates
      .map((symbol) => ({
        symbol,
        pct: toNumber(quoteBySymbol[symbol]?.percentChange),
        price: toNumber(quoteBySymbol[symbol]?.price),
      }))
      .filter((entry) => Number.isFinite(entry.price))
      .sort((a, b) => {
        const aPct = Number.isFinite(a.pct) ? a.pct : Number.NEGATIVE_INFINITY;
        const bPct = Number.isFinite(b.pct) ? b.pct : Number.NEGATIVE_INFINITY;
        return bPct - aPct;
      });

    const positive = ranked.filter((entry) => Number.isFinite(entry.pct) && entry.pct > 0);
    const source = positive.length > 0 ? positive : ranked;
    if (refreshNonce != null && String(refreshNonce).trim() !== '') {
      ranked = seededShuffle(source, String(refreshNonce));
    } else {
      ranked = source;
    }
    return ranked.slice(0, 8).map((entry) => entry.symbol);
  }

  return candidates.slice(0, 8);
}

function buildSources(articles = []) {
  const seen = new Set();
  const rows = [];
  for (const article of articles) {
    const url = String(article?.url || '').trim();
    if (!/^https?:\/\//i.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    rows.push({
      title: String(article?.title || url).trim(),
      url,
    });
    if (rows.length >= 8) break;
  }
  return rows;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const query = normalizeQuery(req.body?.query);
  const refreshNonce = req.body?.refreshNonce;
  const interests = req.body?.interests && typeof req.body.interests === 'object'
    ? req.body.interests
    : {};

  if (!query) return res.status(400).json({ error: 'query is required' });

  const redis = getRedisClient();
  const cacheKey = makeCacheKey(query, refreshNonce);

  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).json({ data, cached: true });
      }
    } catch (error) {
      console.error('[community/ai-search] Redis read error:', error);
    }
  }

  const { allowed, count } = await checkRateLimit(redis);
  if (!allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Please try again shortly.',
      count,
      limit: RATE_LIMIT_PER_MINUTE,
    });
  }

  try {
    const isMomentum = /\bmomentum\b|\bbreakout\b|\bgainer(s)?\b/i.test(query);
    const isPortfolioIdeas = /\bcurrent holdings\b|\bsuggest\s*\d+\s*(additional\s*)?stocks?\b/i.test(query);
    const newsSearchQuery = isPortfolioIdeas
      ? 'stocks to watch market momentum'
      : query;
    let articles = await fetchMarketauxNews(newsSearchQuery, { daysBack: 1, limit: 30 });

    if (articles.length < 6) {
      const fallbackArticles = await fetchMarketauxNews(newsSearchQuery, { daysBack: 3, limit: 30 });
      const seen = new Set();
      articles = [...articles, ...fallbackArticles].filter((article) => {
        const key = normalizeUrl(article?.url) || String(article?.title || '').toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 30);
    }

    const tickerMeta = extractTickerCounts(articles);
    const allSymbols = [...new Set([
      ...tickerMeta.keys(),
      ...(Array.isArray(interests?.trackedSymbols) ? interests.trackedSymbols.map(normalizeSymbol).filter(Boolean) : []),
      ...(isMomentum ? MOMENTUM_FALLBACK_SYMBOLS : []),
    ])].slice(0, 40);

    const quoteBySymbol = await fetchTwelveDataQuotes(allSymbols);
    const relatedTickers = chooseRelatedTickers({
      isMomentum,
      tickerMeta,
      interests,
      quoteBySymbol,
      refreshNonce,
    });

    const keyPoints = buildKeyPoints({
      query,
      isMomentum,
      relatedTickers,
      quoteBySymbol,
      tickerMeta,
      fallbackArticles: articles,
    });

    const nowLabel = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const summary = sanitizeSummary(
      '',
      isMomentum
        ? `Momentum scan updated ${nowLabel} ET using live Twelve Data quotes and current Marketaux headlines (last 24-72h when needed).`
        : `Search updated ${nowLabel} ET using current Marketaux web headlines with live Twelve Data quote snapshots.`
    );

    const data = {
      summary,
      keyPoints,
      sources: buildSources(articles),
      relatedTickers,
      sentiment: computeSentiment(relatedTickers, quoteBySymbol),
      tickerSnapshots: buildTickerSnapshots(relatedTickers, quoteBySymbol),
      generatedAt: new Date().toISOString(),
      query,
    };

    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(data), { ex: CACHE_TTL_SECONDS });
      } catch (error) {
        console.error('[community/ai-search] Redis write error:', error);
      }
    }

    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json({ data, cached: false });
  } catch (error) {
    console.error('[community/ai-search] error:', error);
    return res.status(502).json({ error: String(error?.message || 'AI search failed') });
  }
}
