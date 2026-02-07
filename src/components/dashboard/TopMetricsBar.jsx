import { useState, useEffect, useRef } from 'react';
import SearchBar from "./SearchBar";

// Notification Settings Dropdown
const NotificationDropdown = ({ isOpen, onClose, themeClasses }) => {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('stratify-notification-settings');
      return saved ? JSON.parse(saved) : {
        enabled: true,
        phone: false,
        desktop: true,
        email: false,
        arbOpportunities: true,
        tradeOutcomes: true,
        priceAlerts: false,
        strategyStatus: true,
        weeklyDigest: false,
      };
    } catch { 
      return {
        enabled: true,
        phone: false,
        desktop: true,
        email: false,
        arbOpportunities: true,
        tradeOutcomes: true,
        priceAlerts: false,
        strategyStatus: true,
        weeklyDigest: false,
      };
    }
  });

  const updateSetting = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    localStorage.setItem('stratify-notification-settings', JSON.stringify(newSettings));
  };

  if (!isOpen) return null;

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-[#0d0d12] border border-[#2a2a3d] rounded-xl shadow-2xl z-50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#2a2a3d] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="text-sm font-semibold text-white">Notifications</span>
        </div>
        <button
          onClick={() => updateSetting('enabled', !settings.enabled)}
          className={`w-10 h-5 rounded-full transition-colors ${settings.enabled ? 'bg-emerald-500' : 'bg-[#3c4043]'}`}
        >
          <div className={`w-4 h-4 bg-white rounded-full transition-transform ${settings.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      <div className={`${settings.enabled ? '' : 'opacity-50 pointer-events-none'}`}>
        {/* Delivery Methods */}
        <div className="px-4 py-3 border-b border-[#2a2a3d]">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">Delivery Method</p>
          <div className="space-y-2">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-sm text-white">Desktop</span>
              </div>
              <button
                onClick={() => updateSetting('desktop', !settings.desktop)}
                className={`w-9 h-5 rounded-full transition-colors ${settings.desktop ? 'bg-emerald-500' : 'bg-[#3c4043]'}`}
              >
                <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform ${settings.desktop ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <div>
                  <span className="text-sm text-white">Phone</span>
                  <p className="text-[10px] text-gray-500">Requires mobile app</p>
                </div>
              </div>
              <button
                onClick={() => updateSetting('phone', !settings.phone)}
                className={`w-9 h-5 rounded-full transition-colors ${settings.phone ? 'bg-emerald-500' : 'bg-[#3c4043]'}`}
              >
                <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform ${settings.phone ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-sm text-white">Email</span>
              </div>
              <button
                onClick={() => updateSetting('email', !settings.email)}
                className={`w-9 h-5 rounded-full transition-colors ${settings.email ? 'bg-emerald-500' : 'bg-[#3c4043]'}`}
              >
                <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform ${settings.email ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </label>
          </div>
        </div>

        {/* Alert Types */}
        <div className="px-4 py-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-3">Alert Types</p>
          <div className="space-y-2">
            <label className="flex items-center justify-between cursor-pointer py-1">
              <div className="flex items-center gap-2">
                <span className="text-amber-400">🎯</span>
                <span className="text-sm text-white">Arbitrage Opportunities</span>
              </div>
              <button
                onClick={() => updateSetting('arbOpportunities', !settings.arbOpportunities)}
                className={`w-9 h-5 rounded-full transition-colors ${settings.arbOpportunities ? 'bg-emerald-500' : 'bg-[#3c4043]'}`}
              >
                <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform ${settings.arbOpportunities ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </label>
            <label className="flex items-center justify-between cursor-pointer py-1">
              <div className="flex items-center gap-2">
                <span className="text-emerald-400">💰</span>
                <span className="text-sm text-white">Trade Outcomes</span>
              </div>
              <button
                onClick={() => updateSetting('tradeOutcomes', !settings.tradeOutcomes)}
                className={`w-9 h-5 rounded-full transition-colors ${settings.tradeOutcomes ? 'bg-emerald-500' : 'bg-[#3c4043]'}`}
              >
                <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform ${settings.tradeOutcomes ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </label>
            <label className="flex items-center justify-between cursor-pointer py-1">
              <div className="flex items-center gap-2">
                <span className="text-blue-400">📈</span>
                <span className="text-sm text-white">Price Alerts</span>
              </div>
              <button
                onClick={() => updateSetting('priceAlerts', !settings.priceAlerts)}
                className={`w-9 h-5 rounded-full transition-colors ${settings.priceAlerts ? 'bg-emerald-500' : 'bg-[#3c4043]'}`}
              >
                <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform ${settings.priceAlerts ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </label>
            <label className="flex items-center justify-between cursor-pointer py-1">
              <div className="flex items-center gap-2">
                <span className="text-purple-400">⚡</span>
                <span className="text-sm text-white">Strategy Status</span>
              </div>
              <button
                onClick={() => updateSetting('strategyStatus', !settings.strategyStatus)}
                className={`w-9 h-5 rounded-full transition-colors ${settings.strategyStatus ? 'bg-emerald-500' : 'bg-[#3c4043]'}`}
              >
                <div className={`w-3.5 h-3.5 bg-white rounded-full transition-transform ${settings.strategyStatus ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </label>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-[#151515] border-t border-[#2a2a3d]">
        <p className="text-[10px] text-gray-600 text-center">
          {settings.enabled ? 'Notifications are enabled' : 'Notifications are disabled'}
        </p>
      </div>
    </div>
  );
};

// Notification Button with Dropdown
const NotificationButton = ({ themeClasses }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  // Check if notifications are enabled
  const [hasNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('stratify-notification-settings');
      return saved ? JSON.parse(saved).enabled : true;
    } catch { return true; }
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-lg hover:bg-[#2A2A2A] transition-colors relative ${themeClasses.textMuted}`}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {/* Active indicator dot */}
        {hasNotifications && (
          <div className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-400 rounded-full" />
        )}
      </button>
      <NotificationDropdown isOpen={isOpen} onClose={() => setIsOpen(false)} themeClasses={themeClasses} />
    </div>
  );
};

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

export default function TopMetricsBar({ alpacaData, theme, themeClasses, onThemeToggle, onLogout, onAddToWatchlist, onLegendClick, connectedBrokers = [] }) {
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
    <div className={`h-14 flex items-center px-4 ${themeClasses.surfaceElevated} border-b ${themeClasses.border}`}>
      <div className="flex flex-1 min-w-0 items-center gap-6 overflow-x-auto">
        {metrics.map((metric, index) => (
          <div key={index} className="flex flex-col min-w-0">
            <span className={`text-[10px] uppercase tracking-wider ${themeClasses.textMuted}`}>{metric.label}</span>
            <span className={`text-sm font-medium ${metric.change !== undefined ? getValueColor(metric.change) : themeClasses.text}`}>{metric.value}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 ml-auto flex-shrink-0">
        <div className="flex items-center gap-4">
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
          <div className="flex items-center gap-2">
            <div className="text-right">
              <span className={`text-[10px] uppercase tracking-wider ${themeClasses.textMuted}`}>NET LIQ</span>
              <p className={`text-sm font-semibold ${themeClasses.text}`}>{formatCurrencyNeutral(netLiquidity)}</p>
            </div>
            <button
              type="button"
              onClick={onLegendClick}
              className="relative flex h-8 w-8 flex-none shrink-0 items-center justify-center rounded-lg border bg-gradient-to-br from-amber-300/90 via-amber-400 to-amber-500 text-[14px] shadow-[0_0_14px_rgba(251,191,36,0.35)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
              style={{ borderColor: 'rgba(251,191,36,0.3)' }}
              aria-label="Open legend leaderboard"
            >
              <span className="animate-pulse">🏆</span>
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.7)]" />
            </button>
          </div>
        </div>
        {/* Notification Bell */}
        <NotificationButton themeClasses={themeClasses} />
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
