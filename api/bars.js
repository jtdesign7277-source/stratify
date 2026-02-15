// /api/bars.js — Vercel serverless function
// Fetches historical bar data from Alpaca via @alpacahq/alpaca-trade-api

import Alpaca from '@alpacahq/alpaca-trade-api';

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 10000;
const TIMEFRAME_MAP = {
  '1Min': '1Min',
  '5Min': '5Min',
  '15Min': '15Min',
  '1Hour': '1Hour',
  '1Day': '1Day',
  '1Week': '1Week',
};
const ALLOWED_TIMEFRAMES = new Set(Object.keys(TIMEFRAME_MAP));

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

  const normalizedSymbol = symbol.toUpperCase();
  const normalizedTimeframe = typeof timeframe === 'string' ? timeframe : String(timeframe);

  if (!ALLOWED_TIMEFRAMES.has(normalizedTimeframe)) {
    return res.status(400).json({
      error: `Invalid timeframe. Must be one of: ${Array.from(ALLOWED_TIMEFRAMES).join(', ')}`,
    });
  }
  const mappedTimeframe = TIMEFRAME_MAP[normalizedTimeframe];

  const startIso = parseDate(start);
  const endIso = parseDate(end);

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
    const alpaca = new Alpaca({
      keyId: ALPACA_KEY,
      secretKey: ALPACA_SECRET,
      paper: false,
    });

    const options = {
      timeframe: mappedTimeframe,
      limit: parseLimit(limit),
      adjustment: 'split',
      feed: 'sip',
      sort: 'asc',
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
      .filter(Boolean);

    return res.status(200).json(payload);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch bars' });
  }
}
