import ChartWrapper from './ChartWrapper';
import { getPeriodLabel, sortByFiscalDate, toMillions } from '../../../lib/twelvedata';

function getCashFlowGroupedConfig(labels, operating, investing, financing) {
  return {
    chart: { type: 'column', height: 300 },
    title: { text: null },
    xAxis: { categories: labels, crosshair: true },
    yAxis: {
      title: { text: null },
      labels: {
        formatter() {
          return `$${(this.value / 1e3).toFixed(0)}B`;
        },
      },
      plotLines: [{ value: 0, color: 'rgba(255,255,255,0.1)', width: 1 }],
    },
    tooltip: { shared: true, valuePrefix: '$', valueSuffix: 'M' },
    plotOptions: { column: { borderWidth: 0, borderRadius: 3, groupPadding: 0.15 } },
    legend: { enabled: true, align: 'left', verticalAlign: 'top' },
    series: [
      { name: 'Operating', data: operating, color: '#3b82f6' },
      { name: 'Investing', data: investing, color: '#f59e0b' },
      { name: 'Financing', data: financing, color: '#8b5cf6' },
    ],
  };
}

export default function CashFlowChart({ statements = [], period = 'annual', loading = false, error = null }) {
  const rows = sortByFiscalDate(statements, true);
  const labels = rows.map((row) => getPeriodLabel(row, period));
  const operating = rows.map((row) => toMillions(row?.operating_cash_flow));
  const investing = rows.map((row) => toMillions(row?.investing_cash_flow));
  const financing = rows.map((row) => toMillions(row?.financing_cash_flow));

  const hasData = rows.length > 0;
  const options = hasData ? getCashFlowGroupedConfig(labels, operating, investing, financing) : null;

  return (
    <ChartWrapper
      title="Cash Flow Mix"
      subtitle="Operating, investing, and financing cash flow"
      options={options}
      loading={loading}
      error={error}
      empty={!hasData}
    />
  );
}
