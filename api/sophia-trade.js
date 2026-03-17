// api/sophia-trade.js — Sophia Trading Mode
// Parses natural language trade commands, fetches live prices via Twelve Data,
// and executes paper trades via existing paper trading system.
// Does NOT use Alpaca — uses Twelve Data for prices, Supabase for paper portfolio.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY_SOPHIA;
const TWELVE_DATA_KEY = process.env.TWELVE_DATA_API_KEY || process.env.VITE_TWELVE_DATA_WS_KEY;

async function getUserFromToken(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

async function getLivePrice(symbol) {
  try {
    const s = symbol.replace('/', '').toUpperCase();
    const res = await fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(s)}&apikey=${TWELVE_DATA_KEY}`);
    const data = await res.json();
    return parseFloat(data.close || data.price || '0') || null;
  } catch { return null; }
}

async function getPaperPortfolio(userId) {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('paper_trading_balance, positions, trade_history')
      .eq('id', userId)
      .single();
    return data || {};
  } catch { return {}; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const user = await getUserFromToken(req);
  if (!user) return res.status(401).json({ error: 'Sign in to use Trading Mode' });

  const { message, portfolio } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

  try {
    // Load user's paper portfolio
    const paperPortfolio = await getPaperPortfolio(user.id);
    const balance = paperPortfolio.paper_trading_balance || 100000;
    const positions = paperPortfolio.positions || [];

    // Build context for Claude
    const systemPrompt = `You are Sophia, Stratify's AI trading assistant. You help users manage their paper trading portfolio using natural language.

You can:
- Execute paper trades (buy/sell stocks and crypto)
- Show portfolio P&L
- Check live prices
- Analyze positions
- Answer market questions

When executing a trade, respond with valid JSON in this exact format (nothing else if it's a trade):
{"action":"trade","symbol":"AAPL","side":"buy","qty":10,"order_type":"market","reply":"Bought 10 shares of AAPL at $195.20 — added to your paper portfolio."}

For non-trade responses (portfolio questions, analysis, prices):
{"action":"info","reply":"Your paper portfolio is worth $102,450 with 3 open positions..."}

Rules:
- PAPER TRADING ONLY — always mention "paper" so user knows it's not real money
- Use Twelve Data prices (provided in context) for any price references
- Be concise and direct
- Never invent prices — only use prices from context`;

    const userPrompt = `User message: "${message}"

Current paper portfolio:
- Cash balance: $${balance.toLocaleString()}
- Open positions: ${positions.length > 0 ? JSON.stringify(positions.map(p => `${p.symbol}: ${p.shares} shares @ $${p.avg_price}`)) : 'none'}

Sentinel account context: ${JSON.stringify(portfolio || {})}`;

    // If message mentions a ticker, fetch live price first
    const tickerMatch = message.match(/\b([A-Z]{1,5})\b/g);
    const livePrices = {};
    if (tickerMatch) {
      for (const ticker of tickerMatch.slice(0, 3)) {
        if (['BUY', 'SELL', 'AT', 'THE', 'MY', 'FOR', 'AND', 'OR', 'IN', 'OF', 'TO', 'A'].includes(ticker)) continue;
        const price = await getLivePrice(ticker);
        if (price) livePrices[ticker] = price;
      }
    }

    const priceContext = Object.keys(livePrices).length > 0
      ? `\nLive prices from Twelve Data: ${Object.entries(livePrices).map(([s, p]) => `${s}: $${p}`).join(', ')}`
      : '';

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt + priceContext }],
      }),
    });

    const aiData = await anthropicRes.json();
    const rawText = aiData.content?.[0]?.text?.trim() || '{}';

    let parsed;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
    } catch {
      return res.status(200).json({ reply: rawText, action: 'info' });
    }

    // If it's a trade, execute it in the paper portfolio
    if (parsed.action === 'trade' && parsed.symbol && parsed.side && parsed.qty) {
      const price = livePrices[parsed.symbol] || Object.values(livePrices)[0] || 0;
      const cost = price * parsed.qty;

      if (parsed.side === 'buy' && cost > 0 && cost <= balance) {
        // Deduct from cash, add position
        const newBalance = balance - cost;
        const existingPos = positions.find(p => p.symbol === parsed.symbol);
        let newPositions;
        if (existingPos) {
          newPositions = positions.map(p => p.symbol === parsed.symbol
            ? { ...p, shares: p.shares + parsed.qty, avg_price: ((p.avg_price * p.shares) + cost) / (p.shares + parsed.qty) }
            : p
          );
        } else {
          newPositions = [...positions, { symbol: parsed.symbol, shares: parsed.qty, avg_price: price, cost_basis: cost }];
        }

        await supabase.from('profiles').update({
          paper_trading_balance: parseFloat(newBalance.toFixed(2)),
          positions: newPositions,
        }).eq('id', user.id);

        return res.status(200).json({
          reply: parsed.reply || `✓ Paper bought ${parsed.qty} ${parsed.symbol} @ $${price?.toFixed(2)} | Cost: $${cost.toFixed(2)} | Remaining cash: $${newBalance.toFixed(2)}`,
          action: 'trade',
          order: { symbol: parsed.symbol, side: 'buy', qty: parsed.qty, price, cost },
        });

      } else if (parsed.side === 'sell') {
        const pos = positions.find(p => p.symbol === parsed.symbol);
        if (!pos || pos.shares < parsed.qty) {
          return res.status(200).json({ reply: `❌ You don't have ${parsed.qty} shares of ${parsed.symbol} to sell.`, action: 'error' });
        }
        const proceeds = price * parsed.qty;
        const newBalance = balance + proceeds;
        const newPositions = pos.shares === parsed.qty
          ? positions.filter(p => p.symbol !== parsed.symbol)
          : positions.map(p => p.symbol === parsed.symbol ? { ...p, shares: p.shares - parsed.qty } : p);

        await supabase.from('profiles').update({
          paper_trading_balance: parseFloat(newBalance.toFixed(2)),
          positions: newPositions,
        }).eq('id', user.id);

        const pnl = (price - pos.avg_price) * parsed.qty;
        return res.status(200).json({
          reply: parsed.reply || `✓ Paper sold ${parsed.qty} ${parsed.symbol} @ $${price?.toFixed(2)} | P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} | New cash: $${newBalance.toFixed(2)}`,
          action: 'trade',
          order: { symbol: parsed.symbol, side: 'sell', qty: parsed.qty, price, proceeds, pnl },
        });
      }
    }

    return res.status(200).json({ reply: parsed.reply || rawText, action: parsed.action || 'info' });

  } catch (err) {
    console.error('[sophia-trade] Error:', err);
    return res.status(500).json({ error: err.message, reply: `❌ Error: ${err.message}` });
  }
}
