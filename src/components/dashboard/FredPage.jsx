import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Chart from 'react-apexcharts';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  LineChart,
  Percent,
  Search,
  Thermometer,
  TrendingUp,
  Users,
  X
} from 'lucide-react';

const FRED_PROXY = '/api/fred';

// Quick access popular FRED series
const QUICK_ACCESS_SERIES = [
  { keyword: 'unemployment', label: 'Unemployment', description: 'UNRATE, state unemployment rates' },
  { keyword: 'inflation', label: 'Inflation', description: 'CPI, PCE, inflation expectations' },
  { keyword: 'GDP', label: 'GDP', description: 'Gross domestic product, real GDP, GDP growth' },
  { keyword: 'fed funds rate', label: 'Fed Funds', description: 'Federal Reserve interest rate' },
  { keyword: 'housing starts', label: 'Housing', description: 'New residential construction' },
  { keyword: 'consumer confidence', label: 'Confidence', description: 'Consumer sentiment surveys' },
  { keyword: 'oil price', label: 'Oil', description: 'Crude oil, WTI, Brent' },
  { keyword: 'S&P 500', label: 'S&P 500', description: 'Stock market index' },
  { keyword: 'money supply', label: 'Money Supply', description: 'M1, M2 monetary aggregates' },
  { keyword: 'wage growth', label: 'Wages', description: 'Average hourly earnings' },
  { keyword: 'retail sales', label: 'Retail Sales', description: 'Consumer spending data' },
  { keyword: 'treasury yield', label: 'Treasury', description: '10Y, 2Y, 30Y bonds' },
];

const MACRO_SERIES = {
  fedFunds: 'FEDFUNDS',
  cpi: 'CPIAUCSL',
  unemployment: 'UNRATE',
  gdp: 'GDP',
  tenY: 'DGS10',
  sp500: 'SP500',
};

const YIELD_SERIES = [
  { id: 'DGS1MO', label: '1M' },
  { id: 'DGS3MO', label: '3M' },
  { id: 'DGS6MO', label: '6M' },
  { id: 'DGS1', label: '1Y' },
  { id: 'DGS2', label: '2Y' },
  { id: 'DGS3', label: '3Y' },
  { id: 'DGS5', label: '5Y' },
  { id: 'DGS7', label: '7Y' },
  { id: 'DGS10', label: '10Y' },
  { id: 'DGS20', label: '20Y' },
  { id: 'DGS30', label: '30Y' },
];

const TREND_SERIES = {
  unemployment: 'UNRATE',
  inflation: 'CPIAUCSL',
  gdp: 'GDP',
};

const trendOptions = [
  {
    id: 'unemployment',
    label: 'Unemployment',
    stroke: '#06b6d4',
    fill: 'rgba(6,182,212,0.22)'
  },
  {
    id: 'inflation',
    label: 'Inflation (CPI)',
    stroke: '#f97316',
    fill: 'rgba(249,115,22,0.22)'
  },
  {
    id: 'gdp',
    label: 'GDP',
    stroke: '#10b981',
    fill: 'rgba(16,185,129,0.22)'
  }
];

const calendarSchedule = [
  { id: 'cpi', name: 'CPI', offsetDays: 0, previous: '3.1%', consensus: '3.0%' },
  { id: 'ppi', name: 'PPI', offsetDays: 1, previous: '0.4%', consensus: '0.2%' },
  { id: 'retail', name: 'Retail Sales', offsetDays: 3, previous: '0.6%', consensus: '0.4%' },
  { id: 'ism', name: 'ISM', offsetDays: 5, previous: '49.2', consensus: '49.5' },
  { id: 'nfp', name: 'NFP', offsetDays: 7, previous: '216k', consensus: '185k' },
  { id: 'gdp', name: 'GDP', offsetDays: 10, previous: '3.3%', consensus: '2.4%' },
  { id: 'pce', name: 'PCE', offsetDays: 12, previous: '2.8%', consensus: '2.7%' },
  { id: 'fomc', name: 'FOMC', offsetDays: 15, previous: 'Hold', consensus: 'Hold' },
];

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

const formatDate = (value) => {
  if (!value) return '--';
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
};

