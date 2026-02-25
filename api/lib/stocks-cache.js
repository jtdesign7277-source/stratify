import { Redis } from '@upstash/redis';

const TWELVE_DATA_QUOTES_URL = 'https://api.twelvedata.com/quotes';
const CACHE_PREFIX = 'stocks:price';

export const CACHE_TTL_SECONDS = 90;

export const WATCHLIST_SYMBOLS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'SPY', 'QQQ', 'DIA',
  'AMD', 'CRM', 'NFLX', 'SOFI', 'PLTR', 'COIN', 'HOOD', 'GME', 'AMC', 'BB',
  'RIVN', 'LCID', 'NIO', 'SNAP', 'ROKU', 'SQ', 'PYPL', 'SHOP', 'UBER', 'LYFT',
  'DIS', 'BA', 'JPM', 'GS', 'V', 'MA', 'WMT', 'COST', 'HD', 'LOW',
  'PFE', 'JNJ', 'UNH', 'ABBV', 'MRK', 'LLY', 'BMY', 'GILD', 'MRNA', 'BNTX',
];

let redisClient = null;
let redisDisabled = false;

const toNumber = (value) => {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const toQuoteNumber = (value) => {
  if (value == null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return toNumber(value);
};

const toNumberOrZero = (value) => toNumber(value) ?? 0;

const round2 = (value) => Number((toNumber(value) ?? 0).toFixed(2));

export function normalizeSymbol(value) {
  return String(value || '').trim().toUpperCase();
}

export function normalizeSymbols(value, fallback = WATCHLIST_SYMBOLS, limit = 200) {
  const source = value ? String(value).split(',') : fallback;
  const seen = new Set();
  const symbols = [];

  for (const raw of source) {
    const symbol = normalizeSymbol(raw);
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    symbols.push(symbol);
    if (symbols.length >= limit) break;
  }

  return symbols;
}

export function getTwelveDataApiKey() {
  const apiKey = (process.env.TWELVEDATA_API_KEY || '').trim();
  return { apiKey };
}

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
      console.error('[stocks-cache] Redis init failed, falling back to direct Twelve Data:', error);
      return null;
    }
  }

  return redisClient;
}

export function getStockCacheKey(symbol) {
  return `${CACHE_PREFIX}:${normalizeSymbol(symbol)}`;
}

