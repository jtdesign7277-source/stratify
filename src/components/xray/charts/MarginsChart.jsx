import ChartWrapper from './ChartWrapper';
import { getPeriodLabel, sortByFiscalDate } from '../../../lib/twelvedata';

function getMarginsTrendConfig(labels, grossMargins, opMargins, netMargins) {
  return {
    chart: { type: 'spline', height: 170 },
    title: { text: null },
    xAxis: { categories: labels },
    yAxis: {
      title: { text: null },
      labels: { format: '{value}%' },
      plotLines: [{ value: 0, color: 'rgba(255,255,255,0.08)', width: 1 }],
    },
    tooltip: { shared: true, valueSuffix: '%' },
    legend: { enabled: true, align: 'left', verticalAlign: 'top' },
    series: [
      { name: 'Gross', data: grossMargins, color: '#3b82f6', lineWidth: 2.5, marker: { radius: 4 } },
      { name: 'Operating', data: opMargins, color: '#f59e0b', lineWidth: 2.5, marker: { radius: 4 } },
      { name: 'Net', data: netMargins, color: '#10b981', lineWidth: 2.5, marker: { radius: 4 } },
    ],
  };
}

export default function MarginsChart({ statements = [], period = 'annual', loading = false, error = null }) {
  const rows = sortByFiscalDate(statements, true);
  const labels = rows.map((row) => getPeriodLabel(row, period));
  const grossMargins = rows.map((row) => Number(row?.gross_margin) || 0);
  const opMargins = rows.map((row) => Number(row?.operating_margin) || 0);
  const netMargins = rows.map((row) => Number(row?.net_margin) || 0);

  const hasData = rows.length > 0;
  const options = hasData ? getMarginsTrendConfig(labels, grossMargins, opMargins, netMargins) : null;

  return (
    <ChartWrapper
      title="Margins Trend"
      subtitle="Gross, operating, and net margins over time"
      options={options}
      loading={loading}
      error={error}
      empty={!hasData}
    />
  );
}
