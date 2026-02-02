import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, X, Trash2, ChevronsLeft, ChevronsRight } from 'lucide-react';

const getMarketStatus = () => {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const hours = et.getHours();
  const minutes = et.getMinutes();
  const day = et.getDay();
  const time = hours * 60 + minutes;
  
  if (day === 0 || day === 6) return 'closed';
  if (time >= 570 && time < 960) return 'open';
  if (time >= 240 && time < 570) return 'premarket';
  if (time >= 960 && time < 1200) return 'afterhours';
  return 'closed';
};

const STOCK_DATABASE = [
  { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', exchange: 'NASDAQ' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ' },
  { symbol: 'META', name: 'Meta Platforms, Inc.', exchange: 'NASDAQ' },
  { symbol: 'TSLA', name: 'Tesla, Inc.', exchange: 'NASDAQ' },
  { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ' },
  { symbol: 'HOOD', name: 'Robinhood Markets, Inc.', exchange: 'NASDAQ' },
  { symbol: 'SOFI', name: 'SoFi Technologies, Inc.', exchange: 'NASDAQ' },
  { symbol: 'AMD', name: 'Advanced Micro Devices', exchange: 'NASDAQ' },
  { symbol: 'INTC', name: 'Intel Corporation', exchange: 'NASDAQ' },
  { symbol: 'NFLX', name: 'Netflix, Inc.', exchange: 'NASDAQ' },
  { symbol: 'PYPL', name: 'PayPal Holdings, Inc.', exchange: 'NASDAQ' },
  { symbol: 'COIN', name: 'Coinbase Global, Inc.', exchange: 'NASDAQ' },
  { symbol: 'PLTR', name: 'Palantir Technologies', exchange: 'NYSE' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF', exchange: 'NYSE' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust', exchange: 'NASDAQ' },
  { symbol: 'DIA', name: 'SPDR Dow Jones ETF', exchange: 'NYSE' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', exchange: 'NYSE' },
  { symbol: 'BAC', name: 'Bank of America Corp.', exchange: 'NYSE' },
  { symbol: 'V', name: 'Visa Inc.', exchange: 'NYSE' },
  { symbol: 'MA', name: 'Mastercard Inc.', exchange: 'NYSE' },
  { symbol: 'DIS', name: 'Walt Disney Company', exchange: 'NYSE' },
  { symbol: 'UBER', name: 'Uber Technologies', exchange: 'NYSE' },
  { symbol: 'ABNB', name: 'Airbnb, Inc.', exchange: 'NASDAQ' },
  { symbol: 'SQ', name: 'Block, Inc.', exchange: 'NYSE' },
  { symbol: 'CRWD', name: 'CrowdStrike Holdings', exchange: 'NASDAQ' },
  { symbol: 'GME', name: 'GameStop Corp.', exchange: 'NYSE' },
  { symbol: 'AMC', name: 'AMC Entertainment', exchange: 'NYSE' },
  { symbol: 'RIVN', name: 'Rivian Automotive', exchange: 'NASDAQ' },
  { symbol: 'NIO', name: 'NIO Inc.', exchange: 'NYSE' },
  { symbol: 'F', name: 'Ford Motor Company', exchange: 'NYSE' },
  { symbol: 'XOM', name: 'Exxon Mobil Corp.', exchange: 'NYSE' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', exchange: 'NYSE' },
  { symbol: 'WMT', name: 'Walmart Inc.', exchange: 'NYSE' },
  { symbol: 'HD', name: 'Home Depot', exchange: 'NYSE' },
  { symbol: 'BA', name: 'Boeing Company', exchange: 'NYSE' },
  { symbol: 'AVGO', name: 'Broadcom Inc.', exchange: 'NASDAQ' },
  { symbol: 'CRM', name: 'Salesforce, Inc.', exchange: 'NYSE' },
  { symbol: 'ADBE', name: 'Adobe Inc.', exchange: 'NASDAQ' },
  { symbol: 'PANW', name: 'Palo Alto Networks', exchange: 'NASDAQ' },
  { symbol: 'SNOW', name: 'Snowflake Inc.', exchange: 'NYSE' },
  { symbol: 'NET', name: 'Cloudflare, Inc.', exchange: 'NYSE' },
  { symbol: 'HIMS', name: 'Hims & Hers Health', exchange: 'NYSE' },
  { symbol: 'MARA', name: 'Marathon Digital', exchange: 'NASDAQ' },
  { symbol: 'SMCI', name: 'Super Micro Computer', exchange: 'NASDAQ' },
  { symbol: 'ARM', name: 'Arm Holdings', exchange: 'NASDAQ' },
  { symbol: 'RKLB', name: 'Rocket Lab USA', exchange: 'NASDAQ' },
];

const DEFAULT_WATCHLIST = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'META', name: 'Meta Platforms, Inc.' },
  { symbol: 'TSLA', name: 'Tesla, Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'HOOD', name: 'Robinhood Markets, Inc.' },
];

// Alpaca API credentials - using paper trading
const ALPACA_KEY = 'PK3D2TL4D0QXEMNY8SAV';
const ALPACA_SECRET = 'lvMxgWdF1pNt8P9gT3phaFGHc2xPGDLMCNhBN0Ie';
const ALPACA_DATA_URL = 'https://data.alpaca.markets/v2';

const WatchlistPage = ({ watchlist = [], onAddToWatchlist, onRemoveFromWatchlist }) => {
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [marketStatus, setMarketStatus] = useState(getMarketStatus());
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [quotes, setQuotes] = useState({});
  const [loading, setLoading] = useState(true);
  
  const stocks = watchlist.length > 0 
    ? watchlist.map(item => typeof item === 'string' ? { symbol: item, name: item } : item)
    : DEFAULT_WATCHLIST;

  // Fetch quotes from Alpaca
  const fetchQuotes = useCallback(async () => {
    if (stocks.length === 0) return;
    
    const symbols = stocks.map(s => s.symbol).join(',');
    
    try {
      // Fetch latest trades for all symbols at once
      const tradesRes = await fetch(
        `${ALPACA_DATA_URL}/stocks/trades/latest?symbols=${symbols}`,
        {
          headers: {
            'APCA-API-KEY-ID': ALPACA_KEY,
            'APCA-API-SECRET-KEY': ALPACA_SECRET,
          },
        }
      );
      
      if (!tradesRes.ok) {
        console.error('Alpaca trades API error:', tradesRes.status);
        return;
      }
      
      const tradesData = await tradesRes.json();
      
      // Fetch previous day bars for change calculation
      const barsRes = await fetch(
        `${ALPACA_DATA_URL}/stocks/bars?symbols=${symbols}&timeframe=1Day&limit=2`,
        {
          headers: {
            'APCA-API-KEY-ID': ALPACA_KEY,
            'APCA-API-SECRET-KEY': ALPACA_SECRET,
          },
        }
      );
      
      let barsData = {};
      if (barsRes.ok) {
        barsData = await barsRes.json();
      }
      
      // Build quotes object
      const newQuotes = {};
      
      for (const symbol of stocks.map(s => s.symbol)) {
        const trade = tradesData.trades?.[symbol];
        const bars = barsData.bars?.[symbol] || [];
        
        if (trade) {
          const currentPrice = trade.p;
          let prevClose = currentPrice;
          
          // Get previous close from bars
          if (bars.length >= 2) {
            prevClose = bars[bars.length - 2].c;
          } else if (bars.length === 1) {
            prevClose = bars[0].o; // Use open if only one bar
          }
          
          const change = currentPrice - prevClose;
          const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
          
          newQuotes[symbol] = {
            price: currentPrice,
            change: change,
            changePercent: changePercent,
            volume: trade.s || 0,
          };
        }
      }
      
      setQuotes(newQuotes);
      setLoading(false);
      
    } catch (err) {
      console.error('Error fetching quotes:', err);
      setLoading(false);
    }
  }, [stocks]);

  // Fetch on mount and every 10 seconds
  useEffect(() => {
    fetchQuotes();
    const interval = setInterval(fetchQuotes, 10000);
    return () => clearInterval(interval);
  }, [fetchQuotes]);

  useEffect(() => {
    const interval = setInterval(() => setMarketStatus(getMarketStatus()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Local search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const query = searchQuery.toLowerCase();
    const existingSymbols = stocks.map(s => s.symbol);
    const filtered = STOCK_DATABASE.filter(s => 
      !existingSymbols.includes(s.symbol) &&
      (s.symbol.toLowerCase().includes(query) || s.name.toLowerCase().includes(query))
    ).slice(0, 10);
    setSearchResults(filtered);
  }, [searchQuery, stocks]);

  const handleAddStock = (stock) => {
    if (onAddToWatchlist) {
      onAddToWatchlist({ symbol: stock.symbol, name: stock.name });
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleRemoveStock = (symbol, e) => {
    e.stopPropagation();
    e.preventDefault();
    if (onRemoveFromWatchlist) {
      onRemoveFromWatchlist(symbol);
    }
  };

  const formatPrice = (price) => {
    if (!price || price === 0) return '...';
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const scrollStyle = { scrollbarWidth: 'none', msOverflowStyle: 'none' };

  return (
    <div className="flex-1 flex h-full bg-[#060d18] overflow-hidden">
      <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>
      
      {/* Watchlist Panel */}
      <div className={`flex flex-col border-r border-gray-800 transition-all duration-300 ${
        isCollapsed ? 'w-20' : selectedTicker ? 'w-96' : 'flex-1 max-w-xl'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          {!isCollapsed && (
            <div className="flex-1">
              <h1 className="font-semibold text-white text-xl">Watchlist</h1>
              <span className={`text-xs px-2 py-0.5 rounded inline-block mt-1 ${
                marketStatus === 'open' ? 'bg-emerald-500/20 text-emerald-400' :
                marketStatus === 'premarket' ? 'bg-blue-500/20 text-blue-400' :
                marketStatus === 'afterhours' ? 'bg-purple-500/20 text-purple-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {marketStatus === 'open' ? 'Market Open' : marketStatus === 'premarket' ? 'Pre-Market' : marketStatus === 'afterhours' ? 'After Hours' : 'Market Closed'}
              </span>
            </div>
          )}
          <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-1.5 hover:bg-gray-700/50 rounded-lg text-gray-400 hover:text-white">
            {isCollapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Search */}
        {!isCollapsed && (
          <div className="p-3 border-b border-gray-800 relative">
            <div className="flex items-center gap-2 bg-[#0d1829] border border-gray-700 rounded-lg px-3 py-2.5">
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
              <div className="absolute left-3 right-3 top-full mt-1 bg-[#0d1829] border border-gray-700 rounded-lg overflow-hidden shadow-2xl z-50 max-h-96 overflow-y-auto scrollbar-hide" style={scrollStyle}>
                {searchResults.map((stock) => (
                  <div 
                    key={stock.symbol}
                    className="flex items-center justify-between px-4 py-3 hover:bg-emerald-500/10 cursor-pointer border-b border-gray-800/50 last:border-0 transition-colors"
                    onClick={() => handleAddStock(stock)}
                  >
                    <div className="flex-1">
                      <span className="text-white font-bold text-base">${stock.symbol}</span>
                      <span className="text-gray-400 text-sm ml-3">{stock.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 text-xs">{stock.exchange}</span>
                      <Plus className="w-5 h-5 text-emerald-400" strokeWidth={2} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchQuery && searchResults.length === 0 && (
              <div className="absolute left-3 right-3 top-full mt-1 bg-[#0d1829] border border-gray-700 rounded-lg p-4 text-center text-gray-400 text-sm z-50">
                No results for "{searchQuery}"
              </div>
            )}
          </div>
        )}

        {/* Stock List */}
        <div className="flex-1 overflow-auto scrollbar-hide" style={scrollStyle}>
          {loading && stocks.length > 0 && (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-gray-400 text-sm">Loading prices...</span>
            </div>
          )}
          
          {stocks.map((stock) => {
            const quote = quotes[stock.symbol] || {};
            const price = quote.price || 0;
            const change = quote.change || 0;
            const changePercent = quote.changePercent || 0;
            const isPositive = change >= 0;
            const isSelected = selectedTicker === stock.symbol;
            const stockInfo = STOCK_DATABASE.find(s => s.symbol === stock.symbol);
            const name = stockInfo?.name || stock.name || stock.symbol;
            
            return (
              <div 
                key={stock.symbol}
                className={`flex items-center justify-between cursor-pointer transition-all border-b border-gray-800/30 ${
                  isSelected ? 'bg-emerald-500/10 border-l-2 border-l-emerald-400' : 'hover:bg-[#0d1829]'
                } ${isCollapsed ? 'px-2 py-3' : 'px-4 py-3'}`}
                onClick={() => setSelectedTicker(stock.symbol)}
              >
                {isCollapsed ? (
                  <div className="w-full text-center">
                    <div className="text-white text-xs font-bold">${stock.symbol}</div>
                    <div className={`text-[10px] font-medium mt-0.5 ${price > 0 ? (isPositive ? 'text-emerald-400' : 'text-red-400') : 'text-gray-500'}`}>
                      {price > 0 ? `$${formatPrice(price)}` : '...'}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="text-white font-bold text-base">${stock.symbol}</div>
                      <div className="text-gray-500 text-sm truncate">{name}</div>
                    </div>

                    <div className="text-right flex-shrink-0 mr-3">
                      <div className="text-white font-semibold text-base font-mono">
                        {price > 0 ? `$${formatPrice(price)}` : '...'}
                      </div>
                      {price > 0 && (
                        <div className={`text-sm font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isPositive ? '+' : ''}{change.toFixed(2)} ({isPositive ? '+' : ''}{changePercent.toFixed(2)}%)
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={(e) => handleRemoveStock(stock.symbol, e)}
                      className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-gray-600 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.5} />
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
            <span className="text-gray-400">{stocks.length} symbols</span>
            <span className="text-blue-400">Alpaca Data</span>
          </div>
        )}
      </div>

      {/* TradingView Chart */}
      {selectedTicker && (
        <div className="flex-1 flex flex-col bg-[#060d18] min-w-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <h2 className="text-white font-bold text-lg">${selectedTicker}</h2>
              <span className="text-gray-400 text-sm">{STOCK_DATABASE.find(s => s.symbol === selectedTicker)?.name || stocks.find(s => s.symbol === selectedTicker)?.name}</span>
            </div>
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
            <p className="text-sm mt-1">Click any symbol from your watchlist</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WatchlistPage;
