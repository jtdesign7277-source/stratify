// api/sentinel/apply-params.js
// Bridge: reads the best autoresearch params from sentinel_best_params
// and writes them into sentinel_memory so the live heartbeat picks them up.
//
// POST /api/sentinel/apply-params
// Auth: Bearer CRON_SECRET
// Body: { tag: "auto" }

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Base confidence for scalp setups — same as heartbeat-crypto.js BASE_MIN_CONFIDENCE_SCALP
const BASE_MIN_CONFIDENCE_SCALP = 55;

// Scalp setups affected by min_confidence_scalp
const SCALP_SETUPS = ['Momentum Burst', 'Mean Reversion', 'EMA8 Bounce', 'Momentum Long', 'Momentum Short'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const auth = req.headers.authorization || '';
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { tag = 'auto' } = req.body || {};

  // ── Read best params for this tag ────────────────────────────────────────
  const { data: bestEntry, error: bestErr } = await supabase
    .from('sentinel_best_params')
    .select('*')
    .eq('tag', tag)
    .single();

  if (bestErr || !bestEntry) {
    return res.status(404).json({ error: `No best params found for tag="${tag}"`, detail: bestErr?.message });
  }

  const params = bestEntry.params || {};

  // ── Read current sentinel_memory ──────────────────────────────────────────
  const { data: memory } = await supabase
    .from('sentinel_memory')
    .select('*')
    .eq('id', 1)
    .single();

  const current = memory || {};

  // ── Map autoresearch params → sentinel_memory.confidence_adjustments ──────
  // min_confidence_scalp changes the base threshold; store as delta from default.
  const confAdjustments = { ...(current.confidence_adjustments || {}) };
  if (params.min_confidence_scalp !== undefined) {
    const delta = Math.round(params.min_confidence_scalp - BASE_MIN_CONFIDENCE_SCALP);
    for (const setup of SCALP_SETUPS) {
      confAdjustments[setup] = delta;
    }
  }

  // ── Map remaining params → sentinel_memory.config ─────────────────────────
  // These are read by future heartbeat iterations and the scan engine.
  const newConfig = {
    ...(current.config || {}),
    // Bayesian gate threshold
    bayes_threshold: params.bayes_threshold,
    // Position sizing
    stop_mult_scalp:  params.stop_mult_scalp,
    target_mult_scalp: params.target_mult_scalp,
    kelly_max_risk:   params.kelly_max_risk,
    mc_max_drawdown:  params.mc_max_drawdown,
    // Signal generation
    ema_fast:                 params.ema_fast,
    ema_slow:                 params.ema_slow,
    rsi_oversold:             params.rsi_oversold,
    rsi_overbought:           params.rsi_overbought,
    momentum_burst_threshold: params.momentum_burst_threshold,
    mean_reversion_threshold: params.mean_reversion_threshold,
    // Execution cost model
    spread_cost_pct: params.spread_cost_pct,
    // Provenance
    applied_from_tag: tag,
    applied_at:       new Date().toISOString(),
    applied_score:    bestEntry.score,
    applied_win_rate: bestEntry.win_rate,
    applied_pnl:      bestEntry.total_pnl,
  };

  // ── Upsert sentinel_memory ───────────────────────────────────────────────
  const { error: upsertErr } = await supabase
    .from('sentinel_memory')
    .upsert(
      {
        id: 1,
        ...current,
        confidence_adjustments: confAdjustments,
        config: newConfig,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

  if (upsertErr) {
    return res.status(500).json({ error: 'Failed to write sentinel_memory', detail: upsertErr.message });
  }

  return res.status(200).json({
    ok: true,
    tag,
    score: bestEntry.score,
    params_applied: params,
    config_written: newConfig,
    confidence_adjustments_written: confAdjustments,
  });
}
