import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Highcharts from 'highcharts';
import HighchartsMore from 'highcharts/highcharts-more';
import SolidGauge from 'highcharts/modules/solid-gauge';
import HighchartsReact from 'highcharts-react-official';
import {
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  PieChart,
  BarChart3,
  DollarSign,
  Wallet,
  RefreshCw,
} from 'lucide-react';

// Initialize Highcharts modules (guard against double-init)
if (typeof HighchartsMore === 'function') HighchartsMore(Highcharts);
if (typeof SolidGauge === 'function') SolidGauge(Highcharts);

// Highcharts global dark theme
Highcharts.setOptions({
  chart: {
    backgroundColor: 'transparent',
    style: { fontFamily: 'Inter, system-ui, sans-serif' },
  },
  title: { style: { color: '#fff', fontSize: '14px', fontWeight: '600' } },
  subtitle: { style: { color: '#9ca3af' } },
  xAxis: {
    labels: { style: { color: '#6b7280' } },
    lineColor: '#1f2937',
    tickColor: '#1f2937',
    gridLineColor: '#1f2937',
  },
  yAxis: {
    labels: { style: { color: '#6b7280' } },
    gridLineColor: '#1f293740',
    title: { style: { color: '#6b7280' } },
  },
  legend: {
    itemStyle: { color: '#d1d5db' },
    itemHoverStyle: { color: '#fff' },
  },
  tooltip: {
    backgroundColor: '#111827',
    borderColor: '#374151',
    style: { color: '#f3f4f6' },
  },
  credits: { enabled: false },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_CAPITAL_BASE = 100000;

const toNumber = (value) => {
  if (Number.isFinite(value)) return Number(value);
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/,/g, '').trim();
  const match = cleaned.match(/[-+]?\d*\.?\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
};

const toTimestamp = (value) => {
  if (Number.isFinite(value)) return Number(value);
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeSymbol = (value) => {
  if (!value) return '';
  return String(value).trim().replace(/^\$/, '').toUpperCase();
};

const formatCurrency = (value) => {
  const numeric = Number(value) || 0;
  return `$${Math.abs(numeric).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatSignedCurrency = (value) => {
  const numeric = Number(value) || 0;
  if (numeric === 0) return '$0.00';
  return `${numeric > 0 ? '+' : '-'}${formatCurrency(numeric)}`;
};

const formatSignedPercent = (value, precision = 2) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '--';
  return `${numeric >= 0 ? '+' : ''}${numeric.toFixed(precision)}%`;
};

const clampPercent = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(100, Math.max(0, numeric));
};

// ── Trade normalization ─────────────────────────────────────────────────────

const normalizeTrade = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const symbol = normalizeSymbol(raw.symbol ?? raw.ticker ?? raw.asset ?? raw.Symbol);
  if (!symbol) return null;
  const shares = Math.abs(toNumber(raw.shares ?? raw.qty ?? raw.quantity ?? raw.filled_qty ?? raw.size) ?? 0);
  const price = toNumber(raw.price ?? raw.fillPrice ?? raw.avgPrice ?? raw.avg_entry_price ?? raw.filled_avg_price ?? raw.executionPrice) ?? 0;
  if (!Number.isFinite(shares) || shares <= 0) return null;
  if (!Number.isFinite(price) || price <= 0) return null;
  const sideRaw = String(raw.side ?? raw.type ?? raw.action ?? raw.order_side ?? raw.orderSide ?? '').toLowerCase();
  const side = (sideRaw.includes('sell') || sideRaw === 'short' || sideRaw === 'close') ? 'sell' : 'buy';
  const timestamp = toTimestamp(raw.timestamp ?? raw.time ?? raw.date ?? raw.filled_at ?? raw.filledAt ?? raw.submitted_at ?? raw.created_at) ?? Date.now();
  const id = String(raw.id ?? raw.tradeId ?? raw.orderId ?? '').trim();
  return { id, symbol, side, shares, price, timestamp };
};

const buildTradeKey = (trade) => {
  const tsBucket = Math.floor(Number(trade.timestamp || 0) / 1000);
  return `${trade.id || 'noid'}|${trade.symbol}|${trade.side}|${trade.shares.toFixed(6)}|${trade.price.toFixed(6)}|${tsBucket}`;
};

const toMonthKey = (timestamp) => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const getLast12MonthKeys = () => {
  const result = [];
  const cursor = new Date();
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);
  for (let i = 11; i >= 0; i--) {
    const next = new Date(cursor);
    next.setMonth(cursor.getMonth() - i);
    result.push(toMonthKey(next.getTime()));
  }
  return result;
};

const monthLabel = (monthKey) => {
  const [year, month] = monthKey.split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return monthKey;
  return new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short' });
};

// ── Strategy helpers ────────────────────────────────────────────────────────

const extractStrategyPnl = (strategy) => {
  const candidates = [
    strategy?.paper?.pnl, strategy?.unrealizedPnl, strategy?.dailyPnl,
    strategy?.pnl, strategy?.profit_return_data?.pnl, strategy?.profit_return_data?.profit,
    strategy?.backtestResults?.totalPnL, strategy?.backtestResults?.pnl,
    strategy?.results?.totalPnL, strategy?.results?.pnl, strategy?.totalReturnAmount,
  ];
  for (const c of candidates) { const p = toNumber(c); if (p !== null) return p; }
  return 0;
};

const extractStrategyTrades = (strategy) => {
  const candidates = [
    strategy?.paper?.trades, strategy?.totalTrades, strategy?.trades,
    strategy?.metrics?.trades, strategy?.metrics?.totalTrades,
    strategy?.results?.trades, strategy?.backtestResults?.trades,
  ];
  for (const c of candidates) { const p = toNumber(c); if (p !== null && p >= 0) return Math.round(p); }
  return 0;
};

const extractStrategyWinRate = (strategy) => {
  const candidates = [
    strategy?.paper?.winRate, strategy?.winRate, strategy?.metrics?.winRate,
    strategy?.results?.winRate, strategy?.backtestResults?.winRate,
  ];
  for (const c of candidates) { const p = toNumber(c); if (p !== null) return clampPercent(p); }
  return 0;
};

const normalizeStrategy = (strategy, fallbackIndex = 0) => {
  if (!strategy || typeof strategy !== 'object') return null;
  const name = String(strategy.name || strategy.title || strategy.strategyName || 'Untitled Strategy').trim();
  const ticker = normalizeSymbol(strategy.ticker ?? strategy.symbol ?? strategy.asset ?? strategy.tickers?.[0] ?? '');
  const key = String(strategy.id ?? `${name}-${ticker || fallbackIndex}`).trim();
  return {
    key, name, ticker,
    pnl: extractStrategyPnl(strategy),
    trades: extractStrategyTrades(strategy),
    winRate: extractStrategyWinRate(strategy),
    updatedAt: toTimestamp(strategy.updatedAt ?? strategy.savedAt ?? strategy.activatedAt ?? strategy.deployedAt ?? strategy.createdAt ?? strategy.timestamp) ?? Date.now(),
  };
};

// ── Trade stats calculation ─────────────────────────────────────────────────

const calculateTradeStats = (trades) => {
  const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);
  const lotsBySymbol = new Map();
  const realizedEvents = [];
  const monthlyPnl = {};
  let realizedPnl = 0;

  sorted.forEach((trade) => {
    const symbol = trade.symbol;
    if (!lotsBySymbol.has(symbol)) lotsBySymbol.set(symbol, []);
    const lots = lotsBySymbol.get(symbol);
    if (trade.side === 'buy') { lots.push({ shares: trade.shares, price: trade.price }); return; }
    let remaining = trade.shares;
    let sellPnl = 0;
    while (remaining > 0 && lots.length > 0) {
      const lot = lots[0];
      const matched = Math.min(remaining, lot.shares);
      sellPnl += matched * (trade.price - lot.price);
      lot.shares -= matched;
      remaining -= matched;
      if (lot.shares <= 0) lots.shift();
    }
    if (sellPnl !== 0) {
      realizedPnl += sellPnl;
      realizedEvents.push({ timestamp: trade.timestamp, pnl: sellPnl });
      const month = toMonthKey(trade.timestamp);
      monthlyPnl[month] = (monthlyPnl[month] || 0) + sellPnl;
    }
  });

  const winEvents = realizedEvents.filter((e) => e.pnl > 0);
  const lossEvents = realizedEvents.filter((e) => e.pnl < 0);
  const winsAbs = winEvents.reduce((s, e) => s + e.pnl, 0);
  const lossesAbs = Math.abs(lossEvents.reduce((s, e) => s + e.pnl, 0));
  const avgWin = winEvents.length > 0 ? winsAbs / winEvents.length : 0;
  const avgLoss = lossEvents.length > 0 ? -lossesAbs / lossEvents.length : 0;
  const profitFactor = lossesAbs > 0 ? winsAbs / lossesAbs : (winsAbs > 0 ? Infinity : 0);

  let equity = 0, peak = 0, maxDrawdown = 0;
  const equityCurve = [];
  realizedEvents.forEach((event) => {
    equity += event.pnl;
    peak = Math.max(peak, equity);
    if (peak > 0) maxDrawdown = Math.max(maxDrawdown, ((peak - equity) / peak) * 100);
    equityCurve.push([event.timestamp, equity]);
  });

  return { realizedPnl, realizedEvents, monthlyPnl, equityCurve, wins: winEvents.length, losses: lossEvents.length, closedTrades: realizedEvents.length, avgWin, avgLoss, profitFactor, maxDrawdown };
};

// ── KPI Card ────────────────────────────────────────────────────────────────

const StatCard = ({ title, value, subtitle, icon: Icon, color = 'text-white' }) => (
  <div className="bg-[#0a1220] border border-white/[0.06] rounded-xl p-4 shadow-[0_0_18px_rgba(16,185,129,0.08)]">
    <div className="flex items-center gap-2 text-gray-400 text-[11px] uppercase tracking-wider mb-2">
      <Icon className="w-4 h-4" strokeWidth={1.5} />
      {title}
    </div>
    <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
    {subtitle && <div className="text-white/40 text-xs mt-1">{subtitle}</div>}
  </div>
);

// ── MAIN COMPONENT ──────────────────────────────────────────────────────────

const AnalyticsPage = ({
  tradeHistory = [],
  savedStrategies = [],
  deployedStrategies = [],
  alpacaData = {},
}) => {
  // ── Normalize trades ──────────────────────────────────────────────────────
  const normalizedTrades = useMemo(() => {
    const local = Array.isArray(tradeHistory) ? tradeHistory : [];
    const orders = Array.isArray(alpacaData?.orders) ? alpacaData.orders : [];
    const broker = Array.isArray(alpacaData?.trades) ? alpacaData.trades : [];
    const byKey = new Map();
    [...local, ...orders, ...broker].map(normalizeTrade).filter(Boolean).forEach((t) => byKey.set(buildTradeKey(t), t));
    return [...byKey.values()];
  }, [tradeHistory, alpacaData]);

  // ── Normalize strategies ──────────────────────────────────────────────────
  const strategyRows = useMemo(() => {
    const merged = new Map();
    [...(Array.isArray(savedStrategies) ? savedStrategies : []), ...(Array.isArray(deployedStrategies) ? deployedStrategies : [])]
      .forEach((item, i) => {
        const n = normalizeStrategy(item, i);
        if (!n) return;
        const existing = merged.get(n.key);
        if (!existing || n.updatedAt >= existing.updatedAt) merged.set(n.key, n);
      });
    return [...merged.values()].sort((a, b) => b.pnl - a.pnl);
  }, [savedStrategies, deployedStrategies]);

  // ── Trade stats ───────────────────────────────────────────────────────────
  const tradeStats = useMemo(() => calculateTradeStats(normalizedTrades), [normalizedTrades]);

  const brokerUnrealizedPnl = useMemo(() => {
    const positions = Array.isArray(alpacaData?.positions) ? alpacaData.positions : [];
    return positions.reduce((s, p) => s + (toNumber(p?.unrealized_pl ?? p?.unrealizedPnl) || 0), 0);
  }, [alpacaData]);

  const strategyTotalPnl = useMemo(() => strategyRows.reduce((s, r) => s + (toNumber(r.pnl) || 0), 0), [strategyRows]);
  const totalPnl = tradeStats.realizedPnl + brokerUnrealizedPnl + strategyTotalPnl;

  const strategyTrades = useMemo(() => strategyRows.reduce((s, r) => s + (Number(r.trades) || 0), 0), [strategyRows]);
  const strategyWinsWeighted = useMemo(() => strategyRows.reduce((s, r) => s + ((Number(r.trades) || 0) * (Number(r.winRate) || 0) / 100), 0), [strategyRows]);
  const totalTrades = tradeStats.closedTrades + strategyTrades;
  const winCount = tradeStats.closedTrades > 0 ? tradeStats.wins : strategyWinsWeighted;
  const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;

  const accountEquity = toNumber(alpacaData?.account?.equity ?? alpacaData?.account?.portfolio_value ?? alpacaData?.account?.last_equity) || DEFAULT_CAPITAL_BASE;

  // ── Monthly returns ───────────────────────────────────────────────────────
  const monthKeys = useMemo(() => getLast12MonthKeys(), []);
  const monthlyReturns = useMemo(() => {
    const mp = {};
    monthKeys.forEach((k) => { mp[k] = Number(tradeStats.monthlyPnl[k] || 0); });
    if (Object.values(mp).every((v) => v === 0) && strategyTotalPnl !== 0) {
      mp[monthKeys[monthKeys.length - 1]] = strategyTotalPnl;
    }
    return monthKeys.map((k) => {
      const amount = mp[k] || 0;
      return { key: k, month: monthLabel(k), amount, return: accountEquity > 0 ? (amount / accountEquity) * 100 : 0 };
    });
  }, [monthKeys, tradeStats.monthlyPnl, strategyTotalPnl, accountEquity]);

  // ── Sharpe ratio ──────────────────────────────────────────────────────────
  const sharpeRatio = useMemo(() => {
    const vals = monthlyReturns.map((m) => m.return / 100).filter((v) => Number.isFinite(v) && v !== 0);
    if (vals.length < 2) return 0;
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const variance = vals.reduce((s, v) => s + ((v - mean) ** 2), 0) / (vals.length - 1);
    const std = Math.sqrt(variance);
    return std === 0 ? 0 : (mean / std) * Math.sqrt(12);
  }, [monthlyReturns]);

  // ── Position allocation for pie chart ─────────────────────────────────────
  const positionAllocation = useMemo(() => {
    const positions = Array.isArray(alpacaData?.positions) ? alpacaData.positions : [];
    return positions
      .map((p) => ({
        name: normalizeSymbol(p.symbol) || '??',
        y: Math.abs(toNumber(p.market_value ?? p.marketValue) || 0),
      }))
      .filter((p) => p.y > 0)
      .sort((a, b) => b.y - a.y);
  }, [alpacaData]);

  // ── Equity curve from account snapshots ───────────────────────────────────
  const equityCurveData = useMemo(() => {
    // Prefer account snapshots if available
    const snapshots = Array.isArray(alpacaData?.snapshots) ? alpacaData.snapshots : [];
    if (snapshots.length > 1) {
      return snapshots
        .map((s) => [toTimestamp(s.timestamp ?? s.date ?? s.created_at), toNumber(s.equity ?? s.portfolio_value)])
        .filter(([t, v]) => t && v)
        .sort((a, b) => a[0] - b[0]);
    }
    // Fallback to realized equity curve from trade stats
    if (tradeStats.equityCurve.length > 0) {
      return tradeStats.equityCurve.map(([t, v]) => [t, accountEquity + v]);
    }
    // Just current equity as single point
    return [[Date.now(), accountEquity]];
  }, [alpacaData, tradeStats.equityCurve, accountEquity]);

  // ── Highcharts: Equity Curve (area chart) ─────────────────────────────────
  const equityCurveOptions = useMemo(() => ({
    chart: { type: 'area', height: 280 },
    title: { text: '' },
    xAxis: {
      type: 'datetime',
      labels: { format: '{value:%b %d}', style: { color: '#6b7280', fontSize: '10px' } },
      lineColor: '#1f2937',
    },
    yAxis: {
      title: { text: '' },
      labels: {
        style: { color: '#6b7280', fontSize: '10px' },
        formatter() { return `$${(this.value / 1000).toFixed(0)}k`; },
      },
      gridLineColor: '#1f293730',
    },
    tooltip: {
      backgroundColor: '#111827',
      borderColor: '#374151',
      style: { color: '#f3f4f6', fontSize: '12px' },
      pointFormat: '<b>${point.y:,.2f}</b>',
      xDateFormat: '%b %d, %Y',
    },
    legend: { enabled: false },
    plotOptions: {
      area: {
        fillColor: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [[0, 'rgba(16, 185, 129, 0.25)'], [1, 'rgba(16, 185, 129, 0)']],
        },
        lineColor: '#10b981',
        lineWidth: 2,
        marker: { enabled: false, states: { hover: { enabled: true, radius: 4, fillColor: '#10b981' } } },
        threshold: null,
      },
    },
    series: [{ name: 'Portfolio', data: equityCurveData }],
  }), [equityCurveData]);

  // ── Highcharts: Monthly P&L (column chart) ────────────────────────────────
  const monthlyPnlOptions = useMemo(() => ({
    chart: { type: 'column', height: 240 },
    title: { text: '' },
    xAxis: {
      categories: monthlyReturns.map((m) => m.month),
      labels: { style: { color: '#6b7280', fontSize: '10px' } },
      lineColor: '#1f2937',
    },
    yAxis: {
      title: { text: '' },
      labels: {
        style: { color: '#6b7280', fontSize: '10px' },
        formatter() { return `${this.value >= 0 ? '+' : ''}${this.value.toFixed(1)}%`; },
      },
      gridLineColor: '#1f293730',
      plotLines: [{ value: 0, color: '#374151', width: 1 }],
    },
    tooltip: {
      backgroundColor: '#111827',
      borderColor: '#374151',
      style: { color: '#f3f4f6', fontSize: '12px' },
      pointFormatter() {
        const color = this.y >= 0 ? '#10b981' : '#ef4444';
        return `<span style="color:${color}">${this.y >= 0 ? '+' : ''}${this.y.toFixed(2)}%</span><br/>$${this.amount?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}`;
      },
    },
    legend: { enabled: false },
    plotOptions: {
      column: {
        borderRadius: 4,
        borderWidth: 0,
        colorByPoint: false,
      },
    },
    series: [{
      name: 'Monthly Return',
      data: monthlyReturns.map((m) => ({
        y: m.return,
        amount: m.amount,
        color: m.return >= 0 ? '#10b981' : '#ef4444',
      })),
    }],
  }), [monthlyReturns]);

  // ── Highcharts: Win Rate Gauge ────────────────────────────────────────────
  const winRateGaugeOptions = useMemo(() => ({
    chart: { type: 'solidgauge', height: 200 },
    title: { text: '' },
    pane: {
      startAngle: -130,
      endAngle: 130,
      background: [{
        backgroundColor: '#1f293760',
        innerRadius: '80%',
        outerRadius: '100%',
        shape: 'arc',
        borderWidth: 0,
        borderRadius: 20,
      }],
      size: '100%',
      center: ['50%', '60%'],
    },
    yAxis: {
      min: 0,
      max: 100,
      lineWidth: 0,
      tickWidth: 0,
      minorTickWidth: 0,
      labels: { enabled: false },
      stops: [[0.0, '#ef4444'], [0.45, '#f59e0b'], [0.6, '#10b981']],
    },
    tooltip: { enabled: false },
    plotOptions: {
      solidgauge: {
        innerRadius: '80%',
        borderRadius: 20,
        dataLabels: {
          y: -25,
          borderWidth: 0,
          useHTML: true,
          format: '<div style="text-align:center"><div style="font-size:28px;font-weight:700;color:#fff">{y:.1f}%</div><div style="font-size:11px;color:#6b7280;margin-top:2px">Win Rate</div></div>',
        },
      },
    },
    series: [{ data: [{ y: winRate, radius: '100%', innerRadius: '80%' }] }],
  }), [winRate]);

  // ── Highcharts: Risk Score Gauge (based on max drawdown) ──────────────────
  const riskScore = useMemo(() => {
    const dd = tradeStats.maxDrawdown;
    if (dd <= 5) return 25;
    if (dd <= 10) return 40;
    if (dd <= 20) return 60;
    if (dd <= 35) return 75;
    return 90;
  }, [tradeStats.maxDrawdown]);

  const riskGaugeOptions = useMemo(() => ({
    chart: { type: 'solidgauge', height: 200 },
    title: { text: '' },
    pane: {
      startAngle: -130,
      endAngle: 130,
      background: [{
        backgroundColor: '#1f293760',
        innerRadius: '80%',
        outerRadius: '100%',
        shape: 'arc',
        borderWidth: 0,
        borderRadius: 20,
      }],
      size: '100%',
      center: ['50%', '60%'],
    },
    yAxis: {
      min: 0,
      max: 100,
      lineWidth: 0,
      tickWidth: 0,
      minorTickWidth: 0,
      labels: { enabled: false },
      stops: [[0.0, '#10b981'], [0.4, '#f59e0b'], [0.7, '#ef4444']],
    },
    tooltip: { enabled: false },
    plotOptions: {
      solidgauge: {
        innerRadius: '80%',
        borderRadius: 20,
        dataLabels: {
          y: -25,
          borderWidth: 0,
          useHTML: true,
          format: '<div style="text-align:center"><div style="font-size:28px;font-weight:700;color:#fff">{y:.0f}</div><div style="font-size:11px;color:#6b7280;margin-top:2px">Risk Score</div></div>',
        },
      },
    },
    series: [{ data: [{ y: riskScore, radius: '100%', innerRadius: '80%' }] }],
  }), [riskScore]);

  // ── Highcharts: Allocation Pie ────────────────────────────────────────────
  const allocationPieOptions = useMemo(() => ({
    chart: { type: 'pie', height: 260 },
    title: { text: '' },
    tooltip: {
      backgroundColor: '#111827',
      borderColor: '#374151',
      style: { color: '#f3f4f6', fontSize: '12px' },
      pointFormat: '<b>${point.y:,.2f}</b> ({point.percentage:.1f}%)',
    },
    plotOptions: {
      pie: {
        innerSize: '60%',
        borderWidth: 0,
        borderColor: null,
        dataLabels: {
          enabled: true,
          format: '<b>{point.name}</b>',
          style: { color: '#d1d5db', fontSize: '10px', fontWeight: '500', textOutline: 'none' },
          distance: 15,
        },
        colors: ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'],
      },
    },
    series: [{
      name: 'Allocation',
      data: positionAllocation.length > 0
        ? positionAllocation
        : [{ name: 'Cash', y: accountEquity, color: '#374151' }],
    }],
  }), [positionAllocation, accountEquity]);

  // ── Colors ────────────────────────────────────────────────────────────────
  const totalPnLColor = totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400';
  const winRateColor = winRate >= 50 ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent p-4 overflow-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Analytics</h1>
        <p className="text-gray-400 text-sm">
          Portfolio performance from your connected broker account.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard title="Total P&L" value={formatSignedCurrency(totalPnl)} subtitle="Realized + unrealized" icon={TrendingUp} color={totalPnLColor} />
        <StatCard title="Win Rate" value={`${winRate.toFixed(1)}%`} subtitle={`${totalTrades} trades`} icon={Target} color={winRateColor} />
        <StatCard title="Sharpe Ratio" value={sharpeRatio.toFixed(2)} subtitle="Annualized" icon={Zap} color="text-emerald-400" />
        <StatCard title="Max Drawdown" value={`-${tradeStats.maxDrawdown.toFixed(2)}%`} subtitle="Peak to trough" icon={TrendingDown} color="text-red-400" />
      </div>

      {/* Row 1: Equity Curve + Allocation Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-2 bg-[#0a1220] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
            <h3 className="text-white font-medium text-sm">Portfolio Value</h3>
          </div>
          <HighchartsReact highcharts={Highcharts} options={equityCurveOptions} />
        </div>
        <div className="bg-[#0a1220] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <PieChart className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
            <h3 className="text-white font-medium text-sm">Allocation</h3>
          </div>
          <HighchartsReact highcharts={Highcharts} options={allocationPieOptions} />
        </div>
      </div>

      {/* Row 2: Monthly P&L + Gauges */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-1 bg-[#0a1220] border border-white/[0.06] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
            <h3 className="text-white font-medium text-sm">Monthly Returns</h3>
          </div>
          <HighchartsReact highcharts={Highcharts} options={monthlyPnlOptions} />
        </div>
        <div className="bg-[#0a1220] border border-white/[0.06] rounded-xl p-4">
          <HighchartsReact highcharts={Highcharts} options={winRateGaugeOptions} />
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="text-center">
              <div className="text-emerald-400 font-bold text-sm">{formatSignedCurrency(tradeStats.avgWin)}</div>
              <div className="text-[10px] text-gray-500">Avg Win</div>
            </div>
            <div className="text-center">
              <div className="text-red-400 font-bold text-sm">{formatSignedCurrency(tradeStats.avgLoss)}</div>
              <div className="text-[10px] text-gray-500">Avg Loss</div>
            </div>
          </div>
        </div>
        <div className="bg-[#0a1220] border border-white/[0.06] rounded-xl p-4">
          <HighchartsReact highcharts={Highcharts} options={riskGaugeOptions} />
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="text-center">
              <div className="text-white font-bold text-sm">
                {Number.isFinite(tradeStats.profitFactor) ? tradeStats.profitFactor.toFixed(2) : '∞'}
              </div>
              <div className="text-[10px] text-gray-500">Profit Factor</div>
            </div>
            <div className="text-center">
              <div className="text-white font-bold text-sm">{tradeStats.closedTrades}</div>
              <div className="text-[10px] text-gray-500">Closed Trades</div>
            </div>
          </div>
        </div>
      </div>

      {/* Strategy Performance Table */}
      <div className="bg-[#0a1220] border border-white/[0.06] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
          <h3 className="text-white font-medium text-sm">Strategy Performance</h3>
          <span className="text-[11px] text-gray-500">{strategyRows.length} strategies</span>
        </div>
        <div className="overflow-auto">
          {strategyRows.length === 0 ? (
            <div className="px-4 py-8 text-sm text-gray-500">No saved or deployed strategies yet.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-white/40 border-b border-white/[0.06]">
                  <th className="text-left px-4 py-2">Strategy</th>
                  <th className="text-right px-4 py-2">P&L</th>
                  <th className="text-right px-4 py-2">Trades</th>
                  <th className="text-right px-4 py-2">Win Rate</th>
                  <th className="text-right px-4 py-2">Performance</th>
                </tr>
              </thead>
              <tbody>
                {strategyRows.map((s) => {
                  const pnl = Number(s.pnl) || 0;
                  const wr = clampPercent(s.winRate);
                  return (
                    <tr key={s.key} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-white font-medium text-sm">{s.name}</div>
                        {s.ticker && <div className="text-[11px] text-emerald-400 font-semibold">${s.ticker}</div>}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono text-sm tabular-nums ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatSignedCurrency(pnl)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300 text-sm tabular-nums">{s.trades}</td>
                      <td className="px-4 py-3 text-right text-white text-sm tabular-nums">{wr.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right">
                        <div className="w-20 h-1.5 bg-white/[0.06] rounded-full overflow-hidden ml-auto">
                          <div
                            className={`h-full rounded-full ${wr >= 60 ? 'bg-emerald-500' : wr >= 45 ? 'bg-yellow-500' : 'bg-red-500'}`}
                            style={{ width: `${wr}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
