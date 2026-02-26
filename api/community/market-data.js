import { Redis } from '@upstash/redis';

export const config = { maxDuration: 15 };

const TWELVE_DATA_QUOTE_URL = 'https://api.twelvedata.com/quote';
const CACHE_KEY_PREFIX = 'quote';
const CACHE_TTL_SECONDS = 10;
const MAX_SYMBOLS = 80;

let redisClient = null;
let redisDisabled = false;

function getRedisClient() {
  if (redisDisabled) return null;

  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
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
    process.env.TWELVEDATA_API_KEY
    || process.env.TWELVE_DATA_API_KEY
    || ''
  ).trim();
}

const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeSymbol = (value) => String(value || '').trim().toUpperCase();

const normalizeSymbolKey = (value) => {
  const raw = normalizeSymbol(value);
  if (!raw) return '';
  if (raw.includes(':')) return raw.split(':').pop();
  return raw;
};

const unwrapPipelineResult = (value) => (
  value && typeof value === 'object' && 'result' in value ? value.result : value
);

const buildCacheKey = (symbol) => `${CACHE_KEY_PREFIX}:${symbol}`;

const emptyQuoteRow = (symbol) => ({
  symbol,
  price: null,
  previous_close: null,
  previousClose: null,
  change: null,
  percent_change: null,
  percentChange: null,
  changePercent: null,
  volume: null,
  timestamp: null,
});

const toQuoteRow = (symbol, quote = {}) => {
  const normalizedSymbol = normalizeSymbolKey(quote?.symbol || symbol) || symbol;
  const price = toNumber(quote?.close ?? quote?.price ?? quote?.last);
  const previousClose = toNumber(quote?.previous_close ?? quote?.previousClose);
  const change = toNumber(quote?.change);
  const percentChange = toNumber(
    quote?.percent_change
    ?? quote?.percentChange
    ?? quote?.changePercent
    ?? quote?.day_change_percent
    ?? quote?.dayChangePercent
  );

  return {
    symbol: normalizedSymbol,
    price,
    previous_close: previousClose,
    previousClose,
    change,
    percent_change: percentChange,
    percentChange,
    changePercent: percentChange,
    volume: toNumber(quote?.volume),
    timestamp: quote?.timestamp ?? quote?.datetime ?? null,
  };
};

const parseCachedQuotePayload = (raw, fallbackSymbol) => {
  if (!raw) return null;

  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== 'object') return null;

  const symbol = normalizeSymbolKey(parsed?.symbol || fallbackSymbol);
  if (!symbol) return null;

  return {
    ...parsed,
    symbol,
  };
};

