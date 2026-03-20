// api/sentinel/experiments.js
// GET /api/sentinel/experiments?tag=auto&limit=50
// Returns recent autoresearch experiments for the Heartbeat dashboard

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });

  const { tag = 'auto', limit = '50' } = req.query;
  const maxRows = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));

  try {
    // Recent experiments — select actual DB column names
    const { data: rawExps, error: expErr } = await supabase
      .from('sentinel_experiments')
      .select('id, iteration, changed_param, changed_to, backtest_win_rate, backtest_total_pnl, backtest_max_drawdown, backtest_trades, composite_score, status, parameters, created_at')
      .eq('experiment_tag', tag)
      .order('created_at', { ascending: false })
      .limit(maxRows);

    if (expErr) throw expErr;

    // Remap to field names that HeartbeatPage.jsx expects
    const experiments = (rawExps || []).map(e => ({
      id: e.id,
      iteration: e.iteration,
      tweaked_key: e.changed_param,
      tweaked_val: e.changed_to,
      win_rate: e.backtest_win_rate,
      total_pnl: e.backtest_total_pnl,
      max_drawdown: e.backtest_max_drawdown,
      trade_count: e.backtest_trades,
      score: e.composite_score,
      status: e.status,
      params: e.parameters,
      created_at: e.created_at,
    }));

    // Best params — keyed by id=1 (single row, no tag column)
    const { data: bestRaw, error: bpErr } = await supabase
      .from('sentinel_best_params')
      .select('*')
      .eq('id', 1)
      .single();

    if (bpErr && bpErr.code !== 'PGRST116') throw bpErr; // ignore not-found

    // Remap best_params: composite_score → score
    const bestParams = bestRaw
      ? { ...bestRaw, score: bestRaw.composite_score }
      : null;

    return res.status(200).json({
      ok: true,
      tag,
      experiments,
      best_params: bestParams,
    });
  } catch (err) {
    console.error('[experiments] error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
