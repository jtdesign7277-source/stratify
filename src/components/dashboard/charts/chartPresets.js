export const CHART_PRESETS = [
  {
    id: 'order-book-live',
    name: 'Order book live chart',
    description: 'Animated bids/asks market depth with start/stop control.',
    dataUrl: null,
    engine: 'chart',
  },
  {
    id: 'stock-tools-popup-events',
    name: 'Stock tools popup events',
    description: 'Candlestick + volume with indicator/annotation popup controls.',
    dataUrl: 'https://demo-live-data.highcharts.com/aapl-ohlcv.json',
  },
  {
    id: 'aapl-basic-exact',
    name: 'AAPL Stock Price (Exact)',
    description: 'Exact basic candlestick setup from your snippet.',
    dataUrl: 'https://demo-live-data.highcharts.com/aapl-ohlc.json',
  },
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
  {
    id: 'styled-crosshair-candles',
    name: 'Styled crosshair candlestick',
    description: 'Styled-mode candles + volume with custom crosshair labels.',
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

function getRandomNumber(min, max) {
  return Math.round(Math.random() * (max - min)) + min;
}

function generateBidAndAskData(n) {
  const data = [[], []];
  let bidPrice = getRandomNumber(29000, 30000);
  let askPrice = bidPrice + 0.5;

  for (let i = 0; i < n; i += 1) {
    bidPrice -= i * getRandomNumber(8, 10);
    askPrice += i * getRandomNumber(8, 10);
    data[0].push({
      x: i,
      y: (i + 1) * getRandomNumber(70000, 110000),
      price: bidPrice,
    });

    data[1].push({
      x: i,
      y: (i + 1) * getRandomNumber(70000, 110000),
      price: askPrice,
    });
  }
  return data;
}

function updateData(chart) {
  const data = generateBidAndAskData(10);
  chart.series.forEach((series, i) => {
    series.setData(data[i], false);
  });
  chart.redraw();
}

const buildOrderBookLive = () => {
  const [bidsData, asksData] = generateBidAndAskData(10);

  return {
    chart: {
      animation: {
        duration: 200,
      },
      type: 'bar',
      backgroundColor: '#23232f',
      marginTop: 70,
      events: {
        load() {
          const chart = this;
          const toggleButton = document.getElementById('animation-toggle');
          if (!toggleButton) return;

          let intervalId = null;
          const toggleInterval = () => {
            if (intervalId) {
              chart.update(
                {
                  accessibility: {
                    enabled: true,
                  },
                },
                false,
              );
              clearInterval(intervalId);
              intervalId = null;
              chart.__orderBookIntervalId = null;
              toggleButton.innerText = 'Start animation';
            } else {
              chart.update(
                {
                  accessibility: {
                    enabled: false,
                  },
                },
                false,
              );
              intervalId = setInterval(() => {
                if (chart.series) updateData(chart);
              }, 200);
              chart.__orderBookIntervalId = intervalId;
              toggleButton.innerText = 'Stop animation';
            }
          };

          chart.__orderBookToggleHandler = toggleInterval;
          toggleButton.addEventListener('click', toggleInterval);
          toggleInterval();
        },
        destroy() {
          const toggleButton = document.getElementById('animation-toggle');
          if (toggleButton && this.__orderBookToggleHandler) {
            toggleButton.removeEventListener('click', this.__orderBookToggleHandler);
          }
          if (this.__orderBookIntervalId) {
            clearInterval(this.__orderBookIntervalId);
          }
        },
      },
    },

    accessibility: {
      point: {
        descriptionFormat: 'Price: {price:.1f}USD, {series.name}: {y}',
      },
    },

    title: {
      text: 'Order book live chart',
      style: {
        color: '#ffffff',
      },
    },

    tooltip: {
      headerFormat: 'Price: <b>${point.point.price:,.1f}</b></br>',
      pointFormat: '{series.name}: <b>{point.y:,.0f}</b>',
      shape: 'rect',
      positioner(labelWidth, _, point) {
        const { plotX, plotY, h } = point;
        const negative = plotX < this.chart.yAxis[0].left;

        return {
          x: negative ? plotX + h - labelWidth + 10 : plotX - h + 10,
          y: plotY,
        };
      },
    },

    xAxis: [
      {
        reversed: true,
        visible: false,
        title: {
          text: 'Market depth / price',
        },
        accessibility: {
          description: 'Bid orders',
        },
      },
      {
        opposite: true,
        visible: false,
        title: {
          text: 'Market depth / price',
        },
        accessibility: {
          description: 'Ask orders',
        },
      },
    ],

    yAxis: [
      {
        offset: 0,
        visible: true,
        opposite: true,
        gridLineWidth: 0,
        tickAmount: 1,
        left: '50%',
        width: '50%',
        title: {
          text: 'Amount of ask orders',
          style: {
            visibility: 'hidden',
          },
        },
        min: 0,
        max: 1200000,
        labels: {
          enabled: true,
          format: '{#if isLast}Asks{/if}',
          style: {
            color: '#ffffff',
            fontSize: '16px',
            fontWeight: 700,
          },
          y: 10,
        },
      },
      {
        offset: 0,
        visible: true,
        opposite: true,
        gridLineWidth: 0,
        tickAmount: 2,
        left: '0%',
        width: '50%',
        reversed: true,
        title: {
          text: 'Amount of bid orders',
          style: {
            visibility: 'hidden',
          },
        },
        min: 0,
        max: 1200000,
        labels: {
          enabled: true,
          format: '{#if (eq pos 0)}Price ($){/if}{#if isLast}Bids{/if}',
          style: {
            color: '#ffffff',
            fontSize: '16px',
            fontWeight: 700,
          },
          y: 10,
        },
      },
    ],

    legend: {
      enabled: false,
    },

    navigation: {
      buttonOptions: {
        theme: {
          fill: 'none',
        },
      },
    },

    plotOptions: {
      series: {
        animation: false,
        pointPadding: 0,
        groupPadding: 0,
        dataLabels: {
          enabled: true,
          color: '#ffffff',
        },
        borderWidth: 0,
        crisp: false,
      },
    },

    series: [
      {
        dataLabels: [
          {
            align: 'right',
            alignTo: 'plotEdges',
            style: {
              fontSize: '14px',
              textOutline: 0,
            },
            format: '{point.y:,.0f}',
          },
          {
            align: 'left',
            inside: true,
            style: {
              fontSize: '13px',
              textOutline: 0,
            },
            format: '{point.price:,.1f}',
          },
        ],
        name: 'Asks',
        color: '#ce4548',
        data: asksData,
      },
      {
        dataLabels: [
          {
            align: 'left',
            alignTo: 'plotEdges',
            style: {
              fontSize: '14px',
              textOutline: 0,
            },
            format: '{point.y:,.0f}',
          },
          {
            align: 'right',
            inside: true,
            style: {
              fontSize: '13px',
              textOutline: 0,
            },
            format: '{point.price:,.1f}',
          },
        ],
        name: 'Bids',
        color: '#107db7',
        data: bidsData,
        yAxis: 1,
      },
    ],
  };
};

const buildStockToolsPopupEvents = (data) => {
  const addPopupEvents = (chart) => {
    const closePopupButtons = document.getElementsByClassName('highcharts-close-popup');
    const indicatorsPopup = document.getElementsByClassName('highcharts-popup-indicators')[0];
    const annotationsPopup = document.getElementsByClassName('highcharts-popup-annotations')[0];

    if (!indicatorsPopup || !annotationsPopup) return;

    chart.stockToolbar = chart.stockToolbar || {};
    chart.stockToolbar.indicatorsPopupContainer = indicatorsPopup;
    chart.stockToolbar.annotationsPopupContainer = annotationsPopup;

    if (closePopupButtons[0] && closePopupButtons[0].dataset.bound !== '1') {
      Highcharts.addEvent(closePopupButtons[0], 'click', function closeIndicatorsPopup() {
        this.parentNode.style.display = 'none';
      });
      closePopupButtons[0].dataset.bound = '1';
    }

    if (closePopupButtons[1] && closePopupButtons[1].dataset.bound !== '1') {
      Highcharts.addEvent(closePopupButtons[1], 'click', function closeAnnotationsPopup() {
        this.parentNode.style.display = 'none';
      });
      closePopupButtons[1].dataset.bound = '1';
    }

    const addIndicatorButton = document.querySelectorAll('.highcharts-popup-indicators button')[0];
    if (addIndicatorButton && addIndicatorButton.dataset.bound !== '1') {
      Highcharts.addEvent(addIndicatorButton, 'click', function addIndicator() {
        const typeSelect = document.querySelectorAll('.highcharts-popup-indicators select')[0];
        const periodInput = document.querySelectorAll('.highcharts-popup-indicators input')[0];

        if (!typeSelect) return;

        const type = typeSelect.options[typeSelect.selectedIndex].value;
        const period = periodInput?.value || 14;

        chart.addSeries({
          linkedTo: 'aapl-ohlc',
          type,
          params: {
            period: parseInt(period, 10),
          },
        });

        chart.stockToolbar.indicatorsPopupContainer.style.display = 'none';
      });
      addIndicatorButton.dataset.bound = '1';
    }

    const updateAnnotationButton = document.querySelectorAll('.highcharts-popup-annotations button')[0];
    if (updateAnnotationButton && updateAnnotationButton.dataset.bound !== '1') {
      Highcharts.addEvent(updateAnnotationButton, 'click', function updateAnnotation() {
        const strokeWidthInput = document.querySelectorAll(
          '.highcharts-popup-annotations input[name="stroke-width"]',
        )[0];
        const strokeColorInput = document.querySelectorAll(
          '.highcharts-popup-annotations input[name="stroke"]',
        )[0];

        const strokeWidth = parseInt(strokeWidthInput?.value || '1', 10);
        const strokeColor = strokeColorInput?.value || '#3b82f6';

        if (!chart.currentAnnotation) return;

        if (chart.currentAnnotation.options.typeOptions) {
          chart.currentAnnotation.update({
            typeOptions: {
              lineColor: strokeColor,
              lineWidth: strokeWidth,
              line: {
                strokeWidth,
                stroke: strokeColor,
              },
              background: {
                strokeWidth,
                stroke: strokeColor,
              },
              innerBackground: {
                strokeWidth,
                stroke: strokeColor,
              },
              outerBackground: {
                strokeWidth,
                stroke: strokeColor,
              },
              connector: {
                strokeWidth,
                stroke: strokeColor,
              },
            },
          });
        } else {
          chart.currentAnnotation.update({
            shapes: [
              {
                'stroke-width': strokeWidth,
                stroke: strokeColor,
              },
            ],
            labels: [
              {
                borderWidth: strokeWidth,
                borderColor: strokeColor,
              },
            ],
          });
        }

        chart.stockToolbar.annotationsPopupContainer.style.display = 'none';
      });
      updateAnnotationButton.dataset.bound = '1';
    }
  };

  const ohlc = [];
  const volume = [];
  const dataLength = Array.isArray(data) ? data.length : 0;

  for (let i = 0; i < dataLength; i += 1) {
    ohlc.push([
      data[i][0], // date
      data[i][1], // open
      data[i][2], // high
      data[i][3], // low
      data[i][4], // close
    ]);

    volume.push([
      data[i][0], // date
      data[i][5], // volume
    ]);
  }

  return {
    chart: {
      events: {
        load() {
          addPopupEvents(this);
        },
      },
    },
    rangeSelector: {
      selected: 2,
    },
    yAxis: [
      {
        labels: {
          align: 'left',
        },
        height: '80%',
        resize: {
          enabled: true,
        },
      },
      {
        labels: {
          align: 'left',
        },
        top: '80%',
        height: '20%',
        offset: 0,
      },
    ],
    navigationBindings: {
      events: {
        selectButton(event) {
          let newClassName = `${event.button.className} highcharts-active`;
          const topButton = event.button.parentNode.parentNode;

          if (topButton.classList.contains('right')) {
            newClassName += ' right';
          }

          if (!topButton.classList.contains('highcharts-menu-wrapper')) {
            topButton.className = newClassName;
          }

          this.chart.activeButton = event.button;
        },
        deselectButton(event) {
          event.button.parentNode.parentNode.classList.remove('highcharts-active');
          this.chart.activeButton = null;
        },
        showPopup(event) {
          if (!this.indicatorsPopupContainer) {
            this.indicatorsPopupContainer = document.getElementsByClassName(
              'highcharts-popup-indicators',
            )[0];
          }

          if (!this.annotationsPopupContainer) {
            this.annotationsPopupContainer = document.getElementsByClassName(
              'highcharts-popup-annotations',
            )[0];
          }

          if (event.formType === 'indicators' && this.indicatorsPopupContainer) {
            this.indicatorsPopupContainer.style.display = 'block';
          } else if (event.formType === 'annotation-toolbar') {
            if (!this.chart.activeButton && this.annotationsPopupContainer) {
              this.chart.currentAnnotation = event.annotation;
              this.annotationsPopupContainer.style.display = 'block';
            }
          }
        },
        closePopup() {
          if (this.indicatorsPopupContainer) {
            this.indicatorsPopupContainer.style.display = 'none';
          }
          if (this.annotationsPopupContainer) {
            this.annotationsPopupContainer.style.display = 'none';
          }
        },
      },
    },
    stockTools: {
      gui: {
        enabled: false,
      },
    },
    series: [
      {
        type: 'candlestick',
        id: 'aapl-ohlc',
        name: 'AAPL Stock Price',
        data: ohlc,
      },
      {
        type: 'column',
        id: 'aapl-volume',
        name: 'AAPL Volume',
        data: volume,
        yAxis: 1,
      },
    ],
    responsive: {
      rules: [
        {
          condition: {
            maxWidth: 800,
          },
          chartOptions: {
            rangeSelector: {
              inputEnabled: false,
            },
          },
        },
      ],
    },
  };
};

const buildAaplBasicExact = (data) => ({
  rangeSelector: {
    selected: 1,
  },
  title: {
    text: 'AAPL Stock Price',
  },
  series: [
    {
      type: 'candlestick',
      name: 'AAPL Stock Price',
      data,
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

const buildStyledCrosshairCandles = (data) => {
  const colorTemplate = '{#ge point.open point.close}#ff6e6e{else}#51af7b{/ge}';
  const ohlc = [];
  const volume = [];

  for (let i = 0; i < data.length; i += 1) {
    const row = data[i];
    if (!Array.isArray(row) || row.length < 6) continue;

    ohlc.push([row[0], row[1], row[2], row[3], row[4]]);
    volume.push([
      row[0],
      row[5],
      row[1] < row[4] ? 'highcharts-point-up' : 'highcharts-point-down',
    ]);
  }

  return {
    lang: {
      accessibility: {
        defaultChartTitle: 'AAPL Stock Price',
      },
    },
    chart: {
      styledMode: true,
      backgroundColor: '#0a0a0a',
    },
    credits: {
      enabled: false,
    },
    title: {
      text: 'AAPL Stock Price',
    },
    xAxis: {
      crosshair: {
        className: 'highcharts-crosshair-custom',
        enabled: true,
      },
    },
    yAxis: [
      {
        title: { text: 'price (USD)' },
        crosshair: {
          snap: false,
          className: 'highcharts-crosshair-custom',
          enabled: true,
          label: {
            className: 'highcharts-crosshair-custom-label',
            enabled: true,
            format: '{value:.2f}',
          },
        },
        labels: { align: 'left' },
        height: '70%',
      },
      {
        title: { text: 'volume' },
        crosshair: {
          className: 'highcharts-crosshair-custom',
          snap: false,
          enabled: true,
          label: {
            format:
              '{#if value ge 1000000} {(divide value 1000000):.2f} M {else} {value} {/if}',
            className: 'highcharts-crosshair-custom-label',
            enabled: true,
          },
        },
        labels: { align: 'left' },
        top: '70%',
        height: '30%',
        offset: 0,
      },
    ],
    tooltip: {
      shape: 'square',
      split: false,
      shared: true,
      headerShape: 'callout',
      fixed: true,
      format: `<span style="font-size: 1.4em">{point.series.name}</span><br/>
O<span style="color:${colorTemplate}";>{point.open}</span>
H<span style="color:${colorTemplate}";>{point.high}</span>
L<span style="color:${colorTemplate}";>{point.low}</span>
C<span style="color:${colorTemplate}";>{point.close}
{(subtract point.open point.close):.2f}
{(multiply (divide (subtract point.open point.close) point.close) 100):.2f}%
</span><br/>
Volume<span style="color:${colorTemplate}";>{points.1.y}</span>`,
    },
    series: [
      {
        type: 'candlestick',
        id: 'aapl-ohlc',
        name: 'AAPL Stock Price',
        lastPrice: {
          enabled: true,
          label: {
            enabled: true,
            align: 'left',
            x: 8,
          },
        },
        data: ohlc,
      },
      {
        type: 'column',
        id: 'aapl-volume',
        name: 'AAPL Volume',
        keys: ['x', 'y', 'className'],
        data: volume,
        yAxis: 1,
        lastPrice: {
          enabled: true,
          label: {
            format:
              '{#if value ge 1000000} {(divide value 1000000):.2f} M {else} {value} {/if}',
            enabled: true,
            align: 'left',
            x: 8,
          },
        },
      },
    ],
    rangeSelector: {
      verticalAlign: 'bottom',
    },
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

export const buildChartOptions = ({ presetId, data }) => {
  if (presetId === 'order-book-live') {
    return buildOrderBookLive();
  }
  if (presetId === 'stock-tools-popup-events') {
    return buildStockToolsPopupEvents(data);
  }
  if (presetId === 'aapl-basic-exact') {
    return buildAaplBasicExact(data);
  }
  if (presetId === 'technical-annotations') {
    return buildTechnicalWithAnnotations(data);
  }
  if (presetId === 'volume-proportional-width') {
    return buildVolumeProportionalWidth(data);
  }
  if (presetId === 'candlestick-volume-ikh') {
    return buildCandlestickVolumeIkh(data);
  }
  if (presetId === 'styled-crosshair-candles') {
    return buildStyledCrosshairCandles(data);
  }
  return buildCandlestickDemo(data);
};
