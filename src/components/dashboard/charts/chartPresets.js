export const CHART_PRESETS = [
  {
    id: 'candlestick-basic',
    name: 'Candlestick Demo',
    description: 'AAPL OHLC candlestick chart.',
    dataUrl: 'https://demo-live-data.highcharts.com/aapl-ohlc.json',
  },
  {
    id: 'technical-annotations',
    name: 'Technical analysis with annotations',
    description: 'Resistance zone + Fibonacci + trendline.',
    dataUrl: 'https://www.highcharts.com/samples/data/mini-ohlc.json',
  },
];

const baseDarkTheme = {
  chart: {
    backgroundColor: '#060d18',
  },
  credits: {
    enabled: false,
  },
  navigator: {
    maskFill: 'rgba(59,130,246,0.12)',
    series: {
      color: '#1d4ed8',
      lineWidth: 1.2,
    },
    handles: {
      backgroundColor: '#0a1628',
      borderColor: '#334155',
    },
    xAxis: {
      labels: {
        style: {
          color: '#94a3b8',
        },
      },
    },
  },
  scrollbar: {
    barBackgroundColor: '#1e293b',
    barBorderColor: '#334155',
    buttonBackgroundColor: '#0a1628',
    buttonBorderColor: '#334155',
    trackBackgroundColor: '#060d18',
    trackBorderColor: '#1a2332',
    rifleColor: '#94a3b8',
    buttonArrowColor: '#94a3b8',
  },
  rangeSelector: {
    selected: 1,
    inputEnabled: false,
    buttonTheme: {
      fill: '#0a1628',
      stroke: '#1f2937',
      style: { color: '#cbd5e1' },
      states: {
        hover: { fill: '#172554', style: { color: '#dbeafe' } },
        select: { fill: '#1d4ed8', style: { color: '#eff6ff' } },
      },
    },
    labelStyle: { color: '#94a3b8' },
  },
  xAxis: {
    lineColor: '#1f2937',
    labels: {
      style: {
        color: '#94a3b8',
      },
    },
  },
  yAxis: {
    gridLineColor: '#1a2332',
    labels: {
      style: {
        color: '#94a3b8',
      },
    },
  },
  legend: {
    enabled: false,
  },
  tooltip: {
    backgroundColor: '#0a1628',
    borderColor: '#1e293b',
    style: {
      color: '#e2e8f0',
    },
  },
};

const buildCandlestickDemo = (data) => ({
  ...baseDarkTheme,
  title: {
    text: 'AAPL Stock Price',
    style: { color: '#f8fafc' },
  },
  series: [
    {
      type: 'candlestick',
      name: 'AAPL Stock Price',
      data,
      color: '#ef4444',
      upColor: '#22c55e',
      lineColor: '#ef4444',
      upLineColor: '#22c55e',
      dataGrouping: {
        units: [
          ['week', [1]],
          ['month', [1, 2, 3, 4, 6]],
        ],
      },
    },
  ],
});

const buildTechnicalWithAnnotations = (data) => ({
  ...baseDarkTheme,
  title: {
    text: 'Technical analysis with annotations',
    style: { color: '#f8fafc' },
  },
  yAxis: {
    ...baseDarkTheme.yAxis,
    plotBands: [
      {
        color: 'rgba(169, 255, 101, 0.4)',
        from: 182.94,
        to: 177.57,
        zIndex: 3,
        label: {
          text: 'Resistance Zone',
          style: { color: '#0f172a', fontWeight: '600' },
        },
      },
    ],
  },
  annotations: [
    {
      type: 'fibonacci',
      langKey: 'Fibonacci',
      typeOptions: {
        points: [
          { x: 1631021400000, y: 157.26 },
          { x: 1633354200000, y: 157.26 },
        ],
        height: 138.27 - 157.26,
        xAxis: 0,
        yAxis: 0,
      },
    },
    {
      type: 'crookedLine',
      langKey: 'Trendline',
      typeOptions: {
        points: [
          { x: 1636727400000, y: 147.48 },
          { x: 1642516200000, y: 182.5 },
        ],
      },
      shapeOptions: {
        stroke: 'orange',
        strokeWidth: 2,
      },
    },
  ],
  series: [
    {
      id: 'main',
      type: 'candlestick',
      color: '#FF6F6F',
      upColor: '#6FB76F',
      data,
      dataGrouping: {
        enabled: false,
      },
    },
  ],
});

export const buildChartOptions = ({ presetId, data }) => {
  if (presetId === 'technical-annotations') {
    return buildTechnicalWithAnnotations(data);
  }
  return buildCandlestickDemo(data);
};
