import { fetchWatchlistBatchQuotes } from '../lib/twelvedata.js';

const normalizeSymbols = (input) => {
  const source = Array.isArray(input) ? input : String(input || '').split(',');
  const seen = new Set();
  return source
    .map((item) => String(item || '').trim().toUpperCase().replace(/^\$/, '').split(':')[0])
    .filter((item) => {
      if (!item || seen.has(item)) return false;
      seen.add(item);
      return true;
    });
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const symbolsRaw = req.method === 'POST' ? req.body?.symbols : req.query?.symbols;
    const symbols = normalizeSymbols(symbolsRaw).slice(0, 120);

    if (symbols.length === 0) {
      return res.status(400).json({ error: 'Missing symbols' });
    }

    const data = await fetchWatchlistBatchQuotes(symbols, 120);

    return res.status(200).json({
      symbols,
      requestedCount: symbols.length,
      upstreamCalls: 1,
      data,
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return res.status(status).json({
      error: error?.message || 'Failed to fetch watchlist batch quotes',
      details: error?.payload || null,
    });
  }
}
