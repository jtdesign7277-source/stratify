// api/sentinel/reconcile-sessions.js
// Recomputes gross_pnl, wins, losses, trades_closed for all sessions
// from actual closed trade data. Run this whenever sessions show $0.
// POST /api/sentinel/reconcile-sessions  (requires CRON_SECRET)

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Pull all closed trades that have a session_date
    const { data: trades, error: tradesErr } = await supabase
      .from('sentinel_trades')
      .select('session_date, pnl, win, status')
      .eq('status', 'closed')
      .not('session_date', 'is', null);

    if (tradesErr) throw new Error('Failed to fetch trades: ' + tradesErr.message);

    // Group trades by session_date
    const byDate = {};
    for (const trade of trades || []) {
      const d = trade.session_date;
      if (!d) continue;
      if (!byDate[d]) byDate[d] = { gross_pnl: 0, wins: 0, losses: 0, trades_closed: 0 };
      byDate[d].gross_pnl += trade.pnl || 0;
      byDate[d].trades_closed++;
      if (trade.win) byDate[d].wins++; else byDate[d].losses++;
    }

    // Pull all existing sessions
    const { data: sessions, error: sessionsErr } = await supabase
      .from('sentinel_sessions')
      .select('id, session_date, gross_pnl, wins, losses, trades_closed');

    if (sessionsErr) throw new Error('Failed to fetch sessions: ' + sessionsErr.message);

    const results = [];

    for (const session of sessions || []) {
      const computed = byDate[session.session_date];
      if (!computed) continue; // No closed trades for this session — leave it

      const newPnl = +computed.gross_pnl.toFixed(2);
      const changed =
        Math.abs((session.gross_pnl || 0) - newPnl) > 0.01 ||
        (session.wins || 0) !== computed.wins ||
        (session.losses || 0) !== computed.losses ||
        (session.trades_closed || 0) !== computed.trades_closed;

      if (changed) {
        const { error: updateErr } = await supabase
          .from('sentinel_sessions')
          .update({
            gross_pnl: newPnl,
            wins: computed.wins,
            losses: computed.losses,
            trades_closed: computed.trades_closed,
          })
          .eq('id', session.id);

        results.push({
          date: session.session_date,
          old_pnl: session.gross_pnl,
          new_pnl: newPnl,
          wins: computed.wins,
          losses: computed.losses,
          trades_closed: computed.trades_closed,
          error: updateErr?.message || null,
        });
      }
    }

    // Also create sessions for dates that have trades but no session row
    const existingDates = new Set((sessions || []).map(s => s.session_date));
    const created = [];
    for (const [date, computed] of Object.entries(byDate)) {
      if (!existingDates.has(date)) {
        const { error: insertErr } = await supabase
          .from('sentinel_sessions')
          .insert({
            session_date: date,
            gross_pnl: +computed.gross_pnl.toFixed(2),
            wins: computed.wins,
            losses: computed.losses,
            trades_closed: computed.trades_closed,
            trades_fired: computed.trades_closed,
          });
        created.push({ date, pnl: +computed.gross_pnl.toFixed(2), error: insertErr?.message || null });
      }
    }

    // Bust the Redis cache so next page load gets fresh data
    try {
      const redis = (await import('../lib/redis.js')).default;
      await redis.del('sentinel:status');
    } catch { /* ignore if redis unavailable */ }

    return res.status(200).json({
      success: true,
      updated: results.length,
      created: created.length,
      details: results,
      new_sessions: created,
    });
  } catch (err) {
    console.error('[reconcile-sessions] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
