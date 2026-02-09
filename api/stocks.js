export default async function handler(req, res) {
  const ALPACA_KEY = process.env.ALPACA_API_KEY;
  const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY;

  if (!ALPACA_KEY || !ALPACA_SECRET) {
    return res.status(500).json({ error: 'Missing Alpaca API credentials' });
  }

  const DEFAULT_SYMBOLS = [
    'AAPL','MSFT','GOOGL','AMZN','NVDA','META','TSLA','SPY','QQQ','DIA',
    'AMD','CRM','NFLX','SOFI','PLTR','COIN','HOOD','GME','AMC','BB',
    'RIVN','LCID','NIO','SNAP','ROKU','SQ','PYPL','SHOP','UBER','LYFT',
    'DIS','BA','JPM','GS','V','MA','WMT','COST','HD','LOW',
    'PFE','JNJ','UNH','ABBV','MRK','LLY','BMY','GILD','MRNA','BNTX'
  ];

  const querySymbols = req.query.symbols
    ? req.query.symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
    : DEFAULT_SYMBOLS;

  const symbols = querySymbols.slice(0, 200);

  try {
    const response = await fetch(
      `https://data.alpaca.markets/v2/stocks/snapshots?symbols=${symbols.join(',')}&feed=sip`,
      {
        headers: {
          'APCA-API-KEY-ID': ALPACA_KEY,
          'APCA-API-SECRET-KEY': ALPACA_SECRET,
        },
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error('Alpaca API error:', response.status, errText);
      return res.status(response.status).json({ error: 'Alpaca API error: ' + response.status });
    }

    const snapshots = await response.json();

    const bars = Object.entries(snapshots).map(([symbol, snap]) => {
      const latest = snap.latestTrade || {};
      const daily = snap.dailyBar || {};
      const prevDaily = snap.prevDailyBar || {};
      const price = latest.p || daily.c || 0;
      const prevClose = prevDaily.c || 0;
      const change = prevClose ? price - prevClose : 0;
      const changePercent = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;

      return {
        symbol,
        price,
        open: daily.o || 0,
        high: daily.h || 0,
        low: daily.l || 0,
        close: daily.c || 0,
        prevClose,
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        volume: daily.v || 0,
        tradeTimestamp: latest.t || daily.t || null,
      };
    });

    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=20');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json(bars);
  } catch (err) {
    console.error('Stock proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
}
