import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, RefreshCcw } from 'lucide-react';
import { applyStratifyTheme } from '../../styles/highcharts-theme';
import { Highcharts } from './charts/ChartWrapper';
import IncomeTab from './IncomeTab';
import BalanceTab from './BalanceTab';
import CashFlowTab from './CashFlowTab';
import KeyStatsTab from './KeyStatsTab';
import StatCard from './StatCard';
import {
  useIncomeStatement,
  useBalanceSheet,
  useCashFlow,
  useStatistics,
  useQuote,
} from './hooks/useTwelveData';
import { useTwelveDataWS } from './hooks/useTwelveDataWS';

const TABS = [
  { id: 'income', label: 'Income Statement' },
  { id: 'balance', label: 'Balance Sheet' },
  { id: 'cashflow', label: 'Cash Flow' },
  { id: 'stats', label: 'Key Stats' },
];

const normalizeSymbol = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.:-]/g, '')
    .slice(0, 24);

const formatPrice = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(
    parsed
  );
};

const formatChange = (change, pct) => {
  const c = Number(change);
  const p = Number(pct);
  if (!Number.isFinite(c) || !Number.isFinite(p)) return '—';
  const sign = c >= 0 ? '+' : '';
  return `${sign}${c.toFixed(2)} (${sign}${p.toFixed(2)}%)`;
};

const formatCompactCurrency = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(parsed);
};

const formatMultiple = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '—';
  return `${parsed.toFixed(2)}x`;
};

const formatPercent = (value, scale = 100) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '—';
  return `${(parsed * scale).toFixed(2)}%`;
};

