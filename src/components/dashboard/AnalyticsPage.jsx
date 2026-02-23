import React, { useMemo } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { Activity, Target, TrendingDown, TrendingUp } from 'lucide-react';

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

const clampPercent = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(100, Math.max(0, numeric));
};

const normalizeTrade = (raw) => {
  if (!raw || typeof raw !== 'object') return null;

  const symbol = normalizeSymbol(raw.symbol ?? raw.ticker ?? raw.asset ?? raw.Symbol);
  if (!symbol) return null;

  const shares = Math.abs(
    toNumber(raw.shares ?? raw.qty ?? raw.quantity ?? raw.filled_qty ?? raw.size) ?? 0,
  );
  const price =
    toNumber(
      raw.price ??
        raw.fillPrice ??
        raw.avgPrice ??
        raw.avg_entry_price ??
        raw.filled_avg_price ??
        raw.executionPrice,
    ) ?? 0;

  if (!Number.isFinite(shares) || shares <= 0) return null;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sideRaw = String(
    raw.side ?? raw.type ?? raw.action ?? raw.order_side ?? raw.orderSide ?? '',
  ).toLowerCase();
  const side = sideRaw.includes('sell') || sideRaw === 'short' || sideRaw === 'close' ? 'sell' : 'buy';

  const timestamp =
    toTimestamp(
      raw.timestamp ??
        raw.time ??
        raw.date ??
        raw.filled_at ??
        raw.filledAt ??
        raw.submitted_at ??
        raw.created_at,
    ) ?? Date.now();

  const id = String(raw.id ?? raw.tradeId ?? raw.orderId ?? '').trim();

  return {
    id,
    symbol,
    side,
    shares,
    price,
    timestamp,
  };
};

const buildTradeKey = (trade) => {
  const tsBucket = Math.floor(Number(trade.timestamp || 0) / 1000);
  return `${trade.id || 'noid'}|${trade.symbol}|${trade.side}|${trade.shares.toFixed(6)}|${trade.price.toFixed(6)}|${tsBucket}`;
};

const toMonthKey = (timestamp) => {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
};

