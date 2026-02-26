import { Redis } from '@upstash/redis';

export const config = { maxDuration: 30 };

const MAX_RESULTS = 8;
const CACHE_TTL_SECONDS = 60 * 60;
const CACHE_PREFIX = 'hashtag_web';

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
    console.error('[community/hashtag-search] Redis init failed:', error);
    return null;
  }
}

function normalizeHashtag(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const cleaned = raw.replace(/\s+/g, '').replace(/^#+/, '');
  if (!cleaned) return '';
  return `#${cleaned}`;
}

function normalizeHashtagKey(value) {
  return normalizeHashtag(value).toLowerCase().replace(/^#/, '');
}

function getHashtagCacheKey(value) {
  const key = normalizeHashtagKey(value);
  return key ? `${CACHE_PREFIX}:${key}` : '';
}

function stripMarkdownFences(text) {
  return String(text || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function tryParseJsonArray(text) {
  const cleaned = stripMarkdownFences(text);
  if (!cleaned) return null;

  try {
    const direct = JSON.parse(cleaned);
    return Array.isArray(direct) ? direct : null;
  } catch {
    // Continue scanning for JSON array boundaries.
  }

  let depth = 0;
  let start = -1;
  for (let i = 0; i < cleaned.length; i += 1) {
    const char = cleaned[i];
    if (char === '[') {
      if (start === -1) start = i;
      depth += 1;
      continue;
    }

    if (char !== ']') continue;
    depth -= 1;
    if (depth !== 0 || start === -1) continue;

    const candidate = cleaned.slice(start, i + 1);
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Keep scanning for another possible array block.
    }
  }

  return null;
}

function normalizeTickers(rows = []) {
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
}

function normalizeItems(rows = []) {
  const deduped = new Set();
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      headline: String(row?.headline || row?.title || '').replace(/\s+/g, ' ').trim(),
      summary: String(row?.summary || row?.description || '').replace(/\s+/g, ' ').trim(),
      source: String(row?.source || row?.publisher || row?.outlet || 'Web').replace(/\s+/g, ' ').trim() || 'Web',
      relatedTickers: normalizeTickers(row?.relatedTickers || row?.tickers || []),
    }))
    .filter((row) => row.headline)
    .filter((row) => {
      const key = row.headline.toLowerCase();
      if (deduped.has(key)) return false;
      deduped.add(key);
      return true;
    })
    .slice(0, MAX_RESULTS);
}

function parseCachedHashtagItems(cached) {
  if (cached === null || cached === undefined) return null;

  try {
    const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
    if (Array.isArray(parsed)) return normalizeItems(parsed);
    if (Array.isArray(parsed?.items)) return normalizeItems(parsed.items);
    if (Array.isArray(parsed?.data)) return normalizeItems(parsed.data);
  } catch (error) {
    console.error('[community/hashtag-search] Cached payload parse failed:', error);
  }

  return null;
}

async function callGrokHashtagSearch(hashtag) {
  const apiKey = String(process.env.XAI_API_KEY || '').trim();
  if (!apiKey) throw new Error('XAI_API_KEY is missing. Please add it in environment variables.');

  const today = new Date().toISOString().split('T')[0];
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-3-mini-fast',
      messages: [
        {
          role: 'system',
          content: `You are a financial news aggregator. Today is ${today}. Return ONLY a JSON array, no markdown, no backticks.`,
        },
        {
          role: 'user',
          content: `Find 8 current trending discussions about ${hashtag} in financial markets. Return JSON array: [{ "headline": string, "summary": string (1-2 sentences), "source": string, "relatedTickers": [string] }]`,
        },
      ],
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`xAI API error ${response.status}: ${errorBody.slice(0, 240)}`);
  }

  return response.json();
}

function parseHashtagSearchPayload(payload) {
  const assistantText = String(payload?.choices?.[0]?.message?.content || '').trim();
  const parsed = tryParseJsonArray(assistantText);
  if (Array.isArray(parsed)) return normalizeItems(parsed);
  return [];
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rawHashtag = req.body?.hashtag || req.body?.tag || req.query?.hashtag || req.query?.tag;
  const hashtag = normalizeHashtag(rawHashtag);
  if (!hashtag) {
    return res.status(400).json({ error: 'Missing hashtag' });
  }

  const redis = getRedisClient();
  const cacheKey = getHashtagCacheKey(hashtag);

  if (redis && cacheKey) {
    try {
      const cached = await redis.get(cacheKey);
      const cachedItems = parseCachedHashtagItems(cached);
      if (Array.isArray(cachedItems)) {
        res.setHeader('X-Cache', 'HIT');
        return res.status(200).json({
          hashtag,
          items: cachedItems,
          data: cachedItems,
          source: 'cache',
          cached: true,
          generatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('[community/hashtag-search] Redis read failed:', error);
    }
  }

  try {
    const payload = await callGrokHashtagSearch(hashtag);
    const items = parseHashtagSearchPayload(payload);

    if (redis && cacheKey) {
      try {
        await redis.set(cacheKey, JSON.stringify(items), { ex: CACHE_TTL_SECONDS });
      } catch (error) {
        console.error('[community/hashtag-search] Redis write failed:', error);
      }
    }

    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json({
      hashtag,
      items,
      data: items,
      source: 'api',
      cached: false,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(502).json({
      error: String(error?.message || 'Hashtag web search failed'),
      items: [],
      data: [],
      hashtag,
      cached: false,
    });
  }
}
