import React, { useEffect, useRef, useState, useCallback } from 'react';
import 'highcharts/css/stocktools/gui.css';
import 'highcharts/css/annotations/popup.css';
import Highcharts from 'highcharts/highstock';
import StockTools from 'highcharts/modules/stock-tools';
import AnnotationsAdvanced from 'highcharts/modules/annotations-advanced';
import PriceIndicator from 'highcharts/modules/price-indicator';
import FullScreen from 'highcharts/modules/full-screen';
import Heikinashi from 'highcharts/modules/heikinashi';
import HollowCandlestick from 'highcharts/modules/hollowcandlestick';

// Init modules once
StockTools(Highcharts);
AnnotationsAdvanced(Highcharts);
PriceIndicator(Highcharts);
FullScreen(Highcharts);
Heikinashi(Highcharts);
HollowCandlestick(Highcharts);

const TWELVE_DATA_KEY = import.meta.env.VITE_TWELVE_DATA_API_KEY;
const WS_URL = 'wss://ws.twelvedata.com/v1/quotes/price';

// Dark theme for Highcharts
Highcharts.setOptions({
  chart: {
    backgroundColor: 'transparent',
    style: { fontFamily: 'JetBrains Mono, ui-monospace, monospace' },
  },
  title: { style: { color: '#e5e7eb' } },
  subtitle: { style: { color: '#9ca3af' } },
  xAxis: {
    gridLineColor: '#1f2937',
    lineColor: '#1f2937',
    tickColor: '#1f2937',
    labels: { style: { color: '#9ca3af', fontSize: '10px' } },
  },
  yAxis: {
    gridLineColor: '#1f2937',
    lineColor: '#1f2937',
    labels: { style: { color: '#9ca3af', fontSize: '10px' } },
  },
  tooltip: {
    backgroundColor: 'rgba(10, 15, 26, 0.92)',
    borderColor: '#374151',
    style: { color: '#e5e7eb', fontSize: '11px' },
  },
  rangeSelector: {
    buttonTheme: {
      fill: 'rgba(255,255,255,0.05)',
      stroke: '#374151',
      'stroke-width': 1,
      style: { color: '#9ca3af', fontSize: '10px' },
      states: {
        hover: { fill: 'rgba(16,185,129,0.15)', style: { color: '#34d399' } },
        select: { fill: 'rgba(16,185,129,0.2)', stroke: '#10b981', style: { color: '#34d399' } },
      },
    },
    inputStyle: { color: '#e5e7eb', backgroundColor: '#111827', borderColor: '#374151' },
    labelStyle: { color: '#9ca3af' },
  },
  navigator: {
    handles: { backgroundColor: '#374151', borderColor: '#6b7280' },
    maskFill: 'rgba(16,185,129,0.08)',
    series: { color: '#10b981', lineColor: '#10b981' },
    xAxis: { gridLineColor: '#1f2937', labels: { style: { color: '#6b7280' } } },
  },
  scrollbar: {
    barBackgroundColor: '#374151',
    barBorderColor: '#374151',
    buttonBackgroundColor: '#1f2937',
    buttonBorderColor: '#374151',
    trackBackgroundColor: '#111827',
    trackBorderColor: '#1f2937',
  },
  plotOptions: {
    candlestick: {
      color: '#ef4444',
      upColor: '#10b981',
      lineColor: '#ef4444',
      upLineColor: '#10b981',
    },
    column: {
      borderWidth: 0,
    },
  },
});