const getLast12MonthKeys = () => {
  const result = [];
  const cursor = new Date();
  cursor.setDate(1);
  cursor.setHours(0, 0, 0, 0);

  for (let i = 11; i >= 0; i -= 1) {
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

const extractStrategyPnl = (strategy) => {
  const candidates = [
    strategy?.paper?.pnl,
    strategy?.unrealizedPnl,
    strategy?.dailyPnl,
    strategy?.pnl,
    strategy?.profit_return_data?.pnl,
    strategy?.profit_return_data?.profit,
    strategy?.backtestResults?.totalPnL,
    strategy?.backtestResults?.pnl,
    strategy?.results?.totalPnL,
    strategy?.results?.pnl,
    strategy?.totalReturnAmount,
  ];

  for (const candidate of candidates) {
    const parsed = toNumber(candidate);
    if (parsed !== null) return parsed;
  }

  return 0;
};

const extractStrategyTrades = (strategy) => {
  const candidates = [
    strategy?.paper?.trades,
    strategy?.totalTrades,
    strategy?.trades,
    strategy?.metrics?.trades,
    strategy?.metrics?.totalTrades,
    strategy?.results?.trades,
    strategy?.backtestResults?.trades,
  ];

  for (const candidate of candidates) {
    const parsed = toNumber(candidate);
    if (parsed !== null && parsed >= 0) return Math.round(parsed);
  }

  return 0;
};

const extractStrategyWinRate = (strategy) => {
  const candidates = [
    strategy?.paper?.winRate,
    strategy?.winRate,
    strategy?.metrics?.winRate,
    strategy?.results?.winRate,
    strategy?.backtestResults?.winRate,
  ];

  for (const candidate of candidates) {
    const parsed = toNumber(candidate);
    if (parsed !== null) return clampPercent(parsed);
  }

  return 0;
};

const normalizeStrategy = (strategy, fallbackIndex = 0) => {
  if (!strategy || typeof strategy !== 'object') return null;

  const name = String(strategy.name || strategy.title || strategy.strategyName || 'Untitled Strategy').trim();
  const ticker = normalizeSymbol(
    strategy.ticker ?? strategy.symbol ?? strategy.asset ?? strategy.tickers?.[0] ?? '',
  );
  const key = String(strategy.id ?? `${name}-${ticker || fallbackIndex}`).trim();

  const trades = extractStrategyTrades(strategy);
  const winRate = extractStrategyWinRate(strategy);
  const pnl = extractStrategyPnl(strategy);
  const updatedAt =
    toTimestamp(
      strategy.updatedAt ??
        strategy.savedAt ??
        strategy.activatedAt ??
        strategy.deployedAt ??
        strategy.createdAt ??
        strategy.timestamp,
    ) ?? Date.now();

  return {
    key,
    name,
    ticker,
    pnl,
    trades,
    winRate,
    updatedAt,
  };
};

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

    if (trade.side === 'buy') {
      lots.push({ shares: trade.shares, price: trade.price });
      return;
    }

    let remaining = trade.shares;
    let sellPnl = 0;

    while (remaining > 0 && lots.length > 0) {
      const lot = lots[0];
      const matchedShares = Math.min(remaining, lot.shares);
      sellPnl += matchedShares * (trade.price - lot.price);
      lot.shares -= matchedShares;
      remaining -= matchedShares;
      if (lot.shares <= 0) lots.shift();
    }

    if (sellPnl !== 0) {
      realizedPnl += sellPnl;
      realizedEvents.push({ timestamp: trade.timestamp, pnl: sellPnl });
      const month = toMonthKey(trade.timestamp);
      monthlyPnl[month] = (monthlyPnl[month] || 0) + sellPnl;
    }
  });

  const winEvents = realizedEvents.filter((item) => item.pnl > 0);
  const lossEvents = realizedEvents.filter((item) => item.pnl < 0);
  const winsAbs = winEvents.reduce((sum, item) => sum + item.pnl, 0);
  const lossesAbs = Math.abs(lossEvents.reduce((sum, item) => sum + item.pnl, 0));

  const avgWin = winEvents.length > 0 ? winsAbs / winEvents.length : 0;
  const avgLoss = lossEvents.length > 0 ? -lossesAbs / lossEvents.length : 0;
  const profitFactor = lossesAbs > 0 ? winsAbs / lossesAbs : winsAbs > 0 ? Infinity : 0;

  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  realizedEvents.forEach((event) => {
    equity += event.pnl;
    peak = Math.max(peak, equity);
    if (peak > 0) {
      const drawdownPct = ((peak - equity) / peak) * 100;
      maxDrawdown = Math.max(maxDrawdown, drawdownPct);
    }
  });

  return {
    realizedPnl,
    realizedEvents,
    monthlyPnl,
    wins: winEvents.length,
    losses: lossEvents.length,
    closedTrades: realizedEvents.length,
    avgWin,
    avgLoss,
    profitFactor,
    maxDrawdown,
  };
};

const StatCard = ({ title, value, subtitle, icon: Icon, color = 'text-white' }) => (
  <div className="rounded-xl border border-[#1f2a3a] bg-[rgba(10,22,40,0.55)] backdrop-blur-md p-4">
    <div className="mb-2 flex items-center gap-2 text-sm text-gray-400">
      <Icon className="h-4 w-4" strokeWidth={1.5} />
      {title}
    </div>
    <div className={`text-2xl font-semibold ${color}`}>{value}</div>
    {subtitle ? <div className="mt-1 text-xs text-white/50">{subtitle}</div> : null}
  </div>
);

