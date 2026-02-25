import { Redis } from '@upstash/redis';

const WARROOM_CACHE_PREFIX = 'warroom:scan';
const TRANSCRIPT_CACHE_PREFIX = 'warroom:transcript';

export const SCAN_TTL_SECONDS = 30 * 60; // 30 minutes
export const TRANSCRIPT_TTL_SECONDS = 4 * 60 * 60; // 4 hours

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

function scanCacheKey(label) {
  return `${WARROOM_CACHE_PREFIX}:${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

function transcriptCacheKey(symbol) {
  return `${TRANSCRIPT_CACHE_PREFIX}:${symbol.toUpperCase()}`;
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
