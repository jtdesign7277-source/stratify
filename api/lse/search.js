import { searchLseSymbols } from '../lib/twelvedata.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const q = String(req.query.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Missing q query parameter' });

  try {
    const data = await searchLseSymbols(q);
    return res.status(200).json({ query: q, data });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return res.status(status).json({
      error: error?.message || 'Failed to search LSE symbols',
      details: error?.payload || null,
    });
  }
}
