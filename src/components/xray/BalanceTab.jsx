import BalanceBarChart from './charts/BalanceBarChart';
import StatCard from './StatCard';
import { useBalanceSheet } from './hooks/useTwelveData';
import { formatPercent, sortByFiscalDate, toBillions } from '../../lib/twelvedata';

const ratio = (a, b) => {
  const left = Number(a);
  const right = Number(b);
  if (!Number.isFinite(left) || !Number.isFinite(right) || right === 0) return null;
  return left / right;
};

export default function BalanceTab({ symbol, period }) {
  const { data, loading, error } = useBalanceSheet(symbol, period);

  const statements = sortByFiscalDate(Array.isArray(data) ? data : [], true);
  const latest = sortByFiscalDate(statements, false)[0] || null;

  const currentRatio = ratio(latest?.current_assets, latest?.current_liabilities);
  const debtToAssets = ratio(latest?.total_liabilities, latest?.total_assets);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Total Assets"
          value={latest ? `${toBillions(latest.total_assets).toFixed(2)}B` : '--'}
          subvalue={latest?.fiscal_date || '--'}
          tone="accent"
        />
        <StatCard
          label="Total Liabilities"
          value={latest ? `${toBillions(latest.total_liabilities).toFixed(2)}B` : '--'}
          tone="negative"
        />
        <StatCard
          label="Total Equity"
          value={latest ? `${toBillions(latest.total_equity).toFixed(2)}B` : '--'}
          tone="positive"
        />
        <StatCard
          label="Current Ratio"
          value={currentRatio !== null ? currentRatio.toFixed(2) : '--'}
          subvalue={debtToAssets !== null ? `Debt/Assets ${formatPercent(debtToAssets * 100)}` : '--'}
        />
      </div>

      <BalanceBarChart statements={statements} period={period} loading={loading} error={error} />
    </div>
  );
}
