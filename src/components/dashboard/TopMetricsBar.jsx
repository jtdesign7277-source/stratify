import SearchBar from "./SearchBar";

const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '--';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);
};

export default function TopMetricsBar({ alpacaData, theme, themeClasses, onThemeToggle, onLogout, onAddToWatchlist }) {
  const account = alpacaData?.account || {};
  
  const metrics = [
    { label: 'Daily P&L', value: formatCurrency(account.daily_pnl), change: account.daily_pnl },
    { label: 'Unrealized P&L', value: formatCurrency(account.unrealized_pl), change: account.unrealized_pl },
    { label: 'Realized P&L', value: formatCurrency(account.realized_pl), change: account.realized_pl },
    { label: 'Net Liquidity', value: formatCurrency(account.equity) },
    { label: 'Buying Power', value: formatCurrency(account.buying_power) },
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
        <div className="flex items-center gap-4 pl-4 border-l border-[#2A2A2A]">
          <div className="text-right">
            <span className={`text-[10px] uppercase tracking-wider ${themeClasses.textMuted}`}>NET LIQ</span>
            <p className={`text-sm font-semibold ${themeClasses.text}`}>{formatCurrency(account.equity)}</p>
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
