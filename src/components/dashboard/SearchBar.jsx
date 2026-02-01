import { useState, useEffect, useRef, useCallback } from 'react';
import { API_URL } from '../../config';

// Popular stocks for instant results
const POPULAR_STOCKS = [
  { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', sector: 'Technology' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', sector: 'Technology' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ', sector: 'Technology' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', exchange: 'NASDAQ', sector: 'Consumer' },
  { symbol: 'TSLA', name: 'Tesla Inc.', exchange: 'NASDAQ', sector: 'Automotive' },
  { symbol: 'META', name: 'Meta Platforms Inc.', exchange: 'NASDAQ', sector: 'Technology' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ', sector: 'Technology' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', exchange: 'NASDAQ', sector: 'Technology' },
  { symbol: 'NFLX', name: 'Netflix Inc.', exchange: 'NASDAQ', sector: 'Entertainment' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', exchange: 'NYSE', sector: 'ETF' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', exchange: 'NASDAQ', sector: 'ETF' },
  { symbol: 'BTC', name: 'Bitcoin', exchange: 'CRYPTO', sector: 'Crypto' },
  { symbol: 'ETH', name: 'Ethereum', exchange: 'CRYPTO', sector: 'Crypto' },
  { symbol: 'GME', name: 'GameStop Corp.', exchange: 'NYSE', sector: 'Retail' },
  { symbol: 'AMC', name: 'AMC Entertainment', exchange: 'NYSE', sector: 'Entertainment' },
  { symbol: 'PLTR', name: 'Palantir Technologies', exchange: 'NYSE', sector: 'Technology' },
  { symbol: 'COIN', name: 'Coinbase Global', exchange: 'NASDAQ', sector: 'Finance' },
  { symbol: 'SOFI', name: 'SoFi Technologies', exchange: 'NASDAQ', sector: 'Finance' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', exchange: 'NYSE', sector: 'Finance' },
  { symbol: 'GS', name: 'Goldman Sachs', exchange: 'NYSE', sector: 'Finance' },
];

// Animated sparkle/star icon like Gemini
const SparkleIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <path 
      d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z" 
      className="fill-cyan-400/80"
    />
    <path 
      d="M19 14L19.75 16.25L22 17L19.75 17.75L19 20L18.25 17.75L16 17L18.25 16.25L19 14Z" 
      className="fill-purple-400/60"
    />
    <path 
      d="M5 2L5.5 3.5L7 4L5.5 4.5L5 6L4.5 4.5L3 4L4.5 3.5L5 2Z" 
      className="fill-blue-400/50"
    />
  </svg>
);

