import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ALPACA_BASE = 'https://paper-api.alpaca.markets';
const ALPACA_DATA = 'https://data.alpaca.markets';

async function getAlpacaAccount(apiKey, secretKey) {
  const res = await fetch(`${ALPACA_BASE}/v2/account`, {
    headers: { 'APCA-API-KEY-ID': apiKey, 'APCA-API-SECRET-KEY': secretKey },
  });
  if (!res.ok) return null;
  return res.json();
}

async function getAlpacaPositions(apiKey, secretKey) {
  const res = await fetch(`${ALPACA_BASE}/v2/positions`, {
    headers: { 'APCA-API-KEY-ID': apiKey, 'APCA-API-SECRET-KEY': secretKey },
  });
  if (!res.ok) return [];
  return res.json();
}

async function getRecentBars(apiKey, secretKey, symbol) {
  const end = new Date().toISOString();
  const start = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const res = await fetch(
    `${ALPACA_DATA}/v2/stocks/${symbol}/bars?timeframe=1Day&start=${start}&end=${end}&limit=5`,
    { headers: { 'APCA-API-KEY-ID': apiKey, 'APCA-API-SECRET-KEY': secretKey } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.bars || [];
}

function buildCopilotPrompt(account, positions, barsMap) {
  const positionSummary = positions.map((p) => {
    const bars = barsMap[p.symbol] || [];
    const barsStr = bars.map((b) => `${b.t}: O${b.o} H${b.h} L${b.l} C${b.c} V${b.v}`).join(' | ');
    return `${p.symbol}: ${p.qty} shares @ $${p.avg_entry_price} → $${p.current_price} (${(parseFloat(p.unrealized_plpc) * 100).toFixed(2)}% P&L, today ${(parseFloat(p.change_today) * 100).toFixed(2)}%) | 5d bars: ${barsStr}`;
  }).join('\n');

  return `You are Sophia, an AI trade copilot. You're monitoring a trader's live positions in real-time.

ACCOUNT:
- Equity: $${account.equity}
- Cash: $${account.cash}
- Buying Power: $${account.buying_power}
- Day P&L: $${(parseFloat(account.equity) - parseFloat(account.last_equity)).toFixed(2)}

LIVE POSITIONS:
${positionSummary || 'No open positions.'}

YOUR JOB: Analyze each position and generate alerts ONLY when something actionable is happening. Be sharp, specific, and urgent when needed.

Check for:
1. **Stop Loss Breaches** — Price dropping through key support levels or moving averages
2. **Profit Target Hits** — Position up significantly, potential take-profit opportunity
3. **Unusual Movement** — Big daily % move (>3% either direction), unusual volume
4. **Trend Breaks** — Price action breaking key patterns from the 5-day bars
5. **Risk Concentration** — Too much capital in one position (>30% of portfolio)
6. **Drawdown Alerts** — Position losing >5% from entry

For each alert, respond with this EXACT format (one per line):
ALERT|severity|symbol|title|message

Severity: 🔴 critical, 🟡 warning, 🟢 opportunity, 🔵 info

Examples:
ALERT|🔴|TSLA|Stop Loss Breach|$TSLA broke below $270 support — down 4.2% today. Consider cutting losses.
ALERT|🟢|NVDA|Profit Target|$NVDA up 8.3% from entry — momentum strong but RSI approaching overbought.
ALERT|🟡|Portfolio|Risk Concentration|62% of portfolio in tech. Single sector pullback could hit hard.

If nothing actionable, respond with exactly: ALL_CLEAR|Portfolio looks healthy. No immediate actions needed.

Be concise. No fluff. Traders need fast decisions.`;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Fetch recent alerts
    const { data, error } = await supabase
      .from('sophia_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || []);
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ALPACA_API_KEY;
  const secretKey = process.env.ALPACA_SECRET_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || !secretKey) return res.status(500).json({ error: 'Missing Alpaca keys' });
  if (!anthropicKey) return res.status(500).json({ error: 'Missing Anthropic key' });

  try {
    // Fetch account + positions
    const [account, positions] = await Promise.all([
      getAlpacaAccount(apiKey, secretKey),
      getAlpacaPositions(apiKey, secretKey),
    ]);

    if (!account) return res.status(502).json({ error: 'Failed to fetch Alpaca account' });

    // Fetch recent bars for each position
    const barsMap = {};
    if (positions.length > 0) {
      const barsPromises = positions.map(async (p) => {
        barsMap[p.symbol] = await getRecentBars(apiKey, secretKey, p.symbol);
      });
      await Promise.all(barsPromises);
    }

    // Ask Sophia to analyze
    const client = new Anthropic({ apiKey: anthropicKey });
    const prompt = buildCopilotPrompt(account, positions, barsMap);

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0]?.text || '';

    // Parse alerts
    const alerts = [];
    const lines = responseText.split('\n').filter((l) => l.trim());

    for (const line of lines) {
      if (line.startsWith('ALL_CLEAR|')) {
        alerts.push({
          severity: '🟢',
          symbol: 'Portfolio',
          title: 'All Clear',
          message: line.split('|')[1]?.trim() || 'No alerts.',
          alert_type: 'all_clear',
        });
        break;
      }

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
        account_equity: parseFloat(account.equity),
        raw_response: responseText,
      }));

      await supabase.from('sophia_alerts').insert(rows);
    }

    return res.status(200).json({
      alerts,
      account: {
        equity: account.equity,
        cash: account.cash,
        buying_power: account.buying_power,
        day_pnl: (parseFloat(account.equity) - parseFloat(account.last_equity)).toFixed(2),
      },
      positions_checked: positions.length,
      raw: responseText,
    });
  } catch (err) {
    console.error('Copilot error:', err);
    return res.status(500).json({ error: err.message });
  }
}
