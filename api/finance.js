// api/finance.js — Finance feed endpoint (Vercel serverless)
// Cache-first with Redis (Upstash) — 2-minute TTL
// Returns: indices, marketSummary, trendingCompanies, predictionMarkets

import { Redis } from '@upstash/redis'

const CACHE_KEY = 'finance_feed'
const CACHE_TTL = 120 // 2 minutes

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

function getTwelveDataKey() {
  return (
    process.env.TWELVEDATA_API_KEY ||
    process.env.TWELVE_DATA_API_KEY ||
    process.env.VITE_TWELVE_DATA_API_KEY ||
    ''
  ).trim()
}

// ─── Indices (Twelve Data /quote + /time_series for sparkline) ──
const INDEX_SYMBOLS = [
  { symbol: 'SPY', name: 'S&P 500' },
  { symbol: 'QQQ', name: 'NASDAQ' },
  { symbol: 'DIA', name: 'Dow Jones' },
  { symbol: 'VIX', name: 'VIX' },
]

async function fetchIndices() {
  const apiKey = getTwelveDataKey()
  if (!apiKey) return INDEX_SYMBOLS.map((s) => ({ name: s.name, symbol: s.symbol, value: null, change: null, changePercent: null, sparkline: [] }))

  try {
    // Fetch quotes
    const symbolStr = INDEX_SYMBOLS.map((s) => s.symbol).join(',')
    const quoteUrl = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbolStr)}&apikey=${apiKey}`
    const quoteRes = await fetch(quoteUrl, { signal: AbortSignal.timeout(8000) })
    if (!quoteRes.ok) throw new Error(`Twelve Data quote ${quoteRes.status}`)
    const quoteData = await quoteRes.json()

    // Fetch sparklines in parallel (last 20 data points, 1h interval)
    const sparklinePromises = INDEX_SYMBOLS.map(async (s) => {
      try {
        const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(s.symbol)}&interval=1h&outputsize=20&order=ASC&dp=2&apikey=${apiKey}`
        const r = await fetch(url, { signal: AbortSignal.timeout(6000) })
        if (!r.ok) return []
        const d = await r.json()
        return (d.values || []).map((v) => Number(v.close) || 0)
      } catch {
        return []
      }
    })
    const sparklines = await Promise.all(sparklinePromises)

    return INDEX_SYMBOLS.map((s, i) => {
      const q = quoteData[s.symbol] || {}
      return {
        name: s.name,
        symbol: s.symbol,
        value: Number(q.close || q.price) || null,
        change: Number(q.change) || null,
        changePercent: Number(q.percent_change) || null,
        sparkline: sparklines[i] || [],
      }
    })
  } catch (err) {
    console.error('[finance] indices fetch failed:', err.message)
    return INDEX_SYMBOLS.map((s) => ({ name: s.name, symbol: s.symbol, value: null, change: null, changePercent: null, sparkline: [] }))
  }
}

// ─── Market Summary (Marketaux headlines) ───────────────────
async function fetchMarketSummary() {
  const apiKey = process.env.MARKETAUX_API_KEY
  if (!apiKey) return []

  try {
    const params = new URLSearchParams({
      api_token: apiKey,
      language: 'en',
      limit: '10',
      sort: 'entity_match_score',
      search: 'stock market',
      published_after: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
    })

    const res = await fetch(`https://api.marketaux.com/v1/news/all?${params}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`Marketaux ${res.status}`)
    const data = await res.json()

    return (data.data || []).map((a) => ({
      headline: (a.title || '').replace(/<[^>]+>/g, '').slice(0, 120),
      snippet: (a.description || '').replace(/<[^>]+>/g, '').slice(0, 200),
      source: a.source || 'Unknown',
      url: a.url || null,
      publishedAt: a.published_at || null,
      isExpanded: false,
    }))
  } catch (err) {
    console.error('[finance] marketSummary fetch failed:', err.message)
    return []
  }
}

// ─── Trending Companies (Twelve Data quotes) ────────────────
const TRENDING_SYMBOLS = [
  { symbol: 'NVDA', name: 'NVIDIA' },
  { symbol: 'TSLA', name: 'Tesla' },
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'MSFT', name: 'Microsoft' },
  { symbol: 'META', name: 'Meta' },
  { symbol: 'AMZN', name: 'Amazon' },
  { symbol: 'GOOGL', name: 'Alphabet' },
  { symbol: 'AMD', name: 'AMD' },
]

async function fetchTrendingCompanies() {
  const apiKey = getTwelveDataKey()
  if (!apiKey) return TRENDING_SYMBOLS.map((s) => ({ name: s.name, ticker: s.symbol, price: null, changePercent: null, logoUrl: null }))

  try {
    const symbolStr = TRENDING_SYMBOLS.map((s) => s.symbol).join(',')
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbolStr)}&apikey=${apiKey}`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`Twelve Data ${res.status}`)
    const data = await res.json()

    return TRENDING_SYMBOLS.map((s) => {
      const q = data[s.symbol] || {}
      return {
        name: s.name,
        ticker: s.symbol,
        price: Number(q.close || q.price) || null,
        changePercent: Number(q.percent_change) || null,
        logoUrl: `https://logo.clearbit.com/${s.name.toLowerCase().replace(/[^a-z]/g, '')}.com`,
      }
    })
  } catch (err) {
    console.error('[finance] trendingCompanies fetch failed:', err.message)
    return TRENDING_SYMBOLS.map((s) => ({ name: s.name, ticker: s.symbol, price: null, changePercent: null, logoUrl: null }))
  }
}

