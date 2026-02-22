import { fetchTwelveData } from '../lib/twelvedata.js';
import { supabase } from '../lib/supabase.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const toInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizePeriod = (period) => (String(period || '').toLowerCase() === 'quarterly' ? 'quarterly' : 'annual');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { symbol, period = 'annual' } = req.query;
  if (!symbol) return res.status(400).json({ error: 'symbol required' });

  const sym = String(symbol).trim().toUpperCase();
  const normalizedPeriod = normalizePeriod(period);

  try {
    const { data: cached, error: cacheError } = await supabase
      .from('xray_balance_sheet')
      .select('*')
      .eq('symbol', sym)
      .eq('period', normalizedPeriod)
      .gte('fetched_at', new Date(Date.now() - DAY_MS).toISOString())
      .order('fiscal_date', { ascending: false })
      .limit(20);

    if (!cacheError && Array.isArray(cached) && cached.length > 0) {
      return res.status(200).json({ source: 'cache', data: cached });
    }

    const td = await fetchTwelveData('balance_sheet', {
      symbol: sym,
      period: normalizedPeriod,
    });

    const statements = Array.isArray(td?.balance_sheet) ? td.balance_sheet : [];
    const rows = statements.map((statement) => ({
      symbol: sym,
      period: normalizedPeriod,
      fiscal_date: statement?.fiscal_date || null,
      total_assets: toInt(statement?.total_assets),
      current_assets: toInt(statement?.current_assets),
      cash_and_equivalents: toInt(statement?.cash_and_short_term_investments),
      short_term_investments: toInt(statement?.short_term_investments),
      accounts_receivable: toInt(statement?.accounts_receivable),
      inventory: toInt(statement?.inventory),
      non_current_assets: toInt(statement?.non_current_assets),
      property_plant_equipment: toInt(statement?.property_plant_and_equipment),
      goodwill: toInt(statement?.goodwill),
      intangible_assets: toInt(statement?.intangible_assets),
      total_liabilities: toInt(statement?.total_liabilities),
      current_liabilities: toInt(statement?.current_liabilities),
      accounts_payable: toInt(statement?.accounts_payable),
      short_term_debt: toInt(statement?.short_term_debt),
      non_current_liabilities: toInt(statement?.non_current_liabilities),
      long_term_debt: toInt(statement?.long_term_debt),
      total_equity: toInt(statement?.shareholders_equity),
      retained_earnings: toInt(statement?.retained_earnings),
      raw_json: statement,
      fetched_at: new Date().toISOString(),
    }));

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from('xray_balance_sheet')
        .upsert(rows, { onConflict: 'symbol,period,fiscal_date' });

      if (upsertError) {
        console.error('[xray/balance-sheet] Supabase upsert error:', upsertError);
      }
    }

    return res.status(200).json({ source: 'twelvedata', data: rows });
  } catch (error) {
    const status = Number(error?.status) || 500;
    console.error('[xray/balance-sheet] error:', error);
    return res.status(status).json({ error: error?.message || 'Failed to fetch balance sheet' });
  }
}
