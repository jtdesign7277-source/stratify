import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import indicators from 'highcharts/indicators/indicators-all';
import annotationsAdvanced from 'highcharts/modules/annotations-advanced';
import priceIndicator from 'highcharts/modules/price-indicator';
import fullScreen from 'highcharts/modules/full-screen';
import dragPanes from 'highcharts/modules/drag-panes';
import stockTools from 'highcharts/modules/stock-tools';
import 'highcharts/css/stocktools/gui.css';
import {
  ChevronDown,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Search,
} from 'lucide-react';
import useAnalyticsPrefs from '../../hooks/useAnalyticsPrefs';

// Initialize Highcharts modules (idempotent)
indicators(Highcharts);
annotationsAdvanced(Highcharts);
priceIndicator(Highcharts);
fullScreen(Highcharts);
dragPanes(Highcharts);
stockTools(Highcharts);

// ── Constants ──────────────────────────────────────────────────────────
const TWELVE_DATA_REST = 'https://api.twelvedata.com/time_series';
const TWELVE_DATA_WS_URL = 'wss://ws.twelvedata.com/v1/quotes/price';

const INTERVALS = [
  { label: '1m', value: '1min' },
  { label: '5m', value: '5min' },
  { label: '15m', value: '15min' },
  { label: '1H', value: '1h' },
  { label: '1D', value: '1day' },
];

const INDICATOR_DEFS = [
  { id: 'sma20', label: 'SMA 20', type: 'sma', params: { period: 20 }, overlay: true },
  { id: 'sma50', label: 'SMA 50', type: 'sma', params: { period: 50 }, overlay: true },
  { id: 'sma200', label: 'SMA 200', type: 'sma', params: { period: 200 }, overlay: true },
  { id: 'ema12', label: 'EMA 12', type: 'ema', params: { period: 12 }, overlay: true },
  { id: 'ema26', label: 'EMA 26', type: 'ema', params: { period: 26 }, overlay: true },
  { id: 'bb', label: 'Bollinger', type: 'bb', params: { period: 20, standardDeviation: 2 }, overlay: true },
  { id: 'rsi', label: 'RSI 14', type: 'rsi', params: { period: 14 }, overlay: false },
  { id: 'macd', label: 'MACD', type: 'macd', params: { shortPeriod: 12, longPeriod: 26, signalPeriod: 9, period: 26 }, overlay: false },
  { id: 'volume', label: 'Volume', type: 'volume', overlay: false },
];

const SMA_COLORS = { 20: '#f59e0b', 50: '#3b82f6', 200: '#a855f7' };
const EMA_COLORS = { 12: '#ec4899', 26: '#14b8a6' };

const resolveApiKey = () =>
  import.meta.env.VITE_TWELVE_DATA_API_KEY ||
  import.meta.env.VITE_TWELVE_DATA_APIKEY ||
  import.meta.env.VITE_TWELVEDATA_API_KEY ||
  '';

const toNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

const normalizeSymbol = (v) => String(v || '').trim().replace(/^\$/, '').toUpperCase();