// Fetch historical OHLCV from Twelve Data REST
async function fetchHistorical(symbol, interval = '1day', outputsize = 200) {
  const url = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=${interval}&outputsize=${outputsize}&apikey=${TWELVE_DATA_KEY}&format=JSON`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status === 'error') throw new Error(data.message || 'Twelve Data error');

  const values = (data.values || []).reverse(); // oldest first
  const ohlc = [];
  const volume = [];

  for (const v of values) {
    const ts = new Date(v.datetime).getTime();
    ohlc.push([ts, +v.open, +v.high, +v.low, +v.close]);
    volume.push([ts, +v.volume]);
  }

  return { ohlc, volume };
}

export default function HighchartsStockLive({ symbol = 'NVDA', interval = '1day' }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const wsRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const destroyChart = useCallback(() => {
    if (chartRef.current) {
      try { chartRef.current.destroy(); } catch {}
      chartRef.current = null;
    }
  }, []);

  const disconnectWs = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setLoading(true);
      setError('');
      destroyChart();
      disconnectWs();

      try {
        const { ohlc, volume } = await fetchHistorical(symbol, interval);
        if (cancelled) return;

        // Calculate overscroll based on interval
        const intervalMs = interval.includes('min')
          ? parseInt(interval) * 60 * 1000
          : interval === '1h' ? 3600000
          : interval === '4h' ? 14400000
          : 86400000; // 1day default
        const overscrollMs = 30 * intervalMs;

        const chart = Highcharts.stockChart(containerRef.current, {
          chart: {
            animation: false,
            height: null, // fill container
          },
          stockTools: {
            gui: {
              enabled: true,
              buttons: [
                'indicators', 'separator',
                'simpleShapes', 'lines', 'crookedLines', 'measure', 'advanced', 'separator',
                'toggleAnnotations', 'separator',
                'verticalLabels', 'flags', 'separator',
                'zoomChange', 'fullScreen', 'separator',
                'currentPriceIndicator',
              ],
            },
          },
          navigation: {
            bindingsClassName: 'highcharts-stock-tools-wrapper',
            iconsURL: 'https://code.highcharts.com/12.1.2/gfx/stock-icons/',
          },
          xAxis: {
            overscroll: overscrollMs,
            ordinal: true,
          },
          yAxis: [{
            labels: { align: 'left', x: 6 },
            height: '78%',
            resize: { enabled: true },
            crosshair: { snap: false, label: { enabled: true, format: '{value:.2f}' } },
          }, {
            labels: { align: 'left', x: 6 },
            top: '80%',
            height: '20%',
            offset: 0,
          }],
          rangeSelector: {
            selected: 4,
            buttons: [
              { type: 'day', count: 1, text: '1D' },
              { type: 'week', count: 1, text: '1W' },
              { type: 'month', count: 1, text: '1M' },
              { type: 'month', count: 3, text: '3M' },
              { type: 'month', count: 6, text: '6M' },
              { type: 'year', count: 1, text: '1Y' },
              { type: 'all', text: 'All' },
            ],
          },
          tooltip: {
            shape: 'square',
            headerShape: 'callout',
            borderWidth: 0,
            shadow: false,
            split: true,
          },
          series: [{
            type: 'candlestick',
            id: `${symbol}-ohlc`,
            name: `${symbol}`,
            data: ohlc,
            dataGrouping: { groupPixelWidth: 20 },
            lastPrice: { enabled: true, color: '#10b981', label: { enabled: true, backgroundColor: '#10b981' } },
          }, {
            type: 'column',
            id: `${symbol}-volume`,
            name: 'Volume',
            data: volume,
            yAxis: 1,
            color: 'rgba(16, 185, 129, 0.3)',
            dataGrouping: { groupPixelWidth: 20 },
          }],
          responsive: {
            rules: [{
              condition: { maxWidth: 800 },
              chartOptions: { rangeSelector: { inputEnabled: false } },
            }],
          },
          credits: { enabled: false },
        });

        chartRef.current = chart;
        setLoading(false);

        // Connect WebSocket for live updates
        const ws = new WebSocket(`${WS_URL}?apikey=${TWELVE_DATA_KEY}`);
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(JSON.stringify({
            action: 'subscribe',
            params: { symbols: symbol },
          }));
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.event === 'price' && msg.symbol === symbol && chartRef.current) {
              const ts = msg.timestamp * 1000;
              const price = parseFloat(msg.price);
              const ohlcSeries = chartRef.current.get(`${symbol}-ohlc`);
              if (ohlcSeries && ohlcSeries.points?.length) {
                const last = ohlcSeries.points[ohlcSeries.points.length - 1];
                if (last) {
                  // Update the last candle with the new price
                  const newHigh = Math.max(last.high, price);
                  const newLow = Math.min(last.low, price);
                  last.update({ high: newHigh, low: newLow, close: price }, true);
                }
              }
            }
          } catch {}
        };

        ws.onerror = () => {};
        ws.onclose = () => {};

      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load chart data');
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      destroyChart();
      disconnectWs();
    };
  }, [symbol, interval, destroyChart, disconnectWs]);

  // Resize handler
  useEffect(() => {
    const onResize = () => {
      if (chartRef.current) chartRef.current.reflow();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="w-full h-full relative">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <div className="w-4 h-4 border-2 border-emerald-500/40 border-t-emerald-400 rounded-full animate-spin" />
            Loading {symbol}...
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="text-red-400 text-sm">{error}</div>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
