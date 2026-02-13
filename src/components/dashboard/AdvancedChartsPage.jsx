import { useEffect, useRef, useState } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import * as am5stock from '@amcharts/amcharts5/stock';
import am5themes_Dark from '@amcharts/amcharts5/themes/Dark';

const GRID_COLOR = am5.color(0x1f1f1f);
const PANEL_COLOR = am5.color(0x0b0b0b);
const BG_COLOR = am5.color(0x060a10);
const LABEL_COLOR = am5.color(0x8b8b9e);
const UP_COLOR = am5.color(0x34d399);
const DOWN_COLOR = am5.color(0xf87171);
const VOLUME_COLOR = am5.color(0x3b82f6);

const hashString = (value) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
};

const TIMEFRAME_OPTIONS = [
  { label: '1m', value: '1Min', unit: 'minute', count: 1, intraday: true },
  { label: '5m', value: '5Min', unit: 'minute', count: 5, intraday: true },
  { label: '15m', value: '15Min', unit: 'minute', count: 15, intraday: true },
  { label: '1H', value: '1Hour', unit: 'hour', count: 1, intraday: true },
  { label: '4H', value: '4Hour', unit: 'hour', count: 4, intraday: true },
  { label: '1D', value: '1Day', unit: 'day', count: 1, intraday: false },
  { label: '1W', value: '1Week', unit: 'week', count: 1, intraday: false },
];

const getTradingDaysAgo = (days) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  let remaining = days;
  while (remaining > 0) {
    date.setDate(date.getDate() - 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }
  return date;
};

const fetchBars = async ({ symbol, timeframe, limit, start, signal }) => {
  const params = new URLSearchParams({
    symbol,
    timeframe,
    limit: String(limit),
  });

  if (start) {
    params.append('start', start);
  }

  const response = await fetch(`/api/bars?${params.toString()}`, { signal });
  let payload = null;

  try {
    payload = await response.json();
  } catch (err) {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload?.error ||
      payload?.detail ||
      `Failed to fetch bars (${response.status})`;
    throw new Error(message);
  }

  if (payload?.error) {
    throw new Error(payload.error);
  }

  const bars = payload?.bars || [];
  return bars.map((bar) => ({
    Date: new Date(bar.Timestamp).getTime(),
    Open: bar.OpenPrice,
    High: bar.HighPrice,
    Low: bar.LowPrice,
    Close: bar.ClosePrice,
    Volume: bar.Volume,
  }));
};

class ADXIndicator extends am5stock.ChartIndicator {
  constructor() {
    super(...arguments);
    this._editableSettings = [
      {
        key: 'period',
        name: this.root.language.translateAny('Period'),
        type: 'number',
      },
      {
        key: 'seriesColor',
        name: this.root.language.translateAny('Color'),
        type: 'color',
      },
    ];
  }

  _afterNew() {
    this._themeTags.push('adx');
    super._afterNew();

    if (this.yAxis) {
      this.yAxis.setAll({
        min: 0,
        max: 100,
        strictMinMax: true,
      });
    }

    if (this.panel) {
      this.panel.set(
        'background',
        am5.Rectangle.new(this._root, {
          fill: PANEL_COLOR,
          fillOpacity: 1,
        })
      );
    }

    if (this.xAxis) {
      const xRenderer = this.xAxis.get('renderer');
      xRenderer.grid.template.setAll({ stroke: GRID_COLOR, strokeOpacity: 0.3 });
      xRenderer.labels.template.setAll({ fill: LABEL_COLOR });
    }

    if (this.yAxis) {
      const yRenderer = this.yAxis.get('renderer');
      yRenderer.grid.template.setAll({ stroke: GRID_COLOR, strokeOpacity: 0.3 });
      yRenderer.labels.template.setAll({ fill: LABEL_COLOR });
    }
  }

  _createSeries() {
    return this.panel.series.push(
      am5xy.LineSeries.new(this._root, {
        name: 'ADX',
        themeTags: ['indicator'],
        xAxis: this.xAxis,
        yAxis: this.yAxis,
        valueXField: 'valueX',
        valueYField: 'adx',
        fill: undefined,
      })
    );
  }

