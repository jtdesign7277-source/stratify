import WaterfallChart from './charts/WaterfallChart';
import RevenueSegmentChart from './charts/RevenueSegmentChart';
import MarginsChart from './charts/MarginsChart';
import IncomeCompChart from './charts/IncomeCompChart';
import StatCard from './StatCard';
import { useIncomeStatement } from './hooks/useTwelveData';
import { formatCurrency, formatPercent, sortByFiscalDate, toBillions } from '../../lib/twelvedata';

export default function IncomeTab({ symbol, period }) {
  const { data, loading, error } = useIncomeStatement(symbol, period);

  const statements = sortByFiscalDate(Array.isArray(data) ? data : [], true);
  const latest = sortByFiscalDate(statements, false)[0] || null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Revenue"
          value={latest ? `${toBillions(latest.total_revenue).toFixed(2)}B` : '--'}
          subvalue={latest?.fiscal_date || '--'}
          tone="accent"
        />
        <StatCard
          label="Gross Margin"
          value={latest ? formatPercent(latest.gross_margin) : '--'}
          tone="positive"
        />
        <StatCard
          label="Operating Margin"
          value={latest ? formatPercent(latest.operating_margin) : '--'}
          tone={(Number(latest?.operating_margin) || 0) >= 0 ? 'positive' : 'negative'}
        />
        <StatCard
          label="EPS Diluted"
          value={latest?.eps_diluted !== null && latest?.eps_diluted !== undefined ? formatCurrency(latest.eps_diluted) : '--'}
          tone="default"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <WaterfallChart statement={latest} loading={loading} error={error} />
        <RevenueSegmentChart statements={statements} period={period} loading={loading} error={error} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <MarginsChart statements={statements} period={period} loading={loading} error={error} />
        <IncomeCompChart statements={statements} period={period} loading={loading} error={error} />
      </div>
    </div>
  );
}
