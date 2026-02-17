import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALPACA_DATA = 'https://data.alpaca.markets';
const ALPACA_KEY = process.env.ALPACA_API_KEY;
const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY;

const SCAN_TICKERS = ['SPY', 'QQQ', 'DIA', 'IWM', 'AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'META', 'GOOGL', 'AMD', 'NFLX', 'JPM', 'GS', 'XLF', 'TLT', 'GLD', 'USO'];

async function getSnapshots() {
  if (!ALPACA_KEY) return {};
  try {
    const res = await fetch(`${ALPACA_DATA}/v2/stocks/snapshots?symbols=${SCAN_TICKERS.join(',')}`, {
      headers: { 'APCA-API-KEY-ID': ALPACA_KEY, 'APCA-API-SECRET-KEY': ALPACA_SECRET },
    });
    if (!res.ok) return {};
    const data = await res.json();
    const results = {};
    for (const [sym, snap] of Object.entries(data)) {
      const price = snap.latestTrade?.p || snap.minuteBar?.c || 0;
      const prevClose = snap.prevDailyBar?.c || 0;
      const change = prevClose ? ((price - prevClose) / prevClose * 100) : 0;
      const volume = snap.dailyBar?.v || 0;
      const prevVolume = snap.prevDailyBar?.v || 1;
      results[sym] = {
        price: price.toFixed(2),
        change: change.toFixed(2),
        volume,
        volumeRatio: (volume / prevVolume).toFixed(1),
      };
    }
    return results;
  } catch { return {}; }
}

async function getLatestIntel() {
  const { data } = await supabase
    .from('market_intel_reports')
    .select('headline, report_content')
    .order('created_at', { ascending: false })
    .limit(1);
  
  const content = data?.[0]?.report_content || '';
  // Take first 600 chars of intel for context
  return content.slice(0, 600);
}

async function getRecentInsights() {
  const { data } = await supabase
    .from('sophia_alerts')
    .select('message, created_at')
    .eq('alert_type', 'insight')
    .order('created_at', { ascending: false })
    .limit(5);
  return data || [];
}

const INSIGHT_PROMPT = `You are Sophia, the AI trading strategist at Stratify. You're deciding whether to send a proactive insight to users right now.

RULES — READ CAREFULLY:
1. You are NOT obligated to send anything. MOST of the time, you should NOT.
2. Only speak when something is GENUINELY notable — the kind of thing a senior trader would tap a junior on the shoulder about.
3. If markets are calm and nothing unusual is happening, respond with exactly: PASS
4. If you DO have something worth saying, respond with exactly: INSIGHT|title|message
5. Title: 5-8 words max. Punchy.
6. Message: 2-3 sentences max. Specific numbers. No generic advice.

WHAT'S WORTH AN INSIGHT:
- A major index moving >1.5% intraday
- VIX/TLT/GLD diverging from equities (bonds dumping while stocks rip, or vice versa)
- A mega-cap stock moving >3% on unusual volume (>2x average)
- Sector rotation signals (financials up, tech down, etc.)
- Breaking correlation — things moving together that shouldn't be, or apart that usually track
- Pre-earnings positioning for a major name this week
- A pattern you see forming across multiple tickers

WHAT'S NOT WORTH AN INSIGHT:
- Markets up or down <1% on normal volume
- "NVDA is up 0.5% today" — nobody cares
- Generic advice like "stay diversified" or "watch for support levels"
- Anything you've said in the last 24 hours (see recent insights below)

MARKET DATA:
{MARKET_DATA}

LATEST MARKET INTEL:
{INTEL}

YOUR RECENT INSIGHTS (don't repeat these):
{RECENT}

Now decide: PASS or INSIGHT|title|message`;

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Return recent insights for display
    const { data, error } = await supabase
      .from('sophia_alerts')
      .select('*')
      .eq('alert_type', 'insight')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || []);
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) return res.status(500).json({ error: 'Missing ANTHROPIC_API_KEY' });

  try {
    const [snapshots, intel, recentInsights] = await Promise.all([
      getSnapshots(),
      getLatestIntel(),
      getRecentInsights(),
    ]);

    // Build market data string
    const marketData = Object.entries(snapshots)
      .map(([sym, s]) => `${sym}: $${s.price} (${s.change > 0 ? '+' : ''}${s.change}%) vol:${s.volumeRatio}x`)
      .join('\n') || 'Market data unavailable (markets may be closed).';

    const recentStr = recentInsights.length > 0
      ? recentInsights.map((i) => `- ${i.message} (${new Date(i.created_at).toLocaleDateString()})`).join('\n')
      : 'None recently.';

    const prompt = INSIGHT_PROMPT
      .replace('{MARKET_DATA}', marketData)
      .replace('{INTEL}', intel || 'No recent intel.')
      .replace('{RECENT}', recentStr);

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!anthropicRes.ok) {
      return res.status(502).json({ error: `Anthropic error: ${anthropicRes.status}` });
    }

    const data = await anthropicRes.json();
    const responseText = (data.content?.[0]?.text || '').trim();

    // Check if Sophia decided to pass
    if (responseText === 'PASS' || responseText.startsWith('PASS')) {
      return res.status(200).json({ action: 'pass', message: 'Nothing notable right now.' });
    }

    // Parse insight
    if (responseText.startsWith('INSIGHT|')) {
      const parts = responseText.split('|');
      const title = parts[1]?.trim() || 'Market Update';
      const message = parts[2]?.trim() || responseText;

      // Save to sophia_alerts as an insight
      const { error: insertErr } = await supabase.from('sophia_alerts').insert({
        severity: '💡',
        symbol: 'Market',
        title,
        message,
        alert_type: 'insight',
        raw_response: responseText,
      });

      if (insertErr) console.error('Insert error:', insertErr);

      return res.status(200).json({ action: 'insight', title, message });
    }

    // Fallback — unexpected format
    return res.status(200).json({ action: 'pass', message: 'Sophia had nothing notable.', raw: responseText });
  } catch (err) {
    console.error('Insight error:', err);
    return res.status(500).json({ error: err.message });
  }
}