  prepareData() {
    if (!this.series) {
      return;
    }

    const dataItems = this.get('stockSeries').dataItems;
    const period = this.get('period', 14);
    const data = dataItems.map((item) => ({
      valueX: item.get('valueX'),
      adx: null,
    }));

    if (dataItems.length <= period * 2) {
      this.series.updateData(data);
      return;
    }

    const tr = [];
    const plusDM = [];
    const minusDM = [];

    for (let i = 1; i < dataItems.length; i += 1) {
      const current = dataItems[i];
      const previous = dataItems[i - 1];
      const high = current.get('highValueY');
      const low = current.get('lowValueY');
      const prevHigh = previous.get('highValueY');
      const prevLow = previous.get('lowValueY');
      const prevClose = previous.get('valueY');

      const trueRange = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );

      const upMove = high - prevHigh;
      const downMove = prevLow - low;

      tr[i] = trueRange;
      plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
      minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;
    }

    let trPeriod = 0;
    let plusPeriod = 0;
    let minusPeriod = 0;

    for (let i = 1; i <= period; i += 1) {
      trPeriod += tr[i] || 0;
      plusPeriod += plusDM[i] || 0;
      minusPeriod += minusDM[i] || 0;
    }

    let adx = null;
    const dxValues = [];

    for (let i = period; i < dataItems.length; i += 1) {
      if (i > period) {
        trPeriod = trPeriod - trPeriod / period + (tr[i] || 0);
        plusPeriod = plusPeriod - plusPeriod / period + (plusDM[i] || 0);
        minusPeriod = minusPeriod - minusPeriod / period + (minusDM[i] || 0);
      }

      const plusDI = trPeriod === 0 ? 0 : (100 * plusPeriod) / trPeriod;
      const minusDI = trPeriod === 0 ? 0 : (100 * minusPeriod) / trPeriod;
      const diSum = plusDI + minusDI;
      const dx = diSum === 0 ? 0 : (100 * Math.abs(plusDI - minusDI)) / diSum;

      if (dxValues.length < period) {
        dxValues.push(dx);
        if (dxValues.length === period) {
          const sum = dxValues.reduce((acc, value) => acc + value, 0);
          adx = sum / period;
          data[i].adx = adx;
        }
      } else {
        adx = ((adx || dx) * (period - 1) + dx) / period;
        data[i].adx = adx;
      }
    }

    this.series.updateData(data);
  }
}

const applyAxisStyling = (renderer) => {
  renderer.grid.template.setAll({
    stroke: GRID_COLOR,
    strokeOpacity: 0.3,
  });
  renderer.labels.template.setAll({
    fill: LABEL_COLOR,
    fontSize: 11,
  });
  renderer.ticks.template.setAll({
    stroke: GRID_COLOR,
    strokeOpacity: 0.4,
  });
  if (renderer.line) {
    renderer.line.setAll({ stroke: GRID_COLOR, strokeOpacity: 0.6 });
  }
};

const applyCandleColors = (series) => {
  series.columns.template.adapters.add('fill', (fill, target) => {
    const dataItem = target.dataItem;
    if (!dataItem) {
      return fill;
    }
    const open = dataItem.get('openValueY');
    const close = dataItem.get('valueY');
    return close >= open ? UP_COLOR : DOWN_COLOR;
  });

  series.columns.template.adapters.add('stroke', (stroke, target) => {
    const dataItem = target.dataItem;
    if (!dataItem) {
      return stroke;
    }
    const open = dataItem.get('openValueY');
    const close = dataItem.get('valueY');
    return close >= open ? UP_COLOR : DOWN_COLOR;
  });
};

const createComparisonData = (baseData, seed) => {
  const ratio = 0.85 + (seed % 30) / 100;
  return baseData.map((item) => ({
    Date: item.Date,
    Close: Number((item.Close * ratio).toFixed(2)),
  }));
};

