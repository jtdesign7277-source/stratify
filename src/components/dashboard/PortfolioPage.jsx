import React from 'react';
import { Wallet, TrendingUp, TrendingDown, PieChart, DollarSign, Percent, ArrowUpRight } from 'lucide-react';

const PortfolioPage = () => {
  const portfolioValue = 125432.67;
  const dayChange = 1234.56;
  const dayChangePercent = 0.99;

  const holdings = [
    { symbol: 'AAPL', name: 'Apple Inc.', shares: 50, avgCost: 175.00, currentPrice: 213.25, value: 10662.50 },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', shares: 15, avgCost: 450.00, currentPrice: 721.33, value: 10819.95 },
    { symbol: 'MSFT', name: 'Microsoft', shares: 25, avgCost: 350.00, currentPrice: 378.91, value: 9472.75 },
    { symbol: 'GOOGL', name: 'Alphabet', shares: 40, avgCost: 125.00, currentPrice: 141.80, value: 5672.00 },
    { symbol: 'BTC', name: 'Bitcoin', shares: 0.5, avgCost: 45000, currentPrice: 97543.21, value: 48771.61 },
  ];

  const allocation = [
    { category: 'Technology', percent: 45, color: 'bg-blue-500' },
    { category: 'Crypto', percent: 35, color: 'bg-purple-500' },
    { category: 'ETFs', percent: 15, color: 'bg-emerald-500' },
    { category: 'Cash', percent: 5, color: 'bg-gray-500' },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#060d18] p-4 overflow-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Portfolio</h1>
        <p className="text-gray-400 text-sm">Track your investments</p>
      </div>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-[#0a1628] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
            <Wallet className="w-4 h-4" strokeWidth={1.5} />
            Total Value
          </div>
          <div className="text-2xl font-bold text-white">${portfolioValue.toLocaleString()}</div>
          <div className={`flex items-center gap-1 text-sm mt-1 ${dayChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {dayChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {dayChange >= 0 ? '+' : ''}${dayChange.toLocaleString()} ({dayChangePercent}%) today
          </div>
        </div>

        <div className="bg-[#0a1628] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
            <DollarSign className="w-4 h-4" strokeWidth={1.5} />
            Available Cash
          </div>
          <div className="text-2xl font-bold text-white">$5,432.10</div>
          <div className="text-sm text-gray-500 mt-1">Ready to invest</div>
        </div>

        <div className="bg-[#0a1628] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
            <Percent className="w-4 h-4" strokeWidth={1.5} />
            Total Return
          </div>
          <div className="text-2xl font-bold text-emerald-400">+24.5%</div>
          <div className="text-sm text-gray-500 mt-1">All time</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
        {/* Holdings */}
        <div className="lg:col-span-2 bg-[#0a1628] border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h3 className="text-white font-medium">Holdings</h3>
          </div>
          <div className="overflow-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-800">
                  <th className="text-left px-4 py-2">Symbol</th>
                  <th className="text-right px-4 py-2">Shares</th>
                  <th className="text-right px-4 py-2">Avg Cost</th>
                  <th className="text-right px-4 py-2">Price</th>
                  <th className="text-right px-4 py-2">Value</th>
                  <th className="text-right px-4 py-2">P/L</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((holding) => {
                  const pl = (holding.currentPrice - holding.avgCost) * holding.shares;
                  const plPercent = ((holding.currentPrice - holding.avgCost) / holding.avgCost) * 100;
                  const isPositive = pl >= 0;
                  return (
                    <tr key={holding.symbol} className="border-b border-gray-800/50 hover:bg-[#0d1829]">
                      <td className="px-4 py-3">
                        <div className="text-white font-medium">${holding.symbol}</div>
                        <div className="text-gray-500 text-xs">{holding.name}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-white">{holding.shares}</td>
                      <td className="px-4 py-3 text-right text-gray-400">${holding.avgCost.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-white">${holding.currentPrice.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-white font-medium">${holding.value.toLocaleString()}</td>
                      <td className={`px-4 py-3 text-right ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isPositive ? '+' : ''}${pl.toFixed(2)}
                        <div className="text-xs">{isPositive ? '+' : ''}{plPercent.toFixed(1)}%</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Allocation */}
        <div className="bg-[#0a1628] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-blue-400" strokeWidth={1.5} />
            <h3 className="text-white font-medium">Allocation</h3>
          </div>
          <div className="space-y-3">
            {allocation.map((item) => (
              <div key={item.category}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-300">{item.category}</span>
                  <span className="text-white font-medium">{item.percent}%</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortfolioPage;
