import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Globe,
  Plus,
  Search,
  Loader2,
  TrendingDown,
  TrendingUp,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import useAlpacaStream from '../../hooks/useAlpacaStream';
import useTwelveData from '../../hooks/useTwelveData';
import { useMarketData } from '../../store/StratifyProvider';

const ETF_SYMBOLS = ['SPY', 'QQQ', 'DIA', 'IWM', 'GLD'];
const TRENDING_SYMBOLS = ['NVDA', 'TSLA', 'META', 'AAPL', 'AMZN', 'MSFT'];
const CRYPTO_SYMBOLS = ['BTC-USD', 'ETH-USD', 'SOL-USD', 'XRP-USD', 'DOGE-USD'];
const STREAM_STOCK_SYMBOLS = [...new Set([...ETF_SYMBOLS, ...TRENDING_SYMBOLS])];

const ETF_NAMES = {
  SPY: 'S&P 500',
  QQQ: 'Nasdaq 100',
  DIA: 'Dow Jones',
  IWM: 'Russell 2000',
  GLD: 'Gold Trust',
};

const TRENDING_NAMES = {
  NVDA: 'NVIDIA',
  TSLA: 'Tesla',
  META: 'Meta Platforms',
  AAPL: 'Apple',
  AMZN: 'Amazon',
  MSFT: 'Microsoft',
};

const CRYPTO_NAMES = {
  'BTC-USD': 'Bitcoin',
  'ETH-USD': 'Ethereum',
  'SOL-USD': 'Solana',
  'XRP-USD': 'XRP',
  'DOGE-USD': 'Dogecoin',
};

const SECTORS = [
  { name: 'Technology', symbol: 'XLK', changePercent: 1.45 },
  { name: 'Healthcare', symbol: 'XLV', changePercent: -0.32 },
  { name: 'Financials', symbol: 'XLF', changePercent: 0.87 },
  { name: 'Energy', symbol: 'XLE', changePercent: 2.13 },
  { name: 'Consumer', symbol: 'XLY', changePercent: -0.54 },
  { name: 'Industrials', symbol: 'XLI', changePercent: 0.23 },
];

const LSE_STORAGE_KEY = 'stratify-markets-lse-watchlist';
const LSE_LIST_LIMIT = 350;
const DEFAULT_LSE_SYMBOLS = ['SHEL', 'AZN', 'HSBA', 'BP', 'BARC', 'LLOY'];
const LSE_DEFAULT_NAMES = {
  SHEL: 'Shell plc',
  AZN: 'AstraZeneca plc',
  HSBA: 'HSBC Holdings plc',
  BP: 'BP plc',
  BARC: 'Barclays plc',
  LLOY: 'Lloyds Banking Group',
  RIO: 'Rio Tinto plc',
  GSK: 'GSK plc',
  VOD: 'Vodafone Group plc',
  ULVR: 'Unilever plc',
  LSEG: 'London Stock Exchange Group',
  BATS: 'British American Tobacco',
};

