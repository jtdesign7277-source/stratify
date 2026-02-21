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

  try {
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(
      symbol.toUpperCase()
    )}&apikey=${apiKey}`;

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

    // Map Twelve Data response to Alpaca-like format for compatibility
    return res.status(200).json({
      symbol: data.symbol || symbol.toUpperCase(),
      bid: parseFloat(data.close) || null,  // Twelve Data doesn't provide real-time bid
      ask: parseFloat(data.close) || null,  // Using close as approximation
      last: parseFloat(data.close) || null,
      volume: parseFloat(data.volume) || null,
      high: parseFloat(data.high) || null,
      low: parseFloat(data.low) || null,
      open: parseFloat(data.open) || null,
      change: parseFloat(data.change) || null,
      percent_change: parseFloat(data.percent_change) || null,
      timestamp: data.timestamp || null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
