// /api/bars.js — Vercel serverless function
// Fetches historical bar data from Alpaca Markets API

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const {
    symbol    = 'AAPL',
    timeframe = '1Day',
    start,
    end,
    limit     = '1000',
  } = req.query;

  const ALPACA_KEY    = process.env.ALPACA_API_KEY    || process.env.APCA_API_KEY_ID;
  const ALPACA_SECRET = process.env.ALPACA_API_SECRET || process.env.APCA_API_SECRET_KEY;

  if (!ALPACA_KEY || !ALPACA_SECRET) {
    return res.status(500).json({ error: 'Alpaca API keys not configured' });
  }

  try {
    const params = new URLSearchParams({
      timeframe,
      limit,
      adjustment: 'split',
      feed: 'sip',
      sort: 'asc',
    });

    if (start) params.append('start', start);
    if (end)   params.append('end', end);

    const url = `https://data.alpaca.markets/v2/stocks/${symbol.toUpperCase()}/bars?${params}`;

    const response = await fetch(url, {
      headers: {
        'APCA-API-KEY-ID':     ALPACA_KEY,
        'APCA-API-SECRET-KEY': ALPACA_SECRET,
        'Accept':              'application/json',
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({
        error: `Alpaca API error: ${response.status}`,
        detail: errText,
      });
    }

    const data = await response.json();

    // Alpaca returns { bars: [...], symbol, next_page_token }
    // Normalize field names for the frontend
    const bars = (data.bars || []).map((b) => ({
      Timestamp:  b.t,
      OpenPrice:  b.o,
      HighPrice:  b.h,
      LowPrice:   b.l,
      ClosePrice: b.c,
      Volume:     b.v,
    }));

    return res.status(200).json({ bars, symbol: data.symbol });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
