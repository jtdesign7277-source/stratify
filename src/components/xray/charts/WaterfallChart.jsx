import Highcharts from 'highcharts';
import ChartWrapper from './ChartWrapper';

function getIncomeWaterfallConfig(data) {
  const revenue = Number(data?.total_revenue) || 0;
  const grossProfit = Number(data?.gross_profit) || 0;
  const operatingExpenses = Number(data?.operating_expenses) || 0;
  const operatingIncome = Number(data?.operating_income) || 0;
  const netIncome = Number(data?.net_income) || 0;

  const cogs = revenue - grossProfit;
  const otherItems = netIncome - operatingIncome;

  return {
    chart: { 
      type: 'column', 
      height: 300,
      backgroundColor: 'transparent'
    },
    title: { text: null },
    xAxis: {
      categories: ['Revenue', 'COGS', 'Gross Profit', 'OpEx', 'Op. Income', 'Other', 'Net Income'],
      labels: { style: { fontSize: '9px', color: '#9ca3af' } },
      lineColor: '#374151',
    },
    yAxis: {
      title: { text: null },
      gridLineColor: '#374151',
      labels: {
        style: { color: '#9ca3af' },
        formatter() {
          return `$${(this.value / 1e9).toFixed(0)}B`;
        },
      },
      min: 0,
    },
    tooltip: {
      formatter() {
        const val = Math.abs(this.y);
        return `<b>${this.x}</b><br/>$${(val / 1e6).toLocaleString()}M`;
      },
    },
    legend: { enabled: false },
    plotOptions: {
      column: {
        pointPadding: 0.1,
        groupPadding: 0.15,
        borderWidth: 0,
        borderRadius: 3,
      },
    },
    series: [
      {
        data: [
          { y: revenue, color: '#3b82f6' },
          { y: cogs, color: '#ef4444' },
          { y: grossProfit, color: '#10b981' },
          { y: operatingExpenses, color: '#f97316' },
          { y: operatingIncome, color: '#10b981' },
          { y: Math.abs(otherItems), color: otherItems >= 0 ? '#6366f1' : '#ef4444' },
          { y: netIncome, color: '#22c55e' },
        ],
        dataLabels: {
          enabled: true,
          formatter() {
            return `$${(this.y / 1e9).toFixed(1)}B`;
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
