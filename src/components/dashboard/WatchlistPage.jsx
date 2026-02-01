import React, { useState } from 'react';
import { Search, Plus, TrendingUp, TrendingDown, Star, X, Eye, MoreHorizontal } from 'lucide-react';

const WatchlistPage = ({ watchlist = [], onAddToWatchlist, onRemoveFromWatchlist, onViewChart }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Default watchlist if none provided
  const defaultStocks = [
    { symbol: 'AAPL', name: 'Apple Inc.', price: 213.25, change: 2.34, changePercent: 1.11 },
    { symbol: 'MSFT', name: 'Microsoft Corp.', price: 378.91, change: -1.23, changePercent: -0.32 },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 141.80, change: 3.45, changePercent: 2.49 },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 178.25, change: 1.87, changePercent: 1.06 },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 721.33, change: 15.67, changePercent: 2.22 },
    { symbol: 'META', name: 'Meta Platforms', price: 474.99, change: -2.11, changePercent: -0.44 },
    { symbol: 'TSLA', name: 'Tesla Inc.', price: 248.50, change: 8.90, changePercent: 3.72 },
  ];

  const stocks = watchlist.length > 0 ? watchlist : defaultStocks;

  const popularTickers = [
    { symbol: 'SPY', name: 'S&P 500 ETF' },
    { symbol: 'QQQ', name: 'Nasdaq 100 ETF' },
    { symbol: 'DIA', name: 'Dow Jones ETF' },
    { symbol: 'BTC', name: 'Bitcoin' },
    { symbol: 'ETH', name: 'Ethereum' },
  ];

  const filteredStocks = stocks.filter(stock => 
    stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    stock.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[#060d18] p-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Watchlist</h1>
          <p className="text-gray-400 text-sm">Track your favorite stocks and crypto</p>
        </div>
        <button 
          onClick={() => setShowSearch(!showSearch)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" strokeWidth={2} />
          Add Symbol
        </button>
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
              placeholder="Search stocks, ETFs, crypto..."
              className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm outline-none"
              autoFocus
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-gray-500 hover:text-gray-300">
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            )}
          </div>
          
          {/* Quick Add */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-gray-500">Popular:</span>
            {popularTickers.map((ticker) => (
              <button
                key={ticker.symbol}
                onClick={() => onAddToWatchlist?.(ticker)}
                className="px-2 py-1 bg-[#1a2438] hover:bg-[#243048] text-gray-300 rounded text-xs font-medium transition-colors"
              >
                ${ticker.symbol}
              </button>
            ))}
          </div>
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
          {filteredStocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <Star className="w-12 h-12 text-gray-700 mb-3" strokeWidth={1} />
              <p className="text-gray-400 text-sm mb-1">No stocks in your watchlist</p>
              <p className="text-gray-500 text-xs">Click "Add Symbol" to start tracking</p>
            </div>
          ) : (
            filteredStocks.map((stock, idx) => {
              const isPositive = stock.change >= 0;
              return (
                <div 
                  key={stock.symbol}
                  className={`grid grid-cols-12 gap-4 px-4 py-3 hover:bg-[#0d1829] transition-colors cursor-pointer ${
                    idx !== filteredStocks.length - 1 ? 'border-b border-gray-800/50' : ''
                  }`}
                  onClick={() => onViewChart?.(stock.symbol)}
                >
                  {/* Symbol & Name */}
                  <div className="col-span-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                      <span className="text-xs font-bold text-blue-400">{stock.symbol.slice(0, 2)}</span>
                    </div>
                    <div>
                      <div className="text-white font-medium text-sm">${stock.symbol}</div>
                      <div className="text-gray-500 text-xs truncate max-w-[120px]">{stock.name}</div>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="col-span-2 flex items-center justify-end">
                    <span className="text-white font-mono text-sm">${stock.price?.toFixed(2)}</span>
                  </div>

                  {/* Change */}
                  <div className="col-span-2 flex items-center justify-end gap-1">
                    {isPositive ? (
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-400" strokeWidth={2} />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-red-400" strokeWidth={2} />
                    )}
                    <span className={`font-mono text-sm ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isPositive ? '+' : ''}{stock.change?.toFixed(2)}
                    </span>
                  </div>

                  {/* % Change */}
                  <div className="col-span-2 flex items-center justify-end">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {isPositive ? '+' : ''}{stock.changePercent?.toFixed(2)}%
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex items-center justify-end gap-1">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewChart?.(stock.symbol);
                      }}
                      className="p-1.5 hover:bg-[#1a2438] rounded-lg transition-colors text-gray-400 hover:text-white"
                      title="View Chart"
                    >
                      <Eye className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveFromWatchlist?.(stock.symbol);
                      }}
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
            <span className="text-emerald-400">{filteredStocks.filter(s => s.change >= 0).length}</span> gaining
          </span>
          <span className="text-gray-500">
            <span className="text-red-400">{filteredStocks.filter(s => s.change < 0).length}</span> declining
          </span>
        </div>
      </div>
    </div>
  );
};

export default WatchlistPage;
