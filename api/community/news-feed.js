import { Redis } from '@upstash/redis';

export const config = { maxDuration: 30 };

const CACHE_PREFIX = 'community:claude';
const RATE_LIMIT_PREFIX = 'community:ratelimit';
const MAX_CALLS_PER_MINUTE = 20;

const ACTION_TTLS = {
  'market-summary': 900,
  'suggestions': 600,
  'search': 1800,
  'trending-tickers': 600,
  'news-digest': 900,
};

const VALID_ACTIONS = Object.keys(ACTION_TTLS);

// Stale-while-revalidate: serve cache if within this many seconds of expiry
const STALE_WINDOW = 120;

let redisClient = null;
let redisDisabled = false;

function getRedisClient() {
  if (redisDisabled) return null;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  if (!redisClient) {
    try {
      redisClient = new Redis({ url, token });
    } catch (error) {
      redisDisabled = true;
      redisClient = null;
      console.error('[community/news-feed] Redis init failed:', error);
      return null;
    }
  }
  return redisClient;
}

function makeCacheKey(action, query, interests) {
  const payload = JSON.stringify({ query: query || '', interests: interests || [] });
  const hash = Buffer.from(payload).toString('base64').slice(0, 32);
  return `${CACHE_PREFIX}:${action}:${hash}`;
}

function buildUserPrompt(action, query, interests) {
  const interestsContext = interests && interests.length > 0
    ? `\n\nUser interests: ${interests.join(', ')}. Tailor content toward these interests when relevant.`
    : '';

  switch (action) {
    case 'market-summary':
      return `Generate a current market news summary for today. Return JSON with this exact structure:
{"headlines":[{"id":"unique-id","headline":"string","summary":"1-2 sentence summary","sentiment":"bullish|bearish|neutral","relatedTickers":["AAPL"],"source":"source name"}]}
Include 8-10 headlines covering major market moves, sector rotations, economic data, and notable stock movements. Use realistic sources like Reuters, Bloomberg, CNBC, WSJ.${interestsContext}`;

    case 'suggestions':
      return `Generate search suggestions for a trading community feed. Return JSON with this exact structure:
{"suggestions":[{"text":"search query text","category":"earnings|macro|sector|technical|crypto|commodities","relatedTicker":"AAPL"}]}
Include 5-6 suggestions covering timely market topics, upcoming events, and trending themes.${interestsContext}`;

    case 'search':
      return `Search query: "${query || 'market overview'}"
Analyze this query and return relevant financial information. Return JSON with this exact structure:
{"results":[{"type":"news|analysis|data|opinion","title":"string","summary":"2-3 sentence summary","sentiment":"bullish|bearish|neutral","tickers":["AAPL"],"source":"source name","relevance":0.95}],"context":"Brief paragraph explaining the overall context of this topic"}
Include 3-5 relevant results ordered by relevance.${interestsContext}`;

    case 'trending-tickers':
      return `Identify the most talked-about tickers in financial markets right now. Return JSON with this exact structure:
{"tickers":[{"symbol":"AAPL","buzzReason":"Brief reason this ticker is trending","mentionCount":1250,"sentiment":"bullish|bearish|neutral"}]}
Include 5-8 tickers that are generating significant discussion due to earnings, news, price action, or macro events.${interestsContext}`;

    case 'news-digest':
      return `Create a curated financial news digest. Return JSON with this exact structure:
{"articles":[{"headline":"string","summary":"2-3 sentence summary","source":"source name","sentiment":"bullish|bearish|neutral","tickers":["AAPL"],"whyItMatters":"1 sentence on why traders should care","category":"earnings|macro|sector|geopolitical|crypto|commodities|technical"}]}
Include 6-8 articles covering the most important financial news. Focus on actionable information for active traders.${interestsContext}`;

    default:
      return `Return {"error":"Unknown action"}`;
  }
}

