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
  {
    id: 'volume-proportional-width',
    name: 'Volume width candlesticks',
    description: 'Hollow candlesticks with proportional width by volume.',
    dataUrl: 'https://demo-live-data.highcharts.com/aapl-ohlcv.json',
  },
  {
    id: 'candlestick-volume-ikh',
    name: 'Candlestick + Volume + IKH',
    description: 'Dark style candlesticks with volume and Ichimoku overlay.',
    dataUrl: 'https://demo-live-data.highcharts.com/aapl-ohlcv.json',
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

const buildVolumeProportionalWidth = (data) => {
  const ohlc = [];
  const volume = [];
  let previousCandleClose = 0;

  for (let i = 0; i < data.length; i += 1) {
    const row = data[i];
    if (!Array.isArray(row) || row.length < 6) continue;

    ohlc.push([
      row[0], // date
      row[1], // open
      row[2], // high
      row[3], // low
      row[4], // close
    ]);

    volume.push({
      x: row[0],
      y: row[5],
      color: row[4] > previousCandleClose ? '#466742' : '#a23f43',
    });

    previousCandleClose = row[4];
  }

  return {
    ...baseDarkTheme,
    title: {
      text: 'Volume width candlesticks',
      style: { color: '#f8fafc' },
    },
    plotOptions: {
      series: {
        dataGrouping: {
          units: [
            ['week', [1]],
            ['month', [1, 2, 3, 4, 6]],
          ],
        },
        groupPadding: 0,
        pointPadding: 0,
      },
    },
    rangeSelector: {
      ...baseDarkTheme.rangeSelector,
      selected: 4,
    },
    navigator: {
      enabled: false,
    },
    yAxis: [
      {
        labels: {
          align: 'left',
          style: { color: '#94a3b8' },
        },
        height: '80%',
        resize: { enabled: true },
      },
      {
        labels: {
          align: 'left',
          style: { color: '#94a3b8' },
        },
        top: '80%',
        height: '20%',
        offset: 0,
      },
    ],
    tooltip: {
      shape: 'square',
      headerShape: 'callout',
      borderWidth: 0,
      shadow: false,
      fixed: true,
      backgroundColor: '#0a1628',
      style: { color: '#e2e8f0' },
    },
    series: [
      {
        type: 'hollowcandlestick',
        id: 'aapl-ohlc',
        name: 'AAPL Stock Price',
        data: ohlc,
        baseVolume: 'aapl-volume',
      },
      {
        type: 'column',
        id: 'aapl-volume',
        name: 'AAPL Volume',
        data: volume,
        yAxis: 1,
        baseVolume: 'aapl-volume',
        borderRadius: 0,
      },
    ],
    responsive: {
      rules: [
        {
          condition: { maxWidth: 800 },
          chartOptions: {
            rangeSelector: { inputEnabled: false },
          },
        },
      ],
    },
  };
};

const buildCandlestickVolumeIkh = (data) => {
  const ohlc = [];
  const volume = [];

  let previousCandleClose = 0;
  for (let i = 0; i < data.length; i += 1) {
    const row = data[i];
    if (!Array.isArray(row) || row.length < 6) continue;

    ohlc.push([
      row[0], // date
      row[1], // open
      row[2], // high
      row[3], // low
      row[4], // close
    ]);

    volume.push({
      x: row[0], // date
      y: row[5], // volume
      color: row[4] > previousCandleClose ? '#466742' : '#a23f43',
      labelColor: row[4] > previousCandleClose ? '#51a958' : '#ea3d3d',
    });

    previousCandleClose = row[4];
  }

  return {
    chart: {
      backgroundColor: '#0a0a0a',
    },
    title: {
      text: 'Candlestick and Volume',
      style: {
        color: '#cccccc',
      },
    },
    credits: {
      enabled: false,
    },
    rangeSelector: {
      enabled: false,
    },
    navigator: {
      enabled: false,
    },
    xAxis: {
      gridLineWidth: 1,
      gridLineColor: '#181816',
      labels: {
        style: {
          color: '#9d9da2',
        },
      },
      crosshair: {
        snap: false,
      },
    },
    yAxis: [
      {
        height: '70%',
        gridLineColor: '#181816',
        labels: {
          style: {
            color: '#9d9da2',
          },
        },
        crosshair: {
          snap: false,
        },
        accessibility: {
          description: 'price',
        },
      },
      {
        top: '70%',
        height: '30%',
        gridLineColor: '#181816',
        labels: {
          style: {
            color: '#9d9da2',
          },
        },
        accessibility: {
          description: 'volume',
        },
      },
    ],
    tooltip: {
      shared: true,
      split: false,
      fixed: true,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      style: {
        color: '#cdcdc9',
      },
    },
    scrollbar: {
      barBackgroundColor: '#464646',
      barBorderRadius: 0,
      barBorderWidth: 0,
      buttonBorderWidth: 0,
      buttonArrowColor: '#cccccc',
      rifleColor: '#cccccc',
      trackBackgroundColor: '#121211',
      trackBorderRadius: 0,
      trackBorderWidth: 1,
      trackBorderColor: '#464646',
    },
    exporting: {
      buttons: {
        contextButton: {
          theme: {
            fill: '#121211',
          },
        },
      },
    },
    plotOptions: {
      series: {
        marker: {
          enabled: false,
          states: {
            hover: {
              enabled: false,
            },
          },
        },
      },
      candlestick: {
        color: '#ea3d3d',
        upColor: '#51a958',
        upLineColor: '#51a958',
        lineColor: '#ea3d3d',
      },
    },
    series: [
      {
        type: 'candlestick',
        id: 'aapl',
        name: 'AAPL Stock Price',
        data: ohlc,
        tooltip: {
          valueDecimals: 2,
          pointFormat:
            '<b>O</b> <span style="color: {point.color}">{point.open} </span>' +
            '<b>H</b> <span style="color: {point.color}">{point.high}</span><br/>' +
            '<b>L</b> <span style="color: {point.color}">{point.low}</span>' +
            '<b>C</b> <span style="color: {point.color}">{point.close}</span><br/>',
        },
      },
      {
        type: 'column',
        name: 'Volume',
        data: volume,
        yAxis: 1,
        borderRadius: 0,
        groupPadding: 0,
        pointPadding: 0,
        tooltip: {
          pointFormat: '<b>Volume</b> <span style="color: {point.labelColor}">{point.y}</span><br/>',
        },
      },
      {
        type: 'ikh',
        linkedTo: 'aapl',
        tooltip: {
          pointFormat: `<br/>
              <span style="color: #666666;">IKH</span>
              <br/>
              Tenkan-sen: <span style="color:{series.options.tenkanLine.styles.lineColor}">
              {point.tenkanSen:.3f}</span><br/>
              Kijun-sen: <span style="color:{series.options.kijunLine.styles.lineColor}">
              {point.kijunSen:.3f}</span><br/>
              Chikou span: <span style="color:{series.options.chikouLine.styles.lineColor}">
              {point.chikouSpan:.3f}</span><br/>
              Senkou span A: <span style="color:{series.options.senkouSpanA.styles.lineColor}">
              {point.senkouSpanA:.3f}</span><br/>
              Senkou span B: <span style="color:{series.options.senkouSpanB.styles.lineColor}">
              {point.senkouSpanB:.3f}</span><br/>`,
        },
        tenkanLine: {
          styles: {
            lineColor: '#12dbd1',
          },
        },
        kijunLine: {
          styles: {
            lineColor: '#de70fa',
          },
        },
        chikouLine: {
          styles: {
            lineColor: '#728efd',
          },
        },
        senkouSpanA: {
          styles: {
            lineColor: '#2ad156',
          },
        },
        senkouSpanB: {
          styles: {
            lineColor: '#fca18d',
          },
        },
        senkouSpan: {
          color: 'rgba(255, 255, 255, 0.3)',
          negativeColor: 'rgba(237, 88, 71, 0.2)',
        },
      },
    ],
  };
};

export const buildChartOptions = ({ presetId, data }) => {
  if (presetId === 'technical-annotations') {
    return buildTechnicalWithAnnotations(data);
  }
  if (presetId === 'volume-proportional-width') {
    return buildVolumeProportionalWidth(data);
  }
  if (presetId === 'candlestick-volume-ikh') {
    return buildCandlestickVolumeIkh(data);
  }
  return buildCandlestickDemo(data);
};
