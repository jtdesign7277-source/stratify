import { fetchLseQuotes, getDefaultLseSymbols } from '../lib/twelvedata.js';

const normalizeSymbols = (raw) => {
  const source = Array.isArray(raw) ? raw : String(raw || '').split(',');
  const seen = new Set();
  return source
    .map((item) => String(item || '').trim().toUpperCase())
    .filter((item) => {
      if (!item || seen.has(item)) return false;
      seen.add(item);
      return true;
    });
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const requested = normalizeSymbols(req.query.symbols);
    const symbols = requested.length > 0 ? requested : getDefaultLseSymbols();
    const data = await fetchLseQuotes(symbols);
    return res.status(200).json({ symbols, data });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return res.status(status).json({
      error: error?.message || 'Failed to fetch LSE quotes',
      details: error?.payload || null,
    });
  }
}
