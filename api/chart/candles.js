import { fetchLseTimeSeries } from '../lib/twelvedata.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const symbol = String(req.query.symbol || '').trim();
  const interval = String(req.query.interval || '1day').trim();
  const outputsize = Math.min(Number(req.query.outputsize || 500), 5000);

  if (!symbol) return res.status(400).json({ error: 'Missing symbol' });

  try {
    const data = await fetchLseTimeSeries(symbol, interval, outputsize);
    return res.status(200).json(data);
  } catch (error) {
    const status = Number(error?.status) || 500;
    return res.status(status).json({ error: error?.message || 'Failed to fetch candles' });
  }
}
