import { useState, useEffect } from 'react';

export default function TerminalPanel({ themeClasses, deployedStrategies = [], onRemoveStrategy, embedded = false }) {
  const [liveData, setLiveData] = useState({});
  const [pausedStrategies, setPausedStrategies] = useState({});
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update current time every second for running clocks
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Format elapsed time as "Xd Xh Xm Xs"
  const formatElapsedTime = (deployedAt) => {
    const elapsed = currentTime - deployedAt;
    const seconds = Math.floor(elapsed / 1000) % 60;
    const minutes = Math.floor(elapsed / (1000 * 60)) % 60;
    const hours = Math.floor(elapsed / (1000 * 60 * 60)) % 24;
    const days = Math.floor(elapsed / (1000 * 60 * 60 * 24));
    
    let result = '';
    if (days > 0) result += `${days}d `;
    if (days > 0 || hours > 0) result += `${hours}h `;
    if (days > 0 || hours > 0 || minutes > 0) result += `${minutes}m `;
    result += `${seconds}s`;
    
    return result;
  };

  // Initialize live data for each strategy
  useEffect(() => {
    const newLiveData = {};
    deployedStrategies.forEach(s => {
      if (!liveData[s.id]) {
        newLiveData[s.id] = {
          pnl: Math.random() * 2000 - 500,
          trades: Math.floor(Math.random() * 20),
          winRate: parseFloat(s.metrics?.winRate || 60),
        };
      } else {
        newLiveData[s.id] = liveData[s.id];
      }
    });
    if (Object.keys(newLiveData).length > 0) {
      setLiveData(prev => ({ ...prev, ...newLiveData }));
    }
  }, [deployedStrategies.length]);

  // Live update effect - only for non-paused strategies
  useEffect(() => {
    if (deployedStrategies.length === 0) return;
    
    const interval = setInterval(() => {
      setLiveData(prev => {
        const updated = { ...prev };
        deployedStrategies.forEach(s => {
          if (updated[s.id] && !pausedStrategies[s.id]) {
            const pnlChange = (Math.random() - 0.4) * 30;
            updated[s.id] = {
              ...updated[s.id],
              pnl: updated[s.id].pnl + pnlChange,
              trades: Math.random() > 0.8 ? updated[s.id].trades + 1 : updated[s.id].trades,
              winRate: Math.max(0, Math.min(100, updated[s.id].winRate + (Math.random() - 0.5) * 0.3)),
            };
          }
        });
        return updated;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [deployedStrategies, pausedStrategies]);

  const handlePause = (strategyId) => {
    setPausedStrategies(prev => ({ ...prev, [strategyId]: !prev[strategyId] }));
  };

  const handleKill = (strategyId, strategyName) => {
    if (window.confirm(`Kill strategy "${strategyName}"? This will stop all trading for this strategy.`)) {
      setLiveData(prev => {
        const updated = { ...prev };
        delete updated[strategyId];
        return updated;
      });
      if (onRemoveStrategy) {
        onRemoveStrategy(strategyId);
      }
    }
  };

  const activeStrategies = deployedStrategies.filter(s => liveData[s.id] !== undefined);

  // Calculate totals for header
  const totals = activeStrategies.reduce((acc, strategy) => {
    const live = liveData[strategy.id] || { pnl: 0, trades: 0, winRate: 60 };
    return {
      pnl: acc.pnl + live.pnl,
      trades: acc.trades + live.trades,
      winRateSum: acc.winRateSum + live.winRate,
    };
  }, { pnl: 0, trades: 0, winRateSum: 0 });
  
  const avgWinRate = activeStrategies.length > 0 ? totals.winRateSum / activeStrategies.length : 0;
  const isPositiveTotal = totals.pnl >= 0;

  // Content only (when embedded, parent handles collapse)
  const content = (
    <div className="h-full flex flex-col">
      {/* Summary Stats Bar */}
      {activeStrategies.length > 0 && (
        <div className={`flex items-center justify-end gap-4 px-3 py-2 border-b ${themeClasses?.border || 'border-[#5f6368]'} bg-[#252525]`}>
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-500">Total P&L:</span>
            <span className={`font-medium tabular-nums ${isPositiveTotal ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositiveTotal ? '+' : '-'}${Math.abs(totals.pnl).toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-500">Trades:</span>
            <span className="text-white font-medium tabular-nums">{totals.trades}</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-500">Avg Win:</span>
            <span className="text-emerald-400 font-medium tabular-nums">{avgWinRate.toFixed(1)}%</span>
          </div>
        </div>
      )}

      {/* Strategy List */}
      <div className="flex-1 overflow-y-auto p-3 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
        {activeStrategies.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 py-8">
            <svg className="w-8 h-8 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-xs">No deployed strategies yet</p>
            <p className="text-[10px] mt-1 opacity-70">Backtest and deploy strategies from the builder</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {activeStrategies.map((strategy) => {
              const live = liveData[strategy.id] || { pnl: 0, trades: 0, winRate: 60 };
              const isPositive = live.pnl >= 0;
              const isPaused = pausedStrategies[strategy.id];

              return (
                <div 
                  key={strategy.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${themeClasses?.surface || 'bg-[#202124]'} border ${
                    isPaused ? 'border-yellow-500/50' : (themeClasses?.border || 'border-[#5f6368]')
                  } hover:border-emerald-500/30 transition-colors`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      isPaused ? 'bg-yellow-400' : 'bg-emerald-400 animate-pulse'
                    }`} />
                    <div>
                      <div className={`text-sm font-medium ${themeClasses?.text || 'text-white'}`}>{strategy.name}</div>
                      <div className={`text-xs ${isPaused ? 'text-yellow-400' : 'text-emerald-400'}`}>
                        {isPaused ? 'Paused' : 'Running'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs ${themeClasses?.textMuted || 'text-gray-500'}`}>Runtime</div>
                    <div className="text-xs text-white font-mono tabular-nums">
                      {formatElapsedTime(strategy.deployedAt || Date.now())}
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-xs">
                    <div className="text-right">
                      <div className={themeClasses?.textMuted || 'text-gray-500'}>P&L</div>
                      <div className={`font-medium tabular-nums ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isPositive ? '+' : ''}{live.pnl < 0 ? '-' : ''}${Math.abs(live.pnl).toFixed(2)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={themeClasses?.textMuted || 'text-gray-500'}>Trades</div>
                      <div className={`${themeClasses?.text || 'text-white'} tabular-nums`}>{live.trades}</div>
                    </div>
                    <div className="text-right">
                      <div className={themeClasses?.textMuted || 'text-gray-500'}>Win Rate</div>
                      <div className="text-emerald-400 tabular-nums">{live.winRate.toFixed(1)}%</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handlePause(strategy.id)}
                        className={`px-2 py-1 text-sm font-light rounded transition-colors ${
                          isPaused 
                            ? 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10' 
                            : 'text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10'
                        }`}
                        title={isPaused ? 'Resume' : 'Pause'}
                      >
                        {isPaused ? 'RESUME' : 'PAUSE'}
                      </button>
                      <button 
                        onClick={() => handleKill(strategy.id, strategy.name)}
                        className="px-2 py-1 text-sm font-light text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors" 
                        title="Kill Strategy"
                      >
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
  );

  // When embedded, just return content (parent CollapsiblePanel handles expand/collapse)
  if (embedded) {
    return content;
  }

  // Standalone mode (legacy support) - has own header
  return (
    <div className={`flex flex-col ${themeClasses?.surfaceElevated || 'bg-[#303134]'} border-t ${themeClasses?.border || 'border-[#5f6368]'} h-full`}>
      <div className={`h-9 flex items-center justify-between px-4 border-b ${themeClasses?.border || 'border-[#5f6368]'}`}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm font-medium text-white">Deployed Strategies</span>
          <span className="text-xs text-emerald-400 ml-2">{activeStrategies.length} active</span>
        </div>
      </div>
      {content}
    </div>
  );
}
