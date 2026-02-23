import { fetchTwelveData } from '../lib/twelvedata.js';
import { supabase } from '../lib/supabase.js';

const HOUR_MS = 60 * 60 * 1000;

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

const hasValue = (value) => value !== null && value !== undefined && value !== '';

const getAtPath = (obj, path) => {
  if (!obj || typeof obj !== 'object' || !path) return undefined;
  const parts = String(path).split('.');
  let cursor = obj;
  for (const part of parts) {
    if (!cursor || typeof cursor !== 'object') return undefined;
    cursor = cursor[part];
  }
  return cursor;
};

const firstFloat = (source, paths = []) => {
  for (const path of paths) {
    const value = getAtPath(source, path);
    const parsed = toFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const firstInt = (source, paths = []) => {
  for (const path of paths) {
    const value = getAtPath(source, path);
    const parsed = toInt(value);
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
    const { data: cached, error: cacheError } = await supabase
      .from('xray_statistics')
      .select('*')
      .eq('symbol', sym)
      .gte('fetched_at', new Date(Date.now() - HOUR_MS).toISOString())
      .maybeSingle();

    const cacheHasCoreMetrics = Boolean(
      hasValue(cached?.market_cap)
      || hasValue(cached?.pe_ratio)
      || hasValue(cached?.fifty_two_week_high)
      || hasValue(cached?.fifty_two_week_low)
    );

    if (!cacheError && cached && cacheHasCoreMetrics) {
      return res.status(200).json({ source: 'cache', data: cached });
    }

    const td = await fetchTwelveData('statistics', { symbol: sym });
    const statistics =
      td?.statistics && typeof td.statistics === 'object'
        ? td.statistics
        : td;

    const source = { td, statistics };

    const row = {
      symbol: sym,
      market_cap: firstInt(source, [
        'statistics.valuations_metrics.market_capitalization',
        'statistics.valuations_metrics.market_cap',
        'statistics.valuation_metrics.market_capitalization',
        'statistics.market_capitalization',
        'statistics.market_cap',
        'td.market_capitalization',
        'td.market_cap',
      ]),
      enterprise_value: firstInt(source, [
        'statistics.valuations_metrics.enterprise_value',
        'statistics.valuation_metrics.enterprise_value',
        'statistics.enterprise_value',
        'td.enterprise_value',
      ]),
      pe_ratio: firstFloat(source, [
        'statistics.valuations_metrics.trailing_pe',
        'statistics.valuations_metrics.pe_ratio',
        'statistics.valuation_metrics.trailing_pe',
        'statistics.pe_ratio',
        'td.pe_ratio',
      ]),
      forward_pe: firstFloat(source, [
        'statistics.valuations_metrics.forward_pe',
        'statistics.valuation_metrics.forward_pe',
        'statistics.forward_pe',
        'td.forward_pe',
      ]),
      peg_ratio: firstFloat(source, [
        'statistics.valuations_metrics.peg_ratio',
        'statistics.valuation_metrics.peg_ratio',
        'statistics.peg_ratio',
        'td.peg_ratio',
      ]),
      price_to_sales: firstFloat(source, [
        'statistics.valuations_metrics.price_to_sales_ttm',
        'statistics.valuations_metrics.price_to_sales',
        'statistics.valuation_metrics.price_to_sales_ttm',
        'statistics.price_to_sales',
        'td.price_to_sales',
      ]),
      price_to_book: firstFloat(source, [
        'statistics.valuations_metrics.price_to_book_mrq',
        'statistics.valuations_metrics.price_to_book',
        'statistics.valuation_metrics.price_to_book_mrq',
        'statistics.price_to_book',
        'td.price_to_book',
      ]),
      ev_to_ebitda: firstFloat(source, [
        'statistics.valuations_metrics.enterprise_to_ebitda',
        'statistics.valuation_metrics.enterprise_to_ebitda',
        'statistics.ev_to_ebitda',
        'td.ev_to_ebitda',
      ]),
      ev_to_revenue: firstFloat(source, [
        'statistics.valuations_metrics.enterprise_to_revenue',
        'statistics.valuation_metrics.enterprise_to_revenue',
        'statistics.ev_to_revenue',
        'td.ev_to_revenue',
      ]),
      profit_margin: firstFloat(source, [
        'statistics.financials.profit_margin',
        'statistics.profit_margin',
        'td.profit_margin',
      ]),
      operating_margin: firstFloat(source, [
        'statistics.financials.operating_margin',
        'statistics.operating_margin',
        'td.operating_margin',
      ]),
      return_on_equity: firstFloat(source, [
        'statistics.financials.return_on_equity_ttm',
        'statistics.financials.return_on_equity',
        'statistics.return_on_equity_ttm',
        'statistics.return_on_equity',
        'td.return_on_equity',
      ]),
      return_on_assets: firstFloat(source, [
        'statistics.financials.return_on_assets_ttm',
        'statistics.financials.return_on_assets',
        'statistics.return_on_assets_ttm',
        'statistics.return_on_assets',
        'td.return_on_assets',
      ]),
      revenue_growth: firstFloat(source, [
        'statistics.financials.income_statement.quarterly_revenue_growth',
        'statistics.financials.income_statement.revenue_growth',
        'statistics.revenue_growth',
        'td.revenue_growth',
      ]),
      earnings_growth: firstFloat(source, [
        'statistics.financials.income_statement.quarterly_earnings_growth_yoy',
        'statistics.financials.income_statement.earnings_growth',
        'statistics.earnings_growth',
        'td.earnings_growth',
      ]),
      current_ratio: firstFloat(source, [
        'statistics.financials.balance_sheet.current_ratio_mrq',
        'statistics.financials.balance_sheet.current_ratio',
        'statistics.current_ratio',
        'td.current_ratio',
      ]),
      debt_to_equity: firstFloat(source, [
        'statistics.financials.balance_sheet.total_debt_to_equity_mrq',
        'statistics.financials.balance_sheet.debt_to_equity',
        'statistics.debt_to_equity',
        'td.debt_to_equity',
      ]),
      dividend_yield: firstFloat(source, [
        'statistics.stock_statistics.dividend_yield_5_year_avg',
        'statistics.stock_statistics.dividend_yield',
        'statistics.dividend_yield',
        'td.dividend_yield',
      ]),
      payout_ratio: firstFloat(source, [
        'statistics.stock_statistics.payout_ratio',
        'statistics.payout_ratio',
        'td.payout_ratio',
      ]),
      beta: firstFloat(source, [
        'statistics.stock_price_summary.beta',
        'statistics.stock_statistics.beta',
        'statistics.beta',
        'td.beta',
      ]),
      fifty_two_week_high: firstFloat(source, [
        'statistics.stock_price_summary.fifty_two_week_high',
        'statistics.stock_price_summary.week_52_high',
        'statistics.stock_price_summary.52_week_high',
        'statistics.fifty_two_week_high',
        'statistics.52_week_high',
        'td.fifty_two_week_high',
      ]),
      fifty_two_week_low: firstFloat(source, [
        'statistics.stock_price_summary.fifty_two_week_low',
        'statistics.stock_price_summary.week_52_low',
        'statistics.stock_price_summary.52_week_low',
        'statistics.fifty_two_week_low',
        'statistics.52_week_low',
        'td.fifty_two_week_low',
      ]),
      fifty_day_ma: firstFloat(source, [
        'statistics.stock_price_summary.day_50_ma',
        'statistics.stock_price_summary.moving_average_50',
        'statistics.fifty_day_ma',
        'td.fifty_day_ma',
      ]),
      two_hundred_day_ma: firstFloat(source, [
        'statistics.stock_price_summary.day_200_ma',
        'statistics.stock_price_summary.moving_average_200',
        'statistics.two_hundred_day_ma',
        'td.two_hundred_day_ma',
      ]),
      shares_outstanding: firstInt(source, [
        'statistics.stock_statistics.shares_outstanding',
        'statistics.shares_outstanding',
        'td.shares_outstanding',
      ]),
      float_shares: firstInt(source, [
        'statistics.stock_statistics.float_shares',
        'statistics.float_shares',
        'td.float_shares',
      ]),
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
