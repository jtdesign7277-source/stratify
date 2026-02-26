import { Redis } from '@upstash/redis';

export const config = { maxDuration: 15 };

const CACHE_PREFIX = 'community:price';
const CACHE_TTL = 10; // seconds

let redisClient = null;
let redisDisabled = false;

function getRedisClient() {
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
      console.error('[community/market-data] Redis init failed:', error);
      return null;
    }
  }
  return redisClient;
}

function getApiKey() {
  return String(
    process.env.TWELVEDATA_API_KEY ||
    process.env.TWELVE_DATA_API_KEY ||
    ''
  ).trim();
}

const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { symbols } = req.query;
  if (!symbols) return res.status(400).json({ error: 'symbols query parameter required' });

  const symbolList = String(symbols)
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 30);

  if (symbolList.length === 0) return res.status(400).json({ error: 'No valid symbols provided' });

  const redis = getRedisClient();
  const results = [];
  const cacheMisses = [];

  // Check Redis cache for each symbol
  if (redis) {
    try {
      const pipeline = redis.pipeline();
      for (const sym of symbolList) {
        pipeline.get(`${CACHE_PREFIX}:${sym}`);
      }
      const cached = await pipeline.exec();

      for (let i = 0; i < symbolList.length; i++) {
        const raw = cached[i];
        if (raw) {
          try {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            results.push(parsed);
          } catch {
            cacheMisses.push(symbolList[i]);
          }
        } else {
          cacheMisses.push(symbolList[i]);
        }
      }
    } catch (error) {
      console.error('[community/market-data] Redis read error:', error);
      // Fall through to fetch all symbols
      cacheMisses.push(...symbolList.filter((s) => !results.find((r) => r.symbol === s)));
    }
  } else {
    cacheMisses.push(...symbolList);
  }

  // Fetch missing symbols from Twelve Data
  if (cacheMisses.length > 0) {
    const apiKey = getApiKey();
    if (!apiKey) {
      // Return whatever we have from cache, plus empty entries for misses
      for (const sym of cacheMisses) {
        results.push({ symbol: sym, price: null, change: null, changePercent: null, volume: null });
      }
      return res.status(200).json({ data: sortByRequest(results, symbolList) });
    }

    try {
      const url = `https://api.twelvedata.com/quote?symbol=${cacheMisses.join(',')}&apikey=${apiKey}`;
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      const payload = await response.json().catch(() => ({}));

      const quoteMap = parseQuotePayload(payload, cacheMisses);
      const toCache = [];

      for (const sym of cacheMisses) {
        const quote = quoteMap[sym];
        const row = {
          symbol: sym,
          price: toNumber(quote?.close || quote?.price || quote?.last),
          change: toNumber(quote?.change),
          changePercent: toNumber(quote?.percent_change ?? quote?.percentChange),
          volume: toNumber(quote?.volume),
        };
        results.push(row);
        toCache.push(row);
      }

      // Cache results in Redis
      if (redis && toCache.length > 0) {
        try {
          const pipeline = redis.pipeline();
          for (const row of toCache) {
            pipeline.set(`${CACHE_PREFIX}:${row.symbol}`, JSON.stringify(row), { ex: CACHE_TTL });
          }
          await pipeline.exec();
        } catch (error) {
          console.error('[community/market-data] Redis write error:', error);
        }
      }
    } catch (error) {
      console.error('[community/market-data] Twelve Data fetch error:', error);
      // Return empty entries for symbols we couldn't fetch
      for (const sym of cacheMisses) {
        if (!results.find((r) => r.symbol === sym)) {
          results.push({ symbol: sym, price: null, change: null, changePercent: null, volume: null });
        }
      }
    }
  }

  return res.status(200).json({ data: sortByRequest(results, symbolList) });
}

function parseQuotePayload(payload, symbols) {
  const quoteMap = {};
  if (!payload || typeof payload !== 'object') return quoteMap;

  // Single symbol response
  if (symbols.length === 1) {
    const sym = symbols[0];
    if (payload?.symbol || payload?.close || payload?.price) {
      quoteMap[sym] = payload;
    }
    return quoteMap;
  }

  // Multi-symbol response: Twelve Data returns { AAPL: {...}, MSFT: {...} }
  for (const [key, value] of Object.entries(payload)) {
    if (!value || typeof value !== 'object') continue;
    if (['status', 'code', 'message'].includes(key)) continue;
    const sym = String(value?.symbol || key).trim().toUpperCase();
    if (sym) quoteMap[sym] = value;
  }

  return quoteMap;
}

function sortByRequest(results, symbolList) {
  const map = new Map();
  for (const row of results) {
    map.set(row.symbol, row);
  }
  return symbolList.map((sym) => map.get(sym)).filter(Boolean);
}
