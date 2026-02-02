import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, X, Trash2, ChevronsLeft, ChevronsRight } from 'lucide-react';

const getMarketStatus = () => {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const hours = et.getHours();
  const minutes = et.getMinutes();
  const day = et.getDay();
  const time = hours * 60 + minutes;
  
  const marketOpen = 9 * 60 + 30;
  const marketClose = 16 * 60;
  const preMarketStart = 4 * 60;
  const afterHoursEnd = 20 * 60;
  
  if (day === 0 || day === 6) return 'closed';
  if (time >= marketOpen && time < marketClose) return 'open';
  if (time >= preMarketStart && time < marketOpen) return 'premarket';
  if (time >= marketClose && time < afterHoursEnd) return 'afterhours';
  return 'closed';
};

const DEFAULT_SYMBOLS = ['AAPL', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'MSFT', 'HOOD'];

const WatchlistPage = ({ watchlist = [], onAddToWatchlist, onRemoveFromWatchlist }) => {
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [marketStatus, setMarketStatus] = useState(getMarketStatus());
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [quotes, setQuotes] = useState({});
  const [loading, setLoading] = useState({});
  
  // Get symbols from watchlist prop or defaults
  const watchlistSymbols = watchlist.length > 0 
    ? watchlist.map(item => typeof item === 'string' ? item : item.symbol)
    : DEFAULT_SYMBOLS;

  // Fetch quote from Alpaca API
  const fetchQuote = useCallback(async (symbol) => {
    setLoading(prev => ({ ...prev, [symbol]: true }));
    try {
      const res = await fetch(`https://atlas-api-production-5944.up.railway.app/api/trades/quote/${symbol}`);
      const data = await res.json();
      if (data.price) {
        setQuotes(prev => ({ ...prev, [symbol]: data }));
      }
    } catch (err) {
      console.error('Quote fetch error:', symbol, err);
    }
    setLoading(prev => ({ ...prev, [symbol]: false }));
  }, []);

  // Fetch all quotes on mount and refresh every 10 seconds
  useEffect(() => {
    watchlistSymbols.forEach(symbol => fetchQuote(symbol));
    const interval = setInterval(() => {
      watchlistSymbols.forEach(symbol => fetchQuote(symbol));
    }, 10000);
    return () => clearInterval(interval);
  }, [watchlistSymbols.join(','), fetchQuote]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMarketStatus(getMarketStatus());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Search stocks via Yahoo Finance API
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const searchStocks = async () => {
      try {
        const res = await fetch(`https://atlas-api-production-5944.up.railway.app/api/public/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        const filtered = (data || []).filter(s => !watchlistSymbols.includes(s.symbol)).slice(0, 10);
        setSearchResults(filtered);
      } catch (err) {
        console.error('Search error:', err);
        setSearchResults([]);
      }
    };
    const debounce = setTimeout(searchStocks, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, watchlistSymbols.join(',')]);

  const handleAddStock = (stock) => {
    if (onAddToWatchlist) {
      onAddToWatchlist({ symbol: stock.symbol, name: stock.name });
    }
    setSearchQuery('');
    setSearchResults([]);
    fetchQuote(stock.symbol);
  };

  const handleRemoveStock = (symbol, e) => {
    e.stopPropagation();
    e.preventDefault();
    if (onRemoveFromWatchlist) {
      onRemoveFromWatchlist(symbol);
    }
  };

  const formatPrice = (price) => {
    if (!price) return '—';
    if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (price < 0.01) return price.toFixed(6);
    if (price < 1) return price.toFixed(4);
    return price.toFixed(2);
  };

  const scrollHideStyle = { scrollbarWidth: 'none', msOverflowStyle: 'none' };

  return (
    <div className="flex-1 flex h-full bg-[#060d18] overflow-hidden">
      <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>
      
      {/* Watchlist Panel */}
      <div className={`flex flex-col border-r border-gray-800 transition-all duration-300 ${
        isCollapsed ? 'w-20' : selectedTicker ? 'w-80' : 'flex-1 max-w-2xl'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-800">
          {!isCollapsed && (
            <div className="flex-1">
              <h1 className="font-semibold text-white text-lg">Watchlist</h1>
              <span className={`text-xs px-2 py-0.5 rounded inline-block mt-1 ${
                marketStatus === 'open' ? 'bg-emerald-500/20 text-emerald-400' :
                marketStatus === 'premarket' ? 'bg-blue-500/20 text-blue-400' :
                marketStatus === 'afterhours' ? 'bg-purple-500/20 text-purple-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {marketStatus === 'open' ? 'Open' : marketStatus === 'premarket' ? 'Pre' : marketStatus === 'afterhours' ? 'After' : 'Closed'}
              </span>
            </div>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 hover:bg-gray-700/50 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            {isCollapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Search */}
        {!isCollapsed && (
          <div className="p-3 border-b border-gray-800 bg-[#0a1628] relative">
            <div className="flex items-center gap-2 bg-[#060d18] border border-gray-700 rounded-lg px-3 py-2">
              <Search className="w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search symbol or company..."
                className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-gray-500 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {searchQuery && searchResults.length > 0 && (
              <div className="absolute left-3 right-3 top-full mt-1 bg-[#0d1829] border border-gray-700 rounded-lg overflow-hidden shadow-xl z-50 max-h-80 overflow-y-auto" style={scrollHideStyle}>
                {searchResults.map((stock) => (
                  <div key={stock.symbol} className="flex items-center justify-between px-3 py-3 hover:bg-purple-500/20 cursor-pointer border-b border-gray-800/50 last:border-0" onClick={() => handleAddStock(stock)}>
                    <div className="flex-1">
                      <span className="text-white font-semibold">{stock.symbol}</span>
                      <span className="text-gray-400 text-sm ml-2">{stock.name}</span>
                    </div>
                    <Plus className="w-5 h-5 text-purple-400" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Stock List - LIVE DATA */}
        <div className="flex-1 overflow-auto scrollbar-hide" style={scrollHideStyle}>
          {watchlistSymbols.map((symbol) => {
            const quote = quotes[symbol] || {};
            const isLoading = loading[symbol];
            const price = quote.price || quote.askPrice || 0;
            const isSelected = selectedTicker === symbol;
            
            return (
              <div 
                key={symbol}
                className={`flex items-center justify-between cursor-pointer transition-colors border-b border-gray-800/50 ${
                  isSelected ? 'bg-purple-500/20' : 'hover:bg-[#0d1829]'
                } ${isCollapsed ? 'px-2 py-3' : 'px-3 py-2.5'}`}
                onClick={() => setSelectedTicker(symbol)}
              >
                {isCollapsed ? (
                  <div className="w-full text-center">
                    <div className="text-white text-xs font-semibold">{symbol}</div>
                    <div className="text-[10px] font-medium mt-0.5 text-gray-400">
                      {isLoading ? '...' : `$${formatPrice(price)}`}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="text-white font-semibold text-base">{symbol}</div>
                      <div className="text-gray-500 text-sm">
                        {isLoading ? 'Loading...' : 'Live Quote'}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 mr-3">
                      <div className="text-white font-semibold text-base font-mono">
                        {isLoading ? '...' : `$${formatPrice(price)}`}
                      </div>
                      <div className="text-emerald-400 text-sm">LIVE</div>
                    </div>
                    <button 
                      onClick={(e) => handleRemoveStock(symbol, e)}
                      className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-gray-500 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        {!isCollapsed && (
          <div className="p-3 border-t border-gray-800 flex items-center justify-between text-xs">
            <span className="text-gray-400">{watchlistSymbols.length} symbols</span>
            <span className="text-emerald-400">LIVE via Alpaca</span>
          </div>
        )}
      </div>

      {/* TradingView Chart */}
      {selectedTicker && (
        <div className="flex-1 flex flex-col bg-[#060d18] min-w-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <h2 className="text-white font-semibold text-lg">{selectedTicker}</h2>
            <button onClick={() => setSelectedTicker(null)} className="p-2 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-400">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <iframe
              key={selectedTicker}
              src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${selectedTicker}&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=0&toolbarbg=f1f3f6&studies=[]&theme=dark&style=1&timezone=America%2FNew_York&withdateranges=1&showpopupbutton=0&locale=en`}
              style={{ width: '100%', height: '100%', border: 'none' }}
              allowFullScreen
            />
          </div>
        </div>
      )}

      {!selectedTicker && (
        <div className="flex-1 flex items-center justify-center bg-[#060d18]">
          <div className="text-center text-gray-500">
            <p className="text-lg">Select a ticker to view chart</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WatchlistPage;
