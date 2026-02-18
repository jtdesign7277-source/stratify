import React, { useMemo } from 'react';
import {
  BarChart3,
  PieChart,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';

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

const normalizeTrade = (raw) => {
  if (!raw || typeof raw !== 'object') return null;

  const symbol = normalizeSymbol(raw.symbol ?? raw.ticker ?? raw.asset ?? raw.Symbol);
  if (!symbol) return null;

  const shares = Math.abs(toNumber(raw.shares ?? raw.qty ?? raw.quantity ?? raw.filled_qty ?? raw.size) ?? 0);
  const price = toNumber(
    raw.price
      ?? raw.fillPrice
      ?? raw.avgPrice
      ?? raw.avg_entry_price
      ?? raw.filled_avg_price
      ?? raw.executionPrice,
  ) ?? 0;

  if (!Number.isFinite(shares) || shares <= 0) return null;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sideRaw = String(
    raw.side
      ?? raw.type
      ?? raw.action
      ?? raw.order_side
      ?? raw.orderSide
      ?? '',
  ).toLowerCase();
  const side = (sideRaw.includes('sell') || sideRaw === 'short' || sideRaw === 'close') ? 'sell' : 'buy';

  const timestamp = toTimestamp(
    raw.timestamp
      ?? raw.time
      ?? raw.date
      ?? raw.filled_at
      ?? raw.filledAt
      ?? raw.submitted_at
      ?? raw.created_at,
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

const clampPercent = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(100, Math.max(0, numeric));
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
  const ticker = normalizeSymbol(strategy.ticker ?? strategy.symbol ?? strategy.asset ?? strategy.tickers?.[0] ?? '');
  const key = String(strategy.id ?? `${name}-${ticker || fallbackIndex}`).trim();

  const trades = extractStrategyTrades(strategy);
  const winRate = extractStrategyWinRate(strategy);
  const pnl = extractStrategyPnl(strategy);
  const updatedAt = toTimestamp(
    strategy.updatedAt
      ?? strategy.savedAt
      ?? strategy.activatedAt
      ?? strategy.deployedAt
      ?? strategy.createdAt
      ?? strategy.timestamp,
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
  const profitFactor = lossesAbs > 0 ? winsAbs / lossesAbs : (winsAbs > 0 ? Infinity : 0);

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
  <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-4">
    <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
      <Icon className="w-4 h-4" strokeWidth={1.5} />
      {title}
    </div>
    <div className={`text-2xl font-bold ${color}`}>{value}</div>
    {subtitle ? <div className="text-white/50 text-xs mt-1">{subtitle}</div> : null}
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
        const key = buildTradeKey(trade);
        byKey.set(key, trade);
      });

    return [...byKey.values()];
  }, [tradeHistory, alpacaData]);

  const strategyRows = useMemo(() => {
    const merged = new Map();
    const source = [...(Array.isArray(savedStrategies) ? savedStrategies : []), ...(Array.isArray(deployedStrategies) ? deployedStrategies : [])];

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
    () => strategyRows.reduce((sum, strategy) => sum + ((Number(strategy.trades) || 0) * (Number(strategy.winRate) || 0) / 100), 0),
    [strategyRows],
  );

  const totalTrades = tradeStats.closedTrades + strategyTrades;
  const winCount = tradeStats.closedTrades > 0
    ? tradeStats.wins
    : strategyWinsWeighted;
  const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;

  const accountEquity = toNumber(
    alpacaData?.account?.equity
      ?? alpacaData?.account?.portfolio_value
      ?? alpacaData?.account?.last_equity,
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

  const sharpeRatio = useMemo(() => {
    const values = monthlyReturns.map((item) => item.return / 100);
    const active = values.filter((value) => Number.isFinite(value) && value !== 0);
    if (active.length < 2) return 0;

    const mean = active.reduce((sum, value) => sum + value, 0) / active.length;
    const variance = active.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / (active.length - 1);
    const stdDev = Math.sqrt(variance);
    if (stdDev === 0) return 0;
    return (mean / stdDev) * Math.sqrt(12);
  }, [monthlyReturns]);

  const maxAbsMonthlyReturn = Math.max(
    1,
    ...monthlyReturns.map((item) => Math.abs(item.return)),
  );

  const totalPnLColor = totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400';
  const winRateColor = winRate >= 50 ? 'text-emerald-400' : 'text-red-400';
  const maxDrawdown = tradeStats.maxDrawdown;

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent p-4 overflow-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Analytics</h1>
        <p className="text-gray-400 text-sm">
          Live performance metrics from your current account, trade history, and strategy data.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total P&L"
          value={formatSignedCurrency(totalPnl)}
          subtitle="Realized + unrealized + strategy"
          icon={TrendingUp}
          color={totalPnLColor}
        />
        <StatCard
          title="Win Rate"
          value={`${winRate.toFixed(1)}%`}
          subtitle={`${totalTrades} total trades`}
          icon={Target}
          color={winRateColor}
        />
        <StatCard
          title="Sharpe Ratio"
          value={sharpeRatio.toFixed(2)}
          subtitle="12-month monthly return basis"
          icon={Zap}
          color="text-emerald-400"
        />
        <StatCard
          title="Max Drawdown"
          value={`-${maxDrawdown.toFixed(2)}%`}
          subtitle="From closed-trade equity curve"
          icon={TrendingDown}
          color="text-red-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-emerald-400" strokeWidth={1.5} />
            <h3 className="text-white font-medium">Monthly Returns</h3>
          </div>
          <div className="flex items-end gap-2 h-40">
            {monthlyReturns.map((month) => {
              const isPositive = month.return >= 0;
              const scaledHeight = Math.max(8, (Math.abs(month.return) / maxAbsMonthlyReturn) * 120);
              return (
                <div key={month.key} className="flex-1 flex flex-col items-center justify-end">
                  <div
                    className={`w-full rounded-t ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`}
                    style={{ height: `${scaledHeight}px` }}
                    title={`${month.month}: ${formatSignedPercent(month.return)}`}
                  />
                  <span className="text-[10px] text-white/50 mt-2">{month.month}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-emerald-400" strokeWidth={1.5} />
            <h3 className="text-white font-medium">Trade Distribution</h3>
          </div>
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 border-4 border-emerald-500 flex items-center justify-center">
                <span className="text-2xl font-bold text-emerald-400">{winRate.toFixed(1)}%</span>
              </div>
              <span className="text-sm text-gray-400 mt-2 block">Wins</span>
            </div>
            <div className="space-y-2">
              <div>
                <span className="text-gray-400 text-sm">Avg Win</span>
                <div className="text-emerald-400 font-bold">{formatSignedCurrency(tradeStats.avgWin)}</div>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Avg Loss</span>
                <div className="text-red-400 font-bold">{formatSignedCurrency(tradeStats.avgLoss)}</div>
              </div>
              <div>
                <span className="text-gray-400 text-sm">Profit Factor</span>
                <div className="text-white font-bold">
                  {Number.isFinite(tradeStats.profitFactor) ? tradeStats.profitFactor.toFixed(2) : '∞'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#1f1f1f] flex items-center justify-between">
          <h3 className="text-white font-medium">Strategy Performance</h3>
          <span className="text-[11px] text-gray-500">{strategyRows.length} strategies</span>
        </div>
        <div className="overflow-auto">
          {strategyRows.length === 0 ? (
            <div className="px-4 py-8 text-sm text-gray-500">
              No saved or deployed strategies yet.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-xs text-white/50 border-b border-[#1f1f1f]">
                  <th className="text-left px-4 py-2">Strategy</th>
                  <th className="text-right px-4 py-2">P&L</th>
                  <th className="text-right px-4 py-2">Trades</th>
                  <th className="text-right px-4 py-2">Win Rate</th>
                  <th className="text-right px-4 py-2">Performance</th>
                </tr>
              </thead>
              <tbody>
                {strategyRows.map((strategy) => {
                  const pnl = Number(strategy.pnl) || 0;
                  const trades = Number(strategy.trades) || 0;
                  const winRateValue = clampPercent(strategy.winRate);
                  return (
                    <tr key={strategy.key} className="border-b border-[#1f1f1f]/50 hover:bg-white/5">
                      <td className="px-4 py-3">
                        <div className="text-white font-medium text-sm">{strategy.name}</div>
                        {strategy.ticker ? (
                          <div className="text-[11px] text-emerald-400 font-semibold">${strategy.ticker}</div>
                        ) : null}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono text-sm ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatSignedCurrency(pnl)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-300 text-sm">{trades}</td>
                      <td className="px-4 py-3 text-right text-white text-sm">{winRateValue.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right">
                        <div className="w-20 h-2 bg-gray-800 rounded-full overflow-hidden ml-auto">
                          <div
                            className={`h-full ${winRateValue >= 60 ? 'bg-emerald-500' : winRateValue >= 45 ? 'bg-yellow-500' : 'bg-red-500'} rounded-full`}
                            style={{ width: `${winRateValue}%` }}
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
