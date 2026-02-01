import React, { useState, useEffect } from 'react';
import { Search, Plus, TrendingUp, TrendingDown, Star, X, Eye, RefreshCw, Loader2 } from 'lucide-react';
import { useWatchlist } from '../../useAlpacaData';
import { searchStocks } from '../../services/marketData';

const DEFAULT_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'];

const WatchlistPage = ({ themeClasses }) => {
  const [symbols, setSymbols] = useState(() => {
    const saved = localStorage.getItem('stratify-watchlist-symbols');
    return saved ? JSON.parse(saved) : DEFAULT_SYMBOLS;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const { stocks, loading, error, refetch } = useWatchlist(symbols);

  // Save symbols to localStorage
  useEffect(() => {
    localStorage.setItem('stratify-watchlist-symbols', JSON.stringify(symbols));
  }, [symbols]);

  // Search stocks as user types
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 1) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setSearching(true);
      const results = await searchStocks(searchQuery);
      setSearchResults(results);
      setSearching(false);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const addSymbol = (symbol) => {
    if (!symbols.includes(symbol)) {
      setSymbols([...symbols, symbol]);
    }
    setSearchQuery('');
    setShowSearch(false);
  };

  const removeSymbol = (symbol) => {
    setSymbols(symbols.filter(s => s !== symbol));
  };

  const popularTickers = [
    { symbol: 'SPY', name: 'S&P 500 ETF' },
    { symbol: 'QQQ', name: 'Nasdaq 100 ETF' },
    { symbol: 'IWM', name: 'Russell 2000 ETF' },
    { symbol: 'DIA', name: 'Dow Jones ETF' },
    { symbol: 'VTI', name: 'Total Stock Market' },
  ];

  const filteredStocks = stocks.filter(stock =>
    !searchQuery ||
    stock.symbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    stock.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[#060d18] p-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Watchlist</h1>
          <p className="text-gray-400 text-sm">
            {loading ? 'Loading live data...' : 'Live market data • Updates every 15s'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refetch}
            disabled={loading}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors text-gray-400 hover:text-white disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            Add Symbol
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <div className="mb-4 bg-[#0a1628] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 bg-[#060d18] border border-gray-700 rounded-lg px-4 py-2.5 mb-3">
            <Search className="w-4 h-4 text-gray-500" strokeWidth={1.5} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search stocks, ETFs..."
              className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm outline-none"
              autoFocus
            />
            {searching && <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />}
            {searchQuery && !searching && (
              <button onClick={() => setSearchQuery('')} className="text-gray-500 hover:text-gray-300">
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            )}
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mb-3 max-h-48 overflow-auto">
              {searchResults.map((result) => (
                <button
                  key={result.symbol}
                  onClick={() => addSymbol(result.symbol)}
                  disabled={symbols.includes(result.symbol)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                    symbols.includes(result.symbol)
                      ? 'bg-purple-500/10 text-purple-400'
                      : 'hover:bg-[#1a2438] text-white'
                  }`}
                >
                  <div>
                    <span className="font-medium">{result.symbol}</span>
                    <span className="text-gray-500 text-sm ml-2">{result.name}</span>
                  </div>
                  {symbols.includes(result.symbol) ? (
                    <span className="text-xs text-purple-400">Added</span>
                  ) : (
                    <Plus className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Quick Add */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-gray-500">Popular:</span>
            {popularTickers.map((ticker) => (
              <button
                key={ticker.symbol}
                onClick={() => addSymbol(ticker.symbol)}
                disabled={symbols.includes(ticker.symbol)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  symbols.includes(ticker.symbol)
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'bg-[#1a2438] hover:bg-[#243048] text-gray-300'
                }`}
              >
                ${ticker.symbol}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Watchlist Table */}
      <div className="bg-[#0a1628] border border-gray-800 rounded-xl flex-1 flex flex-col overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-gray-800 text-xs text-gray-500 font-medium">
          <div className="col-span-4">Symbol</div>
          <div className="col-span-2 text-right">Price</div>
          <div className="col-span-2 text-right">Change</div>
          <div className="col-span-2 text-right">% Change</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-auto">
          {loading && stocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-3" />
              <p className="text-gray-400 text-sm">Loading market data...</p>
            </div>
          ) : filteredStocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <Star className="w-12 h-12 text-gray-700 mb-3" strokeWidth={1} />
              <p className="text-gray-400 text-sm mb-1">No stocks in your watchlist</p>
              <p className="text-gray-500 text-xs">Click "Add Symbol" to start tracking</p>
            </div>
          ) : (
            filteredStocks.map((stock, idx) => {
              const change = stock.change || 0;
              const changePercent = stock.changePercent || 0;
              const isPositive = change >= 0;

              return (
                <div
                  key={stock.symbol}
                  className={`grid grid-cols-12 gap-4 px-4 py-3 hover:bg-[#0d1829] transition-colors ${
                    idx !== filteredStocks.length - 1 ? 'border-b border-gray-800/50' : ''
                  }`}
                >
                  {/* Symbol & Name */}
                  <div className="col-span-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                      <span className="text-xs font-bold text-blue-400">{stock.symbol?.slice(0, 2)}</span>
                    </div>
                    <div>
                      <div className="text-white font-medium text-sm">${stock.symbol}</div>
                      <div className="text-gray-500 text-xs truncate max-w-[120px]">{stock.name || stock.symbol}</div>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="col-span-2 flex items-center justify-end">
                    <span className="text-white font-mono text-sm">
                      ${typeof stock.price === 'number' ? stock.price.toFixed(2) : stock.price || '—'}
                    </span>
                  </div>

                  {/* Change */}
                  <div className="col-span-2 flex items-center justify-end gap-1">
                    {isPositive ? (
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" strokeWidth={2} />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-red-400" strokeWidth={2} />
                    )}
                    <span className={`font-mono text-sm ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isPositive ? '+' : ''}{typeof change === 'number' ? change.toFixed(2) : change}
                    </span>
                  </div>

                  {/* % Change */}
                  <div className="col-span-2 flex items-center justify-end">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {isPositive ? '+' : ''}{typeof changePercent === 'number' ? changePercent.toFixed(2) : changePercent}%
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex items-center justify-end gap-1">
                    <button
                      onClick={() => removeSymbol(stock.symbol)}
                      className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors text-gray-400 hover:text-red-400"
                      title="Remove"
                    >
                      <X className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Summary Footer */}
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-gray-400">{filteredStocks.length} symbols</span>
        <div className="flex items-center gap-4">
          <span className="text-gray-500">
            <span className="text-emerald-400">{filteredStocks.filter(s => (s.change || 0) >= 0).length}</span> gaining
          </span>
          <span className="text-gray-500">
            <span className="text-red-400">{filteredStocks.filter(s => (s.change || 0) < 0).length}</span> declining
          </span>
        </div>
      </div>
    </div>
  );
};

export default WatchlistPage;
