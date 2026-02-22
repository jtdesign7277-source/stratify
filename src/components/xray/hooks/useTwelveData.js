import { useEffect, useMemo, useState } from 'react';
import { normalizeSymbol } from '../../../lib/twelvedata';

const API_BASE = '/api/xray';

const ENDPOINTS_WITHOUT_PERIOD = new Set(['statistics', 'quote', 'profile']);

const hasValue = (value) => value !== null && value !== undefined && value !== '';

const withFallback = (flatValue, ...fallbackValues) => {
  if (hasValue(flatValue)) return flatValue;
  for (const value of fallbackValues) {
    if (!hasValue(value)) continue;
    if (typeof value === 'object') continue;
    return value;
  }
  return null;
};

const toNumeric = (value) => {
  if (!hasValue(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const computeMargin = (numerator, denominator) => {
  const num = toNumeric(numerator);
  const den = toNumeric(denominator);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  return Number(((num / den) * 100).toFixed(2));
};

const normalizeBalanceRow = (row = {}) => {
  const raw = row?.raw_json || {};
  const assets = raw?.assets;
  const currentAssets = assets?.current_assets;
  const nonCurrentAssets = assets?.non_current_assets;
  const liabilities = raw?.liabilities;
  const currentLiabilities = liabilities?.current_liabilities;
  const nonCurrentLiabilities = liabilities?.non_current_liabilities;
  const equity = raw?.shareholders_equity;

  return {
    ...row,
    total_assets: withFallback(row?.total_assets, assets?.total_assets, raw?.total_assets),
    current_assets: withFallback(
      row?.current_assets,
      currentAssets?.total_current_assets,
      assets?.current_assets,
      raw?.current_assets
    ),
    cash_and_equivalents: withFallback(
      row?.cash_and_equivalents,
      currentAssets?.cash_and_cash_equivalents,
      raw?.cash_and_short_term_investments,
      raw?.cash_and_equivalents
    ),
    short_term_investments: withFallback(
      row?.short_term_investments,
      currentAssets?.short_term_investments,
      raw?.short_term_investments
    ),
    accounts_receivable: withFallback(
      row?.accounts_receivable,
      currentAssets?.accounts_receivable,
      raw?.accounts_receivable
    ),
    inventory: withFallback(row?.inventory, currentAssets?.inventory, raw?.inventory),
    non_current_assets: withFallback(
      row?.non_current_assets,
      nonCurrentAssets?.total_non_current_assets,
      assets?.non_current_assets,
      raw?.non_current_assets
    ),
    property_plant_equipment: withFallback(
      row?.property_plant_equipment,
      nonCurrentAssets?.properties,
      nonCurrentAssets?.property_plant_and_equipment,
      raw?.property_plant_and_equipment
    ),
    goodwill: withFallback(row?.goodwill, nonCurrentAssets?.goodwill, raw?.goodwill),
    intangible_assets: withFallback(
      row?.intangible_assets,
      nonCurrentAssets?.intangible_assets,
      raw?.intangible_assets
    ),
    total_liabilities: withFallback(row?.total_liabilities, liabilities?.total_liabilities, raw?.total_liabilities),
    current_liabilities: withFallback(
      row?.current_liabilities,
      currentLiabilities?.total_current_liabilities,
      liabilities?.current_liabilities,
      raw?.current_liabilities
    ),
    accounts_payable: withFallback(
      row?.accounts_payable,
      currentLiabilities?.accounts_payable,
      raw?.accounts_payable
    ),
    short_term_debt: withFallback(row?.short_term_debt, currentLiabilities?.short_term_debt, raw?.short_term_debt),
    non_current_liabilities: withFallback(
      row?.non_current_liabilities,
      nonCurrentLiabilities?.total_non_current_liabilities,
      liabilities?.non_current_liabilities,
      raw?.non_current_liabilities
    ),
    long_term_debt: withFallback(row?.long_term_debt, nonCurrentLiabilities?.long_term_debt, raw?.long_term_debt),
    total_equity: withFallback(
      row?.total_equity,
      equity?.total_shareholders_equity,
      raw?.shareholders_equity,
      raw?.total_equity
    ),
    retained_earnings: withFallback(row?.retained_earnings, equity?.retained_earnings, raw?.retained_earnings),
  };
};

const normalizeIncomeRow = (row = {}) => {
  const raw = row?.raw_json || {};
  const revenue = raw?.revenue;
  const grossProfitGroup = raw?.gross_profit;
  const operatingExpense = raw?.operating_expense;
  const operatingExpenses = raw?.operating_expenses;
  const nonOperatingInterest = raw?.non_operating_interest;
  const operatingIncomeGroup = raw?.operating_income;
  const pretaxIncomeGroup = raw?.pretax_income;
  const incomeTaxGroup = raw?.income_tax;
  const netIncomeGroup = raw?.net_income;

  const totalRevenue = withFallback(row?.total_revenue, raw?.sales, revenue?.total_revenue, raw?.total_revenue);
  const grossProfit = withFallback(
    row?.gross_profit,
    typeof grossProfitGroup === 'object' ? grossProfitGroup?.gross_profit_value : grossProfitGroup,
    raw?.gross_profit
  );
  const researchDevelopment = withFallback(
    row?.research_development,
    operatingExpense?.research_and_development,
    operatingExpenses?.research_and_development,
    raw?.research_and_development
  );
  const sellingGeneralAdmin = withFallback(
    row?.selling_general_admin,
    operatingExpense?.selling_general_and_administrative,
    operatingExpenses?.selling_general_and_administrative,
    raw?.selling_general_and_administrative
  );
  const otherOperatingExpenses = withFallback(
    null,
    operatingExpense?.other_operating_expenses,
    operatingExpenses?.other_operating_expenses,
    raw?.other_operating_expenses
  );
  const rdNum = toNumeric(researchDevelopment);
  const sgaNum = toNumeric(sellingGeneralAdmin);
  const otherOpNum = toNumeric(otherOperatingExpenses);
  const derivedOperatingExpenses =
    rdNum !== null || sgaNum !== null || otherOpNum !== null
      ? (rdNum || 0) + (sgaNum || 0) + (otherOpNum || 0)
      : null;

  const operatingIncome = withFallback(
    row?.operating_income,
    typeof operatingIncomeGroup === 'object' ? operatingIncomeGroup?.operating_income_value : operatingIncomeGroup,
    raw?.operating_income
  );
  const netIncome = withFallback(
    row?.net_income,
    typeof netIncomeGroup === 'object' ? netIncomeGroup?.net_income_value : netIncomeGroup,
    raw?.net_income
  );

  return {
    ...row,
    total_revenue: totalRevenue,
    cost_of_revenue: withFallback(
      row?.cost_of_revenue,
      raw?.cost_of_goods,
      grossProfitGroup?.cost_of_revenue?.cost_of_revenue_value,
      raw?.cost_of_revenue
    ),
    gross_profit: grossProfit,
    research_development: researchDevelopment,
    selling_general_admin: sellingGeneralAdmin,
    operating_expenses: withFallback(
      row?.operating_expenses,
      operatingExpense?.operating_expense_total,
      operatingExpenses?.operating_expense_total,
      raw?.operating_expenses,
      raw?.operating_expense,
      derivedOperatingExpenses
    ),
    operating_income: operatingIncome,
    interest_expense: withFallback(row?.interest_expense, nonOperatingInterest?.expense, raw?.interest_expense),
    income_before_tax: withFallback(
      row?.income_before_tax,
      typeof pretaxIncomeGroup === 'object' ? pretaxIncomeGroup?.pretax_income_value : pretaxIncomeGroup,
      raw?.pretax_income,
      raw?.income_before_tax
    ),
    income_tax_expense: withFallback(
      row?.income_tax_expense,
      typeof incomeTaxGroup === 'object' ? incomeTaxGroup?.income_tax_value : incomeTaxGroup,
      raw?.income_tax,
      raw?.income_tax_expense
    ),
    net_income: netIncome,
    eps: withFallback(row?.eps, raw?.eps_basic, raw?.basic_eps),
    eps_diluted: withFallback(row?.eps_diluted, raw?.eps_diluted, raw?.diluted_eps),
    shares_outstanding: withFallback(row?.shares_outstanding, raw?.basic_shares_outstanding, raw?.shares_outstanding),
    gross_margin: withFallback(row?.gross_margin, computeMargin(grossProfit, totalRevenue)),
    operating_margin: withFallback(row?.operating_margin, computeMargin(operatingIncome, totalRevenue)),
    net_margin: withFallback(row?.net_margin, computeMargin(netIncome, totalRevenue)),
  };
};

const normalizeCashFlowRow = (row = {}) => {
  const raw = row?.raw_json || {};
  const operatingActivities = raw?.operating_activities;
  const investingActivities = raw?.investing_activities;
  const financingActivities = raw?.financing_activities;
  const endCashPosition = raw?.end_cash_position;
  const cashFlowFromOperating = raw?.cash_flow_from_operating_activities;
  const cashFlowFromInvesting = raw?.cash_flow_from_investing_activities;
  const cashFlowFromFinancing = raw?.cash_flow_from_financing_activities;

  const operatingCashFlow = withFallback(
    row?.operating_cash_flow,
    operatingActivities?.operating_cash_flow,
    cashFlowFromOperating?.operating_cash_flow,
    raw?.operating_cash_flow
  );
  const investingCashFlow = withFallback(
    row?.investing_cash_flow,
    investingActivities?.investing_cash_flow,
    cashFlowFromInvesting?.investing_cash_flow,
    raw?.investing_cash_flow
  );
  const financingCashFlow = withFallback(
    row?.financing_cash_flow,
    financingActivities?.financing_cash_flow,
    cashFlowFromFinancing?.financing_cash_flow,
    raw?.financing_cash_flow
  );
  const operatingNum = toNumeric(operatingCashFlow);
  const investingNum = toNumeric(investingCashFlow);
  const financingNum = toNumeric(financingCashFlow);
  const computedNetChange =
    operatingNum !== null || investingNum !== null || financingNum !== null
      ? (operatingNum || 0) + (investingNum || 0) + (financingNum || 0)
      : null;

  return {
    ...row,
    operating_cash_flow: operatingCashFlow,
    investing_cash_flow: investingCashFlow,
    financing_cash_flow: financingCashFlow,
    capital_expenditure: withFallback(
      row?.capital_expenditure,
      investingActivities?.capital_expenditures,
      investingActivities?.capital_expenditure,
      cashFlowFromInvesting?.capital_expenditures,
      cashFlowFromInvesting?.capital_expenditure,
      raw?.capital_expenditure
    ),
    free_cash_flow: withFallback(
      row?.free_cash_flow,
      raw?.free_cash_flow,
      cashFlowFromOperating?.free_cash_flow
    ),
    dividends_paid: withFallback(
      row?.dividends_paid,
      financingActivities?.common_dividends,
      financingActivities?.dividends_paid,
      cashFlowFromFinancing?.common_dividends,
      raw?.dividends_paid
    ),
    share_repurchase: withFallback(
      row?.share_repurchase,
      financingActivities?.common_stock_repurchase,
      financingActivities?.share_repurchase,
      cashFlowFromFinancing?.common_stock_repurchase,
      raw?.share_repurchase
    ),
    debt_repayment: withFallback(
      row?.debt_repayment,
      financingActivities?.long_term_debt_payments,
      financingActivities?.debt_repayment,
      cashFlowFromFinancing?.long_term_debt_payments,
      raw?.debt_repayment
    ),
    net_change_in_cash: withFallback(
      row?.net_change_in_cash,
      raw?.net_change_in_cash,
      raw?.changes_in_cash,
      endCashPosition?.changes_in_cash,
      computedNetChange
    ),
  };
};

const normalizeFundamentalRows = (endpoint, payloadData) => {
  if (!Array.isArray(payloadData)) return payloadData;
  if (endpoint === 'balance-sheet') return payloadData.map((row) => normalizeBalanceRow(row));
  if (endpoint === 'income-statement') return payloadData.map((row) => normalizeIncomeRow(row));
  if (endpoint === 'cash-flow') return payloadData.map((row) => normalizeCashFlowRow(row));
  return payloadData;
};

export function useFundamentals(symbol, endpoint, period = 'annual') {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null);

  const normalizedSymbol = useMemo(() => normalizeSymbol(symbol), [symbol]);

  useEffect(() => {
    if (!normalizedSymbol || !endpoint) {
      setLoading(false);
      setData(null);
      setError(null);
      setSource(null);
      return;
    }

    const controller = new AbortController();

    const query = new URLSearchParams({ symbol: normalizedSymbol });
    if (!ENDPOINTS_WITHOUT_PERIOD.has(endpoint) && period) {
      query.set('period', period);
    }

    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/${endpoint}?${query.toString()}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((payload) => {
        setData(normalizeFundamentalRows(endpoint, payload?.data ?? null));
        setSource(payload?.source ?? null);
      })
      .catch((fetchError) => {
        if (fetchError.name === 'AbortError') return;
        console.error(`[xray/useFundamentals] ${endpoint} error:`, fetchError);
        setError(fetchError.message || 'Request failed');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [endpoint, normalizedSymbol, period]);

  return { data, loading, error, source };
}

export function useIncomeStatement(symbol, period = 'annual') {
  return useFundamentals(symbol, 'income-statement', period);
}

export function useBalanceSheet(symbol, period = 'annual') {
  return useFundamentals(symbol, 'balance-sheet', period);
}

export function useCashFlow(symbol, period = 'annual') {
  return useFundamentals(symbol, 'cash-flow', period);
}

export function useStatistics(symbol) {
  return useFundamentals(symbol, 'statistics');
}

export function useQuote(symbol) {
  return useFundamentals(symbol, 'quote');
}

export function useProfile(symbol) {
  return useFundamentals(symbol, 'profile');
}
