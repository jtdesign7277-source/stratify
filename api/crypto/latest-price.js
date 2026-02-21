// Fetch latest crypto price using shared Alpaca keys (market data only)
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbol } = req.query;
  if (!symbol) {
    return res.status(400).json({ error: 'symbol query parameter required' });
  }

  try {
    const response = await fetch(
      `https://data.alpaca.markets/v1beta3/crypto/us/latest/trades?symbols=${symbol}`,
      {
        headers: {
          'APCA-API-KEY-ID': process.env.ALPACA_API_KEY,
          'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY,
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: `Alpaca error: ${text}` });
    }

    const data = await response.json();
    const trade = data?.trades?.[symbol];

    if (!trade?.p) {
      return res.status(404).json({ error: 'Price not found' });
    }

    return res.status(200).json({
      symbol,
      price: Number(trade.p),
      timestamp: trade.t,
    });
  } catch (error) {
    console.error('Latest price error:', error);
    return res.status(500).json({ error: error.message });
  }
}
