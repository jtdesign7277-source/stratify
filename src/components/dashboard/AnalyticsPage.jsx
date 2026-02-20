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
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';

// Initialize Highcharts modules
HighchartsMore(Highcharts);
SolidGauge(Highcharts);

// Highcharts global dark theme
Highcharts.setOptions({
  chart: {
    backgroundColor: 'transparent',
    style: { fontFamily: 'Inter, system-ui, sans-serif' },
  },
  title: { style: { color: '#fff', fontSize: '14px', fontWeight: '600' } },
  subtitle: { style: { color: '#8892a0' } },
  xAxis: {
    gridLineColor: '#1f2937',
    labels: { style: { color: '#8892a0', fontSize: '10px' } },
    lineColor: '#1f2937',
    tickColor: '#1f2937',
  },
  yAxis: {
    gridLineColor: '#1f2937',
    labels: { style: { color: '#8892a0', fontSize: '10px' } },
    title: { style: { color: '#8892a0' } },
  },
  legend: {
    itemStyle: { color: '#d1d5db', fontWeight: '400', fontSize: '11px' },
    itemHoverStyle: { color: '#fff' },
  },
  tooltip: {
    backgroundColor: 'rgba(17, 17, 17, 0.95)',
    borderColor: '#2a2a2a',
    style: { color: '#fff', fontSize: '11px' },
  },
  plotOptions: {
    series: { animation: { duration: 600 } },
  },
  credits: { enabled: false },
});

/* ─── Helpers ─── */
const toNumber = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

const formatCurrency = (v) => {
  const n = toNumber(v);
  return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatSigned = (v) => {
  const n = toNumber(v);
  if (n === 0) return '$0.00';
  return `${n > 0 ? '+' : '-'}${formatCurrency(n)}`;
};

const formatPct = (v, d = 1) => {
  const n = toNumber(v);
  return `${n >= 0 ? '+' : ''}${n.toFixed(d)}%`;
};

const normalizeTrade = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const symbol = String(raw.symbol ?? raw.ticker ?? '').replace(/^\$/, '').toUpperCase().trim();
  if (!symbol) return null;
  const shares = Math.abs(toNumber(raw.shares ?? raw.qty ?? raw.quantity ?? raw.filled_qty));
  const price = toNumber(raw.price ?? raw.fillPrice ?? raw.avg_entry_price ?? raw.filled_avg_price);
  if (!shares || !price) return null;
  const sideRaw = String(raw.side ?? raw.type ?? raw.action ?? '').toLowerCase();
  const side = (sideRaw.includes('sell') || sideRaw === 'short') ? 'sell' : 'buy';
  const timestamp = Date.parse(raw.timestamp ?? raw.time ?? raw.date ?? raw.filled_at ?? raw.created_at) || Date.now();
  return { symbol, side, shares, price, timestamp, pnl: toNumber(raw.pnl ?? raw.realized_pl) };
};

/* ─── KPI Card ─── */
const KPICard = ({ title, value, subtitle, icon: Icon, color = 'text-white', large }) => (
  <div className="rounded-xl border border-[#1f1f1f] bg-[#111111] p-4">
    <div className="flex items-center gap-2 mb-2">
      {Icon && <Icon className={`w-4 h-4 ${color}`} strokeWidth={1.5} />}
      <span className="text-xs text-gray-400 uppercase tracking-wider">{title}</span>
    </div>
    <div className={`${large ? 'text-2xl' : 'text-xl'} font-bold ${color} font-mono`}>{value}</div>
    {subtitle && <div className="text-[11px] text-gray-500 mt-1">{subtitle}</div>}
  </div>
);

