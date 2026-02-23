// /api/bars.js — Vercel serverless function
// Fetches historical bar data from Alpaca via @alpacahq/alpaca-trade-api

import Alpaca from '@alpacahq/alpaca-trade-api';

const DEFAULT_LIMIT = 2000;
const MAX_LIMIT = 10000;
const TIMEFRAME_MAP = {
  '1Min': '1Min',
  '5Min': '5Min',
  '15Min': '15Min',
  '1Hour': '1Hour',
  '1Day': '1Day',
  '1Week': '1Week',
};
const INTRADAY_TIMEFRAMES = new Set(['1Min', '5Min', '15Min', '1Hour']);
const INTRADAY_LOOKBACK_DAYS_BY_TIMEFRAME = {
  '1Min': 7,
  '5Min': 30,
  '15Min': 90,
  '1Hour': 365,
};
const DAILY_LOOKBACK_MIN_DAYS = 365;
const DAILY_LOOKBACK_MAX_DAYS = 365 * 25;
const WEEKLY_LOOKBACK_MIN_DAYS = 365 * 5;
const WEEKLY_LOOKBACK_MAX_DAYS = 365 * 40;
const ALLOWED_TIMEFRAMES = new Set(Object.keys(TIMEFRAME_MAP));

const normalizeRawSymbol = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^\$/, '');

const normalizeCryptoSymbol = (value) => {
  const raw = normalizeRawSymbol(value);
  if (!raw) return null;
  if (raw.includes('/')) {
    const [base, quote] = raw.split('/');
    if (!base || !quote) return null;
    return `${base}/${quote}`;
  }
  if (raw.endsWith('-USD')) return `${raw.slice(0, -4)}/USD`;
  if (raw.endsWith('USD') && raw.length > 3) return `${raw.slice(0, -3)}/USD`;
  return null;
};

const getBarsArrayFromPayload = (payload, symbolKey) => {
  const barsMap = payload?.bars;
  if (!barsMap || typeof barsMap !== 'object') return [];
  if (Array.isArray(barsMap[symbolKey])) return barsMap[symbolKey];

  const compact = symbolKey.replace('/', '');
  if (Array.isArray(barsMap[compact])) return barsMap[compact];

  const dotted = symbolKey.replace('/', '-');
  if (Array.isArray(barsMap[dotted])) return barsMap[dotted];

  const firstKey = Object.keys(barsMap)[0];
  if (firstKey && Array.isArray(barsMap[firstKey])) return barsMap[firstKey];
  return [];
};

const parseLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
};

const parseDate = (value) => {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? null : new Date(ts).toISOString();
};

