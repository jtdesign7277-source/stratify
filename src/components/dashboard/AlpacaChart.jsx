import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import StockModule from 'highcharts/modules/stock';
import FullScreenModule from 'highcharts/modules/full-screen';

const initializeHighchartsModule = (moduleImport) => {
  const moduleFactory = moduleImport?.default || moduleImport;
  if (typeof moduleFactory === 'function') {
    moduleFactory(Highcharts);
  }
};

initializeHighchartsModule(StockModule);
initializeHighchartsModule(FullScreenModule);

const COLORS = {
  containerBg: '#060d18',
  plotBg: '#000000',
  chartAreaBg: '#0a1628',
  text: '#8892a0',
  textMuted: '#6f7d8f',
  up: '#22c55e',
  down: '#ef4444',
  crosshair: '#4a5568',
  track: '#111827',
  thumb: '#1f2937',
  activePill: '#60a5fa',
  sma20: '#3b82f6',
  sma50: '#f59e0b',
  ema12: '#22d3ee',
  ema26: '#f97316',
  bb: '#8b5cf6',
  rsi: '#38bdf8',
  macd: '#22c55e',
  signal: '#f43f5e',
};

const TIMEFRAME_BUTTONS = [
  { type: 'day', count: 1, text: '1D' },
  { type: 'week', count: 1, text: '1W' },
  { type: 'month', count: 1, text: '1M' },
  { type: 'month', count: 3, text: '3M' },
  { type: 'month', count: 6, text: '6M' },
  { type: 'year', count: 1, text: '1Y' },
  { type: 'all', text: 'ALL' },
];

const INTERVAL_OPTIONS = [
  { label: '1min', value: '1min', bucketMs: 60_000 },
  { label: '5min', value: '5min', bucketMs: 300_000 },
  { label: '15min', value: '15min', bucketMs: 900_000 },
  { label: '30min', value: '30min', bucketMs: 1_800_000 },
  { label: '1hr', value: '1h', bucketMs: 3_600_000 },
  { label: '4hr', value: '4h', bucketMs: 14_400_000 },
  { label: '1D', value: '1day', bucketMs: 86_400_000 },
  { label: '1W', value: '1week', bucketMs: 604_800_000 },
  { label: '1M', value: '1month', bucketMs: 2_592_000_000 },
];

const CHART_TYPE_OPTIONS = [
  { label: 'Candles', value: 'candlestick' },
  { label: 'OHLC', value: 'ohlc' },
  { label: 'Line', value: 'line' },
  { label: 'Area', value: 'area' },
];

const INDICATOR_OPTIONS = [
  { key: 'sma20', label: 'SMA(20)' },
  { key: 'sma50', label: 'SMA(50)' },
  { key: 'ema12', label: 'EMA(12)' },
  { key: 'ema26', label: 'EMA(26)' },
  { key: 'rsi14', label: 'RSI(14)' },
  { key: 'macd', label: 'MACD' },
  { key: 'bb', label: 'Bollinger Bands' },
];

const TWELVE_DATA_REST_URL = 'https://api.twelvedata.com/time_series';
const TWELVE_DATA_WS_URL = 'wss://ws.twelvedata.com/v1/quotes/price';

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toUnixMs = (value) => {
  if (value == null) return null;

  if (typeof value === 'number') {
    return value > 10_000_000_000 ? value : value * 1000;
  }

  const raw = String(value);
  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : null;
};

const normalizeSymbol = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^\$/, '');

const normalizeWsSymbol = (value) => {
  const symbol = normalizeSymbol(value);
  if (!symbol) return 'AAPL';

  if (symbol.includes(':')) {
    return symbol.split(':').pop() || symbol;
  }

  if (symbol.includes('/USD')) return symbol;
  if (symbol.includes('-USD')) return symbol.replace('-USD', '/USD');

  if (symbol.endsWith('USD') && symbol.length > 3) {
    return `${symbol.slice(0, -3)}/USD`;
  }

  return symbol;
};

const getIntervalConfig = (value) =>
  INTERVAL_OPTIONS.find((item) => item.value === value) || INTERVAL_OPTIONS[2];

