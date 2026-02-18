import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Globe,
  Loader2,
  TrendingDown,
  TrendingUp,
  Wifi,
  WifiOff,
} from 'lucide-react';
import useAlpacaStream from '../../hooks/useAlpacaStream';

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

const isFiniteNumber = (value) => Number.isFinite(Number(value));

const getPriceFromQuote = (quote) => {
  const candidates = [quote?.price, quote?.lastTrade, quote?.ask, quote?.bid];
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

const toSafeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

const getLatestTimestampDate = (stateMap) => {
  const latest = Object.values(stateMap)
    .map((item) => toSafeDate(item?.updatedAt))
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime())
    .pop();

  return latest || null;
};

const MiniSparkline = ({ values = [] }) => {
  const normalized = values.filter((value) => Number.isFinite(value));
  if (normalized.length < 2) {
    return <div className="w-16 h-6 rounded bg-white/[0.03] border border-white/[0.04]" />;
  }

  const min = Math.min(...normalized);
  const max = Math.max(...normalized);
  const range = max - min || 1;
  const points = normalized
    .map((value, index) => {
      const x = (index / (normalized.length - 1)) * 64;
      const y = 24 - ((value - min) / range) * 24;
      return `${x},${y}`;
    })
    .join(' ');

  const trendUp = normalized[normalized.length - 1] >= normalized[0];

  return (
    <svg viewBox="0 0 64 24" className="w-16 h-6" preserveAspectRatio="none" aria-hidden="true">
      <polyline
        fill="none"
        stroke={trendUp ? '#34d399' : '#f87171'}
        strokeWidth="1.8"
        points={points}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const MarketsPage = () => {
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

  const {
    stockQuotes,
    cryptoQuotes,
    stockConnected,
    cryptoConnected,
    error,
    reconnectStock,
    reconnectCrypto,
  } = useAlpacaStream({
    stockSymbols: STREAM_STOCK_SYMBOLS,
    cryptoSymbols: CRYPTO_SYMBOLS,
    enabled: true,
  });

  useEffect(() => {
    const updates = Object.entries(stockQuotes);
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
          updatedAt: quote?.timestamp || new Date().toISOString(),
        };
      });
      return next;
    });
  }, [stockQuotes]);

  useEffect(() => {
    const updates = Object.entries(cryptoQuotes);
    if (updates.length === 0) return;

    setCryptoState((prev) => {
      const next = { ...prev };
      updates.forEach(([symbol, quote]) => {
        const price = getPriceFromQuote(quote);
        if (!Number.isFinite(price)) return;

        const current = next[symbol] || createEntry(symbol, CRYPTO_NAMES[symbol] || symbol);
        const baseline = Number.isFinite(current.baseline) ? current.baseline : price;
        const changePercent = baseline ? ((price - baseline) / baseline) * 100 : 0;

        next[symbol] = {
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
  const hasStockData = useMemo(
    () => Object.values(stockState).some((entry) => Number.isFinite(entry?.price)),
    [stockState],
  );
  const hasCryptoData = useMemo(
    () => Object.values(cryptoState).some((entry) => Number.isFinite(entry?.price)),
    [cryptoState],
  );

  const renderStreamRows = ({ symbols, dataset, isCrypto = false }) => {
    return symbols.map((symbol) => {
      const entry = dataset[symbol] || createEntry(symbol, isCrypto ? CRYPTO_NAMES[symbol] : ETF_NAMES[symbol] || TRENDING_NAMES[symbol] || symbol);
      const positive = (entry.changePercent || 0) >= 0;
      const hasPrice = Number.isFinite(entry.price);
      const displaySymbol = isCrypto ? symbol.replace('-', '/').replace('-USD', '/USD') : symbol;

      return (
        <div key={symbol} className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.015] px-3 py-2.5">
          <div>
            <div className="text-sm font-semibold text-white">${displaySymbol}</div>
            <div className="text-xs text-gray-500">{entry.name}</div>
          </div>

          <div className="flex items-center gap-3">
            <MiniSparkline values={entry.ticks} />
            <div className="text-right min-w-[88px]">
              <div className="text-sm font-mono text-white">{hasPrice ? formatPrice(entry.price, isCrypto) : '...'} </div>
              <div className={`text-xs font-medium inline-flex items-center gap-1 ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                {positive ? <TrendingUp className="w-3 h-3" strokeWidth={1.5} /> : <TrendingDown className="w-3 h-3" strokeWidth={1.5} />}
                {formatSignedPercent(entry.changePercent)}
              </div>
            </div>
          </div>
        </div>
      );
    });
  };

  const Card = ({ title, icon: Icon, connected, children, updatedAt }) => (
    <div className="rounded-xl border border-[#1f1f1f] bg-black/45 p-4 backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-emerald-400" strokeWidth={1.5} />
          <h3 className="text-white font-semibold">{title}</h3>
        </div>
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

      <div className="space-y-2.5">{children}</div>

      <div className="mt-3 text-[11px] text-gray-600">
        {updatedAt && Number.isFinite(updatedAt.getTime())
          ? `Last tick ${updatedAt.toLocaleTimeString()}`
          : 'Waiting for stream...'}
      </div>
    </div>
  );

  return (
    <div className="relative flex-1 flex h-full flex-col overflow-hidden bg-transparent p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Markets</h1>
          <p className="text-sm text-gray-400">Live Alpaca WebSocket stream only</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={`inline-flex items-center gap-1 ${stockConnected ? 'text-emerald-400' : 'text-yellow-400'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${stockConnected ? 'bg-emerald-400 animate-pulse' : 'bg-yellow-400'}`} />
            ETFs/Stocks
          </span>
          <span className={`inline-flex items-center gap-1 ${cryptoConnected ? 'text-emerald-400' : 'text-yellow-400'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${cryptoConnected ? 'bg-emerald-400 animate-pulse' : 'bg-yellow-400'}`} />
            Crypto
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-auto lg:grid-cols-2 xl:grid-cols-3 scrollbar-hide">
        <Card title="ETFs & Indices" icon={Globe} connected={stockConnected} updatedAt={stockLastUpdated}>
          {renderStreamRows({ symbols: ETF_SYMBOLS, dataset: stockState })}
        </Card>

        <Card title="Crypto" icon={Activity} connected={cryptoConnected} updatedAt={cryptoLastUpdated}>
          {renderStreamRows({ symbols: CRYPTO_SYMBOLS, dataset: cryptoState, isCrypto: true })}
        </Card>

        <Card title="Trending" icon={BarChart3} connected={stockConnected} updatedAt={stockLastUpdated}>
          {renderStreamRows({ symbols: TRENDING_SYMBOLS, dataset: stockState })}
        </Card>

        <div className="rounded-xl border border-[#1f1f1f] bg-black/45 p-4 backdrop-blur-sm lg:col-span-2 xl:col-span-3">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-emerald-400" strokeWidth={1.5} />
            <h3 className="text-white font-semibold">Sectors</h3>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {SECTORS.map((sector) => {
              const positive = sector.changePercent >= 0;
              return (
                <div key={sector.symbol} className="rounded-lg border border-white/[0.04] bg-white/[0.015] px-3 py-2">
                  <div className="text-sm font-medium text-white">{sector.name}</div>
                  <div className="text-xs text-gray-500">${sector.symbol}</div>
                  <div className={`mt-1 text-xs font-medium ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {positive ? '+' : ''}{sector.changePercent.toFixed(2)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {(!stockConnected || !cryptoConnected || !hasStockData || !hasCryptoData) && (
        <div className="mt-3 rounded-lg border border-white/10 bg-[#0a1628]/70 px-3 py-2 text-xs text-gray-300">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" strokeWidth={1.5} />
              <span>
                {!stockConnected || !hasStockData
                  ? 'Equity stream reconnecting'
                  : 'Crypto stream reconnecting'}
                {' · '}
                data will populate live when ticks arrive.
              </span>
            </div>
            <div className="flex items-center gap-2">
              {(!stockConnected || !hasStockData) && (
                <button
                  type="button"
                  onClick={reconnectStock}
                  className="rounded border border-white/15 px-2 py-1 text-[11px] text-gray-300 hover:bg-white/5"
                >
                  Reconnect Equities
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