// Trending indicator
const TrendingIcon = () => (
  <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

export default function SearchBar({ onSelectStock, onAddToWatchlist }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getLocalResults = useCallback((q) => {
    if (!q) return [];
    const upper = q.toUpperCase();
    return POPULAR_STOCKS.filter(s => 
      s.symbol.startsWith(upper) || 
      s.name.toUpperCase().includes(upper)
    ).slice(0, 8);
  }, []);

  useEffect(() => {
    if (query.length < 1) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const localResults = getLocalResults(query);
    if (localResults.length > 0) {
      setResults(localResults);
      setIsOpen(true);
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const timer = setTimeout(async () => {
      abortControllerRef.current = new AbortController();
      setLoading(true);
      
      try {
        const res = await fetch(`${API_URL}/api/public/search?q=${query}`, {
          signal: abortControllerRef.current.signal
        });
        const data = await res.json();
        
        if (data && data.length > 0) {
          const apiSymbols = new Set(data.map(s => s.symbol));
          const uniqueLocal = localResults.filter(s => !apiSymbols.has(s.symbol));
          setResults([...data.slice(0, 8), ...uniqueLocal].slice(0, 10));
        }
        setIsOpen(true);
      } catch (err) {
        if (err.name !== 'AbortError') {
          if (localResults.length > 0) {
            setResults(localResults);
            setIsOpen(true);
          }
        }
      }
      setLoading(false);
    }, 150);

    return () => {
      clearTimeout(timer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query, getLocalResults]);

  const handleKeyDown = (e) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelect = async (stock) => {
    setQuery('');
    setIsOpen(false);
    setSelectedIndex(-1);
    try {
      const res = await fetch(`${API_URL}/api/public/quote/${stock.symbol}`);
      const quote = await res.json();
      onSelectStock?.({ ...stock, ...quote });
    } catch (err) {
      onSelectStock?.(stock);
    }
  };

  const getSectorColor = (sector) => {
    const colors = {
      Technology: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      Finance: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      Crypto: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      ETF: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      Entertainment: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
      Consumer: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      Retail: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      Automotive: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return colors[sector] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  return (
    <div ref={wrapperRef} className="relative">
      {/* Premium Search Input */}
      <div className={`
        relative flex items-center gap-3 
        bg-gradient-to-r from-[#0f0f14] to-[#12121a]
        border rounded-2xl px-4 py-2.5
        transition-all duration-300 ease-out
        ${isFocused 
          ? 'border-cyan-500/50 shadow-lg shadow-cyan-500/10 scale-[1.02]' 
          : 'border-[#1e1e2d] hover:border-[#2a2a3d]'
        }
      `}>
        {/* Animated sparkle icon */}
        <div className={`transition-transform duration-300 ${isFocused ? 'scale-110 rotate-12' : ''}`}>
          <SparkleIcon className={`w-5 h-5 transition-opacity duration-300 ${isFocused ? 'opacity-100' : 'opacity-60'}`} />
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value.toUpperCase());
            setSelectedIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setIsFocused(true);
            if (query.length > 0 && results.length > 0) {
              setIsOpen(true);
            }
          }}
          onBlur={() => setIsFocused(false)}
          placeholder="Search stocks, ETFs..."
          className="bg-transparent text-white text-sm outline-none w-48 placeholder-gray-500 font-medium"
        />
        
        {/* Loading spinner or clear button */}
        {loading ? (
          <div className="relative w-5 h-5">
            <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400 animate-spin" />
          </div>
        ) : query ? (
          <button 
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="p-1 hover:bg-white/10 rounded-full transition-colors"
          >
            <svg className="w-4 h-4 text-gray-500 hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : (
          <div className="flex items-center gap-1 text-[10px] text-gray-600 font-mono">
            <kbd className="px-1.5 py-0.5 bg-[#1e1e2d] rounded text-gray-500">⌘</kbd>
            <kbd className="px-1.5 py-0.5 bg-[#1e1e2d] rounded text-gray-500">K</kbd>
          </div>
        )}
      </div>
      
      {/* Premium Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-3 w-[420px] bg-[#0a0a0f] border border-[#1e1e2d] rounded-2xl shadow-2xl shadow-black/50 z-50 overflow-hidden backdrop-blur-xl">
          {/* Header */}
          <div className="px-4 py-3 border-b border-[#1e1e2d] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingIcon />
              <span className="text-xs font-medium text-gray-400">Results for "{query}"</span>
            </div>
            <span className="text-[10px] text-gray-600">{results.length} found</span>
          </div>
          
          {/* Results */}
          <div className="max-h-80 overflow-y-auto scrollbar-hide">
            {results.map((stock, index) => (
              <div
                key={stock.symbol}
                onClick={() => handleSelect(stock)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`
                  group px-4 py-3 cursor-pointer border-b border-[#1e1e2d]/50 last:border-0
                  transition-all duration-150
                  ${index === selectedIndex 
                    ? 'bg-gradient-to-r from-cyan-500/10 to-transparent' 
                    : 'hover:bg-[#12121a]'
                  }
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Symbol badge */}
                    <div className={`
                      w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm
                      ${index === selectedIndex 
                        ? 'bg-cyan-500/20 text-cyan-400' 
                        : 'bg-[#1e1e2d] text-white group-hover:bg-cyan-500/10 group-hover:text-cyan-400'
                      }
                      transition-all duration-150
                    `}>
                      {stock.symbol.slice(0, 2)}
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold text-sm ${index === selectedIndex ? 'text-cyan-400' : 'text-white'}`}>
                          {stock.symbol}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${getSectorColor(stock.sector)}`}>
                          {stock.exchange}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 truncate max-w-[200px]">{stock.name}</div>
                    </div>
                  </div>
                  
                  {/* Add to Watchlist button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddToWatchlist?.(stock);
                      setQuery('');
                      setIsOpen(false);
                    }}
                    className={`
                      px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150
                      ${index === selectedIndex 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white'
                      }
                    `}
                  >
                    + Watchlist
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-[#1e1e2d] bg-[#0f0f14]">
            <div className="flex items-center justify-between text-[10px] text-gray-600">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-[#1e1e2d] rounded">↑↓</kbd> navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1 py-0.5 bg-[#1e1e2d] rounded">↵</kbd> select
                </span>
              </div>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-[#1e1e2d] rounded">esc</kbd> close
              </span>
            </div>
          </div>
        </div>
      )}

      {/* No results state */}
      {isOpen && query.length > 0 && results.length === 0 && !loading && (
        <div className="absolute top-full mt-3 w-[420px] bg-[#0a0a0f] border border-[#1e1e2d] rounded-2xl shadow-2xl z-50 p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-[#1e1e2d] flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm font-medium">No results for "{query}"</p>
          <p className="text-gray-600 text-xs mt-1">Try a different symbol or company name</p>
        </div>
      )}
    </div>
  );
}
