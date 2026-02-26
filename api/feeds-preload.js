// api/feeds-preload.js — Preloads all 5 community feed caches in parallel
// Fire-and-forget from Community page mount — ensures every tab click is instant
// Cache-first: only fetches feeds that aren't already cached

import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
})

const FEEDS = ['earnings', 'momentum', 'macro', 'options', 'sentiment']

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    // Check which feeds are already cached
    const cacheKeys = FEEDS.map((f) => `feed:${f}`)
    const cached = await redis.mget(...cacheKeys)

    const missing = FEEDS.filter((_, i) => !cached[i])

    if (missing.length === 0) {
      return res.status(200).json({
        preloaded: [],
        message: 'All feeds already cached',
        cached: FEEDS,
      })
    }

    // Only fetch missing feeds — hit the feeds endpoint internally
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'

    const results = await Promise.allSettled(
      missing.map(async (feed) => {
        const response = await fetch(`${baseUrl}/api/feeds?feed=${feed}`)
        const data = await response.json()
        return { feed, status: data.cacheHit ? 'already-cached' : 'fetched' }
      })
    )

    return res.status(200).json({
      preloaded: results.map((r) => r.value || { feed: 'unknown', status: 'failed' }),
      cached: FEEDS.filter((_, i) => cached[i]),
    })
  } catch (error) {
    console.error('Feeds preload error:', error)
    return res.status(500).json({ error: 'Preload failed' })
  }
}
