// /api/radar/candles.js
// Vercel serverless — fetches historical candles from Twelve Data
// Falls back to direct fetch if Redis unavailable

const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY;
const TWELVE_DATA_BASE = 'https://api.twelvedata.com';

let redis = null;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const { Redis } = require('@upstash/redis');
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch (e) {
  console.log('Redis not available, fetching directly');
}

const CACHE_TTL = {
  '1min': 30,
  '5min': 60,
  '15min': 120,
  '30min': 180,
  '1h': 300,
  '2h': 600,
  '4h': 1200,
  '1day': 3600,
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { symbol, interval = '1h' } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: 'Missing symbol parameter' });
  }

  if (!TWELVE_DATA_API_KEY) {
    return res.status(500).json({ error: 'TWELVE_DATA_API_KEY not configured' });
  }

  const cacheKey = `radar:candles:${symbol}:${interval}`;

  try {
    // 1. Try Redis cache first
    if (redis) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
          return res.status(200).json(data);
        }
      } catch (cacheErr) {
        console.log('Cache read failed:', cacheErr.message);
      }
    }

    // 2. Fetch from Twelve Data
    const outputSize = interval === '1day' ? 365 : interval === '1min' ? 200 : 500;
    const url = `${TWELVE_DATA_BASE}/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=${outputSize}&apikey=${TWELVE_DATA_API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'error') {
      console.error('Twelve Data error:', data.message);
      return res.status(400).json({ error: data.message || 'Twelve Data error' });
    }

    // 3. Cache in Redis if available
    if (redis && data.values) {
      try {
        const ttl = CACHE_TTL[interval] || 300;
        await redis.setex(cacheKey, ttl, JSON.stringify(data));
      } catch (cacheErr) {
        console.log('Cache write failed:', cacheErr.message);
      }
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('Radar candles error:', err);
    return res.status(500).json({ error: 'Failed to fetch candle data', details: err.message });
  }
};
