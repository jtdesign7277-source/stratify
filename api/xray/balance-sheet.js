import { fetchTwelveData } from '../lib/twelvedata.js';
import { supabase } from '../lib/supabase.js';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const toInt = (value) => {
  if (value == null || value === '') return null;
  const parsed = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
};

const normalizePeriod = (value) => {
  const text = String(value || 'annual').toLowerCase();
  return text === 'quarterly' ? 'quarterly' : 'annual';
};

const parseRows = (symbol, period, statements) =>
  (Array.isArray(statements) ? statements : []).map((s) => ({
    symbol,
    period,
    fiscal_date: s.fiscal_date,
    total_assets: toInt(s.total_assets),
    current_assets: toInt(s.current_assets),
    cash_and_equivalents: toInt(s.cash_and_short_term_investments),
    short_term_investments: toInt(s.short_term_investments),
    accounts_receivable: toInt(s.accounts_receivable),
    inventory: toInt(s.inventory),
    non_current_assets: toInt(s.non_current_assets),
    property_plant_equipment: toInt(s.property_plant_and_equipment),
    goodwill: toInt(s.goodwill),
    intangible_assets: toInt(s.intangible_assets),
    total_liabilities: toInt(s.total_liabilities),
    current_liabilities: toInt(s.current_liabilities),
    accounts_payable: toInt(s.accounts_payable),
    short_term_debt: toInt(s.short_term_debt),
    non_current_liabilities: toInt(s.non_current_liabilities),
    long_term_debt: toInt(s.long_term_debt),
    total_equity: toInt(s.shareholders_equity),
    retained_earnings: toInt(s.retained_earnings),
    raw_json: s,
    fetched_at: new Date().toISOString(),
  }));

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const symbol = String(req.query?.symbol || '').trim().toUpperCase();
  const period = normalizePeriod(req.query?.period);

  if (!symbol) {
    return res.status(400).json({ error: 'symbol required' });
  }

  try {
    const { data: cached, error: cacheError } = await supabase
      .from('xray_balance_sheet')
      .select('*')
      .eq('symbol', symbol)
      .eq('period', period)
      .gte('fetched_at', new Date(Date.now() - CACHE_TTL_MS).toISOString())
      .order('fiscal_date', { ascending: false })
      .limit(20);

    if (!cacheError && Array.isArray(cached) && cached.length > 0) {
      return res.status(200).json({ source: 'cache', data: cached });
    }

    const td = await fetchTwelveData('balance_sheet', { symbol, period });

    if (td?.status === 'error') {
      return res.status(400).json({ error: td.message || 'Twelve Data error' });
    }

    const rows = parseRows(symbol, period, td?.balance_sheet);

    if (rows.length > 0) {
      const { error } = await supabase
        .from('xray_balance_sheet')
        .upsert(rows, { onConflict: 'symbol,period,fiscal_date' });

      if (error) {
        console.error('[xray] balance sheet upsert error:', error);
      }
    }

    return res.status(200).json({ source: 'twelvedata', data: rows });
  } catch (error) {
    console.error('[xray] balance sheet error:', error);
    return res.status(error?.status || 500).json({ error: error?.message || 'Unexpected server error' });
  }
}
