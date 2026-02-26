import { Redis } from '@upstash/redis';

export const config = { maxDuration: 30 };

const CACHE_TTL_SECONDS = 600;
const HOUR_BUCKET_MS = 60 * 60 * 1000;
const CACHE_KEY_PREFIX = 'todays-news';
const MAX_STORIES = 8;
const SOURCE_BADGE_COLORS = ['#58a6ff', '#3fb950', '#f778ba', '#d29922', '#a371f7', '#f85149', '#79c0ff'];
const CATEGORY_SET = new Set(['News', 'Markets', 'Crypto', 'Politics', 'Earnings']);

let redisClient = null;
let redisDisabled = false;

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

const getHourBucket = (now = Date.now()) => Math.floor(now / HOUR_BUCKET_MS);
const buildCacheKey = (bucket) => `${CACHE_KEY_PREFIX}:${bucket}`;

function stripMarkdownFences(text) {
  return String(text || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
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
  if (/\bposts?\b/i.test(raw)) return raw;

  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return raw;

  const parsed = Number(digits);
  if (!Number.isFinite(parsed)) return raw;
  return `${parsed.toLocaleString('en-US')} posts`;
}

function normalizeSources(rows = []) {
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
      color: SOURCE_BADGE_COLORS[idx % SOURCE_BADGE_COLORS.length],
    }));
}

function normalizeNewsItems(rows = []) {
  const deduped = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row, idx) => {
    if (!row || typeof row !== 'object') return;

    const headline = String(row?.headline || row?.title || '').replace(/\s+/g, ' ').trim();
    if (!headline) return;

    const key = headline.toLowerCase();
    if (deduped.has(key)) return;

    const category = normalizeCategory(row?.category);
    deduped.set(key, {
      id: String(row?.id || `todays-news-${idx}-${headline.slice(0, 24)}`).trim(),
      headline,
      sources: normalizeSources(row?.sources || row?.sourceNames || row?.source_names || []),
      category: CATEGORY_SET.has(category) ? category : 'News',
      postCount: normalizePostCount(row?.postCount ?? row?.post_count ?? row?.posts),
      summary: String(row?.summary || '').trim(),
      trendingLabel: String(row?.trendingLabel || row?.trending_label || 'Trending now').trim() || 'Trending now',
      url: /^https?:\/\//i.test(String(row?.url || row?.link || '').trim())
        ? String(row?.url || row?.link || '').trim()
        : '',
    });
  });

  return [...deduped.values()].slice(0, MAX_STORIES);
}

function toNewsArray(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== 'object') return null;
  if (Array.isArray(parsed.items)) return parsed.items;
  if (Array.isArray(parsed.data)) return parsed.data;
  if (Array.isArray(parsed.news)) return parsed.news;
  if (Array.isArray(parsed.articles)) return parsed.articles;
  return null;
}

function parseClaudeNewsItems(claudePayload) {
  const assistantText = String(claudePayload?.choices?.[0]?.message?.content || '').trim();
  const anthropicBlocks = (Array.isArray(claudePayload?.content) ? claudePayload.content : [])
    .filter((block) => block?.type === 'text' && typeof block?.text === 'string')
    .map((block) => stripMarkdownFences(block.text))
    .filter(Boolean);
  const textBlocks = assistantText ? [stripMarkdownFences(assistantText)] : anthropicBlocks;

  for (const text of textBlocks) {
    try {
      const parsed = JSON.parse(text);
      const rows = toNewsArray(parsed);
      if (!Array.isArray(rows)) continue;

      const normalized = normalizeNewsItems(rows);
      if (normalized.length > 0) return normalized;
    } catch {
      // Ignore non-JSON blocks and continue scanning text responses.
    }
  }

  return [];
}

async function callClaudeForTodaysNews() {
  const apiKey = String(process.env.XAI_API_KEY || '').trim();
  if (!apiKey) throw new Error('XAI_API_KEY is missing. Please add it in environment variables.');

  const userPrompt = 'Search the web for the top 8 trending financial news stories right now. Return ONLY valid JSON array with exactly 8 items and this schema: [{"headline":"string","sources":["string"],"category":"News|Markets|Crypto|Politics|Earnings","postCount":"string","summary":"string","url":"https://...","trendingLabel":"string"}]. No markdown fences and no extra text.';

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-3-mini-fast',
      max_tokens: 2600,
      temperature: 0.8,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`xAI API error ${response.status}: ${errorBody.slice(0, 240)}`);
  }

  return response.json();
}

async function readCachedPayload(redis, key) {
  if (!redis) return null;

  try {
    const cached = await redis.get(key);
    if (!cached) return null;
    const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.items)) return null;
    return parsed;
  } catch (error) {
    console.error('[community/todays-news] Redis read failed:', error);
    return null;
  }
}

async function writeCachedPayload(redis, key, payload) {
  if (!redis || !payload) return;

  try {
    await redis.set(key, JSON.stringify(payload), { ex: CACHE_TTL_SECONDS });
  } catch (error) {
    console.error('[community/todays-news] Redis write failed:', error);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const redis = getRedisClient();
  const hourBucket = getHourBucket();
  const cacheKey = buildCacheKey(hourBucket);

  const cached = await readCachedPayload(redis, cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json({
      ...cached,
      cached: true,
    });
  }

  try {
    const claudePayload = await callClaudeForTodaysNews();
    const items = parseClaudeNewsItems(claudePayload);

    if (items.length === 0) {
      return res.status(502).json({
        error: 'AI response parsing failed',
        items: [],
        cached: false,
      });
    }

    const payload = {
      hourBucket,
      generatedAt: new Date().toISOString(),
      items: items.slice(0, MAX_STORIES),
    };

    await writeCachedPayload(redis, cacheKey, payload);

    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json({
      ...payload,
      cached: false,
    });
  } catch (error) {
    console.error('[community/todays-news] Fetch failed:', error);
    return res.status(502).json({
      error: String(error?.message || 'Failed to fetch today\'s news'),
      items: [],
      cached: false,
    });
  }
}
