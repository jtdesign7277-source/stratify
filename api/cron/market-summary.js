import { postToDiscord } from '../lib/discord.js';

const WATCHLIST = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'];

async function getTwelveDataQuotes(symbols) {
  const res = await fetch(
    `https://api.twelvedata.com/quote?symbol=${symbols.join(',')}&apikey=${process.env.TWELVE_DATA_API_KEY}`
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Twelve Data failed: ${res.status}`);

  // Normalize: single symbol returns object directly, multiple returns keyed object
  if (symbols.length === 1) {
    return { [symbols[0]]: data };
  }
  return data;
}

function formatMover(symbol, quote) {
  if (!quote || quote.code) return null;
  const price = parseFloat(quote.close).toFixed(2);
  const pct = parseFloat(quote.percent_change).toFixed(2);
  const change = parseFloat(quote.change).toFixed(2);
  const arrow = parseFloat(pct) >= 0 ? '🟢' : '🔴';
  const sign = parseFloat(pct) >= 0 ? '+' : '';
  return `${arrow} **$${symbol}** $${price} (${sign}${pct}%)`;
}

export default async function handler(req, res) {
  const authHeader = req.headers['authorization'];
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const quotes = await getTwelveDataQuotes(WATCHLIST);

    const lines = WATCHLIST
      .map(sym => formatMover(sym, quotes[sym]))
      .filter(Boolean);

    if (lines.length === 0) {
      return res.status(200).json({ success: false, reason: 'No quote data available' });
    }

    // Find best and worst performer
    const performers = WATCHLIST
      .filter(sym => quotes[sym] && !quotes[sym].code)
      .map(sym => ({ sym, pct: parseFloat(quotes[sym].percent_change) }))
      .sort((a, b) => b.pct - a.pct);

    const winner = performers[0];
    const loser = performers[performers.length - 1];

    const embed = {
      title: '🔔 Market Close Recap',
      description: "Here's how the day closed:",
      color: 0x10b981,
      fields: [
        {
          name: 'Watchlist',
          value: lines.join('\n') || 'No data available',
        },
        {
          name: '📈 Best Performer',
          value: `$${winner.sym} ${winner.pct >= 0 ? '+' : ''}${winner.pct.toFixed(2)}%`,
          inline: true,
        },
        {
          name: '📉 Worst Performer',
          value: `$${loser.sym} ${loser.pct >= 0 ? '+' : ''}${loser.pct.toFixed(2)}%`,
          inline: true,
        },
      ],
      footer: { text: 'Stratify Market Intel • Powered by Twelve Data • Not financial advice' },
      timestamp: new Date().toISOString(),
    };

    await postToDiscord('marketTalk', { embeds: [embed] });
    return res.status(200).json({ success: true, tickers: lines.length });

  } catch (err) {
    console.error('Market summary error:', err);
    return res.status(500).json({ error: err.message });
  }
}
