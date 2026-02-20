import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries as VolumeSeries,
  ColorType,
  CrosshairMode,
} from 'lightweight-charts';

const TWELVE_DATA_REST_URL = 'https://api.twelvedata.com/time_series';
const TWELVE_DATA_WS_URL = 'wss://ws.twelvedata.com/v1/quotes/price';

const GRID_COLOR = '#1a2332';
const TEXT_COLOR = '#8892a0';
const UP_COLOR = '#22c55e';
const DOWN_COLOR = '#ef4444';
const VOLUME_UP = 'rgba(34, 197, 94, 0.35)';
const VOLUME_DOWN = 'rgba(239, 68, 68, 0.35)';

const INTERVAL_OPTIONS = [
  { label: '1m', value: '1min' },
  { label: '5m', value: '5min' },
  { label: '15m', value: '15min' },
  { label: '1h', value: '1h' },
  { label: '1D', value: '1day' },
];

const INTERVAL_SECONDS = {
  '1min': 60,
  '5min': 300,
  '15min': 900,
  '1h': 3600,
  '1day': 86400,
};

const normalizeSymbol = (value) => String(value || '').trim().toUpperCase();

const normalizeInterval = (value) => {
  const raw = String(value || '1day').trim().toLowerCase();
  if (raw === '1m' || raw === '1min' || raw === '1minute') return '1min';
  if (raw === '5m' || raw === '5min' || raw === '5minute') return '5min';
  if (raw === '15m' || raw === '15min' || raw === '15minute') return '15min';
  if (raw === '1h' || raw === '60m' || raw === '1hour') return '1h';
  if (raw === '1d' || raw === '1day') return '1day';
  return '1day';
};

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toUnixSeconds = (value) => {
  if (value == null) return null;
  if (typeof value === 'number') {
    if (value > 1e12) return Math.floor(value / 1000);
    if (value > 1e10) return Math.floor(value / 1000);
    return Math.floor(value);
  }
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) {
    return toUnixSeconds(Number(text));
  }
  const normalized = text.includes('T') ? text : text.replace(' ', 'T');
  let ts = Date.parse(normalized);
  if (!Number.isFinite(ts)) ts = Date.parse(`${normalized}Z`);
  if (!Number.isFinite(ts)) return null;
  return Math.floor(ts / 1000);
};

const chartTimeToUnix = (time) => {
  if (typeof time === 'number') return Math.floor(time);
  if (typeof time === 'string') return toUnixSeconds(time);
  if (time && typeof time === 'object' && 'year' in time && 'month' in time && 'day' in time) {
    return Math.floor(Date.UTC(time.year, time.month - 1, time.day) / 1000);
  }
  return null;
};

