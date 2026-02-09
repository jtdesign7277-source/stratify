import { useState, useEffect, useCallback } from 'react';
import { TOP_CRYPTO_BY_MARKET_CAP } from '../../data/cryptoTop20';

const CRYPTO_API_BASE = 'https://api.crypto.com/exchange/v1/public/get-tickers';
const API_BASE = 'https://stratify-backend-production-3ebd.up.railway.app';

const TrendUpIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
  </svg>
);

const TrendDownIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181" />
  </svg>
);

const formatNumber = (num) => {
  if (!num) return null;
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toString();
};

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

const isCryptoAsset = (stock) => {
  if (!stock) return false;
  if (stock.isCrypto) return true;
  const exchange = String(stock.exchange || '').toLowerCase();
  const sector = String(stock.sector || '').toLowerCase();
  const assetType = String(stock.assetType || stock.type || '').toLowerCase();
  const symbol = String(stock.symbol || '').toUpperCase();
  return exchange.includes('crypto') || sector.includes('crypto') || assetType.includes('crypto') || symbol.includes('-USD');
};

const buildCryptoChartSymbol = (symbol) => {
  const raw = String(symbol || '').toUpperCase().trim();
  if (!raw) return null;
  if (raw.includes(':')) return raw;
  const sanitized = raw.replace(/[^A-Z0-9]/g, '');
  if (!sanitized) return null;
  const normalized = sanitized.endsWith('USD') ? sanitized : `${sanitized}USD`;
  return `CRYPTO:${normalized}`;
};

const buildCryptoInstrumentName = (symbol) => `${String(symbol || '').toUpperCase()}_USD`;

