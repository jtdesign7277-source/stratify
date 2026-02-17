import React, { useMemo, useState } from 'react';
import {
  Wallet,
  DollarSign,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Plus,
  Unlink,
  History,
} from 'lucide-react';
import BrokerConnectModal, { BrokerIcon } from './BrokerConnectModal';
import BrokerConnect from './BrokerConnect';

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (value) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number.isFinite(value) ? value : 0);

const formatNumber = (value, decimals = 2) => new Intl.NumberFormat('en-US', {
  minimumFractionDigits: decimals,
  maximumFractionDigits: decimals,
}).format(Number.isFinite(value) ? value : 0);

const formatSigned = (value, suffix = '') => {
  if (!Number.isFinite(value)) return `0${suffix}`;
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${Math.abs(value).toFixed(2)}${suffix}`;
};

const formatSignedCurrency = (value) => {
  if (!Number.isFinite(value)) return formatCurrency(0);
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${formatCurrency(Math.abs(value))}`;
};

const formatTimestamp = (timestamp) => {
  if (!timestamp) return '—';
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const getCompanyName = (position) => (
  position?.name
  || position?.companyName
  || position?.company
  || position?.asset_name
  || position?.assetName
  || position?.symbol
  || '—'
);

const normalizePercent = (value, fallback) => {
  if (Number.isFinite(value)) {
    const abs = Math.abs(value);
    return abs <= 1 ? value * 100 : value;
  }
  return Number.isFinite(fallback) ? fallback : 0;
};

const PortfolioPage = ({
  themeClasses: _themeClasses,
  alpacaData,
  connectedBrokers = [],
  onBrokerConnect = () => {},
  onBrokerDisconnect = () => {},
  tradeHistory = [],
}) => {
  const [showBrokerModal, setShowBrokerModal] = useState(false);

  const account = alpacaData?.account || {};
  const rawPositions = Array.isArray(alpacaData?.positions) ? alpacaData.positions : [];

  const equity = toNumber(account.equity ?? account.portfolio_value);
  const cash = toNumber(account.cash);
  const buyingPower = toNumber(account.buying_power);
  const dailyPnL = Number.isFinite(Number(account.daily_pnl))
    ? toNumber(account.daily_pnl)
    : toNumber(account.equity) - toNumber(account.last_equity);
  const dailyPnLPercent = toNumber(account.last_equity) > 0
    ? (dailyPnL / toNumber(account.last_equity)) * 100
    : 0;

  const positions = useMemo(() => rawPositions
    .map((pos) => {
      const shares = toNumber(pos.qty ?? pos.shares ?? pos.quantity);
      const avgEntry = toNumber(pos.avg_entry_price ?? pos.avgCost ?? pos.avgEntryPrice);
      const currentPrice = toNumber(pos.current_price ?? pos.currentPrice ?? pos.price);
      const marketValue = toNumber(pos.market_value ?? (shares * currentPrice));
      const unrealizedPL = toNumber(pos.unrealized_pl ?? pos.pnl ?? (marketValue - (shares * avgEntry)));
      const rawPercent = Number(pos.unrealized_plpc ?? pos.pnlPercent);
      const fallbackPercent = avgEntry > 0 ? ((currentPrice - avgEntry) / avgEntry) * 100 : 0;

      const changeTodayPct = toNumber(pos.change_today ?? pos.changeToday) * 100;
      const prevPrice = changeTodayPct !== 0 ? currentPrice / (1 + toNumber(pos.change_today ?? pos.changeToday)) : currentPrice;
      const dailyChange = (currentPrice - prevPrice) * shares;

      return {
        symbol: String(pos.symbol ?? pos.ticker ?? '').toUpperCase(),
        companyName: getCompanyName(pos),
        shares,
        avgEntry,
        currentPrice,
        marketValue,
        unrealizedPL,
        unrealizedPLPercent: normalizePercent(rawPercent, fallbackPercent),
        dailyChange,
        dailyChangePct: changeTodayPct,
      };
    })
    .filter((pos) => pos.symbol && pos.shares > 0), [rawPositions]);

  const recentTrades = useMemo(() => {
    if (!Array.isArray(tradeHistory)) return [];
    return [...tradeHistory]
      .filter(Boolean)
      .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
      .slice(0, 12);
  }, [tradeHistory]);

  const handleBrokerConnect = (broker) => {
    onBrokerConnect(broker);
    setShowBrokerModal(false);
  };

  const handleDisconnectBroker = (brokerId) => {
    onBrokerDisconnect(brokerId);
  };

  const totalMarketValue = useMemo(() => positions.reduce((sum, p) => sum + p.marketValue, 0), [positions]);
  const totalUnrealizedPL = useMemo(() => positions.reduce((sum, p) => sum + p.unrealizedPL, 0), [positions]);
  const totalCostBasis = useMemo(() => positions.reduce((sum, p) => sum + (p.avgEntry * p.shares), 0), [positions]);
  const totalUnrealizedPLPercent = totalCostBasis > 0 ? (totalUnrealizedPL / totalCostBasis) * 100 : 0;
  const totalDailyChange = useMemo(() => positions.reduce((sum, p) => sum + p.dailyChange, 0), [positions]);
  const totalDailyChangePct = totalMarketValue > 0 ? (totalDailyChange / (totalMarketValue - totalDailyChange)) * 100 : 0;
  const totalPLIsPositive = totalUnrealizedPL >= 0;

  const dailyIsPositive = dailyPnL >= 0;

  const noBrokerConnected = !account.equity && !account.portfolio_value && rawPositions.length === 0;

  if (noBrokerConnected) {
    return (
      <div className="flex-1 flex flex-col h-full bg-transparent text-white overflow-auto">
        <BrokerConnect onConnected={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent text-white overflow-auto">
      <div className="px-6 pt-6 pb-8 space-y-6">
        {/* Connected Accounts — compact row */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-[#111111] border border-[#1f1f1f] rounded-lg px-3 py-1.5">
            <div className="w-5 h-5 bg-yellow-500 rounded flex items-center justify-center">
              <BrokerIcon broker="alpaca" className="w-4 h-4" />
            </div>
            <span className="text-xs font-medium text-white">Alpaca</span>
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
            <span className="text-xs text-white/50 font-mono">{formatCurrency(equity)}</span>
          </div>
          {connectedBrokers.map((broker) => (
            <div key={broker.id} className="flex items-center gap-2 bg-[#111111] border border-[#1f1f1f] rounded-lg px-3 py-1.5 group">
              <div className="w-5 h-5 rounded flex items-center justify-center overflow-hidden">
                <BrokerIcon broker={broker.id} className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium text-white">{broker.name}</span>
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
              <span className="text-xs text-white/50 font-mono">{formatCurrency(broker.value || 0)}</span>
              <button
                onClick={() => handleDisconnectBroker(broker.id)}
                className="text-white/0 group-hover:text-white/40 hover:!text-red-400 transition-colors"
                title="Disconnect"
              >
                <Unlink className="w-3 h-3" strokeWidth={1.5} />
              </button>
            </div>
          ))}
          <button
            onClick={() => setShowBrokerModal(true)}
            className="flex items-center gap-1.5 border border-dashed border-[#2a2a2a] rounded-lg px-3 py-1.5 hover:border-emerald-500/50 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.5} />
            <span className="text-xs text-white/50">Add Broker</span>
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">Net Liquidation</div>
              <div className="text-2xl font-semibold font-mono">{formatCurrency(equity)}</div>
            </div>
            <div className="w-px h-8 bg-white/10"></div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">Buying Power</div>
              <div className="text-lg font-semibold font-mono text-white/80">{formatCurrency(buyingPower)}</div>
            </div>
            <div className="w-px h-8 bg-white/10"></div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">Cash</div>
              <div className="text-lg font-semibold font-mono text-white/80">{formatCurrency(cash)}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">Daily P&L</div>
            <div className={`text-2xl font-semibold font-mono ${dailyIsPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatSignedCurrency(dailyPnL)}
            </div>
            <div className={`text-xs font-mono ${dailyIsPositive ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
              {formatSigned(dailyPnLPercent, '%')}
            </div>
          </div>
        </div>


        <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-white/40">Positions</div>
              <h3 className="text-lg font-semibold">Live Holdings</h3>
            </div>
            <div className="text-xs text-white/40">{positions.length} positions</div>
          </div>

          {positions.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-xl border border-[#1f1f1f] bg-[#0b0b0b] p-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">Total Market Value</div>
                <div className="text-lg font-semibold font-mono text-white">{formatCurrency(totalMarketValue)}</div>
              </div>
              <div className="rounded-xl border border-[#1f1f1f] bg-[#0b0b0b] p-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">Unrealized P&L</div>
                <div className={`text-lg font-semibold font-mono ${totalPLIsPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatSignedCurrency(totalUnrealizedPL)}
                </div>
                <div className={`text-[10px] font-mono ${totalPLIsPositive ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                  {formatSigned(totalUnrealizedPLPercent, '%')}
                </div>
              </div>
              <div className="rounded-xl border border-[#1f1f1f] bg-[#0b0b0b] p-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-1">Cost Basis</div>
                <div className="text-lg font-semibold font-mono text-white">{formatCurrency(totalCostBasis)}</div>
              </div>
            </div>
          )}

          {positions.length === 0 ? (
            <div className="text-sm text-white/50 py-6 text-center">-$0.00 - Connect a broker to get started</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.2em] text-white/40">
                    <th className="py-3 pr-4">Ticker</th>
                    <th className="py-3 pr-4">Company</th>
                    <th className="py-3 pr-4">Shares</th>
                    <th className="py-3 pr-4">Avg Entry</th>
                    <th className="py-3 pr-4">Current</th>
                    <th className="py-3 pr-4">Market Value</th>
                    <th className="py-3 pr-4">Daily P&L</th>
                    <th className="py-3 pr-4">Total P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos) => {
                    const isPositive = pos.unrealizedPL >= 0;
                    return (
                      <tr key={pos.symbol} className="border-t border-[#1f1f1f]">
                        <td className="py-4 pr-4">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${isPositive ? 'bg-emerald-400' : 'bg-red-400'}`} />
                            <span className="font-semibold">{pos.symbol}</span>
                          </div>
                        </td>
                        <td className="py-4 pr-4 text-white/70">{pos.companyName}</td>
                        <td className="py-4 pr-4 font-mono">{formatNumber(pos.shares, 2)}</td>
                        <td className="py-4 pr-4 font-mono">{formatCurrency(pos.avgEntry)}</td>
                        <td className="py-4 pr-4 font-mono">{formatCurrency(pos.currentPrice)}</td>
                        <td className="py-4 pr-4 font-mono">{formatCurrency(pos.marketValue)}</td>
                        <td className="py-4 pr-4">
                          <span className={`font-mono ${pos.dailyChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatSignedCurrency(pos.dailyChange)}
                          </span>
                          <span className={`text-xs font-mono ${pos.dailyChange >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                            ({formatSigned(pos.dailyChangePct, '%')})
                          </span>
                        </td>
                        <td className="py-4 pr-4">
                          <span className={`font-mono ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatSignedCurrency(pos.unrealizedPL)}
                          </span>
                          <span className={`text-xs font-mono ${isPositive ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                            ({formatSigned(pos.unrealizedPLPercent, '%')})
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-[#2a2a2a] bg-[#0d0d0d]">
                    <td className="py-4 pr-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${totalPLIsPositive ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        <span className="font-semibold text-white/80">TOTAL</span>
                      </div>
                    </td>
                    <td className="py-4 pr-4 text-white/50 text-xs">{positions.length} positions</td>
                    <td className="py-4 pr-4"></td>
                    <td className="py-4 pr-4"></td>
                    <td className="py-4 pr-4 font-mono text-white/30">—</td>
                    <td className="py-4 pr-4 font-mono font-semibold">{formatCurrency(totalMarketValue)}</td>
                    <td className="py-4 pr-4">
                      <span className={`font-mono font-semibold ${totalDailyChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatSignedCurrency(totalDailyChange)}
                      </span>
                      <span className={`text-xs font-mono ${totalDailyChange >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                        {' '}({formatSigned(totalDailyChangePct, '%')})
                      </span>
                    </td>
                    <td className="py-4 pr-4">
                      <span className={`font-mono font-semibold ${totalPLIsPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatSignedCurrency(totalUnrealizedPL)}
                      </span>
                      <span className={`text-xs font-mono ${totalPLIsPositive ? 'text-emerald-400/70' : 'text-red-400/70'}`}>
                        {' '}({formatSigned(totalUnrealizedPLPercent, '%')})
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-[#111111] border border-[#1f1f1f] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-white/60" strokeWidth={1.5} />
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-white/40">Trade History</div>
                <h3 className="text-lg font-semibold">Recent Activity</h3>
              </div>
            </div>
            <div className="text-xs text-white/40">{recentTrades.length} trades</div>
          </div>

          {recentTrades.length === 0 ? (
            <div className="text-sm text-white/50 py-6 text-center">No trades yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-[0.2em] text-white/40">
                    <th className="py-3 pr-4">Date</th>
                    <th className="py-3 pr-4">Ticker</th>
                    <th className="py-3 pr-4">Side</th>
                    <th className="py-3 pr-4">Shares</th>
                    <th className="py-3 pr-4">Price</th>
                    <th className="py-3 pr-4">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTrades.map((trade) => {
                    const side = String(trade.side || '').toLowerCase();
                    const isBuy = side === 'buy';
                    const total = toNumber(trade.total ?? (trade.shares * trade.price));
                    return (
                      <tr key={trade.id || `${trade.symbol}-${trade.timestamp}`} className="border-t border-[#1f1f1f]">
                        <td className="py-4 pr-4 text-white/70">{formatTimestamp(trade.timestamp)}</td>
                        <td className="py-4 pr-4 font-semibold">{trade.symbol}</td>
                        <td className="py-4 pr-4">
                          <span className={`text-xs font-semibold uppercase tracking-[0.2em] ${
                            isBuy ? 'text-emerald-400' : 'text-red-400'
                          }`}>
                            {isBuy ? 'Buy' : 'Sell'}
                          </span>
                        </td>
                        <td className="py-4 pr-4 font-mono">{formatNumber(trade.shares, 2)}</td>
                        <td className="py-4 pr-4 font-mono">{formatCurrency(trade.price)}</td>
                        <td className="py-4 pr-4 font-mono">{formatCurrency(total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <BrokerConnectModal
        isOpen={showBrokerModal}
        onClose={() => setShowBrokerModal(false)}
        onConnect={handleBrokerConnect}
        connectedBrokers={connectedBrokers}
      />
    </div>
  );
};

export default PortfolioPage;
