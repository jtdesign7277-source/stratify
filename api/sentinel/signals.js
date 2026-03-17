// api/sentinel/signals.js — Real-time signal feed for Training Stream UI
// GET — returns latest signal evaluations from all 5 models
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const limit = Math.min(parseInt(req.query.limit) || 100, 200);
    const since = req.query.since || null; // ISO timestamp for polling

    let query = supabase
      .from('sentinel_signals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (since) {
      query = query.gt('created_at', since);
    }

    const { data: signals, error } = await query;
    if (error) throw error;

    // Also fetch current model weights for UI panels
    const { data: weights } = await supabase
      .from('sentinel_model_weights')
      .select('*')
      .eq('id', 1)
      .single();

    // Aggregate latest model values from most recent trade signal
    const latestTrade = (signals || []).find(s => s.trade_fired);
    const latestScan = (signals || []).find(s => s.signal_type !== 'SCAN');

    return res.status(200).json({
      signals: (signals || []).map(s => ({
        id: s.id,
        t: s.created_at,
        type: s.signal_type,
        symbol: s.symbol,
        timeframe: s.timeframe,
        direction: s.direction,
        score: s.composite_score,
        fired: s.trade_fired,
        price: s.price_at_signal,
        regime: s.regime,
        // Model values for panel display
        bayesian: s.bayesian_posterior ? {
          prior: s.bayesian_prior,
          posterior: s.bayesian_posterior,
          ev: s.bayesian_ev,
          confidence: s.bayesian_confidence,
        } : null,
        edge: s.edge_ev_net != null ? {
          ev: s.edge_ev_net,
          cost: s.edge_cost,
          zScore: s.edge_z_score,
          pass: s.edge_pass,
        } : null,
        stoikov: s.stoikov_reservation ? {
          q: s.stoikov_q,
          gamma: s.stoikov_gamma,
          sigma2: s.stoikov_sigma_sq,
          reservation: s.stoikov_reservation,
          optimalSize: s.stoikov_optimal_size,
        } : null,
        mc: s.mc_kelly_fraction != null ? {
          kelly: s.mc_kelly_fraction,
          maxDd: s.mc_max_dd_pct,
          paths: s.mc_paths_simulated,
        } : null,
      })),
      // Latest model state for panel readouts
      latestModels: latestScan ? {
        bayesian: {
          prior: latestScan.bayesian_prior,
          posterior: latestScan.bayesian_posterior,
          ev: latestScan.bayesian_ev,
          confidence: latestScan.bayesian_confidence,
        },
        edge: {
          ev: latestScan.edge_ev_net,
          cost: latestScan.edge_cost,
          zScore: latestScan.edge_z_score,
          pass: latestScan.edge_pass,
        },
        stoikov: {
          q: latestScan.stoikov_q,
          gamma: latestScan.stoikov_gamma,
          sigma2: latestScan.stoikov_sigma_sq,
          reservation: latestScan.stoikov_reservation,
        },
        mc: {
          kelly: latestScan.mc_kelly_fraction,
          maxDd: latestScan.mc_max_dd_pct,
          paths: latestScan.mc_paths_simulated,
        },
      } : null,
      weights: weights || {},
      count: (signals || []).length,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[sentinel/signals] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
