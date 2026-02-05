import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Plus, X, Trash2, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import BreakingNewsBanner from './BreakingNewsBanner';
import TickerTape from './TickerTape';
import useBreakingNews from '../../hooks/useBreakingNews';
import { TOP_CRYPTO_BY_MARKET_CAP } from '../../data/cryptoTop20';
import { useToast } from '../ui/Toast';

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

const CRYPTO_DATABASE = TOP_CRYPTO_BY_MARKET_CAP.map((crypto) => ({
  symbol: `${crypto.symbol}-USD`,
  name: crypto.name,
  displaySymbol: crypto.symbol,
  exchange: 'CRYPTO',
}));

const DEFAULT_CRYPTO_WATCHLIST = (() => {
  const primary = CRYPTO_DATABASE.filter((crypto) =>
    ['BTC-USD', 'ETH-USD', 'SOL-USD', 'XRP-USD', 'DOGE-USD'].includes(crypto.symbol)
  );
  return primary.length > 0 ? primary : CRYPTO_DATABASE.slice(0, 5);
})();

const CRYPTO_TV_MAP = {
  BTC: 'COINBASE:BTCUSD',
  'BTC-USD': 'COINBASE:BTCUSD',
  ETH: 'COINBASE:ETHUSD',
  'ETH-USD': 'COINBASE:ETHUSD',
  SOL: 'COINBASE:SOLUSD',
  'SOL-USD': 'COINBASE:SOLUSD',
  XRP: 'COINBASE:XRPUSD',
  'XRP-USD': 'COINBASE:XRPUSD',
  DOGE: 'COINBASE:DOGEUSD',
  'DOGE-USD': 'COINBASE:DOGEUSD',
  ADA: 'COINBASE:ADAUSD',
  'ADA-USD': 'COINBASE:ADAUSD',
  AVAX: 'COINBASE:AVAXUSD',
  'AVAX-USD': 'COINBASE:AVAXUSD',
  LINK: 'COINBASE:LINKUSD',
  'LINK-USD': 'COINBASE:LINKUSD',
  MATIC: 'COINBASE:MATICUSD',
  'MATIC-USD': 'COINBASE:MATICUSD',
};

const normalizeWatchlistItem = (item) => (typeof item === 'string' ? { symbol: item, name: item } : item);

const getCryptoDisplaySymbol = (symbol) => {
  if (!symbol) return '';
  const normalized = symbol.includes(':') ? symbol.split(':')[1] : symbol;
  if (CRYPTO_TV_MAP[normalized]) return normalized.replace('-USD', '').replace('USD', '');
  if (normalized.includes('-')) return normalized.split('-')[0];
  if (normalized.includes('/')) return normalized.split('/')[0];
  if (normalized.endsWith('USDT')) return normalized.slice(0, -4);
  if (normalized.endsWith('USD')) return normalized.slice(0, -3);
  return normalized;
};

const getTradingViewSymbol = (symbol, market) => {
  if (!symbol) return symbol;
  if (symbol.includes(':')) {
    if (market === 'crypto') {
      const normalized = symbol.split(':')[1] || symbol;
      const base = getCryptoDisplaySymbol(normalized);
      return base ? `COINBASE:${base}USD` : symbol;
    }
    return symbol;
  }
  if (market === 'crypto') {
    if (CRYPTO_TV_MAP[symbol]) return CRYPTO_TV_MAP[symbol];
    const base = getCryptoDisplaySymbol(symbol);
    return base ? `COINBASE:${base}USD` : symbol;
  }
  return symbol;
};

const normalizeCryptoQuoteSymbol = (symbol) => {
  if (!symbol) return symbol;
  let normalized = symbol.includes(':') ? symbol.split(':')[1] : symbol;
  if (normalized.includes('-') || normalized.includes('/')) return normalized;
  if (normalized.endsWith('USDT')) normalized = normalized.slice(0, -4);
  if (normalized.endsWith('USD')) normalized = normalized.slice(0, -3);
  return `${normalized}-USD`;
};

