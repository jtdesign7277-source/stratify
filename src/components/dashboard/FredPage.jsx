import React, { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  ChevronDown,
  LineChart,
  Percent,
  Search,
  Thermometer,
  TrendingUp,
  Users
} from 'lucide-react';

const FRED_PROXY = '/api/fred';

// Quick access popular FRED series
const QUICK_ACCESS_SERIES = [
  {
    keyword: 'unemployment',
    label: 'Unemployment',
    symbol: 'FRED:UNRATE',
    description: 'UNRATE, state unemployment rates',
  },
  {
    keyword: 'inflation',
    label: 'Inflation',
    symbol: 'FRED:CPIAUCSL',
    description: 'CPI, PCE, inflation expectations',
  },
  {
    keyword: 'GDP',
    label: 'GDP',
    symbol: 'FRED:GDP',
    description: 'Gross domestic product, real GDP, GDP growth',
  },
  {
    keyword: 'fed funds rate',
    label: 'Fed Funds',
    symbol: 'FRED:FEDFUNDS',
    description: 'Federal Reserve interest rate',
  },
  {
    keyword: 'housing starts',
    label: 'Housing',
    symbol: 'FRED:HOUST',
    description: 'New residential construction',
  },
  {
    keyword: 'consumer confidence',
    label: 'Confidence',
    symbol: 'FRED:UMCSENT',
    description: 'Consumer sentiment surveys',
  },
  {
    keyword: 'oil price',
    label: 'Oil',
    symbol: 'FRED:DCOILWTICO',
    description: 'Crude oil, WTI, Brent',
  },
  {
    keyword: 'S&P 500',
    label: 'S&P 500',
    symbol: 'SP:SPX',
    description: 'Stock market index',
  },
  {
    keyword: 'money supply',
    label: 'Money Supply',
    symbol: 'FRED:M2SL',
    description: 'M1, M2 monetary aggregates',
  },
  {
    keyword: 'wage growth',
    label: 'Wages',
    symbol: 'FRED:CES0500000003',
    description: 'Average hourly earnings',
  },
  {
    keyword: 'retail sales',
    label: 'Retail Sales',
    symbol: 'FRED:RSXFS',
    description: 'Consumer spending data',
  },
  {
    keyword: 'treasury yield',
    label: 'Treasury',
    symbol: 'FRED:DGS10',
    description: '10Y, 2Y, 30Y bonds',
  },
];

const MACRO_SERIES = {
  fedFunds: 'FEDFUNDS',
  cpi: 'CPIAUCSL',
  unemployment: 'UNRATE',
  gdp: 'GDP',
  tenY: 'DGS10',
  sp500: 'SP500',
};

const MINI_CHART_SRC = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
const ADVANCED_CHART_SRC = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
const ECON_CALENDAR_SRC = 'https://s3.tradingview.com/external-embedding/embed-widget-events.js';
const SYMBOL_OVERVIEW_SRC = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js';
const FOREX_CROSS_RATES_SRC = 'https://s3.tradingview.com/external-embedding/embed-widget-forex-cross-rates.js';

const formatNumber = (value, decimals = 2) => {
  if (!Number.isFinite(value)) return '--';
  return Number(value).toFixed(decimals);
};

const formatCompact = (value) => {
  if (!Number.isFinite(value)) return '--';
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value);
};

const formatPercent = (value, decimals = 2) => {
  if (!Number.isFinite(value)) return '--';
  const sign = value > 0 ? '+' : value < 0 ? '' : '';
  return `${sign}${Number(value).toFixed(decimals)}%`;
};

const parseObservations = (observations = []) => observations
  .map((entry) => ({
    date: entry.date,
    value: Number(entry.value),
  }))
  .filter((entry) => Number.isFinite(entry.value));

const fetchSeries = async (seriesId) => {
  const res = await fetch(`${FRED_PROXY}?series_id=${encodeURIComponent(seriesId)}`);
  if (!res.ok) throw new Error('FRED fetch failed');
  const data = await res.json();
  return data.observations || [];
};

