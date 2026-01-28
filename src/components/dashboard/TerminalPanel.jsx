import { useState, useEffect } from 'react';

// Live updating number component
const LiveNumber = ({ baseValue, prefix = '', suffix = '', color = 'text-white', fluctuation = 0.5 }) => {
  const [value, setValue] = useState(parseFloat(baseValue));
  
  useEffect(() => {
    const interval = setInterval(() => {
      const change = (Math.random() - 0.5) * fluctuation;
      setValue(prev => {
        const newVal = prev + change;
        return Math.max(0, newVal);
      });
    }, 1000 + Math.random() * 2000);
    
    return () => clearInterval(interval);
  }, [baseValue, fluctuation]);

  return (
    <span className={`${color} font-medium tabular-nums transition-all duration-300`}>
      {prefix}{value.toFixed(2)}{suffix}
    </span>
  );
};

// Live P&L that can go up or down
const LivePnL = ({ baseValue = 1000 }) => {
  const [value, setValue] = useState(baseValue);
  const [trades, setTrades] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      const change = (Math.random() - 0.4) * 50; // Slightly biased positive
      setValue(prev => prev + change);
      if (Math.random() > 0.7) {
        setTrades(prev => prev + 1);
      }
    }, 2000 + Math.random() * 3000);
    
    return () => clearInterval(interval);
  }, []);

  const isPositive = value >= 0;
  
  return {
    pnl: (
      <span className={`font-medium tabular-nums ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
        {isPositive ? '+' : ''}{value < 0 ? '-' : ''}${Math.abs(value).toFixed(2)}
      </span>
    ),
    trades
  };
};

export default function TerminalPanel({ themeClasses, deployedStrategies = [] }) {
  const [expanded, setExpanded] = useState(true);
  const [panelHeight, setPanelHeight] = useState(() => {
    const saved = localStorage.getItem('stratify-terminal-height');
    return saved ? parseInt(saved, 10) : 200;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [liveData, setLiveData] = useState({});

  // Initialize live data for each strategy
  useEffect(() => {
    const newLiveData = {};
    deployedStrategies.forEach(s => {
      if (!liveData[s.id]) {
        newLiveData[s.id] = {
          pnl: Math.random() * 2000 - 500,
          trades: Math.floor(Math.random() * 20),
          winRate: parseFloat(s.metrics.winRate),
        };
      } else {
        newLiveData[s.id] = liveData[s.id];
      }
    });
    setLiveData(newLiveData);
  }, [deployedStrategies.length]);

  // Live update effect
  useEffect(() => {
    if (deployedStrategies.length === 0) return;
    
    const interval = setInterval(() => {
      setLiveData(prev => {
        const updated = { ...prev };
        deployedStrategies.forEach(s => {
          if (updated[s.id]) {
            const pnlChange = (Math.random() - 0.4) * 30;
            updated[s.id] = {
              ...updated[s.id],
              pnl: updated[s.id].pnl + pnlChange,
              trades: Math.random() > 0.8 ? updated[s.id].trades + 1 : updated[s.id].trades,
              winRate: updated[s.id].winRate + (Math.random() - 0.5) * 0.3,
            };
          }
        });
        return updated;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [deployedStrategies]);

  useEffect(() => {
    localStorage.setItem('stratify-terminal-height', panelHeight.toString());
  }, [panelHeight]);

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

  // Collapsed view
  if (!expanded) {
    return (
      <div 
        className={`h-8 flex items-center justify-between px-4 ${themeClasses.surfaceElevated} border-t ${themeClasses.border} cursor-pointer hover:bg-[#3c4043] transition-colors`}
        onClick={() => setExpanded(true)}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-medium text-white">Deployed Strategies</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-emerald-400">{deployedStrategies.length} active</span>
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${themeClasses.surfaceElevated} border-t ${themeClasses.border}`}>
      {/* Resize handle */}
      <div 
        className={`h-1 cursor-row-resize flex items-center justify-center ${isDragging ? 'bg-emerald-500/30' : 'hover:bg-emerald-500/20'}`}
        onMouseDown={() => setIsDragging(true)}
      >
        <div className={`w-12 h-0.5 rounded-full ${isDragging ? 'bg-emerald-500' : 'bg-[#3A3A3A]'}`} />
      </div>

      {/* Header */}
      <div className={`h-9 flex items-center justify-between px-4 border-b ${themeClasses.border}`}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm font-medium text-white">Deployed Strategies</span>
          <span className="text-xs text-emerald-400 ml-2">{deployedStrategies.length} active</span>
        </div>
        <div className="flex items-center gap-6">
          {/* Totals in header */}
          {deployedStrategies.length > 0 && (() => {
            const totals = deployedStrategies.reduce((acc, strategy) => {
              const live = liveData[strategy.id] || { pnl: 0, trades: 0, winRate: parseFloat(strategy.metrics.winRate) };
              return {
                pnl: acc.pnl + live.pnl,
                trades: acc.trades + live.trades,
                winRateSum: acc.winRateSum + live.winRate,
              };
            }, { pnl: 0, trades: 0, winRateSum: 0 });
            const avgWinRate = totals.winRateSum / deployedStrategies.length;
            const isPositive = totals.pnl >= 0;

            return (
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">P&L:</span>
                  <span className={`font-medium tabular-nums ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {isPositive ? '+' : '-'}${Math.abs(totals.pnl).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">Trades:</span>
                  <span className="text-white font-medium tabular-nums">{totals.trades}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">Win:</span>
                  <span className="text-emerald-400 font-medium tabular-nums">{avgWinRate.toFixed(1)}%</span>
                </div>
              </div>
            );
          })()}
          <button 
            onClick={() => setExpanded(false)}
            className={`p-1 rounded hover:bg-[#2A2A2A] ${themeClasses.textMuted}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Panel content */}
      <div 
        className="overflow-hidden"
        style={{ height: `${panelHeight}px` }}
      >
        <div className="h-full overflow-y-auto p-3 scrollbar-hide">
          {deployedStrategies.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <svg className="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p className="text-xs">No deployed strategies yet</p>
              <p className="text-[10px] mt-1 opacity-70">Backtest and deploy strategies from the center panel</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {deployedStrategies.map((strategy) => {
                const live = liveData[strategy.id] || { pnl: 0, trades: 0, winRate: parseFloat(strategy.metrics.winRate) };
                const isPositive = live.pnl >= 0;

                return (
                  <div 
                    key={strategy.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${themeClasses.surface} border ${themeClasses.border} hover:border-emerald-500/30 transition-colors animate-fadeIn`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <div>
                        <div className={`text-sm font-medium ${themeClasses.text}`}>{strategy.name}</div>
                        <div className="text-xs text-emerald-400">Running</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-xs">
                      <div className="text-right">
                        <div className={themeClasses.textMuted}>P&L</div>
                        <div className={`font-medium tabular-nums ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isPositive ? '+' : ''}{live.pnl < 0 ? '-' : ''}${Math.abs(live.pnl).toFixed(2)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={themeClasses.textMuted}>Trades</div>
                        <div className={`${themeClasses.text} tabular-nums`}>{live.trades}</div>
                      </div>
                      <div className="text-right">
                        <div className={themeClasses.textMuted}>Win Rate</div>
                        <div className="text-emerald-400 tabular-nums">{live.winRate.toFixed(1)}%</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button className="px-2 py-1 text-sm font-medium text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10 rounded transition-colors" title="Pause">
                          PAUSE
                        </button>
                        <button className="px-2 py-1 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors" title="Kill Strategy">
                          KILL
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
