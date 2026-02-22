import ChartWrapper from './ChartWrapper';
import { getPeriodLabel, sortByFiscalDate, toMillions } from '../../../lib/twelvedata';

function getIncomeComparisonConfig(labels, grossProfit, opIncome, netIncome) {
  return {
    chart: { type: 'column', height: 260 },
    title: { text: null },
    xAxis: { categories: labels, crosshair: true },
    yAxis: {
      title: { text: null },
      labels: {
        formatter() {
          return `$${(this.value / 1e3).toFixed(0)}B`;
        },
      },
    },
    tooltip: { shared: true, valuePrefix: '$', valueSuffix: 'M' },
    plotOptions: { column: { borderWidth: 0, borderRadius: 3, groupPadding: 0.15 } },
    legend: { enabled: true, align: 'left', verticalAlign: 'top' },
    series: [
      { name: 'Gross Profit', data: grossProfit, color: '#3b82f6' },
      { name: 'Operating Income', data: opIncome, color: '#f59e0b' },
      { name: 'Net Income', data: netIncome, color: '#10b981' },
    ],
  };
}

export default function IncomeCompChart({ statements = [], period = 'annual', loading = false, error = null }) {
  const rows = sortByFiscalDate(statements, true);
  const labels = rows.map((row) => getPeriodLabel(row, period));
  const grossProfit = rows.map((row) => toMillions(row?.gross_profit));
  const opIncome = rows.map((row) => toMillions(row?.operating_income));
  const netIncome = rows.map((row) => toMillions(row?.net_income));

  const hasData = rows.length > 0;
  const options = hasData ? getIncomeComparisonConfig(labels, grossProfit, opIncome, netIncome) : null;

  return (
    <ChartWrapper
      title="Income Comparison"
      subtitle="Gross vs operating vs net income"
      options={options}
      loading={loading}
      error={error}
      empty={!hasData}
    />
  );
}
