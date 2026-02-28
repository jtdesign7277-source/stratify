import React, { useState, useMemo, useEffect } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import usePaperTrading from '../../hooks/usePaperTrading';
import {
  Wallet, TrendingUp, TrendingDown, DollarSign, PieChart,
  BarChart3, Clock, RefreshCw, ChevronDown, ChevronUp, X,
  AlertTriangle, Briefcase, Activity
} from 'lucide-react';

// ─── Highcharts Dark Theme (Stratify Terminal-Pro) ─────────
const STRATIFY_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#ec4899', '#6366f1', '#14b8a6'
];

const darkTheme = {
  chart: {
    backgroundColor: '#060d18',
    style: { fontFamily: "'Inter', 'SF Mono', monospace" },
    borderRadius: 12,
    spacing: [20, 20, 20, 20],
  },
  title: { style: { color: '#e2e8f0', fontSize: '14px', fontWeight: '600' } },
  subtitle: { style: { color: '#64748b', fontSize: '11px' } },
  xAxis: {
    gridLineColor: '#1a2538',
    lineColor: '#1a2538',
    tickColor: '#1a2538',
    labels: { style: { color: '#64748b', fontSize: '10px' } },
    title: { style: { color: '#94a3b8' } },
  },
  yAxis: {
    gridLineColor: '#1a253833',
    lineColor: '#1a2538',
    labels: { style: { color: '#64748b', fontSize: '10px' } },
    title: { style: { color: '#94a3b8' } },
  },
  legend: {
    itemStyle: { color: '#94a3b8', fontSize: '11px' },
    itemHoverStyle: { color: '#e2e8f0' },
  },
  tooltip: {
    backgroundColor: '#0a1628',
    borderColor: '#1a2538',
    style: { color: '#e2e8f0', fontSize: '11px' },
    borderRadius: 8,
    shadow: false,
  },
  plotOptions: {
    series: { animation: { duration: 800 } },
  },
  credits: { enabled: false },
  colors: STRATIFY_COLORS,
};

// Apply theme globally
Highcharts.setOptions(darkTheme);

// ─── Formatters ────────────────────────────────────────────
const fmt = (v, decimals = 2) =>
  '$' + Number(v || 0).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const fmtPct = (v) => {
  const n = Number(v || 0);
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
};

const fmtQty = (v) => {
  const n = Number(v || 0);
  return n >= 1 ? n.toFixed(2) : n.toFixed(6);
};

// ─── KPI Card ──────────────────────────────────────────────
function KPICard({ label, value, subValue, icon: Icon, trend, color }) {
  const isPositive = trend === 'up';
  const isNegative = trend === 'down';

  return (
    <div className="bg-[#0a1628] border border-[#1a2538] rounded-xl p-4 flex flex-col gap-1 hover:border-[#2a3548] transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">{label}</span>
        {Icon && (
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: `${color || '#3b82f6'}15` }}>
            <Icon size={12} strokeWidth={1.5} style={{ color: color || '#3b82f6' }} />
          </div>
        )}
      </div>
      <span className={`text-xl font-bold font-mono tracking-tight ${
        isPositive ? 'text-emerald-400' : isNegative ? 'text-red-400' : 'text-white'
      }`}>
        {value}
      </span>
      {subValue && (
        <span className={`text-[11px] font-mono ${
          isPositive ? 'text-emerald-400/70' : isNegative ? 'text-red-400/70' : 'text-gray-500'
        }`}>
          {subValue}
        </span>
      )}
    </div>
  );
}