const AnalyticsPage = ({
  tradeHistory = [],
  savedStrategies = [],
  deployedStrategies = [],
  alpacaData = {},
}) => {
  const normalizedTrades = useMemo(() => {
    const localTrades = Array.isArray(tradeHistory) ? tradeHistory : [];
    const brokerOrders = Array.isArray(alpacaData?.orders) ? alpacaData.orders : [];
    const brokerTrades = Array.isArray(alpacaData?.trades) ? alpacaData.trades : [];

    const byKey = new Map();
    [...localTrades, ...brokerOrders, ...brokerTrades]
      .map(normalizeTrade)
      .filter(Boolean)
      .forEach((trade) => {
        byKey.set(buildTradeKey(trade), trade);
      });

    return [...byKey.values()];
  }, [tradeHistory, alpacaData]);

  const strategyRows = useMemo(() => {
    const merged = new Map();
    const source = [
      ...(Array.isArray(savedStrategies) ? savedStrategies : []),
      ...(Array.isArray(deployedStrategies) ? deployedStrategies : []),
    ];

    source.forEach((item, index) => {
      const normalized = normalizeStrategy(item, index);
      if (!normalized) return;
      const existing = merged.get(normalized.key);
      if (!existing || normalized.updatedAt >= existing.updatedAt) {
        merged.set(normalized.key, normalized);
      }
    });

    return [...merged.values()].sort((a, b) => b.pnl - a.pnl);
  }, [savedStrategies, deployedStrategies]);

  const tradeStats = useMemo(() => calculateTradeStats(normalizedTrades), [normalizedTrades]);

  const brokerUnrealizedPnl = useMemo(() => {
    const positions = Array.isArray(alpacaData?.positions) ? alpacaData.positions : [];
    return positions.reduce((sum, position) => {
      const unrealized = toNumber(position?.unrealized_pl ?? position?.unrealizedPnl);
      return sum + (unrealized || 0);
    }, 0);
  }, [alpacaData]);

  const strategyTotalPnl = useMemo(
    () => strategyRows.reduce((sum, strategy) => sum + (toNumber(strategy.pnl) || 0), 0),
    [strategyRows],
  );

  const totalPnl = tradeStats.realizedPnl + brokerUnrealizedPnl + strategyTotalPnl;
  const strategyTrades = useMemo(
    () => strategyRows.reduce((sum, strategy) => sum + (Number(strategy.trades) || 0), 0),
    [strategyRows],
  );
  const strategyWinsWeighted = useMemo(
    () =>
      strategyRows.reduce(
        (sum, strategy) => sum + ((Number(strategy.trades) || 0) * (Number(strategy.winRate) || 0)) / 100,
        0,
      ),
    [strategyRows],
  );

  const totalTrades = tradeStats.closedTrades + strategyTrades;
  const winCount = tradeStats.closedTrades > 0 ? tradeStats.wins : strategyWinsWeighted;
  const lossCount = Math.max(0, totalTrades - winCount);
  const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;

  const accountEquity =
    toNumber(
      alpacaData?.account?.equity ??
        alpacaData?.account?.portfolio_value ??
        alpacaData?.account?.last_equity,
    ) || DEFAULT_CAPITAL_BASE;

  const monthKeys = useMemo(() => getLast12MonthKeys(), []);
  const monthlyReturns = useMemo(() => {
    const monthlyPnl = {};
    monthKeys.forEach((key) => {
      monthlyPnl[key] = Number(tradeStats.monthlyPnl[key] || 0);
    });

    const noTradeMonthlyData = Object.values(monthlyPnl).every((value) => value === 0);
    if (noTradeMonthlyData && strategyTotalPnl !== 0) {
      monthlyPnl[monthKeys[monthKeys.length - 1]] = strategyTotalPnl;
    }

    return monthKeys.map((key) => {
      const amount = monthlyPnl[key] || 0;
      const returnPct = accountEquity > 0 ? (amount / accountEquity) * 100 : 0;
      return {
        key,
        month: monthLabel(key),
        amount,
        return: returnPct,
      };
    });
  }, [monthKeys, tradeStats.monthlyPnl, strategyTotalPnl, accountEquity]);

  const monthlyPnlTotal = useMemo(
    () => monthlyReturns.reduce((sum, month) => sum + month.amount, 0),
    [monthlyReturns],
  );

  const equitySeries = useMemo(() => {
    const startingEquity = accountEquity - monthlyPnlTotal;
    let running = Number.isFinite(startingEquity) ? startingEquity : DEFAULT_CAPITAL_BASE;

    return monthlyReturns.map((month) => {
      running += month.amount;
      return Number(running.toFixed(2));
    });
  }, [accountEquity, monthlyPnlTotal, monthlyReturns]);

  const performanceChartOptions = useMemo(
    () => ({
      chart: {
        backgroundColor: 'transparent',
        height: 360,
        spacingTop: 16,
        spacingRight: 20,
        spacingLeft: 8,
      },
      title: { text: undefined },
      credits: { enabled: false },
      legend: {
        itemStyle: { color: '#94a3b8', fontWeight: '500' },
        itemHoverStyle: { color: '#e2e8f0' },
      },
      xAxis: {
        categories: monthlyReturns.map((month) => month.month),
        labels: { style: { color: '#64748b' } },
        lineColor: '#1f2a3a',
        tickColor: '#1f2a3a',
      },
      yAxis: [
        {
          title: { text: 'Equity', style: { color: '#64748b' } },
          gridLineColor: '#1a2332',
          labels: {
            style: { color: '#94a3b8' },
            formatter() {
              return `$${Number(this.value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
            },
          },
        },
        {
          title: { text: 'Monthly P&L', style: { color: '#64748b' } },
          opposite: true,
          gridLineWidth: 0,
          labels: {
            style: { color: '#94a3b8' },
            formatter() {
              return `$${Number(this.value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
            },
          },
        },
      ],
      tooltip: {
        shared: true,
        backgroundColor: '#0b1220',
        borderColor: '#1f2a3a',
        style: { color: '#e2e8f0' },
        valueDecimals: 2,
      },
      plotOptions: {
        series: {
          animation: false,
        },
        column: {
          borderRadius: 3,
          borderWidth: 0,
        },
        spline: {
          marker: { enabled: false },
          lineWidth: 2.5,
        },
      },
      series: [
        {
          type: 'spline',
          name: 'Equity Curve',
          yAxis: 0,
          color: '#38bdf8',
          data: equitySeries,
        },
        {
          type: 'column',
          name: 'Monthly P&L',
          yAxis: 1,
          data: monthlyReturns.map((month) => ({
            y: Number(month.amount.toFixed(2)),
            color: month.amount >= 0 ? '#22c55e' : '#ef4444',
          })),
        },
      ],
    }),
    [equitySeries, monthlyReturns],
  );

  const strategyChartOptions = useMemo(() => {
    const topStrategies = strategyRows.slice(0, 8);
    return {
      chart: {
        type: 'bar',
        backgroundColor: 'transparent',
        height: 320,
      },
      title: { text: undefined },
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: {
        categories: topStrategies.map((strategy) => strategy.name.slice(0, 20)),
        labels: { style: { color: '#94a3b8', fontSize: '11px' } },
        lineColor: '#1f2a3a',
        tickColor: '#1f2a3a',
      },
      yAxis: {
        title: { text: undefined },
        gridLineColor: '#1a2332',
        labels: {
          style: { color: '#94a3b8' },
          formatter() {
            return `$${Number(this.value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
          },
        },
      },
      tooltip: {
        backgroundColor: '#0b1220',
        borderColor: '#1f2a3a',
        style: { color: '#e2e8f0' },
        pointFormatter() {
          return `<span style=\"color:${this.color}\">●</span> ${this.category}: <b>${formatSignedCurrency(
            this.y,
          )}</b>`;
        },
      },
      plotOptions: {
        series: {
          animation: false,
          borderRadius: 3,
          borderWidth: 0,
          dataLabels: {
            enabled: true,
            formatter() {
              return formatSignedCurrency(this.y);
            },
            style: {
              color: '#cbd5e1',
              textOutline: 'none',
              fontSize: '10px',
            },
          },
        },
      },
      series: [
        {
          name: 'Strategy P&L',
          data: topStrategies.map((strategy) => ({
            y: Number(strategy.pnl) || 0,
            color: (Number(strategy.pnl) || 0) >= 0 ? '#22c55e' : '#ef4444',
          })),
        },
      ],
    };
  }, [strategyRows]);

  const winLossChartOptions = useMemo(
    () => ({
      chart: {
        type: 'pie',
        backgroundColor: 'transparent',
        height: 320,
      },
      title: { text: undefined },
      credits: { enabled: false },
      tooltip: {
        backgroundColor: '#0b1220',
        borderColor: '#1f2a3a',
        style: { color: '#e2e8f0' },
        pointFormat: '<b>{point.y:.0f}</b> trades ({point.percentage:.1f}%)',
      },
      plotOptions: {
        pie: {
          innerSize: '62%',
          borderWidth: 0,
          dataLabels: {
            enabled: true,
            style: {
              color: '#cbd5e1',
              textOutline: 'none',
              fontSize: '11px',
            },
            formatter() {
              return `${this.point.name}: ${this.y}`;
            },
          },
        },
      },
      series: [
        {
          name: 'Trades',
          data: [
            { name: 'Wins', y: Number(winCount) || 0, color: '#22c55e' },
            { name: 'Losses', y: Number(lossCount) || 0, color: '#ef4444' },
          ],
        },
      ],
    }),
    [lossCount, winCount],
  );

  const totalPnlColor = totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400';
  const winRateColor = winRate >= 50 ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className="flex h-full flex-1 flex-col overflow-y-auto bg-transparent p-4">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-white">Analytics</h1>
        <p className="text-sm text-gray-400">
          Highcharts analytics wired to your account trades, strategies, and portfolio data.
        </p>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          title="Total P&L"
          value={formatSignedCurrency(totalPnl)}
          subtitle="Realized + Unrealized + Strategy"
          icon={TrendingUp}
          color={totalPnlColor}
        />
        <StatCard
          title="Win Rate"
          value={`${winRate.toFixed(1)}%`}
          subtitle={`${totalTrades} total trades`}
          icon={Target}
          color={winRateColor}
        />
        <StatCard
          title="Profit Factor"
          value={Number.isFinite(tradeStats.profitFactor) ? tradeStats.profitFactor.toFixed(2) : '∞'}
          subtitle="Closed trade quality"
          icon={Activity}
          color="text-sky-300"
        />
        <StatCard
          title="Max Drawdown"
          value={`-${tradeStats.maxDrawdown.toFixed(2)}%`}
          subtitle="From closed-trade equity"
          icon={TrendingDown}
          color="text-red-400"
        />
      </div>

      <div className="mb-5 rounded-2xl border border-[#1f2a3a] bg-[rgba(10,22,40,0.55)] p-4 backdrop-blur-md">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Performance Curve</h3>
          <span className="text-xs text-gray-500">Last 12 months</span>
        </div>
        <HighchartsReact highcharts={Highcharts} options={performanceChartOptions} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#1f2a3a] bg-[rgba(10,22,40,0.55)] p-4 backdrop-blur-md">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Top Strategy P&L</h3>
            <span className="text-xs text-gray-500">{strategyRows.length} strategies</span>
          </div>
          <HighchartsReact highcharts={Highcharts} options={strategyChartOptions} />
        </div>

        <div className="rounded-2xl border border-[#1f2a3a] bg-[rgba(10,22,40,0.55)] p-4 backdrop-blur-md">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Win / Loss Distribution</h3>
            <span className="text-xs text-gray-500">Closed + strategy trades</span>
          </div>
          <HighchartsReact highcharts={Highcharts} options={winLossChartOptions} />
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
