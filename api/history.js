// api/history.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbol, timeframe = '1Hour', period = '6M' } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: 'symbol is required' });
  }

  const ALPACA_KEY = process.env.ALPACA_API_KEY;
  const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY;

  const now = new Date();
  const periodDays = {
    '1W': 7,
    '1M': 30,
    '3M': 90,
    '6M': 180,
    '1Y': 365,
    '2Y': 730,
    '5Y': 1825,
  };
  const days = periodDays[period] || 180;
  const start = new Date(now);
  start.setDate(start.getDate() - days);

  const tfMap = {
    '1Min': '1Min',
    '5Min': '5Min',
    '15Min': '15Min',
    '30Min': '30Min',
    '1Hour': '1Hour',
    '4Hour': '4Hour',
    '1Day': '1Day',
    '1m': '1Min',
    '5m': '5Min',
    '15m': '15Min',
    '30m': '30Min',
    '1H': '1Hour',
    '4H': '4Hour',
    '1D': '1Day',
  };
  const alpacaTf = tfMap[timeframe] || '1Hour';

  try {
    const baseUrl = `https://data.alpaca.markets/v2/stocks/${symbol.toUpperCase()}/bars`;
    const params = new URLSearchParams({
      timeframe: alpacaTf,
      start: start.toISOString(),
      end: now.toISOString(),
      limit: '10000',
      feed: 'sip',
      sort: 'asc',
    });
    const url = `${baseUrl}?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        'APCA-API-KEY-ID': ALPACA_KEY,
        'APCA-API-SECRET-KEY': ALPACA_SECRET,
      },
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    const bars = (data.bars || []).map((bar) => ({
      date: bar.t,
      timestamp: new Date(bar.t).getTime(),
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
      vwap: bar.vw,
    }));

    let nextToken = data.next_page_token;
    while (nextToken) {
      const nextParams = new URLSearchParams({
        timeframe: alpacaTf,
        start: start.toISOString(),
        end: now.toISOString(),
        limit: '10000',
        feed: 'sip',
        sort: 'asc',
        page_token: nextToken,
      });
      const nextUrl = `${baseUrl}?${nextParams.toString()}`;
      const nextRes = await fetch(nextUrl, {
        headers: {
          'APCA-API-KEY-ID': ALPACA_KEY,
          'APCA-API-SECRET-KEY': ALPACA_SECRET,
        },
      });
      const nextData = await nextRes.json();
      const moreBars = (nextData.bars || []).map((bar) => ({
        date: bar.t,
        timestamp: new Date(bar.t).getTime(),
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v,
        vwap: bar.vw,
      }));
      bars.push(...moreBars);
      nextToken = nextData.next_page_token;
    }

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.status(200).json({
      symbol: symbol.toUpperCase(),
      timeframe: alpacaTf,
      period,
      count: bars.length,
      bars,
    });
  } catch (error) {
    console.error('History fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch historical data' });
  }
}
