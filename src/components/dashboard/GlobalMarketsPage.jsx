import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  Loader2,
  Maximize2,
  Minimize2,
  Plus,
  Search,
  TrendingDown,
  TrendingUp,
  WifiOff,
  X,
} from 'lucide-react';
import { getApiUrl } from '../../lib/api';

const MARKETS = [
  {
    id: 'nyse',
    title: '🇺🇸 United States',
    shortTitle: '🇺🇸 NYSE',
    currency: 'USD',
    accent: 'text-emerald-400',
    defaultSymbols: ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META'],
  },
  {
    id: 'lse',
    title: '🇬🇧 United Kingdom',
    shortTitle: '🇬🇧 LSE',
    currency: 'GBP',
    accent: 'text-blue-400',
    defaultSymbols: ['SHEL', 'AZN', 'HSBA', 'BP', 'BARC', 'LLOY'],
  },
  {
    id: 'sydney',
    title: '🇦🇺 Australia',
    shortTitle: '🇦🇺 ASX',
    currency: 'AUD',
    accent: 'text-violet-400',
    defaultSymbols: ['BHP', 'CBA', 'WBC', 'NAB', 'ANZ', 'CSL'],
  },
  {
    id: 'crypto',
    title: '₿ Crypto Watchlist',
    shortTitle: '₿ Crypto',
    currency: 'USD',
    accent: 'text-fuchsia-300',
    defaultSymbols: ['BTC/USD', 'ETH/USD', 'SOL/USD', 'XRP/USD', 'DOGE/USD', 'LINK/USD'],
  },
];

const WATCHLIST_COLUMN = {
  id: 'watchlist',
  title: 'Watchlist',
  shortTitle: 'Watchlist',
  currency: 'USD',
  accent: 'text-cyan-300',
};

const COLUMN_IDS = [WATCHLIST_COLUMN.id, ...MARKETS.map((market) => market.id)];

const CRYPTO_SEARCH_UNIVERSE = [
  { symbol: 'BTC/USD', instrumentName: 'Bitcoin' },
  { symbol: 'ETH/USD', instrumentName: 'Ethereum' },
  { symbol: 'SOL/USD', instrumentName: 'Solana' },
  { symbol: 'XRP/USD', instrumentName: 'XRP' },
  { symbol: 'DOGE/USD', instrumentName: 'Dogecoin' },
  { symbol: 'LINK/USD', instrumentName: 'Chainlink' },
  { symbol: 'ADA/USD', instrumentName: 'Cardano' },
  { symbol: 'AVAX/USD', instrumentName: 'Avalanche' },
  { symbol: 'DOT/USD', instrumentName: 'Polkadot' },
  { symbol: 'MATIC/USD', instrumentName: 'Polygon' },
  { symbol: 'LTC/USD', instrumentName: 'Litecoin' },
  { symbol: 'BCH/USD', instrumentName: 'Bitcoin Cash' },
  { symbol: 'SHIB/USD', instrumentName: 'Shiba Inu' },
];

const WATCHLIST_STORAGE_PREFIX = 'stratify-global-market-watchlist';
const CUSTOM_WATCHLISTS_STORAGE_KEY = 'stratify-global-market-custom-watchlists';
const ACTIVE_WATCHLIST_TAB_STORAGE_KEY = 'stratify-global-market-active-watchlist-tab';

const PAGE_TRANSITION = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
};

const sectionMotion = (index) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.1 + (index * 0.05), duration: 0.3 },
});

const listItemMotion = (index) => ({
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0 },
  transition: { delay: index * 0.03, duration: 0.25 },
});

const interactiveTransition = { type: 'spring', stiffness: 400, damping: 25 };

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

const sanitizeWatchlistName = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 24);

const makeWatchlistId = (name) => {
  const slug = sanitizeWatchlistName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `wl-${slug || 'custom'}-${Date.now().toString(36)}`;
};

const loadStoredCustomWatchlists = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_WATCHLISTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => {
        const id = String(entry?.id || '').trim();
        const name = sanitizeWatchlistName(entry?.name);
        const symbols = dedupeSymbols(Array.isArray(entry?.symbols) ? entry.symbols : []);
        if (!id || !name) return null;
        return { id, name, symbols };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
};

