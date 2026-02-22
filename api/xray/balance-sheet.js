import { fetchTwelveData } from '../lib/twelvedata.js';
import { supabase } from '../lib/supabase.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const BALANCE_FIELDS = [
  'total_assets',
  'current_assets',
  'cash_and_equivalents',
  'short_term_investments',
  'accounts_receivable',
  'inventory',
  'non_current_assets',
  'property_plant_equipment',
  'goodwill',
  'intangible_assets',
  'total_liabilities',
  'current_liabilities',
  'accounts_payable',
  'short_term_debt',
  'non_current_liabilities',
  'long_term_debt',
  'total_equity',
  'retained_earnings',
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

const hasAnyBalanceValue = (row = {}) => BALANCE_FIELDS.some((field) => hasValue(row?.[field]));

const cacheKey = (row = {}) => `${row?.symbol || ''}|${row?.period || ''}|${row?.fiscal_date || ''}`;

const mapBalanceStatement = (statement = {}, { symbol, period, fiscalDate = null, fetchedAt }) => {
  const assets = statement?.assets;
  const currentAssets = assets?.current_assets;
  const nonCurrentAssets = assets?.non_current_assets;
  const liabilities = statement?.liabilities;
  const currentLiabilities = liabilities?.current_liabilities;
  const nonCurrentLiabilities = liabilities?.non_current_liabilities;
  const equity = statement?.shareholders_equity;

  return {
    symbol,
    period,
    fiscal_date: fiscalDate || statement?.fiscal_date || null,
    total_assets: pickInt(assets?.total_assets, statement?.total_assets),
    current_assets: pickInt(currentAssets?.total_current_assets, assets?.current_assets, statement?.current_assets),
    cash_and_equivalents: pickInt(
      currentAssets?.cash_and_cash_equivalents,
      statement?.cash_and_short_term_investments,
      statement?.cash_and_equivalents
    ),
    short_term_investments: pickInt(currentAssets?.short_term_investments, statement?.short_term_investments),
    accounts_receivable: pickInt(currentAssets?.accounts_receivable, statement?.accounts_receivable),
    inventory: pickInt(currentAssets?.inventory, statement?.inventory),
    non_current_assets: pickInt(
      nonCurrentAssets?.total_non_current_assets,
      assets?.non_current_assets,
      statement?.non_current_assets
    ),
    property_plant_equipment: pickInt(
      nonCurrentAssets?.properties,
      nonCurrentAssets?.property_plant_and_equipment,
      statement?.property_plant_and_equipment
    ),
    goodwill: pickInt(nonCurrentAssets?.goodwill, statement?.goodwill),
    intangible_assets: pickInt(nonCurrentAssets?.intangible_assets, statement?.intangible_assets),
    total_liabilities: pickInt(liabilities?.total_liabilities, statement?.total_liabilities),
    current_liabilities: pickInt(
      currentLiabilities?.total_current_liabilities,
      liabilities?.current_liabilities,
      statement?.current_liabilities
    ),
    accounts_payable: pickInt(currentLiabilities?.accounts_payable, statement?.accounts_payable),
    short_term_debt: pickInt(currentLiabilities?.short_term_debt, statement?.short_term_debt),
    non_current_liabilities: pickInt(
      nonCurrentLiabilities?.total_non_current_liabilities,
      liabilities?.non_current_liabilities,
      statement?.non_current_liabilities
    ),
    long_term_debt: pickInt(nonCurrentLiabilities?.long_term_debt, statement?.long_term_debt),
    total_equity: pickInt(
      equity?.total_shareholders_equity,
      statement?.shareholders_equity,
      statement?.total_equity
    ),
    retained_earnings: pickInt(equity?.retained_earnings, statement?.retained_earnings),
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
      .from('xray_balance_sheet')
      .select('*')
      .eq('symbol', sym)
      .eq('period', normalizedPeriod)
      .gte('fetched_at', new Date(Date.now() - DAY_MS).toISOString())
      .order('fiscal_date', { ascending: false })
      .limit(20);

    if (!cacheError && Array.isArray(cached) && cached.length > 0) {
      const fetchedAt = new Date().toISOString();
      const staleRows = cached.filter((row) => row?.raw_json && !hasAnyBalanceValue(row));
      let repairedRows = [];

      if (staleRows.length > 0) {
        repairedRows = staleRows.map((row) =>
          mapBalanceStatement(row?.raw_json || {}, {
            symbol: row?.symbol || sym,
            period: row?.period || normalizedPeriod,
            fiscalDate: row?.fiscal_date || null,
            fetchedAt,
          })
        );

        const { error: repairError } = await supabase
          .from('xray_balance_sheet')
          .upsert(repairedRows, { onConflict: 'symbol,period,fiscal_date' });

        if (repairError) {
          console.error('[xray/balance-sheet] cache repair upsert error:', repairError);
        }
      }

      const repairedMap = new Map(repairedRows.map((row) => [cacheKey(row), row]));
      const hydratedCache = cached.map((row) => {
        const repaired = repairedMap.get(cacheKey(row));
        return repaired ? { ...row, ...repaired } : row;
      });

      if (hydratedCache.some((row) => hasAnyBalanceValue(row))) {
        return res.status(200).json({
          source: repairedRows.length > 0 ? 'cache_repaired' : 'cache',
          data: hydratedCache,
        });
      }
    }

    const td = await fetchTwelveData('balance_sheet', {
      symbol: sym,
      period: normalizedPeriod,
    });

    const statements = Array.isArray(td?.balance_sheet) ? td.balance_sheet : [];
    const fetchedAt = new Date().toISOString();
    const rows = statements.map((statement) =>
      mapBalanceStatement(statement, {
        symbol: sym,
        period: normalizedPeriod,
        fetchedAt,
      })
    );

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from('xray_balance_sheet')
        .upsert(rows, { onConflict: 'symbol,period,fiscal_date' });

      if (upsertError) {
        console.error('[xray/balance-sheet] Supabase upsert error:', upsertError);
      }
    }

    return res.status(200).json({ source: 'twelvedata', data: rows });
  } catch (error) {
    const status = Number(error?.status) || 500;
    console.error('[xray/balance-sheet] error:', error);
    return res.status(status).json({ error: error?.message || 'Failed to fetch balance sheet' });
  }
}
