// /api/latest-quote.js — Vercel serverless function
// Fetches latest quote data from Alpaca SIP feed

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbol } = req.query;

  if (!symbol || typeof symbol !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid symbol' });
  }

  const ALPACA_KEY = (process.env.ALPACA_API_KEY || process.env.APCA_API_KEY_ID || '').trim();
  const ALPACA_SECRET = (
    process.env.ALPACA_SECRET_KEY ||
    process.env.ALPACA_API_SECRET ||
    process.env.APCA_API_SECRET_KEY ||
    ''
  ).trim();

  if (!ALPACA_KEY || !ALPACA_SECRET) {
    return res.status(500).json({ error: 'Alpaca API keys not configured' });
  }

  try {
    const upperSymbol = symbol.toUpperCase();
    const url = `https://data.alpaca.markets/v2/stocks/${encodeURIComponent(
      upperSymbol
    )}/quotes/latest?feed=sip`;

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
    const quote = data?.quote || data?.latestQuote || {};
    const toNumber = (value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const bid = toNumber(quote.bp ?? quote.BidPrice);
    const ask = toNumber(quote.ap ?? quote.AskPrice);
    const timestamp = quote.t ?? quote.Timestamp ?? null;

    let price = null;
    if (Number.isFinite(bid) && Number.isFinite(ask)) {
      price = (bid + ask) / 2;
    } else if (Number.isFinite(ask)) {
      price = ask;
    } else if (Number.isFinite(bid)) {
      price = bid;
    }

    return res.status(200).json({
      price,
      bid,
      ask,
      timestamp,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch latest quote' });
  }
}
