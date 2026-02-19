import { fetchIndicatorsBatch } from '../lib/indicators.js';

const single = (value) => (Array.isArray(value) ? value[0] : value);

const normalizeIndicatorInput = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').map((item) => item.trim());
  return [];
};

const resolveRequestPayload = (req) => {
  if (req.method === 'POST' && req.body && typeof req.body === 'object') {
    return req.body;
  }

  return {
    symbol: single(req.query.symbol),
    interval: single(req.query.interval),
    outputsize: single(req.query.outputsize),
    indicators: normalizeIndicatorInput(single(req.query.indicators)),
  };
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const payload = resolveRequestPayload(req);
  const symbol = String(payload?.symbol || '').trim();
  const interval = String(payload?.interval || '').trim() || undefined;
  const outputsize = payload?.outputsize;
  const indicators = normalizeIndicatorInput(payload?.indicators);
  const paramsByIndicator = payload?.paramsByIndicator && typeof payload.paramsByIndicator === 'object'
    ? payload.paramsByIndicator
    : {};

  if (!symbol) {
    return res.status(400).json({ error: 'Missing symbol' });
  }

  if (!Array.isArray(indicators) || indicators.length === 0) {
    return res.status(400).json({ error: 'Missing indicators array' });
  }

  try {
    const data = await fetchIndicatorsBatch({
      symbol,
      indicators,
      interval,
      outputsize,
      paramsByIndicator,
    });

    return res.status(200).json(data);
  } catch (error) {
    return res.status(Number(error?.status) || 500).json({
      error: error?.message || 'Failed to fetch indicators batch',
      details: error?.payload || null,
    });
  }
}
