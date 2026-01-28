import { useState, useEffect, useRef, useCallback } from 'react';
import { API_URL } from '../../config';

// Popular stocks for instant results (like Google Finance)
const POPULAR_STOCKS = [
  { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', exchange: 'NASDAQ' },
  { symbol: 'TSLA', name: 'Tesla Inc.', exchange: 'NASDAQ' },
  { symbol: 'META', name: 'Meta Platforms Inc.', exchange: 'NASDAQ' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', exchange: 'NASDAQ' },
  { symbol: 'NFLX', name: 'Netflix Inc.', exchange: 'NASDAQ' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', exchange: 'NYSE' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', exchange: 'NASDAQ' },
  { symbol: 'DIS', name: 'Walt Disney Company', exchange: 'NYSE' },
  { symbol: 'BABA', name: 'Alibaba Group', exchange: 'NYSE' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', exchange: 'NYSE' },
  { symbol: 'V', name: 'Visa Inc.', exchange: 'NYSE' },
  { symbol: 'MA', name: 'Mastercard Inc.', exchange: 'NYSE' },
  { symbol: 'BAC', name: 'Bank of America', exchange: 'NYSE' },
  { symbol: 'WMT', name: 'Walmart Inc.', exchange: 'NYSE' },
  { symbol: 'PG', name: 'Procter & Gamble', exchange: 'NYSE' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', exchange: 'NYSE' },
  { symbol: 'UNH', name: 'UnitedHealth Group', exchange: 'NYSE' },
  { symbol: 'HD', name: 'Home Depot Inc.', exchange: 'NYSE' },
  { symbol: 'INTC', name: 'Intel Corporation', exchange: 'NASDAQ' },
  { symbol: 'CRM', name: 'Salesforce Inc.', exchange: 'NYSE' },
  { symbol: 'COIN', name: 'Coinbase Global', exchange: 'NASDAQ' },
  { symbol: 'PLTR', name: 'Palantir Technologies', exchange: 'NYSE' },
  { symbol: 'SOFI', name: 'SoFi Technologies', exchange: 'NASDAQ' },
  { symbol: 'NIO', name: 'NIO Inc.', exchange: 'NYSE' },
  { symbol: 'RIVN', name: 'Rivian Automotive', exchange: 'NASDAQ' },
  { symbol: 'LCID', name: 'Lucid Group', exchange: 'NASDAQ' },
  { symbol: 'F', name: 'Ford Motor Company', exchange: 'NYSE' },
  { symbol: 'GM', name: 'General Motors', exchange: 'NYSE' },
  { symbol: 'XOM', name: 'Exxon Mobil', exchange: 'NYSE' },
  { symbol: 'CVX', name: 'Chevron Corporation', exchange: 'NYSE' },
  { symbol: 'KO', name: 'Coca-Cola Company', exchange: 'NYSE' },
  { symbol: 'PEP', name: 'PepsiCo Inc.', exchange: 'NASDAQ' },
  { symbol: 'MCD', name: "McDonald's Corporation", exchange: 'NYSE' },
  { symbol: 'SBUX', name: 'Starbucks Corporation', exchange: 'NASDAQ' },
  { symbol: 'NKE', name: 'Nike Inc.', exchange: 'NYSE' },
  { symbol: 'BA', name: 'Boeing Company', exchange: 'NYSE' },
  { symbol: 'CAT', name: 'Caterpillar Inc.', exchange: 'NYSE' },
  { symbol: 'GS', name: 'Goldman Sachs', exchange: 'NYSE' },
  { symbol: 'MS', name: 'Morgan Stanley', exchange: 'NYSE' },
  { symbol: 'C', name: 'Citigroup Inc.', exchange: 'NYSE' },
  { symbol: 'WFC', name: 'Wells Fargo', exchange: 'NYSE' },
  { symbol: 'T', name: 'AT&T Inc.', exchange: 'NYSE' },
  { symbol: 'VZ', name: 'Verizon Communications', exchange: 'NYSE' },
  { symbol: 'CMCSA', name: 'Comcast Corporation', exchange: 'NASDAQ' },
  { symbol: 'PYPL', name: 'PayPal Holdings', exchange: 'NASDAQ' },
  { symbol: 'SQ', name: 'Block Inc.', exchange: 'NYSE' },
  { symbol: 'SHOP', name: 'Shopify Inc.', exchange: 'NYSE' },
  { symbol: 'UBER', name: 'Uber Technologies', exchange: 'NYSE' },
  { symbol: 'LYFT', name: 'Lyft Inc.', exchange: 'NASDAQ' },
  { symbol: 'ABNB', name: 'Airbnb Inc.', exchange: 'NASDAQ' },
  { symbol: 'ZM', name: 'Zoom Video Communications', exchange: 'NASDAQ' },
  { symbol: 'ROKU', name: 'Roku Inc.', exchange: 'NASDAQ' },
  { symbol: 'SNAP', name: 'Snap Inc.', exchange: 'NYSE' },
  { symbol: 'PINS', name: 'Pinterest Inc.', exchange: 'NYSE' },
  { symbol: 'TWTR', name: 'X Holdings (Twitter)', exchange: 'NYSE' },
  { symbol: 'GME', name: 'GameStop Corp.', exchange: 'NYSE' },
  { symbol: 'AMC', name: 'AMC Entertainment', exchange: 'NYSE' },
  { symbol: 'BB', name: 'BlackBerry Limited', exchange: 'NYSE' },
  { symbol: 'NOK', name: 'Nokia Corporation', exchange: 'NYSE' },
  { symbol: 'SPCE', name: 'Virgin Galactic', exchange: 'NYSE' },
  { symbol: 'ARKK', name: 'ARK Innovation ETF', exchange: 'NYSE' },
  { symbol: 'IWM', name: 'iShares Russell 2000', exchange: 'NYSE' },
  { symbol: 'GLD', name: 'SPDR Gold Shares', exchange: 'NYSE' },
  { symbol: 'SLV', name: 'iShares Silver Trust', exchange: 'NYSE' },
  { symbol: 'USO', name: 'United States Oil Fund', exchange: 'NYSE' },
  { symbol: 'VTI', name: 'Vanguard Total Stock', exchange: 'NYSE' },
  { symbol: 'VOO', name: 'Vanguard S&P 500', exchange: 'NYSE' },
];

export default function SearchBar({ onSelectStock }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Instant local search
  const getLocalResults = useCallback((q) => {
    if (!q) return [];
    const upper = q.toUpperCase();
    return POPULAR_STOCKS.filter(s => 
      s.symbol.startsWith(upper) || 
      s.name.toUpperCase().includes(upper)
    ).slice(0, 8);
  }, []);

  // Search effect with immediate local + async API
  useEffect(() => {
    if (query.length < 1) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    // Immediate local results
    const localResults = getLocalResults(query);
    if (localResults.length > 0) {
      setResults(localResults);
      setIsOpen(true);
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Debounced API search (shorter delay - 150ms)
    const timer = setTimeout(async () => {
      abortControllerRef.current = new AbortController();
      setLoading(true);
      
      try {
        const res = await fetch(`${API_URL}/api/public/search?q=${query}`, {
          signal: abortControllerRef.current.signal
        });
        const data = await res.json();
        
        if (data && data.length > 0) {
          // Merge API results with local, prioritizing API but avoiding duplicates
          const apiSymbols = new Set(data.map(s => s.symbol));
          const uniqueLocal = localResults.filter(s => !apiSymbols.has(s.symbol));
          setResults([...data.slice(0, 8), ...uniqueLocal].slice(0, 10));
        }
        setIsOpen(true);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Search error:', err);
          // Keep showing local results on error
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

  // Keyboard navigation
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

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex items-center bg-[#303134] border border-[#5f6368] rounded-full px-4 py-2 focus-within:border-[#8ab4f8] focus-within:bg-[#303134] transition-colors">
        <svg className="w-5 h-5 text-[#9AA0A6] mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value.toUpperCase());
            setSelectedIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (query.length > 0 && results.length > 0) {
              setIsOpen(true);
            }
          }}
          placeholder="Search stocks, ETFs..."
          className="bg-transparent text-[#E8EAED] text-sm outline-none w-52 placeholder-[#9AA0A6]"
        />
        {loading && (
          <svg className="w-4 h-4 animate-spin text-[#8ab4f8]" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {query && !loading && (
          <button 
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
            }}
            className="text-[#9AA0A6] hover:text-[#E8EAED] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      
      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-2 w-96 bg-[#303134] border border-[#5f6368] rounded-xl shadow-2xl z-50 max-h-96 overflow-y-auto overflow-x-hidden">
          {results.map((stock, index) => (
            <div
              key={stock.symbol}
              onClick={() => handleSelect(stock)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`px-4 py-3 cursor-pointer border-b border-[#3c4043] last:border-0 transition-colors ${
                index === selectedIndex ? 'bg-[#3c4043]' : 'hover:bg-[#3c4043]'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="text-[#8ab4f8] font-semibold text-[15px]">{stock.symbol}</span>
                <span className="text-[11px] text-[#9AA0A6] bg-[#202124] px-2 py-0.5 rounded">{stock.exchange}</span>
              </div>
              <div className="text-[13px] text-[#9AA0A6] truncate mt-0.5">{stock.name}</div>
            </div>
          ))}
        </div>
      )}

      {isOpen && query.length > 0 && results.length === 0 && !loading && (
        <div className="absolute top-full mt-2 w-96 bg-[#303134] border border-[#5f6368] rounded-xl shadow-2xl z-50 px-4 py-6 text-center">
          <div className="text-[#9AA0A6] text-sm">No results for "{query}"</div>
        </div>
      )}
    </div>
  );
}
