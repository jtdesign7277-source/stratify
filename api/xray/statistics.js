import { fetchTwelveData } from '../lib/twelvedata.js';
import { supabase } from '../lib/supabase.js';

const CACHE_TTL_MS = 60 * 60 * 1000;

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

const toRow = (symbol, payload) => {
  const stats = payload?.statistics || {};
  const valuations = stats?.valuations_metrics || {};
  const fiscalYear = stats?.financial_highlights?.fiscal_year || {};
  const profitability = stats?.financial_highlights?.profitability || {};
  const balance = stats?.financial_highlights?.balance_sheet || {};
  const priceSummary = stats?.stock_price_summary || {};
  const stockStats = stats?.stock_statistics || {};

  return {
    symbol,
    market_cap: toInt(valuations.market_capitalization),
    enterprise_value: toInt(valuations.enterprise_value),
    pe_ratio: toFloat(valuations.trailing_pe),
    forward_pe: toFloat(valuations.forward_pe),
    peg_ratio: toFloat(valuations.peg_ratio),
    price_to_sales: toFloat(valuations.price_to_sales_ttm),
    price_to_book: toFloat(valuations.price_to_book_mrq),
    ev_to_ebitda: toFloat(valuations.enterprise_to_ebitda),
    ev_to_revenue: toFloat(valuations.enterprise_to_revenue),
    profit_margin: toFloat(profitability.profit_margin),
    operating_margin: toFloat(profitability.operating_margin),
    return_on_equity: toFloat(profitability.return_on_equity),
    return_on_assets: toFloat(profitability.return_on_assets),
    revenue_growth: toFloat(fiscalYear.revenue_growth),
    earnings_growth: toFloat(fiscalYear.earnings_growth),
    current_ratio: toFloat(balance.current_ratio),
    debt_to_equity: toFloat(balance.total_debt_to_equity),
    dividend_yield: toFloat(stockStats.dividend_yield_5_year_avg),
    payout_ratio: toFloat(stockStats.payout_ratio),
    beta: toFloat(priceSummary.beta),
    fifty_two_week_high: toFloat(priceSummary['52_week_high']),
    fifty_two_week_low: toFloat(priceSummary['52_week_low']),
    fifty_day_ma: toFloat(priceSummary['50_day_ma']),
    two_hundred_day_ma: toFloat(priceSummary['200_day_ma']),
    shares_outstanding: toInt(stockStats.shares_outstanding),
    float_shares: toInt(stockStats.float_shares),
    raw_json: payload,
    fetched_at: new Date().toISOString(),
  };
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
    const { data: cached, error: cacheError } = await supabase
      .from('xray_statistics')
      .select('*')
      .eq('symbol', symbol)
      .gte('fetched_at', new Date(Date.now() - CACHE_TTL_MS).toISOString())
      .maybeSingle();

    if (!cacheError && cached) {
      return res.status(200).json({ source: 'cache', data: cached });
    }

    const td = await fetchTwelveData('statistics', { symbol });

    if (td?.status === 'error') {
      return res.status(400).json({ error: td.message || 'Twelve Data error' });
    }

    const row = toRow(symbol, td);

    const { error } = await supabase.from('xray_statistics').upsert(row, { onConflict: 'symbol' });
    if (error) {
      console.error('[xray] statistics upsert error:', error);
    }

    return res.status(200).json({ source: 'twelvedata', data: row });
  } catch (error) {
    console.error('[xray] statistics error:', error);
    return res.status(error?.status || 500).json({ error: error?.message || 'Unexpected server error' });
  }
}
