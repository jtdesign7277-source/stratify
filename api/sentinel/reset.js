// api/sentinel/reset.js — Full Sentinel reset: wipe all trades, sessions, reset account to $2M
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const ACCOUNT_ID = '00000000-0000-0000-0000-000000000001';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Delete all trades (open + closed)
    await supabase.from('sentinel_trades').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    // Delete all copied trades
    await supabase.from('sentinel_copied_trades').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    // Delete all sessions
    await supabase.from('sentinel_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    // Delete all notifications
    await supabase.from('sentinel_notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // Reset account to $2M starting balance, zero everything
    await supabase.from('sentinel_account').update({
      current_balance: 2000000,
      total_pnl: 0,
      total_trades: 0,
      closed_trades: 0,
      wins: 0,
      losses: 0,
      win_rate: 0,
      avg_r: 0,
      expectancy: 0,
      updated_at: new Date().toISOString(),
    }).eq('id', ACCOUNT_ID);

    // Reset brain memory weights but keep structure
    await supabase.from('sentinel_memory').update({
      setup_weights: {},
      regime_filters: {},
      ticker_weights: {},
      timeframe_weights: {},
      suspended_conditions: [],
      updated_at: new Date().toISOString(),
    }).eq('id', 1);

    return res.status(200).json({
      success: true,
      message: 'Sentinel fully reset. $2,000,000 starting balance. All trades, sessions, and metrics wiped.',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[sentinel/reset] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
