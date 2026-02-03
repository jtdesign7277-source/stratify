import React from 'react';
import { BarChart3, TrendingUp, TrendingDown, Target, Clock, Zap, PieChart } from 'lucide-react';

const AnalyticsPage = () => {
  const performanceStats = {
    totalPnL: 12543.67,
    winRate: 68.5,
    avgWin: 234.50,
    avgLoss: -89.25,
    sharpeRatio: 1.87,
    maxDrawdown: -8.3,
    totalTrades: 342,
    profitFactor: 2.14,
  };

  const monthlyReturns = [
    { month: 'Jan', return: 5.2 },
    { month: 'Feb', return: -2.1 },
    { month: 'Mar', return: 8.4 },
    { month: 'Apr', return: 3.2 },
    { month: 'May', return: -1.5 },
    { month: 'Jun', return: 6.8 },
    { month: 'Jul', return: 4.1 },
    { month: 'Aug', return: -3.2 },
    { month: 'Sep', return: 7.5 },
    { month: 'Oct', return: 2.8 },
    { month: 'Nov', return: 5.9 },
    { month: 'Dec', return: 4.3 },
  ];

  const strategyPerformance = [
    { name: 'RSI Momentum', pnl: 4521.30, trades: 89, winRate: 72 },
    { name: 'MACD Crossover', pnl: 2340.15, trades: 56, winRate: 65 },
    { name: 'Mean Reversion', pnl: 3456.80, trades: 78, winRate: 71 },
    { name: 'Breakout Scanner', pnl: 1890.42, trades: 45, winRate: 58 },
    { name: 'Scalping BTC', pnl: 335.00, trades: 74, winRate: 62 },
  ];

  const StatCard = ({ title, value, subtitle, icon: Icon, color = 'text-white' }) => (
    <div className="bg-[#111118] border border-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
        <Icon className="w-4 h-4" strokeWidth={1.5} />
        {title}
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {subtitle && <div className="text-gray-500 text-xs mt-1">{subtitle}</div>}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d0d12] p-4 overflow-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Analytics</h1>
        <p className="text-gray-400 text-sm">Track your trading performance</p>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard 
          title="Total P&L" 
          value={`$${performanceStats.totalPnL.toLocaleString()}`}
          subtitle="All time"
          icon={TrendingUp}
          color="text-emerald-400"
        />
        <StatCard 
          title="Win Rate" 
          value={`${performanceStats.winRate}%`}
          subtitle={`${performanceStats.totalTrades} total trades`}
          icon={Target}
          color="text-emerald-400"
        />
        <StatCard 
          title="Sharpe Ratio" 
          value={performanceStats.sharpeRatio.toFixed(2)}
          subtitle="Risk-adjusted return"
          icon={Zap}
          color="text-emerald-400"
        />
        <StatCard 
          title="Max Drawdown" 
          value={`${performanceStats.maxDrawdown}%`}
          subtitle="Largest peak-to-trough"
          icon={TrendingDown}
          color="text-red-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Monthly Returns */}
        <div className="bg-[#111118] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-emerald-400" strokeWidth={1.5} />
            <h3 className="text-white font-medium">Monthly Returns</h3>
          </div>
          <div className="flex items-end gap-2 h-40">
            {monthlyReturns.map((month) => {
              const isPositive = month.return >= 0;
              const height = Math.abs(month.return) * 4;
              return (
                <div key={month.month} className="flex-1 flex flex-col items-center justify-end">
                  <div 
                    className={`w-full rounded-t ${isPositive ? 'bg-emerald-500' : 'bg-red-500'}`}
                    style={{ height: `${height}px` }}
                  />
                  <span className="text-[10px] text-gray-500 mt-2">{month.month}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Win/Loss Distribution */}
        <div className="bg-[#111118] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-emerald-400" strokeWidth={1.5} />
            <h3 className="text-white font-medium">Trade Distribution</h3>
          </div>
          <div className="flex items-center justify-center gap-8">
            <div className="text-center">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 border-4 border-emerald-500 flex items-center justify-center">
                <span className="text-2xl font-bold text-emerald-400">{performanceStats.winRate}%</span>
              </div>
              <span className="text-sm text-gray-400 mt-2 block">Wins</span>
            </div>
            <div className="text-center">
              <div className="space-y-2">
                <div>
                  <span className="text-gray-400 text-sm">Avg Win</span>
                  <div className="text-emerald-400 font-bold">${performanceStats.avgWin}</div>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">Avg Loss</span>
                  <div className="text-red-400 font-bold">${performanceStats.avgLoss}</div>
                </div>
                <div>
                  <span className="text-gray-400 text-sm">Profit Factor</span>
                  <div className="text-white font-bold">{performanceStats.profitFactor}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Strategy Performance */}
      <div className="bg-[#111118] border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h3 className="text-white font-medium">Strategy Performance</h3>
        </div>
        <div className="overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-800">
                <th className="text-left px-4 py-2">Strategy</th>
                <th className="text-right px-4 py-2">P&L</th>
                <th className="text-right px-4 py-2">Trades</th>
                <th className="text-right px-4 py-2">Win Rate</th>
                <th className="text-right px-4 py-2">Performance</th>
              </tr>
            </thead>
            <tbody>
              {strategyPerformance.map((strategy) => (
                <tr key={strategy.name} className="border-b border-gray-800/50 hover:bg-white/5">
                  <td className="px-4 py-3">
                    <div className="text-white font-medium text-sm">{strategy.name}</div>
                  </td>
                  <td className={`px-4 py-3 text-right font-mono text-sm ${strategy.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {strategy.pnl >= 0 ? '+' : ''}${strategy.pnl.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300 text-sm">{strategy.trades}</td>
                  <td className="px-4 py-3 text-right text-white text-sm">{strategy.winRate}%</td>
                  <td className="px-4 py-3 text-right">
                    <div className="w-20 h-2 bg-gray-800 rounded-full overflow-hidden ml-auto">
                      <div 
                        className={`h-full ${strategy.winRate >= 60 ? 'bg-emerald-500' : 'bg-yellow-500'} rounded-full`}
                        style={{ width: `${strategy.winRate}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
