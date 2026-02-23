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
    operating_cash_flow: toInt(s.operating_cash_flow),
    investing_cash_flow: toInt(s.investing_cash_flow),
    financing_cash_flow: toInt(s.financing_cash_flow),
    capital_expenditure: toInt(s.capital_expenditure),
    free_cash_flow: toInt(s.free_cash_flow),
    dividends_paid: toInt(s.dividends_paid),
    share_repurchase: toInt(s.share_repurchase || s.share_based_compensation),
    debt_repayment: toInt(s.debt_repayment),
    net_change_in_cash: toInt(s.net_change_in_cash),
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
      .from('xray_cash_flow')
      .select('*')
      .eq('symbol', symbol)
      .eq('period', period)
      .gte('fetched_at', new Date(Date.now() - CACHE_TTL_MS).toISOString())
      .order('fiscal_date', { ascending: false })
      .limit(20);

    if (!cacheError && Array.isArray(cached) && cached.length > 0) {
      return res.status(200).json({ source: 'cache', data: cached });
    }

    const td = await fetchTwelveData('cash_flow', { symbol, period });

    if (td?.status === 'error') {
      return res.status(400).json({ error: td.message || 'Twelve Data error' });
    }

    const rows = parseRows(symbol, period, td?.cash_flow);

    if (rows.length > 0) {
      const { error } = await supabase
        .from('xray_cash_flow')
        .upsert(rows, { onConflict: 'symbol,period,fiscal_date' });

      if (error) {
        console.error('[xray] cash flow upsert error:', error);
      }
    }

    return res.status(200).json({ source: 'twelvedata', data: rows });
  } catch (error) {
    console.error('[xray] cash flow error:', error);
    return res.status(error?.status || 500).json({ error: error?.message || 'Unexpected server error' });
  }
}
