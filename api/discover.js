// api/discover.js — Discover feed endpoint (Vercel serverless)
// Cache-first with Redis (Upstash) — 5-minute TTL
// Returns: topStories, weather, marketOutlook

import { Redis } from '@upstash/redis'

const CACHE_KEY = 'discover_feed'
const CACHE_TTL = 300 // 5 minutes

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

// ─── Top Stories (Marketaux) ────────────────────────────────
async function fetchTopStories() {
  const apiKey = process.env.MARKETAUX_API_KEY
  if (!apiKey) return []

  try {
    const params = new URLSearchParams({
      api_token: apiKey,
      language: 'en',
      limit: '10',
      sort: 'entity_match_score',
      published_after: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
    })

    const res = await fetch(`https://api.marketaux.com/v1/news/all?${params}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`Marketaux ${res.status}`)
    const data = await res.json()
    const articles = data.data || []

    return articles.map((a) => ({
      title: (a.title || '').replace(/<[^>]+>/g, '').slice(0, 120),
      source: a.source || 'Unknown',
      publishedAt: a.published_at || null,
      thumbnailUrl: a.image_url && a.image_url.startsWith('http') ? a.image_url : null,
      url: a.url || null,
      sourcesCount: (a.similar || []).length + 1,
    }))
  } catch (err) {
    console.error('[discover] topStories fetch failed:', err.message)
    return []
  }
}

// ─── Weather (wttr.in) ──────────────────────────────────────
async function fetchWeather() {
  try {
    const res = await fetch('https://wttr.in/Boston+MA?format=j1', {
      headers: { 'User-Agent': 'Stratify/1.0' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) throw new Error(`wttr.in ${res.status}`)
    const data = await res.json()

    const current = data.current_condition?.[0] || {}
    const today = data.weather?.[0] || {}

    return {
      temp: Number(current.temp_F) || null,
      tempC: Number(current.temp_C) || null,
      condition: current.weatherDesc?.[0]?.value || 'Unknown',
      location: 'Boston, MA',
      high: Number(today.maxtempF) || null,
      low: Number(today.mintempF) || null,
      humidity: Number(current.humidity) || null,
      windMph: Number(current.windspeedMiles) || null,
      icon: current.weatherCode || null,
    }
  } catch (err) {
    console.error('[discover] weather fetch failed:', err.message)
    return {
      temp: null, condition: 'Unavailable', location: 'Boston, MA',
      high: null, low: null,
    }
  }
}

// ─── Market Outlook (Twelve Data) ───────────────────────────
async function fetchMarketOutlook() {
  const apiKey = (
    process.env.TWELVEDATA_API_KEY ||
    process.env.TWELVE_DATA_API_KEY ||
    process.env.VITE_TWELVE_DATA_API_KEY ||
    ''
  ).trim()

  if (!apiKey) return []

  const symbols = [
    { symbol: 'SPY', name: 'S&P 500' },
    { symbol: 'QQQ', name: 'NASDAQ' },
    { symbol: 'DIA', name: 'Dow Jones' },
    { symbol: 'VIX', name: 'VIX' },
    { symbol: 'BTC/USD', name: 'Bitcoin' },
  ]

  try {
    const symbolStr = symbols.map((s) => s.symbol).join(',')
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbolStr)}&apikey=${apiKey}`

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`Twelve Data ${res.status}`)
    const data = await res.json()

    return symbols.map((s) => {
      const quote = data[s.symbol] || data
      const isSingle = symbols.length === 1
      const q = isSingle ? data : quote

      const price = Number(q?.close || q?.price) || null
      const change = Number(q?.change) || null
      const pct = Number(q?.percent_change) || null

      return {
        name: s.name,
        symbol: s.symbol,
        value: price,
        change,
        changePercent: pct,
      }
    })
  } catch (err) {
    console.error('[discover] marketOutlook fetch failed:', err.message)
    return symbols.map((s) => ({
      name: s.name, symbol: s.symbol,
      value: null, change: null, changePercent: null,
    }))
  }
}

// ─── Handler ─────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const flush = req.query?.flush === 'true'

  // Try Redis cache
  let redis
  try {
    redis = getRedis()
  } catch (err) {
    console.error('[discover] Redis init failed:', err.message)
  }

  if (flush && redis) {
    try {
      await redis.del(CACHE_KEY)
      console.log('[discover] Cache FLUSHED')
    } catch (err) {
      console.error('[discover] Redis DEL failed:', err.message)
    }
  }

  if (redis && !flush) {
    try {
      const cached = await redis.get(CACHE_KEY)
      if (cached) {
        console.log('[discover] Cache HIT')
        const data = typeof cached === 'string' ? JSON.parse(cached) : cached
        return res.status(200).json({ ...data, source: 'cache', cacheHit: true })
      }
      console.log('[discover] Cache MISS')
    } catch (err) {
      console.error('[discover] Redis GET failed:', err.message)
    }
  }

  // Fetch all sections in parallel
  const [topStories, weather, marketOutlook] = await Promise.all([
    fetchTopStories(),
    fetchWeather(),
    fetchMarketOutlook(),
  ])

  const result = {
    topStories,
    weather,
    marketOutlook,
    generatedAt: new Date().toISOString(),
  }

  // Cache
  if (redis) {
    try {
      await redis.set(CACHE_KEY, JSON.stringify(result), { ex: CACHE_TTL })
      console.log(`[discover] Cached with ${CACHE_TTL}s TTL`)
    } catch (err) {
      console.error('[discover] Redis SET failed:', err.message)
    }
  }

  return res.status(200).json({ ...result, source: 'api', cacheHit: false })
}
