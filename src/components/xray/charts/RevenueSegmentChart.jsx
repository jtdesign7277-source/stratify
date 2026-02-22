import ChartWrapper from './ChartWrapper';
import { getPeriodLabel, parseRevenueSegments, sortByFiscalDate, toMillions } from '../../../lib/twelvedata';

function getRevenueSegmentsConfig(labels, segments, grossMargins) {
  return {
    chart: { type: 'column', height: 280 },
    title: { text: null },
    xAxis: { categories: labels, crosshair: true },
    yAxis: [
      {
        title: { text: null },
        labels: {
          formatter() {
            return `$${(this.value / 1e3).toFixed(0)}B`;
          },
        },
      },
      {
        title: { text: null },
        labels: { format: '{value}%' },
        opposite: true,
        max: 30,
        min: 0,
      },
    ],
    tooltip: {
      shared: true,
      formatter() {
        let s = `<b>${this.x}</b><br/>`;
        let total = 0;
        this.points.forEach((point) => {
          if (point.series.type === 'column') {
            s += `<span style="color:${point.color}">●</span> ${point.series.name}: <b>$${point.y.toLocaleString()}M</b><br/>`;
            total += point.y;
          } else {
            s += `<span style="color:${point.color}">━</span> ${point.series.name}: <b>${point.y.toFixed(1)}%</b><br/>`;
          }
        });
        s += `<br/><b>Total: $${total.toLocaleString()}M</b>`;
        return s;
      },
    },
    plotOptions: { column: { stacking: 'normal', borderWidth: 0, borderRadius: 3 } },
    legend: { enabled: true, align: 'left', verticalAlign: 'top' },
    series: [
      { name: 'Automotive', data: segments.automotive, color: '#3b82f6', type: 'column' },
      { name: 'Energy', data: segments.energy, color: '#10b981', type: 'column' },
      { name: 'Services', data: segments.services, color: '#8b5cf6', type: 'column' },
      {
        name: 'Gross Margin',
        data: grossMargins,
        color: '#f59e0b',
        type: 'spline',
        yAxis: 1,
        lineWidth: 2.5,
        marker: { radius: 4, fillColor: '#f59e0b', lineColor: '#060d18', lineWidth: 2 },
        zIndex: 5,
      },
    ],
  };
}

export default function RevenueSegmentChart({ statements = [], period = 'annual', loading = false, error = null }) {
  const rows = sortByFiscalDate(statements, true).slice(-5);

  const labels = rows.map((row) => getPeriodLabel(row, period));
  const segments = {
    automotive: rows.map((row) => toMillions(parseRevenueSegments(row).automotive)),
    energy: rows.map((row) => toMillions(parseRevenueSegments(row).energy)),
    services: rows.map((row) => toMillions(parseRevenueSegments(row).services)),
  };
  const grossMargins = rows.map((row) => Number(row?.gross_margin) || 0);

  const hasData = rows.length > 0;
  const options = hasData ? getRevenueSegmentsConfig(labels, segments, grossMargins) : null;

  return (
    <ChartWrapper
      title="Revenue Segments"
      subtitle="Segment mix with gross margin overlay"
      options={options}
      loading={loading}
      error={error}
      empty={!hasData}
    />
  );
}
