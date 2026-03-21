import { useState, useEffect, useCallback } from 'react';
import { TOP_CRYPTO_BY_MARKET_CAP } from '../../data/cryptoTop20';
import { getApiUrl } from '../../lib/api';

const CRYPTO_API_BASE = 'https://api.crypto.com/exchange/v1/public/get-tickers';


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

const isWeekendET = () => {
    const dayStr = new Intl.DateTimeFormat('en-US', { timeZone: EASTERN_TIMEZONE, weekday: 'short' }).format(new Date());
    return dayStr === 'Sat' || dayStr === 'Sun';
};

const getMarketSession = () => {
    if (isWeekendET()) return 'closed';
    const minutes = getEasternMinutes(new Date());
    if (minutes >= PRE_MARKET_START_MINUTES && minutes < PRE_MARKET_END_MINUTES) return 'pre_market';
    if (minutes >= PRE_MARKET_END_MINUTES && minutes < AFTER_HOURS_START_MINUTES) return 'regular';
    if (minutes >= AFTER_HOURS_START_MINUTES && minutes < AFTER_HOURS_END_MINUTES) return 'post_market';
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

const WATCHLIST_TICKER_TEXT_CLASS = 'text-sm';

export default function Watchlist({ stocks = [], onRemove, onViewChart, themeClasses, compact = false }) {
    const [quotes, setQuotes] = useState({});
    const [stockLoading, setStockLoading] = useState(false);
    const [cryptoQuotes, setCryptoQuotes] = useState({});
    const [cryptoLoading, setCryptoLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('stocks');
    const [localMarketSession, setLocalMarketSession] = useState(getMarketSession);

  const fetchStockQuotes = useCallback(async (symbolList) => {
        setStockLoading(true);
        try {
                const query = symbolList && symbolList.length > 0 ? `?symbols=${encodeURIComponent(symbolList.join(','))}` : '';
                const res = await fetch(`${getApiUrl('stocks')}${query}`);
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
        } finally {
                setStockLoading(false);
        }
  }, []);

  useEffect(() => {
        const stockSymbols = stocks.filter((stock) => !isCryptoAsset(stock));
        if (stockSymbols.length === 0) return undefined;
        const symbols = stockSymbols.map(s => s.symbol || s).filter(Boolean);
        fetchStockQuotes(symbols);
        const interval = setInterval(() => {
                fetchStockQuotes(symbols);
        }, 30000);
        return () => clearInterval(interval);
  }, [stocks, fetchStockQuotes]);

  useEffect(() => {
        const interval = setInterval(() => {
                setLocalMarketSession(getMarketSession());
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
                                                        activeTab === tab ? 'bg-zinc-900 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                                      }`}
                                    >
                        {tab === 'stocks' ? 'Stocks' : 'Crypto'}
                      </button>button>
                    ))}
                      </div>div>
              </div>div>
        
          {visibleItems.length === 0 && (
                  <div className="px-4 py-6 text-center text-zinc-500 text-sm">
                    {emptyMessage}
                  </div>div>
              )}
        
          {visibleItems.map(stock => {
                  const isCrypto = isCryptoAsset(stock);
                  const quote = isCrypto ? (cryptoQuotes[stock.symbol] || {}) : (quotes[stock.symbol] || {});
                  const isLoading = isCrypto ? (cryptoLoading && !quote.price) : (stockLoading && !quote.price);
                  const hasData = isCrypto ? Number.isFinite(quote.price) : quote.price !== undefined;
                  const price = isCrypto ? quote.price : (quote.latestPrice ?? quote.price ?? stock.price ?? 0);
                  const change = isCrypto ? (quote.changePercent ?? 0) : (quote.change ?? stock.change ?? 0);
                  const changePercent = isCrypto ? quote.changePercent : (quote.changePercent ?? stock.changePercent ?? 0);
                  const changePercentDisplay = isCrypto ? (Number.isFinite(changePercent) ? changePercent : null) : changePercent;
                  const volume = isCrypto ? null : (quote.volume || stock.volume);
                  const companyName = isCrypto ? stock.name : (quote.name || stock.name || '');
                  const isWeekend = isWeekendET();
                  const resolvedMarketSession = isCrypto ? null : (isWeekend ? 'closed' : (quote.marketSession || localMarketSession));
                  const isPreMarket = resolvedMarketSession === 'pre_market' || resolvedMarketSession === 'pre';
                  const isAfterHours = resolvedMarketSession === 'post_market' || resolvedMarketSession === 'after';
                  const extendedChangePercent = isCrypto ? null : (isPreMarket ? quote.preMarketChangePercent : quote.afterHoursChangePercent) ?? quote.extended_percent_change ?? null;
                  const showExtendedHours = !isCrypto && (isPreMarket || isAfterHours) && Number.isFinite(extendedChangePercent);
                  const extendedPercentLabel = formatSignedPercent(extendedChangePercent);
          
                  return (
                              <div
                                            key={stock.symbol}
                                            className="rounded-lg border border-zinc-700/50 bg-zinc-800/30 p-3 hover:border-zinc-600/50 transition-colors cursor-pointer"
                                            onClick={() => handleViewChart(stock)}
                                          >
                                          <div className="flex items-start justify-between mb-2">
                                                        <div>
                                                                        <span className={`${WATCHLIST_TICKER_TEXT_CLASS} font-bold text-white`}>{stock.symbol}</span>span>
                                                                        <p className="text-xs text-zinc-500 truncate max-w-[140px]">{companyName}</p>p>
                                                        </div>div>
                                                        <div className="text-right flex flex-col items-end gap-0.5">
                                                          {isLoading && !hasData ? (
                                                              <div className="w-4 h-4 border-2 border-zinc-700 border-t-blue-400 rounded-full animate-spin" />
                                                            ) : (
                                                              <>
                                                                <p className={`${WATCHLIST_TICKER_TEXT_CLASS} font-bold text-white tabular-nums`}>
                                                                  {isCrypto ? formatCryptoPrice(price) : formatStockPrice(price)}
                                                                </p>
                                                                {changePercentDisplay !== null && (
                                                                  <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold text-white ${changePercent >= 0 ? 'bg-emerald-600' : 'bg-red-600'}`}>
                                                                    {changePercent >= 0 ? '+' : ''}{Number(changePercentDisplay || 0).toFixed(2)}%
                                                                  </span>
                                                                )}
                                                                {showExtendedHours && extendedPercentLabel && (
                                                                  <div className="flex items-center gap-1 text-[11px]">
                                                                    <span>🌙</span>
                                                                    <span className={extendedChangePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}>{extendedPercentLabel}</span>
                                                                  </div>
                                                                )}
                                                              </>
                                                            )}
                                                        </div>
                                          </div>div>
                                {volume && (
                                                          <div className="text-xs text-zinc-500">
                                                                          Vol: {formatNumber(volume)}
                                                          </div>div>
                                          )}
                                {!volume && isCrypto && changePercentDisplay !== null && (
                                                          <div className="text-xs text-zinc-500">
                                                                          24h: {change >= 0 ? '+' : ''}{Number(changePercentDisplay || 0).toFixed(2)}%
                                                          </div>div>
                                          )}
                              </div>div>
                            );
        })}
        </div>div>
      );
}</></div>
