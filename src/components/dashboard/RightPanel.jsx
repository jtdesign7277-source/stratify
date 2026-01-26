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
  const [activeTimeframe, setActiveTimeframe] = useState('1W');
  const [activeNewsTab, setActiveNewsTab] = useState('hot');
  const timeframes = ['1W', 'MTD', '1M', '3M', 'YTD', '1Y', 'All'];
  
  const account = alpacaData?.account || {};
  const portfolioValue = account.equity || 0;
  const dailyChange = account.daily_pnl || 0;
  const dailyChangePercent = portfolioValue ? (dailyChange / portfolioValue) * 100 : 0;
  const currentDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className={`flex flex-col ${themeClasses.surfaceElevated} overflow-hidden`} style={{ width }}>
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
        <div className="flex justify-center gap-1 mt-3">
          {timeframes.map((tf) => (
            <button key={tf} onClick={() => setActiveTimeframe(tf)} className={`px-3 py-1 text-xs font-medium rounded transition-colors ${activeTimeframe === tf ? 'bg-cyan-500/20 text-cyan-400' : themeClasses.textMuted}`}>{tf}</button>
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
          <span className={`text-sm ${themeClasses.textMuted}`}>Portfolio:</span>
          <button onClick={() => setActiveNewsTab('hot')} className={`text-sm font-medium flex items-center gap-1 pb-1 border-b-2 ${activeNewsTab === 'hot' ? 'text-orange-400 border-orange-400' : `${themeClasses.textMuted} border-transparent`}`}>🔥 Hot News</button>
          <button onClick={() => setActiveNewsTab('latest')} className={`text-sm font-medium pb-1 border-b-2 ${activeNewsTab === 'latest' ? `${themeClasses.text} border-cyan-400` : `${themeClasses.textMuted} border-transparent`}`}>Latest News</button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <span className={`text-sm ${themeClasses.textMuted}`}>No News For Portfolio</span>
        </div>
      </div>
    </div>
  );
}
