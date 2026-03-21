import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { CandlestickSeries, ColorType, HistogramSeries, createChart } from 'lightweight-charts';
import { getApiUrl } from '../../lib/api';

const UP_COLOR = '#26a69a';
const DOWN_COLOR = '#ef5350';
const VOLUME_UP_COLOR = 'rgba(38, 166, 154, 0.35)';
const VOLUME_DOWN_COLOR = 'rgba(239, 83, 80, 0.35)';
const DEFAULT_HISTORY_TIMEFRAME = '1Day';
const DEFAULT_HISTORY_LIMIT = '500';
const FALLBACK_TIMEFRAME_ID = '1D';

const TIMEFRAME_CONFIG = {
  '1m': { apiTimeframe: '1Min', limit: '1000' },
  '5m': { apiTimeframe: '5Min', limit: '1000' },
  '15m': { apiTimeframe: '15Min', limit: '1000' },
  '1h': { apiTimeframe: '1Hour', limit: '1000' },
  '4h': { apiTimeframe: '1Hour', limit: '2000' },
  '1D': { apiTimeframe: '1Day', limit: '1500' },
  '1W': { apiTimeframe: '1Week', limit: '1500' },
  '1M': { apiTimeframe: '1Day', limit: '5000' },
  '1Y': { apiTimeframe: '1Week', limit: '5000' },
  ALL: { apiTimeframe: '1Week', limit: '10000' },
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatPrice = (value) => {
  const amount = toNumber(value);
  if (!Number.isFinite(amount)) return '--';

  if (Math.abs(amount) >= 1) {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  });
};

