import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import Highcharts from 'highcharts';
import { Activity, Search } from 'lucide-react';
import IncomeTab from './IncomeTab';
import BalanceTab from './BalanceTab';
import CashFlowTab from './CashFlowTab';
import KeyStatsTab from './KeyStatsTab';
import StatCard from './StatCard';
import { useQuote, useStatistics } from './hooks/useTwelveData';
import { useTwelveDataWS } from './hooks/useTwelveDataWS';
import { applyStratifyTheme } from '../../styles/highcharts-theme';
import {
  formatCompactNumber,
  formatCurrency,
  formatSignedPercent,
  normalizeSymbol,
  toNumber,
} from '../../lib/twelvedata';

const TABS = [
  { id: 'income', label: 'Income Statement' },
  { id: 'balance', label: 'Balance Sheet' },
  { id: 'cashflow', label: 'Cash Flow' },
  { id: 'stats', label: 'Key Stats' },
];

const PERIOD_OPTIONS = [
  { id: 'annual', label: 'Annual' },
  { id: 'quarterly', label: 'Quarterly' },
];

const HIGHCHARTS_CDN_WAIT_MS = 8000;

const PAGE_TRANSITION = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
};

const sectionMotion = (index) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.1 + (index * 0.05), duration: 0.3 },
});

const listItemMotion = (index) => ({
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0 },
  transition: { delay: index * 0.03, duration: 0.25 },
});

const interactiveTransition = { type: 'spring', stiffness: 400, damping: 25 };

const getToneFromChange = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'default';
  if (numeric > 0) return 'positive';
  if (numeric < 0) return 'negative';
  return 'default';
};

const getErrorMessage = (error, fallback = 'Unexpected error') => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message || fallback;
  return fallback;
};

const toDisplayTimestamp = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    if (value > 1e12) return value;
    if (value > 1e10) return Math.floor(value);
    return value * 1000;
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    if (numeric > 1e12) return numeric;
    if (numeric > 1e10) return Math.floor(numeric);
    return numeric * 1000;
  }

  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
};

