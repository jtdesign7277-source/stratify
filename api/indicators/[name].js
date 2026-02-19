import { fetchIndicator } from '../lib/indicators.js';

const single = (value) => (Array.isArray(value) ? value[0] : value);

const normalizeParams = (query = {}) =>
  Object.entries(query).reduce((acc, [key, value]) => {
    if (key === 'name') return acc;
    const normalizedValue = single(value);
    if (normalizedValue == null || normalizedValue === '') return acc;
    acc[key] = normalizedValue;
    return acc;
  }, {});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const indicatorName = String(single(req.query.name) || '').trim();
  const symbol = String(single(req.query.symbol) || '').trim();
  const interval = String(single(req.query.interval) || '').trim() || undefined;
  const outputsize = single(req.query.outputsize);
  const params = normalizeParams(req.query);

  delete params.symbol;
  delete params.interval;
  delete params.outputsize;

  if (!indicatorName) {
    return res.status(400).json({ error: 'Missing indicator name' });
  }

  if (!symbol) {
    return res.status(400).json({ error: 'Missing symbol' });
  }

  try {
    const data = await fetchIndicator({
      name: indicatorName,
      symbol,
      interval,
      outputsize,
      params,
    });

    return res.status(200).json({ indicator: indicatorName, data });
  } catch (error) {
    return res.status(Number(error?.status) || 500).json({
      error: error?.message || 'Failed to fetch indicator',
      details: error?.payload || null,
    });
  }
}
