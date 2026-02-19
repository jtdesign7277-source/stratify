import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronsLeft,
  ChevronsRight,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  subscribeTwelveDataQuotes,
  subscribeTwelveDataStatus,
} from '../../services/twelveDataWebSocket';

const MAX_SYMBOLS = 120;

const DEFAULT_WATCHLIST = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'TSLA', name: 'Tesla, Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.' },
  { symbol: 'META', name: 'Meta Platforms, Inc.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust' },
];

const SEARCH_FALLBACK = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'TSLA', name: 'Tesla, Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.' },
  { symbol: 'META', name: 'Meta Platforms, Inc.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'GOOG', name: 'Alphabet Inc. Class C' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust' },
  { symbol: 'DIA', name: 'SPDR Dow Jones ETF' },
  { symbol: 'IWM', name: 'iShares Russell 2000 ETF' },
  { symbol: 'GLD', name: 'SPDR Gold Shares' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
  { symbol: 'BAC', name: 'Bank of America Corp.' },
  { symbol: 'WFC', name: 'Wells Fargo & Company' },
  { symbol: 'V', name: 'Visa Inc.' },
  { symbol: 'MA', name: 'Mastercard Inc.' },
  { symbol: 'PYPL', name: 'PayPal Holdings, Inc.' },
  { symbol: 'NFLX', name: 'Netflix, Inc.' },
  { symbol: 'AMD', name: 'Advanced Micro Devices, Inc.' },
  { symbol: 'INTC', name: 'Intel Corporation' },
  { symbol: 'AVGO', name: 'Broadcom Inc.' },
  { symbol: 'CRM', name: 'Salesforce, Inc.' },
  { symbol: 'ADBE', name: 'Adobe Inc.' },
  { symbol: 'ORCL', name: 'Oracle Corporation' },
  { symbol: 'PLTR', name: 'Palantir Technologies Inc.' },
  { symbol: 'UBER', name: 'Uber Technologies, Inc.' },
  { symbol: 'ABNB', name: 'Airbnb, Inc.' },
  { symbol: 'HOOD', name: 'Robinhood Markets, Inc.' },
  { symbol: 'COIN', name: 'Coinbase Global, Inc.' },
  { symbol: 'SHOP', name: 'Shopify Inc.' },
  { symbol: 'SNOW', name: 'Snowflake Inc.' },
  { symbol: 'PANW', name: 'Palo Alto Networks, Inc.' },
  { symbol: 'CRWD', name: 'CrowdStrike Holdings, Inc.' },
  { symbol: 'MU', name: 'Micron Technology, Inc.' },
  { symbol: 'SMCI', name: 'Super Micro Computer, Inc.' },
  { symbol: 'ARM', name: 'Arm Holdings plc' },
  { symbol: 'XOM', name: 'Exxon Mobil Corporation' },
  { symbol: 'CVX', name: 'Chevron Corporation' },
  { symbol: 'WMT', name: 'Walmart Inc.' },
  { symbol: 'COST', name: 'Costco Wholesale Corporation' },
  { symbol: 'UNH', name: 'UnitedHealth Group Incorporated' },
  { symbol: 'JNJ', name: 'Johnson & Johnson' },
  { symbol: 'LLY', name: 'Eli Lilly and Company' },
  { symbol: 'PG', name: 'Procter & Gamble Company' },
  { symbol: 'HD', name: 'Home Depot, Inc.' },
  { symbol: 'DIS', name: 'Walt Disney Company' },
  { symbol: 'BA', name: 'Boeing Company' },
  { symbol: 'NKE', name: 'NIKE, Inc.' },
  { symbol: 'T', name: 'AT&T Inc.' },
  { symbol: 'PFE', name: 'Pfizer Inc.' },
  { symbol: 'MRK', name: 'Merck & Co., Inc.' },
  { symbol: 'ABBV', name: 'AbbVie Inc.' },
  { symbol: 'KO', name: 'Coca-Cola Company' },
  { symbol: 'PEP', name: 'PepsiCo, Inc.' },
  { symbol: 'MCD', name: 'McDonald\'s Corporation' },
  { symbol: 'LOW', name: 'Lowe\'s Companies, Inc.' },
  { symbol: 'GE', name: 'GE Aerospace' },
  { symbol: 'CAT', name: 'Caterpillar Inc.' },
  { symbol: 'DE', name: 'Deere & Company' },
  { symbol: 'F', name: 'Ford Motor Company' },
  { symbol: 'GM', name: 'General Motors Company' },
];

const normalizeSymbol = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^\$/, '')
    .replace(/\s+/g, '')
    .split(':')[0]
    .split('.')[0];

