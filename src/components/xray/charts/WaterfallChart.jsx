import Highcharts from 'highcharts';
import HighchartsMore from 'highcharts/highcharts-more';
import ChartWrapper from './ChartWrapper';

if (typeof HighchartsMore === 'function') {
  HighchartsMore(Highcharts);
}

function getIncomeWaterfallConfig(data) {
  const revenue = Number(data?.total_revenue) || 0;
  const grossProfit = Number(data?.gross_profit) || 0;
  const operatingExpenses = Number(data?.operating_expenses) || 0;
  const operatingIncome = Number(data?.operating_income) || 0;
  const netIncome = Number(data?.net_income) || 0;

  const cogs = revenue - grossProfit;
  const otherItems = netIncome - operatingIncome;

  return {
    chart: { type: 'waterfall', height: 300 },
    title: { text: null },
    xAxis: {
      type: 'category',
      labels: { style: { fontSize: '9px' } },
    },
    yAxis: {
      title: { text: null },
      labels: {
        formatter() {
          return `$${(this.value / 1e9).toFixed(0)}B`;
        },
      },
    },
    tooltip: {
      formatter() {
        const val = Math.abs(this.y);
        const sign = this.y < 0 ? '-' : '+';
        const label = this.point.isSum || this.point.isIntermediateSum ? '' : sign;
        return `<b>${this.key}</b><br/>${label}$${(val / 1e6).toLocaleString()}M`;
      },
    },
    legend: { enabled: false },
    series: [
      {
        borderWidth: 0,
        borderRadius: 3,
        data: [
          { name: 'Revenue', y: revenue, color: '#3b82f6' },
          { name: 'COGS', y: -cogs, color: '#ef4444' },
          { name: 'Gross Profit', isIntermediateSum: true, color: '#10b981' },
          { name: 'OpEx', y: -operatingExpenses, color: '#f97316' },
          { name: 'Op. Income', isIntermediateSum: true, color: '#10b981' },
          { name: 'Other', y: otherItems, color: otherItems >= 0 ? '#6366f1' : '#ef4444' },
          { name: 'Net Income', isSum: true, color: '#22c55e' },
        ],
        dataLabels: {
          enabled: true,
          formatter() {
            return `$${(Math.abs(this.y) / 1e9).toFixed(1)}B`;
          },
          style: {
            color: '#e5e7eb',
            fontSize: '9px',
            fontWeight: '500',
            textOutline: 'none',
          },
        },
      },
    ],
  };
}

export default function WaterfallChart({ statement, loading = false, error = null }) {
  const hasData = !!statement;
  const options = hasData ? getIncomeWaterfallConfig(statement) : null;

  return (
    <ChartWrapper
      title="Income Waterfall"
      subtitle="Revenue to net income bridge"
      options={options}
      loading={loading}
      error={error}
      empty={!hasData}
    />
  );
}
