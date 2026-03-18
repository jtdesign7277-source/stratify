// api/sophia-trade.js — Sophia Trading Mode
// Reads REAL portfolio data + Sentinel status, answers natural language questions,
// executes paper trades via paper-portfolio tables.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mszilrexlupzthauoaxb.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY_SOPHIA || process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY_XPOST;
const TWELVE_DATA_KEY = process.env.TWELVE_DATA_API_KEY || process.env.VITE_TWELVE_DATA_WS_KEY;
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function redisGet(key) {
  if (!REDIS_URL) return null;
  try {
    const r = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, { headers: { Authorization: `Bearer ${REDIS_TOKEN}` } });
    const j = await r.json();
    return j.result ? JSON.parse(j.result) : null;
  } catch { return null; }
}

async function redisSet(key, value, ttl = 60) {
  if (!REDIS_URL) return;
  try {
    await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: JSON.stringify(value), ex: ttl }),
    });
  } catch {}
}

// Quick commands that bypass Claude entirely
const QUICK_COMMANDS = {
  "what's my daily p&l?": 'daily_pnl',
  "what's my p&l?": 'daily_pnl',
  'show my positions': 'portfolio',
  'what am i holding?': 'portfolio',
  'sentinel p&l': 'sentinel_pnl',
  'sentinel daily p&l': 'sentinel_daily',
  'sentinel open trades': 'sentinel_trades',
  'market sentiment': 'market_sentiment',
};

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
  try { return await handleRequest(req, res); }
  catch (err) { console.error('[sophia-trade] TOP CRASH:', err.message); return res.status(200).json({ reply: `❌ ${err.message}`, action: 'error' }); }
}

