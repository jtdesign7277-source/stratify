import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Plus, X, Trash2, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { TOP_CRYPTO_BY_MARKET_CAP } from '../../data/cryptoTop20';
import { API_URL } from '../../config';
import useAlpacaStream from '../../hooks/useAlpacaStream';

const CRYPTO_API_BASE = 'https://api.crypto.com/exchange/v1/public/get-tickers';

const getMarketStatus = () => {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const hours = et.getHours();
  const minutes = et.getMinutes();
  const day = et.getDay();
  const time = hours * 60 + minutes;
  if (day === 0 || day === 6) return 'closed';
  if (time >= 240 && time < 570) return 'pre_market';
  if (time >= 570 && time < 960) return 'regular';
  if (time >= 960 && time < 1200) return 'post_market';
  return 'closed';
};

const formatCryptoSymbol = (symbol) => {
  if (!symbol) return symbol;
  const n = symbol.toUpperCase();
  if (n.includes(':')) return n;
  if (n.endsWith('USD')) return `CRYPTO:${n}`;
  return `CRYPTO:${n}USD`;
};

const formatCryptoPrice = (price) => {
  if (!Number.isFinite(price)) return '...';
  if (price >= 1) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 0.01) return price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  return price.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 8 });
};

const formatPrice = (price) => {
  if (!price || price === 0) return '...';
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatExtendedPrice = (price) => {
  if (!Number.isFinite(price)) return '...';
  const formatted = price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return formatted.replace(/^0(?=\.)/, '');
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
  const [cryptoQuotes, setCryptoQuotes] = useState({});
  const [cryptoLoading, setCryptoLoading] = useState(false);
  const mountedRef = useRef(true);
  const cryptoList = TOP_CRYPTO_BY_MARKET_CAP;

  const normalizedWatchlist = watchlist.length > 0
    ? watchlist.map(item => typeof item === 'string' ? { symbol: item, name: item } : item)
    : DEFAULT_WATCHLIST;

  const stockWatchlist = normalizedWatchlist.filter(item => {
    const ex = typeof item?.exchange === 'string' ? item.exchange.toUpperCase() : '';
    const sec = typeof item?.sector === 'string' ? item.sector.toLowerCase() : '';
    return ex !== 'CRYPTO' && sec !== 'crypto';
  });

  const activeWatchlist = activeTab === 'stocks' ? stockWatchlist : [];
  const footerCount = activeTab === 'crypto' ? cryptoList.length : activeWatchlist.length;
  const footerLabel = activeTab === 'crypto' ? 'Crypto.com API' : 'Alpaca Live';

  // Real-time WebSocket streaming from Alpaca
  const stockSymbolsForStream = useMemo(() => stockWatchlist.map(s => s.symbol), [stockWatchlist]);
  const cryptoSymbolsForStream = useMemo(() => cryptoList.map(c => c.symbol), [cryptoList]);
  
  const {
    stockQuotes: wsStockQuotes,
    cryptoQuotes: wsCryptoQuotes,
    stockConnected,
    cryptoConnected,
  } = useAlpacaStream({
    stockSymbols: stockSymbolsForStream,
    cryptoSymbols: cryptoSymbolsForStream,
    enabled: true
  });

  // Merge WebSocket data with polling data for stocks
  useEffect(() => {
    if (Object.keys(wsStockQuotes).length > 0) {
      setQuotes(prev => {
        const merged = { ...prev };
        Object.entries(wsStockQuotes).forEach(([symbol, wsQuote]) => {
          if (wsQuote.price) {
            const prevClose = prev[symbol]?.prevClose || wsQuote.prevClose || wsQuote.price;
            merged[symbol] = {
              ...prev[symbol],
              latestPrice: wsQuote.price,
              change: wsQuote.price - prevClose,
              changePercent: prevClose ? ((wsQuote.price - prevClose) / prevClose) * 100 : 0,
            };
          }
        });
        return merged;
      });
    }
  }, [wsStockQuotes]);

  // Merge WebSocket data with polling data for crypto
  useEffect(() => {
    if (Object.keys(wsCryptoQuotes).length > 0) {
      setCryptoQuotes(prev => {
        const merged = { ...prev };
        Object.entries(wsCryptoQuotes).forEach(([symbol, wsQuote]) => {
          if (wsQuote.price) {
            merged[symbol] = {
              ...prev[symbol],
              price: wsQuote.price,
              changePercent: prev[symbol]?.changePercent || 0,
            };
          }
        });
        return merged;
      });
    }
  }, [wsCryptoQuotes]);

  // Cleanup ref
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Market status updater
  useEffect(() => {
    const interval = setInterval(() => setMarketStatus(getMarketStatus()), 60000);
    return () => clearInterval(interval);
  }, []);

  // ===== STOCK QUOTES via API /api/public/quotes =====
  useEffect(() => {
    if (activeTab !== 'stocks' || activeWatchlist.length === 0) {
      setLoading(false);
      return;
    }

    const fetchStockQuotes = async () => {
      try {
        const symbols = activeWatchlist.map(s => s.symbol).join(',');
        const url = `${API_URL}/api/public/quotes?symbols=${encodeURIComponent(symbols)}`;
        console.log('[WatchlistPage] Fetching stocks:', url);
        const res = await fetch(url);
        if (!res.ok) {
          console.error('[WatchlistPage] Stock API error:', res.status);
          setLoading(false);
          return;
        }
        const data = await res.json();
        console.log('[WatchlistPage] Got stock data:', data.length, 'items');
        if (!mountedRef.current) return;
        const results = {};
        data.forEach(item => {
          if (item && item.symbol) {
            results[item.symbol] = {
              latestPrice: item.latestPrice ?? item.price ?? 0,
              change: item.change ?? 0,
              changePercent: item.changePercent ?? 0,
              marketSession: item.marketSession,
              extendedHoursPrice: item.extendedHoursPrice,
              extendedHoursChangePercent: item.extendedHoursChangePercent,
            };
          }
        });
        setQuotes(results);
      } catch (err) {
        console.error('[WatchlistPage] Stock fetch error:', err);
      }
      if (mountedRef.current) setLoading(false);
    };

    setLoading(true);
    fetchStockQuotes();
    const interval = setInterval(fetchStockQuotes, 3000); // Update every 3 seconds
    return () => clearInterval(interval);
  }, [activeTab, activeWatchlist.map(s => s.symbol).join(',')]);

  // ===== CRYPTO QUOTES via Crypto.com =====
  useEffect(() => {
    if (activeTab !== 'crypto') return;

    const fetchAllCrypto = async () => {
      setCryptoLoading(true);
      const results = {};
      await Promise.all(
        cryptoList.map(async (crypto) => {
          try {
            const name = `${crypto.symbol.toUpperCase()}_USD`;
            const res = await fetch(`${CRYPTO_API_BASE}?instrument_name=${name}`);
            if (!res.ok) return;
            const data = await res.json();
            const ticker = data?.result?.data?.[0];
            if (!ticker) return;
            const price = Number(ticker.a);
            const changeRaw = Number(ticker.c);
            let changePercent = null;
            if (Number.isFinite(changeRaw)) {
              changePercent = Math.abs(changeRaw) <= 1 ? changeRaw * 100 :
                (Number.isFinite(price) && price !== 0) ? (changeRaw / price) * 100 : changeRaw;
            }
            results[crypto.symbol] = { price, changePercent };
          } catch (err) {
            console.error('Crypto error:', crypto.symbol, err);
          }
        })
      );
      if (mountedRef.current) {
        setCryptoQuotes(results);
        setCryptoLoading(false);
      }
    };

    fetchAllCrypto();
    const interval = setInterval(fetchAllCrypto, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [activeTab]);

  // Search
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const q = searchQuery.toLowerCase();
    const existing = normalizedWatchlist.map(s => s.symbol);
    setSearchResults(
      STOCK_DATABASE.filter(s =>
        !existing.includes(s.symbol) &&
        (s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      ).slice(0, 10)
    );
  }, [searchQuery, normalizedWatchlist]);

  const handleAddStock = (stock) => {
    onAddToWatchlist?.({ symbol: stock.symbol, name: stock.name });
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleRemoveStock = (symbol, e) => {
    e.stopPropagation();
    e.preventDefault();
    onRemoveFromWatchlist?.(symbol);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSelectedTicker(null);
  };

  const selectedCrypto = cryptoList.find(c => c.symbol === selectedTicker);
  const selectedIsCrypto = Boolean(selectedCrypto);
  const chartSymbol = selectedTicker
    ? (selectedIsCrypto ? formatCryptoSymbol(selectedTicker) : selectedTicker)
    : null;
  const selectedName = selectedIsCrypto
    ? (selectedCrypto?.name || selectedTicker)
    : (STOCK_DATABASE.find(s => s.symbol === selectedTicker)?.name ||
       normalizedWatchlist.find(s => s.symbol === selectedTicker)?.name || selectedTicker);

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
                marketStatus === 'regular' ? 'bg-emerald-500/20 text-emerald-400' :
                marketStatus === 'pre_market' ? 'bg-blue-500/20 text-blue-400' :
                marketStatus === 'post_market' ? 'bg-purple-500/20 text-purple-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {marketStatus === 'regular' ? 'Market Open' : marketStatus === 'pre_market' ? 'Pre-Market' :
                 marketStatus === 'post_market' ? 'Post-Market' : 'Market Closed'}
              </span>
            </div>
          )}
          <button onClick={() => setIsCollapsed(!isCollapsed)} className="p-1.5 hover:bg-gray-700/50 rounded-lg text-gray-400 hover:text-white">
            {isCollapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Search + Tabs */}
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
              <button type="button" onClick={() => handleTabChange('stocks')}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  activeTab === 'stocks' ? 'bg-emerald-500/20 text-emerald-300' : 'text-gray-400 hover:text-white'
                }`}>Stocks</button>
              <button type="button" onClick={() => handleTabChange('crypto')}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  activeTab === 'crypto' ? 'bg-emerald-500/20 text-emerald-300' : 'text-gray-400 hover:text-white'
                }`}>Crypto</button>
            </div>

            {/* Search Results Dropdown */}
            {searchQuery && searchResults.length > 0 && (
              <div className="absolute left-3 right-3 top-full mt-1 bg-[#111111] border border-[#2a2a2a] rounded-lg overflow-hidden shadow-2xl z-50 max-h-96 overflow-y-auto scrollbar-hide" style={scrollStyle}>
                {searchResults.map((stock) => (
                  <div key={stock.symbol}
                    className="flex items-center justify-between px-4 py-3 hover:bg-emerald-500/10 cursor-pointer border-b border-[#1f1f1f]/50 last:border-0 transition-colors"
                    onClick={() => handleAddStock(stock)}>
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

        {/* List */}
        <div className="flex-1 overflow-auto scrollbar-hide" style={scrollStyle}>
          {/* Loading states */}
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

          {/* Crypto list */}
          {activeTab === 'crypto' && cryptoList.map((crypto) => {
            const isSelected = selectedTicker === crypto.symbol;
            const q = cryptoQuotes[crypto.symbol] || {};
            const price = Number(q.price);
            const cp = Number.isFinite(q.changePercent) ? q.changePercent : null;
            const pos = cp !== null ? cp >= 0 : true;
            return (
              <div key={crypto.symbol}
                className={`flex items-center justify-between cursor-pointer transition-all border-b border-[#1f1f1f]/30 ${
                  isSelected ? 'bg-emerald-500/10 border-l-2 border-l-emerald-400' : 'hover:bg-[#111111]'
                } ${isCollapsed ? 'px-2 py-3' : 'px-4 py-3'}`}
                onClick={() => setSelectedTicker(crypto.symbol)}>
                {isCollapsed ? (
                  <div className="w-full text-center">
                    <div className="text-white text-xs font-bold">{crypto.symbol}</div>
                    <div className={`text-[10px] font-medium mt-0.5 ${Number.isFinite(price) ? (pos ? 'text-emerald-400' : 'text-red-400') : 'text-white/50'}`}>
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
                      {cp !== null && (
                        <div className={`text-sm font-medium ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
                          {pos ? '+' : ''}{cp.toFixed(2)}%
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {/* Stock list */}
          {activeTab === 'stocks' && activeWatchlist.map((stock) => {
            const q = quotes[stock.symbol] || {};
            const latestPrice = Number.isFinite(q.latestPrice) ? q.latestPrice : null;
            const change = Number.isFinite(q.change) ? q.change : null;
            const changePercent = Number.isFinite(q.changePercent) ? q.changePercent : null;
            const pos = (change ?? 0) >= 0;
            const marketSession = q.marketSession;
            const extendedHoursPrice = Number.isFinite(q.extendedHoursPrice) ? q.extendedHoursPrice : null;
            const extendedHoursChangePercent = Number.isFinite(q.extendedHoursChangePercent) ? q.extendedHoursChangePercent : null;
            const showExtended = (marketSession === 'pre_market' || marketSession === 'post_market')
              && Number.isFinite(extendedHoursPrice);
            const extendedPos = extendedHoursChangePercent !== null ? extendedHoursChangePercent >= 0 : null;
            const extendedLabel = marketSession === 'pre_market' ? 'Pre' : 'Post';
            const extendedPercentLabel = extendedHoursChangePercent !== null
              ? `${extendedPos ? '+' : ''}${extendedHoursChangePercent.toFixed(2)}%`
              : '';
            const isSelected = selectedTicker === stock.symbol;
            const info = STOCK_DATABASE.find(s => s.symbol === stock.symbol);
            const name = info?.name || stock.name || stock.symbol;
            return (
              <div key={stock.symbol}
                draggable
                onDragStart={(e) => { e.dataTransfer.setData('text/plain', stock.symbol); e.dataTransfer.effectAllowed = 'copy'; }}
                className={`flex items-center justify-between cursor-grab active:cursor-grabbing transition-all border-b border-[#1f1f1f]/30 ${
                  isSelected ? 'bg-emerald-500/10 border-l-2 border-l-emerald-400' : 'hover:bg-[#111111]'
                } ${isCollapsed ? 'px-2 py-3' : 'px-4 py-3'}`}
                onClick={() => setSelectedTicker(stock.symbol)}>
                {isCollapsed ? (
                  <div className="w-full text-center">
                    <div className="text-white text-xs font-bold">${stock.symbol}</div>
                    <div className={`text-[10px] font-medium mt-0.5 ${Number.isFinite(latestPrice) ? (pos ? 'text-emerald-400' : 'text-red-400') : 'text-white/50'}`}>
                      {Number.isFinite(latestPrice) ? `$${formatPrice(latestPrice)}` : '...'}
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
                        {Number.isFinite(latestPrice) ? `$${formatPrice(latestPrice)}` : '...'}
                      </div>
                      {Number.isFinite(change) && Number.isFinite(changePercent) && (
                        <div className={`text-sm font-medium ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
                          {pos ? '+' : ''}{change.toFixed(2)} ({pos ? '+' : ''}{changePercent.toFixed(2)}%)
                        </div>
                      )}
                      {showExtended && (
                        <div className={`text-xs font-medium mt-0.5 ${extendedPos === null ? 'text-gray-400' : (extendedPos ? 'text-emerald-400' : 'text-red-400')}`}>
                          {extendedLabel} {formatExtendedPrice(extendedHoursPrice)} {extendedPercentLabel}
                        </div>
                      )}
                    </div>
                    <div className="ml-1 w-[2.75rem] flex items-center justify-end opacity-0 hover:opacity-100 transition-opacity duration-200">
                      <button onClick={(e) => handleRemoveStock(stock.symbol, e)}
                        className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-gray-600 hover:text-red-400">
                        <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                      </button>
                    </div>
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
            <div className="flex items-center gap-2">
              {activeTab === 'stocks' && (
                <span className={`flex items-center gap-1 ${stockConnected ? 'text-emerald-400' : 'text-yellow-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${stockConnected ? 'bg-emerald-400 animate-pulse' : 'bg-yellow-400'}`} />
                  {stockConnected ? 'Live' : 'Connecting...'}
                </span>
              )}
              {activeTab === 'crypto' && (
                <span className={`flex items-center gap-1 ${cryptoConnected ? 'text-emerald-400' : 'text-yellow-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${cryptoConnected ? 'bg-emerald-400 animate-pulse' : 'bg-yellow-400'}`} />
                  {cryptoConnected ? 'Live' : 'Connecting...'}
                </span>
              )}
              <span className="text-blue-400">Alpaca</span>
            </div>
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
