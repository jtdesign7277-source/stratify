import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Search, Plus, X, Trash2, ChevronsLeft, ChevronsRight, Wifi, WifiOff, GripVertical, FolderPlus, ChevronRight, Folder, Pin } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import BreakingNewsBanner from './BreakingNewsBanner';
import SocialSentiment from './SocialSentiment';
import useBreakingNews from '../../hooks/useBreakingNews';
import useAlpacaStream from '../../hooks/useAlpacaStream';
import { TOP_CRYPTO_BY_MARKET_CAP } from '../../data/cryptoTop20';

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

const DEFAULT_EQUITY_WATCHLIST = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'META', name: 'Meta Platforms, Inc.' },
  { symbol: 'TSLA', name: 'Tesla, Inc.' },
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

const EASTERN_TIMEZONE = 'America/New_York';
const PRE_MARKET_START_MINUTES = 4 * 60;
const PRE_MARKET_END_MINUTES = 9 * 60 + 30;
const AFTER_HOURS_START_MINUTES = 16 * 60;
const AFTER_HOURS_END_MINUTES = 20 * 60;

const getEasternMinutes = (date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIMEZONE,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
};

const getMarketSession = () => {
  const minutes = getEasternMinutes(new Date());
  if (minutes >= PRE_MARKET_START_MINUTES && minutes < PRE_MARKET_END_MINUTES) return 'pre';
  if (minutes >= PRE_MARKET_END_MINUTES && minutes < AFTER_HOURS_START_MINUTES) return 'regular';
  if (minutes >= AFTER_HOURS_START_MINUTES && minutes < AFTER_HOURS_END_MINUTES) return 'after';
  return 'closed';
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


// TradingView Advanced Chart Widget (replaces basic iframe embed)
const TradingViewWidget = ({ symbol, interval }) => {
  const containerRef = React.useRef(null);
  React.useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: symbol,
      interval: interval,
      timezone: 'America/New_York',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: 'rgba(11, 11, 11, 1)',
      gridColor: 'rgba(30, 30, 30, 0.3)',
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      save_image: true,
      calendar: false,
      hide_volume: false,
      support_host: 'https://www.tradingview.com',
      withdateranges: true,
      details: true,
      hotlist: false,
      show_popup_button: false,
      studies: ['STD;MACD'],
    });
    containerRef.current.appendChild(script);
  }, [symbol, interval]);
  return <div ref={containerRef} className="tradingview-widget-container" style={{ height: '100%', width: '100%' }} />;
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
  const preMarketPrice = toNumber(quote.preMarketPrice);
  const preMarketChange = toNumber(quote.preMarketChange);
  const preMarketChangePercent = toNumber(quote.preMarketChangePercent);
  const afterHoursPrice = toNumber(quote.afterHoursPrice ?? quote.postMarketPrice);
  const afterHoursChange = toNumber(quote.afterHoursChange ?? quote.postMarketChange);
  const afterHoursChangePercent = toNumber(quote.afterHoursChangePercent ?? quote.postMarketChangePercent);
  return {
    price,
    change,
    changePercent,
    open: toNumber(quote.open),
    high: toNumber(quote.high),
    low: toNumber(quote.low),
    volume: toNumber(quote.volume),
    preMarketPrice,
    preMarketChange,
    preMarketChangePercent,
    afterHoursPrice,
    afterHoursChange,
    afterHoursChangePercent,
  };
};

