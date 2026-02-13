import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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

const RANGE_PRESETS = [
  { key: '1D', label: '1D', days: 1, tradingDays: true },
  { key: '5D', label: '5D', days: 5, tradingDays: true },
  { key: '1M', label: '1M', months: 1 },
  { key: '3M', label: '3M', months: 3 },
  { key: '6M', label: '6M', months: 6 },
  { key: '1Y', label: '1Y', years: 1 },
  { key: '5Y', label: '5Y', years: 5 },
];

const getTimeframe = (value) =>
  TIMEFRAMES.find((timeframe) => timeframe.alpaca === value) || TIMEFRAMES[0];

const getRangePreset = (key) =>
  RANGE_PRESETS.find((preset) => preset.key === key) || RANGE_PRESETS[1];

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

const getRangeStartIso = (rangePreset) => {
  if (!rangePreset) return undefined;
  if (rangePreset.days) {
    return rangePreset.tradingDays
      ? getTradingDaysAgoIso(rangePreset.days)
      : new Date(Date.now() - rangePreset.days * 24 * 60 * 60 * 1000).toISOString();
  }
  const date = new Date();
  if (rangePreset.months) {
    date.setMonth(date.getMonth() - rangePreset.months);
  }
  if (rangePreset.years) {
    date.setFullYear(date.getFullYear() - rangePreset.years);
  }
  return date.toISOString();
};

const estimateLimit = (rangePreset, timeframe) => {
  const tf = getTimeframe(timeframe);
  let tradingDays = 30;
  if (rangePreset?.days) tradingDays = rangePreset.days;
  if (rangePreset?.months) tradingDays = rangePreset.months * 21;
  if (rangePreset?.years) tradingDays = rangePreset.years * 252;

  let barsPerDay = 1;
  if (tf.unit === 'minute') barsPerDay = Math.max(1, Math.floor(390 / tf.count));
  if (tf.unit === 'hour') barsPerDay = Math.max(1, Math.floor(6.5 / tf.count));
  if (tf.unit === 'week') barsPerDay = 1 / 5;

  const estimate = Math.ceil(tradingDays * barsPerDay);
  return Math.min(Math.max(estimate, 200), 5000);
};

const formatPrice = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatNumber = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
  return Number(value).toLocaleString('en-US');
};