const chartFont = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';

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
      className="px-3 py-1.5 rounded-lg border border-gray-700/60 bg-[#0a1628] text-gray-300 hover:text-white hover:border-blue-500/60 transition"
    >
      Retry
    </button>
  </div>
);

const InsufficientDataState = () => (
  <div className="h-full w-full flex items-center justify-center text-xs text-gray-500">
    Insufficient data
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
        <div className="h-full w-full bg-[#060d18] text-white overflow-hidden relative flex items-center justify-center">
          <div className="rounded-2xl border border-gray-800/60 bg-[#0a1628] px-6 py-5 text-center flex flex-col items-center gap-3">
            <span className="text-[11px] uppercase tracking-[0.3em] text-gray-400">FRED failed to load</span>
            {this.state.errorMessage ? (
              <span className="text-[11px] text-gray-500">{this.state.errorMessage}</span>
            ) : null}
            <button
              onClick={this.handleReload}
              className="px-4 py-2 rounded-lg border border-gray-700/60 bg-[#0a1628] text-gray-200 hover:text-white hover:border-blue-500/60 transition"
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

const Sparkline = ({ data, stroke = '#3b82f6' }) => {
  const series = useMemo(() => {
    if (!data || data.length < 2) return null;
    return [
      {
        name: 'spark',
        data: data.map((entry) => entry.value),
      },
    ];
  }, [data]);

  const options = useMemo(() => {
    if (!series) return null;
    return {
      chart: {
        type: 'area',
        sparkline: { enabled: true },
        toolbar: { show: false },
        animations: { enabled: true, easing: 'easeinout', speed: 650 },
        dropShadow: {
          enabled: true,
          top: 0,
          left: 0,
          blur: 8,
          opacity: 0.6,
          color: stroke,
        },
        fontFamily: chartFont,
      },
      stroke: {
        curve: 'smooth',
        width: 2.2,
        colors: [stroke],
      },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 0.7,
          opacityFrom: 0.35,
          opacityTo: 0.05,
          stops: [0, 80, 100],
        },
      },
      colors: [stroke],
      grid: { show: false },
      tooltip: { enabled: false },
      dataLabels: { enabled: false },
      markers: { size: 0 },
    };
  }, [series, stroke]);

  if (!series || !options) return null;

  return (
    <div className="chart-container w-24 h-8 rounded-md bg-[#0b1325]/60 px-1 shadow-[0_0_12px_rgba(59,130,246,0.18)]">
      <Chart options={options} series={series} type="area" height={32} />
    </div>
  );
};

const trendChartOptions = ({ stroke, fill, data, height = 170, label }) => ({
  chart: {
    type: 'area',
    height,
    toolbar: { show: false },
    zoom: { enabled: false },
    animations: { enabled: true, easing: 'easeinout', speed: 700 },
    foreColor: '#94a3b8',
    fontFamily: chartFont,
    dropShadow: {
      enabled: true,
      top: 8,
      left: 0,
      blur: 14,
      opacity: 0.3,
      color: stroke,
    },
  },
  stroke: {
    curve: 'smooth',
    width: 2.6,
    colors: [stroke],
  },
  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 0.6,
      opacityFrom: 0.35,
      opacityTo: 0.04,
      stops: [0, 80, 100],
      colorStops: [
        { offset: 0, color: fill || stroke, opacity: 0.45 },
        { offset: 80, color: fill || stroke, opacity: 0.12 },
        { offset: 100, color: fill || stroke, opacity: 0.02 },
      ],
    },
  },
  colors: [stroke],
  dataLabels: { enabled: false },
  markers: { size: 0 },
  grid: {
    show: true,
    borderColor: '#111827',
    xaxis: { lines: { show: false } },
    yaxis: { lines: { show: true } },
    padding: { top: 6, bottom: 4, left: 6, right: 6 },
  },
  xaxis: {
    type: 'datetime',
    labels: {
      show: true,
      datetimeFormatter: {
        year: 'yyyy',
        month: 'MMM',
      },
      style: {
        colors: '#64748b',
        fontSize: '10px',
        fontFamily: chartFont,
      },
    },
    axisBorder: { show: false },
    axisTicks: { show: false },
    crosshairs: {
      show: true,
      position: 'front',
      stroke: { color: stroke, width: 1, dashArray: 4 },
    },
  },
  yaxis: {
    labels: {
      style: {
        colors: '#64748b',
        fontSize: '10px',
        fontFamily: chartFont,
      },
      formatter: (val) => (Number.isFinite(val) ? `${val.toFixed(1)}%` : '--'),
    },
  },
  tooltip: {
    theme: 'dark',
    custom: ({ series, seriesIndex, dataPointIndex }) => {
      const point = data[dataPointIndex];
      if (!point) return '';
      const value = series[seriesIndex]?.[dataPointIndex];
      const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(
        new Date(point.date)
      );
      return `
        <div style="padding:8px 10px;background:#0a1628;border:1px solid ${stroke};border-radius:9px;color:#e2e8f0;box-shadow:0 0 0 1px ${stroke}44, 0 0 16px ${stroke}66, 0 10px 24px rgba(15,23,42,0.35);font-family:${chartFont};font-size:11px;">
          <div style="display:flex;justify-content:space-between;gap:10px;color:#94a3b8;margin-bottom:4px;">
            <span>${label || 'Trend'}</span>
            <span>${monthLabel}</span>
          </div>
          <div style="color:#ffffff;font-weight:600;font-size:12px;">${formatNumber(value, 2)}</div>
        </div>
      `;
    },
  },
});

