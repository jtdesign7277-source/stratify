import { getDefaultLseSymbols, getTwelveDataWebSocketUrl } from '../lib/twelvedata.js';

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
    const requestedSymbols = normalizeSymbols(req.query.symbols);
    const symbols = requestedSymbols.length > 0 ? requestedSymbols : getDefaultLseSymbols();
    const websocketUrl = getTwelveDataWebSocketUrl();

    return res.status(200).json({
      websocketUrl,
      symbols,
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return res.status(status).json({
      error: error?.message || 'Failed to build websocket config',
    });
  }
}
