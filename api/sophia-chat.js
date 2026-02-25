import { createClient } from '@supabase/supabase-js';
import { fetchTwelveData } from './lib/twelvedata.js';

const SOPHIA_MEGA_SYSTEM_PROMPT = `
You are Sophia, Stratify's AI trading strategist.
Always write concise, trader-focused strategy responses in markdown, not JSON and not code.
Always prefix stock tickers with $ (example: $SPY, $NVDA).
When real backtest results are provided, use the EXACT numbers from the data — never invent trades or statistics.
You MUST end every single strategy response with the "🔥 Key Trade Setups" section using the exact bullet format shown below.

MANDATORY OUTPUT TEMPLATE (use this structure exactly):

# $[TICKER] [Strategy Name] Strategy Backtest ([Chart/Timeframe])

## 💰 [+$X,XXX or -$X,XXX] over [period]
This line is MANDATORY and must appear IMMEDIATELY after the title. Use the totalProfit value from the stats data. Example: "## 💰 +$1,895 over 3 months" or "## 💰 -$1,080 over 6 months". NEVER skip this line.

## 📊 Strategy Analysis
**Entry Logic:** [1 concise sentence]
**Profit Target:** [value] | **Stop Loss:** [value]
**Risk/Reward Ratio:** [value]

## ⚡ Real Trade Analysis ([period] Lookback)
**Key Setups Identified:**
[For each trade from the backtest data, format as:]
**🏆 Winner - [entryDate] [entryReason]:** (if profit > 0)
- **Entry:** $[entryPrice] — [entryReason]
- **Exit:** $[exitPrice] — [exitReason]
- **Shares:** [shares]
- **Profit:** $[profit] ([returnPct]%) ✅

**📉 Loss - [entryDate] [entryReason]:** (if profit <= 0)
- **Entry:** $[entryPrice] — [entryReason]
- **Exit:** $[exitPrice] — [exitReason]
- **Shares:** [shares]
- **Loss:** $[profit] ([returnPct]%) ❌

## 📈 Performance Summary
- **Total Trades:** [totalTrades] | **Win Rate:** [winRate]%
- **Total Profit:** $[totalProfit]
- **Avg Win:** $[avgWin] | **Avg Loss:** $[avgLoss]
- **Risk/Reward:** [riskReward] | **Max Drawdown:** $[maxDrawdown]

🔥 Key Trade Setups
● Entry Signal: [value]
● Volume: [value]
● Trend: [value]
● Risk/Reward: [value]
● Stop Loss: [value]
● $ Allocation: [value]

LENGTH RULES:
- Keep total response tight: about half normal length (target 180-350 words).
- No extra sections, no long explanations, no fluff.
- Be direct and readable.
- USE THE REAL BACKTEST DATA PROVIDED. Do NOT make up trades or numbers.
`.trim();

const SOPHIA_CACHED_SYSTEM_MESSAGE = [
  {
    type: 'text',
    text: SOPHIA_MEGA_SYSTEM_PROMPT,
    cache_control: { type: 'ephemeral' },
  },
];

let zeroCacheReadStreak = 0;

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

function detectMonths(text) {
  const lower = text.toLowerCase();
  if (lower.includes('1 month') || lower.includes('one month') || lower.includes('last month')) return 1;
  if (/(?:2|two)\s*month/i.test(lower)) return 2;
  if (/(?:6|six)\s*month|half\s*year/i.test(lower)) return 6;
  if (/(?:1|one|last)\s*year|12\s*month|twelve\s*month/i.test(lower)) return 12;
  return 3;
}

function detectStrategy(text) {
  const lower = text.toLowerCase();
  if (/\brsi\b/.test(lower)) return 'rsi';
  if (/\bmacd\b/.test(lower)) return 'macd';
  if (/\bbollinger\b/.test(lower) || /\bbb\s*band/i.test(lower)) return 'bollinger';
  if (/\bema\b.*\bcross/i.test(lower) || /\bcrossover\b/.test(lower) || /\bmomentum\b/.test(lower)) return 'ema_crossover';
  if (/\bbreakout\b/.test(lower)) return 'breakout';
  if (/\bmean\s*reversion\b/.test(lower) || /\bbounce\b/.test(lower) || /\boversold\b/.test(lower)) return 'rsi';
  if (/\bscalp/i.test(lower)) return 'macd';
  return 'rsi';
}

