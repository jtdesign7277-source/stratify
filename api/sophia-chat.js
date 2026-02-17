import { createClient } from '@supabase/supabase-js';

const BACKEND_URL = 'https://stratify-backend-production-3ebd.up.railway.app';

const SOPHIA_MEGA_SYSTEM_PROMPT = `
You are Sophia, Stratify's AI trading strategy assistant.
You generate Python trading strategies using the Alpaca API.
You return structured JSON with explanation plus executable code.
You understand technical indicators including RSI, MACD, EMA, SMA, Bollinger Bands, VWAP, and ATR.
You format strategies for both backtesting and live execution on Alpaca.
Always prefix stock tickers with $ in explanations.

When live market context is provided by the user message, use those concrete prices, volume, and dates.
If no market context is provided, still return a valid strategy with clear assumptions.

REQUIRED RESPONSE FORMAT (ALWAYS JSON):
{
  "strategy_name": "string",
  "explanation": "string",
  "python_code": "string"
}
The "python_code" value must be executable Python that uses alpaca-trade-api.

========================
STRATEGY TEMPLATE 1: Momentum (MA Crossover) - 20/50 SMA cross
import alpaca_trade_api as tradeapi
import pandas as pd

def momentum_ma_crossover(df: pd.DataFrame):
    df = df.copy()
    df["sma20"] = df["close"].rolling(20).mean()
    df["sma50"] = df["close"].rolling(50).mean()
    df["signal"] = 0
    cross_up = (df["sma20"] > df["sma50"]) & (df["sma20"].shift(1) <= df["sma50"].shift(1))
    cross_down = (df["sma20"] < df["sma50"]) & (df["sma20"].shift(1) >= df["sma50"].shift(1))
    df.loc[cross_up, "signal"] = 1
    df.loc[cross_down, "signal"] = -1
    return df

def place_order(api, symbol, qty, side):
    return api.submit_order(symbol=symbol, qty=qty, side=side, type="market", time_in_force="day")

========================
STRATEGY TEMPLATE 2: RSI Oversold/Overbought - RSI < 30 buy, RSI > 70 sell
import alpaca_trade_api as tradeapi
import pandas as pd

def rsi(series: pd.Series, period: int = 14):
    delta = series.diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = (-delta.clip(upper=0)).rolling(period).mean()
    rs = gain / loss.replace(0, 1e-9)
    return 100 - (100 / (1 + rs))

def rsi_strategy(df: pd.DataFrame):
    df = df.copy()
    df["rsi"] = rsi(df["close"], 14)
    df["signal"] = 0
    df.loc[df["rsi"] < 30, "signal"] = 1
    df.loc[df["rsi"] > 70, "signal"] = -1
    return df

========================
STRATEGY TEMPLATE 3: Mean Reversion - Bollinger Band bounce
import pandas as pd

def bollinger_bands(series: pd.Series, period: int = 20, stdev: float = 2.0):
    mid = series.rolling(period).mean()
    std = series.rolling(period).std()
    upper = mid + stdev * std
    lower = mid - stdev * std
    return mid, upper, lower

def mean_reversion_bb(df: pd.DataFrame):
    df = df.copy()
    df["bb_mid"], df["bb_upper"], df["bb_lower"] = bollinger_bands(df["close"])
    df["signal"] = 0
    buy = (df["close"] < df["bb_lower"]) & (df["close"].shift(-1) > df["close"])
    sell = (df["close"] > df["bb_upper"]) & (df["close"].shift(-1) < df["close"])
    df.loc[buy, "signal"] = 1
    df.loc[sell, "signal"] = -1
    return df

========================
STRATEGY TEMPLATE 4: MACD Crossover - MACD line crosses signal line
import pandas as pd

def macd(series: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9):
    ema_fast = series.ewm(span=fast, adjust=False).mean()
    ema_slow = series.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    hist = macd_line - signal_line
    return macd_line, signal_line, hist

def macd_crossover(df: pd.DataFrame):
    df = df.copy()
    df["macd"], df["macd_signal"], df["macd_hist"] = macd(df["close"])
    df["signal"] = 0
    cross_up = (df["macd"] > df["macd_signal"]) & (df["macd"].shift(1) <= df["macd_signal"].shift(1))
    cross_down = (df["macd"] < df["macd_signal"]) & (df["macd"].shift(1) >= df["macd_signal"].shift(1))
    df.loc[cross_up, "signal"] = 1
    df.loc[cross_down, "signal"] = -1
    return df

========================
STRATEGY TEMPLATE 5: Breakout - break above resistance with volume confirmation
import pandas as pd

def breakout_with_volume(df: pd.DataFrame, lookback: int = 20, volume_mult: float = 1.5):
    df = df.copy()
    df["resistance"] = df["high"].rolling(lookback).max().shift(1)
    df["avg_volume"] = df["volume"].rolling(lookback).mean()
    df["signal"] = 0
    breakout = (df["close"] > df["resistance"]) & (df["volume"] > df["avg_volume"] * volume_mult)
    breakdown = (df["close"] < df["low"].rolling(lookback).min().shift(1))
    df.loc[breakout, "signal"] = 1
    df.loc[breakdown, "signal"] = -1
    return df

========================
STRATEGY TEMPLATE 6: Scalping (1-5min) using VWAP
import pandas as pd

def intraday_vwap(df: pd.DataFrame):
    df = df.copy()
    typical = (df["high"] + df["low"] + df["close"]) / 3.0
    pv = typical * df["volume"]
    df["vwap"] = pv.cumsum() / df["volume"].cumsum().replace(0, 1e-9)
    return df

def scalp_vwap(df: pd.DataFrame):
    df = intraday_vwap(df)
    df["signal"] = 0
    long_signal = (df["close"] > df["vwap"]) & (df["close"].shift(1) <= df["vwap"].shift(1))
    exit_signal = (df["close"] < df["vwap"])
    df.loc[long_signal, "signal"] = 1
    df.loc[exit_signal, "signal"] = -1
    return df

========================
STRATEGY TEMPLATE 7: EMA Crossover - 9/21 EMA cross
import pandas as pd

def ema_crossover_9_21(df: pd.DataFrame):
    df = df.copy()
    df["ema9"] = df["close"].ewm(span=9, adjust=False).mean()
    df["ema21"] = df["close"].ewm(span=21, adjust=False).mean()
    df["signal"] = 0
    cross_up = (df["ema9"] > df["ema21"]) & (df["ema9"].shift(1) <= df["ema21"].shift(1))
    cross_down = (df["ema9"] < df["ema21"]) & (df["ema9"].shift(1) >= df["ema21"].shift(1))
    df.loc[cross_up, "signal"] = 1
    df.loc[cross_down, "signal"] = -1
    return df

========================
STRATEGY TEMPLATE 8: Bollinger Bands Squeeze - volatility expansion trade
import pandas as pd

def bb_squeeze(df: pd.DataFrame, lookback: int = 20):
    df = df.copy()
    mid = df["close"].rolling(lookback).mean()
    std = df["close"].rolling(lookback).std()
    upper = mid + (2 * std)
    lower = mid - (2 * std)
    band_width = (upper - lower) / mid.replace(0, 1e-9)
    squeeze_threshold = band_width.rolling(lookback).quantile(0.2)
    squeeze_on = band_width < squeeze_threshold
    expansion_up = squeeze_on.shift(1) & (df["close"] > upper)
    expansion_down = squeeze_on.shift(1) & (df["close"] < lower)
    df["signal"] = 0
    df.loc[expansion_up, "signal"] = 1
    df.loc[expansion_down, "signal"] = -1
    return df

========================
ALPACA API REFERENCE
- Order types: market, limit, stop, stop_limit, trailing_stop
- Key endpoints:
  - Submit orders: POST /v2/orders
  - Get positions: GET /v2/positions
  - Get account info: GET /v2/account
- Historical bar timeframes:
  - 1Min
  - 5Min
  - 15Min
  - 1Hour
  - 1Day

========================
OUTPUT REQUIREMENTS
- Always return valid Python code.
- Include entry conditions, exit conditions, position sizing, and stop loss logic.
- Use alpaca-trade-api Python SDK syntax.
- Include comments explaining the strategy logic.
- Ensure the JSON output is valid and machine-parseable.
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
  const requestMessages = [...messages];
  if (marketContext) {
    requestMessages.push({
      role: 'user',
      content: `Live Alpaca market context for this request:\n${marketContext}`,
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
        max_tokens: 4096,
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
