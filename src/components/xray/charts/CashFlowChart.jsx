import { useMemo } from 'react';
import ChartWrapper from './ChartWrapper';

const toSeries = (arr = []) => arr.map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0));

export function getCashFlowGroupedConfig(labels, operating, investing, financing) {
  return {
    chart: { type: 'column', height: 300 },
    title: { text: null },
    xAxis: { categories: labels, crosshair: true },
    yAxis: {
      title: { text: null },
      labels: {
        formatter() {
          return '$' + (this.value / 1e3).toFixed(0) + 'B';
        },
      },
      plotLines: [{ value: 0, color: 'rgba(255,255,255,0.1)', width: 1 }],
    },
    tooltip: { shared: true, valuePrefix: '$', valueSuffix: 'M' },
    plotOptions: { column: { borderWidth: 0, borderRadius: 3, groupPadding: 0.15 } },
    legend: { enabled: true, align: 'left', verticalAlign: 'top' },
    series: [
      { name: 'Operating', data: toSeries(operating), color: '#3b82f6' },
      { name: 'Investing', data: toSeries(investing), color: '#f59e0b' },
      { name: 'Financing', data: toSeries(financing), color: '#8b5cf6' },
    ],
  };
}

export default function CashFlowChart({ labels = [], operating = [], investing = [], financing = [] }) {
  const options = useMemo(
    () => getCashFlowGroupedConfig(labels, operating, investing, financing),
    [financing, investing, labels, operating]
  );

  return (
    <ChartWrapper
      title="Cash Flow Components"
      subtitle="Operating, investing, and financing cash flow by period"
      options={options}
      height={300}
    />
  );
}
