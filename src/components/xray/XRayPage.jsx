import { useEffect, useMemo, useState } from 'react';
import Highcharts from 'highcharts';
import { Activity, ArrowLeft, Search } from 'lucide-react';
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

  const livePrice = useMemo(() => {
    if (liveQuote?.price !== null && liveQuote?.price !== undefined && Number.isFinite(liveQuote.price)) {
      return liveQuote.price;
    }
    return quote?.price ?? null;
  }, [liveQuote?.price, quote?.price]);

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
      <div className="h-screen overflow-hidden bg-transparent text-white">
        <div className="mx-auto flex h-full w-full max-w-[1600px] items-center justify-center px-4 py-4 md:px-6 md:py-5">
          <div className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm px-5 py-4 text-sm text-[#cbd5e1]">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-300/80 border-t-transparent" />
            Loading X-Ray chart engine...
          </div>
        </div>
      </div>
    );
  }

  try {
    return (
      <div className="h-screen overflow-hidden bg-transparent text-white">
        <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col px-4 py-4 md:px-6 md:py-5">
          <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleGoBack}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-[#9ca3af] transition hover:border-white/20 hover:text-[#e5e7eb]"
                >
                  <ArrowLeft size={14} strokeWidth={1.5} />
                  Back
                </button>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[#6b7280]">X-Ray Fundamentals</p>
                  <h1 className="mt-1 text-lg font-semibold text-[#e5e7eb]">{symbol}</h1>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[10px] text-[#9ca3af]">
                  <Activity size={11} strokeWidth={1.5} className={connected ? 'text-emerald-300' : 'text-red-300'} />
                  {connected ? 'Live' : 'Offline'}
                </span>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <form onSubmit={handleSubmit} className="relative">
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/50 px-3 py-2">
                    <Search size={14} strokeWidth={1.5} className="text-[#6b7280]" />
                    <input
                      value={symbolInput}
                      onChange={handleSymbolInputChange}
                      onFocus={handleSymbolInputFocus}
                      onBlur={handleSymbolInputBlur}
                      className="w-36 bg-transparent font-mono text-sm text-[#e5e7eb] outline-none placeholder:text-[#6b7280]"
                      placeholder="Symbol"
                      maxLength={12}
                    />
                    <button
                      type="submit"
                      className="rounded-md bg-[#3b82f6] px-2 py-1 text-[11px] font-medium text-white transition hover:bg-[#2563eb]"
                    >
                      Load
                    </button>
                  </div>

                  {isSuggestionsOpen && isSymbolInputFocused && suggestions.length > 0 ? (
                    <div className="absolute z-20 mt-2 w-full rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm p-1 shadow-2xl">
                      {suggestions.map((item) => (
                        <button
                          key={item.symbol}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleSelectSuggestion(item)}
                          className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-white/5"
                        >
                          <span className="font-mono text-[#e5e7eb]">{item.symbol}</span>
                          <span className="truncate pl-3 text-[#6b7280]">{item.name || item.exchange || ''}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </form>

                <div className="inline-flex rounded-xl border border-white/10 bg-black/50 p-1">
                  {PERIOD_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setPeriod(option.id)}
                      className={`rounded-lg px-3 py-1.5 text-xs transition ${
                        period === option.id
                          ? 'bg-[#3b82f6] text-white'
                          : 'text-[#9ca3af] hover:text-[#e5e7eb]'
                      }`}
                    >
                      {option.label}
                    </button>
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

            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
              <StatCard
                label="Price"
                value={livePrice !== null ? formatCurrency(livePrice) : quoteLoading ? '...' : '--'}
                subvalue={quoteError ? quoteError : liveQuote ? `Live • ${new Date(liveQuote.timestamp * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : connected ? 'Connecting...' : 'Market data loading'}
                tone="accent"
              />
              <StatCard
                label="Change"
                value={quote?.change_percent !== null && quote?.change_percent !== undefined ? formatSignedPercent(quote.change_percent) : '--'}
                tone={getToneFromChange(quote?.change_percent)}
              />
              <StatCard
                label="Market Cap"
                value={stats?.market_cap ? formatCompactNumber(stats.market_cap) : '--'}
              />
              <StatCard
                label="P/E"
                value={stats?.pe_ratio !== null && stats?.pe_ratio !== undefined ? Number(stats.pe_ratio).toFixed(2) : '--'}
              />
              <StatCard
                label="52W Range"
                value={
                  stats?.fifty_two_week_low !== null && stats?.fifty_two_week_high !== null
                    ? `${formatCurrency(stats.fifty_two_week_low)} - ${formatCurrency(stats.fifty_two_week_high)}`
                    : '--'
                }
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-xl border px-3 py-1.5 text-xs transition ${
                  activeTab === tab.id
                    ? 'border-[#3b82f6] bg-[#3b82f6]/20 text-[#dbeafe]'
                    : 'border-white/10 bg-black/40 backdrop-blur-sm text-[#9ca3af] hover:text-[#e5e7eb]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-4 flex-1 overflow-y-auto pb-4">
            {activeTab === 'income' ? <IncomeTab symbol={symbol} period={period} /> : null}
            {activeTab === 'balance' ? <BalanceTab symbol={symbol} period={period} /> : null}
            {activeTab === 'cashflow' ? <CashFlowTab symbol={symbol} period={period} /> : null}
            {activeTab === 'stats' ? <KeyStatsTab symbol={symbol} /> : null}
          </div>
        </div>
      </div>
    );
  } catch (error) {
    console.error('[xray/page] Render error:', error);
    return (
      <div className="h-screen overflow-hidden bg-transparent text-white">
        <div className="mx-auto flex h-full w-full max-w-[1600px] items-center justify-center px-4 py-4 md:px-6 md:py-5">
          <div className="w-full max-w-xl rounded-2xl border border-red-500/30 bg-black/40 backdrop-blur-sm p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-red-300">X-Ray Error</p>
            <p className="mt-2 text-sm text-[#e5e7eb]">
              {getErrorMessage(error, 'Unable to render this X-Ray page right now.')}
            </p>
            <button
              type="button"
              onClick={handleGoBack}
              className="mt-4 inline-flex items-center rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[#e5e7eb] transition hover:border-white/25"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }
}