const loadStoredActiveWatchlistTab = () => {
  if (typeof window === 'undefined') return 'main';
  const stored = localStorage.getItem(ACTIVE_WATCHLIST_TAB_STORAGE_KEY);
  return stored || 'main';
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

const formatSignedChange = (value, currency) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '--';
  const sign = numeric >= 0 ? '+' : '-';
  return `${sign}${formatPrice(Math.abs(numeric), currency)}`;
};

const formatVolume = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '--';
  const absolute = Math.abs(numeric);
  if (absolute >= 1e9) return `${(numeric / 1e9).toFixed(2)}B`;
  if (absolute >= 1e6) return `${(numeric / 1e6).toFixed(2)}M`;
  if (absolute >= 1e3) return `${(numeric / 1e3).toFixed(1)}K`;
  return numeric.toLocaleString();
};

const GlobalMarketsPage = ({
  watchlist = [],
  onAddToWatchlist,
  onRemoveFromWatchlist,
}) => {
  const normalizedWatchlist = useMemo(
    () =>
      dedupeSymbols(
        (Array.isArray(watchlist) ? watchlist : []).map((entry) =>
          normalizeSymbol(typeof entry === 'string' ? entry : entry?.symbol)
        )
      ),
    [watchlist]
  );

  const watchlistNameBySymbol = useMemo(
    () =>
      (Array.isArray(watchlist) ? watchlist : []).reduce((accumulator, entry) => {
        const symbol = normalizeSymbol(typeof entry === 'string' ? entry : entry?.symbol);
        if (!symbol) return accumulator;
        const name = typeof entry === 'string' ? symbol : String(entry?.name || symbol);
        if (!accumulator[symbol]) accumulator[symbol] = name;
        return accumulator;
      }, {}),
    [watchlist]
  );

  const [watchlists, setWatchlists] = useState(() =>
    MARKETS.reduce((acc, market) => {
      acc[market.id] = loadStoredSymbols(market.id, market.defaultSymbols);
      return acc;
    }, {})
  );

  const [quotesByMarket, setQuotesByMarket] = useState(() =>
    COLUMN_IDS.reduce((acc, id) => {
      acc[id] = {};
      return acc;
    }, {})
  );

  const [loadingByMarket, setLoadingByMarket] = useState(() =>
    COLUMN_IDS.reduce((acc, id) => {
      acc[id] = false;
      return acc;
    }, {})
  );

  const [errorByMarket, setErrorByMarket] = useState(() =>
    COLUMN_IDS.reduce((acc, id) => {
      acc[id] = null;
      return acc;
    }, {})
  );

  const [searchUiByMarket, setSearchUiByMarket] = useState(() =>
    COLUMN_IDS.reduce((acc, id) => {
      acc[id] = {
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
    COLUMN_IDS.reduce((acc, id) => {
      acc[id] = null;
      return acc;
    }, {})
  );
  const [expandedMarketId, setExpandedMarketId] = useState(null);
  const [customWatchlists, setCustomWatchlists] = useState(loadStoredCustomWatchlists);
  const [activeWatchlistTabId, setActiveWatchlistTabId] = useState(loadStoredActiveWatchlistTab);
  const [creatingWatchlist, setCreatingWatchlist] = useState(false);
  const [newWatchlistName, setNewWatchlistName] = useState('');

  const activeCustomWatchlist = useMemo(
    () => customWatchlists.find((entry) => entry.id === activeWatchlistTabId) || null,
    [customWatchlists, activeWatchlistTabId]
  );

  const activeWatchlistLabel = activeWatchlistTabId === 'main'
    ? 'Main'
    : (activeCustomWatchlist?.name || 'Main');

  const activeWatchlistSymbols = useMemo(
    () => (activeWatchlistTabId === 'main'
      ? normalizedWatchlist
      : dedupeSymbols(activeCustomWatchlist?.symbols || [])),
    [activeWatchlistTabId, activeCustomWatchlist?.symbols, normalizedWatchlist]
  );

  const searchDebounceKey = useMemo(
    () =>
      JSON.stringify(
        COLUMN_IDS.map((id) => {
          const ui = searchUiByMarket[id] || {};
          return [id, Boolean(ui.open), String(ui.query || '')];
        })
      ),
    [searchUiByMarket]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    MARKETS.forEach((market) => {
      localStorage.setItem(getStorageKey(market.id), JSON.stringify(watchlists[market.id] || []));
    });
  }, [watchlists]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CUSTOM_WATCHLISTS_STORAGE_KEY, JSON.stringify(customWatchlists));
  }, [customWatchlists]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ACTIVE_WATCHLIST_TAB_STORAGE_KEY, activeWatchlistTabId);
  }, [activeWatchlistTabId]);

  useEffect(() => {
    if (activeWatchlistTabId === 'main') return;
    const stillExists = customWatchlists.some((entry) => entry.id === activeWatchlistTabId);
    if (!stillExists) {
      setActiveWatchlistTabId('main');
    }
  }, [activeWatchlistTabId, customWatchlists]);

  const fetchQuotesForMarket = useCallback(async (marketId) => {
    const symbols = marketId === WATCHLIST_COLUMN.id
      ? activeWatchlistSymbols
      : (watchlists[marketId] || []);
    if (symbols.length === 0) {
      setQuotesByMarket((prev) => ({ ...prev, [marketId]: {} }));
      setLoadingByMarket((prev) => ({ ...prev, [marketId]: false }));
      setErrorByMarket((prev) => ({ ...prev, [marketId]: null }));
      return;
    }

    setLoadingByMarket((prev) => ({ ...prev, [marketId]: true }));
    setErrorByMarket((prev) => ({ ...prev, [marketId]: null }));

    try {
      const params = new URLSearchParams({
        symbols: symbols.join(','),
      });
      const response = await fetch(`${getApiUrl('stocks')}?${params.toString()}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => []);

      if (!response.ok) {
        throw new Error(`Failed to load ${marketId.toUpperCase()} quotes`);
      }

      const rows = Array.isArray(payload) ? payload : [];
      const quoteMap = rows.reduce((acc, row) => {
        const symbol = normalizeSymbol(row?.symbol);
        if (!symbol) return acc;
        const parsedPercent = Number.isFinite(Number(row?.changePercent))
          ? Number(row?.changePercent)
          : Number.isFinite(Number(row?.percentChange))
            ? Number(row?.percentChange)
            : Number.isFinite(Number(row?.percent_change))
              ? Number(row?.percent_change)
              : Number.isFinite(Number(row?.day_change_percent))
                ? Number(row?.day_change_percent)
                : null;
        const parsedChange = Number.isFinite(Number(row?.change))
          ? Number(row?.change)
          : Number.isFinite(Number(row?.day_change))
            ? Number(row?.day_change)
            : null;
        acc[symbol] = {
          ...row,
          requestedSymbol: symbol,
          streamSymbol: symbol,
          percentChange: parsedPercent,
          change: parsedChange,
        };
        return acc;
      }, {});

      setQuotesByMarket((prev) => ({ ...prev, [marketId]: quoteMap }));
      setUpdatedAtByMarket((prev) => ({ ...prev, [marketId]: new Date().toISOString() }));
    } catch (fetchError) {
      setErrorByMarket((prev) => ({ ...prev, [marketId]: fetchError?.message || 'Failed to fetch quotes' }));
    } finally {
      setLoadingByMarket((prev) => ({ ...prev, [marketId]: false }));
    }
  }, [activeWatchlistSymbols, watchlists]);

  useEffect(() => {
    fetchQuotesForMarket(WATCHLIST_COLUMN.id);
    MARKETS.forEach((market) => {
      fetchQuotesForMarket(market.id);
    });

    // Refresh every 5 minutes instead of 10 seconds to avoid distracting updates
    const timer = setInterval(() => {
      fetchQuotesForMarket(WATCHLIST_COLUMN.id);
      MARKETS.forEach((market) => {
        fetchQuotesForMarket(market.id);
      });
    }, 300000);

    return () => clearInterval(timer);
  }, [fetchQuotesForMarket]);

  const searchSymbols = useCallback(async (marketId, query) => {
    const trimmedQuery = String(query || '').trim();

    if (!trimmedQuery) {
      setSearchUiByMarket((prev) => ({
        ...prev,
        [marketId]: {
          ...prev[marketId],
          loading: false,
          error: null,
          results: [],
        },
      }));
      return;
    }

    setSearchUiByMarket((prev) => ({
      ...prev,
      [marketId]: {
        ...prev[marketId],
        loading: true,
        error: null,
      },
    }));

    if (marketId === 'crypto') {
      const normalizedQuery = trimmedQuery.toUpperCase();
      const normalizedQueryKey = normalizedQuery.replace(/[^A-Z0-9]/g, '');
      const filtered = CRYPTO_SEARCH_UNIVERSE.filter((item) => {
        const symbol = String(item.symbol || '').toUpperCase();
        const symbolKey = symbol.replace(/[^A-Z0-9]/g, '');
        const name = String(item.instrumentName || '').toUpperCase();
        return symbol.includes(normalizedQuery) || symbolKey.includes(normalizedQueryKey) || name.includes(normalizedQuery);
      });
      setSearchUiByMarket((prev) => ({
        ...prev,
        [marketId]: {
          ...prev[marketId],
          loading: false,
          error: null,
          results: filtered.slice(0, 60),
        },
      }));
      return;
    }

    try {
      const searchMarket = marketId === WATCHLIST_COLUMN.id ? 'nyse' : marketId;
      const params = new URLSearchParams({
        market: searchMarket,
        q: trimmedQuery,
        limit: '250',
      });
      const response = await fetch(`/api/global-markets/list?${params.toString()}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || `Failed to search ${(searchMarket || marketId).toUpperCase()} tickers`);
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
    COLUMN_IDS.forEach((marketId) => {
      const marketUi = searchUiByMarket[marketId];
      if (!marketUi?.open) return;

      const timer = setTimeout(() => {
        searchSymbols(marketId, marketUi.query);
      }, 220);
      timeouts.push(timer);
    });

    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
    };
  }, [searchDebounceKey, searchSymbols]);

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

  const addSymbol = (marketId, symbol, name = '') => {
    const normalized = normalizeSymbol(symbol);
    if (!normalized) return;
    if (marketId === WATCHLIST_COLUMN.id) {
      if (activeWatchlistTabId === 'main') {
        onAddToWatchlist?.({ symbol: normalized, name: String(name || normalized) });
      } else {
        setCustomWatchlists((previous) =>
          previous.map((entry) => {
            if (entry.id !== activeWatchlistTabId) return entry;
            if (entry.symbols.includes(normalized)) return entry;
            return {
              ...entry,
              symbols: [...entry.symbols, normalized],
            };
          })
        );
      }
      return;
    }
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
    if (marketId === WATCHLIST_COLUMN.id) {
      if (activeWatchlistTabId === 'main') {
        onRemoveFromWatchlist?.(normalized);
      } else {
        setCustomWatchlists((previous) =>
          previous.map((entry) => {
            if (entry.id !== activeWatchlistTabId) return entry;
            return {
              ...entry,
              symbols: entry.symbols.filter((item) => item !== normalized),
            };
          })
        );
      }
      return;
    }
    setWatchlists((prev) => {
      const current = prev[marketId] || [];
      if (current.length <= 1) return prev;
      return {
        ...prev,
        [marketId]: current.filter((item) => item !== normalized),
      };
    });
  };

  const createWatchlistTab = useCallback(() => {
    const nextName = sanitizeWatchlistName(newWatchlistName);
    if (!nextName) return;

    const duplicateCount = customWatchlists.filter(
      (entry) => entry.name.toLowerCase() === nextName.toLowerCase()
    ).length;
    const finalName = duplicateCount > 0 ? `${nextName} ${duplicateCount + 1}` : nextName;
    const id = makeWatchlistId(finalName);

    setCustomWatchlists((previous) => [
      ...previous,
      { id, name: finalName, symbols: [] },
    ]);
    setActiveWatchlistTabId(id);
    setNewWatchlistName('');
    setCreatingWatchlist(false);
  }, [customWatchlists, newWatchlistName]);

  const visibleMarkets = useMemo(() => {
    const allMarkets = [WATCHLIST_COLUMN, ...MARKETS];
    if (!expandedMarketId) return allMarkets;
    return allMarkets.filter((market) => market.id === expandedMarketId);
  }, [expandedMarketId]);

  return (
    <motion.div {...PAGE_TRANSITION} className="relative flex h-full flex-1 flex-col overflow-hidden bg-transparent p-3">
      <motion.div
        {...sectionMotion(0)}
        className={`grid flex-1 min-h-0 gap-3 ${expandedMarketId ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5'}`}
      >
        {visibleMarkets.map((market, marketIndex) => {
          const marketQuotes = quotesByMarket[market.id] || {};
          const symbols = market.id === WATCHLIST_COLUMN.id
            ? activeWatchlistSymbols
            : (watchlists[market.id] || market.defaultSymbols);
          const searchUi = searchUiByMarket[market.id];
          const loading = loadingByMarket[market.id];
          const error = errorByMarket[market.id];
          const updatedAt = updatedAtByMarket[market.id];
          const isExpanded = expandedMarketId === market.id;

          return (
            <motion.div
              key={market.id}
              {...sectionMotion(marketIndex + 2)}
              className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#1f1f1f] bg-[#0b0b0b]"
            >
              <div className="flex items-center justify-between border-b border-[#1f1f1f] px-3 py-3">
                <div className="flex items-center gap-2">
                  <Globe className={`h-4 w-4 ${market.accent}`} strokeWidth={1.5} />
                  <h3 className="text-sm font-semibold text-white">
                    {market.id === WATCHLIST_COLUMN.id ? `${market.title} · ${activeWatchlistLabel}` : market.title}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <motion.button
                    type="button"
                    onClick={() => setExpandedMarketId((previous) => (previous === market.id ? null : market.id))}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={interactiveTransition}
                    className="inline-flex items-center justify-center rounded-lg border border-white/15 bg-white/[0.04] p-1.5 text-white/75 hover:text-white"
                    title={isExpanded ? 'Click to restore all columns' : 'Click to expand this column'}
                    aria-label={isExpanded ? 'Restore all columns' : `Expand ${market.title}`}
                  >
                    {isExpanded
                      ? <Minimize2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                      : <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.6} />}
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => toggleSearch(market.id)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={interactiveTransition}
                    className="inline-flex items-center gap-1 rounded-lg border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-[11px] font-medium text-blue-300 hover:bg-blue-500/20"
                  >
                    <Plus className="h-3 w-3" strokeWidth={1.5} />
                    Add
                  </motion.button>
                </div>
              </div>

              {market.id === WATCHLIST_COLUMN.id && (
                <div className="border-b border-[#1f1f1f] px-3 py-2">
                  <div className="flex items-center gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                    <button
                      type="button"
                      onClick={() => setActiveWatchlistTabId('main')}
                      className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                        activeWatchlistTabId === 'main'
                          ? 'bg-blue-500/15 text-blue-300'
                          : 'text-gray-400 hover:bg-white/[0.04] hover:text-white'
                      }`}
                    >
                      Main
                    </button>
                    {customWatchlists.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => setActiveWatchlistTabId(entry.id)}
                        className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                          activeWatchlistTabId === entry.id
                            ? 'bg-blue-500/15 text-blue-300'
                            : 'text-gray-400 hover:bg-white/[0.04] hover:text-white'
                        }`}
                      >
                        {entry.name}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCreatingWatchlist((previous) => !previous)}
                      className="shrink-0 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20"
                    >
                      + New
                    </button>
                  </div>
                  {creatingWatchlist && (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        value={newWatchlistName}
                        onChange={(event) => setNewWatchlistName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            createWatchlistTab();
                          } else if (event.key === 'Escape') {
                            event.preventDefault();
                            setCreatingWatchlist(false);
                            setNewWatchlistName('');
                          }
                        }}
                        placeholder="Name new watchlist"
                        className="h-8 w-full rounded-lg border border-white/10 bg-black/30 px-2 text-xs text-white outline-none focus:border-emerald-500/60"
                      />
                      <button
                        type="button"
                        onClick={createWatchlistTab}
                        className="shrink-0 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20"
                      >
                        Create
                      </button>
                    </div>
                  )}
                </div>
              )}

              {searchUi?.open && (
                <div className="border-b border-[#1f1f1f] px-3 py-3">
                  <div className="mb-2 flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                    <Search className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
                    <input
                      value={searchUi.query}
                      onChange={(event) => setSearchQuery(market.id, event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          const firstResult = searchUi.results?.[0];
                          const symbol = normalizeSymbol(firstResult?.symbol);
                          if (!symbol) return;
                          addSymbol(market.id, symbol, firstResult?.instrumentName || firstResult?.name || symbol);
                          setSearchUiByMarket((previous) => ({
                            ...previous,
                            [market.id]: {
                              ...previous[market.id],
                              query: '',
                              results: [],
                              open: false,
                            },
                          }));
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          setSearchUiByMarket((previous) => ({
                            ...previous,
                            [market.id]: {
                              ...previous[market.id],
                              query: '',
                              results: [],
                              open: false,
                            },
                          }));
                        }
                      }}
                      placeholder={market.id === WATCHLIST_COLUMN.id ? 'Search ticker for watchlist...' : `Search ${market.title} ticker...`}
                      className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
                    />
                  </div>

                  {searchUi.error && (
                    <div className="mb-2 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-300">
                      {searchUi.error}
                    </div>
                  )}

                  <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-white/8 bg-[#060d18]/95 p-1" style={{ scrollbarWidth: 'none' }}>
                    {searchUi.loading ? (
                      <div className="flex items-center gap-2 rounded border border-white/10 bg-white/[0.02] px-2 py-1.5 text-[11px] text-gray-300">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" strokeWidth={1.5} />
                        Searching symbols...
                      </div>
                    ) : searchUi.results.length > 0 ? (
                      searchUi.results.slice(0, 30).map((item, index) => {
                        const symbol = normalizeSymbol(item?.symbol);
                        if (!symbol) return null;
                        const alreadyAdded = symbols.includes(symbol);
                        return (
                          <motion.button
                            key={`${market.id}-${symbol}-${item?.instrumentName || ''}`}
                            type="button"
                            onClick={() => {
                              addSymbol(market.id, symbol, item?.instrumentName || item?.name || symbol);
                              setSearchUiByMarket((previous) => ({
                                ...previous,
                                [market.id]: {
                                  ...previous[market.id],
                                  query: '',
                                  results: [],
                                  open: false,
                                },
                              }));
                            }}
                            disabled={alreadyAdded}
                            {...listItemMotion(index)}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            transition={{ ...listItemMotion(index).transition, ...interactiveTransition }}
                            className={`flex w-full items-center justify-between gap-2 rounded border px-2 py-1.5 text-left text-xs transition-colors ${
                              alreadyAdded
                                ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
                                : 'border-white/10 bg-white/[0.02] text-white/85 hover:bg-blue-500/10'
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="font-semibold">${symbol}</span>
                              <span className="ml-2 truncate text-white/55">{item?.instrumentName || item?.name || symbol}</span>
                            </span>
                            <Plus className="h-3.5 w-3.5 shrink-0 text-blue-300" strokeWidth={1.7} />
                          </motion.button>
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
                <div className="mx-3 mt-2 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-300">
                  {error}
                </div>
              )}

              <div className="min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                {symbols.length === 0 && (
                  <div className="px-3 py-4 text-xs text-gray-500">
                    No tickers yet. Use Add to include symbols.
                  </div>
                )}
                {isExpanded && symbols.length > 0 && (
                  <div className="grid grid-cols-[minmax(180px,1.5fr)_minmax(90px,0.9fr)_minmax(90px,0.9fr)_minmax(90px,0.9fr)_minmax(90px,0.9fr)_34px] items-center gap-2 border-b border-[#1f1f1f] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500">
                    <span>Symbol</span>
                    <span className="text-right">Last</span>
                    <span className="text-right">Change</span>
                    <span className="text-right">Chg %</span>
                    <span className="text-right">Volume</span>
                    <span />
                  </div>
                )}
                {symbols.map((symbol, index) => {
                  const quote = marketQuotes[symbol] || {};
                  const positive = Number(quote?.percentChange) >= 0;
                  const changeValue = Number.isFinite(Number(quote?.change)) ? Number(quote?.change) : null;
                  const percentValue = Number.isFinite(Number(quote?.percentChange))
                    ? Number(quote?.percentChange)
                    : null;
                  const volumeValue = quote?.volume ?? quote?.avg_volume ?? quote?.average_volume ?? quote?.averageVolume;
                  return (
                    <motion.div
                      key={`${market.id}-${symbol}`}
                      {...listItemMotion(index)}
                      className={
                        isExpanded
                          ? 'grid grid-cols-[minmax(180px,1.5fr)_minmax(90px,0.9fr)_minmax(90px,0.9fr)_minmax(90px,0.9fr)_minmax(90px,0.9fr)_34px] items-center gap-2 border-b border-[#1f1f1f]/40 px-3 py-2 transition-colors hover:bg-white/[0.03] last:border-b-0'
                          : 'flex items-center justify-between gap-1 border-b border-[#1f1f1f]/40 px-3 py-2 transition-colors hover:bg-white/[0.03] last:border-b-0'
                      }
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-sm font-semibold text-white">${symbol}</div>
                        <div className="truncate text-[11px] text-gray-500">
                          {quote?.name || watchlistNameBySymbol[symbol] || symbol}
                        </div>
                      </div>
                      {isExpanded ? (
                        <>
                          <div className="text-right text-sm font-mono text-white">{formatPrice(quote?.price, market.currency)}</div>
                          <div className={`text-right text-xs font-mono font-medium ${percentClass(changeValue)}`}>
                            {formatSignedChange(changeValue, market.currency)}
                          </div>
                          <div className={`text-right text-xs font-medium ${percentClass(percentValue)}`}>
                            {formatPercent(percentValue)}
                          </div>
                          <div className="text-right text-xs font-mono text-gray-300">
                            {formatVolume(volumeValue)}
                          </div>
                        </>
                      ) : (
                        <div className="min-w-[96px] text-right">
                          <div className="text-sm font-mono text-white">{formatPrice(quote?.price, market.currency)}</div>
                          <div className={`inline-flex items-center gap-1 text-xs font-medium ${percentClass(quote?.percentChange)}`}>
                            {positive ? <TrendingUp className="h-3 w-3" strokeWidth={1.5} /> : <TrendingDown className="h-3 w-3" strokeWidth={1.5} />}
                            {formatPercent(quote?.percentChange)}
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-end">
                        <motion.button
                          type="button"
                          onClick={() => removeSymbol(market.id, symbol)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          transition={interactiveTransition}
                          className="rounded p-1 text-gray-500 transition-colors hover:bg-red-500/15 hover:text-red-400"
                          title="Remove ticker"
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                        </motion.button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="border-t border-[#1f1f1f] px-3 py-2 text-[11px] text-gray-500">
                {updatedAt
                  ? `Last update ${new Date(updatedAt).toLocaleTimeString()}`
                  : 'Waiting for market data...'}
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      <AnimatePresence initial={false}>
        {COLUMN_IDS.some((marketId) => Boolean(errorByMarket[marketId])) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-2 rounded-xl border border-white/10 bg-[#0a1628]/70 px-3 py-2 text-xs text-gray-300 shadow-lg shadow-black/20"
          >
            <div className="flex items-center gap-2">
              <WifiOff className="h-3.5 w-3.5 text-yellow-400" strokeWidth={1.5} />
              <span>Some exchanges are reconnecting. Data will refresh automatically.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default GlobalMarketsPage;
