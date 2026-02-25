import {
  CACHE_TTL_SECONDS,
  WATCHLIST_SYMBOLS,
  fetchSnapshotsFromAlpaca,
  getAlpacaCredentials,
  getRedisClient,
  getStockCacheKey,
  mapSnapshotsToBars,
  normalizeSymbols,
  parseCachedBar,
} from './lib/stocks-cache.js';

function setHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=20');
}

function unwrapPipelineResult(value) {
  if (value && typeof value === 'object' && 'result' in value) {
    return value.result;
  }
  return value;
}

export default async function handler(req, res) {
  setHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const credentials = getAlpacaCredentials();
  if (!credentials.key || !credentials.secret) {
    return res.status(500).json({ error: 'Missing Alpaca API credentials' });
  }

  const symbols = normalizeSymbols(req.query?.symbols, WATCHLIST_SYMBOLS, 200);
  if (symbols.length === 0) {
    return res.status(400).json({ error: 'Missing symbols' });
  }

  const redis = getRedisClient();
  const cachedBarsBySymbol = new Map();
  const fetchedBarsBySymbol = new Map();

  let missingSymbols = [...symbols];

  if (redis) {
    try {
      const readPipeline = redis.pipeline();
      symbols.forEach((symbol) => {
        readPipeline.get(getStockCacheKey(symbol));
      });

      const pipelineResults = await readPipeline.exec();
      const results = Array.isArray(pipelineResults) ? pipelineResults : [];
      const nextMissing = [];

      symbols.forEach((symbol, index) => {
        const rawCached = unwrapPipelineResult(results[index]);
        const parsed = parseCachedBar(rawCached);
        if (parsed) {
          cachedBarsBySymbol.set(symbol, parsed);
        } else {
          nextMissing.push(symbol);
        }
      });

      missingSymbols = nextMissing;
    } catch (error) {
      console.error('[stocks] Redis read failed:', error);
      missingSymbols = [...symbols];
    }
  }

  try {
    if (missingSymbols.length > 0) {
      const snapshots = await fetchSnapshotsFromAlpaca(missingSymbols, credentials);
      const fetchedBars = mapSnapshotsToBars(snapshots, missingSymbols);

      fetchedBars.forEach((bar) => {
        fetchedBarsBySymbol.set(bar.symbol, bar);
      });

      if (redis && fetchedBars.length > 0) {
        try {
          const writePipeline = redis.pipeline();
          fetchedBars.forEach((bar) => {
            writePipeline.set(getStockCacheKey(bar.symbol), bar, { ex: CACHE_TTL_SECONDS });
          });
          await writePipeline.exec();
        } catch (error) {
          console.error('[stocks] Redis write failed:', error);
        }
      }
    }

    const bars = symbols
      .map((symbol) => cachedBarsBySymbol.get(symbol) || fetchedBarsBySymbol.get(symbol))
      .filter(Boolean);

    return res.status(200).json(bars);
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) {
      console.error('[stocks] handler error:', error);
    }

    return res.status(status).json({
      error: error?.message || 'Failed to fetch stocks',
      detail: error?.detail || undefined,
    });
  }
}