/* ─── Trade Stats Calculator ─── */
const computeTradeStats = (trades) => {
  const closed = [];
  const positions = {};

  const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);
  sorted.forEach((t) => {
    if (!positions[t.symbol]) positions[t.symbol] = { qty: 0, costBasis: 0 };
    const pos = positions[t.symbol];
    if (t.side === 'buy') {
      pos.costBasis = ((pos.costBasis * pos.qty) + (t.price * t.shares)) / (pos.qty + t.shares || 1);
      pos.qty += t.shares;
    } else {
      const pnl = (t.price - pos.costBasis) * t.shares;
      closed.push({ symbol: t.symbol, pnl, timestamp: t.timestamp });
      pos.qty = Math.max(0, pos.qty - t.shares);
    }
  });

  const wins = closed.filter((t) => t.pnl > 0);
  const losses = closed.filter((t) => t.pnl < 0);
  const totalPnl = closed.reduce((s, t) => s + t.pnl, 0);
  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;
  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0;
  const grossWins = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLosses = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Infinity : 0;

  // Max drawdown from equity curve
  let peak = 0, maxDD = 0, equity = 0;
  closed.forEach((t) => {
    equity += t.pnl;
    if (equity > peak) peak = equity;
    const dd = peak > 0 ? ((peak - equity) / peak) * 100 : 0;
    if (dd > maxDD) maxDD = dd;
  });

  // Monthly P&L
  const monthlyPnl = {};
  closed.forEach((t) => {
    const d = new Date(t.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyPnl[key] = (monthlyPnl[key] || 0) + t.pnl;
  });

  // Sharpe ratio (monthly)
  const monthlyReturns = Object.values(monthlyPnl);
  let sharpe = 0;
  if (monthlyReturns.length >= 2) {
    const mean = monthlyReturns.reduce((s, v) => s + v, 0) / monthlyReturns.length;
    const variance = monthlyReturns.reduce((s, v) => s + (v - mean) ** 2, 0) / (monthlyReturns.length - 1);
    const stdDev = Math.sqrt(variance);
    if (stdDev > 0) sharpe = (mean / stdDev) * Math.sqrt(12);
  }

  // Equity curve (cumulative)
  let cumPnl = 0;
  const equityCurve = closed.map((t) => {
    cumPnl += t.pnl;
    return [t.timestamp, cumPnl];
  });

  return {
    totalTrades: closed.length, wins: wins.length, losses: losses.length,
    winRate, totalPnl, avgWin, avgLoss, profitFactor, maxDrawdown: maxDD,
    sharpe, monthlyPnl, equityCurve, closed,
  };
};

