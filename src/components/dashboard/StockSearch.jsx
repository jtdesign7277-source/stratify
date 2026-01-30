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
      {/* Search Header Row - Brain + Input integrated */}
      <form onSubmit={handleSubmit} className="relative">
        <div className={`
          relative flex items-center gap-2 px-3 py-2
          transition-all duration-300 ease-out
          hover:bg-gradient-to-r hover:from-violet-500/5 hover:via-blue-500/5 hover:to-cyan-500/5
          ${(isSearching || query) ? 'bg-gradient-to-r from-violet-500/5 via-blue-500/5 to-cyan-500/5' : ''}
        `}>
          {/* Brain icon with glow */}
          <div className={`group/brain relative flex items-center justify-center flex-shrink-0 cursor-pointer ${isSearching ? 'animate-pulse' : ''}`}>
            {/* Outer glow */}
            <div className={`
              absolute inset-0 rounded-full blur-md transition-opacity duration-300
              bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-500
              ${isSearching ? 'opacity-60 animate-pulse' : 'opacity-0 group-hover/brain:opacity-40'}
            `} style={{ transform: 'scale(1.8)' }} />
            {/* Inner glow */}
            <div className={`
              absolute inset-0 rounded-full blur-sm transition-opacity duration-300
              bg-gradient-to-r from-violet-400 via-blue-400 to-cyan-400
              ${isSearching ? 'opacity-80' : 'opacity-0 group-hover/brain:opacity-60'}
            `} style={{ transform: 'scale(1.4)' }} />
            
            <BrainIcon 
              className={`
                relative w-5 h-5 transition-all duration-300
                ${isSearching 
                  ? 'text-blue-300 drop-shadow-[0_0_8px_rgba(129,140,248,0.8)]' 
                  : 'text-zinc-500 group-hover/brain:text-blue-300 group-hover/brain:drop-shadow-[0_0_6px_rgba(129,140,248,0.6)]'}
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

          {/* Input Field */}
          <input
            type="text"
            placeholder="Search stocks..."
            value={query}
            onChange={handleQueryChange}
            onFocus={() => {
              setIsExpanded(true);
              if (query && suggestions.length > 0) setShowSuggestions(true);
            }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className="
              flex-1 bg-transparent text-sm text-white 
              placeholder:text-zinc-500 
              focus:outline-none
              uppercase
            "
          />

          {/* Search/Loading Icon */}
          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="flex-shrink-0 p-1 rounded text-zinc-500 hover:text-blue-400 disabled:opacity-50 transition-colors"
          >
            {isLoadingSuggestions || isSearching ? (
              <LoaderIcon className="w-4 h-4" />
            ) : (
              <SearchIcon className="w-4 h-4" />
            )}
          </button>

          {/* Bottom glow bar */}
          <div className={`
            absolute bottom-0 left-0 right-0 h-px
            bg-gradient-to-r from-transparent via-blue-500 to-transparent
            transition-opacity duration-300
            ${isSearching ? 'opacity-100' : 'opacity-0'}
          `} />
        </div>

        {/* Autocomplete Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 left-3 right-3 mt-1 rounded-lg border border-zinc-700/50 bg-zinc-900 shadow-xl overflow-hidden">
            {suggestions.map((suggestion, idx) => (
              <button
                key={suggestion.symbol || idx}
                type="button"
                onClick={() => selectSuggestion(suggestion)}
                className="w-full px-3 py-2 flex items-center justify-between hover:bg-zinc-800 transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-white">{suggestion.symbol}</span>
                  <span className="text-xs text-zinc-500 truncate max-w-[100px]">
                    {suggestion.shortname || suggestion.longname || suggestion.name}
                  </span>
                </div>
                <span className="text-xs text-zinc-600">{suggestion.exchDisp || suggestion.exchange}</span>
              </button>
            ))}
          </div>
        )}
      </form>

      {/* Results Panel - shows when we have results */}
      {(searchResult || error) && (
        <div className="px-3 pb-3 space-y-2">
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
