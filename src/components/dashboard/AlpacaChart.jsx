import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import HighchartsStockModule from 'highcharts/modules/stock';

if (typeof HighchartsStockModule === 'function') {
  HighchartsStockModule(Highcharts);
}

const COLORS = {
  bg: '#060d18',
  chartBg: '#0a1628',
  grid: '#1a2332',
  text: '#8892a0',
  axis: '#1f2d40',
  up: '#22c55e',
  down: '#ef4444',
  sma20: '#38bdf8',
  sma50: '#a78bfa',
};

const TWELVE_DATA_REST_URL = 'https://api.twelvedata.com/time_series';
const TWELVE_DATA_WS_BASE = 'wss://ws.twelvedata.com/v1/quotes/price';

const TIMEFRAME_CONFIG = {
  '1D': { interval: '1min', outputsize: 700, bucketMs: 60_000 },
  '1W': { interval: '5min', outputsize: 1_200, bucketMs: 300_000 },
  '1M': { interval: '15min', outputsize: 2_000, bucketMs: 900_000 },
  '3M': { interval: '1h', outputsize: 2_200, bucketMs: 3_600_000 },
  '6M': { interval: '1day', outputsize: 600, bucketMs: 86_400_000 },
  '1Y': { interval: '1day', outputsize: 1_000, bucketMs: 86_400_000 },
  ALL: { interval: '1week', outputsize: 1_200, bucketMs: 604_800_000 },
};

const RANGE_BUTTONS = [
  { type: 'day', count: 1, text: '1D' },
  { type: 'week', count: 1, text: '1W' },
  { type: 'month', count: 1, text: '1M' },
  { type: 'month', count: 3, text: '3M' },
  { type: 'month', count: 6, text: '6M' },
  { type: 'year', count: 1, text: '1Y' },
  { type: 'all', text: 'ALL' },
];

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toUnixMs = (value) => {
  if (!value) return null;
  if (typeof value === 'number') {
    return value > 10_000_000_000 ? value : value * 1000;
  }

  const normalized = String(value).includes('T') ? String(value) : String(value).replace(' ', 'T');
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeSymbol = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^\$/, '');

const normalizeWsSymbol = (symbol) => {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) return 'AAPL';

  if (normalized.includes(':')) {
    return normalized.split(':').pop() || normalized;
  }

  if (normalized.includes('-USD')) {
    return normalized.replace('-USD', '/USD');
  }

  if (normalized.endsWith('USD') && normalized.length > 3) {
    const base = normalized.slice(0, -3);
    return `${base}/USD`;
  }

  return normalized;
};

const calculateSma = (ohlc, period) => {
  if (!Array.isArray(ohlc) || ohlc.length === 0) return [];

  const out = [];
  let rolling = 0;

  for (let i = 0; i < ohlc.length; i += 1) {
    const close = ohlc[i]?.[4];
    if (!Number.isFinite(close)) continue;

    rolling += close;
    if (i >= period) {
      const drop = ohlc[i - period]?.[4];
      if (Number.isFinite(drop)) rolling -= drop;
    }

    if (i >= period - 1) {
      out.push([ohlc[i][0], Number((rolling / period).toFixed(4))]);
    }
  }

  return out;
};

const makeVolumePoint = (timestamp, volume, open, close) => ({
  x: timestamp,
  y: Number.isFinite(volume) ? volume : 0,
  color: close >= open ? 'rgba(34,197,94,0.38)' : 'rgba(239,68,68,0.38)',
});

const parseBars = (values = []) => {
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
    const vol = toNumber(row?.volume);

    const resolvedOpen = Number.isFinite(open) ? open : (Number.isFinite(previousClose) ? previousClose : close);
    const resolvedHigh = Number.isFinite(high) ? high : Math.max(resolvedOpen, close);
    const resolvedLow = Number.isFinite(low) ? low : Math.min(resolvedOpen, close);

    const candle = [ts, resolvedOpen, resolvedHigh, resolvedLow, close];
    ohlc.push(candle);
    volume.push(makeVolumePoint(ts, vol, resolvedOpen, close));
    previousClose = close;
  });

  return { ohlc, volume };
};