// ── Component ──────────────────────────────────────────────────────────
const AnalyticsPage = ({
  watchlist = [],
  alpacaData = {},
  tradeHistory = [],
  savedStrategies = [],
  deployedStrategies = [],
}) => {
  const { prefs, updatePrefs } = useAnalyticsPrefs();
  const chartRef = useRef(null);
  const wsRef = useRef(null);
  const requestIdRef = useRef(0);

  const [symbol, setSymbol] = useState(() => {
    if (prefs.symbol) return prefs.symbol;
    const first = watchlist?.[0];
    return normalizeSymbol(typeof first === 'string' ? first : first?.symbol) || 'AAPL';
  });
  const [interval, setInterval_] = useState(prefs.interval || '1day');
  const [activeIndicators, setActiveIndicators] = useState(prefs.indicators || ['sma20', 'volume']);
  const [ohlcData, setOhlcData] = useState([]);
  const [volumeData, setVolumeData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [indicatorDropdown, setIndicatorDropdown] = useState(false);

  const apiKey = useMemo(resolveApiKey, []);

  // Sync prefs
  useEffect(() => { updatePrefs({ symbol }); }, [symbol]);
  useEffect(() => { updatePrefs({ interval }); }, [interval]);
  useEffect(() => { updatePrefs({ indicators: activeIndicators }); }, [activeIndicators]);

  // ── Fetch historical data ──
  useEffect(() => {
    let cancelled = false;
    const id = ++requestIdRef.current;

    const load = async () => {
      setLoading(true);
      setError('');
      if (!apiKey) { setError('Missing API key'); setLoading(false); return; }

      try {
        const url = `${TWELVE_DATA_REST}?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=500&apikey=${apiKey}&format=JSON&order=ASC`;
        const res = await fetch(url, { cache: 'no-store' });
        const json = await res.json();
        if (cancelled || id !== requestIdRef.current) return;
        if (json.status === 'error') throw new Error(json.message || 'API error');

        const values = json.values || [];
        const ohlc = [];
        const vol = [];
        values.forEach((v) => {
          const ts = new Date(v.datetime).getTime();
          if (isNaN(ts)) return;
          const o = +v.open, h = +v.high, l = +v.low, c = +v.close, vl = +(v.volume || 0);
          ohlc.push([ts, o, h, l, c]);
          vol.push([ts, vl]);
        });
        setOhlcData(ohlc);
        setVolumeData(vol);
        setLoading(false);
      } catch (err) {
        if (!cancelled && id === requestIdRef.current) {
          setError(err.message);
          setLoading(false);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [symbol, interval, apiKey]);

  // ── WebSocket live ticks ──
  useEffect(() => {
    if (!apiKey || !ohlcData.length) return;
    let ws = null;
    let cancelled = false;

    const connect = () => {
      ws = new WebSocket(`${TWELVE_DATA_WS_URL}?apikey=${encodeURIComponent(apiKey)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        ws.send(JSON.stringify({ action: 'subscribe', params: { symbols: symbol } }));
      };

      ws.onmessage = (evt) => {
        if (cancelled) return;
        try {
          const d = JSON.parse(evt.data);
          if (d.event && d.event !== 'price') return;
          const msgSym = String(d.symbol || '').toUpperCase();
          if (msgSym !== symbol && msgSym.split(':')[0] !== symbol) return;
          const price = toNum(d.price ?? d.close ?? d.last);
          if (!price) return;
          const ts = d.timestamp ? d.timestamp * 1000 : Date.now();

          // Update last candle in chart
          const chart = chartRef.current?.chart;
          if (!chart) return;
          const series = chart.series[0]; // ohlc series
          if (!series || !series.points?.length) return;
          const last = series.points[series.points.length - 1];
          if (!last) return;
          last.update({
            high: Math.max(last.high, price),
            low: Math.min(last.low, price),
            close: price,
          }, true);
        } catch { /* ignore */ }
      };
    };

    connect();
    return () => {
      cancelled = true;
      if (ws) {
        try { ws.send(JSON.stringify({ action: 'unsubscribe', params: { symbols: symbol } })); } catch {}
        ws.close();
      }
      wsRef.current = null;
    };
  }, [symbol, apiKey, ohlcData.length]);

  // ── Trade markers ──
  const tradeFlags = useMemo(() => {
    if (!tradeHistory?.length) return [];
    return tradeHistory
      .filter((t) => normalizeSymbol(t?.symbol || t?.ticker) === symbol)
      .map((t) => {
        const ts = new Date(t.timestamp || t.time || t.date || t.filled_at || t.created_at).getTime();
        if (isNaN(ts)) return null;
        const side = String(t.side || t.type || t.action || '').toLowerCase();
        const isBuy = side.includes('buy') || side === 'long';
        return {
          x: ts,
          title: isBuy ? 'B' : 'S',
          text: `${isBuy ? 'Buy' : 'Sell'} ${t.shares || t.qty || ''} @ $${toNum(t.price)?.toFixed(2) || '?'}`,
          color: isBuy ? '#22c55e' : '#ef4444',
          fillColor: isBuy ? '#22c55e' : '#ef4444',
          style: { color: '#fff' },
        };
      })
      .filter(Boolean);
  }, [tradeHistory, symbol]);

  // ── Position info ──
  const position = useMemo(() => {
    const positions = alpacaData?.positions || [];
    return positions.find((p) => normalizeSymbol(p.symbol) === symbol);
  }, [alpacaData, symbol]);

  // ── Toggle indicator ──
  const toggleIndicator = useCallback((id) => {
    setActiveIndicators((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

  // ── Build Highcharts options ──
  const chartOptions = useMemo(() => {
    if (!ohlcData.length) return null;

    let yAxisIndex = 2; // 0=price, 1=volume
    const yAxes = [
      { labels: { align: 'right', x: -3, style: { color: '#8892a0' } }, title: { text: '' }, height: '60%', lineWidth: 1, lineColor: '#1f1f1f', gridLineColor: '#1a2332', resize: { enabled: true }, opposite: true },
      { labels: { align: 'right', x: -3, style: { color: '#8892a0' } }, title: { text: '' }, top: '63%', height: '12%', offset: 0, lineWidth: 1, lineColor: '#1f1f1f', gridLineColor: '#1a2332', opposite: true },
    ];

    const series = [
      {
        type: 'candlestick',
        name: symbol,
        id: 'ohlc',
        data: ohlcData,
        color: '#ef4444',
        upColor: '#22c55e',
        lineColor: '#ef4444',
        upLineColor: '#22c55e',
        zIndex: 2,
      },
    ];

    // Volume
    if (activeIndicators.includes('volume')) {
      series.push({
        type: 'column',
        name: 'Volume',
        id: 'vol',
        data: volumeData,
        yAxis: 1,
        color: 'rgba(34,197,94,0.3)',
        zIndex: 0,
      });
    }

    // Overlay indicators
    activeIndicators.forEach((id) => {
      const def = INDICATOR_DEFS.find((d) => d.id === id);
      if (!def || def.id === 'volume') return;

      if (def.overlay) {
        const indicatorSeries = {
          type: def.type,
          linkedTo: 'ohlc',
          params: { ...def.params },
          zIndex: 1,
        };
        if (def.type === 'sma') {
          indicatorSeries.color = SMA_COLORS[def.params.period] || '#f59e0b';
          indicatorSeries.name = `SMA ${def.params.period}`;
        } else if (def.type === 'ema') {
          indicatorSeries.color = EMA_COLORS[def.params.period] || '#ec4899';
          indicatorSeries.name = `EMA ${def.params.period}`;
        } else if (def.type === 'bb') {
          indicatorSeries.color = '#6366f1';
          indicatorSeries.name = 'Bollinger Bands';
        }
        series.push(indicatorSeries);
      } else {
        // Separate pane
        const paneIdx = yAxisIndex++;
        const prevBottom = yAxes.length === 2 ? 75 : 75 + (paneIdx - 2) * 13;
        const paneHeight = '12%';
        const paneTop = `${prevBottom}%`;

        yAxes.push({
          labels: { align: 'right', x: -3, style: { color: '#8892a0' } },
          title: { text: '' },
          top: paneTop,
          height: paneHeight,
          offset: 0,
          lineWidth: 1,
          lineColor: '#1f1f1f',
          gridLineColor: '#1a2332',
          opposite: true,
        });

        if (def.type === 'rsi') {
          series.push({
            type: 'rsi',
            linkedTo: 'ohlc',
            yAxis: paneIdx,
            params: { period: def.params.period },
            color: '#f59e0b',
            name: 'RSI 14',
            zones: [
              { value: 30, color: '#ef4444' },
              { value: 70, color: '#f59e0b' },
              { color: '#22c55e' },
            ],
          });
        } else if (def.type === 'macd') {
          series.push({
            type: 'macd',
            linkedTo: 'ohlc',
            yAxis: paneIdx,
            params: def.params,
            name: 'MACD',
            color: '#3b82f6',
            signalLine: { styles: { lineColor: '#f59e0b' } },
            macdLine: { styles: { lineColor: '#3b82f6' } },
          });
        }
      }
    });

    // Adjust pane heights dynamically
    const separatePanes = activeIndicators.filter((id) => {
      const d = INDICATOR_DEFS.find((x) => x.id === id);
      return d && !d.overlay && d.id !== 'volume';
    }).length;
    const hasVolume = activeIndicators.includes('volume');
    const priceHeight = Math.max(35, 70 - separatePanes * 13);
    const volumeHeight = hasVolume ? 12 : 0;

    yAxes[0].height = `${priceHeight}%`;
    if (hasVolume) {
      yAxes[1].top = `${priceHeight + 2}%`;
      yAxes[1].height = `${volumeHeight}%`;
    } else {
      yAxes[1].height = '0%';
      yAxes[1].top = `${priceHeight}%`;
    }

    let nextTop = priceHeight + (hasVolume ? volumeHeight + 3 : 2);
    for (let i = 2; i < yAxes.length; i++) {
      yAxes[i].top = `${nextTop}%`;
      yAxes[i].height = '12%';
      nextTop += 14;
    }

    // Trade flags
    if (tradeFlags.length) {
      series.push({
        type: 'flags',
        data: tradeFlags,
        onSeries: 'ohlc',
        shape: 'flag',
        width: 16,
        style: { fontSize: '10px' },
        states: { hover: { fillColor: '#1f1f1f' } },
      });
    }

    return {
      chart: {
        backgroundColor: 'transparent',
        style: { fontFamily: 'Inter, system-ui, sans-serif' },
        spacing: [10, 10, 10, 10],
      },
      credits: { enabled: false },
      navigator: {
        enabled: true,
        series: { color: '#22c55e', lineWidth: 1 },
        xAxis: { gridLineColor: '#1a2332', labels: { style: { color: '#8892a0' } } },
        maskFill: 'rgba(34,197,94,0.08)',
        outlineColor: '#1f1f1f',
      },
      scrollbar: { enabled: false },
      rangeSelector: {
        enabled: true,
        inputEnabled: false,
        buttonTheme: {
          fill: 'transparent',
          stroke: '#1f1f1f',
          'stroke-width': 1,
          style: { color: '#8892a0', fontWeight: '500', fontSize: '11px' },
          states: {
            hover: { fill: 'rgba(34,197,94,0.15)', style: { color: '#22c55e' } },
            select: { fill: 'rgba(34,197,94,0.2)', style: { color: '#22c55e', fontWeight: '600' } },
          },
        },
        buttons: [
          { type: 'day', count: 1, text: '1D' },
          { type: 'week', count: 1, text: '1W' },
          { type: 'month', count: 1, text: '1M' },
          { type: 'month', count: 3, text: '3M' },
          { type: 'month', count: 6, text: '6M' },
          { type: 'year', count: 1, text: '1Y' },
          { type: 'all', text: 'All' },
        ],
        selected: interval === '1day' ? 4 : 6,
        labelStyle: { color: '#8892a0' },
      },
      xAxis: {
        gridLineColor: '#1a2332',
        lineColor: '#1f1f1f',
        tickColor: '#1f1f1f',
        labels: { style: { color: '#8892a0' } },
        crosshair: { color: 'rgba(136,146,160,0.3)', dashStyle: 'Dash' },
      },
      yAxis: yAxes,
      tooltip: {
        backgroundColor: 'rgba(6,13,24,0.95)',
        borderColor: '#1f1f1f',
        borderRadius: 8,
        style: { color: '#e5e7eb', fontSize: '12px' },
        split: true,
      },
      plotOptions: {
        candlestick: {
          lineColor: '#ef4444',
          upLineColor: '#22c55e',
          color: '#ef4444',
          upColor: '#22c55e',
        },
        series: {
          dataGrouping: { enabled: true },
        },
      },
      stockTools: {
        gui: {
          enabled: true,
          buttons: [
            'indicators',
            'separator',
            'simpleShapes',
            'lines',
            'crookedLines',
            'measure',
            'advanced',
            'toggleAnnotations',
            'separator',
            'verticalLabels',
            'flags',
            'separator',
            'zoomChange',
            'fullScreen',
            'separator',
            'currentPriceIndicator',
          ],
          toolbarClassName: 'highcharts-stocktools-toolbar',
        },
      },
      navigation: {
        bindingsClassName: 'tools-container',
        annotationsOptions: {
          shapeOptions: {
            stroke: '#22c55e',
            strokeWidth: 1,
            fill: 'rgba(34,197,94,0.1)',
          },
        },
      },
      series,
    };
  }, [ohlcData, volumeData, activeIndicators, symbol, tradeFlags, interval]);

  // ── Symbol change handler ──
  const handleSymbolChange = useCallback((newSymbol) => {
    const s = normalizeSymbol(newSymbol);
    if (s) setSymbol(s);
    setSearchOpen(false);
    setSearchText('');
  }, []);

  // ── Watchlist items ──
  const watchlistSymbols = useMemo(() => {
    if (!watchlist?.length) return [];
    return watchlist.map((w) => normalizeSymbol(typeof w === 'string' ? w : w?.symbol)).filter(Boolean);
  }, [watchlist]);

  const filteredWatchlist = useMemo(() => {
    if (!searchText) return watchlistSymbols;
    const q = searchText.toUpperCase();
    return watchlistSymbols.filter((s) => s.includes(q));
  }, [watchlistSymbols, searchText]);

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent overflow-hidden">
      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[#1f1f1f] flex-shrink-0">
        {/* Symbol selector */}
        <div className="relative">
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="flex items-center gap-1.5 text-white font-semibold text-base hover:text-emerald-400 transition-colors"
          >
            <Search className="w-4 h-4 text-gray-500" strokeWidth={1.5} />
            {symbol}
            <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
          </button>
          {searchOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 w-56 bg-[#0d1117] border border-[#1f1f1f] rounded-lg shadow-xl overflow-hidden">
              <input
                autoFocus
                type="text"
                placeholder="Search symbol..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchText.trim()) handleSymbolChange(searchText);
                  if (e.key === 'Escape') setSearchOpen(false);
                }}
                className="w-full px-3 py-2 bg-transparent text-white text-sm outline-none border-b border-[#1f1f1f] placeholder:text-gray-600"
              />
              <div className="max-h-48 overflow-y-auto">
                {filteredWatchlist.length === 0 && searchText && (
                  <button
                    onClick={() => handleSymbolChange(searchText)}
                    className="w-full px-3 py-2 text-left text-sm text-emerald-400 hover:bg-white/5"
                  >
                    Go to {searchText.toUpperCase()}
                  </button>
                )}
                {filteredWatchlist.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSymbolChange(s)}
                    className={`w-full px-3 py-1.5 text-left text-sm hover:bg-white/5 transition-colors ${
                      s === symbol ? 'text-emerald-400' : 'text-gray-300'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Interval buttons */}
        <div className="flex items-center gap-0.5 ml-2">
          {INTERVALS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setInterval_(opt.value)}
              className={`px-2.5 py-1 text-xs font-medium transition-colors ${
                interval === opt.value
                  ? 'text-emerald-400'
                  : 'text-gray-500 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Indicator toggles */}
        <div className="relative ml-auto">
          <button
            onClick={() => setIndicatorDropdown(!indicatorDropdown)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
          >
            <BarChart3 className="w-3.5 h-3.5" strokeWidth={1.5} />
            Indicators ({activeIndicators.length})
            <ChevronDown className="w-3 h-3" />
          </button>
          {indicatorDropdown && (
            <div className="absolute top-full right-0 mt-1 z-50 w-52 bg-[#0d1117] border border-[#1f1f1f] rounded-lg shadow-xl py-1">
              {INDICATOR_DEFS.map((def) => (
                <button
                  key={def.id}
                  onClick={() => toggleIndicator(def.id)}
                  className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between hover:bg-white/5 transition-colors ${
                    activeIndicators.includes(def.id) ? 'text-emerald-400' : 'text-gray-400'
                  }`}
                >
                  {def.label}
                  {activeIndicators.includes(def.id) && <span className="text-emerald-400">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Position info */}
        {position && (
          <div className="flex items-center gap-3 ml-4 text-xs">
            <span className="text-gray-500">Position:</span>
            <span className="text-white font-medium">{position.qty || position.quantity} shares</span>
            {(() => {
              const pnl = toNum(position.unrealized_pl ?? position.unrealizedPnl);
              if (pnl === null) return null;
              return (
                <span className={`flex items-center gap-0.5 font-medium ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {pnl >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                </span>
              );
            })()}
          </div>
        )}
      </div>

      {/* ── Chart area ── */}
      <div className="flex-1 relative min-h-0">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-gray-400 text-sm">Loading {symbol}...</div>
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="text-red-400 text-sm">{error}</div>
          </div>
        )}
        {chartOptions && (
          <HighchartsReact
            highcharts={Highcharts}
            constructorType="stockChart"
            options={chartOptions}
            ref={chartRef}
            containerProps={{ style: { width: '100%', height: '100%' } }}
          />
        )}
      </div>

      {/* Click-outside close for dropdowns */}
      {(searchOpen || indicatorDropdown) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => { setSearchOpen(false); setIndicatorDropdown(false); }}
        />
      )}
    </div>
  );
};

export default AnalyticsPage;
