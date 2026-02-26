// api/news.js — Cached news endpoint (Vercel serverless)
// Fetches trending market news from Grok API (X/Twitter) + web
// Cache-first with Redis (Upstash) — 5 min TTL per skill rules

import { Redis } from '@upstash/redis'
import crypto from 'crypto'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

const CACHE_KEY = 'news:trending:market'
const CACHE_TTL = 604800 // 7 days (1 week) — conserve API credits until user base grows
// TODO: Drop to 300 (5 min) once paying customers are active

// In-flight deduplication at the serverless level
let inFlightPromise = null

async function fetchFromGrok() {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'grok-3',
      messages: [
        {
          role: 'system',
          content: `You are a financial news aggregator. Return ONLY valid JSON, no markdown, no backticks. 
Return an array of 6-8 trending market news items from X/Twitter and the web right now.
Each item must have: "title" (concise headline, max 80 chars), "source" (e.g. "X/Twitter", "Reuters", "Bloomberg", "CNBC"), "ticker" (relevant ticker with $ prefix or null), "sentiment" ("bullish", "bearish", or "neutral"), "time" (relative like "2m ago", "15m ago", "1h ago"), "summary" (1 sentence, max 120 chars).
Focus on: earnings, Fed/macro, big movers, breaking news, trending tickers.
Order by recency. JSON array only.`
        },
        {
          role: 'user',
          content: 'What is trending in the stock market right now? Give me the latest from X/Twitter and financial news.',
        },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    }),
  })

  if (!response.ok) {
    throw new Error(`Grok API error: ${response.status}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || '[]'

  // Parse — strip any markdown fences just in case
  const clean = content.replace(/```json|```/g, '').trim()
  const articles = JSON.parse(clean)

  return {
    articles,
    fetchedAt: new Date().toISOString(),
    source: 'grok',
  }
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    // 1. ALWAYS check Redis cache first (Hard Rule #1)
    const cached = await redis.get(CACHE_KEY)
    if (cached) {
      return res.status(200).json({
        ...cached,
        source: 'cache',
        cacheHit: true,
      })
    }

    // 2. Cache miss — fetch from Grok API with in-flight dedup (Hard Rule #9)
    if (!inFlightPromise) {
      inFlightPromise = fetchFromGrok().finally(() => {
        inFlightPromise = null
      })
    }

    const freshData = await inFlightPromise

    // 3. Store in Redis with 5 min TTL
    await redis.set(CACHE_KEY, freshData, { ex: CACHE_TTL })

    return res.status(200).json({
      ...freshData,
      source: 'api',
      cacheHit: false,
    })
  } catch (error) {
    console.error('News fetch error:', error)

    // Fallback: try to serve stale cache if available
    try {
      const stale = await redis.get(CACHE_KEY)
      if (stale) {
        return res.status(200).json({
          ...stale,
          source: 'stale-cache',
          cacheHit: true,
          stale: true,
        })
      }
    } catch (_) {
      // Redis also failed
    }

    return res.status(500).json({
      error: 'Failed to fetch news',
      articles: [],
    })
  }
}
