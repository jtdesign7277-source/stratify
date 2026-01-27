import { useState, useMemo, useEffect } from 'react';

const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '--';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);
};

const formatPercent = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '--';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

// Standard Mouse Arrow Cursor Component
const AnimatedCursor = ({ visible, clicking }) => {
  if (!visible) return null;
  
  return (
    <div 
      className={`absolute z-50 pointer-events-none transition-all duration-[1500ms] ease-in-out`}
      style={{
        top: clicking ? '8px' : '-30px',
        left: '50%',
        transform: clicking ? 'scale(0.9) translateX(-50%)' : 'translateX(-50%)',
      }}
    >
      <svg 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="none"
        className={`drop-shadow-xl transition-transform duration-100 ${clicking ? 'translate-y-0.5' : ''}`}
      >
        <path 
          d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.48 0 .72-.58.38-.92L6.35 2.85a.5.5 0 0 0-.85.36Z"
          fill="white"
          stroke="#000"
          strokeWidth="1.5"
        />
      </svg>
      {clicking && (
        <div className="absolute top-2 left-1 w-4 h-4 rounded-full animate-ping bg-purple-400/60" />
      )}
    </div>
  );
};

// Quantum Brain Animation Component
const QuantumBrainAnimation = ({ isThinking }) => {
  const particlePositions = [
    { left: '25%', top: '30%' }, { left: '70%', top: '25%' },
    { left: '35%', top: '65%' }, { left: '60%', top: '70%' },
    { left: '45%', top: '40%' }, { left: '55%', top: '55%' },
    { left: '30%', top: '50%' }, { left: '65%', top: '45%' },
  ];

  return (
    <div className="flex flex-col items-center justify-center py-8 mt-4 border-t border-white/5">
      <style>{`
        @keyframes quantumPulse { 0%, 100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.15); opacity: 1; } }
        @keyframes quantumRotate { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes quantumOrbit { 0% { transform: rotate(0deg) translateX(40px) rotate(0deg); } 100% { transform: rotate(360deg) translateX(40px) rotate(-360deg); } }
        @keyframes quantumOrbit2 { 0% { transform: rotate(120deg) translateX(50px) rotate(-120deg); } 100% { transform: rotate(480deg) translateX(50px) rotate(-480deg); } }
        @keyframes quantumOrbit3 { 0% { transform: rotate(240deg) translateX(35px) rotate(-240deg); } 100% { transform: rotate(600deg) translateX(35px) rotate(-600deg); } }
        @keyframes neuralPulse { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.8; } }
        @keyframes particleFloat { 0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; } 25% { transform: translateY(-10px) translateX(5px); opacity: 0.8; } 50% { transform: translateY(-5px) translateX(-5px); opacity: 0.5; } 75% { transform: translateY(-15px) translateX(3px); opacity: 0.9; } }
      `}</style>
      <div className="relative w-32 h-32">
        <div className={`absolute inset-0 bg-gradient-to-r from-purple-500/30 via-blue-500/30 to-cyan-500/30 rounded-full blur-2xl ${isThinking ? '' : 'opacity-40'}`} style={isThinking ? { animation: 'quantumPulse 3s ease-in-out infinite' } : {}} />
        <div className="absolute inset-2 border border-purple-500/30 rounded-full" style={isThinking ? { animation: 'quantumRotate 8s linear infinite' } : {}} />
        <div className="absolute inset-4 border border-blue-500/20 rounded-full" style={isThinking ? { animation: 'quantumRotate 12s linear infinite reverse' } : {}} />
        <div className="absolute inset-6 border border-cyan-500/20 rounded-full" style={isThinking ? { animation: 'quantumRotate 6s linear infinite' } : {}} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="absolute w-2 h-2 bg-purple-400 rounded-full shadow-lg shadow-purple-500/50" style={isThinking ? { animation: 'quantumOrbit 3s linear infinite' } : { transform: 'translateX(40px)' }} />
          <div className="absolute w-1.5 h-1.5 bg-blue-400 rounded-full shadow-lg shadow-blue-500/50" style={isThinking ? { animation: 'quantumOrbit2 4s linear infinite' } : { transform: 'rotate(120deg) translateX(50px)' }} />
          <div className="absolute w-2 h-2 bg-cyan-400 rounded-full shadow-lg shadow-cyan-500/50" style={isThinking ? { animation: 'quantumOrbit3 2.5s linear infinite' } : { transform: 'rotate(240deg) translateX(35px)' }} />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-purple-600/40 to-blue-600/40 border border-purple-400/50 flex items-center justify-center backdrop-blur-sm ${isThinking ? '' : 'opacity-70'}`} style={isThinking ? { animation: 'quantumPulse 2s ease-in-out infinite' } : {}}>
            <svg className="w-6 h-6 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
        </div>
        {particlePositions.map((pos, i) => (
          <div key={i} className={`absolute w-1 h-1 bg-white rounded-full ${isThinking ? '' : 'opacity-30'}`} style={isThinking ? { left: pos.left, top: pos.top, animation: `particleFloat ${2 + (i % 3)}s ease-in-out infinite`, animationDelay: `${i * 0.3}s` } : { left: pos.left, top: pos.top }} />
        ))}
      </div>
      <div className="flex items-center gap-2 mt-6">
        {[...Array(12)].map((_, i) => (
          <div key={i} className={`w-0.5 bg-gradient-to-t from-transparent via-purple-500/60 to-transparent rounded-full ${isThinking ? '' : 'opacity-40'}`} style={isThinking ? { height: `${15 + Math.sin(i * 0.8) * 10}px`, animation: 'neuralPulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.1}s` } : { height: `${15 + Math.sin(i * 0.8) * 10}px` }} />
        ))}
      </div>
      <div className="text-center mt-4">
        <p className={`text-xs font-medium tracking-wider uppercase ${isThinking ? 'text-purple-400/80' : 'text-purple-400/50'}`}>
          {isThinking ? 'Neural Processing Active' : 'Neural Processing Idle'}
        </p>
      </div>
    </div>
  );
};

