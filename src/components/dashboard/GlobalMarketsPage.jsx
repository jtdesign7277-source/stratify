import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Globe,
  Loader2,
  Plus,
  Search,
  TrendingDown,
  TrendingUp,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';

const MARKETS = [
  {
    id: 'nyse',
    title: 'New York Stock Exchange',
    currency: 'USD',
    accent: 'text-emerald-400',
    defaultSymbols: ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META'],
  },
  {
    id: 'lse',
    title: 'London Stock Exchange',
    currency: 'GBP',
    accent: 'text-blue-400',
    defaultSymbols: ['SHEL', 'AZN', 'HSBA', 'BP', 'BARC', 'LLOY'],
  },
  {
    id: 'tokyo',
    title: 'Tokyo Stock Exchange',
    currency: 'JPY',
    accent: 'text-cyan-400',
    defaultSymbols: ['7203', '6758', '9984', '8306', '6861', '9432'],
  },
  {
    id: 'sydney',
    title: 'Sydney Stock Exchange',
    currency: 'AUD',
    accent: 'text-violet-400',
    defaultSymbols: ['BHP', 'CBA', 'WBC', 'NAB', 'ANZ', 'CSL'],
  },
];

const WATCHLIST_STORAGE_PREFIX = 'stratify-global-market-watchlist';

const normalizeSymbol = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^\$/, '')
    .split(':')[0]
    .split('.')[0];

const dedupeSymbols = (symbols = []) => {
  const seen = new Set();
  return symbols
    .map(normalizeSymbol)
    .filter((symbol) => {
      if (!symbol || seen.has(symbol)) return false;
      seen.add(symbol);
      return true;
    });
};

const getStorageKey = (market) => `${WATCHLIST_STORAGE_PREFIX}:${market}`;

const loadStoredSymbols = (market, fallback) => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(getStorageKey(market));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    const cleaned = dedupeSymbols(Array.isArray(parsed) ? parsed : []);
    return cleaned.length > 0 ? cleaned : fallback;
  } catch {
    return fallback;
  }
};

const formatPrice = (value, currency) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '...';

  const currencySymbol = currency === 'GBP' ? '£' : currency === 'JPY' ? '¥' : currency === 'AUD' ? 'A$' : '$';
  const minimumFractionDigits = currency === 'JPY' ? 0 : 2;
  const maximumFractionDigits = currency === 'JPY' ? 0 : 2;
  return `${currencySymbol}${numeric.toLocaleString(undefined, { minimumFractionDigits, maximumFractionDigits })}`;
};

const formatPercent = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '--';
  return `${numeric >= 0 ? '+' : ''}${numeric.toFixed(2)}%`;
};

const percentClass = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'text-gray-400';
  return numeric >= 0 ? 'text-emerald-400' : 'text-red-400';
};