const formatPrice = (value) => {
  if (!Number.isFinite(value)) return '--';
  if (Math.abs(value) >= 1000) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (Math.abs(value) >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(4)}`;
};

const formatPercent = (value) => {
  if (!Number.isFinite(value)) return '--';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
};

const formatVolume = (value) => {
  if (!Number.isFinite(value)) return '--';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
  return value.toFixed(0);
};

const makeVolumeColor = (isUp) => ({
  linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
  stops: isUp
    ? [
        [0, 'rgba(34,197,94,0.52)'],
        [1, 'rgba(34,197,94,0.08)'],
      ]
    : [
        [0, 'rgba(239,68,68,0.52)'],
        [1, 'rgba(239,68,68,0.08)'],
      ],
});

const parseTimeSeries = (values = []) => {
  const sorted = [...values].sort((a, b) => {
    const aTs = toUnixMs(a?.datetime || a?.time || a?.timestamp) || 0;
    const bTs = toUnixMs(b?.datetime || b?.time || b?.timestamp) || 0;
    return aTs - bTs;
  });

  const ohlc = [];
  const volume = [];
  let previousClose = null;

  sorted.forEach((row) => {
    const ts = toUnixMs(row?.datetime || row?.time || row?.timestamp);
    const close = toNumber(row?.close);
    if (!Number.isFinite(ts) || !Number.isFinite(close)) return;

    const open = toNumber(row?.open);
    const high = toNumber(row?.high);
    const low = toNumber(row?.low);
    const rawVolume = toNumber(row?.volume) || 0;

    const resolvedOpen = Number.isFinite(open) ? open : (Number.isFinite(previousClose) ? previousClose : close);
    const resolvedHigh = Number.isFinite(high) ? high : Math.max(resolvedOpen, close);
    const resolvedLow = Number.isFinite(low) ? low : Math.min(resolvedOpen, close);

    ohlc.push([ts, resolvedOpen, resolvedHigh, resolvedLow, close]);
    volume.push({
      x: ts,
      y: rawVolume,
      color: makeVolumeColor(close >= resolvedOpen),
    });

    previousClose = close;
  });

  return { ohlc, volume };
};

const calculateSma = (ohlc, period) => {
  if (!Array.isArray(ohlc) || ohlc.length < period) return [];
  const out = [];
  let running = 0;

  for (let i = 0; i < ohlc.length; i += 1) {
    const close = ohlc[i]?.[4];
    if (!Number.isFinite(close)) continue;

    running += close;
    if (i >= period) {
      const previous = ohlc[i - period]?.[4];
      if (Number.isFinite(previous)) running -= previous;
    }

    if (i >= period - 1) {
      out.push([ohlc[i][0], Number((running / period).toFixed(4))]);
    }
  }

  return out;
};

const calculateEma = (ohlc, period) => {
  if (!Array.isArray(ohlc) || ohlc.length === 0) return [];

  const multiplier = 2 / (period + 1);
  const out = [];
  let ema = null;

  for (let i = 0; i < ohlc.length; i += 1) {
    const close = ohlc[i]?.[4];
    if (!Number.isFinite(close)) continue;

    if (ema == null) {
      ema = close;
    } else {
      ema = (close - ema) * multiplier + ema;
    }

    out.push([ohlc[i][0], Number(ema.toFixed(4))]);
  }

  return out;
};

const calculateBollinger = (ohlc, period = 20, stdDevMultiplier = 2) => {
  if (!Array.isArray(ohlc) || ohlc.length < period) {
    return { upper: [], middle: [], lower: [] };
  }

  const upper = [];
  const middle = [];
  const lower = [];
  const closes = ohlc.map((item) => item?.[4]).filter(Number.isFinite);

  for (let i = period - 1; i < closes.length; i += 1) {
    const window = closes.slice(i - period + 1, i + 1);
    const avg = window.reduce((sum, value) => sum + value, 0) / period;
    const variance = window.reduce((sum, value) => sum + (value - avg) ** 2, 0) / period;
    const stdev = Math.sqrt(variance);

    const ts = ohlc[i][0];
    upper.push([ts, Number((avg + stdDevMultiplier * stdev).toFixed(4))]);
    middle.push([ts, Number(avg.toFixed(4))]);
    lower.push([ts, Number((avg - stdDevMultiplier * stdev).toFixed(4))]);
  }

  return { upper, middle, lower };
};

const calculateRsi = (ohlc, period = 14) => {
  if (!Array.isArray(ohlc) || ohlc.length <= period) return [];

  const closes = ohlc.map((item) => item?.[4]).filter(Number.isFinite);
  if (closes.length <= period) return [];

  const out = [];
  let gain = 0;
  let loss = 0;

  for (let i = 1; i <= period; i += 1) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gain += diff;
    else loss += Math.abs(diff);
  }

  let avgGain = gain / period;
  let avgLoss = loss / period;
  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsi = 100 - 100 / (1 + rs);
  out.push([ohlc[period][0], Number(rsi.toFixed(2))]);

  for (let i = period + 1; i < closes.length; i += 1) {
    const diff = closes[i] - closes[i - 1];
    const up = diff > 0 ? diff : 0;
    const down = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + up) / period;
    avgLoss = (avgLoss * (period - 1) + down) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi = 100 - 100 / (1 + rs);

    out.push([ohlc[i][0], Number(rsi.toFixed(2))]);
  }

  return out;
};

const calculateMacd = (ohlc) => {
  const ema12 = calculateEma(ohlc, 12);
  const ema26 = calculateEma(ohlc, 26);
  if (!ema12.length || !ema26.length) {
    return { line: [], signal: [], histogram: [] };
  }

  const ema26Map = new Map(ema26.map((point) => [point[0], point[1]]));
  const macdLine = ema12
    .filter((point) => ema26Map.has(point[0]))
    .map((point) => [point[0], Number((point[1] - ema26Map.get(point[0])).toFixed(4))]);

  if (!macdLine.length) return { line: [], signal: [], histogram: [] };

  const signal = [];
  const multiplier = 2 / (9 + 1);
  let ema = null;

  macdLine.forEach((point) => {
    if (ema == null) ema = point[1];
    else ema = (point[1] - ema) * multiplier + ema;
    signal.push([point[0], Number(ema.toFixed(4))]);
  });

  const signalMap = new Map(signal.map((point) => [point[0], point[1]]));
  const histogram = macdLine
    .filter((point) => signalMap.has(point[0]))
    .map((point) => ({
      x: point[0],
      y: Number((point[1] - signalMap.get(point[0])).toFixed(4)),
      color: point[1] - signalMap.get(point[0]) >= 0 ? makeVolumeColor(true) : makeVolumeColor(false),
    }));

  return { line: macdLine, signal, histogram };
};

const getMainSeriesData = (type, ohlc) => {
  if (type === 'candlestick' || type === 'ohlc') return ohlc;
  return ohlc.map((point) => [point[0], point[4]]);
};

const getYAxisLayout = ({ showRsi, showMacd, livePrice, liveColor }) => {
  const extras = [showRsi, showMacd].filter(Boolean).length;

  let priceHeight = 74;
  let volumeTop = 76;
  let volumeHeight = 24;

  if (extras === 1) {
    priceHeight = 60;
    volumeTop = 62;
    volumeHeight = 18;
  }

  if (extras === 2) {
    priceHeight = 56;
    volumeTop = 58;
    volumeHeight = 16;
  }

  const axes = [
    {
      id: 'price-axis',
      lineWidth: 0,
      gridLineWidth: 0,
      labels: {
        align: 'right',
        x: -6,
        style: { color: COLORS.text, fontSize: '11px' },
      },
      crosshair: {
        color: COLORS.crosshair,
        dashStyle: 'Dash',
        width: 1,
      },
      height: `${priceHeight}%`,
      resize: { enabled: true },
      plotLines: Number.isFinite(livePrice)
        ? [
            {
              value: livePrice,
              color: liveColor,
              dashStyle: 'Dash',
              width: 1,
              zIndex: 5,
              label: {
                align: 'right',
                useHTML: true,
                x: 6,
                y: 4,
                text: `<span style="background:${liveColor};color:#ffffff;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:700;">${formatPrice(livePrice)}</span>`,
              },
            },
          ]
        : [],
    },
    {
      id: 'volume-axis',
      top: `${volumeTop}%`,
      height: `${volumeHeight}%`,
      offset: 0,
      lineWidth: 0,
      gridLineWidth: 0,
      labels: {
        align: 'right',
        x: -6,
        style: { color: COLORS.textMuted, fontSize: '10px' },
      },
      title: { text: '' },
    },
  ];

  if (showRsi && showMacd) {
    axes.push({
      id: 'rsi-axis',
      top: '76%',
      height: '12%',
      offset: 0,
      min: 0,
      max: 100,
      lineWidth: 0,
      gridLineWidth: 0,
      labels: { style: { color: COLORS.textMuted, fontSize: '10px' } },
      plotLines: [
        { value: 70, color: '#374151', width: 1, dashStyle: 'Dash' },
        { value: 30, color: '#374151', width: 1, dashStyle: 'Dash' },
      ],
      title: { text: '' },
    });

    axes.push({
      id: 'macd-axis',
      top: '90%',
      height: '10%',
      offset: 0,
      lineWidth: 0,
      gridLineWidth: 0,
      labels: { style: { color: COLORS.textMuted, fontSize: '10px' } },
      plotLines: [{ value: 0, color: '#374151', width: 1 }],
      title: { text: '' },
    });
  } else if (showRsi) {
    axes.push({
      id: 'rsi-axis',
      top: '82%',
      height: '18%',
      offset: 0,
      min: 0,
      max: 100,
      lineWidth: 0,
      gridLineWidth: 0,
      labels: { style: { color: COLORS.textMuted, fontSize: '10px' } },
      plotLines: [
        { value: 70, color: '#374151', width: 1, dashStyle: 'Dash' },
        { value: 30, color: '#374151', width: 1, dashStyle: 'Dash' },
      ],
      title: { text: '' },
    });
  } else if (showMacd) {
    axes.push({
      id: 'macd-axis',
      top: '82%',
      height: '18%',
      offset: 0,
      lineWidth: 0,
      gridLineWidth: 0,
      labels: { style: { color: COLORS.textMuted, fontSize: '10px' } },
      plotLines: [{ value: 0, color: '#374151', width: 1 }],
      title: { text: '' },
    });
  }

  return axes;
};

export default function AlpacaChart({ symbol = 'AAPL', onSymbolChange }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const wsRef = useRef(null);

  const [interval, setInterval] = useState('15min');
  const [chartType, setChartType] = useState('candlestick');
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
  const [indicators, setIndicators] = useState({
    sma20: true,
    sma50: true,
    ema12: false,
    ema26: false,
    rsi14: false,
    macd: false,
    bb: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [hoveredTimestamp, setHoveredTimestamp] = useState(null);
  const [seriesData, setSeriesData] = useState({ ohlc: [], volume: [] });

  const activeSymbol = useMemo(() => normalizeSymbol(symbol) || 'AAPL', [symbol]);
  const wsSymbol = useMemo(() => normalizeWsSymbol(activeSymbol), [activeSymbol]);
  const intervalConfig = useMemo(() => getIntervalConfig(interval), [interval]);

  const twelveDataKey =
    import.meta.env.VITE_TWELVE_DATA_API_KEY ||
    import.meta.env.VITE_TWELVEDATA_API_KEY ||
    '';

  useEffect(() => {
    if (typeof onSymbolChange === 'function') {
      onSymbolChange(activeSymbol);
    }
  }, [activeSymbol, onSymbolChange]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleResize = () => {
      if (chartRef.current && typeof chartRef.current.reflow === 'function') {
        chartRef.current.reflow();
      }
    };

    let observer;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      observer = new ResizeObserver(() => handleResize());
      observer.observe(containerRef.current);
    }

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      observer?.disconnect();
    };
  }, []);

  const closeSocket = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close(1000, 'cleanup');
      } catch {
        // Ignore socket close errors.
      }
      wsRef.current = null;
    }
    setStreaming(false);
  }, []);

  const fetchHistorical = useCallback(async () => {
    if (twelveDataKey) {
      const params = new URLSearchParams({
        symbol: activeSymbol,
        interval,
        outputsize: '500',
        order: 'ASC',
        timezone: 'Exchange',
        apikey: twelveDataKey,
      });

      const response = await fetch(`${TWELVE_DATA_REST_URL}?${params.toString()}`, {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.status === 'error') {
        throw new Error(payload?.message || 'Failed to fetch historical data from Twelve Data');
      }
      return payload;
    }

    const params = new URLSearchParams({ symbol: activeSymbol, interval, outputsize: '500' });
    const response = await fetch(`/api/twelvedata/time-series?${params.toString()}`, {
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || 'Failed to fetch historical data');
    }
    return payload;
  }, [activeSymbol, interval, twelveDataKey]);

  const openSocket = useCallback(async () => {
    let websocketUrl = '';

    if (twelveDataKey) {
      websocketUrl = `${TWELVE_DATA_WS_URL}?apikey=${encodeURIComponent(twelveDataKey)}`;
    } else {
      const response = await fetch('/api/twelvedata/ws-config', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.websocketUrl) {
        throw new Error(payload?.error || 'Unable to start Twelve Data stream');
      }
      websocketUrl = payload.websocketUrl;
    }

    const ws = new WebSocket(websocketUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStreaming(true);
      ws.send(
        JSON.stringify({
          action: 'subscribe',
          params: { symbols: wsSymbol },
        })
      );
    };

    ws.onerror = () => {
      setStreaming(false);
    };

    ws.onclose = () => {
      setStreaming(false);
      if (wsRef.current === ws) wsRef.current = null;
    };

    ws.onmessage = (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data || '{}');
      } catch {
        return;
      }

      const updates = Array.isArray(payload) ? payload : [payload];
      updates.forEach((update) => {
        const tickPrice = toNumber(update?.price ?? update?.close ?? update?.last);
        if (!Number.isFinite(tickPrice)) return;

        const tickMs = toUnixMs(update?.timestamp || update?.datetime) || Date.now();
        const bucketMs = intervalConfig.bucketMs;
        const bucket = Math.floor(tickMs / bucketMs) * bucketMs;

        setSeriesData((prev) => {
          if (!prev.ohlc.length) return prev;

          const ohlc = [...prev.ohlc];
          const volume = [...prev.volume];
          const last = ohlc[ohlc.length - 1];

          if (!last) return prev;

          if (bucket > last[0]) {
            const newOpen = last[4];
            const next = [bucket, newOpen, tickPrice, tickPrice, tickPrice];
            ohlc.push(next);
            volume.push({ x: bucket, y: 0, color: makeVolumeColor(next[4] >= next[1]) });

            if (ohlc.length > 5000) {
              ohlc.shift();
              volume.shift();
            }
          } else {
            const open = last[1];
            const high = Math.max(last[2], tickPrice);
            const low = Math.min(last[3], tickPrice);
            const close = tickPrice;
            ohlc[ohlc.length - 1] = [last[0], open, high, low, close];

            const lastVolume = volume[volume.length - 1];
            volume[volume.length - 1] = {
              x: last[0],
              y: Number(lastVolume?.y) || 0,
              color: makeVolumeColor(close >= open),
            };
          }

          return { ohlc, volume };
        });
      });
    };
  }, [intervalConfig.bucketMs, twelveDataKey, wsSymbol]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      closeSocket();
      setLoading(true);
      setError('');
      setHoveredTimestamp(null);

      try {
        const payload = await fetchHistorical();
        if (cancelled) return;

        const values = Array.isArray(payload?.values) ? payload.values : [];
        const parsed = parseTimeSeries(values);

        if (!parsed.ohlc.length) {
          throw new Error('No data returned for this symbol/timeframe.');
        }

        setSeriesData(parsed);
        setLoading(false);

        try {
          await openSocket();
        } catch (streamError) {
          if (!cancelled) {
            setError(streamError?.message || 'Live stream unavailable. Showing last available data.');
          }
        }
      } catch (loadError) {
        if (cancelled) return;
        setSeriesData({ ohlc: [], volume: [] });
        setLoading(false);
        setError(loadError?.message || 'Failed to load chart data.');
      }
    };

    load();

    return () => {
      cancelled = true;
      closeSocket();
    };
  }, [activeSymbol, closeSocket, fetchHistorical, openSocket]);

  const candleMap = useMemo(() => {
    const map = new Map();
    seriesData.ohlc.forEach((point, index) => {
      const v = seriesData.volume[index]?.y ?? 0;
      map.set(point[0], {
        ts: point[0],
        open: point[1],
        high: point[2],
        low: point[3],
        close: point[4],
        volume: v,
      });
    });
    return map;
  }, [seriesData.ohlc, seriesData.volume]);

  const latestCandle = useMemo(() => {
    if (!seriesData.ohlc.length) return null;
    const point = seriesData.ohlc[seriesData.ohlc.length - 1];
    const volume = seriesData.volume[seriesData.volume.length - 1]?.y ?? 0;
    return {
      ts: point[0],
      open: point[1],
      high: point[2],
      low: point[3],
      close: point[4],
      volume,
    };
  }, [seriesData.ohlc, seriesData.volume]);

  const previousClose = useMemo(() => {
    if (seriesData.ohlc.length < 2) return null;
    return seriesData.ohlc[seriesData.ohlc.length - 2]?.[4] ?? null;
  }, [seriesData.ohlc]);

  const displayCandle = useMemo(() => {
    if (hoveredTimestamp && candleMap.has(hoveredTimestamp)) {
      return candleMap.get(hoveredTimestamp);
    }
    return latestCandle;
  }, [candleMap, hoveredTimestamp, latestCandle]);

  const priceChange = useMemo(() => {
    if (!latestCandle) return 0;
    const baseline = Number.isFinite(previousClose) ? previousClose : latestCandle.open;
    if (!Number.isFinite(baseline) || baseline === 0) return 0;
    return latestCandle.close - baseline;
  }, [latestCandle, previousClose]);

  const priceChangePercent = useMemo(() => {
    if (!latestCandle) return 0;
    const baseline = Number.isFinite(previousClose) ? previousClose : latestCandle.open;
    if (!Number.isFinite(baseline) || baseline === 0) return 0;
    return (priceChange / baseline) * 100;
  }, [latestCandle, previousClose, priceChange]);

  const isPriceUp = priceChange >= 0;

  const sma20 = useMemo(() => calculateSma(seriesData.ohlc, 20), [seriesData.ohlc]);
  const sma50 = useMemo(() => calculateSma(seriesData.ohlc, 50), [seriesData.ohlc]);
  const ema12 = useMemo(() => calculateEma(seriesData.ohlc, 12), [seriesData.ohlc]);
  const ema26 = useMemo(() => calculateEma(seriesData.ohlc, 26), [seriesData.ohlc]);
  const bollinger = useMemo(() => calculateBollinger(seriesData.ohlc, 20, 2), [seriesData.ohlc]);
  const rsi14 = useMemo(() => calculateRsi(seriesData.ohlc, 14), [seriesData.ohlc]);
  const macd = useMemo(() => calculateMacd(seriesData.ohlc), [seriesData.ohlc]);

  const yAxis = useMemo(
    () =>
      getYAxisLayout({
        showRsi: indicators.rsi14,
        showMacd: indicators.macd,
        livePrice: latestCandle?.close,
        liveColor: isPriceUp ? COLORS.up : COLORS.down,
      }),
    [indicators.macd, indicators.rsi14, isPriceUp, latestCandle?.close]
  );

  const mainSeriesData = useMemo(
    () => getMainSeriesData(chartType, seriesData.ohlc),
    [chartType, seriesData.ohlc]
  );

  const chartOptions = useMemo(() => {
    const series = [
      {
        id: 'price-main',
        type: chartType,
        name: activeSymbol,
        data: mainSeriesData,
        yAxis: 'price-axis',
        color: COLORS.down,
        upColor: COLORS.up,
        lineColor: COLORS.down,
        upLineColor: COLORS.up,
        marker: { enabled: false },
        lineWidth: chartType === 'line' ? 1.2 : 1,
        fillColor:
          chartType === 'area'
            ? {
                linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
                stops: [
                  [0, 'rgba(96,165,250,0.35)'],
                  [1, 'rgba(96,165,250,0.03)'],
                ],
              }
            : undefined,
        point: {
          events: {
            mouseOver: function mouseOver() {
              setHoveredTimestamp(this.x);
            },
          },
        },
      },
      {
        id: 'volume',
        type: 'column',
        name: 'Volume',
        data: seriesData.volume,
        yAxis: 'volume-axis',
        borderWidth: 0,
      },
    ];

    if (indicators.sma20) {
      series.push({
        id: 'sma20',
        type: 'line',
        name: 'SMA(20)',
        data: sma20,
        yAxis: 'price-axis',
        color: COLORS.sma20,
        lineWidth: 1,
        marker: { enabled: false },
      });
    }

    if (indicators.sma50) {
      series.push({
        id: 'sma50',
        type: 'line',
        name: 'SMA(50)',
        data: sma50,
        yAxis: 'price-axis',
        color: COLORS.sma50,
        lineWidth: 1,
        marker: { enabled: false },
      });
    }

    if (indicators.ema12) {
      series.push({
        id: 'ema12',
        type: 'line',
        name: 'EMA(12)',
        data: ema12,
        yAxis: 'price-axis',
        color: COLORS.ema12,
        lineWidth: 1,
        marker: { enabled: false },
      });
    }

    if (indicators.ema26) {
      series.push({
        id: 'ema26',
        type: 'line',
        name: 'EMA(26)',
        data: ema26,
        yAxis: 'price-axis',
        color: COLORS.ema26,
        lineWidth: 1,
        marker: { enabled: false },
      });
    }

    if (indicators.bb) {
      series.push(
        {
          id: 'bb-upper',
          type: 'line',
          name: 'BB Upper',
          data: bollinger.upper,
          yAxis: 'price-axis',
          color: COLORS.bb,
          lineWidth: 1,
          dashStyle: 'ShortDot',
          marker: { enabled: false },
        },
        {
          id: 'bb-middle',
          type: 'line',
          name: 'BB Middle',
          data: bollinger.middle,
          yAxis: 'price-axis',
          color: '#a78bfa',
          lineWidth: 1,
          marker: { enabled: false },
        },
        {
          id: 'bb-lower',
          type: 'line',
          name: 'BB Lower',
          data: bollinger.lower,
          yAxis: 'price-axis',
          color: COLORS.bb,
          lineWidth: 1,
          dashStyle: 'ShortDot',
          marker: { enabled: false },
        }
      );
    }

    if (indicators.rsi14) {
      series.push({
        id: 'rsi14',
        type: 'line',
        name: 'RSI(14)',
        data: rsi14,
        yAxis: 'rsi-axis',
        color: COLORS.rsi,
        lineWidth: 1,
        marker: { enabled: false },
      });
    }

    if (indicators.macd) {
      series.push(
        {
          id: 'macd-line',
          type: 'line',
          name: 'MACD',
          data: macd.line,
          yAxis: 'macd-axis',
          color: COLORS.macd,
          lineWidth: 1,
          marker: { enabled: false },
        },
        {
          id: 'macd-signal',
          type: 'line',
          name: 'Signal',
          data: macd.signal,
          yAxis: 'macd-axis',
          color: COLORS.signal,
          lineWidth: 1,
          marker: { enabled: false },
        },
        {
          id: 'macd-hist',
          type: 'column',
          name: 'MACD Hist',
          data: macd.histogram,
          yAxis: 'macd-axis',
          borderWidth: 0,
        }
      );
    }

    return {
      chart: {
        backgroundColor: COLORS.containerBg,
        plotBackgroundColor: COLORS.plotBg,
        animation: false,
        spacing: [2, 2, 2, 2],
        panning: {
          enabled: true,
          type: 'x',
        },
        zooming: {
          mouseWheel: { enabled: true },
          type: 'x',
          pinchType: 'x',
        },
        style: {
          fontFamily: "'Inter', 'JetBrains Mono', sans-serif",
        },
      },
      credits: { enabled: false },
      legend: { enabled: false },
      tooltip: { enabled: false },
      rangeSelector: {
        enabled: true,
        inputEnabled: false,
        selected: 2,
        allButtonsEnabled: true,
        buttons: TIMEFRAME_BUTTONS,
        buttonSpacing: 4,
        buttonTheme: {
          fill: COLORS.thumb,
          stroke: COLORS.thumb,
          r: 10,
          padding: 2,
          style: {
            color: COLORS.text,
            fontSize: '10px',
            fontWeight: '600',
          },
          states: {
            hover: {
              fill: '#253244',
              style: { color: '#9ca3af' },
            },
            select: {
              fill: '#1f2937',
              style: { color: COLORS.activePill },
            },
          },
        },
        labelStyle: { color: COLORS.textMuted },
      },
      navigator: {
        enabled: true,
        maskFill: 'rgba(96,165,250,0.12)',
        series: {
          color: '#1f2937',
          lineColor: '#334155',
        },
        xAxis: {
          labels: { style: { color: COLORS.textMuted } },
          gridLineWidth: 0,
          lineWidth: 0,
          tickWidth: 0,
        },
      },
      scrollbar: {
        enabled: true,
        barBackgroundColor: COLORS.thumb,
        barBorderColor: COLORS.thumb,
        buttonBackgroundColor: COLORS.track,
        buttonBorderColor: COLORS.track,
        rifleColor: COLORS.textMuted,
        trackBackgroundColor: COLORS.track,
        trackBorderColor: COLORS.track,
        height: 10,
      },
      xAxis: {
        type: 'datetime',
        lineWidth: 0,
        tickWidth: 0,
        gridLineWidth: 0,
        labels: { style: { color: COLORS.text, fontSize: '11px' } },
        crosshair: {
          color: COLORS.crosshair,
          dashStyle: 'Dash',
          width: 1,
          snap: true,
          zIndex: 10,
        },
      },
      yAxis,
      plotOptions: {
        series: {
          animation: false,
          dataGrouping: { enabled: false },
          turboThreshold: 0,
          states: {
            inactive: { opacity: 1 },
          },
        },
        candlestick: {
          color: COLORS.down,
          upColor: COLORS.up,
          lineColor: COLORS.down,
          upLineColor: COLORS.up,
          lineWidth: 1,
        },
        ohlc: {
          color: COLORS.down,
          upColor: COLORS.up,
          lineWidth: 1,
        },
      },
      series,
    };
  }, [
    activeSymbol,
    bollinger.lower,
    bollinger.middle,
    bollinger.upper,
    chartType,
    ema12,
    ema26,
    indicators,
    isPriceUp,
    latestCandle?.close,
    macd.histogram,
    macd.line,
    macd.signal,
    mainSeriesData,
    rsi14,
    seriesData.volume,
    sma20,
    sma50,
    yAxis,
  ]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !chart.container) return undefined;

    const handleMove = (nativeEvent) => {
      const normalized = chart.pointer.normalize(nativeEvent);
      const mainSeries = chart.get('price-main');
      if (!mainSeries) return;
      const point = mainSeries.searchPoint(normalized, true);
      if (point && Number.isFinite(point.x)) {
        setHoveredTimestamp(point.x);
      }
    };

    const clearHover = () => setHoveredTimestamp(null);

    const unbindMove = Highcharts.addEvent(chart.container, 'mousemove', handleMove);
    const unbindTouch = Highcharts.addEvent(chart.container, 'touchmove', handleMove);
    const unbindLeave = Highcharts.addEvent(chart.container, 'mouseleave', clearHover);

    return () => {
      if (typeof unbindMove === 'function') unbindMove();
      if (typeof unbindTouch === 'function') unbindTouch();
      if (typeof unbindLeave === 'function') unbindLeave();
    };
  }, [chartOptions.series]);

  const handleToggleIndicator = (key) => {
    setIndicators((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      try {
        await containerRef.current.requestFullscreen();
      } catch {
        // Fullscreen unavailable in this context.
      }
      return;
    }

    try {
      await document.exitFullscreen();
    } catch {
      // Ignore fullscreen exit errors.
    }
  };

  return (
    <div ref={containerRef} className="h-full w-full min-h-0 overflow-hidden rounded-lg border border-[#0f1722] bg-[#060d18]">
      <div className="flex items-center justify-between gap-3 border-b border-[#0f1722] bg-[#0a1628] px-3 py-2 text-[11px]">
        <div className="flex items-center gap-3">
          <span className="font-semibold tracking-[0.04em] text-[#9aa6b8]">{activeSymbol}</span>
          <span className={`font-semibold ${isPriceUp ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
            {formatPrice(latestCandle?.close)}
          </span>
          <span className={`font-medium ${isPriceUp ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
            {isPriceUp ? '+' : ''}{formatPrice(priceChange)} ({formatPercent(priceChangePercent)})
          </span>
          <span className={`inline-flex items-center gap-1 text-[10px] ${streaming ? 'text-[#22c55e]' : 'text-[#8892a0]'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${streaming ? 'bg-[#22c55e]' : 'bg-[#6b7280]'}`} />
            {streaming ? 'LIVE' : 'CLOSED'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[#8892a0]">
          <span>O: {formatPrice(displayCandle?.open)}</span>
          <span>H: {formatPrice(displayCandle?.high)}</span>
          <span>L: {formatPrice(displayCandle?.low)}</span>
          <span>C: {formatPrice(displayCandle?.close)}</span>
          <span>V: {formatVolume(displayCandle?.volume)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-b border-[#0f1722] bg-[#060d18] px-2 py-2">
        <div className="relative flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIndicatorsOpen((open) => !open)}
            className="rounded-full border border-[#1f2937] bg-[#111827] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.05em] text-[#9aa6b8] hover:text-[#cbd5e1]"
          >
            Indicators
          </button>

          {indicatorsOpen && (
            <div className="absolute left-0 top-8 z-20 min-w-[180px] rounded-md border border-[#1f2937] bg-[#0a1628] p-2 shadow-xl">
              <div className="grid grid-cols-1 gap-1">
                {INDICATOR_OPTIONS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleToggleIndicator(item.key)}
                    className={`flex items-center justify-between rounded px-2 py-1 text-left text-[11px] transition-colors ${
                      indicators[item.key]
                        ? 'bg-[#1f2937] text-[#93c5fd]'
                        : 'text-[#8892a0] hover:bg-[#111827] hover:text-[#cbd5e1]'
                    }`}
                  >
                    <span>{item.label}</span>
                    <span>{indicators[item.key] ? 'ON' : 'OFF'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-1">
            {CHART_TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setChartType(option.value)}
                className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.04em] ${
                  chartType === option.value
                    ? 'border-[#2563eb] bg-[#1f2937] text-[#60a5fa]'
                    : 'border-[#1f2937] bg-[#111827] text-[#8892a0] hover:text-[#cbd5e1]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {INTERVAL_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setInterval(option.value)}
              className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${
                interval === option.value
                  ? 'border-[#2563eb] bg-[#1f2937] text-[#60a5fa]'
                  : 'border-[#1f2937] bg-[#111827] text-[#8892a0] hover:text-[#cbd5e1]'
              }`}
            >
              {option.label}
            </button>
          ))}

          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-full border border-[#1f2937] bg-[#111827] px-2 py-1 text-[10px] font-semibold text-[#8892a0] hover:text-[#cbd5e1]"
          >
            Fullscreen
          </button>
        </div>
      </div>

      <div className="relative h-[calc(100%-82px)] min-h-0 bg-[#0a1628]">
        <HighchartsReact
          highcharts={Highcharts}
          constructorType="stockChart"
          options={chartOptions}
          callback={(chart) => {
            chartRef.current = chart;
          }}
          containerProps={{ style: { width: '100%', height: '100%' } }}
        />

        {loading && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#060d18]/80 text-sm text-[#8892a0]">
            Loading {activeSymbol}...
          </div>
        )}

        {!loading && error && (
          <div className="pointer-events-none absolute left-3 top-3 rounded border border-red-500/20 bg-[#210f14]/80 px-3 py-1.5 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="pointer-events-none absolute bottom-1 right-2 text-[10px] tracking-[0.1em] text-[#64748b]">
          MARKET DATA POWERED BY TWELVE DATA
        </div>
      </div>
    </div>
  );
}
