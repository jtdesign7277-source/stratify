import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Plus, X, Trash2, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import BreakingNewsBanner from './BreakingNewsBanner';
import useBreakingNews from '../../hooks/useBreakingNews';

const API_URL = 'https://stratify-backend-production-3ebd.up.railway.app';

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

const TradePage = ({ watchlist = [], onAddToWatchlist, onRemoveFromWatchlist }) => {
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isTradePanelOpen, setIsTradePanelOpen] = useState(false);
  const [quotes, setQuotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [orderSide, setOrderSide] = useState('buy');
  const [orderQty, setOrderQty] = useState('1');
  const [orderType, setOrderType] = useState('market');
  const [orderStatus, setOrderStatus] = useState({ state: 'idle', message: '' });
  const { breakingNews, isVisible: isBreakingNewsVisible, triggerBreakingNews, dismissBreakingNews } = useBreakingNews();
  
  const stocks = watchlist.length > 0 
    ? watchlist.map(item => typeof item === 'string' ? { symbol: item, name: item } : item)
    : [];
  const defaultSymbol = stocks[0]?.symbol || 'SPY';

  const selectedQuote = selectedTicker ? quotes[selectedTicker] : null;
  const orderQtyNumber = useMemo(() => {
    const parsed = parseFloat(orderQty);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [orderQty]);
  const estimatedTotal = selectedQuote?.price ? selectedQuote.price * orderQtyNumber : 0;

  // Fetch quote snapshot via Railway backend
  const fetchSnapshot = useCallback(async (symbol) => {
    try {
      const res = await fetch(`${API_URL}/api/snapshot/${symbol}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data;
    } catch (err) {
      console.error('Snapshot fetch error:', symbol, err);
      return null;
    }
  }, []);

  // Fetch all quotes
  useEffect(() => {
    const fetchAllQuotes = async () => {
      setLoading(true);
      const results = {};
      
      await Promise.all(
        stocks.map(async (stock) => {
          const quote = await fetchSnapshot(stock.symbol);
          if (quote && quote.price) {
            const prevClose = typeof quote.prevClose === 'number' ? quote.prevClose : quote.price;
            const change = typeof quote.change === 'number' ? quote.change : quote.price - prevClose;
            const changePercent = typeof quote.changePercent === 'number'
              ? quote.changePercent
              : (prevClose > 0 ? (change / prevClose) * 100 : 0);
            
            results[stock.symbol] = {
              price: quote.price,
              change,
              changePercent,
              open: quote.open,
              high: quote.high,
              low: quote.low,
              volume: quote.volume,
            };
          }
        })
      );
      
      setQuotes(results);
      setLoading(false);
    };
    
    fetchAllQuotes();
    const interval = setInterval(fetchAllQuotes, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [stocks.map(s => s.symbol).join(','), fetchSnapshot]);

  // Local search from STOCK_DATABASE
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

  useEffect(() => {
    if (!selectedTicker || !stocks.find(s => s.symbol === selectedTicker)) {
      setSelectedTicker(defaultSymbol);
    }
  }, [defaultSymbol, selectedTicker, stocks]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      triggerBreakingNews({
        headline: '⚡ SpaceX acquiring xAI for $50B',
        tickerSymbol: 'TSLA',
        tickerChange: 12,
        newsUrl: 'https://example.com/breaking-news',
        isLive: true,
      });
    }, 600);

    return () => clearTimeout(timeout);
  }, [triggerBreakingNews]);

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

  const handlePlaceOrder = async () => {
    if (!selectedTicker || orderQtyNumber <= 0 || orderStatus.state === 'submitting') return;
    setOrderStatus({ state: 'submitting', message: '' });
    try {
      const res = await fetch(`${API_URL}/api/trades/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedTicker,
          qty: orderQtyNumber,
          side: orderSide,
          type: orderType,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Order failed');
      }
      setOrderStatus({ state: 'success', message: 'Order placed successfully.' });
    } catch (err) {
      setOrderStatus({ state: 'error', message: err?.message || 'Order failed.' });
    }
  };

  const formatPrice = (price) => {
    if (!price || price === 0) return '...';
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const scrollStyle = { scrollbarWidth: 'none', msOverflowStyle: 'none' };

  return (
    <div className="flex-1 flex h-full bg-[#0d0d12] overflow-hidden">
      <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>
      
      {/* Watchlist Panel */}
      <div className={`flex flex-col border-r border-gray-800 transition-all duration-300 ${
        isCollapsed ? 'w-20' : selectedTicker ? 'w-96' : 'flex-1 max-w-xl'
      }`}>
        {/* Header */}
        <div className="border-b border-gray-800">
          <AnimatePresence mode="popLayout">
            {!isCollapsed && isBreakingNewsVisible && breakingNews && (
              <motion.div
                key="breaking-news-banner"
                layout
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                className="px-4 pt-3"
              >
                <BreakingNewsBanner
                  headline={breakingNews.headline}
                  tickerSymbol={breakingNews.tickerSymbol}
                  tickerChange={breakingNews.tickerChange}
                  newsUrl={breakingNews.newsUrl}
                  isLive={breakingNews.isLive}
                  onDismiss={dismissBreakingNews}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            layout
            className="flex items-center justify-end px-3 py-2"
            animate={{ opacity: isBreakingNewsVisible ? 0.6 : 1, y: isBreakingNewsVisible ? 2 : 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={`p-1.5 rounded-lg text-gray-400 hover:text-white transition-all duration-300 ${
                isCollapsed
                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-400/30 shadow-[0_0_12px_rgba(16,185,129,0.45),0_0_22px_rgba(34,211,238,0.35)] animate-pulse'
                  : 'hover:bg-gray-700/50 hover:border hover:border-emerald-400/30 hover:shadow-[0_0_10px_rgba(16,185,129,0.35),0_0_18px_rgba(34,211,238,0.25)] border border-transparent'
              }`}
            >
              {isCollapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
            </button>
          </motion.div>
        </div>

        {/* Search */}
        {!isCollapsed && (
          <div className="p-3 border-b border-gray-800 relative">
            <div className="flex items-center gap-2 bg-[#111118] border border-gray-700 rounded-lg px-3 py-2.5">
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
              <div className="absolute left-3 right-3 top-full mt-1 bg-[#111118] border border-gray-700 rounded-lg overflow-hidden shadow-2xl z-50 max-h-96 overflow-y-auto scrollbar-hide" style={scrollStyle}>
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
              <div className="absolute left-3 right-3 top-full mt-1 bg-[#111118] border border-gray-700 rounded-lg p-4 text-center text-gray-400 text-sm z-50">
                No results for "{searchQuery}"
              </div>
            )}
          </div>
        )}

        {/* Stock List */}
        <div className="flex-1 overflow-auto scrollbar-hide" style={scrollStyle}>
          {loading && Object.keys(quotes).length === 0 && (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-gray-400 text-sm">Loading prices...</span>
            </div>
          )}
          
          {stocks.length === 0 && !loading && (
            <div className="px-4 py-6 text-center text-gray-500 text-sm">
              Watchlist is empty. Search to add symbols.
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
                  isSelected ? 'bg-emerald-500/10 border-l-2 border-l-emerald-400' : 'hover:bg-white/5'
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
            <span className="text-emerald-400">Alpaca Data</span>
          </div>
        )}
      </div>

      {/* TradingView Chart + Trade Panel */}
      <div className="flex-1 flex flex-col bg-[#0d0d12] min-w-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <h2 className="text-white font-bold text-lg">${selectedTicker || defaultSymbol}</h2>
            <span className="text-gray-400 text-sm">
              {STOCK_DATABASE.find(s => s.symbol === (selectedTicker || defaultSymbol))?.name ||
                stocks.find(s => s.symbol === (selectedTicker || defaultSymbol))?.name ||
                'S&P 500 ETF'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {!isTradePanelOpen && (
              <button
                onClick={() => setIsTradePanelOpen(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#111118] border border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
              >
                Trade
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 min-h-0 flex flex-col xl:flex-row">
          <div className="flex-1 min-h-[360px] relative">
            <iframe
              key={selectedTicker || defaultSymbol}
              src={`https://s.tradingview.com/widgetembed/?frameElementId=tv_chart&symbol=${selectedTicker || defaultSymbol}&interval=D&hidesidetoolbar=1&symboledit=0&saveimage=0&toolbarbg=111118&studies=[]&theme=dark&style=1&timezone=America%2FNew_York&withdateranges=1&showpopupbutton=0&locale=en&hide_top_toolbar=0&hide_legend=0&allow_symbol_change=0`}
              style={{ width: '100%', height: '100%', border: 'none' }}
              allowFullScreen
            />
          </div>

          <div
            className={`bg-[#111118] overflow-hidden transition-all duration-300 ease-in-out ${
              isTradePanelOpen
                ? 'opacity-100 max-h-[1000px] border-t xl:border-t-0 xl:border-l border-gray-800 w-full xl:w-80'
                : 'opacity-0 max-h-0 xl:max-h-none border-transparent w-full xl:w-0 pointer-events-none translate-y-2 xl:translate-y-0 xl:translate-x-3'
            }`}
          >
            <div className="p-4 border-b border-gray-800 flex items-start justify-between">
              <div>
                <h3 className="text-white font-semibold text-base">Trade Execution</h3>
                <p className="text-gray-400 text-xs mt-1">Place a market or limit order.</p>
              </div>
              <button
                onClick={() => setIsTradePanelOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
                aria-label="Collapse trade panel"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOrderSide('buy')}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border ${
                    orderSide === 'buy'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'bg-[#060d18] text-gray-400 border-gray-700 hover:text-white'
                  }`}
                >
                  Buy
                </button>
                <button
                  onClick={() => setOrderSide('sell')}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border ${
                    orderSide === 'sell'
                      ? 'bg-red-500/20 text-red-400 border-red-500/40'
                      : 'bg-[#060d18] text-gray-400 border-gray-700 hover:text-white'
                  }`}
                >
                  Sell
                </button>
              </div>

              <div>
                <label className="text-xs text-gray-400">Quantity</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={orderQty}
                  onChange={(e) => setOrderQty(e.target.value)}
                  className="mt-1 w-full bg-[#060d18] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400">Order Type</label>
                <select
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value)}
                  className="mt-1 w-full bg-[#060d18] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-emerald-400"
                >
                  <option value="market">Market</option>
                  <option value="limit">Limit</option>
                </select>
              </div>

              <div className="rounded-lg border border-gray-800 bg-[#060d18] p-3">
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>Est. Total</span>
                  <span className="text-white font-semibold">
                    {estimatedTotal > 0 ? `$${formatPrice(estimatedTotal)}` : '...'}
                  </span>
                </div>
                <div className="text-[11px] text-gray-500 mt-2">
                  Based on {selectedQuote?.price ? `$${formatPrice(selectedQuote.price)}` : 'current'} price.
                </div>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={!selectedTicker || orderQtyNumber <= 0 || orderStatus.state === 'submitting'}
                className={`w-full py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  orderSide === 'buy'
                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                    : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {orderStatus.state === 'submitting' ? 'Placing Order...' : 'Place Order'}
              </button>

              {orderStatus.state !== 'idle' && (
                <div className={`text-xs ${
                  orderStatus.state === 'success' ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {orderStatus.message}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradePage;
// v1770073772
