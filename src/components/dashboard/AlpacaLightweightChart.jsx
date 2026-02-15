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
const INTRADAY_TIMEFRAMES = new Set(['1Min', '5Min', '15Min', '1Hour']);
const INTRADAY_LOOKBACK_DAYS = 21;
const YEARS_LOOKBACK = 2;

const getStartForInterval = (timeframe) => {
  const now = new Date();

  if (INTRADAY_TIMEFRAMES.has(timeframe)) {
    const start = new Date(now);
    start.setDate(start.getDate() - INTRADAY_LOOKBACK_DAYS);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  const start = new Date(now);
  start.setFullYear(start.getFullYear() - YEARS_LOOKBACK);
  start.setHours(0, 0, 0, 0);
  return start;
};

class ChartErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Avoid taking down the whole app when charts fail to initialize.
    console.error('Lightweight chart error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="relative h-full w-full bg-[#060d18]">
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500 bg-[#060d18]/80">
            Chart failed to load.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const AlpacaLightweightChartInner = ({ symbol, interval = '1Day' }) => {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const lastBarRef = useRef(null);
  const [status, setStatus] = useState({ loading: true, error: null });

  useEffect(() => {
    if (!containerRef.current) return undefined;

    try {
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
      candleSeriesRef.current = candleSeries;
      volumeSeriesRef.current = volumeSeries;

      return () => {
        chart.remove();
        chartRef.current = null;
        candleSeriesRef.current = null;
        volumeSeriesRef.current = null;
      };
    } catch (err) {
      console.error('Failed to initialize lightweight chart:', err);
      setStatus({
        loading: false,
        error: err?.message || 'Failed to initialize chart',
      });
      return undefined;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadBars = async () => {
      if (!symbol) {
        setStatus({ loading: false, error: 'Select a symbol to load chart data.' });
        candleSeriesRef.current?.setData([]);
        volumeSeriesRef.current?.setData([]);
        return;
      }

      setStatus({ loading: true, error: null });
      lastBarRef.current = null;

      try {
        const start = getStartForInterval(interval);
        const end = new Date();
        const params = new URLSearchParams({
          symbol,
          timeframe: interval,
          limit: '2000',
          start: start.toISOString(),
          end: end.toISOString(),
        });

        const response = await fetch(`/api/bars?${params.toString()}`);
        const data = await response.json();
        console.log('Bars API response', { symbol, interval, data });

        if (!response.ok) {
          throw new Error(data?.error || 'Failed to load bars');
        }
        if (!Array.isArray(data)) {
          throw new Error('Unexpected response from bars endpoint');
        }

        if (cancelled) return;

        if (data.length === 0) {
          candleSeriesRef.current?.setData([]);
          volumeSeriesRef.current?.setData([]);
          chartRef.current?.timeScale().fitContent();
          lastBarRef.current = null;
          setStatus({ loading: false, error: 'No data available.' });
          return;
        }

        const candleData = data.map((bar) => ({
          time: bar.time,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
        }));

        const volumeData = data.map((bar) => ({
          time: bar.time,
          value: bar.volume ?? 0,
          color: bar.close >= bar.open ? VOLUME_UP : VOLUME_DOWN,
        }));

        candleSeriesRef.current?.setData(candleData);
        volumeSeriesRef.current?.setData(volumeData);
        chartRef.current?.timeScale().fitContent();

        lastBarRef.current = data.length ? { ...data[data.length - 1] } : null;

        setStatus({
          loading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setStatus({
          loading: false,
          error: err?.message || 'Failed to load bars',
        });
      }
    };

    loadBars();

    return () => {
      cancelled = true;
    };
  }, [symbol, interval]);

  useEffect(() => {
    if (!symbol) return undefined;

    let cancelled = false;

    const pollLatest = async () => {
      if (!lastBarRef.current) return;

      try {
        const response = await fetch(`/api/latest-quote?symbol=${encodeURIComponent(symbol)}`);
        const data = await response.json();

        if (!response.ok || cancelled) return;

        const price = Number.isFinite(data?.price)
          ? data.price
          : Number.isFinite(data?.ask)
            ? data.ask
            : data?.bid;

        if (!Number.isFinite(price)) return;

        const lastBar = lastBarRef.current;
        const updatedBar = {
          ...lastBar,
          close: price,
          high: Math.max(lastBar.high, price),
          low: Math.min(lastBar.low, price),
        };

        lastBarRef.current = updatedBar;

        candleSeriesRef.current?.update({
          time: updatedBar.time,
          open: updatedBar.open,
          high: updatedBar.high,
          low: updatedBar.low,
          close: updatedBar.close,
        });

        volumeSeriesRef.current?.update({
          time: updatedBar.time,
          value: updatedBar.volume ?? 0,
          color: updatedBar.close >= updatedBar.open ? VOLUME_UP : VOLUME_DOWN,
        });
      } catch (err) {
        // Silent fail for quote polling
      }
    };

    const intervalId = setInterval(pollLatest, 5000);
    pollLatest();

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [symbol, interval]);

  return (
    <div className="relative h-full w-full bg-[#060d18]">
      <div ref={containerRef} className="absolute inset-0" />
      {status.loading && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400 bg-[#060d18]/80">
          Loading chart data...
        </div>
      )}
      {!status.loading && status.error && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500 bg-[#060d18]/80">
          {status.error}
        </div>
      )}
    </div>
  );
};

const AlpacaLightweightChart = (props) => (
  <ChartErrorBoundary>
    <AlpacaLightweightChartInner {...props} />
  </ChartErrorBoundary>
);

export default AlpacaLightweightChart;
