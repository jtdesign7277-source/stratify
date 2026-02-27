// api/feeds-warm.js — Pre-warm popular feed caches
// Hit this endpoint once to pre-generate the 10 most popular feeds
// After warming, all popular feeds load instantly for every user for 7 days

import { Redis } from '@upstash/redis'

const POPULAR_FEEDS = [
  'Earnings', 'Momentum', 'Trending', 'Options', 'Macro',
  'Sentiment', 'Bitcoin', 'AI', 'Trump', 'MemeStocks'
]

function getRedis() {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) throw new Error('Missing Redis env vars')
  return new Redis({ url, token })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const feedsToWarm = req.query.feeds
    ? req.query.feeds.split(',').filter(Boolean)
    : POPULAR_FEEDS

  console.log(`[feeds-warm] Warming ${feedsToWarm.length} feeds...`)

  let redis
  try {
    redis = getRedis()
  } catch (err) {
    return res.status(500).json({ error: 'Redis unavailable', details: err.message })
  }

  // Check which are already cached
  const results = []
  const toGenerate = []

  for (const feed of feedsToWarm) {
    try {
      const cached = await redis.get(`feed:${feed.toLowerCase()}`)
      if (cached) {
        results.push({ feed, status: 'already-cached' })
      } else {
        toGenerate.push(feed)
      }
    } catch (err) {
      toGenerate.push(feed)
    }
  }

  if (toGenerate.length === 0) {
    return res.status(200).json({
      message: 'All feeds already cached',
      results,
      generated: 0,
    })
  }

  // Generate missing feeds by calling the feeds endpoint internally
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_URL || 'https://stratifymarket.com'

  console.log(`[feeds-warm] Generating ${toGenerate.length} feeds: ${toGenerate.join(', ')}`)

  // Process 3 at a time to avoid rate limits
  const batchSize = 3
  for (let i = 0; i < toGenerate.length; i += batchSize) {
    const batch = toGenerate.slice(i, i + batchSize)

    const batchResults = await Promise.allSettled(
      batch.map(async (feed) => {
        try {
          const response = await fetch(`${baseUrl}/api/feeds?feed=${encodeURIComponent(feed)}`)
          const data = await response.json()
          if (response.ok && data.posts?.length > 0) {
            return { feed, status: 'generated', postCount: data.posts.length }
          } else {
            return { feed, status: 'failed', error: data.error || `HTTP ${response.status}` }
          }
        } catch (err) {
          return { feed, status: 'failed', error: err.message }
        }
      })
    )

    batchResults.forEach(r => {
      results.push(r.value || { feed: 'unknown', status: 'error' })
    })

    // Small delay between batches to be nice to Claude API
    if (i + batchSize < toGenerate.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  const generated = results.filter(r => r.status === 'generated').length
  const failed = results.filter(r => r.status === 'failed').length

  console.log(`[feeds-warm] Complete: ${generated} generated, ${failed} failed`)

  return res.status(200).json({
    message: `Warmed ${generated} feeds`,
    results,
    generated,
    failed,
    total: feedsToWarm.length,
  })
}