const MacroPulse = ({ cards, loading, error, onRetry }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-gray-800/50 bg-[#0a1628] p-3">
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
      <div className="rounded-xl border border-gray-800/50 bg-[#0a1628] p-4">
        <ErrorState onRetry={onRetry} />
      </div>
    );
  }

  return (
    <motion.div
      variants={{
        hidden: {},
        show: {
          transition: { staggerChildren: 0.06 },
        },
      }}
      initial="hidden"
      animate="show"
      className="grid grid-cols-6 gap-3"
    >
      {cards.map((card) => (
        <motion.div
          key={card.label}
          variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
          className="rounded-xl border border-gray-800/50 bg-[#0a1628] p-3 flex flex-col justify-between"
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
            {card.sparkline && (
              <div className="flex items-end justify-end">
                <Sparkline data={card.sparkline} stroke="#3b82f6" />
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
};

const YieldCurve = ({ data, loading, error, onRetry }) => {
  const safeData = Array.isArray(data) ? data : [];
  const values = safeData.map((entry) => entry.value);
  const twoYear = values[4];
  const tenYear = values[8];
  const isInverted = Number.isFinite(twoYear) && Number.isFinite(tenYear) ? twoYear > tenYear : false;
  const lineColor = isInverted ? '#fb923c' : '#38bdf8';
  const glowShadow = isInverted
    ? 'shadow-[0_0_32px_rgba(249,115,22,0.32)]'
    : 'shadow-[0_0_32px_rgba(56,189,248,0.22)]';
  const badgeClass = isInverted ? 'yield-badge yield-badge--inverted' : 'yield-badge yield-badge--normal';
  const scanlineClass = isInverted ? 'chart-container--warm' : 'chart-container--cool';

  const series = useMemo(() => [
    {
      name: 'Yield',
      data: safeData.map((entry) => entry.value),
    },
  ], [safeData]);

  const options = useMemo(() => ({
    chart: {
      type: 'area',
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: { enabled: true, easing: 'easeinout', speed: 700 },
      dropShadow: {
        enabled: true,
        top: 10,
        left: 0,
        blur: 18,
        opacity: 0.35,
        color: lineColor,
      },
      foreColor: '#94a3b8',
      fontFamily: chartFont,
    },
    stroke: {
      curve: 'smooth',
      width: 2.8,
      colors: [lineColor],
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 0.65,
        opacityFrom: 0.4,
        opacityTo: 0.05,
        stops: [0, 75, 100],
      },
    },
    colors: [lineColor],
    dataLabels: { enabled: false },
    markers: { size: 0 },
    grid: { show: false, padding: { top: 8, bottom: 6, left: 8, right: 8 } },
    xaxis: {
      categories: safeData.map((entry) => entry.label),
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: {
          colors: '#94a3b8',
          fontSize: '10px',
          fontFamily: chartFont,
        },
      },
      tooltip: { enabled: false },
    },
    yaxis: {
      labels: {
        style: {
          colors: '#94a3b8',
          fontSize: '10px',
          fontFamily: chartFont,
        },
        formatter: (val) => `${formatNumber(val, 2)}%`,
      },
    },
    tooltip: {
      theme: 'dark',
      custom: ({ series, seriesIndex, dataPointIndex, w }) => {
        const value = series[seriesIndex]?.[dataPointIndex];
        const label = w.globals.labels?.[dataPointIndex];
        const labelText = label ? `${label} Treasury` : 'Treasury';
        return `
          <div style="padding:8px 10px;background:#0a1628;border:1px solid ${lineColor};border-radius:9px;color:#e2e8f0;box-shadow:0 0 0 1px ${lineColor}55, 0 0 18px ${lineColor}88, 0 10px 24px rgba(15,23,42,0.35);font-family:${chartFont};font-size:11px;">
            <div style="color:#94a3b8;margin-bottom:2px;">${labelText}</div>
            <div style="color:${lineColor};font-weight:600;font-size:12px;">${formatNumber(value, 2)}%</div>
          </div>
        `;
      },
    },
  }), [safeData, lineColor]);

  const hasInsufficientData = safeData.length < 2
    || safeData.some((entry) => !Number.isFinite(entry.value));

  if (loading) {
    return (
      <div className="h-full rounded-2xl border border-gray-800/50 bg-[#0a1628] p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-blue-400" strokeWidth={1.5} fill="none" />
          <span className="text-white text-sm font-semibold">Yield Curve</span>
        </div>
        <SkeletonBlock className="h-40 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full rounded-2xl border border-gray-800/50 bg-[#0a1628] p-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-blue-400" strokeWidth={1.5} fill="none" />
          <span className="text-white text-sm font-semibold">Yield Curve</span>
        </div>
        <ErrorState onRetry={onRetry} />
      </div>
    );
  }

  if (hasInsufficientData) {
    return (
      <div className="h-full rounded-2xl border border-gray-800/50 bg-[#0a1628] p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-blue-400" strokeWidth={1.5} fill="none" />
          <span className="text-white text-sm font-semibold">Yield Curve</span>
        </div>
        <div className="flex-1">
          <InsufficientDataState />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full rounded-2xl border border-gray-800/50 bg-[#0a1628] p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-400" strokeWidth={1.5} fill="none" />
          <span className="text-white text-sm font-semibold">Yield Curve</span>
        </div>
        <span
          className={`text-[10px] px-2.5 py-1 rounded-full border font-semibold ${badgeClass} ${
            isInverted
              ? 'border-orange-400/60 text-orange-100 bg-orange-500/10 animate-pulse'
              : 'border-cyan-400/60 text-cyan-200 bg-cyan-500/10'
          }`}
        >
          {isInverted ? '⚠ INVERTED' : 'NORMAL'}
        </span>
      </div>
      <div
        className={`chart-container ${scanlineClass} relative flex-1 rounded-xl border ${glowShadow} overflow-hidden ${
          isInverted
            ? 'border-orange-500/40 bg-[#140b12]/70'
            : 'border-cyan-500/30 bg-[#0b1325]/70'
        } p-2`}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-16"
          style={{ background: `linear-gradient(180deg, ${lineColor}33, transparent)` }}
        />
        <div
          className="pointer-events-none absolute inset-x-6 bottom-3 h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${lineColor}, transparent)`,
            boxShadow: `0 0 14px ${lineColor}cc`,
          }}
        />
        <div className="relative z-10 h-full">
          <Chart options={options} series={series} type="area" height={200} />
        </div>
      </div>
    </div>
  );
};

const EconCalendar = () => {
  const today = new Date();
  const formatDay = (date) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);

  return (
    <div className="h-full rounded-2xl border border-gray-800/50 bg-[#0a1628] p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="w-4 h-4 text-blue-400" strokeWidth={1.5} fill="none" />
        <span className="text-white text-sm font-semibold">Econ Calendar</span>
      </div>
      <div className="flex-1 text-xs text-gray-300 overflow-hidden">
        <div className="grid grid-cols-[64px_1fr_72px_72px] text-[10px] uppercase tracking-widest text-gray-500 pb-2">
          <span>Date</span>
          <span>Release</span>
          <span className="text-right">Prev</span>
          <span className="text-right">Cons</span>
        </div>
        <div className="space-y-1">
          {calendarSchedule.map((item, index) => {
            const date = new Date(today);
            date.setDate(today.getDate() + item.offsetDays);
            const isToday = item.offsetDays === 0;
            return (
              <div
                key={item.id}
                className={`relative grid grid-cols-[64px_1fr_72px_72px] items-center px-2 py-2 rounded-lg text-[11px] ${
                  index % 2 === 0 ? 'bg-[#0b1a2e]/60' : 'bg-[#0a1426]/60'
                }`}
              >
                {isToday && (
                  <div className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full bg-gradient-to-b from-blue-400 via-blue-500/70 to-transparent shadow-[0_0_12px_rgba(59,130,246,0.7)]" />
                )}
                <span className={isToday ? 'text-blue-300 font-mono text-[10px] tracking-[0.2em]' : 'text-gray-400'}>
                  {isToday ? 'TODAY' : formatDay(date)}
                </span>
                <span className="text-gray-200 truncate">{item.name}</span>
                <span className="text-right text-gray-400">{item.previous}</span>
                <span className="text-right text-gray-200">{item.consensus}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const TrendChart = ({ data, stroke, fill, height = 170, label }) => {
  const hasInsufficientData = !data
    || data.length < 2
    || data.some((entry) => !Number.isFinite(entry.value));

  const series = useMemo(() => {
    if (hasInsufficientData) return [];
    return [
      {
        name: 'Trend',
        data: data.map((entry) => ({
          x: new Date(entry.date).getTime(),
          y: entry.value,
        })),
      },
    ];
  }, [data, hasInsufficientData]);

  const options = useMemo(() => {
    if (hasInsufficientData) return null;
    return trendChartOptions({ stroke, data, height, fill, label });
  }, [stroke, data, height, fill, label, hasInsufficientData]);

  if (hasInsufficientData) {
    return <InsufficientDataState />;
  }

  if (!options) return null;

  return (
    <div
      className="chart-container h-full w-full rounded-xl border border-cyan-500/20 bg-[#0b1325]/70 p-2"
      style={{ boxShadow: `0 0 26px ${stroke}33` }}
    >
      <Chart options={options} series={series} type="area" height={height} />
    </div>
  );
};

const HistoricalTrends = ({ seriesMap, loading, error, onRetry }) => {
  const [activeTrend, setActiveTrend] = useState('unemployment');
  const [range, setRange] = useState('5Y');

  const activeConfig = trendOptions.find((trend) => trend.id === activeTrend) || trendOptions[0];
  const rawSeries = parseObservations(seriesMap[TREND_SERIES[activeConfig.id]] || []);
  const ascendingSeries = [...rawSeries].reverse();

  const filteredSeries = useMemo(() => {
    if (range === 'MAX') return ascendingSeries;
    const years = Number(range.replace('Y', ''));
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - years);
    return ascendingSeries.filter((entry) => new Date(`${entry.date}T00:00:00Z`) >= cutoff);
  }, [ascendingSeries, range]);

  if (loading) {
    return (
      <div className="h-full rounded-2xl border border-gray-800/50 bg-[#0a1628] p-4">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-blue-400" strokeWidth={1.5} fill="none" />
          <span className="text-white text-sm font-semibold">Trends</span>
        </div>
        <SkeletonBlock className="h-40 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full rounded-2xl border border-gray-800/50 bg-[#0a1628] p-4">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-blue-400" strokeWidth={1.5} fill="none" />
          <span className="text-white text-sm font-semibold">Trends</span>
        </div>
        <ErrorState onRetry={onRetry} />
      </div>
    );
  }

  return (
    <div className="h-full rounded-2xl border border-gray-800/50 bg-[#0a1628] p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-400" strokeWidth={1.5} fill="none" />
          <span className="text-white text-sm font-semibold">Trends</span>
        </div>
        <div className="flex items-center gap-2">
          {['1Y', '5Y', '10Y', 'MAX'].map((item) => (
            <button
              key={item}
              onClick={() => setRange(item)}
              className={`px-2 py-1 text-[10px] rounded-full border ${
                range === item
                  ? 'border-blue-500/60 text-blue-300 bg-blue-500/10'
                  : 'border-gray-700/50 text-gray-400'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 mb-3">
        {trendOptions.map((option) => (
          <button
            key={option.id}
            onClick={() => setActiveTrend(option.id)}
            className={`px-2.5 py-1 rounded-full text-[11px] border transition ${
              activeTrend === option.id
                ? 'border-blue-500/60 text-white bg-blue-500/10'
                : 'border-gray-700/50 text-gray-400'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 pb-2">
        <TrendChart
          data={filteredSeries}
          stroke={activeConfig.stroke}
          fill={activeConfig.fill}
          label={activeConfig.label}
        />
      </div>
    </div>
  );
};

const SeriesModal = ({ series, onClose }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadSeries = useCallback(() => {
    let isMounted = true;
    if (!series) return () => {};

    setLoading(true);
    setError(false);
    setData([]);

    fetchSeries(series.id)
      .then((observations) => {
        if (!isMounted) return;
        const parsed = parseObservations(observations).reverse();
        setData(parsed);
      })
      .catch(() => {
        if (!isMounted) return;
        setError(true);
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [series]);

  useEffect(() => {
    const cleanup = loadSeries();
    return () => cleanup && cleanup();
  }, [loadSeries]);

  return (
    <AnimatePresence>
      {series && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-3xl bg-[#0a1628] border border-gray-800/60 rounded-2xl p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <div className="text-xs text-gray-400">{series.id}</div>
                <div className="text-lg text-white font-semibold">{series.title}</div>
                <div className="text-xs text-gray-500">{series.frequency} - Updated {series.last_updated ? series.last_updated.split(' ')[0] : '--'}</div>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition"
              >
                <X className="w-4 h-4" strokeWidth={1.5} fill="none" />
              </button>
            </div>
            <div className="h-64">
              {loading ? (
                <SkeletonBlock className="h-full w-full" />
              ) : error ? (
                <ErrorState onRetry={loadSeries} />
              ) : (
                <TrendChart
                  data={data}
                  stroke="#3b82f6"
                  fill="rgba(59,130,246,0.2)"
                  height={240}
                  label={series?.title || series?.id}
                />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const FredSearch = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState(null);
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
    <div className="h-full rounded-2xl border border-gray-800/50 bg-[#0a1628] p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Search className="w-4 h-4 text-blue-400" strokeWidth={1.5} fill="none" />
        <span className="text-white text-sm font-semibold">Explore</span>
      </div>
      <div className="flex items-center gap-2 bg-[#0b1325] border border-gray-800/60 rounded-xl px-3 py-2 mb-3">
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
                  onClick={() => setQuery(item.keyword)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-gray-700/60 bg-[#0b1325]/70 hover:bg-blue-500/20 hover:border-blue-500/40 transition-all text-gray-300 hover:text-blue-300"
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
                onClick={() => setSelectedSeries(item)}
                className="w-full text-left px-3 py-2 rounded-xl border border-gray-800/60 bg-[#0b1325]/70 hover:bg-[#12203a]/70 transition"
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
      <SeriesModal series={selectedSeries} onClose={() => setSelectedSeries(null)} />
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
  const spSpark = sp500.slice(0, 20).reverse();

  return [
    {
      label: 'Fed Funds Rate',
      icon: Percent,
      value: fedLatest,
      format: (val) => `${formatNumber(val, 2)}%`,
      trend: fedTrend,
      trendColor: fedChange >= 0 ? 'text-emerald-400' : 'text-red-400',
      subline: Number.isFinite(fedChange) ? `${formatPercent(fedChange, 2)} vs last` : 'Latest',
    },
    {
      label: 'CPI Inflation',
      icon: Thermometer,
      value: cpiYoY,
      format: (val) => `${formatNumber(val, 2)}%`,
      subline: 'YoY change',
    },
    {
      label: 'Unemployment',
      icon: Users,
      value: unrateLatest,
      format: (val) => `${formatNumber(val, 2)}%`,
      dotColor: unrateDot,
      subline: 'Rate',
    },
    {
      label: 'GDP Growth',
      icon: BarChart3,
      value: gdpGrowth,
      format: (val) => `${formatNumber(val, 2)}%`,
      subline: 'QoQ',
    },
    {
      label: '10Y Treasury',
      icon: TrendingUp,
      value: tenYLatest,
      format: (val) => `${formatNumber(val, 2)}%`,
      trend: tenYTrend,
      trendColor: tenYChange >= 0 ? 'text-emerald-400' : 'text-red-400',
      subline: Number.isFinite(tenYChange) ? `${formatPercent(tenYChange, 2)} today` : 'Latest',
    },
    {
      label: 'S&P 500 ($SPX)',
      icon: LineChart,
      value: spLatest,
      format: (val) => formatCompact(val),
      subline: 'Index',
      sparkline: spSpark,
    },
  ];
};

const buildYieldData = (seriesMap) => YIELD_SERIES.map((entry) => {
  const data = parseObservations(seriesMap[entry.id] || []);
  return {
    label: entry.label,
    value: data[0]?.value ?? 0,
  };
});

const FredPage = () => {
  const seriesIds = useMemo(() => [
    ...Object.values(MACRO_SERIES),
    ...YIELD_SERIES.map((entry) => entry.id),
    ...Object.values(TREND_SERIES),
  ].filter((value, index, array) => array.indexOf(value) === index), []);

  const { seriesMap, loading, error, reload } = useFredSeries(seriesIds);

  const macroCards = useMemo(() => buildMacroCards(seriesMap), [seriesMap]);
  const yieldData = useMemo(() => buildYieldData(seriesMap), [seriesMap]);
  const panelStagger = useMemo(() => ({
    hidden: {},
    show: { transition: { staggerChildren: 0.08 } },
  }), []);
  const panelVariants = useMemo(() => ({
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0 },
  }), []);

  return (
    <FredErrorBoundary>
      <div className="h-full w-full bg-[#060d18] text-white overflow-hidden relative fred-scanline">
        <style>{`
          .fred-scanline .chart-container {
            position: relative;
            overflow: hidden;
          }
          .fred-scanline .chart-container::after {
            content: '';
            position: absolute;
            left: -10%;
            right: -10%;
            top: -70%;
            height: 70%;
            background: linear-gradient(120deg, transparent 0%, rgba(56,189,248,0.08) 45%, rgba(148,163,184,0.16) 50%, rgba(56,189,248,0.08) 55%, transparent 100%);
            opacity: 0.65;
            animation: fred-scanline 6s linear infinite;
            pointer-events: none;
            mix-blend-mode: screen;
            border-radius: inherit;
          }
          .fred-scanline .chart-container--warm::after {
            background: linear-gradient(120deg, transparent 0%, rgba(249,115,22,0.12) 45%, rgba(239,68,68,0.2) 50%, rgba(249,115,22,0.12) 55%, transparent 100%);
          }
          .fred-scanline .yield-badge {
            letter-spacing: 0.28em;
            font-family: ${chartFont};
            box-shadow: 0 0 12px rgba(56,189,248,0.35), inset 0 0 12px rgba(56,189,248,0.18);
          }
          .fred-scanline .yield-badge--inverted {
            box-shadow: 0 0 14px rgba(249,115,22,0.45), 0 0 26px rgba(239,68,68,0.35);
          }
          @keyframes fred-scanline {
            0% { transform: translateY(-120%); }
            100% { transform: translateY(220%); }
          }
        `}</style>
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage: 'linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="relative z-10 h-full p-6 grid grid-rows-[auto_1fr_1fr] gap-4">
          <MacroPulse cards={macroCards} loading={loading} error={error} onRetry={reload} />
          <motion.div
            variants={panelStagger}
            initial="hidden"
            animate="show"
            className="grid grid-cols-3 gap-4 min-h-0"
          >
            <motion.div variants={panelVariants} className="col-span-2 min-h-0">
              <YieldCurve data={yieldData} loading={loading} error={error} onRetry={reload} />
            </motion.div>
            <motion.div variants={panelVariants} className="col-span-1 min-h-0">
              <EconCalendar />
            </motion.div>
          </motion.div>
          <motion.div
            variants={panelStagger}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 gap-4 min-h-0"
          >
            <motion.div variants={panelVariants} className="min-h-0">
              <HistoricalTrends seriesMap={seriesMap} loading={loading} error={error} onRetry={reload} />
            </motion.div>
            <motion.div variants={panelVariants} className="min-h-0">
              <FredSearch />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </FredErrorBoundary>
  );
};

export default FredPage;
