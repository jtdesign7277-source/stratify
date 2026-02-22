import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createChart, CandlestickSeries, ColorType, HistogramSeries } from 'lightweight-charts';
import { Plus, Search, X } from 'lucide-react';

const TWELVE_DATA_WS_URL = 'wss://ws.twelvedata.com/v1/quotes/price';
const TWELVE_DATA_REST_URL = 'https://api.twelvedata.com/time_series';

const WATCHLIST_STORAGE_KEY = 'stratify-trader-watchlist';
const DEFAULT_WATCHLIST = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'SPY'];

const CHART_INTERVAL = '5min';
const CHART_INTERVAL_SECONDS = 300;
const RECONNECT_MIN_MS = 1200;
const RECONNECT_MAX_MS = 15000;

const UP_COLOR = '#34d399';
const DOWN_COLOR = '#ef4444';
const VOLUME_UP = 'rgba(52, 211, 153, 0.3)';
const VOLUME_DOWN = 'rgba(239, 68, 68, 0.3)';

const normalizeSymbol = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^\$/, '')
    .replace(/\s+/g, '')
    .split(':')[0]
    .split('.')[0];

const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toUnixSeconds = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (value > 1e12) return Math.floor(value / 1000);
    if (value > 1e10) return Math.floor(value / 1000);
    return Math.floor(value);
  }

  const raw = String(value).trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return toUnixSeconds(Number(raw));

  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  let parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) parsed = Date.parse(`${normalized}Z`);
  if (!Number.isFinite(parsed)) return null;
  return Math.floor(parsed / 1000);
};

