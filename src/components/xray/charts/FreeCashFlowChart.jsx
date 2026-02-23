import ChartWrapper from './ChartWrapper';
import { getPeriodLabel, sortByFiscalDate, toMillions } from '../../../lib/twelvedata';

function getFreeCashFlowConfig(labels, operatingCF, investingCF) {
  const freeCF = operatingCF.map((value, index) => value + (investingCF[index] || 0));

  return {
    chart: { type: 'areaspline', height: 180 },
    title: { text: null },
    xAxis: { categories: labels },
    yAxis: {
      title: { text: null },
      labels: {
        formatter() {
          return `$${(this.value / 1e3).toFixed(0)}B`;
        },
      },
      plotLines: [{ value: 0, color: 'rgba(255,255,255,0.08)', width: 1 }],
    },
    tooltip: { valuePrefix: '$', valueSuffix: 'M' },
    legend: { enabled: true, align: 'left', verticalAlign: 'top' },
    series: [
      {
        name: 'Operating CF',
        data: operatingCF,
        color: '#3b82f6',
        fillColor: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [
            [0, 'rgba(59,130,246,0.2)'],
            [1, 'rgba(59,130,246,0)'],
          ],
        },
        lineWidth: 2,
        marker: { radius: 4 },
      },
      {
        name: 'Free Cash Flow',
        data: freeCF,
        color: '#10b981',
        fillColor: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [
            [0, 'rgba(16,185,129,0.2)'],
            [1, 'rgba(16,185,129,0)'],
          ],
        },
        lineWidth: 2,
        marker: { radius: 4 },
      },
    ],
  };
}

export default function FreeCashFlowChart({ statements = [], period = 'annual', loading = false, error = null }) {
  const rows = sortByFiscalDate(statements, true);
  const labels = rows.map((row) => getPeriodLabel(row, period));
  const operatingCF = rows.map((row) => toMillions(row?.operating_cash_flow));
  const investingCF = rows.map((row) => toMillions(row?.investing_cash_flow));

  const hasData = rows.length > 0;
  const options = hasData ? getFreeCashFlowConfig(labels, operatingCF, investingCF) : null;

  return (
    <ChartWrapper
      title="Free Cash Flow"
      subtitle="Operating cash flow versus free cash flow"
      options={options}
      loading={loading}
      error={error}
      empty={!hasData}
    />
  );
}
