import { fetchTwelveData } from '../lib/twelvedata.js';
import { supabase } from '../lib/supabase.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const INCOME_FIELDS = [
  'total_revenue',
  'cost_of_revenue',
  'gross_profit',
  'research_development',
  'selling_general_admin',
  'operating_expenses',
  'operating_income',
  'interest_expense',
  'income_before_tax',
  'income_tax_expense',
  'net_income',
  'eps',
  'eps_diluted',
  'shares_outstanding',
  'gross_margin',
  'operating_margin',
  'net_margin',
];

const toInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const toFloat = (value) => {
  const parsed = Number.parseFloat(value);
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

const pickFloat = (...values) => {
  for (const value of values) {
    const parsed = toFloat(value);
    if (parsed !== null) return parsed;
  }
  return null;
};

const toMargin = (numerator, denominator) => {
  const num = toInt(numerator);
  const den = toInt(denominator);
  if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return null;
  return Number(((num / den) * 100).toFixed(2));
};

const hasAnyIncomeValue = (row = {}) => INCOME_FIELDS.some((field) => hasValue(row?.[field]));

const cacheKey = (row = {}) => `${row?.symbol || ''}|${row?.period || ''}|${row?.fiscal_date || ''}`;

const mapIncomeStatement = (statement = {}, { symbol, period, fiscalDate = null, fetchedAt }) => {
  const revenue = statement?.revenue;
  const grossProfitGroup = statement?.gross_profit;
  const operatingExpense = statement?.operating_expense;
  const operatingExpenses = statement?.operating_expenses;
  const nonOperatingInterest = statement?.non_operating_interest;
  const incomeTax = statement?.income_tax;
  const netIncomeGroup = statement?.net_income;
  const operatingIncomeGroup = statement?.operating_income;
  const pretaxIncomeGroup = statement?.pretax_income;

  const totalRevenue = pickInt(statement?.sales, revenue?.total_revenue, statement?.total_revenue);
  const costOfRevenue = pickInt(
    statement?.cost_of_goods,
    grossProfitGroup?.cost_of_revenue?.cost_of_revenue_value,
    statement?.cost_of_revenue
  );
  const grossProfit = pickInt(
    typeof grossProfitGroup === 'object' ? grossProfitGroup?.gross_profit_value : grossProfitGroup,
    statement?.gross_profit
  );
  const researchDevelopment = pickInt(
    operatingExpense?.research_and_development,
    operatingExpenses?.research_and_development,
    statement?.research_and_development
  );
  const sellingGeneralAdmin = pickInt(
    operatingExpense?.selling_general_and_administrative,
    operatingExpenses?.selling_general_and_administrative,
    statement?.selling_general_admin,
    statement?.selling_general_and_administrative
  );
  const otherOperatingExpenses = pickInt(
    operatingExpense?.other_operating_expenses,
    operatingExpenses?.other_operating_expenses,
    statement?.other_operating_expenses
  );
  const derivedOperatingExpenses =
    researchDevelopment !== null || sellingGeneralAdmin !== null || otherOperatingExpenses !== null
      ? (researchDevelopment || 0) + (sellingGeneralAdmin || 0) + (otherOperatingExpenses || 0)
      : null;
  const operatingExpensesTotal = pickInt(
    operatingExpense?.operating_expense_total,
    operatingExpenses?.operating_expense_total,
    statement?.operating_expenses,
    statement?.operating_expense,
    derivedOperatingExpenses
  );
  const operatingIncome = pickInt(
    typeof operatingIncomeGroup === 'object' ? operatingIncomeGroup?.operating_income_value : operatingIncomeGroup,
    statement?.operating_income
  );
  const interestExpense = pickInt(nonOperatingInterest?.expense, statement?.interest_expense);
  const incomeBeforeTax = pickInt(
    typeof pretaxIncomeGroup === 'object' ? pretaxIncomeGroup?.pretax_income_value : pretaxIncomeGroup,
    statement?.income_before_tax,
    statement?.pretax_income
  );
  const incomeTaxExpense = pickInt(
    typeof incomeTax === 'object' ? incomeTax?.income_tax_value : incomeTax,
    statement?.income_tax_expense,
    statement?.income_tax
  );
  const netIncome = pickInt(
    typeof netIncomeGroup === 'object' ? netIncomeGroup?.net_income_value : netIncomeGroup,
    statement?.net_income
  );
  const eps = pickFloat(statement?.eps_basic, statement?.basic_eps, statement?.eps);
  const epsDiluted = pickFloat(statement?.eps_diluted, statement?.diluted_eps);
  const sharesOutstanding = pickInt(statement?.basic_shares_outstanding, statement?.shares_outstanding);

  return {
    symbol,
    period,
    fiscal_date: fiscalDate || statement?.fiscal_date || null,
    total_revenue: totalRevenue,
    cost_of_revenue: costOfRevenue,
    gross_profit: grossProfit,
    research_development: researchDevelopment,
    selling_general_admin: sellingGeneralAdmin,
    operating_expenses: operatingExpensesTotal,
    operating_income: operatingIncome,
    interest_expense: interestExpense,
    income_before_tax: incomeBeforeTax,
    income_tax_expense: incomeTaxExpense,
    net_income: netIncome,
    eps,
    eps_diluted: epsDiluted,
    shares_outstanding: sharesOutstanding,
    gross_margin: toMargin(grossProfit, totalRevenue),
    operating_margin: toMargin(operatingIncome, totalRevenue),
    net_margin: toMargin(netIncome, totalRevenue),
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
      .from('xray_income_statement')
      .select('*')
      .eq('symbol', sym)
      .eq('period', normalizedPeriod)
      .gte('fetched_at', new Date(Date.now() - DAY_MS).toISOString())
      .order('fiscal_date', { ascending: false })
      .limit(20);

    if (!cacheError && Array.isArray(cached) && cached.length > 0) {
      const fetchedAt = new Date().toISOString();
      const staleRows = cached.filter((row) => row?.raw_json && !hasAnyIncomeValue(row));
      let repairedRows = [];

      if (staleRows.length > 0) {
        repairedRows = staleRows.map((row) =>
          mapIncomeStatement(row?.raw_json || {}, {
            symbol: row?.symbol || sym,
            period: row?.period || normalizedPeriod,
            fiscalDate: row?.fiscal_date || null,
            fetchedAt,
          })
        );

        const { error: repairError } = await supabase
          .from('xray_income_statement')
          .upsert(repairedRows, { onConflict: 'symbol,period,fiscal_date' });

        if (repairError) {
          console.error('[xray/income-statement] cache repair upsert error:', repairError);
        }
      }

      const repairedMap = new Map(repairedRows.map((row) => [cacheKey(row), row]));
      const hydratedCache = cached.map((row) => {
        const repaired = repairedMap.get(cacheKey(row));
        return repaired ? { ...row, ...repaired } : row;
      });

      if (hydratedCache.some((row) => hasAnyIncomeValue(row))) {
        return res.status(200).json({
          source: repairedRows.length > 0 ? 'cache_repaired' : 'cache',
          data: hydratedCache,
        });
      }
    }

    const td = await fetchTwelveData('income_statement', {
      symbol: sym,
      period: normalizedPeriod,
    });

    const statements = Array.isArray(td?.income_statement) ? td.income_statement : [];
    const fetchedAt = new Date().toISOString();
    const rows = statements.map((statement) =>
      mapIncomeStatement(statement, {
        symbol: sym,
        period: normalizedPeriod,
        fetchedAt,
      })
    );

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
