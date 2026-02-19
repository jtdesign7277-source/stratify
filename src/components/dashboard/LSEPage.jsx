import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import useTwelveData from '../../hooks/useTwelveData';

const WATCHLIST_STORAGE_KEY = 'stratify-lse-watchlist';
const LSE_LIST_LIMIT = 1000;

const DEFAULT_LSE_UNIVERSE = [
  { symbol: 'SHEL', instrumentName: 'Shell plc' },
  { symbol: 'AZN', instrumentName: 'AstraZeneca' },
  { symbol: 'HSBA', instrumentName: 'HSBC Holdings' },
  { symbol: 'BP', instrumentName: 'BP plc' },
  { symbol: 'ULVR', instrumentName: 'Unilever PLC' },
  { symbol: 'RIO', instrumentName: 'Rio Tinto' },
  { symbol: 'GSK', instrumentName: 'GSK plc' },
  { symbol: 'BARC', instrumentName: 'Barclays PLC' },
  { symbol: 'LLOY', instrumentName: 'Lloyds Banking Group' },
  { symbol: 'NG', instrumentName: 'National Grid' },
  { symbol: 'REL', instrumentName: 'RELX' },
  { symbol: 'VOD', instrumentName: 'Vodafone Group' },
  { symbol: 'BATS', instrumentName: 'British American Tobacco' },
  { symbol: 'DGE', instrumentName: 'Diageo' },
  { symbol: 'GLEN', instrumentName: 'Glencore' },
  { symbol: 'LSEG', instrumentName: 'London Stock Exchange Group' },
  { symbol: 'PRU', instrumentName: 'Prudential' },
  { symbol: 'AAL', instrumentName: 'Anglo American' },
  { symbol: 'TSCO', instrumentName: 'Tesco' },
  { symbol: 'SMIN', instrumentName: 'Smiths Group' },
  { symbol: 'RR', instrumentName: 'Rolls-Royce Holdings' },
  { symbol: 'IAG', instrumentName: 'International Airlines Group' },
  { symbol: 'EXPN', instrumentName: 'Experian' },
  { symbol: 'SPX', instrumentName: 'Spirax Group' },
  { symbol: 'WPP', instrumentName: 'WPP plc' },
  { symbol: 'ABF', instrumentName: 'Associated British Foods' },
  { symbol: 'CNA', instrumentName: 'Centrica' },
  { symbol: 'MKS', instrumentName: 'Marks and Spencer Group' },
  { symbol: 'AUTO', instrumentName: 'Auto Trader Group' },
  { symbol: 'PSN', instrumentName: 'Persimmon plc' },
];

const DEFAULT_WATCHLIST = ['SHEL', 'AZN', 'HSBA', 'BP', 'BARC', 'LLOY', 'RIO', 'VOD'];

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
    .map((symbol) => normalizeSymbol(symbol))
    .filter((symbol) => {
      if (!symbol || seen.has(symbol)) return false;
      seen.add(symbol);
      return true;
    });
};

const loadStoredWatchlist = () => {
  if (typeof window === 'undefined') return DEFAULT_WATCHLIST;

  try {
    const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!raw) return DEFAULT_WATCHLIST;

    const parsed = JSON.parse(raw);
    const cleaned = dedupeSymbols(Array.isArray(parsed) ? parsed : []);
    return cleaned.length > 0 ? cleaned : DEFAULT_WATCHLIST;
  } catch {
    return DEFAULT_WATCHLIST;
  }
};

