// Fetch latest crypto price using Twelve Data API (market data only)
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbol } = req.query;
  if (!symbol) {
    return res.status(400).json({ error: 'symbol query parameter required' });
  }

  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'TWELVE_DATA_API_KEY not configured' });
  }

  try {
    const response = await fetch(
      `https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error('[TwelveData] API error:', response.status, text);
      return res.status(response.status).json({ error: `Twelve Data error: ${text}` });
    }

    const data = await response.json();

    if (data.code && data.code !== 200) {
      console.error('[TwelveData] API returned error:', data);
      return res.status(400).json({ error: data.message || 'Invalid symbol' });
    }

    const price = parseFloat(data.price);
    if (!Number.isFinite(price) || price <= 0) {
      return res.status(404).json({ error: 'Price not found or invalid' });
    }

    return res.status(200).json({
      symbol,
      price,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[TwelveData] Latest price error:', error);
    return res.status(500).json({ error: error.message });
  }
}
