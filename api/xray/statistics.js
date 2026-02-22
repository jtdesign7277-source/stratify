import { fetchTwelveData } from '../lib/twelvedata.js';
import { supabase } from '../lib/supabase.js';

const HOUR_MS = 60 * 60 * 1000;

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
    const { data: cached, error: cacheError } = await supabase
      .from('xray_statistics')
      .select('*')
      .eq('symbol', sym)
      .gte('fetched_at', new Date(Date.now() - HOUR_MS).toISOString())
      .maybeSingle();

    if (!cacheError && cached) {
      return res.status(200).json({ source: 'cache', data: cached });
    }

    const td = await fetchTwelveData('statistics', { symbol: sym });

    const statistics = td?.statistics || {};
    const valuations = statistics?.valuations_metrics || {};
    const financials = statistics?.financials || {};
    const incomeStatement = financials?.income_statement || {};
    const balanceSheet = financials?.balance_sheet || {};
    const stockPriceSummary = statistics?.stock_price_summary || {};
    const stockStatistics = statistics?.stock_statistics || {};

    const row = {
      symbol: sym,
      market_cap: toInt(valuations?.market_capitalization),
      enterprise_value: toInt(valuations?.enterprise_value),
      pe_ratio: toFloat(valuations?.trailing_pe),
      forward_pe: toFloat(valuations?.forward_pe),
      peg_ratio: toFloat(valuations?.peg_ratio),
      price_to_sales: toFloat(valuations?.price_to_sales_ttm),
      price_to_book: toFloat(valuations?.price_to_book_mrq),
      ev_to_ebitda: toFloat(valuations?.enterprise_to_ebitda),
      ev_to_revenue: toFloat(valuations?.enterprise_to_revenue),
      profit_margin: toFloat(financials?.profit_margin),
      operating_margin: toFloat(financials?.operating_margin),
      return_on_equity: toFloat(financials?.return_on_equity_ttm),
      return_on_assets: toFloat(financials?.return_on_assets_ttm),
      revenue_growth: toFloat(incomeStatement?.quarterly_revenue_growth),
      earnings_growth: toFloat(incomeStatement?.quarterly_earnings_growth_yoy),
      current_ratio: toFloat(balanceSheet?.current_ratio_mrq),
      debt_to_equity: toFloat(balanceSheet?.total_debt_to_equity_mrq),
      dividend_yield: toFloat(stockStatistics?.dividend_yield_5_year_avg),
      payout_ratio: toFloat(stockStatistics?.payout_ratio),
      beta: toFloat(stockPriceSummary?.beta),
      fifty_two_week_high: toFloat(stockPriceSummary?.fifty_two_week_high),
      fifty_two_week_low: toFloat(stockPriceSummary?.fifty_two_week_low),
      fifty_day_ma: toFloat(stockPriceSummary?.day_50_ma),
      two_hundred_day_ma: toFloat(stockPriceSummary?.day_200_ma),
      shares_outstanding: toInt(stockStatistics?.shares_outstanding),
      float_shares: toInt(stockStatistics?.float_shares),
      raw_json: td,
      fetched_at: new Date().toISOString(),
    };

    const { error: upsertError } = await supabase
      .from('xray_statistics')
      .upsert(row, { onConflict: 'symbol' });

    if (upsertError) {
      console.error('[xray/statistics] Supabase upsert error:', upsertError);
    }

    return res.status(200).json({ source: 'twelvedata', data: row });
  } catch (error) {
    const status = Number(error?.status) || 500;
    console.error('[xray/statistics] error:', error);
    return res.status(status).json({ error: error?.message || 'Failed to fetch statistics' });
  }
}