const formatLiveTimestamp = (value) => {
  const ts = toDisplayTimestamp(value);
  if (!Number.isFinite(ts)) return null;
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const firstFiniteNumber = (...values) => {
  for (const value of values) {
    const parsed = toNumber(value);
    if (parsed !== null) return parsed;
  }
  return null;
};

const getAtPath = (obj, path) => {
  if (!obj || typeof obj !== 'object' || !path) return undefined;
  return String(path)
    .split('.')
    .reduce((cursor, segment) => (cursor && typeof cursor === 'object' ? cursor[segment] : undefined), obj);
};

const hasHighchartsCdnScript = () => {
  if (typeof document === 'undefined') return false;
  return Array.from(document.querySelectorAll('script[src]')).some((script) =>
    /highcharts/i.test(script.getAttribute('src') || '')
  );
};

const getWindowHighcharts = () => {
  if (typeof window === 'undefined') return null;
  const candidate = window.Highcharts;
  if (!candidate || typeof candidate.setOptions !== 'function') return null;
  return candidate;
};

export default function XRayPage({ initialSymbol = 'TSLA', onSymbolChange, onBack }) {
  const [symbolInput, setSymbolInput] = useState(() => normalizeSymbol(initialSymbol) || 'TSLA');
  const [symbol, setSymbol] = useState(() => normalizeSymbol(initialSymbol) || 'TSLA');
  const [activeTab, setActiveTab] = useState('income');
  const [period, setPeriod] = useState('annual');
  const [suggestions, setSuggestions] = useState([]);
  const [isSymbolInputFocused, setIsSymbolInputFocused] = useState(false);
  const [hasTypedSymbolQuery, setHasTypedSymbolQuery] = useState(false);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [chartEngineReady, setChartEngineReady] = useState(false);
  const [chartEngineError, setChartEngineError] = useState('');
  const [isCompactHeader, setIsCompactHeader] = useState(() => (
    typeof window !== 'undefined' ? window.innerHeight < 980 : false
  ));

  const { data: quote, loading: quoteLoading, error: quoteError } = useQuote(symbol);
  const {
    data: stats,
    loading: statsLoading,
    error: statsError,
  } = useStatistics(symbol);
  const { prices, connected, subscribe, unsubscribe } = useTwelveDataWS();

  useEffect(() => {
    let cancelled = false;
    let pollTimer = null;
    let fallbackTimer = null;

    const applyThemeSafely = (instance) => {
      if (cancelled) return;
      try {
        const applied = applyStratifyTheme(instance);
        if (!applied) {
          setChartEngineError('Highcharts is not available yet.');
          setChartEngineReady(false);
          return;
        }
        setChartEngineError('');
        setChartEngineReady(true);
      } catch (error) {
        console.error('[xray/page] Highcharts init error:', error);
        setChartEngineError(getErrorMessage(error, 'Failed to initialize chart engine.'));
        setChartEngineReady(false);
      }
    };

    const windowInstance = getWindowHighcharts();
    if (windowInstance) {
      applyThemeSafely(windowInstance);
      return () => {
        cancelled = true;
      };
    }

    if (!hasHighchartsCdnScript()) {
      applyThemeSafely(Highcharts);
      return () => {
        cancelled = true;
      };
    }

    pollTimer = window.setInterval(() => {
      const cdnInstance = getWindowHighcharts();
      if (!cdnInstance) return;
      if (pollTimer) window.clearInterval(pollTimer);
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
      applyThemeSafely(cdnInstance);
    }, 120);

    fallbackTimer = window.setTimeout(() => {
      if (pollTimer) window.clearInterval(pollTimer);
      applyThemeSafely(Highcharts);
    }, HIGHCHARTS_CDN_WAIT_MS);

    return () => {
      cancelled = true;
      if (pollTimer) window.clearInterval(pollTimer);
      if (fallbackTimer) window.clearTimeout(fallbackTimer);
    };
  }, []);

  useEffect(() => {
    const normalized = normalizeSymbol(initialSymbol) || 'TSLA';
    setSymbolInput(normalized);
    setSymbol(normalized);
    setSuggestions([]);
    setHasTypedSymbolQuery(false);
    setIsSuggestionsOpen(false);
  }, [initialSymbol]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleResize = () => {
      setIsCompactHeader(window.innerHeight < 980);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!symbol) return undefined;
    subscribe([symbol]);
    return () => unsubscribe([symbol]);
  }, [subscribe, symbol, unsubscribe]);

  useEffect(() => {
    const query = normalizeSymbol(symbolInput);
    if (
      !isSuggestionsOpen ||
      !isSymbolInputFocused ||
      !hasTypedSymbolQuery ||
      !query ||
      query.length < 1
    ) {
      setSuggestions([]);
      return undefined;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/stock/search?q=${encodeURIComponent(query)}`, {
          cache: 'no-store',
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) return;
        const list = Array.isArray(payload?.results) ? payload.results.slice(0, 6) : [];
        setSuggestions(list);
      } catch {
        setSuggestions([]);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [hasTypedSymbolQuery, isSuggestionsOpen, isSymbolInputFocused, symbolInput]);

  const liveQuote = prices?.[symbol] || null;
  const liveQuoteTime = formatLiveTimestamp(liveQuote?.timestamp);
  const rawStats = stats?.raw_json || null;
  const statsPayload =
    rawStats && rawStats.statistics && typeof rawStats.statistics === 'object'
      ? rawStats.statistics
      : rawStats;

  const livePrice = useMemo(() => {
    if (liveQuote?.price !== null && liveQuote?.price !== undefined && Number.isFinite(liveQuote.price)) {
      return liveQuote.price;
    }
    return toNumber(quote?.price);
  }, [liveQuote?.price, quote?.price]);

  const displayChangePercent = useMemo(() => {
    const livePercent = firstFiniteNumber(liveQuote?.change_percent, liveQuote?.percent_change);
    if (livePercent !== null) return livePercent;

    const quotePercent = firstFiniteNumber(quote?.change_percent, quote?.percent_change);
    if (quotePercent !== null) return quotePercent;

    const previousClose = firstFiniteNumber(quote?.previous_close, liveQuote?.previous_close);
    if (livePrice !== null && previousClose !== null && previousClose !== 0) {
      return Number((((livePrice - previousClose) / previousClose) * 100).toFixed(2));
    }

    return null;
  }, [
    livePrice,
    liveQuote?.change_percent,
    liveQuote?.percent_change,
    liveQuote?.previous_close,
    quote?.change_percent,
    quote?.percent_change,
    quote?.previous_close,
  ]);

  const marketCapValue = useMemo(() => firstFiniteNumber(
    stats?.market_cap,
    getAtPath(statsPayload, 'valuations_metrics.market_capitalization'),
    getAtPath(statsPayload, 'valuations_metrics.market_cap'),
    getAtPath(statsPayload, 'market_capitalization'),
    getAtPath(statsPayload, 'market_cap')
  ), [stats?.market_cap, statsPayload]);

  const peRatioValue = useMemo(() => firstFiniteNumber(
    stats?.pe_ratio,
    getAtPath(statsPayload, 'valuations_metrics.trailing_pe'),
    getAtPath(statsPayload, 'valuations_metrics.pe_ratio'),
    getAtPath(statsPayload, 'pe_ratio')
  ), [stats?.pe_ratio, statsPayload]);

  const fiftyTwoWeekHigh = useMemo(() => firstFiniteNumber(
    stats?.fifty_two_week_high,
    getAtPath(statsPayload, 'stock_price_summary.fifty_two_week_high'),
    getAtPath(statsPayload, 'stock_price_summary.week_52_high'),
    getAtPath(statsPayload, 'stock_price_summary.52_week_high'),
    getAtPath(statsPayload, 'fifty_two_week_high'),
    getAtPath(statsPayload, '52_week_high')
  ), [stats?.fifty_two_week_high, statsPayload]);

  const fiftyTwoWeekLow = useMemo(() => firstFiniteNumber(
    stats?.fifty_two_week_low,
    getAtPath(statsPayload, 'stock_price_summary.fifty_two_week_low'),
    getAtPath(statsPayload, 'stock_price_summary.week_52_low'),
    getAtPath(statsPayload, 'stock_price_summary.52_week_low'),
    getAtPath(statsPayload, 'fifty_two_week_low'),
    getAtPath(statsPayload, '52_week_low')
  ), [stats?.fifty_two_week_low, statsPayload]);

  const livePriceSubvalue = useMemo(() => {
    if (quoteError) return quoteError;
    if (liveQuote && liveQuoteTime) return `Live • ${liveQuoteTime}`;
    if (liveQuote) return 'Live • updated';
    if (connected) return 'Live feed connected';
    return 'Connecting...';
  }, [connected, liveQuote, liveQuoteTime, quoteError]);

  const handleGoBack = () => {
    if (typeof onBack === 'function') {
      onBack();
      return;
    }

    if (typeof window !== 'undefined') {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.assign('/');
      }
    }
  };

  const handleSymbolInputChange = (event) => {
    const nextValue = event.target.value.toUpperCase();
    const query = normalizeSymbol(nextValue);
    setSymbolInput(nextValue);
    setHasTypedSymbolQuery(true);
    setIsSuggestionsOpen(Boolean(query) && query.length > 0);
  };

  const handleSymbolInputFocus = () => {
    setIsSymbolInputFocused(true);
    const query = normalizeSymbol(symbolInput);
    setIsSuggestionsOpen(hasTypedSymbolQuery && Boolean(query) && query.length > 0);
  };

  const handleSymbolInputBlur = () => {
    setIsSymbolInputFocused(false);
    setIsSuggestionsOpen(false);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const next = normalizeSymbol(symbolInput);
    if (!next) return;
    setSymbol(next);
    setSuggestions([]);
    setIsSuggestionsOpen(false);
    if (typeof onSymbolChange === 'function') {
      onSymbolChange(next);
    }
  };

  const handleSelectSuggestion = (candidate) => {
    const next = normalizeSymbol(candidate?.symbol || symbolInput);
    if (!next) return;
    setSymbolInput(next);
    setSymbol(next);
    setSuggestions([]);
    setIsSuggestionsOpen(false);
    if (typeof onSymbolChange === 'function') {
      onSymbolChange(next);
    }
  };

  const apiError = quoteError || statsError || '';
  const apiLoading = quoteLoading || statsLoading;

  if (!chartEngineReady && !chartEngineError) {
    return (
      <motion.div {...PAGE_TRANSITION} className="h-full min-h-0 overflow-hidden bg-[#0b0b0b] text-white">
        <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] items-center justify-center px-4 py-4 md:px-6 md:py-5">
          <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0b0b0b] px-5 py-4 text-sm text-[#cbd5e1]">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-300/80 border-t-transparent" />
            Loading X-Ray chart engine...
          </div>
        </div>
      </motion.div>
    );
  }

  try {
    return (
      <motion.div {...PAGE_TRANSITION} className="h-full min-h-0 overflow-hidden bg-[#0b0b0b] text-white">
        <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col px-3 py-2 md:px-4 md:py-3">
          <motion.div {...sectionMotion(0)} className={`rounded-2xl border border-white/10 bg-[#0b0b0b] ${isCompactHeader ? 'p-2.5' : 'p-3'}`}>
            <div className={`flex flex-col ${isCompactHeader ? 'gap-2' : 'gap-3'} lg:flex-row lg:items-center lg:justify-between`}>
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#6b7280]">X-Ray Fundamentals</p>
                  <h1 className={`${isCompactHeader ? 'mt-0.5 text-base' : 'mt-1 text-lg'} font-semibold text-[#e5e7eb]`}>{symbol}</h1>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[10px] text-[#9ca3af]">
                  <Activity size={11} strokeWidth={1.5} className={connected ? 'text-emerald-300' : 'text-red-300'} />
                  {connected ? 'Live' : 'Offline'}
                </span>
              </div>

              <div className={`flex flex-col ${isCompactHeader ? 'gap-2' : 'gap-3'} md:flex-row md:items-center`}>
                <form onSubmit={handleSubmit} className="relative">
                  <div className={`flex items-center gap-2 rounded-xl border border-white/10 bg-[#0b0b0b] ${isCompactHeader ? 'px-2 py-1.5' : 'px-3 py-2'}`}>
                    <Search size={14} strokeWidth={1.5} className="text-[#6b7280]" />
                    <input
                      value={symbolInput}
                      onChange={handleSymbolInputChange}
                      onFocus={handleSymbolInputFocus}
                      onBlur={handleSymbolInputBlur}
                      className={`bg-transparent font-mono ${isCompactHeader ? 'w-28 text-xs' : 'w-36 text-sm'} text-[#e5e7eb] outline-none placeholder:text-[#6b7280]`}
                      placeholder="Symbol"
                      maxLength={12}
                    />
                    <motion.button
                      type="submit"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      transition={interactiveTransition}
                      className={`rounded-md bg-[#3b82f6] ${isCompactHeader ? 'px-2 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]'} font-medium text-white transition hover:bg-[#2563eb]`}
                    >
                      Load
                    </motion.button>
                  </div>

                  {isSuggestionsOpen && isSymbolInputFocused && suggestions.length > 0 ? (
                    <div className="absolute z-20 mt-2 w-full rounded-xl border border-white/10 bg-[#0b0b0b] p-1 shadow-2xl">
                      {suggestions.map((item, index) => (
                        <motion.button
                          key={item.symbol}
                          type="button"
                          {...listItemMotion(index)}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          transition={{ ...listItemMotion(index).transition, ...interactiveTransition }}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleSelectSuggestion(item)}
                          className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-white/5"
                        >
                          <span className="font-mono text-[#e5e7eb]">{item.symbol}</span>
                          <span className="truncate pl-3 text-[#6b7280]">{item.name || item.exchange || ''}</span>
                        </motion.button>
                      ))}
                    </div>
                  ) : null}
                </form>

                <div className="inline-flex rounded-xl border border-white/10 bg-[#0b0b0b] p-0.5">
                  {PERIOD_OPTIONS.map((option, index) => (
                    <motion.button
                      key={option.id}
                      type="button"
                      onClick={() => setPeriod(option.id)}
                      {...listItemMotion(index)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ ...listItemMotion(index).transition, ...interactiveTransition }}
                      className={`rounded-lg ${isCompactHeader ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'} transition ${
                        period === option.id
                          ? 'bg-[#3b82f6] text-white'
                          : 'text-[#9ca3af] hover:text-[#e5e7eb]'
                      }`}
                    >
                      {option.label}
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>

            {chartEngineError ? (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {chartEngineError}
              </div>
            ) : null}

            {apiError ? (
              <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                Twelve Data request failed: {apiError}
              </div>
            ) : null}

            {apiLoading ? (
              <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-transparent px-3 py-1.5 text-[11px] text-[#9ca3af]">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#9ca3af]/70 border-t-transparent" />
                Loading fundamentals...
              </div>
            ) : null}

            <div className={`grid grid-cols-2 gap-2 ${isCompactHeader ? 'mt-2' : 'mt-3'} md:grid-cols-5`}>
              <StatCard
                label="Price"
                value={livePrice !== null ? formatCurrency(livePrice) : quoteLoading ? '...' : '--'}
                subvalue={livePriceSubvalue}
                tone="accent"
                compact={isCompactHeader}
              />
              <StatCard
                label="Change"
                value={displayChangePercent !== null ? formatSignedPercent(displayChangePercent) : '--'}
                tone={getToneFromChange(displayChangePercent)}
                compact={isCompactHeader}
              />
              <StatCard
                label="Market Cap"
                value={marketCapValue !== null ? formatCompactNumber(marketCapValue) : '--'}
                compact={isCompactHeader}
              />
              <StatCard
                label="P/E"
                value={peRatioValue !== null ? Number(peRatioValue).toFixed(2) : '--'}
                compact={isCompactHeader}
              />
              <StatCard
                label="52W Range"
                value={
                  fiftyTwoWeekLow !== null && fiftyTwoWeekHigh !== null
                    ? `${formatCurrency(fiftyTwoWeekLow)} - ${formatCurrency(fiftyTwoWeekHigh)}`
                    : '--'
                }
                compact={isCompactHeader}
              />
            </div>
          </motion.div>

          <motion.div {...sectionMotion(1)} className="mt-2.5 flex flex-wrap items-center gap-2">
            {TABS.map((tab, index) => (
              <motion.button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                {...listItemMotion(index)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ ...listItemMotion(index).transition, ...interactiveTransition }}
                className={`rounded-xl border px-3 py-1.5 text-xs transition ${
                  activeTab === tab.id
                    ? 'border-[#3b82f6] bg-[#3b82f6]/20 text-[#dbeafe]'
                    : 'border-white/10 bg-[#0b0b0b] text-[#9ca3af] hover:text-[#e5e7eb]'
                }`}
              >
                {tab.label}
              </motion.button>
            ))}
          </motion.div>

          <motion.div {...sectionMotion(2)} className="mt-2 min-h-0 flex-1 overflow-y-auto pr-1 pb-4">
            {activeTab === 'income' ? <IncomeTab symbol={symbol} period={period} /> : null}
            {activeTab === 'balance' ? <BalanceTab symbol={symbol} period={period} /> : null}
            {activeTab === 'cashflow' ? <CashFlowTab symbol={symbol} period={period} /> : null}
            {activeTab === 'stats' ? <KeyStatsTab symbol={symbol} /> : null}
          </motion.div>
        </div>
      </motion.div>
    );
  } catch (error) {
    console.error('[xray/page] Render error:', error);
    return (
      <motion.div {...PAGE_TRANSITION} className="h-full min-h-0 overflow-hidden bg-[#0b0b0b] text-white">
        <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] items-center justify-center px-4 py-4 md:px-6 md:py-5">
          <div className="w-full max-w-xl rounded-2xl border border-red-500/30 bg-[#0b0b0b] p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-red-300">X-Ray Error</p>
            <p className="mt-2 text-sm text-[#e5e7eb]">
              {getErrorMessage(error, 'Unable to render this X-Ray page right now.')}
            </p>
            <motion.button
              type="button"
              onClick={handleGoBack}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={interactiveTransition}
              className="mt-4 inline-flex items-center rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[#e5e7eb] transition hover:border-white/25"
            >
              Go Back
            </motion.button>
          </div>
        </div>
      </motion.div>
    );
  }
}
