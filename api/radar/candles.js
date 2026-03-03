// /api/radar/candles.js
// Vercel serverless function — fetches historical candles from Twelve Data
// Cache-first with Redis (Upstash)

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY;
const TWELVE_DATA_BASE = 'https://api.twelvedata.com';

// Cache TTL by interval (seconds)
const CACHE_TTL = {
  '1min': 20,     // 20s for 1m candles
  '5min': 45,     // 45s for 5m candles
  '15min': 90,    // 90s for 15m candles
  '30min': 150,   // 2.5 min for 30m candles
  '1h': 300,      // 5 min for 1H candles
  '2h': 600,      // 10 min for 2H candles
  '4h': 1200,     // 20 min for 4H candles
  '1day': 3600,   // 1 hour for daily candles
};

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { symbol, interval = '1h' } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: 'Missing symbol parameter' });
  }

  if (!TWELVE_DATA_API_KEY) {
    return res.status(500).json({ error: 'TWELVE_DATA_API_KEY not configured' });
  }

  const cacheKey = `radar:candles:${symbol}:${interval}`;

  try {
    // 1. Cache-first — check Redis
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.status(200).json(typeof cached === 'string' ? JSON.parse(cached) : cached);
    }

    // 2. Cache miss — fetch from Twelve Data
    const outputSize = interval === '1day' ? 365 : 500;
    const url = `${TWELVE_DATA_BASE}/time_series?symbol=${symbol}&interval=${interval}&outputsize=${outputSize}&apikey=${TWELVE_DATA_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'error') {
      return res.status(400).json({ error: data.message || 'Twelve Data error' });
    }

    // 3. Store in Redis with TTL
    const ttl = CACHE_TTL[interval] || 300;
    await redis.setex(cacheKey, ttl, JSON.stringify(data));

    return res.status(200).json(data);
  } catch (err) {
    console.error('Radar candles error:', err);
    return res.status(500).json({ error: 'Failed to fetch candle data' });
  }
}
