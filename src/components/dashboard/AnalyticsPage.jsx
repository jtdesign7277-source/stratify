import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Grid from '@highcharts/grid-lite';
import { Plus, Search, X } from 'lucide-react';
import '@highcharts/grid-lite/css/grid.css';
import './AnalyticsWatchlistGrid.css';

const WATCHLIST_STORAGE_KEY = 'stratify-analytics-grid-watchlist';
const TWELVE_DATA_WS_URL = 'wss://ws.twelvedata.com/v1/quotes/price';
const TWELVE_DATA_API_KEY = import.meta.env.VITE_TWELVE_DATA_API_KEY;
const MAX_SYMBOLS = 120;
const QUOTE_POLL_INTERVAL_MS = 20000;
const DEFAULT_SYMBOLS = ['SOFI', 'HIMS', 'FUBO', 'NIO', 'PYPL', 'NVDA', 'AAPL', 'PLTR', 'AMD'];

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
  return number.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatSigned = (value) => {
  const number = toNumber(value);
  if (!Number.isFinite(number)) return '--';
  return `${number >= 0 ? '+' : ''}${number.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatSignedPercent = (value) => {
  const number = toNumber(value);
  if (!Number.isFinite(number)) return '--';
  return `${number >= 0 ? '+' : ''}${number.toFixed(2)}%`;
};

const formatVolume = (value) => {
  const number = toNumber(value);
  if (!Number.isFinite(number)) return '--';
  if (Math.abs(number) >= 1e9) return `${(number / 1e9).toFixed(2)}B`;
  if (Math.abs(number) >= 1e6) return `${(number / 1e6).toFixed(2)}M`;
  if (Math.abs(number) >= 1e3) return `${(number / 1e3).toFixed(2)}K`;
  return number.toLocaleString('en-US');
};

const deriveChangeAndPercent = (quote = {}) => {
  const price = toNumber(quote?.price);
  const previousClose = toNumber(quote?.previousClose);

  let change = toNumber(quote?.change);
  let percent = toNumber(quote?.percentChange);

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

const loadStoredSymbols = () => {
  if (typeof window === 'undefined') return DEFAULT_SYMBOLS;
  try {
    const raw = JSON.parse(localStorage.getItem(WATCHLIST_STORAGE_KEY) || '[]');
    const source = Array.isArray(raw) ? raw : [];
    const cleaned = source.map((symbol) => normalizeSymbol(symbol)).filter(Boolean);
    if (cleaned.length > 0) return cleaned.slice(0, MAX_SYMBOLS);
  } catch {}
  return DEFAULT_SYMBOLS;
};

const extractInputSymbols = (value) =>
  String(value || '')
    .split(',')
    .map((item) => normalizeSymbol(item))
    .filter(Boolean);

function generateWatchlistColumns(rows) {
  const columns = {
    Ticker: [],
    Last: [],
    Change: [],
    ChangePercent: [],
    Volume: [],
  };

  rows.forEach((row) => {
    columns.Ticker.push(row.ticker);
    columns.Last.push(row.last);
    columns.Change.push(row.change);
    columns.ChangePercent.push(row.changePercent);
    columns.Volume.push(row.volume);
  });

  return columns;
}

export default function AnalyticsPage() {
  const [symbols, setSymbols] = useState(loadStoredSymbols);
  const [quotesBySymbol, setQuotesBySymbol] = useState({});
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [isFetchingQuotes, setIsFetchingQuotes] = useState(false);
  const gridRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(symbols));
  }, [symbols]);

  const fetchQuotes = useCallback(async () => {
    if (symbols.length === 0) {
      setQuotesBySymbol({});
      return;
    }

    setIsFetchingQuotes(true);
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

      const rows = Array.isArray(payload?.data) ? payload.data : [];
      const next = {};

      rows.forEach((row) => {
        const symbol = normalizeSymbol(row?.symbol);
        if (!symbol) return;

        const raw = row?.raw && typeof row.raw === 'object' ? row.raw : {};
        next[symbol] = {
          symbol,
          name: String(row?.name || raw?.name || symbol).trim(),
          price: toNumber(row?.price),
          change: toNumber(row?.change),
          percentChange: toNumber(row?.percentChange),
          previousClose: toNumber(
            row?.previousClose
            ?? raw?.previous_close
            ?? raw?.previousClose
            ?? raw?.prev_close
            ?? raw?.prevClose
          ),
          volume: toNumber(row?.volume ?? raw?.volume ?? raw?.day_volume),
          timestamp: row?.timestamp || raw?.datetime || raw?.timestamp || null,
        };
      });

      setQuotesBySymbol((previous) => {
        const merged = {};
        symbols.forEach((symbol) => {
          const normalized = normalizeSymbol(symbol);
          merged[normalized] = next[normalized] || previous[normalized] || {
            symbol: normalized,
            name: normalized,
          };
        });
        return merged;
      });
    } catch (error) {
      setFetchError(error?.message || 'Failed to load watchlist quotes');
    } finally {
      setIsFetchingQuotes(false);
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

          const derived = deriveChangeAndPercent(next);
          next.change = derived.change;
          next.percentChange = derived.percent;

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

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return undefined;
    }

    let active = true;
    const controller = new AbortController();
    const query = searchQuery.trim();
    setSearchLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/stock/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!active) return;
        const list = Array.isArray(payload?.results) ? payload.results : [];
        setSearchResults(
          list
            .map((item) => ({
              symbol: normalizeSymbol(item?.symbol),
              name: String(item?.name || '').trim(),
              exchange: String(item?.exchange || '').trim(),
            }))
            .filter((item) => item.symbol)
        );
      } catch (error) {
        if (error?.name !== 'AbortError' && active) {
          setSearchResults([]);
        }
      } finally {
        if (active) setSearchLoading(false);
      }
    }, 220);

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  const gridRows = useMemo(() => {
    return symbols.map((rawSymbol) => {
      const symbol = normalizeSymbol(rawSymbol);
      const quote = quotesBySymbol[symbol] || { symbol, name: symbol };
      const derived = deriveChangeAndPercent(quote);

      const isPositive = Number.isFinite(derived.change) && derived.change >= 0;
      const changeClass = Number.isFinite(derived.change)
        ? (isPositive ? 'value-positive' : 'value-negative')
        : 'value-neutral';

      return {
        ticker: symbol,
        last: formatPrice(quote.price),
        change: `<span class="${changeClass}">${formatSigned(derived.change)}</span>`,
        changePercent: `<span class="${changeClass}">${formatSignedPercent(derived.percent)}</span>`,
        volume: formatVolume(quote.volume),
      };
    });
  }, [quotesBySymbol, symbols]);

  const dataTable = useMemo(() => ({
    columns: generateWatchlistColumns(gridRows),
  }), [gridRows]);

  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.destroy();
      gridRef.current = null;
    }

    const grid = Grid.grid('container', {
      dataTable,
      lang: {
        pagination: {
          pageInfo: 'Showing {start} - {end} of {total} (page {currentPage} of {totalPages})',
          rowsPerPage: 'rows per page',
        },
      },
      rendering: {
        rows: {
          minVisibleRows: 12,
        },
      },
      pagination: {
        enabled: true,
        pageSize: 20,
        controls: {
          pageSizeSelector: {
            enabled: true,
            options: [10, 20, 50],
          },
          pageInfo: true,
          firstLastButtons: true,
          previousNextButtons: true,
          pageButtons: {
            enabled: true,
            count: 5,
          },
        },
      },
      columns: [
        { id: 'Ticker', width: 170 },
        { id: 'Last', width: 170 },
        { id: 'Change', width: 170 },
        { id: 'ChangePercent', title: 'Change %', width: 170 },
        { id: 'Volume', width: 170 },
      ],
    });

    gridRef.current = grid;
    return () => {
      if (gridRef.current) {
        gridRef.current.destroy();
        gridRef.current = null;
      }
    };
  }, [dataTable]);

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

  const removeSymbol = useCallback((symbolToRemove) => {
    const target = normalizeSymbol(symbolToRemove);
    if (!target) return;
    setSymbols((previous) => previous.filter((symbol) => normalizeSymbol(symbol) !== target));
    setQuotesBySymbol((previous) => {
      const next = { ...previous };
      delete next[target];
      return next;
    });
  }, []);

  const handleAddFromInput = (event) => {
    event.preventDefault();
    const next = extractInputSymbols(inputValue);
    if (next.length === 0) return;
    addSymbols(next);
    setInputValue('');
  };

  const handlePickSearch = (symbol) => {
    addSymbols([symbol]);
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <div className="watchlist-grid-page">
      <div className="watchlist-grid-shell">
        <div className="watchlist-grid-top">
          <h1 className="watchlist-grid-title">Watchlist</h1>
        </div>

        <div className="watchlist-grid-search-row">
          <form className="watchlist-grid-add-form" onSubmit={handleAddFromInput}>
            <input
              className="watchlist-grid-input"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="Add ticker(s), e.g. AMD, PLTR"
            />
            <button type="submit" className="watchlist-grid-add-btn">
              <Plus className="h-4 w-4" />
              Add
            </button>
          </form>

          <div className="watchlist-grid-search">
            <Search className="h-4 w-4 text-white/55" />
            <input
              className="watchlist-grid-input watchlist-grid-search-input"
              value={searchQuery}
              onChange={(event) => {
                setSearchOpen(true);
                setSearchQuery(event.target.value);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search stocks..."
            />
            {searchOpen && (searchQuery.trim() || searchLoading) && (
              <div className="watchlist-grid-search-results">
                {searchLoading ? (
                  <div className="watchlist-grid-search-empty">Searching...</div>
                ) : searchResults.length === 0 ? (
                  <div className="watchlist-grid-search-empty">No results</div>
                ) : (
                  searchResults.slice(0, 8).map((item) => (
                    <button
                      key={`${item.symbol}-${item.exchange}`}
                      type="button"
                      className="watchlist-grid-search-item"
                      onClick={() => handlePickSearch(item.symbol)}
                    >
                      <span className="symbol">{item.symbol}</span>
                      <span className="name">{item.name || item.exchange || ''}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="watchlist-grid-chips">
          {symbols.map((symbol) => (
            <button
              key={symbol}
              type="button"
              className="watchlist-grid-chip"
              onClick={() => removeSymbol(symbol)}
              title={`Remove ${symbol}`}
            >
              {symbol}
              <X className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>

        {fetchError && <div className="watchlist-grid-error">{fetchError}</div>}
        {isFetchingQuotes && <div className="watchlist-grid-status">Loading latest quotes...</div>}

        <div id="container" className="watchlist-grid-container" />
      </div>
    </div>
  );
}
