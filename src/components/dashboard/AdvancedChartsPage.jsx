import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import * as am5stock from '@amcharts/amcharts5/stock';
import am5themes_Dark from '@amcharts/amcharts5/themes/Dark';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';

const TIMEFRAME_GROUPS = [
  {
    title: 'MINUTE',
    options: [
      { key: '1m', label: '1 min', alpaca: '1Min', unit: 'minute', count: 1 },
      { key: '2m', label: '2 mins', alpaca: '1Min', unit: 'minute', count: 1 },
      { key: '3m', label: '3 mins', alpaca: '1Min', unit: 'minute', count: 1 },
      { key: '5m', label: '5 mins', alpaca: '5Min', unit: 'minute', count: 5 },
      { key: '10m', label: '10 mins', alpaca: '5Min', unit: 'minute', count: 5 },
      { key: '15m', label: '15 mins', alpaca: '15Min', unit: 'minute', count: 15 },
      { key: '20m', label: '20 mins', alpaca: '15Min', unit: 'minute', count: 15 },
      { key: '30m', label: '30 mins', alpaca: '15Min', unit: 'minute', count: 15 },
    ],
  },
  {
    title: 'HOUR',
    options: [
      { key: '1h', label: '1 hour', alpaca: '1Hour', unit: 'hour', count: 1 },
      { key: '2h', label: '2 hours', alpaca: '1Hour', unit: 'hour', count: 1 },
      { key: '4h', label: '4 hours', alpaca: '4Hour', unit: 'hour', count: 4 },
    ],
  },
  {
    title: 'DAY',
    options: [
      { key: '1d', label: 'Daily', alpaca: '1Day', unit: 'day', count: 1 },
      { key: '1w', label: 'Weekly', alpaca: '1Week', unit: 'week', count: 1 },
      { key: '1mo', label: 'Monthly', alpaca: '1Month', unit: 'month', count: 1 },
      { key: '1q', label: 'Quarterly', alpaca: '1Month', unit: 'month', count: 1 },
    ],
  },
];

const TIMEFRAMES = TIMEFRAME_GROUPS.flatMap((group) => group.options);

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
  TIMEFRAMES.find((timeframe) => timeframe.key === value) || TIMEFRAMES[0];

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
  if (tf.unit === 'month') barsPerDay = 1 / 21;

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

const formatUsd = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
};

const formatTimestamp = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '--';
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  });
  const parts = formatter.formatToParts(date);
  const lookup = parts.reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});
  return `${lookup.month} ${lookup.day}, ${lookup.year} at ${lookup.hour}:${lookup.minute} ${lookup.dayPeriod} ${lookup.timeZoneName}`;
};

const ORDER_TYPE_LABELS = {
  market: 'Market',
  limit: 'Limit',
  stop: 'Stop',
  stop_limit: 'Stop Limit',
  trailing_stop: 'Trailing Stop',
};

const ORDER_TYPE_OPTIONS = [
  { value: 'market', label: 'Market' },
  { value: 'limit', label: 'Limit' },
  { value: 'stop', label: 'Stop' },
  { value: 'stop_limit', label: 'Stop Limit' },
  { value: 'trailing_stop', label: 'Trailing Stop' },
];

