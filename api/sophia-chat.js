import { createClient } from '@supabase/supabase-js';

const BACKEND_URL = 'https://stratify-backend-production-3ebd.up.railway.app';

const SYSTEM_PROMPT = `You are Sophia, Stratify's AI trading strategist. Sharp, direct, data-driven. You remember past conversations and build on them.

CRITICAL RULES:
- You have REAL Alpaca market data injected below. USE IT. Never say "I can't access data."
- When asked about a stock, reference the ACTUAL numbers from the data provided.
- For backtests: analyze the real historical OHLCV bars provided. Find actual setups that occurred — dates, prices, entries, exits, P&L.
- Give specific numbers: prices, percentages, levels, volumes, dates.
- Calculate actual returns: "If you bought at $X on [date] and sold at $Y on [date], that's Z% return."
- Be concise but thorough. No generic advice — use the ACTUAL data.
- You're talking to a trader who pays for premium Alpaca data. Deliver premium analysis.
- Format with **bold**, bullet points, and clear sections.
- Always prefix stock tickers with $ sign in your responses. Write $TSLA not TSLA, $AAPL not AAPL.

CODE RULE:
- Do NOT include Python code blocks in your responses. Skip the code section completely. Users want the strategy analysis, key trade setups, and backtest results only — not code.

BACKTEST LOOKBACK LIMIT:
- Maximum backtest lookback is 6 months. If the user requests longer (1 year, 2 years, etc.), cap it at 6 months and briefly mention: "Capped at 6M lookback for optimal performance."

BACKTEST NAMING & VALUATION (CRITICAL):
- At the VERY END of every backtest/strategy response, include a bold summary box like:

---
## 🏷️ Strategy Name: $TSLA Break & Retest Long Setup (15min Chart)
## 💰 Backtest Value: $4,230 profit on $10,000 starting capital (42.3% return)
---

- Give each backtest a catchy, specific trade name (include ticker, pattern, timeframe, direction)
- Calculate the REAL DOLLAR P&L assuming $10,000 starting capital
- Include: entry price, exit price, shares bought, gross profit, % return
- Use emojis in your response: 🏆 for winners, 📉 for losers, 🎯 for targets, ⚡ for key signals, 💰 for P&L, 📊 for stats, 🔥 for best setups, ❌ for avoid signals
- Use color-friendly formatting: lines with gains should mention "profit" or "+", losses should mention "loss" or "-"

KEY TRADE SETUPS (CRITICAL — INCLUDE IN EVERY STRATEGY/BACKTEST):
You MUST end every single strategy response with a section titled '🔥 Key Trade Setups' containing exactly these 5 fields on separate lines, each starting with ● bullet: Entry Signal, Volume, Trend, Risk/Reward, Stop Loss. Never skip this section.

REAL TRADE ANALYSIS SECTION (CRITICAL — INCLUDE BEFORE KEY TRADE SETUPS):
You MUST include this section directly before the final '🔥 Key Trade Setups' section. Use real values from the analysis (no placeholders):

## ⚡ Real Trade Analysis (1M Lookbook)

**Key [StrategyType] Setups Identified:**

**🏆 Winner - [Date] [Setup Name]:**
- **Entry:** $[price] at [time] ([reason])
- **Exit:** $[price] ([result])
- **Shares:** [count] shares ($25,000 ÷ $[entry price])
- **Profit:** +$[amount] ✅

Use actual dates, setup names, prices, share counts, and profit values from the provided market data.

At the VERY END of your response, ALWAYS include this exact section and formatting with real values extracted from your analysis:

🔥 Key Trade Setups
● Entry Signal: [exact entry condition, e.g. "RSI crosses above 30 with volume confirmation"]
● Volume: [volume requirement, e.g. "Above 20-day average (>2.5M shares)"]
● Trend: [trend alignment, e.g. "Bullish — price above 50-day SMA at $142.30"]
● Risk/Reward: [ratio, e.g. "3.2:1 ($4.50 risk / $14.40 reward)"]
● Stop Loss: [exact stop, e.g. "$138.50 (-2.8% from entry)"]

These 5 values are parsed by the UI and displayed in an editable "Key Trade Setups" section. Make each value specific with real numbers from the data.`;

function extractTickers(text) {
  const tickers = new Set();
  for (const m of text.matchAll(/\$([A-Z]{1,5})\b/g)) tickers.add(m[1]);
  for (const m of text.matchAll(/\b(TSLA|AAPL|NVDA|AMD|MSFT|META|GOOGL|AMZN|SPY|QQQ|BTC|ETH|DOGE|XRP|SOL|NFLX|COIN|PLTR|SOFI|RIVN|LCID|NIO|BABA|BA|DIS|JPM|GS|V|MA)\b/gi)) {
    tickers.add(m[1].toUpperCase());
  }
  const nameMap = { tesla: 'TSLA', apple: 'AAPL', nvidia: 'NVDA', amazon: 'AMZN', google: 'GOOGL', microsoft: 'MSFT', meta: 'META', bitcoin: 'BTC', ethereum: 'ETH' };
  for (const [name, ticker] of Object.entries(nameMap)) {
    if (text.toLowerCase().includes(name)) tickers.add(ticker);
  }
  return [...tickers];
}

function detectPeriod(text) {
  const lower = text.toLowerCase();
  if (lower.includes('1 month') || lower.includes('one month') || lower.includes('last month')) return '1mo';
  if (/(?:2|two)\s*month/i.test(lower)) return '2mo';
  if (/(?:6|six)\s*month|half\s*year/i.test(lower)) return '6mo';
  if (/(?:1|one|last)\s*year|12\s*month|twelve\s*month/i.test(lower)) return '1y';
  return '3mo';
}

