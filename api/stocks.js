import {
  CACHE_TTL_SECONDS,
  WATCHLIST_SYMBOLS,
  fetchSnapshotsFromTwelveData,
  getTwelveDataApiKey,
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

const STOCK_SYMBOL_PATTERN = /^[A-Z][A-Z0-9./-]{0,14}$/;

export default async function handler(req, res) {
  setHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const credentials = getTwelveDataApiKey();
  if (!credentials.apiKey) {
    console.error('[stocks] Twelve Data API key is missing. Proceeding in fail-open mode (cache-only data may be returned).', {
      checkedEnvVars: ['TWELVEDATA_API_KEY', 'TWELVE_DATA_API_KEY'],
      keySource: credentials?.source || null,
    });
  }

  const symbols = normalizeSymbols(req.query?.symbols, WATCHLIST_SYMBOLS, 200)
    .filter((symbol) => STOCK_SYMBOL_PATTERN.test(symbol));
  if (symbols.length === 0) {
    // Return an empty array instead of 400 so callers can fail soft.
    return res.status(200).json([]);
  }

  let redis = null;
  try {
    redis = getRedisClient();
  } catch (error) {
    console.error('[stocks] Redis unavailable, falling back to direct Twelve Data:', error);
    redis = null;
  }
  const cachedBarsBySymbol = new Map();
  const fetchedBarsBySymbol = new Map();
  const mergeFetchedBars = (bars) => {
    bars.forEach((bar) => {
      fetchedBarsBySymbol.set(bar.symbol, bar);
    });
  };
  const getCombinedBars = () => symbols
    .map((symbol) => cachedBarsBySymbol.get(symbol) || fetchedBarsBySymbol.get(symbol))
    .filter(Boolean);

  const fetchDirectBarsWithoutRedis = async (reason, targetSymbols = symbols) => {
    try {
      const snapshots = await fetchSnapshotsFromTwelveData(targetSymbols, credentials);
      return mapSnapshotsToBars(snapshots, targetSymbols);
    } catch (error) {
      console.error(`[stocks] Direct Twelve Data fail-open fetch failed (${reason}).`, {
        message: error?.message,
        status: error?.status,
        detail: error?.detail,
        symbolsCount: targetSymbols.length,
        symbols: targetSymbols.slice(0, 25),
      });
      return [];
    }
  };

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
      console.error('[stocks] Redis read failed. Falling back to direct Twelve Data without cache.', error);
      missingSymbols = [...symbols];
    }
  }

  try {
    if (missingSymbols.length > 0) {
      try {
        const snapshots = await fetchSnapshotsFromTwelveData(missingSymbols, credentials);
        const fetchedBars = mapSnapshotsToBars(snapshots, missingSymbols);
        mergeFetchedBars(fetchedBars);

        if (redis && fetchedBars.length > 0) {
          try {
            const writePipeline = redis.pipeline();
            fetchedBars.forEach((bar) => {
              writePipeline.set(getStockCacheKey(bar.symbol), bar, { ex: CACHE_TTL_SECONDS });
            });
            await writePipeline.exec();
          } catch (error) {
            console.error('[stocks] Redis write failed (data still returned from Twelve Data):', error);
          }
        }
      } catch (error) {
        console.error('[stocks] Primary fetch from Twelve Data failed. Retrying direct fail-open fetch without Redis.', {
          message: error?.message,
          status: error?.status,
          detail: error?.detail,
          symbolsCount: missingSymbols.length,
          symbols: missingSymbols.slice(0, 25),
        });
        const fallbackBars = await fetchDirectBarsWithoutRedis('primary-fetch-failed', symbols);
        mergeFetchedBars(fallbackBars);
      }
    }

    return res.status(200).json(getCombinedBars());
  } catch (error) {
    console.error('[stocks] Unexpected handler error. Returning fail-open response instead of 500.', {
      message: error?.message,
      status: error?.status,
      detail: error?.detail,
      symbolsCount: symbols.length,
      symbols: symbols.slice(0, 25),
    });

    const fallbackBars = await fetchDirectBarsWithoutRedis('unexpected-handler-error', symbols);
    mergeFetchedBars(fallbackBars);
    return res.status(200).json(getCombinedBars());
  }
}