function isBacktestRequest(text) {
  const lower = text.toLowerCase();
  return /backtest|strategy|test.*strat|run.*strat|build.*strat|trade.*strat|analyze.*strat/i.test(lower) ||
    /\brsi\b|\bmacd\b|\bbollinger\b|\bema\b|\bbreakout\b|\bmomentum\b|\bmean.reversion\b/i.test(lower);
}

async function runRealBacktest(symbol, strategy, months, params = {}) {
  // Import and call the backtest handler logic directly server-side
  const { fetchTwelveData: fetchTD } = await import('./lib/twelvedata.js');

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  const startDateStr = startDate.toISOString().split('T')[0];
  const interval = '1day';
  const stopLossPct = (Number(params.stopLoss) || 3) / 100;
  const positionSize = Number(params.positionSize) || 25000;

  const toNumber = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
  const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
  const daysBetween = (a, b) => Math.round(Math.abs(new Date(b) - new Date(a)) / 86400000);

  // Fetch OHLCV
  const ohlcvPayload = await fetchTD('time_series', {
    symbol, interval, start_date: startDateStr, outputsize: 5000, order: 'ASC', dp: 4,
  });
  const bars = (ohlcvPayload?.values || [])
    .map((b) => ({ datetime: b.datetime, open: toNumber(b.open), high: toNumber(b.high), low: toNumber(b.low), close: toNumber(b.close), volume: toNumber(b.volume) }))
    .filter((b) => b.datetime && b.close != null);

  if (bars.length === 0) return null;

  // Fetch indicator
  let indicatorEndpoint, indicatorParams, indicatorFields;
  switch (strategy) {
    case 'rsi':
      indicatorEndpoint = 'rsi';
      indicatorParams = { time_period: params.rsiPeriod || 14 };
      indicatorFields = ['rsi'];
      break;
    case 'macd':
      indicatorEndpoint = 'macd';
      indicatorParams = { fast_period: params.fastPeriod || 12, slow_period: params.slowPeriod || 26, signal_period: params.signalPeriod || 9 };
      indicatorFields = ['macd', 'macd_signal', 'macd_hist'];
      break;
    case 'bollinger':
      indicatorEndpoint = 'bbands';
      indicatorParams = { time_period: params.bbPeriod || 20, sd: params.bbStdDev || 2 };
      indicatorFields = ['lower_band', 'middle_band', 'upper_band'];
      break;
    case 'ema_crossover': {
      const shortP = params.shortEmaPeriod || 9;
      const longP = params.longEmaPeriod || 21;
      const [shortData, longData] = await Promise.all([
        fetchTD('ema', { symbol, interval, start_date: startDateStr, outputsize: 5000, order: 'ASC', dp: 4, time_period: shortP }),
        fetchTD('ema', { symbol, interval, start_date: startDateStr, outputsize: 5000, order: 'ASC', dp: 4, time_period: longP }),
      ]);
      const shortMap = new Map((shortData?.values || []).map((r) => [r.datetime, r]));
      const longMap = new Map((longData?.values || []).map((r) => [r.datetime, r]));
      const merged = bars.map((b) => ({
        ...b,
        ema_short: toNumber((shortMap.get(b.datetime) || {}).ema),
        ema_long: toNumber((longMap.get(b.datetime) || {}).ema),
      }));

      let prevShort = null, prevLong = null;
      const shouldBuy = (bar) => {
        const s = bar.ema_short, l = bar.ema_long;
        if (s == null || l == null) { prevShort = s; prevLong = l; return null; }
        const sig = (prevShort != null && prevLong != null && prevShort <= prevLong && s > l)
          ? `EMA ${shortP} crossed above EMA ${longP}` : null;
        prevShort = s; prevLong = l;
        return sig;
      };
      const shouldSell = (bar) => {
        const s = bar.ema_short, l = bar.ema_long;
        if (s == null || l == null) return null;
        return s < l ? `EMA ${shortP} below EMA ${longP}` : null;
      };

      return runEngine(merged, shouldBuy, shouldSell, stopLossPct, positionSize, symbol, strategy, months, startDateStr);
    }
    case 'breakout': {
      const lookback = params.breakoutPeriod || 20;
      const shouldBuy = (bar, i) => {
        if (i < lookback) return null;
        let highest = -Infinity;
        for (let j = i - lookback; j < i; j++) if (bars[j].high > highest) highest = bars[j].high;
        return bar.close > highest ? `Price broke above ${lookback}-day high $${round(highest, 2)}` : null;
      };
      const shouldSell = (bar, i) => {
        if (i < lookback) return null;
        let lowest = Infinity;
        for (let j = i - lookback; j < i; j++) if (bars[j].low < lowest) lowest = bars[j].low;
        return bar.close < lowest ? `Price broke below ${lookback}-day low $${round(lowest, 2)}` : null;
      };
      return runEngine(bars, shouldBuy, shouldSell, stopLossPct, positionSize, symbol, strategy, months, startDateStr);
    }
    default:
      indicatorEndpoint = 'rsi';
      indicatorParams = { time_period: 14 };
      indicatorFields = ['rsi'];
  }

  // Fetch single indicator and merge
  const indPayload = await fetchTD(indicatorEndpoint, {
    symbol, interval, start_date: startDateStr, outputsize: 5000, order: 'ASC', dp: 4, ...indicatorParams,
  });
  const indMap = new Map((indPayload?.values || []).map((r) => [r.datetime, r]));
  const merged = bars.map((b) => {
    const ind = indMap.get(b.datetime) || {};
    const row = { ...b };
    for (const f of indicatorFields) row[f] = toNumber(ind[f]);
    return row;
  });

  // Build strategy signals
  let shouldBuy, shouldSell;
  switch (strategy) {
    case 'rsi': {
      const entry = params.entryThreshold || 30;
      const exit = params.exitThreshold || 70;
      shouldBuy = (bar) => bar.rsi != null && bar.rsi < entry ? `RSI ${round(bar.rsi, 1)} < ${entry}` : null;
      shouldSell = (bar) => bar.rsi != null && bar.rsi > exit ? `RSI ${round(bar.rsi, 1)} > ${exit}` : null;
      break;
    }
    case 'macd': {
      let prevHist = null;
      shouldBuy = (bar) => {
        const h = bar.macd_hist;
        if (h == null) { prevHist = h; return null; }
        const sig = (prevHist != null && prevHist <= 0 && h > 0) ? `MACD histogram crossed above zero` : null;
        prevHist = h;
        return sig;
      };
      shouldSell = (bar) => bar.macd_hist != null && bar.macd_hist < 0 ? `MACD histogram below zero` : null;
      break;
    }
    case 'bollinger':
      shouldBuy = (bar) => bar.lower_band != null && bar.close <= bar.lower_band ? `Price at lower Bollinger band` : null;
      shouldSell = (bar) => bar.middle_band != null && bar.close >= bar.middle_band ? `Price reached middle Bollinger band` : null;
      break;
    default:
      shouldBuy = () => null;
      shouldSell = () => null;
  }

  return runEngine(merged, shouldBuy, shouldSell, stopLossPct, positionSize, symbol, strategy, months, startDateStr);

  function runEngine(data, buyFn, sellFn, slPct, posSize, sym, strat, mo, startStr) {
    const trades = [];
    let position = null;

    for (let i = 0; i < data.length; i++) {
      const bar = data[i];
      if (bar.close == null) continue;

      if (!position) {
        const reason = buyFn(bar, i);
        if (reason) {
          const shares = Math.floor(posSize / bar.close);
          if (shares > 0) position = { entryDate: bar.datetime, entryPrice: bar.close, entryReason: reason, shares };
        }
        continue;
      }

      const dd = (bar.low - position.entryPrice) / position.entryPrice;
      if (dd <= -slPct) {
        const exitPrice = round(position.entryPrice * (1 - slPct), 4);
        trades.push({
          type: 'long', entryDate: position.entryDate, entryPrice: position.entryPrice,
          entryReason: position.entryReason, exitDate: bar.datetime, exitPrice,
          exitReason: `Stop loss triggered (-${round(slPct * 100, 1)}%)`,
          shares: position.shares,
          profit: round((exitPrice - position.entryPrice) * position.shares, 2),
          returnPct: round(((exitPrice - position.entryPrice) / position.entryPrice) * 100, 2),
          holdingDays: daysBetween(position.entryDate, bar.datetime),
        });
        position = null;
        continue;
      }

      const sellReason = sellFn(bar, i);
      if (sellReason) {
        trades.push({
          type: 'long', entryDate: position.entryDate, entryPrice: position.entryPrice,
          entryReason: position.entryReason, exitDate: bar.datetime, exitPrice: bar.close,
          exitReason: sellReason, shares: position.shares,
          profit: round((bar.close - position.entryPrice) * position.shares, 2),
          returnPct: round(((bar.close - position.entryPrice) / position.entryPrice) * 100, 2),
          holdingDays: daysBetween(position.entryDate, bar.datetime),
        });
        position = null;
      }
    }

    if (position && data.length > 0) {
      const last = data[data.length - 1];
      trades.push({
        type: 'long', entryDate: position.entryDate, entryPrice: position.entryPrice,
        entryReason: position.entryReason, exitDate: last.datetime, exitPrice: last.close,
        exitReason: 'Position closed at end of period', shares: position.shares,
        profit: round((last.close - position.entryPrice) * position.shares, 2),
        returnPct: round(((last.close - position.entryPrice) / position.entryPrice) * 100, 2),
        holdingDays: daysBetween(position.entryDate, last.datetime),
      });
    }

    const totalTrades = trades.length;
    const winners = trades.filter((t) => t.profit > 0);
    const losers = trades.filter((t) => t.profit <= 0);
    const totalProfit = round(trades.reduce((s, t) => s + t.profit, 0), 2);
    const winRate = totalTrades > 0 ? round((winners.length / totalTrades) * 100, 1) : 0;
    const avgWin = winners.length > 0 ? round(winners.reduce((s, t) => s + t.profit, 0) / winners.length, 2) : 0;
    const avgLoss = losers.length > 0 ? round(losers.reduce((s, t) => s + t.profit, 0) / losers.length, 2) : 0;
    const riskReward = avgLoss !== 0 ? round(Math.abs(avgWin / avgLoss), 2) : 0;
    let peak = 0, cum = 0, maxDD = 0;
    for (const t of trades) { cum += t.profit; if (cum > peak) peak = cum; const d = peak - cum; if (d > maxDD) maxDD = d; }

    return {
      symbol: sym, strategy: strat,
      period: { months: mo, startDate: startStr, endDate: data[data.length - 1]?.datetime, totalBars: data.length },
      trades,
      stats: { totalTrades, winners: winners.length, losers: losers.length, winRate, totalProfit, avgWin, avgLoss, riskReward, maxDrawdown: round(maxDD, 2) },
    };
  }
}