export default function XRayPage({ initialSymbol = 'TSLA', onSymbolChange }) {
  const [symbol, setSymbol] = useState(normalizeSymbol(initialSymbol) || 'TSLA');
  const [symbolInput, setSymbolInput] = useState(normalizeSymbol(initialSymbol) || 'TSLA');
  const [period, setPeriod] = useState('annual');
  const [activeTab, setActiveTab] = useState('income');

  const themeApplied = useRef(false);

  const income = useIncomeStatement(symbol, period);
  const balance = useBalanceSheet(symbol, period);
  const cashFlow = useCashFlow(symbol, period);
  const stats = useStatistics(symbol);
  const quote = useQuote(symbol);

  const { prices, connected, subscribe, unsubscribe } = useTwelveDataWS();

  useEffect(() => {
    if (themeApplied.current) return;
    applyStratifyTheme(Highcharts);
    themeApplied.current = true;
  }, []);

  useEffect(() => {
    const normalized = normalizeSymbol(initialSymbol);
    if (!normalized || normalized === symbol) return;
    setSymbol(normalized);
    setSymbolInput(normalized);
  }, [initialSymbol, symbol]);

  useEffect(() => {
    if (!connected || !symbol) return;
    subscribe([symbol]);
    return () => unsubscribe([symbol]);
  }, [connected, subscribe, symbol, unsubscribe]);

  const liveQuote = prices[symbol] || null;
  const quoteData = quote.data || {};
  const statsData = stats.data || null;

  const displayPrice =
    Number.isFinite(Number(liveQuote?.price))
      ? Number(liveQuote.price)
      : Number.isFinite(Number(quoteData?.price))
        ? Number(quoteData.price)
        : null;

  const changeValue = Number.isFinite(Number(quoteData?.change)) ? Number(quoteData.change) : null;
  const changePct = Number.isFinite(Number(quoteData?.change_percent)) ? Number(quoteData.change_percent) : null;

  const isLoadingAny =
    income.loading || balance.loading || cashFlow.loading || stats.loading || quote.loading;

  const activeTabContent = useMemo(() => {
    if (activeTab === 'income') return <IncomeTab incomeRows={income.data || []} />;
    if (activeTab === 'balance') return <BalanceTab balanceRows={balance.data || []} />;
    if (activeTab === 'cashflow') return <CashFlowTab cashFlowRows={cashFlow.data || []} />;
    return <KeyStatsTab stats={statsData} />;
  }, [activeTab, balance.data, cashFlow.data, income.data, statsData]);

  const handleSubmitSymbol = (event) => {
    event.preventDefault();
    const normalized = normalizeSymbol(symbolInput);
    if (!normalized) return;
    setSymbol(normalized);
    setSymbolInput(normalized);
    if (typeof onSymbolChange === 'function') {
      onSymbolChange(normalized);
    }
  };

  const refetchAll = () => {
    income.refetch();
    balance.refetch();
    cashFlow.refetch();
    stats.refetch();
    quote.refetch();
  };

  return (
    <div className="min-h-screen bg-[#060d18] text-white">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-5 md:py-6 space-y-4">
        <div className="rounded-xl border border-white/10 bg-[#0a1628] p-4 md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-blue-300/80">X-Ray Fundamentals</div>
              <div className="mt-1 flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-semibold" style={{ fontFamily: "'SF Mono', monospace" }}>
                  {symbol}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${
                    connected
                      ? 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10'
                      : 'text-amber-300 border-amber-400/40 bg-amber-500/10'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                  {connected ? 'Live stream' : 'Delayed'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <form onSubmit={handleSubmitSymbol} className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    value={symbolInput}
                    onChange={(event) => setSymbolInput(event.target.value.toUpperCase())}
                    placeholder="Search ticker (e.g. TSLA)"
                    className="w-52 rounded-lg border border-white/10 bg-[#0d1b2a] pl-9 pr-3 py-2 text-sm text-gray-100 outline-none focus:border-blue-400/60"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-lg border border-blue-400/40 bg-blue-500/20 px-3 py-2 text-sm font-medium text-blue-100 hover:bg-blue-500/30"
                >
                  Load
                </button>
              </form>

              <div className="inline-flex rounded-lg border border-white/10 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setPeriod('annual')}
                  className={`px-3 py-2 text-sm ${
                    period === 'annual' ? 'bg-blue-500/25 text-blue-100' : 'bg-[#0d1b2a] text-gray-400'
                  }`}
                >
                  Annual
                </button>
                <button
                  type="button"
                  onClick={() => setPeriod('quarterly')}
                  className={`px-3 py-2 text-sm ${
                    period === 'quarterly' ? 'bg-blue-500/25 text-blue-100' : 'bg-[#0d1b2a] text-gray-400'
                  }`}
                >
                  Quarterly
                </button>
              </div>

              <button
                type="button"
                onClick={refetchAll}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#0d1b2a] px-3 py-2 text-sm text-gray-300 hover:text-white"
              >
                <RefreshCcw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <StatCard label="Price" value={formatPrice(displayPrice)} sublabel={liveQuote ? 'WebSocket' : 'Quote'} />
          <StatCard
            label="Day Change"
            value={formatChange(changeValue, changePct)}
            positive={Number.isFinite(changeValue) ? changeValue >= 0 : null}
          />
          <StatCard label="Market Cap" value={formatCompactCurrency(statsData?.market_cap)} />
          <StatCard label="P/E" value={formatMultiple(statsData?.pe_ratio)} />
          <StatCard label="Net Margin" value={formatPercent(statsData?.profit_margin)} />
          <StatCard label="Debt/Equity" value={Number.isFinite(Number(statsData?.debt_to_equity)) ? Number(statsData.debt_to_equity).toFixed(2) : '—'} />
        </div>

        <div className="inline-flex rounded-lg border border-white/10 bg-[#0a1628] p-1 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm rounded-md whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-blue-500/20 text-blue-100 border border-blue-400/30'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoadingAny ? (
          <div className="rounded-xl border border-white/10 bg-[#0a1628] p-10 text-center text-sm text-gray-300">
            Loading fundamentals for {symbol}...
          </div>
        ) : null}

        {!isLoadingAny ? activeTabContent : null}

        {[income.error, balance.error, cashFlow.error, stats.error, quote.error].some(Boolean) ? (
          <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 px-4 py-3 text-sm text-rose-200">
            {income.error || balance.error || cashFlow.error || stats.error || quote.error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
