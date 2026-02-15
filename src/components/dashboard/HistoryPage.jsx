import React, { useMemo, useState } from 'react';
import { History, ArrowUpRight, ArrowDownRight, Filter, Calendar, Search } from 'lucide-react';
import { useTradeHistory } from '../../store/StratifyProvider';

const HistoryPage = () => {
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { trades } = useTradeHistory();

  const transactions = useMemo(() => {
    if (!Array.isArray(trades)) return [];

    return trades
      .map((trade) => {
        const timestamp = Number.isFinite(trade?.timestamp)
          ? trade.timestamp
          : Date.parse(trade?.timestamp);
        const resolvedTimestamp = Number.isFinite(timestamp) ? timestamp : Date.now();
        const side = String(trade?.side || trade?.type || '').toLowerCase();
        const type = side === 'sell' ? 'sell' : 'buy';
        const symbol = String(trade?.symbol || trade?.ticker || '').toUpperCase();
        const shares = Number(trade?.shares ?? trade?.qty ?? trade?.quantity ?? 0);
        const price = Number(trade?.price ?? 0);
        const total = Number(trade?.total ?? (shares * price));

        return {
          id: trade?.id || `${symbol}-${resolvedTimestamp}-${type}`,
          type,
          symbol,
          shares: Number.isFinite(shares) ? Math.abs(shares) : 0,
          price: Number.isFinite(price) ? price : 0,
          total: Number.isFinite(total) ? Math.abs(total) : 0,
          timestamp: resolvedTimestamp,
          status: 'filled',
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [trades]);

  const stats = useMemo(() => {
    const buyVolume = transactions
      .filter((trade) => trade.type === 'buy')
      .reduce((sum, trade) => sum + trade.total, 0);
    const sellVolume = transactions
      .filter((trade) => trade.type === 'sell')
      .reduce((sum, trade) => sum + trade.total, 0);

    return {
      totalTrades: transactions.length,
      buyVolume,
      sellVolume,
    };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return transactions.filter((trade) => {
      if (filter !== 'all' && trade.type !== filter) return false;
      if (!query) return true;

      return (
        trade.symbol.toLowerCase().includes(query) ||
        trade.type.toLowerCase().includes(query) ||
        String(trade.id).toLowerCase().includes(query)
      );
    });
  }, [transactions, filter, searchQuery]);

  const formatCurrency = (value, { zeroAsDash = false } = {}) => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount === 0) {
      return zeroAsDash ? '-$0.00' : '$0.00';
    }
    const sign = amount < 0 ? '-' : '';
    return `${sign}$${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (timestamp) =>
    new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

  const formatTime = (timestamp) =>
    new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0b0b] p-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Trade History</h1>
          <p className="text-gray-400 text-sm">View your past transactions</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-2 bg-[#111111] hover:bg-[#243048] text-gray-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <Calendar className="w-4 h-4" strokeWidth={1.5} />
            Date Range
          </button>
          <button className="px-3 py-2 bg-[#111111] hover:bg-[#243048] text-gray-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <Filter className="w-4 h-4" strokeWidth={1.5} />
            Export
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-4">
          <div className="text-gray-400 text-sm mb-1">Total Trades</div>
          <div className="text-xl font-bold text-white">{stats.totalTrades}</div>
        </div>
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-4">
          <div className="text-gray-400 text-sm mb-1">Buy Volume</div>
          <div className="text-xl font-bold text-emerald-400">{formatCurrency(stats.buyVolume, { zeroAsDash: true })}</div>
        </div>
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-4">
          <div className="text-gray-400 text-sm mb-1">Sell Volume</div>
          <div className="text-xl font-bold text-red-400">{formatCurrency(stats.sellVolume, { zeroAsDash: true })}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-1 bg-[#111111] border border-[#1f1f1f] rounded-lg p-1">
          {['all', 'buy', 'sell'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filter === f 
                  ? 'bg-emerald-500 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex-1 flex items-center gap-2 bg-[#111111] border border-[#1f1f1f] rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-white/50" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm outline-none"
          />
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl flex-1 overflow-hidden flex flex-col">
        <div className="grid grid-cols-8 gap-4 px-4 py-3 border-b border-[#1f1f1f] text-xs text-white/50 font-medium">
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
          {filteredTransactions.length > 0 ? (
            filteredTransactions.map((tx) => (
              <div
                key={tx.id}
                className="grid grid-cols-8 gap-4 px-4 py-3 border-b border-[#1f1f1f]/50 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {tx.type === 'buy' ? (
                    <ArrowDownRight className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
                  ) : (
                    <ArrowUpRight className="w-4 h-4 text-red-400" strokeWidth={1.5} />
                  )}
                  <span className={`text-sm font-medium ${tx.type === 'buy' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {tx.type.toUpperCase()}
                  </span>
                </div>
                <div className="text-white font-medium text-sm">${tx.symbol}</div>
                <div className="text-right text-white text-sm">{tx.shares}</div>
                <div className="text-right text-gray-300 text-sm font-mono">{formatCurrency(tx.price)}</div>
                <div className="text-right text-white text-sm font-medium">{formatCurrency(tx.total)}</div>
                <div className="text-gray-400 text-sm">{formatDate(tx.timestamp)}</div>
                <div className="text-white/50 text-sm">{formatTime(tx.timestamp)}</div>
                <div>
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-xs font-medium">
                    {tx.status}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="h-full flex items-center justify-center p-8">
              <div className="text-center">
                <History className="w-8 h-8 text-white/20 mx-auto mb-3" strokeWidth={1.5} />
                <p className="text-sm text-white/65">
                  {transactions.length === 0
                    ? 'No trades yet. Start paper trading or connect a broker to see your history.'
                    : 'No trades match your current filters.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;
