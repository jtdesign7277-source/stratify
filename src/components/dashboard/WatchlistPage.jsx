import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, X, Trash2, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { TOP_CRYPTO_BY_MARKET_CAP } from '../../data/cryptoTop20';

const API_URL = 'https://stratify-backend-production-3ebd.up.railway.app';
const CRYPTO_API_BASE = 'https://api.crypto.com/exchange/v1/public/get-tickers';

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

const formatCryptoSymbol = (symbol) => {
  if (!symbol) return symbol;
  const normalized = symbol.toUpperCase();
  if (normalized.includes(':')) return normalized;
  if (normalized.endsWith('USD')) return `CRYPTO:${normalized}`;
  return `CRYPTO:${normalized}USD`;
};

const buildCryptoInstrumentName = (symbol) => `${String(symbol || '').toUpperCase()}_USD`;

const formatCryptoPrice = (price) => {
  if (!Number.isFinite(price)) return '...';
  if (price >= 1) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (price >= 0.01) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  }
  return price.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 8 });
};

const resolveCryptoChangePercent = (changeRaw, price) => {
  if (!Number.isFinite(changeRaw)) return null;
  if (Math.abs(changeRaw) <= 1) return changeRaw * 100;
  if (Number.isFinite(price) && price !== 0) {
    return (changeRaw / price) * 100;
  }
  return changeRaw;
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

const WatchlistPage = ({ watchlist = [], onAddToWatchlist, onRemoveFromWatchlist }) => {
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [activeTab, setActiveTab] = useState('stocks');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [marketStatus, setMarketStatus] = useState(getMarketStatus());
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [quotes, setQuotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [prevCloses, setPrevCloses] = useState({});
  const [cryptoQuotes, setCryptoQuotes] = useState({});
  const [cryptoLoading, setCryptoLoading] = useState(false);
  const cryptoList = TOP_CRYPTO_BY_MARKET_CAP;
  
  const normalizedWatchlist = watchlist.length > 0 
    ? watchlist.map(item => typeof item === 'string' ? { symbol: item, name: item } : item)
    : DEFAULT_WATCHLIST;

  const isCryptoItem = (item) => {
    const exchange = typeof item?.exchange === 'string' ? item.exchange.toUpperCase() : '';
    const sector = typeof item?.sector === 'string' ? item.sector.toLowerCase() : '';
    return exchange === 'CRYPTO' || sector === 'crypto';
  };

  const stockWatchlist = normalizedWatchlist.filter((item) => !isCryptoItem(item));
  const activeWatchlist = activeTab === 'stocks' ? stockWatchlist : [];

  const activeSymbols = activeWatchlist.map(s => s.symbol).join(',');
  const selectedStock = normalizedWatchlist.find(s => s.symbol === selectedTicker);
  const selectedCrypto = cryptoList.find(crypto => crypto.symbol === selectedTicker);
  const selectedIsCrypto = Boolean(selectedCrypto) || (selectedStock ? isCryptoItem(selectedStock) : false);
  const chartSymbol = selectedTicker
    ? (selectedIsCrypto ? formatCryptoSymbol(selectedTicker) : selectedTicker)
    : null;
  const selectedName = selectedIsCrypto
    ? (selectedCrypto?.name || selectedTicker)
    : (STOCK_DATABASE.find(s => s.symbol === selectedTicker)?.name || normalizedWatchlist.find(s => s.symbol === selectedTicker)?.name || selectedTicker);
  const footerCount = activeTab === 'crypto' ? cryptoList.length : activeWatchlist.length;
  const footerLabel = activeTab === 'crypto' ? 'Crypto.com API' : 'Alpaca Data';

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (!selectedTicker) return;
    if ((tab === 'crypto' && !selectedIsCrypto) || (tab === 'stocks' && selectedIsCrypto)) {
      setSelectedTicker(null);
    }
  };

  const fetchCryptoQuote = useCallback(async (symbol) => {
    try {
      const instrumentName = buildCryptoInstrumentName(symbol);
      const res = await fetch(`${CRYPTO_API_BASE}?instrument_name=${instrumentName}`);
      if (!res.ok) return null;
      const data = await res.json();
      const ticker = data?.result?.data?.[0];
      if (!ticker) return null;
      const price = Number(ticker.a);
      const changeRaw = Number(ticker.c);
      const changePercent = resolveCryptoChangePercent(changeRaw, price);
      return { price, changePercent };
    } catch (err) {
      console.error('Crypto quote fetch error:', symbol, err);
      return null;
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'crypto') return undefined;
    let isMounted = true;

    const fetchAllCryptoQuotes = async () => {
      setCryptoLoading(true);
      const results = {};
      await Promise.all(
        cryptoList.map(async (crypto) => {
          const quote = await fetchCryptoQuote(crypto.symbol);
          if (quote) {
            results[crypto.symbol] = quote;
          }
        })
      );
      if (isMounted) {
        setCryptoQuotes(results);
        setCryptoLoading(false);
      }
    };

    fetchAllCryptoQuotes();
    const interval = setInterval(fetchAllCryptoQuotes, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeTab, cryptoList, fetchCryptoQuote]);

  // Fetch quote from Alpaca via Railway backend - WORKING ENDPOINT
  const fetchQuote = useCallback(async (symbol) => {
    try {
      // Use public quote endpoint (same as TickerPill - has accurate change/changePercent)
      const res = await fetch(`${API_URL}/api/public/quote/${symbol}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.error('Quote fetch error:', symbol, err);
      return null;
    }
  }, []);

  // Fetch all quotes
  useEffect(() => {
    if (activeTab !== 'stocks') {
      setLoading(false);
      return;
    }
    const fetchAllQuotes = async () => {
      setLoading(true);
      const results = {};
      
      await Promise.all(
        activeWatchlist.map(async (stock) => {
          const quote = await fetchQuote(stock.symbol);
          if (quote && quote.price) {
            // Use API's change data directly (same source as TickerPill)
            results[stock.symbol] = {
              price: quote.price,
              change: quote.change || 0,
              changePercent: quote.changePercent || 0,
              askPrice: quote.askPrice,
              bidPrice: quote.bidPrice,
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
  }, [activeTab, activeSymbols, fetchQuote]);

  useEffect(() => {
    const interval = setInterval(() => setMarketStatus(getMarketStatus()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Local search from STOCK_DATABASE
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const query = searchQuery.toLowerCase();
    const existingSymbols = normalizedWatchlist.map(s => s.symbol);
    const filtered = STOCK_DATABASE.filter(s => 
      !existingSymbols.includes(s.symbol) &&
      (s.symbol.toLowerCase().includes(query) || s.name.toLowerCase().includes(query))
    ).slice(0, 10);
    setSearchResults(filtered);
  }, [searchQuery, normalizedWatchlist]);

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
    <div className="flex-1 flex h-full bg-[#0b0b0b] overflow-hidden">
      <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>
      
      {/* Watchlist Panel */}
      <div className={`flex flex-col border-r border-[#1f1f1f] transition-all duration-300 ${
        isCollapsed ? 'w-20' : selectedTicker ? 'w-96' : 'flex-1 max-w-xl'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#1f1f1f]">
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
          <div className="p-3 border-b border-[#1f1f1f] relative">
            <div className="flex items-center gap-2 bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5">
              <Search className="w-4 h-4 text-white/50" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search symbol or company..."
                className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-white/50 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="mt-3 flex items-center gap-2 bg-[#111111] border border-[#2a2a2a] rounded-lg p-1">
              <button
                type="button"
                onClick={() => handleTabChange('stocks')}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  activeTab === 'stocks'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Stocks
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('crypto')}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  activeTab === 'crypto'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Crypto
              </button>
            </div>
            
            {searchQuery && searchResults.length > 0 && (
              <div className="absolute left-3 right-3 top-full mt-1 bg-[#111111] border border-[#2a2a2a] rounded-lg overflow-hidden shadow-2xl z-50 max-h-96 overflow-y-auto scrollbar-hide" style={scrollStyle}>
                {searchResults.map((stock) => (
                  <div 
                    key={stock.symbol}
                    className="flex items-center justify-between px-4 py-3 hover:bg-emerald-500/10 cursor-pointer border-b border-[#1f1f1f]/50 last:border-0 transition-colors"
                    onClick={() => handleAddStock(stock)}
                  >
                    <div className="flex-1">
                      <span className="text-white font-bold text-base">${stock.symbol}</span>
                      <span className="text-gray-400 text-sm ml-3">{stock.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-white/50 text-xs">{stock.exchange}</span>
                      <Plus className="w-5 h-5 text-emerald-400" strokeWidth={2} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchQuery && searchResults.length === 0 && (
              <div className="absolute left-3 right-3 top-full mt-1 bg-[#111111] border border-[#2a2a2a] rounded-lg p-4 text-center text-gray-400 text-sm z-50">
                No results for "{searchQuery}"
              </div>
            )}
          </div>
        )}

        {/* Stock/Crypto List */}
        <div className="flex-1 overflow-auto scrollbar-hide" style={scrollStyle}>
          {activeTab === 'stocks' && loading && Object.keys(quotes).length === 0 && (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-gray-400 text-sm">Loading prices...</span>
            </div>
          )}

          {activeTab === 'crypto' && cryptoLoading && Object.keys(cryptoQuotes).length === 0 && (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-gray-400 text-sm">Loading top 20 crypto...</span>
            </div>
          )}

          {activeTab === 'crypto' && !cryptoLoading && Object.keys(cryptoQuotes).length === 0 && (
            <div className="px-4 py-6 text-center text-white/50 text-sm">
              No crypto data available.
            </div>
          )}

          {activeTab === 'crypto' && cryptoList.map((crypto) => {
            const isSelected = selectedTicker === crypto.symbol;
            const quote = cryptoQuotes[crypto.symbol] || {};
            const price = Number(quote.price);
            const changePercent = Number.isFinite(quote.changePercent) ? quote.changePercent : null;
            const isPositive = changePercent !== null ? changePercent >= 0 : true;

            return (
              <div 
                key={crypto.symbol}
                className={`flex items-center justify-between cursor-pointer transition-all border-b border-[#1f1f1f]/30 ${
                  isSelected ? 'bg-emerald-500/10 border-l-2 border-l-emerald-400' : 'hover:bg-[#111111]'
                } ${isCollapsed ? 'px-2 py-3' : 'px-4 py-3'}`}
                onClick={() => setSelectedTicker(crypto.symbol)}
              >
                {isCollapsed ? (
                  <div className="w-full text-center">
                    <div className="text-white text-xs font-bold">{crypto.symbol}</div>
                    <div className={`text-[10px] font-medium mt-0.5 ${Number.isFinite(price) ? (isPositive ? 'text-emerald-400' : 'text-red-400') : 'text-white/50'}`}>
                      {Number.isFinite(price) ? `$${formatCryptoPrice(price)}` : '...'}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="text-white font-bold text-base">{crypto.symbol}</div>
                      <div className="text-white/50 text-sm truncate">{crypto.name}</div>
                    </div>
                    <div className="text-right flex-shrink-0 mr-3">
                      <div className="text-white font-semibold text-base font-mono">
                        {Number.isFinite(price) ? `$${formatCryptoPrice(price)}` : '...'}
                      </div>
                      {changePercent !== null && (
                        <div className={`text-sm font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {activeTab === 'stocks' && activeWatchlist.map((stock) => {
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
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', stock.symbol);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                className={`flex items-center justify-between cursor-grab active:cursor-grabbing transition-all border-b border-[#1f1f1f]/30 ${
                  isSelected ? 'bg-emerald-500/10 border-l-2 border-l-emerald-400' : 'hover:bg-[#111111]'
                } ${isCollapsed ? 'px-2 py-3' : 'px-4 py-3'}`}
                onClick={() => setSelectedTicker(stock.symbol)}
              >
                {isCollapsed ? (
                  <div className="w-full text-center">
                    <div className="text-white text-xs font-bold">${stock.symbol}</div>
                    <div className={`text-[10px] font-medium mt-0.5 ${price > 0 ? (isPositive ? 'text-emerald-400' : 'text-red-400') : 'text-white/50'}`}>
                      {price > 0 ? `$${formatPrice(price)}` : '...'}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="text-white font-bold text-base">${stock.symbol}</div>
                      <div className="text-white/50 text-sm truncate">{name}</div>
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
          <div className="p-3 border-t border-[#1f1f1f] flex items-center justify-between text-xs">
            <span className="text-gray-400">{footerCount} symbols</span>
            <span className="text-blue-400">{footerLabel}</span>
          </div>
        )}
      </div>

      {/* TradingView Chart */}
      {selectedTicker && (
        <div className="flex-1 flex flex-col bg-[#0b0b0b] min-w-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f1f1f]">
            <div className="flex items-center gap-3">
              <h2 className="text-white font-bold text-lg">${selectedTicker}</h2>
              <span className="text-gray-400 text-sm">{selectedName}</span>
            </div>
            <button onClick={() => setSelectedTicker(null)} className="p-2 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-400">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 min-h-0">
            <iframe
              key={chartSymbol || selectedTicker}
              src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${chartSymbol || selectedTicker}&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=0&toolbarbg=f1f3f6&studies=[]&theme=dark&style=1&timezone=America%2FNew_York&withdateranges=1&showpopupbutton=0&locale=en`}
              style={{ width: '100%', height: '100%', border: 'none' }}
              allowFullScreen
            />
          </div>
        </div>
      )}

      {!selectedTicker && (
        <div className="flex-1 flex items-center justify-center bg-[#0b0b0b]">
          <div className="text-center text-white/50">
            <p className="text-lg">Select a ticker to view chart</p>
            <p className="text-sm mt-1">Click any symbol from your watchlist</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WatchlistPage;