const formatPrice = (value) => {
  const price = Number(value);
  if (!Number.isFinite(price)) return '--';
  if (price >= 1) return `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${price.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
};

const formatPercent = (value) => {
  const percent = Number(value);
  if (!Number.isFinite(percent)) return '--';
  return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
};

const formatTime = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleTimeString();
};

const WatchlistPage = ({ watchlist = [], onAddToWatchlist, onRemoveFromWatchlist }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [quotesBySymbol, setQuotesBySymbol] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [streamStatus, setStreamStatus] = useState({ connected: false, connecting: false, error: null });

  const refreshInFlightRef = useRef(false);
  const searchDebounceRef = useRef(null);

  const normalizedWatchlist = useMemo(() => {
    const source = Array.isArray(watchlist) && watchlist.length > 0 ? watchlist : DEFAULT_WATCHLIST;
    const seen = new Set();

    return source
      .map((item) => {
        const symbol = normalizeSymbol(typeof item === 'string' ? item : item?.symbol);
        if (!symbol) return null;
        const name = typeof item === 'object' && item?.name ? item.name : symbol;
        return { symbol, name };
      })
      .filter((item) => {
        if (!item?.symbol || seen.has(item.symbol)) return false;
        seen.add(item.symbol);
        return true;
      });
  }, [watchlist]);

  const visibleWatchlist = useMemo(
    () => normalizedWatchlist.slice(0, MAX_SYMBOLS),
    [normalizedWatchlist]
  );

  const activeSymbols = useMemo(
    () => visibleWatchlist.map((item) => item.symbol),
    [visibleWatchlist]
  );

  const labelMap = useMemo(() => {
    const map = {};
    SEARCH_FALLBACK.forEach((item) => {
      map[item.symbol] = item.name;
    });
    visibleWatchlist.forEach((item) => {
      map[item.symbol] = item.name || map[item.symbol] || item.symbol;
    });
    return map;
  }, [visibleWatchlist]);

  const refreshQuotes = useCallback(async ({ manual = false } = {}) => {
    if (activeSymbols.length === 0) {
      setQuotesBySymbol({});
      setLastUpdated(null);
      return;
    }

    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;

    if (manual) setIsRefreshing(true);
    setLoading((prev) => prev || Object.keys(quotesBySymbol).length === 0);

    try {
      const response = await fetch('/api/watchlist/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: activeSymbols }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load watchlist quotes');
      }

      const map = {};
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      rows.forEach((row) => {
        const symbol = normalizeSymbol(row?.symbol);
        if (!symbol) return;
        map[symbol] = {
          ...row,
          symbol,
          name: row?.name || labelMap[symbol] || symbol,
          source: 'rest',
        };
      });

      setQuotesBySymbol(map);
      setLastUpdated(new Date().toISOString());
      setError('');
    } catch (loadError) {
      setError(loadError?.message || 'Failed to refresh quotes');
    } finally {
      setLoading(false);
      if (manual) setIsRefreshing(false);
      refreshInFlightRef.current = false;
    }
  }, [activeSymbols, labelMap, quotesBySymbol]);

  useEffect(() => {
    refreshQuotes({ manual: false });
  }, [refreshQuotes]);

  useEffect(() => {
    if (activeSymbols.length === 0) return undefined;

    const unsubscribeQuotes = subscribeTwelveDataQuotes(activeSymbols, (update) => {
      const symbol = normalizeSymbol(update?.symbol);
      if (!symbol) return;

      setQuotesBySymbol((prev) => {
        const previous = prev[symbol] || {};
        const nextPrice = Number(update?.price);
        const previousPrice = Number(previous?.price);
        const realtimePercent = Number(update?.percentChange);
        const calculatedPercent =
          Number.isFinite(nextPrice) && Number.isFinite(previousPrice) && previousPrice !== 0
            ? ((nextPrice - previousPrice) / previousPrice) * 100
            : null;

        return {
          ...prev,
          [symbol]: {
            ...previous,
            symbol,
            name: previous?.name || labelMap[symbol] || symbol,
            price: Number.isFinite(nextPrice) ? nextPrice : previous?.price ?? null,
            change: Number.isFinite(Number(update?.change)) ? Number(update.change) : previous?.change ?? null,
            percentChange: Number.isFinite(realtimePercent)
              ? realtimePercent
              : Number.isFinite(calculatedPercent)
                ? calculatedPercent
                : previous?.percentChange ?? null,
            timestamp: update?.timestamp || new Date().toISOString(),
            source: 'ws',
          },
        };
      });

      setLastUpdated(new Date().toISOString());
    });

    const unsubscribeStatus = subscribeTwelveDataStatus((status) => {
      setStreamStatus(status || { connected: false, connecting: false, error: null });
      if (status?.error) {
        setError(status.error);
      }
    });

    return () => {
      unsubscribeQuotes?.();
      unsubscribeStatus?.();
    };
  }, [activeSymbols, labelMap]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    const activeSet = new Set(activeSymbols);
    const query = searchQuery.trim().toUpperCase();

    searchDebounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await fetch(
          `/api/global-markets/list?market=nyse&q=${encodeURIComponent(query)}&limit=40`,
          { cache: 'no-store' }
        );
        const payload = await response.json().catch(() => ({}));
        const upstream = response.ok && Array.isArray(payload?.data)
          ? payload.data.map((item) => ({
              symbol: normalizeSymbol(item?.symbol),
              name: item?.instrumentName || item?.name || item?.symbol,
            }))
          : [];

        const fallback = SEARCH_FALLBACK.filter(
          (item) => item.symbol.includes(query) || item.name.toUpperCase().includes(query)
        );

        const merged = [...upstream, ...fallback]
          .filter((item) => item.symbol && !activeSet.has(item.symbol))
          .reduce((acc, item) => {
            if (!acc.some((entry) => entry.symbol === item.symbol)) {
              acc.push(item);
            }
            return acc;
          }, [])
          .slice(0, 20);

        setSearchResults(merged);
      } catch {
        const fallback = SEARCH_FALLBACK
          .filter((item) => (
            item.symbol.includes(query)
            || item.name.toUpperCase().includes(query)
          ))
          .filter((item) => !activeSet.has(item.symbol))
          .slice(0, 20);
        setSearchResults(fallback);
      } finally {
        setSearchLoading(false);
      }
    }, 220);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [searchQuery, activeSymbols]);

  useEffect(() => {
    if (!selectedTicker && activeSymbols.length > 0) {
      setSelectedTicker(activeSymbols[0]);
      return;
    }

    if (selectedTicker && !activeSymbols.includes(selectedTicker)) {
      setSelectedTicker(activeSymbols[0] || null);
    }
  }, [activeSymbols, selectedTicker]);

  const addSymbolToWatchlist = (symbol, name) => {
    const normalized = normalizeSymbol(symbol);
    if (!normalized) return;
    if (activeSymbols.includes(normalized)) return;

    if (activeSymbols.length >= MAX_SYMBOLS) {
      setError(`Watchlist limit reached (${MAX_SYMBOLS} symbols)`);
      return;
    }

    onAddToWatchlist?.({ symbol: normalized, name: name || labelMap[normalized] || normalized });
    setSearchQuery('');
    setSearchResults([]);
    setError('');
  };

  const handleDirectAdd = () => {
    const normalized = normalizeSymbol(searchQuery);
    if (!normalized) return;

    const exactResult = searchResults.find((item) => item.symbol === normalized);
    addSymbolToWatchlist(normalized, exactResult?.name || labelMap[normalized]);
  };

  const selectedName = visibleWatchlist.find((item) => item.symbol === selectedTicker)?.name || selectedTicker;

  return (
    <div className="flex h-full flex-1 overflow-hidden bg-transparent">
      <div className={`flex flex-col border-r border-[#1f1f1f] transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-[380px]'}`}>
        <div className="flex items-center justify-between border-b border-[#1f1f1f] px-4 py-3">
          {!isCollapsed && (
            <div>
              <h1 className="text-xl font-semibold text-white">Watchlist</h1>
              <p className="text-xs text-gray-400">Twelve Data live WebSocket</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
          >
            {isCollapsed ? <ChevronsRight className="h-4 w-4" strokeWidth={1.5} /> : <ChevronsLeft className="h-4 w-4" strokeWidth={1.5} />}
          </button>
        </div>

        {!isCollapsed && (
          <>
            <div className="relative z-20 border-b border-[#1f1f1f] px-4 py-3">
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                <Search className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      if (searchResults.length > 0) {
                        addSymbolToWatchlist(searchResults[0].symbol, searchResults[0].name);
                      } else {
                        handleDirectAdd();
                      }
                    }
                  }}
                  placeholder="Search ticker or company (TSLA, Apple...)"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="rounded p-0.5 text-gray-500 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleDirectAdd}
                  className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
                >
                  <Plus className="h-3 w-3" strokeWidth={1.5} />
                  Add
                </button>
              </div>

              {searchQuery.trim() ? (
                <div className="absolute left-4 right-4 top-[100%] mt-1 max-h-72 overflow-y-auto rounded-lg border border-white/10 bg-[#060d18]/95 p-1 shadow-2xl" style={{ scrollbarWidth: 'none' }}>
                  {searchLoading ? (
                    <div className="px-2 py-2 text-xs text-gray-400">Searching symbols...</div>
                  ) : searchResults.length > 0 ? (
                    searchResults.map((result) => (
                      <button
                        key={result.symbol}
                        type="button"
                        onClick={() => addSymbolToWatchlist(result.symbol, result.name)}
                        className="flex w-full items-center justify-between rounded px-2 py-2 text-left hover:bg-blue-500/10"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white">${result.symbol}</div>
                          <div className="truncate text-[11px] text-gray-400">{result.name || result.symbol}</div>
                        </div>
                        <Plus className="h-3.5 w-3.5 text-blue-300" strokeWidth={1.5} />
                      </button>
                    ))
                  ) : (
                    <div className="px-2 py-2 text-xs text-gray-400">No symbols found</div>
                  )}
                </div>
              ) : null}

              <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
                <span>{activeSymbols.length}/{MAX_SYMBOLS} symbols</span>
                <span className={`inline-flex items-center gap-1 ${streamStatus.connected ? 'text-emerald-400' : streamStatus.connecting ? 'text-yellow-400' : 'text-gray-400'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${streamStatus.connected ? 'animate-pulse bg-emerald-400' : streamStatus.connecting ? 'bg-yellow-400' : 'bg-gray-500'}`} />
                  {streamStatus.connected ? 'Live stream' : streamStatus.connecting ? 'Connecting...' : 'Offline'}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] text-gray-500">Last tick: {formatTime(lastUpdated)}</span>
                <button
                  type="button"
                  onClick={() => refreshQuotes({ manual: true })}
                  className="inline-flex items-center gap-1 rounded border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-300 hover:bg-blue-500/20"
                >
                  <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} strokeWidth={1.5} />
                  {isRefreshing ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>

              {error ? (
                <div className="mt-2 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-300">
                  {error}
                </div>
              ) : null}
              {normalizedWatchlist.length > MAX_SYMBOLS ? (
                <div className="mt-2 rounded border border-yellow-500/30 bg-yellow-500/10 px-2 py-1 text-[11px] text-yellow-300">
                  Showing first {MAX_SYMBOLS} symbols. Remove some to manage beyond the limit.
                </div>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
              {loading && visibleWatchlist.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-400">Loading watchlist...</div>
              ) : null}

              {visibleWatchlist.map((item) => {
                const quote = quotesBySymbol[item.symbol] || {};
                const pct = Number(quote?.percentChange);
                const positive = Number.isFinite(pct) ? pct >= 0 : true;
                const rowActive = selectedTicker === item.symbol;

                return (
                  <button
                    key={item.symbol}
                    type="button"
                    onClick={() => setSelectedTicker(item.symbol)}
                    className={`flex w-full items-center justify-between gap-2 border-b border-[#1f1f1f]/40 px-4 py-2.5 text-left transition-colors ${
                      rowActive ? 'bg-blue-500/10' : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-1">
                      <div className="text-sm font-semibold text-white">${item.symbol}</div>
                      <div className="truncate text-xs text-gray-500">{item.name || labelMap[item.symbol] || item.symbol}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="min-w-[88px] text-right">
                        <div className="text-sm font-mono text-white">{formatPrice(quote?.price)}</div>
                        <div className={`text-xs font-medium ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                          {formatPercent(quote?.percentChange)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onRemoveFromWatchlist?.(item.symbol);
                        }}
                        className="rounded p-1 text-gray-500 hover:bg-red-500/15 hover:text-red-400"
                        title="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {isCollapsed && (
          <div className="px-2 py-3 text-center text-[10px] text-gray-500">
            {activeSymbols.length}
            <br />
            symbols
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 bg-transparent">
        {selectedTicker ? (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-[#1f1f1f] px-4 py-3">
              <div>
                <div className="text-lg font-semibold text-white">${selectedTicker}</div>
                <div className="text-xs text-gray-400">{selectedName || selectedTicker}</div>
              </div>
              <span className="rounded border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-300">
                Twelve Data
              </span>
            </div>
            <div className="min-h-0 flex-1">
              <iframe
                key={selectedTicker}
                src={`https://s.tradingview.com/widgetembed/?frameElementId=watchlist_widget&symbol=${encodeURIComponent(selectedTicker)}&interval=15&hidesidetoolbar=0&symboledit=1&saveimage=0&toolbarbg=f1f3f6&studies=[]&theme=dark&style=1&timezone=America%2FNew_York&withdateranges=1&showpopupbutton=0&locale=en`}
                style={{ width: '100%', height: '100%', border: 'none' }}
                allowFullScreen
              />
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-center text-gray-500">
            <div>
              <p className="text-lg text-white/70">Select a symbol</p>
              <p className="mt-1 text-sm">Add symbols on the left to build your watchlist</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WatchlistPage;
