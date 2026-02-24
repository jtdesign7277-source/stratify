import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Grid from '@highcharts/grid-lite';
import { Plus, RefreshCw, X } from 'lucide-react';
import { getExtendedHoursStatus, isMarketOpen } from '../../lib/marketHours';
import '@highcharts/grid-lite/css/grid.css';
import './AnalyticsWatchlistGrid.css';

const WATCHLIST_STORAGE_KEY = 'stratify-analytics-grid-watchlist';
const TWELVE_DATA_WS_URL = 'wss://ws.twelvedata.com/v1/quotes/price';
const TWELVE_DATA_API_KEY = import.meta.env.VITE_TWELVE_DATA_API_KEY;

const DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'SPY', 'QQQ'];
const MAX_SYMBOLS = 120;
const QUOTE_POLL_INTERVAL_MS = 20000;

const normalizeSymbol = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^\$/, '')
    .replace(/\s+/g, '')
    .split(':')
    .pop();

const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatPrice = (value) => {
  const number = toNumber(value);
  if (!Number.isFinite(number)) return '--';
  return `$${number.toFixed(2)}`;
};

const formatSignedPercent = (value) => {
  const number = toNumber(value);
  if (!Number.isFinite(number)) return '--';
  return `${number >= 0 ? '+' : ''}${number.toFixed(2)}%`;
};

const formatTimestamp = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const getCurrentSession = () => {
  const extended = getExtendedHoursStatus();
  if (extended === 'pre-market') return 'Pre-Market';
  if (extended === 'post-market') return 'After-Hours';
  if (isMarketOpen()) return 'Live';
  return 'Closed';
};

const extractInputSymbols = (value) =>
  String(value || '')
    .split(',')
    .map((item) => normalizeSymbol(item))
    .filter(Boolean);

const extractWatchlistSymbols = (watchlist = []) => {
  const source = Array.isArray(watchlist) ? watchlist : [];
  return source
    .map((entry) => (typeof entry === 'string' ? entry : entry?.symbol))
    .map((entry) => normalizeSymbol(entry))
    .filter(Boolean);
};

const loadStoredSymbols = (fallbackSymbols = DEFAULT_SYMBOLS) => {
  if (typeof window === 'undefined') return fallbackSymbols;
  try {
    const raw = JSON.parse(localStorage.getItem(WATCHLIST_STORAGE_KEY) || '[]');
    const source = Array.isArray(raw) ? raw : [];
    const cleaned = source.map((symbol) => normalizeSymbol(symbol)).filter(Boolean);
    if (cleaned.length > 0) return cleaned.slice(0, MAX_SYMBOLS);
  } catch {}
  return fallbackSymbols.slice(0, MAX_SYMBOLS);
};

const getAfterHoursValue = (quote = {}, field = 'price') => {
  if (field === 'price') {
    return toNumber(
      quote?.afterHoursPrice
      ?? quote?.after_hours_price
      ?? quote?.postMarketPrice
      ?? quote?.post_market_price
      ?? quote?.postmarket_price
      ?? quote?.postmarketPrice
    );
  }
  if (field === 'change') {
    return toNumber(
      quote?.afterHoursChange
      ?? quote?.after_hours_change
      ?? quote?.postMarketChange
      ?? quote?.post_market_change
      ?? quote?.postmarket_change
      ?? quote?.postmarketChange
    );
  }
  return toNumber(
    quote?.afterHoursChangePercent
    ?? quote?.after_hours_change_percent
    ?? quote?.postMarketChangePercent
    ?? quote?.post_market_change_percent
    ?? quote?.postmarket_change_percent
    ?? quote?.postmarketChangePercent
  );
};