const toCandleBar = (item, previousClose = null) => {
  const close = toNumber(item?.close);
  const time = toUnixSeconds(item?.datetime || item?.time || item?.timestamp);
  if (!Number.isFinite(close) || !Number.isFinite(time)) return null;

  const openValue = toNumber(item?.open);
  const highValue = toNumber(item?.high);
  const lowValue = toNumber(item?.low);
  const volumeValue = toNumber(item?.volume) ?? 0;

  const open = Number.isFinite(openValue)
    ? openValue
    : Number.isFinite(previousClose)
      ? previousClose
      : close;

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

const formatPrice = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '--';
  if (Math.abs(amount) >= 1) {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
};

const formatPercent = (value) => {
  const percent = Number(value);
  if (!Number.isFinite(percent)) return '--';
  return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
};

const loadInitialWatchlist = () => {
  if (typeof window === 'undefined') return [...DEFAULT_WATCHLIST];
  try {
    const saved = JSON.parse(localStorage.getItem(WATCHLIST_STORAGE_KEY) || '[]');
    if (!Array.isArray(saved)) return [...DEFAULT_WATCHLIST];
    const normalized = saved.map(normalizeSymbol).filter(Boolean);
    const unique = [...new Set(normalized)];
    return unique.length > 0 ? unique : [...DEFAULT_WATCHLIST];
  } catch {
    return [...DEFAULT_WATCHLIST];
  }
};

export default function TraderPage() {
  const apiKey = import.meta.env.VITE_TWELVE_DATA_API_KEY;
  const initialWatchlist = useMemo(() => loadInitialWatchlist(), []);

  const [watchlist, setWatchlist] = useState(initialWatchlist);
  const [selectedSymbol, setSelectedSymbol] = useState(initialWatchlist[0] || DEFAULT_WATCHLIST[0]);
  const [symbolInput, setSymbolInput] = useState('');
  const [quotesBySymbol, setQuotesBySymbol] = useState({});
  const [streamStatus, setStreamStatus] = useState({
    connected: false,
    connecting: false,
    retryCount: 0,
    error: '',
  });
  const [chartStatus, setChartStatus] = useState({
    loading: true,
    error: '',
  });
  const [chartReady, setChartReady] = useState(false);

  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const lastBarRef = useRef(null);

  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const closedByUserRef = useRef(false);
  const subscribedSymbolsRef = useRef(new Set());
  const watchlistRef = useRef(new Set(initialWatchlist));
  const selectedSymbolRef = useRef(normalizeSymbol(selectedSymbol));

  useEffect(() => {
    selectedSymbolRef.current = normalizeSymbol(selectedSymbol);
  }, [selectedSymbol]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    const normalized = watchlist.map(normalizeSymbol).filter(Boolean);
    watchlistRef.current = new Set(normalized);

    if (normalized.length === 0) {
      setSelectedSymbol('');
      return;
    }

    if (!normalized.includes(normalizeSymbol(selectedSymbol))) {
      setSelectedSymbol(normalized[0]);
    }
  }, [watchlist, selectedSymbol]);

  const filteredWatchlist = useMemo(() => {
    const query = normalizeSymbol(symbolInput);
    if (!query) return watchlist;
    return watchlist.filter((symbol) => symbol.includes(query));
  }, [watchlist, symbolInput]);

  const selectedQuote = selectedSymbol ? quotesBySymbol[selectedSymbol] : null;

  const applyPriceToChart = useCallback((symbol, price, timestamp) => {
    if (!Number.isFinite(price)) return;
    if (normalizeSymbol(symbol) !== selectedSymbolRef.current) return;
    if (!candleSeriesRef.current) return;

    const timeSeconds = toUnixSeconds(timestamp) || Math.floor(Date.now() / 1000);
    const bucketTime = Math.floor(timeSeconds / CHART_INTERVAL_SECONDS) * CHART_INTERVAL_SECONDS;
    const previous = lastBarRef.current;

    if (!previous || !Number.isFinite(previous.time)) {
      const initialBar = {
        time: bucketTime,
        open: price,
        high: price,
        low: price,
        close: price,
        volume: 0,
      };
      lastBarRef.current = initialBar;
      candleSeriesRef.current.update(initialBar);
      volumeSeriesRef.current?.update({
        time: initialBar.time,
        value: 0,
        color: VOLUME_UP,
      });
      return;
    }

    if (bucketTime > previous.time) {
      const nextBar = {
        time: bucketTime,
        open: previous.close,
        high: price,
        low: price,
        close: price,
        volume: 0,
      };
      lastBarRef.current = nextBar;

      candleSeriesRef.current.update(nextBar);
      volumeSeriesRef.current?.update({
        time: nextBar.time,
        value: 0,
        color: nextBar.close >= nextBar.open ? VOLUME_UP : VOLUME_DOWN,
      });
      return;
    }

    if (bucketTime < previous.time) return;

    const updatedBar = {
      ...previous,
      close: price,
      high: Math.max(previous.high, price),
      low: Math.min(previous.low, price),
    };

    lastBarRef.current = updatedBar;
    candleSeriesRef.current.update(updatedBar);
    volumeSeriesRef.current?.update({
      time: updatedBar.time,
      value: Number.isFinite(updatedBar.volume) ? updatedBar.volume : 0,
      color: updatedBar.close >= updatedBar.open ? VOLUME_UP : VOLUME_DOWN,
    });
  }, []);

  useEffect(() => {
    if (!chartContainerRef.current) return undefined;

    const chart = createChart(chartContainerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: '#0b0b0b' },
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
        borderColor: '#1f1f1f',
        scaleMargins: { top: 0.08, bottom: 0.2 },
      },
      timeScale: {
        borderColor: '#1f1f1f',
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 3,
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
      scaleMargins: { top: 0.82, bottom: 0 },
      borderVisible: false,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    setChartReady(true);

    return () => {
      setChartReady(false);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      lastBarRef.current = null;
    };
  }, []);

  const loadCandles = useCallback(async (symbol) => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;

    const normalized = normalizeSymbol(symbol);
    if (!normalized) {
      candleSeriesRef.current.setData([]);
      volumeSeriesRef.current.setData([]);
      lastBarRef.current = null;
      setChartStatus({ loading: false, error: 'Add a ticker to load chart data.' });
      return;
    }

    if (!apiKey) {
      candleSeriesRef.current.setData([]);
      volumeSeriesRef.current.setData([]);
      lastBarRef.current = null;
      setChartStatus({ loading: false, error: 'Missing VITE_TWELVE_DATA_API_KEY.' });
      return;
    }

    setChartStatus({ loading: true, error: '' });

    try {
      const params = new URLSearchParams({
        symbol: normalized,
        interval: CHART_INTERVAL,
        outputsize: '320',
        format: 'JSON',
        apikey: apiKey,
      });

      const response = await fetch(`${TWELVE_DATA_REST_URL}?${params.toString()}`, {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload?.status === 'error') {
        throw new Error(payload?.message || payload?.code || 'Failed to load chart data.');
      }

      const values = Array.isArray(payload?.values) ? payload.values : [];
      let previousClose = null;
      const parsed = values
        .map((entry) => {
          const bar = toCandleBar(entry, previousClose);
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

      if (deduped.length === 0) {
        candleSeriesRef.current.setData([]);
        volumeSeriesRef.current.setData([]);
        lastBarRef.current = null;
        setChartStatus({ loading: false, error: 'No candles returned for this symbol.' });
        return;
      }

      candleSeriesRef.current.setData(
        deduped.map((bar) => ({
          time: bar.time,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
        }))
      );

      volumeSeriesRef.current.setData(
        deduped.map((bar) => ({
          time: bar.time,
          value: Number.isFinite(bar.volume) ? bar.volume : 0,
          color: bar.close >= bar.open ? VOLUME_UP : VOLUME_DOWN,
        }))
      );

      chartRef.current?.timeScale().fitContent();
      lastBarRef.current = deduped[deduped.length - 1];
      setChartStatus({ loading: false, error: '' });
    } catch (error) {
      setChartStatus({
        loading: false,
        error: error?.message || 'Failed to load chart data.',
      });
    }
  }, [apiKey]);

  useEffect(() => {
    if (!chartReady) return;
    loadCandles(selectedSymbol);
  }, [chartReady, selectedSymbol, loadCandles]);

  useEffect(() => {
    const symbols = watchlist.map(normalizeSymbol).filter(Boolean);
    const nextWatchlistSet = new Set(symbols);
    watchlistRef.current = nextWatchlistSet;

    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const subscribed = subscribedSymbolsRef.current;
    const toSubscribe = symbols.filter((symbol) => !subscribed.has(symbol));
    const toUnsubscribe = [...subscribed].filter((symbol) => !nextWatchlistSet.has(symbol));

    if (toSubscribe.length > 0) {
      ws.send(
        JSON.stringify({
          action: 'subscribe',
          params: { symbols: toSubscribe.join(',') },
        })
      );
      toSubscribe.forEach((symbol) => subscribed.add(symbol));
    }

    if (toUnsubscribe.length > 0) {
      ws.send(
        JSON.stringify({
          action: 'unsubscribe',
          params: { symbols: toUnsubscribe.join(',') },
        })
      );
      toUnsubscribe.forEach((symbol) => subscribed.delete(symbol));
    }
  }, [watchlist]);

  useEffect(() => {
    if (!apiKey) {
      setStreamStatus({
        connected: false,
        connecting: false,
        retryCount: 0,
        error: 'Missing VITE_TWELVE_DATA_API_KEY.',
      });
      return undefined;
    }

    closedByUserRef.current = false;

    const clearReconnectTimer = () => {
      if (!reconnectTimerRef.current) return;
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    };

    const dispatchPrice = (payload) => {
      const symbol = normalizeSymbol(payload?.symbol || payload?.meta?.symbol);
      if (!symbol) return;

      const price = toNumber(payload?.price ?? payload?.close ?? payload?.last);
      if (!Number.isFinite(price)) return;

      const rawChange = toNumber(payload?.change);
      const rawPercent = toNumber(payload?.percent_change ?? payload?.percentChange);

      setQuotesBySymbol((previous) => {
        const previousQuote = previous[symbol] || {};
        const previousPrice = toNumber(previousQuote?.price);

        const change = Number.isFinite(rawChange)
          ? rawChange
          : Number.isFinite(previousPrice)
            ? price - previousPrice
            : null;

        const changePercent = Number.isFinite(rawPercent)
          ? rawPercent
          : Number.isFinite(change) && Number.isFinite(price - change) && price - change !== 0
            ? (change / (price - change)) * 100
            : null;

        return {
          ...previous,
          [symbol]: {
            symbol,
            price,
            change,
            changePercent,
            timestamp: payload?.timestamp || payload?.datetime || Date.now(),
          },
        };
      });

      applyPriceToChart(symbol, price, payload?.timestamp || payload?.datetime);
    };

    const handlePayload = (payload) => {
      if (!payload) return;

      if (Array.isArray(payload)) {
        payload.forEach((entry) => handlePayload(entry));
        return;
      }

      if (payload?.event === 'price') {
        dispatchPrice(payload);
        return;
      }

      if (payload?.symbol && (payload?.price || payload?.close || payload?.last)) {
        dispatchPrice(payload);
        return;
      }

      if (payload?.event === 'error') {
        setStreamStatus((previous) => ({
          ...previous,
          error: payload?.message || 'Twelve Data stream error.',
        }));
      }
    };

    const scheduleReconnect = (connect) => {
      if (closedByUserRef.current || reconnectTimerRef.current) return;

      reconnectAttemptsRef.current += 1;
      const delay = Math.min(
        RECONNECT_MAX_MS,
        RECONNECT_MIN_MS * 2 ** Math.min(reconnectAttemptsRef.current - 1, 5),
      );

      setStreamStatus((previous) => ({
        ...previous,
        connected: false,
        connecting: false,
        retryCount: reconnectAttemptsRef.current,
      }));

      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, delay);
    };

    const connect = () => {
      if (closedByUserRef.current) return;

      setStreamStatus((previous) => ({
        ...previous,
        connecting: true,
        error: '',
      }));

      const ws = new WebSocket(`${TWELVE_DATA_WS_URL}?apikey=${apiKey}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (wsRef.current !== ws) return;

        reconnectAttemptsRef.current = 0;
        subscribedSymbolsRef.current.clear();

        setStreamStatus({
          connected: true,
          connecting: false,
          retryCount: 0,
          error: '',
        });

        const symbols = [...watchlistRef.current];
        if (symbols.length > 0) {
          ws.send(
            JSON.stringify({
              action: 'subscribe',
              params: { symbols: symbols.join(',') },
            })
          );
          symbols.forEach((symbol) => subscribedSymbolsRef.current.add(symbol));
        }
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data || '{}');
          handlePayload(payload);
        } catch {
          setStreamStatus((previous) => ({
            ...previous,
            error: 'Failed to parse Twelve Data message.',
          }));
        }
      };

      ws.onerror = () => {
        setStreamStatus((previous) => ({
          ...previous,
          error: 'Twelve Data websocket error.',
        }));
      };

      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;

        setStreamStatus((previous) => ({
          ...previous,
          connected: false,
          connecting: false,
        }));

        if (!closedByUserRef.current) {
          scheduleReconnect(connect);
        }
      };
    };

    connect();

    return () => {
      closedByUserRef.current = true;
      clearReconnectTimer();
      subscribedSymbolsRef.current.clear();
      reconnectAttemptsRef.current = 0;

      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) {
        try {
          ws.close(1000, 'Trader page cleanup');
        } catch {}
      }
    };
  }, [apiKey, applyPriceToChart]);

  const addSymbol = (event) => {
    event.preventDefault();
    const normalized = normalizeSymbol(symbolInput);
    if (!normalized) return;

    setWatchlist((previous) => {
      if (previous.includes(normalized)) return previous;
      return [...previous, normalized];
    });
    setSelectedSymbol(normalized);
    setSymbolInput('');
  };

  const removeSymbol = (symbolToRemove) => {
    const normalized = normalizeSymbol(symbolToRemove);
    setWatchlist((previous) => previous.filter((symbol) => symbol !== normalized));
    setQuotesBySymbol((previous) => {
      if (!previous[normalized]) return previous;
      const next = { ...previous };
      delete next[normalized];
      return next;
    });
  };

  const streamLabel = streamStatus.connected
    ? 'Connected'
    : streamStatus.connecting
      ? 'Connecting...'
      : streamStatus.retryCount > 0
        ? `Reconnecting (${streamStatus.retryCount})`
        : 'Disconnected';

  return (
    <div className="h-full w-full bg-[#0b0b0b] text-[#e5e7eb]">
      <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-5">
        <aside className="flex min-h-0 flex-col border-b border-[#1f1f1f] lg:col-span-2 lg:border-b-0 lg:border-r">
          <div className="border-b border-[#1f1f1f] px-4 py-3">
            <h2 className="text-sm font-medium text-white">Watchlist</h2>
            <p className="mt-1 text-xs text-[#7c8087]">Search, add, and stream symbols in real time.</p>
          </div>

          <form onSubmit={addSymbol} className="border-b border-[#1f1f1f] px-4 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7280]" strokeWidth={1.5} />
              <input
                value={symbolInput}
                onChange={(event) => setSymbolInput(event.target.value)}
                placeholder="Search or add ticker (AAPL)"
                className="h-10 w-full border border-[#1f1f1f] bg-[#0b0b0b] pl-9 pr-3 text-sm text-white outline-none transition-colors focus:border-emerald-500/70"
              />
            </div>
            <button
              type="submit"
              className="mt-2 inline-flex h-9 items-center gap-2 border border-[#1f1f1f] px-3 text-sm text-[#d1d5db] transition-colors hover:border-emerald-500/60 hover:text-emerald-300"
            >
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Add ticker
            </button>
          </form>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-[#1f1f1f] px-4 py-2 text-xs">
              <span className="text-[#9ca3af]">Stream: {streamLabel}</span>
              {streamStatus.error ? (
                <span className="text-red-400">{streamStatus.error}</span>
              ) : (
                <span className="text-emerald-400">{watchlist.length} symbols</span>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {filteredWatchlist.length === 0 ? (
                <div className="px-4 py-5 text-sm text-[#6b7280]">No symbols match your search.</div>
              ) : (
                filteredWatchlist.map((symbol) => {
                  const quote = quotesBySymbol[symbol];
                  const changePercent = toNumber(quote?.changePercent);
                  const changeClass = !Number.isFinite(changePercent)
                    ? 'text-[#6b7280]'
                    : changePercent >= 0
                      ? 'text-emerald-400'
                      : 'text-red-400';

                  return (
                    <div
                      key={symbol}
                      className={`flex items-stretch border-b border-[#1f1f1f] ${
                        symbol === selectedSymbol ? 'bg-emerald-500/6' : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedSymbol(symbol)}
                        className={`flex min-w-0 flex-1 items-center justify-between px-4 py-3 text-left transition-colors ${
                          symbol === selectedSymbol ? 'border-l-2 border-emerald-500 pl-[14px]' : 'border-l-2 border-transparent'
                        } hover:bg-white/[0.02]`}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-white">{symbol}</div>
                          <div className="text-xs text-[#9ca3af]">{formatPrice(quote?.price)}</div>
                        </div>
                        <div className={`pl-3 text-xs font-medium tabular-nums ${changeClass}`}>
                          {formatPercent(changePercent)}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSymbol(symbol)}
                        className="border-l border-[#1f1f1f] px-3 text-[#6b7280] transition-colors hover:text-red-400"
                        aria-label={`Remove ${symbol}`}
                      >
                        <X className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        <section className="flex min-h-0 flex-col lg:col-span-3">
          <div className="flex items-center justify-between border-b border-[#1f1f1f] px-4 py-3">
            <div>
              <h2 className="text-sm font-medium text-white">{selectedSymbol || 'Select a symbol'}</h2>
              <p className="mt-1 text-xs text-[#7c8087]">Candlestick chart · {CHART_INTERVAL}</p>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold tabular-nums text-white">{formatPrice(selectedQuote?.price)}</div>
              <div
                className={`text-xs font-medium tabular-nums ${
                  Number.isFinite(Number(selectedQuote?.changePercent))
                    ? Number(selectedQuote?.changePercent) >= 0
                      ? 'text-emerald-400'
                      : 'text-red-400'
                    : 'text-[#6b7280]'
                }`}
              >
                {formatPercent(selectedQuote?.changePercent)}
              </div>
            </div>
          </div>

          <div className="relative min-h-[260px] flex-1">
            <div ref={chartContainerRef} className="h-full w-full" />

            {chartStatus.loading && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#0b0b0b]/55 text-sm text-[#9ca3af]">
                Loading candles...
              </div>
            )}

            {!chartStatus.loading && chartStatus.error && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#0b0b0b]/65 px-6 text-center text-sm text-[#9ca3af]">
                {chartStatus.error}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
