import { Redis } from '@upstash/redis';

const WEEK_BUCKET_MS = 7 * 24 * 60 * 60 * 1000;
const WEEKLY_TTL_SECONDS = 7 * 24 * 60 * 60;

export const SCAN_TTL_SECONDS = WEEKLY_TTL_SECONDS;
export const TRANSCRIPT_TTL_SECONDS = WEEKLY_TTL_SECONDS;

let redisClient = null;
let redisDisabled = false;

export function getRedisClient() {
  if (redisDisabled) return null;

  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;

  if (!redisClient) {
    try {
      redisClient = new Redis({ url, token });
    } catch (error) {
      redisDisabled = true;
      redisClient = null;
      console.error('[warroom-cache] Redis init failed:', error);
      return null;
    }
  }

  return redisClient;
}

const toTabKey = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'unknown';

const getCurrentWeekNumber = () => Math.floor(Date.now() / WEEK_BUCKET_MS);

function weeklyWarRoomKey(tab) {
  return `warroom:${toTabKey(tab)}:week-${getCurrentWeekNumber()}`;
}

function scanCacheKey(label) {
  return weeklyWarRoomKey(label);
}

function transcriptCacheKey(symbol) {
  return weeklyWarRoomKey(`transcripts-${String(symbol || '').toUpperCase()}`);
}

export async function getCachedScan(label) {
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    const cached = await redis.get(scanCacheKey(label));
    if (!cached) return null;
    return typeof cached === 'string' ? JSON.parse(cached) : cached;
  } catch {
    return null;
  }
}

export async function setCachedScan(label, data) {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.set(scanCacheKey(label), JSON.stringify(data), { ex: SCAN_TTL_SECONDS });
  } catch (error) {
    console.error('[warroom-cache] Failed to cache scan:', error);
  }
}

export async function getCachedTranscript(symbol) {
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    const cached = await redis.get(transcriptCacheKey(symbol.toUpperCase()));
    if (!cached) return null;
    return typeof cached === 'string' ? JSON.parse(cached) : cached;
  } catch {
    return null;
  }
}

export async function setCachedTranscript(symbol, data) {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.set(transcriptCacheKey(symbol.toUpperCase()), JSON.stringify(data), { ex: TRANSCRIPT_TTL_SECONDS });
  } catch (error) {
    console.error('[warroom-cache] Failed to cache transcript:', error);
  }
}

export async function flushTranscriptCache(symbols) {
  const redis = getRedisClient();
  if (!redis) return 0;
  try {
    const pipeline = redis.pipeline();
    for (const symbol of symbols) {
      pipeline.del(transcriptCacheKey(symbol.toUpperCase()));
    }
    const results = await pipeline.exec();
    return results.filter(r => r === 1).length;
  } catch { return 0; }
}

export async function getAllCachedScans(labels) {
  const redis = getRedisClient();
  if (!redis) return {};
  try {
    const pipeline = redis.pipeline();
    for (const label of labels) {
      pipeline.get(scanCacheKey(label));
    }
    const results = await pipeline.exec();
    const cached = {};
    labels.forEach((label, i) => {
      const raw = results[i];
      if (raw) {
        try {
          cached[label] = typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch { /* skip */ }
      }
    });
    return cached;
  } catch {
    return {};
  }
}