// ─── Prediction Markets (Polymarket public gamma API) ───────
async function fetchPredictionMarkets() {
  try {
    const res = await fetch('https://gamma-api.polymarket.com/markets?limit=6&active=true&closed=false&order=volume24hr&ascending=false', {
      signal: AbortSignal.timeout(6000),
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`Polymarket ${res.status}`)
    const markets = await res.json()

    if (!Array.isArray(markets)) return []

    return markets.slice(0, 6).map((m) => {
      const outcomePrices = (() => {
        try { return JSON.parse(m.outcomePrices || '[]') } catch { return [] }
      })()
      const outcomes = (() => {
        try { return JSON.parse(m.outcomes || '[]') } catch { return [] }
      })()

      const options = outcomes.map((label, i) => ({
        label: String(label).slice(0, 40),
        probability: Math.round((Number(outcomePrices[i]) || 0) * 100),
        change: null,
      }))

      return {
        question: (m.question || m.title || '').slice(0, 120),
        options,
        volume: Number(m.volume24hr) || Number(m.volume) || 0,
        source: 'Polymarket',
        url: m.slug ? `https://polymarket.com/event/${m.slug}` : null,
      }
    })
  } catch (err) {
    console.error('[finance] predictionMarkets fetch failed:', err.message)
    return []
  }
}

// ─── Handler ─────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const flush = req.query?.flush === 'true'

  let redis
  try {
    redis = getRedis()
  } catch (err) {
    console.error('[finance] Redis init failed:', err.message)
  }

  if (flush && redis) {
    try {
      await redis.del(CACHE_KEY)
      console.log('[finance] Cache FLUSHED')
    } catch (err) {
      console.error('[finance] Redis DEL failed:', err.message)
    }
  }

  if (redis && !flush) {
    try {
      const cached = await redis.get(CACHE_KEY)
      if (cached) {
        console.log('[finance] Cache HIT')
        const data = typeof cached === 'string' ? JSON.parse(cached) : cached
        return res.status(200).json({ ...data, source: 'cache', cacheHit: true })
      }
      console.log('[finance] Cache MISS')
    } catch (err) {
      console.error('[finance] Redis GET failed:', err.message)
    }
  }

  // Fetch all sections in parallel
  const [indices, marketSummary, trendingCompanies, predictionMarkets] = await Promise.all([
    fetchIndices(),
    fetchMarketSummary(),
    fetchTrendingCompanies(),
    fetchPredictionMarkets(),
  ])

  const result = {
    indices,
    marketSummary,
    trendingCompanies,
    predictionMarkets,
    generatedAt: new Date().toISOString(),
  }

  // Cache
  if (redis) {
    try {
      await redis.set(CACHE_KEY, JSON.stringify(result), { ex: CACHE_TTL })
      console.log(`[finance] Cached with ${CACHE_TTL}s TTL`)
    } catch (err) {
      console.error('[finance] Redis SET failed:', err.message)
    }
  }

  return res.status(200).json({ ...result, source: 'api', cacheHit: false })
}
