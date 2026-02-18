import { postToDiscord } from '../lib/discord.js';

const ALPACA_API_KEY    = process.env.ALPACA_API_KEY;
const ALPACA_API_SECRET = process.env.ALPACA_API_SECRET;
const ALPACA_BASE       = 'https://data.alpaca.markets';

const WATCHLIST = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'];

async function getSnapshots(symbols) {
  const params = new URLSearchParams({ symbols: symbols.join(','), feed: 'sip' });
  const res = await fetch(`${ALPACA_BASE}/v2/stocks/snapshots?${params}`, {
    headers: {
      'APCA-API-KEY-ID': ALPACA_API_KEY,
      'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
    },
  });
  if (!res.ok) throw new Error(`Alpaca snapshot failed: ${res.status}`);
  return res.json();
}

function formatMover(symbol, snapshot) {
  const bar = snapshot.dailyBar || snapshot.latestTrade || {};
  const prev = snapshot.prevDailyBar || {};
  const price = bar.c || bar.p || 0;
  const prevClose = prev.c || price;
  const change = price - prevClose;
  const changePct = prevClose ? ((change / prevClose) * 100).toFixed(2) : '0.00';
  const arrow = change >= 0 ? '🟢' : '🔴';
  const sign = change >= 0 ? '+' : '';
  return `${arrow} **$${symbol}** $${price.toFixed(2)} (${sign}${changePct}%)`;
}

export default async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const period = req.query.period || 'close';

  try {
    const snapshots = await getSnapshots(WATCHLIST);
    const lines = WATCHLIST
      .filter(sym => snapshots[sym])
      .map(sym => formatMover(sym, snapshots[sym]));

    const isPremarket = period === 'premarket';

    const embed = {
      title: isPremarket ? '🌅 Pre-Market Snapshot' : '🔔 Market Close Recap',
      description: isPremarket
        ? "Here's where the Mag 7 + indices stand before the bell:"
        : "Here's how the day closed:",
      color: 0x3B82F6,
      fields: [{ name: 'Watchlist', value: lines.join('\n') || 'No data available' }],
      footer: { text: 'Stratify Market Intel • Not financial advice' },
      timestamp: new Date().toISOString(),
    };

    await postToDiscord('marketTalk', { embeds: [embed] });
    return res.status(200).json({ success: true, period, tickers: WATCHLIST.length });
  } catch (err) {
    console.error('Market summary error:', err);
    return res.status(500).json({ error: err.message });
  }
}
