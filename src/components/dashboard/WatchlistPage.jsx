import React, { useState, useEffect } from 'react';
import { Search, Plus, TrendingUp, TrendingDown, X, RefreshCw } from 'lucide-react';

const TradingViewChart = ({ symbol }) => {
  useEffect(() => {
    // Clean up any existing widget
    const container = document.getElementById('tradingview-widget-container');
    if (container) {
      container.innerHTML = '';
    }

    // Create the widget
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: symbol,
      interval: 'D',
      timezone: 'America/New_York',
      theme: 'dark',
      style: '1',
      locale: 'en',
      enable_publishing: false,
      backgroundColor: 'rgba(6, 13, 24, 1)',
      gridColor: 'rgba(0, 0, 0, 0)',
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: true,
      save_image: false,
      calendar: false,
      hide_volume: false,
      support_host: 'https://www.tradingview.com'
    });

    if (container) {
      container.appendChild(script);
    }

    return () => {
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [symbol]);

  return (
    <div className="tradingview-widget-container h-full w-full" id="tradingview-widget-container">
      <div className="tradingview-widget-container__widget h-full w-full"></div>
    </div>
  );
};

const WatchlistPage = ({ watchlist = [], onAddToWatchlist, onRemoveFromWatchlist }) => {
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Default watchlist if none provided
  const defaultStocks = [
    { symbol: 'AAPL', name: 'Apple Inc.', price: 259.48, change: 1.20, changePercent: 0.46 },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 338.00, change: -0.25, changePercent: -0.07 },
    { symbol: 'AMZN', name: 'Amazon.com, Inc.', price: 239.30, change: -2.43, changePercent: -1.01 },
    { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 191.13, change: -1.38, changePercent: -0.72 },
    { symbol: 'META', name: 'Meta Platforms, Inc.', price: 716.50, change: -21.81, changePercent: -2.95 },
    { symbol: 'TSLA', name: 'Tesla, Inc.', price: 430.41, change: 13.84, changePercent: 3.32 },
    { symbol: 'QQQ', name: 'Invesco QQQ Trust', price: 621.87, change: -7.56, changePercent: -1.20 },
    { symbol: 'SOFI', name: 'SoFi Technologies, Inc.', price: 22.81, change: -1.55, changePercent: -6.36 },
  ];

  const stocks = watchlist.length > 0 ? watchlist : defaultStocks;

  const handleTickerClick = (symbol) => {
    setSelectedTicker(symbol);
  };

  const handleCloseChart = () => {
    setSelectedTicker(null);
  };

  const popularTickers = [
    { symbol: 'SPY', name: 'S&P 500 ETF' },
    { symbol: 'QQQ', name: 'Nasdaq 100 ETF' },
    { symbol: 'DIA', name: 'Dow Jones ETF' },
    { symbol: 'BTC', name: 'Bitcoin' },
    { symbol: 'ETH', name: 'Ethereum' },
  ];

  return (
    <div className="flex-1 flex h-full bg-[#060d18] overflow-hidden">
      {/* Watchlist Panel - Compact when chart is open */}
      <div className={`flex flex-col border-r border-gray-800 transition-all duration-300 ${
        selectedTicker ? 'w-72' : 'flex-1'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div>
            <h1 className={`font-semibold text-white ${selectedTicker ? 'text-base' : 'text-xl'}`}>Watchlist</h1>
            {!selectedTicker && (
              <p className="text-gray-400 text-sm">Live market data • Updates every 15s</p>
            )}
          </div>
          <button 
            onClick={() => setShowSearch(!showSearch)}
            className={`bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 ${
              selectedTicker ? 'p-2' : 'px-4 py-2 text-sm'
            }`}
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
            {!selectedTicker && 'Add Symbol'}
          </button>
        </div>

        {/* Search Bar */}
        {showSearch && (
          <div className="p-3 border-b border-gray-800 bg-[#0a1628]">
            <div className="flex items-center gap-2 bg-[#060d18] border border-gray-700 rounded-lg px-3 py-2">
              <Search className="w-4 h-4 text-gray-500" strokeWidth={1.5} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm outline-none"
                autoFocus
              />
            </div>
            {!selectedTicker && (
              <div className="flex flex-wrap gap-1 mt-2">
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
            )}
          </div>
        )}

        {/* Stocks List */}
        <div className="flex-1 overflow-auto">
          {/* Table Header - Only show when expanded */}
          {!selectedTicker && (
            <div className="grid grid-cols-12 gap-4 px-4 py-2 border-b border-gray-800 text-xs text-gray-500 font-medium sticky top-0 bg-[#060d18]">
              <div className="col-span-4">Symbol</div>
              <div className="col-span-2 text-right">Price</div>
              <div className="col-span-2 text-right">Change</div>
              <div className="col-span-2 text-right">% Change</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>
          )}

          {stocks.map((stock) => {
            const isPositive = stock.change >= 0;
            const isSelected = selectedTicker === stock.symbol;
            
            return (
              <div 
                key={stock.symbol}
                onClick={() => handleTickerClick(stock.symbol)}
                className={`cursor-pointer transition-colors border-b border-gray-800/50 ${
                  isSelected ? 'bg-purple-500/20 border-l-2 border-l-purple-500' : 'hover:bg-[#0d1829]'
                } ${selectedTicker ? 'px-3 py-2.5' : 'px-4 py-3'}`}
              >
                {selectedTicker ? (
                  // Compact view
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium text-sm">${stock.symbol}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-white text-sm font-mono">${stock.price?.toFixed(2)}</span>
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                        isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {isPositive ? '+' : ''}{stock.changePercent?.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                ) : (
                  // Expanded view
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-4 flex items-center gap-3">
                      <div>
                        <div className="text-white font-medium text-sm">${stock.symbol}</div>
                        <div className="text-gray-500 text-xs truncate max-w-[120px]">{stock.name}</div>
                      </div>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className="text-white font-mono text-sm">${stock.price?.toFixed(2)}</span>
                    </div>
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
                    <div className="col-span-2 text-right">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {isPositive ? '+' : ''}{stock.changePercent?.toFixed(2)}%
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center justify-end">
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
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-800 flex items-center justify-between text-xs">
          <span className="text-gray-400">{stocks.length} symbols</span>
          {!selectedTicker && (
            <div className="flex items-center gap-3">
              <span className="text-emerald-400">{stocks.filter(s => s.change >= 0).length} gaining</span>
              <span className="text-red-400">{stocks.filter(s => s.change < 0).length} declining</span>
            </div>
          )}
        </div>
      </div>

      {/* TradingView Chart Panel */}
      {selectedTicker && (
        <div className="flex-1 flex flex-col bg-[#060d18] min-w-0">
          {/* Chart Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
            <div className="flex items-center gap-3">
              <h2 className="text-white font-semibold text-lg">${selectedTicker}</h2>
              <span className="text-gray-400 text-sm">
                {stocks.find(s => s.symbol === selectedTicker)?.name}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleCloseChart}
                className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-gray-400 hover:text-red-400"
                title="Close chart"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Chart Container - Using iframe for reliability */}
          <div className="flex-1 min-h-0">
            <iframe
              key={selectedTicker}
              src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${selectedTicker}&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=0&toolbarbg=f1f3f6&studies=[]&theme=dark&style=1&timezone=America%2FNew_York&withdateranges=1&showpopupbutton=0&studies_overrides={}&overrides={"paneProperties.vertGridProperties.color":"rgba(0,0,0,0)","paneProperties.horzGridProperties.color":"rgba(0,0,0,0)","paneProperties.background":"rgba(6,13,24,1)","paneProperties.backgroundType":"solid"}&enabled_features=[]&disabled_features=[]&locale=en&utm_source=&utm_medium=widget_new&utm_campaign=chart`}
              style={{ width: '100%', height: '100%', border: 'none' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default WatchlistPage;