/* ─── Main Component ─── */
export default function AnalyticsPage({
  tradeHistory = [],
  savedStrategies = [],
  deployedStrategies = [],
  alpacaData = {},
  watchlist = [],
}) {
  const { user } = useAuth();
  const [snapshots, setSnapshots] = useState([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(true);

  // Load account snapshots from Supabase
  useEffect(() => {
    if (!user?.id) { setLoadingSnapshots(false); return; }
    const load = async () => {
      const { data } = await supabase
        .from('account_snapshots')
        .select('snapshot_date, equity, cash, portfolio_value, daily_pnl, total_pnl')
        .eq('user_id', user.id)
        .order('snapshot_date', { ascending: true })
        .limit(365);
      setSnapshots(data || []);
      setLoadingSnapshots(false);
    };
    load();
  }, [user?.id]);

  // Parse trades
  const trades = useMemo(() => {
    const raw = Array.isArray(tradeHistory) ? tradeHistory : [];
    const brokerOrders = Array.isArray(alpacaData?.orders) ? alpacaData.orders : [];
    return [...raw, ...brokerOrders].map(normalizeTrade).filter(Boolean);
  }, [tradeHistory, alpacaData]);

  const stats = useMemo(() => computeTradeStats(trades), [trades]);

  // Account data
  const account = alpacaData?.account || {};
  const equity = toNumber(account.equity || account.portfolio_value);
  const cash = toNumber(account.cash);
  const buyingPower = toNumber(account.buying_power);
  const positions = Array.isArray(alpacaData?.positions) ? alpacaData.positions : [];
  const totalMarketValue = positions.reduce((s, p) => s + toNumber(p.market_value), 0);
  const totalUnrealizedPL = positions.reduce((s, p) => s + toNumber(p.unrealized_pl), 0);
  const totalCostBasis = positions.reduce((s, p) => s + toNumber(p.cost_basis), 0);

  // Position allocation for pie chart
  const positionAllocation = useMemo(() => {
    if (!positions.length) return [];
    return positions
      .map((p) => ({
        name: p.symbol,
        y: Math.abs(toNumber(p.market_value)),
        pnl: toNumber(p.unrealized_pl),
        pnlPct: toNumber(p.unrealized_plpc) * 100,
      }))
      .filter((p) => p.y > 0)
      .sort((a, b) => b.y - a.y);
  }, [positions]);

  // Equity curve from snapshots
  const equityCurveData = useMemo(() => {
    if (snapshots.length > 0) {
      return snapshots.map((s) => [new Date(s.snapshot_date).getTime(), toNumber(s.equity)]);
    }
    // Fallback to trade-based equity curve
    if (stats.equityCurve.length > 0) {
      const base = equity || 100000;
      return stats.equityCurve.map(([t, pnl]) => [t, base + pnl]);
    }
    return [];
  }, [snapshots, stats.equityCurve, equity]);

  // Invested amount curve from snapshots
  const investedCurveData = useMemo(() => {
    if (snapshots.length > 0) {
      return snapshots.map((s) => [new Date(s.snapshot_date).getTime(), toNumber(s.portfolio_value) - toNumber(s.equity) + toNumber(s.cash)]);
    }
    return [];
  }, [snapshots]);

  // Monthly returns bar data
  const monthlyData = useMemo(() => {
    const months = Object.entries(stats.monthlyPnl).sort(([a], [b]) => a.localeCompare(b));
    return months.map(([key, pnl]) => {
      const [y, m] = key.split('-').map(Number);
      return {
        x: new Date(y, m - 1, 1).getTime(),
        y: pnl,
        color: pnl >= 0 ? 'rgba(34, 197, 94, 0.8)' : 'rgba(239, 68, 68, 0.8)',
      };
    });
  }, [stats.monthlyPnl]);

  /* ─── Highcharts Options ─── */

  // Portfolio Performance (equity curve)
  const equityChartOptions = useMemo(() => ({
    chart: { type: 'area', height: 340, zooming: { type: 'x' } },
    title: { text: 'Portfolio Performance' },
    xAxis: { type: 'datetime' },
    yAxis: {
      title: { text: '' },
      labels: { format: '${value:,.0f}' },
    },
    tooltip: {
      shared: true,
      xDateFormat: '%b %e, %Y',
      pointFormat: '<span style="color:{series.color}">\u25CF</span> {series.name}: <b>${point.y:,.2f}</b><br/>',
    },
    series: [
      {
        name: 'Portfolio Value',
        data: equityCurveData,
        color: '#22c55e',
        fillColor: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [[0, 'rgba(34, 197, 94, 0.25)'], [1, 'rgba(34, 197, 94, 0.02)']],
        },
        lineWidth: 2,
        marker: { enabled: false },
      },
      ...(investedCurveData.length > 0 ? [{
        name: 'Cost Basis',
        data: investedCurveData,
        color: '#6366f1',
        dashStyle: 'Dash',
        lineWidth: 1.5,
        marker: { enabled: false },
        fillOpacity: 0,
      }] : []),
    ],
    legend: { enabled: equityCurveData.length > 0 && investedCurveData.length > 0 },
  }), [equityCurveData, investedCurveData]);

  // Monthly Returns
  const monthlyChartOptions = useMemo(() => ({
    chart: { type: 'column', height: 260 },
    title: { text: 'Monthly P&L' },
    xAxis: { type: 'datetime', labels: { format: '{value:%b %y}' } },
    yAxis: {
      title: { text: '' },
      labels: { format: '${value:,.0f}' },
      plotLines: [{ value: 0, color: '#374151', width: 1 }],
    },
    tooltip: {
      xDateFormat: '%B %Y',
      pointFormat: 'P&L: <b>${point.y:,.2f}</b>',
    },
    plotOptions: {
      column: { borderRadius: 3, borderWidth: 0 },
    },
    legend: { enabled: false },
    series: [{ name: 'Monthly P&L', data: monthlyData }],
  }), [monthlyData]);

  // Position Allocation Pie
  const allocationChartOptions = useMemo(() => ({
    chart: { type: 'pie', height: 280 },
    title: { text: 'Portfolio Allocation' },
    tooltip: {
      pointFormat: '<b>{point.percentage:.1f}%</b> — ${point.y:,.2f}<br/>P&L: {point.pnlFormatted}',
    },
    plotOptions: {
      pie: {
        innerSize: '55%',
        borderWidth: 0,
        borderRadius: 4,
        dataLabels: {
          enabled: true,
          format: '{point.name}',
          style: { color: '#d1d5db', fontSize: '10px', fontWeight: '400', textOutline: 'none' },
          distance: 15,
        },
        colors: ['#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'],
      },
    },
    series: [{
      name: 'Allocation',
      data: positionAllocation.map((p) => ({
        ...p,
        pnlFormatted: formatSigned(p.pnl),
      })),
    }],
  }), [positionAllocation]);

  // Win Rate Gauge
  const winRateGaugeOptions = useMemo(() => ({
    chart: { type: 'solidgauge', height: 200 },
    title: { text: 'Win Rate', floating: true, style: { fontSize: '12px' } },
    pane: {
      startAngle: -90, endAngle: 90,
      background: [{ innerRadius: '85%', outerRadius: '100%', shape: 'arc', borderWidth: 0, backgroundColor: '#1f2937' }],
      size: '140%', center: ['50%', '80%'],
    },
    yAxis: {
      min: 0, max: 100,
      lineWidth: 0, tickWidth: 0, minorTickInterval: null,
      labels: { enabled: false },
      stops: [[0.3, '#ef4444'], [0.5, '#f59e0b'], [0.65, '#22c55e']],
    },
    tooltip: { enabled: false },
    series: [{
      name: 'Win Rate',
      data: [Math.round(stats.winRate * 10) / 10],
      innerRadius: '85%',
      dataLabels: {
        format: '<div style="text-align:center"><span style="font-size:1.8em;color:#fff">{y}%</span></div>',
        useHTML: true, borderWidth: 0, y: -20,
      },
    }],
  }), [stats.winRate]);

  // Risk Gauge (based on max drawdown — lower is better)
  const riskScore = Math.min(100, stats.maxDrawdown * 2); // Scale drawdown to 0-100
  const riskGaugeOptions = useMemo(() => ({
    chart: { type: 'solidgauge', height: 200 },
    title: { text: 'Risk Score', floating: true, style: { fontSize: '12px' } },
    pane: {
      startAngle: -90, endAngle: 90,
      background: [{ innerRadius: '85%', outerRadius: '100%', shape: 'arc', borderWidth: 0, backgroundColor: '#1f2937' }],
      size: '140%', center: ['50%', '80%'],
    },
    yAxis: {
      min: 0, max: 100,
      lineWidth: 0, tickWidth: 0, minorTickInterval: null,
      labels: { enabled: false },
      stops: [[0.3, '#22c55e'], [0.6, '#f59e0b'], [0.8, '#ef4444']],
    },
    tooltip: { enabled: false },
    series: [{
      name: 'Risk',
      data: [Math.round(riskScore * 10) / 10],
      innerRadius: '85%',
      dataLabels: {
        format: '<div style="text-align:center"><span style="font-size:1.8em;color:#fff">{y:.0f}</span><br/><span style="font-size:11px;color:#8892a0">/ 100</span></div>',
        useHTML: true, borderWidth: 0, y: -20,
      },
    }],
  }), [riskScore]);

  const noData = !equity && trades.length === 0 && positions.length === 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent overflow-auto">
      <div className="p-6 space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-xl font-semibold text-white">Portfolio Analytics</h1>
          <p className="text-gray-500 text-sm">
            Real-time performance metrics from your broker, trade history, and positions.
          </p>
        </div>

        {noData && (
          <div className="text-center py-12">
            <Wallet className="w-10 h-10 text-gray-600 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-gray-400 text-sm">Connect a broker and start trading to see analytics.</p>
          </div>
        )}

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <KPICard
            title="Portfolio Value"
            value={formatCurrency(equity)}
            subtitle="Total equity"
            icon={Wallet}
            color="text-white"
            large
          />
          <KPICard
            title="Unrealized P&L"
            value={formatSigned(totalUnrealizedPL)}
            subtitle={totalCostBasis > 0 ? formatPct((totalUnrealizedPL / totalCostBasis) * 100) : '--'}
            icon={TrendingUp}
            color={totalUnrealizedPL >= 0 ? 'text-emerald-400' : 'text-red-400'}
          />
          <KPICard
            title="Win Rate"
            value={`${stats.winRate.toFixed(1)}%`}
            subtitle={`${stats.totalTrades} closed trades`}
            icon={Target}
            color={stats.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}
          />
          <KPICard
            title="Sharpe Ratio"
            value={stats.sharpe.toFixed(2)}
            subtitle="Annualized (monthly)"
            icon={Zap}
            color={stats.sharpe >= 1 ? 'text-emerald-400' : stats.sharpe >= 0 ? 'text-amber-400' : 'text-red-400'}
          />
          <KPICard
            title="Max Drawdown"
            value={`-${stats.maxDrawdown.toFixed(1)}%`}
            subtitle="Peak to trough"
            icon={TrendingDown}
            color="text-red-400"
          />
          <KPICard
            title="Profit Factor"
            value={Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : '∞'}
            subtitle={`Avg W: ${formatCurrency(stats.avgWin)}`}
            icon={BarChart3}
            color={stats.profitFactor >= 1.5 ? 'text-emerald-400' : 'text-amber-400'}
          />
        </div>

        {/* Portfolio Performance Chart */}
        {equityCurveData.length > 0 && (
          <div className="rounded-xl border border-[#1f1f1f] bg-[#111111] p-4">
            <HighchartsReact highcharts={Highcharts} options={equityChartOptions} />
          </div>
        )}

        {/* Middle Row: Monthly P&L + Allocation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {monthlyData.length > 0 && (
            <div className="rounded-xl border border-[#1f1f1f] bg-[#111111] p-4">
              <HighchartsReact highcharts={Highcharts} options={monthlyChartOptions} />
            </div>
          )}
          {positionAllocation.length > 0 && (
            <div className="rounded-xl border border-[#1f1f1f] bg-[#111111] p-4">
              <HighchartsReact highcharts={Highcharts} options={allocationChartOptions} />
            </div>
          )}
        </div>

        {/* Gauges Row: Win Rate + Risk Score */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-[#1f1f1f] bg-[#111111] p-4">
            <HighchartsReact highcharts={Highcharts} options={winRateGaugeOptions} />
          </div>
          <div className="rounded-xl border border-[#1f1f1f] bg-[#111111] p-4">
            <HighchartsReact highcharts={Highcharts} options={riskGaugeOptions} />
          </div>
          {/* Trade Summary Stats */}
          <div className="rounded-xl border border-[#1f1f1f] bg-[#111111] p-4 col-span-1 md:col-span-2 lg:col-span-2">
            <h3 className="text-sm font-semibold text-white mb-4">Trade Summary</h3>
            <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Trades</span>
                <span className="text-white font-mono">{stats.totalTrades}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Winning Trades</span>
                <span className="text-emerald-400 font-mono">{stats.wins}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Losing Trades</span>
                <span className="text-red-400 font-mono">{stats.losses}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Realized P&L</span>
                <span className={`font-mono ${stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatSigned(stats.totalPnl)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Avg Win</span>
                <span className="text-emerald-400 font-mono">{formatCurrency(stats.avgWin)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Avg Loss</span>
                <span className="text-red-400 font-mono">{formatCurrency(Math.abs(stats.avgLoss))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Cash Available</span>
                <span className="text-white font-mono">{formatCurrency(cash)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Buying Power</span>
                <span className="text-white font-mono">{formatCurrency(buyingPower)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Positions Table */}
        {positions.length > 0 && (
          <div className="rounded-xl border border-[#1f1f1f] bg-[#111111] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#1f1f1f] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Current Holdings</h3>
              <span className="text-[11px] text-gray-500">{positions.length} positions</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] text-gray-500 uppercase tracking-wider border-b border-[#1f1f1f]">
                    <th className="text-left px-4 py-2">Symbol</th>
                    <th className="text-right px-4 py-2">Shares</th>
                    <th className="text-right px-4 py-2">Avg Entry</th>
                    <th className="text-right px-4 py-2">Current</th>
                    <th className="text-right px-4 py-2">Market Value</th>
                    <th className="text-right px-4 py-2">P&L</th>
                    <th className="text-right px-4 py-2">% of Portfolio</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p) => {
                    const mv = toNumber(p.market_value);
                    const pnl = toNumber(p.unrealized_pl);
                    const pnlPct = toNumber(p.unrealized_plpc) * 100;
                    const allocation = totalMarketValue > 0 ? (mv / totalMarketValue) * 100 : 0;
                    return (
                      <tr key={p.symbol} className="border-b border-[#1f1f1f]/40 hover:bg-white/[0.02]">
                        <td className="px-4 py-2.5 font-bold text-white">{p.symbol}</td>
                        <td className="px-4 py-2.5 text-right text-gray-300 font-mono">{toNumber(p.qty)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-300 font-mono">${toNumber(p.avg_entry_price).toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right text-white font-mono">${toNumber(p.current_price).toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-right text-white font-mono">{formatCurrency(mv)}</td>
                        <td className={`px-4 py-2.5 text-right font-mono ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {formatSigned(pnl)} <span className="text-[10px]">({formatPct(pnlPct)})</span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, allocation)}%` }} />
                            </div>
                            <span className="text-gray-400 text-[11px] font-mono w-10 text-right">{allocation.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
