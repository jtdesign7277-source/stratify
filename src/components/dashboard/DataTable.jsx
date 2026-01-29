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

// Sparkline animation component for backtest progress
const BacktestSparkline = ({ progress }) => {
  const points = useMemo(() => {
    const pts = [];
    const numPoints = 20;
    for (let i = 0; i < numPoints; i++) {
      const x = (i / (numPoints - 1)) * 100;
      const activePoint = (progress / 100) * numPoints;
      if (i <= activePoint) {
        const y = 50 + Math.sin(i * 0.8 + progress * 0.1) * 30 + Math.random() * 10;
        pts.push(`${x},${Math.max(10, Math.min(90, y))}`);
      }
    }
    return pts.join(' ');
  }, [progress]);

  return (
    <svg className="w-full h-8" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.8" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke="url(#sparkGradient)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        className="drop-shadow-lg"
      />
    </svg>
  );
};

// Results Panel Component
// Info tooltip component
const InfoTooltip = ({ text }) => (
  <div className="group relative inline-flex ml-1">
    <svg className="w-3 h-3 text-gray-500 hover:text-gray-300 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
      <path strokeLinecap="round" strokeWidth="1.5" d="M12 16v-4m0-4h.01" />
    </svg>
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#2d2d2d] border border-[#3c4043] rounded-lg text-xs text-gray-300 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-xl">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#3c4043]" />
    </div>
  </div>
);

const BacktestResultsPanel = ({ results, onDeploy, onClose, strategy }) => {
  const [collapsed, setCollapsed] = useState(false);
  
  if (!results) return null;
  
  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="flex items-center gap-1 px-2 py-1 bg-purple-500/20 text-purple-400 text-[10px] rounded hover:bg-purple-500/30 transition-colors"
        title="Show Results"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Results
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-[#202124] border border-[#3c4043] rounded-lg">
      <div className="flex items-center gap-4 text-xs">
        <div className="text-center">
          <div className="text-gray-500">Win</div>
          <div className="text-amber-400 font-medium">{results.winRate}%</div>
        </div>
        <div className="text-center">
          <div className="text-gray-500 flex items-center justify-center">
            Sharpe
            <InfoTooltip text="Sharpe Ratio measures risk-adjusted return. Higher = better returns per unit of risk. 1-2 is solid, 2+ is very good." />
          </div>
          <div className="text-amber-400 font-medium">{results.sharpeRatio}</div>
        </div>
        <div className="text-center">
          <div className="text-gray-500 flex items-center justify-center">
            DD
            <InfoTooltip text="Max Drawdown is the largest peak-to-trough decline. Shows the worst-case loss you'd have experienced. Lower is better." />
          </div>
          <div className="text-emerald-400 font-medium">-{results.maxDrawdown}%</div>
        </div>
      </div>
      <button
        onClick={onDeploy}
        className="px-2 py-1 text-emerald-400 hover:text-emerald-300 text-xs font-medium transition-colors"
      >
        Deploy
      </button>
      <button
        onClick={() => setCollapsed(true)}
        className="text-gray-500 hover:text-gray-300 p-0.5"
        title="Collapse"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  );
};

export default function DataTable({ activeTab, alpacaData, strategies = [], demoState = 'idle', theme, themeClasses, onDeleteStrategy, onDeployStrategy, onEditStrategy, onSaveToSidebar, savedStrategies = [], autoBacktestStrategy, onUpdateStrategy }) {
  const [sortColumn, setSortColumn] = useState('symbol');
  const [sortDirection, setSortDirection] = useState('asc');
  const [selectedRow, setSelectedRow] = useState(null);
  const [expandedStrategy, setExpandedStrategy] = useState(null);
  const [backtestingId, setBacktestingId] = useState(null);
  const [backtestProgress, setBacktestProgress] = useState(0);
  const [backtestResults, setBacktestResults] = useState({}); // Store results by strategy ID
  const [cursorPhase, setCursorPhase] = useState('idle');
  const [showDeployCursor, setShowDeployCursor] = useState(false);
  
  // Edit mode state
  const [editingStrategyId, setEditingStrategyId] = useState(null);
  const [editParams, setEditParams] = useState({
    stopLoss: -5,
    takeProfit: 10,
    positionSize: 2,
    trailingStop: 3
  });
  const [editBacktestRunning, setEditBacktestRunning] = useState(false);
  const [editBacktestProgress, setEditBacktestProgress] = useState(0);
  const [editBacktestResults, setEditBacktestResults] = useState(null);

  // Run backtest on a strategy
  const runBacktest = (strategyId) => {
    setBacktestingId(strategyId);
    setBacktestProgress(0);
  };

  // Backtest progress animation
  useEffect(() => {
    if (!backtestingId) return;
    
    const interval = setInterval(() => {
      setBacktestProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          // Generate results
          setBacktestResults(prevResults => ({
            ...prevResults,
            [backtestingId]: {
              winRate: (55 + Math.random() * 25).toFixed(1),
              profitFactor: (1.2 + Math.random() * 1.0).toFixed(2),
              sharpeRatio: (1.0 + Math.random() * 1.5).toFixed(2),
              maxDrawdown: (5 + Math.random() * 15).toFixed(1),
              totalReturn: (10 + Math.random() * 40).toFixed(1),
              trades: Math.floor(50 + Math.random() * 150)
            }
          }));
          setBacktestingId(null);
          return 100;
        }
        return prev + 2;
      });
    }, 30);

    return () => clearInterval(interval);
  }, [backtestingId]);

  // Start editing a strategy
  const startEditing = (strategy) => {
    setEditingStrategyId(strategy.id);
    setExpandedStrategy(strategy.id);
    // Initialize params from strategy or defaults
    setEditParams({
      stopLoss: strategy.riskParams?.stopLoss ?? -5,
      takeProfit: strategy.riskParams?.takeProfit ?? 10,
      positionSize: strategy.riskParams?.positionSize ?? 2,
      trailingStop: strategy.riskParams?.trailingStop ?? 3
    });
    setEditBacktestResults(null);
  };

  // Run backtest with edited params
  const runEditBacktest = (strategyId) => {
    setEditBacktestRunning(true);
    setEditBacktestProgress(0);
  };

  // Backtest progress for edit mode
  useEffect(() => {
    if (!editBacktestRunning) return;
    
    const interval = setInterval(() => {
      setEditBacktestProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setEditBacktestRunning(false);
          // Generate new mock results based on params
          const baseWinRate = 60 + Math.random() * 15;
          const stopLossImpact = Math.abs(editParams.stopLoss) < 3 ? -5 : Math.abs(editParams.stopLoss) > 8 ? 3 : 0;
          const takeProfitImpact = editParams.takeProfit > 15 ? -3 : editParams.takeProfit < 5 ? 2 : 0;
          setEditBacktestResults({
            winRate: (baseWinRate + stopLossImpact + takeProfitImpact).toFixed(1),
            profitFactor: (1.5 + Math.random() * 0.8).toFixed(2),
            sharpeRatio: (1.2 + Math.random() * 0.9).toFixed(2),
            maxDrawdown: (8 + Math.random() * 10).toFixed(1)
          });
          return 100;
        }
        return prev + 4;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [editBacktestRunning, editParams]);

  // Confirm edit and save
  const confirmEdit = (strategy) => {
    if (onUpdateStrategy && editBacktestResults) {
      onUpdateStrategy(strategy.id, {
        riskParams: { ...editParams },
        metrics: editBacktestResults
      });
    }
    setEditingStrategyId(null);
    setEditBacktestResults(null);
  };

  // Cancel edit
  const cancelEdit = () => {
    setEditingStrategyId(null);
    setEditBacktestResults(null);
  };

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
              <div key={strategy.id} className={`bg-[#303134] border rounded-lg transition-all ${isExpanded ? 'border-purple-500/50' : 'border-[#5f6368] hover:border-purple-500/30'}`}>
                {/* Strategy Row */}
                <div className="flex items-center justify-between gap-4 px-3 py-2">
                  {/* Left: Dropdown toggle + Name + Status */}
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      onClick={() => setExpandedStrategy(isExpanded ? null : strategy.id)}
                      className="text-gray-400 hover:text-white transition-colors p-0.5"
                    >
                      <svg 
                        className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <h3 className="text-sm font-medium text-white truncate">{strategy.name}</h3>
                    <span className={`text-[10px] flex-shrink-0 ${
                      strategy.status === 'deployed' 
                        ? 'text-emerald-400' 
                        : 'text-gray-500'
                    }`}>
                      {strategy.status}
                    </span>
                  </div>

                  {/* Right: Action buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0 relative">
                    <button 
                      onClick={() => startEditing(strategy)}
                      className={`text-xs font-medium transition-colors ${
                        editingStrategyId === strategy.id 
                          ? 'text-cyan-400' 
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Edit
                    </button>
                    
                    {/* Backtest button or progress */}
                    {isBacktesting ? (
                      <div className="flex items-center gap-2 px-2 py-1 bg-purple-500/10 rounded">
                        <div className="w-20">
                          <BacktestSparkline progress={backtestProgress} />
                        </div>
                        <span className="text-purple-400 text-xs font-mono">{backtestProgress}%</span>
                      </div>
                    ) : (
                      <button 
                        onClick={() => runBacktest(strategy.id)}
                        className={`text-purple-400 text-xs font-light transition-colors px-2 py-1 rounded ${
                          isClickingBacktest && strategy.id === autoBacktestStrategy?.id
                            ? 'bg-purple-500 text-white scale-95'
                            : 'hover:text-purple-300 hover:bg-purple-500/10'
                        }`}
                      >
                        Backtest
                      </button>
                    )}
                    
                    {showBacktestCursor && strategy.id === autoBacktestStrategy?.id && (
                      <AnimatedCursor 
                        visible={true} 
                        clicking={isClickingBacktest}
                      />
                    )}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onSaveToSidebar?.(strategy);
                        onDeleteStrategy?.(strategy.id);
                      }}
                      className="text-emerald-400 hover:text-emerald-300 transition-colors px-1.5 py-0.5 rounded hover:bg-emerald-500/10 text-[10px] font-light"
                      title="Save to Strategies"
                    >
                      Save
                    </button>
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
                    
                    {/* Results Panel - appears after backtest completes */}
                    {backtestResults[strategy.id] && (
                      <BacktestResultsPanel 
                        results={backtestResults[strategy.id]}
                        strategy={strategy}
                        onDeploy={() => {
                          onDeployStrategy?.(strategy);
                          setBacktestResults(prev => {
                            const updated = { ...prev };
                            delete updated[strategy.id];
                            return updated;
                          });
                        }}
                        onClose={() => {
                          setBacktestResults(prev => {
                            const updated = { ...prev };
                            delete updated[strategy.id];
                            return updated;
                          });
                        }}
                      />
                    )}
                  </div>
                </div>

                {/* Expanded Section - Stats & Code */}
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-[#5f6368] mt-1 pt-3">
                    
                    {/* Edit Mode Panel */}
                    {editingStrategyId === strategy.id && (
                      <div className="mb-3">
                        {/* Risk Level Presets */}
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-[10px] text-gray-400">Risk Level:</span>
                          <button
                            onClick={() => setEditParams({ stopLoss: -2, takeProfit: 5, positionSize: 1, trailingStop: 2 })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              editParams.stopLoss === -2 && editParams.takeProfit === 5
                                ? 'bg-emerald-500/30 text-emerald-400 border border-emerald-500/50'
                                : 'bg-[#202124] text-gray-400 border border-[#5f6368] hover:border-emerald-500/50'
                            }`}
                          >
                            🛡️ Safe
                          </button>
                          <button
                            onClick={() => setEditParams({ stopLoss: -5, takeProfit: 10, positionSize: 2, trailingStop: 3 })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              editParams.stopLoss === -5 && editParams.takeProfit === 10
                                ? 'bg-amber-500/30 text-amber-400 border border-amber-500/50'
                                : 'bg-[#202124] text-gray-400 border border-[#5f6368] hover:border-amber-500/50'
                            }`}
                          >
                            ⚖️ Balanced
                          </button>
                          <button
                            onClick={() => setEditParams({ stopLoss: -10, takeProfit: 20, positionSize: 5, trailingStop: 5 })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              editParams.stopLoss === -10 && editParams.takeProfit === 20
                                ? 'bg-red-500/30 text-red-400 border border-red-500/50'
                                : 'bg-[#202124] text-gray-400 border border-[#5f6368] hover:border-red-500/50'
                            }`}
                          >
                            🚀 Aggressive
                          </button>
                          <span className="text-[10px] text-gray-600 ml-2">or customize below</span>
                        </div>

                        <div className="flex items-center gap-4 mb-3">
                          <span className="text-[10px] text-cyan-400 font-medium">Fine-tune</span>
                          
                          {/* Compact inline inputs with better labels */}
                          <div className="flex items-center gap-3 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-gray-500" title="Maximum loss per trade">Max Loss</span>
                              <input
                                type="number"
                                value={editParams.stopLoss}
                                onChange={(e) => setEditParams(prev => ({ ...prev, stopLoss: parseFloat(e.target.value) || 0 }))}
                                className="w-14 bg-[#202124] border border-[#5f6368] rounded px-1.5 py-1 text-xs text-white font-mono focus:border-white/50 focus:outline-none text-center"
                                step="0.5"
                                max="0"
                              />
                              <span className="text-[10px] text-gray-500">%</span>
                            </div>
                            
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-gray-500" title="Target profit to take">Target</span>
                              <input
                                type="number"
                                value={editParams.takeProfit}
                                onChange={(e) => setEditParams(prev => ({ ...prev, takeProfit: parseFloat(e.target.value) || 0 }))}
                                className="w-14 bg-[#202124] border border-[#5f6368] rounded px-1.5 py-1 text-xs text-white font-mono focus:border-white/50 focus:outline-none text-center"
                                step="0.5"
                                min="0"
                              />
                              <span className="text-[10px] text-gray-500">%</span>
                            </div>
                            
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-gray-500" title="Percentage of portfolio per trade">Trade Size</span>
                              <input
                                type="number"
                                value={editParams.positionSize}
                                onChange={(e) => setEditParams(prev => ({ ...prev, positionSize: parseFloat(e.target.value) || 0 }))}
                                className="w-14 bg-[#202124] border border-[#5f6368] rounded px-1.5 py-1 text-xs text-white font-mono focus:border-white/50 focus:outline-none text-center"
                                step="0.5"
                                min="0.5"
                                max="100"
                              />
                              <span className="text-[10px] text-gray-500">%</span>
                            </div>
                            
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-gray-500" title="Lock in profits as price rises">Lock Profits</span>
                              <input
                                type="number"
                                value={editParams.trailingStop}
                                onChange={(e) => setEditParams(prev => ({ ...prev, trailingStop: parseFloat(e.target.value) || 0 }))}
                                className="w-14 bg-[#202124] border border-[#5f6368] rounded px-1.5 py-1 text-xs text-white font-mono focus:border-white/50 focus:outline-none text-center"
                                step="0.5"
                                min="0"
                              />
                              <span className="text-[10px] text-gray-500">%</span>
                            </div>
                          </div>
                        </div>

                        {/* Edit Backtest Progress */}
                        {editBacktestRunning && (
                          <div className="flex items-center justify-center gap-3 py-3 mb-3 bg-[#202124] rounded-lg border border-purple-500/30">
                            <svg className="w-4 h-4 animate-spin text-purple-400" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                            </svg>
                            <span className="text-sm text-purple-400">Running Backtest... {editBacktestProgress}%</span>
                          </div>
                        )}

                        {/* Edit Backtest Results */}
                        {editBacktestResults && !editBacktestRunning && (
                          <div className="mb-3">
                            <div className="text-xs text-emerald-400 font-medium mb-2 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              New Backtest Results
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                              <div className="bg-[#202124] rounded p-2 border border-emerald-500/30">
                                <div className="text-[10px] text-gray-500 mb-0.5">Win Rate</div>
                                <div className="text-sm font-semibold text-emerald-400">{editBacktestResults.winRate}%</div>
                              </div>
                              <div className="bg-[#202124] rounded p-2 border border-emerald-500/30">
                                <div className="text-[10px] text-gray-500 mb-0.5">Profit Factor</div>
                                <div className="text-sm font-semibold text-blue-400">{editBacktestResults.profitFactor}</div>
                              </div>
                              <div className="bg-[#202124] rounded p-2 border border-emerald-500/30">
                                <div className="text-[10px] text-gray-500 mb-0.5">Sharpe Ratio</div>
                                <div className="text-sm font-semibold text-purple-400">{editBacktestResults.sharpeRatio}</div>
                              </div>
                              <div className="bg-[#202124] rounded p-2 border border-emerald-500/30">
                                <div className="text-[10px] text-gray-500 mb-0.5">Max Drawdown</div>
                                <div className="text-sm font-semibold text-orange-400">-{editBacktestResults.maxDrawdown}%</div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Edit Action Buttons */}
                        <div className="flex items-center justify-center gap-3">
                          {!editBacktestResults ? (
                            <>
                              <button
                                onClick={() => runEditBacktest(strategy.id)}
                                disabled={editBacktestRunning}
                                className="text-sm font-light text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                Backtest
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="text-sm font-medium text-gray-500 hover:text-gray-400 transition-colors"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => confirmEdit(strategy)}
                                className="text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors flex items-center gap-1.5"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                OK
                              </button>
                              <button
                                onClick={() => { setEditBacktestResults(null); }}
                                className="text-sm font-light text-purple-400 hover:text-purple-300 transition-colors"
                              >
                                Re-test
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="text-sm font-medium text-gray-500 hover:text-gray-400 transition-colors"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Backtest Progress (during auto-demo) */}
                    {isBacktesting && !backtestComplete && editingStrategyId !== strategy.id && (
                      <div className="flex items-center justify-center gap-3 py-4">
                        <svg className="w-5 h-5 animate-spin text-purple-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                        </svg>
                        <span className="text-sm text-purple-400">Running Backtest... {backtestProgress}%</span>
                      </div>
                    )}

                    {/* Always show stats if available (not just during backtest) */}
                    {strategy.metrics && !isBacktesting && editingStrategyId !== strategy.id && (
                      <>
                        <div className="text-xs text-gray-500 mb-2">Backtest Results</div>
                        <div className="grid grid-cols-4 gap-2 mb-3">
                          <div className="bg-[#202124] rounded p-2 border border-[#5f6368]">
                            <div className="text-[10px] text-gray-500 mb-0.5">Win Rate</div>
                            <div className="text-sm font-semibold text-emerald-400">{strategy.metrics.winRate}%</div>
                          </div>
                          <div className="bg-[#202124] rounded p-2 border border-[#5f6368]">
                            <div className="text-[10px] text-gray-500 mb-0.5">Profit Factor</div>
                            <div className="text-sm font-semibold text-blue-400">{strategy.metrics.profitFactor}</div>
                          </div>
                          <div className="bg-[#202124] rounded p-2 border border-[#5f6368]">
                            <div className="text-[10px] text-gray-500 mb-0.5">Sharpe Ratio</div>
                            <div className="text-sm font-semibold text-purple-400">{strategy.metrics.sharpeRatio}</div>
                          </div>
                          <div className="bg-[#202124] rounded p-2 border border-[#5f6368]">
                            <div className="text-[10px] text-gray-500 mb-0.5">Max Drawdown</div>
                            <div className="text-sm font-semibold text-orange-400">-{strategy.metrics.maxDrawdown}%</div>
                          </div>
                        </div>

                        {/* Strategy Code Preview */}
                        {strategy.code && (
                          <div className="mb-3">
                            <div className="text-xs text-gray-500 mb-2">Strategy Code</div>
                            <pre className="bg-[#202124] rounded p-3 border border-[#5f6368] text-xs text-gray-400 font-mono overflow-x-auto max-h-32 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
                              {strategy.code}
                            </pre>
                          </div>
                        )}

                        {/* Deploy button if not deployed */}
                        {strategy.status !== 'deployed' && (
                          <div className="flex justify-center relative">
                            <button 
                              onClick={() => onDeployStrategy?.(strategy)}
                              className={`px-4 py-2 text-sm font-light rounded-lg flex items-center gap-2 transition-all ${
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
                        )}
                      </>
                    )}

                    {/* During backtest completion - show complete message then stats */}
                    {backtestComplete && (
                      <>
                        <div className="flex items-center gap-2 mb-3">
                          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-xs font-medium text-emerald-400">Backtest Complete</span>
                        </div>

                        <div className="grid grid-cols-4 gap-2 mb-3">
                          <div className="bg-[#202124] rounded p-2 border border-[#5f6368]">
                            <div className="text-[10px] text-gray-500 mb-0.5">Win Rate</div>
                            <div className="text-sm font-semibold text-emerald-400">{strategy.metrics.winRate}%</div>
                          </div>
                          <div className="bg-[#202124] rounded p-2 border border-[#5f6368]">
                            <div className="text-[10px] text-gray-500 mb-0.5">Profit Factor</div>
                            <div className="text-sm font-semibold text-blue-400">{strategy.metrics.profitFactor}</div>
                          </div>
                          <div className="bg-[#202124] rounded p-2 border border-[#5f6368]">
                            <div className="text-[10px] text-gray-500 mb-0.5">Sharpe Ratio</div>
                            <div className="text-sm font-semibold text-purple-400">{strategy.metrics.sharpeRatio}</div>
                          </div>
                          <div className="bg-[#202124] rounded p-2 border border-[#5f6368]">
                            <div className="text-[10px] text-gray-500 mb-0.5">Max Drawdown</div>
                            <div className="text-sm font-semibold text-orange-400">-{strategy.metrics.maxDrawdown}%</div>
                          </div>
                        </div>

                        <div className="flex justify-center relative">
                          <button 
                            className={`px-4 py-2 text-sm font-light rounded-lg flex items-center gap-2 transition-all ${
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
              <tr key={row.symbol || index} onClick={() => setSelectedRow(index)} className={`border-b border-[#5f6368] cursor-pointer ${selectedRow === index ? 'bg-[#3c4043] border-l-2 border-l-emerald-500' : 'hover:bg-[#303134]'}`}>
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
