import { useState, useCallback, useEffect } from 'react';

// Brain icon SVG
const BrainIcon = ({ className, isSearching }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
  </svg>
);

const SearchIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
  </svg>
);

const ChevronIcon = ({ open, className = "w-3 h-3" }) => (
  <svg className={`${className} transition-transform duration-200 ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

const TrendUpIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
  </svg>
);

const TrendDownIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181" />
  </svg>
);

const XIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const LoaderIcon = ({ className }) => (
  <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
  </svg>
);

const formatNumber = (num) => {
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toString();
};

export default function StockSearch({ collapsed = false, onAddToWatchlist, watchlist = [] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [error, setError] = useState(null);
  const [savedListExpanded, setSavedListExpanded] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Debounced autocomplete search
  useEffect(() => {
    if (!query || query.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoadingSuggestions(true);
      try {
        // Try our API first
        const response = await fetch(`/api/stock/search?q=${encodeURIComponent(query)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.results) {
            setSuggestions(data.results.slice(0, 6));
            setShowSuggestions(true);
            return;
          }
        }
        // Fallback: use Yahoo Finance autocomplete
        const yahooUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=6&newsCount=0`;
        const yahooRes = await fetch(yahooUrl);
        const yahooData = await yahooRes.json();
        if (yahooData.quotes) {
          setSuggestions(yahooData.quotes.filter(q => q.quoteType === 'EQUITY' || q.quoteType === 'ETF').slice(0, 6));
          setShowSuggestions(true);
        }
      } catch (err) {
        console.error('Autocomplete error:', err);
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Auto-expand when user starts typing
  const handleQueryChange = (e) => {
    const val = e.target.value.toUpperCase();
    setQuery(val);
    setSearchResult(null);
    if (val && !isExpanded) {
      setIsExpanded(true);
    }
  };

  // Select suggestion
  const selectSuggestion = (suggestion) => {
    const symbol = suggestion.symbol;
    setQuery(symbol);
    setShowSuggestions(false);
    setSuggestions([]);
    searchStock(symbol);
  };

  // Check if stock is already in watchlist
  const isInWatchlist = (symbol) => {
    return watchlist.some(s => s.symbol === symbol);
  };

  const searchStock = useCallback(async (symbol) => {
    if (!symbol.trim()) return;
    
    setIsSearching(true);
    setError(null);
    setSearchResult(null);
    
    try {
      const upperSymbol = symbol.toUpperCase().trim();
      // Use our API endpoint (works on Vercel, falls back to direct for dev)
      const apiUrl = `/api/stock/${encodeURIComponent(upperSymbol)}`;
      
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Symbol not found');
      }

      if (data.stock) {
        setSearchResult(data.stock);
      } else {
        throw new Error(`Symbol "${upperSymbol}" not found`);
      }
    } catch (err) {
      // Fallback: try direct Yahoo Finance for local dev
      try {
        const upperSymbol = symbol.toUpperCase().trim();
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(upperSymbol)}?interval=1d&range=1d`;
        const response = await fetch(url);
        const data = await response.json();
        const result = data?.chart?.result?.[0];
        const meta = result?.meta;

        if (meta) {
          const price = meta.regularMarketPrice || 0;
          const previousClose = meta.chartPreviousClose || meta.previousClose || price;
          const change = price - previousClose;
          const changePercent = previousClose ? (change / previousClose) * 100 : 0;

          setSearchResult({
            symbol: upperSymbol,
            name: meta.shortName || meta.longName || upperSymbol,
            price: price,
            change: change,
            changePercent: changePercent,
            volume: meta.regularMarketVolume,
            marketCap: meta.marketCap,
          });
          return;
        }
      } catch {
        // Fallback failed too
      }
      setError(err.message || 'Failed to fetch stock data');
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    searchStock(query);
  };

  const addToWatchlist = (stock) => {
    if (onAddToWatchlist && !isInWatchlist(stock.symbol)) {
      onAddToWatchlist(stock);
    }
    setSearchResult(null);
    setQuery('');
  };

  const getChangeColor = (change) => {
    if (change > 0) return 'text-emerald-400';
    if (change < 0) return 'text-red-400';
    return 'text-zinc-400';
  };

  // Collapsed view - just the brain icon
  if (collapsed) {
    return (
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="group relative w-full flex items-center justify-center py-3 hover:bg-white/5 transition-colors"
        title="Stock Search"
      >
        <div className="relative">
          <div className={`
            absolute inset-0 rounded-full blur-md transition-opacity duration-300
            bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500
            opacity-0 group-hover:opacity-40
          `} style={{ transform: 'scale(1.8)' }} />
          <BrainIcon className="relative w-5 h-5 text-zinc-400 group-hover:text-blue-400 transition-colors" />
        </div>
      </button>
    );
  }

  return (
    <div className="border-b border-white/5">
      {/* Tab Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`
          group relative w-full px-4 py-3 flex items-center gap-3 
          transition-all duration-300 ease-out
          hover:bg-gradient-to-r hover:from-violet-500/10 hover:via-blue-500/10 hover:to-cyan-500/10
          ${isExpanded ? 'bg-gradient-to-r from-violet-500/5 via-blue-500/5 to-cyan-500/5' : ''}
        `}
      >
        {/* Brain icon with glow */}
        <div className={`relative flex items-center justify-center ${isSearching ? 'animate-pulse' : ''}`}>
          {/* Glow layers */}
          <div className={`
            absolute inset-0 rounded-full blur-md transition-opacity duration-300
            bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500
            ${isSearching ? 'opacity-60 animate-pulse' : 'opacity-0 group-hover:opacity-40'}
          `} style={{ transform: 'scale(1.8)' }} />
          <div className={`
            absolute inset-0 rounded-full blur-sm transition-opacity duration-300
            bg-gradient-to-r from-violet-400 via-blue-400 to-cyan-400
            ${isSearching ? 'opacity-80' : 'opacity-0 group-hover:opacity-60'}
          `} style={{ transform: 'scale(1.4)' }} />
          
          <BrainIcon 
            className={`
              relative w-5 h-5 transition-all duration-300
              ${isSearching 
                ? 'text-blue-300' 
                : 'text-zinc-400 group-hover:text-blue-300'
              }
            `}
            isSearching={isSearching}
          />
          
          {/* Neural activity dots when searching */}
          {isSearching && (
            <>
              <span className="absolute -top-1 -right-1 h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
              <span className="absolute -bottom-1 -left-1 h-1.5 w-1.5 rounded-full bg-violet-400 animate-ping" style={{ animationDelay: '0.2s' }} />
              <span className="absolute top-0 -left-2 h-1 w-1 rounded-full bg-blue-400 animate-ping" style={{ animationDelay: '0.4s' }} />
            </>
          )}
        </div>

        <span className={`
          font-medium text-sm transition-all duration-300
          ${isSearching ? 'text-blue-300' : 'text-zinc-400 group-hover:text-zinc-200'}
        `}>
          {isSearching ? 'Analyzing...' : 'Stock Search'}
        </span>

        {watchlist.length > 0 && (
          <span className="ml-auto mr-2 text-xs text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
            {watchlist.length}
          </span>
        )}

        <SearchIcon className="w-4 h-4 text-zinc-500 group-hover:text-zinc-400 ml-auto" />

        {/* Bottom glow bar */}
        <div className={`
          absolute bottom-0 left-0 right-0 h-px
          bg-gradient-to-r from-transparent via-blue-500 to-transparent
          transition-opacity duration-300
          ${isSearching ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}
        `} />
      </button>

      {/* Expanded Panel */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 animate-slideDown">
          {/* Search Input with Autocomplete */}
          <div className="relative">
            <form onSubmit={handleSubmit} className="relative">
              <input
                type="text"
                placeholder="Search stocks (AAPL, TSLA...)"
                value={query}
                onChange={handleQueryChange}
                onFocus={() => query && suggestions.length > 0 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="
                  w-full rounded-lg border border-zinc-700/50 bg-zinc-800/30 
                  py-2 pl-4 pr-10 text-sm text-white uppercase
                  placeholder:text-zinc-500 placeholder:normal-case
                  focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50
                  transition-all duration-200
                "
              />
              <button
                type="submit"
                disabled={isSearching || !query.trim()}
                className="
                  absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md
                  text-zinc-400 hover:text-blue-400 hover:bg-zinc-700/50
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors duration-200
                "
              >
                {isLoadingSuggestions || isSearching ? (
                  <LoaderIcon className="w-4 h-4" />
              ) : (
                <SearchIcon className="w-4 h-4" />
              )}
              </button>
            </form>

            {/* Autocomplete Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-50 w-full mt-1 rounded-lg border border-zinc-700/50 bg-zinc-900 shadow-xl overflow-hidden">
                {suggestions.map((suggestion, idx) => (
                  <button
                    key={suggestion.symbol || idx}
                    type="button"
                    onClick={() => selectSuggestion(suggestion)}
                    className="w-full px-3 py-2 flex items-center justify-between hover:bg-zinc-800 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-white">{suggestion.symbol}</span>
                      <span className="text-xs text-zinc-500 truncate max-w-[120px]">
                        {suggestion.shortname || suggestion.longname || suggestion.name}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-600">{suggestion.exchDisp || suggestion.exchange}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">
              {error}
            </div>
          )}

          {/* Search Result */}
          {searchResult && (
            <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/30 p-3 hover:border-zinc-600/50 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="font-bold text-white">{searchResult.symbol}</span>
                  <p className="text-xs text-zinc-500 truncate max-w-[140px]">{searchResult.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-white">${searchResult.price.toFixed(2)}</p>
                  <div className={`flex items-center gap-1 text-xs ${getChangeColor(searchResult.change)}`}>
                    {searchResult.change >= 0 ? (
                      <TrendUpIcon className="w-3 h-3" />
                    ) : (
                      <TrendDownIcon className="w-3 h-3" />
                    )}
                    <span>
                      {searchResult.change >= 0 ? '+' : ''}{searchResult.change.toFixed(2)} ({searchResult.changePercent.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-2 border-t border-zinc-700/30">
                <div className="flex gap-3 text-xs text-zinc-500">
                  {searchResult.volume && <span>Vol: {formatNumber(searchResult.volume)}</span>}
                  {searchResult.marketCap && <span>MCap: {formatNumber(searchResult.marketCap)}</span>}
                </div>
                <button
                  onClick={() => addToWatchlist(searchResult)}
                  disabled={isInWatchlist(searchResult.symbol)}
                  className={`text-xs font-medium transition-colors ${
                    isInWatchlist(searchResult.symbol) 
                      ? 'text-zinc-500 cursor-not-allowed' 
                      : 'text-blue-400 hover:text-blue-300'
                  }`}
                >
                  {isInWatchlist(searchResult.symbol) ? '✓ In Watchlist' : '+ Add to Watchlist'}
                </button>
              </div>
            </div>
          )}

          {/* Watchlist - Collapsible */}
          {watchlist.length > 0 && (
            <div className="pt-2">
              <button
                onClick={() => setSavedListExpanded(!savedListExpanded)}
                className="flex items-center gap-2 w-full text-left text-xs text-zinc-500 hover:text-zinc-400 transition-colors mb-2"
              >
                <ChevronIcon open={savedListExpanded} className="w-3 h-3" />
                <span className="font-medium uppercase tracking-wide">Watchlist ({watchlist.length})</span>
              </button>
              
              {savedListExpanded && (
                <div className="space-y-1.5 animate-slideDown">
                  {watchlist.map((stock) => (
                    <div
                      key={stock.symbol}
                      className="flex items-center justify-between rounded-lg border border-zinc-700/30 bg-zinc-800/20 px-3 py-2 hover:border-zinc-600/50 hover:bg-zinc-800/40 transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white">{stock.symbol}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-zinc-300">${stock.price?.toFixed(2) || '—'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!isSearching && !searchResult && watchlist.length === 0 && !error && (
            <p className="text-xs text-zinc-600 text-center py-2">
              Search for stocks to add to watchlist
            </p>
          )}
        </div>
      )}

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slideDown {
          animation: slideDown 0.2s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