export default function AdvancedChartsPage({ activeTicker = 'NVDA' }) {
  const [ticker, setTicker] = useState(activeTicker);
  const [timeframe, setTimeframe] = useState('1m');
  const [rangeKey, setRangeKey] = useState('5D');
  const [quote, setQuote] = useState(null);
  const [quoteStatus, setQuoteStatus] = useState({ state: 'idle', message: '' });
  const [account, setAccount] = useState(null);
  const [accountStatus, setAccountStatus] = useState({ state: 'idle', message: '' });
  const [positions, setPositions] = useState([]);
  const [positionsStatus, setPositionsStatus] = useState({ state: 'idle', message: '' });

  const [searchQuery, setSearchQuery] = useState(activeTicker);
  const [searchResults, setSearchResults] = useState([]);
  const [searchStatus, setSearchStatus] = useState('idle');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isTimeframeOpen, setIsTimeframeOpen] = useState(false);
  const blurTimeoutRef = useRef(null);

  const [isTradePanelOpen, setIsTradePanelOpen] = useState(true);
  const [orderSide, setOrderSide] = useState('buy');
  const [orderType, setOrderType] = useState('market');
  const [orderQty, setOrderQty] = useState('1');
  const [limitPrice, setLimitPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [trailAmount, setTrailAmount] = useState('');
  const [orderStep, setOrderStep] = useState('entry');
  const [orderStatus, setOrderStatus] = useState({
    state: 'idle',
    message: '',
    data: null,
    timestamp: null,
  });
  const [orderError, setOrderError] = useState('');

  const timeframeRef = useRef(null);
  const toolbarRef = useRef(null);
  const chartRef = useRef(null);
  const lastPriceRef = useRef(null);

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
    if (!ticker || !isTradePanelOpen) return;
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
  }, [ticker, isTradePanelOpen]);

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

  useEffect(() => {
    if (!isTimeframeOpen) return undefined;
    const handleClick = (event) => {
      if (timeframeRef.current && !timeframeRef.current.contains(event.target)) {
        setIsTimeframeOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isTimeframeOpen]);

  const handleSearchSelect = (symbol) => {
    if (!symbol) return;
    const next = symbol.toUpperCase();
    setTicker(next);
    setSearchQuery(next);
    setIsSearchOpen(false);
    setOrderStep('entry');
    setOrderStatus({ state: 'idle', message: '', data: null, timestamp: null });
    setOrderError('');
  };

  const refreshAccount = useCallback(async () => {
    try {
      setAccountStatus({ state: 'loading', message: '' });
      const response = await fetch('/api/account');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to fetch account');
      }
      setAccount(data);
      setAccountStatus({ state: 'success', message: '' });
    } catch (err) {
      setAccountStatus({ state: 'error', message: err.message });
    }
  }, []);

  const refreshPositions = useCallback(async () => {
    try {
      setPositionsStatus({ state: 'loading', message: '' });
      const response = await fetch('/api/positions');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to fetch positions');
      }
      setPositions(Array.isArray(data) ? data : []);
      setPositionsStatus({ state: 'success', message: '' });
    } catch (err) {
      setPositionsStatus({ state: 'error', message: err.message });
    }
  }, []);

  useEffect(() => {
    if (!isTradePanelOpen) return;
    refreshAccount();
    refreshPositions();
  }, [isTradePanelOpen, refreshAccount, refreshPositions]);

  const orderQtyNumber = useMemo(() => {
    const parsed = parseFloat(orderQty);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [orderQty]);

  const limitPriceNumber = useMemo(() => {
    const parsed = parseFloat(limitPrice);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [limitPrice]);

  const stopPriceNumber = useMemo(() => {
    const parsed = parseFloat(stopPrice);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [stopPrice]);

  const trailAmountNumber = useMemo(() => {
    const parsed = parseFloat(trailAmount);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [trailAmount]);

  const marketPrice = useMemo(() => {
    return quote?.last ?? quote?.ask ?? quote?.bid ?? 0;
  }, [quote]);

  const bidPrice = quote?.bid ?? null;
  const askPrice = quote?.ask ?? null;

  const priceDirection = useMemo(() => {
    const reference = quote?.open ?? lastPriceRef.current;
    if (!marketPrice || !reference) return 'neutral';
    if (marketPrice > reference) return 'up';
    if (marketPrice < reference) return 'down';
    return 'neutral';
  }, [marketPrice, quote?.open]);

  useEffect(() => {
    if (marketPrice) {
      lastPriceRef.current = marketPrice;
    }
  }, [marketPrice]);

  useEffect(() => {
    if (orderType !== 'limit' && orderType !== 'stop_limit') return;
    if (limitPrice !== '') return;
    const next = orderSide === 'buy' ? askPrice : bidPrice;
    if (Number.isFinite(next) && next > 0) {
      setLimitPrice(next.toFixed(2));
    }
  }, [orderType, orderSide, askPrice, bidPrice, limitPrice]);

  const priceForEstimate = useMemo(() => {
    if (orderType === 'limit') return limitPriceNumber;
    if (orderType === 'stop') return stopPriceNumber;
    if (orderType === 'stop_limit') return limitPriceNumber;
    if (orderType === 'trailing_stop') return marketPrice;
    return marketPrice;
  }, [orderType, limitPriceNumber, stopPriceNumber, marketPrice]);

  const estimatedTotal =
    orderQtyNumber > 0 && priceForEstimate > 0 ? orderQtyNumber * priceForEstimate : 0;

  const requiresLimit = orderType === 'limit' || orderType === 'stop_limit';
  const requiresStop = orderType === 'stop' || orderType === 'stop_limit';
  const requiresTrail = orderType === 'trailing_stop';

  const isPriceMissing =
    (requiresLimit && limitPriceNumber <= 0) ||
    (requiresStop && stopPriceNumber <= 0) ||
    (requiresTrail && trailAmountNumber <= 0);

  const canReview =
    ticker && orderQtyNumber > 0 && !isPriceMissing && orderStep === 'entry';

  const positionForTicker = useMemo(() => {
    return positions.find(
      (position) => position?.symbol?.toUpperCase() === ticker?.toUpperCase()
    );
  }, [positions, ticker]);

  const availableShares = useMemo(() => {
    const rawQty =
      positionForTicker?.qty_available ??
      positionForTicker?.qty ??
      positionForTicker?.quantity;
    const parsed = parseFloat(rawQty);
    return Number.isFinite(parsed) ? parsed : null;
  }, [positionForTicker]);

  const availableSharesDisplay =
    positionsStatus.state === 'loading'
      ? '...'
      : availableShares === null
        ? '--'
        : availableShares.toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 4,
          });

  const priceTextClass =
    priceDirection === 'up'
      ? 'text-emerald-400'
      : priceDirection === 'down'
        ? 'text-red-400'
        : 'text-white';

  const actionButtonClass =
    orderSide === 'buy'
      ? 'bg-emerald-500 hover:bg-emerald-400'
      : 'bg-red-500 hover:bg-red-400';

  const orderTypeLabel = ORDER_TYPE_LABELS[orderType] || 'Market';

  const orderTimestamp =
    orderStatus.data?.filled_at ||
    orderStatus.data?.submitted_at ||
    orderStatus.data?.created_at ||
    orderStatus.timestamp;

  const inputBaseClass =
    'w-28 rounded-md border border-white/10 bg-transparent px-2 py-1 text-right text-sm text-white focus:border-white/30 focus:outline-none';
  const selectBaseClass =
    'w-full rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none';

  const handleReview = () => {
    if (!ticker) {
      setOrderError('Select a ticker to continue.');
      return;
    }
    if (orderQtyNumber <= 0) {
      setOrderError('Enter a valid share quantity.');
      return;
    }
    if (requiresLimit && limitPriceNumber <= 0) {
      setOrderError('Enter a valid limit price.');
      return;
    }
    if (requiresStop && stopPriceNumber <= 0) {
      setOrderError('Enter a valid stop price.');
      return;
    }
    if (requiresTrail && trailAmountNumber <= 0) {
      setOrderError('Enter a valid trail amount.');
      return;
    }
    setOrderError('');
    setOrderStep('review');
  };

  const clearOrderError = () => {
    if (orderError) {
      setOrderError('');
    }
  };

  const handleSubmitOrder = async () => {
    const submittedAt = new Date().toISOString();
    setOrderStatus({ state: 'submitting', message: '', data: null, timestamp: submittedAt });
    try {
      const payload = {
        symbol: ticker,
        qty: orderQtyNumber,
        side: orderSide,
        type: orderType,
        time_in_force: 'day',
      };
      if (requiresLimit) {
        payload.limit_price = limitPriceNumber;
      }
      if (requiresStop) {
        payload.stop_price = stopPriceNumber;
      }
      if (orderType === 'trailing_stop') {
        payload.trail_price = trailAmountNumber;
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

      setOrderStatus({
        state: 'success',
        message: 'Order submitted.',
        data,
        timestamp: data?.submitted_at || submittedAt,
      });
      setOrderStep('confirm');
      refreshAccount();
      refreshPositions();
    } catch (err) {
      setOrderStatus({
        state: 'error',
        message: err.message,
        data: null,
        timestamp: submittedAt,
      });
      setOrderStep('confirm');
      refreshAccount();
      refreshPositions();
    }
  };

  const handleResetOrder = () => {
    setOrderStep('entry');
    setOrderStatus({ state: 'idle', message: '', data: null, timestamp: null });
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

        const bars = Array.isArray(json) ? json : json.bars || [];
        const data = bars.map((b) => ({
          Date: (Number.isFinite(b.time) ? b.time * 1000 : new Date(b.Timestamp).getTime()),
          Open: b.open ?? b.OpenPrice,
          High: b.high ?? b.HighPrice,
          Low: b.low ?? b.LowPrice,
          Close: b.close ?? b.ClosePrice,
          Volume: b.volume ?? b.Volume,
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

  // Twelve Data WebSocket for live price updates
  const tdWsRef = useRef(null);
  const [isLive, setIsLive] = useState(false);
  useEffect(() => {
    const tdKey = import.meta.env.VITE_TWELVE_DATA_APIKEY || import.meta.env.VITE_TWELVEDATA_API_KEY || '';
    const tf = getTimeframe(timeframe);
    if (!tdKey || (tf.unit !== 'minute' && tf.unit !== 'hour')) { setIsLive(false); return; }
    let cancelled = false;
    const ws = new WebSocket(`wss://ws.twelvedata.com/v1/quotes/price?apikey=${encodeURIComponent(tdKey)}`);
    tdWsRef.current = ws;
    ws.onopen = () => { ws.send(JSON.stringify({ action: 'subscribe', params: { symbols: ticker } })); setIsLive(true); };
    ws.onmessage = (e) => {
      try {
        const m = JSON.parse(e.data);
        if (m.event !== 'price') return;
        const p = parseFloat(m.price);
        if (!Number.isFinite(p)) return;
        lastPriceRef.current = p;
        // Update last candle in amCharts
        const chart = chartRef.current;
        if (!chart?.valueSeries) return;
        const data = chart.valueSeries.data;
        if (!data || data.length === 0) return;
        const last = data.getIndex(data.length - 1);
        if (!last) return;
        data.setIndex(data.length - 1, {
          ...last,
          Close: p,
          High: Math.max(last.High, p),
          Low: Math.min(last.Low, p),
        });
      } catch {}
    };
    ws.onclose = () => { if (!cancelled) setIsLive(false); };
    ws.onerror = () => { if (!cancelled) setIsLive(false); };
    return () => {
      cancelled = true;
      try { ws.send(JSON.stringify({ action: 'unsubscribe', params: { symbols: ticker } })); } catch {}
      try { ws.close(); } catch {}
      tdWsRef.current = null;
      setIsLive(false);
    };
  }, [ticker, timeframe]);

  const buyingPower =
    account?.buying_power ?? account?.buyingPower ?? account?.cash ?? null;
  const buyingPowerDisplay =
    accountStatus.state === 'loading'
      ? '...'
      : accountStatus.state === 'error'
        ? '--'
        : buyingPower !== null && buyingPower !== undefined
          ? formatUsd(buyingPower)
          : '--';
  const activeTimeframe = getTimeframe(timeframe);

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
            <div className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.2em] flex items-center gap-1 ${isLive ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200' : 'border-white/20 bg-white/5 text-white/40'}`}>
              {isLive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
              {isLive ? 'Live' : 'Delayed'}
            </div>
            {!isTradePanelOpen && (
              <button
                type="button"
                onClick={() => setIsTradePanelOpen(true)}
                className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-400 hover:border-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/15 transition-all shadow-[0_0_12px_rgba(16,185,129,0.15)]"
              >
                Trade
              </button>
            )}
            <div className="relative" ref={timeframeRef}>
              <button
                type="button"
                onClick={() => setIsTimeframeOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#0c1220] px-3 py-2 text-xs font-semibold text-white/80 hover:text-white"
              >
                <span>{activeTimeframe.label}</span>
                <svg
                  aria-hidden="true"
                  className="h-3 w-3 text-white/70"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.25a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              {isTimeframeOpen && (
                <div className="absolute left-0 top-full z-30 mt-2 w-[280px] rounded-2xl border border-white/10 bg-[#1a1a1a] p-4 shadow-2xl">
                  {TIMEFRAME_GROUPS.map((group) => (
                    <div key={group.title} className="mb-4 last:mb-0">
                      <div className="mb-2 text-xs font-semibold text-white">
                        {group.title}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {group.options.map((option) => {
                          const isActive = option.key === timeframe;
                          return (
                            <button
                              key={option.key}
                              type="button"
                              onClick={() => {
                                setTimeframe(option.key);
                                setIsTimeframeOpen(false);
                              }}
                              className={`rounded-full border bg-white/10 px-3 py-1 text-[11px] font-semibold transition ${
                                isActive
                                  ? 'border-blue-400 text-blue-300'
                                  : 'border-transparent text-white/80 hover:text-white'
                              }`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
        className={`relative flex flex-col bg-[#0a0f1a] transition-all duration-300 overflow-hidden ${
          isTradePanelOpen
            ? 'w-[300px] border-l border-white/10 opacity-100'
            : 'w-0 border-l border-transparent opacity-0 pointer-events-none'
        }`}
      >
        <div className="border-b border-white/10 px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  clearOrderError();
                  setOrderSide('buy');
                }}
                className={`transition ${
                  orderSide === 'buy'
                    ? 'text-emerald-400'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                Buy
              </button>
              <button
                type="button"
                onClick={() => {
                  clearOrderError();
                  setOrderSide('sell');
                }}
                className={`transition ${
                  orderSide === 'sell'
                    ? 'text-red-400'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                Sell
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsTradePanelOpen(false)}
              aria-label="Collapse trade panel"
              className="text-white/40 hover:text-white/70 transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-white">{ticker}</span>
              <span className={`text-xl ${priceTextClass}`}>
                {marketPrice > 0 ? `$${formatPrice(marketPrice)}` : '--'}
              </span>
            </div>
            <div className="mt-1 text-xs text-white/40">
              Bid {formatPrice(bidPrice)} · Ask {formatPrice(askPrice)}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div
            className={`space-y-4 overflow-hidden transition-all duration-300 ${
              orderStep === 'entry'
                ? 'max-h-[1200px] opacity-100'
                : 'max-h-0 opacity-0 pointer-events-none'
            }`}
          >
            <div className="space-y-2">
              <label className="text-sm text-white/60">Order Type</label>
              <select
                value={orderType}
                onChange={(e) => {
                  clearOrderError();
                  setOrderType(e.target.value);
                }}
                className={selectBaseClass}
              >
                {ORDER_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} className="bg-[#0a0f1a]">
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {orderType === 'limit' && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Limit Price</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={limitPrice}
                  onChange={(e) => {
                    clearOrderError();
                    setLimitPrice(e.target.value);
                  }}
                  className={inputBaseClass}
                />
              </div>
            )}

            {orderType === 'stop' && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Stop Price</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={stopPrice}
                  onChange={(e) => {
                    clearOrderError();
                    setStopPrice(e.target.value);
                  }}
                  className={inputBaseClass}
                />
              </div>
            )}

            {orderType === 'stop_limit' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">Stop Price</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={stopPrice}
                    onChange={(e) => {
                      clearOrderError();
                      setStopPrice(e.target.value);
                    }}
                    className={inputBaseClass}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">Limit Price</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={limitPrice}
                    onChange={(e) => {
                      clearOrderError();
                      setLimitPrice(e.target.value);
                    }}
                    className={inputBaseClass}
                  />
                </div>
              </div>
            )}

            {orderType === 'trailing_stop' && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Trail Amount ($)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={trailAmount}
                  onChange={(e) => {
                    clearOrderError();
                    setTrailAmount(e.target.value);
                  }}
                  className={inputBaseClass}
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Shares</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={orderQty}
                  onChange={(e) => {
                    clearOrderError();
                    setOrderQty(e.target.value);
                  }}
                  className={`${inputBaseClass} w-24`}
                />
              </div>
              {orderSide === 'sell' && (
                <div className="text-xs text-white/40">
                  {availableSharesDisplay} shares available
                </div>
              )}
            </div>

            <div className="border-t border-white/10 pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Market Price</span>
                <span className="text-sm text-white">
                  {marketPrice > 0 ? formatUsd(marketPrice) : '--'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Estimated Cost</span>
                <span className="text-sm text-white">
                  {estimatedTotal > 0 ? formatUsd(estimatedTotal) : '--'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Buying Power</span>
                <span className="text-sm text-white/40">{buyingPowerDisplay}</span>
              </div>
              <div className="border-t border-white/10 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">Estimated Total</span>
                  <span className="text-lg font-semibold text-white">
                    {estimatedTotal > 0 ? formatUsd(estimatedTotal) : '--'}
                  </span>
                </div>
              </div>
            </div>

            {orderError && <div className="text-xs text-red-300">{orderError}</div>}

            <button
              type="button"
              onClick={handleReview}
              disabled={!canReview}
              className={`h-10 w-full rounded-lg text-sm font-medium text-white ${actionButtonClass} ${
                !canReview ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              Review Order
            </button>
          </div>

          <div
            className={`space-y-4 overflow-hidden transition-all duration-300 ${
              orderStep === 'review'
                ? 'max-h-[1200px] opacity-100'
                : 'max-h-0 opacity-0 pointer-events-none'
            }`}
          >
            <div className="space-y-3 rounded-lg border border-white/10 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-white/60">Side</span>
                <span className={orderSide === 'buy' ? 'text-emerald-300' : 'text-red-300'}>
                  {orderSide === 'buy' ? 'Buy' : 'Sell'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Ticker</span>
                <span className="text-white">{ticker}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Order Type</span>
                <span className="text-white">{orderTypeLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Shares</span>
                <span className="text-white">{orderQtyNumber}</span>
              </div>
              {orderType === 'limit' && (
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Limit Price</span>
                  <span className="text-white">{formatUsd(limitPriceNumber)}</span>
                </div>
              )}
              {orderType === 'stop' && (
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Stop Price</span>
                  <span className="text-white">{formatUsd(stopPriceNumber)}</span>
                </div>
              )}
              {orderType === 'stop_limit' && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Stop Price</span>
                    <span className="text-white">{formatUsd(stopPriceNumber)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Limit Price</span>
                    <span className="text-white">{formatUsd(limitPriceNumber)}</span>
                  </div>
                </>
              )}
              {orderType === 'trailing_stop' && (
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Trail Amount</span>
                  <span className="text-white">{formatUsd(trailAmountNumber)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-white/60">Estimated Total</span>
                <span className="text-white">
                  {estimatedTotal > 0 ? formatUsd(estimatedTotal) : '--'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOrderStep('entry')}
              className="w-full rounded-lg border border-white/20 py-2 text-sm text-white/60 hover:text-white transition"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={handleSubmitOrder}
              disabled={orderStatus.state === 'submitting'}
              className={`h-10 w-full rounded-lg text-sm font-medium text-white ${actionButtonClass} ${
                orderStatus.state === 'submitting' ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {orderStatus.state === 'submitting' ? 'Submitting...' : 'Submit Order'}
            </button>
          </div>

          <div
            className={`space-y-4 overflow-hidden transition-all duration-300 ${
              orderStep === 'confirm'
                ? 'max-h-[1200px] opacity-100'
                : 'max-h-0 opacity-0 pointer-events-none'
            }`}
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-1 h-5 w-5 text-emerald-400" />
              <div>
                <div className="text-lg font-medium text-white">
                  {orderStatus.state === 'success' ? 'Order Submitted' : 'Order Failed'}
                </div>
                {orderStatus.state === 'error' && (
                  <div className="mt-1 text-sm text-red-300">{orderStatus.message}</div>
                )}
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-white/60">Ticker</span>
                <span className="text-white">{ticker}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Side</span>
                <span className="text-white">{orderSide === 'buy' ? 'Buy' : 'Sell'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Shares</span>
                <span className="text-white">{orderQtyNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/60">Order Type</span>
                <span className="text-white">{orderTypeLabel}</span>
              </div>
              {orderStatus.data?.filled_avg_price && (
                <div className="flex items-center justify-between">
                  <span className="text-white/60">Fill Price</span>
                  <span className="text-white">
                    {formatUsd(orderStatus.data.filled_avg_price)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-white/60">Timestamp</span>
                <span className="text-white">
                  {orderTimestamp ? formatTimestamp(orderTimestamp) : '--'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetOrder}
              className="w-full rounded-lg border border-white/20 py-2 text-sm text-white/60 hover:text-white transition"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
