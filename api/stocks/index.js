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

    // Determine current market session (ET timezone)
    const now = new Date();
    const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const hours = etTime.getHours();
    const minutes = etTime.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    const dayOfWeek = etTime.getDay();
    
    // Market hours: Pre (4:00-9:30), Regular (9:30-16:00), After (16:00-20:00)
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isPreMarket = !isWeekend && totalMinutes >= 240 && totalMinutes < 570; // 4:00 - 9:30
    const isRegularHours = !isWeekend && totalMinutes >= 570 && totalMinutes < 960; // 9:30 - 16:00
    const isAfterHours = !isWeekend && totalMinutes >= 960 && totalMinutes < 1200; // 16:00 - 20:00

    const bars = Object.entries(snapshots).map(([symbol, snap]) => {
      const latest = snap.latestTrade || {};
      const daily = snap.dailyBar || {};
      const prevDaily = snap.prevDailyBar || {};
      const latestPrice = latest.p || 0;
      const dailyClose = daily.c || 0;
      const prevClose = prevDaily.c || 0;
      
      // Regular session price and change (based on prev close)
      const price = latestPrice || dailyClose || 0;
      const change = prevClose ? price - prevClose : 0;
      const changePercent = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;

      // Extended hours calculations
      let preMarketPrice = null;
      let preMarketChange = null;
      let preMarketChangePercent = null;
      let afterHoursPrice = null;
      let afterHoursChange = null;
      let afterHoursChangePercent = null;

      // During pre-market: show change from previous close
      if (isPreMarket && latestPrice && prevClose) {
        preMarketPrice = latestPrice;
        preMarketChange = latestPrice - prevClose;
        preMarketChangePercent = (preMarketChange / prevClose) * 100;
      }

      // During after-hours or closed: show change from today's close
      if ((isAfterHours || isWeekend || (!isPreMarket && !isRegularHours && !isAfterHours)) && latestPrice && dailyClose && latestPrice !== dailyClose) {
        afterHoursPrice = latestPrice;
        afterHoursChange = latestPrice - dailyClose;
        afterHoursChangePercent = (afterHoursChange / dailyClose) * 100;
      }

      return {
        symbol,
        price,
        open: daily.o || 0,
        high: daily.h || 0,
        low: daily.l || 0,
        close: dailyClose,
        prevClose,
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
        volume: daily.v || 0,
        tradeTimestamp: latest.t || daily.t || null,
        // Extended hours data
        preMarketPrice: preMarketPrice ? Number(preMarketPrice.toFixed(2)) : null,
        preMarketChange: preMarketChange ? Number(preMarketChange.toFixed(2)) : null,
        preMarketChangePercent: preMarketChangePercent ? Number(preMarketChangePercent.toFixed(2)) : null,
        afterHoursPrice: afterHoursPrice ? Number(afterHoursPrice.toFixed(2)) : null,
        afterHoursChange: afterHoursChange ? Number(afterHoursChange.toFixed(2)) : null,
        afterHoursChangePercent: afterHoursChangePercent ? Number(afterHoursChangePercent.toFixed(2)) : null,
        marketSession: isPreMarket ? 'pre' : isRegularHours ? 'regular' : isAfterHours ? 'after' : 'closed',
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
