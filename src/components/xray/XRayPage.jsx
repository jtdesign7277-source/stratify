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

const getToneFromChange = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'default';
  if (numeric > 0) return 'positive';
  if (numeric < 0) return 'negative';
  return 'default';
};

export default function XRayPage({ initialSymbol = 'TSLA', onSymbolChange, onBack }) {
  const [symbolInput, setSymbolInput] = useState(() => normalizeSymbol(initialSymbol) || 'TSLA');
  const [symbol, setSymbol] = useState(() => normalizeSymbol(initialSymbol) || 'TSLA');
  const [activeTab, setActiveTab] = useState('income');
  const [period, setPeriod] = useState('annual');
  const [suggestions, setSuggestions] = useState([]);

  const { data: quote, loading: quoteLoading, error: quoteError } = useQuote(symbol);
  const { data: stats } = useStatistics(symbol);
  const { prices, connected, subscribe, unsubscribe } = useTwelveDataWS();

  useEffect(() => {
    applyStratifyTheme(Highcharts);
  }, []);

  useEffect(() => {
    const normalized = normalizeSymbol(initialSymbol) || 'TSLA';
    setSymbolInput(normalized);
    setSymbol(normalized);
  }, [initialSymbol]);

  useEffect(() => {
    if (!symbol) return undefined;
    subscribe([symbol]);
    return () => unsubscribe([symbol]);
  }, [subscribe, symbol, unsubscribe]);

  useEffect(() => {
    const query = normalizeSymbol(symbolInput);
    if (!query || query.length < 1) {
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
  }, [symbolInput]);

  const liveQuote = prices?.[symbol] || null;

  const livePrice = useMemo(() => {
    if (liveQuote?.price !== null && liveQuote?.price !== undefined && Number.isFinite(liveQuote.price)) {
      return liveQuote.price;
    }
    return quote?.price ?? null;
  }, [liveQuote?.price, quote?.price]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const next = normalizeSymbol(symbolInput);
    if (!next) return;
    setSymbol(next);
    setSuggestions([]);
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
    if (typeof onSymbolChange === 'function') {
      onSymbolChange(next);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-[#060d18] text-white">
      <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col px-4 py-4 md:px-6 md:py-5">
        <div className="rounded-2xl border border-white/10 bg-[#0a1628] p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onBack}
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
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0d1b2a] px-3 py-2">
                  <Search size={14} strokeWidth={1.5} className="text-[#6b7280]" />
                  <input
                    value={symbolInput}
                    onChange={(event) => setSymbolInput(event.target.value.toUpperCase())}
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

                {suggestions.length > 0 ? (
                  <div className="absolute z-20 mt-2 w-full rounded-xl border border-white/10 bg-[#0a1628] p-1 shadow-2xl">
                    {suggestions.map((item) => (
                      <button
                        key={item.symbol}
                        type="button"
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

              <div className="inline-flex rounded-xl border border-white/10 bg-[#0d1b2a] p-1">
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

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard
              label="Price"
              value={livePrice !== null ? formatCurrency(livePrice) : quoteLoading ? '...' : '--'}
              subvalue={quoteError ? quoteError : liveQuote?.timestamp ? `Tick ${liveQuote.timestamp}` : 'Delayed fallback'}
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
                  : 'border-white/10 bg-[#0a1628] text-[#9ca3af] hover:text-[#e5e7eb]'
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
}
