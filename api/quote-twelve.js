// /api/quote-twelve.js - Vercel serverless function
// Fetches latest quote snapshot from Twelve Data API

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbol } = req.query;

  if (!symbol || symbol.length > 20) {
    return res.status(400).json({ error: 'Invalid symbol' });
  }

  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'TWELVE_DATA_API_KEY not configured' });
  }

  const toNumber = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  try {
    const params = new URLSearchParams({
      symbol: symbol.toUpperCase(),
      apikey: apiKey,
      extended_hours: '1',
    });
    const url = `https://api.twelvedata.com/quote?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const detail = await response.text();
      return res.status(response.status).json({
        error: `Twelve Data API error: ${response.status}`,
        detail,
      });
    }

    const data = await response.json();

    if (data.code && data.code !== 200) {
      return res.status(400).json({
        error: data.message || 'Invalid symbol',
      });
    }

    const preMarketPrice = toNumber(data.pre_market_price ?? data.premarket_price ?? data.extended_price);
    const preMarketChange = toNumber(data.pre_market_change ?? data.premarket_change ?? data.extended_change);
    const preMarketChangePercent = toNumber(
      data.pre_market_change_percent ?? data.premarket_change_percent ?? data.extended_percent_change
    );
    const postMarketPrice = toNumber(data.post_market_price ?? data.postmarket_price);
    const postMarketChange = toNumber(data.post_market_change ?? data.postmarket_change);
    const postMarketChangePercent = toNumber(
      data.post_market_change_percent ?? data.postmarket_change_percent
    );

    // Map Twelve Data response to Alpaca-like format for compatibility
    return res.status(200).json({
      symbol: data.symbol || symbol.toUpperCase(),
      bid: toNumber(data.close), // Twelve Data doesn't provide real-time bid
      ask: toNumber(data.close), // Using close as approximation
      last: toNumber(data.close),
      volume: toNumber(data.volume),
      high: toNumber(data.high),
      low: toNumber(data.low),
      open: toNumber(data.open),
      change: toNumber(data.change),
      percent_change: toNumber(data.percent_change),
      timestamp: data.timestamp || null,

      // Extended-hours fields (snake_case for API parity)
      pre_market_price: preMarketPrice,
      pre_market_change: preMarketChange,
      pre_market_change_percent: preMarketChangePercent,
      post_market_price: postMarketPrice,
      post_market_change: postMarketChange,
      post_market_change_percent: postMarketChangePercent,

      // Extended-hours fields (camelCase for TraderPage/watchlist consumers)
      preMarketPrice,
      preMarketChange,
      preMarketChangePercent,
      postMarketPrice,
      postMarketChange,
      postMarketChangePercent,

      // Additional compatibility aliases used elsewhere
      after_hours_price: postMarketPrice,
      after_hours_change: postMarketChange,
      after_hours_change_percent: postMarketChangePercent,
      afterHoursPrice: postMarketPrice,
      afterHoursChange: postMarketChange,
      afterHoursChangePercent: postMarketChangePercent,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
