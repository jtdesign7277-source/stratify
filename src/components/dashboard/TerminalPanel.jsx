import { useState, useEffect } from 'react';

export default function TerminalPanel({ themeClasses }) {
  const [expanded, setExpanded] = useState(false);
  const [panelHeight, setPanelHeight] = useState(() => {
    const saved = localStorage.getItem('stratify-terminal-height');
    return saved ? parseInt(saved, 10) : 200;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState('strategies');

  // Sample strategy data - will be replaced with real data
  const [strategies, setStrategies] = useState([
    { id: 1, name: 'RSI Breakout', status: 'running', profit: '+$1,245.50', trades: 12, winRate: '67%' },
    { id: 2, name: 'MACD Crossover', status: 'running', profit: '+$892.30', trades: 8, winRate: '75%' },
    { id: 3, name: 'Bollinger Bounce', status: 'paused', profit: '+$456.00', trades: 5, winRate: '60%' },
  ]);

  const [logs, setLogs] = useState([
    { time: '18:45:32', type: 'info', message: 'Strategy "RSI Breakout" executed BUY order for TSLA @ $436.29' },
    { time: '18:44:15', type: 'success', message: 'Strategy "MACD Crossover" closed position NVDA with +$125.50 profit' },
    { time: '18:42:08', type: 'info', message: 'Scanning 500 symbols for pattern matches...' },
    { time: '18:40:00', type: 'warning', message: 'Strategy "Bollinger Bounce" paused - market volatility high' },
    { time: '18:38:22', type: 'info', message: 'Strategy "RSI Breakout" detected entry signal for META' },
  ]);

  // Save panel height to localStorage
  useEffect(() => {
    localStorage.setItem('stratify-terminal-height', panelHeight.toString());
  }, [panelHeight]);

  // Handle resize drag
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const container = document.getElementById('main-content-area');
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const newHeight = containerRect.bottom - e.clientY;
      setPanelHeight(Math.max(100, Math.min(400, newHeight)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const tabs = [
    { id: 'strategies', label: 'Strategies', icon: '📊' },
    { id: 'output', label: 'Output', icon: '📋' },
    { id: 'logs', label: 'Logs', icon: '📝' },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return 'text-emerald-400';
      case 'paused': return 'text-yellow-400';
      case 'stopped': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getStatusDot = (status) => {
    switch (status) {
      case 'running': return 'bg-emerald-400 animate-pulse';
      case 'paused': return 'bg-yellow-400';
      case 'stopped': return 'bg-red-400';
      default: return 'bg-gray-400';
    }
  };

  const getLogColor = (type) => {
    switch (type) {
      case 'success': return 'text-emerald-400';
      case 'warning': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  // Collapsed view
  if (!expanded) {
    return (
      <div 
        className={`h-8 flex items-center justify-between px-4 ${themeClasses.surfaceElevated} border-t ${themeClasses.border} cursor-pointer hover:bg-[#252525] transition-colors`}
        onClick={() => setExpanded(true)}
      >
        <div className="flex items-center gap-4">
          {tabs.map((tab) => (
            <span key={tab.id} className={`text-xs ${themeClasses.textMuted} flex items-center gap-1`}>
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-emerald-400">3 strategies active</span>
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </div>
      </div>
    );
  }

  // Expanded view
  return (
    <div className={`flex flex-col ${themeClasses.surfaceElevated} border-t ${themeClasses.border}`}>
      {/* Resize handle */}
      <div 
        className={`h-1 cursor-row-resize flex items-center justify-center ${isDragging ? 'bg-emerald-500/30' : 'hover:bg-emerald-500/20'}`}
        onMouseDown={() => setIsDragging(true)}
      >
        <div className={`w-12 h-0.5 rounded-full ${isDragging ? 'bg-emerald-500' : 'bg-[#3A3A3A]'}`} />
      </div>

      {/* Tab bar */}
      <div className={`h-9 flex items-center justify-between px-2 border-b ${themeClasses.border}`}>
        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-t flex items-center gap-1.5 transition-colors ${
                activeTab === tab.id 
                  ? `${themeClasses.text} bg-[#2A2A2A]` 
                  : `${themeClasses.textMuted} hover:${themeClasses.text}`
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setExpanded(false)}
            className={`p-1 rounded hover:bg-[#2A2A2A] ${themeClasses.textMuted}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button 
            onClick={() => setExpanded(false)}
            className={`p-1 rounded hover:bg-[#2A2A2A] ${themeClasses.textMuted}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Panel content */}
      <div 
        className="overflow-hidden"
        style={{ height: `${panelHeight}px` }}
      >
        {/* Strategies Tab */}
        {activeTab === 'strategies' && (
          <div className="h-full overflow-y-auto p-3 scrollbar-hide">
            <div className="grid gap-2">
              {strategies.map((strategy) => (
                <div 
                  key={strategy.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${themeClasses.surface} border ${themeClasses.border} hover:border-emerald-500/30 transition-colors`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${getStatusDot(strategy.status)}`} />
                    <div>
                      <div className={`text-sm font-medium ${themeClasses.text}`}>{strategy.name}</div>
                      <div className={`text-xs ${getStatusColor(strategy.status)} capitalize`}>{strategy.status}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-xs">
                    <div className="text-right">
                      <div className={themeClasses.textMuted}>P&L</div>
                      <div className="text-emerald-400 font-medium">{strategy.profit}</div>
                    </div>
                    <div className="text-right">
                      <div className={themeClasses.textMuted}>Trades</div>
                      <div className={themeClasses.text}>{strategy.trades}</div>
                    </div>
                    <div className="text-right">
                      <div className={themeClasses.textMuted}>Win Rate</div>
                      <div className={themeClasses.text}>{strategy.winRate}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Play - Green */}
                      <button className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors" title="Start">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </button>
                      
                      {/* Pause - Yellow */}
                      <button className="p-1 text-yellow-400 hover:text-yellow-300 transition-colors" title="Pause">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                        </svg>
                      </button>
                      
                      {/* Kill - Red */}
                      <button className="p-1 text-red-400 hover:text-red-300 transition-colors" title="Kill">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 6h12v12H6z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Add Strategy Button */}
              <button className={`flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed ${themeClasses.border} hover:border-emerald-500/50 text-gray-500 hover:text-emerald-400 transition-colors`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-sm font-medium">Deploy New Strategy</span>
              </button>
            </div>
          </div>
        )}

        {/* Output Tab */}
        {activeTab === 'output' && (
          <div className="h-full overflow-y-auto p-3 font-mono text-xs scrollbar-hide">
            <div className="text-emerald-400">$ stratify engine started</div>
            <div className="text-gray-400">Connecting to Alpaca API...</div>
            <div className="text-emerald-400">✓ Connected to market data stream</div>
            <div className="text-emerald-400">✓ Connected to trading API</div>
            <div className="text-gray-400">Loading strategies...</div>
            <div className="text-cyan-400">→ RSI Breakout (active)</div>
            <div className="text-cyan-400">→ MACD Crossover (active)</div>
            <div className="text-yellow-400">→ Bollinger Bounce (paused)</div>
            <div className="text-emerald-400">✓ All strategies loaded</div>
            <div className="text-gray-400">Monitoring 500 symbols...</div>
            <div className="text-gray-500 animate-pulse">▋</div>
          </div>
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <div className="h-full overflow-y-auto scrollbar-hide">
            <table className="w-full text-xs">
              <thead className={`sticky top-0 ${themeClasses.surfaceElevated}`}>
                <tr className={`border-b ${themeClasses.border}`}>
                  <th className={`px-3 py-2 text-left ${themeClasses.textMuted} font-medium`}>Time</th>
                  <th className={`px-3 py-2 text-left ${themeClasses.textMuted} font-medium`}>Type</th>
                  <th className={`px-3 py-2 text-left ${themeClasses.textMuted} font-medium`}>Message</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, i) => (
                  <tr key={i} className={`border-b ${themeClasses.border} hover:bg-[#252525]`}>
                    <td className={`px-3 py-2 ${themeClasses.textMuted} font-mono`}>{log.time}</td>
                    <td className={`px-3 py-2 ${getLogColor(log.type)} capitalize`}>{log.type}</td>
                    <td className={`px-3 py-2 ${themeClasses.text}`}>{log.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