const resolveCryptoChangePercent = (changeRaw, price) => {
  if (!Number.isFinite(changeRaw)) return null;
  if (Math.abs(changeRaw) <= 1) return changeRaw * 100;
  if (Number.isFinite(price) && price !== 0) {
    return (changeRaw / price) * 100;
  }
  return changeRaw;
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

const formatStockPrice = (price) => {
  if (!Number.isFinite(price)) return '...';
  return Number(price).toFixed(2);
};

const formatSignedPercent = (value) => {
  if (!Number.isFinite(value)) return null;
  return `${value >= 0 ? '+' : ''}${Number(value).toFixed(2)}%`;
};

export default function Watchlist({ stocks = [], onRemove, onViewChart, themeClasses, compact = false }) {
  const [quotes, setQuotes] = useState({});
  const [stockLoading, setStockLoading] = useState(false);
  const [cryptoQuotes, setCryptoQuotes] = useState({});
  const [cryptoLoading, setCryptoLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('stocks');
  const [marketSession, setMarketSession] = useState(getMarketSession);

  const fetchStockQuotes = useCallback(async () => {
    setStockLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/stocks/bars`);
      if (!res.ok) {
        throw new Error(`Failed to fetch stock snapshots: ${res.status}`);
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        const nextQuotes = {};
        data.forEach((item) => {
          if (item?.symbol) {
            nextQuotes[item.symbol] = item;
          }
        });
        setQuotes(nextQuotes);
      }
    } catch (err) {
      console.error('Quote fetch error:', err);
    }
  }, []);

  useEffect(() => {
    const stockSymbols = stocks.filter((stock) => !isCryptoAsset(stock));
    if (stockSymbols.length === 0) return undefined;
    fetchStockQuotes();
    const interval = setInterval(() => {
      fetchStockQuotes();
    }, 30000);
    return () => clearInterval(interval);
  }, [stocks, fetchStockQuotes]);

  useEffect(() => {
    const interval = setInterval(() => {
      setMarketSession(getMarketSession());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

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
        TOP_CRYPTO_BY_MARKET_CAP.map(async (crypto) => {
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
  }, [activeTab, fetchCryptoQuote]);

  const getChangeColor = (change) => {
    if (change > 0) return 'text-emerald-400';
    if (change < 0) return 'text-red-400';
    return 'text-zinc-400';
  };

  const stockItems = stocks.filter(stock => !isCryptoAsset(stock));
  const cryptoItems = TOP_CRYPTO_BY_MARKET_CAP.map(crypto => ({
    ...crypto,
    isCrypto: true,
    assetType: 'crypto',
  }));
  const visibleItems = activeTab === 'crypto' ? cryptoItems : stockItems;
  const emptyMessage = activeTab === 'crypto' ? 'No crypto in watchlist' : 'No stocks in watchlist';

  const handleViewChart = (stock) => {
    if (!onViewChart) return;
    if (isCryptoAsset(stock)) {
      const chartSymbol = buildCryptoChartSymbol(stock.symbol);
      onViewChart({
        ...stock,
        chartSymbol: chartSymbol || stock.chartSymbol,
        assetType: stock.assetType || 'crypto',
        isCrypto: true,
      });
      return;
    }
    onViewChart(stock);
  };

  return (
    <div className="px-3 pb-3 space-y-2">
      <div className="pt-3">
        <div className="flex items-center gap-1 p-1 rounded-lg border border-zinc-700/50 bg-zinc-800/40">
          {['stocks', 'crypto'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === tab
                  ? 'bg-zinc-900 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab === 'stocks' ? 'Stocks' : 'Crypto'}
            </button>
          ))}
        </div>
      </div>
      {visibleItems.length === 0 && (
        <div className="px-4 py-6 text-center text-zinc-500 text-sm">
          {emptyMessage}
        </div>
      )}
      {visibleItems.map(stock => {
        const isCrypto = isCryptoAsset(stock);
        const quote = isCrypto ? (cryptoQuotes[stock.symbol] || {}) : (quotes[stock.symbol] || {});
        const isLoading = isCrypto ? (cryptoLoading && !quote.price) : (stockLoading && !quote.price);
        const hasData = isCrypto ? Number.isFinite(quote.price) : quote.price !== undefined;
        
        const price = isCrypto ? quote.price : (quote.price || stock.price || 0);
        const change = isCrypto ? (quote.changePercent ?? 0) : (quote.change || stock.change || 0);
        const changePercent = isCrypto ? quote.changePercent : (quote.changePercent || stock.changePercent || 0);
        const changePercentDisplay = isCrypto
          ? (Number.isFinite(changePercent) ? changePercent : null)
          : changePercent;
        const volume = isCrypto ? null : (quote.volume || stock.volume);
        const companyName = isCrypto ? stock.name : (quote.name || stock.name || '');
        const preMarketPrice = isCrypto ? null : quote.preMarketPrice;
        const preMarketChange = isCrypto ? null : quote.preMarketChange;
        const preMarketChangePercent = isCrypto ? null : quote.preMarketChangePercent;
        const afterHoursPrice = isCrypto ? null : quote.afterHoursPrice;
        const afterHoursChange = isCrypto ? null : quote.afterHoursChange;
        const afterHoursChangePercent = isCrypto ? null : quote.afterHoursChangePercent;
        const showPreMarket = !isCrypto && marketSession === 'pre' && Number.isFinite(preMarketPrice);
        const showAfterHours = !isCrypto && marketSession === 'after' && Number.isFinite(afterHoursPrice);
        const preMarketPercentLabel = formatSignedPercent(preMarketChangePercent);
        const afterHoursPercentLabel = formatSignedPercent(afterHoursChangePercent);
        
        return (
          <div 
            key={stock.symbol} 
            className="rounded-lg border border-zinc-700/50 bg-zinc-800/30 p-3 hover:border-zinc-600/50 transition-colors cursor-pointer"
            onClick={() => handleViewChart(stock)}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="font-bold text-white">{stock.symbol}</span>
                <p className="text-xs text-zinc-500 truncate max-w-[140px]">{companyName}</p>
              </div>
              <div className="text-right flex flex-col items-end">
                {isLoading && !hasData ? (
                  <div className="w-4 h-4 border-2 border-zinc-700 border-t-blue-400 rounded-full animate-spin" />
                ) : (
                  <>
                    <p className="font-semibold text-white">
                      ${isCrypto ? formatCryptoPrice(price) : formatStockPrice(price)}
                    </p>
                    {changePercentDisplay !== null && (
                      <div className={`mt-1 flex items-center justify-end gap-1 text-xs ${getChangeColor(change)}`}>
                        {change >= 0 ? (
                          <TrendUpIcon className="w-3 h-3" />
                        ) : (
                          <TrendDownIcon className="w-3 h-3" />
                        )}
                        <span>{change >= 0 ? '+' : ''}{Number(changePercentDisplay || 0).toFixed(2)}%</span>
                      </div>
                    )}
                    {showPreMarket && preMarketPercentLabel && (
                      <div className={`mt-1 text-xs ${getChangeColor(preMarketChange || 0)}`}>
                        Pre: ${formatStockPrice(preMarketPrice)} {preMarketPercentLabel}
                      </div>
                    )}
                    {showAfterHours && afterHoursPercentLabel && (
                      <div className={`mt-1 text-xs ${getChangeColor(afterHoursChange || 0)}`}>
                        AH: ${formatStockPrice(afterHoursPrice)} {afterHoursPercentLabel}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            {volume && (
              <div className="text-xs text-zinc-500">
                Vol: {formatNumber(volume)}
              </div>
            )}
            {!volume && isCrypto && changePercentDisplay !== null && (
              <div className="text-xs text-zinc-500">
                24h: {change >= 0 ? '+' : ''}{Number(changePercentDisplay || 0).toFixed(2)}%
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
