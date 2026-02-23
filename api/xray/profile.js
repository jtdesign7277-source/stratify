import { fetchTwelveData } from '../lib/twelvedata.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const symbol = String(req.query?.symbol || '').trim().toUpperCase();

  if (!symbol) {
    return res.status(400).json({ error: 'symbol required' });
  }

  try {
    const td = await fetchTwelveData('profile', { symbol });

    if (td?.status === 'error') {
      return res.status(400).json({ error: td.message || 'Twelve Data error' });
    }

    return res.status(200).json({ data: td });
  } catch (error) {
    console.error('[xray] profile error:', error);
    return res.status(error?.status || 500).json({ error: error?.message || 'Unexpected server error' });
  }
}
