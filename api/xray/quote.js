import { fetchTwelveData } from '../lib/twelvedata.js';
import { supabase } from '../lib/supabase.js';

const toInt = (value) => {
  if (value == null || value === '') return null;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
};

const toFloat = (value) => {
  if (value == null || value === '') return null;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const symbol = String(req.query?.symbol || '').trim().toUpperCase();

  if (!symbol) {
    return res.status(400).json({ error: 'symbol required' });
  }

  try {
    const td = await fetchTwelveData('quote', { symbol });

    if (td?.status === 'error') {
      return res.status(400).json({ error: td.message || 'Twelve Data error' });
    }

    const row = {
      symbol,
      price: toFloat(td.close),
      change: toFloat(td.change),
      change_percent: toFloat(td.percent_change),
      volume: toInt(td.volume),
      open: toFloat(td.open),
      high: toFloat(td.high),
      low: toFloat(td.low),
      previous_close: toFloat(td.previous_close),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('xray_quotes').upsert(row, { onConflict: 'symbol' });
    if (error) {
      console.error('[xray] quote upsert error:', error);
    }

    return res.status(200).json({ data: row });
  } catch (error) {
    console.error('[xray] quote error:', error);
    return res.status(error?.status || 500).json({ error: error?.message || 'Unexpected server error' });
  }
}
