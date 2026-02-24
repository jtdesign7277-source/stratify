import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Grid from '@highcharts/grid-lite';
import { ChevronDown, Link2, Plus, RefreshCw, Share2, X } from 'lucide-react';
import { getExtendedHoursStatus, isMarketOpen } from '../../lib/marketHours';
import '@highcharts/grid-lite/css/grid.css';
import './AnalyticsWatchlistGrid.css';

const WATCHLIST_STORAGE_KEY = 'stratify-analytics-grid-watchlist';
const TWELVE_DATA_WS_URL = 'wss://ws.twelvedata.com/v1/quotes/price';
const TWELVE_DATA_API_KEY = import.meta.env.VITE_TWELVE_DATA_API_KEY;

const DEFAULT_SYMBOLS = ['NDQ', 'SPX', 'DJI', 'DXY', 'VIX', 'SOFI', 'HIMS', 'FUBO', 'NIO', 'PYPL'];
const MAX_SYMBOLS = 120;
const QUOTE_POLL_INTERVAL_MS = 20000;
const OVERVIEW_TABS = ['Overview', 'Earnings', 'Dividends', 'News'];
const DATA_TABS = ['Price', 'Financials', 'Performance', 'Risk', 'Technicals'];
const SESSION_LABELS = {
  regular: 'Live',
  premarket: 'Pre',
  postmarket: 'After',
  closed: 'Closed',
};

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

const formatSignedPercent = (value) => {
  const number = toNumber(value);
  if (!Number.isFinite(number)) return '--';
  return `${number >= 0 ? '+' : ''}${number.toFixed(2)}%`;
};