const searchFred = async (query) => {
  const res = await fetch(`${FRED_PROXY}?endpoint=search&search_text=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('FRED search failed');
  const data = await res.json();
  return data.seriess || data.series || [];
};

const CountUpValue = ({ value, format = (val) => formatNumber(val, 2), className }) => {
  const [display, setDisplay] = useState(() => (Number.isFinite(value) ? format(value) : '--'));
  const previous = useRef(Number.isFinite(value) ? value : 0);
  const formatRef = useRef(format);

  useEffect(() => {
    formatRef.current = format;
  }, [format]);

  useEffect(() => {
    if (!Number.isFinite(value)) {
      setDisplay('--');
      previous.current = 0;
      return undefined;
    }

    const from = Number.isFinite(previous.current) ? previous.current : 0;
    const to = value;
    const duration = 800;
    let start;
    let raf;

    const step = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * eased;
      setDisplay(formatRef.current(current));
      if (progress < 1) {
        raf = requestAnimationFrame(step);
      }
    };

    raf = requestAnimationFrame(step);
    previous.current = value;

    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [value]);

  return <span className={className}>{display}</span>;
};

const ErrorState = ({ onRetry }) => (
  <div className="h-full w-full flex flex-col items-center justify-center gap-3 text-sm text-gray-500">
    <span>Data unavailable</span>
    <button
      onClick={onRetry}
      className="px-3 py-1.5 rounded-lg border border-blue-500/30 bg-[rgba(6,13,24,0.6)] backdrop-blur-sm text-gray-300 hover:text-white hover:border-blue-400/70 transition"
    >
      Retry
    </button>
  </div>
);

class FredErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
    this.handleReload = this.handleReload.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: error?.message || 'Unexpected error' };
  }

  componentDidCatch(error, info) {
    console.error('FRED render failed', error, info);
  }

  handleReload() {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full bg-transparent text-white overflow-hidden relative flex items-center justify-center">
          <div className="rounded-2xl border border-blue-500/25 bg-[rgba(6,13,24,0.6)] backdrop-blur-md px-6 py-5 text-center flex flex-col items-center gap-3">
            <span className="text-[11px] uppercase tracking-[0.3em] text-gray-400">FRED failed to load</span>
            {this.state.errorMessage ? (
              <span className="text-[11px] text-gray-500">{this.state.errorMessage}</span>
            ) : null}
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-lg border border-blue-500/30 bg-[rgba(6,13,24,0.6)] backdrop-blur-sm text-gray-200 hover:text-white hover:border-blue-400/70 transition"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const SkeletonBlock = ({ className }) => (
  <div className={`animate-pulse rounded-md bg-gray-800/70 ${className}`} />
);

const TradingViewWidget = memo(({ scriptSrc, config }) => {
  const containerRef = useRef(null);
  const configJson = useMemo(() => JSON.stringify(config), [config]);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    containerRef.current.innerHTML = '';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = '100%';
    widgetDiv.style.width = '100%';
    containerRef.current.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.src = scriptSrc;
    script.async = true;
    script.type = 'text/javascript';
    script.innerHTML = configJson;
    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [scriptSrc, configJson]);

  return (
    <div
      className="tradingview-widget-container"
      ref={containerRef}
      style={{ height: '100%', width: '100%' }}
    />
  );
});

const MiniChart = ({ symbol }) => {
  const config = useMemo(() => ({
    symbol,
    width: '100%',
    height: '100%',
    locale: 'en',
    dateRange: '1M',
    colorTheme: 'dark',
    isTransparent: true,
    autosize: true,
    largeChartUrl: '',
  }), [symbol]);

  return <TradingViewWidget scriptSrc={MINI_CHART_SRC} config={config} />;
};

const MacroPulse = ({ cards, loading, error, onRetry }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-blue-500/25 bg-[rgba(6,13,24,0.6)] backdrop-blur-md p-3">
            <SkeletonBlock className="h-3 w-20 mb-3" />
            <SkeletonBlock className="h-6 w-24 mb-2" />
            <SkeletonBlock className="h-3 w-14" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-blue-500/25 bg-[rgba(6,13,24,0.6)] backdrop-blur-md p-4">
        <ErrorState onRetry={onRetry} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-6 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-blue-500/25 bg-[rgba(6,13,24,0.6)] backdrop-blur-md p-3 flex flex-col justify-between min-h-[80px]"
        >
          <div className="flex items-center justify-between text-gray-400 text-[11px] uppercase tracking-widest">
            <span>{card.label}</span>
            {(() => {
              const Icon = card.icon || LineChart;
              return <Icon className="w-4 h-4" strokeWidth={1.5} fill="none" />;
            })()}
          </div>
          <div className="mt-2 flex items-end justify-between gap-2">
            <div>
              <div className="text-blue-500 text-lg font-semibold">
                <CountUpValue value={card.value} format={card.format} />
              </div>
              {card.subline && (
                <div className="flex items-center gap-1 text-[11px] text-gray-400">
                  {card.trend && (
                    <card.trend
                      className={`w-3.5 h-3.5 ${card.trendColor}`}
                      strokeWidth={1.5}
                      fill="none"
                    />
                  )}
                  {card.dotColor && <span className={`w-2 h-2 rounded-full ${card.dotColor}`} />}
                  <span>{card.subline}</span>
                </div>
              )}
            </div>
          </div>
          {card.symbol && (
            <div className="mt-2 h-8 rounded-lg border border-blue-500/20 bg-[rgba(8,20,38,0.45)] backdrop-blur-sm overflow-hidden">
              <MiniChart symbol={card.symbol} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const YieldCurve = ({ activeSymbol, activeLabel, onSelectSymbol }) => {
  const yieldTabs = useMemo(() => ([
    { label: '10Y', symbol: 'FRED:DGS10', title: '10Y Treasury' },
    { label: '5Y', symbol: 'FRED:DGS5', title: '5Y Treasury' },
    { label: '30Y', symbol: 'FRED:DGS30', title: '30Y Treasury' },
    { label: '2Y', symbol: 'FRED:DGS2', title: '2Y Treasury' },
  ]), []);

  const config = useMemo(() => ({
    autosize: true,
    symbol: activeSymbol,
    interval: 'D',
    timezone: 'America/New_York',
    theme: 'dark',
    style: '3',
    locale: 'en',
    backgroundColor: 'rgba(6, 13, 24, 1)',
    gridColor: 'rgba(31, 41, 55, 0.3)',
    hide_top_toolbar: false,
    hide_legend: false,
    save_image: false,
    hide_volume: true,
    allow_symbol_change: false,
    enable_publishing: false,
    withdateranges: true,
    toolbar_bg: '#060d18',
    support_host: 'https://www.tradingview.com',
    isTransparent: true,
    studies: [],
  }), [activeSymbol]);

  return (
    <div className="h-full rounded-2xl border border-blue-500/25 bg-[rgba(6,13,24,0.6)] backdrop-blur-md p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-400" strokeWidth={1.5} fill="none" />
          <span className="text-white text-sm font-semibold">{activeLabel || 'Treasury Yields'}</span>
        </div>
        <div className="flex items-center gap-2">
          {yieldTabs.map((tab) => (
            <button
              key={tab.symbol}
              onClick={() => onSelectSymbol(tab.symbol, tab.title)}
              className={`px-2.5 py-1 rounded-full text-[10px] border ${
                activeSymbol === tab.symbol
                  ? 'border-blue-400/70 text-blue-200 bg-blue-500/15'
                  : 'border-blue-500/25 text-gray-400 bg-[rgba(6,13,24,0.4)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-container flex-1 min-h-0 rounded-xl border border-blue-500/20 bg-[rgba(8,20,38,0.45)] backdrop-blur-sm overflow-hidden">
        <TradingViewWidget scriptSrc={ADVANCED_CHART_SRC} config={config} />
      </div>
    </div>
  );
};

const EconCalendar = ({ collapsed, onToggle }) => {
  const config = useMemo(() => ({
    colorTheme: 'dark',
    isTransparent: true,
    width: '100%',
    height: 900,
    locale: 'en',
    importanceFilter: '-1,0,1',
    countryFilter: 'us',
  }), []);

  return (
    <div
      className={`rounded-2xl border border-blue-500/25 bg-[rgba(6,13,24,0.6)] backdrop-blur-md flex flex-col ${
        collapsed ? 'h-[64px] p-3' : 'flex-1 p-4'
      }`}
    >
      <div className={`flex items-center justify-between gap-2 ${collapsed ? 'mb-0' : 'mb-3'}`}>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-400" strokeWidth={1.5} fill="none" />
          <span className="text-white text-sm font-semibold">Economic Calendar</span>
        </div>
        <button
          onClick={onToggle}
          className="p-1 rounded-md border border-blue-500/25 text-gray-400 hover:text-white transition"
          aria-label={collapsed ? 'Expand calendar' : 'Collapse calendar'}
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform ${collapsed ? '-rotate-90' : 'rotate-0'}`}
            strokeWidth={1.5}
            fill="none"
          />
        </button>
      </div>
      {!collapsed && (
        <div className="chart-container flex-1 min-h-0 rounded-xl border border-blue-500/20 bg-[rgba(8,20,38,0.45)] backdrop-blur-sm overflow-hidden">
          <div className="relative h-full overflow-y-auto">
            <div className="sticky top-0 z-10 h-8 bg-[rgba(8,20,38,0.65)] backdrop-blur-sm" />
            <TradingViewWidget scriptSrc={ECON_CALENDAR_SRC} config={config} />
          </div>
        </div>
      )}
    </div>
  );
};

const HistoricalTrends = () => {
  const config = useMemo(() => ({
    symbols: [
      ['Unemployment', 'FRED:UNRATE|12M'],
      ['Inflation (CPI)', 'FRED:CPIAUCSL|12M'],
      ['GDP', 'FRED:GDP|12M'],
      ['Fed Funds', 'FRED:FEDFUNDS|12M'],
      ['Initial Claims', 'FRED:ICSA|12M'],
    ],
    grids: [{ color: 'rgba(31, 41, 55, 0.3)' }],
    chartOnly: false,
    width: '100%',
    height: '100%',
    locale: 'en',
    colorTheme: 'dark',
    autosize: true,
    showVolume: false,
    showMA: false,
    hideDateRanges: false,
    hideMarketStatus: true,
    hideSymbolLogo: false,
    scalePosition: 'right',
    scaleMode: 'Normal',
    fontFamily: '-apple-system, BlinkMacSystemFont, Trebuchet MS, Roboto, Ubuntu, sans-serif',
    fontSize: '10',
    noTimeScale: false,
    valuesTracking: '1',
    changeMode: 'price-and-percent',
    chartType: 'area',
    lineWidth: 2,
    lineType: 0,
    dateRanges: ['1m|1D', '3m|1D', '12m|1W', '60m|1W', 'all|1M'],
    lineColor: 'rgba(59, 130, 246, 1)',
    topColor: 'rgba(59, 130, 246, 0.3)',
    bottomColor: 'rgba(59, 130, 246, 0.02)',
    isTransparent: true,
  }), []);

  return (
    <div className="h-full rounded-2xl border border-blue-500/25 bg-[rgba(6,13,24,0.6)] backdrop-blur-md p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-blue-400" strokeWidth={1.5} fill="none" />
        <span className="text-white text-sm font-semibold">Trends</span>
      </div>
      <div className="chart-container flex-1 min-h-0 rounded-xl border border-blue-500/20 bg-[rgba(8,20,38,0.45)] backdrop-blur-sm overflow-hidden">
        <TradingViewWidget scriptSrc={SYMBOL_OVERVIEW_SRC} config={config} />
      </div>
    </div>
  );
};

const MARKET_OVERVIEW_TABS = [
  {
    id: 'indices',
    label: 'Indices',
    symbols: [
      ['S&P 500', 'SP:SPX|1D'],
      ['Nasdaq 100', 'NASDAQ:NDX|1D'],
      ['Dow Jones', 'DJ:DJI|1D'],
      ['Russell 2000', 'TVC:RUT|1D'],
      ['VIX', 'CBOE:VIX|1D'],
    ],
  },
  {
    id: 'bonds',
    label: 'Bonds',
    symbols: [
      ['US 2Y', 'TVC:US02Y|1D'],
      ['US 5Y', 'TVC:US05Y|1D'],
      ['US 10Y', 'TVC:US10Y|1D'],
      ['US 30Y', 'TVC:US30Y|1D'],
      ['TLT', 'NASDAQ:TLT|1D'],
    ],
  },
  {
    id: 'commodities',
    label: 'Commodities',
    symbols: [
      ['Gold', 'TVC:GOLD|1D'],
      ['Silver', 'TVC:SILVER|1D'],
      ['Crude Oil', 'TVC:USOIL|1D'],
      ['Natural Gas', 'TVC:NATGAS|1D'],
      ['Copper', 'TVC:COPPER|1D'],
    ],
  },
];

const MarketOverviewPanel = () => {
  const [activeTab, setActiveTab] = useState('indices');

  const activeConfig = useMemo(
    () => MARKET_OVERVIEW_TABS.find((tab) => tab.id === activeTab) || MARKET_OVERVIEW_TABS[0],
    [activeTab],
  );

  const config = useMemo(() => ({
    symbols: activeConfig.symbols,
    chartOnly: false,
    width: '100%',
    height: '100%',
    locale: 'en',
    colorTheme: 'dark',
    autosize: true,
    showVolume: false,
    showMA: false,
    hideDateRanges: true,
    hideMarketStatus: false,
    hideSymbolLogo: false,
    scalePosition: 'right',
    scaleMode: 'Normal',
    fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: '10',
    noTimeScale: false,
    valuesTracking: '1',
    changeMode: 'price-and-percent',
    chartType: 'line',
    lineWidth: 2,
    lineColor: 'rgba(56, 189, 248, 0.95)',
    topColor: 'rgba(56, 189, 248, 0.22)',
    bottomColor: 'rgba(56, 189, 248, 0.03)',
    isTransparent: true,
  }), [activeConfig]);

  return (
    <div className="h-full rounded-2xl border border-blue-500/25 bg-[rgba(6,13,24,0.6)] backdrop-blur-md p-4 flex flex-col">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-400" strokeWidth={1.5} fill="none" />
          <span className="text-white text-sm font-semibold">Market Overview</span>
        </div>
        <div className="flex items-center gap-2">
          {MARKET_OVERVIEW_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-2.5 py-1 rounded-full text-[10px] border transition ${
                activeTab === tab.id
                  ? 'border-blue-400/70 text-blue-200 bg-blue-500/15'
                  : 'border-blue-500/25 text-gray-400 bg-[rgba(6,13,24,0.4)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 flex-1 min-h-0 rounded-xl border border-blue-500/20 bg-[rgba(8,20,38,0.45)] backdrop-blur-sm overflow-hidden">
        <TradingViewWidget scriptSrc={SYMBOL_OVERVIEW_SRC} config={config} />
      </div>
    </div>
  );
};

const ForexCrossRatesPanel = () => {
  const config = useMemo(() => ({
    width: '100%',
    height: '100%',
    currencies: ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD'],
    isTransparent: true,
    colorTheme: 'dark',
    locale: 'en',
  }), []);

  return (
    <div className="h-full rounded-2xl border border-blue-500/25 bg-[rgba(6,13,24,0.6)] backdrop-blur-md p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <Percent className="w-4 h-4 text-blue-400" strokeWidth={1.5} fill="none" />
        <span className="text-white text-sm font-semibold">Forex Cross Rates</span>
      </div>
      <div className="flex-1 min-h-0 rounded-xl border border-blue-500/20 bg-[rgba(8,20,38,0.45)] backdrop-blur-sm overflow-hidden">
        <TradingViewWidget scriptSrc={FOREX_CROSS_RATES_SRC} config={config} />
      </div>
    </div>
  );
};

const FredSearch = ({ onSelectSymbol, collapsed, onToggle }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const debounceRef = useRef(null);

  const runSearch = useCallback((text) => {
    if (!text.trim()) {
      setResults([]);
      setLoading(false);
      setError(false);
      return;
    }

    setLoading(true);
    setError(false);

    searchFred(text)
      .then((data) => setResults(data.slice(0, 6)))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch(query);
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  return (
    <div
      className={`rounded-2xl border border-blue-500/25 bg-[rgba(6,13,24,0.6)] backdrop-blur-md flex flex-col ${
        collapsed ? 'h-[64px] p-3' : 'flex-1 p-4'
      }`}
    >
      <div className={`flex items-center justify-between gap-2 ${collapsed ? 'mb-0' : 'mb-4'}`}>
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-blue-400" strokeWidth={1.5} fill="none" />
          <span className="text-white text-sm font-semibold">Explore</span>
        </div>
        <button
          onClick={onToggle}
          className="p-1 rounded-md border border-blue-500/25 text-gray-400 hover:text-white transition"
          aria-label={collapsed ? 'Expand explore' : 'Collapse explore'}
        >
          <ChevronDown
            className={`w-4 h-4 transition-transform ${collapsed ? '-rotate-90' : 'rotate-0'}`}
            strokeWidth={1.5}
            fill="none"
          />
        </button>
      </div>
      {!collapsed && (
        <>
          <div className="flex items-center gap-2 bg-[rgba(8,20,38,0.45)] border border-blue-500/20 rounded-xl px-3 py-2 mb-3 backdrop-blur-sm">
            <Search className="w-4 h-4 text-gray-400" strokeWidth={1.5} fill="none" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search FRED series"
              className="flex-1 bg-transparent outline-none text-sm text-white placeholder-gray-500"
            />
            <kbd className="text-[10px] text-gray-500 border border-gray-700/60 rounded px-1.5 py-0.5">CMD K</kbd>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <SkeletonBlock key={index} className="h-12 w-full" />
                ))}
              </div>
            ) : error ? (
              <ErrorState onRetry={() => runSearch(query)} />
            ) : results.length === 0 ? (
              <div className="space-y-3">
                <div className="text-xs text-gray-500">Quick access to popular indicators:</div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_ACCESS_SERIES.map((item) => (
                    <button
                      key={item.keyword}
                      onClick={() => {
                        setQuery(item.keyword);
                        if (item.symbol) {
                          onSelectSymbol(item.symbol, item.label);
                        }
                      }}
                      className="px-2.5 py-1.5 text-xs rounded-lg border border-blue-500/25 bg-[rgba(8,20,38,0.45)] backdrop-blur-sm hover:bg-blue-500/20 hover:border-blue-400/60 transition-all text-gray-300 hover:text-blue-200"
                      title={item.description}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {results.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onSelectSymbol(`FRED:${item.id}`, item.title || item.id)}
                    className="w-full text-left px-3 py-2 rounded-xl border border-blue-500/20 bg-[rgba(8,20,38,0.45)] backdrop-blur-sm hover:bg-[rgba(18,32,58,0.7)] transition"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-blue-400 font-semibold">{item.id}</div>
                        <div className="text-sm text-white truncate">{item.title}</div>
                        <div className="text-[11px] text-gray-500">{item.frequency} - Updated {item.last_updated ? item.last_updated.split(' ')[0] : '--'}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const useFredSeries = (seriesIds) => {
  const [seriesMap, setSeriesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const results = await Promise.all(seriesIds.map((id) => fetchSeries(id)));
      const next = {};
      seriesIds.forEach((id, index) => {
        next[id] = results[index];
      });
      setSeriesMap(next);
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [seriesIds]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return { seriesMap, loading, error, reload: fetchAll };
};

const buildMacroCards = (seriesMap) => {
  const fed = parseObservations(seriesMap[MACRO_SERIES.fedFunds] || []);
  const cpi = parseObservations(seriesMap[MACRO_SERIES.cpi] || []);
  const unrate = parseObservations(seriesMap[MACRO_SERIES.unemployment] || []);
  const gdp = parseObservations(seriesMap[MACRO_SERIES.gdp] || []);
  const tenY = parseObservations(seriesMap[MACRO_SERIES.tenY] || []);
  const sp500 = parseObservations(seriesMap[MACRO_SERIES.sp500] || []);

  const fedLatest = fed[0]?.value;
  const fedPrev = fed[1]?.value;
  const fedChange = Number.isFinite(fedLatest) && Number.isFinite(fedPrev) ? fedLatest - fedPrev : null;
  const fedTrend = fedChange > 0 ? ArrowUpRight : fedChange < 0 ? ArrowDownRight : null;

  const cpiLatest = cpi[0]?.value;
  const cpiPrevYear = cpi[12]?.value;
  const cpiYoY = Number.isFinite(cpiLatest) && Number.isFinite(cpiPrevYear)
    ? ((cpiLatest - cpiPrevYear) / cpiPrevYear) * 100
    : null;

  const unrateLatest = unrate[0]?.value;
  const unrateDot = Number.isFinite(unrateLatest)
    ? unrateLatest < 4
      ? 'bg-emerald-400'
      : unrateLatest < 6
        ? 'bg-amber-400'
        : 'bg-red-400'
    : 'bg-gray-600';

  const gdpLatest = gdp[0]?.value;
  const gdpPrev = gdp[1]?.value;
  const gdpGrowth = Number.isFinite(gdpLatest) && Number.isFinite(gdpPrev)
    ? ((gdpLatest - gdpPrev) / gdpPrev) * 100
    : null;

  const tenYLatest = tenY[0]?.value;
  const tenYPrev = tenY[1]?.value;
  const tenYChange = Number.isFinite(tenYLatest) && Number.isFinite(tenYPrev) ? tenYLatest - tenYPrev : null;
  const tenYTrend = tenYChange > 0 ? ArrowUpRight : tenYChange < 0 ? ArrowDownRight : null;

  const spLatest = sp500[0]?.value;

  return [
    {
      label: 'Fed Funds Rate',
      icon: Percent,
      symbol: 'FRED:FEDFUNDS',
      value: fedLatest,
      format: (val) => `${formatNumber(val, 2)}%`,
      trend: fedTrend,
      trendColor: fedChange >= 0 ? 'text-emerald-400' : 'text-red-400',
      subline: Number.isFinite(fedChange) ? `${formatPercent(fedChange, 2)} vs last` : 'Latest',
    },
    {
      label: 'CPI Inflation',
      icon: Thermometer,
      symbol: 'FRED:CPIAUCSL',
      value: cpiYoY,
      format: (val) => `${formatNumber(val, 2)}%`,
      subline: 'YoY change',
    },
    {
      label: 'Unemployment',
      icon: Users,
      symbol: 'FRED:UNRATE',
      value: unrateLatest,
      format: (val) => `${formatNumber(val, 2)}%`,
      dotColor: unrateDot,
      subline: 'Rate',
    },
    {
      label: 'GDP Growth',
      icon: BarChart3,
      symbol: 'FRED:GDP',
      value: gdpGrowth,
      format: (val) => `${formatNumber(val, 2)}%`,
      subline: 'QoQ',
    },
    {
      label: '10Y Treasury',
      icon: TrendingUp,
      symbol: 'TVC:US10Y',
      value: tenYLatest,
      format: (val) => `${formatNumber(val, 2)}%`,
      trend: tenYTrend,
      trendColor: tenYChange >= 0 ? 'text-emerald-400' : 'text-red-400',
      subline: Number.isFinite(tenYChange) ? `${formatPercent(tenYChange, 2)} today` : 'Latest',
    },
    {
      label: 'S&P 500 ($SPX)',
      icon: LineChart,
      symbol: 'SP:SPX',
      value: spLatest,
      format: (val) => formatCompact(val),
      subline: 'Index',
    },
  ];
};

const FredPage = () => {
  const seriesIds = useMemo(() => [
    ...Object.values(MACRO_SERIES),
  ].filter((value, index, array) => array.indexOf(value) === index), []);

  const { seriesMap, loading, error, reload } = useFredSeries(seriesIds);
  const [calendarCollapsed, setCalendarCollapsed] = useState(true);
  const [exploreCollapsed, setExploreCollapsed] = useState(false);
  const [activeSymbol, setActiveSymbol] = useState('FRED:DGS10');
  const [activeLabel, setActiveLabel] = useState('10Y Treasury');

  const handleSelectSymbol = useCallback((symbol, label) => {
    setActiveSymbol(symbol);
    if (label) setActiveLabel(label);
  }, []);

  const macroCards = useMemo(() => buildMacroCards(seriesMap), [seriesMap]);
  return (
    <FredErrorBoundary>
      <div className="h-full w-full bg-transparent text-white overflow-hidden relative">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage: 'linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="relative z-10 h-full p-6 grid grid-rows-[80px_minmax(0,1fr)_minmax(220px,0.58fr)] gap-3">
          <div className="h-[80px]">
            <MacroPulse cards={macroCards} loading={loading} error={error} onRetry={reload} />
          </div>
          <div className="grid grid-cols-[minmax(0,2.4fr)_minmax(0,1fr)] gap-3 min-h-0">
            <div className="min-h-0">
              <YieldCurve
                activeSymbol={activeSymbol}
                activeLabel={activeLabel}
                onSelectSymbol={handleSelectSymbol}
              />
            </div>
            <div className="min-h-0 flex flex-col gap-3">
              <FredSearch
                onSelectSymbol={handleSelectSymbol}
                collapsed={exploreCollapsed}
                onToggle={() => setExploreCollapsed((prev) => !prev)}
              />
              <div className="flex-1 min-h-0">
                <EconCalendar
                  collapsed={calendarCollapsed}
                  onToggle={() => setCalendarCollapsed((prev) => !prev)}
                />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-3 min-h-0">
            <MarketOverviewPanel />
            <ForexCrossRatesPanel />
          </div>
        </div>
      </div>
    </FredErrorBoundary>
  );
};

export default FredPage;