export default function AlpacaChart({ symbol = 'AAPL' }) {
  const [timeframe, setTimeframe] = useState('1M');
  const [showSma20, setShowSma20] = useState(true);
  const [showSma50, setShowSma50] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastTickAt, setLastTickAt] = useState(null);
  const [seriesData, setSeriesData] = useState({ ohlc: [], volume: [] });

  const wsRef = useRef(null);

  const activeSymbol = useMemo(() => normalizeSymbol(symbol) || 'AAPL', [symbol]);
  const wsSymbol = useMemo(() => normalizeWsSymbol(activeSymbol), [activeSymbol]);
  const timeframeConfig = TIMEFRAME_CONFIG[timeframe] || TIMEFRAME_CONFIG['1M'];
  const twelveDataKey =
    import.meta.env.VITE_TWELVE_DATA_API_KEY ||
    import.meta.env.VITE_TWELVEDATA_API_KEY ||
    '';

  const closeSocket = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close(1000, 'symbol/timeframe change');
      } catch {
        // Ignore close failures.
      }
      wsRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const fetchHistoricalBars = useCallback(async () => {
    const { interval, outputsize } = timeframeConfig;

    if (twelveDataKey) {
      const params = new URLSearchParams({
        symbol: activeSymbol,
        interval,
        outputsize: String(outputsize),
        order: 'ASC',
        timezone: 'Exchange',
        apikey: twelveDataKey,
      });

      const response = await fetch(`${TWELVE_DATA_REST_URL}?${params.toString()}`, {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload?.status === 'error') {
        throw new Error(payload?.message || 'Failed to fetch Twelve Data bars');
      }

      return payload;
    }

    const proxyParams = new URLSearchParams({
      symbol: activeSymbol,
      interval,
      outputsize: String(outputsize),
    });

    const proxyResponse = await fetch(`/api/lse/timeseries?${proxyParams.toString()}`, {
      cache: 'no-store',
    });
    const proxyPayload = await proxyResponse.json().catch(() => ({}));

    if (!proxyResponse.ok) {
      throw new Error(proxyPayload?.error || 'Failed to fetch proxied Twelve Data bars');
    }

    return proxyPayload;
  }, [activeSymbol, timeframeConfig, twelveDataKey]);

  const openSocket = useCallback(async () => {
    let wsUrl = '';

    if (twelveDataKey) {
      wsUrl = `${TWELVE_DATA_WS_BASE}?apikey=${encodeURIComponent(twelveDataKey)}`;
    } else {
      const response = await fetch('/api/lse/ws-config', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.websocketUrl) {
        throw new Error(payload?.error || 'Failed to resolve Twelve Data WebSocket URL');
      }
      wsUrl = payload.websocketUrl;
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsStreaming(true);
      ws.send(
        JSON.stringify({
          action: 'subscribe',
          params: { symbols: wsSymbol },
        })
      );
    };

    ws.onerror = () => {
      setIsStreaming(false);
    };

    ws.onclose = () => {
      setIsStreaming(false);
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data || '{}');
      } catch {
        return;
      }

      const updates = Array.isArray(payload) ? payload : [payload];

      updates.forEach((tick) => {
        const tickSymbol = normalizeSymbol(tick?.symbol || tick?.meta?.symbol || '');
        const tickPrice = toNumber(tick?.price ?? tick?.close ?? tick?.last);

        if (!Number.isFinite(tickPrice)) return;
        if (tickSymbol && !tickSymbol.includes(wsSymbol.split('/')[0])) return;

        const tickTs = toUnixMs(tick?.timestamp || tick?.datetime) || Date.now();
        const bucketMs = timeframeConfig.bucketMs;
        const bucketTs = Math.floor(tickTs / bucketMs) * bucketMs;

        setSeriesData((prev) => {
          if (!prev.ohlc.length) return prev;

          const nextOhlc = [...prev.ohlc];
          const nextVolume = [...prev.volume];
          const last = nextOhlc[nextOhlc.length - 1];

          if (!last) return prev;

          if (bucketTs > last[0]) {
            const newOpen = last[4];
            const newCandle = [bucketTs, newOpen, tickPrice, tickPrice, tickPrice];
            nextOhlc.push(newCandle);
            nextVolume.push(makeVolumePoint(bucketTs, 0, newOpen, tickPrice));

            if (nextOhlc.length > 5000) {
              nextOhlc.shift();
              nextVolume.shift();
            }
          } else {
            const open = last[1];
            const high = Math.max(last[2], tickPrice);
            const low = Math.min(last[3], tickPrice);
            const close = tickPrice;
            nextOhlc[nextOhlc.length - 1] = [last[0], open, high, low, close];

            const currentVol = Number(nextVolume[nextVolume.length - 1]?.y) || 0;
            nextVolume[nextVolume.length - 1] = makeVolumePoint(last[0], currentVol, open, close);
          }

          return { ohlc: nextOhlc, volume: nextVolume };
        });

        setLastTickAt(tickTs);
      });
    };
  }, [timeframeConfig.bucketMs, twelveDataKey, wsSymbol]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      closeSocket();
      setLoading(true);
      setError('');

      try {
        const payload = await fetchHistoricalBars();
        if (cancelled) return;

        const values = Array.isArray(payload?.values) ? payload.values : [];
        const parsed = parseBars(values);

        if (!parsed.ohlc.length) {
          throw new Error('No historical data returned for this symbol/timeframe.');
        }

        setSeriesData(parsed);
        setLastTickAt(parsed.ohlc[parsed.ohlc.length - 1]?.[0] || null);
        setLoading(false);

        try {
          await openSocket();
        } catch (socketError) {
          if (!cancelled) {
            setIsStreaming(false);
            setError((prev) => prev || socketError?.message || 'Live stream unavailable. Showing last data.');
          }
        }
      } catch (loadError) {
        if (cancelled) return;
        setLoading(false);
        setError(loadError?.message || 'Unable to load chart data.');
        setSeriesData({ ohlc: [], volume: [] });
      }
    };

    load();

    return () => {
      cancelled = true;
      closeSocket();
    };
  }, [activeSymbol, closeSocket, fetchHistoricalBars, openSocket, timeframe]);

  const sma20 = useMemo(() => calculateSma(seriesData.ohlc, 20), [seriesData.ohlc]);
  const sma50 = useMemo(() => calculateSma(seriesData.ohlc, 50), [seriesData.ohlc]);

  const stale = useMemo(() => {
    if (!lastTickAt) return true;
    const now = Date.now();
    return now - lastTickAt > Math.max(timeframeConfig.bucketMs * 3, 180_000);
  }, [lastTickAt, timeframeConfig.bucketMs]);

  const chartOptions = useMemo(() => ({
    chart: {
      backgroundColor: COLORS.bg,
      animation: false,
      spacing: [8, 8, 8, 8],
      style: {
        fontFamily: "'Inter', 'JetBrains Mono', sans-serif",
      },
    },
    credits: { enabled: false },
    legend: {
      enabled: true,
      itemStyle: { color: COLORS.text, fontSize: '11px' },
      itemHoverStyle: { color: '#cbd5e1' },
      itemHiddenStyle: { color: '#4b5563' },
    },
    rangeSelector: {
      enabled: true,
      selected: 2,
      inputEnabled: false,
      allButtonsEnabled: true,
      buttonSpacing: 4,
      buttonTheme: {
        fill: COLORS.chartBg,
        stroke: COLORS.grid,
        r: 4,
        style: { color: COLORS.text, fontSize: '10px' },
        states: {
          hover: { fill: '#0f2138', style: { color: '#d1d5db' } },
          select: { fill: '#123154', style: { color: '#f8fafc' } },
        },
      },
      labelStyle: { color: COLORS.text },
      buttons: RANGE_BUTTONS,
    },
    navigator: {
      enabled: true,
      maskFill: 'rgba(34,197,94,0.12)',
      outlineColor: COLORS.grid,
      xAxis: {
        gridLineColor: COLORS.grid,
        labels: { style: { color: COLORS.text } },
      },
      series: {
        color: '#1e3a5f',
        lineColor: '#4b6b94',
      },
      handles: {
        backgroundColor: COLORS.axis,
        borderColor: COLORS.grid,
      },
    },
    scrollbar: {
      enabled: true,
      barBackgroundColor: '#16273f',
      barBorderColor: COLORS.grid,
      buttonBackgroundColor: '#13263f',
      buttonBorderColor: COLORS.grid,
      rifleColor: COLORS.text,
      trackBackgroundColor: '#0b1423',
      trackBorderColor: COLORS.grid,
    },
    xAxis: {
      lineColor: COLORS.axis,
      tickColor: COLORS.axis,
      gridLineColor: COLORS.grid,
      labels: { style: { color: COLORS.text } },
      crosshair: {
        color: '#2f415a',
        dashStyle: 'Dash',
      },
    },
    yAxis: [
      {
        labels: { align: 'right', x: -3, style: { color: COLORS.text } },
        title: { text: '' },
        lineColor: COLORS.axis,
        gridLineColor: COLORS.grid,
        height: '74%',
        resize: { enabled: true },
      },
      {
        labels: { align: 'right', x: -3, style: { color: COLORS.text } },
        title: { text: '' },
        top: '76%',
        height: '24%',
        offset: 0,
        lineColor: COLORS.axis,
        gridLineColor: COLORS.grid,
      },
    ],
    plotOptions: {
      series: {
        animation: false,
        dataGrouping: { enabled: false },
        turboThreshold: 0,
      },
      candlestick: {
        color: COLORS.down,
        upColor: COLORS.up,
        lineColor: COLORS.down,
        upLineColor: COLORS.up,
        states: {
          hover: {
            lineWidthPlus: 0,
          },
        },
      },
      column: {
        borderWidth: 0,
      },
    },
    tooltip: {
      shared: true,
      useHTML: true,
      backgroundColor: '#0b1729',
      borderColor: COLORS.grid,
      style: { color: '#d1d5db', fontSize: '12px' },
      formatter() {
        const points = this.points || [];
        const candle = points.find((p) => p.series?.type === 'candlestick');
        const volumePoint = points.find((p) => p.series?.name === 'Volume');

        if (!candle || !candle.point) return false;

        const { open, high, low, close } = candle.point;
        const volume = volumePoint?.point?.y ?? 0;

        return `
          <div style="min-width:180px;">
            <div style="margin-bottom:6px;color:${COLORS.text};">${Highcharts.dateFormat('%Y-%m-%d %H:%M', this.x)}</div>
            <div>Open: <b>${Number(open).toFixed(2)}</b></div>
            <div>High: <b>${Number(high).toFixed(2)}</b></div>
            <div>Low: <b>${Number(low).toFixed(2)}</b></div>
            <div>Close: <b>${Number(close).toFixed(2)}</b></div>
            <div>Volume: <b>${Math.round(volume).toLocaleString()}</b></div>
          </div>
        `;
      },
    },
    series: [
      {
        id: 'ohlc',
        type: 'candlestick',
        name: activeSymbol,
        data: seriesData.ohlc,
        zIndex: 2,
      },
      {
        id: 'sma20',
        type: 'line',
        name: 'SMA 20',
        data: sma20,
        color: COLORS.sma20,
        lineWidth: 1.25,
        marker: { enabled: false },
        visible: showSma20,
      },
      {
        id: 'sma50',
        type: 'line',
        name: 'SMA 50',
        data: sma50,
        color: COLORS.sma50,
        lineWidth: 1.25,
        marker: { enabled: false },
        visible: showSma50,
      },
      {
        id: 'volume',
        type: 'column',
        name: 'Volume',
        data: seriesData.volume,
        yAxis: 1,
      },
    ],
  }), [activeSymbol, seriesData.ohlc, seriesData.volume, showSma20, showSma50, sma20, sma50]);

  return (
    <div className="h-full w-full min-h-0 flex flex-col overflow-hidden bg-[#060d18]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1a2332] bg-[#0a1628] px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          {Object.keys(TIMEFRAME_CONFIG).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTimeframe(key)}
              className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                timeframe === key
                  ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-300'
                  : 'border-[#1a2332] bg-[#060d18] text-[#8892a0] hover:border-[#2b3b52] hover:text-white'
              }`}
            >
              {key}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-[#8892a0]">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showSma20}
              onChange={(event) => setShowSma20(event.target.checked)}
              className="h-3.5 w-3.5 accent-sky-400"
            />
            SMA(20)
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showSma50}
              onChange={(event) => setShowSma50(event.target.checked)}
              className="h-3.5 w-3.5 accent-violet-400"
            />
            SMA(50)
          </label>
          <span className={`${isStreaming ? 'text-emerald-400' : stale ? 'text-amber-400' : 'text-[#8892a0]'}`}>
            {isStreaming ? 'Live' : stale ? 'Market Closed' : 'Syncing'}
          </span>
        </div>
      </div>

      <div className="relative flex-1 min-h-0 bg-[#060d18]">
        <HighchartsReact
          highcharts={Highcharts}
          constructorType="stockChart"
          options={chartOptions}
          containerProps={{ style: { width: '100%', height: '100%' } }}
        />

        {loading && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#060d18]/70 text-sm text-[#8892a0]">
            Loading {activeSymbol} data...
          </div>
        )}

        {!loading && error && (
          <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-red-500/30 bg-[#140d14]/80 px-3 py-1.5 text-xs text-red-300">
            {error}
          </div>
        )}
      </div>

      <div className="border-t border-[#1a2332] bg-[#0a1628] px-3 py-1.5 text-right text-[10px] font-semibold tracking-[0.12em] text-[#8892a0]">
        MARKET DATA POWERED BY TWELVE DATA
      </div>
    </div>
  );
}
