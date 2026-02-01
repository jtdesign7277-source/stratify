import React from 'react';
import { TrendingUp, TrendingDown, Globe, BarChart3, Activity } from 'lucide-react';

const MarketsPage = () => {
  const markets = [
    { name: 'S&P 500', symbol: 'SPY', price: 502.34, change: 1.23, changePercent: 0.25 },
    { name: 'Nasdaq 100', symbol: 'QQQ', price: 438.67, change: 3.45, changePercent: 0.79 },
    { name: 'Dow Jones', symbol: 'DIA', price: 389.12, change: -0.87, changePercent: -0.22 },
    { name: 'Russell 2000', symbol: 'IWM', price: 198.45, change: 2.10, changePercent: 1.07 },
  ];

  const crypto = [
    { name: 'Bitcoin', symbol: 'BTC', price: 97543.21, change: 2345.67, changePercent: 2.46 },
    { name: 'Ethereum', symbol: 'ETH', price: 3245.89, change: -45.23, changePercent: -1.37 },
    { name: 'Solana', symbol: 'SOL', price: 178.34, change: 12.45, changePercent: 7.51 },
    { name: 'XRP', symbol: 'XRP', price: 2.34, change: 0.12, changePercent: 5.41 },
  ];

  const sectors = [
    { name: 'Technology', change: 1.45 },
    { name: 'Healthcare', change: -0.32 },
    { name: 'Financials', change: 0.87 },
    { name: 'Energy', change: 2.13 },
    { name: 'Consumer', change: -0.54 },
    { name: 'Industrials', change: 0.23 },
  ];

  const MarketCard = ({ title, data, icon: Icon }) => (
    <div className="bg-[#0a1628] border border-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-blue-400" strokeWidth={1.5} />
        <h3 className="text-white font-medium">{title}</h3>
      </div>
      <div className="space-y-3">
        {data.map((item) => {
          const isPositive = item.change >= 0;
          return (
            <div key={item.symbol || item.name} className="flex items-center justify-between py-2 border-b border-gray-800/50 last:border-0">
              <div>
                <div className="text-white text-sm font-medium">{item.symbol ? `$${item.symbol}` : item.name}</div>
                {item.name && item.symbol && <div className="text-gray-500 text-xs">{item.name}</div>}
              </div>
              <div className="text-right">
                {item.price && <div className="text-white text-sm font-mono">${item.price.toLocaleString()}</div>}
                <div className={`text-xs font-medium flex items-center gap-1 justify-end ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {isPositive ? '+' : ''}{item.changePercent?.toFixed(2) || item.change?.toFixed(2)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[#060d18] p-4 overflow-auto">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-white">Markets</h1>
        <p className="text-gray-400 text-sm">Real-time market overview</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        <MarketCard title="US Indices" data={markets} icon={Globe} />
        <MarketCard title="Cryptocurrency" data={crypto} icon={Activity} />
        <MarketCard title="Sectors" data={sectors} icon={BarChart3} />
      </div>
    </div>
  );
};

export default MarketsPage;
