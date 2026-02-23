import { useMemo } from 'react';
import ChartWrapper from './ChartWrapper';

const toSeries = (arr = []) => arr.map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0));

export function getIncomeComparisonConfig(labels, grossProfit, opIncome, netIncome) {
  return {
    chart: { type: 'column', height: 260 },
    title: { text: null },
    xAxis: { categories: labels, crosshair: true },
    yAxis: {
      title: { text: null },
      labels: {
        formatter() {
          return '$' + (this.value / 1e3).toFixed(0) + 'B';
        },
      },
    },
    tooltip: { shared: true, valuePrefix: '$', valueSuffix: 'M' },
    plotOptions: { column: { borderWidth: 0, borderRadius: 3, groupPadding: 0.15 } },
    legend: { enabled: true, align: 'left', verticalAlign: 'top' },
    series: [
      { name: 'Gross Profit', data: toSeries(grossProfit), color: '#3b82f6' },
      { name: 'Operating Income', data: toSeries(opIncome), color: '#f59e0b' },
      { name: 'Net Income', data: toSeries(netIncome), color: '#10b981' },
    ],
  };
}

export default function IncomeCompChart({ labels = [], grossProfit = [], opIncome = [], netIncome = [] }) {
  const options = useMemo(
    () => getIncomeComparisonConfig(labels, grossProfit, opIncome, netIncome),
    [grossProfit, labels, netIncome, opIncome]
  );

  return (
    <ChartWrapper
      title="Profitability Comparison"
      subtitle="Gross profit vs operating income vs net income"
      options={options}
      height={260}
    />
  );
}