async function handleRequest(req, res) {

  const user = await getUserFromToken(req);
  if (!user) return res.status(401).json({ reply: '⚠️ Please sign in to use Trading Mode.', action: 'error' });

  const { message, includeSentinel, quickCommand } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

  // ── FAST PATH: Known quick commands bypass Claude entirely ──────────────
  const cmdKey = message.trim().toLowerCase();
  const quickType = QUICK_COMMANDS[cmdKey];

  if (quickType === 'daily_pnl') {
    const cacheKey = `sophia:daily_pnl:v4:${user.id}`;
    const cached = await redisGet(cacheKey);
    if (cached) return res.status(200).json(cached);

    // Fetch both user portfolio AND Sentinel data in parallel
    const [portfolio, sentinelData] = await Promise.all([
      getRealPortfolio(user.id),
      getSentinelStatus(),
    ]);

    const etDate = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const etTime = new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true });

    const lines = [`${etDate} · ${etTime} ET`, ''];

    // User's paper portfolio
    const enriched = await Promise.all((portfolio.positions || []).map(async p => {
      const price = await getLivePrice(p.symbol); const qty = parseFloat(p.quantity); const avg = parseFloat(p.avg_cost_basis); const cur = price || avg;
      return { ...p, current_price: cur, market_value: qty * cur, pnl: qty * cur - qty * avg };
    }));

    if (enriched.length > 0) {
      const unrealized = enriched.reduce((s,p)=>s+p.pnl,0);
      const totalMarketValue = enriched.reduce((s,p)=>s+p.market_value,0);
      const totalAccountValue = portfolio.cash + totalMarketValue;
      const allTimePnl = totalAccountValue - portfolio.starting;
      lines.push('YOUR PORTFOLIO');
      lines.push(`Unrealized: ${unrealized>=0?'+':''}$${Math.abs(unrealized).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`);
      lines.push(`All-time: ${allTimePnl>=0?'+':''}$${Math.abs(allTimePnl).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`);
      lines.push(`${enriched.length} positions · $${portfolio.cash.toLocaleString('en-US',{minimumFractionDigits:0})} cash`);
      lines.push('');
    }

    // Sentinel bot P&L (always show)
    if (sentinelData?.account) {
      const acc = sentinelData.account;
      const session = sentinelData.todaySession;
      const unrealized = sentinelData.totalUnrealizedPnl || 0;
      const todayRealized = session?.gross_pnl || 0;
      const todayTotal = todayRealized + unrealized;
      const totalPnl = (acc.total_pnl || 0) + unrealized;

      lines.push('SENTINEL BOT');
      lines.push(`Today: ${todayTotal>=0?'+':''}$${Math.abs(todayTotal).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})} (${session?.trades_closed||0} closed, ${sentinelData.openTrades?.length||0} open)`);
      lines.push(`All-time: ${totalPnl>=0?'+':''}$${Math.abs(totalPnl).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})} · ${(acc.win_rate||0).toFixed(1)}% WR · ${acc.closed_trades||0} trades`);
    }

    if (lines.length <= 2) {
      lines.push('No positions or Sentinel data available.');
    }

    const result = { action: 'info', reply: lines.join('\n') };
    await redisSet(cacheKey, result, 60);
    return res.status(200).json(result);
  }

  if (quickType === 'portfolio') {
    const cacheKey = `sophia:portfolio:v3:${user.id}`;
    const cached = await redisGet(cacheKey);
    if (cached) return res.status(200).json(cached);

    const portfolio = await getRealPortfolio(user.id);
    const enrichedPositions = await Promise.all((portfolio.positions || []).map(async p => {
      const price = await getLivePrice(p.symbol); const qty = parseFloat(p.quantity); const avg = parseFloat(p.avg_cost_basis); const cur = price || avg;
      return { symbol: p.symbol, qty, avg_cost: avg, current_price: cur, market_value: qty*cur, pnl: qty*cur - qty*avg, pnl_pct: avg>0 ? ((qty*cur - qty*avg)/(qty*avg))*100 : 0 };
    }));
    const totalMarketValue = enrichedPositions.reduce((s,p)=>s+p.market_value,0);
    const totalAccountValue = portfolio.cash + totalMarketValue;
    const totalPnl = totalAccountValue - portfolio.starting;
    const result = { action: 'portfolio', reply: '', portfolio: { cash: portfolio.cash, starting: portfolio.starting, totalValue: totalAccountValue, totalPnl, totalPnlPct: portfolio.starting > 0 ? (totalPnl/portfolio.starting)*100 : 0, positions: enrichedPositions } };
    await redisSet(cacheKey, result, 60);
    return res.status(200).json(result);
  }

  if (quickType === 'sentinel_pnl') {
    const sentinelData = await getSentinelStatus();
    if (!sentinelData) return res.status(200).json({ action: 'info', reply: 'Sentinel data unavailable right now.' });
    const acc = sentinelData.account || {};
    const totalPnl = acc.total_pnl || 0;
    const winRate = acc.win_rate || 0;
    const totalTrades = acc.closed_trades || 0;
    const unrealized = sentinelData.totalUnrealizedPnl || 0;
    const livePnl = totalPnl + unrealized;
    const reply = `Sentinel All-Time P&L\nRealized: ${totalPnl >= 0 ? '+' : ''}$${Math.abs(totalPnl).toLocaleString('en-US', {minimumFractionDigits:2})}\nUnrealized: ${unrealized >= 0 ? '+' : ''}$${Math.abs(unrealized).toLocaleString('en-US', {minimumFractionDigits:2})}\nLive Total: ${livePnl >= 0 ? '+' : ''}$${Math.abs(livePnl).toLocaleString('en-US', {minimumFractionDigits:2})}\nWin Rate: ${winRate.toFixed(1)}% · ${totalTrades} closed trades`;
    return res.status(200).json({ action: 'info', reply });
  }

  if (quickType === 'sentinel_daily') {
    const sentinelData = await getSentinelStatus();
    if (!sentinelData) return res.status(200).json({ action: 'info', reply: 'Sentinel data unavailable right now.' });
    const session = sentinelData.todaySession;
    const unrealized = sentinelData.totalUnrealizedPnl || 0;
    const realized = session?.gross_pnl || 0;
    const todayTotal = realized + unrealized;
    const etDate = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' });
    const etTime = new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true });
    const reply = `Sentinel Daily P&L · ${etDate}\n${etTime} ET\nRealized: ${realized >= 0 ? '+' : ''}$${Math.abs(realized).toLocaleString('en-US', {minimumFractionDigits:2})} (${session?.trades_closed || 0} trades closed)\nUnrealized: ${unrealized >= 0 ? '+' : ''}$${Math.abs(unrealized).toLocaleString('en-US', {minimumFractionDigits:2})} (${sentinelData.openTrades?.length || 0} open)\nToday Total: ${todayTotal >= 0 ? '+' : ''}$${Math.abs(todayTotal).toLocaleString('en-US', {minimumFractionDigits:2})}`;
    return res.status(200).json({ action: 'info', reply });
  }

  if (quickType === 'sentinel_trades') {
    const sentinelData = await getSentinelStatus();
    if (!sentinelData) return res.status(200).json({ action: 'info', reply: 'Sentinel data unavailable right now.' });
    const trades = sentinelData.openTrades || [];
    if (trades.length === 0) return res.status(200).json({ action: 'info', reply: 'No open Sentinel positions right now.' });
    const lines = trades.map(t => {
      const dir = t.direction === 'LONG' ? 'LONG' : 'SHORT';
      const sym = t.symbol.replace('/USD', '');
      const pnl = t.unrealized_pnl || 0;
      return `${dir} $${sym} · Entry $${parseFloat(t.entry).toLocaleString()} · Live $${(t.current_price || 0).toLocaleString()} · ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`;
    });
    const totalUnrealized = trades.reduce((s, t) => s + (t.unrealized_pnl || 0), 0);
    const reply = `Sentinel Open Positions (${trades.length})\n${lines.join('\n')}\nTotal Unrealized: ${totalUnrealized >= 0 ? '+' : ''}$${Math.abs(totalUnrealized).toFixed(2)}`;
    return res.status(200).json({ action: 'info', reply });
  }

  if (quickType === 'market_sentiment') {
    const cacheKey = `sophia:sentiment:v1`;
    const cached = await redisGet(cacheKey);
    if (cached) return res.status(200).json(cached);

    // Fetch live market data for sentiment analysis
    const symbols = 'SPY,QQQ,DIA,AAPL,NVDA,TSLA,BTC/USD,VIX';
    let quotes = {};
    try {
      const r = await fetch(`https://api.twelvedata.com/quote?symbol=${symbols}&apikey=${TWELVE_DATA_KEY}`);
      quotes = await r.json();
    } catch {}

    // Build context for Claude
    const marketContext = Object.entries(quotes).map(([sym, q]) => {
      if (!q?.close) return null;
      return `${sym}: $${parseFloat(q.close).toFixed(2)} (${parseFloat(q.percent_change) >= 0 ? '+' : ''}${parseFloat(q.percent_change).toFixed(2)}%)`;
    }).filter(Boolean).join('\n');

    const etTime = new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true });
    const etDate = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'short', day: 'numeric' });

    try {
      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 300,
          messages: [{
            role: 'user',
            content: `You are Sophia, a sharp trading AI. Give a concise real-time market sentiment reading based on this live data:\n\n${marketContext}\n\nTime: ${etTime} ET, ${etDate}\n\nRespond in this exact format:\n1. One word: BULLISH, BEARISH, or NEUTRAL\n2. One sentence explaining why based on the actual numbers above\n3. One sentence on what to watch next\n\nBe specific — cite the actual tickers and percentages. No fluff. Under 280 chars total after the sentiment word.`
          }],
        }),
      });
      const aiData = await aiRes.json();
      const sentimentText = aiData.content?.[0]?.text?.trim() || 'Market data unavailable.';
      const reply = `Market Sentiment · ${etDate} ${etTime} ET\n\n${sentimentText}`;
      const result = { action: 'info', reply };
      await redisSet(cacheKey, result, 120); // 2 min cache
      return res.status(200).json(result);
    } catch {
      return res.status(200).json({ action: 'info', reply: 'Could not fetch market sentiment right now. Try again in a minute.' });
    }
  }
  // ── END FAST PATH ────────────────────────────────────────────────────────

  try {
    console.log('[sophia-trade] Processing message:', message.slice(0,50), '| user:', user.id.slice(0,8));
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

Return JSON only. Choose the right action:

1. User asks about TODAY'S P&L / daily P&L / how am I doing today:
{"action":"info","reply":"Today [DATE] [TIME ET]: your paper portfolio is [UP/DOWN] $X.XX ([+/-]X.XX%) on the day."}
Use the today_pnl value from the data. Keep it to one line. Date + time + number. Nothing else.

2. User asks to SEE their positions / holdings / what they own / portfolio breakdown:
{"action":"portfolio","reply":""}

3. User asks about Sentinel bot:
{"action":"sentinel","reply":""}

4. User wants to execute a trade:
{"action":"trade","symbol":"AAPL","side":"buy","qty":10,"reply":""}

5. Everything else:
{"action":"info","reply":"One concise sentence answer."}

CRITICAL: Match the question to the action. "daily P&L" or "today's P&L" = action:info with just the date, time and number. NOT action:portfolio.`;

    // Calculate today's P&L from recent trades
    const etNow = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
    const etDate = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const etTime = new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true });
    const todayMidnight = new Date(); todayMidnight.setHours(0,0,0,0);
    const todayTrades = portfolio.recentTrades.filter(t => new Date(t.created_at) >= todayMidnight);
    const todayPnl = todayTrades.reduce((s, t) => {
      if (t.side === 'sell') return s + (t.price * t.quantity - t.total_cost);
      return s;
    }, 0);

    const userPrompt = `User asks: "${message}"

THEIR REAL PAPER PORTFOLIO RIGHT NOW:
- Current ET date/time: ${etDate} at ${etTime}
- Cash balance: $${portfolio.cash.toLocaleString()}
- Starting balance: $${portfolio.starting.toLocaleString()}
- Total account value: $${totalAccountValue.toFixed(2)}
- All-time P&L: ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}
- Today's realized P&L: ${todayPnl >= 0 ? '+' : ''}$${todayPnl.toFixed(2)} (from ${todayTrades.length} trades today)
- Unrealized P&L on open positions: ${enrichedPositions.reduce((s,p)=>s+p.pnl,0) >= 0 ? '+' : ''}$${enrichedPositions.reduce((s,p)=>s+p.pnl,0).toFixed(2)}
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
    console.error('[sophia-trade] CRASH:', err.message, err.stack?.slice(0,300));
    return res.status(200).json({ reply: `❌ Error: ${err.message}`, action: 'error' });
  }
}
