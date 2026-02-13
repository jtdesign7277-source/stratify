// /api/quote.js - Vercel serverless function
// Fetches latest quote snapshot from Alpaca Markets API

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbol } = req.query;

  if (!symbol || symbol.length > 10) {
    return res.status(400).json({ error: 'Invalid symbol' });
  }

  const ALPACA_KEY = (process.env.ALPACA_API_KEY || '').trim();
  const ALPACA_SECRET = (process.env.ALPACA_API_SECRET || '').trim();

  if (!ALPACA_KEY || !ALPACA_SECRET) {
    return res.status(500).json({ error: 'Alpaca API keys not configured' });
  }

  try {
    const url = `https://data.alpaca.markets/v2/stocks/${encodeURIComponent(
      symbol.toUpperCase()
    )}/snapshot`;

    const response = await fetch(url, {
      headers: {
        'APCA-API-KEY-ID': ALPACA_KEY,
        'APCA-API-SECRET-KEY': ALPACA_SECRET,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const detail = await response.text();
      return res.status(response.status).json({
        error: `Alpaca API error: ${response.status}`,
        detail,
      });
    }

    const data = await response.json();
    const latestQuote = data?.latestQuote || {};
    const latestTrade = data?.latestTrade || {};
    const dailyBar = data?.dailyBar || {};

    return res.status(200).json({
      symbol: data?.symbol || symbol.toUpperCase(),
      bid: latestQuote.bp ?? null,
      ask: latestQuote.ap ?? null,
      last: latestTrade.p ?? null,
      volume: dailyBar.v ?? null,
      high: dailyBar.h ?? null,
      low: dailyBar.l ?? null,
      open: dailyBar.o ?? null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
