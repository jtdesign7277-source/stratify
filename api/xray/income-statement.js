import { fetchTwelveData } from '../lib/twelvedata.js';
import { supabase } from '../lib/supabase.js';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

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

const normalizePeriod = (value) => {
  const text = String(value || 'annual').toLowerCase();
  return text === 'quarterly' ? 'quarterly' : 'annual';
};

const calcMargin = (numerator, denominator) => {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return Number(((numerator / denominator) * 100).toFixed(2));
};

const parseIncomeRows = (symbol, period, statements) =>
  (Array.isArray(statements) ? statements : []).map((s) => {
    const totalRevenue = toInt(s.sales);
    const grossProfit = toInt(s.gross_profit);
    const operatingIncome = toInt(s.operating_income);
    const netIncome = toInt(s.net_income);

    return {
      symbol,
      period,
      fiscal_date: s.fiscal_date,
      total_revenue: totalRevenue,
      cost_of_revenue: toInt(s.cost_of_goods),
      gross_profit: grossProfit,
      research_development: toInt(s.research_and_development),
      selling_general_admin: toInt(s.selling_general_and_administrative),
      operating_expenses: toInt(s.operating_expense),
      operating_income: operatingIncome,
      interest_expense: toInt(s.interest_expense),
      income_before_tax: toInt(s.income_before_tax),
      income_tax_expense: toInt(s.income_tax_expense),
      net_income: netIncome,
      eps: toFloat(s.basic_eps),
      eps_diluted: toFloat(s.diluted_eps),
      shares_outstanding: toInt(s.basic_shares_outstanding),
      gross_margin: calcMargin(grossProfit, totalRevenue),
      operating_margin: calcMargin(operatingIncome, totalRevenue),
      net_margin: calcMargin(netIncome, totalRevenue),
      raw_json: s,
      fetched_at: new Date().toISOString(),
    };
  });

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
      .from('xray_income_statement')
      .select('*')
      .eq('symbol', symbol)
      .eq('period', period)
      .gte('fetched_at', new Date(Date.now() - CACHE_TTL_MS).toISOString())
      .order('fiscal_date', { ascending: false })
      .limit(20);

    if (!cacheError && Array.isArray(cached) && cached.length > 0) {
      return res.status(200).json({ source: 'cache', data: cached });
    }

    const td = await fetchTwelveData('income_statement', { symbol, period });

    if (td?.status === 'error') {
      return res.status(400).json({ error: td.message || 'Twelve Data error' });
    }

    const rows = parseIncomeRows(symbol, period, td?.income_statement);

    if (rows.length > 0) {
      const { error } = await supabase
        .from('xray_income_statement')
        .upsert(rows, { onConflict: 'symbol,period,fiscal_date' });

      if (error) {
        console.error('[xray] income statement upsert error:', error);
      }
    }

    return res.status(200).json({ source: 'twelvedata', data: rows });
  } catch (error) {
    console.error('[xray] income statement error:', error);
    return res.status(error?.status || 500).json({ error: error?.message || 'Unexpected server error' });
  }
}
