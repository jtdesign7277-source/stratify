import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';

const MAX_SYMBOLS = 120;
const AUTO_REFRESH_MS = 15000;

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

const SYMBOL_LABELS = {
  AAPL: 'Apple Inc.',
  MSFT: 'Microsoft Corporation',
  NVDA: 'NVIDIA Corporation',
  TSLA: 'Tesla, Inc.',
  AMZN: 'Amazon.com, Inc.',
  META: 'Meta Platforms, Inc.',
  GOOGL: 'Alphabet Inc.',
  SPY: 'SPDR S&P 500 ETF Trust',
  QQQ: 'Invesco QQQ Trust',
  DIA: 'SPDR Dow Jones ETF',
  IWM: 'iShares Russell 2000 ETF',
  GLD: 'SPDR Gold Shares',
  JPM: 'JPMorgan Chase & Co.',
  BAC: 'Bank of America Corp.',
  V: 'Visa Inc.',
  MA: 'Mastercard Inc.',
  PYPL: 'PayPal Holdings, Inc.',
  NFLX: 'Netflix, Inc.',
  AMD: 'Advanced Micro Devices, Inc.',
};

const normalizeSymbol = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^\$/, '')
    .replace(/\s+/g, '')
    .split(':')[0];

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
  const [newSymbol, setNewSymbol] = useState('');
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [quotesBySymbol, setQuotesBySymbol] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const normalizedWatchlist = useMemo(() => {
    const source = Array.isArray(watchlist) && watchlist.length > 0 ? watchlist : DEFAULT_WATCHLIST;
    const seen = new Set();

    return source
      .map((item) => {
        const symbol = normalizeSymbol(typeof item === 'string' ? item : item?.symbol);
        if (!symbol) return null;
        const name = typeof item === 'object' && item?.name ? item.name : SYMBOL_LABELS[symbol] || symbol;
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

  const refreshQuotes = useCallback(async () => {
    if (activeSymbols.length === 0) {
      setQuotesBySymbol({});
      setLastUpdated(null);
      return;
    }

    setIsRefreshing(true);
    setLoading((prev) => prev || Object.keys(quotesBySymbol).length === 0);
    setError('');

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
        map[symbol] = row;
      });

      setQuotesBySymbol(map);
      setLastUpdated(new Date().toISOString());
    } catch (loadError) {
      setError(loadError?.message || 'Failed to refresh quotes');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [activeSymbols, quotesBySymbol]);

  useEffect(() => {
    refreshQuotes();
    const timer = setInterval(refreshQuotes, AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [refreshQuotes]);

  useEffect(() => {
    if (!selectedTicker && activeSymbols.length > 0) {
      setSelectedTicker(activeSymbols[0]);
      return;
    }

    if (selectedTicker && !activeSymbols.includes(selectedTicker)) {
      setSelectedTicker(activeSymbols[0] || null);
    }
  }, [activeSymbols, selectedTicker]);

  const handleAdd = () => {
    const symbol = normalizeSymbol(newSymbol);
    if (!symbol) return;
    if (activeSymbols.includes(symbol)) {
      setNewSymbol('');
      return;
    }
    if (activeSymbols.length >= MAX_SYMBOLS) {
      setError(`Watchlist limit reached (${MAX_SYMBOLS} symbols)`);
      return;
    }

    onAddToWatchlist?.({
      symbol,
      name: SYMBOL_LABELS[symbol] || symbol,
    });
    setNewSymbol('');
    setError('');
  };

  const selectedName = visibleWatchlist.find((item) => item.symbol === selectedTicker)?.name || selectedTicker;

  return (
    <div className="flex h-full flex-1 overflow-hidden bg-transparent">
      <div className={`flex flex-col border-r border-[#1f1f1f] transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-[420px]'}`}>
        <div className="flex items-center justify-between border-b border-[#1f1f1f] px-4 py-3">
          {!isCollapsed && (
            <div>
              <h1 className="text-xl font-semibold text-white">Watchlist</h1>
              <p className="text-xs text-gray-400">Twelve Data batch quotes</p>
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
            <div className="border-b border-[#1f1f1f] px-4 py-3">
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                <Search className="h-4 w-4 text-gray-400" strokeWidth={1.5} />
                <input
                  value={newSymbol}
                  onChange={(event) => setNewSymbol(normalizeSymbol(event.target.value))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleAdd();
                    }
                  }}
                  placeholder="Add symbol (example: TSLA)"
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
                />
                {newSymbol ? (
                  <button
                    type="button"
                    onClick={() => setNewSymbol('')}
                    className="rounded p-0.5 text-gray-500 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleAdd}
                  className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
                >
                  <Plus className="h-3 w-3" strokeWidth={1.5} />
                  Add
                </button>
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
                <span>{activeSymbols.length}/{MAX_SYMBOLS} symbols</span>
                <span className="inline-flex items-center gap-1 text-blue-300">
                  <Activity className="h-3 w-3" strokeWidth={1.5} />
                  Batch refresh: {activeSymbols.length} symbols in 1 call
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] text-gray-500">Last update: {formatTime(lastUpdated)}</span>
                <button
                  type="button"
                  onClick={refreshQuotes}
                  className="inline-flex items-center gap-1 rounded border border-blue-500/40 bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-300 hover:bg-blue-500/20"
                >
                  <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} strokeWidth={1.5} />
                  Refresh
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
                    className={`flex w-full items-center justify-between border-b border-[#1f1f1f]/40 px-4 py-3 text-left transition-colors ${
                      rowActive ? 'bg-blue-500/10' : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-sm font-semibold text-white">${item.symbol}</div>
                      <div className="truncate text-xs text-gray-500">{item.name || SYMBOL_LABELS[item.symbol] || item.symbol}</div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
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