export default function AdvancedChartsPage({ activeTicker = 'NVDA' }) {
  const chartRef = useRef(null);
  const toolbarRef = useRef(null);
  const stockChartRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const dateAxisRef = useRef(null);
  const volumeDateAxisRef = useRef(null);
  const dataRef = useRef([]);
  const initialTickerRef = useRef(activeTicker);
  const [timeframe, setTimeframe] = useState('1Day');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!chartRef.current || !toolbarRef.current) {
      return undefined;
    }

    toolbarRef.current.innerHTML = '';

    const root = am5.Root.new(chartRef.current);
    root.setThemes([am5themes_Dark.new(root)]);

    root.container.set(
      'background',
      am5.Rectangle.new(root, {
        fill: BG_COLOR,
        fillOpacity: 1,
      })
    );

    root.interfaceColors.set('positive', UP_COLOR);
    root.interfaceColors.set('negative', DOWN_COLOR);

    const stockChart = root.container.children.push(
      am5stock.StockChart.new(root, {
        paddingLeft: 0,
        paddingRight: 0,
      })
    );

    const mainPanel = stockChart.panels.push(
      am5stock.StockPanel.new(root, {
        wheelY: 'zoomX',
        panX: true,
        panY: true,
        height: am5.percent(70),
        background: am5.Rectangle.new(root, {
          fill: PANEL_COLOR,
          fillOpacity: 1,
        }),
      })
    );

    const valueAxis = mainPanel.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {
          pan: 'zoom',
        }),
        extraMin: 0.05,
        extraMax: 0.05,
        tooltip: am5.Tooltip.new(root, {}),
      })
    );

    const dateAxis = mainPanel.xAxes.push(
      am5xy.GaplessDateAxis.new(root, {
        baseInterval: {
          timeUnit: 'day',
          count: 1,
        },
        renderer: am5xy.AxisRendererX.new(root, {
          minorGridEnabled: true,
        }),
        tooltip: am5.Tooltip.new(root, {}),
      })
    );

    applyAxisStyling(valueAxis.get('renderer'));
    applyAxisStyling(dateAxis.get('renderer'));

    const valueSeries = mainPanel.series.push(
      am5xy.CandlestickSeries.new(root, {
        name: initialTickerRef.current.toUpperCase(),
        clustered: false,
        valueXField: 'Date',
        valueYField: 'Close',
        highValueYField: 'High',
        lowValueYField: 'Low',
        openValueYField: 'Open',
        calculateAggregates: true,
        xAxis: dateAxis,
        yAxis: valueAxis,
        legendValueText:
          'open: [bold]{openValueY.formatNumber("#.00")}[/] high: [bold]{highValueY.formatNumber("#.00")}[/] low: [bold]{lowValueY.formatNumber("#.00")}[/] close: [bold]{valueY.formatNumber("#.00")}[/]',
      })
    );

    applyCandleColors(valueSeries);

    const valueLegend = mainPanel.plotContainer.children.push(
      am5stock.StockLegend.new(root, {
        stockChart,
      })
    );

    stockChart.set('stockSeries', valueSeries);

    const volumePanel = stockChart.panels.push(
      am5stock.StockPanel.new(root, {
        panX: true,
        panY: true,
        height: am5.percent(30),
        paddingTop: 6,
        background: am5.Rectangle.new(root, {
          fill: PANEL_COLOR,
          fillOpacity: 1,
        }),
      })
    );

    volumePanel.panelControls.closeButton.set('forceHidden', true);

    const volumeDateAxis = volumePanel.xAxes.push(
      am5xy.GaplessDateAxis.new(root, {
        baseInterval: {
          timeUnit: 'day',
          count: 1,
        },
        renderer: am5xy.AxisRendererX.new(root, {
          minorGridEnabled: true,
        }),
        tooltip: am5.Tooltip.new(root, {
          forceHidden: true,
        }),
        height: 0,
      })
    );

    volumeDateAxis.get('renderer').labels.template.set('forceHidden', true);
    applyAxisStyling(volumeDateAxis.get('renderer'));

    const volumeValueAxis = volumePanel.yAxes.push(
      am5xy.ValueAxis.new(root, {
        numberFormat: '#.#a',
        renderer: am5xy.AxisRendererY.new(root, {}),
      })
    );

    applyAxisStyling(volumeValueAxis.get('renderer'));

    const volumeSeries = volumePanel.series.push(
      am5xy.ColumnSeries.new(root, {
        name: 'Volume',
        clustered: false,
        valueXField: 'Date',
        valueYField: 'Volume',
        xAxis: volumeDateAxis,
        yAxis: volumeValueAxis,
        legendValueText: '[bold]{valueY.formatNumber("#.0a")}[/]',
      })
    );

    volumeSeries.columns.template.setAll({
      strokeOpacity: 0,
      fill: VOLUME_COLOR,
      fillOpacity: 0.3,
    });

    const volumeLegend = volumePanel.plotContainer.children.push(
      am5stock.StockLegend.new(root, {
        stockChart,
      })
    );

    stockChart.set('volumeSeries', volumeSeries);
    valueLegend.data.setAll([valueSeries]);
    volumeLegend.data.setAll([volumeSeries]);

    mainPanel.set(
      'cursor',
      am5xy.XYCursor.new(root, {
        yAxis: valueAxis,
        xAxis: dateAxis,
        snapToSeries: [valueSeries],
      })
    );

    volumePanel.set(
      'cursor',
      am5xy.XYCursor.new(root, {
        yAxis: volumeValueAxis,
        xAxis: volumeDateAxis,
      })
    );

    dataRef.current = [];
    valueSeries.data.setAll([]);
    volumeSeries.data.setAll([]);

    stockChartRef.current = stockChart;
    volumeSeriesRef.current = volumeSeries;
    dateAxisRef.current = dateAxis;
    volumeDateAxisRef.current = volumeDateAxis;

    const comparisonTickers = [
      { label: 'Apple', subLabel: 'AAPL', id: 'AAPL' },
      { label: 'Advanced Micro Devices', subLabel: 'AMD', id: 'AMD' },
      { label: 'Microsoft', subLabel: 'MSFT', id: 'MSFT' },
      { label: 'Alphabet', subLabel: 'GOOGL', id: 'GOOGL' },
      { label: 'Amazon', subLabel: 'AMZN', id: 'AMZN' },
      { label: 'Tesla', subLabel: 'TSLA', id: 'TSLA' },
      { label: 'NVIDIA', subLabel: 'NVDA', id: 'NVDA' },
    ];

    const comparisonControl = am5stock.ComparisonControl.new(root, {
      stockChart,
      searchable: true,
      searchCallback: (query) => {
        const lowered = query.toLowerCase();
        return comparisonTickers.filter((item) =>
          item.label.toLowerCase().includes(lowered) ||
          item.subLabel.toLowerCase().includes(lowered)
        );
      },
    });

    comparisonControl.events.on('selected', (ev) => {
      const symbol = ev.item.subLabel || ev.item.id;
      const series = am5xy.LineSeries.new(root, {
        name: symbol,
        valueYField: 'Close',
        valueXField: 'Date',
        calculateAggregates: true,
        xAxis: dateAxis,
        yAxis: valueAxis,
        legendValueText: '{valueY.formatNumber("#.00")}',
      });

      const comparingSeries = stockChart.addComparingSeries(series);
      comparingSeries.data.setAll(
        createComparisonData(dataRef.current, hashString(symbol))
      );
    });

    const indicatorControl = am5stock.IndicatorControl.new(root, {
      stockChart,
      legend: valueLegend,
      indicators: [
        {
          id: 'SMA',
          name: 'SMA',
          callback: () =>
            am5stock.MovingAverage.new(root, {
              stockChart,
              stockSeries: stockChart.get('stockSeries'),
              legend: valueLegend,
              type: 'simple',
              name: 'SMA',
              shortName: 'SMA',
            }),
        },
        {
          id: 'EMA',
          name: 'EMA',
          callback: () =>
            am5stock.MovingAverage.new(root, {
              stockChart,
              stockSeries: stockChart.get('stockSeries'),
              legend: valueLegend,
              type: 'exponential',
              name: 'EMA',
              shortName: 'EMA',
            }),
        },
        { id: 'Bollinger Bands', name: 'Bollinger' },
        { id: 'Relative Strength Index', name: 'RSI' },
        { id: 'MACD', name: 'MACD' },
        { id: 'Stochastic Oscillator', name: 'Stochastic' },
        { id: 'Average True Range', name: 'ATR' },
        { id: 'VWAP', name: 'VWAP' },
        { id: 'On Balance Volume', name: 'OBV' },
        {
          id: 'ADX',
          name: 'ADX',
          callback: () =>
            ADXIndicator.new(root, {
              stockChart,
              stockSeries: stockChart.get('stockSeries'),
              legend: valueLegend,
              name: 'ADX',
              shortName: 'ADX',
            }),
        },
      ],
    });

    const periodSelector = am5stock.PeriodSelector.new(root, {
      stockChart,
      periods: [
        { timeUnit: 'day', count: 1, name: '1D' },
        { timeUnit: 'day', count: 5, name: '5D' },
        { timeUnit: 'month', count: 1, name: '1M' },
        { timeUnit: 'month', count: 3, name: '3M' },
        { timeUnit: 'month', count: 6, name: '6M' },
        { timeUnit: 'year', count: 1, name: '1Y' },
        { timeUnit: 'ytd', name: 'YTD' },
        { timeUnit: 'max', name: 'ALL' },
      ],
    });

    const chartTypeControl = am5stock.SeriesTypeControl.new(root, {
      stockChart,
      currentItem: 'candlestick',
      items: [
        { id: 'candlestick', label: 'Candlestick' },
        { id: 'ohlc', label: 'OHLC' },
        { id: 'line', label: 'Line' },
        { id: 'area', label: 'Area' },
      ],
    });

    const getSeriesSettings = (series) => {
      const settings = {};
      [
        'name',
        'valueYField',
        'highValueYField',
        'lowValueYField',
        'openValueYField',
        'calculateAggregates',
        'valueXField',
        'xAxis',
        'yAxis',
        'legendValueText',
        'legendRangeValueText',
        'stroke',
        'fill',
      ].forEach((setting) => {
        settings[setting] = series.get(setting);
      });
      return settings;
    };

    const setSeriesType = (seriesType) => {
      const currentSeries = stockChart.get('stockSeries');
      const newSettings = getSeriesSettings(currentSeries);
      const data = currentSeries.data.values;

      mainPanel.series.removeValue(currentSeries);

      let nextSeries;
      switch (seriesType) {
        case 'line':
          nextSeries = mainPanel.series.push(
            am5xy.LineSeries.new(root, {
              ...newSettings,
              fillOpacity: 0,
              stroke: UP_COLOR,
            })
          );
          break;
        case 'area':
          nextSeries = mainPanel.series.push(
            am5xy.LineSeries.new(root, {
              ...newSettings,
              fillOpacity: 0.25,
              stroke: UP_COLOR,
              fill: UP_COLOR,
            })
          );
          break;
        case 'ohlc':
          newSettings.clustered = false;
          nextSeries = mainPanel.series.push(
            am5xy.OHLCSeries.new(root, newSettings)
          );
          applyCandleColors(nextSeries);
          break;
        case 'candlestick':
        default:
          newSettings.clustered = false;
          nextSeries = mainPanel.series.push(
            am5xy.CandlestickSeries.new(root, newSettings)
          );
          applyCandleColors(nextSeries);
          break;
      }

      if (nextSeries) {
        valueLegend.data.removeValue(currentSeries);
        nextSeries.data.setAll(data);
        stockChart.set('stockSeries', nextSeries);
        const cursor = mainPanel.get('cursor');
        if (cursor) {
          cursor.set('snapToSeries', [nextSeries]);
        }
        valueLegend.data.insertIndex(0, nextSeries);
      }
    };

    chartTypeControl.events.on('selected', (ev) => {
      setSeriesType(ev.item.id);
    });

    const toolbar = am5stock.StockToolbar.new(root, {
      container: toolbarRef.current,
      stockChart,
      controls: [
        periodSelector,
        comparisonControl,
        indicatorControl,
        chartTypeControl,
        am5stock.DrawingControl.new(root, {
          stockChart,
        }),
        am5stock.ResetControl.new(root, {
          stockChart,
        }),
      ],
    });

    return () => {
      toolbar.dispose();
      root.dispose();
      if (toolbarRef.current) {
        toolbarRef.current.innerHTML = '';
      }
      stockChartRef.current = null;
      volumeSeriesRef.current = null;
      dateAxisRef.current = null;
      volumeDateAxisRef.current = null;
      dataRef.current = [];
    };
  }, []);

  useEffect(() => {
    const stockChart = stockChartRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const dateAxis = dateAxisRef.current;
    const volumeDateAxis = volumeDateAxisRef.current;

    if (!stockChart || !volumeSeries || !dateAxis || !volumeDateAxis) {
      return undefined;
    }

    const selected =
      TIMEFRAME_OPTIONS.find((option) => option.value === timeframe) ||
      TIMEFRAME_OPTIONS[5];
    const limit = selected.intraday ? 1000 : 500;
    const start = selected.intraday
      ? getTradingDaysAgo(5).toISOString()
      : undefined;

    const controller = new AbortController();

    const stockSeries = stockChart.get('stockSeries');
    if (stockSeries) {
      stockSeries.set('name', activeTicker.toUpperCase());
    }

    const loadBars = async () => {
      setIsLoading(true);
      setErrorMessage('');
      try {
        const data = await fetchBars({
          symbol: activeTicker,
          timeframe: selected.value,
          limit,
          start,
          signal: controller.signal,
        });

        if (controller.signal.aborted) {
          return;
        }

        dataRef.current = data;
        const currentSeries = stockChart.get('stockSeries');
        if (currentSeries) {
          currentSeries.data.setAll(data);
          currentSeries.set('name', activeTicker.toUpperCase());
        }
        volumeSeries.data.setAll(data);
        dateAxis.set('baseInterval', {
          timeUnit: selected.unit,
          count: selected.count,
        });
        volumeDateAxis.set('baseInterval', {
          timeUnit: selected.unit,
          count: selected.count,
        });
      } catch (err) {
        if (controller.signal.aborted || err?.name === 'AbortError') {
          return;
        }
        setErrorMessage(err?.message || 'Failed to load bars.');
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    loadBars();

    return () => {
      controller.abort();
    };
  }, [activeTicker, timeframe]);

  return (
    <div className="bg-[#060a10] h-full w-full overflow-hidden flex flex-col">
      <style>{`
        .advanced-chart-toolbar {
          background: #060a10;
        }
        .advanced-chart-toolbar .am5stock-control-button {
          background: #0b0b0b;
          border: 1px solid #1f1f1f;
          color: rgba(255, 255, 255, 0.7);
          border-radius: 8px;
          padding: 6px 10px;
          min-height: 32px;
        }
        .advanced-chart-toolbar .am5stock-control-button:hover {
          background: #111111;
          color: rgba(255, 255, 255, 0.85);
        }
        .advanced-chart-toolbar .am5stock-control-button-active {
          background: #111111;
          border-color: #2b2b2b;
          color: rgba(255, 255, 255, 0.9);
        }
        .advanced-chart-toolbar .am5stock-control-label {
          color: rgba(255, 255, 255, 0.7);
          font-size: 12px;
        }
        .advanced-chart-toolbar .am5stock-control-icon svg {
          width: 14px;
          height: 14px;
        }
        .advanced-chart-toolbar .am5stock-control-icon svg path {
          stroke: rgba(255, 255, 255, 0.7);
        }
        .advanced-chart-toolbar .am5stock-link {
          color: rgba(255, 255, 255, 0.7);
          font-size: 11px;
          margin-right: 10px;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }
        .advanced-chart-toolbar .am5stock-link.am5stock-active {
          color: #34d399;
          border-bottom: 1px solid #34d399;
        }
        .advanced-chart-toolbar .am5stock-control-list {
          background: #0b0b0b;
          border: 1px solid #1f1f1f;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
        }
        .advanced-chart-toolbar .am5stock-list-item {
          color: rgba(255, 255, 255, 0.7);
        }
        .advanced-chart-toolbar .am5stock-list-item:hover {
          background: rgba(255, 255, 255, 0.04);
        }
        .advanced-chart-toolbar .am5stock-list-search input {
          background: #0b0b0b;
          border: 1px solid #1f1f1f;
          color: rgba(255, 255, 255, 0.7);
          border-radius: 6px;
          padding: 6px 8px;
        }
      `}</style>
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f1f1f]">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/50">
            Advanced Chart
          </div>
          <div className="text-base font-semibold text-white">
            {activeTicker.toUpperCase()}
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] text-white/30">
          <div className="h-4 w-4 rounded-sm border border-white/20" />
          amCharts
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-[#1f1f1f]">
        {TIMEFRAME_OPTIONS.map((option) => {
          const isActive = timeframe === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setTimeframe(option.value)}
              aria-pressed={isActive}
              className={`text-xs uppercase tracking-[0.2em] px-3 py-1 rounded-md border transition ${
                isActive
                  ? 'bg-white/10 text-white border-white/20'
                  : 'bg-[#0b0b0b] border-[#1f1f1f] text-white/50'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <div
        ref={toolbarRef}
        className="advanced-chart-toolbar px-3 py-2 border-b border-[#1f1f1f]"
      />
      <div className="relative flex-1 min-h-0">
        <div ref={chartRef} className="absolute inset-0" />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#060a10]/70">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        )}
        {errorMessage && (
          <div className="absolute inset-x-0 top-3 flex justify-center">
            <div className="rounded-md border border-red-500/30 bg-[#0b0b0b]/90 px-4 py-2 text-xs text-red-300">
              {errorMessage}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