const formatPrice = (value) => {
  if (!Number.isFinite(value)) return '--';
  if (Math.abs(value) >= 1) {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return value.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
};

const formatVolume = (value) => {
  if (!Number.isFinite(value)) return '--';
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return `${Math.round(value)}`;
};

const formatOverlayTime = (seconds, interval) => {
  if (!Number.isFinite(seconds)) return '--';
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return '--';
  if (interval === '1day') {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  }
  return date.toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const formatTimeTick = (time, interval) => {
  const seconds = chartTimeToUnix(time);
  if (!Number.isFinite(seconds)) return '';
  const date = new Date(seconds * 1000);
  if (interval === '1day') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const toBar = (value, previousClose) => {
  const close = toNumber(value?.close);
  const time = toUnixSeconds(value?.datetime ?? value?.timestamp ?? value?.time);
  if (!Number.isFinite(close) || !Number.isFinite(time)) return null;

  const openValue = toNumber(value?.open);
  const highValue = toNumber(value?.high);
  const lowValue = toNumber(value?.low);
  const volumeValue = toNumber(value?.volume) ?? 0;

  const open = Number.isFinite(openValue) ? openValue : Number.isFinite(previousClose) ? previousClose : close;
  const high = Number.isFinite(highValue) ? highValue : Math.max(open, close);
  const low = Number.isFinite(lowValue) ? lowValue : Math.min(open, close);

  return {
    time,
    open,
    high,
    low,
    close,
    volume: volumeValue,
  };
};

const normalizeBars = (rawValues) => {
  const values = Array.isArray(rawValues) ? rawValues : [];
  let previousClose = null;
  const parsed = values
    .map((entry) => {
      const bar = toBar(entry, previousClose);
      if (bar) previousClose = bar.close;
      return bar;
    })
    .filter(Boolean)
    .sort((a, b) => a.time - b.time);

  const deduped = [];
  parsed.forEach((bar) => {
    const latest = deduped[deduped.length - 1];
    if (latest && latest.time === bar.time) {
      deduped[deduped.length - 1] = bar;
      return;
    }
    deduped.push(bar);
  });

  return deduped;
};

const resolveApiKey = () =>
  import.meta.env.VITE_TWELVE_DATA_API_KEY ||
  import.meta.env.VITE_TWELVE_DATA_APIKEY ||
  import.meta.env.VITE_TWELVEDATA_API_KEY ||
  '';

const isMatchingSymbol = (messageSymbol, currentSymbol) => {
  const message = normalizeSymbol(messageSymbol);
  const current = normalizeSymbol(currentSymbol);
  if (!message || !current) return false;
  if (message === current) return true;
  return message.split(':')[0] === current.split(':')[0];
};

export default function LiveChart({ symbol = 'AAPL', interval = '1day', onSymbolChange }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const latestBarRef = useRef(null);
  const wsRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const activeIntervalRef = useRef(normalizeInterval(interval));
  const requestIdRef = useRef(0);

  const [chartReady, setChartReady] = useState(false);
  const [symbolInput, setSymbolInput] = useState(normalizeSymbol(symbol));
  const [internalSymbol, setInternalSymbol] = useState(normalizeSymbol(symbol) || 'AAPL');
  const [activeInterval, setActiveInterval] = useState(() => normalizeInterval(interval));
  const [latestBar, setLatestBar] = useState(null);
  const [hoverBar, setHoverBar] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: '' });

  const apiKey = useMemo(resolveApiKey, []);
  const activeSymbol = useMemo(() => normalizeSymbol(symbol || internalSymbol), [symbol, internalSymbol]);
  const displayedBar = hoverBar || latestBar;

  useEffect(() => {
    const next = normalizeSymbol(symbol);
    if (next) {
      setInternalSymbol(next);
      setSymbolInput(next);
    }
  }, [symbol]);

  useEffect(() => {
    const normalized = normalizeInterval(interval);
    setActiveInterval(normalized);
  }, [interval]);

  useEffect(() => {
    activeIntervalRef.current = activeInterval;
    if (chartRef.current) {
      chartRef.current.timeScale().applyOptions({
        timeVisible: activeInterval !== '1day',
        secondsVisible: false,
      });
    }
  }, [activeInterval]);

  const applyLiveTick = useCallback((price, timestampSeconds) => {
    if (!Number.isFinite(price) || !candleSeriesRef.current || !volumeSeriesRef.current) return;
    const intervalSeconds = INTERVAL_SECONDS[activeIntervalRef.current] || 60;
    const bucket = Math.floor(timestampSeconds / intervalSeconds) * intervalSeconds;
    const last = latestBarRef.current;
    let nextBar = null;

    if (!last || bucket > last.time) {
      nextBar = {
        time: bucket,
        open: last?.close ?? price,
        high: price,
        low: price,
        close: price,
        volume: 0,
      };
    } else if (bucket === last.time) {
      nextBar = {
        ...last,
        close: price,
        high: Math.max(last.high, price),
        low: Math.min(last.low, price),
      };
    }

    if (!nextBar) return;
    latestBarRef.current = nextBar;
    candleSeriesRef.current.update({
      time: nextBar.time,
      open: nextBar.open,
      high: nextBar.high,
      low: nextBar.low,
      close: nextBar.close,
    });
    volumeSeriesRef.current.update({
      time: nextBar.time,
      value: nextBar.volume ?? 0,
      color: nextBar.close >= nextBar.open ? VOLUME_UP : VOLUME_DOWN,
    });
    setLatestBar(nextBar);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const chart = createChart(containerRef.current, {
      width: Math.max(320, containerRef.current.clientWidth || 0),
      height: Math.max(240, containerRef.current.clientHeight || 0),
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: TEXT_COLOR,
      },
      grid: {
        vertLines: { color: GRID_COLOR },
        horzLines: { color: GRID_COLOR },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(136,146,160,0.35)' },
        horzLine: { color: 'rgba(136,146,160,0.35)' },
      },
      rightPriceScale: {
        borderColor: GRID_COLOR,
        scaleMargins: { top: 0.05, bottom: 0.32 },
      },
      timeScale: {
        borderColor: GRID_COLOR,
        timeVisible: activeIntervalRef.current !== '1day',
        secondsVisible: false,
        rightOffset: 4,
        barSpacing: 8,
        tickMarkFormatter: (time) => formatTimeTick(time, activeIntervalRef.current),
      },
      localization: {
        locale: 'en-US',
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: UP_COLOR,
      downColor: DOWN_COLOR,
      wickUpColor: UP_COLOR,
      wickDownColor: DOWN_COLOR,
      borderUpColor: UP_COLOR,
      borderDownColor: DOWN_COLOR,
      priceLineVisible: true,
    });

    const volumeSeries = chart.addSeries(VolumeSeries, {
      priceScaleId: 'volume',
      priceFormat: { type: 'volume' },
      lastValueVisible: false,
      priceLineVisible: false,
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.72, bottom: 0 },
      borderVisible: false,
    });

    const crosshairHandler = (param) => {
      if (!param?.time || !param?.seriesData) {
        setHoverBar(null);
        return;
      }

      const candlePoint = param.seriesData.get(candleSeries);
      if (!candlePoint) {
        setHoverBar(null);
        return;
      }

      const volumePoint = param.seriesData.get(volumeSeries);
      setHoverBar({
        time: chartTimeToUnix(candlePoint.time ?? param.time),
        open: toNumber(candlePoint.open),
        high: toNumber(candlePoint.high),
        low: toNumber(candlePoint.low),
        close: toNumber(candlePoint.close),
        volume: toNumber(volumePoint?.value) ?? toNumber(latestBarRef.current?.volume),
      });
    };

    chart.subscribeCrosshairMove(crosshairHandler);
    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = Math.max(320, Math.floor(entry.contentRect.width));
      const height = Math.max(240, Math.floor(entry.contentRect.height));
      chart.applyOptions({ width, height });
    });
    resizeObserver.observe(containerRef.current);
    resizeObserverRef.current = resizeObserver;

    setChartReady(true);

    return () => {
      setChartReady(false);
      chart.unsubscribeCrosshairMove(crosshairHandler);
      resizeObserver.disconnect();
      resizeObserverRef.current = null;
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!chartReady || !activeSymbol) return undefined;

    let cancelled = false;
    let ws = null;
    const requestId = ++requestIdRef.current;

    const closeSocket = () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            action: 'unsubscribe',
            params: { symbols: activeSymbol },
          })
        );
      }
      if (ws) ws.close();
      if (wsRef.current === ws) wsRef.current = null;
      ws = null;
    };

    const loadHistoricalData = async () => {
      setStatus({ loading: true, error: '' });
      setHoverBar(null);

      if (!apiKey) {
        latestBarRef.current = null;
        setLatestBar(null);
        candleSeriesRef.current?.setData([]);
        volumeSeriesRef.current?.setData([]);
        setStatus({ loading: false, error: 'Missing Twelve Data API key.' });
        return false;
      }

      try {
        const url = new URL(TWELVE_DATA_REST_URL);
        url.searchParams.set('symbol', activeSymbol);
        url.searchParams.set('interval', activeInterval);
        url.searchParams.set('outputsize', '500');
        url.searchParams.set('apikey', apiKey);
        url.searchParams.set('format', 'JSON');
        url.searchParams.set('order', 'ASC');

        const response = await fetch(url.toString(), { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok || payload?.status === 'error') {
          throw new Error(payload?.message || payload?.error || 'Failed to load historical candles');
        }

        const bars = normalizeBars(payload?.values);
        if (cancelled || requestId !== requestIdRef.current) return false;

        candleSeriesRef.current?.setData(
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
            value: bar.volume ?? 0,
            color: bar.close >= bar.open ? VOLUME_UP : VOLUME_DOWN,
          }))
        );

        latestBarRef.current = bars.length > 0 ? { ...bars[bars.length - 1] } : null;
        setLatestBar(latestBarRef.current);
        chartRef.current?.timeScale().fitContent();
        setStatus({ loading: false, error: '' });
        return true;
      } catch (error) {
        if (cancelled || requestId !== requestIdRef.current) return false;
        latestBarRef.current = null;
        setLatestBar(null);
        candleSeriesRef.current?.setData([]);
        volumeSeriesRef.current?.setData([]);
        setStatus({ loading: false, error: error?.message || 'Failed to load historical candles' });
        return false;
      }
    };

    const startWebSocket = () => {
      const socketUrl = `${TWELVE_DATA_WS_URL}?apikey=${encodeURIComponent(apiKey)}`;
      ws = new WebSocket(socketUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        ws.send(
          JSON.stringify({
            action: 'subscribe',
            params: { symbols: activeSymbol },
          })
        );
      };

      ws.onmessage = (event) => {
        if (cancelled) return;

        let payload;
        try {
          payload = JSON.parse(event.data || '{}');
        } catch {
          return;
        }

        const handlePayload = (entry) => {
          if (!entry || typeof entry !== 'object') return;
          if (entry.event && entry.event !== 'price') return;
          if (!isMatchingSymbol(entry.symbol, activeSymbol)) return;

          const price = toNumber(entry.price ?? entry.close ?? entry.last);
          if (!Number.isFinite(price)) return;
          const timestamp = toUnixSeconds(entry.timestamp ?? entry.datetime ?? entry.time) ?? Math.floor(Date.now() / 1000);
          applyLiveTick(price, timestamp);
        };

        if (Array.isArray(payload)) {
          payload.forEach(handlePayload);
          return;
        }
        handlePayload(payload);
      };
    };

    loadHistoricalData().then((ok) => {
      if (!ok || cancelled || requestId !== requestIdRef.current) return;
      startWebSocket();
    });

    return () => {
      cancelled = true;
      closeSocket();
    };
  }, [activeInterval, activeSymbol, apiKey, applyLiveTick, chartReady]);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const submitSymbol = useCallback(() => {
    const next = normalizeSymbol(symbolInput);
    if (!next) return;
    if (typeof onSymbolChange === 'function') {
      onSymbolChange(next);
    } else {
      setInternalSymbol(next);
    }
  }, [onSymbolChange, symbolInput]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute left-3 top-2 z-20 flex flex-wrap items-center gap-2 text-[11px] font-mono">
        <span className="text-white/75">{activeSymbol || '--'}</span>
        <span className="text-white/45">O <span className="text-white/70">{formatPrice(displayedBar?.open)}</span></span>
        <span className="text-white/45">H <span className="text-emerald-400/80">{formatPrice(displayedBar?.high)}</span></span>
        <span className="text-white/45">L <span className="text-red-400/80">{formatPrice(displayedBar?.low)}</span></span>
        <span className="text-white/45">C <span className="text-white/70">{formatPrice(displayedBar?.close)}</span></span>
        <span className="text-white/45">V <span className="text-white/60">{formatVolume(displayedBar?.volume)}</span></span>
        <span className="text-white/30">{formatOverlayTime(displayedBar?.time, activeInterval)}</span>
      </div>

      <div className="absolute right-3 top-2 z-20 flex items-center gap-2">
        <input
          type="text"
          value={symbolInput}
          onChange={(event) => setSymbolInput(normalizeSymbol(event.target.value))}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submitSymbol();
          }}
          placeholder="Symbol"
          className="h-8 w-36 rounded-md border border-[#1a2332] bg-black/30 px-2 text-xs text-white outline-none placeholder:text-gray-500 focus:border-emerald-500/70"
        />
        <button
          type="button"
          onClick={submitSymbol}
          className="h-8 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 text-xs font-semibold text-emerald-300 transition-colors hover:border-emerald-400 hover:text-emerald-200"
        >
          Go
        </button>
      </div>

      <div ref={containerRef} className="h-full w-full" />

      <div className="pointer-events-none absolute inset-x-0 bottom-9 z-10 flex justify-center">
        {status.loading && <div className="rounded bg-black/55 px-2 py-1 text-[11px] text-gray-300">Loading candles...</div>}
        {!status.loading && status.error && (
          <div className="rounded bg-red-900/35 px-2 py-1 text-[11px] text-red-200">{status.error}</div>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-1 border-t border-[#1a2332] bg-black/20 px-2 py-2 backdrop-blur-sm">
        {INTERVAL_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setActiveInterval(option.value)}
            className={`rounded-md px-3 py-1 text-[11px] font-semibold transition-colors ${
              activeInterval === option.value
                ? 'border border-emerald-500/55 bg-emerald-500/15 text-emerald-300'
                : 'border border-transparent text-gray-500 hover:bg-white/5 hover:text-white'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