const formatPriceWithCurrency = (value) => {
  const number = toNumber(value);
  if (!Number.isFinite(number)) return '--';
  return `${number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
};

const formatPriceNumber = (value) => {
  const number = toNumber(value);
  if (!Number.isFinite(number)) return '--';
  return number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatSignedUsd = (value) => {
  const number = toNumber(value);
  if (!Number.isFinite(number)) return '--';
  return `${number >= 0 ? '+' : ''}${number.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} USD`;
};

const formatSignedNumber = (value) => {
  const number = toNumber(value);
  if (!Number.isFinite(number)) return '--';
  return `${number >= 0 ? '+' : ''}${number.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatCompactPlain = (value) => {
  const number = toNumber(value);
  if (!Number.isFinite(number)) return '--';
  if (Math.abs(number) >= 1e9) return `${(number / 1e9).toFixed(2)} B`;
  if (Math.abs(number) >= 1e6) return `${(number / 1e6).toFixed(2)} M`;
  if (Math.abs(number) >= 1e3) return `${(number / 1e3).toFixed(2)} K`;
  return number.toLocaleString('en-US');
};

const formatCompactUsd = (value) => {
  const number = toNumber(value);
  if (!Number.isFinite(number)) return '--';
  if (Math.abs(number) >= 1e12) return `${(number / 1e12).toFixed(2)} T USD`;
  if (Math.abs(number) >= 1e9) return `${(number / 1e9).toFixed(2)} B USD`;
  if (Math.abs(number) >= 1e6) return `${(number / 1e6).toFixed(2)} M USD`;
  return `${number.toLocaleString('en-US')} USD`;
};

const formatTimestamp = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const inferMarketSession = () => {
  const extended = getExtendedHoursStatus();
  if (extended === 'pre-market') return 'premarket';
  if (extended === 'post-market') return 'postmarket';
  if (isMarketOpen()) return 'regular';
  return 'closed';
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

const deriveChangePair = (price, rawChange, rawPercent, previousClose) => {
  let change = toNumber(rawChange);
  let percent = toNumber(rawPercent);

  if (!Number.isFinite(change) && Number.isFinite(price) && Number.isFinite(previousClose)) {
    change = price - previousClose;
  }
  if (!Number.isFinite(percent) && Number.isFinite(change) && Number.isFinite(previousClose) && previousClose !== 0) {
    percent = (change / previousClose) * 100;
  }
  if (!Number.isFinite(change) && Number.isFinite(percent) && Number.isFinite(previousClose)) {
    change = previousClose * (percent / 100);
  }

  return {
    change: Number.isFinite(change) ? change : null,
    percent: Number.isFinite(percent) ? percent : null,
  };
};

const inferExtendedFromLive = (price, previousClose) => {
  if (!Number.isFinite(price) || !Number.isFinite(previousClose) || previousClose === 0) {
    return { change: null, percent: null };
  }
  const change = price - previousClose;
  return {
    change,
    percent: (change / previousClose) * 100,
  };
};

const getDisplayQuote = (quote = {}, session = 'regular') => {
  const price = toNumber(quote?.price);
  const previousClose = toNumber(quote?.previousClose);
  const sessionLabel = SESSION_LABELS[session] || SESSION_LABELS.regular;

  const regular = deriveChangePair(price, quote?.change, quote?.percentChange, previousClose);
  const pre = deriveChangePair(
    toNumber(quote?.preMarketPrice),
    quote?.preMarketChange,
    quote?.preMarketChangePercent,
    previousClose
  );
  const post = deriveChangePair(
    toNumber(quote?.afterHoursPrice),
    quote?.afterHoursChange,
    quote?.afterHoursChangePercent,
    previousClose
  );

  if (session === 'premarket' && Number.isFinite(toNumber(quote?.preMarketPrice))) {
    return {
      sessionLabel,
      price: toNumber(quote?.preMarketPrice),
      change: pre.change,
      percentChange: pre.percent,
    };
  }

  if (session === 'postmarket' && Number.isFinite(toNumber(quote?.afterHoursPrice))) {
    return {
      sessionLabel,
      price: toNumber(quote?.afterHoursPrice),
      change: post.change,
      percentChange: post.percent,
    };
  }

  return {
    sessionLabel,
    price,
    change: regular.change,
    percentChange: regular.percent,
  };
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
  const [sessionMode, setSessionMode] = useState(inferMarketSession);
  const [overviewTab, setOverviewTab] = useState('Overview');
  const [dataTab, setDataTab] = useState('Price');
  const [inlineFiltering, setInlineFiltering] = useState(true);
  const [showCurrency, setShowCurrency] = useState(true);
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
      setSessionMode(inferMarketSession());
    }, 45000);
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
        const regular = deriveChangePair(price, row?.change, row?.percentChange, previousClose);

        const preMarketPrice = toNumber(row?.preMarketPrice);
        const preMarket = deriveChangePair(
          preMarketPrice,
          row?.preMarketChange,
          row?.preMarketChangePercent,
          previousClose
        );

        const afterHoursPrice = getAfterHoursValue(row, 'price');
        const afterHours = deriveChangePair(
          afterHoursPrice,
          getAfterHoursValue(row, 'change'),
          getAfterHoursValue(row, 'percent'),
          previousClose
        );

        incomingBySymbol[symbol] = {
          symbol,
          name: String(row?.name || symbol).trim(),
          exchange: String(row?.exchange || '').trim(),
          price,
          change: regular.change,
          percentChange: regular.percent,
          previousClose,
          preMarketPrice,
          preMarketChange: preMarket.change,
          preMarketChangePercent: preMarket.percent,
          afterHoursPrice,
          afterHoursChange: afterHours.change,
          afterHoursChangePercent: afterHours.percent,
          volume: toNumber(row?.volume ?? raw?.volume ?? raw?.day_volume),
          avgVolume10: toNumber(
            row?.avgVolume10
            ?? raw?.average_volume_10d
            ?? raw?.average_volume
            ?? raw?.avg_volume
            ?? raw?.avgVolume
          ),
          marketCap: toNumber(row?.marketCap ?? raw?.market_cap ?? raw?.marketCap),
          timestamp: row?.timestamp || raw?.datetime || raw?.timestamp || new Date().toISOString(),
        };
      });

      setQuotesBySymbol((previous) => {
        const next = {};
        symbols.forEach((symbol) => {
          const normalized = normalizeSymbol(symbol);
          next[normalized] = incomingBySymbol[normalized] || previous[normalized] || {
            symbol: normalized,
            name: normalized,
          };
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
          const regular = inferExtendedFromLive(livePrice, previousClose);
          if (Number.isFinite(regular.change)) next.change = regular.change;
          if (Number.isFinite(regular.percent)) next.percentChange = regular.percent;

          const extended = getExtendedHoursStatus();
          if (extended === 'pre-market') {
            if (Number.isFinite(regular.change)) next.preMarketChange = regular.change;
            if (Number.isFinite(regular.percent)) next.preMarketChangePercent = regular.percent;
            next.preMarketPrice = livePrice;
          } else if (extended === 'post-market') {
            if (Number.isFinite(regular.change)) next.afterHoursChange = regular.change;
            if (Number.isFinite(regular.percent)) next.afterHoursChangePercent = regular.percent;
            next.afterHoursPrice = livePrice;
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
      const quote = quotesBySymbol[normalized] || { symbol: normalized, name: normalized };
      const display = getDisplayQuote(quote, sessionMode);

      return {
        row: index + 1,
        ticker: normalized,
        company: quote?.name || normalized,
        last: showCurrency ? formatPriceWithCurrency(display.price) : formatPriceNumber(display.price),
        chgPercent: formatSignedPercent(display.percentChange),
        chg: showCurrency ? formatSignedUsd(display.change) : formatSignedNumber(display.change),
        volume: formatCompactPlain(quote?.volume),
        avgVol10: formatCompactPlain(quote?.avgVolume10),
        marketCap: showCurrency ? formatCompactUsd(quote?.marketCap) : formatCompactPlain(quote?.marketCap),
        session: display.sessionLabel,
        updated: formatTimestamp(quote?.timestamp),
      };
    });
  }, [quotesBySymbol, sessionMode, showCurrency, symbols]);

  const dataTable = useMemo(() => ({
    columns: {
      row: rows.map((row) => row.row),
      ticker: rows.map((row) => row.ticker),
      company: rows.map((row) => row.company),
      last: rows.map((row) => row.last),
      chgPercent: rows.map((row) => row.chgPercent),
      chg: rows.map((row) => row.chg),
      volume: rows.map((row) => row.volume),
      avgVol10: rows.map((row) => row.avgVol10),
      marketCap: rows.map((row) => row.marketCap),
      session: rows.map((row) => row.session),
      updated: rows.map((row) => row.updated),
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
        { id: 'row', width: 56, title: '#' },
        { id: 'ticker', width: 98, title: 'Ticker' },
        { id: 'company', width: 270, title: 'Company' },
        { id: 'last', width: 156, title: 'Last' },
        { id: 'chgPercent', width: 118, title: 'Chg%' },
        { id: 'chg', width: 132, title: 'Chg' },
        { id: 'volume', width: 120, title: 'Volume' },
        { id: 'avgVol10', width: 122, title: 'Avg Vol (10)' },
        { id: 'marketCap', width: 140, title: 'Market Cap' },
        { id: 'session', width: 100, title: 'Session' },
        { id: 'updated', width: 118, title: 'Updated' },
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
    <div className="analytics-tv-page h-full w-full">
      <section className="analytics-tv-shell">
        <header className="analytics-tv-header">
          <div>
            <h1 className="analytics-tv-title">
              Watchlist <ChevronDown className="h-5 w-5 text-slate-300" />
            </h1>
            <p className="analytics-tv-description-link">Add description</p>
          </div>
          <div className="analytics-tv-top-actions">
            <button type="button" className="analytics-tv-icon-btn" title="Share list">
              <Share2 className="h-4 w-4" />
            </button>
            <button type="button" className="analytics-tv-icon-btn" title="Copy link">
              <Link2 className="h-4 w-4" />
            </button>
          </div>
        </header>

        <nav className="analytics-tv-nav-tabs">
          {OVERVIEW_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setOverviewTab(tab)}
              className={`analytics-tv-tab ${overviewTab === tab ? 'is-active' : ''}`}
            >
              {tab}
            </button>
          ))}
        </nav>

        <div className="analytics-tv-toolbar">
          <div>
            <h2 className="analytics-tv-symbols-title">Symbols</h2>
            <div className="analytics-tv-symbol-count">
              {symbols.length} symbols · Session {SESSION_LABELS[sessionMode] || SESSION_LABELS.regular}
            </div>
          </div>
          <div className="analytics-tv-toolbar-actions">
            <label className="analytics-tv-currency-toggle">
              Currency in USD
              <input
                type="checkbox"
                checked={showCurrency}
                onChange={(event) => setShowCurrency(event.target.checked)}
              />
            </label>
            <label className="analytics-tv-currency-toggle">
              Inline filters
              <input id="inlineToggle" type="checkbox" defaultChecked={inlineFiltering} />
            </label>
            <button
              type="button"
              className="analytics-tv-refresh-btn"
              onClick={fetchQuotes}
              disabled={isFetching}
              title="Refresh quotes"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="analytics-tv-subtabs">
          {DATA_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setDataTab(tab)}
              className={`analytics-tv-tab-pill ${dataTab === tab ? 'is-active' : ''}`}
            >
              {tab}
            </button>
          ))}
        </div>

        <form className="analytics-tv-add-ticker-form" onSubmit={handleAddTicker}>
          <input
            value={symbolInput}
            onChange={(event) => setSymbolInput(event.target.value)}
            placeholder="Add ticker(s), e.g. SOFI, AMD, PLTR"
            className="analytics-tv-add-input"
          />
          <button type="submit" className="analytics-tv-add-btn">
            <Plus className="h-4 w-4" />
            Add
          </button>
        </form>

        <div className="analytics-tv-chips">
          {symbols.map((symbol) => (
            <button
              key={symbol}
              type="button"
              className="analytics-tv-chip"
              onClick={() => removeSymbol(symbol)}
              title={`Remove ${symbol}`}
            >
              {symbol}
              <X className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>

        {fetchError && <div className="analytics-tv-error">{fetchError}</div>}

        <div id="container" className="analytics-tv-grid" />
      </section>
    </div>
  );
}
