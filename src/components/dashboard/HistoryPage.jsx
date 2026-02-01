import React, { useState } from 'react';
import { History, ArrowUpRight, ArrowDownRight, Filter, Calendar, Search } from 'lucide-react';

const HistoryPage = () => {
  const [filter, setFilter] = useState('all');

  const transactions = [
    { id: 1, type: 'buy', symbol: 'AAPL', shares: 10, price: 212.50, total: 2125.00, date: '2025-02-01', time: '09:32:15', status: 'filled' },
    { id: 2, type: 'sell', symbol: 'TSLA', shares: 5, price: 248.90, total: 1244.50, date: '2025-02-01', time: '10:15:42', status: 'filled' },
    { id: 3, type: 'buy', symbol: 'NVDA', shares: 3, price: 718.25, total: 2154.75, date: '2025-01-31', time: '14:22:08', status: 'filled' },
    { id: 4, type: 'buy', symbol: 'BTC', shares: 0.05, price: 97234.00, total: 4861.70, date: '2025-01-31', time: '11:45:33', status: 'filled' },
    { id: 5, type: 'sell', symbol: 'META', shares: 8, price: 472.15, total: 3777.20, date: '2025-01-30', time: '15:58:21', status: 'filled' },
    { id: 6, type: 'buy', symbol: 'MSFT', shares: 5, price: 376.80, total: 1884.00, date: '2025-01-30', time: '09:45:12', status: 'filled' },
    { id: 7, type: 'sell', symbol: 'GOOGL', shares: 15, price: 140.25, total: 2103.75, date: '2025-01-29', time: '13:12:45', status: 'filled' },
    { id: 8, type: 'buy', symbol: 'ETH', shares: 2, price: 3198.45, total: 6396.90, date: '2025-01-29', time: '10:30:00', status: 'filled' },
  ];

  const filteredTransactions = filter === 'all' 
    ? transactions 
    : transactions.filter(t => t.type === filter);

  const stats = {
    totalTrades: transactions.length,
    buyVolume: transactions.filter(t => t.type === 'buy').reduce((sum, t) => sum + t.total, 0),
    sellVolume: transactions.filter(t => t.type === 'sell').reduce((sum, t) => sum + t.total, 0),
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#060d18] p-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Trade History</h1>
          <p className="text-gray-400 text-sm">View your past transactions</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-2 bg-[#1a2438] hover:bg-[#243048] text-gray-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <Calendar className="w-4 h-4" strokeWidth={1.5} />
            Date Range
          </button>
          <button className="px-3 py-2 bg-[#1a2438] hover:bg-[#243048] text-gray-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <Filter className="w-4 h-4" strokeWidth={1.5} />
            Export
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-[#0a1628] border border-gray-800 rounded-xl p-4">
          <div className="text-gray-400 text-sm mb-1">Total Trades</div>
          <div className="text-xl font-bold text-white">{stats.totalTrades}</div>
        </div>
        <div className="bg-[#0a1628] border border-gray-800 rounded-xl p-4">
          <div className="text-gray-400 text-sm mb-1">Buy Volume</div>
          <div className="text-xl font-bold text-emerald-400">${stats.buyVolume.toLocaleString()}</div>
        </div>
        <div className="bg-[#0a1628] border border-gray-800 rounded-xl p-4">
          <div className="text-gray-400 text-sm mb-1">Sell Volume</div>
          <div className="text-xl font-bold text-red-400">${stats.sellVolume.toLocaleString()}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-1 bg-[#0a1628] border border-gray-800 rounded-lg p-1">
          {['all', 'buy', 'sell'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filter === f 
                  ? 'bg-purple-600 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex-1 flex items-center gap-2 bg-[#0a1628] border border-gray-800 rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-gray-500" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="Search transactions..."
            className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm outline-none"
          />
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-[#0a1628] border border-gray-800 rounded-xl flex-1 overflow-hidden flex flex-col">
        <div className="grid grid-cols-8 gap-4 px-4 py-3 border-b border-gray-800 text-xs text-gray-500 font-medium">
          <div>Type</div>
          <div>Symbol</div>
          <div className="text-right">Shares</div>
          <div className="text-right">Price</div>
          <div className="text-right">Total</div>
          <div>Date</div>
          <div>Time</div>
          <div>Status</div>
        </div>

        <div className="flex-1 overflow-auto">
          {filteredTransactions.map((tx) => (
            <div 
              key={tx.id} 
              className="grid grid-cols-8 gap-4 px-4 py-3 border-b border-gray-800/50 hover:bg-[#0d1829] transition-colors"
            >
              <div className="flex items-center gap-2">
                {tx.type === 'buy' ? (
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" strokeWidth={2} />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                    <ArrowUpRight className="w-3.5 h-3.5 text-red-400" strokeWidth={2} />
                  </div>
                )}
                <span className={`text-sm font-medium ${tx.type === 'buy' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {tx.type.toUpperCase()}
                </span>
              </div>
              <div className="text-white font-medium text-sm">${tx.symbol}</div>
              <div className="text-right text-white text-sm">{tx.shares}</div>
              <div className="text-right text-gray-300 text-sm font-mono">${tx.price.toLocaleString()}</div>
              <div className="text-right text-white text-sm font-medium">${tx.total.toLocaleString()}</div>
              <div className="text-gray-400 text-sm">{tx.date}</div>
              <div className="text-gray-500 text-sm">{tx.time}</div>
              <div>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-xs font-medium">
                  {tx.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;
