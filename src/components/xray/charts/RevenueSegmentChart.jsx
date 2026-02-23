import { useMemo } from 'react';
import ChartWrapper from './ChartWrapper';

const toSeries = (arr = []) => arr.map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0));

export function getRevenueSegmentsConfig(labels, segments, grossMargins) {
  return {
    chart: { type: 'column', height: 280 },
    title: { text: null },
    xAxis: { categories: labels, crosshair: true },
    yAxis: [
      {
        title: { text: null },
        labels: {
          formatter() {
            return '$' + (this.value / 1e3).toFixed(0) + 'B';
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
        let s = '<b>' + this.x + '</b><br/>';
        let total = 0;
        this.points.forEach((p) => {
          if (p.series.type === 'column') {
            s +=
              '<span style="color:' +
              p.color +
              '">●</span> ' +
              p.series.name +
              ': <b>$' +
              p.y.toLocaleString() +
              'M</b><br/>';
            total += p.y;
          } else {
            s +=
              '<span style="color:' +
              p.color +
              '">━</span> ' +
              p.series.name +
              ': <b>' +
              p.y.toFixed(1) +
              '%</b><br/>';
          }
        });
        s += '<br/><b>Total: $' + total.toLocaleString() + 'M</b>';
        return s;
      },
    },
    plotOptions: { column: { stacking: 'normal', borderWidth: 0, borderRadius: 3 } },
    legend: { enabled: true, align: 'left', verticalAlign: 'top' },
    series: [
      { name: 'Automotive', data: toSeries(segments.automotive), color: '#3b82f6', type: 'column' },
      { name: 'Energy', data: toSeries(segments.energy), color: '#10b981', type: 'column' },
      { name: 'Services', data: toSeries(segments.services), color: '#8b5cf6', type: 'column' },
      {
        name: 'Gross Margin',
        data: toSeries(grossMargins),
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

export default function RevenueSegmentChart({ labels = [], segments = {}, grossMargins = [] }) {
  const options = useMemo(
    () => getRevenueSegmentsConfig(labels, segments, grossMargins),
    [grossMargins, labels, segments]
  );

  return (
    <ChartWrapper
      title="Revenue Segments"
      subtitle="Stacked revenue mix with gross margin trend overlay"
      options={options}
      height={280}
    />
  );
}
