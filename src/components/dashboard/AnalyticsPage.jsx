import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Grid from '@highcharts/grid-lite';
import { LayoutGrid, MoreHorizontal, Plus, Search } from 'lucide-react';
import { getExtendedHoursStatus } from '../../lib/marketHours';
import '@highcharts/grid-lite/css/grid.css';
import './AnalyticsWatchlistGrid.css';

const WATCHLIST_STORAGE_KEY = 'stratify-analytics-grid-watchlist';
const TWELVE_DATA_WS_URL = 'wss://ws.twelvedata.com/v1/quotes/price';
const TWELVE_DATA_API_KEY = import.meta.env.VITE_TWELVE_DATA_API_KEY;
const MAX_SYMBOLS = 120;
const QUOTE_POLL_INTERVAL_MS = 20000;
const DEFAULT_SYMBOLS = [
  'TSLA',
  'NVDA',
  'AAPL',
  'AMD',
  'PLTR',
  'META',
  'AMZN',
  'SOFI',
  'HIMS',
  'NIO',
];

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

const escapeHtml = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

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

const getDirectionClass = (value) => {
  const number = toNumber(value);
  if (!Number.isFinite(number) || number === 0) return 'watchlist-value-neutral';
  return number > 0 ? 'watchlist-value-positive' : 'watchlist-value-negative';
};

