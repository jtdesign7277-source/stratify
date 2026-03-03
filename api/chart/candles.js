import { fetchLseTimeSeries } from '../lib/twelvedata.js';
import { Redis } from '@upstash/redis';

const INTERVAL_ALIASES = {
  '1m': '1min',
  '5m': '5min',
  '15m': '15min',
  '30m': '30min',
  '1d': '1day',
  '1w': '1week',
  '1mo': '1month',
};

const normalizeInterval = (value) => {
  const raw = String(value || '1day').trim().toLowerCase();
  return INTERVAL_ALIASES[raw] || raw;
};

const supportsPrepost = (interval) => {
  const match = String(interval || '').match(/^(\d+)min$/);
  if (!match) return false;
  const minutes = Number(match[1]);
  return Number.isFinite(minutes) && minutes > 0 && minutes <= 30;
};

const CACHE_KEY_PREFIX = 'candles';
let redisClient = null;
let redisDisabled = false;

const getRedisClient = () => {
  if (redisDisabled) return null;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (!redisClient) {
    try {
      redisClient = new Redis({ url, token });
    } catch {
      redisDisabled = true;
      redisClient = null;
      return null;
    }
  }
  return redisClient;
};

const buildCacheKey = ({ symbol, interval, outputsize, prepost }) => (
  `${CACHE_KEY_PREFIX}:${String(symbol || '').trim().toUpperCase()}:${interval}:${outputsize}:${prepost ? '1' : '0'}`
);

const getTtlSeconds = (interval) => {
  const normalized = String(interval || '').toLowerCase();
  if (normalized.endsWith('min')) return 20;
  if (normalized === '1h' || normalized === '1hour') return 45;
  if (normalized === '1day') return 300;
  return 900;
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const symbol = String(req.query.symbol || '').trim();
  const interval = normalizeInterval(req.query.interval || '1day');
  const outputsize = Math.max(1, Math.min(Number(req.query.outputsize || 500), 5000));
  const prepost = supportsPrepost(interval);

  if (!symbol) return res.status(400).json({ error: 'Missing symbol' });

  const redis = getRedisClient();
  const cacheKey = buildCacheKey({ symbol, interval, outputsize, prepost });
  if (redis) {
    try {
      const cachedRaw = await redis.get(cacheKey);
      if (cachedRaw) {
        const cached = typeof cachedRaw === 'string' ? JSON.parse(cachedRaw) : cachedRaw;
        if (cached && typeof cached === 'object') {
          return res.status(200).json({ ...cached, source: 'cache' });
        }
      }
    } catch {
      // continue to fresh fetch
    }
  }

  try {
    const data = await fetchLseTimeSeries(symbol, interval, outputsize, prepost);
    if (redis) {
      try {
        await redis.set(cacheKey, JSON.stringify(data), { ex: getTtlSeconds(interval) });
      } catch {
        // best effort cache write
      }
    }
    return res.status(200).json({ ...data, source: 'fresh' });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return res.status(status).json({ error: error?.message || 'Failed to fetch candles' });
  }
}
