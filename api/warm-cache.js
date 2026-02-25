import {
  CACHE_TTL_SECONDS,
  WATCHLIST_SYMBOLS,
  fetchSnapshotsFromTwelveData,
  getTwelveDataApiKey,
  getRedisClient,
  getStockCacheKey,
  mapSnapshotsToBars,
} from './lib/stocks-cache.js';

function setHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
}

export default async function handler(req, res) {
  setHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const credentials = getTwelveDataApiKey();
  if (!credentials.apiKey) {
    return res.status(500).json({ error: 'Missing TWELVEDATA_API_KEY' });
  }

  const redis = getRedisClient();
  if (!redis) {
    return res.status(500).json({
      error: 'Missing Redis credentials',
      requiredEnv: ['KV_REST_API_URL', 'KV_REST_API_TOKEN'],
    });
  }

  try {
    const snapshots = await fetchSnapshotsFromTwelveData(WATCHLIST_SYMBOLS, credentials);
    const bars = mapSnapshotsToBars(snapshots, WATCHLIST_SYMBOLS);

    if (bars.length > 0) {
      const pipeline = redis.pipeline();
      bars.forEach((bar) => {
        pipeline.set(getStockCacheKey(bar.symbol), bar, { ex: CACHE_TTL_SECONDS });
      });
      await pipeline.exec();
    }

    return res.status(200).json({
      success: true,
      requested: WATCHLIST_SYMBOLS.length,
      warmed: bars.length,
      ttlSeconds: CACHE_TTL_SECONDS,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) {
      console.error('[warm-cache] failed:', error);
    }

    return res.status(status).json({
      error: error?.message || 'Failed to warm stock cache',
      detail: error?.detail || undefined,
    });
  }
}
