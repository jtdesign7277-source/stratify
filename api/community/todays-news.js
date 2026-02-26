import { Redis } from '@upstash/redis';

export const config = { maxDuration: 30 };

const CACHE_TTL_SECONDS = 600;
const STALE_REVALIDATE_WINDOW_SECONDS = 120;
const STALE_FALLBACK_TTL_SECONDS = 7 * 24 * 60 * 60;
const RATE_LIMIT_PER_MINUTE = 5;
const RATE_LIMIT_KEY_PREFIX = 'claude:ratelimit:news';
const LAST_SUCCESS_CACHE_KEY = 'todays-news:last';

const ALLOWED_CATEGORIES = new Set(['News', 'Markets', 'Crypto', 'Politics', 'Earnings']);
const SOURCE_BADGE_COLORS = ['#58a6ff', '#3fb950', '#f778ba', '#d29922', '#a371f7', '#f85149', '#79c0ff'];

let redisClient = null;
let redisDisabled = false;
const backgroundRefreshInFlight = new Set();

function getRedisClient() {
  if (redisDisabled) return null;

  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  if (redisClient) return redisClient;

  try {
    redisClient = new Redis({ url, token });
    return redisClient;
  } catch (error) {
    redisDisabled = true;
    redisClient = null;
    console.error('[community/todays-news] Redis init failed:', error);
    return null;
  }
}

function unwrapPipelineResult(value) {
  return value && typeof value === 'object' && 'result' in value ? value.result : value;
}

function getDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function cacheKeyForDate(dateString) {
  return `todays-news:${dateString}`;
}

function parseCachedPayload(rawValue) {
  if (!rawValue) return null;
  try {
    const parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function normalizeCategory(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'markets' || raw === 'market') return 'Markets';
  if (raw === 'crypto') return 'Crypto';
  if (raw === 'politics' || raw === 'policy') return 'Politics';
  if (raw === 'earnings') return 'Earnings';
  return 'News';
}

function normalizePostCount(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return `${Math.round(value).toLocaleString('en-US')} posts`;
  }

  const raw = String(value || '').trim();
  if (!raw) return '0 posts';

  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return raw;

  const asNumber = Number(digits);
  if (!Number.isFinite(asNumber)) return raw;
  return `${asNumber.toLocaleString('en-US')} posts`;
}

function sanitizeSources(rows = []) {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : [])
    .map((row) => String(row || '').trim())
    .filter(Boolean)
    .filter((source) => {
      const key = source.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4)
    .map((source, index) => ({
      name: source,
      initial: source.charAt(0).toUpperCase() || '?',
      color: SOURCE_BADGE_COLORS[index % SOURCE_BADGE_COLORS.length],
    }));
}

function sanitizeHeadline(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeNewsItem(row, index = 0) {
  if (!row || typeof row !== 'object') return null;

  const headline = sanitizeHeadline(row.headline || row.title);
  if (!headline) return null;

  const sources = sanitizeSources(row.sources || row.sourceNames || row.source_names || []);
  const category = normalizeCategory(row.category);
  const postCount = normalizePostCount(row.postCount ?? row.post_count ?? row.posts);
  const summary = String(row.summary || '').trim();
  const trendingLabelRaw = String(row.trendingLabel || row.trending_label || '').trim();
  const urlRaw = String(row.url || row.link || '').trim();

  return {
    id: String(row.id || `todays-news-${index}-${headline.slice(0, 30)}`).trim(),
    headline,
    sources,
    category: ALLOWED_CATEGORIES.has(category) ? category : 'News',
    postCount,
    summary,
    trendingLabel: trendingLabelRaw || 'Trending now',
    url: /^https?:\/\//i.test(urlRaw) ? urlRaw : '',
  };
}

function normalizeNewsItems(rows = []) {
  const deduped = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row, index) => {
    const item = normalizeNewsItem(row, index);
    if (!item?.headline) return;
    const key = item.headline.toLowerCase();
    if (!deduped.has(key)) {
      deduped.set(key, item);
    }
  });
  return [...deduped.values()].slice(0, 8);
}

