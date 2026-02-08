import { useState, useEffect } from 'react';

// Premium stat display
const StatBadge = ({ label, value, color = 'white', trend }) => (
  <div className="text-right">
    <div className="text-[10px] text-white/50 uppercase tracking-wider">{label}</div>
    <div className={`font-semibold tabular-nums text-sm ${
      color === 'green' ? 'text-emerald-400' : 
      color === 'red' ? 'text-red-400' : 
      color === 'yellow' ? 'text-amber-400' : 'text-white'
    }`}>
      {value}
      {trend && (
        <span className={`ml-1 text-[10px] ${trend > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {trend > 0 ? '↑' : '↓'}
        </span>
      )}
    </div>
  </div>
);

export default function TerminalPanel({ themeClasses, deployedStrategies = [], onRemoveStrategy, embedded = false }) {
  const [liveData, setLiveData] = useState({});
  const [pausedStrategies, setPausedStrategies] = useState({});
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

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
    if (window.confirm(`Kill strategy "${strategyName}"? This will stop all trading.`)) {
      setLiveData(prev => {
        const updated = { ...prev };
        delete updated[strategyId];
        return updated;
      });
      onRemoveStrategy?.(strategyId);
    }
  };

  const activeStrategies = deployedStrategies.filter(s => liveData[s.id] !== undefined);

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

  const content = (
    <div className="h-full flex flex-col bg-[#0b0b0b]">
      {/* Premium Summary Bar */}
      {activeStrategies.length > 0 && (
        <div className="flex items-center justify-end gap-6 px-4 py-3 border-b border-[#1f1f1f] bg-gradient-to-r from-[#0f0f14] to-[#0d0d12]">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/50 uppercase tracking-wider">Total P&L:</span>
            <span className={`font-bold tabular-nums ${isPositiveTotal ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositiveTotal ? '+' : ''}${totals.pnl.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/50 uppercase tracking-wider">Trades:</span>
            <span className="text-white font-semibold tabular-nums">{totals.trades}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-white/50 uppercase tracking-wider">Avg Win:</span>
            <span className="text-emerald-400 font-semibold tabular-nums">{avgWinRate.toFixed(1)}%</span>
          </div>
        </div>
      )}

      {/* Strategy Cards */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-hide">
        {activeStrategies.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12">
            <div className="w-16 h-16 rounded-2xl bg-[#1e1e2d] flex items-center justify-center mb-4">
              <span className="text-3xl">🚀</span>
            </div>
            <p className="text-gray-400 font-medium mb-1">No deployed strategies</p>
            <p className="text-xs text-gray-600">Build and deploy from the Strategy Builder</p>
          </div>
        ) : (
          activeStrategies.map((strategy) => {
            const live = liveData[strategy.id] || { pnl: 0, trades: 0, winRate: 60 };
            const isPositive = live.pnl >= 0;
            const isPaused = pausedStrategies[strategy.id];

            return (
              <div 
                key={strategy.id}
                className={`group relative bg-[#111111] border rounded-xl p-4 transition-all duration-300 hover:bg-[#12121a] ${
                  isPaused 
                    ? 'border-amber-500/40 hover:border-amber-500/60' 
                    : 'border-[#1f1f1f] hover:border-emerald-500/40'
                }`}
              >
                {/* Glow effect on hover */}
                <div className={`absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${
                  isPaused ? 'bg-amber-500/5' : 'bg-emerald-500/5'
                }`} />
                
                <div className="relative flex items-center justify-between">
                  {/* Left: Status + Name */}
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className={`w-3 h-3 rounded-full ${
                        isPaused ? 'bg-amber-400' : 'bg-emerald-400'
                      }`} />
                      {!isPaused && (
                        <div className="absolute inset-0 w-3 h-3 rounded-full bg-emerald-400 animate-ping opacity-50" />
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{strategy.name}</div>
                      <div className={`text-xs font-medium ${isPaused ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {isPaused ? '⏸ Paused' : '● Running'}
                      </div>
                    </div>
                  </div>

                  {/* Middle: Runtime */}
                  <div className="text-center">
                    <div className="text-[10px] text-white/50 uppercase tracking-wider">Runtime</div>
                    <div className="text-sm text-white font-mono tabular-nums">
                      {formatElapsedTime(strategy.deployedAt || Date.now())}
                    </div>
                  </div>

                  {/* Right: Stats */}
                  <div className="flex items-center gap-6">
                    <StatBadge 
                      label="P&L" 
                      value={`${isPositive ? '+' : ''}$${live.pnl.toFixed(2)}`}
                      color={isPositive ? 'green' : 'red'}
                    />
                    <StatBadge label="Trades" value={live.trades} />
                    <StatBadge 
                      label="Win Rate" 
                      value={`${live.winRate.toFixed(1)}%`}
                      color="green"
                    />

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 ml-2">
                      <button 
                        onClick={() => handlePause(strategy.id)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                          isPaused 
                            ? 'text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300' 
                            : 'text-amber-400 hover:bg-amber-500/10 hover:text-amber-300'
                        }`}
                      >
                        {isPaused ? 'RESUME' : 'PAUSE'}
                      </button>
                      <button 
                        onClick={() => handleKill(strategy.id, strategy.name)}
                        className="px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg transition-all"
                      >
                        KILL
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  if (embedded) return content;

  return (
    <div className="flex flex-col bg-[#0b0b0b] border-t border-[#1f1f1f] h-full">
      <div className="h-10 flex items-center justify-between px-4 border-b border-[#1f1f1f] bg-[#111111]">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-50" />
          </div>
          <span className="text-sm font-semibold text-white">Deployed Strategies</span>
          <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-500/20 text-emerald-400 rounded-full">
            {activeStrategies.length} active
          </span>
        </div>
      </div>
      {content}
    </div>
  );
}
