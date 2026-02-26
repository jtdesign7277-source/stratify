import { createClient } from '@supabase/supabase-js';
import { generateTTS } from './lib/tts.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALPACA_DATA = 'https://data.alpaca.markets';
const ALPACA_KEY = process.env.ALPACA_API_KEY;
const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY;

const CORE_TICKERS = ['SPY', 'QQQ', 'DIA', 'IWM', 'AAPL', 'TSLA', 'NVDA', 'MSFT', 'AMZN', 'META', 'AMD', 'GOOGL', 'TLT', 'GLD', 'VIX'];

async function getSnapshots() {
  if (!ALPACA_KEY) return {};
  try {
    const symbols = CORE_TICKERS.filter((s) => s !== 'VIX');
    const res = await fetch(`${ALPACA_DATA}/v2/stocks/snapshots?symbols=${symbols.join(',')}`, {
      headers: { 'APCA-API-KEY-ID': ALPACA_KEY, 'APCA-API-SECRET-KEY': ALPACA_SECRET },
    });
    if (!res.ok) return {};
    const data = await res.json();
    const results = {};
    for (const [sym, snap] of Object.entries(data)) {
      const price = snap.latestTrade?.p || snap.minuteBar?.c || 0;
      const prevClose = snap.prevDailyBar?.c || 0;
      const change = prevClose ? ((price - prevClose) / prevClose * 100) : 0;
      results[sym] = { price: price.toFixed(2), change: change.toFixed(2) };
    }
    return results;
  } catch { return {}; }
}

async function getLatestIntel() {
  const { data } = await supabase
    .from('market_intel_reports')
    .select('headline')
    .order('created_at', { ascending: false })
    .limit(1);
  return data?.[0]?.headline || '';
}

const MORNING_PROMPT = `You are Sophia, the AI trading strategist at Stratify. It's 9:20 AM ET — markets open in 10 minutes.

Write a morning briefing for users. This appears as a notification when they open the app.

RULES:
- Keep it under 200 words. Tight, punchy, useful.
- Start with a greeting and the vibe (calm day? volatile? big news?)
- Include 2-3 key pre-market numbers from the data below
- Mention any notable movers (>1% pre-market)
- If there's relevant news from the intel headline, tie it in
- End with something engaging — a question, a tip, or a "watch for X today"
- Sound like a sharp trader friend texting you, not a Bloomberg terminal
- Use 1-2 emojis max. Don't overdo it.

PRE-MARKET DATA:
{MARKET_DATA}

LATEST MARKET INTEL:
{INTEL}

Write the briefing now. No preamble. Just the message.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const xaiKey = String(process.env.XAI_API_KEY || '').trim();
  if (!xaiKey) return res.status(500).json({ error: 'XAI_API_KEY is missing. Please add it in environment variables.' });

  try {
    const [snapshots, intel] = await Promise.all([getSnapshots(), getLatestIntel()]);

    const marketData = Object.entries(snapshots)
      .map(([sym, s]) => `${sym}: $${s.price} (${s.change > 0 ? '+' : ''}${s.change}%)`)
      .join('\n') || 'Pre-market data loading...';

    const prompt = MORNING_PROMPT
      .replace('{MARKET_DATA}', marketData)
      .replace('{INTEL}', intel || 'No recent intel.');

    const aiRes = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${xaiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-3-mini-fast',
        max_tokens: 512,
        temperature: 0.8,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      return res.status(502).json({ error: `xAI error: ${aiRes.status}` });
    }

    const data = await aiRes.json();
    const briefing = String(data?.choices?.[0]?.message?.content || '').trim();

    // Pre-generate voice audio
    const audioUrl = await generateTTS(briefing);

    // Save as a special morning briefing alert
    await supabase.from('sophia_alerts').insert({
      severity: '☀️',
      symbol: 'Market',
      title: 'Morning Briefing',
      message: briefing,
      alert_type: 'morning',
      audio_url: audioUrl,
      raw_response: briefing,
    });

    return res.status(200).json({ briefing, audio_url: audioUrl });
  } catch (err) {
    console.error('Morning briefing error:', err);
    return res.status(500).json({ error: err.message });
  }
}
