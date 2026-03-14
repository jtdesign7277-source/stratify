import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries as VolumeSeries,
  ColorType,
  CrosshairMode,
} from 'lightweight-charts';

const CHART_CANDLES_URL = '/api/chart/candles';
const WS_CONFIG_URL = '/api/lse/ws-config';

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

const CHART_STATE_KEY = 'stratify-livechart-state';

const saveChartState = (symbol, state) => {
  try {
    const all = JSON.parse(sessionStorage.getItem(CHART_STATE_KEY) || '{}');
    all[normalizeSymbol(symbol)] = { ...state, savedAt: Date.now() };
    sessionStorage.setItem(CHART_STATE_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
};

const loadChartState = (symbol) => {
  try {
    const all = JSON.parse(sessionStorage.getItem(CHART_STATE_KEY) || '{}');
    return all[normalizeSymbol(symbol)] || null;
  } catch { return null; }
};

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
  const savedVisibleRangeRef = useRef(null);
  const requestIdRef = useRef(0);
  const isFirstLoadRef = useRef(true);

  // Restore interval from session state if available
  const initialState = loadChartState(symbol);
  const activeIntervalRef = useRef(initialState?.interval || normalizeInterval(interval));

  const [chartReady, setChartReady] = useState(false);
  const [symbolInput, setSymbolInput] = useState(normalizeSymbol(symbol));
  const [internalSymbol, setInternalSymbol] = useState(normalizeSymbol(symbol) || 'AAPL');
  const [activeInterval, setActiveInterval] = useState(() => initialState?.interval || normalizeInterval(interval));
  const [latestBar, setLatestBar] = useState(null);
  const [hoverBar, setHoverBar] = useState(null);
  const [status, setStatus] = useState({ loading: true, error: '' });

  // Load saved visible range for restoration after data load
  useEffect(() => {
    const saved = loadChartState(symbol);
    if (saved?.visibleRange) {
      savedVisibleRangeRef.current = saved.visibleRange;
    }
  }, []);

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
    // Persist interval to session storage
    saveChartState(activeSymbol, { interval: activeInterval });
  }, [activeInterval, activeSymbol]);

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

      try {
        const url = new URL(CHART_CANDLES_URL, window.location.origin);
        url.searchParams.set('symbol', activeSymbol);
        url.searchParams.set('interval', activeInterval);
        url.searchParams.set('outputsize', '500');

        const response = await fetch(url.toString(), { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to load historical candles');
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
        
        // Restore saved visible range on first load, otherwise fit content
        const savedRange = savedVisibleRangeRef.current;
        if (isFirstLoadRef.current && savedRange && savedRange.from && savedRange.to) {
          try {
            chartRef.current?.timeScale().setVisibleRange(savedRange);
          } catch {
            chartRef.current?.timeScale().fitContent();
          }
          savedVisibleRangeRef.current = null;
          isFirstLoadRef.current = false;
        } else {
          chartRef.current?.timeScale().fitContent();
          isFirstLoadRef.current = false;
        }
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

    const startWebSocket = async () => {
      if (cancelled) return;
      let socketUrl;
      try {
        const wsConfigRes = await fetch(WS_CONFIG_URL, { cache: 'no-store' });
        const wsConfig = await wsConfigRes.json();
        socketUrl = wsConfig?.websocketUrl;
        if (!socketUrl) throw new Error('No WebSocket URL');
      } catch {
        if (!cancelled) setStatus({ loading: false, error: 'Failed to connect live feed' });
        return;
      }
      if (cancelled) return;
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
  }, [activeInterval, activeSymbol, applyLiveTick, chartReady]);

  // Save chart state (visible range + interval) on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      // Persist visible range before unmount
      try {
        const range = chartRef.current?.timeScale().getVisibleRange();
        if (range) {
          saveChartState(activeSymbol, {
            interval: activeIntervalRef.current,
            visibleRange: range,
          });
        }
      } catch { /* ignore */ }
    };
  }, [activeSymbol]);

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
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.2)] [box-shadow:0_8px_32px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.05)]">
      {/* Top bar: symbol, interval buttons, OHLCV data */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between border-b border-white/[0.06] bg-gradient-to-r from-white/[0.04] to-white/[0.02] px-3 py-1.5 backdrop-blur-xl shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono min-w-0">
          <span className="text-white/75 font-semibold shrink-0">{activeSymbol || '--'}</span>

          {/* Interval buttons */}
          <div className="flex items-center gap-0.5 shrink-0">
            {INTERVAL_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setActiveInterval(option.value)}
                className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold transition-all duration-300 ${
                  activeInterval === option.value
                    ? 'bg-emerald-500/15 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.15),inset_0_1px_0_rgba(255,255,255,0.05)] border border-emerald-500/20'
                    : 'text-gray-500 hover:bg-white/[0.06] hover:text-white hover:shadow-[0_2px_8px_rgba(0,0,0,0.3)] border border-transparent'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* OHLCV overlay */}
          <span className="text-white/45 shrink-0">O <span className="text-white/70">{formatPrice(displayedBar?.open)}</span></span>
          <span className="text-white/45 shrink-0">H <span className="text-emerald-400/80">{formatPrice(displayedBar?.high)}</span></span>
          <span className="text-white/45 shrink-0">L <span className="text-red-400/80">{formatPrice(displayedBar?.low)}</span></span>
          <span className="text-white/45 shrink-0">C <span className="text-white/70">{formatPrice(displayedBar?.close)}</span></span>
          <span className="text-white/45 shrink-0">V <span className="text-white/60">{formatVolume(displayedBar?.volume)}</span></span>
          <span className="text-white/30 shrink-0">{formatOverlayTime(displayedBar?.time, activeInterval)}</span>
        </div>

        {/* Symbol search */}
        <div className="flex items-center gap-2 shrink-0 ml-2">
          <input
            type="text"
            value={symbolInput}
            onChange={(event) => setSymbolInput(normalizeSymbol(event.target.value))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitSymbol();
            }}
            placeholder="Symbol"
            className="h-6 w-24 rounded-xl bg-black/40 shadow-[inset_4px_4px_8px_rgba(0,0,0,0.5),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] border border-white/[0.04] px-2 text-[11px] text-white outline-none placeholder:text-gray-500 focus:border-emerald-500/40 focus:shadow-[inset_4px_4px_8px_rgba(0,0,0,0.5),inset_-2px_-2px_6px_rgba(255,255,255,0.02),0_0_12px_rgba(16,185,129,0.1)] transition-all duration-300"
          />
          <button
            type="button"
            onClick={submitSymbol}
            className="h-6 rounded-xl bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 border border-emerald-500/20 px-2 text-[11px] font-semibold text-emerald-300 shadow-[0_2px_8px_rgba(0,0,0,0.3),0_0_12px_rgba(16,185,129,0.08)] transition-all duration-300 hover:from-emerald-500/25 hover:to-emerald-500/10 hover:border-emerald-400/40 hover:text-emerald-200 hover:shadow-[0_4px_16px_rgba(0,0,0,0.4),0_0_20px_rgba(16,185,129,0.15)]"
          >
            Go
          </button>
        </div>
      </div>

      <div ref={containerRef} className="h-full w-full pt-8" />

      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-10 flex justify-center">
        {status.loading && (
          <div className="rounded-xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.05)] px-3 py-1.5 text-[11px] text-gray-300">
            Loading candles...
          </div>
        )}
        {!status.loading && status.error && (
          <div className="rounded-xl bg-gradient-to-br from-red-500/[0.1] to-red-900/[0.05] backdrop-blur-xl border border-red-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_16px_rgba(239,68,68,0.08)] px-3 py-1.5 text-[11px] text-red-200">
            {status.error}
          </div>
        )}
      </div>
    </div>
  );
}
