import { fetchLseTimeSeries } from '../lib/twelvedata.js';

const INTERVAL_ALIASES = {
  '1m': '1min',
  '5m': '5min',
  '15m': '15min',
  '30m': '30min',
  '1d': '1day',
  '1w': '1week',
  '1mo': '1month',
};

const normalizeInterval = (value) => {
  const raw = String(value || '1day').trim().toLowerCase();
  return INTERVAL_ALIASES[raw] || raw;
};

const supportsPrepost = (interval) => {
  const match = String(interval || '').match(/^(\d+)min$/);
  if (!match) return false;
  const minutes = Number(match[1]);
  return Number.isFinite(minutes) && minutes > 0 && minutes <= 30;
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const symbol = String(req.query.symbol || '').trim();
  const interval = normalizeInterval(req.query.interval || '1day');
  const outputsize = Math.max(1, Math.min(Number(req.query.outputsize || 500), 5000));
  const prepost = supportsPrepost(interval);

  if (!symbol) return res.status(400).json({ error: 'Missing symbol' });

  try {
    const data = await fetchLseTimeSeries(symbol, interval, outputsize, prepost);
    return res.status(200).json(data);
  } catch (error) {
    const status = Number(error?.status) || 500;
    return res.status(status).json({ error: error?.message || 'Failed to fetch candles' });
  }
}
