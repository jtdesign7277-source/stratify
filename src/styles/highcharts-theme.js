export function applyStratifyTheme(Highcharts) {
  Highcharts.setOptions({
    chart: {
      backgroundColor: 'transparent',
      style: {
        fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', 'Cascadia Code', monospace",
      },
    },
    title: {
      style: { color: '#e5e7eb', fontSize: '13px', fontWeight: '600' },
    },
    subtitle: {
      style: { color: '#6b7280', fontSize: '10px' },
    },
    xAxis: {
      gridLineColor: 'rgba(255,255,255,0.03)',
      lineColor: 'rgba(255,255,255,0.06)',
      tickColor: 'rgba(255,255,255,0.06)',
      labels: { style: { color: '#9ca3af', fontSize: '10px' } },
    },
    yAxis: {
      gridLineColor: 'rgba(255,255,255,0.04)',
      lineColor: 'rgba(255,255,255,0.06)',
      labels: { style: { color: '#6b7280', fontSize: '10px' } },
      title: { style: { color: '#6b7280' } },
    },
    legend: {
      itemStyle: { color: '#9ca3af', fontWeight: '400', fontSize: '10px' },
      itemHoverStyle: { color: '#e5e7eb' },
    },
    tooltip: {
      backgroundColor: 'rgba(6,13,24,0.96)',
      borderColor: 'rgba(59,130,246,0.2)',
      borderRadius: 8,
      style: { color: '#e5e7eb', fontSize: '11px' },
      shadow: false,
    },
    plotOptions: {
      series: { animation: { duration: 600 } },
      column: { borderWidth: 0, borderRadius: 3 },
      bar: { borderWidth: 0, borderRadius: 2 },
      waterfall: { borderWidth: 0, borderRadius: 3 },
    },
    credits: { enabled: false },
    navigator: {
      maskFill: 'rgba(59,130,246,0.08)',
      outlineColor: 'rgba(255,255,255,0.08)',
      handles: { backgroundColor: '#3b82f6', borderColor: '#1d4ed8' },
      series: { color: '#3b82f6', lineWidth: 1 },
    },
    rangeSelector: {
      buttonTheme: {
        fill: 'rgba(255,255,255,0.04)',
        stroke: 'rgba(255,255,255,0.08)',
        style: { color: '#9ca3af', fontSize: '10px' },
        states: {
          hover: { fill: 'rgba(59,130,246,0.15)', style: { color: '#e5e7eb' } },
          select: {
            fill: 'rgba(59,130,246,0.25)',
            style: { color: '#3b82f6', fontWeight: '600' },
          },
        },
      },
      inputStyle: { color: '#e5e7eb' },
      labelStyle: { color: '#6b7280' },
    },
    scrollbar: { enabled: false },
  });
}

export default applyStratifyTheme;