const getLookbackStartIso = (days) => {
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const getLookbackDaysForTimeframe = (timeframe, limit) => {
  const safeLimit = parseLimit(limit);

  if (INTRADAY_TIMEFRAMES.has(timeframe)) {
    return INTRADAY_LOOKBACK_DAYS_BY_TIMEFRAME[timeframe] || 21;
  }

  if (timeframe === '1Day') {
    return clamp(Math.ceil(safeLimit * 2.2), DAILY_LOOKBACK_MIN_DAYS, DAILY_LOOKBACK_MAX_DAYS);
  }

  if (timeframe === '1Week') {
    return clamp(Math.ceil(safeLimit * 7.5), WEEKLY_LOOKBACK_MIN_DAYS, WEEKLY_LOOKBACK_MAX_DAYS);
  }

  return null;
};

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    symbol,
    timeframe = '1Day',
    start,
    end,
    limit,
  } = req.query;

  if (!symbol || typeof symbol !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid symbol' });
  }

  const normalizedInputSymbol = normalizeRawSymbol(symbol);
  const cryptoSymbol = normalizeCryptoSymbol(normalizedInputSymbol);
  const isCrypto = Boolean(cryptoSymbol);
  const normalizedSymbol = isCrypto ? cryptoSymbol : normalizedInputSymbol;
  const normalizedTimeframe = typeof timeframe === 'string' ? timeframe : String(timeframe);
  const resolvedLimit = parseLimit(limit);

  if (!ALLOWED_TIMEFRAMES.has(normalizedTimeframe)) {
    return res.status(400).json({
      error: `Invalid timeframe. Must be one of: ${Array.from(ALLOWED_TIMEFRAMES).join(', ')}`,
    });
  }
  const mappedTimeframe = TIMEFRAME_MAP[normalizedTimeframe];

  let startIso = parseDate(start);
  const endIso = parseDate(end);

  if (!startIso) {
    const lookbackDays = getLookbackDaysForTimeframe(normalizedTimeframe, resolvedLimit);
    if (Number.isFinite(lookbackDays) && lookbackDays > 0) {
      startIso = getLookbackStartIso(lookbackDays);
    }
  }

  if (start && !startIso) {
    return res.status(400).json({ error: 'Invalid start date' });
  }
  if (end && !endIso) {
    return res.status(400).json({ error: 'Invalid end date' });
  }
  if (startIso && endIso && Date.parse(startIso) > Date.parse(endIso)) {
    return res.status(400).json({ error: 'Start date must be before end date' });
  }

  const ALPACA_KEY = (process.env.ALPACA_API_KEY || process.env.APCA_API_KEY_ID || '').trim();
  const ALPACA_SECRET = (
    process.env.ALPACA_SECRET_KEY ||
    process.env.ALPACA_API_SECRET ||
    process.env.APCA_API_SECRET_KEY ||
    ''
  ).trim();

  if (!ALPACA_KEY || !ALPACA_SECRET) {
    return res.status(500).json({ error: 'Alpaca API keys not configured' });
  }

  try {
    if (isCrypto) {
      const params = new URLSearchParams({
        symbols: normalizedSymbol,
        timeframe: mappedTimeframe,
        limit: String(resolvedLimit),
        sort: 'desc',
      });
      if (startIso) params.set('start', startIso);
      if (endIso) params.set('end', endIso);

      const url = `https://data.alpaca.markets/v1beta3/crypto/us/bars?${params.toString()}`;
      const response = await fetch(url, {
        headers: {
          'APCA-API-KEY-ID': ALPACA_KEY,
          'APCA-API-SECRET-KEY': ALPACA_SECRET,
          Accept: 'application/json',
        },
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return res.status(response.status).json({
          error: data?.message || data?.error || `Alpaca crypto bars request failed (${response.status})`,
        });
      }

      const bars = getBarsArrayFromPayload(data, normalizedSymbol);
      const payload = bars
        .map((bar) => {
          const rawTime = bar?.t || bar?.Timestamp || bar?.timestamp;
          const timestamp = rawTime ? new Date(rawTime).getTime() : null;
          if (!timestamp) return null;
          const open = Number(bar?.o ?? bar?.OpenPrice);
          const high = Number(bar?.h ?? bar?.HighPrice);
          const low = Number(bar?.l ?? bar?.LowPrice);
          const close = Number(bar?.c ?? bar?.ClosePrice);
          const volume = Number(bar?.v ?? bar?.Volume ?? 0);
          if (![open, high, low, close].every(Number.isFinite)) return null;
          return {
            time: Math.floor(timestamp / 1000),
            open,
            high,
            low,
            close,
            volume: Number.isFinite(volume) ? volume : 0,
          };
        })
        .filter(Boolean)
        .sort((a, b) => a.time - b.time);

      return res.status(200).json(payload);
    }

    const alpaca = new Alpaca({
      keyId: ALPACA_KEY,
      secretKey: ALPACA_SECRET,
      paper: false,
    });

    const options = {
      timeframe: mappedTimeframe,
      limit: resolvedLimit,
      adjustment: 'split',
      feed: 'sip',
      sort: 'desc',
    };

    if (startIso) options.start = startIso;
    if (endIso) options.end = endIso;

    const barsMap = await alpaca.getMultiBarsV2([normalizedSymbol], options);
    const bars = barsMap.get(normalizedSymbol) || [];

    const payload = bars
      .map((bar) => {
        const timestamp = bar.Timestamp ? new Date(bar.Timestamp).getTime() : null;
        if (!timestamp) return null;
        return {
          time: Math.floor(timestamp / 1000),
          open: bar.OpenPrice,
          high: bar.HighPrice,
          low: bar.LowPrice,
          close: bar.ClosePrice,
          volume: bar.Volume ?? 0,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.time - b.time);

    return res.status(200).json(payload);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch bars' });
  }
}
