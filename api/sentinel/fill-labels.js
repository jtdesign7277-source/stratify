// api/sentinel/fill-labels.js — Backfill ML labels on stored features
// Runs periodically to label past feature rows with actual outcomes
// Label: did price go up or down in the next 30 min (6 x 5min bars)?

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const TD_KEY = process.env.TWELVE_DATA_API_KEY || process.env.TWELVEDATA_API_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // Find unlabeled features that are old enough (30+ min ago for 5min, 4h+ for 1h)
    const cutoff5m = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 min ago
    const cutoff1h = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(); // 4h ago

    const { data: unlabeled } = await supabase
      .from('sentinel_features')
      .select('id, symbol, timeframe, price, created_at')
      .eq('label_filled', false)
      .lt('created_at', cutoff5m)
      .order('created_at', { ascending: true })
      .limit(50);

    if (!unlabeled?.length) {
      return res.status(200).json({ labeled: 0, message: 'No features ready for labeling' });
    }

    let labeled = 0;

    for (const row of unlabeled) {
      try {
        // Fetch current price for the symbol
        const r = await fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(row.symbol)}&apikey=${TD_KEY}`);
        const data = await r.json();
        const currentPrice = parseFloat(data.close || '0');

        if (!currentPrice || !row.price) continue;

        // Compute actual return since feature was stored
        const actualReturn = (currentPrice - row.price) / row.price;

        // Binary label: 1 = price went up, 0 = price went down
        // Use a small threshold to filter noise (0.1% dead zone)
        let label = null;
        if (actualReturn > 0.001) label = 1;
        else if (actualReturn < -0.001) label = 0;
        // else null = dead zone, excluded from training

        await supabase.from('sentinel_features').update({
          label_direction: label,
          label_return: Math.round(actualReturn * 100000) / 100000,
          label_filled: true,
          label_filled_at: new Date().toISOString(),
        }).eq('id', row.id);

        labeled++;
      } catch { /* skip this row */ }
    }

    return res.status(200).json({ labeled, total: unlabeled.length });
  } catch (err) {
    console.error('[fill-labels] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