export default function AnalyticsPage({ watchlist = [] }) {
  const seedSymbols = useMemo(() => {
    const fromWatchlist = extractWatchlistSymbols(watchlist);
    return fromWatchlist.length > 0 ? fromWatchlist : DEFAULT_SYMBOLS;
  }, [watchlist]);

  const [symbols, setSymbols] = useState(() => loadStoredSymbols(seedSymbols));
  const [quotesBySymbol, setQuotesBySymbol] = useState({});
  const [symbolInput, setSymbolInput] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [marketSession, setMarketSession] = useState(getCurrentSession);
  const [inlineFiltering, setInlineFiltering] = useState(true);
  const gridRef = useRef(null);

  useEffect(() => {
    if (symbols.length > 0) return;
    if (seedSymbols.length === 0) return;
    setSymbols(seedSymbols.slice(0, MAX_SYMBOLS));
  }, [seedSymbols, symbols.length]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(symbols));
  }, [symbols]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMarketSession(getCurrentSession());
    }, 60000);
    return () => window.clearInterval(timer);
  }, []);

  const fetchQuotes = useCallback(async () => {
    if (symbols.length === 0) {
      setQuotesBySymbol({});
      return;
    }

    setIsFetching(true);
    setFetchError('');

    try {
      const response = await fetch('/api/watchlist/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load watchlist quotes');
      }

      const data = Array.isArray(payload?.data) ? payload.data : [];
      const incomingBySymbol = {};

      data.forEach((row) => {
        const symbol = normalizeSymbol(row?.symbol);
        if (!symbol) return;

        const raw = row?.raw && typeof row.raw === 'object' ? row.raw : {};
        const previousClose = toNumber(
          row?.previousClose
          ?? raw?.previous_close
          ?? raw?.previousClose
          ?? raw?.prev_close
          ?? raw?.prevClose
        );
        const price = toNumber(row?.price);
        const preMarketPrice = toNumber(row?.preMarketPrice);
        const preMarketChange = toNumber(row?.preMarketChange);
        const preMarketChangePercent = toNumber(row?.preMarketChangePercent);
        const afterHoursPrice = getAfterHoursValue(row, 'price');
        const afterHoursChange = getAfterHoursValue(row, 'change');
        const afterHoursChangePercent = getAfterHoursValue(row, 'percent');

        incomingBySymbol[symbol] = {
          symbol,
          name: String(row?.name || symbol).trim(),
          exchange: String(row?.exchange || '').trim(),
          price,
          change: toNumber(row?.change),
          percentChange: toNumber(row?.percentChange),
          previousClose,
          preMarketPrice,
          preMarketChange,
          preMarketChangePercent,
          afterHoursPrice,
          afterHoursChange,
          afterHoursChangePercent,
          timestamp: row?.timestamp || new Date().toISOString(),
        };
      });

      setQuotesBySymbol((previous) => {
        const next = {};
        symbols.forEach((symbol) => {
          const normalized = normalizeSymbol(symbol);
          next[normalized] = incomingBySymbol[normalized] || previous[normalized] || { symbol: normalized };
        });
        return next;
      });
    } catch (error) {
      setFetchError(error?.message || 'Failed to load watchlist quotes');
    } finally {
      setIsFetching(false);
    }
  }, [symbols]);

  useEffect(() => {
    fetchQuotes();
    const timer = window.setInterval(fetchQuotes, QUOTE_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [fetchQuotes]);

  useEffect(() => {
    if (!TWELVE_DATA_API_KEY || symbols.length === 0) return undefined;

    let socket = null;
    let reconnectTimer = null;
    let closedManually = false;

    const connect = () => {
      socket = new WebSocket(`${TWELVE_DATA_WS_URL}?apikey=${encodeURIComponent(TWELVE_DATA_API_KEY)}`);

      socket.onopen = () => {
        socket?.send(JSON.stringify({ action: 'subscribe', params: { symbols } }));
      };

      socket.onmessage = (event) => {
        let payload;
        try {
          payload = JSON.parse(event.data);
        } catch {
          return;
        }

        if (payload?.event !== 'price') return;

        const symbol = normalizeSymbol(payload?.symbol);
        const livePrice = toNumber(payload?.price ?? payload?.close ?? payload?.last);
        if (!symbol || !Number.isFinite(livePrice)) return;

        setQuotesBySymbol((previous) => {
          const current = previous[symbol];
          if (!current) return previous;

          const next = {
            ...current,
            price: livePrice,
            timestamp: payload?.timestamp || new Date().toISOString(),
          };

          const previousClose = toNumber(current?.previousClose);
          const extended = getExtendedHoursStatus();

          if (extended === 'pre-market' && Number.isFinite(previousClose) && previousClose !== 0) {
            const change = livePrice - previousClose;
            next.preMarketPrice = livePrice;
            next.preMarketChange = change;
            next.preMarketChangePercent = (change / previousClose) * 100;
          }

          if (extended === 'post-market' && Number.isFinite(previousClose) && previousClose !== 0) {
            const change = livePrice - previousClose;
            next.afterHoursPrice = livePrice;
            next.afterHoursChange = change;
            next.afterHoursChangePercent = (change / previousClose) * 100;
          }

          return {
            ...previous,
            [symbol]: next,
          };
        });
      };

      socket.onclose = () => {
        if (closedManually) return;
        reconnectTimer = window.setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      closedManually = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      if (socket) socket.close();
    };
  }, [symbols]);

  const rows = useMemo(() => {
    return symbols.map((symbol, index) => {
      const normalized = normalizeSymbol(symbol);
      const quote = quotesBySymbol[normalized] || {};
      return {
        id: index + 1,
        symbol: normalized,
        price: formatPrice(quote.price),
        dayChangePercent: formatSignedPercent(quote.percentChange),
        preMarketPrice: formatPrice(quote.preMarketPrice),
        preMarketChangePercent: formatSignedPercent(quote.preMarketChangePercent),
        afterHoursPrice: formatPrice(quote.afterHoursPrice),
        afterHoursChangePercent: formatSignedPercent(quote.afterHoursChangePercent),
        session: marketSession,
        updatedAt: formatTimestamp(quote.timestamp),
      };
    });
  }, [marketSession, quotesBySymbol, symbols]);

  const dataTable = useMemo(() => ({
    columns: {
      id: rows.map((row) => row.id),
      symbol: rows.map((row) => row.symbol),
      price: rows.map((row) => row.price),
      dayChangePercent: rows.map((row) => row.dayChangePercent),
      preMarketPrice: rows.map((row) => row.preMarketPrice),
      preMarketChangePercent: rows.map((row) => row.preMarketChangePercent),
      afterHoursPrice: rows.map((row) => row.afterHoursPrice),
      afterHoursChangePercent: rows.map((row) => row.afterHoursChangePercent),
      session: rows.map((row) => row.session),
      updatedAt: rows.map((row) => row.updatedAt),
    },
  }), [rows]);

  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.destroy();
      gridRef.current = null;
    }

    const grid = Grid.grid('container', {
      dataTable,
      columnDefaults: {
        filtering: {
          enabled: true,
          inline: inlineFiltering,
        },
      },
      columns: [
        { id: 'id', width: 56 },
        { id: 'symbol', width: 96 },
        { id: 'price', width: 112 },
        { id: 'dayChangePercent', width: 122 },
        { id: 'preMarketPrice', width: 122 },
        { id: 'preMarketChangePercent', width: 126 },
        { id: 'afterHoursPrice', width: 122 },
        { id: 'afterHoursChangePercent', width: 130 },
        { id: 'session', width: 112 },
        { id: 'updatedAt', width: 116 },
      ],
      rendering: {
        rows: {
          strictHeights: false,
        },
      },
    });

    gridRef.current = grid;

    return () => {
      if (gridRef.current) {
        gridRef.current.destroy();
        gridRef.current = null;
      }
    };
  }, [dataTable, inlineFiltering]);

  useEffect(() => {
    const toggle = document.getElementById('inlineToggle');
    if (!toggle) return undefined;

    const handleInlineToggle = (event) => {
      const nextValue = Boolean(event?.target?.checked);
      setInlineFiltering(nextValue);
      gridRef.current?.update({
        columnDefaults: {
          filtering: {
            inline: nextValue,
          },
        },
      });
    };

    toggle.addEventListener('change', handleInlineToggle);
    return () => {
      toggle.removeEventListener('change', handleInlineToggle);
    };
  }, []);

  const addSymbols = useCallback((items = []) => {
    const normalized = items.map((item) => normalizeSymbol(item)).filter(Boolean);
    if (normalized.length === 0) return;

    setSymbols((previous) => {
      const seen = new Set(previous.map((item) => normalizeSymbol(item)));
      const next = [...previous];
      normalized.forEach((symbol) => {
        if (seen.has(symbol)) return;
        if (next.length >= MAX_SYMBOLS) return;
        seen.add(symbol);
        next.push(symbol);
      });
      return next;
    });
  }, []);

  const handleAddTicker = (event) => {
    event.preventDefault();
    const incoming = extractInputSymbols(symbolInput);
    if (incoming.length === 0) return;
    addSymbols(incoming);
    setSymbolInput('');
  };

  const removeSymbol = (symbol) => {
    const normalized = normalizeSymbol(symbol);
    if (!normalized) return;
    setSymbols((previous) => previous.filter((item) => normalizeSymbol(item) !== normalized));
    setQuotesBySymbol((previous) => {
      const next = { ...previous };
      delete next[normalized];
      return next;
    });
  };

  return (
    <div className="analytics-watchlist-page h-full w-full px-6 py-5">
      <section className="analytics-watchlist-shell">
        <div className="analytics-watchlist-header">
          <div>
            <div className="analytics-watchlist-kicker">Analytics Watchlist</div>
            <h1 className="analytics-watchlist-title">Highcharts Grid Watchlist</h1>
            <p className="analytics-watchlist-subtitle">
              Live price, pre-market, and after-hours pricing in one table.
            </p>
          </div>

          <div className="analytics-watchlist-actions">
            <label className="analytics-inline-toggle">
              <input id="inlineToggle" type="checkbox" defaultChecked={inlineFiltering} />
              Inline filters
            </label>
            <button
              type="button"
              className="analytics-refresh-btn"
              onClick={fetchQuotes}
              disabled={isFetching}
              title="Refresh quotes"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        <form className="analytics-add-ticker-form" onSubmit={handleAddTicker}>
          <input
            value={symbolInput}
            onChange={(event) => setSymbolInput(event.target.value)}
            placeholder="Add ticker(s), e.g. AMD, QQQ, SPY"
            className="analytics-add-input"
          />
          <button type="submit" className="analytics-add-btn">
            <Plus className="h-4 w-4" />
            Add
          </button>
        </form>

        <div className="analytics-symbol-chips">
          {symbols.map((symbol) => (
            <button
              key={symbol}
              type="button"
              className="analytics-symbol-chip"
              onClick={() => removeSymbol(symbol)}
              title={`Remove ${symbol}`}
            >
              {symbol}
              <X className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>

        {fetchError && <div className="analytics-watchlist-error">{fetchError}</div>}

        <div id="container" className="analytics-watchlist-grid" />
      </section>
    </div>
  );
}