async function fetchSnapshot(symbol) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/stocks/${encodeURIComponent(symbol)}`);
    if (!res.ok) return `${symbol}: snapshot unavailable`;
    const d = await res.json();
    return `${symbol} CURRENT: Price $${d.price || d.askPrice || 0}, Open $${d.open || 0}, High $${d.high || 0}, Low $${d.low || 0}, Volume ${d.volume || 0}, PrevClose $${d.prevClose || 0}, Change ${(d.changePercent || d.change || 0)}%`;
  } catch { return `${symbol}: snapshot unavailable`; }
}

async function fetchHistory(symbol, period) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/stocks/${encodeURIComponent(symbol)}/history?period=${period}`);
    if (!res.ok) return '';
    const data = await res.json();
    const bars = data.bars || [];
    if (bars.length === 0) return '';

    const closes = bars.map(b => b.close);
    const highs = bars.map(b => b.high);
    const lows = bars.map(b => b.low);
    const volumes = bars.map(b => b.volume);
    const periodHigh = Math.max(...highs);
    const periodLow = Math.min(...lows);
    const avgVolume = Math.round(volumes.reduce((a, b) => a + b, 0) / volumes.length);
    const startPrice = closes[0];
    const endPrice = closes[closes.length - 1];
    const periodReturn = ((endPrice - startPrice) / startPrice * 100).toFixed(2);

    const dailyMoves = bars.slice(1).map((b, i) => ({
      date: b.date, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume,
      prevClose: bars[i].close,
      change: ((b.close - bars[i].close) / bars[i].close * 100),
      intraday: ((b.high - b.low) / b.low * 100),
    }));

    const topGainers = [...dailyMoves].sort((a, b) => b.change - a.change).slice(0, 5);
    const topLosers = [...dailyMoves].sort((a, b) => a.change - b.change).slice(0, 5);

    let result = `\n${symbol} HISTORICAL (${period}, ${bars.length} trading days):\n`;
    result += `Period: ${bars[0].date} to ${bars[bars.length - 1].date}\n`;
    result += `Period Return: ${periodReturn}% ($${startPrice.toFixed(2)} → $${endPrice.toFixed(2)})\n`;
    result += `Period High: $${periodHigh.toFixed(2)} | Period Low: $${periodLow.toFixed(2)} | Avg Volume: ${avgVolume.toLocaleString()}\n`;

    result += `\nTOP 5 BEST DAYS:\n`;
    for (const d of topGainers) result += `  ${d.date}: +${d.change.toFixed(2)}% (O:$${d.open.toFixed(2)} H:$${d.high.toFixed(2)} L:$${d.low.toFixed(2)} C:$${d.close.toFixed(2)} Vol:${d.volume.toLocaleString()})\n`;

    result += `\nTOP 5 WORST DAYS:\n`;
    for (const d of topLosers) result += `  ${d.date}: ${d.change.toFixed(2)}% (O:$${d.open.toFixed(2)} H:$${d.high.toFixed(2)} L:$${d.low.toFixed(2)} C:$${d.close.toFixed(2)} Vol:${d.volume.toLocaleString()})\n`;

    result += `\nFULL DAILY BARS (date,open,high,low,close,volume):\n`;
    for (const b of bars) result += `${b.date},${b.open},${b.high},${b.low},${b.close},${b.volume}\n`;

    return result;
  } catch { return ''; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Missing ANTHROPIC_API_KEY' });

  const { messages: incomingMessages, userId } = req.body;
  if (!Array.isArray(incomingMessages)) return res.status(400).json({ error: 'messages must be an array' });

  // Load conversation history from Supabase
  let conversationContext = [];
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let supabase = null;

  if (supabaseUrl && supabaseServiceKey) {
    supabase = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

    if (userId) {
      try {
        const { data } = await supabase
          .from('sophia_conversations')
          .select('role, content')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })
          .limit(20);
        if (data) conversationContext = data.map(m => ({ role: m.role, content: m.content }));
      } catch (e) { console.error('Failed to load conversation history:', e); }
    }
  }

  // Build messages array: history + new messages
  const messages = [
    ...conversationContext,
    ...incomingMessages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
  ];

  // Extract tickers and fetch market data
  const allText = messages.map(m => m.content).join(' ');
  const tickers = extractTickers(allText);
  const period = detectPeriod(allText);
  let marketContext = '';
  if (tickers.length > 0) {
    const dataPromises = tickers.slice(0, 3).map(async (t) => {
      const snapshot = await fetchSnapshot(t);
      const history = await fetchHistory(t, period);
      return snapshot + history;
    });
    const results = await Promise.all(dataPromises);
    marketContext = `\n\n## LIVE ALPACA MARKET DATA (REAL — use this data in your response)\n${results.join('\n')}`;
  }

  const fullSystem = SYSTEM_PROMPT + marketContext;

  // Set up SSE streaming
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Transfer-Encoding', 'chunked');

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: fullSystem,
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).end(`Anthropic error: ${response.status} ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            fullResponse += parsed.delta.text;
            res.write(parsed.delta.text);
          }
        } catch {}
      }
    }

    res.end();

    // Save messages to Supabase (fire and forget)
    if (supabase && userId) {
      const lastUserMsg = incomingMessages[incomingMessages.length - 1];
      const inserts = [];
      if (lastUserMsg) inserts.push({ user_id: userId, role: 'user', content: lastUserMsg.content });
      if (fullResponse) inserts.push({ user_id: userId, role: 'assistant', content: fullResponse });
      if (inserts.length > 0) {
        supabase.from('sophia_conversations').insert(inserts).then(() => {}).catch(() => {});
      }
    }
  } catch (err) {
    if (!res.headersSent) res.status(500).end(err.message || 'Internal server error');
    else res.end();
  }
}