const deriveMainChangeAndPercent = (quote = {}) => {
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

const deriveExtendedMetric = (quote = {}, sessionStatus = null) => {
  const previousClose = toNumber(quote?.previousClose);
  const livePrice = toNumber(quote?.price);

  const buildMetric = (prefix, fallbackLivePrice = null) => {
    let extPrice = toNumber(quote?.[`${prefix}Price`]);
    let extChange = toNumber(quote?.[`${prefix}Change`]);
    let extPercent = toNumber(quote?.[`${prefix}ChangePercent`]);

    if (!Number.isFinite(extPrice) && Number.isFinite(fallbackLivePrice)) {
      extPrice = fallbackLivePrice;
    }

    if (!Number.isFinite(extChange) && Number.isFinite(extPrice) && Number.isFinite(previousClose)) {
      extChange = extPrice - previousClose;
    }

    if (
      !Number.isFinite(extPercent)
      && Number.isFinite(extChange)
      && Number.isFinite(previousClose)
      && previousClose !== 0
    ) {
      extPercent = (extChange / previousClose) * 100;
    }

    return {
      price: Number.isFinite(extPrice) ? extPrice : null,
      change: Number.isFinite(extChange) ? extChange : null,
      percent: Number.isFinite(extPercent) ? extPercent : null,
    };
  };

  const pre = buildMetric('preMarket', sessionStatus === 'pre-market' ? livePrice : null);
  const post = buildMetric('afterHours', sessionStatus === 'post-market' ? livePrice : null);

  if (sessionStatus === 'pre-market' && Number.isFinite(pre.percent)) {
    return { label: 'Pre', ...pre };
  }

  if (sessionStatus === 'post-market' && Number.isFinite(post.percent)) {
    return { label: 'Post', ...post };
  }

  if (Number.isFinite(post.percent)) {
    return { label: 'Post', ...post };
  }

  if (Number.isFinite(pre.percent)) {
    return { label: 'Pre', ...pre };
  }

  return { label: 'Ext', price: null, change: null, percent: null };
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

const buildSymbolBadge = (symbol) => {
  const label = escapeHtml(String(symbol).slice(0, 3));
  const hash = [...String(symbol)].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = hash % 360;
  const badgeColor = `hsl(${hue}, 64%, 42%)`;
  return `<span class="watchlist-symbol-cell"><span class="watchlist-symbol-badge" style="background:${badgeColor}">${label}</span><span class="watchlist-symbol-text">${escapeHtml(symbol)}</span></span>`;
};

const buildExtCell = (metric) => {
  const directionClass = getDirectionClass(metric?.percent);
  if (!Number.isFinite(toNumber(metric?.percent))) {
    return '<span class="watchlist-value watchlist-value-neutral">--</span>';
  }

  return `<span class="watchlist-value ${directionClass}">${escapeHtml(metric.label)} ${formatSignedPercent(metric.percent)}</span>`;
};

function generateWatchlistColumns(rows) {
  const columns = {
    Symbol: [],
    Last: [],
    Chg: [],
    ChgPercent: [],
    Vol: [],
    Ext: [],
  };

  rows.forEach((row) => {
    columns.Symbol.push(row.symbol);
    columns.Last.push(row.last);
    columns.Chg.push(row.chg);
    columns.ChgPercent.push(row.chgPercent);
    columns.Vol.push(row.vol);
    columns.Ext.push(row.ext);
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
  const [clockTick, setClockTick] = useState(() => Date.now());
  const gridRef = useRef(null);
  const addInputRef = useRef(null);
  const searchWrapRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(symbols));
  }, [symbols]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockTick(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!searchOpen) return undefined;

    const handleOutsideClick = (event) => {
      if (!searchWrapRef.current) return;
      if (!searchWrapRef.current.contains(event.target)) {
        setSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [searchOpen]);

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
          price: toNumber(row?.price ?? raw?.close ?? raw?.price ?? raw?.last),
          change: toNumber(row?.change ?? raw?.change),
          percentChange: toNumber(row?.percentChange ?? raw?.percent_change ?? raw?.percentChange),
          previousClose: toNumber(
            row?.previousClose
            ?? raw?.previous_close
            ?? raw?.previousClose
            ?? raw?.prev_close
            ?? raw?.prevClose
          ),
          preMarketPrice: toNumber(row?.preMarketPrice ?? raw?.pre_market_price ?? raw?.premarket_price),
          preMarketChange: toNumber(row?.preMarketChange ?? raw?.pre_market_change ?? raw?.premarket_change),
          preMarketChangePercent: toNumber(
            row?.preMarketChangePercent
            ?? raw?.pre_market_change_percent
            ?? raw?.premarket_change_percent
          ),
          afterHoursPrice: toNumber(row?.afterHoursPrice ?? raw?.after_hours_price ?? raw?.post_market_price),
          afterHoursChange: toNumber(row?.afterHoursChange ?? raw?.after_hours_change ?? raw?.post_market_change),
          afterHoursChangePercent: toNumber(
            row?.afterHoursChangePercent
            ?? raw?.after_hours_change_percent
            ?? raw?.post_market_change_percent
          ),
          volume: toNumber(row?.volume ?? raw?.volume ?? raw?.day_volume),
          timestamp: row?.timestamp || raw?.datetime || raw?.timestamp || null,
        };
      });

      setQuotesBySymbol((previous) => {
        const merged = {};
        symbols.forEach((symbolValue) => {
          const normalized = normalizeSymbol(symbolValue);
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

        const isPriceEvent = payload?.event === 'price' || payload?.symbol;
        if (!isPriceEvent) return;

        const symbol = normalizeSymbol(payload?.symbol);
        const livePrice = toNumber(payload?.price ?? payload?.close ?? payload?.last);
        if (!symbol || !Number.isFinite(livePrice)) return;

        setQuotesBySymbol((previous) => {
          const current = previous[symbol];
          if (!current) return previous;

          const sessionStatus = getExtendedHoursStatus();
          const next = {
            ...current,
            price: livePrice,
            timestamp: payload?.timestamp || payload?.datetime || new Date().toISOString(),
          };

          if (sessionStatus === 'pre-market') {
            next.preMarketPrice = livePrice;
          }

          if (sessionStatus === 'post-market') {
            next.afterHoursPrice = livePrice;
          }

          const derived = deriveMainChangeAndPercent(next);
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
    const sessionStatus = getExtendedHoursStatus(new Date(clockTick));

    return symbols.map((rawSymbol) => {
      const symbol = normalizeSymbol(rawSymbol);
      const quote = quotesBySymbol[symbol] || { symbol, name: symbol };
      const mainMetric = deriveMainChangeAndPercent(quote);
      const extMetric = deriveExtendedMetric(quote, sessionStatus);
      const directionClass = getDirectionClass(mainMetric.percent ?? mainMetric.change);

      return {
        symbol: buildSymbolBadge(symbol),
        last: `<span class="watchlist-value ${directionClass}">${formatPrice(quote.price)}</span>`,
        chg: `<span class="watchlist-value ${directionClass}">${formatSigned(mainMetric.change)}</span>`,
        chgPercent: `<span class="watchlist-value ${directionClass}">${formatSignedPercent(mainMetric.percent)}</span>`,
        vol: `<span class="watchlist-value watchlist-value-neutral">${formatVolume(quote.volume)}</span>`,
        ext: buildExtCell(extMetric),
      };
    });
  }, [clockTick, quotesBySymbol, symbols]);

  const dataTable = useMemo(
    () => ({
      columns: generateWatchlistColumns(gridRows),
    }),
    [gridRows]
  );

  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.destroy();
      gridRef.current = null;
    }

    const grid = Grid.grid('analytics-watchlist-grid', {
      dataTable,
      rendering: {
        rows: {
          minVisibleRows: 18,
        },
      },
      pagination: {
        enabled: false,
      },
      columns: [
        { id: 'Symbol', width: 280 },
        { id: 'Last', width: 170 },
        { id: 'Chg', width: 160 },
        { id: 'ChgPercent', title: 'Chg%', width: 170 },
        { id: 'Vol', width: 170 },
        { id: 'Ext', width: 170 },
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

  const handleAddFromInput = (event) => {
    event.preventDefault();
    const nextSymbols = extractInputSymbols(inputValue);
    if (nextSymbols.length === 0) return;
    addSymbols(nextSymbols);
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
        <header className="watchlist-grid-header">
          <h1 className="watchlist-grid-title">Watchlist</h1>
          <div className="watchlist-grid-header-actions">
            <button
              type="button"
              className="watchlist-grid-icon-btn"
              onClick={() => addInputRef.current?.focus()}
              title="Add ticker"
            >
              <Plus size={18} />
            </button>
            <button type="button" className="watchlist-grid-icon-btn" title="Layout">
              <LayoutGrid size={18} />
            </button>
            <button type="button" className="watchlist-grid-icon-btn" title="More">
              <MoreHorizontal size={18} />
            </button>
          </div>
        </header>

        <div className="watchlist-grid-controls">
          <form className="watchlist-grid-add-form" onSubmit={handleAddFromInput}>
            <input
              ref={addInputRef}
              className="watchlist-grid-input"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="Add ticker(s), e.g. TSLA, AMD"
            />
            <button type="submit" className="watchlist-grid-add-btn">
              Add
            </button>
          </form>

          <div className="watchlist-grid-search" ref={searchWrapRef}>
            <Search className="watchlist-grid-search-icon" size={15} />
            <input
              className="watchlist-grid-input watchlist-grid-search-input"
              value={searchQuery}
              onChange={(event) => {
                setSearchOpen(true);
                setSearchQuery(event.target.value);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Search symbol"
            />
            {searchOpen && (searchQuery.trim() || searchLoading) && (
              <div className="watchlist-grid-search-results">
                {searchLoading ? (
                  <div className="watchlist-grid-search-empty">Searching...</div>
                ) : searchResults.length === 0 ? (
                  <div className="watchlist-grid-search-empty">No results</div>
                ) : (
                  searchResults.slice(0, 10).map((item) => (
                    <button
                      key={`${item.symbol}-${item.exchange}`}
                      type="button"
                      className="watchlist-grid-search-item"
                      onClick={() => handlePickSearch(item.symbol)}
                    >
                      <span className="watchlist-grid-search-symbol">{item.symbol}</span>
                      <span className="watchlist-grid-search-name">{item.name || item.exchange || ''}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {fetchError && <div className="watchlist-grid-error">{fetchError}</div>}
        {isFetchingQuotes && <div className="watchlist-grid-status">Syncing live quotes...</div>}

        <div id="analytics-watchlist-grid" className="watchlist-grid-container" />
      </div>
    </div>
  );
}
