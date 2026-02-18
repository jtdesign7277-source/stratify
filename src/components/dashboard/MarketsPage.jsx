import React, { useEffect, useMemo, useRef, useState } from 'react';
import { TrendingUp, TrendingDown, Globe, BarChart3, Activity, Loader2 } from 'lucide-react';
import useAlpacaStream from '../../hooks/useAlpacaStream';

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

const getMarketSession = (date = new Date()) => {
  const minutes = getEasternMinutes(date);
  if (minutes >= PRE_MARKET_START_MINUTES && minutes < PRE_MARKET_END_MINUTES) return 'pre';
  if (minutes >= PRE_MARKET_END_MINUTES && minutes < AFTER_HOURS_START_MINUTES) return 'regular';
  if (minutes >= AFTER_HOURS_START_MINUTES && minutes < AFTER_HOURS_END_MINUTES) return 'after';
  return 'closed';
};

const ETF_SYMBOLS = ['SPY', 'QQQ', 'DIA', 'IWM', 'GLD'];
const CRYPTO_SYMBOLS = ['BTC-USD', 'ETH-USD', 'SOL-USD', 'XRP-USD', 'DOGE-USD'];
const TRENDING_SYMBOLS = ['NVDA', 'TSLA', 'META', 'AAPL', 'AMZN', 'MSFT'];

const ETF_NAMES = {
  SPY: 'S&P 500 ETF',
  QQQ: 'Nasdaq 100 ETF',
  DIA: 'Dow Jones ETF',
  IWM: 'Russell 2000 ETF',
  GLD: 'Gold ETF',
};

const CRYPTO_NAMES = {
  'BTC-USD': 'Bitcoin',
  'ETH-USD': 'Ethereum',
  'SOL-USD': 'Solana',
  'XRP-USD': 'XRP',
  'DOGE-USD': 'Dogecoin',
};

const TRENDING_NAMES = {
  NVDA: 'NVIDIA',
  TSLA: 'Tesla',
  META: 'Meta',
  AAPL: 'Apple',
  AMZN: 'Amazon',
  MSFT: 'Microsoft',
};

const getChangeColor = (value) => {
  if (value > 0) return 'text-emerald-400';
  if (value < 0) return 'text-red-400';
  return 'text-zinc-400';
};

