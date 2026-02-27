// api/news.js — Cached news endpoint (Vercel serverless)
// Full rewrite with debug logging at every step

import { Redis } from '@upstash/redis'

const CACHE_KEY = 'news:trending:market'
const CACHE_TTL = 604800 // 7 days

function getRedis() {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) {
    throw new Error(`Missing Redis env vars — url: ${!!url}, token: ${!!token}`)
  }
  return new Redis({ url, token })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // Env check — logged to Vercel function logs
  console.log('ENV CHECK:', {
    hasRedisUrl: !!process.env.KV_REST_API_URL,
    hasRedisToken: !!process.env.KV_REST_API_TOKEN,
    hasGrokKey: !!process.env.GROK_API_KEY,
  })

  let redis
  try {
    redis = getRedis()
    console.log('STEP 1: Redis client created')
  } catch (err) {
    console.error('STEP 1 FAILED: Redis client creation:', err.message)
    return res.status(500).json({
      error: 'Redis client creation failed',
      details: err.message,
      step: 'redis-connect',
      articles: [],
    })
  }

  // Step 2: Check cache
  try {
    const cached = await redis.get(CACHE_KEY)
    console.log('STEP 2: Redis GET result:', cached ? 'HIT' : 'MISS')
    if (cached) {
      // Upstash auto-deserializes JSON, but guard against string
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached
      return res.status(200).json({
        articles: data.articles || [],
        fetchedAt: data.fetchedAt || new Date().toISOString(),
        source: 'cache',
        cacheHit: true,
      })
    }
  } catch (err) {
    console.error('STEP 2 FAILED: Redis GET:', err.message)
    // Don't bail — continue to Grok fetch
  }

  // Step 3: Fetch from Grok
  let grokResponse
  try {
    console.log('STEP 3: Calling Grok API...')
    grokResponse = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-3',
        messages: [
          {
            role: 'system',
            content:
              'You are a financial news aggregator. Return ONLY valid JSON, no markdown, no backticks. Return an array of 6-8 trending market news items. Each item must have: "title" (concise headline, max 80 chars), "source" (e.g. "X/Twitter", "Reuters", "Bloomberg", "CNBC"), "ticker" (relevant ticker with $ prefix or null), "sentiment" ("bullish", "bearish", or "neutral"), "time" (relative like "2m ago", "15m ago", "1h ago"), "summary" (1 sentence, max 120 chars). Focus on: earnings, Fed/macro, big movers, breaking news, trending tickers. Order by recency. JSON array only.',
          },
          {
            role: 'user',
            content:
              'What is trending in the stock market right now? Give me the latest from X/Twitter and financial news.',
          },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    })
    console.log('STEP 3: Grok API status:', grokResponse.status)
    if (!grokResponse.ok) {
      const body = await grokResponse.text()
      console.error('STEP 3 FAILED: Grok API response body:', body)
      throw new Error(`Grok API ${grokResponse.status}: ${body}`)
    }
  } catch (err) {
    console.error('STEP 3 FAILED: Grok fetch:', err.message)
    return res.status(500).json({
      error: 'Grok API fetch failed',
      details: err.message,
      step: 'grok-fetch',
      articles: [],
    })
  }

  // Step 4: Parse Grok response
  let articles
  try {
    const data = await grokResponse.json()
    const content = data.choices?.[0]?.message?.content || '[]'
    console.log('STEP 4: Raw Grok content (first 200 chars):', content.substring(0, 200))
    const clean = content.replace(/```json|```/g, '').trim()
    articles = JSON.parse(clean)
    console.log('STEP 4: Parsed', articles.length, 'articles')
  } catch (err) {
    console.error('STEP 4 FAILED: Grok parse:', err.message)
    return res.status(500).json({
      error: 'Grok response parse failed',
      details: err.message,
      step: 'grok-parse',
      articles: [],
    })
  }

  // Step 5: Cache in Redis
  const result = { articles, fetchedAt: new Date().toISOString() }
  try {
    await redis.set(CACHE_KEY, JSON.stringify(result), { ex: CACHE_TTL })
    console.log('STEP 5: Redis SET success, TTL:', CACHE_TTL)
  } catch (err) {
    console.error('STEP 5 FAILED: Redis SET:', err.message)
    // Don't bail — still return the data
  }

  return res.status(200).json({
    ...result,
    source: 'api',
    cacheHit: false,
  })
}
