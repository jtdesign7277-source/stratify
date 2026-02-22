import { fetchTwelveData } from '../lib/twelvedata.js';
import { supabase } from '../lib/supabase.js';

const toInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const toFloat = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  const sym = String(symbol).trim().toUpperCase();

  try {
    const quote = await fetchTwelveData('quote', { symbol: sym });

    const row = {
      symbol: sym,
      price: toFloat(quote?.close),
      change: toFloat(quote?.change),
      change_percent: toFloat(quote?.percent_change),
      volume: toInt(quote?.volume),
      open: toFloat(quote?.open),
      high: toFloat(quote?.high),
      low: toFloat(quote?.low),
      previous_close: toFloat(quote?.previous_close),
      updated_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from('xray_quotes')
      .upsert(row, { onConflict: 'symbol' });

    if (upsertError) {
      console.error('[xray/quote] Supabase upsert error:', upsertError);
    }

    return res.status(200).json({ data: row });
  } catch (error) {
    const status = Number(error?.status) || 500;
    console.error('[xray/quote] error:', error);
    return res.status(status).json({ error: error?.message || 'Failed to fetch quote' });
  }
}
