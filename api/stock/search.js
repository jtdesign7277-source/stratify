export default async function handler(req, res) {
  const { q } = req.query;
  
  if (!q || q.length < 1) {
    return res.status(400).json({ error: 'Query required' });
  }

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0&enableFuzzyQuery=false`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Yahoo Finance search failed');
    }

    const data = await response.json();
    
    // Filter to only stocks and ETFs
    const results = (data.quotes || [])
      .filter(q => q.quoteType === 'EQUITY' || q.quoteType === 'ETF')
      .slice(0, 6)
      .map(q => ({
        symbol: q.symbol,
        name: q.shortname || q.longname,
        exchange: q.exchDisp || q.exchange,
        type: q.quoteType,
      }));

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    return res.status(200).json({ results });
  } catch (error) {
    console.error('Stock search error:', error);
    return res.status(500).json({ error: 'Search failed' });
  }
}
