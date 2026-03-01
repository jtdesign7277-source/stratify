import { Redis } from '@upstash/redis';

const CALENDAR_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const CACHE_KEY = 'economic-calendar:thisweek:v1';
const CACHE_TTL_SECONDS = 60 * 15;
const STALE_REVALIDATE_SECONDS = 60 * 60;

let redisClient = null;
let redisDisabled = false;
let memoryCache = null;
let memoryCacheAt = 0;

const getRedisClient = () => {
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
      console.error('[economic-calendar] Redis init failed:', error);
    }
  }

  return redisClient;
};

const parseCachedPayload = (raw) => {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
};

const hasCalendarRows = (data) => Array.isArray(data) && data.length > 0;

const getCachedCalendar = async () => {
  const redis = getRedisClient();
  if (!redis) return null;

  try {
    const cached = await redis.get(CACHE_KEY);
    return parseCachedPayload(cached);
  } catch (error) {
    console.error('[economic-calendar] Redis read failed:', error);
    return null;
  }
};

const setCachedCalendar = async (data) => {
  if (!Array.isArray(data) || data.length === 0) return;
  const redis = getRedisClient();
  if (!redis) return;

  try {
    await redis.set(CACHE_KEY, JSON.stringify(data), { ex: CACHE_TTL_SECONDS });
  } catch (error) {
    console.error('[economic-calendar] Redis write failed:', error);
  }
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const forceRefresh = String(req.query?.refresh || '') === '1';
  const memoryFresh = Array.isArray(memoryCache) && (Date.now() - memoryCacheAt) < CACHE_TTL_SECONDS * 1000;

  if (!forceRefresh) {
    if (memoryFresh) {
      res.setHeader('Cache-Control', `s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=${STALE_REVALIDATE_SECONDS}`);
      res.setHeader('X-Calendar-Source', 'memory-cache');
      return res.status(200).json(memoryCache);
    }

    const cached = await getCachedCalendar();
    if (Array.isArray(cached) && cached.length > 0) {
      memoryCache = cached;
      memoryCacheAt = Date.now();
      res.setHeader('Cache-Control', `s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=${STALE_REVALIDATE_SECONDS}`);
      res.setHeader('X-Calendar-Source', 'redis-cache');
      return res.status(200).json(cached);
    }
  }

  try {
    const response = await fetch(CALENDAR_URL, {
      headers: { 'User-Agent': 'Stratify/1.0' },
    });

    if (!response.ok) {
      const fallbackRedis = await getCachedCalendar();
      const fallbackData = hasCalendarRows(memoryCache)
        ? memoryCache
        : (hasCalendarRows(fallbackRedis) ? fallbackRedis : []);

      if (hasCalendarRows(fallbackRedis)) {
        memoryCache = fallbackRedis;
        memoryCacheAt = Date.now();
      }

      res.setHeader('Cache-Control', `s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=${STALE_REVALIDATE_SECONDS}`);
      res.setHeader('X-Calendar-Source', fallbackData.length > 0 ? 'stale-fallback' : 'empty-fallback');
      res.setHeader('X-Calendar-Stale', '1');
      return res.status(200).json(fallbackData);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error('Invalid calendar payload');
    }

    memoryCache = data;
    memoryCacheAt = Date.now();
    void setCachedCalendar(data);

    res.setHeader('Cache-Control', `s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=${STALE_REVALIDATE_SECONDS}`);
    res.setHeader('X-Calendar-Source', 'upstream');
    return res.status(200).json(data);
  } catch (err) {
    const fallbackRedis = await getCachedCalendar();
    const fallbackData = hasCalendarRows(memoryCache)
      ? memoryCache
      : (hasCalendarRows(fallbackRedis) ? fallbackRedis : []);

    if (hasCalendarRows(fallbackRedis)) {
      memoryCache = fallbackRedis;
      memoryCacheAt = Date.now();
    }

    if (fallbackData.length > 0) {
      res.setHeader('Cache-Control', `s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=${STALE_REVALIDATE_SECONDS}`);
      res.setHeader('X-Calendar-Source', 'stale-fallback');
      res.setHeader('X-Calendar-Stale', '1');
      return res.status(200).json(fallbackData);
    }

    res.setHeader('Cache-Control', `s-maxage=${CACHE_TTL_SECONDS}, stale-while-revalidate=${STALE_REVALIDATE_SECONDS}`);
    res.setHeader('X-Calendar-Source', 'empty-fallback');
    res.setHeader('X-Calendar-Stale', '1');
    return res.status(200).json([]);
  }
}
