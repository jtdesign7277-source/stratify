import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALPACA_DATA = 'https://data.alpaca.markets';
const ALPACA_KEY = process.env.ALPACA_API_KEY;
const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY;

// Default watchlist tickers if user has none
const DEFAULT_TICKERS = ['SPY', 'QQQ', 'AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'META', 'BTC/USD'];

async function getMarketSnapshots(symbols) {
  // Filter out crypto for stock endpoint
  const stocks = symbols.filter((s) => !s.includes('/'));
  const crypto = symbols.filter((s) => s.includes('/'));
  const results = {};

  if (stocks.length > 0 && ALPACA_KEY) {
    try {
      const url = `${ALPACA_DATA}/v2/stocks/snapshots?symbols=${stocks.join(',')}`;
      const res = await fetch(url, {
        headers: { 'APCA-API-KEY-ID': ALPACA_KEY, 'APCA-API-SECRET-KEY': ALPACA_SECRET },
      });
      if (res.ok) {
        const data = await res.json();
        for (const [sym, snap] of Object.entries(data)) {
          const price = snap.latestTrade?.p || snap.minuteBar?.c || 0;
          const prevClose = snap.prevDailyBar?.c || 0;
          const change = prevClose ? ((price - prevClose) / prevClose * 100).toFixed(2) : '0.00';
          const volume = snap.dailyBar?.v || 0;
          const prevVolume = snap.prevDailyBar?.v || 1;
          results[sym] = {
            price: price.toFixed(2),
            change: `${change}%`,
            volume,
            volumeRatio: (volume / prevVolume).toFixed(1),
            high: snap.dailyBar?.h || 0,
            low: snap.dailyBar?.l || 0,
          };
        }
      }
    } catch {}
  }

  if (crypto.length > 0 && ALPACA_KEY) {
    for (const sym of crypto) {
      try {
        const encoded = encodeURIComponent(sym);
        const res = await fetch(`${ALPACA_DATA}/v1beta3/crypto/us/latest/trades?symbols=${encoded}`, {
          headers: { 'APCA-API-KEY-ID': ALPACA_KEY, 'APCA-API-SECRET-KEY': ALPACA_SECRET },
        });
        if (res.ok) {
          const data = await res.json();
          const trade = data.trades?.[sym];
          if (trade) results[sym] = { price: trade.p?.toFixed(2) || '0', change: 'N/A', volume: 0, volumeRatio: '0', high: 0, low: 0 };
        }
      } catch {}
    }
  }

  return results;
}

async function getLatestIntel() {
  const { data } = await supabase
    .from('market_intel_reports')
    .select('headline, report_content')
    .order('created_at', { ascending: false })
    .limit(1);
  return data?.[0]?.headline || '';
}

function buildCopilotPrompt(tickers, snapshots, intelHeadline) {
  const tickerData = tickers.map((t) => {
    const s = snapshots[t];
    if (!s) return `${t}: no data`;
    return `${t}: $${s.price} (${s.change}) | Vol ratio: ${s.volumeRatio}x | Range: $${s.low}-$${s.high}`;
  }).join('\n');

  return `You are Sophia, an AI trade copilot for Stratify. You monitor a user's watchlist and market conditions. Be sharp, specific, actionable.

WATCHLIST TICKERS (with live market data):
${tickerData}

LATEST MARKET INTEL HEADLINE:
${intelHeadline || 'No recent intel.'}

YOUR JOB: Scan the watchlist and generate 2-5 alerts about what matters RIGHT NOW. Focus on:
1. **Big Movers** — Any ticker up or down >2%? Why might that be?
2. **Unusual Volume** — Volume ratio >1.5x is notable, >2x is significant
3. **Technical Levels** — Price near round numbers, daily highs/lows
4. **Market Context** — How does the intel headline affect these tickers?
5. **Opportunities** — Any setups forming? Oversold bounces? Breakouts?

For each alert, respond with this EXACT format (one per line):
ALERT|severity|symbol|title|message

Severity: 🔴 critical, 🟡 warning, 🟢 opportunity, 🔵 info

Keep messages under 120 chars. Be concise. No fluff.
If market is closed and nothing notable, give 1-2 info alerts about positioning for next session.`;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('sophia_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || []);
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return res.status(500).json({ error: 'Missing ANTHROPIC_API_KEY' });
  if (!ALPACA_KEY) return res.status(500).json({ error: 'Missing ALPACA_API_KEY for market data' });

  try {
    // Use default tickers (later: pull from user's watchlist via Supabase)
    const tickers = DEFAULT_TICKERS;

    const [snapshots, intelHeadline] = await Promise.all([
      getMarketSnapshots(tickers),
      getLatestIntel(),
    ]);

    const prompt = buildCopilotPrompt(tickers, snapshots, intelHeadline);

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return res.status(502).json({ error: `Anthropic error: ${anthropicRes.status}` });
    }

    const anthropicData = await anthropicRes.json();
    const responseText = anthropicData.content?.[0]?.text || '';

    // Parse alerts
    const alerts = [];
    const lines = responseText.split('\n').filter((l) => l.trim());

    for (const line of lines) {
      if (line.startsWith('ALERT|')) {
        const parts = line.split('|');
        if (parts.length >= 5) {
          alerts.push({
            severity: parts[1]?.trim(),
            symbol: parts[2]?.trim(),
            title: parts[3]?.trim(),
            message: parts[4]?.trim(),
            alert_type: parts[1]?.includes('🔴') ? 'critical' : parts[1]?.includes('🟡') ? 'warning' : parts[1]?.includes('🟢') ? 'opportunity' : 'info',
          });
        }
      }
    }

    // Save to Supabase
    if (alerts.length > 0) {
      const rows = alerts.map((a) => ({
        severity: a.severity,
        symbol: a.symbol,
        title: a.title,
        message: a.message,
        alert_type: a.alert_type,
        raw_response: responseText,
      }));

      await supabase.from('sophia_alerts').insert(rows);
    }

    return res.status(200).json({
      alerts,
      tickers_scanned: tickers.length,
      snapshots_found: Object.keys(snapshots).length,
    });
  } catch (err) {
    console.error('Copilot error:', err);
    return res.status(500).json({ error: err.message });
  }
}