const normalizeCryptoWatchlistItem = (item) => {
  const normalized = normalizeWatchlistItem(item);
  const normalizedSymbol = normalizeCryptoQuoteSymbol(normalized.symbol);
  const displaySymbol = normalized.displaySymbol || getCryptoDisplaySymbol(normalizedSymbol);
  return { ...normalized, symbol: normalizedSymbol, displaySymbol };
};

const toNumber = (value) => {
  if (typeof value === 'number') return value;
  if (value == null) return NaN;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const buildQuote = (quote) => {
  if (!quote) return null;
  const price = toNumber(quote.price);
  if (!Number.isFinite(price)) return null;
  const prevClose = toNumber(quote.prevClose ?? quote.previousClose ?? quote.prev_close);
  const fallbackPrevClose = Number.isFinite(prevClose) ? prevClose : price;
  const rawChange = toNumber(quote.change);
  const change = Number.isFinite(rawChange) ? rawChange : price - fallbackPrevClose;
  const rawChangePercent = toNumber(quote.changePercent ?? quote.change_percent);
  const changePercent = Number.isFinite(rawChangePercent)
    ? rawChangePercent
    : fallbackPrevClose > 0
      ? (change / fallbackPrevClose) * 100
      : 0;
  return {
    price,
    change,
    changePercent,
    open: toNumber(quote.open),
    high: toNumber(quote.high),
    low: toNumber(quote.low),
    volume: toNumber(quote.volume),
  };
};

const TradePage = ({ watchlist = [], onAddToWatchlist, onRemoveFromWatchlist }) => {
  const toast = useToast();
  const [activeMarket, setActiveMarket] = useState('equity');
  const [selectedEquity, setSelectedEquity] = useState(null);
  const [selectedCrypto, setSelectedCrypto] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isTradePanelOpen, setIsTradePanelOpen] = useState(false);
  const [equityQuotes, setEquityQuotes] = useState({});
  const [cryptoQuotes, setCryptoQuotes] = useState({});
  const [equityLoading, setEquityLoading] = useState(true);
  const [cryptoLoading, setCryptoLoading] = useState(true);
  const [cryptoWatchlist, setCryptoWatchlist] = useState(() => {
    try {
      const saved = localStorage.getItem('stratify-crypto-watchlist');
      return saved
        ? JSON.parse(saved).map(normalizeCryptoWatchlistItem)
        : DEFAULT_CRYPTO_WATCHLIST.map(normalizeCryptoWatchlistItem);
    } catch {
      return DEFAULT_CRYPTO_WATCHLIST.map(normalizeCryptoWatchlistItem);
    }
  });
  const [orderSide, setOrderSide] = useState('buy');
  const [orderQty, setOrderQty] = useState('1');
  const [orderType, setOrderType] = useState('market');
  const [orderStatus, setOrderStatus] = useState({ state: 'idle', message: '' });
  const {
    breakingNews,
    isVisible: isBreakingNewsVisible,
    status: breakingNewsStatus,
    triggerBreakingNews,
    dismissBreakingNews,
  } = useBreakingNews();
  
  const equityStocks = useMemo(() => (
    watchlist.length > 0 ? watchlist.map(normalizeWatchlistItem) : []
  ), [watchlist]);
  const cryptoStocks = useMemo(() => (
    cryptoWatchlist.length > 0 ? cryptoWatchlist.map(normalizeWatchlistItem) : []
  ), [cryptoWatchlist]);
  const activeWatchlist = activeMarket === 'crypto' ? cryptoStocks : equityStocks;
  const activeDatabase = activeMarket === 'crypto' ? CRYPTO_DATABASE : STOCK_DATABASE;
  const defaultEquitySymbol = equityStocks[0]?.symbol || 'SPY';
  const defaultCryptoSymbol = cryptoStocks[0]?.symbol || 'BTC-USD';
  const selectedTicker = activeMarket === 'crypto' ? (selectedCrypto || defaultCryptoSymbol) : (selectedEquity || defaultEquitySymbol);
  const activeQuotes = activeMarket === 'crypto' ? cryptoQuotes : equityQuotes;
  const selectedQuote = selectedTicker ? activeQuotes[selectedTicker] : null;
  const activeLoading = activeMarket === 'crypto' ? cryptoLoading : equityLoading;
  const selectedDisplaySymbol = activeMarket === 'crypto' ? getCryptoDisplaySymbol(selectedTicker) : selectedTicker;
  const selectedName = useMemo(() => {
    if (!selectedTicker) return '';
    if (activeMarket === 'crypto') {
      return CRYPTO_DATABASE.find(s => s.symbol === selectedTicker || s.displaySymbol === selectedTicker)?.name
        || cryptoStocks.find(s => s.symbol === selectedTicker)?.name
        || selectedTicker;
    }
    return STOCK_DATABASE.find(s => s.symbol === selectedTicker)?.name
      || equityStocks.find(s => s.symbol === selectedTicker)?.name
      || 'S&P 500 ETF';
  }, [activeMarket, cryptoStocks, equityStocks, selectedTicker]);
  const chartSymbol = useMemo(() => getTradingViewSymbol(selectedTicker, activeMarket), [selectedTicker, activeMarket]);
  const orderQtyNumber = useMemo(() => {
    const parsed = parseFloat(orderQty);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [orderQty]);
  const estimatedTotal = selectedQuote?.price ? selectedQuote.price * orderQtyNumber : 0;
  const tickerTapeText = useMemo(() => {
    if (!breakingNews?.headline) return '';
    const normalizedHeadline = breakingNews.headline.replace(/^⚡\\s*/, '');
    const changeValue = typeof breakingNews.tickerChange === 'number'
      ? breakingNews.tickerChange
      : Number(breakingNews.tickerChange || 0);
    const changeSign = changeValue > 0 ? '+' : changeValue < 0 ? '' : '';
    const formattedChange = Number.isFinite(changeValue) ? `${changeSign}${changeValue.toFixed(2)}%` : '';
    const tickerMove = breakingNews.tickerSymbol
      ? `$${breakingNews.tickerSymbol} ${formattedChange}`.trim()
      : '';
    const segments = [
      `⚡ BREAKING: ${normalizedHeadline}`,
      tickerMove,
      'Fed announces rate cut',
      '$NVDA earnings beat...',
    ].filter(Boolean);

    return segments.join(' │ ');
  }, [breakingNews]);

  // Fetch quote snapshot via Railway backend
  const fetchSnapshot = useCallback(async (symbol) => {
    try {
      const url = new URL(`${API_URL}/api/snapshot/${encodeURIComponent(symbol)}`);
      url.searchParams.set('t', Date.now());
      const res = await fetch(url.toString(), {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return buildQuote(data);
    } catch (err) {
      console.error('Snapshot fetch error:', symbol, err);
      return null;
    }
  }, []);

  const fetchCryptoQuote = useCallback(async (symbol) => {
    try {
      const normalizedSymbol = normalizeCryptoQuoteSymbol(symbol);
      const url = new URL(`${API_URL}/api/public/quote/${encodeURIComponent(normalizedSymbol)}`);
      url.searchParams.set('t', Date.now());
      const res = await fetch(url.toString(), {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return buildQuote(data);
    } catch (err) {
      console.error('Crypto quote fetch error:', symbol, err);
      return null;
    }
  }, []);

  const equitySymbolsKey = useMemo(() => equityStocks.map(s => s.symbol).join(','), [equityStocks]);
  const cryptoSymbolsKey = useMemo(() => cryptoStocks.map(s => s.symbol).join(','), [cryptoStocks]);

  // Fetch equity quotes
  useEffect(() => {
    const fetchEquityQuotes = async () => {
      setEquityLoading(true);
      const results = {};
      await Promise.all(
        equityStocks.map(async (stock) => {
          const quote = await fetchSnapshot(stock.symbol);
          if (quote && quote.price) {
            results[stock.symbol] = quote;
          }
        })
      );
      setEquityQuotes(results);
      setEquityLoading(false);
    };

    fetchEquityQuotes();
    const interval = setInterval(fetchEquityQuotes, 10000);
    return () => clearInterval(interval);
  }, [equitySymbolsKey, fetchSnapshot]);

  // Fetch crypto quotes
  useEffect(() => {
    const fetchCryptoQuotes = async () => {
      setCryptoLoading(true);
      const results = {};
      await Promise.all(
        cryptoStocks.map(async (stock) => {
          const quote = await fetchCryptoQuote(stock.symbol);
          if (quote && quote.price) {
            results[stock.symbol] = quote;
          }
        })
      );
      setCryptoQuotes(results);
      setCryptoLoading(false);
    };

    fetchCryptoQuotes();
    const interval = setInterval(fetchCryptoQuotes, 10000);
    return () => clearInterval(interval);
  }, [cryptoSymbolsKey, fetchCryptoQuote]);

  useEffect(() => {
    localStorage.setItem('stratify-crypto-watchlist', JSON.stringify(cryptoWatchlist));
  }, [cryptoWatchlist]);

  useEffect(() => {
    setSearchQuery('');
    setSearchResults([]);
  }, [activeMarket]);

  // Local search from active database
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const query = searchQuery.toLowerCase();
    const existingSymbols = activeWatchlist.map(s => s.symbol);
    const filtered = activeDatabase.filter(s => {
      if (existingSymbols.includes(s.symbol)) return false;
      const symbolMatch = s.symbol.toLowerCase().includes(query);
      const nameMatch = s.name.toLowerCase().includes(query);
      const displayMatch = s.displaySymbol ? s.displaySymbol.toLowerCase().includes(query) : false;
      return symbolMatch || nameMatch || displayMatch;
    }).slice(0, 10);
    setSearchResults(filtered);
  }, [searchQuery, activeDatabase, activeWatchlist]);

  useEffect(() => {
    if (activeMarket === 'equity') {
      if (!selectedEquity || !equityStocks.find(s => s.symbol === selectedEquity)) {
        setSelectedEquity(defaultEquitySymbol);
      }
    }
  }, [activeMarket, defaultEquitySymbol, equityStocks, selectedEquity]);

  useEffect(() => {
    if (activeMarket === 'crypto') {
      if (!selectedCrypto || !cryptoStocks.find(s => s.symbol === selectedCrypto)) {
        setSelectedCrypto(defaultCryptoSymbol);
      }
    }
  }, [activeMarket, defaultCryptoSymbol, cryptoStocks, selectedCrypto]);

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
    if (activeMarket === 'crypto') {
      const normalizedStock = normalizeCryptoWatchlistItem(stock);
      setCryptoWatchlist(prev => {
        if (prev.some(s => s.symbol === normalizedStock.symbol)) return prev;
        return [...prev, normalizedStock];
      });
    } else if (onAddToWatchlist) {
      onAddToWatchlist({ symbol: stock.symbol, name: stock.name });
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleRemoveStock = (symbol, e) => {
    e.stopPropagation();
    e.preventDefault();
    if (activeMarket === 'crypto') {
      setCryptoWatchlist(prev => prev.filter(s => s.symbol !== symbol));
    } else if (onRemoveFromWatchlist) {
      onRemoveFromWatchlist(symbol);
    }
  };

  const handleSelectSymbol = useCallback((symbol) => {
    if (activeMarket === 'crypto') {
      setSelectedCrypto(symbol);
    } else {
      setSelectedEquity(symbol);
    }
  }, [activeMarket]);

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
      toast.success(`${orderSide === 'buy' ? 'Bought' : 'Sold'} ${orderQtyNumber} ${selectedTicker}`, {
        title: 'Order Executed',
      });
    } catch (err) {
      setOrderStatus({ state: 'error', message: err?.message || 'Order failed.' });
      toast.error(err?.message || 'Order failed', {
        title: 'Order Failed',
      });
    }
  };

  const formatPrice = (price) => {
    if (!price || price === 0) return '...';
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const scrollStyle = { scrollbarWidth: 'none', msOverflowStyle: 'none' };
  const showBreakingBanner = !isCollapsed && isBreakingNewsVisible && breakingNews;
  const showTickerTape = !isCollapsed && !isBreakingNewsVisible && breakingNewsStatus === 'dismissed';
  const collapseToggle = (
    <button
      onClick={() => setIsCollapsed(!isCollapsed)}
      className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors focus:outline-none"
      aria-label={isCollapsed ? 'Expand watchlist panel' : 'Collapse watchlist panel'}
      type="button"
    >
      {isCollapsed ? (
        <ChevronsRight className="w-4 h-4 animate-pulse drop-shadow-[0_0_10px_rgba(16,185,129,0.65)]" />
      ) : (
        <ChevronsLeft className="w-4 h-4 animate-pulse drop-shadow-[0_0_10px_rgba(16,185,129,0.65)]" />
      )}
    </button>
  );

  return (
    <div className="flex-1 flex h-full bg-[#0d0d12] overflow-hidden">
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .ticker-tape-track { height: 100%; display: flex; align-items: center; overflow: hidden; }
        .ticker-tape-content { display: inline-flex; align-items: center; white-space: nowrap; animation: ticker-scroll 18s linear infinite; }
        .ticker-tape-content span { padding-right: 3rem; }
        @keyframes ticker-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      `}</style>
      
      {/* Watchlist Panel */}
      <div className={`flex flex-col border-r border-gray-800 transition-all duration-300 ${
        isCollapsed ? 'w-20' : selectedTicker ? 'w-96' : 'flex-1 max-w-xl'
      }`}>
        {/* Header */}
        <div className="border-b border-gray-800 relative">
          <div className="pr-10">
            <AnimatePresence mode="popLayout">
              {showBreakingBanner && (
                <motion.div
                  key="breaking-news-banner"
                  layout
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                  className="px-4 pt-3 pb-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <BreakingNewsBanner
                        headline={breakingNews.headline}
                        tickerSymbol={breakingNews.tickerSymbol}
                        tickerChange={breakingNews.tickerChange}
                        newsUrl={breakingNews.newsUrl}
                        isLive={breakingNews.isLive}
                        onDismiss={dismissBreakingNews}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="popLayout">
              {showTickerTape && (
                <motion.div
                  key="breaking-news-ticker"
                  layout
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
                  className="px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <TickerTape text={tickerTapeText} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!showBreakingBanner && !showTickerTape && (
              <motion.div
                layout
                className="px-3 py-2"
                animate={{ opacity: isBreakingNewsVisible ? 0.6 : 1, y: isBreakingNewsVisible ? 2 : 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            )}
          </div>
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {collapseToggle}
          </div>
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
                placeholder={activeMarket === 'crypto' ? 'Search coin or token...' : 'Search symbol or company...'}
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
                {searchResults.map((stock) => {
                  const displaySymbol = activeMarket === 'crypto'
                    ? (stock.displaySymbol || getCryptoDisplaySymbol(stock.symbol))
                    : stock.symbol;
                  const exchangeLabel = stock.exchange || (activeMarket === 'crypto' ? 'CRYPTO' : '');
                  return (
                    <div 
                      key={stock.symbol}
                      className="flex items-center justify-between px-4 py-3 hover:bg-emerald-500/10 cursor-pointer border-b border-gray-800/50 last:border-0 transition-colors"
                      onClick={() => handleAddStock(stock)}
                    >
                      <div className="flex-1">
                        <span className="text-white font-bold text-base">${displaySymbol}</span>
                        <span className="text-gray-400 text-sm ml-3">{stock.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {exchangeLabel && (
                          <span className="text-gray-500 text-xs">{exchangeLabel}</span>
                        )}
                        <Plus className="w-5 h-5 text-emerald-400" strokeWidth={2} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {searchQuery && searchResults.length === 0 && (
              <div className="absolute left-3 right-3 top-full mt-1 bg-[#111118] border border-gray-700 rounded-lg p-4 text-center text-gray-400 text-sm z-50">
                No results for "{searchQuery}"
              </div>
            )}
          </div>
        )}

        {/* Tab Switcher */}
        {!isCollapsed && (
          <div className="px-3 pb-3">
            <div className="flex items-center gap-1 p-1 rounded-lg border border-gray-700 bg-[#111118]">
              <button
                type="button"
                onClick={() => setActiveMarket('equity')}
                className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  activeMarket === 'equity'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Equity
              </button>
              <button
                type="button"
                onClick={() => setActiveMarket('crypto')}
                className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  activeMarket === 'crypto'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Crypto
              </button>
            </div>
          </div>
        )}

        {/* Stock/Crypto List */}
        <div className="flex-1 overflow-auto scrollbar-hide" style={scrollStyle}>
          {activeLoading && Object.keys(activeQuotes).length === 0 && (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span className="ml-3 text-gray-400 text-sm">Loading prices...</span>
            </div>
          )}
          
          {activeWatchlist.length === 0 && !activeLoading && (
            <div className="px-4 py-6 text-center text-gray-500 text-sm">
              Watchlist is empty. Search to add symbols.
            </div>
          )}

          {activeWatchlist.map((stock) => {
            const quote = activeQuotes[stock.symbol] || {};
            const price = quote.price || 0;
            const change = quote.change || 0;
            const changePercent = quote.changePercent || 0;
            const isPositive = change >= 0;
            const isSelected = selectedTicker === stock.symbol;
            const stockInfo = activeMarket === 'crypto'
              ? CRYPTO_DATABASE.find(s => s.symbol === stock.symbol || s.displaySymbol === stock.symbol)
              : STOCK_DATABASE.find(s => s.symbol === stock.symbol);
            const displaySymbol = activeMarket === 'crypto'
              ? (stock.displaySymbol || stockInfo?.displaySymbol || getCryptoDisplaySymbol(stock.symbol))
              : stock.symbol;
            const name = stockInfo?.name || stock.name || displaySymbol;
            
            return (
              <div 
                key={stock.symbol}
                className={`flex items-center justify-between cursor-pointer transition-all border-b border-gray-800/30 ${
                  isSelected ? 'bg-emerald-500/10 border-l-2 border-l-emerald-400' : 'hover:bg-white/5'
                } ${isCollapsed ? 'px-2 py-3' : 'px-4 py-3'}`}
                onClick={() => handleSelectSymbol(stock.symbol)}
              >
                {isCollapsed ? (
                  <div className="w-full text-center">
                    <div className="text-white text-xs font-bold">${displaySymbol}</div>
                    <div className={`text-[10px] font-medium mt-0.5 ${price > 0 ? (isPositive ? 'text-emerald-400' : 'text-red-400') : 'text-gray-500'}`}>
                      {price > 0 ? `$${formatPrice(price)}` : '...'}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="text-white font-bold text-base">${displaySymbol}</div>
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
            <span className="text-gray-400">{activeWatchlist.length} symbols</span>
            <span className={activeMarket === 'crypto' ? 'text-amber-400' : 'text-emerald-400'}>
              {activeMarket === 'crypto' ? 'Crypto Data' : 'Alpaca Data'}
            </span>
          </div>
        )}
      </div>

      {/* TradingView Chart + Trade Panel */}
      <div className="flex-1 flex flex-col bg-[#0d0d12] min-w-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <h2 className="text-white font-bold text-lg">${selectedDisplaySymbol}</h2>
            <span className="text-gray-400 text-sm">{selectedName}</span>
            <span className={`text-[10px] uppercase tracking-[0.2em] px-2 py-0.5 rounded-full border ${
              activeMarket === 'crypto'
                ? 'border-amber-500/40 text-amber-300 bg-amber-500/10'
                : 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
            }`}>
              {activeMarket === 'crypto' ? 'Crypto' : 'Equity'}
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
              key={chartSymbol}
              src={`https://s.tradingview.com/widgetembed/?frameElementId=tv_chart&symbol=${chartSymbol}&interval=D&hidesidetoolbar=1&symboledit=0&saveimage=0&toolbarbg=111118&studies=[]&theme=dark&style=1&timezone=America%2FNew_York&withdateranges=1&showpopupbutton=0&locale=en&hide_top_toolbar=0&hide_legend=0&allow_symbol_change=0`}
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
