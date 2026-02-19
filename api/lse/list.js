import { fetchLseUniverse, searchLseSymbols } from '../lib/twelvedata.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const q = String(req.query.q || '').trim();
  const limit = Math.max(50, Math.min(Number(req.query.limit) || 600, 1200));

  try {
    const data = q ? await searchLseSymbols(q) : await fetchLseUniverse(limit);
    const filtered = q
      ? data.filter((item) =>
          `${item.symbol} ${item.instrumentName}`.toLowerCase().includes(q.toLowerCase())
        )
      : data;

    return res.status(200).json({
      query: q,
      count: filtered.length,
      data: filtered.slice(0, limit),
    });
  } catch (error) {
    return res.status(Number(error?.status) || 500).json({
      error: error?.message || 'Failed to load LSE list',
      details: error?.payload || null,
    });
  }
}
