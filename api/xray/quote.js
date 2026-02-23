import { fetchTwelveData } from '../lib/twelvedata.js';
import { supabase } from '../lib/supabase.js';

const parseNumeric = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const raw = String(value).trim();
  if (!raw) return null;

  const suffixMatch = raw.match(/^(-?\d+(?:\.\d+)?)([kKmMbBtT])$/);
  if (suffixMatch) {
    const base = Number.parseFloat(suffixMatch[1]);
    if (!Number.isFinite(base)) return null;
    const multiplier = {
      k: 1e3,
      m: 1e6,
      b: 1e9,
      t: 1e12,
    }[suffixMatch[2].toLowerCase()] || 1;
    return base * multiplier;
  }

  const cleaned = raw.replace(/[$,%\s,]/g, '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const toInt = (value) => {
  const parsed = parseNumeric(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed);
};

const toFloat = (value) => {
  const parsed = parseNumeric(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const firstFiniteFloat = (...candidates) => {
  for (const candidate of candidates) {
    const parsed = toFloat(candidate);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const firstFiniteInt = (...candidates) => {
  for (const candidate of candidates) {
    const parsed = toInt(candidate);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
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
    const quoteData =
      quote && typeof quote === 'object' && quote.quote && typeof quote.quote === 'object'
        ? quote.quote
        : quote;

    const row = {
      symbol: sym,
      price: firstFiniteFloat(
        quoteData?.price,
        quoteData?.close,
        quoteData?.last,
        quoteData?.last_price,
        quoteData?.c
      ),
      change: firstFiniteFloat(
        quoteData?.change,
        quoteData?.price_change,
        quoteData?.change_value
      ),
      change_percent: firstFiniteFloat(
        quoteData?.percent_change,
        quoteData?.change_percent,
        quoteData?.percentChange
      ),
      volume: firstFiniteInt(
        quoteData?.volume,
        quoteData?.day_volume,
        quoteData?.avg_volume,
        quoteData?.average_volume
      ),
      open: firstFiniteFloat(quoteData?.open, quoteData?.o),
      high: firstFiniteFloat(quoteData?.high, quoteData?.h),
      low: firstFiniteFloat(quoteData?.low, quoteData?.l),
      previous_close: firstFiniteFloat(
        quoteData?.previous_close,
        quoteData?.prev_close,
        quoteData?.previousClose
      ),
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
