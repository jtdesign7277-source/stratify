import { createHash } from 'node:crypto';
import { Redis } from '@upstash/redis';

export const config = { maxDuration: 30 };

const CACHE_TTL_SECONDS = 30 * 60;
const RATE_LIMIT_PER_MINUTE = 30;
const RATE_LIMIT_KEY_PREFIX = 'ai-search:ratelimit';

const SYSTEM_PROMPT = 'You are a financial research assistant for Stratify, a trading platform. When the user asks about stocks, crypto, markets, or financial news, use web search to find the latest information. Return a clear, structured response with key findings, relevant data points, and sources. Format your response as JSON with this structure: { summary: string, keyPoints: [string], sources: [{ title: string, url: string }], relatedTickers: [string], sentiment: bullish|bearish|neutral }';

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

function makeCacheKey(query) {
  return `ai-search:{${hashQuery(query)}}`;
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

function getTextBlocks(content = []) {
  return (Array.isArray(content) ? content : [])
    .filter((block) => block?.type === 'text' && typeof block?.text === 'string')
    .map((block) => block.text.trim())
    .filter(Boolean);
}

function tryParseJson(text) {
  if (!text) return null;
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  if (!cleaned) return null;

  try {
    return JSON.parse(cleaned);
  } catch {
    // Continue to best-effort bracket extraction below
  }

  let depth = 0;
  let start = -1;
  for (let i = 0; i < cleaned.length; i += 1) {
    const char = cleaned[i];
    if (char === '{') {
      if (start === -1) start = i;
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        const candidate = cleaned.slice(start, i + 1);
        try {
          return JSON.parse(candidate);
        } catch {
          // Keep scanning in case of multiple blocks
        }
      }
    }
  }

  return null;
}

function extractJsonFromTextBlocks(blocks) {
  for (const block of blocks) {
    const parsed = tryParseJson(block);
    if (parsed && typeof parsed === 'object') return parsed;
  }
  return null;
}

function collectWebSourceCandidates(node, found = []) {
  if (Array.isArray(node)) {
    node.forEach((entry) => collectWebSourceCandidates(entry, found));
    return found;
  }

  if (!node || typeof node !== 'object') {
    return found;
  }

  const urlCandidate = node.url || node.uri || node.link || node.source_url;
  if (typeof urlCandidate === 'string' && /^https?:\/\//i.test(urlCandidate)) {
    found.push({
      title: String(node.title || node.name || node.source || urlCandidate).trim(),
      url: urlCandidate.trim(),
    });
  }

  Object.values(node).forEach((value) => {
    collectWebSourceCandidates(value, found);
  });

  return found;
}

function sanitizeSources(rows = []) {
  const seen = new Set();
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      title: String(row?.title || row?.url || '').trim(),
      url: String(row?.url || '').trim(),
    }))
    .filter((row) => /^https?:\/\//i.test(row.url))
    .filter((row) => {
      if (seen.has(row.url)) return false;
      seen.add(row.url);
      return true;
    })
    .slice(0, 8);
}

function sanitizeSentiment(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'bullish' || normalized === 'bearish' || normalized === 'neutral') {
    return normalized;
  }
  return 'neutral';
}

function sanitizeRelatedTickers(rows = []) {
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
}

function normalizeAiResult({ query, parsedJson, textBlocks, webSearchResults }) {
  const summaryFromText = textBlocks.join('\n\n').trim();
  const keyPoints = (Array.isArray(parsedJson?.keyPoints) ? parsedJson.keyPoints : [])
    .map((point) => String(point || '').trim())
    .filter(Boolean)
    .slice(0, 8);

  return {
    summary: String(parsedJson?.summary || summaryFromText || `No summary available for "${query}".`).trim(),
    keyPoints,
    sources: sanitizeSources([...(parsedJson?.sources || []), ...webSearchResults]),
    relatedTickers: sanitizeRelatedTickers(parsedJson?.relatedTickers || []),
    sentiment: sanitizeSentiment(parsedJson?.sentiment),
    textBlocks: textBlocks.slice(0, 6),
    webResults: sanitizeSources(webSearchResults),
  };
}

async function callClaudeWithWebSearch(query, interests) {
  const apiKey = String(process.env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const interestsContext = interests && typeof interests === 'object' && Object.keys(interests).length > 0
    ? `\n\nUser interests context: ${JSON.stringify(interests)}`
    : '';

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{ role: 'user', content: `${query}${interestsContext}` }],
      system: SYSTEM_PROMPT,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Claude API error ${response.status}: ${errorBody.slice(0, 240)}`);
  }

  return response.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const query = normalizeQuery(req.body?.query);
  const interests = req.body?.interests && typeof req.body.interests === 'object'
    ? req.body.interests
    : {};

  if (!query) {
    return res.status(400).json({ error: 'query is required' });
  }

  const redis = getRedisClient();
  const cacheKey = makeCacheKey(query);

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
    const claudeResponse = await callClaudeWithWebSearch(query, interests);
    const textBlocks = getTextBlocks(claudeResponse?.content || []);
    const parsedJson = extractJsonFromTextBlocks(textBlocks) || {};
    const webSearchResults = sanitizeSources(collectWebSourceCandidates(claudeResponse?.content || []));

    const data = normalizeAiResult({
      query,
      parsedJson,
      textBlocks,
      webSearchResults,
    });

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
    console.error('[community/ai-search] Claude error:', error);
    return res.status(502).json({ error: String(error?.message || 'AI search failed') });
  }
}
