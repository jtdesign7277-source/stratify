import { fetchTwelveData } from '../lib/twelvedata.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=300');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  const sym = String(symbol).trim().toUpperCase();

  try {
    const profile = await fetchTwelveData('profile', { symbol: sym });
    return res.status(200).json({ data: profile });
  } catch (error) {
    const status = Number(error?.status) || 500;
    console.error('[xray/profile] error:', error);
    return res.status(status).json({ error: error?.message || 'Failed to fetch profile' });
  }
}