const formatPrice = (value) => {
  if (!Number.isFinite(value)) return '--';
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatChangePercent = (value) => {
  if (!Number.isFinite(value)) return '--';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
};

const formatSymbol = (symbol) => {
  if (!symbol) return '';
  if (symbol.includes('-USD')) {
    return `$${symbol.replace('-USD', '/USD')}`;
  }
  return `$${symbol}`;
};

const Sparkline = ({ points = [] }) => {
  if (!Array.isArray(points) || points.length < 2) {
    return <div className="w-14 h-6" />;
  }

  const width = 56;
  const height = 24;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const trend = points[points.length - 1] - points[0];
  const stroke = trend >= 0 ? '#34d399' : '#f87171';

  const path = points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * (width - 2) + 1;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-14 h-6">
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const buildCardRows = ({ symbols, quotes, labels }) =>
  symbols.map((symbol) => {
    const quote = quotes[symbol] || null;
    const price = Number(quote?.price ?? quote?.lastTrade ?? quote?.ask ?? quote?.bid);
    const baseline = Number(quote?.baseline);
    const previous = Number(quote?.previousPrice);
    const change = Number.isFinite(price) && Number.isFinite(baseline) ? price - baseline : NaN;
    const changePercent =
      Number.isFinite(price) && Number.isFinite(baseline) && baseline !== 0
        ? ((price - baseline) / baseline) * 100
        : NaN;

    return {
      symbol,
      name: labels[symbol] || symbol,
      price,
      baseline,
      previous,
      change,
      changePercent,
      history: Array.isArray(quote?.history) ? quote.history : [],
      hasData: Number.isFinite(price),
    };
  });

const MarketsPage = ({ themeClasses }) => {
  const [equityStreamQuotes, setEquityStreamQuotes] = useState({});
  const [cryptoStreamQuotes, setCryptoStreamQuotes] = useState({});
  const [lastTickAt, setLastTickAt] = useState(null);

  const {
    stockQuotes,
    cryptoQuotes,
    stockConnected,
    cryptoConnected,
    error: streamError,
  } = useAlpacaStream({
    stockSymbols: [...ETF_SYMBOLS, ...TRENDING_SYMBOLS],
    cryptoSymbols: CRYPTO_SYMBOLS,
    enabled: true,
  });

  const updateQuoteMap = (previousMap, symbol, nextPrice) => {
    if (!Number.isFinite(nextPrice)) return previousMap;

    const previous = previousMap[symbol] || {};
    const previousHistory = Array.isArray(previous.history) ? previous.history : [];
    const nextHistory = [...previousHistory, nextPrice].slice(-20);

    return {
      ...previousMap,
      [symbol]: {
        ...previous,
        symbol,
        price: nextPrice,
        previousPrice: Number.isFinite(previous.price) ? previous.price : nextPrice,
        baseline: Number.isFinite(previous.baseline) ? previous.baseline : nextPrice,
        bid: previous.bid,
        ask: previous.ask,
        timestamp: Date.now(),
        history: nextHistory,
      },
    };
  };

  useEffect(() => {
    if (!stockQuotes || Object.keys(stockQuotes).length === 0) return;

    setEquityStreamQuotes((prev) => {
      let next = prev;
      Object.entries(stockQuotes).forEach(([symbol, quote]) => {
        const nextPrice = Number(quote?.price ?? quote?.lastTrade ?? quote?.ask ?? quote?.bid);
        if (!Number.isFinite(nextPrice)) return;

        next = updateQuoteMap(next, symbol, nextPrice);
        next[symbol] = {
          ...next[symbol],
          bid: Number(quote?.bid),
          ask: Number(quote?.ask),
          timestamp: quote?.timestamp || Date.now(),
        };
      });
      return next;
    });

    setLastTickAt(Date.now());
  }, [stockQuotes]);

  useEffect(() => {
    if (!cryptoQuotes || Object.keys(cryptoQuotes).length === 0) return;

    setCryptoStreamQuotes((prev) => {
      let next = prev;
      Object.entries(cryptoQuotes).forEach(([symbol, quote]) => {
        const nextPrice = Number(quote?.price ?? quote?.lastTrade ?? quote?.ask ?? quote?.bid);
        if (!Number.isFinite(nextPrice)) return;

        next = updateQuoteMap(next, symbol, nextPrice);
        next[symbol] = {
          ...next[symbol],
          bid: Number(quote?.bid),
          ask: Number(quote?.ask),
          timestamp: quote?.timestamp || Date.now(),
        };
      });
      return next;
    });

    setLastTickAt(Date.now());
  }, [cryptoQuotes]);

  const marketSession = getMarketSession(new Date(lastTickAt || Date.now()));

  const etfRows = useMemo(
    () => buildCardRows({ symbols: ETF_SYMBOLS, quotes: equityStreamQuotes, labels: ETF_NAMES }),
    [equityStreamQuotes],
  );

  const cryptoRows = useMemo(
    () => buildCardRows({ symbols: CRYPTO_SYMBOLS, quotes: cryptoStreamQuotes, labels: CRYPTO_NAMES }),
    [cryptoStreamQuotes],
  );

  const trendingRows = useMemo(
    () => buildCardRows({ symbols: TRENDING_SYMBOLS, quotes: equityStreamQuotes, labels: TRENDING_NAMES }),
    [equityStreamQuotes],
  );

  const sectors = [
    { name: 'Technology', symbol: 'XLK', changePercent: 1.45 },
    { name: 'Healthcare', symbol: 'XLV', changePercent: -0.32 },
    { name: 'Financials', symbol: 'XLF', changePercent: 0.87 },
    { name: 'Energy', symbol: 'XLE', changePercent: 2.13 },
    { name: 'Consumer', symbol: 'XLY', changePercent: -0.54 },
    { name: 'Industrials', symbol: 'XLI', changePercent: 0.23 },
  ];

  const MarketCard = ({ title, data, icon: Icon, showName = true }) => {
    const hasAnyData = data.some((item) => item.hasData || Number.isFinite(item.changePercent));

    return (
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Icon className="w-5 h-5 text-emerald-400" strokeWidth={1.5} />
          <h3 className="text-white font-medium">{title}</h3>
        </div>

        {!hasAnyData ? (
          <div className="flex items-center justify-center py-8 gap-2 text-zinc-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Waiting for live ticks...
          </div>
        ) : (
          <div className="space-y-3">
            {data.map((item) => {
              const changeClass = getChangeColor(item.changePercent);
              const positive = (item.changePercent || 0) >= 0;

              return (
                <div key={item.symbol} className="flex items-center justify-between py-2 border-b border-[#1f1f1f]/50 last:border-0">
                  <div className="min-w-0">
                    <div className="text-white text-sm font-medium">{formatSymbol(item.symbol)}</div>
                    {showName ? <div className="text-white/50 text-xs truncate">{item.name}</div> : null}
                  </div>

                  <div className="flex items-center gap-3">
                    <Sparkline points={item.history} />
                    <div className="text-right min-w-[92px]">
                      <div className="text-white text-sm font-mono">${formatPrice(item.price)}</div>
                      <div className={`text-xs font-medium flex items-center gap-1 justify-end ${changeClass}`}>
                        {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {formatChangePercent(item.changePercent)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const SectorCard = () => (
    <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-emerald-400" strokeWidth={1.5} />
        <h3 className="text-white font-medium">Sectors</h3>
      </div>

      <div className="space-y-3">
        {sectors.map((sector) => (
          <div key={sector.symbol} className="flex items-center justify-between py-2 border-b border-[#1f1f1f]/50 last:border-0">
            <div>
              <div className="text-white text-sm font-medium">${sector.symbol}</div>
              <div className="text-white/50 text-xs">{sector.name}</div>
            </div>
            <div className={`text-xs font-medium flex items-center gap-1 ${getChangeColor(sector.changePercent)}`}>
              {sector.changePercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {formatChangePercent(sector.changePercent)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent p-4 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Markets</h1>
          <p className="text-gray-400 text-sm">
            {stockConnected || cryptoConnected
              ? `Live stream: ${marketSession === 'regular' ? 'Market Open' : marketSession === 'pre' ? 'Pre-Market' : marketSession === 'after' ? 'After Hours' : 'Market Closed'}`
              : 'Connecting to Alpaca stream...'}
          </p>
        </div>

        <div className="text-right">
          <p className={`text-xs ${stockConnected && cryptoConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
            {stockConnected && cryptoConnected ? 'Stocks + Crypto Live' : 'Stream Connecting'}
          </p>
          {streamError ? <p className="text-[11px] text-red-400 mt-0.5">{streamError}</p> : null}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        <MarketCard title="ETFs & Indices" data={etfRows} icon={Globe} />
        <MarketCard title="Cryptocurrency" data={cryptoRows} icon={Activity} />
        <MarketCard title="Trending" data={trendingRows} icon={BarChart3} />
      </div>

      <div className="mt-4">
        <SectorCard />
      </div>
    </div>
  );
};

export default MarketsPage;
