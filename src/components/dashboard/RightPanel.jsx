import { useState } from 'react';

const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '--';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);
};

const MiniChart = ({ color = '#10B981', height = 120 }) => {
  const data = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i * 0.3) * 10 + Math.random() * 5);
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
  const width = 280, chartHeight = height - 20;
  const points = data.map((v, i) => `${2 + (i / 29) * 276},${chartHeight - ((v - min) / range) * (chartHeight - 4)}`).join(' ');

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`2,${chartHeight} ${points} 278,${chartHeight}`} fill="url(#chartGradient)" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export default function RightPanel({ width, alpacaData, theme, themeClasses }) {
  const [expanded, setExpanded] = useState(false);
  const [activeTimeframe, setActiveTimeframe] = useState('1W');
  const [activeNewsTab, setActiveNewsTab] = useState('hot');
  const timeframes = ['1W', 'MTD', '1M', '3M', 'YTD', '1Y', 'All'];
  
  const account = alpacaData?.account || {};
  const portfolioValue = account.equity || 0;
  const dailyChange = account.daily_pnl || 0;
  const dailyChangePercent = portfolioValue ? (dailyChange / portfolioValue) * 100 : 0;
  const currentDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Collapsed view - just icons
  if (!expanded) {
    return (
      <div 
        className={`w-12 flex flex-col items-center py-4 gap-4 ${themeClasses.surfaceElevated} cursor-pointer transition-all duration-200 hover:bg-[#252525]`}
        onMouseEnter={() => setExpanded(true)}
      >
        {/* Chart icon */}
        <div className="flex flex-col items-center gap-1">
          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
          <span className="text-[8px] text-gray-500">Chart</span>
        </div>

        {/* Value icon */}
        <div className="flex flex-col items-center gap-1">
          <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-[8px] text-gray-500">Value</span>
        </div>

        {/* News icon */}
        <div className="flex flex-col items-center gap-1">
          <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
          </svg>
          <span className="text-[8px] text-gray-500">News</span>
        </div>

        {/* Expand indicator */}
        <div className="mt-auto flex flex-col items-center gap-1">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-[8px] text-gray-500">Expand</span>
        </div>
      </div>
    );
  }

  // Expanded view - full panel
  return (
    <div 
      className={`flex flex-col ${themeClasses.surfaceElevated} overflow-hidden transition-all duration-200`} 
      style={{ width }}
      onMouseLeave={() => setExpanded(false)}
    >
      <div className={`p-4 border-b ${themeClasses.border}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex gap-4">
            <button className={`text-sm font-medium ${themeClasses.text}`}>Value</button>
            <button className={`text-sm font-medium ${themeClasses.textMuted}`}>Performance</button>
          </div>
        </div>
        <div className="text-2xl font-semibold mb-1">{formatCurrency(portfolioValue)}</div>
        <div className={`text-sm ${dailyChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {formatCurrency(dailyChange)} ({dailyChange >= 0 ? '+' : ''}{dailyChangePercent.toFixed(2)}%) <span className={themeClasses.textMuted}>{currentDate}</span>
        </div>
      </div>
      <div className={`p-4 border-b ${themeClasses.border}`}>
        <div className="h-32"><MiniChart color={dailyChange >= 0 ? '#10B981' : '#F87171'} height={128} /></div>
        <div className="flex flex-wrap justify-center gap-1 mt-3">
          {timeframes.map((tf) => (
            <button key={tf} onClick={() => setActiveTimeframe(tf)} className={`px-2 py-1 text-[10px] sm:text-xs font-medium rounded transition-colors whitespace-nowrap ${activeTimeframe === tf ? 'bg-cyan-500/20 text-cyan-400' : themeClasses.textMuted}`}>{tf}</button>
          ))}
        </div>
      </div>
      <div className={`p-4 border-b ${themeClasses.border}`}>
        <div className="flex items-center justify-between mb-3">
          <span className={`text-sm font-medium ${themeClasses.text}`}>AI News Overview</span>
          <button className={`text-xs ${themeClasses.textMuted}`}>AI Disclosure</button>
        </div>
        <div className={`text-sm ${themeClasses.textMuted}`}>...</div>
      </div>
      <div className="flex-1 flex flex-col">
        <div className={`flex items-center gap-4 px-4 py-2 border-b ${themeClasses.border}`}>
          <button onClick={() => setActiveNewsTab('hot')} className={`text-sm font-medium flex items-center gap-1 pb-1 border-b-2 ${activeNewsTab === 'hot' ? 'text-orange-400 border-orange-400' : `${themeClasses.textMuted} border-transparent`}`}>🔥 Hot News</button>
          <button onClick={() => setActiveNewsTab('latest')} className={`text-sm font-medium pb-1 border-b-2 ${activeNewsTab === 'latest' ? `${themeClasses.text} border-cyan-400` : `${themeClasses.textMuted} border-transparent`}`}>Latest News</button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <span className={`text-sm ${themeClasses.textMuted}`}>No news available</span>
        </div>
      </div>
    </div>
  );
}
