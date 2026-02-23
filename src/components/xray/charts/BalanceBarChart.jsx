import { useMemo } from 'react';
import ChartWrapper from './ChartWrapper';

const toSeries = (arr = []) => arr.map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0));

export function getBalanceSheetBarConfig(
  labels,
  currentAssets,
  nonCurrentAssets,
  currentLiab,
  nonCurrentLiab,
  equity
) {
  return {
    chart: { type: 'bar', height: 320 },
    title: { text: null },
    xAxis: { categories: labels, crosshair: true },
    yAxis: {
      title: { text: null },
      labels: {
        formatter() {
          return '$' + (Math.abs(this.value) / 1e3).toFixed(0) + 'B';
        },
      },
    },
    tooltip: {
      shared: true,
      formatter() {
        let s = '<b>' + this.x + '</b><br/>';
        this.points.forEach((p) => {
          s +=
            '<span style="color:' +
            p.color +
            '">●</span> ' +
            p.series.name +
            ': <b>$' +
            Math.abs(p.y).toLocaleString() +
            'M</b><br/>';
        });
        return s;
      },
    },
    plotOptions: { bar: { stacking: 'normal', borderWidth: 0, borderRadius: 2 } },
    legend: { enabled: true, align: 'left', verticalAlign: 'top' },
    series: [
      { name: 'Current Assets', data: toSeries(currentAssets), color: '#3b82f6' },
      { name: 'Non-Current Assets', data: toSeries(nonCurrentAssets), color: '#60a5fa' },
      { name: 'Current Liabilities', data: toSeries(currentLiab).map((v) => -v), color: '#ef4444' },
      { name: 'Non-Current Liab.', data: toSeries(nonCurrentLiab).map((v) => -v), color: '#f87171' },
      { name: 'Equity', data: toSeries(equity).map((v) => -v), color: '#10b981' },
    ],
  };
}

export default function BalanceBarChart({
  labels = [],
  currentAssets = [],
  nonCurrentAssets = [],
  currentLiab = [],
  nonCurrentLiab = [],
  equity = [],
}) {
  const options = useMemo(
    () =>
      getBalanceSheetBarConfig(
        labels,
        currentAssets,
        nonCurrentAssets,
        currentLiab,
        nonCurrentLiab,
        equity
      ),
    [currentAssets, currentLiab, equity, labels, nonCurrentAssets, nonCurrentLiab]
  );

  return (
    <ChartWrapper
      title="Assets vs Liabilities & Equity"
      subtitle="Stacked balance composition (liabilities/equity shown on negative axis)"
      options={options}
      height={320}
    />
  );
}