const isFiniteNumber = (value) => Number.isFinite(Number(value));
const toNumber = (value) => {
  if (typeof value === 'number') return value;
  if (value == null) return NaN;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const getPriceFromQuote = (quote) => {
  const candidates = [
    quote?.price,
    quote?.lastTrade,
    quote?.ask,
    quote?.bid,
    quote?.askPrice,
    quote?.bidPrice,
  ];
  for (const candidate of candidates) {
    const num = Number(candidate);
    if (Number.isFinite(num)) return num;
  }
  return null;
};

const createEntry = (symbol, name) => ({
  symbol,
  name,
  price: null,
  baseline: null,
  changePercent: 0,
  ticks: [],
  updatedAt: null,
});

const formatSignedPercent = (value) => {
  if (!isFiniteNumber(value)) return '--';
  const numeric = Number(value);
  return `${numeric >= 0 ? '+' : ''}${numeric.toFixed(2)}%`;
};

const formatPrice = (price, isCrypto = false) => {
  if (!isFiniteNumber(price)) return '--';

  const numeric = Number(price);
  if (isCrypto) {
    const decimals = numeric >= 1000 ? 2 : numeric >= 1 ? 3 : 5;
    return `$${numeric.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  }

  return `$${numeric.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const parseStockSnapshot = (quote) => {
  if (!quote) return null;

  const price = toNumber(quote.price ?? quote.latestPrice ?? quote.last ?? quote.lastPrice);
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

  return { price, changePercent, prevClose: fallbackPrevClose };
};

const toSafeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

const normalizeCryptoStateSymbol = (symbol) => {
  const normalized = String(symbol || '')
    .trim()
    .toUpperCase()
    .replace(/_/g, '-')
    .replace(/\//g, '-');

  if (!normalized) return '';
  if (CRYPTO_SYMBOLS.includes(normalized)) return normalized;

  const compact = normalized.replace(/-/g, '');
  const compactMatch = compact.match(/^([A-Z0-9]+)(USD|USDT|USDC)$/);
  if (!compactMatch) return normalized;

  const candidate = `${compactMatch[1]}-${compactMatch[2]}`;
  return CRYPTO_SYMBOLS.includes(candidate) ? candidate : candidate;
};

const normalizeLseSymbol = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^\$/, '')
    .split(':')[0]
    .split('.')[0];

const dedupeLseSymbols = (symbols = []) => {
  const seen = new Set();
  return symbols
    .map(normalizeLseSymbol)
    .filter((symbol) => {
      if (!symbol || seen.has(symbol)) return false;
      seen.add(symbol);
      return true;
    });
};

const loadStoredLseSymbols = () => {
  if (typeof window === 'undefined') return DEFAULT_LSE_SYMBOLS;
  try {
    const raw = localStorage.getItem(LSE_STORAGE_KEY);
    if (!raw) return DEFAULT_LSE_SYMBOLS;
    const parsed = JSON.parse(raw);
    const cleaned = dedupeLseSymbols(Array.isArray(parsed) ? parsed : []);
    return cleaned.length > 0 ? cleaned : DEFAULT_LSE_SYMBOLS;
  } catch {
    return DEFAULT_LSE_SYMBOLS;
  }
};

const formatLsePrice = (price) => {
  if (!isFiniteNumber(price)) return '--';
  return `£${Number(price).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const getLatestTimestampDate = (stateMap) => {
  const latest = Object.values(stateMap)
    .map((item) => toSafeDate(item?.updatedAt))
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime())
    .pop();

  return latest || null;
};

const MarketsPage = () => {
  const { prices: marketPrices, connected: marketDataConnected } = useMarketData();

  const [stockState, setStockState] = useState(() =>
    STREAM_STOCK_SYMBOLS.reduce((acc, symbol) => {
      acc[symbol] = createEntry(symbol, ETF_NAMES[symbol] || TRENDING_NAMES[symbol] || symbol);
      return acc;
    }, {})
  );

  const [cryptoState, setCryptoState] = useState(() =>
    CRYPTO_SYMBOLS.reduce((acc, symbol) => {
      acc[symbol] = createEntry(symbol, CRYPTO_NAMES[symbol] || symbol);
      return acc;
    }, {})
  );
  const [lseSymbols, setLseSymbols] = useState(loadStoredLseSymbols);
  const [lsePickerOpen, setLsePickerOpen] = useState(false);
  const [lseSearchQuery, setLseSearchQuery] = useState('');
  const [lseSearchLoading, setLseSearchLoading] = useState(false);
  const [lseSearchError, setLseSearchError] = useState(null);
  const [lseSearchResults, setLseSearchResults] = useState([]);

  const {
    cryptoQuotes,
    cryptoConnected,
    error,
    reconnectCrypto,
  } = useAlpacaStream({
    stockSymbols: [],
    cryptoSymbols: CRYPTO_SYMBOLS,
    enabled: true,
  });

  const lseLabelsBySymbol = useMemo(() => {
    const mapping = { ...LSE_DEFAULT_NAMES };
    lseSearchResults.forEach((item) => {
      const symbol = normalizeLseSymbol(item?.symbol);
      if (!symbol) return;
      mapping[symbol] = item?.instrumentName || item?.name || mapping[symbol] || symbol;
    });
    return mapping;
  }, [lseSearchResults]);

  const {
    quoteList: lseQuoteList,
    status: lseStatus,
    error: lseError,
    loadingQuotes: lseQuotesLoading,
  } = useTwelveData({
    symbols: lseSymbols,
    labelsBySymbol: lseLabelsBySymbol,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LSE_STORAGE_KEY, JSON.stringify(lseSymbols));
  }, [lseSymbols]);

  const searchLseUniverse = useCallback(async (query = '') => {
    setLseSearchLoading(true);
    setLseSearchError(null);
    try {
      const params = new URLSearchParams({ limit: String(LSE_LIST_LIMIT) });
      const trimmed = String(query || '').trim();
      if (trimmed) params.set('q', trimmed);

      const response = await fetch(`/api/lse/list?${params.toString()}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Failed to search London stocks');

      const rows = Array.isArray(payload?.data) ? payload.data : [];
      setLseSearchResults(rows);
    } catch (searchError) {
      setLseSearchResults([]);
      setLseSearchError(searchError?.message || 'Failed to search London stocks');
    } finally {
      setLseSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!lsePickerOpen) return undefined;

    const timer = setTimeout(() => {
      searchLseUniverse(lseSearchQuery);
    }, 200);

    return () => clearTimeout(timer);
  }, [lsePickerOpen, lseSearchQuery, searchLseUniverse]);

  const addLseSymbol = useCallback((symbol) => {
    const normalized = normalizeLseSymbol(symbol);
    if (!normalized) return;

    setLseSymbols((prev) => {
      if (prev.includes(normalized)) return prev;
      return [...prev, normalized];
    });
  }, []);

  const removeLseSymbol = useCallback((symbol) => {
    const normalized = normalizeLseSymbol(symbol);
    if (!normalized) return;

    setLseSymbols((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((item) => item !== normalized);
    });
  }, []);

  const fetchEquitySnapshots = useCallback(async () => {
    try {
      const symbols = STREAM_STOCK_SYMBOLS.join(',');
      const response = await fetch(`/api/stocks?symbols=${encodeURIComponent(symbols)}`, {
        cache: 'no-store',
      });
      if (!response.ok) return [];
      const payload = await response.json();
      return Array.isArray(payload) ? payload : [];
    } catch (fetchError) {
      console.error('[MarketsPage] Equity snapshot fetch error:', fetchError);
      return [];
    }
  }, []);

  useEffect(() => {
    if (!marketPrices || typeof marketPrices.get !== 'function') return;

    const updates = STREAM_STOCK_SYMBOLS
      .map((symbol) => [symbol, marketPrices.get(symbol)])
      .filter(([, quote]) => quote && typeof quote === 'object');

    if (updates.length === 0) return;

    setStockState((prev) => {
      const next = { ...prev };
      updates.forEach(([symbol, quote]) => {
        const price = getPriceFromQuote(quote);
        if (!Number.isFinite(price)) return;

        const current = next[symbol] || createEntry(symbol, ETF_NAMES[symbol] || TRENDING_NAMES[symbol] || symbol);
        const baseline = Number.isFinite(current.baseline) ? current.baseline : price;
        const changePercent = baseline ? ((price - baseline) / baseline) * 100 : 0;

        next[symbol] = {
          ...current,
          price,
          baseline,
          changePercent,
          ticks: [...current.ticks, price].slice(-30),
          updatedAt: quote?.timestamp || quote?.t || new Date().toISOString(),
        };
      });
      return next;
    });
  }, [marketPrices]);

  useEffect(() => {
    const applySnapshot = async () => {
      const snapshotData = await fetchEquitySnapshots();
      if (!Array.isArray(snapshotData) || snapshotData.length === 0) return;

      const snapshotsBySymbol = {};
      snapshotData.forEach((item) => {
        if (item?.symbol) snapshotsBySymbol[item.symbol] = item;
      });

      setStockState((prev) => {
        const next = { ...prev };

        STREAM_STOCK_SYMBOLS.forEach((symbol) => {
          const parsed = parseStockSnapshot(snapshotsBySymbol[symbol]);
          if (!parsed) return;

          const current = next[symbol] || createEntry(symbol, ETF_NAMES[symbol] || TRENDING_NAMES[symbol] || symbol);
          const baseline = Number.isFinite(current.baseline) ? current.baseline : parsed.prevClose || parsed.price;
          const fallbackChangePercent = baseline ? ((parsed.price - baseline) / baseline) * 100 : 0;

          next[symbol] = {
            ...current,
            price: parsed.price,
            baseline,
            changePercent: Number.isFinite(parsed.changePercent) ? parsed.changePercent : fallbackChangePercent,
            ticks: [...current.ticks, parsed.price].slice(-30),
            updatedAt: new Date().toISOString(),
          };
        });

        return next;
      });
    };

    applySnapshot();
    const interval = setInterval(applySnapshot, 10000);
    return () => clearInterval(interval);
  }, [fetchEquitySnapshots]);

  useEffect(() => {
    const updates = Object.entries(cryptoQuotes);
    if (updates.length === 0) return;

    setCryptoState((prev) => {
      const next = { ...prev };
      updates.forEach(([symbol, quote]) => {
        const normalizedSymbol = normalizeCryptoStateSymbol(symbol);
        const price = getPriceFromQuote(quote);
        if (!Number.isFinite(price)) return;

        const current = next[normalizedSymbol] || createEntry(
          normalizedSymbol,
          CRYPTO_NAMES[normalizedSymbol] || normalizedSymbol,
        );
        const baseline = Number.isFinite(current.baseline) ? current.baseline : price;
        const changePercent = baseline ? ((price - baseline) / baseline) * 100 : 0;

        next[normalizedSymbol] = {
          ...current,
          price,
          baseline,
          changePercent,
          ticks: [...current.ticks, price].slice(-30),
          updatedAt: quote?.timestamp || new Date().toISOString(),
        };
      });
      return next;
    });
  }, [cryptoQuotes]);

  const stockLastUpdated = useMemo(() => getLatestTimestampDate(stockState), [stockState]);
  const cryptoLastUpdated = useMemo(() => getLatestTimestampDate(cryptoState), [cryptoState]);
  const lseLastUpdated = useMemo(() => {
    const latest = lseQuoteList
      .map((quote) => toSafeDate(quote?.timestamp))
      .filter(Boolean)
      .sort((a, b) => a.getTime() - b.getTime())
      .pop();
    return latest || null;
  }, [lseQuoteList]);
  const hasStockData = useMemo(
    () => Object.values(stockState).some((entry) => Number.isFinite(entry?.price)),
    [stockState],
  );
  const hasCryptoData = useMemo(
    () => Object.values(cryptoState).some((entry) => Number.isFinite(entry?.price)),
    [cryptoState],
  );
  const hasLseData = useMemo(
    () => lseQuoteList.some((quote) => Number.isFinite(Number(quote?.price))),
    [lseQuoteList],
  );

  const stockConnected = marketDataConnected || hasStockData;
  const lseConnected = lseStatus.connected || hasLseData;
  const visibleError = (!cryptoConnected && error) || ((!lseConnected || !hasLseData) && lseError)
    ? (!cryptoConnected && error ? error : lseError)
    : null;

  const renderStreamRows = ({ symbols, dataset, isCrypto = false }) => {
    return symbols.map((symbol) => {
      const entry = dataset[symbol] || createEntry(symbol, isCrypto ? CRYPTO_NAMES[symbol] : ETF_NAMES[symbol] || TRENDING_NAMES[symbol] || symbol);
      const positive = (entry.changePercent || 0) >= 0;
      const hasPrice = Number.isFinite(entry.price);
      const displaySymbol = isCrypto ? symbol.replace('-', '/').replace('-USD', '/USD') : symbol;

      return (
        <div key={symbol} className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.015] px-2.5 py-2">
          <div className="min-w-0 pr-2">
            <div className="text-sm font-semibold text-white">${displaySymbol}</div>
            <div className="text-[11px] text-gray-500 truncate">{entry.name}</div>
          </div>

          <div className="text-right min-w-[86px]">
            <div className="text-sm font-mono text-white">{hasPrice ? formatPrice(entry.price, isCrypto) : '...'}</div>
            <div className={`text-xs font-medium inline-flex items-center gap-1 ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
              {positive ? <TrendingUp className="w-3 h-3" strokeWidth={1.5} /> : <TrendingDown className="w-3 h-3" strokeWidth={1.5} />}
              {formatSignedPercent(entry.changePercent)}
            </div>
          </div>
        </div>
      );
    });
  };

  const renderLseRows = () => (
    lseQuoteList.map((quote) => {
      const symbol = normalizeLseSymbol(quote?.symbol || quote?.streamSymbol);
      const percentChange = Number(quote?.percentChange);
      const positive = Number.isFinite(percentChange) ? percentChange >= 0 : true;
      const hasPrice = Number.isFinite(Number(quote?.price));

      return (
        <div key={symbol} className="flex items-start justify-between rounded-lg border border-white/[0.04] bg-white/[0.015] px-2.5 py-2">
          <div className="min-w-0 pr-2">
            <div className="text-sm font-semibold text-white">${symbol}</div>
            <div className="text-[11px] text-gray-500 truncate">{quote?.name || LSE_DEFAULT_NAMES[symbol] || symbol}</div>
          </div>

          <div className="flex items-start gap-2">
            <div className="text-right min-w-[92px]">
              <div className="text-sm font-mono text-white">{hasPrice ? formatLsePrice(quote?.price) : '...'}</div>
              <div className={`text-xs font-medium inline-flex items-center gap-1 ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                {positive ? <TrendingUp className="w-3 h-3" strokeWidth={1.5} /> : <TrendingDown className="w-3 h-3" strokeWidth={1.5} />}
                {formatSignedPercent(percentChange)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeLseSymbol(symbol)}
              className="rounded p-1 text-gray-500 transition-colors hover:bg-white/10 hover:text-white"
              title="Remove ticker"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      );
    })
  );

  const Card = ({ title, icon: Icon, connected, children, updatedAt, actions = null, iconClassName = 'text-emerald-400' }) => (
    <div className="relative rounded-xl border border-[#1f1f1f] bg-black/45 p-3 backdrop-blur-sm min-h-0">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-4.5 w-4.5 ${iconClassName}`} strokeWidth={1.5} />
          <h3 className="text-white font-semibold">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          <div className="flex items-center gap-2 text-xs">
            {connected ? (
              <>
                <Wifi className="h-3.5 w-3.5 text-emerald-400" strokeWidth={1.5} />
                <span className="text-emerald-400">Live</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5 text-yellow-400" strokeWidth={1.5} />
                <span className="text-yellow-400">Connecting...</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">{children}</div>

      <div className="mt-2 text-[10px] text-gray-600">
        {updatedAt && Number.isFinite(updatedAt.getTime())
          ? `Last tick ${updatedAt.toLocaleTimeString()}`
          : 'Waiting for stream...'}
      </div>
    </div>
  );

  return (
    <div className="relative flex-1 flex h-full flex-col overflow-hidden bg-transparent p-3">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Markets</h1>
          <p className="text-xs text-gray-400">Live Alpaca + London Stock Exchange stream</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={`inline-flex items-center gap-1 ${stockConnected ? 'text-emerald-400' : 'text-yellow-400'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${stockConnected ? 'bg-emerald-400 animate-pulse' : 'bg-yellow-400'}`} />
            ETFs/Stocks
          </span>
          <span className={`inline-flex items-center gap-1 ${lseConnected ? 'text-blue-400' : 'text-yellow-400'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${lseConnected ? 'bg-blue-400 animate-pulse' : 'bg-yellow-400'}`} />
            London
          </span>
          <span className={`inline-flex items-center gap-1 ${cryptoConnected ? 'text-emerald-400' : 'text-yellow-400'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cryptoConnected ? 'bg-emerald-400 animate-pulse' : 'bg-yellow-400'}`} />
            Crypto
          </span>
        </div>
      </div>

      {visibleError && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {visibleError}
        </div>
      )}

      <div className="grid flex-1 min-h-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Card title="ETFs & Indices" icon={Globe} connected={stockConnected} updatedAt={stockLastUpdated}>
          {renderStreamRows({ symbols: ETF_SYMBOLS, dataset: stockState })}
        </Card>

        <Card title="Trending" icon={BarChart3} connected={stockConnected} updatedAt={stockLastUpdated}>
          {renderStreamRows({ symbols: TRENDING_SYMBOLS, dataset: stockState })}
        </Card>

        <Card title="Sectors" icon={BarChart3} connected={stockConnected} updatedAt={stockLastUpdated}>
          <div className="grid grid-cols-2 gap-1.5">
            {SECTORS.map((sector) => {
              const positive = sector.changePercent >= 0;
              return (
                <div key={sector.symbol} className="rounded-lg border border-white/[0.04] bg-white/[0.015] px-2 py-1.5">
                  <div className="text-xs font-medium text-white truncate">{sector.name}</div>
                  <div className="text-[10px] text-gray-500">${sector.symbol}</div>
                  <div className={`mt-0.5 text-[11px] font-medium ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {positive ? '+' : ''}{sector.changePercent.toFixed(2)}%
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card
          title="London Stock Exchange"
          icon={Globe}
          connected={lseConnected}
          updatedAt={lseLastUpdated}
          iconClassName="text-blue-400"
          actions={(
            <button
              type="button"
              onClick={() => setLsePickerOpen((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded border border-blue-500/40 bg-blue-500/15 px-2 py-1 text-[11px] font-medium text-blue-300 hover:bg-blue-500/25"
            >
              <Plus className="h-3 w-3" strokeWidth={1.5} />
              Add
            </button>
          )}
        >
          {lsePickerOpen && (
            <div className="mb-2 rounded-lg border border-blue-500/30 bg-[#060d18]/90 p-2">
              <div className="mb-2 flex items-center gap-2 rounded border border-white/10 bg-white/[0.02] px-2 py-1.5">
                <Search className="h-3.5 w-3.5 text-gray-400" strokeWidth={1.5} />
                <input
                  value={lseSearchQuery}
                  onChange={(event) => setLseSearchQuery(event.target.value)}
                  placeholder="Search London ticker..."
                  className="w-full bg-transparent text-xs text-white outline-none placeholder:text-gray-500"
                />
              </div>
              {lseSearchError && (
                <div className="mb-2 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-300">
                  {lseSearchError}
                </div>
              )}
              <div className="max-h-40 space-y-1 overflow-y-auto pr-1" style={{ scrollbarWidth: 'none' }}>
                {lseSearchLoading ? (
                  <div className="flex items-center gap-2 rounded border border-white/10 bg-white/[0.02] px-2 py-1.5 text-[11px] text-gray-300">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" strokeWidth={1.5} />
                    Loading symbols...
                  </div>
                ) : lseSearchResults.length > 0 ? (
                  lseSearchResults.slice(0, 30).map((item) => {
                    const symbol = normalizeLseSymbol(item?.symbol);
                    if (!symbol) return null;
                    const alreadyAdded = lseSymbols.includes(symbol);
                    return (
                      <button
                        key={`${symbol}-${item?.instrumentName || ''}`}
                        type="button"
                        onClick={() => addLseSymbol(symbol)}
                        disabled={alreadyAdded}
                        className={`w-full rounded border px-2 py-1.5 text-left text-xs transition-colors ${
                          alreadyAdded
                            ? 'border-emerald-500/35 bg-emerald-500/10 text-emerald-300'
                            : 'border-white/10 bg-white/[0.02] text-white/85 hover:border-blue-500/35 hover:bg-blue-500/10'
                        }`}
                      >
                        <span className="font-semibold">${symbol}</span>
                        <span className="ml-2 text-white/55">{item?.instrumentName || item?.name || symbol}</span>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded border border-white/10 bg-white/[0.02] px-2 py-1.5 text-[11px] text-gray-400">
                    No London symbols found.
                  </div>
                )}
              </div>
            </div>
          )}
          {lseQuotesLoading && (
            <div className="mb-2 flex items-center gap-2 rounded border border-white/10 bg-white/[0.02] px-2 py-1.5 text-xs text-gray-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" strokeWidth={1.5} />
              Loading London quotes...
            </div>
          )}
          {renderLseRows()}
        </Card>

        <Card title="Crypto" icon={Activity} connected={cryptoConnected} updatedAt={cryptoLastUpdated}>
          {renderStreamRows({ symbols: CRYPTO_SYMBOLS, dataset: cryptoState, isCrypto: true })}
        </Card>
      </div>

      {(!stockConnected || !cryptoConnected || !lseConnected || !hasStockData || !hasCryptoData || !hasLseData) && (
        <div className="mt-2 rounded-lg border border-white/10 bg-[#0a1628]/70 px-3 py-2 text-xs text-gray-300">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" strokeWidth={1.5} />
              <span>
                {!stockConnected || !hasStockData
                  ? 'Equity stream reconnecting'
                  : (!lseConnected || !hasLseData)
                    ? 'London stream reconnecting'
                    : 'Crypto stream reconnecting'}
                {' · '}
                data will populate live when ticks arrive.
              </span>
            </div>
            <div className="flex items-center gap-2">
              {(!stockConnected || !hasStockData) && (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="rounded border border-white/15 px-2 py-1 text-[11px] text-gray-300 hover:bg-white/5"
                >
                  Refresh Equities
                </button>
              )}
              {(!lseConnected || !hasLseData) && (
                <button
                  type="button"
                  onClick={() => searchLseUniverse(lseSearchQuery)}
                  className="rounded border border-white/15 px-2 py-1 text-[11px] text-gray-300 hover:bg-white/5"
                >
                  Refresh London
                </button>
              )}
              {(!cryptoConnected || !hasCryptoData) && (
                <button
                  type="button"
                  onClick={reconnectCrypto}
                  className="rounded border border-white/15 px-2 py-1 text-[11px] text-gray-300 hover:bg-white/5"
                >
                  Reconnect Crypto
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketsPage;