function stripMarkdownFences(text) {
  return String(text || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function tryParseJson(text) {
  const cleaned = stripMarkdownFences(text);
  if (!cleaned) return null;

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function extractBalancedJsonSubstring(text, openChar, closeChar) {
  const cleaned = stripMarkdownFences(text);
  if (!cleaned) return [];

  const candidates = [];
  for (let i = 0; i < cleaned.length; i += 1) {
    if (cleaned[i] !== openChar) continue;
    let depth = 1;
    for (let j = i + 1; j < cleaned.length; j += 1) {
      if (cleaned[j] === openChar) depth += 1;
      if (cleaned[j] === closeChar) depth -= 1;
      if (depth === 0) {
        candidates.push(cleaned.slice(i, j + 1));
        break;
      }
    }
  }
  return candidates;
}

function toArrayPayload(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== 'object') return null;
  if (Array.isArray(parsed.items)) return parsed.items;
  if (Array.isArray(parsed.data)) return parsed.data;
  if (Array.isArray(parsed.news)) return parsed.news;
  if (Array.isArray(parsed.articles)) return parsed.articles;
  if (Array.isArray(parsed.headlines)) return parsed.headlines;
  return null;
}

function extractNewsItemsFromClaude(claudePayload) {
  const textBlocks = (Array.isArray(claudePayload?.content) ? claudePayload.content : [])
    .filter((block) => block?.type === 'text' && typeof block?.text === 'string')
    .map((block) => block.text)
    .filter(Boolean);

  for (const block of textBlocks) {
    const direct = tryParseJson(block);
    const directRows = toArrayPayload(direct);
    if (Array.isArray(directRows)) {
      const normalized = normalizeNewsItems(directRows);
      if (normalized.length > 0) return normalized;
    }

    const arrayCandidates = extractBalancedJsonSubstring(block, '[', ']');
    for (const candidate of arrayCandidates) {
      const parsed = tryParseJson(candidate);
      const rows = toArrayPayload(parsed);
      if (!Array.isArray(rows)) continue;
      const normalized = normalizeNewsItems(rows);
      if (normalized.length > 0) return normalized;
    }

    const objectCandidates = extractBalancedJsonSubstring(block, '{', '}');
    for (const candidate of objectCandidates) {
      const parsed = tryParseJson(candidate);
      const rows = toArrayPayload(parsed);
      if (!Array.isArray(rows)) continue;
      const normalized = normalizeNewsItems(rows);
      if (normalized.length > 0) return normalized;
    }
  }

  return [];
}

async function readCacheWithTtl(redis, key) {
  if (!redis) return null;
  try {
    const pipeline = redis.pipeline();
    pipeline.get(key);
    pipeline.ttl(key);
    const [cachedRaw, ttlRaw] = await pipeline.exec();
    const payload = parseCachedPayload(unwrapPipelineResult(cachedRaw));
    if (!payload) return null;
    const ttl = Number(unwrapPipelineResult(ttlRaw));
    return { payload, ttl: Number.isFinite(ttl) ? ttl : -1 };
  } catch (error) {
    console.error('[community/todays-news] Redis read+ttl failed:', error);
    return null;
  }
}

async function readCache(redis, key) {
  if (!redis) return null;
  try {
    const cached = await redis.get(key);
    return parseCachedPayload(cached);
  } catch (error) {
    console.error('[community/todays-news] Redis read failed:', error);
    return null;
  }
}

async function writeCaches(redis, dateString, payload) {
  if (!redis || !payload) return;
  try {
    const pipeline = redis.pipeline();
    pipeline.set(cacheKeyForDate(dateString), JSON.stringify(payload), { ex: CACHE_TTL_SECONDS });
    pipeline.set(LAST_SUCCESS_CACHE_KEY, JSON.stringify(payload), { ex: STALE_FALLBACK_TTL_SECONDS });
    await pipeline.exec();
  } catch (error) {
    console.error('[community/todays-news] Redis write failed:', error);
  }
}

async function checkRateLimit(redis) {
  if (!redis) return { allowed: true, count: null };
  try {
    const minuteBucket = Math.floor(Date.now() / 60000);
    const key = `${RATE_LIMIT_KEY_PREFIX}:${minuteBucket}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 60);
    }
    return { allowed: count <= RATE_LIMIT_PER_MINUTE, count };
  } catch {
    return { allowed: true, count: null };
  }
}

async function callClaudeForTodaysNews() {
  const apiKey = String(process.env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{
        role: 'user',
        content: 'Search X (Twitter) and financial news sites for the top 8 trending financial news stories right now. For each story return: headline, source names, category (News/Markets/Crypto/Politics/Earnings), estimated post count on X, and a one-sentence summary. Focus on stocks, crypto, economics, Fed policy, earnings, and major market-moving events. Return ONLY valid JSON array, no markdown: [{ headline: string, sources: [string], category: string, postCount: string, summary: string, trendingLabel: string }]',
      }],
      system: 'You are a financial news aggregator. Use web search to find the latest trending financial news from X/Twitter and major financial news sources. Return structured JSON only, no markdown backticks, no preamble.',
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Claude API error ${response.status}: ${errorBody.slice(0, 240)}`);
  }

  return response.json();
}

async function fetchFreshPayload(dateString) {
  const claudePayload = await callClaudeForTodaysNews();
  const items = extractNewsItemsFromClaude(claudePayload);
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  return {
    date: dateString,
    generatedAt: new Date().toISOString(),
    items: items.slice(0, 8),
  };
}

function sendCachedResponse(res, payload, mode = 'HIT') {
  res.setHeader('X-Cache', 'HIT');
  if (mode !== 'HIT') res.setHeader('X-Cache-Mode', mode);
  return res.status(200).json({
    ...payload,
    cached: true,
  });
}

function triggerBackgroundRefresh(redis, dateString) {
  const key = cacheKeyForDate(dateString);
  if (backgroundRefreshInFlight.has(key)) return;
  backgroundRefreshInFlight.add(key);

  void (async () => {
    try {
      const { allowed } = await checkRateLimit(redis);
      if (!allowed) return;

      const freshPayload = await fetchFreshPayload(dateString);
      if (!freshPayload) return;

      await writeCaches(redis, dateString, freshPayload);
    } catch (error) {
      console.error('[community/todays-news] Background refresh failed:', error);
    } finally {
      backgroundRefreshInFlight.delete(key);
    }
  })();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const redis = getRedisClient();
  const dateString = getDateString();
  const todaysKey = cacheKeyForDate(dateString);

  const cachedToday = await readCacheWithTtl(redis, todaysKey);
  if (cachedToday?.payload) {
    const isNearExpiry = cachedToday.ttl > 0 && cachedToday.ttl <= STALE_REVALIDATE_WINDOW_SECONDS;
    if (isNearExpiry) {
      triggerBackgroundRefresh(redis, dateString);
      return sendCachedResponse(res, cachedToday.payload, 'STALE-WHILE-REVALIDATE');
    }
    return sendCachedResponse(res, cachedToday.payload);
  }

  const staleFallback = await readCache(redis, LAST_SUCCESS_CACHE_KEY);
  const { allowed, count } = await checkRateLimit(redis);
  if (!allowed) {
    if (staleFallback) {
      res.setHeader('X-RateLimit-Count', String(count));
      return sendCachedResponse(res, staleFallback, 'RATE-LIMIT-STALE');
    }
    return res.status(429).json({
      error: 'Rate limit exceeded. No stale cache available.',
      items: [],
      cached: false,
    });
  }

  try {
    const freshPayload = await fetchFreshPayload(dateString);

    if (!freshPayload) {
      if (staleFallback) {
        return sendCachedResponse(res, staleFallback, 'FALLBACK-PARSE');
      }
      return res.status(502).json({
        error: 'Claude response parsing failed and no stale cache is available.',
        items: [],
        cached: false,
      });
    }

    await writeCaches(redis, dateString, freshPayload);
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json({
      ...freshPayload,
      cached: false,
    });
  } catch (error) {
    console.error('[community/todays-news] Claude fetch failed:', error);
    if (staleFallback) {
      return sendCachedResponse(res, staleFallback, 'FALLBACK-ERROR');
    }
    return res.status(502).json({
      error: String(error?.message || 'Failed to fetch today\'s news'),
      items: [],
      cached: false,
    });
  }
}