const TradePage = ({ watchlist = [], onAddToWatchlist, onRemoveFromWatchlist, onReorderWatchlist, onPinToTop, addTrade }) => {
  const [activeMarket, setActiveMarket] = useState('equity');
  const [chartInterval, setChartInterval] = useState('D');
  const [selectedEquity, setSelectedEquity] = useState(() => {
    // Check if coming from Active trades with a symbol
    const chartSymbol = localStorage.getItem('stratify_chart_symbol');
    if (chartSymbol) {
      localStorage.removeItem('stratify_chart_symbol'); // Clear after reading
      const stock = EQUITY_LIST.find(s => s.symbol === chartSymbol);
      return stock || { symbol: chartSymbol, name: chartSymbol, exchange: 'NASDAQ' };
    }
    return null;
  });
  const [selectedCrypto, setSelectedCrypto] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  
  // Mini tabs - pinned tickers for quick access
  const [pinnedTabs, setPinnedTabs] = useState(() => {
    try {
      const saved = localStorage.getItem('stratify-pinned-tabs');
      return saved ? JSON.parse(saved) : ['NVDA', 'TSLA', 'AAPL'];
    } catch { return ['NVDA', 'TSLA', 'AAPL']; }
  });
  const [dragOverTabs, setDragOverTabs] = useState(false);
  const [marketSession, setMarketSession] = useState(getMarketSession);

  // Save pinned tabs to localStorage
  useEffect(() => {
    localStorage.setItem('stratify-pinned-tabs', JSON.stringify(pinnedTabs));
  }, [pinnedTabs]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMarketSession(getMarketSession());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const addPinnedTab = (symbol) => {
    if (!pinnedTabs.includes(symbol) && pinnedTabs.length < 5) {
      setPinnedTabs([...pinnedTabs, symbol]);
    }
  };

  const removePinnedTab = (symbol) => {
    setPinnedTabs(pinnedTabs.filter(s => s !== symbol));
  };

  const handleTabDrop = (e) => {
    e.preventDefault();
    const symbol = e.dataTransfer.getData('text/plain');
    if (symbol) addPinnedTab(symbol);
    setDragOverTabs(false);
  };

  // Watchlist states: 'open' (384px) → 'small' (280px) → 'closed' (80px) → 'open'...
  // Default to 'small' size
  const [watchlistState, setWatchlistState] = useState('small');
  
  const stateWidths = { open: 384, small: 280, closed: 80 };
  
  const cycleWatchlistState = () => {
    setWatchlistState(prev => {
      if (prev === 'open') return 'small';
      if (prev === 'small') return 'closed';
      return 'open';
    });
  };
  const [isTradePanelOpen, setIsTradePanelOpen] = useState(false);
  const [socialCollapsed, setSocialCollapsed] = useState(false);
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
  const [showDollarChange, setShowDollarChange] = useState(false); // Toggle % vs $ display
  const {
    breakingNews,
    isVisible: isBreakingNewsVisible,
    status: breakingNewsStatus,
    triggerBreakingNews,
    dismissBreakingNews,
  } = useBreakingNews();
  
  const equityStocks = useMemo(() => (
    watchlist.length > 0
      ? watchlist.map(normalizeWatchlistItem)
      : DEFAULT_EQUITY_WATCHLIST.map(normalizeWatchlistItem)
  ), [watchlist]);
  const cryptoStocks = useMemo(() => (
    cryptoWatchlist.length > 0 ? cryptoWatchlist.map(normalizeWatchlistItem) : []
  ), [cryptoWatchlist]);
  
  // Real-time WebSocket streaming from Alpaca
  const stockSymbolsForStream = useMemo(() => equityStocks.map(s => s.symbol), [equityStocks]);
  const cryptoSymbolsForStream = useMemo(() => cryptoStocks.map(s => s.symbol), [cryptoStocks]);
  
  const {
    stockQuotes: wsStockQuotes,
    cryptoQuotes: wsCryptoQuotes,
    stockConnected,
    cryptoConnected,
    isConnected: wsConnected,
    error: wsError
  } = useAlpacaStream({
    stockSymbols: stockSymbolsForStream,
    cryptoSymbols: cryptoSymbolsForStream,
    enabled: true
  });
  
  const activeWatchlist = activeMarket === 'crypto' ? cryptoStocks : equityStocks;
  const activeDatabase = activeMarket === 'crypto' ? CRYPTO_DATABASE : STOCK_DATABASE;
  const defaultEquitySymbol = equityStocks.find(s => s.symbol === 'NVDA')?.symbol || equityStocks[0]?.symbol || 'NVDA';
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

  // Fetch quote snapshot via Railway backend
  const fetchSnapshot = useCallback(async () => {
    try {
      const symbols = equityStocks.map(s => s.symbol).join(',');
      const res = await fetch('/api/stocks?symbols=' + symbols);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('Snapshot fetch error:', err);
      return [];
    }
  }, [equityStocks]);

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

  // Merge WebSocket data with polling data for equity quotes
  useEffect(() => {
    if (Object.keys(wsStockQuotes).length > 0) {
      setEquityQuotes(prev => {
        const merged = { ...prev };
        Object.entries(wsStockQuotes).forEach(([symbol, wsQuote]) => {
          if (wsQuote.price) {
            merged[symbol] = {
              ...prev[symbol],
              ...wsQuote,
              // Keep previous day data if we have it
              prevClose: prev[symbol]?.prevClose || wsQuote.prevClose,
              change: wsQuote.price - (prev[symbol]?.prevClose || wsQuote.price),
              changePercent: prev[symbol]?.prevClose 
                ? ((wsQuote.price - prev[symbol].prevClose) / prev[symbol].prevClose) * 100 
                : prev[symbol]?.changePercent || 0
            };
          }
        });
        return merged;
      });
      setEquityLoading(false);
    }
  }, [wsStockQuotes]);

  // Merge WebSocket data with polling data for crypto quotes
  useEffect(() => {
    if (Object.keys(wsCryptoQuotes).length > 0) {
      setCryptoQuotes(prev => {
        const merged = { ...prev };
        Object.entries(wsCryptoQuotes).forEach(([symbol, wsQuote]) => {
          if (wsQuote.price) {
            merged[symbol] = {
              ...prev[symbol],
              ...wsQuote,
              prevClose: prev[symbol]?.prevClose || wsQuote.prevClose,
              change: wsQuote.price - (prev[symbol]?.prevClose || wsQuote.price),
              changePercent: prev[symbol]?.prevClose 
                ? ((wsQuote.price - prev[symbol].prevClose) / prev[symbol].prevClose) * 100 
                : prev[symbol]?.changePercent || 0
            };
          }
        });
        return merged;
      });
      setCryptoLoading(false);
    }
  }, [wsCryptoQuotes]);

  // Fallback polling for equity quotes (runs on initial load and as backup)
  useEffect(() => {
    const fetchEquityQuotes = async () => {
      // Only show loading on initial fetch
      if (Object.keys(equityQuotes).length === 0) {
        setEquityLoading(true);
      }
      const results = {};
      const snapshotData = await fetchSnapshot();
      const snapshotsBySymbol = {};
      snapshotData.forEach((item) => {
        if (item?.symbol) {
          snapshotsBySymbol[item.symbol] = item;
        }
      });
      equityStocks.forEach((stock) => {
        const quote = buildQuote(snapshotsBySymbol[stock.symbol]);
        if (quote && quote.price) {
          results[stock.symbol] = quote;
        }
      });
      setEquityQuotes(prev => ({ ...prev, ...results }));
      setEquityLoading(false);
    };

    fetchEquityQuotes();
    // Poll less frequently when WebSocket is connected (60s vs 10s)
    const pollInterval = stockConnected ? 60000 : 10000;
    const interval = setInterval(fetchEquityQuotes, pollInterval);
    return () => clearInterval(interval);
  }, [equitySymbolsKey, fetchSnapshot, stockConnected]);

  // Fallback polling for crypto quotes (runs on initial load and as backup)
  useEffect(() => {
    const fetchCryptoQuotes = async () => {
      if (Object.keys(cryptoQuotes).length === 0) {
        setCryptoLoading(true);
      }
      const results = {};
      await Promise.all(
        cryptoStocks.map(async (stock) => {
          const quote = await fetchCryptoQuote(stock.symbol);
          if (quote && quote.price) {
            results[stock.symbol] = quote;
          }
        })
      );
      setCryptoQuotes(prev => ({ ...prev, ...results }));
      setCryptoLoading(false);
    };

    fetchCryptoQuotes();
    // Poll less frequently when WebSocket is connected
    const pollInterval = cryptoConnected ? 60000 : 10000;
    const interval = setInterval(fetchCryptoQuotes, pollInterval);
    return () => clearInterval(interval);
  }, [cryptoSymbolsKey, fetchCryptoQuote, cryptoConnected]);

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
        // Add new tickers to TOP of list (prepend)
        return [normalizedStock, ...prev];
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

  // Handle drag & drop reordering
  const handleDragEnd = useCallback((result) => {
    if (!result.destination) return;
    
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;
    
    if (sourceIndex === destIndex) return;
    
    if (activeMarket === 'crypto') {
      setCryptoWatchlist(prev => {
        const reordered = Array.from(prev);
        const [removed] = reordered.splice(sourceIndex, 1);
        reordered.splice(destIndex, 0, removed);
        return reordered;
      });
    } else if (onReorderWatchlist) {
      onReorderWatchlist(sourceIndex, destIndex);
    }
  }, [activeMarket, onReorderWatchlist]);

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
      const payload = await res.json();
      const candidatePrice = toNumber(payload?.filled_avg_price ?? payload?.estimatedPrice ?? selectedQuote?.price);
      const executionPrice = Number.isFinite(candidatePrice) && candidatePrice > 0 ? candidatePrice : null;
      const executedAt = payload?.filled_at ?? payload?.submitted_at ?? new Date().toISOString();
      const recordedTrade = executionPrice && typeof addTrade === 'function'
        ? addTrade({
          symbol: selectedTicker,
          shares: orderQtyNumber,
          side: orderSide,
          price: executionPrice,
          timestamp: executedAt,
        })
        : null;
      setOrderStatus({
        state: 'success',
        message: 'Order placed successfully.',
        executedAt: recordedTrade?.timestamp ?? executedAt,
        symbol: selectedDisplaySymbol,
        price: recordedTrade?.price ?? executionPrice ?? selectedQuote?.price,
        qty: orderQtyNumber,
        side: orderSide,
      });
    } catch (err) {
      setOrderStatus({ state: 'error', message: err?.message || 'Order failed.' });
    }
  };

  const formatPrice = (price) => {
    if (!price || price === 0) return '...';
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatSignedPercent = (value) => {
    if (!Number.isFinite(value)) return null;
    return `${value >= 0 ? '+' : ''}${Number(value).toFixed(2)}%`;
  };

  const formatOrderSide = (side) => {
    if (!side) return '';
    return `${side.charAt(0).toUpperCase()}${side.slice(1)}`;
  };

  const formatExecutionTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const timeZone = 'America/New_York';
    const datePart = date.toLocaleDateString('en-US', {
      timeZone,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    const timePart = date.toLocaleTimeString('en-US', {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    });
    return `${datePart} · ${timePart}`;
  };

  const formatExecutionPrice = (price) => {
    if (!Number.isFinite(price)) return '...';
    return `$${formatPrice(price)}`;
  };

  const getChangeColor = (value) => {
    if (value > 0) return 'text-emerald-400';
    if (value < 0) return 'text-red-400';
    return 'text-white/50';
  };

  const scrollStyle = { scrollbarWidth: 'none', msOverflowStyle: 'none' };
  const showBreakingBanner = watchlistState !== 'closed' && isBreakingNewsVisible && breakingNews;
  // Ticker tape removed per user request
  const collapseToggle = (
    <button
      onClick={cycleWatchlistState}
      className="p-1 hover:bg-gray-800 rounded transition-colors focus:outline-none"
      aria-label="Resize watchlist"
      type="button"
    >
      <ChevronsLeft 
        className={`w-5 h-5 transition-all duration-200 ${
          watchlistState !== 'closed' 
            ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.7)]' 
            : 'text-gray-600'
        }`}
      />
    </button>
  );

  return (
    <div className="flex-1 flex h-full bg-[#0b0b0b] overflow-hidden">
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .ticker-tape-track { height: 100%; display: flex; align-items: center; overflow: hidden; }
        .ticker-tape-content { display: inline-flex; align-items: center; white-space: nowrap; animation: ticker-scroll 18s linear infinite; }
        .ticker-tape-content span { padding-right: 3rem; }
        @keyframes ticker-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      `}</style>
      
      {/* Watchlist Panel */}
      <div 
        className="flex flex-col border-r border-[#1f1f1f] flex-shrink-0 transition-all duration-300 ease-out"
        style={{ width: stateWidths[watchlistState] }}
      >
        {/* Header */}
        <div className="border-b border-[#1f1f1f] relative">
          {/* Mini Tabs - Drag tickers here */}
          <div 
            className={`flex-1 px-2 py-2 flex items-center gap-1 overflow-x-auto scrollbar-hide ${
              dragOverTabs ? 'bg-emerald-500/10 border-emerald-500/30' : ''
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOverTabs(true); }}
            onDragLeave={() => setDragOverTabs(false)}
            onDrop={handleTabDrop}
          >
            {pinnedTabs.map((symbol) => (
              <button
                key={symbol}
                onClick={() => {
                  if (activeMarket === 'crypto') setSelectedCrypto(symbol);
                  else setSelectedEquity(symbol);
                }}
                className={`group flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all ${
                  selectedTicker === symbol
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-gray-800 text-gray-400 border border-[#2a2a2a] hover:border-gray-600 hover:text-white'
                }`}
              >
                <span>{symbol}</span>
                <X 
                  className="w-3 h-3 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                  onClick={(e) => { e.stopPropagation(); removePinnedTab(symbol); }}
                />
              </button>
            ))}
            {pinnedTabs.length < 5 && (
              <div className={`px-2 py-1 rounded border border-dashed text-xs transition-colors ${
                dragOverTabs 
                  ? 'border-emerald-500 text-emerald-400' 
                  : 'border-[#2a2a2a] text-gray-600'
              }`}>
                {dragOverTabs ? 'Drop here' : '+ Drag'}
              </div>
            )}
            {/* Spacer for collapse button */}
            <div className="w-8 flex-shrink-0" />
          </div>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
            {collapseToggle}
          </div>
        </div>

        {/* Search */}
        {watchlistState !== 'closed' && (
          <div className="p-3 border-b border-[#1f1f1f] relative">
            <div className="flex items-center gap-2 bg-[#111111] border border-[#2a2a2a] rounded-lg px-3 py-2.5">
              <Search className="w-4 h-4 text-white/50" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeMarket === 'crypto' ? 'Search coin or token...' : 'Search symbol or company...'}
                className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-white/50 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {searchQuery && searchResults.length > 0 && (
              <div className="absolute left-3 right-3 top-full mt-1 bg-[#111111] border border-[#2a2a2a] rounded-lg overflow-hidden shadow-2xl z-50 max-h-96 overflow-y-auto scrollbar-hide" style={scrollStyle}>
                {searchResults.map((stock) => {
                  const displaySymbol = activeMarket === 'crypto'
                    ? (stock.displaySymbol || getCryptoDisplaySymbol(stock.symbol))
                    : stock.symbol;
                  const exchangeLabel = stock.exchange || (activeMarket === 'crypto' ? 'CRYPTO' : '');
                  return (
                    <div 
                      key={stock.symbol}
                      className="flex items-center justify-between px-4 py-3 hover:bg-emerald-500/10 cursor-pointer border-b border-[#1f1f1f]/50 last:border-0 transition-colors"
                      onClick={() => handleAddStock(stock)}
                    >
                      <div className="flex-1">
                        <span className="text-white font-bold text-base">${displaySymbol}</span>
                        <span className="text-gray-400 text-sm ml-3">{stock.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {exchangeLabel && (
                          <span className="text-white/50 text-xs">{exchangeLabel}</span>
                        )}
                        <Plus className="w-5 h-5 text-emerald-400" strokeWidth={2} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {searchQuery && searchResults.length === 0 && (
              <div className="absolute left-3 right-3 top-full mt-1 bg-[#111111] border border-[#2a2a2a] rounded-lg p-4 text-center text-gray-400 text-sm z-50">
                No results for "{searchQuery}"
              </div>
            )}
          </div>
        )}

        {/* Tab Switcher */}
        {watchlistState !== 'closed' && (
          <div className="px-3 pb-3">
            <div className="flex items-center gap-1 p-1 rounded-lg border border-[#2a2a2a] bg-[#111111]">
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
            {/* WebSocket Connection Status */}
            <div className="flex items-center justify-center gap-2 mt-2 text-[10px]">
              {(activeMarket === 'equity' ? stockConnected : cryptoConnected) ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-emerald-400 font-medium">LIVE STREAMING</span>
                </>
              ) : (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-gray-500"></span>
                  </span>
                  <span className="text-gray-500 font-medium">POLLING (10s)</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Stock/Crypto List with Drag & Drop */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="watchlist">
            {(provided, snapshot) => (
              <div 
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex-1 overflow-auto scrollbar-hide" 
                style={scrollStyle}
              >
                {activeLoading && Object.keys(activeQuotes).length === 0 && (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <span className="ml-3 text-gray-400 text-sm">Loading prices...</span>
                  </div>
                )}
                
                {activeWatchlist.length === 0 && !activeLoading && (
                  <div className="px-4 py-6 text-center text-white/50 text-sm">
                    Watchlist is empty. Search to add symbols.
                  </div>
                )}

                {activeWatchlist.map((stock, index) => {
                  const quote = activeQuotes[stock.symbol] || {};
                  const price = quote.price || 0;
                  const change = quote.change || 0;
                  const changePercent = quote.changePercent || 0;
                  const preMarketPrice = quote.preMarketPrice;
                  const preMarketChange = quote.preMarketChange;
                  const preMarketChangePercent = quote.preMarketChangePercent;
                  const afterHoursPrice = quote.afterHoursPrice;
                  const afterHoursChange = quote.afterHoursChange;
                  const afterHoursChangePercent = quote.afterHoursChangePercent;
                  const isPositive = changePercent !== 0 ? changePercent >= 0 : change >= 0;
                  const isSelected = selectedTicker === stock.symbol;
                  const stockInfo = activeMarket === 'crypto'
                    ? CRYPTO_DATABASE.find(s => s.symbol === stock.symbol || s.displaySymbol === stock.symbol)
                    : STOCK_DATABASE.find(s => s.symbol === stock.symbol);
                  const displaySymbol = activeMarket === 'crypto'
                    ? (stock.displaySymbol || stockInfo?.displaySymbol || getCryptoDisplaySymbol(stock.symbol))
                    : stock.symbol;
                  const name = stockInfo?.name || stock.name || displaySymbol;
                  const isExtendedHours = marketSession === 'pre' || marketSession === 'after' || marketSession === 'closed';
                  const showPreMarket = activeMarket === 'equity' && (marketSession === 'pre' || marketSession === 'closed') && Number.isFinite(preMarketPrice) && preMarketPrice > 0;
                  const showAfterHours = activeMarket === 'equity' && (marketSession === 'after' || marketSession === 'closed') && Number.isFinite(afterHoursPrice) && afterHoursPrice > 0;
                  const preMarketPercentLabel = formatSignedPercent(preMarketChangePercent);
                  const afterHoursPercentLabel = formatSignedPercent(afterHoursChangePercent);
                  
                  return (
                    <Draggable key={stock.symbol} draggableId={stock.symbol} index={index}>
                      {(provided, snapshot) => (
                        <div 
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          draggable="true"
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', stock.symbol);
                            e.dataTransfer.effectAllowed = 'copy';
                          }}
                          className={`flex items-center justify-between cursor-pointer transition-all border-b border-[#1f1f1f]/30 ${
                            isSelected ? 'bg-emerald-500/10 border-l-2 border-l-emerald-400' : 'hover:bg-white/5'
                          } ${watchlistState === 'closed' ? 'px-2 py-3' : 'px-4 py-3'} ${
                            snapshot.isDragging ? 'bg-[#1a1a1a] shadow-lg ring-1 ring-emerald-500/40' : ''
                          }`}
                          onClick={() => handleSelectSymbol(stock.symbol)}
                        >
                          {watchlistState === 'closed' ? (
                            <div className="w-full text-center">
                              <div className="text-white text-xs font-bold">${displaySymbol}</div>
                              <div className={`text-[10px] font-medium mt-0.5 ${price > 0 ? (isPositive ? 'text-emerald-400' : 'text-red-400') : 'text-white/50'}`}>
                                {price > 0 ? `$${formatPrice(price)}` : '...'}
                              </div>
                            </div>
                          ) : (
                            <>
                              {/* Drag Handle */}
                              <div 
                                {...provided.dragHandleProps}
                                className="mr-2 text-gray-600 hover:text-gray-400 cursor-grab active:cursor-grabbing"
                              >
                                <GripVertical className="w-4 h-4" />
                              </div>

                              <div className="flex-1 min-w-0 pr-4">
                                <div className="text-white font-bold text-base">${displaySymbol}</div>
                                <div className="text-white/50 text-sm truncate">{name}</div>
                              </div>

                              <div className="text-right flex-shrink-0 mr-3">
                                <div className="text-white font-semibold text-base font-mono">
                                  {price > 0 ? `$${formatPrice(price)}` : '...'}
                                </div>
                                {price > 0 && (
                                  <div className="flex flex-col items-end gap-1">
                                    <span 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowDollarChange(!showDollarChange);
                                      }}
                                      className={`px-2 py-0.5 rounded text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity ${isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}
                                    >
                                      {showDollarChange 
                                        ? `${isPositive ? '+' : ''}$${Math.abs(change).toFixed(2)}`
                                        : `${isPositive ? '+' : ''}${changePercent.toFixed(2)}%`
                                      }
                                    </span>
                                    {showPreMarket && (
                                      <span 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowDollarChange(!showDollarChange);
                                        }}
                                        className="text-xs font-semibold text-blue-400 flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                                      >
                                        <span className="text-yellow-400">☀️</span>
                                        {showDollarChange 
                                          ? `${preMarketChange >= 0 ? '+' : ''}$${Math.abs(preMarketChange || 0).toFixed(2)}`
                                          : preMarketPercentLabel
                                        }
                                      </span>
                                    )}
                                    {showAfterHours && (
                                      <span 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowDollarChange(!showDollarChange);
                                        }}
                                        className="text-xs font-semibold text-blue-400 flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                                      >
                                        <span className="text-purple-400">🌙</span>
                                        {showDollarChange 
                                          ? `${afterHoursChange >= 0 ? '+' : ''}$${Math.abs(afterHoursChange || 0).toFixed(2)}`
                                          : afterHoursPercentLabel
                                        }
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Pin to Mini Pill - Double-click for top pills, drag for local pills */}
                              <div
                                draggable="true"
                                onDragStart={(e) => {
                                  e.stopPropagation();
                                  e.dataTransfer.setData('text/plain', stock.symbol);
                                  e.dataTransfer.effectAllowed = 'copy';
                                }}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  if (onPinToTop) onPinToTop(stock.symbol);
                                }}
                                className="p-2 hover:bg-emerald-500/20 rounded-lg transition-colors text-gray-600 hover:text-emerald-400 cursor-grab active:cursor-grabbing"
                                title="Double-click to pin to top • Drag to local pills"
                              >
                                <Pin className="w-4 h-4" strokeWidth={1.5} />
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
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {/* Footer */}
        {watchlistState !== 'closed' && (
          <div className="p-3 border-t border-[#1f1f1f] flex items-center justify-between text-xs">
            <span className="text-gray-400">{activeWatchlist.length} symbols</span>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
              <span className={activeMarket === 'crypto' ? 'text-amber-400' : 'text-emerald-400'}>Alpaca</span>
            </div>
          </div>
        )}
      </div>

      {/* TradingView Chart + Trade Panel */}
      <div className="flex-1 flex flex-col bg-[#0b0b0b] min-w-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f1f1f]">
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
            <div className="flex items-center gap-1 rounded-lg bg-[#111111] border border-[#1f1f1f] p-1">
              {['1', '5', '15', '30', '60', 'D', 'W', 'M'].map((interval) => (
                <button
                  key={interval}
                  onClick={() => setChartInterval(interval)}
                  className={`px-2 py-1 text-[11px] font-semibold rounded-md transition-colors ${
                    chartInterval === interval
                      ? 'bg-[#1a1a1a] text-white'
                      : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
                  }`}
                  aria-pressed={chartInterval === interval}
                >
                  {interval}
                </button>
              ))}
            </div>
            {!isTradePanelOpen && (
              <button
                onClick={() => setIsTradePanelOpen(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#111111] border border-[#2a2a2a] text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
              >
                Trade
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 min-h-0 flex flex-col xl:flex-row">
          <div className="flex-1 min-h-[360px] relative">
            <TradingViewWidget symbol={chartSymbol} interval={chartInterval} />
          </div>

          <div className={`border-t xl:border-t-0 xl:border-l border-white/[0.06] bg-[#0b0b0b] p-1.5 min-h-0 transition-all duration-300 ${
            socialCollapsed ? 'w-full xl:w-14' : 'w-full xl:w-80'
          }`}>
            <div className="h-[360px] xl:h-full min-h-0">
              <SocialSentiment activeTicker={selectedDisplaySymbol} onCollapseChange={setSocialCollapsed} />
            </div>
          </div>

          <div
            className={`bg-[#0b0b0b] overflow-hidden backdrop-blur-xl transition-[opacity,transform,max-height] duration-500 ease-out ${
              isTradePanelOpen
                ? 'opacity-100 max-h-[1000px] border-t xl:border-t-0 xl:border-l border-white/[0.06] w-full xl:w-80'
                : 'opacity-0 max-h-0 xl:max-h-none border-transparent w-full xl:w-0 pointer-events-none translate-y-2 xl:translate-y-0 xl:translate-x-3'
            }`}
          >
            <div className="p-4 border-b border-white/[0.06] flex items-start justify-between gap-3 bg-white/[0.02] backdrop-blur-xl">
              <div className="min-w-0">
                <h3 className="text-white/90 font-semibold text-base truncate">
                  <span className="text-emerald-400">{selectedDisplaySymbol}</span>
                  <span className="text-white/60"> — </span>
                  <span className="text-white/80">{selectedName}</span>
                </h3>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <span className="text-white/40">Live</span>
                  <span className="text-white/90 font-semibold">
                    {selectedQuote?.price ? `$${formatPrice(selectedQuote.price)}` : '—'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsTradePanelOpen(false)}
                className="p-1.5 rounded-lg text-white/40 hover:text-white/90 hover:bg-white/[0.08] transition-colors"
                aria-label="Collapse trade panel"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOrderSide('buy')}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${
                    orderSide === 'buy'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40 shadow-[0_0_18px_rgba(52,211,153,0.35)]'
                      : 'bg-white/[0.03] text-white/60 border-white/[0.06] hover:text-white/90 hover:border-white/[0.2]'
                  }`}
                >
                  Buy
                </button>
                <button
                  onClick={() => setOrderSide('sell')}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${
                    orderSide === 'sell'
                      ? 'bg-red-500/20 text-red-300 border-red-400/40 shadow-[0_0_18px_rgba(248,113,113,0.35)]'
                      : 'bg-white/[0.03] text-white/60 border-white/[0.06] hover:text-white/90 hover:border-white/[0.2]'
                  }`}
                >
                  Sell
                </button>
              </div>

              <div>
                <label className="text-xs text-white/40">Quantity</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={orderQty}
                  onChange={(e) => setOrderQty(e.target.value)}
                  className="mt-1 w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-white/90 text-sm outline-none transition-colors focus:border-emerald-400/60 focus:ring-1 focus:ring-emerald-400/20"
                />
              </div>

              <div>
                <label className="text-xs text-white/40">Order Type</label>
                <select
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value)}
                  className="mt-1 w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-white/90 text-sm outline-none transition-colors focus:border-emerald-400/60 focus:ring-1 focus:ring-emerald-400/20"
                >
                  <option value="market">Market</option>
                  <option value="limit">Limit</option>
                </select>
              </div>

              <div className="rounded-lg border border-white/[0.08] bg-white/[0.04] p-3 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
                <div className="flex items-center justify-between text-xs text-white/40">
                  <span>Est. Total</span>
                  <span className="text-white/90 font-semibold">
                    {estimatedTotal > 0 ? `$${formatPrice(estimatedTotal)}` : '...'}
                  </span>
                </div>
                <div className="text-[11px] text-white/40 mt-2">
                  Based on {selectedQuote?.price ? `$${formatPrice(selectedQuote.price)}` : 'current'} price.
                </div>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={!selectedTicker || orderQtyNumber <= 0 || orderStatus.state === 'submitting'}
                className={`w-full py-2.5 rounded-lg text-sm font-semibold text-white/90 transition-all ${
                  orderSide === 'buy'
                    ? 'bg-gradient-to-r from-emerald-500/80 to-emerald-600/80 hover:shadow-[0_0_24px_rgba(52,211,153,0.45)]'
                    : 'bg-gradient-to-r from-red-500/80 to-red-600/80 hover:shadow-[0_0_24px_rgba(248,113,113,0.45)]'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {orderStatus.state === 'submitting' ? 'Placing Order...' : 'Place Order'}
              </button>

              {orderStatus.state !== 'idle' && (
                orderStatus.state === 'success' ? (
                  <div className="text-xs space-y-1">
                    <div className="text-emerald-400">{orderStatus.message}</div>
                    <div className="text-white/60">
                      {orderStatus.symbol} · {formatOrderSide(orderStatus.side)} {orderStatus.qty} @ {formatExecutionPrice(orderStatus.price)}
                    </div>
                    {orderStatus.executedAt && (
                      <div className="text-white/40">
                        {formatExecutionTimestamp(orderStatus.executedAt)}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-red-400">
                    {orderStatus.message}
                  </div>
                )
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
