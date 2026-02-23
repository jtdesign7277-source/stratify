import ChartWrapper from './ChartWrapper';
import { getPeriodLabel, sortByFiscalDate, toMillions } from '../../../lib/twelvedata';

function getBalanceSheetBarConfig(labels, currentAssets, nonCurrentAssets, currentLiab, nonCurrentLiab, equity) {
  return {
    chart: { type: 'bar', height: 220 },
    title: { text: null },
    xAxis: { categories: labels, crosshair: true },
    yAxis: {
      title: { text: null },
      labels: {
        formatter() {
          return `$${(Math.abs(this.value) / 1e3).toFixed(0)}B`;
        },
      },
    },
    tooltip: {
      shared: true,
      formatter() {
        let s = `<b>${this.x}</b><br/>`;
        this.points.forEach((point) => {
          s += `<span style="color:${point.color}">●</span> ${point.series.name}: <b>$${Math.abs(point.y).toLocaleString()}M</b><br/>`;
        });
        return s;
      },
    },
    plotOptions: { bar: { stacking: 'normal', borderWidth: 0, borderRadius: 2 } },
    legend: { enabled: true, align: 'left', verticalAlign: 'top' },
    series: [
      { name: 'Current Assets', data: currentAssets, color: '#3b82f6' },
      { name: 'Non-Current Assets', data: nonCurrentAssets, color: '#60a5fa' },
      { name: 'Current Liabilities', data: currentLiab.map((v) => -v), color: '#ef4444' },
      { name: 'Non-Current Liab.', data: nonCurrentLiab.map((v) => -v), color: '#f87171' },
      { name: 'Equity', data: equity.map((v) => -v), color: '#10b981' },
    ],
  };
}

export default function BalanceBarChart({ statements = [], period = 'annual', loading = false, error = null }) {
  const rows = sortByFiscalDate(statements, true);
  const labels = rows.map((row) => getPeriodLabel(row, period));

  const currentAssets = rows.map((row) => toMillions(row?.current_assets));
  const nonCurrentAssets = rows.map((row) => toMillions(row?.non_current_assets));
  const currentLiab = rows.map((row) => toMillions(row?.current_liabilities));
  const nonCurrentLiab = rows.map((row) => toMillions(row?.non_current_liabilities));
  const equity = rows.map((row) => toMillions(row?.total_equity));

  const hasData = rows.length > 0;
  const options = hasData
    ? getBalanceSheetBarConfig(labels, currentAssets, nonCurrentAssets, currentLiab, nonCurrentLiab, equity)
    : null;

  return (
    <ChartWrapper
      title="Balance Sheet Composition"
      subtitle="Assets versus liabilities and equity"
      options={options}
      loading={loading}
      error={error}
      empty={!hasData}
    />
  );
}
