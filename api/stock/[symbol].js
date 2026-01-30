export default async function handler(req, res) {
  const { symbol } = req.query;
  
  if (!symbol || symbol.length > 10) {
    return res.status(400).json({ error: 'Invalid symbol' });
  }

  const upperSymbol = symbol.toUpperCase();

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(upperSymbol)}?interval=1d&range=1d`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return res.status(404).json({ error: `Symbol "${upperSymbol}" not found` });
    }

    const data = await response.json();
    const result = data?.chart?.result?.[0];
    const meta = result?.meta;

    if (!meta) {
      return res.status(404).json({ error: `Symbol "${upperSymbol}" not found` });
    }

    const price = meta.regularMarketPrice || 0;
    const previousClose = meta.chartPreviousClose || meta.previousClose || price;
    const change = price - previousClose;
    const changePercent = previousClose ? (change / previousClose) * 100 : 0;

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    
    return res.status(200).json({
      stock: {
        symbol: upperSymbol,
        name: meta.shortName || meta.longName || upperSymbol,
        price: price,
        change: change,
        changePercent: changePercent,
        volume: meta.regularMarketVolume,
        marketCap: meta.marketCap,
      },
    });
  } catch (error) {
    console.error('Stock API error:', error);
    return res.status(500).json({ error: 'Failed to fetch stock data' });
  }
}
