import { useState, useEffect, useMemo, useCallback } from 'react';

// ============== CONSTANTS & CONFIG ==============
const STRATEGY_FOLDERS = [
  { id: 'live', name: 'Live', color: '#10b981', dot: 'bg-emerald-500', count: 0 },
  { id: 'paper', name: 'Paper Trading', color: '#f59e0b', dot: 'bg-amber-500', count: 0 },
  { id: 'development', name: 'In Development', color: '#6b7280', dot: 'bg-gray-500', count: 0 },
  { id: 'backtested', name: 'Backtested', color: '#3b82f6', dot: 'bg-blue-500', count: 0 },
  { id: 'templates', name: 'Templates', color: '#a855f7', dot: 'bg-purple-500', count: 0 },
  { id: 'archived', name: 'Archived', color: '#4b5563', dot: 'bg-gray-600 opacity-50', count: 0 },
];

const WORKFLOW_TABS = [
  { id: 'overview', name: 'Overview', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'conditions', name: 'Conditions', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { id: 'execution', name: 'Execution', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
  { id: 'risk', name: 'Risk', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
  { id: 'backtest', name: 'Backtest', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
  { id: 'optimize', name: 'Optimize', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
  { id: 'deploy', name: 'Deploy', icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12' },
];

// ============== UTILITY FUNCTIONS ==============
const formatNumber = (num, decimals = 2) => {
  if (num === null || num === undefined || isNaN(num)) return '--';
  return Number(num).toFixed(decimals);
};

const formatPercent = (num) => {
  if (num === null || num === undefined || isNaN(num)) return '--';
  const sign = num >= 0 ? '+' : '';
  return `${sign}${Number(num).toFixed(2)}%`;
};

// ============== SUB-COMPONENTS ==============

// Metric Card Component
const MetricCard = ({ label, value, subValue, color = 'cyan', tooltip }) => (
  <div className="bg-[#0d0d12] border border-[#1e1e2d] rounded-lg p-3 hover:border-[#2a2a3d] transition-all group relative">
    <div className="flex items-center gap-1 mb-1">
      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">{label}</span>
      {tooltip && (
        <div className="relative">
          <svg className="w-3 h-3 text-gray-600 hover:text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
            <path strokeLinecap="round" strokeWidth="1.5" d="M12 16v-4m0-4h.01" />
          </svg>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#1a1a2e] border border-[#2a2a3d] rounded text-[10px] text-gray-300 w-36 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 whitespace-normal">
            {tooltip}
          </div>
        </div>
      )}
    </div>
    <div className={`text-lg font-semibold font-mono ${
      color === 'cyan' ? 'text-cyan-400' : 
      color === 'green' ? 'text-emerald-400' : 
      color === 'red' ? 'text-red-400' : 
      color === 'amber' ? 'text-amber-400' : 
      color === 'purple' ? 'text-purple-400' : 'text-white'
    }`}>
      {value}
    </div>
    {subValue && <div className="text-[10px] text-gray-500 mt-0.5">{subValue}</div>}
  </div>
);

// Sparkline Chart Component
const SparklineChart = ({ data = [], color = '#06b6d4', height = 60 }) => {
  const points = useMemo(() => {
    if (!data.length) return '';
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    return data.map((val, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = height - ((val - min) / range) * (height - 10) - 5;
      return `${x},${y}`;
    }).join(' ');
  }, [data, height]);

  const areaPoints = useMemo(() => {
    if (!points) return '';
    return `0,${height} ${points} 100,${height}`;
  }, [points, height]);

  return (
    <svg className="w-full" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon fill="url(#sparkGrad)" points={areaPoints} />
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
};

// Code Editor Component
const CodeEditor = ({ code, onChange, readOnly = false }) => {
  const lines = code?.split('\n') || [''];
  
  return (
    <div className="bg-[#0d0d12] border border-[#1e1e2d] rounded-lg overflow-hidden font-mono text-xs">
      <div className="flex items-center justify-between px-3 py-2 bg-[#12121a] border-b border-[#1e1e2d]">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500/60"></div>
          <div className="w-3 h-3 rounded-full bg-amber-500/60"></div>
          <div className="w-3 h-3 rounded-full bg-emerald-500/60"></div>
        </div>
        <span className="text-[10px] text-gray-500">strategy.py</span>
      </div>
      <div className="flex max-h-64 overflow-auto scrollbar-hide">
        <div className="py-3 px-2 bg-[#0d0d12] border-r border-[#1e1e2d] select-none">
          {lines.map((_, i) => (
            <div key={i} className="text-gray-600 text-right pr-2 leading-5">{i + 1}</div>
          ))}
        </div>
        <textarea
          value={code}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readOnly}
          className="flex-1 bg-transparent text-gray-300 p-3 outline-none resize-none leading-5"
          style={{ minHeight: `${lines.length * 20 + 24}px` }}
          spellCheck={false}
        />
      </div>
    </div>
  );
};

// Visual Condition Builder
const ConditionBuilder = ({ conditions = [], onChange }) => {
  const [mode, setMode] = useState('visual'); // 'visual' | 'code'
  
  const indicatorOptions = ['RSI', 'MACD', 'SMA', 'EMA', 'Bollinger', 'ATR', 'Volume', 'Price'];
  const operatorOptions = ['>', '<', '>=', '<=', '==', 'crosses above', 'crosses below'];
  
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setMode('visual')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
            mode === 'visual' 
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50' 
              : 'bg-[#12121a] text-gray-400 border border-[#1e1e2d] hover:border-gray-600'
          }`}
        >
          Visual Builder
        </button>
        <button
          onClick={() => setMode('code')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-all ${
            mode === 'code' 
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50' 
              : 'bg-[#12121a] text-gray-400 border border-[#1e1e2d] hover:border-gray-600'
          }`}
        >
          Code Editor
        </button>
      </div>

      {mode === 'visual' ? (
        <div className="space-y-2">
          {/* Entry Conditions */}
          <div className="bg-[#0d0d12] border border-emerald-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-xs font-medium text-emerald-400">Entry Conditions</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <select className="bg-[#12121a] border border-[#1e1e2d] rounded px-2 py-1.5 text-xs text-white focus:border-cyan-500 outline-none">
                  {indicatorOptions.map(ind => <option key={ind}>{ind}</option>)}
                </select>
                <select className="bg-[#12121a] border border-[#1e1e2d] rounded px-2 py-1.5 text-xs text-white focus:border-cyan-500 outline-none">
                  {operatorOptions.map(op => <option key={op}>{op}</option>)}
                </select>
                <input 
                  type="text" 
                  defaultValue="30"
                  className="w-20 bg-[#12121a] border border-[#1e1e2d] rounded px-2 py-1.5 text-xs text-white font-mono focus:border-cyan-500 outline-none"
                />
                <button className="p-1 text-gray-500 hover:text-red-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <button className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
                Add Condition
              </button>
            </div>
          </div>

          {/* Exit Conditions */}
          <div className="bg-[#0d0d12] border border-red-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="text-xs font-medium text-red-400">Exit Conditions</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <select className="bg-[#12121a] border border-[#1e1e2d] rounded px-2 py-1.5 text-xs text-white focus:border-cyan-500 outline-none">
                  {indicatorOptions.map(ind => <option key={ind}>{ind}</option>)}
                </select>
                <select className="bg-[#12121a] border border-[#1e1e2d] rounded px-2 py-1.5 text-xs text-white focus:border-cyan-500 outline-none">
                  {operatorOptions.map(op => <option key={op}>{op}</option>)}
                </select>
                <input 
                  type="text" 
                  defaultValue="70"
                  className="w-20 bg-[#12121a] border border-[#1e1e2d] rounded px-2 py-1.5 text-xs text-white font-mono focus:border-cyan-500 outline-none"
                />
                <button className="p-1 text-gray-500 hover:text-red-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <button className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
                Add Condition
              </button>
            </div>
          </div>
        </div>
      ) : (
        <CodeEditor 
          code={`# Entry/Exit Logic
def should_enter(self, bar):
    rsi = self.indicators.RSI(14)
    return rsi < 30

def should_exit(self, bar):
    rsi = self.indicators.RSI(14)
    return rsi > 70`}
        />
      )}
    </div>
  );
};

// Equity Curve Chart
const EquityCurve = ({ data = [] }) => {
  const chartData = useMemo(() => {
    if (!data.length) {
      // Generate mock data
      const mockData = [];
      let value = 10000;
      for (let i = 0; i < 100; i++) {
        value += (Math.random() - 0.45) * 200;
        mockData.push(Math.max(8000, value));
      }
      return mockData;
    }
    return data;
  }, [data]);

  return (
    <div className="bg-[#0d0d12] border border-[#1e1e2d] rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400 font-medium">Equity Curve</span>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-gray-500">Initial: $10,000</span>
          <span className="text-emerald-400">Final: ${chartData[chartData.length - 1]?.toLocaleString() || '--'}</span>
        </div>
      </div>
      <SparklineChart data={chartData} color="#06b6d4" height={120} />
    </div>
  );
};

// Backtest Metrics Table
const BacktestMetricsTable = ({ metrics = {} }) => {
  const defaultMetrics = {
    cagr: 24.5,
    sharpeRatio: 1.84,
    sortinoRatio: 2.31,
    winRate: 67.3,
    profitFactor: 1.92,
    maxDrawdown: 12.4,
    calmarRatio: 1.98,
    totalTrades: 142,
    avgTradeDuration: '3.2 days',
    ...metrics
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
      <MetricCard label="CAGR" value={`${formatNumber(defaultMetrics.cagr)}%`} color="green" tooltip="Compound Annual Growth Rate" />
      <MetricCard label="Sharpe Ratio" value={formatNumber(defaultMetrics.sharpeRatio)} color="cyan" tooltip="Risk-adjusted return (>1 is good, >2 is excellent)" />
      <MetricCard label="Sortino Ratio" value={formatNumber(defaultMetrics.sortinoRatio)} color="cyan" tooltip="Like Sharpe but only penalizes downside volatility" />
      <MetricCard label="Win Rate" value={`${formatNumber(defaultMetrics.winRate)}%`} color="green" tooltip="Percentage of profitable trades" />
      <MetricCard label="Profit Factor" value={formatNumber(defaultMetrics.profitFactor)} color="amber" tooltip="Gross profit / Gross loss (>1.5 is good)" />
      <MetricCard label="Max Drawdown" value={`-${formatNumber(defaultMetrics.maxDrawdown)}%`} color="red" tooltip="Largest peak-to-trough decline" />
      <MetricCard label="Calmar Ratio" value={formatNumber(defaultMetrics.calmarRatio)} color="purple" tooltip="CAGR / Max Drawdown (>1 is good)" />
      <MetricCard label="Total Trades" value={defaultMetrics.totalTrades} color="white" />
      <MetricCard label="Avg Duration" value={defaultMetrics.avgTradeDuration} color="white" />
    </div>
  );
};

// Slider Input Component
const clampNumber = (value, min, max) => {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
};

const SliderInput = ({ label, value, onChange, min, max, step = 1, unit = '', tooltip, showInput = false }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-400">{label}</span>
        {tooltip && (
          <div className="group relative">
            <svg className="w-3 h-3 text-gray-600 hover:text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
              <path strokeLinecap="round" strokeWidth="1.5" d="M12 16v-4m0-4h.01" />
            </svg>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#1a1a2e] border border-[#2a2a3d] rounded text-[10px] text-gray-300 w-36 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              {tooltip}
            </div>
          </div>
        )}
      </div>
      {showInput ? (
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={Number.isFinite(value) ? value : ''}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              const parsed = parseFloat(e.target.value);
              if (!Number.isNaN(parsed)) {
                onChange(clampNumber(parsed, min, max));
              }
            }}
            className="w-20 bg-[#0d0d12] border border-[#1e1e2d] rounded px-2 py-1 text-xs text-gray-200 font-mono focus:border-cyan-500 outline-none"
          />
          <span className="text-[10px] text-gray-500">{unit}</span>
        </div>
      ) : (
        <span className="text-xs text-cyan-400 font-mono">{value}{unit}</span>
      )}
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1 bg-[#1e1e2d] rounded-lg appearance-none cursor-pointer accent-cyan-500"
    />
    <div className="flex justify-between text-[10px] text-gray-600">
      <span>{min}{unit}</span>
      <span>{max}{unit}</span>
    </div>
  </div>
);

// ============== MAIN COMPONENT ==============
export default function StrategyBuilder({ 
  strategies = [], 
  deployedStrategies = [],
  onStrategyGenerated,
  onDeleteStrategy,
  onDeployStrategy,
  onUpdateStrategy,
  themeClasses = {}
}) {
  // State
  const [selectedFolder, setSelectedFolder] = useState('development');
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [backtestProgress, setBacktestProgress] = useState(0);
  const [backtestResults, setBacktestResults] = useState(null);

  // Risk Management State
  const [riskParams, setRiskParams] = useState({
    stopLoss: 5,
    takeProfit: 15,
    maxDrawdown: 20,
    positionSize: 2,
    maxPositions: 5,
    trailingStop: 3,
  });

  const updateRiskParams = useCallback((updates) => {
    setRiskParams(prev => {
      const next = { ...prev, ...updates };
      if (selectedStrategy?.id && onUpdateStrategy) {
        onUpdateStrategy(selectedStrategy.id, { risk: next });
      }
      setSelectedStrategy(prevSelected => (
        prevSelected?.id === selectedStrategy?.id ? { ...prevSelected, risk: next } : prevSelected
      ));
      return next;
    });
  }, [onUpdateStrategy, selectedStrategy?.id]);

  // Optimization State
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeProgress, setOptimizeProgress] = useState(0);
  const [optimizeResults, setOptimizeResults] = useState([]);

  // Categorize strategies
  const categorizedStrategies = useMemo(() => {
    const cats = {
      live: deployedStrategies.filter(s => s.status === 'deployed' && s.runStatus === 'running'),
      paper: strategies.filter(s => s.status === 'paper'),
      development: strategies.filter(s => s.status === 'draft' || !s.status),
      backtested: strategies.filter(s => s.status === 'backtested'),
      templates: [],
      archived: strategies.filter(s => s.status === 'archived'),
    };
    return cats;
  }, [strategies, deployedStrategies]);

  // Folder counts
  const foldersWithCounts = useMemo(() => 
    STRATEGY_FOLDERS.map(f => ({
      ...f,
      count: categorizedStrategies[f.id]?.length || 0
    })),
    [categorizedStrategies]
  );

  // Selected folder strategies
  const currentStrategies = useMemo(() => 
    categorizedStrategies[selectedFolder] || [],
    [categorizedStrategies, selectedFolder]
  );

  // Auto-select first strategy
  useEffect(() => {
    if (!currentStrategies.length) {
      setSelectedStrategy(null);
      return;
    }
    if (!selectedStrategy || !currentStrategies.some(s => s.id === selectedStrategy.id)) {
      setSelectedStrategy(currentStrategies[0]);
      return;
    }
    const updated = currentStrategies.find(s => s.id === selectedStrategy.id);
    if (updated && updated !== selectedStrategy) {
      setSelectedStrategy(updated);
    }
  }, [currentStrategies, selectedStrategy]);

  // Sync risk parameters from selected strategy
  useEffect(() => {
    if (!selectedStrategy) {
      setRiskParams({
        stopLoss: 5,
        takeProfit: 15,
        maxDrawdown: 20,
        positionSize: 2,
        maxPositions: 5,
        trailingStop: 3,
      });
      return;
    }
    const nextRisk = {
      stopLoss: selectedStrategy.risk?.stopLoss ?? 5,
      takeProfit: selectedStrategy.risk?.takeProfit ?? 15,
      maxDrawdown: selectedStrategy.risk?.maxDrawdown ?? 20,
      positionSize: selectedStrategy.risk?.positionSize ?? 2,
      maxPositions: selectedStrategy.risk?.maxPositions ?? 5,
      trailingStop: selectedStrategy.risk?.trailingStop ?? 3,
    };
    setRiskParams(nextRisk);
  }, [selectedStrategy?.id]);

  // Run Backtest
  const runBacktest = useCallback(() => {
    setIsBacktesting(true);
    setBacktestProgress(0);
    setBacktestResults(null);

    const interval = setInterval(() => {
      setBacktestProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsBacktesting(false);
          setBacktestResults({
            cagr: 18 + Math.random() * 20,
            sharpeRatio: 1.2 + Math.random() * 1.5,
            sortinoRatio: 1.5 + Math.random() * 1.5,
            winRate: 55 + Math.random() * 20,
            profitFactor: 1.3 + Math.random() * 1.0,
            maxDrawdown: 8 + Math.random() * 12,
            calmarRatio: 1 + Math.random() * 1.5,
            totalTrades: Math.floor(80 + Math.random() * 100),
            avgTradeDuration: `${(1 + Math.random() * 5).toFixed(1)} days`,
          });
          return 100;
        }
        return prev + 2;
      });
    }, 50);

    return () => clearInterval(interval);
  }, []);

  // Run Optimization
  const runOptimization = useCallback(() => {
    setOptimizing(true);
    setOptimizeProgress(0);
    setOptimizeResults([]);

    const interval = setInterval(() => {
      setOptimizeProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setOptimizing(false);
          // Generate optimization results
          setOptimizeResults([
            { params: 'RSI(12), SL: 4%, TP: 12%', sharpe: 2.14, winRate: 71.2, drawdown: 9.8 },
            { params: 'RSI(14), SL: 5%, TP: 15%', sharpe: 1.98, winRate: 68.5, drawdown: 11.2 },
            { params: 'RSI(16), SL: 6%, TP: 18%', sharpe: 1.85, winRate: 65.3, drawdown: 13.1 },
            { params: 'RSI(10), SL: 3%, TP: 10%', sharpe: 1.72, winRate: 73.1, drawdown: 8.4 },
            { params: 'RSI(20), SL: 7%, TP: 20%', sharpe: 1.64, winRate: 62.8, drawdown: 15.2 },
          ]);
          return 100;
        }
        return prev + 1;
      });
    }, 30);

    return () => clearInterval(interval);
  }, []);

  // Handle Deploy
  const handleDeploy = useCallback((mode) => {
    if (selectedStrategy && onDeployStrategy) {
      const deployedStrategy = {
        ...selectedStrategy,
        status: mode === 'paper' ? 'paper' : 'deployed',
        deployedAt: Date.now(),
        runStatus: 'running',
      };
      onDeployStrategy(deployedStrategy);
    }
  }, [selectedStrategy, onDeployStrategy]);

  // ============== RENDER TAB CONTENT ==============
  const renderTabContent = () => {
    if (!selectedStrategy) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <svg className="w-16 h-16 mx-auto text-gray-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-500 text-sm">Select a strategy to view details</p>
            <p className="text-gray-600 text-xs mt-1">or create a new one with Atlas AI</p>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return (
          <div className="p-4 space-y-4 overflow-auto">
            {/* Strategy Header */}
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white mb-1">{selectedStrategy.name}</h2>
                <p className="text-sm text-gray-400">{selectedStrategy.description || 'No description provided'}</p>
              </div>
              <div className={`px-2 py-1 rounded text-xs font-medium ${
                selectedStrategy.status === 'deployed' ? 'bg-emerald-500/20 text-emerald-400' :
                selectedStrategy.status === 'paper' ? 'bg-amber-500/20 text-amber-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {selectedStrategy.status || 'Draft'}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <MetricCard 
                label="Win Rate" 
                value={selectedStrategy.metrics?.winRate ? `${selectedStrategy.metrics.winRate}%` : '--'} 
                color="green" 
              />
              <MetricCard 
                label="Sharpe Ratio" 
                value={selectedStrategy.metrics?.sharpeRatio || '--'} 
                color="cyan" 
              />
              <MetricCard 
                label="Max Drawdown" 
                value={selectedStrategy.metrics?.maxDrawdown ? `-${selectedStrategy.metrics.maxDrawdown}%` : '--'} 
                color="red" 
              />
              <MetricCard 
                label="Profit Factor" 
                value={selectedStrategy.metrics?.profitFactor || '--'} 
                color="amber" 
              />
            </div>

            {/* Version History */}
            <div className="bg-[#0d0d12] border border-[#1e1e2d] rounded-lg p-4">
              <h3 className="text-sm font-medium text-white mb-3">Version History</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-2 bg-[#12121a] rounded">
                  <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
                  <span className="text-xs text-gray-300 flex-1">v1.0 - Initial version</span>
                  <span className="text-[10px] text-gray-500">Current</span>
                </div>
              </div>
            </div>

            {/* Code Preview */}
            {selectedStrategy.code && (
              <div>
                <h3 className="text-sm font-medium text-white mb-2">Strategy Code</h3>
                <CodeEditor code={selectedStrategy.code} readOnly />
              </div>
            )}
          </div>
        );

      case 'conditions':
        return (
          <div className="p-4 space-y-4 overflow-auto">
            <h3 className="text-sm font-medium text-white">Entry & Exit Logic</h3>
            <ConditionBuilder />
          </div>
        );

      case 'execution':
        return (
          <div className="p-4 space-y-4 overflow-auto">
            <h3 className="text-sm font-medium text-white mb-4">Execution Settings</h3>
            
            {/* Order Types */}
            <div className="bg-[#0d0d12] border border-[#1e1e2d] rounded-lg p-4">
              <h4 className="text-xs text-gray-400 mb-3">Order Type</h4>
              <div className="grid grid-cols-3 gap-2">
                {['Market', 'Limit', 'Stop-Limit'].map(type => (
                  <button
                    key={type}
                    className="px-3 py-2 text-xs font-medium rounded transition-all bg-[#12121a] text-gray-400 border border-[#1e1e2d] hover:border-cyan-500/50 hover:text-cyan-400"
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Timing Rules */}
            <div className="bg-[#0d0d12] border border-[#1e1e2d] rounded-lg p-4">
              <h4 className="text-xs text-gray-400 mb-3">Trading Hours</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block">Start Time</label>
                  <input 
                    type="time" 
                    defaultValue="09:30"
                    className="w-full bg-[#12121a] border border-[#1e1e2d] rounded px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 mb-1 block">End Time</label>
                  <input 
                    type="time" 
                    defaultValue="16:00"
                    className="w-full bg-[#12121a] border border-[#1e1e2d] rounded px-3 py-2 text-xs text-white focus:border-cyan-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Position Sizing */}
            <div className="bg-[#0d0d12] border border-[#1e1e2d] rounded-lg p-4 space-y-4">
              <h4 className="text-xs text-gray-400">Position Sizing</h4>
              <SliderInput 
                label="Position Size" 
                value={riskParams.positionSize} 
                onChange={(v) => updateRiskParams({ positionSize: v })}
                min={0.5} max={10} step={0.5} unit="%"
                tooltip="Percentage of portfolio per trade"
              />
              <SliderInput 
                label="Max Positions" 
                value={riskParams.maxPositions} 
                onChange={(v) => updateRiskParams({ maxPositions: v })}
                min={1} max={20} step={1}
                tooltip="Maximum concurrent open positions"
              />
            </div>
          </div>
        );

      case 'risk':
        return (
          <div className="p-4 space-y-4 overflow-auto">
            <h3 className="text-sm font-medium text-white mb-4">Risk Management</h3>
            
            {/* Risk Presets */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-gray-400">Presets:</span>
              <button
                onClick={() => updateRiskParams({ stopLoss: 3, takeProfit: 8, maxDrawdown: 10, positionSize: 1, maxPositions: 3, trailingStop: 2 })}
                className="px-3 py-1.5 text-xs font-medium rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all"
              >
                🛡️ Conservative
              </button>
              <button
                onClick={() => updateRiskParams({ stopLoss: 5, takeProfit: 15, maxDrawdown: 20, positionSize: 2, maxPositions: 5, trailingStop: 3 })}
                className="px-3 py-1.5 text-xs font-medium rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-all"
              >
                ⚖️ Balanced
              </button>
              <button
                onClick={() => updateRiskParams({ stopLoss: 8, takeProfit: 25, maxDrawdown: 30, positionSize: 5, maxPositions: 10, trailingStop: 5 })}
                className="px-3 py-1.5 text-xs font-medium rounded bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 transition-all"
              >
                🚀 Aggressive
              </button>
            </div>

            {/* Risk Parameters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#0d0d12] border border-[#1e1e2d] rounded-lg p-4 space-y-4">
                <SliderInput 
                  label="Stop Loss" 
                  value={riskParams.stopLoss} 
                  onChange={(v) => updateRiskParams({ stopLoss: v })}
                  min={1} max={15} step={0.5} unit="%"
                  tooltip="Maximum loss per trade before exit"
                  showInput
                />
                <SliderInput 
                  label="Take Profit" 
                  value={riskParams.takeProfit} 
                  onChange={(v) => updateRiskParams({ takeProfit: v })}
                  min={2} max={50} step={1} unit="%"
                  tooltip="Target profit to close position"
                  showInput
                />
                <SliderInput 
                  label="Trailing Stop" 
                  value={riskParams.trailingStop} 
                  onChange={(v) => updateRiskParams({ trailingStop: v })}
                  min={1} max={10} step={0.5} unit="%"
                  tooltip="Lock in profits as price rises"
                />
              </div>

              <div className="bg-[#0d0d12] border border-[#1e1e2d] rounded-lg p-4 space-y-4">
                <SliderInput 
                  label="Max Drawdown" 
                  value={riskParams.maxDrawdown} 
                  onChange={(v) => updateRiskParams({ maxDrawdown: v })}
                  min={5} max={50} step={1} unit="%"
                  tooltip="Stop trading when portfolio drops this much"
                  showInput
                />
                <SliderInput 
                  label="Position Size" 
                  value={riskParams.positionSize} 
                  onChange={(v) => updateRiskParams({ positionSize: v })}
                  min={0.5} max={10} step={0.5} unit="%"
                  tooltip="Percentage of portfolio per trade"
                  showInput
                />
                <SliderInput 
                  label="Max Positions" 
                  value={riskParams.maxPositions} 
                  onChange={(v) => updateRiskParams({ maxPositions: v })}
                  min={1} max={20} step={1}
                  tooltip="Maximum concurrent positions"
                />
              </div>
            </div>
          </div>
        );

      case 'backtest':
        return (
          <div className="p-4 space-y-4 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-white">Backtest Results</h3>
              <div className="flex items-center gap-2">
                <select className="bg-[#12121a] border border-[#1e1e2d] rounded px-2 py-1.5 text-xs text-white focus:border-cyan-500 outline-none">
                  <option>1 Year</option>
                  <option>2 Years</option>
                  <option>5 Years</option>
                  <option>Max</option>
                </select>
                <button
                  onClick={runBacktest}
                  disabled={isBacktesting}
                  className={`px-4 py-1.5 text-xs font-medium rounded transition-all flex items-center gap-2 ${
                    isBacktesting 
                      ? 'bg-purple-500/20 text-purple-400 cursor-wait' 
                      : 'bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20'
                  }`}
                >
                  {isBacktesting ? (
                    <>
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      {backtestProgress}%
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Run Backtest
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Equity Curve */}
            <EquityCurve />

            {/* Metrics */}
            <BacktestMetricsTable metrics={backtestResults || selectedStrategy.metrics} />
          </div>
        );

      case 'optimize':
        return (
          <div className="p-4 space-y-4 overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-white">Parameter Optimization</h3>
              <button
                onClick={runOptimization}
                disabled={optimizing}
                className={`px-4 py-1.5 text-xs font-medium rounded transition-all flex items-center gap-2 ${
                  optimizing 
                    ? 'bg-amber-500/20 text-amber-400 cursor-wait' 
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20'
                }`}
              >
                {optimizing ? (
                  <>
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    {optimizeProgress}%
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Run Optimization
                  </>
                )}
              </button>
            </div>

            {/* Parameter Grid */}
            <div className="bg-[#0d0d12] border border-[#1e1e2d] rounded-lg p-4">
              <h4 className="text-xs text-gray-400 mb-3">Parameters to Optimize</h4>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 text-xs text-gray-300">
                  <input type="checkbox" defaultChecked className="accent-cyan-500" />
                  RSI Period (8-20)
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-300">
                  <input type="checkbox" defaultChecked className="accent-cyan-500" />
                  Stop Loss (2-10%)
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-300">
                  <input type="checkbox" defaultChecked className="accent-cyan-500" />
                  Take Profit (5-25%)
                </label>
                <label className="flex items-center gap-2 text-xs text-gray-300">
                  <input type="checkbox" className="accent-cyan-500" />
                  Position Size (1-5%)
                </label>
              </div>
            </div>

            {/* Optimization Results */}
            {optimizeResults.length > 0 && (
              <div className="bg-[#0d0d12] border border-[#1e1e2d] rounded-lg overflow-hidden">
                <div className="px-4 py-2 bg-[#12121a] border-b border-[#1e1e2d]">
                  <span className="text-xs text-gray-400">Top Parameter Combinations</span>
                </div>
                <div className="divide-y divide-[#1e1e2d]">
                  {optimizeResults.map((result, i) => (
                    <div key={i} className={`flex items-center justify-between px-4 py-2 hover:bg-[#12121a] cursor-pointer ${i === 0 ? 'bg-emerald-500/5' : ''}`}>
                      <div className="flex items-center gap-2">
                        {i === 0 && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">BEST</span>}
                        <span className="text-xs text-gray-300 font-mono">{result.params}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-cyan-400">Sharpe: {result.sharpe}</span>
                        <span className="text-emerald-400">Win: {result.winRate}%</span>
                        <span className="text-red-400">DD: -{result.drawdown}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'deploy':
        return (
          <div className="p-4 space-y-4 overflow-auto">
            <h3 className="text-sm font-medium text-white mb-4">Deploy Strategy</h3>

            {/* Deployment Flow */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                selectedStrategy?.status === 'draft' ? 'border-gray-500 bg-gray-500/10' : 'border-[#1e1e2d] bg-[#0d0d12]'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  selectedStrategy?.status === 'draft' ? 'bg-gray-500 text-white' : 'bg-gray-700 text-gray-500'
                }`}>1</div>
                <span className="text-xs text-gray-400">Draft</span>
              </div>
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
              </svg>
              <div className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                selectedStrategy?.status === 'paper' ? 'border-amber-500 bg-amber-500/10' : 'border-[#1e1e2d] bg-[#0d0d12]'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  selectedStrategy?.status === 'paper' ? 'bg-amber-500 text-black' : 'bg-gray-700 text-gray-500'
                }`}>2</div>
                <span className="text-xs text-gray-400">Paper</span>
              </div>
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
              </svg>
              <div className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                selectedStrategy?.status === 'deployed' ? 'border-emerald-500 bg-emerald-500/10' : 'border-[#1e1e2d] bg-[#0d0d12]'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  selectedStrategy?.status === 'deployed' ? 'bg-emerald-500 text-black' : 'bg-gray-700 text-gray-500'
                }`}>3</div>
                <span className="text-xs text-gray-400">Live</span>
              </div>
            </div>

            {/* Deployment Actions */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleDeploy('paper')}
                disabled={selectedStrategy?.status === 'deployed'}
                className="flex flex-col items-center gap-3 p-6 bg-[#0d0d12] border border-amber-500/30 rounded-lg hover:bg-amber-500/5 hover:border-amber-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-amber-400">Paper Trading</div>
                  <div className="text-[10px] text-gray-500 mt-1">Test with simulated money</div>
                </div>
              </button>

              <button
                onClick={() => handleDeploy('live')}
                disabled={selectedStrategy?.status !== 'paper' && selectedStrategy?.status !== 'draft'}
                className="flex flex-col items-center gap-3 p-6 bg-[#0d0d12] border border-emerald-500/30 rounded-lg hover:bg-emerald-500/5 hover:border-emerald-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-emerald-400">Go Live</div>
                  <div className="text-[10px] text-gray-500 mt-1">Trade with real capital</div>
                </div>
              </button>
            </div>

            {/* Confirmation Warning */}
            {selectedStrategy?.status !== 'deployed' && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <div className="text-sm font-medium text-red-400">Before Going Live</div>
                    <ul className="text-xs text-gray-400 mt-1 space-y-1">
                      <li>• Ensure you've paper traded for at least 2 weeks</li>
                      <li>• Review all risk management settings</li>
                      <li>• Start with a small position size</li>
                      <li>• Monitor closely during initial deployment</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // ============== MAIN RENDER ==============
  return (
    <div className="flex h-full bg-[#0d0d12] text-white overflow-hidden">
      {/* Left Sidebar - Strategy Library */}
      <div className={`flex flex-col border-r border-[#1e1e2d] transition-all duration-300 ${sidebarCollapsed ? 'w-12' : 'w-56'}`}>
        {/* Sidebar Header */}
        <div className="h-10 flex items-center justify-between px-3 border-b border-[#1e1e2d] bg-[#12121a]">
          {!sidebarCollapsed && <span className="text-xs font-medium text-gray-400">STRATEGIES</span>}
          <button 
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1 hover:bg-[#1e1e2d] rounded transition-colors"
          >
            <svg className={`w-4 h-4 text-gray-500 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Folder List */}
        <div className="flex-1 overflow-auto py-2 scrollbar-hide">
          {foldersWithCounts.map(folder => (
            <button
              key={folder.id}
              onClick={() => { setSelectedFolder(folder.id); setSelectedStrategy(null); }}
              className={`w-full flex items-center gap-2 px-3 py-2 transition-all ${
                selectedFolder === folder.id 
                  ? 'bg-[#1e1e2d] text-white' 
                  : 'text-gray-400 hover:bg-[#12121a] hover:text-gray-300'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${folder.dot}`}></div>
              {!sidebarCollapsed && (
                <>
                  <span className="flex-1 text-xs text-left truncate">{folder.name}</span>
                  {folder.count > 0 && (
                    <span className="text-[10px] text-gray-500">{folder.count}</span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>

        {/* Strategy List */}
        {!sidebarCollapsed && (
          <div className="border-t border-[#1e1e2d] max-h-48 overflow-auto scrollbar-hide">
            <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-gray-600">
              {foldersWithCounts.find(folder => folder.id === selectedFolder)?.name || 'Strategies'}
            </div>
            {currentStrategies.length > 0 ? (
              currentStrategies.map(strategy => (
                <button
                  key={strategy.id}
                  onClick={() => setSelectedStrategy(strategy)}
                  className={`w-full flex items-center gap-2 px-3 py-2 transition-all ${
                    selectedStrategy?.id === strategy.id 
                      ? 'bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-500' 
                      : 'text-gray-400 hover:bg-[#12121a] hover:text-gray-300'
                  }`}
                >
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-xs truncate">{strategy.name}</span>
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-[11px] text-gray-500">
                No strategies in this folder.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Tab Navigation */}
        <div className="h-10 flex items-center border-b border-[#1e1e2d] bg-[#12121a] px-2 overflow-x-auto scrollbar-hide">
          {WORKFLOW_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id 
                  ? 'text-cyan-400 border-b-2 border-cyan-400 -mb-[2px]' 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={tab.icon} />
              </svg>
              {tab.name}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden bg-[#12121a]">
          {renderTabContent()}
        </div>
      </div>

      {/* Custom scrollbar hiding */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
