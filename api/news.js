// api/news.js — Sidebar news endpoint (Vercel serverless)
// Fetches real headlines from Marketaux API, cached in Redis (30-min TTL)
// Primary fetch: 12 articles from last 72h; fallback: broader query from last 7d

import { Redis } from '@upstash/redis'

const CACHE_KEY = 'sidebar_news'
const CACHE_TTL = 1800 // 30 minutes

// Domains known to be paywalled — articles from these sources are filtered out
const PAYWALLED_SOURCES = [
  'seekingalpha.com',
  'wsj.com',
  'ft.com',
  'barrons.com',
  'bloomberg.com',
  'economist.com',
  'nytimes.com',
  'washingtonpost.com',
  'reuters.com',
]

function isPaywalled(article) {
  const domain = String(article.url || '').toLowerCase()
  const source = String(article.source || '').toLowerCase()
  return PAYWALLED_SOURCES.some(
    (s) => domain.includes(s) || source.includes(s.replace('.com', ''))
  )
}

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

// Convert ISO timestamp to relative time string
function relativeTime(publishedAt) {
  if (!publishedAt) return ''
  try {
    const diffMs = Date.now() - new Date(publishedAt).getTime()
    const min = Math.floor(diffMs / 60000)
    if (min < 60) return `${min}m ago`
    const hr = Math.floor(diffMs / 3600000)
    if (hr < 24) return `${hr}h ago`
    const d = Math.floor(diffMs / 86400000)
    return `${d}d ago`
  } catch {
    return ''
  }
}

// Derive sentiment from Marketaux entity sentiment scores
function deriveSentiment(entities) {
  if (!entities || entities.length === 0) return 'neutral'
  const scores = entities
    .map((e) => e.sentiment_score)
    .filter((s) => typeof s === 'number')
  if (scores.length === 0) return 'neutral'
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length
  if (avg > 0.3) return 'bullish'
  if (avg < -0.3) return 'bearish'
  return 'neutral'
}

// Extract first ticker symbol from entities
function extractTicker(entities) {
  if (!entities || entities.length === 0) return null
  const match = entities.find((e) => e.symbol && e.symbol.length <= 5)
  return match ? `$${match.symbol}` : null
}

// Strip HTML tags
function stripHtml(text) {
  if (!text) return ''
  return text.replace(/<\/?[^>]+(>|$)/g, '').trim()
}

// Transform Marketaux article to sidebar news format
function transformArticle(article) {
  const entities = article.entities || []
  return {
    title: stripHtml(article.title || '').slice(0, 100),
    source: article.source || 'Unknown',
    ticker: extractTicker(entities),
    sentiment: deriveSentiment(entities),
    time: relativeTime(article.published_at),
    summary: stripHtml(article.description || '').slice(0, 120),
    url: article.url || null,
    publishedAt: article.published_at || null,
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const flush = req.query?.flush === 'true'

  // Redis cache
  let redis
  try {
    redis = getRedis()
  } catch (err) {
    console.error('[news] Redis init failed:', err.message)
  }

  if (flush && redis) {
    try {
      await redis.del(CACHE_KEY)
      console.log('[news] Cache FLUSHED')
    } catch (err) {
      console.error('[news] Redis DEL failed:', err.message)
    }
  }

  if (redis && !flush) {
    try {
      const cached = await redis.get(CACHE_KEY)
      if (cached) {
        console.log('[news] Cache HIT')
        const data = typeof cached === 'string' ? JSON.parse(cached) : cached
        return res.status(200).json({
          articles: data.articles || [],
          fetchedAt: data.fetchedAt || new Date().toISOString(),
          source: 'cache',
          cacheHit: true,
        })
      }
      console.log('[news] Cache MISS')
    } catch (err) {
      console.error('[news] Redis GET failed:', err.message)
    }
  }

  // Fetch from Marketaux API
  const apiKey = process.env.MARKETAUX_API_KEY
  if (!apiKey) {
    return res.status(500).json({
      error: 'MARKETAUX_API_KEY not configured',
      articles: [],
    })
  }

  try {
    // Primary fetch: 12 articles from last 72 hours
    const threeDaysAgo = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString().split('T')[0]
    const params = new URLSearchParams({
      api_token: apiKey,
      language: 'en',
      limit: '12',
      sort: 'entity_match_score',
      published_after: threeDaysAgo,
    })

    const url = `https://api.marketaux.com/v1/news/all?${params.toString()}`
    console.log('[news] Fetching Marketaux (primary)...')

    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      const body = await response.text()
      console.error(`[news] Marketaux ${response.status}:`, body.substring(0, 300))
      throw new Error(`Marketaux API ${response.status}`)
    }

    const data = await response.json()
    const rawArticles = data.data || []

    console.log(`[news] Marketaux primary returned ${rawArticles.length} articles`)

    let articles = rawArticles
      .filter((a) => !isPaywalled(a))
      .map(transformArticle)
      .filter((a) => a.title && a.title.length > 10)

    // Fallback fetch if fewer than 7 articles after filtering
    if (articles.length < 7) {
      console.log(`[news] Only ${articles.length} articles, running fallback fetch...`)
      try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        const fallbackParams = new URLSearchParams({
          api_token: apiKey,
          language: 'en',
          limit: '10',
          sort: 'entity_match_score',
          search: 'stock market finance trading',
          published_after: sevenDaysAgo,
        })

        const fallbackRes = await fetch(
          `https://api.marketaux.com/v1/news/all?${fallbackParams.toString()}`,
          { signal: AbortSignal.timeout(10000) },
        )

        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json()
          const fallbackRaw = (fallbackData.data || [])
            .filter((a) => !isPaywalled(a))
            .map(transformArticle)
            .filter((a) => a.title && a.title.length > 10)

          console.log(`[news] Fallback returned ${fallbackRaw.length} articles`)

          // Deduplicate by title
          const seen = new Set(articles.map((a) => a.title))
          for (const a of fallbackRaw) {
            if (!seen.has(a.title)) {
              seen.add(a.title)
              articles.push(a)
            }
          }
        }
      } catch (fallbackErr) {
        console.error('[news] Fallback fetch failed:', fallbackErr.message)
      }
    }

    // Cap at 10 articles max
    articles = articles.slice(0, 10)

    const result = {
      articles,
      fetchedAt: new Date().toISOString(),
    }

    // Cache in Redis
    if (redis) {
      try {
        await redis.set(CACHE_KEY, JSON.stringify(result), { ex: CACHE_TTL })
        console.log(`[news] Cached ${articles.length} articles with ${CACHE_TTL}s TTL`)
      } catch (err) {
        console.error('[news] Redis SET failed:', err.message)
      }
    }

    return res.status(200).json({
      ...result,
      source: 'api',
      cacheHit: false,
    })
  } catch (err) {
    console.error('[news] Error fetching:', err.message)

    // Try stale cache
    if (redis) {
      try {
        const stale = await redis.get(CACHE_KEY)
        if (stale) {
          const data = typeof stale === 'string' ? JSON.parse(stale) : stale
          return res.status(200).json({
            articles: data.articles || [],
            fetchedAt: data.fetchedAt,
            source: 'stale-cache',
            cacheHit: true,
          })
        }
      } catch (_) {}
    }

    return res.status(500).json({
      error: 'Failed to fetch news',
      details: err.message,
      articles: [],
    })
  }
}