// ─── Holdings Row ──────────────────────────────────────────
function HoldingRow({ position, onClose }) {
  const pnl = Number(position.pnl || 0);
  const pnlPct = Number(position.pnl_percent || 0);
  const isProfit = pnl >= 0;

  return (
    <tr className="border-b border-[#1a2538]/50 hover:bg-[#0f1d32]/50 transition-colors group">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isProfit ? 'bg-emerald-400' : 'bg-red-400'}`} />
          <span className="text-white font-mono font-medium text-sm">${position.symbol}</span>
        </div>
      </td>
      <td className="py-3 px-3 text-right">
        <span className="text-gray-300 font-mono text-sm">{fmtQty(position.quantity)}</span>
      </td>
      <td className="py-3 px-3 text-right">
        <span className="text-gray-400 font-mono text-sm">{fmt(position.avg_cost_basis)}</span>
      </td>
      <td className="py-3 px-3 text-right">
        <span className="text-white font-mono text-sm">{fmt(position.current_price)}</span>
      </td>
      <td className="py-3 px-3 text-right">
        <span className="text-gray-300 font-mono text-sm">{fmt(position.market_value)}</span>
      </td>
      <td className="py-3 px-3 text-right">
        <span className={`font-mono text-sm font-medium ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
          {isProfit ? '+' : ''}{fmt(pnl)}
        </span>
      </td>
      <td className="py-3 px-3 text-right">
        <span className={`font-mono text-xs px-2 py-0.5 rounded-md ${
          isProfit ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-400'
        }`}>
          {fmtPct(pnlPct)}
        </span>
      </td>
      <td className="py-3 px-3 text-right">
        <button
          onClick={() => onClose(position.symbol)}
          className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all text-[10px] uppercase tracking-wider font-medium px-2 py-1 rounded hover:bg-red-400/10"
        >
          Close
        </button>
      </td>
    </tr>
  );
}

// ─── Generate Mock Portfolio History ───────────────────────
function generatePortfolioHistory(currentValue, days = 90) {
  const data = [];
  const now = Date.now();
  let value = currentValue * 0.85; // start lower

  for (let i = days; i >= 0; i--) {
    const timestamp = now - (i * 24 * 60 * 60 * 1000);
    const change = (Math.random() - 0.45) * (currentValue * 0.015);
    value = Math.max(value + change, currentValue * 0.7);
    if (i === 0) value = currentValue;
    data.push([timestamp, Math.round(value * 100) / 100]);
  }
  return data;
}

