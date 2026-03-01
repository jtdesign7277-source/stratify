import React, { useEffect, useMemo, useState } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import usePaperTrading from '../../hooks/usePaperTrading';
import { useTradeHistory as useTradeHistoryStore } from '../../store/StratifyProvider';
import { subscribeCryptoPrices } from '../../services/twelveDataStream';
import { getMarketStatus } from '../../lib/marketHours';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const STARTING_BALANCE = 100000;
const GOAL_TARGET = 150000;

const CRYPTO_BASE_SYMBOLS = new Set(['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'LINK', 'ADA', 'AVAX', 'DOT']);

const normalizeSymbol = (value = '') => String(value || '').trim().toUpperCase().replace(/^\$/, '');
const toSymbolKey = (value = '') => normalizeSymbol(value).replace(/[^A-Z0-9]/g, '');

const isCryptoSymbol = (value = '') => {
  const normalized = normalizeSymbol(value);
  if (!normalized) return false;

  if (normalized.includes('/')) {
    const [base = ''] = normalized.split('/');
    return CRYPTO_BASE_SYMBOLS.has(base.replace(/[^A-Z0-9]/g, ''));
  }

  const compact = normalized.replace(/[^A-Z0-9]/g, '');
  if (CRYPTO_BASE_SYMBOLS.has(compact)) return true;
  if (compact.endsWith('USD') && compact.length > 3) {
    return CRYPTO_BASE_SYMBOLS.has(compact.slice(0, -3));
  }
  return false;
};

const toStreamSymbol = (value = '') => {
  const normalized = normalizeSymbol(value);
  if (!normalized) return '';

  if (normalized.includes('/')) {
    const [baseRaw = '', quoteRaw = 'USD'] = normalized.split('/');
    const base = baseRaw.replace(/[^A-Z0-9]/g, '');
    const quote = (quoteRaw || 'USD').replace(/[^A-Z0-9]/g, '') || 'USD';
    if (!base) return '';
    return `${base}/${quote}`;
  }

  const compact = normalized.replace(/[^A-Z0-9]/g, '');
  if (!compact) return '';

  if (CRYPTO_BASE_SYMBOLS.has(compact)) return `${compact}/USD`;
  if (compact.endsWith('USD') && compact.length > 3 && CRYPTO_BASE_SYMBOLS.has(compact.slice(0, -3))) {
    return `${compact.slice(0, -3)}/USD`;
  }

  return compact;
};

const fmtMoney = (value, decimals = 2) => {
  const parsed = Number(value || 0);
  return '$' + parsed.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

const fmtQty = (value) => {
  const parsed = Number(value || 0);
  return parsed >= 1 ? parsed.toFixed(2) : parsed.toFixed(6);
};

const fmtPct = (value) => {
  const parsed = Number(value || 0);
  return `${parsed >= 0 ? '+' : ''}${parsed.toFixed(2)}%`;
};

const summarizePositions = (rows = []) => {
  const value = rows.reduce((sum, row) => sum + Number(row?.market_value || 0), 0);
  const pnl = rows.reduce((sum, row) => sum + Number(row?.pnl || 0), 0);
  const costBasis = rows.reduce((sum, row) => {
    const marketValue = Number(row?.market_value || 0);
    const rowPnl = Number(row?.pnl || 0);
    const derivedCost = marketValue - rowPnl;
    return sum + Math.max(0, Number.isFinite(derivedCost) ? derivedCost : 0);
  }, 0);
  const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
  return { value, pnl, pnlPct };
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const generateWalletSeries = (holdingValue, investedValue, points = 120) => {
  const now = Date.now();
  const holding = [];
  const invested = [];

  for (let i = 0; i <= points; i += 1) {
    const ratio = i / points;
    const t = now - (points - i) * 24 * 60 * 60 * 1000;
    const wave = Math.sin(i * 0.33) * 0.008 * investedValue;
    const holdingPoint = investedValue + (holdingValue - investedValue) * ratio + wave;

    holding.push([t, i === points ? holdingValue : holdingPoint]);
    invested.push([t, investedValue]);
  }

  return { holding, invested };
};

const asTradeValue = (trade) => {
  const explicit = Number(trade?.total_cost);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const qty = Number(trade?.quantity || 0);
  const price = Number(trade?.price || 0);
  return qty > 0 && price > 0 ? qty * price : 0;
};

const toTimestamp = (value) => {
  if (Number.isFinite(value)) return Number(value);
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatTradeTime = (value) => {
  const timestamp = toTimestamp(value);
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const panelClass = 'rounded-xl border border-[#1f1f1f] bg-[#0b0b0b]';
const starfieldBaseStyle = {
  backgroundImage:
    'radial-gradient(circle at 50% 50%, rgba(6,13,24,0.96) 0%, rgba(4,9,18,0.98) 55%, rgba(2,6,14,1) 100%), radial-gradient(circle at 14% 18%, rgba(16,185,129,0.08), transparent 34%), radial-gradient(circle at 82% 72%, rgba(148,163,184,0.08), transparent 36%)',
};
const starfieldDotsStyle = {
  backgroundImage:
    'radial-gradient(rgba(255,255,255,0.28) 0.7px, transparent 1px), radial-gradient(rgba(167,243,208,0.22) 0.65px, transparent 0.95px), radial-gradient(rgba(148,163,184,0.18) 0.7px, transparent 1px)',
  backgroundSize: '150px 150px, 210px 210px, 260px 260px',
  backgroundPosition: '0 0, 42px 86px, 118px 30px',
};

export default function PortfolioDashboard() {
  const { portfolio, trades, loading, error, fetchPortfolio, updatePositionPrice } = usePaperTrading();
  const { trades: syncedTrades = [] } = useTradeHistoryStore();
  const [marketStatus, setMarketStatus] = useState(() => getMarketStatus());

  const positions = Array.isArray(portfolio?.positions) ? portfolio.positions : [];
  const cashBalance = Number(portfolio?.cash_balance || 0);
  const totalValue = Number(portfolio?.total_account_value || STARTING_BALANCE);
  const totalPnl = Number(portfolio?.total_pnl || 0);
  const totalPnlPct = Number(portfolio?.total_pnl_percent || 0);

  const investedNow = Math.max(0, totalValue - cashBalance);
  const holdingNow = totalValue;

  const strategyTrades = useMemo(() => {
    const rows = Array.isArray(syncedTrades) ? syncedTrades : [];

    return rows
      .filter((trade) => {
        const strategyId = String(
          trade?.strategyId
          ?? trade?.strategy
          ?? trade?.strategy_id
          ?? '',
        ).trim();

        const source = String(trade?.source ?? trade?.origin ?? '').toLowerCase();
        const note = String(trade?.note ?? trade?.reason ?? '').toLowerCase();

        return Boolean(strategyId)
          || source.includes('strategy')
          || source.includes('ai')
          || note.includes('strategy')
          || note.includes('ai');
      })
      .sort((a, b) => toTimestamp(b?.timestamp) - toTimestamp(a?.timestamp))
      .slice(0, 30);
  }, [syncedTrades]);

  const strategySymbols = useMemo(() => new Set(
    strategyTrades
      .map((trade) => normalizeSymbol(trade?.symbol))
      .filter(Boolean)
  ), [strategyTrades]);

  const strategyPositions = useMemo(
    () => positions.filter((position) => strategySymbols.has(normalizeSymbol(position?.symbol))),
    [positions, strategySymbols]
  );

  const nonStrategyPositions = useMemo(
    () => positions.filter((position) => !strategySymbols.has(normalizeSymbol(position?.symbol))),
    [positions, strategySymbols]
  );

  const equityPositions = useMemo(
    () => nonStrategyPositions.filter((position) => !isCryptoSymbol(position?.symbol)),
    [nonStrategyPositions]
  );

  const cryptoPositions = useMemo(
    () => nonStrategyPositions.filter((position) => isCryptoSymbol(position?.symbol)),
    [nonStrategyPositions]
  );

  const equitySummary = useMemo(() => summarizePositions(equityPositions), [equityPositions]);
  const cryptoSummary = useMemo(() => summarizePositions(cryptoPositions), [cryptoPositions]);
  const strategySummary = useMemo(() => summarizePositions(strategyPositions), [strategyPositions]);

  const holdingsSections = useMemo(() => ([
    { id: 'equity', label: 'Equity Holdings', rows: equityPositions, summary: equitySummary },
    { id: 'crypto', label: 'Crypto Holdings', rows: cryptoPositions, summary: cryptoSummary },
    { id: 'strategy', label: 'Strategy Holdings', rows: strategyPositions, summary: strategySummary },
  ]), [
    cryptoPositions,
    cryptoSummary,
    equityPositions,
    equitySummary,
    strategyPositions,
    strategySummary,
  ]);

  const { holding, invested } = useMemo(
    () => generateWalletSeries(holdingNow, STARTING_BALANCE),
    [holdingNow]
  );

  const riskScore = useMemo(() => {
    if (!positions.length) return 8;

    const maxWeight = positions.reduce((max, position) => {
      const weight = totalValue > 0 ? (Number(position?.market_value || 0) / totalValue) * 100 : 0;
      return Math.max(max, weight);
    }, 0);

    const cryptoWeight = positions.reduce((sum, position) => {
      if (!isCryptoSymbol(position?.symbol)) return sum;
      const weight = totalValue > 0 ? (Number(position?.market_value || 0) / totalValue) * 100 : 0;
      return sum + weight;
    }, 0);

    const pnlVolProxy = Math.min(25, Math.abs(totalPnlPct) * 0.8);
    return clamp(15 + maxWeight * 0.45 + cryptoWeight * 0.25 + pnlVolProxy, 1, 99);
  }, [positions, totalValue, totalPnlPct]);

  const goalProbability = useMemo(() => {
    const progress = clamp((totalValue / GOAL_TARGET) * 100, 0, 100);
    const momentum = clamp(totalPnlPct, -40, 40);
    return Math.round(clamp(progress * 0.75 + (momentum + 40) * 0.3, 0, 100));
  }, [totalValue, totalPnlPct]);

  const allocationSlices = useMemo(() => {
    const palette = ['#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#6366f1', '#0ea5e9'];
    const rows = [];

    positions
      .slice()
      .sort((a, b) => Number(b?.market_value || 0) - Number(a?.market_value || 0))
      .forEach((position, index) => {
        const value = Number(position?.market_value || 0);
        if (value <= 0) return;
        rows.push({
          name: `$${normalizeSymbol(position?.symbol || '--')}`,
          y: value,
          color: palette[index % palette.length],
        });
      });

    if (cashBalance > 0) {
      rows.push({
        name: 'Cash',
        y: cashBalance,
        color: '#1e293b',
      });
    }

    if (!rows.length) {
      rows.push({ name: 'Cash', y: STARTING_BALANCE, color: '#1e293b' });
    }

    return rows;
  }, [positions, cashBalance]);

  const heldSymbolsKey = useMemo(() => {
    const unique = new Set();
    positions.forEach((position) => {
      const symbol = normalizeSymbol(position?.symbol);
      if (symbol) unique.add(symbol);
    });
    return [...unique].sort().join(',');
  }, [positions]);

  const streamConfig = useMemo(() => {
    const equitiesEnabled = marketStatus !== 'Weekend' && marketStatus !== 'Holiday';
    const streamSymbols = [];
    const streamToPositionSymbols = new Map();

    if (!heldSymbolsKey) {
      return { streamSymbols, streamToPositionSymbols };
    }

    heldSymbolsKey.split(',').forEach((positionSymbol) => {
      if (!positionSymbol) return;
      const crypto = isCryptoSymbol(positionSymbol);
      if (!crypto && !equitiesEnabled) return;

      const streamSymbol = toStreamSymbol(positionSymbol);
      const streamKey = toSymbolKey(streamSymbol);
      if (!streamSymbol || !streamKey) return;

      if (!streamToPositionSymbols.has(streamKey)) {
        streamToPositionSymbols.set(streamKey, new Set());
        streamSymbols.push(streamSymbol);
      }
      streamToPositionSymbols.get(streamKey).add(positionSymbol);
    });

    return { streamSymbols, streamToPositionSymbols };
  }, [heldSymbolsKey, marketStatus]);

  useEffect(() => {
    const timer = setInterval(() => {
      setMarketStatus(getMarketStatus());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!streamConfig.streamSymbols.length) return undefined;

    const unsubscribe = subscribeCryptoPrices(streamConfig.streamSymbols, (update) => {
      const price = Number(update?.price);
      if (!Number.isFinite(price) || price <= 0) return;

      const incomingKey = toSymbolKey(update?.symbol);
      if (!incomingKey) return;

      const linkedSymbols = streamConfig.streamToPositionSymbols.get(incomingKey);
      if (linkedSymbols && linkedSymbols.size > 0) {
        linkedSymbols.forEach((positionSymbol) => {
          updatePositionPrice(positionSymbol, price);
        });
        return;
      }

      updatePositionPrice(update?.symbol, price);
    });

    return () => unsubscribe?.();
  }, [streamConfig, updatePositionPrice]);

  useEffect(() => {
    const onTradeExecuted = () => {
      fetchPortfolio({ silent: true });
    };

    window.addEventListener('paper-trade-executed', onTradeExecuted);
    return () => window.removeEventListener('paper-trade-executed', onTradeExecuted);
  }, [fetchPortfolio]);

  const walletChartOptions = useMemo(() => ({
    chart: {
      type: 'areaspline',
      backgroundColor: 'transparent',
      height: 280,
      spacing: [12, 12, 12, 12],
    },
    title: { text: null },
    credits: { enabled: false },
    legend: {
      itemStyle: { color: '#94a3b8' },
      itemHoverStyle: { color: '#e5e7eb' },
    },
    xAxis: {
      type: 'datetime',
      lineColor: '#1f1f1f',
      tickColor: '#1f1f1f',
      labels: { style: { color: '#6b7280', fontSize: '10px' } },
    },
    yAxis: {
      title: { text: null },
      gridLineColor: '#1f1f1f',
      labels: {
        style: { color: '#6b7280', fontSize: '10px' },
        formatter() { return fmtMoney(this.value, 0); },
      },
    },
    tooltip: {
      backgroundColor: '#0b0b0b',
      borderColor: '#1f1f1f',
      style: { color: '#e5e7eb' },
      xDateFormat: '%b %e, %Y',
      pointFormat: '<span style="color:{series.color}">●</span> {series.name}: <b>${point.y:,.2f}</b><br/>',
      shared: true,
    },
    plotOptions: {
      series: {
        marker: { enabled: false },
        animation: false,
      },
      areaspline: {
        fillOpacity: 0.2,
      },
    },
    series: [
      {
        type: 'areaspline',
        name: 'Holding',
        data: holding,
        color: '#10b981',
        lineWidth: 2,
      },
      {
        type: 'line',
        name: 'Invested',
        data: invested,
        color: '#737373',
        dashStyle: 'ShortDot',
        lineWidth: 2,
      },
    ],
  }), [holding, invested]);

  const riskColor = riskScore >= 75 ? '#ef4444' : '#3b82f6';
  const goalColor = goalProbability >= 60 ? '#10b981' : '#ef4444';

  const allocationPieOptions = useMemo(() => ({
    chart: {
      type: 'pie',
      backgroundColor: 'transparent',
      height: 280,
      spacing: [6, 6, 6, 6],
      animation: true,
    },
    title: { text: null },
    credits: { enabled: false },
    legend: {
      enabled: true,
      itemStyle: { color: '#94a3b8', fontSize: '10px' },
      itemHoverStyle: { color: '#e5e7eb' },
    },
    tooltip: {
      backgroundColor: '#0b0b0b',
      borderColor: '#1f1f1f',
      style: { color: '#e5e7eb' },
      pointFormat: '<b>{point.name}</b><br/>Value: <b>{point.y:$,.2f}</b><br/>Weight: <b>{point.percentage:.2f}%</b>',
    },
    plotOptions: {
      series: {
        animation: { duration: 900 },
      },
      pie: {
        innerSize: '56%',
        borderWidth: 2,
        borderColor: '#0b0b0b',
        shadow: {
          color: 'rgba(0, 0, 0, 0.45)',
          offsetX: 0,
          offsetY: 4,
          opacity: 0.35,
          width: 6,
        },
        dataLabels: {
          enabled: true,
          distance: 12,
          style: { color: '#cbd5e1', textOutline: 'none', fontSize: '10px' },
          formatter() {
            return this.percentage >= 4 ? `${this.point.name} ${this.percentage.toFixed(1)}%` : '';
          },
        },
      },
    },
    series: [{
      type: 'pie',
      data: allocationSlices,
    }],
  }), [allocationSlices]);

  const metricsBarOptions = useMemo(() => ({
    chart: {
      type: 'column',
      backgroundColor: 'transparent',
      height: 280,
      spacing: [6, 6, 6, 6],
      animation: true,
    },
    title: { text: null },
    credits: { enabled: false },
    legend: {
      enabled: true,
      itemStyle: { color: '#94a3b8', fontSize: '10px' },
      itemHoverStyle: { color: '#e5e7eb' },
    },
    xAxis: {
      categories: ['Goal', 'Risk', 'Cash', 'Invested'],
      lineColor: '#1f1f1f',
      tickColor: '#1f1f1f',
      labels: { style: { color: '#94a3b8', fontSize: '10px' } },
    },
    yAxis: {
      min: 0,
      max: 100,
      title: { text: 'Score / Allocation %', style: { color: '#6b7280', fontSize: '10px' } },
      gridLineColor: '#1f1f1f',
      labels: {
        style: { color: '#6b7280', fontSize: '10px' },
        formatter() { return `${this.value}%`; },
      },
    },
    tooltip: {
      backgroundColor: '#0b0b0b',
      borderColor: '#1f1f1f',
      style: { color: '#e5e7eb' },
      pointFormat: '<b>{series.name}: {point.y:.1f}%</b>',
    },
    plotOptions: {
      series: {
        animation: { duration: 900 },
      },
      column: {
        borderWidth: 0,
        borderRadius: 6,
        dataLabels: {
          enabled: true,
          style: { color: '#e5e7eb', textOutline: 'none', fontSize: '10px' },
          formatter() { return `${this.y.toFixed(1)}%`; },
        },
      },
    },
    series: [
      {
        type: 'column',
        name: 'Current',
        data: [
          { y: goalProbability, color: goalColor },
          { y: riskScore, color: riskColor },
          { y: totalValue > 0 ? (cashBalance / totalValue) * 100 : 0, color: '#06b6d4' },
          { y: totalValue > 0 ? (investedNow / totalValue) * 100 : 0, color: '#6366f1' },
        ],
      },
      {
        type: 'line',
        name: 'Target',
        color: '#3b82f6',
        lineWidth: 1.5,
        marker: { enabled: true, radius: 3 },
        data: [70, 40, 30, 70],
      },
    ],
  }), [cashBalance, goalColor, goalProbability, investedNow, riskColor, riskScore, totalValue]);

  if (loading && !portfolio) {
    return (
      <div className="relative h-full overflow-hidden bg-[#060d18] text-gray-400" style={starfieldBaseStyle}>
        <div className="pointer-events-none absolute inset-0 opacity-70" style={starfieldDotsStyle} />
        <div className="relative z-10 flex h-full items-center justify-center">
          <RefreshCw size={16} className="mr-2 animate-spin" /> Loading portfolio...
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-y-auto bg-[#060d18] text-[#f8fbff]" style={starfieldBaseStyle}>
      <div className="pointer-events-none absolute inset-0 opacity-70" style={starfieldDotsStyle} />
      <div className="relative z-10 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-[#f8fbff]">Portfolio</h2>
          <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300">
            Paper Mode
          </span>
        </div>
        <button
          onClick={fetchPortfolio}
          className="inline-flex items-center gap-1 rounded-lg border border-[#1f1f1f] bg-[#0b0b0b] px-3 py-1.5 text-xs text-[#f8fbff] hover:text-[#ffffff]"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div className={`mt-3 ${panelClass} p-3`}>
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Holdings</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1f1f1f] text-[10px] uppercase tracking-[0.14em] text-gray-500">
                <th className="px-2 py-2 text-left">Symbol</th>
                <th className="px-2 py-2 text-right">Qty</th>
                <th className="px-2 py-2 text-right">Avg</th>
                <th className="px-2 py-2 text-right">Price</th>
                <th className="px-2 py-2 text-right">Value</th>
                <th className="px-2 py-2 text-right">P&L</th>
                <th className="px-2 py-2 text-right">P&L %</th>
              </tr>
            </thead>
            <tbody>
              {holdingsSections.map((section, sectionIndex) => (
                <React.Fragment key={section.id}>
                  {sectionIndex > 0 ? (
                    <tr>
                      <td colSpan={7} className="border-t-2 border-[#334155] px-0 py-0" />
                    </tr>
                  ) : null}

                  <tr className="border-b border-[#1f1f1f] bg-[#0a0a0a]/35">
                    <td colSpan={7} className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-400">
                      {section.label}
                    </td>
                  </tr>

                  {section.rows.length > 0 ? (
                    section.rows.map((position) => {
                      const pnl = Number(position?.pnl || 0);
                      const isProfit = pnl >= 0;
                      return (
                        <tr key={`${section.id}-${position.symbol}`} className="border-b border-[#1f1f1f]/60">
                          <td className="px-2 py-2 font-mono">${position.symbol}</td>
                          <td className="px-2 py-2 text-right font-mono">{fmtQty(position.quantity)}</td>
                          <td className="px-2 py-2 text-right font-mono">{fmtMoney(position.avg_cost_basis)}</td>
                          <td className="px-2 py-2 text-right font-mono">{fmtMoney(position.current_price)}</td>
                          <td className="px-2 py-2 text-right font-mono">{fmtMoney(position.market_value)}</td>
                          <td className={`px-2 py-2 text-right font-mono ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isProfit ? '+' : ''}{fmtMoney(pnl)}
                          </td>
                          <td className={`px-2 py-2 text-right font-mono ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                            {fmtPct(position.pnl_percent)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr className="border-b border-[#1f1f1f]/60">
                      <td colSpan={7} className="px-2 py-2 text-xs text-gray-500">
                        No {section.label.toLowerCase()}.
                      </td>
                    </tr>
                  )}

                  <tr className="border-b border-[#1f1f1f]/80 bg-[#0a0a0a]/30">
                    <td className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400" colSpan={4}>
                      {section.label} Totals
                    </td>
                    <td className="px-2 py-2 text-right font-mono text-[#f8fbff]">{fmtMoney(section.summary.value)}</td>
                    <td className={`px-2 py-2 text-right font-mono ${section.summary.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {section.summary.pnl >= 0 ? '+' : ''}{fmtMoney(section.summary.pnl)}
                    </td>
                    <td className={`px-2 py-2 text-right font-mono ${section.summary.pnlPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {fmtPct(section.summary.pnlPct)}
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 border-t-2 border-[#334155] pt-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Strategy Trade Log</div>
          {strategyTrades.length > 0 ? (
            <div className="divide-y divide-[#1f1f1f]/60">
              {strategyTrades.slice(0, 12).map((trade, index) => {
                const side = String(trade?.side || '').toLowerCase();
                const qty = Number(trade?.shares ?? trade?.quantity ?? trade?.qty ?? 0);
                const price = Number(trade?.price || 0);
                const strategyId = String(trade?.strategyId || trade?.strategy || '').trim();
                return (
                  <div
                    key={trade?.id || `strategy-trade-${index}`}
                    className="flex items-center justify-between px-2 py-1.5 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold uppercase tracking-[0.12em] ${side === 'buy' ? 'text-emerald-300' : 'text-red-300'}`}>
                        {side || 'trade'}
                      </span>
                      <span className="font-mono">${normalizeSymbol(trade?.symbol)}</span>
                      <span className="text-gray-500">x{fmtQty(qty)}</span>
                      {strategyId ? <span className="font-mono text-[10px] text-gray-400">{strategyId}</span> : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[#f8fbff]">@ {fmtMoney(price)}</span>
                      <span className="text-gray-500">{formatTradeTime(trade?.timestamp)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-2 py-1.5 text-xs text-gray-500">
              No AI strategy trades logged yet.
            </div>
          )}
        </div>

        <div className="mt-3 border-t-2 border-[#334155] pt-3">
          <div className="flex items-center justify-between text-xs">
            <span className="uppercase tracking-[0.12em] text-gray-500">Portfolio Value</span>
            <span className="font-mono text-sm text-[#f8fbff]">{fmtMoney(totalValue)}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs">
            <span className="uppercase tracking-[0.12em] text-gray-500">Buying Power</span>
            <span className="font-mono text-sm text-[#f8fbff]">{fmtMoney(cashBalance)}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs">
            <span className="uppercase tracking-[0.12em] text-gray-500">Total P&L</span>
            <span className={`font-mono text-sm ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {totalPnl >= 0 ? '+' : ''}{fmtMoney(totalPnl)}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs">
            <span className="uppercase tracking-[0.12em] text-gray-500">Total P&L %</span>
            <span className={`font-mono text-sm ${totalPnlPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmtPct(totalPnlPct)}
            </span>
          </div>
        </div>
      </div>

      <div className={`mt-3 ${panelClass} p-3`}>
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Portfolio Performance</div>
        <HighchartsReact highcharts={Highcharts} options={walletChartOptions} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className={`${panelClass} p-3`}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Allocation View</div>
          <HighchartsReact highcharts={Highcharts} options={allocationPieOptions} />
        </div>
        <div className={`${panelClass} p-3`}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Portfolio Metrics</div>
          <HighchartsReact highcharts={Highcharts} options={metricsBarOptions} />
        </div>
      </div>

      {Array.isArray(trades) && trades.length > 0 ? (
        <div className={`mt-3 ${panelClass} p-3`}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">Recent Trades</div>
          <div className="space-y-1">
            {trades.slice(0, 8).map((trade, index) => {
              const side = String(trade?.side || '').toLowerCase();
              const value = asTradeValue(trade);
              return (
                <div key={trade?.id || `${trade?.symbol || 'trade'}-${index}`} className="flex items-center justify-between rounded border border-[#1f1f1f] bg-[#0a0a0a] px-2 py-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold uppercase tracking-[0.12em] ${side === 'buy' ? 'text-emerald-300' : 'text-red-300'}`}>
                      {side || 'trade'}
                    </span>
                    <span className="font-mono">${normalizeSymbol(trade?.symbol)}</span>
                    <span className="text-gray-500">x{fmtQty(trade?.quantity)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[#f8fbff]">@ {fmtMoney(trade?.price)}</span>
                    <span className="font-mono text-[#f8fbff]">{fmtMoney(value)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          <AlertTriangle size={14} /> {error}
        </div>
      ) : null}
      </div>
    </div>
  );
}
