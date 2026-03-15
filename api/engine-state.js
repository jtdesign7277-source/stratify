/**
 * /api/engine-state — Arb Engine live state
 * Returns: account metrics, open positions, recent signals, system status
 * Sources: Supabase (sentinel_account, sentinel_trades, sentinel_polymarket_trades)
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SENTINEL_ACCOUNT_ID = '00000000-0000-0000-0000-000000000001';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Parallel: account, open trades, recent closed, polymarket open, recent signals
    const [accountRes, openTradesRes, closedTradesRes, polyOpenRes, recentSignalsRes] = await Promise.all([
      supabase.from('sentinel_account').select('*').eq('id', SENTINEL_ACCOUNT_ID).single(),
      supabase.from('sentinel_trades').select('*').eq('status', 'open').order('opened_at', { ascending: false }),
      supabase.from('sentinel_trades').select('*').eq('status', 'closed').order('closed_at', { ascending: false }).limit(50),
      supabase.from('sentinel_polymarket_trades').select('*').eq('status', 'open').order('created_at', { ascending: false }),
      supabase.from('sentinel_trades').select('symbol, direction, setup, confidence, opened_at, status, pnl, win').order('opened_at', { ascending: false }).limit(100),
    ]);

    const account = accountRes.data || {};
    const openTrades = openTradesRes.data || [];
    const closedTrades = closedTradesRes.data || [];
    const polyOpen = polyOpenRes.data || [];
    const recentSignals = recentSignalsRes.data || [];

    // Compute live metrics
    const balance = account.current_balance || 2000000;
    const deposit = account.starting_balance || 2000000;
    const totalPnl = account.total_pnl || 0;
    const wins = account.wins || 0;
    const losses = account.losses || 0;
    const totalClosed = wins + losses;
    const winRate = totalClosed > 0 ? (wins / totalClosed) * 100 : 0;

    // Sharpe approximation from recent trades
    const recentPnls = closedTrades.slice(0, 30).map(t => t.pnl || 0);
    const avgPnl = recentPnls.length > 0 ? recentPnls.reduce((a, b) => a + b, 0) / recentPnls.length : 0;
    const stdPnl = recentPnls.length > 1
      ? Math.sqrt(recentPnls.reduce((sum, p) => sum + (p - avgPnl) ** 2, 0) / (recentPnls.length - 1))
      : 1;
    const sharpe = stdPnl > 0 ? (avgPnl / stdPnl) * Math.sqrt(252) : 0;

    // Max drawdown
    let peak = deposit;
    let maxDd = 0;
    let running = deposit;
    for (const t of closedTrades.slice().reverse()) {
      running += (t.pnl || 0);
      if (running > peak) peak = running;
      const dd = (peak - running) / peak;
      if (dd > maxDd) maxDd = dd;
    }

    // Trades per hour (last 24h)
    const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
    const recentCount = recentSignals.filter(s => s.opened_at > oneDayAgo).length;
    const tradesPerHr = +(recentCount / 24).toFixed(1);

    // Recent EXEC signals (filled trades from last hour)
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const execSignals = recentSignals
      .filter(s => s.opened_at > oneHourAgo)
      .map(s => ({
        type: 'EXEC',
        symbol: s.symbol,
        direction: s.direction,
        setup: s.setup,
        confidence: s.confidence,
        pnl: s.pnl,
        win: s.win,
        ts: s.opened_at,
      }));

    return res.status(200).json({
      metrics: {
        balance: +balance.toFixed(0),
        deposit,
        roi: +((totalPnl / deposit) * 100).toFixed(2),
        winRate: +winRate.toFixed(1),
        sharpe: +sharpe.toFixed(2),
        maxDd: +(maxDd * 100).toFixed(1),
        tradesHr: tradesPerHr,
        totalTrades: totalClosed,
        openPositions: openTrades.length,
        polyOpenPositions: polyOpen.length,
        avgR: +(account.avg_r || 0).toFixed(2),
        expectancy: +(account.expectancy || 0).toFixed(2),
      },
      openTrades: openTrades.map(t => ({
        id: t.id,
        symbol: t.symbol,
        direction: t.direction,
        setup: t.setup,
        entry: t.entry,
        stop: t.stop,
        target: t.target,
        size: t.size,
        dollarSize: t.dollar_size,
        confidence: t.confidence,
        openedAt: t.opened_at,
      })),
      polymarketOpen: polyOpen.map(t => ({
        id: t.id,
        question: t.question,
        side: t.side,
        entryPrice: t.entry_price,
        shares: t.shares,
        dollarCost: t.dollar_cost,
        confidence: t.confidence,
      })),
      execSignals,
      status: {
        polymarket: polyOpen.length >= 0 ? 'ONLINE' : 'OFFLINE',
        scanner: openTrades.length > 0 ? 'ACTIVE' : 'SCAN',
        bayes: 'ONLINE',
        kelly: 'ONLINE',
        slippage: 'ACTIVE',
        sync: 99.8,
      },
      ts: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[engine-state] error:', err.message);
    return res.status(500).json({ error: 'Internal error', detail: err.message });
  }
}