async function checkRateLimit(redis) {
  if (!redis) return { allowed: true };
  try {
    const minute = Math.floor(Date.now() / 60000);
    const key = `${RATE_LIMIT_PREFIX}:${minute}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 60);
    }
    return { allowed: count <= MAX_CALLS_PER_MINUTE, count };
  } catch {
    return { allowed: true };
  }
}

async function callClaude(action, query, interests) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

  const userPrompt = buildUserPrompt(action, query, interests);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: 'You are a financial news analyst for Stratify, a trading platform. Return valid JSON only, no markdown wrapping, no code blocks.',
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Claude API error ${response.status}: ${errorBody.slice(0, 200)}`);
  }

  const result = await response.json();
  const text = result?.content?.[0]?.text || '';

  // Parse JSON from response, stripping any accidental markdown wrapping
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(cleaned);
}

async function getCachedWithTTL(redis, key) {
  if (!redis) return null;
  try {
    const pipeline = redis.pipeline();
    pipeline.get(key);
    pipeline.ttl(key);
    const [data, ttl] = await pipeline.exec();
    if (!data) return null;
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return { data: parsed, ttl: ttl || 0 };
  } catch {
    return null;
  }
}

function emptyResponse(action) {
  switch (action) {
    case 'market-summary': return { headlines: [] };
    case 'suggestions': return { suggestions: [] };
    case 'search': return { results: [], context: '' };
    case 'trending-tickers': return { tickers: [] };
    case 'news-digest': return { articles: [] };
    default: return {};
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, query, interests } = req.body || {};

  if (!action || !VALID_ACTIONS.includes(action)) {
    return res.status(400).json({
      error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}`,
    });
  }

  const redis = getRedisClient();
  const cacheKey = makeCacheKey(action, query, interests);
  const ttl = ACTION_TTLS[action];

  // Check cache first
  const cached = await getCachedWithTTL(redis, cacheKey);
  if (cached?.data) {
    const isNearExpiry = cached.ttl > 0 && cached.ttl <= STALE_WINDOW;

    if (isNearExpiry) {
      // Stale-while-revalidate: serve cached data and trigger background refresh
      res.setHeader('X-Cache', 'HIT-STALE');
      triggerBackgroundRefresh(redis, cacheKey, ttl, action, query, interests);
      return res.status(200).json({ data: cached.data });
    }

    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json({ data: cached.data });
  }

  // Rate limiting
  const { allowed } = await checkRateLimit(redis);
  if (!allowed) {
    // Try to serve stale cache even if expired (best effort)
    if (cached?.data) {
      res.setHeader('X-Cache', 'HIT-RATELIMIT');
      return res.status(200).json({ data: cached.data });
    }
    return res.status(429).json({ error: 'Rate limit exceeded. Please try again shortly.' });
  }

  // Cache miss: call Claude
  try {
    const data = await callClaude(action, query, interests);

    // Cache the result
    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(data), { ex: ttl });
      } catch (error) {
        console.error('[community/news-feed] Redis write error:', error);
      }
    }

    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json({ data });
  } catch (error) {
    console.error('[community/news-feed] Claude API error:', error);

    // If Claude fails, try to return any stale cached data
    if (redis) {
      try {
        const stale = await redis.get(cacheKey);
        if (stale) {
          const parsed = typeof stale === 'string' ? JSON.parse(stale) : stale;
          res.setHeader('X-Cache', 'HIT-FALLBACK');
          return res.status(200).json({ data: parsed });
        }
      } catch {
        // Redis also failed, fall through
      }
    }

    // Return empty arrays as last resort
    return res.status(200).json({ data: emptyResponse(action), error: 'Temporarily unavailable' });
  }
}

function triggerBackgroundRefresh(redis, cacheKey, ttl, action, query, interests) {
  // Fire-and-forget: refresh cache in background
  callClaude(action, query, interests)
    .then(async (data) => {
      if (redis) {
        try {
          await redis.set(cacheKey, JSON.stringify(data), { ex: ttl });
        } catch (error) {
          console.error('[community/news-feed] Background refresh cache write error:', error);
        }
      }
    })
    .catch((error) => {
      console.error('[community/news-feed] Background refresh failed:', error);
    });
}
