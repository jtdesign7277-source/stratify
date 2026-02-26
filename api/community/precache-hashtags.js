import { Redis } from '@upstash/redis';

export const config = { maxDuration: 30 };

const CACHE_PREFIX = 'hashtag_web';
const CACHE_TTL_SECONDS = 60 * 60;
const MAX_RESULTS = 8;
const HASHTAGS = ['Earnings', 'Momentum', 'Macro', 'Options', 'Sentiment'];

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
    console.error('[community/precache-hashtags] Redis init failed:', error);
    return null;
  }
}

function normalizeHashtagKey(value) {
  return String(value || '').trim().toLowerCase().replace(/^#/, '');
}

function buildCacheKey(hashtag) {
  const key = normalizeHashtagKey(hashtag);
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

function parseHashtagSearchPayload(payload) {
  const assistantText = String(payload?.choices?.[0]?.message?.content || '').trim();
  const parsed = tryParseJsonArray(assistantText);
  if (Array.isArray(parsed)) return normalizeItems(parsed);
  return [];
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
          content: `You are a financial news aggregator. Today is ${today}. Search the web for the latest news. Return ONLY a JSON array, no markdown, no backticks.`,
        },
        {
          role: 'user',
          content: `Find 8 current trending discussions about ${hashtag} in financial markets right now in 2026. Return JSON array: [{ "headline": string, "summary": string (1-2 sentences), "source": string, "relatedTickers": [string] }]`,
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const redis = getRedisClient();
  if (!redis) {
    return res.status(500).json({
      success: false,
      error: 'Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.',
    });
  }

  const results = {};

  for (const tag of HASHTAGS) {
    const cacheKey = buildCacheKey(tag);
    if (!cacheKey) {
      results[tag] = 'error: invalid hashtag';
      continue;
    }

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        results[tag] = 'already cached';
        continue;
      }
    } catch (error) {
      results[tag] = `error: ${String(error?.message || 'Redis read failed')}`;
      continue;
    }

    try {
      const payload = await callGrokHashtagSearch(tag);
      const items = parseHashtagSearchPayload(payload);
      await redis.set(cacheKey, JSON.stringify(items), { ex: CACHE_TTL_SECONDS });
      results[tag] = `cached ${items.length} items`;
    } catch (error) {
      results[tag] = `error: ${String(error?.message || 'Hashtag pre-cache failed')}`;
    }
  }

  return res.status(200).json({ success: true, results });
}
