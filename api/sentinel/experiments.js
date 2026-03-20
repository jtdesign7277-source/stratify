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
    // Recent experiments
    const { data: experiments, error: expErr } = await supabase
      .from('sentinel_experiments')
      .select('id, iteration, tweaked_key, tweaked_val, win_rate, total_pnl, max_drawdown, trade_count, score, status, params, created_at')
      .eq('tag', tag)
      .order('created_at', { ascending: false })
      .limit(maxRows);

    if (expErr) throw expErr;

    // Best params for this tag
    const { data: bestParams, error: bpErr } = await supabase
      .from('sentinel_best_params')
      .select('*')
      .eq('tag', tag)
      .single();

    if (bpErr && bpErr.code !== 'PGRST116') throw bpErr; // ignore not-found

    return res.status(200).json({
      ok: true,
      tag,
      experiments: experiments || [],
      best_params: bestParams || null,
    });
  } catch (err) {
    console.error('[experiments] error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