const formatVolume = (value) => {
  const amount = toNumber(value);
  if (!Number.isFinite(amount)) return '--';
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(2)}K`;
  return `${Math.round(amount)}`;
};

const resolvePriceTone = (nextPrice, previousPrice) => {
  const next = toNumber(nextPrice);
  const prev = toNumber(previousPrice);
  if (!Number.isFinite(next) || !Number.isFinite(prev)) return 'neutral';
  if (next > prev) return 'up';
  if (next < prev) return 'down';
  return 'neutral';
};

const toUnixSeconds = (value) => {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    if (value > 1e12) return Math.floor(value / 1000);
    if (value > 1e10) return Math.floor(value / 1000);
    return Math.floor(value);
  }

  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return null;
    if (/^\d+$/.test(raw)) return toUnixSeconds(Number(raw));

    const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
    let parsed = Date.parse(normalized);
    if (!Number.isFinite(parsed)) parsed = Date.parse(`${normalized}Z`);
    if (!Number.isFinite(parsed)) return null;
    return Math.floor(parsed / 1000);
  }

  if (typeof value === 'object' && value && 'year' in value && 'month' in value && 'day' in value) {
    return Math.floor(Date.UTC(value.year, value.month - 1, value.day) / 1000);
  }

  return null;
};

const normalizeCandles = (rows = []) => {
  const source = Array.isArray(rows) ? rows : [];
  let previousClose = null;

  const parsed = source
    .map((row) => {
      const close = toNumber(row?.close);
      const time = toUnixSeconds(row?.time ?? row?.datetime ?? row?.timestamp ?? row?.date);
      if (!Number.isFinite(close) || !Number.isFinite(time)) return null;

      const openValue = toNumber(row?.open);
      const highValue = toNumber(row?.high);
      const lowValue = toNumber(row?.low);
      const volumeValue = toNumber(row?.volume) ?? 0;

      const open = Number.isFinite(openValue)
        ? openValue
        : Number.isFinite(previousClose)
          ? previousClose
          : close;

      const high = Number.isFinite(highValue) ? highValue : Math.max(open, close);
      const low = Number.isFinite(lowValue) ? lowValue : Math.min(open, close);

      previousClose = close;

      return {
        time,
        open,
        high,
        low,
        close,
        volume: volumeValue,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.time - b.time);

  const deduped = [];
  parsed.forEach((bar) => {
    const last = deduped[deduped.length - 1];
    if (last && last.time === bar.time) {
      deduped[deduped.length - 1] = bar;
      return;
    }
    deduped.push(bar);
  });

  return deduped;
};

const toSymbolKey = (value) => String(value || '').trim().toUpperCase();

const normalizeTimeframeId = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return FALLBACK_TIMEFRAME_ID;

  if (raw === '1m') return '1m';
  if (raw === '5m') return '5m';
  if (raw === '15m') return '15m';
  if (raw === '1h') return '1h';
  if (raw === '4h') return '4h';
  if (raw === '1D') return '1D';
  if (raw === '1W') return '1W';
  if (raw === '1M') return '1M';
  if (raw === '1Y') return '1Y';
  if (raw === 'ALL') return 'ALL';

  const lower = raw.toLowerCase();
  if (lower === '1m') return '1m';
  if (lower === '5m') return '5m';
  if (lower === '15m') return '15m';
  if (lower === '1h') return '1h';
  if (lower === '4h') return '4h';
  if (lower === '1d') return '1D';
  if (lower === '1w') return '1W';
  if (lower === '1y') return '1Y';
  if (lower === 'all') return 'ALL';

  return FALLBACK_TIMEFRAME_ID;
};

const resolveTimeframeConfig = (timeframeId) => {
  const normalized = normalizeTimeframeId(timeframeId);
  return TIMEFRAME_CONFIG[normalized] || TIMEFRAME_CONFIG[FALLBACK_TIMEFRAME_ID];
};

const getWeekBucketStart = (timeSeconds) => {
  const date = new Date(timeSeconds * 1000);
  const day = date.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  date.setUTCHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 1000);
};

const getMonthBucketStart = (timeSeconds) => {
  const date = new Date(timeSeconds * 1000);
  date.setUTCDate(1);
  date.setUTCHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 1000);
};

const getYearBucketStart = (timeSeconds) => {
  const date = new Date(timeSeconds * 1000);
  date.setUTCMonth(0, 1);
  date.setUTCHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 1000);
};

const getBucketStartByTimeframe = (timeSeconds, timeframeId) => {
  if (!Number.isFinite(timeSeconds)) return Math.floor(Date.now() / 1000);

  const timeframe = normalizeTimeframeId(timeframeId);

  if (timeframe === '1m') return Math.floor(timeSeconds / 60) * 60;
  if (timeframe === '5m') return Math.floor(timeSeconds / 300) * 300;
  if (timeframe === '15m') return Math.floor(timeSeconds / 900) * 900;
  if (timeframe === '1h') return Math.floor(timeSeconds / 3600) * 3600;
  if (timeframe === '4h') return Math.floor(timeSeconds / 14400) * 14400;

  if (timeframe === '1D') {
    const date = new Date(timeSeconds * 1000);
    date.setUTCHours(0, 0, 0, 0);
    return Math.floor(date.getTime() / 1000);
  }

  if (timeframe === '1W' || timeframe === 'ALL') return getWeekBucketStart(timeSeconds);
  if (timeframe === '1M') return getMonthBucketStart(timeSeconds);
  if (timeframe === '1Y') return getYearBucketStart(timeSeconds);

  return Math.floor(timeSeconds / 86400) * 86400;
};

const aggregateBarsForTimeframe = (bars = [], timeframeId) => {
  if (!Array.isArray(bars) || bars.length === 0) return [];

  const timeframe = normalizeTimeframeId(timeframeId);
  const shouldAggregate = ['4h', '1M', '1Y', 'ALL'].includes(timeframe);
  if (!shouldAggregate) return bars;

  const buckets = new Map();

  bars.forEach((bar) => {
    const barTime = toNumber(bar?.time);
    const bucketTime = getBucketStartByTimeframe(barTime, timeframe);
    if (!Number.isFinite(bucketTime)) return;

    const open = toNumber(bar?.open);
    const high = toNumber(bar?.high);
    const low = toNumber(bar?.low);
    const close = toNumber(bar?.close);
    const volume = toNumber(bar?.volume) ?? 0;
    if (![open, high, low, close].every(Number.isFinite)) return;

    const current = buckets.get(bucketTime);
    if (!current) {
      buckets.set(bucketTime, {
        time: bucketTime,
        open,
        high,
        low,
        close,
        volume,
      });
      return;
    }

    current.high = Math.max(current.high, high);
    current.low = Math.min(current.low, low);
    current.close = close;
    current.volume = (toNumber(current.volume) ?? 0) + volume;
  });

  return [...buckets.values()].sort((a, b) => a.time - b.time);
};

const LightweightChart = forwardRef(function LightweightChart(
  { initialData = [], symbol = '', timeframe = FALLBACK_TIMEFRAME_ID, onCrosshairMove },
  ref
) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const lastBarRef = useRef(null);
  const symbolRef = useRef(symbol);
  const onCrosshairMoveRef = useRef(onCrosshairMove);
  const candlesByTimeRef = useRef(new Map());
  const historyRequestIdRef = useRef(0);
  const historyAbortRef = useRef(null);
  const timeframeRef = useRef(normalizeTimeframeId(timeframe));
  const resizeObserverRef = useRef(null);
  const previousCloseRef = useRef(null);

  const [legendBar, setLegendBar] = useState(null);
  const [lastPrice, setLastPrice] = useState(null);
  const [priceTone, setPriceTone] = useState('neutral');

  const normalizedData = useMemo(() => normalizeCandles(initialData), [initialData]);

  useEffect(() => {
    symbolRef.current = symbol;
  }, [symbol]);

  useEffect(() => {
    timeframeRef.current = normalizeTimeframeId(timeframe);
  }, [timeframe]);

  useEffect(() => {
    onCrosshairMoveRef.current = onCrosshairMove;
  }, [onCrosshairMove]);

  const applyCandlesData = useCallback((bars = [], shouldFit = true) => {
    const byTime = new Map();
    bars.forEach((bar) => {
      if (Number.isFinite(bar?.time)) byTime.set(bar.time, bar);
    });
    candlesByTimeRef.current = byTime;

    if (!candleSeriesRef.current) return;

    candleSeriesRef.current.setData(
      bars.map((bar) => ({
        time: bar.time,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      }))
    );

    volumeSeriesRef.current?.setData(
      bars.map((bar) => ({
        time: bar.time,
        value: Number.isFinite(bar.volume) ? bar.volume : 0,
        color: bar.close >= bar.open ? VOLUME_UP_COLOR : VOLUME_DOWN_COLOR,
      }))
    );

    setLegendBar(null);

    const latestBar = bars.length > 0 ? bars[bars.length - 1] : null;
    const previousBar = bars.length > 1 ? bars[bars.length - 2] : null;

    lastBarRef.current = latestBar;
    previousCloseRef.current = previousBar?.close ?? null;
    setLastPrice(latestBar?.close ?? null);
    setPriceTone(resolvePriceTone(latestBar?.close, previousBar?.close));

    if (shouldFit && bars.length > 0) {
      chartRef.current?.timeScale().fitContent();
    }
  }, []);

  const updateFromTick = useCallback((tick = {}) => {
    if (!candleSeriesRef.current) return null;

    const price = toNumber(tick?.price ?? tick?.close ?? tick?.last);
    if (!Number.isFinite(price)) return null;

    const tickSymbol = toSymbolKey(tick?.symbol);
    const activeSymbol = toSymbolKey(symbolRef.current);
    if (tickSymbol && activeSymbol && tickSymbol !== activeSymbol) return null;

    const tickTime = toUnixSeconds(tick?.time ?? tick?.timestamp ?? Date.now()) ?? Math.floor(Date.now() / 1000);
    const bucketTime = getBucketStartByTimeframe(tickTime, timeframeRef.current);
    const tickVolume = toNumber(tick?.volume);
    const previous = lastBarRef.current;

    if (previous && Number.isFinite(previous.time) && bucketTime < previous.time) return null;

    let nextBar;

    if (previous && Number.isFinite(previous.time) && bucketTime === previous.time) {
      nextBar = {
        ...previous,
        time: bucketTime,
        close: price,
        high: Math.max(previous.high, price),
        low: Math.min(previous.low, price),
        volume: Number.isFinite(tickVolume)
          ? (toNumber(previous.volume) ?? 0) + tickVolume
          : (toNumber(previous.volume) ?? 0),
      };
    } else if (previous && Number.isFinite(previous.time) && bucketTime > previous.time) {
      nextBar = {
        time: bucketTime,
        open: previous.close,
        high: price,
        low: price,
        close: price,
        volume: Number.isFinite(tickVolume) ? tickVolume : 0,
      };
    } else {
      nextBar = {
        time: bucketTime,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: Number.isFinite(tickVolume) ? tickVolume : 0,
      };
    }

    lastBarRef.current = nextBar;
    candlesByTimeRef.current.set(nextBar.time, nextBar);

    candleSeriesRef.current.update({
      time: nextBar.time,
      open: nextBar.open,
      high: nextBar.high,
      low: nextBar.low,
      close: nextBar.close,
    });

    volumeSeriesRef.current?.update({
      time: nextBar.time,
      value: Number.isFinite(nextBar.volume) ? nextBar.volume : 0,
      color: nextBar.close >= nextBar.open ? VOLUME_UP_COLOR : VOLUME_DOWN_COLOR,
    });

    const prevCloseForTone = previous?.close ?? previousCloseRef.current;
    setLastPrice(nextBar.close);
    setPriceTone(resolvePriceTone(nextBar.close, prevCloseForTone));

    return nextBar;
  }, []);

  useImperativeHandle(ref, () => ({
    updateFromTick,
    fitContent: () => {
      chartRef.current?.timeScale().fitContent();
    },
  }), [updateFromTick]);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const chart = createChart(containerRef.current, {
      width: Math.max(320, Math.floor(containerRef.current.clientWidth || 320)),
      height: Math.max(220, Math.floor(containerRef.current.clientHeight || 220)),
      layout: {
        background: { type: ColorType.Solid, color: '#0a0a0a' },
        textColor: '#ffffff',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.1)',
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.1)',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 4,
        barSpacing: 7,
      },
      crosshair: {
        vertLine: { color: 'rgba(255,255,255,0.22)', width: 1 },
        horzLine: { color: 'rgba(255,255,255,0.22)', width: 1 },
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: UP_COLOR,
      downColor: DOWN_COLOR,
      wickUpColor: UP_COLOR,
      wickDownColor: DOWN_COLOR,
      borderUpColor: UP_COLOR,
      borderDownColor: DOWN_COLOR,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
      borderVisible: false,
    });

    const handleCrosshairMove = (param) => {
      const callback = onCrosshairMoveRef.current;
      const bar = param?.seriesData?.get(candleSeries);

      if (!bar) {
        setLegendBar(null);
        if (typeof callback === 'function') callback(null);
        return;
      }

      const time = toUnixSeconds(param?.time ?? bar?.time);
      const cached = Number.isFinite(time) ? candlesByTimeRef.current.get(time) : null;
      const payload = {
        symbol: symbolRef.current,
        time,
        open: toNumber(bar?.open),
        high: toNumber(bar?.high),
        low: toNumber(bar?.low),
        close: toNumber(bar?.close),
        volume: toNumber(cached?.volume),
        point: param?.point || null,
      };

      setLegendBar(payload);
      if (typeof callback === 'function') callback(payload);
    };

    const handleResize = () => {
      if (!chartRef.current || !containerRef.current) return;
      const width = Math.max(320, Math.floor(containerRef.current.clientWidth || 320));
      const height = Math.max(220, Math.floor(containerRef.current.clientHeight || 220));
      chartRef.current.applyOptions({ width, height });
    };

    const observer = new ResizeObserver(() => {
      handleResize();
    });
    observer.observe(containerRef.current);
    resizeObserverRef.current = observer;
    window.addEventListener('resize', handleResize);

    chart.subscribeCrosshairMove(handleCrosshairMove);
    handleResize();

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      lastBarRef.current = null;
      previousCloseRef.current = null;
      candlesByTimeRef.current = new Map();
      setLegendBar(null);
      setLastPrice(null);
      setPriceTone('neutral');
    };
  }, []);

  useEffect(() => {
    if (!candleSeriesRef.current) return;
    applyCandlesData(normalizedData, true);
  }, [applyCandlesData, normalizedData, symbol]);

  useEffect(() => {
    const activeSymbol = toSymbolKey(symbol);
    if (!activeSymbol) return undefined;

    const requestId = historyRequestIdRef.current + 1;
    historyRequestIdRef.current = requestId;

    historyAbortRef.current?.abort();
    const controller = new AbortController();
    historyAbortRef.current = controller;

    const loadHistory = async () => {
      try {
        const config = resolveTimeframeConfig(timeframeRef.current);
        const params = new URLSearchParams({
          symbol: activeSymbol,
          timeframe: config?.apiTimeframe || DEFAULT_HISTORY_TIMEFRAME,
          limit: config?.limit || DEFAULT_HISTORY_LIMIT,
        });

        const response = await fetch(`${getApiUrl('bars')}?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => []);

        if (controller.signal.aborted || requestId !== historyRequestIdRef.current) return;
        if (!response.ok || !Array.isArray(payload)) return;

        const historyBars = aggregateBarsForTimeframe(normalizeCandles(payload), timeframeRef.current);
        if (historyBars.length === 0) return;
        applyCandlesData(historyBars, true);
      } catch (error) {
        if (controller.signal.aborted) return;
      }
    };

    void loadHistory();

    return () => {
      controller.abort();
    };
  }, [applyCandlesData, symbol, timeframe]);

  useEffect(() => {
    return () => {
      historyAbortRef.current?.abort();
    };
  }, []);

  const priceToneClass = priceTone === 'up'
    ? 'text-[#26a69a]'
    : priceTone === 'down'
      ? 'text-[#ef5350]'
      : 'text-white';

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[#0a0a0a]">
      <div className="flex items-center justify-between border-b border-[#1f1f1f] bg-[#0a0a0a] px-3 py-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">
          {symbol || '--'}
        </div>
        <div className={`text-sm font-semibold tabular-nums ${priceToneClass}`}>
          {lastPrice === null ? '--' : `$${formatPrice(lastPrice)}`}
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="h-full w-full" />

        {legendBar && (
          <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-white/10 bg-black/60 px-2.5 py-2 backdrop-blur-sm">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-300">
              {legendBar.symbol || symbol || '--'}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium tabular-nums text-gray-200">
              <span>O {formatPrice(legendBar.open)}</span>
              <span>H {formatPrice(legendBar.high)}</span>
              <span>L {formatPrice(legendBar.low)}</span>
              <span className={toNumber(legendBar.close) >= toNumber(legendBar.open) ? 'text-[#26a69a]' : 'text-[#ef5350]'}>
                C {formatPrice(legendBar.close)}
              </span>
              <span className="text-gray-300">V {formatVolume(legendBar.volume)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

LightweightChart.displayName = 'LightweightChart';

export default LightweightChart;
