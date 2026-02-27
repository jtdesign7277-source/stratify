import { Redis } from '@upstash/redis';

const DEFAULT_INTERVAL = '1h';
const DEFAULT_OUTPUT_SIZE = 12;
const MAX_OUTPUT_SIZE = 100;
const CACHE_TTL_SECONDS = 4 * 60 * 60;
const SYMBOL_PATTERN = /^[A-Z][A-Z0-9./-]{0,19}$/;
let redisClient = null;
let redisDisabled = false;

function setHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
}

function toNumber(value) {
  const num = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeSymbol(value) {
  return String(value || '').trim().toUpperCase();
}

function normalizeInterval(value) {
  const raw = String(value || DEFAULT_INTERVAL).trim().toLowerCase();
  if (!raw) return DEFAULT_INTERVAL;
  if (!/^[0-9]{1,3}(min|h|day|week|month)$/.test(raw)) return DEFAULT_INTERVAL;
  return raw;
}

function normalizeOutputSize(value) {
  const parsed = Number.parseInt(String(value || DEFAULT_OUTPUT_SIZE), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_OUTPUT_SIZE;
  return Math.max(2, Math.min(parsed, MAX_OUTPUT_SIZE));
}

function getApiKey() {
  return String(process.env.TWELVE_DATA_API_KEY || '').trim();
}

function getRedisClient() {
  if (redisDisabled) return null;

  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  if (!redisClient) {
    try {
      redisClient = new Redis({ url, token });
    } catch (error) {
      redisDisabled = true;
      redisClient = null;
      console.error('[sparkline] Redis init failed:', error);
      return null;
    }
  }

  return redisClient;
}

function getCacheKey({ symbol, interval, outputsize }) {
  return `sparkline:${symbol}:${interval}:${outputsize}`;
}

function toTwelveDataSymbol(symbol) {
  if (String(symbol).endsWith('-USD')) {
    return symbol.replace('-USD', '/USD');
  }
  return symbol;
}

async function fetchSparklineFromTwelveData({ symbol, interval, outputsize, apiKey }) {
  const params = new URLSearchParams({
    symbol,
    interval,
    outputsize: String(outputsize),
    order: 'ASC',
    apikey: apiKey,
  });

  const response = await fetch(`https://api.twelvedata.com/time_series?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`Twelve Data request failed (${response.status})`);
    error.status = response.status;
    error.detail = detail;
    throw error;
  }

  const payload = await response.json();
  if (payload?.status === 'error' || (payload?.code && payload?.code !== 200)) {
    const error = new Error(payload?.message || 'Twelve Data error');
    error.status = 400;
    error.detail = payload;
    throw error;
  }

  const values = Array.isArray(payload?.values) ? payload.values : [];
  return values
    .map((item) => toNumber(item?.close))
    .filter((value) => value != null);
}

export default async function handler(req, res) {
  setHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const requestedSymbol = normalizeSymbol(req.query?.symbol);
  if (!requestedSymbol || !SYMBOL_PATTERN.test(requestedSymbol)) {
    return res.status(400).json({ error: 'Invalid symbol' });
  }
  const symbol = toTwelveDataSymbol(requestedSymbol);

  const interval = normalizeInterval(req.query?.interval);
  const outputsize = normalizeOutputSize(req.query?.outputsize);

  const apiKey = getApiKey();
  if (!apiKey) {
    return res.status(500).json({ error: 'TWELVE_DATA_API_KEY not configured' });
  }

  const cacheKey = getCacheKey({ symbol, interval, outputsize });

  let redis = null;
  try {
    redis = getRedisClient();
  } catch (error) {
    console.error('[sparkline] Redis init failed, continuing without cache:', error);
  }

  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      const cachedArray = Array.isArray(cached)
        ? cached
        : (typeof cached === 'string' ? JSON.parse(cached) : null);
      if (Array.isArray(cachedArray) && cachedArray.length > 1) {
        return res.status(200).json(cachedArray);
      }
    } catch (error) {
      console.error('[sparkline] Redis read failed:', error);
    }
  }

  try {
    const closes = await fetchSparklineFromTwelveData({ symbol, interval, outputsize, apiKey });

    if (redis && closes.length > 1) {
      try {
        await redis.set(cacheKey, closes, { ex: CACHE_TTL_SECONDS });
      } catch (error) {
        console.error('[sparkline] Redis write failed:', error);
      }
    }

    return res.status(200).json(closes);
  } catch (error) {
    return res.status(error?.status || 500).json({
      error: error?.message || 'Failed to load sparkline',
      detail: error?.detail || null,
    });
  }
}