export default function DataTable({ activeTab, alpacaData, strategies = [], demoState = 'idle', theme, themeClasses, onDeleteStrategy, onDeployStrategy, autoBacktestStrategy }) {
  const [sortColumn, setSortColumn] = useState('symbol');
  const [sortDirection, setSortDirection] = useState('asc');
  const [selectedRow, setSelectedRow] = useState(null);
  const [expandedStrategy, setExpandedStrategy] = useState(null);
  const [backtestingId, setBacktestingId] = useState(null);
  const [backtestProgress, setBacktestProgress] = useState(0);
  const [cursorPhase, setCursorPhase] = useState('idle'); // idle, moving-backtest, clicking-backtest, moving-deploy, clicking-deploy
  const [showDeployCursor, setShowDeployCursor] = useState(false);

  // Handle auto backtest trigger from parent
  useEffect(() => {
    if (autoBacktestStrategy) {
      // Start cursor animation to backtest
      setCursorPhase('moving-backtest');
      setExpandedStrategy(autoBacktestStrategy.id);
      
      // After cursor moves, click
      setTimeout(() => {
        setCursorPhase('clicking-backtest');
        setBacktestingId(autoBacktestStrategy.id);
        setBacktestProgress(0);
        
        setTimeout(() => {
          setCursorPhase('idle');
        }, 300);
      }, 1500);
    }
  }, [autoBacktestStrategy]);

  // Backtest progress animation - slower for better visibility
  useEffect(() => {
    if (!backtestingId) return;
    
    const interval = setInterval(() => {
      setBacktestProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          // After backtest complete, start deploy cursor animation
          setTimeout(() => {
            setShowDeployCursor(true);
            setCursorPhase('moving-deploy');
            
            setTimeout(() => {
              setCursorPhase('clicking-deploy');
              
              setTimeout(() => {
                // Deploy the strategy
                const strategy = strategies.find(s => s.id === backtestingId);
                if (strategy && onDeployStrategy) {
                  onDeployStrategy(strategy);
                }
                setCursorPhase('idle');
                setShowDeployCursor(false);
                setExpandedStrategy(null);
                setBacktestingId(null);
                setBacktestProgress(0);
                
                // Reset right panel demo after deploy
                setTimeout(() => {
                  if (window.resetRightPanelDemo) {
                    window.resetRightPanelDemo();
                  }
                }, 3000);
              }, 400);
            }, 2000);
          }, 1500);
          return 100;
        }
        return prev + 2; // Slower increment
      });
    }, 120); // Slower interval

    return () => clearInterval(interval);
  }, [backtestingId, strategies, onDeployStrategy]);

  const columnConfigs = {
    positions: [
      { key: 'symbol', label: 'Symbol', align: 'left' },
      { key: 'qty', label: 'Position', align: 'right' },
      { key: 'current_price', label: 'Last', align: 'right' },
      { key: 'unrealized_pl', label: 'Daily P&L', align: 'right', colored: true },
      { key: 'unrealized_plpc', label: 'P&L %', align: 'right', colored: true },
      { key: 'avg_entry_price', label: 'Avg Price', align: 'right' },
      { key: 'market_value', label: 'Market Value', align: 'right' },
    ],
    orders: [
      { key: 'symbol', label: 'Symbol', align: 'left' },
      { key: 'side', label: 'Side', align: 'left' },
      { key: 'qty', label: 'Qty', align: 'right' },
      { key: 'type', label: 'Type', align: 'left' },
      { key: 'status', label: 'Status', align: 'left' },
    ],
    trades: [
      { key: 'symbol', label: 'Symbol', align: 'left' },
      { key: 'side', label: 'Side', align: 'left' },
      { key: 'qty', label: 'Qty', align: 'right' },
      { key: 'price', label: 'Price', align: 'right' },
    ],
    balances: [
      { key: 'type', label: 'Type', align: 'left' },
      { key: 'currency', label: 'Currency', align: 'left' },
      { key: 'amount', label: 'Amount', align: 'right' },
    ],
  };

  const columns = columnConfigs[activeTab] || columnConfigs.positions;

  const getData = () => {
    switch (activeTab) {
      case 'positions': return alpacaData?.positions || [];
      case 'orders': return alpacaData?.orders || [];
      case 'trades': return alpacaData?.trades || [];
      case 'balances': 
        const account = alpacaData?.account || {};
        return [{ type: 'USD CASH', currency: 'USD', amount: account.cash }];
      default: return [];
    }
  };

  const sortedData = useMemo(() => {
    const data = getData();
    return [...data].sort((a, b) => {
      const aVal = a[sortColumn], bVal = b[sortColumn];
      if (aVal === bVal) return 0;
      const comparison = aVal < bVal ? -1 : 1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [activeTab, alpacaData, sortColumn, sortDirection]);

  const handleSort = (column) => {
    if (sortColumn === column) setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    else { setSortColumn(column); setSortDirection('asc'); }
  };

  const getValueColor = (value) => {
    if (value === null || value === undefined) return themeClasses.text;
    const num = parseFloat(value);
    if (num > 0) return 'text-emerald-400';
    if (num < 0) return 'text-red-400';
    return themeClasses.text;
  };

  const renderCell = (row, col) => {
    const value = row[col.key];
    if (col.key === 'current_price' || col.key === 'avg_entry_price' || col.key === 'price' || col.key === 'market_value' || col.key === 'amount') return formatCurrency(value);
    if (col.key === 'unrealized_plpc') return formatPercent(parseFloat(value) * 100);
    if (col.key === 'unrealized_pl') return formatCurrency(value);
    if (col.key === 'side') return <span className={value === 'buy' ? 'text-emerald-400' : 'text-red-400'}>{value?.toUpperCase()}</span>;
    if (col.key === 'status') return <span className={value === 'filled' ? 'text-emerald-400' : 'text-cyan-400'}>{value?.toUpperCase()}</span>;
    return value ?? '--';
  };

  // Strategies Tab View
  if (activeTab === 'strategies') {
    // Show all strategies (both draft and deployed can be modified)
    const allStrategies = strategies;
    
    return (
      <div className="flex-1 overflow-auto p-4 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <div className="grid gap-2">
          {allStrategies.map((strategy) => {
            const isExpanded = expandedStrategy === strategy.id;
            const isBacktesting = backtestingId === strategy.id;
            const backtestComplete = isBacktesting && backtestProgress >= 100;
            const showBacktestCursor = cursorPhase === 'moving-backtest' || cursorPhase === 'clicking-backtest';
            const isClickingBacktest = cursorPhase === 'clicking-backtest';

            return (
              <div key={strategy.id} className={`bg-[#1A1A1A] border rounded-lg transition-all ${isExpanded ? 'border-purple-500/50' : 'border-[#2A2A2A] hover:border-purple-500/30'}`}>
                {/* Strategy Row */}
                <div className="flex items-center justify-between gap-4 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="text-sm font-medium text-white truncate">{strategy.name}</h3>
                    <span className={`px-1.5 py-0.5 text-[10px] rounded-full flex-shrink-0 ${
                      strategy.status === 'deployed' 
                        ? 'bg-emerald-500/20 text-emerald-400' 
                        : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {strategy.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 relative">
                    <button 
                      className={`text-purple-400 text-xs font-medium transition-colors px-2 py-1 rounded ${
                        isClickingBacktest && strategy.id === autoBacktestStrategy?.id
                          ? 'bg-purple-500 text-white scale-95'
                          : 'hover:text-purple-300 hover:bg-purple-500/10'
                      }`}
                    >
                      Backtest
                    </button>
                    {showBacktestCursor && strategy.id === autoBacktestStrategy?.id && (
                      <AnimatedCursor 
                        visible={true} 
                        clicking={isClickingBacktest}
                      />
                    )}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteStrategy?.(strategy.id);
                      }}
                      className="text-gray-500 hover:text-red-400 transition-colors p-0.5 hover:bg-red-500/10 rounded"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Expanded Backtest Results */}
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-[#2A2A2A] mt-1 pt-3">
                    {isBacktesting && !backtestComplete && (
                      <div className="flex items-center justify-center gap-3 py-4">
                        <svg className="w-5 h-5 animate-spin text-purple-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                        </svg>
                        <span className="text-sm text-purple-400">Running Backtest... {backtestProgress}%</span>
                      </div>
                    )}

                    {backtestComplete && (
                      <>
                        <div className="flex items-center gap-2 mb-3">
                          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-xs font-medium text-emerald-400">Backtest Complete</span>
                        </div>

                        <div className="grid grid-cols-4 gap-2 mb-3">
                          <div className="bg-[#0D0D0D] rounded p-2 border border-[#2A2A2A]">
                            <div className="text-[10px] text-gray-500 mb-0.5">Win Rate</div>
                            <div className="text-sm font-semibold text-emerald-400">{strategy.metrics.winRate}%</div>
                          </div>
                          <div className="bg-[#0D0D0D] rounded p-2 border border-[#2A2A2A]">
                            <div className="text-[10px] text-gray-500 mb-0.5">Profit Factor</div>
                            <div className="text-sm font-semibold text-blue-400">{strategy.metrics.profitFactor}</div>
                          </div>
                          <div className="bg-[#0D0D0D] rounded p-2 border border-[#2A2A2A]">
                            <div className="text-[10px] text-gray-500 mb-0.5">Sharpe Ratio</div>
                            <div className="text-sm font-semibold text-purple-400">{strategy.metrics.sharpeRatio}</div>
                          </div>
                          <div className="bg-[#0D0D0D] rounded p-2 border border-[#2A2A2A]">
                            <div className="text-[10px] text-gray-500 mb-0.5">Max Drawdown</div>
                            <div className="text-sm font-semibold text-orange-400">-{strategy.metrics.maxDrawdown}%</div>
                          </div>
                        </div>

                        <div className="flex justify-center relative">
                          <button 
                            className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 transition-all ${
                              cursorPhase === 'clicking-deploy'
                                ? 'bg-emerald-500 text-white scale-95'
                                : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            Deploy Strategy
                          </button>
                          {showDeployCursor && (
                            <AnimatedCursor 
                              visible={true} 
                              clicking={cursorPhase === 'clicking-deploy'}
                            />
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <QuantumBrainAnimation isThinking={demoState === 'thinking'} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full">
        <thead className={`sticky top-0 ${themeClasses.surfaceElevated}`}>
          <tr>
            {columns.map((col) => (
              <th key={col.key} onClick={() => handleSort(col.key)} className={`px-4 py-3 text-xs font-medium uppercase tracking-wider cursor-pointer hover:bg-[#2A2A2A] ${themeClasses.textMuted} ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                <div className={`flex items-center gap-1 ${col.align === 'right' ? 'justify-end' : ''}`}>
                  {col.label}
                  {sortColumn === col.key && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={sortDirection === 'asc' ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} /></svg>}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.length === 0 ? (
            <tr><td colSpan={columns.length} className={`px-4 py-16 text-center ${themeClasses.textMuted}`}>No {activeTab} to display</td></tr>
          ) : (
            sortedData.map((row, index) => (
              <tr key={row.symbol || index} onClick={() => setSelectedRow(index)} className={`border-b border-[#1A1A1A] cursor-pointer ${selectedRow === index ? 'bg-[#252525] border-l-2 border-l-emerald-500' : 'hover:bg-[#1E1E1E]'}`}>
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 text-sm font-mono ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.colored ? getValueColor(row[col.key]) : themeClasses.text}`}>{renderCell(row, col)}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
