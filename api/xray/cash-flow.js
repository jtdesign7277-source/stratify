import { fetchTwelveData } from '../lib/twelvedata.js';
import { supabase } from '../lib/supabase.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const CASH_FLOW_FIELDS = [
  'operating_cash_flow',
  'investing_cash_flow',
  'financing_cash_flow',
  'capital_expenditure',
  'free_cash_flow',
  'dividends_paid',
  'share_repurchase',
  'debt_repayment',
  'net_change_in_cash',
];

const toInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const hasValue = (value) => value !== null && value !== undefined && value !== '';

const pickInt = (...values) => {
  for (const value of values) {
    const parsed = toInt(value);
    if (parsed !== null) return parsed;
  }
  return null;
};

const hasAnyCashFlowValue = (row = {}) => CASH_FLOW_FIELDS.some((field) => hasValue(row?.[field]));

const cacheKey = (row = {}) => `${row?.symbol || ''}|${row?.period || ''}|${row?.fiscal_date || ''}`;

const mapCashFlowStatement = (statement = {}, { symbol, period, fiscalDate = null, fetchedAt }) => {
  const operatingActivities = statement?.operating_activities;
  const investingActivities = statement?.investing_activities;
  const financingActivities = statement?.financing_activities;
  const endCashPosition = statement?.end_cash_position;
  const cashFlowFromOperating = statement?.cash_flow_from_operating_activities;
  const cashFlowFromInvesting = statement?.cash_flow_from_investing_activities;
  const cashFlowFromFinancing = statement?.cash_flow_from_financing_activities;

  const operatingCashFlow = pickInt(
    operatingActivities?.operating_cash_flow,
    cashFlowFromOperating?.operating_cash_flow,
    statement?.operating_cash_flow
  );
  const investingCashFlow = pickInt(
    investingActivities?.investing_cash_flow,
    cashFlowFromInvesting?.investing_cash_flow,
    statement?.investing_cash_flow
  );
  const financingCashFlow = pickInt(
    financingActivities?.financing_cash_flow,
    cashFlowFromFinancing?.financing_cash_flow,
    statement?.financing_cash_flow
  );
  const capitalExpenditure = pickInt(
    investingActivities?.capital_expenditures,
    investingActivities?.capital_expenditure,
    cashFlowFromInvesting?.capital_expenditures,
    cashFlowFromInvesting?.capital_expenditure,
    statement?.capital_expenditure
  );
  const freeCashFlow = pickInt(
    statement?.free_cash_flow,
    cashFlowFromOperating?.free_cash_flow,
    operatingCashFlow !== null && capitalExpenditure !== null ? operatingCashFlow + capitalExpenditure : null
  );
  const dividendsPaid = pickInt(
    financingActivities?.common_dividends,
    financingActivities?.dividends_paid,
    cashFlowFromFinancing?.common_dividends,
    statement?.dividends_paid
  );
  const shareRepurchase = pickInt(
    financingActivities?.common_stock_repurchase,
    financingActivities?.share_repurchase,
    cashFlowFromFinancing?.common_stock_repurchase,
    statement?.share_repurchase
  );
  const debtRepayment = pickInt(
    financingActivities?.long_term_debt_payments,
    financingActivities?.debt_repayment,
    cashFlowFromFinancing?.long_term_debt_payments,
    statement?.debt_repayment
  );
  const netChangeInCash = pickInt(
    statement?.net_change_in_cash,
    statement?.changes_in_cash,
    endCashPosition?.changes_in_cash,
    operatingCashFlow !== null || investingCashFlow !== null || financingCashFlow !== null
      ? (operatingCashFlow || 0) + (investingCashFlow || 0) + (financingCashFlow || 0)
      : null
  );

  return {
    symbol,
    period,
    fiscal_date: fiscalDate || statement?.fiscal_date || null,
    operating_cash_flow: operatingCashFlow,
    investing_cash_flow: investingCashFlow,
    financing_cash_flow: financingCashFlow,
    capital_expenditure: capitalExpenditure,
    free_cash_flow: freeCashFlow,
    dividends_paid: dividendsPaid,
    share_repurchase: shareRepurchase,
    debt_repayment: debtRepayment,
    net_change_in_cash: netChangeInCash,
    raw_json: statement,
    fetched_at: fetchedAt,
  };
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
      const fetchedAt = new Date().toISOString();
      const staleRows = cached.filter((row) => row?.raw_json && !hasAnyCashFlowValue(row));
      let repairedRows = [];

      if (staleRows.length > 0) {
        repairedRows = staleRows.map((row) =>
          mapCashFlowStatement(row?.raw_json || {}, {
            symbol: row?.symbol || sym,
            period: row?.period || normalizedPeriod,
            fiscalDate: row?.fiscal_date || null,
            fetchedAt,
          })
        );

        const { error: repairError } = await supabase
          .from('xray_cash_flow')
          .upsert(repairedRows, { onConflict: 'symbol,period,fiscal_date' });

        if (repairError) {
          console.error('[xray/cash-flow] cache repair upsert error:', repairError);
        }
      }

      const repairedMap = new Map(repairedRows.map((row) => [cacheKey(row), row]));
      const hydratedCache = cached.map((row) => {
        const repaired = repairedMap.get(cacheKey(row));
        return repaired ? { ...row, ...repaired } : row;
      });

      if (hydratedCache.some((row) => hasAnyCashFlowValue(row))) {
        return res.status(200).json({
          source: repairedRows.length > 0 ? 'cache_repaired' : 'cache',
          data: hydratedCache,
        });
      }
    }

    const td = await fetchTwelveData('cash_flow', {
      symbol: sym,
      period: normalizedPeriod,
    });

    const statements = Array.isArray(td?.cash_flow) ? td.cash_flow : [];
    const fetchedAt = new Date().toISOString();
    const rows = statements.map((statement) =>
      mapCashFlowStatement(statement, {
        symbol: sym,
        period: normalizedPeriod,
        fetchedAt,
      })
    );

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