// ─── Main Portfolio Dashboard ──────────────────────────────
export default function PortfolioDashboard() {
  const { portfolio, trades, loading, error, closePosition, fetchPortfolio } = usePaperTrading();
  const [sortField, setSortField] = useState('market_value');
  const [sortDir, setSortDir] = useState('desc');

  const positions = portfolio?.positions || [];
  const cashBalance = Number(portfolio?.cash_balance || 0);
  const totalValue = Number(portfolio?.total_account_value || 0);
  const totalPnl = Number(portfolio?.total_pnl || 0);
  const totalPnlPct = Number(portfolio?.total_pnl_percent || 0);
  const startingBalance = 100000;
  const investedValue = totalValue - cashBalance;

  // Sort positions
  const sortedPositions = useMemo(() => {
    return [...positions].sort((a, b) => {
      const aVal = Number(a[sortField] || 0);
      const bVal = Number(b[sortField] || 0);
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [positions, sortField, sortDir]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortDir === 'desc'
      ? <ChevronDown size={10} className="inline ml-0.5" />
      : <ChevronUp size={10} className="inline ml-0.5" />;
  };

  // ─── Portfolio Performance Chart ───────────────────────
  const performanceOptions = useMemo(() => ({
    chart: {
      type: 'areaspline',
      backgroundColor: 'transparent',
      height: 260,
      spacing: [10, 10, 10, 10],
    },
    title: { text: null },
    xAxis: {
      type: 'datetime',
      gridLineWidth: 0,
      lineColor: '#1a2538',
      tickLength: 0,
      labels: {
        format: '{value:%b %d}',
        style: { color: '#4a5568', fontSize: '9px' },
      },
    },
    yAxis: {
      title: { text: null },
      gridLineColor: '#1a253822',
      labels: {
        formatter: function () { return '$' + (this.value / 1000).toFixed(0) + 'k'; },
        style: { color: '#4a5568', fontSize: '9px' },
      },
    },
    tooltip: {
      pointFormat: 'Portfolio: <b>${point.y:,.2f}</b>',
      xDateFormat: '%b %d, %Y',
    },
    legend: { enabled: false },
    plotOptions: {
      areaspline: {
        fillColor: {
          linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
          stops: [
            [0, totalPnl >= 0 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'],
            [1, 'rgba(6, 13, 24, 0)'],
          ],
        },
        lineColor: totalPnl >= 0 ? '#10b981' : '#ef4444',
        lineWidth: 2,
        marker: { enabled: false },
        threshold: null,
      },
    },
    series: [{
      name: 'Portfolio Value',
      data: generatePortfolioHistory(totalValue || startingBalance),
    }],
  }), [totalValue, totalPnl]);

  // ─── Allocation Donut Chart ────────────────────────────
  const allocationOptions = useMemo(() => {
    const slices = positions.map((p, i) => ({
      name: `$${p.symbol}`,
      y: Number(p.market_value || 0),
      color: STRATIFY_COLORS[i % STRATIFY_COLORS.length],
    }));

    if (cashBalance > 0) {
      slices.push({
        name: 'Cash',
        y: cashBalance,
        color: '#1e293b',
      });
    }

    return {
      chart: {
        type: 'pie',
        backgroundColor: 'transparent',
        height: 260,
        spacing: [0, 0, 0, 0],
      },
      title: { text: null },
      tooltip: {
        pointFormat: '<b>{point.percentage:.1f}%</b><br/>{point.y:$,.2f}',
      },
      plotOptions: {
        pie: {
          innerSize: '65%',
          borderWidth: 0,
          borderColor: '#060d18',
          dataLabels: {
            enabled: true,
            format: '{point.name}',
            distance: 15,
            style: { color: '#94a3b8', fontSize: '10px', fontWeight: '400', textOutline: 'none' },
          },
          states: {
            hover: { brightness: 0.15 },
          },
        },
      },
      series: [{
        name: 'Allocation',
        data: slices.length > 0 ? slices : [{ name: 'Cash', y: startingBalance, color: '#1e293b' }],
      }],
    };
  }, [positions, cashBalance]);

  // ─── Recent Trades ─────────────────────────────────────
  const recentTrades = (trades || []).slice(0, 5);

  if (loading && !portfolio) {
    return (
      <div className="flex items-center justify-center h-full bg-[#060d18]">
        <div className="flex items-center gap-3 text-gray-500">
          <RefreshCw size={16} className="animate-spin" />
          <span className="text-sm">Loading portfolio...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#060d18] p-4 space-y-4">

      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-white text-lg font-semibold">Portfolio</h2>
          <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Paper Mode
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchPortfolio}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-[#0f1d32] border border-[#1a2538] transition-all"
          >
            <RefreshCw size={11} strokeWidth={1.5} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── KPI Row ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KPICard
          label="Total Value"
          value={fmt(totalValue)}
          icon={Wallet}
          color="#3b82f6"
        />
        <KPICard
          label="Cash Available"
          value={fmt(cashBalance)}
          icon={DollarSign}
          color="#06b6d4"
        />
        <KPICard
          label="Invested"
          value={fmt(investedValue)}
          icon={Briefcase}
          color="#8b5cf6"
        />
        <KPICard
          label="Total P&L"
          value={(totalPnl >= 0 ? '+' : '') + fmt(totalPnl)}
          subValue={fmtPct(totalPnlPct)}
          icon={totalPnl >= 0 ? TrendingUp : TrendingDown}
          trend={totalPnl >= 0 ? 'up' : 'down'}
          color={totalPnl >= 0 ? '#10b981' : '#ef4444'}
        />
        <KPICard
          label="Positions"
          value={String(positions.length)}
          icon={PieChart}
          color="#f59e0b"
        />
        <KPICard
          label="Trades"
          value={String((trades || []).length)}
          icon={Activity}
          color="#f97316"
        />
      </div>

      {/* ── Charts Row ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        {/* Performance Chart (3/5) */}
        <div className="lg:col-span-3 bg-[#0a1628] border border-[#1a2538] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1a2538] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 size={13} strokeWidth={1.5} className="text-blue-400" />
              <span className="text-white text-xs font-medium">Portfolio Performance</span>
              <span className="text-gray-600 text-[10px]">90 days</span>
            </div>
            <span className={`text-xs font-mono font-medium ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmtPct(totalPnlPct)}
            </span>
          </div>
          <div className="p-2">
            <HighchartsReact highcharts={Highcharts} options={performanceOptions} />
          </div>
        </div>

        {/* Allocation Donut (2/5) */}
        <div className="lg:col-span-2 bg-[#0a1628] border border-[#1a2538] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1a2538] flex items-center gap-2">
            <PieChart size={13} strokeWidth={1.5} className="text-purple-400" />
            <span className="text-white text-xs font-medium">Allocation</span>
          </div>
          <div className="p-2">
            <HighchartsReact highcharts={Highcharts} options={allocationOptions} />
          </div>
        </div>
      </div>

      {/* ── Holdings Table ────────────────────────────────── */}
      <div className="bg-[#0a1628] border border-[#1a2538] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1a2538] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase size={13} strokeWidth={1.5} className="text-blue-400" />
            <span className="text-white text-xs font-medium">Holdings</span>
            <span className="text-gray-600 text-[10px]">{positions.length} position{positions.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {positions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1a2538]">
                  {[
                    { key: 'symbol', label: 'Symbol', align: 'left' },
                    { key: 'quantity', label: 'Qty', align: 'right' },
                    { key: 'avg_cost_basis', label: 'Avg Cost', align: 'right' },
                    { key: 'current_price', label: 'Price', align: 'right' },
                    { key: 'market_value', label: 'Mkt Value', align: 'right' },
                    { key: 'pnl', label: 'P&L', align: 'right' },
                    { key: 'pnl_percent', label: 'P&L %', align: 'right' },
                    { key: null, label: '', align: 'right' },
                  ].map(col => (
                    <th
                      key={col.label || 'actions'}
                      onClick={() => col.key && handleSort(col.key)}
                      className={`py-2.5 px-${col.align === 'left' ? '4' : '3'} text-${col.align} text-[10px] uppercase tracking-wider text-gray-500 font-medium ${col.key ? 'cursor-pointer hover:text-gray-300 transition-colors' : ''}`}
                    >
                      {col.label}<SortIcon field={col.key} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedPositions.map(pos => (
                  <HoldingRow key={pos.symbol} position={pos} onClose={closePosition} />
                ))}
              </tbody>
              {/* Totals Row */}
              <tfoot>
                <tr className="border-t border-[#1a2538] bg-[#060d18]/50">
                  <td className="py-3 px-4 text-white text-xs font-semibold" colSpan={4}>Total</td>
                  <td className="py-3 px-3 text-right text-white font-mono text-sm font-semibold">
                    {fmt(investedValue)}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className={`font-mono text-sm font-semibold ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {totalPnl >= 0 ? '+' : ''}{fmt(totalPnl)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className={`font-mono text-xs px-2 py-0.5 rounded-md font-semibold ${
                      totalPnl >= 0 ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-400'
                    }`}>
                      {fmtPct(totalPnlPct)}
                    </span>
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-gray-600">
            <Wallet size={24} strokeWidth={1.5} className="mb-2 text-gray-700" />
            <span className="text-xs">No open positions</span>
            <span className="text-[10px] text-gray-700 mt-1">Execute a trade to see holdings here</span>
          </div>
        )}
      </div>

      {/* ── Recent Trades ─────────────────────────────────── */}
      {recentTrades.length > 0 && (
        <div className="bg-[#0a1628] border border-[#1a2538] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1a2538] flex items-center gap-2">
            <Clock size={13} strokeWidth={1.5} className="text-amber-400" />
            <span className="text-white text-xs font-medium">Recent Trades</span>
          </div>
          <div className="divide-y divide-[#1a2538]/50">
            {recentTrades.map((trade, i) => {
              const isBuy = trade.side === 'buy';
              return (
                <div key={trade.id || i} className="flex items-center justify-between px-4 py-2.5 hover:bg-[#0f1d32]/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                      isBuy ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-400'
                    }`}>
                      {trade.side}
                    </span>
                    <span className="text-white font-mono text-sm">${trade.symbol}</span>
                    <span className="text-gray-500 text-xs">×{fmtQty(trade.quantity)}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-gray-300 font-mono text-xs">@ {fmt(trade.price)}</span>
                    <span className="text-gray-500 font-mono text-xs">{fmt(trade.total_value)}</span>
                    <span className="text-gray-600 text-[10px]">
                      {new Date(trade.created_at).toLocaleString('en-US', {
                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Error Banner ──────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}
    </div>
  );
}
