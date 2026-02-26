// lib/redis.js — Shared Redis client + cache utilities for ALL Stratify endpoints
// Every API route imports from here. No endpoint should talk to Redis directly.
// Follows Hard Rules #1 (cache-first) and #9 (dedup)

import { Redis } from '@upstash/redis'
import crypto from 'crypto'

// ── Redis Client ──────────────────────────────────────────────────
const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
})

export default redis

// ── In-flight Deduplication ───────────────────────────────────────
// If the same cache key is being fetched, return the existing promise
// instead of firing a duplicate API call
const inFlight = new Map()

/**
 * Cache-first wrapper for ANY data fetcher.
 * Usage in any API route:
 *
 *   import { cachedFetch } from '../../lib/redis.js'
 *
 *   export default async function handler(req, res) {
 *     const data = await cachedFetch({
 *       key: 'stock:AAPL',
 *       ttl: 30,
 *       fetcher: () => fetch('https://api.twelvedata.com/quote?symbol=AAPL&apikey=...')
 *                        .then(r => r.json()),
 *     })
 *     return res.status(200).json(data)
 *   }
 *
 * @param {Object} options
 * @param {string} options.key - Redis cache key (e.g. 'stock:AAPL', 'sophia:quick:abc123')
 * @param {number} options.ttl - Time-to-live in seconds
 * @param {Function} options.fetcher - Async function that returns the data on cache miss
 * @param {boolean} [options.serveStale=true] - If fetcher fails, serve expired cache
 * @returns {{ data, source: 'cache'|'api'|'stale-cache' }}
 */
export async function cachedFetch({ key, ttl, fetcher, serveStale = true }) {
  // 1. ALWAYS check Redis cache first
  try {
    const cached = await redis.get(key)
    if (cached) {
      return { data: cached, source: 'cache', cacheHit: true }
    }
  } catch (err) {
    console.error(`Redis GET error for ${key}:`, err)
    // Continue to fetch even if Redis is down
  }

  // 2. In-flight dedup — if this key is already being fetched, wait for it
  if (inFlight.has(key)) {
    const data = await inFlight.get(key)
    return { data, source: 'api-deduped', cacheHit: false }
  }

  // 3. Cache miss — fetch from source
  const promise = fetcher()
    .then(async (data) => {
      // 4. Store in Redis with TTL
      try {
        await redis.set(key, data, { ex: ttl })
      } catch (err) {
        console.error(`Redis SET error for ${key}:`, err)
      }
      return data
    })
    .finally(() => {
      inFlight.delete(key)
    })

  inFlight.set(key, promise)

  try {
    const data = await promise
    return { data, source: 'api', cacheHit: false }
  } catch (err) {
    // 5. Fallback: serve stale cache if available
    if (serveStale) {
      try {
        const stale = await redis.get(key)
        if (stale) {
          return { data: stale, source: 'stale-cache', cacheHit: true, stale: true }
        }
      } catch (_) {}
    }
    throw err
  }
}

/**
 * Hash prompt inputs into a short cache key.
 * Use for Claude API / Grok API calls so identical prompts return cached responses.
 *
 * Usage:
 *   const key = `sophia:chat:${hashPrompt({ ticker: 'AAPL', question: 'What is RSI?' })}`
 *
 * @param {Object} inputs - Any JSON-serializable object
 * @returns {string} 16-char hex hash
 */
export function hashPrompt(inputs) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(inputs))
    .digest('hex')
    .slice(0, 16)
}

/**
 * Batch fetch multiple keys, only fetching what's missing from cache.
 * Perfect for watchlists with multiple symbols.
 *
 * Usage:
 *   const results = await batchCachedFetch({
 *     keys: symbols.map(s => `stock:${s}`),
 *     ttl: 30,
 *     fetcher: (missingKeys) => fetchFromTwelveData(missingKeys),
 *   })
 *
 * @param {Object} options
 * @param {string[]} options.keys - Array of Redis cache keys
 * @param {number} options.ttl - TTL for freshly fetched items
 * @param {Function} options.fetcher - Receives array of missing keys, returns Map or Object
 * @returns {Object} Map of key -> data
 */
export async function batchCachedFetch({ keys, ttl, fetcher }) {
  // 1. Multi-get from Redis
  const cached = await redis.mget(...keys)

  const results = {}
  const missing = []

  keys.forEach((key, i) => {
    if (cached[i]) {
      results[key] = cached[i]
    } else {
      missing.push(key)
    }
  })

  // 2. Fetch only missing
  if (missing.length > 0) {
    const freshData = await fetcher(missing)

    // 3. Pipeline cache writes
    const pipeline = redis.pipeline()
    for (const [key, value] of Object.entries(freshData)) {
      results[key] = value
      pipeline.set(key, value, { ex: ttl })
    }
    await pipeline.exec()
  }

  return results
}

// ── TTL Constants ─────────────────────────────────────────────────
// Central place for all TTL values. Update here when scaling up.
// TODO: Drop to production values once paying customers are active

export const TTL = {
  // Market data
  STOCK_QUOTE_LIVE: 30,        // 30s during market hours
  STOCK_QUOTE_AFTER: 300,      // 5 min after hours
  MARKET_OVERVIEW: 30,         // 30s — shared across all users
  HISTORICAL_DATA: 600,        // 10 min
  WATCHLIST: 60,               // 60s per user

  // AI responses (these cost real money!)
  SOPHIA_QUICK: 604800,        // 7 days — quick responses are mostly static
  SOPHIA_CHAT: 604800,         // 7 days — same question = same answer
  STRATEGY_GENERATE: 604800,   // 7 days — same ticker+template = same strategy
  STRATEGY_TEMPLATES: 604800,  // 7 days — templates rarely change
  BACKTEST_RESULTS: 604800,    // 7 days — same params = same backtest
  AI_REWRITE: 604800,          // 7 days — community post rewrites

  // Community
  NEWS_TRENDING: 604800,       // 7 days — weekly refresh
  FEED_POSTS: 604800,          // 7 days — weekly refresh

  // ── PRODUCTION VALUES (uncomment when scaling) ──────────────
  // SOPHIA_QUICK: 1800,       // 30 min
  // SOPHIA_CHAT: 1800,        // 30 min
  // STRATEGY_GENERATE: 3600,  // 1 hour
  // STRATEGY_TEMPLATES: 3600, // 1 hour
  // BACKTEST_RESULTS: 3600,   // 1 hour
  // AI_REWRITE: 900,          // 15 min
  // NEWS_TRENDING: 300,       // 5 min
  // FEED_POSTS: 300,          // 5 min
}
