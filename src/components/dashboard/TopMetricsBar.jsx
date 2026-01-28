import { useState, useEffect } from 'react';
import SearchBar from "./SearchBar";

const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '--';
  const formatted = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Math.abs(value));
  return value < 0 ? `-${formatted}` : `+${formatted}`;
};

const formatCurrencyNeutral = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '--';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);
};

// Mini broker badge for connected accounts
const BrokerBadge = ({ broker }) => {
  const colors = {
    alpaca: 'bg-[#FFCD00] text-black',
    polymarket: 'bg-[#6366F1] text-white',
    kalshi: 'bg-[#00D4AA] text-black',
    webull: 'bg-[#FF5722] text-white',
    ibkr: 'bg-[#D32F2F] text-white',
    robinhood: 'bg-[#00C805] text-white',
    coinbase: 'bg-[#0052FF] text-white',
    binance: 'bg-[#F3BA2F] text-black',
  };
  const initials = {
    alpaca: 'A', polymarket: 'P', kalshi: 'K', webull: 'W',
    ibkr: 'IB', robinhood: 'R', coinbase: 'C', binance: 'B'
  };
  return (
    <div className={`w-5 h-5 rounded ${colors[broker.id] || 'bg-gray-500 text-white'} flex items-center justify-center text-[8px] font-bold`} title={broker.name}>
      {initials[broker.id] || '?'}
    </div>
  );
};

export default function TopMetricsBar({ alpacaData, theme, themeClasses, onThemeToggle, onLogout, onAddToWatchlist, connectedBrokers = [] }) {
  const account = alpacaData?.account || {};
  
  // Mock live P&L data
  const [mockPnL, setMockPnL] = useState({
    daily: 1247.83,
    unrealized: 3892.45,
    realized: 856.22,
    netLiq: 125840.00,
    buyingPower: 251680.00
  });

  // Animate P&L values
  useEffect(() => {
    const interval = setInterval(() => {
      setMockPnL(prev => ({
        daily: prev.daily + (Math.random() - 0.45) * 50,
        unrealized: prev.unrealized + (Math.random() - 0.48) * 80,
        realized: prev.realized + (Math.random() - 0.5) * 20,
        netLiq: prev.netLiq + (Math.random() - 0.45) * 100,
        buyingPower: prev.buyingPower + (Math.random() - 0.5) * 50
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Use real data if available and non-zero, otherwise use mock
  const hasRealData = account.equity && account.equity > 0;
  const dailyPnL = hasRealData ? (account.daily_pnl ?? 0) : mockPnL.daily;
  const unrealizedPnL = hasRealData ? (account.unrealized_pl ?? 0) : mockPnL.unrealized;
  const realizedPnL = hasRealData ? (account.realized_pl ?? 0) : mockPnL.realized;
  const netLiquidity = hasRealData ? account.equity : mockPnL.netLiq;
  const buyingPower = hasRealData ? (account.buying_power ?? 0) : mockPnL.buyingPower;
  
  const metrics = [
    { label: 'Daily P&L', value: formatCurrency(dailyPnL), change: dailyPnL },
    { label: 'Buying Power', value: formatCurrencyNeutral(buyingPower) },
  ];

  const getValueColor = (change) => {
    if (change === null || change === undefined || isNaN(change)) return themeClasses.text;
    if (change > 0) return 'text-emerald-400';
    if (change < 0) return 'text-red-400';
    return themeClasses.text;
  };

  return (
    <div className={`h-14 flex items-center justify-between px-4 ${themeClasses.surfaceElevated} border-b ${themeClasses.border}`}>
      <div className="flex items-center gap-6 overflow-x-auto">
        {metrics.map((metric, index) => (
          <div key={index} className="flex flex-col min-w-0">
            <span className={`text-[10px] uppercase tracking-wider ${themeClasses.textMuted}`}>{metric.label}</span>
            <span className={`text-sm font-medium ${metric.change !== undefined ? getValueColor(metric.change) : themeClasses.text}`}>{metric.value}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 ml-4">
        <SearchBar onSelectStock={onAddToWatchlist} />
        <div className="flex items-center gap-4 pl-4 border-l border-[#5f6368]">
          {/* Connected Accounts */}
          {connectedBrokers.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {connectedBrokers.slice(0, 4).map(broker => (
                  <BrokerBadge key={broker.id} broker={broker} />
                ))}
                {connectedBrokers.length > 4 && (
                  <span className="text-[10px] text-gray-500">+{connectedBrokers.length - 4}</span>
                )}
              </div>
              <div className="text-right">
                <span className="text-[10px] text-emerald-400 uppercase tracking-wider">Connected</span>
                <p className="text-xs text-gray-400">{connectedBrokers.length} account{connectedBrokers.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
          )}
          <div className="text-right">
            <span className={`text-[10px] uppercase tracking-wider ${themeClasses.textMuted}`}>NET LIQ</span>
            <p className={`text-sm font-semibold ${themeClasses.text}`}>{formatCurrencyNeutral(netLiquidity)}</p>
          </div>
        </div>
        <button onClick={onThemeToggle} className={`p-2 rounded-lg hover:bg-[#2A2A2A] transition-colors ${themeClasses.textMuted}`}>
          {theme === 'dark' ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
          )}
        </button>
        <button onClick={onLogout} className={`p-2 rounded-lg hover:bg-[#2A2A2A] transition-colors ${themeClasses.textMuted}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
        </button>
      </div>
    </div>
  );
}
