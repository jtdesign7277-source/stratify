// api/sophia-trade.js — Sophia Trading Mode
// Reads REAL portfolio data + Sentinel status, answers natural language questions,
// executes paper trades via paper-portfolio tables.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY_SOPHIA || process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY_XPOST;
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

async function getRealPortfolio(userId) {
  try {
    // Get portfolio from paper_portfolios
    const { data: portfolio } = await supabase
      .from('paper_portfolios')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Get positions from paper_positions
    const { data: positions } = await supabase
      .from('paper_positions')
      .select('*')
      .eq('user_id', userId);

    // Get recent trades
    const { data: trades } = await supabase
      .from('paper_trades')
      .select('symbol, side, quantity, price, total_cost, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    return {
      cash: portfolio?.cash_balance || 100000,
      starting: portfolio?.starting_balance || 100000,
      positions: positions || [],
      recentTrades: trades || [],
    };
  } catch { return { cash: 100000, starting: 100000, positions: [], recentTrades: [] }; }
}

async function getSentinelStatus() {
  try {
    const res = await fetch('https://stratifymarket.com/api/sentinel/status');
    const data = await res.json();
    return data;
  } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const user = await getUserFromToken(req);
  if (!user) return res.status(401).json({ reply: '⚠️ Please sign in to use Trading Mode.', action: 'error' });

  const { message, includeSentinel } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

  try {
    // Load real portfolio + optionally Sentinel data in parallel
    const [portfolio, sentinelData] = await Promise.all([
      getRealPortfolio(user.id),
      includeSentinel ? getSentinelStatus() : Promise.resolve(null),
    ]);

    // Enrich positions with live prices
    const enrichedPositions = await Promise.all(
      (portfolio.positions || []).map(async (pos) => {
        const price = await getLivePrice(pos.symbol);
        const qty = parseFloat(pos.quantity);
        const avg = parseFloat(pos.avg_cost_basis);
        const current = price || avg;
        const marketValue = qty * current;
        const pnl = marketValue - (qty * avg);
        return {
          symbol: pos.symbol,
          qty,
          avg_cost: avg,
          current_price: current,
          market_value: marketValue,
          pnl,
          pnl_pct: avg > 0 ? (pnl / (qty * avg)) * 100 : 0,
        };
      })
    );

    const totalMarketValue = enrichedPositions.reduce((s, p) => s + p.market_value, 0);
    const totalAccountValue = portfolio.cash + totalMarketValue;
    const totalPnl = totalAccountValue - portfolio.starting;
    const positionsSummary = enrichedPositions.map(p =>
      `${p.symbol}: ${p.qty} shares @ avg $${p.avg_cost.toFixed(2)}, now $${p.current_price.toFixed(2)}, value $${p.market_value.toFixed(2)}, P&L ${p.pnl >= 0 ? '+' : ''}$${p.pnl.toFixed(2)} (${p.pnl_pct >= 0 ? '+' : ''}${p.pnl_pct.toFixed(2)}%)`
    ).join('\n');

    const recentTradesSummary = portfolio.recentTrades.slice(0, 5).map(t =>
      `${t.side?.toUpperCase()} ${t.quantity} ${t.symbol} @ $${t.price} on ${new Date(t.created_at).toLocaleDateString()}`
    ).join('\n');

    // Build Sentinel context if requested
    let sentinelContext = '';
    if (sentinelData) {
      const acc = sentinelData.account || {};
      const openTrades = sentinelData.openTrades || [];
      sentinelContext = `\n\nSENTINEL BOT STATUS:
- Account balance: $${(acc.current_balance || 0).toLocaleString()}
- All-time P&L: ${acc.total_pnl >= 0 ? '+' : ''}$${(acc.total_pnl || 0).toFixed(2)}
- Win rate: ${(acc.win_rate || 0).toFixed(1)}%
- Total trades: ${acc.total_trades || 0} (${acc.closed_trades || 0} closed)
- Open positions right now: ${openTrades.length > 0 ? openTrades.map(t => `${t.direction} ${t.symbol} entry $${t.entry} conf ${t.confidence}%`).join(', ') : 'none'}
- Today session: ${sentinelData.todaySession ? `${sentinelData.todaySession.trades_fired} trades, P&L $${sentinelData.todaySession.gross_pnl}` : 'no session today'}`;
    }

    const systemPrompt = `You are Sophia, Stratify's AI trading assistant. You have full access to the user's real paper trading portfolio.

When the user asks about their portfolio, positions, holdings, P&L, or account — respond with this exact JSON (the UI will render a live widget, NOT your text):
{"action":"portfolio","reply":""}

When executing a trade:
{"action":"trade","symbol":"AAPL","side":"buy","qty":10,"reply":""}

For Sentinel bot questions:
{"action":"sentinel","reply":""}

For general market questions or analysis:
{"action":"info","reply":"Your concise answer. Max 2 sentences."}

RULES:
- Portfolio/positions/P&L questions → ALWAYS return action:"portfolio" — the UI handles the display
- Never write out portfolio data as text — the UI renders it live
- For trades, just confirm the action briefly
- Be extremely concise — one line max for info replies`;

    const userPrompt = `User asks: "${message}"

THEIR REAL PAPER PORTFOLIO RIGHT NOW:
- Cash balance: $${portfolio.cash.toLocaleString()}
- Starting balance: $${portfolio.starting.toLocaleString()}
- Total account value: $${totalAccountValue.toFixed(2)}
- Total P&L: ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)} (${totalPnl >= 0 ? '+' : ''}${portfolio.starting > 0 ? ((totalPnl / portfolio.starting) * 100).toFixed(2) : 0}%)
- Open positions: ${enrichedPositions.length > 0 ? `\n${positionsSummary}` : 'None'}
- Recent trades: ${portfolio.recentTrades.length > 0 ? `\n${recentTradesSummary}` : 'None'}${sentinelContext}`;

    if (!ANTHROPIC_KEY) {
      return res.status(500).json({ reply: '❌ AI service not configured.', action: 'error' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    let anthropicRes;
    try {
      anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 400,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error('[sophia-trade] Claude error:', anthropicRes.status, errText.slice(0, 200));
      return res.status(200).json({ reply: `❌ AI error ${anthropicRes.status}. Try again.`, action: 'error' });
    }

    const aiData = await anthropicRes.json();
    const rawText = aiData.content?.[0]?.text?.trim() || '{}';

    let parsed;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
    } catch {
      return res.status(200).json({ reply: rawText, action: 'info' });
    }

    // Execute paper trade if requested
    if (parsed.action === 'trade' && parsed.symbol && parsed.side && parsed.qty) {
      const price = await getLivePrice(parsed.symbol) || 0;
      if (!price) return res.status(200).json({ reply: `❌ Couldn't get live price for ${parsed.symbol}`, action: 'error' });

      const cost = price * parsed.qty;

      if (parsed.side === 'buy') {
        if (cost > portfolio.cash) return res.status(200).json({ reply: `❌ Not enough cash. Need $${cost.toFixed(2)}, have $${portfolio.cash.toFixed(2)}`, action: 'error' });

        // Update cash
        await supabase.from('paper_portfolios').upsert({ user_id: user.id, cash_balance: portfolio.cash - cost }, { onConflict: 'user_id' });

        // Upsert position
        const existing = portfolio.positions.find(p => p.symbol === parsed.symbol.toUpperCase());
        if (existing) {
          const newQty = parseFloat(existing.quantity) + parsed.qty;
          const newAvg = ((parseFloat(existing.avg_cost_basis) * parseFloat(existing.quantity)) + cost) / newQty;
          await supabase.from('paper_positions').update({ quantity: newQty, avg_cost_basis: newAvg }).eq('user_id', user.id).eq('symbol', parsed.symbol.toUpperCase());
        } else {
          await supabase.from('paper_positions').insert({ user_id: user.id, symbol: parsed.symbol.toUpperCase(), quantity: parsed.qty, avg_cost_basis: price });
        }

        // Log trade
        await supabase.from('paper_trades').insert({ user_id: user.id, symbol: parsed.symbol.toUpperCase(), side: 'buy', quantity: parsed.qty, price, total_cost: cost });

        return res.status(200).json({
          reply: parsed.reply || `✓ Paper bought ${parsed.qty} ${parsed.symbol} @ $${price.toFixed(2)} | Cost: $${cost.toFixed(2)} | Remaining cash: $${(portfolio.cash - cost).toFixed(2)}`,
          action: 'trade',
          order: { symbol: parsed.symbol, side: 'buy', qty: parsed.qty, price, cost },
        });
      }

      if (parsed.side === 'sell') {
        const pos = portfolio.positions.find(p => p.symbol === parsed.symbol.toUpperCase());
        if (!pos || parseFloat(pos.quantity) < parsed.qty) return res.status(200).json({ reply: `❌ You don't have ${parsed.qty} shares of ${parsed.symbol}.`, action: 'error' });
        const proceeds = price * parsed.qty;
        const pnl = (price - parseFloat(pos.avg_cost_basis)) * parsed.qty;
        const newQty = parseFloat(pos.quantity) - parsed.qty;
        if (newQty <= 0) {
          await supabase.from('paper_positions').delete().eq('user_id', user.id).eq('symbol', parsed.symbol.toUpperCase());
        } else {
          await supabase.from('paper_positions').update({ quantity: newQty }).eq('user_id', user.id).eq('symbol', parsed.symbol.toUpperCase());
        }
        await supabase.from('paper_portfolios').upsert({ user_id: user.id, cash_balance: portfolio.cash + proceeds }, { onConflict: 'user_id' });
        await supabase.from('paper_trades').insert({ user_id: user.id, symbol: parsed.symbol.toUpperCase(), side: 'sell', quantity: parsed.qty, price, total_cost: proceeds });
        return res.status(200).json({
          reply: parsed.reply || `✓ Paper sold ${parsed.qty} ${parsed.symbol} @ $${price.toFixed(2)} | P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} | Cash: $${(portfolio.cash + proceeds).toFixed(2)}`,
          action: 'trade',
          order: { symbol: parsed.symbol, side: 'sell', qty: parsed.qty, price, proceeds, pnl },
        });
      }
    }

    // Portfolio action — return structured data for live UI rendering
    if (parsed.action === 'portfolio') {
      return res.status(200).json({
        action: 'portfolio',
        reply: '',
        portfolio: {
          cash: portfolio.cash,
          starting: portfolio.starting,
          totalValue: totalAccountValue,
          totalPnl,
          totalPnlPct: portfolio.starting > 0 ? (totalPnl / portfolio.starting) * 100 : 0,
          positions: enrichedPositions,
        },
      });
    }

    // Sentinel action — return structured sentinel data
    if (parsed.action === 'sentinel' && sentinelData) {
      const acc = sentinelData.account || {};
      return res.status(200).json({
        action: 'sentinel',
        reply: '',
        sentinel: {
          balance: acc.current_balance || 0,
          totalPnl: acc.total_pnl || 0,
          winRate: acc.win_rate || 0,
          totalTrades: acc.total_trades || 0,
          openTrades: sentinelData.openTrades || [],
          todaySession: sentinelData.todaySession || null,
        },
      });
    }

    return res.status(200).json({ reply: parsed.reply || rawText, action: parsed.action || 'info' });

  } catch (err) {
    console.error('[sophia-trade] Error:', err.message);
    return res.status(200).json({ reply: `❌ Error: ${err.message}`, action: 'error' });
  }
}
