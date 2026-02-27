// api/news.js — Cached news endpoint (Vercel serverless)
// Uses Anthropic Claude API + Upstash Redis caching
// Debug logging at every step

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

  console.log('ENV CHECK:', {
    hasRedisUrl: !!process.env.KV_REST_API_URL,
    hasRedisToken: !!process.env.KV_REST_API_TOKEN,
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
  })

  // Step 1: Create Redis client
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
  }

  // Step 3: Fetch from Claude API
  let claudeResponse
  try {
    console.log('STEP 3: Calling Claude API...')
    claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: 'You are a financial news aggregator. Return ONLY a valid JSON array, no markdown, no backticks, no explanation. Return 6-8 trending market news items. Each item must have: "title" (concise headline, max 80 chars), "source" (e.g. "Reuters", "Bloomberg", "CNBC", "X/Twitter"), "ticker" (relevant ticker with $ prefix or null), "sentiment" ("bullish", "bearish", or "neutral"), "time" (relative like "2h ago", "15m ago", "1d ago"), "summary" (1 sentence, max 120 chars). Focus on: earnings, Fed/macro, big movers, breaking news, trending tickers. Order by recency. JSON array only.',
        messages: [
          {
            role: 'user',
            content: 'What are the most important trending stock market news stories right now?',
          },
        ],
      }),
    })
    console.log('STEP 3: Claude API status:', claudeResponse.status)
    if (!claudeResponse.ok) {
      const body = await claudeResponse.text()
      console.error('STEP 3 FAILED: Claude API response body:', body)
      throw new Error(`Claude API ${claudeResponse.status}: ${body}`)
    }
  } catch (err) {
    console.error('STEP 3 FAILED: Claude fetch:', err.message)
    return res.status(500).json({
      error: 'Claude API fetch failed',
      details: err.message,
      step: 'claude-fetch',
      articles: [],
    })
  }

  // Step 4: Parse Claude response
  let articles
  try {
    const data = await claudeResponse.json()
    const content = data.content?.[0]?.text || '[]'
    console.log('STEP 4: Raw Claude content (first 200 chars):', content.substring(0, 200))
    const clean = content.replace(/```json|```/g, '').trim()
    articles = JSON.parse(clean)
    console.log('STEP 4: Parsed', articles.length, 'articles')
  } catch (err) {
    console.error('STEP 4 FAILED: Claude parse:', err.message)
    return res.status(500).json({
      error: 'Claude response parse failed',
      details: err.message,
      step: 'claude-parse',
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
  }

  return res.status(200).json({
    ...result,
    source: 'api',
    cacheHit: false,
  })
}