async function fetchTwelveDataQuotePayload(symbols, apiKey) {
  if (!Array.isArray(symbols) || symbols.length === 0) return {};

  const params = new URLSearchParams({
    symbol: symbols.join(','),
    apikey: apiKey,
  });

  const response = await fetch(`${TWELVE_DATA_QUOTE_URL}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload?.message || `Twelve Data request failed (${response.status})`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  if (payload?.status === 'error') {
    const error = new Error(payload?.message || 'Twelve Data error');
    error.status = Number(payload?.code) || 502;
    error.payload = payload;
    throw error;
  }

  return payload;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { symbols } = req.query;
  if (!symbols) return res.status(400).json({ error: 'symbols query parameter required' });

  const symbolList = [...new Set(
    String(symbols)
      .split(',')
      .map((value) => normalizeSymbolKey(value))
      .filter(Boolean)
  )].slice(0, MAX_SYMBOLS);

  if (symbolList.length === 0) return res.status(400).json({ error: 'No valid symbols provided' });

  const redis = getRedisClient();
  const quoteBySymbol = new Map();
  const cacheMisses = [];

  if (redis) {
    try {
      const pipeline = redis.pipeline();
      for (const symbol of symbolList) {
        pipeline.get(buildCacheKey(symbol));
      }
      const cachedRows = await pipeline.exec();

      for (let i = 0; i < symbolList.length; i += 1) {
        const symbol = symbolList[i];
        const cachedRaw = unwrapPipelineResult(cachedRows?.[i]);
        const cachedPayload = parseCachedQuotePayload(cachedRaw, symbol);
        if (cachedPayload) {
          quoteBySymbol.set(symbol, toQuoteRow(symbol, cachedPayload));
        } else {
          cacheMisses.push(symbol);
        }
      }
    } catch (error) {
      console.error('[community/market-data] Redis read error:', error);
      cacheMisses.push(...symbolList.filter((symbol) => !quoteBySymbol.has(symbol)));
    }
  } else {
    cacheMisses.push(...symbolList);
  }

  if (cacheMisses.length > 0) {
    const apiKey = getApiKey();
    if (!apiKey) {
      for (const symbol of cacheMisses) {
        if (!quoteBySymbol.has(symbol)) quoteBySymbol.set(symbol, emptyQuoteRow(symbol));
      }
      return res.status(200).json({ data: sortByRequest(quoteBySymbol, symbolList) });
    }

    const quotePayloadBySymbol = {};

    try {
      const batchPayload = await fetchTwelveDataQuotePayload(cacheMisses, apiKey);
      Object.assign(quotePayloadBySymbol, parseQuotePayload(batchPayload, cacheMisses));
    } catch (error) {
      console.error('[community/market-data] Twelve Data batch fetch error:', error);
    }

    const unresolvedSymbols = cacheMisses.filter((symbol) => !quotePayloadBySymbol[symbol]);
    if (unresolvedSymbols.length > 0) {
      const singleResults = await Promise.all(
        unresolvedSymbols.map(async (symbol) => {
          try {
            const payload = await fetchTwelveDataQuotePayload([symbol], apiKey);
            return parseQuotePayload(payload, [symbol])[symbol] || null;
          } catch (error) {
            console.error('[community/market-data] Twelve Data single-symbol fetch error:', symbol, error);
            return null;
          }
        })
      );

      unresolvedSymbols.forEach((symbol, idx) => {
        if (singleResults[idx]) quotePayloadBySymbol[symbol] = singleResults[idx];
      });
    }

    const rawQuotesToCache = [];

    for (const symbol of cacheMisses) {
      const rawQuote = quotePayloadBySymbol[symbol] || null;
      if (rawQuote) {
        quoteBySymbol.set(symbol, toQuoteRow(symbol, rawQuote));
        rawQuotesToCache.push({ symbol, payload: rawQuote });
      } else {
        quoteBySymbol.set(symbol, emptyQuoteRow(symbol));
      }
    }

    if (redis && rawQuotesToCache.length > 0) {
      try {
        const pipeline = redis.pipeline();
        for (const item of rawQuotesToCache) {
          pipeline.set(buildCacheKey(item.symbol), JSON.stringify(item.payload), { ex: CACHE_TTL_SECONDS });
        }
        await pipeline.exec();
      } catch (error) {
        console.error('[community/market-data] Redis write error:', error);
      }
    }
  }

  return res.status(200).json({ data: sortByRequest(quoteBySymbol, symbolList) });
}

function parseQuotePayload(payload, symbols) {
  const quoteMap = {};
  if (!payload || typeof payload !== 'object') return quoteMap;

  if (symbols.length === 1) {
    const symbol = symbols[0];
    if (payload?.symbol || payload?.close || payload?.price || payload?.last) {
      const normalizedPayloadSymbol = normalizeSymbolKey(payload?.symbol || symbol);
      if (normalizedPayloadSymbol) quoteMap[normalizedPayloadSymbol] = payload;
      quoteMap[symbol] = payload;
    }
    return quoteMap;
  }

  for (const [key, value] of Object.entries(payload)) {
    if (!value || typeof value !== 'object') continue;
    if (['status', 'code', 'message'].includes(key)) continue;
    const symbol = normalizeSymbolKey(value?.symbol || key);
    if (symbol) quoteMap[symbol] = value;
  }

  return quoteMap;
}

function sortByRequest(quoteBySymbol, symbolList) {
  return symbolList.map((symbol) => quoteBySymbol.get(symbol) || emptyQuoteRow(symbol));
}