async function fetchQuote(symbol) {
  try {
    const payload = await fetchTwelveData('quote', { symbol });
    const price = Number(payload?.close || payload?.price || 0);
    const change = Number(payload?.percent_change || 0);
    return `${symbol} CURRENT: Price $${price.toFixed(2)}, Change ${change.toFixed(2)}%`;
  } catch {
    return `${symbol}: quote unavailable`;
  }
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

  // Extract tickers and detect intent
  const allText = messages.map(m => m.content).join(' ');
  const tickers = extractTickers(allText);
  const months = detectMonths(allText);
  let marketContext = '';

  if (tickers.length > 0) {
    const primaryTicker = tickers[0];
    const latestUserMsg = allText;

    if (isBacktestRequest(latestUserMsg)) {
      // Run real backtest with Twelve Data
      const strategy = detectStrategy(latestUserMsg);
      try {
        const result = await runRealBacktest(primaryTicker, strategy, months);
        if (result) {
          marketContext = `\n\n## REAL BACKTEST RESULTS (from Twelve Data — use these EXACT numbers)\n`;
          marketContext += `Symbol: $${result.symbol} | Strategy: ${result.strategy} | Period: ${result.period.months} months (${result.period.startDate} to ${result.period.endDate})\n`;
          marketContext += `Total Bars: ${result.period.totalBars}\n\n`;
          marketContext += `### Trades:\n`;
          for (const t of result.trades) {
            const icon = t.profit > 0 ? '🏆 WIN' : '📉 LOSS';
            marketContext += `${icon}: Entry ${t.entryDate} @ $${t.entryPrice} (${t.entryReason}) → Exit ${t.exitDate} @ $${t.exitPrice} (${t.exitReason}) | Shares: ${t.shares} | P&L: $${t.profit} (${t.returnPct}%) | Held: ${t.holdingDays} days\n`;
          }
          marketContext += `\n### Stats:\n`;
          marketContext += `Total Trades: ${result.stats.totalTrades} | Winners: ${result.stats.winners} | Losers: ${result.stats.losers} | Win Rate: ${result.stats.winRate}%\n`;
          marketContext += `Total Profit: $${result.stats.totalProfit} | Avg Win: $${result.stats.avgWin} | Avg Loss: $${result.stats.avgLoss}\n`;
          marketContext += `Risk/Reward: ${result.stats.riskReward} | Max Drawdown: $${result.stats.maxDrawdown}\n`;
        }
      } catch (err) {
        console.error('[Sophia] Backtest failed:', err.message);
      }

      // Also fetch additional ticker quotes for context
      for (const t of tickers.slice(0, 3)) {
        try {
          const quote = await fetchQuote(t);
          marketContext += `\n${quote}`;
        } catch {}
      }
    } else {
      // Non-backtest request — just fetch live quotes
      for (const t of tickers.slice(0, 3)) {
        try {
          const quote = await fetchQuote(t);
          marketContext += `\n${quote}`;
        } catch {}
      }
      if (marketContext) marketContext = `\n\n## LIVE MARKET DATA (from Twelve Data)\n${marketContext}`;
    }
  }

  const requestMessages = [...messages];
  if (marketContext) {
    requestMessages.push({
      role: 'user',
      content: `Real market data for this request:\n${marketContext}`,
    });
  }

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
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1800,
        system: SOPHIA_CACHED_SYSTEM_MESSAGE,
        messages: requestMessages,
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
    const cacheMetrics = {
      cache_write: 0,
      cache_read: 0,
      input: 0,
      output: 0,
    };

    const mergeUsage = (usage) => {
      if (!usage || typeof usage !== 'object') return;
      if (Number.isFinite(usage.cache_creation_input_tokens)) {
        cacheMetrics.cache_write = usage.cache_creation_input_tokens;
      }
      if (Number.isFinite(usage.cache_read_input_tokens)) {
        cacheMetrics.cache_read = usage.cache_read_input_tokens;
      }
      if (Number.isFinite(usage.input_tokens)) {
        cacheMetrics.input = usage.input_tokens;
      }
      if (Number.isFinite(usage.output_tokens)) {
        cacheMetrics.output = usage.output_tokens;
      }
    };

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
          if (parsed.type === 'message_start') {
            mergeUsage(parsed.message?.usage);
          }
          if (parsed.type === 'message_delta' || parsed.type === 'message_stop') {
            mergeUsage(parsed.usage);
          }
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            fullResponse += parsed.delta.text;
            res.write(parsed.delta.text);
          }
        } catch {}
      }
    }

    res.end();

    if (cacheMetrics.cache_read > 0) {
      zeroCacheReadStreak = 0;
    } else {
      zeroCacheReadStreak += 1;
      if (zeroCacheReadStreak >= 2) {
        console.error('[Sophia Cache] cache_read_input_tokens is 0 on consecutive requests — caching likely broken.');
      }
    }

    console.log('[Sophia Cache]', cacheMetrics);

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
