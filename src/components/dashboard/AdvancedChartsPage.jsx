import { useLayoutEffect, useRef, useState } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import * as am5stock from '@amcharts/amcharts5/stock';
import am5themes_Dark from '@amcharts/amcharts5/themes/Dark';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';

const TIMEFRAMES = [
  { label: '1m', alpaca: '1Min', unit: 'minute', count: 1 },
  { label: '5m', alpaca: '5Min', unit: 'minute', count: 5 },
  { label: '15m', alpaca: '15Min', unit: 'minute', count: 15 },
  { label: '1H', alpaca: '1Hour', unit: 'hour', count: 1 },
  { label: '4H', alpaca: '4Hour', unit: 'hour', count: 4 },
  { label: '1D', alpaca: '1Day', unit: 'day', count: 1 },
  { label: '1W', alpaca: '1Week', unit: 'week', count: 1 },
];

const getTimeframe = (value) =>
  TIMEFRAMES.find((timeframe) => timeframe.alpaca === value) || TIMEFRAMES[0];

const getTradingDaysAgoIso = (tradingDays) => {
  const date = new Date();
  let remaining = tradingDays;
  while (remaining > 0) {
    date.setDate(date.getDate() - 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }
  return date.toISOString();
};

export default function AdvancedChartsPage({ activeTicker = 'NVDA' }) {
  const [timeframe, setTimeframe] = useState('1Min');
  const toolbarRef = useRef(null);
  const rootRef = useRef(null);

  useLayoutEffect(() => {
    const selectedTimeframe = getTimeframe(timeframe);
    const isIntraday =
      selectedTimeframe.unit === 'minute' || selectedTimeframe.unit === 'hour';
    let disposed = false;

    const root = am5.Root.new('advancedChartDiv');
    rootRef.current = root;

    var myTheme = am5.Theme.new(root);

    root.setThemes([
      am5themes_Animated.new(root),
      am5themes_Dark.new(root),
      myTheme,
    ]);

    var stockChart = root.container.children.push(
      am5stock.StockChart.new(root, {
        paddingRight: 0,
        stockPositiveColor: am5.color(0x34d399),
        stockNegativeColor: am5.color(0xf87171),
      })
    );
    root.numberFormatter.set('numberFormat', '#,###.00');

    var mainPanel = stockChart.panels.push(
      am5stock.StockPanel.new(root, { wheelY: 'zoomX', panX: true, panY: true })
    );

    var valueAxis = mainPanel.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, { pan: 'zoom' }),
        extraMin: 0.1,
        tooltip: am5.Tooltip.new(root, {}),
        numberFormat: '#,###.00',
        extraTooltipPrecision: 2,
      })
    );

    var dateAxis = mainPanel.xAxes.push(
      am5xy.GaplessDateAxis.new(root, {
        baseInterval: {
          timeUnit: selectedTimeframe.unit,
          count: selectedTimeframe.count,
        },
        renderer: am5xy.AxisRendererX.new(root, {
          pan: 'zoom',
          minorGridEnabled: true,
        }),
        tooltip: am5.Tooltip.new(root, {}),
      })
    );

    var valueSeries = mainPanel.series.push(
      am5xy.CandlestickSeries.new(root, {
        turboMode: true,
        name: activeTicker,
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
          'open: [bold]{openValueY}[/] high: [bold]{highValueY}[/] low: [bold]{lowValueY}[/] close: [bold]{valueY}[/]',
        legendRangeValueText: '',
      })
    );

    stockChart.set('stockSeries', valueSeries);

    var valueLegend = mainPanel.plotContainer.children.push(
      am5stock.StockLegend.new(root, { stockChart: stockChart })
    );

    // Volume axis (inside main panel, bottom 20%)
    var volumeAxisRenderer = am5xy.AxisRendererY.new(root, {});
    volumeAxisRenderer.labels.template.set('forceHidden', true);
    volumeAxisRenderer.grid.template.set('forceHidden', true);
    var volumeValueAxis = mainPanel.yAxes.push(
      am5xy.ValueAxis.new(root, {
        numberFormat: '#.#a',
        height: am5.percent(20),
        y: am5.percent(100),
        centerY: am5.percent(100),
        renderer: volumeAxisRenderer,
      })
    );
    var volumeSeries = mainPanel.series.push(
      am5xy.ColumnSeries.new(root, {
        turboMode: true,
        name: 'Volume',
        clustered: false,
        valueXField: 'Date',
        valueYField: 'Volume',
        xAxis: dateAxis,
        yAxis: volumeValueAxis,
        legendValueText: '[bold]{valueY.formatNumber("#,###.0a")}[/]',
      })
    );
    volumeSeries.columns.template.setAll({ strokeOpacity: 0, fillOpacity: 0.5 });
    volumeSeries.columns.template.adapters.add('fill', function (fill, target) {
      var dataItem = target.dataItem;
      if (dataItem) {
        return stockChart.getVolumeColor(dataItem);
      }
      return fill;
    });
    stockChart.set('volumeSeries', volumeSeries);
    valueLegend.data.setAll([valueSeries, volumeSeries]);

    // Cursor
    mainPanel.set(
      'cursor',
      am5xy.XYCursor.new(root, {
        yAxis: valueAxis,
        xAxis: dateAxis,
        snapToSeries: [valueSeries],
        snapToSeriesBy: 'y!',
      })
    );

    // Scrollbar
    var scrollbar = mainPanel.set(
      'scrollbarX',
      am5xy.XYChartScrollbar.new(root, { orientation: 'horizontal', height: 50 })
    );
    stockChart.toolsContainer.children.push(scrollbar);
    var sbDateAxis = scrollbar.chart.xAxes.push(
      am5xy.GaplessDateAxis.new(root, {
        baseInterval: {
          timeUnit: selectedTimeframe.unit,
          count: selectedTimeframe.count,
        },
        renderer: am5xy.AxisRendererX.new(root, { minorGridEnabled: true }),
      })
    );
    var sbValueAxis = scrollbar.chart.yAxes.push(
      am5xy.ValueAxis.new(root, { renderer: am5xy.AxisRendererY.new(root, {}) })
    );
    var sbSeries = scrollbar.chart.series.push(
      am5xy.LineSeries.new(root, {
        valueYField: 'Close',
        valueXField: 'Date',
        xAxis: sbDateAxis,
        yAxis: sbValueAxis,
      })
    );
    sbSeries.fills.template.setAll({ visible: true, fillOpacity: 0.3 });

    // Set up series type switcher
    var seriesSwitcher = am5stock.SeriesTypeControl.new(root, {
      stockChart: stockChart,
    });

    seriesSwitcher.events.on('selected', function (ev) {
      setSeriesType(ev.item.id);
    });

    function getNewSettings(series) {
      var newSettings = [];
      am5.array.each(
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
        ],
        function (setting) {
          newSettings[setting] = series.get(setting);
        }
      );
      return newSettings;
    }

    function setSeriesType(seriesType) {
      // Get current series and its settings
      var currentSeries = stockChart.get('stockSeries');
      var newSettings = getNewSettings(currentSeries);

      // Remove previous series
      var data = currentSeries.data.values;
      mainPanel.series.removeValue(currentSeries);

      // Create new series
      var series;
      switch (seriesType) {
        case 'line':
          series = mainPanel.series.push(am5xy.LineSeries.new(root, newSettings));
          break;
        case 'candlestick':
        case 'procandlestick':
          newSettings.clustered = false;
          series = mainPanel.series.push(
            am5xy.CandlestickSeries.new(root, newSettings)
          );
          if (seriesType == 'procandlestick') {
            series.columns.template.get('themeTags').push('pro');
          }
          break;
        case 'ohlc':
          newSettings.clustered = false;
          series = mainPanel.series.push(am5xy.OHLCSeries.new(root, newSettings));
          break;
      }

      // Set new series as stockSeries
      if (series) {
        valueLegend.data.removeValue(currentSeries);
        series.data.setAll(data);
        stockChart.set('stockSeries', series);
        var cursor = mainPanel.get('cursor');
        if (cursor) {
          cursor.set('snapToSeries', [series]);
        }
        valueLegend.data.insertIndex(0, series);
      }
    }

    // Stock toolbar
    var toolbar = am5stock.StockToolbar.new(root, {
      container: toolbarRef.current,
      stockChart: stockChart,
      controls: [
        am5stock.IndicatorControl.new(root, {
          stockChart: stockChart,
          legend: valueLegend,
        }),
        seriesSwitcher,
        am5stock.DrawingControl.new(root, {
          stockChart: stockChart,
        }),
        am5stock.ResetControl.new(root, {
          stockChart: stockChart,
        }),
        am5stock.SettingsControl.new(root, {
          stockChart: stockChart,
        }),
      ],
    });

    const loadData = async () => {
      const limit = isIntraday ? 1000 : 500;
      const start = isIntraday
        ? `&start=${encodeURIComponent(getTradingDaysAgoIso(5))}`
        : '';
      const response = await fetch(
        `/api/bars?symbol=${encodeURIComponent(
          activeTicker
        )}&timeframe=${selectedTimeframe.alpaca}&limit=${limit}${start}`
      );
      const json = await response.json();
      const data = json.bars.map((b) => ({
        Date: new Date(b.Timestamp).getTime(),
        Open: b.OpenPrice,
        High: b.HighPrice,
        Low: b.LowPrice,
        Close: b.ClosePrice,
        Volume: b.Volume,
      }));
      if (disposed) {
        return;
      }
      valueSeries.data.setAll(data);
      volumeSeries.data.setAll(data);
      sbSeries.data.setAll(data);
    };

    loadData();

    return () => {
      disposed = true;
      toolbar.dispose();
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
    };
  }, [activeTicker, timeframe]);

  return (
    <div className='flex flex-col h-full bg-[#060a10]'>
      <div className='flex items-center gap-2 px-4 py-2 border-b border-[#1f1f1f]'>
        <span className='text-white font-semibold'>{activeTicker}</span>
        <div className='flex gap-1 ml-4'>
          {TIMEFRAMES.map((option) => {
            const isActive = option.alpaca === timeframe;
            return (
              <button
                key={option.alpaca}
                type='button'
                onClick={() => setTimeframe(option.alpaca)}
                className={`rounded border px-2 py-1 text-xs font-medium transition ${
                  isActive
                    ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200'
                    : 'border-transparent bg-transparent text-slate-300 hover:border-slate-600/60 hover:text-white'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
      <div
        ref={toolbarRef}
        id='advancedChartControls'
        style={{ padding: '5px 5px 0 16px' }}
      ></div>
      <div
        id='advancedChartDiv'
        style={{ width: '100%', flex: 1, minHeight: 0 }}
      ></div>
    </div>
  );
}