export default function AdvancedChartsPage({ activeTicker = 'NVDA' }) {
  const [ticker, setTicker] = useState(activeTicker);
  const [timeframe, setTimeframe] = useState('1Min');
  const [rangeKey, setRangeKey] = useState('5D');
  const [quote, setQuote] = useState(null);
  const [quoteStatus, setQuoteStatus] = useState({ state: 'idle', message: '' });

  const [searchQuery, setSearchQuery] = useState(activeTicker);
  const [searchResults, setSearchResults] = useState([]);
  const [searchStatus, setSearchStatus] = useState('idle');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const blurTimeoutRef = useRef(null);

  const [isTradePanelOpen, setIsTradePanelOpen] = useState(true);
  const [orderSide, setOrderSide] = useState('buy');
  const [orderType, setOrderType] = useState('market');
  const [orderQty, setOrderQty] = useState('1');
  const [limitPrice, setLimitPrice] = useState('');
  const [orderStep, setOrderStep] = useState('entry');
  const [orderStatus, setOrderStatus] = useState({ state: 'idle', message: '', data: null });
  const [orderError, setOrderError] = useState('');

  const toolbarRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    setTicker(activeTicker);
    setSearchQuery(activeTicker);
  }, [activeTicker]);

  useEffect(() => {
    const tf = getTimeframe(timeframe);
    if (tf.unit === 'minute' || tf.unit === 'hour') {
      setRangeKey((prev) => (prev === '1D' || prev === '5D' ? prev : '5D'));
    } else if (tf.unit === 'day') {
      setRangeKey((prev) => (prev === '6M' || prev === '1Y' ? prev : '6M'));
    } else {
      setRangeKey((prev) => (prev === '1Y' || prev === '5Y' ? prev : '1Y'));
    }
  }, [timeframe]);

  useEffect(() => {
    if (!ticker) return;
    let cancelled = false;

    const loadQuote = async () => {
      try {
        setQuoteStatus({ state: 'loading', message: '' });
        const response = await fetch(`/api/quote?symbol=${encodeURIComponent(ticker)}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || 'Failed to fetch quote');
        }
        if (!cancelled) {
          setQuote(data);
          setQuoteStatus({ state: 'success', message: '' });
        }
      } catch (err) {
        if (!cancelled) {
          setQuoteStatus({ state: 'error', message: err.message });
        }
      }
    };

    loadQuote();
    const interval = setInterval(loadQuote, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [ticker]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearchStatus('idle');
      return;
    }

    let cancelled = false;
    setSearchStatus('loading');
    const handle = setTimeout(async () => {
      try {
        const response = await fetch(`/api/stock/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || 'Search failed');
        }
        if (!cancelled) {
          setSearchResults(data.results || []);
          setSearchStatus('success');
        }
      } catch (err) {
        if (!cancelled) {
          setSearchStatus('error');
          setSearchResults([]);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [searchQuery]);

  const handleSearchSelect = (symbol) => {
    if (!symbol) return;
    const next = symbol.toUpperCase();
    setTicker(next);
    setSearchQuery(next);
    setIsSearchOpen(false);
    setOrderStep('entry');
    setOrderStatus({ state: 'idle', message: '', data: null });
    setOrderError('');
  };

  const orderQtyNumber = useMemo(() => {
    const parsed = parseFloat(orderQty);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [orderQty]);

  const limitPriceNumber = useMemo(() => {
    const parsed = parseFloat(limitPrice);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [limitPrice]);

  const displayPrice = useMemo(() => {
    if (orderType === 'limit' && limitPriceNumber > 0) return limitPriceNumber;
    return quote?.last ?? quote?.ask ?? quote?.bid ?? 0;
  }, [orderType, limitPriceNumber, quote]);

  const estimatedTotal = orderQtyNumber > 0 ? orderQtyNumber * displayPrice : 0;

  const canReview =
    ticker &&
    orderQtyNumber > 0 &&
    (orderType !== 'limit' || limitPriceNumber > 0) &&
    orderStep === 'entry';

  const handleReview = () => {
    if (!ticker) {
      setOrderError('Select a ticker to continue.');
      return;
    }
    if (orderQtyNumber <= 0) {
      setOrderError('Enter a valid quantity.');
      return;
    }
    if (orderType === 'limit' && limitPriceNumber <= 0) {
      setOrderError('Enter a valid limit price.');
      return;
    }
    setOrderError('');
    setOrderStep('review');
  };

  const handleSubmitOrder = async () => {
    setOrderStatus({ state: 'submitting', message: '', data: null });
    try {
      const payload = {
        symbol: ticker,
        qty: orderQtyNumber,
        side: orderSide,
        type: orderType,
        time_in_force: 'day',
      };
      if (orderType === 'limit') {
        payload.limit_price = limitPriceNumber;
      }

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Order failed');
      }

      setOrderStatus({ state: 'success', message: 'Order submitted.', data });
      setOrderStep('confirm');
    } catch (err) {
      setOrderStatus({ state: 'error', message: err.message, data: null });
      setOrderStep('confirm');
    }
  };

  const handleResetOrder = () => {
    setOrderStep('entry');
    setOrderStatus({ state: 'idle', message: '', data: null });
    setOrderError('');
  };

  useLayoutEffect(() => {
    const selectedTimeframe = getTimeframe(timeframe);

    const root = am5.Root.new('advancedChartDiv');
    root.setThemes([
      am5themes_Animated.new(root),
      am5themes_Dark.new(root),
    ]);

    const stockChart = root.container.children.push(
      am5stock.StockChart.new(root, {
        paddingRight: 0,
        stockPositiveColor: am5.color(0x34d399),
        stockNegativeColor: am5.color(0xf87171),
      })
    );

    root.numberFormatter.set('numberFormat', '#,###.00');

    const mainPanel = stockChart.panels.push(
      am5stock.StockPanel.new(root, {
        wheelY: 'zoomX',
        panX: true,
        panY: true,
      })
    );

    const valueAxis = mainPanel.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, { pan: 'zoom' }),
        extraMin: 0.1,
        tooltip: am5.Tooltip.new(root, {}),
        numberFormat: '#,###.00',
        extraTooltipPrecision: 2,
      })
    );

    const dateAxis = mainPanel.xAxes.push(
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

    const valueSeries = mainPanel.series.push(
      am5xy.CandlestickSeries.new(root, {
        turboMode: true,
        name: 'Price',
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

    const valueLegend = mainPanel.plotContainer.children.push(
      am5stock.StockLegend.new(root, { stockChart })
    );

    const volumeAxisRenderer = am5xy.AxisRendererY.new(root, {});
    volumeAxisRenderer.labels.template.set('forceHidden', true);
    volumeAxisRenderer.grid.template.set('forceHidden', true);
    const volumeValueAxis = mainPanel.yAxes.push(
      am5xy.ValueAxis.new(root, {
        numberFormat: '#.#a',
        height: am5.percent(20),
        y: am5.percent(100),
        centerY: am5.percent(100),
        renderer: volumeAxisRenderer,
      })
    );

    const volumeSeries = mainPanel.series.push(
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
      const dataItem = target.dataItem;
      if (dataItem) {
        return stockChart.getVolumeColor(dataItem);
      }
      return fill;
    });

    stockChart.set('volumeSeries', volumeSeries);
    valueLegend.data.setAll([valueSeries, volumeSeries]);

    mainPanel.set(
      'cursor',
      am5xy.XYCursor.new(root, {
        yAxis: valueAxis,
        xAxis: dateAxis,
        snapToSeries: [valueSeries],
        snapToSeriesBy: 'y!',
      })
    );

    const scrollbar = mainPanel.set(
      'scrollbarX',
      am5xy.XYChartScrollbar.new(root, { orientation: 'horizontal', height: 50 })
    );
    stockChart.toolsContainer.children.push(scrollbar);
    const sbDateAxis = scrollbar.chart.xAxes.push(
      am5xy.GaplessDateAxis.new(root, {
        baseInterval: {
          timeUnit: selectedTimeframe.unit,
          count: selectedTimeframe.count,
        },
        renderer: am5xy.AxisRendererX.new(root, { minorGridEnabled: true }),
      })
    );
    const sbValueAxis = scrollbar.chart.yAxes.push(
      am5xy.ValueAxis.new(root, { renderer: am5xy.AxisRendererY.new(root, {}) })
    );
    const sbSeries = scrollbar.chart.series.push(
      am5xy.LineSeries.new(root, {
        valueYField: 'Close',
        valueXField: 'Date',
        xAxis: sbDateAxis,
        yAxis: sbValueAxis,
      })
    );
    sbSeries.fills.template.setAll({ visible: true, fillOpacity: 0.3 });

    const seriesSwitcher = am5stock.SeriesTypeControl.new(root, { stockChart });

    const getNewSettings = (series) => {
      const newSettings = [];
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
    };

    const setSeriesType = (seriesType) => {
      const currentSeries = stockChart.get('stockSeries');
      const newSettings = getNewSettings(currentSeries);
      const data = currentSeries.data.values;
      mainPanel.series.removeValue(currentSeries);

      let series;
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
          if (seriesType === 'procandlestick') {
            series.columns.template.get('themeTags').push('pro');
          }
          break;
        case 'ohlc':
          newSettings.clustered = false;
          series = mainPanel.series.push(am5xy.OHLCSeries.new(root, newSettings));
          break;
        default:
          break;
      }

      if (series) {
        valueLegend.data.removeValue(currentSeries);
        series.data.setAll(data);
        stockChart.set('stockSeries', series);
        const cursor = mainPanel.get('cursor');
        if (cursor) {
          cursor.set('snapToSeries', [series]);
        }
        valueLegend.data.insertIndex(0, series);
        if (chartRef.current) {
          chartRef.current.valueSeries = series;
        }
      }
    };

    seriesSwitcher.events.on('selected', function (ev) {
      setSeriesType(ev.item.id);
    });

    const toolbar = am5stock.StockToolbar.new(root, {
      container: toolbarRef.current,
      stockChart,
      controls: [
        am5stock.IndicatorControl.new(root, {
          stockChart,
          legend: valueLegend,
        }),
        seriesSwitcher,
        am5stock.DrawingControl.new(root, {
          stockChart,
        }),
        am5stock.ResetControl.new(root, {
          stockChart,
        }),
        am5stock.SettingsControl.new(root, {
          stockChart,
        }),
      ],
    });

    chartRef.current = {
      root,
      stockChart,
      valueSeries,
      volumeSeries,
      sbSeries,
      dateAxis,
      toolbar,
    };

    return () => {
      toolbar.dispose();
      root.dispose();
      chartRef.current = null;
    };
  }, [timeframe]);

  useEffect(() => {
    const chart = chartRef.current;
    if (chart?.valueSeries) {
      chart.valueSeries.set('name', ticker);
    }
  }, [ticker]);

  useEffect(() => {
    let cancelled = false;
    const chart = chartRef.current;
    if (!chart) return undefined;

    const loadData = async () => {
      try {
        const selectedTimeframe = getTimeframe(timeframe);
        const rangePreset = getRangePreset(rangeKey);
        const start = getRangeStartIso(rangePreset);
        const limit = estimateLimit(rangePreset, timeframe);

        const response = await fetch(
          `/api/bars?symbol=${encodeURIComponent(ticker)}&timeframe=${selectedTimeframe.alpaca}&limit=${limit}${
            start ? `&start=${encodeURIComponent(start)}` : ''
          }`
        );
        const json = await response.json();
        if (!response.ok) {
          throw new Error(json?.error || 'Failed to load bars');
        }
        const data = (json.bars || []).map((b) => ({
          Date: new Date(b.Timestamp).getTime(),
          Open: b.OpenPrice,
          High: b.HighPrice,
          Low: b.LowPrice,
          Close: b.ClosePrice,
          Volume: b.Volume,
        }));

        if (cancelled) return;
        const activeSeries = chartRef.current?.valueSeries;
        activeSeries?.data.setAll(data);
        chart.volumeSeries.data.setAll(data);
        chart.sbSeries.data.setAll(data);
      } catch (err) {
        if (!cancelled) {
          // Silent fail for chart refresh
        }
      }
    };

    loadData();
    const refreshMs = (() => {
      const tf = getTimeframe(timeframe);
      if (tf.unit === 'minute') return 15000;
      if (tf.unit === 'hour') return 30000;
      return 60000;
    })();

    const interval = setInterval(loadData, refreshMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [ticker, timeframe, rangeKey]);

  const bidAskMid = useMemo(() => {
    if (!quote?.bid || !quote?.ask) return null;
    return (quote.bid + quote.ask) / 2;
  }, [quote]);

  return (
    <div className="flex h-full w-full bg-[#060a12] text-white">
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 bg-[#070c15]">
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value.toUpperCase());
                  setIsSearchOpen(true);
                }}
                onFocus={() => {
                  if (blurTimeoutRef.current) {
                    clearTimeout(blurTimeoutRef.current);
                  }
                  setIsSearchOpen(true);
                }}
                onBlur={() => {
                  blurTimeoutRef.current = setTimeout(() => setIsSearchOpen(false), 150);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearchSelect(searchQuery.trim() || ticker);
                  }
                }}
                className="w-44 rounded-lg border border-white/10 bg-[#0c1220] px-3 py-2 text-sm font-semibold tracking-wide text-white focus:border-emerald-400/60 focus:outline-none"
                placeholder="Search symbol"
              />
              {isSearchOpen && searchQuery.trim() && (
                <div className="absolute left-0 top-full z-20 mt-2 w-64 rounded-lg border border-white/10 bg-[#0c1220] shadow-2xl">
                  {searchStatus === 'loading' && (
                    <div className="px-3 py-2 text-xs text-white/50">Searching...</div>
                  )}
                  {searchStatus !== 'loading' && searchResults.length === 0 && (
                    <div className="px-3 py-2 text-xs text-white/50">No results</div>
                  )}
                  {searchResults.map((result) => (
                    <button
                      key={result.symbol}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSearchSelect(result.symbol)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-white/5"
                    >
                      <div>
                        <div className="font-semibold text-white">{result.symbol}</div>
                        <div className="text-[10px] text-white/50">{result.name}</div>
                      </div>
                      <span className="text-[10px] text-white/40">{result.exchange}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="text-sm font-semibold tracking-wide">{ticker}</div>
              <div className="text-xs text-white/50">
                {quoteStatus.state === 'error'
                  ? 'Quote unavailable'
                  : `Bid ${formatPrice(quote?.bid)} | Ask ${formatPrice(quote?.ask)}`}
              </div>
            </div>
            <div className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-200">
              Alpaca Live
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#0c1220] p-1">
              {TIMEFRAMES.map((option) => {
                const isActive = option.alpaca === timeframe;
                return (
                  <button
                    key={option.alpaca}
                    type="button"
                    onClick={() => setTimeframe(option.alpaca)}
                    className={`px-2 py-1 text-[11px] font-semibold rounded-md transition ${
                      isActive
                        ? 'bg-emerald-500/20 text-emerald-200'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#0c1220] p-1">
              {RANGE_PRESETS.map((range) => {
                const isActive = range.key === rangeKey;
                return (
                  <button
                    key={range.key}
                    type="button"
                    onClick={() => setRangeKey(range.key)}
                    className={`px-2 py-1 text-[11px] font-semibold rounded-md transition ${
                      isActive
                        ? 'bg-white/10 text-white'
                        : 'text-white/50 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {range.label}
                  </button>
                );
              })}
            </div>
            {!isTradePanelOpen && (
              <button
                type="button"
                onClick={() => setIsTradePanelOpen(true)}
                className="rounded-lg border border-white/10 bg-[#0c1220] px-3 py-2 text-xs font-semibold text-white/80 hover:text-white"
              >
                Trade
              </button>
            )}
          </div>
        </div>
        <div
          ref={toolbarRef}
          id="advancedChartControls"
          className="px-4 py-2 border-b border-white/5"
        />
        <div id="advancedChartDiv" className="flex-1 min-h-0" />
      </div>

      <div
        className={`relative flex flex-col border-l border-white/10 bg-[#0a0f1a] transition-all duration-300 ${
          isTradePanelOpen ? 'w-[280px] opacity-100' : 'w-0 opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Order Ticket</div>
            <div className="text-[11px] text-white/50">{ticker} | {orderType.toUpperCase()}</div>
          </div>
          <button
            type="button"
            onClick={() => setIsTradePanelOpen(false)}
            className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70 hover:text-white"
          >
            Collapse
          </button>
        </div>

        <div className="border-b border-white/5 px-4 py-3">
          <div className="flex items-center justify-between text-xs text-white/60">
            <span>Bid</span>
            <span className="font-semibold text-emerald-300">{formatPrice(quote?.bid)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-white/60">
            <span>Ask</span>
            <span className="font-semibold text-red-300">{formatPrice(quote?.ask)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-white/40">
            <span>Last</span>
            <span className="font-semibold text-white/80">{formatPrice(quote?.last)}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {orderStep === 'entry' && (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOrderSide('buy')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                    orderSide === 'buy'
                      ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200'
                      : 'border-white/10 bg-white/5 text-white/60 hover:text-white'
                  }`}
                >
                  Buy
                </button>
                <button
                  type="button"
                  onClick={() => setOrderSide('sell')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                    orderSide === 'sell'
                      ? 'border-red-400/40 bg-red-500/20 text-red-200'
                      : 'border-white/10 bg-white/5 text-white/60 hover:text-white'
                  }`}
                >
                  Sell
                </button>
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-[0.2em] text-white/40">Quantity</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={orderQty}
                  onChange={(e) => setOrderQty(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-400/60 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase tracking-[0.2em] text-white/40">Order Type</label>
                <select
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-400/60 focus:outline-none"
                >
                  <option value="market">Market</option>
                  <option value="limit">Limit</option>
                </select>
              </div>

              {orderType === 'limit' && (
                <div>
                  <label className="text-[11px] uppercase tracking-[0.2em] text-white/40">Limit Price</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-400/60 focus:outline-none"
                  />
                </div>
              )}

              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>Est. Total</span>
                  <span className="font-semibold text-white">{estimatedTotal ? `$${formatPrice(estimatedTotal)}` : '--'}</span>
                </div>
                <div className="mt-1 text-[11px] text-white/40">
                  Mid: {bidAskMid ? `$${formatPrice(bidAskMid)}` : '--'}
                </div>
              </div>

              {orderError && <div className="text-xs text-red-300">{orderError}</div>}

              <button
                type="button"
                onClick={handleReview}
                disabled={!canReview}
                className={`w-full rounded-lg py-2.5 text-sm font-semibold transition ${
                  orderSide === 'buy'
                    ? 'bg-emerald-500/80 text-white hover:bg-emerald-400 disabled:bg-emerald-500/30'
                    : 'bg-red-500/80 text-white hover:bg-red-400 disabled:bg-red-500/30'
                } disabled:cursor-not-allowed`}
              >
                Review Order
              </button>
            </>
          )}

          {orderStep === 'review' && (
            <>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Symbol</span>
                  <span className="font-semibold">{ticker}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Side</span>
                  <span className={orderSide === 'buy' ? 'text-emerald-300' : 'text-red-300'}>
                    {orderSide.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Quantity</span>
                  <span>{orderQtyNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Type</span>
                  <span>{orderType.toUpperCase()}</span>
                </div>
                {orderType === 'limit' && (
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Limit</span>
                    <span>${formatPrice(limitPriceNumber)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Est. Total</span>
                  <span className="font-semibold">{estimatedTotal ? `$${formatPrice(estimatedTotal)}` : '--'}</span>
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-white/50">
                Quotes update every 5s. Review carefully before confirming.
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOrderStep('entry')}
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 py-2 text-xs text-white/70 hover:text-white"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleSubmitOrder}
                  disabled={orderStatus.state === 'submitting'}
                  className={`flex-1 rounded-lg py-2 text-xs font-semibold text-white transition ${
                    orderSide === 'buy'
                      ? 'bg-emerald-500/80 hover:bg-emerald-400'
                      : 'bg-red-500/80 hover:bg-red-400'
                  } ${orderStatus.state === 'submitting' ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {orderStatus.state === 'submitting' ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </>
          )}

          {orderStep === 'confirm' && (
            <>
              <div
                className={`rounded-lg border p-3 text-sm ${
                  orderStatus.state === 'success'
                    ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
                    : 'border-red-400/30 bg-red-500/10 text-red-200'
                }`}
              >
                <div className="font-semibold">
                  {orderStatus.state === 'success' ? 'Order Confirmed' : 'Order Failed'}
                </div>
                <div className="mt-1 text-xs">
                  {orderStatus.message || 'Check the order status in your broker.'}
                </div>
              </div>
              {orderStatus.data && (
                <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-white/60">
                  <div>Order ID: {orderStatus.data.id || '--'}</div>
                  <div>Status: {orderStatus.data.status || '--'}</div>
                </div>
              )}
              <button
                type="button"
                onClick={handleResetOrder}
                className="w-full rounded-lg border border-white/10 bg-white/5 py-2 text-xs text-white/70 hover:text-white"
              >
                Place Another Order
              </button>
            </>
          )}
        </div>

        <div className="border-t border-white/10 px-4 py-3 text-[11px] text-white/40">
          Daily volume: {formatNumber(quote?.volume)} | High {formatPrice(quote?.high)} | Low {formatPrice(quote?.low)}
        </div>
      </div>
    </div>
  );
}
