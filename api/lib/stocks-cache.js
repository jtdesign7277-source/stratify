import { Redis } from '@upstash/redis';

const ALPACA_DATA_URL = 'https://data.alpaca.markets';
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

const toNumber = (value) => {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
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

export function getAlpacaCredentials() {
  const key = (process.env.ALPACA_API_KEY || process.env.APCA_API_KEY_ID || '').trim();
  const secret = (
    process.env.ALPACA_SECRET_KEY ||
    process.env.ALPACA_API_SECRET ||
    process.env.APCA_API_SECRET_KEY ||
    ''
  ).trim();

  return { key, secret };
}

export function getRedisClient() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) return null;

  if (!redisClient) {
    redisClient = new Redis({ url, token });
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

export async function fetchSnapshotsFromAlpaca(symbols, creds = getAlpacaCredentials()) {
  if (!Array.isArray(symbols) || symbols.length === 0) return {};

  if (!creds.key || !creds.secret) {
    const error = new Error('Missing Alpaca API credentials');
    error.status = 500;
    throw error;
  }

  const params = new URLSearchParams({
    symbols: symbols.join(','),
    feed: 'sip',
  });

  const response = await fetch(`${ALPACA_DATA_URL}/v2/stocks/snapshots?${params.toString()}`, {
    headers: {
      'APCA-API-KEY-ID': creds.key,
      'APCA-API-SECRET-KEY': creds.secret,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`Alpaca API error: ${response.status}`);
    error.status = response.status;
    error.detail = detail;
    throw error;
  }

  const payload = await response.json();
  return payload && typeof payload === 'object' ? payload : {};
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
