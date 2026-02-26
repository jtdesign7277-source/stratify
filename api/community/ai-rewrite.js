import { createHash } from 'node:crypto';
import { Redis } from '@upstash/redis';

export const config = { maxDuration: 30 };

const CACHE_TTL_SECONDS = 60 * 60;
const RATE_LIMIT_PER_MINUTE = 20;
const RATE_LIMIT_KEY_PREFIX = 'ai-rewrite:ratelimit';
const SYSTEM_PROMPT = 'You are a social media post rewriter for a stock trading community called Stratify. Rewrite the user draft in the requested style and personality. Keep ticker mentions. Keep it authentic and human - never sound like AI. Return ONLY the rewritten text, nothing else.';

let redisClient = null;
let redisDisabled = false;

function getRedisClient() {
  if (redisDisabled) return null;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (redisClient) return redisClient;
  try {
    redisClient = new Redis({ url, token });
    return redisClient;
  } catch (error) {
    redisDisabled = true;
    redisClient = null;
    console.error('[community/ai-rewrite] Redis init failed:', error);
    return null;
  }
}

function normalizeInput(value, maxLength = 4000) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function makeCacheKey({ text, style, personality }) {
  const payload = `${text}${style}${personality}`;
  const hash = createHash('sha256').update(payload).digest('hex');
  return `ai-rewrite:{${hash}}`;
}

function getAssistantMessageText(payload) {
  return String(payload?.choices?.[0]?.message?.content || '').trim();
}

async function checkRateLimit(redis) {
  const minuteBucket = Math.floor(Date.now() / 60000);
  const key = `${RATE_LIMIT_KEY_PREFIX}:${minuteBucket}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 60);
  }
  return { allowed: count <= RATE_LIMIT_PER_MINUTE, count };
}

async function callClaudeRewrite({ text, style, personality, apiKey }) {
  const userPrompt = `Original post: ${text}. Style: ${style || 'None'}. Personality: ${personality || 'None'}. Rewrite this post.`;
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'grok-3-mini-fast',
      max_tokens: 1000,
      temperature: 0.8,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`xAI API error ${response.status}: ${errorBody.slice(0, 240)}`);
  }

  const payload = await response.json();
  const rewritten = getAssistantMessageText(payload);
  if (!rewritten) {
    throw new Error('xAI returned empty rewrite');
  }
  return rewritten;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const text = normalizeInput(req.body?.text, 6000);
  const style = normalizeInput(req.body?.style, 240);
  const personality = normalizeInput(req.body?.personality, 240);

  if (!text) {
    return res.status(400).json({ error: 'text is required' });
  }

  if (!style && !personality) {
    return res.status(400).json({ error: 'style or personality is required' });
  }

  const apiKey = String(process.env.XAI_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(500).json({ error: 'XAI_API_KEY is missing. Please add it in environment variables.' });
  }

  const redis = getRedisClient();
  const cacheKey = makeCacheKey({ text, style, personality });

  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const rewritten = String(
          typeof cached === 'string'
            ? cached
            : cached?.rewritten || ''
        ).trim();
        if (rewritten) {
          res.setHeader('X-Cache', 'HIT');
          return res.status(200).json({ rewritten, cached: true });
        }
      }
    } catch (error) {
      console.error('[community/ai-rewrite] Redis read error:', error);
    }
  }

  try {
    if (redis) {
      try {
        const { allowed, count } = await checkRateLimit(redis);
        if (!allowed) {
          return res.status(429).json({
            error: 'Rate limit exceeded. Please try again shortly.',
            count,
            limit: RATE_LIMIT_PER_MINUTE,
          });
        }
      } catch (error) {
        console.error('[community/ai-rewrite] Redis rate-limit error:', error);
      }
    }

    const rewritten = await callClaudeRewrite({ text, style, personality, apiKey });

    if (redis) {
      try {
        await redis.set(cacheKey, rewritten, { ex: CACHE_TTL_SECONDS });
      } catch (error) {
        console.error('[community/ai-rewrite] Redis write error:', error);
      }
    }

    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json({ rewritten, cached: false });
  } catch (error) {
    console.error('[community/ai-rewrite] xAI error:', error);
    return res.status(502).json({ error: String(error?.message || 'AI rewrite failed') });
  }
}