export function parseCachedBar(rawValue) {
  if (!rawValue) return null;

  let parsed = rawValue;
  if (typeof rawValue === 'string') {
    try {
      parsed = JSON.parse(rawValue);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== 'object') return null;

  const symbol = normalizeSymbol(parsed.symbol);
  if (!symbol) return null;

  return { ...parsed, symbol };
}

function parseTwelveDataBatchQuotes(payload) {
  const quoteMap = {};
  if (!payload || typeof payload !== 'object') return quoteMap;

  if (Array.isArray(payload?.data)) {
    payload.data.forEach((quote) => {
      const symbol = normalizeSymbol(quote?.symbol);
      if (symbol) quoteMap[symbol] = quote;
    });
    return quoteMap;
  }

  const isSingleQuoteShape = payload?.symbol || payload?.close || payload?.price || payload?.last;
  if (isSingleQuoteShape) {
    const symbol = normalizeSymbol(payload?.symbol);
    if (symbol) quoteMap[symbol] = payload;
    return quoteMap;
  }

  Object.entries(payload).forEach(([key, value]) => {
    if (['status', 'code', 'message', 'meta'].includes(String(key))) return;
    if (!value || typeof value !== 'object') return;
    const symbol = normalizeSymbol(value?.symbol || key);
    if (symbol) quoteMap[symbol] = value;
  });

  return quoteMap;
}

function hasQuoteSnapshotData(quote) {
  const fields = [
    quote?.close,
    quote?.price,
    quote?.last,
    quote?.open,
    quote?.high,
    quote?.low,
    quote?.volume,
    quote?.previous_close,
    quote?.previousClose,
    quote?.prev_close,
    quote?.prevClose,
  ];

  return fields.some((value) => toQuoteNumber(value) != null);
}

function mapQuoteToSnapshot(quote) {
  const latestPrice = toQuoteNumber(quote?.close ?? quote?.price ?? quote?.last);
  const tradeTimestamp = quote?.datetime || quote?.timestamp || null;

  return {
    latestTrade: {
      p: latestPrice,
      t: tradeTimestamp,
    },
    dailyBar: {
      o: toQuoteNumber(quote?.open),
      h: toQuoteNumber(quote?.high),
      l: toQuoteNumber(quote?.low),
      c: latestPrice,
      v: toQuoteNumber(quote?.volume),
      t: tradeTimestamp,
    },
    prevDailyBar: {
      c: toQuoteNumber(
        quote?.previous_close
        ?? quote?.previousClose
        ?? quote?.prev_close
        ?? quote?.prevClose
      ),
    },
  };
}

export async function fetchSnapshotsFromTwelveData(symbols, creds = getTwelveDataApiKey()) {
  if (!Array.isArray(symbols) || symbols.length === 0) return {};

  const apiKey = String(creds?.apiKey || '').trim();
  if (!apiKey) {
    const error = new Error('Missing Twelve Data API key');
    error.status = 500;
    throw error;
  }

  const params = new URLSearchParams({
    symbol: symbols.join(','),
    apikey: apiKey,
  });

  const response = await fetch(`${TWELVE_DATA_QUOTES_URL}?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(`Twelve Data API error: ${response.status}`);
    error.status = response.status;
    error.detail = payload;
    throw error;
  }

  if (payload?.status === 'error') {
    const error = new Error(payload?.message || 'Twelve Data error');
    error.status = Number(payload?.code) || 502;
    error.detail = payload;
    throw error;
  }

  const quoteMap = parseTwelveDataBatchQuotes(payload);
  const snapshots = {};

  for (const symbol of symbols) {
    const normalizedSymbol = normalizeSymbol(symbol);
    const quote = quoteMap[normalizedSymbol];
    if (!quote || typeof quote !== 'object' || !hasQuoteSnapshotData(quote)) continue;
    snapshots[normalizedSymbol] = mapQuoteToSnapshot(quote);
  }

  return snapshots;
}

function getMarketSessionState() {
  const now = new Date();
  const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const hours = etTime.getHours();
  const minutes = etTime.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  const dayOfWeek = etTime.getDay();

  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isPreMarket = !isWeekend && totalMinutes >= 240 && totalMinutes < 570;
  const isRegularHours = !isWeekend && totalMinutes >= 570 && totalMinutes < 960;
  const isAfterHours = !isWeekend && totalMinutes >= 960 && totalMinutes < 1200;

  return {
    isPreMarket,
    isRegularHours,
    isAfterHours,
    marketSession: isPreMarket ? 'pre' : isRegularHours ? 'regular' : isAfterHours ? 'after' : 'closed',
  };
}

function resolvePrevClose(symbol, latestTrade, dailyBar, prevDailyBar) {
  const candidates = [
    { source: 'prevDailyBar.c', value: prevDailyBar?.c },
    { source: 'dailyBar.o', value: dailyBar?.o },
    { source: 'latestTrade.p', value: latestTrade?.p },
  ];

  let prevClose = 0;
  let prevCloseSource = 'prevDailyBar.c';

  for (const candidate of candidates) {
    const numericValue = toNumber(candidate.value);
    if (numericValue) {
      prevClose = numericValue;
      prevCloseSource = candidate.source;
      break;
    }
  }

  if (prevCloseSource !== 'prevDailyBar.c') {
    console.log(`[stocks] prevClose fallback for ${symbol}: using ${prevCloseSource}`);
  }

  return prevClose;
}

function buildBar(symbol, snapshot, sessionState) {
  const latest = snapshot?.latestTrade || {};
  const daily = snapshot?.dailyBar || {};
  const prevDaily = snapshot?.prevDailyBar || {};

  const latestPrice = toNumberOrZero(latest.p);
  const dailyClose = toNumberOrZero(daily.c);
  const prevClose = resolvePrevClose(symbol, latest, daily, prevDaily);

  let preMarketPrice = null;
  let preMarketChange = null;
  let preMarketChangePercent = null;
  let afterHoursPrice = null;
  let afterHoursChange = null;
  let afterHoursChangePercent = null;

  let price = 0;
  let change = 0;
  let changePercent = 0;

  if (sessionState.isPreMarket) {
    price = latestPrice || 0;
    change = dailyClose && prevClose ? dailyClose - prevClose : 0;
    changePercent = prevClose && dailyClose ? ((dailyClose - prevClose) / prevClose) * 100 : 0;

    if (latestPrice && dailyClose) {
      preMarketPrice = latestPrice;
      preMarketChange = latestPrice - dailyClose;
      preMarketChangePercent = (preMarketChange / dailyClose) * 100;
    } else if (latestPrice && prevClose) {
      preMarketPrice = latestPrice;
      preMarketChange = latestPrice - prevClose;
      preMarketChangePercent = (preMarketChange / prevClose) * 100;
    }
  } else if (sessionState.isAfterHours) {
    price = dailyClose || latestPrice || 0;
    change = prevClose ? dailyClose - prevClose : 0;
    changePercent = prevClose ? ((dailyClose - prevClose) / prevClose) * 100 : 0;

    if (latestPrice && dailyClose && latestPrice !== dailyClose) {
      afterHoursPrice = latestPrice;
      afterHoursChange = latestPrice - dailyClose;
      afterHoursChangePercent = (afterHoursChange / dailyClose) * 100;
    }
  } else {
    price = latestPrice || dailyClose || 0;
    change = prevClose ? price - prevClose : 0;
    changePercent = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
  }

  return {
    symbol,
    price,
    open: toNumberOrZero(daily.o),
    high: toNumberOrZero(daily.h),
    low: toNumberOrZero(daily.l),
    close: dailyClose,
    prevClose,
    change: round2(change),
    changePercent: round2(changePercent),
    volume: toNumberOrZero(daily.v),
    tradeTimestamp: latest.t || daily.t || null,
    preMarketPrice: preMarketPrice == null ? null : round2(preMarketPrice),
    preMarketChange: preMarketChange == null ? null : round2(preMarketChange),
    preMarketChangePercent: preMarketChangePercent == null ? null : round2(preMarketChangePercent),
    afterHoursPrice: afterHoursPrice == null ? null : round2(afterHoursPrice),
    afterHoursChange: afterHoursChange == null ? null : round2(afterHoursChange),
    afterHoursChangePercent: afterHoursChangePercent == null ? null : round2(afterHoursChangePercent),
    marketSession: sessionState.marketSession,
  };
}

export function mapSnapshotsToBars(snapshots, symbols) {
  if (!snapshots || typeof snapshots !== 'object' || !Array.isArray(symbols)) return [];

  const sessionState = getMarketSessionState();
  const bars = [];

  for (const symbol of symbols) {
    const normalizedSymbol = normalizeSymbol(symbol);
    const snapshot = snapshots[normalizedSymbol];
    if (!snapshot || typeof snapshot !== 'object') continue;
    bars.push(buildBar(normalizedSymbol, snapshot, sessionState));
  }

  return bars;
}
