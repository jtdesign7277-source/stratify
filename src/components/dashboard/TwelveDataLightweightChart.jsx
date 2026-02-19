import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
} from 'lightweight-charts';

const UP_COLOR = '#22c55e';
const DOWN_COLOR = '#ef4444';
const VOLUME_UP = 'rgba(34, 197, 94, 0.3)';
const VOLUME_DOWN = 'rgba(239, 68, 68, 0.3)';

const TIMEFRAME_TO_INTERVAL = {
  '1Min': '1min',
  '5Min': '5min',
  '15Min': '15min',
  '1Hour': '1h',
  '1Day': '1day',
  '1Week': '1week',
  '1m': '1min',
  '5m': '5min',
  '15m': '15min',
  '1H': '1h',
  '1D': '1day',
  '1W': '1week',
};

const INTERVAL_SECONDS = {
  '1min': 60,
  '5min': 300,
  '15min': 900,
  '1h': 3600,
  '1day': 86400,
  '1week': 604800,
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toUnix = (value) => {
  if (!value) return null;
  const normalized = String(value).includes('T') ? String(value) : String(value).replace(' ', 'T');
  const ts = Date.parse(normalized);
  if (!Number.isFinite(ts)) return null;
  return Math.floor(ts / 1000);
};

const toBar = (item, previousClose = null) => {
  const close = toNumber(item?.close);
  if (!Number.isFinite(close)) return null;
  const open = toNumber(item?.open);
  const high = toNumber(item?.high);
  const low = toNumber(item?.low);
  const volume = toNumber(item?.volume) ?? 0;
  const time = toUnix(item?.datetime || item?.time || item?.timestamp);
  if (!Number.isFinite(time)) return null;

  const resolvedOpen = Number.isFinite(open) ? open : (Number.isFinite(previousClose) ? previousClose : close);
  const resolvedHigh = Number.isFinite(high) ? high : Math.max(resolvedOpen, close);
  const resolvedLow = Number.isFinite(low) ? low : Math.min(resolvedOpen, close);

  return {
    time,
    open: resolvedOpen,
    high: resolvedHigh,
    low: resolvedLow,
    close,
    volume,
  };
};

const formatInterval = (timeframe) => TIMEFRAME_TO_INTERVAL[timeframe] || '1day';

const TwelveDataLightweightChart = ({ symbol, timeframe = '1Day', interval, height = '100%' }) => {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleRef = useRef(null);
  const volumeRef = useRef(null);
  const lastBarRef = useRef(null);
  const timeframeRef = useRef(formatInterval(interval || timeframe));
  const [status, setStatus] = useState({ loading: true, error: null });

  useEffect(() => {
    timeframeRef.current = formatInterval(interval || timeframe);
  }, [interval, timeframe]);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#060d18' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.03)' },
      },
      crosshair: {
        vertLine: { color: 'rgba(255,255,255,0.15)', width: 1 },
        horzLine: { color: 'rgba(255,255,255,0.15)', width: 1 },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.08, bottom: 0.2 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 5,
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
    });

    chartRef.current = chart;
    candleRef.current = candleSeries;
    volumeRef.current = volumeSeries;

    return () => {
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadBars = async () => {
      if (!symbol) {
        setStatus({ loading: false, error: 'Select a symbol to load chart data.' });
        candleRef.current?.setData([]);
        volumeRef.current?.setData([]);
        return;
      }

      setStatus({ loading: true, error: null });
      try {
        const tf = formatInterval(interval || timeframe);
        const params = new URLSearchParams({
          symbol,
          interval: tf,
          outputsize: '320',
        });
        const response = await fetch(`/api/lse/timeseries?${params.toString()}`, {
          cache: 'no-store',
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to load LSE bars');
        }

        const values = Array.isArray(payload?.values) ? payload.values : [];
        let previousClose = null;
        const parsedBars = values
          .map((item) => {
            const bar = toBar(item, previousClose);
            if (bar) previousClose = bar.close;
            return bar;
          })
          .filter(Boolean);

        if (cancelled) return;

        if (parsedBars.length === 0) {
          candleRef.current?.setData([]);
          volumeRef.current?.setData([]);
          chartRef.current?.timeScale().fitContent();
          lastBarRef.current = null;
          setStatus({ loading: false, error: 'No data available.' });
          return;
        }

        const candles = parsedBars.map((bar) => ({
          time: bar.time,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
        }));
        const volumes = parsedBars.map((bar) => ({
          time: bar.time,
          value: bar.volume || 0,
          color: bar.close >= bar.open ? VOLUME_UP : VOLUME_DOWN,
        }));

        candleRef.current?.setData(candles);
        volumeRef.current?.setData(volumes);
        chartRef.current?.timeScale().fitContent();
        lastBarRef.current = { ...parsedBars[parsedBars.length - 1] };
        setStatus({ loading: false, error: null });
      } catch (error) {
        if (cancelled) return;
        setStatus({ loading: false, error: error?.message || 'Failed to load LSE bars' });
      }
    };

    loadBars();

    return () => {
      cancelled = true;
    };
  }, [symbol, interval, timeframe]);

  useEffect(() => {
    if (!symbol) return undefined;

    let cancelled = false;

    const pollLatest = async () => {
      if (!lastBarRef.current) return;

      try {
        const response = await fetch(`/api/lse/quotes?symbols=${encodeURIComponent(symbol)}`, {
          cache: 'no-store',
        });
        const payload = await response.json();
        if (!response.ok || cancelled) return;

        const latest = Array.isArray(payload?.data) ? payload.data[0] : null;
        const price = toNumber(latest?.price);
        if (!Number.isFinite(price)) return;

        const tf = timeframeRef.current;
        const tfSeconds = INTERVAL_SECONDS[tf] || 60;
        const now = Math.floor(Date.now() / 1000);
        const currentBarTime = Math.floor(now / tfSeconds) * tfSeconds;
        const lastBar = lastBarRef.current;

        if (currentBarTime > lastBar.time) {
          const newBar = {
            time: currentBarTime,
            open: price,
            high: price,
            low: price,
            close: price,
            volume: 0,
          };
          lastBarRef.current = newBar;

          candleRef.current?.update({
            time: newBar.time,
            open: newBar.open,
            high: newBar.high,
            low: newBar.low,
            close: newBar.close,
          });
          volumeRef.current?.update({
            time: newBar.time,
            value: 0,
            color: VOLUME_UP,
          });
          return;
        }

        const updated = {
          ...lastBar,
          close: price,
          high: Math.max(lastBar.high, price),
          low: Math.min(lastBar.low, price),
        };
        lastBarRef.current = updated;

        candleRef.current?.update({
          time: updated.time,
          open: updated.open,
          high: updated.high,
          low: updated.low,
          close: updated.close,
        });
      } catch {
        // Keep UI stable on transient quote failures.
      }
    };

    const timer = setInterval(pollLatest, 15000);
    pollLatest();
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [symbol]);

  return (
    <div className="relative h-full w-full bg-[#060d18]" style={{ height }}>
      <div ref={containerRef} className="h-full w-full" />
      {status.loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#060d18]/55 text-sm text-gray-400">
          Loading LSE chart...
        </div>
      )}
      {status.error && !status.loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#060d18]/65 text-sm text-gray-500">
          {status.error}
        </div>
      )}
    </div>
  );
};

export default TwelveDataLightweightChart;
