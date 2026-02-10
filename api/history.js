// Fetch historical bars from Alpaca for backtesting
export default async function handler(req, res) {
  const ALPACA_KEY = process.env.ALPACA_API_KEY;
  const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY;
  
  if (!ALPACA_KEY || !ALPACA_SECRET) {
    return res.status(500).json({ error: 'Missing Alpaca API credentials' });
  }
  
  const symbol = req.query.symbol;
  const timeframe = req.query.timeframe || '1Day';
  const period = req.query.period || '6M';
  
  if (!symbol) {
    return res.status(400).json({ error: 'Symbol required' });
  }
  
  // Calculate date range based on period
  const periodDays = {
    '1W': 7,
    '1M': 30,
    '3M': 90,
    '6M': 180,
    '1Y': 365,
    '2Y': 730,
  };
  
  const days = periodDays[period] || 180;
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
  
  // Map frontend timeframe to Alpaca format
  const timeframeMap = {
    '5m': '5Min',
    '15m': '15Min',
    '1H': '1Hour',
    '4H': '4Hour',
    '1D': '1Day',
    '1Day': '1Day',
  };
  const alpacaTimeframe = timeframeMap[timeframe] || '1Day';
  
  try {
    const url = `https://data.alpaca.markets/v2/stocks/${encodeURIComponent(symbol)}/bars?timeframe=${alpacaTimeframe}&start=${startDate.toISOString()}&end=${endDate.toISOString()}&limit=10000&feed=sip`;
    
    const response = await fetch(url, {
      headers: {
        'APCA-API-KEY-ID': ALPACA_KEY,
        'APCA-API-SECRET-KEY': ALPACA_SECRET,
      },
    });
    
    if (!response.ok) {
      const errText = await response.text();
      console.error('Alpaca bars error:', response.status, errText);
      return res.status(response.status).json({ error: 'Alpaca API error: ' + response.status });
    }
    
    const data = await response.json();
    const rawBars = data.bars || [];
    
    // Transform to expected format
    const bars = rawBars.map(bar => ({
      date: bar.t,
      timestamp: new Date(bar.t).getTime(),
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
      vwap: bar.vw,
    }));
    
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ 
      symbol: symbol.toUpperCase(),
      timeframe: alpacaTimeframe,
      period,
      bars,
      count: bars.length,
    });
  } catch (err) {
    console.error('Bars fetch error:', err);
    return res.status(500).json({ error: err.message });
  }
}
