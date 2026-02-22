import { fetchTwelveData } from '../lib/twelvedata.js';
import { supabase } from '../lib/supabase.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const toInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const toFloat = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toMargin = (numerator, denominator) => {
  const num = toInt(numerator);
  const den = toInt(denominator);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  return Number(((num / den) * 100).toFixed(2));
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
      .from('xray_income_statement')
      .select('*')
      .eq('symbol', sym)
      .eq('period', normalizedPeriod)
      .gte('fetched_at', new Date(Date.now() - DAY_MS).toISOString())
      .order('fiscal_date', { ascending: false })
      .limit(20);

    if (!cacheError && Array.isArray(cached) && cached.length > 0) {
      return res.status(200).json({ source: 'cache', data: cached });
    }

    const td = await fetchTwelveData('income_statement', {
      symbol: sym,
      period: normalizedPeriod,
    });

    const statements = Array.isArray(td?.income_statement) ? td.income_statement : [];
    const rows = statements.map((statement) => ({
      symbol: sym,
      period: normalizedPeriod,
      fiscal_date: statement?.fiscal_date || null,
      total_revenue: toInt(statement?.sales),
      cost_of_revenue: toInt(statement?.cost_of_goods),
      gross_profit: toInt(statement?.gross_profit),
      research_development: toInt(statement?.research_and_development),
      selling_general_admin: toInt(statement?.selling_general_and_administrative),
      operating_expenses: toInt(statement?.operating_expense),
      operating_income: toInt(statement?.operating_income),
      interest_expense: toInt(statement?.interest_expense),
      income_before_tax: toInt(statement?.income_before_tax),
      income_tax_expense: toInt(statement?.income_tax_expense),
      net_income: toInt(statement?.net_income),
      eps: toFloat(statement?.basic_eps),
      eps_diluted: toFloat(statement?.diluted_eps),
      shares_outstanding: toInt(statement?.basic_shares_outstanding),
      gross_margin: toMargin(statement?.gross_profit, statement?.sales),
      operating_margin: toMargin(statement?.operating_income, statement?.sales),
      net_margin: toMargin(statement?.net_income, statement?.sales),
      raw_json: statement,
      fetched_at: new Date().toISOString(),
    }));

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from('xray_income_statement')
        .upsert(rows, { onConflict: 'symbol,period,fiscal_date' });

      if (upsertError) {
        console.error('[xray/income-statement] Supabase upsert error:', upsertError);
      }
    }

    return res.status(200).json({ source: 'twelvedata', data: rows });
  } catch (error) {
    const status = Number(error?.status) || 500;
    console.error('[xray/income-statement] error:', error);
    return res.status(status).json({ error: error?.message || 'Failed to fetch income statement' });
  }
}
