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
      .from('xray_cash_flow')
      .select('*')
      .eq('symbol', sym)
      .eq('period', normalizedPeriod)
      .gte('fetched_at', new Date(Date.now() - DAY_MS).toISOString())
      .order('fiscal_date', { ascending: false })
      .limit(20);

    if (!cacheError && Array.isArray(cached) && cached.length > 0) {
      return res.status(200).json({ source: 'cache', data: cached });
    }

    const td = await fetchTwelveData('cash_flow', {
      symbol: sym,
      period: normalizedPeriod,
    });

    const statements = Array.isArray(td?.cash_flow) ? td.cash_flow : [];
    const rows = statements.map((statement) => ({
      symbol: sym,
      period: normalizedPeriod,
      fiscal_date: statement?.fiscal_date || null,
      operating_cash_flow: toInt(statement?.operating_cash_flow),
      investing_cash_flow: toInt(statement?.investing_cash_flow),
      financing_cash_flow: toInt(statement?.financing_cash_flow),
      capital_expenditure: toInt(statement?.capital_expenditure),
      free_cash_flow: toInt(statement?.free_cash_flow),
      dividends_paid: toInt(statement?.dividends_paid),
      share_repurchase: toInt(statement?.share_based_compensation),
      debt_repayment: toInt(statement?.debt_repayment),
      net_change_in_cash: toInt(statement?.net_change_in_cash),
      raw_json: statement,
      fetched_at: new Date().toISOString(),
    }));

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from('xray_cash_flow')
        .upsert(rows, { onConflict: 'symbol,period,fiscal_date' });

      if (upsertError) {
        console.error('[xray/cash-flow] Supabase upsert error:', upsertError);
      }
    }

    return res.status(200).json({ source: 'twelvedata', data: rows });
  } catch (error) {
    const status = Number(error?.status) || 500;
    console.error('[xray/cash-flow] error:', error);
    return res.status(status).json({ error: error?.message || 'Failed to fetch cash flow' });
  }
}