const formatPrice = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
  return `£${num.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatPercent = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
};

const formatTime = (value) => {
  if (!value) return '--';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '--';
  return date.toLocaleTimeString();
};

const valueClass = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 'text-white/55';
  if (num > 0) return 'text-emerald-400';
  if (num < 0) return 'text-red-400';
  return 'text-white/70';
};

const LSEPage = () => {
  const [watchlistSymbols, setWatchlistSymbols] = useState(loadStoredWatchlist);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [availableStocks, setAvailableStocks] = useState(DEFAULT_LSE_UNIVERSE);
  const [loadingUniverse, setLoadingUniverse] = useState(false);
  const [universeError, setUniverseError] = useState(null);
  const [selectedSymbols, setSelectedSymbols] = useState([]);

  const pickerRef = useRef(null);
  const searchDebounceRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlistSymbols));
  }, [watchlistSymbols]);

  const labelsBySymbol = useMemo(() => {
    const mapping = {};

    DEFAULT_LSE_UNIVERSE.forEach((item) => {
      mapping[item.symbol] = item.instrumentName;
    });

    availableStocks.forEach((item) => {
      const symbol = normalizeSymbol(item?.symbol);
      if (!symbol) return;
      mapping[symbol] = item?.instrumentName || item?.name || mapping[symbol] || symbol;
    });

    return mapping;
  }, [availableStocks]);

  const {
    quoteList,
    status,
    error,
    loadingQuotes,
    refreshQuotes,
  } = useTwelveData({
    symbols: watchlistSymbols,
    labelsBySymbol,
  });

  const loadUniverse = useCallback(async (query = '') => {
    setLoadingUniverse(true);
    setUniverseError(null);

    try {
      const q = String(query || '').trim();
      const params = new URLSearchParams({ limit: String(LSE_LIST_LIMIT) });
      if (q) params.set('q', q);

      const response = await fetch(`/api/lse/list?${params.toString()}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load London stocks');
      }

      const rows = Array.isArray(payload?.data) ? payload.data : [];
      if (rows.length > 0) {
        setAvailableStocks(rows);
      } else if (!q) {
        setAvailableStocks(DEFAULT_LSE_UNIVERSE);
      }
    } catch (loadError) {
      setUniverseError(loadError?.message || 'Unable to load London stock list');
      if (!String(query || '').trim()) {
        setAvailableStocks(DEFAULT_LSE_UNIVERSE);
      }
    } finally {
      setLoadingUniverse(false);
    }
  }, []);

  useEffect(() => {
    if (!isPickerOpen) return;

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      loadUniverse(pickerQuery);
    }, 220);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [isPickerOpen, loadUniverse, pickerQuery]);

  useEffect(() => {
    if (!isPickerOpen) return undefined;

    const handleOutsideClick = (event) => {
      if (!pickerRef.current) return;
      if (!pickerRef.current.contains(event.target)) {
        setIsPickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isPickerOpen]);

  const toggleSymbolSelection = (symbol) => {
    const normalized = normalizeSymbol(symbol);
    if (!normalized) return;

    setSelectedSymbols((prev) => {
      if (prev.includes(normalized)) {
        return prev.filter((item) => item !== normalized);
      }
      return [...prev, normalized];
    });
  };

  const addSelectedToWatchlist = () => {
    if (selectedSymbols.length === 0) {
      setIsPickerOpen(false);
      return;
    }

    setWatchlistSymbols((prev) => dedupeSymbols([...prev, ...selectedSymbols]));
    setSelectedSymbols([]);
    setIsPickerOpen(false);
  };

  const removeFromWatchlist = (symbol) => {
    const normalized = normalizeSymbol(symbol);
    setWatchlistSymbols((prev) => {
      const next = prev.filter((item) => item !== normalized);
      return next.length > 0 ? next : prev;
    });
  };

  const clearSelection = () => setSelectedSymbols([]);

  const connectionLabel = useMemo(() => {
    if (status.connected) return 'Live';
    if (status.connecting) return 'Connecting...';
    return 'Offline';
  }, [status.connected, status.connecting]);

  return (
    <div className="h-full w-full overflow-y-auto bg-transparent px-5 py-4" style={{ scrollbarWidth: 'none' }}>
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div className="relative z-30 rounded-xl border border-blue-500/20 bg-[#060d18]/70 p-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-end gap-4">
              <div className="leading-none text-blue-500">
                <div className="text-[28px] font-black tracking-[0.08em] sm:text-[30px]">LONDON</div>
                <div className="text-[28px] font-black tracking-[0.08em] sm:text-[30px]">STOCK</div>
                <div className="text-[28px] font-black tracking-[0.08em] sm:text-[30px]">EXCHANGE</div>
                <div className="mt-1 text-[13px] font-medium tracking-[0.02em] text-blue-300">
                  An LSEG Business
                </div>
              </div>

              <div className="pb-1 text-xs text-white/55">
                Build your London watchlist in one click, then stream quotes live.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`inline-flex items-center gap-1.5 ${status.connected ? 'text-emerald-400' : 'text-amber-300'}`}>
                {status.connected ? (
                  <Wifi className="h-3.5 w-3.5" strokeWidth={1.5} />
                ) : (
                  <WifiOff className="h-3.5 w-3.5" strokeWidth={1.5} />
                )}
                {connectionLabel}
              </span>

              <button
                type="button"
                onClick={refreshQuotes}
                className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-blue-300 transition-colors hover:bg-blue-500/20"
              >
                <RefreshCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
                Refresh
              </button>

              <div className="relative" ref={pickerRef}>
                <button
                  type="button"
                  onClick={() => setIsPickerOpen((prev) => !prev)}
                  className="inline-flex items-center gap-1 rounded-md border border-blue-500/40 bg-blue-500/15 px-3 py-1 text-blue-200 transition-colors hover:bg-blue-500/25"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Add London Stocks
                </button>

                {isPickerOpen && (
                  <div className="absolute right-0 top-9 z-[100] w-[460px] rounded-xl border border-blue-500/30 bg-[#060d18]/95 p-3 shadow-2xl backdrop-blur">
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-semibold text-white">LSE Stock Selector</h2>
                        <p className="text-[11px] text-white/50">Select multiple tickers, add, then close.</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsPickerOpen(false)}
                        className="rounded-md p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        <X className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                    </div>

                    <div className="mb-2 flex items-center gap-2 rounded-lg border border-white/10 bg-[#0a1628]/70 px-3 py-2">
                      <Search className="h-4 w-4 text-white/45" strokeWidth={1.5} />
                      <input
                        value={pickerQuery}
                        onChange={(event) => setPickerQuery(event.target.value)}
                        placeholder="Search London stocks (name or ticker)..."
                        className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
                      />
                    </div>

                    {universeError && (
                      <div className="mb-2 rounded-md border border-rose-500/25 bg-rose-500/10 px-2.5 py-2 text-xs text-rose-300">
                        {universeError}
                      </div>
                    )}

                    <div className="max-h-[320px] space-y-1 overflow-y-auto pr-1" style={{ scrollbarWidth: 'none' }}>
                      {loadingUniverse ? (
                        <div className="flex items-center gap-2 rounded-md border border-white/10 bg-[#0a1628]/60 px-3 py-2 text-sm text-white/70">
                          <Loader2 className="h-4 w-4 animate-spin text-blue-400" strokeWidth={1.5} />
                          Loading London stock list...
                        </div>
                      ) : availableStocks.length > 0 ? (
                        availableStocks.map((item) => {
                          const symbol = normalizeSymbol(item?.symbol);
                          if (!symbol) return null;

                          const isSelected = selectedSymbols.includes(symbol);
                          const alreadyInWatchlist = watchlistSymbols.includes(symbol);

                          return (
                            <button
                              key={`${symbol}-${item?.micCode || ''}`}
                              type="button"
                              onClick={() => toggleSymbolSelection(symbol)}
                              className={`flex w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left transition-colors ${
                                isSelected
                                  ? 'border-blue-400/50 bg-blue-500/15'
                                  : 'border-white/10 bg-[#0a1628]/60 hover:border-blue-500/30 hover:bg-blue-500/10'
                              }`}
                            >
                              <span
                                className={`mt-[2px] inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                                  isSelected ? 'border-blue-300 bg-blue-500 text-white' : 'border-white/30'
                                }`}
                              >
                                {isSelected && <Check className="h-3 w-3" strokeWidth={2} />}
                              </span>

                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-white">{symbol}</span>
                                <span className="block truncate text-xs text-white/60">
                                  {item?.instrumentName || item?.name || symbol}
                                </span>
                              </span>

                              {alreadyInWatchlist && (
                                <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                                  In watchlist
                                </span>
                              )}
                            </button>
                          );
                        })
                      ) : (
                        <div className="rounded-md border border-white/10 bg-[#0a1628]/60 px-3 py-2 text-sm text-white/55">
                          No London stocks matched that search.
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="rounded-md border border-white/15 px-2.5 py-1.5 text-xs text-white/70 transition-colors hover:bg-white/10"
                      >
                        Clear selection
                      </button>

                      <button
                        type="button"
                        onClick={addSelectedToWatchlist}
                        className="rounded-md border border-blue-500/40 bg-blue-500/20 px-3 py-1.5 text-xs font-semibold text-blue-200 transition-colors hover:bg-blue-500/30"
                      >
                        Add Selected ({selectedSymbols.length})
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-3 rounded-md border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </div>
          )}
        </div>

        <section className="relative z-10 rounded-xl border border-blue-500/20 bg-[#0a1628]/75 p-4 backdrop-blur">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">Your London Watchlist ({watchlistSymbols.length})</h2>
            {loadingQuotes ? <Loader2 className="h-4 w-4 animate-spin text-blue-400" strokeWidth={1.5} /> : null}
          </div>

          {quoteList.length === 0 ? (
            <div className="rounded-lg border border-white/10 bg-[#060d18]/70 p-4 text-sm text-white/55">
              No symbols selected yet. Use <span className="text-blue-300">Add London Stocks</span> to build your watchlist.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {quoteList.map((quote) => {
                const symbol = normalizeSymbol(quote?.symbol || quote?.streamSymbol);
                return (
                  <article key={symbol} className="rounded-lg border border-white/10 bg-[#060d18]/70 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">{symbol}</div>
                        <div className="mt-0.5 truncate text-xs text-white/55">
                          {quote?.name || labelsBySymbol[symbol] || symbol}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFromWatchlist(symbol)}
                        className="rounded-md p-1 text-white/45 transition-colors hover:bg-white/10 hover:text-white"
                        title="Remove from watchlist"
                      >
                        <X className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                    </div>

                    <div className="mt-3 text-lg font-semibold text-white">{formatPrice(quote?.price)}</div>
                    <div className={`text-sm font-medium ${valueClass(quote?.percentChange)}`}>
                      {formatPercent(quote?.percentChange)}
                    </div>
                    <div className="mt-2 text-[11px] text-white/45">Updated: {formatTime(quote?.timestamp)}</div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default LSEPage;
