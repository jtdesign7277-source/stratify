import { useMemo } from 'react';
import ChartWrapper from './ChartWrapper';

const toSeries = (arr = []) => arr.map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0));

export function getMarginsTrendConfig(labels, grossMargins, opMargins, netMargins) {
  return {
    chart: { type: 'spline', height: 240 },
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
      { name: 'Gross', data: toSeries(grossMargins), color: '#3b82f6', lineWidth: 2.5, marker: { radius: 4 } },
      { name: 'Operating', data: toSeries(opMargins), color: '#f59e0b', lineWidth: 2.5, marker: { radius: 4 } },
      { name: 'Net', data: toSeries(netMargins), color: '#10b981', lineWidth: 2.5, marker: { radius: 4 } },
    ],
  };
}

export default function MarginsChart({ labels = [], grossMargins = [], opMargins = [], netMargins = [] }) {
  const options = useMemo(
    () => getMarginsTrendConfig(labels, grossMargins, opMargins, netMargins),
    [grossMargins, labels, netMargins, opMargins]
  );

  return (
    <ChartWrapper
      title="Margins Trend"
      subtitle="Gross, operating, and net margin progression"
      options={options}
      height={240}
    />
  );
}