const GlobalMarketsPage = () => {
  const [watchlists, setWatchlists] = useState(() =>
    MARKETS.reduce((acc, market) => {
      acc[market.id] = loadStoredSymbols(market.id, market.defaultSymbols);
      return acc;
    }, {})
  );

  const [quotesByMarket, setQuotesByMarket] = useState(() =>
    MARKETS.reduce((acc, market) => {
      acc[market.id] = {};
      return acc;
    }, {})
  );

  const [loadingByMarket, setLoadingByMarket] = useState(() =>
    MARKETS.reduce((acc, market) => {
      acc[market.id] = false;
      return acc;
    }, {})
  );

  const [errorByMarket, setErrorByMarket] = useState(() =>
    MARKETS.reduce((acc, market) => {
      acc[market.id] = null;
      return acc;
    }, {})
  );

  const [searchUiByMarket, setSearchUiByMarket] = useState(() =>
    MARKETS.reduce((acc, market) => {
      acc[market.id] = {
        open: false,
        query: '',
        loading: false,
        error: null,
        results: [],
      };
      return acc;
    }, {})
  );

  const [updatedAtByMarket, setUpdatedAtByMarket] = useState(() =>
    MARKETS.reduce((acc, market) => {
      acc[market.id] = null;
      return acc;
    }, {})
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    MARKETS.forEach((market) => {
      localStorage.setItem(getStorageKey(market.id), JSON.stringify(watchlists[market.id] || []));
    });
  }, [watchlists]);

  const fetchQuotesForMarket = useCallback(async (marketId) => {
    const symbols = watchlists[marketId] || [];
    if (symbols.length === 0) return;

    setLoadingByMarket((prev) => ({ ...prev, [marketId]: true }));
    setErrorByMarket((prev) => ({ ...prev, [marketId]: null }));

    try {
      const params = new URLSearchParams({
        market: marketId,
        symbols: symbols.join(','),
      });
      const response = await fetch(`/api/global-markets/quotes?${params.toString()}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || `Failed to load ${marketId.toUpperCase()} quotes`);
      }

      const rows = Array.isArray(payload?.data) ? payload.data : [];
      const quoteMap = rows.reduce((acc, row) => {
        const symbol = normalizeSymbol(row?.requestedSymbol || row?.symbol || row?.streamSymbol);
        if (!symbol) return acc;
        acc[symbol] = row;
        return acc;
      }, {});

      setQuotesByMarket((prev) => ({ ...prev, [marketId]: quoteMap }));
      setUpdatedAtByMarket((prev) => ({ ...prev, [marketId]: new Date().toISOString() }));
    } catch (fetchError) {
      setErrorByMarket((prev) => ({ ...prev, [marketId]: fetchError?.message || 'Failed to fetch quotes' }));
    } finally {
      setLoadingByMarket((prev) => ({ ...prev, [marketId]: false }));
    }
  }, [watchlists]);

  useEffect(() => {
    MARKETS.forEach((market) => {
      fetchQuotesForMarket(market.id);
    });

    const timer = setInterval(() => {
      MARKETS.forEach((market) => {
        fetchQuotesForMarket(market.id);
      });
    }, 10000);

    return () => clearInterval(timer);
  }, [fetchQuotesForMarket]);

  const searchSymbols = useCallback(async (marketId, query) => {
    setSearchUiByMarket((prev) => ({
      ...prev,
      [marketId]: {
        ...prev[marketId],
        loading: true,
        error: null,
      },
    }));

    try {
      const params = new URLSearchParams({
        market: marketId,
        q: String(query || '').trim(),
        limit: '250',
      });
      const response = await fetch(`/api/global-markets/list?${params.toString()}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || `Failed to search ${marketId.toUpperCase()} tickers`);
      }

      setSearchUiByMarket((prev) => ({
        ...prev,
        [marketId]: {
          ...prev[marketId],
          loading: false,
          error: null,
          results: Array.isArray(payload?.data) ? payload.data : [],
        },
      }));
    } catch (searchError) {
      setSearchUiByMarket((prev) => ({
        ...prev,
        [marketId]: {
          ...prev[marketId],
          loading: false,
          error: searchError?.message || 'Search failed',
          results: [],
        },
      }));
    }
  }, []);

  useEffect(() => {
    const timeouts = [];
    MARKETS.forEach((market) => {
      const marketUi = searchUiByMarket[market.id];
      if (!marketUi?.open) return;

      const timer = setTimeout(() => {
        searchSymbols(market.id, marketUi.query);
      }, 220);
      timeouts.push(timer);
    });

    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
    };
  }, [searchUiByMarket, searchSymbols]);

  const toggleSearch = (marketId) => {
    setSearchUiByMarket((prev) => ({
      ...prev,
      [marketId]: {
        ...prev[marketId],
        open: !prev[marketId].open,
      },
    }));
  };

  const setSearchQuery = (marketId, query) => {
    setSearchUiByMarket((prev) => ({
      ...prev,
      [marketId]: {
        ...prev[marketId],
        query,
      },
    }));
  };

  const addSymbol = (marketId, symbol) => {
    const normalized = normalizeSymbol(symbol);
    if (!normalized) return;
    setWatchlists((prev) => {
      const current = prev[marketId] || [];
      if (current.includes(normalized)) return prev;
      return {
        ...prev,
        [marketId]: [...current, normalized],
      };
    });
  };

  const removeSymbol = (marketId, symbol) => {
    const normalized = normalizeSymbol(symbol);
    if (!normalized) return;
    setWatchlists((prev) => {
      const current = prev[marketId] || [];
      if (current.length <= 1) return prev;
      return {
        ...prev,
        [marketId]: current.filter((item) => item !== normalized),
      };
    });
  };

  const marketStatuses = useMemo(
    () =>
      MARKETS.map((market) => {
        const hasData = Object.values(quotesByMarket[market.id] || {}).some((item) =>
          Number.isFinite(Number(item?.price))
        );
        return {
          id: market.id,
          title: market.title,
          connected: hasData && !loadingByMarket[market.id] && !errorByMarket[market.id],
        };
      }),
    [quotesByMarket, loadingByMarket, errorByMarket]
  );

  return (
    <div className="relative flex h-full flex-1 flex-col overflow-hidden bg-transparent p-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Global Markets</h1>
          <p className="text-xs text-gray-400">Twelve Data real-time market board</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {marketStatuses.map((status) => (
            <span key={status.id} className={`inline-flex items-center gap-1 ${status.connected ? 'text-emerald-400' : 'text-yellow-400'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.connected ? 'bg-emerald-400 animate-pulse' : 'bg-yellow-400'}`} />
              {status.title}
            </span>
          ))}
        </div>
      </div>

      <div className="grid flex-1 min-h-0 grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-4">
        {MARKETS.map((market) => {
          const marketQuotes = quotesByMarket[market.id] || {};
          const symbols = watchlists[market.id] || market.defaultSymbols;
          const searchUi = searchUiByMarket[market.id];
          const loading = loadingByMarket[market.id];
          const error = errorByMarket[market.id];
          const updatedAt = updatedAtByMarket[market.id];

          return (
            <div key={market.id} className="rounded-xl border border-[#1f1f1f] bg-black/45 p-3 backdrop-blur-sm min-h-0">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className={`h-4.5 w-4.5 ${market.accent}`} strokeWidth={1.5} />
                  <h3 className="text-white font-semibold">{market.title}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleSearch(market.id)}
                    className="inline-flex items-center gap-1 rounded border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-[11px] font-medium text-blue-300 hover:bg-blue-500/20"
                  >
                    <Plus className="h-3 w-3" strokeWidth={1.5} />
                    Add
                  </button>
                  {loading ? (
                    <span className="inline-flex items-center gap-1 text-xs text-yellow-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                      Syncing
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                      <Wifi className="h-3.5 w-3.5" strokeWidth={1.5} />
                      Live
                    </span>
                  )}
                </div>
              </div>

              {searchUi?.open && (
                <div className="mb-2 rounded-lg border border-blue-500/30 bg-[#060d18]/90 p-2">
                  <div className="mb-2 flex items-center gap-2 rounded border border-white/10 bg-white/[0.02] px-2 py-1.5">
                    <Search className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
                    <input
                      value={searchUi.query}
                      onChange={(event) => setSearchQuery(market.id, event.target.value)}
                      placeholder={`Search ${market.title} ticker...`}
                      className="w-full bg-transparent text-xs text-white outline-none placeholder:text-gray-500"
                    />
                  </div>

                  {searchUi.error && (
                    <div className="mb-2 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-300">
                      {searchUi.error}
                    </div>
                  )}

                  <div className="max-h-40 space-y-1 overflow-y-auto pr-1" style={{ scrollbarWidth: 'none' }}>
                    {searchUi.loading ? (
                      <div className="flex items-center gap-2 rounded border border-white/10 bg-white/[0.02] px-2 py-1.5 text-[11px] text-gray-300">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" strokeWidth={1.5} />
                        Searching symbols...
                      </div>
                    ) : searchUi.results.length > 0 ? (
                      searchUi.results.slice(0, 30).map((item) => {
                        const symbol = normalizeSymbol(item?.symbol);
                        if (!symbol) return null;
                        const alreadyAdded = symbols.includes(symbol);
                        return (
                          <button
                            key={`${market.id}-${symbol}-${item?.instrumentName || ''}`}
                            type="button"
                            onClick={() => addSymbol(market.id, symbol)}
                            disabled={alreadyAdded}
                            className={`w-full rounded border px-2 py-1.5 text-left text-xs transition-colors ${
                              alreadyAdded
                                ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
                                : 'border-white/10 bg-white/[0.02] text-white/85 hover:border-blue-500/35 hover:bg-blue-500/10'
                            }`}
                          >
                            <span className="font-semibold">${symbol}</span>
                            <span className="ml-2 text-white/55">{item?.instrumentName || item?.name || symbol}</span>
                          </button>
                        );
                      })
                    ) : (
                      <div className="rounded border border-white/10 bg-white/[0.02] px-2 py-1.5 text-[11px] text-gray-400">
                        No symbols found.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {error && (
                <div className="mb-2 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-300">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                {symbols.map((symbol) => {
                  const quote = marketQuotes[symbol] || {};
                  const positive = Number(quote?.percentChange) >= 0;
                  return (
                    <div key={`${market.id}-${symbol}`} className="flex items-start justify-between rounded-lg border border-white/[0.04] bg-white/[0.015] px-2.5 py-2">
                      <div className="min-w-0 pr-2">
                        <div className="text-sm font-semibold text-white">${symbol}</div>
                        <div className="truncate text-[11px] text-gray-500">{quote?.name || symbol}</div>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="min-w-[96px] text-right">
                          <div className="text-sm font-mono text-white">{formatPrice(quote?.price, market.currency)}</div>
                          <div className={`inline-flex items-center gap-1 text-xs font-medium ${percentClass(quote?.percentChange)}`}>
                            {positive ? <TrendingUp className="h-3 w-3" strokeWidth={1.5} /> : <TrendingDown className="h-3 w-3" strokeWidth={1.5} />}
                            {formatPercent(quote?.percentChange)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSymbol(market.id, symbol)}
                          className="rounded p-1 text-gray-500 transition-colors hover:bg-white/10 hover:text-white"
                          title="Remove ticker"
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-2 text-[10px] text-gray-600">
                {updatedAt
                  ? `Last update ${new Date(updatedAt).toLocaleTimeString()}`
                  : 'Waiting for market data...'}
              </div>
            </div>
          );
        })}
      </div>

      {MARKETS.some((market) => Boolean(errorByMarket[market.id])) && (
        <div className="mt-2 rounded-lg border border-white/10 bg-[#0a1628]/70 px-3 py-2 text-xs text-gray-300">
          <div className="flex items-center gap-2">
            <WifiOff className="h-3.5 w-3.5 text-yellow-400" strokeWidth={1.5} />
            <span>Some exchanges are reconnecting. Data will refresh automatically.</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalMarketsPage;
