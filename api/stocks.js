// Vercel Serverless — Alpaca Stock Snapshots
// Replaces Railway dependency for stock price data

const ALPACA_KEY = process.env.ALPACA_API_KEY;
const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY;
const ALPACA_DATA_URL = 'https://data.alpaca.markets/v2';

const DEFAULT_SYMBOLS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA',
  'SPY', 'QQQ', 'DIA'
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (!ALPACA_KEY || !ALPACA_SECRET) {
      return res.status(500).json({ error: 'Alpaca API keys not configured in Vercel env vars' });
    }

    const symbols = req.query.symbols
      ? req.query.symbols.split(',').map(s => s.trim().toUpperCase())
      : DEFAULT_SYMBOLS;

    const response = await fetch(
      `${ALPACA_DATA_URL}/stocks/snapshots?symbols=${symbols.join(',')}&feed=iexfeed=sip`,
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
      return res.status(response.status).json({ error: `Alpaca error: ${response.status}`, detail: errText });
    }

    const snapshots = await response.json();

    const bars = symbols.map(symbol => {
      const snap = snapshots[symbol];
      if (!snap) return { symbol, price: 0, change: 0, changePercent: 0, volume: 0 };

      const latestTrade = snap.latestTrade || {};
      const dailyBar = snap.dailyBar || {};
      const prevDailyBar = snap.prevDailyBar || {};

      const currentPrice = latestTrade.p || dailyBar.c || 0;
      const prevClose = prevDailyBar.c || dailyBar.o || currentPrice;
      const change = currentPrice - prevClose;
      const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;

      return {
        symbol,
        price: currentPrice,
        open: dailyBar.o || 0,
        high: dailyBar.h || 0,
        low: dailyBar.l || 0,
        close: dailyBar.c || 0,
        prevClose,
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        volume: dailyBar.v || 0,
        tradeTimestamp: latestTrade.t || null,
      };
    });

    res.setHeader('Cache-Control', 's-maxage=15, stale-while-revalidate=30');
    return res.status(200).json(bars);
  } catch (err) {
    console.error('Stock proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
}
