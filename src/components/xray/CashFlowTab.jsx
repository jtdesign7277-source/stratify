import CashFlowChart from './charts/CashFlowChart';
import FreeCashFlowChart from './charts/FreeCashFlowChart';
import StatCard from './StatCard';
import { useCashFlow } from './hooks/useTwelveData';
import { sortByFiscalDate, toBillions } from '../../lib/twelvedata';

export default function CashFlowTab({ symbol, period }) {
  const { data, loading, error } = useCashFlow(symbol, period);

  const statements = sortByFiscalDate(Array.isArray(data) ? data : [], true);
  const latest = sortByFiscalDate(statements, false)[0] || null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Operating CF"
          value={latest ? `${toBillions(latest.operating_cash_flow).toFixed(2)}B` : '--'}
          subvalue={latest?.fiscal_date || '--'}
          tone="accent"
        />
        <StatCard
          label="Investing CF"
          value={latest ? `${toBillions(latest.investing_cash_flow).toFixed(2)}B` : '--'}
          tone={(Number(latest?.investing_cash_flow) || 0) >= 0 ? 'positive' : 'negative'}
        />
        <StatCard
          label="Financing CF"
          value={latest ? `${toBillions(latest.financing_cash_flow).toFixed(2)}B` : '--'}
          tone={(Number(latest?.financing_cash_flow) || 0) >= 0 ? 'positive' : 'negative'}
        />
        <StatCard
          label="Free CF"
          value={latest ? `${toBillions(latest.free_cash_flow).toFixed(2)}B` : '--'}
          tone={(Number(latest?.free_cash_flow) || 0) >= 0 ? 'positive' : 'negative'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <CashFlowChart statements={statements} period={period} loading={loading} error={error} />
        <FreeCashFlowChart statements={statements} period={period} loading={loading} error={error} />
      </div>
    </div>
  );
}
