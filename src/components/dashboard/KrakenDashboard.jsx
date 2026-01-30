import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// Import ALL existing working components
import Sidebar from './Sidebar';
import RightPanel from './RightPanel';
import StatusBar from './StatusBar';
import TerminalPanel from './TerminalPanel';
import ArbitragePanel from './ArbitragePanel';
import DataTable from './DataTable';
import StockDetailView from './StockDetailView';
import NewsletterModal from './NewsletterModal';
import BrokerConnectModal from './BrokerConnectModal';
import NewsletterPage from './NewsletterPage';
import SettingsPage from './SettingsPage';

// ============================================
// KRAKEN-STYLE DASHBOARD
// Uses existing working components with Kraken theme
// ============================================

// Animation variants for smooth transitions
const chartVariants = {
  collapsed: { 
    height: 48,
    transition: { 
      type: "spring", 
      stiffness: 300, 
      damping: 30 
    }
  },
  expanded: { 
    height: 280,
    transition: { 
      type: "spring", 
      stiffness: 300, 
      damping: 30 
    }
  }
};

const contentFadeVariants = {
  hidden: { 
    opacity: 0,
    transition: { duration: 0.15 }
  },
  visible: { 
    opacity: 1,
    transition: { duration: 0.25, delay: 0.1 }
  }
};

const tabContentVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { 
      type: "spring",
      stiffness: 300,
      damping: 30
    }
  },
  exit: { 
    opacity: 0, 
    y: -10,
    transition: { duration: 0.15 }
  }
};

const loadDashboardState = () => {
  try {
    const saved = localStorage.getItem('stratify-dashboard-state');
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

const saveDashboardState = (state) => {
  localStorage.setItem('stratify-dashboard-state', JSON.stringify(state));
};

// Strategy generators (from original Dashboard)
const STRATEGY_TEMPLATES = [
  { name: 'MACD Crossover', symbol: 'TSLA', type: 'Momentum' },
  { name: 'RSI Divergence', symbol: 'NVDA', type: 'Mean Reversion' },
  { name: 'Bollinger Squeeze', symbol: 'AAPL', type: 'Volatility' },
  { name: 'Golden Cross', symbol: 'SPY', type: 'Trend Following' },
  { name: 'VWAP Bounce', symbol: 'AMD', type: 'Scalping' },
  { name: 'Gap Fill', symbol: 'MSFT', type: 'Mean Reversion' },
  { name: 'Breakout Hunter', symbol: 'META', type: 'Momentum' },
  { name: 'Support Bounce', symbol: 'GOOGL', type: 'Technical' },
  { name: 'EMA Ribbon', symbol: 'QQQ', type: 'Trend Following' },
  { name: 'Stochastic Pop', symbol: 'AMZN', type: 'Momentum' },
];

const generateRandomStrategy = () => {
  const template = STRATEGY_TEMPLATES[Math.floor(Math.random() * STRATEGY_TEMPLATES.length)];
  const winRate = (55 + Math.random() * 25).toFixed(1);
  const totalReturn = (10 + Math.random() * 40).toFixed(1);
  const maxDrawdown = (5 + Math.random() * 15).toFixed(1);
  const sharpeRatio = (1 + Math.random() * 1.5).toFixed(2);
  
  return {
    id: `strategy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: `${template.name} ${template.symbol}`,
    symbol: template.symbol,
    type: template.type,
    status: 'draft',
    metrics: {
      winRate: `${winRate}%`,
      totalReturn: `${totalReturn}%`,
      maxDrawdown: maxDrawdown,
      sharpeRatio: sharpeRatio,
      trades: Math.floor(50 + Math.random() * 150),
    }
  };
};

const generateRandomDeployedStrategy = () => {
  const strategy = generateRandomStrategy();
  const staggeredTimes = [
    Date.now() - (14 * 24 * 60 * 60 * 1000) - Math.random() * (3 * 60 * 60 * 1000),
    Date.now() - (3 * 24 * 60 * 60 * 1000) - Math.random() * (7 * 60 * 60 * 1000),
    Date.now() - (45 * 60 * 1000) - Math.random() * (30 * 60 * 1000),
    Date.now() - (7 * 24 * 60 * 60 * 1000) - Math.random() * (11 * 60 * 60 * 1000),
    Date.now() - (1 * 24 * 60 * 60 * 1000) - Math.random() * (2 * 60 * 60 * 1000),
  ];
  return {
    ...strategy,
    status: 'deployed',
    runStatus: 'running',
    deployedAt: staggeredTimes[Math.floor(Math.random() * staggeredTimes.length)]
  };
};

const RESPAWN_DELAY_MS = 60000;

// Portfolio Growth Chart (Custom SVG with gradient)
const PortfolioGrowthChart = ({ data, height = 180 }) => {
  const width = 800;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  const portfolioData = data || Array.from({ length: 30 }, (_, i) => {
    const base = 10000;
    const growth = base * (1 + (i * 0.015) + Math.sin(i * 0.3) * 0.02);
    return { day: i + 1, value: growth };
  });
  
  const minVal = Math.min(...portfolioData.map(d => d.value)) * 0.98;
  const maxVal = Math.max(...portfolioData.map(d => d.value)) * 1.02;
  
  const points = portfolioData.map((d, i) => {
    const x = padding.left + (i / (portfolioData.length - 1)) * chartWidth;
    const y = padding.top + chartHeight - ((d.value - minVal) / (maxVal - minVal)) * chartHeight;
    return `${x},${y}`;
  }).join(' ');
  
  const areaPoints = `${padding.left},${padding.top + chartHeight} ${points} ${padding.left + chartWidth},${padding.top + chartHeight}`;
  
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      <defs>
        <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7B61FF" stopOpacity="0.4" />
          <stop offset="50%" stopColor="#5B8DEF" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#5B8DEF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7B61FF" />
          <stop offset="100%" stopColor="#5B8DEF" />
        </linearGradient>
      </defs>
      
      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
        <line
          key={i}
          x1={padding.left}
          y1={padding.top + chartHeight * pct}
          x2={padding.left + chartWidth}
          y2={padding.top + chartHeight * pct}
          stroke="#1e1e2d"
          strokeWidth="1"
        />
      ))}
      
      <polygon points={areaPoints} fill="url(#portfolioGradient)" />
      
      <polyline
        points={points}
        fill="none"
        stroke="url(#lineGradient)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {[0, 0.5, 1].map((pct, i) => {
        const val = minVal + (maxVal - minVal) * (1 - pct);
        return (
          <text
            key={i}
            x={padding.left - 8}
            y={padding.top + chartHeight * pct + 4}
            fill="#6b6b80"
            fontSize="11"
            textAnchor="end"
            fontFamily="monospace"
          >
            ${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </text>
        );
      })}
    </svg>
  );
};

// Index Card Component
const IndexCard = ({ title, value, change, icon, color = 'purple', onClick, active }) => {
  const colorClasses = {
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30 hover:border-purple-500/50',
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30 hover:border-blue-500/50',
    cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 hover:border-cyan-500/50',
    emerald: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 hover:border-emerald-500/50',
    amber: 'from-amber-500/20 to-amber-600/10 border-amber-500/30 hover:border-amber-500/50',
  };
  
  const activeClasses = {
    purple: 'ring-2 ring-purple-500/50 border-purple-500',
    blue: 'ring-2 ring-blue-500/50 border-blue-500',
    cyan: 'ring-2 ring-cyan-500/50 border-cyan-500',
    emerald: 'ring-2 ring-emerald-500/50 border-emerald-500',
    amber: 'ring-2 ring-amber-500/50 border-amber-500',
  };
  
  const iconColors = {
    purple: 'text-purple-400',
    blue: 'text-blue-400',
    cyan: 'text-cyan-400',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
  };
  
  return (
    <motion.div 
      className={`flex-1 min-w-[140px] p-4 rounded-xl border bg-gradient-to-br cursor-pointer ${colorClasses[color]} ${active ? activeClasses[color] : ''}`}
      onClick={onClick}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-5 h-5 ${iconColors[color]}`}>{icon}</div>
        <span className="text-sm font-medium text-white">{title}</span>
        {active && (
          <motion.div 
            className="ml-auto"
            initial={{ rotate: 0 }}
            animate={{ rotate: 180 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </motion.div>
        )}
      </div>
      {value && (
        <div className="text-xl font-bold text-white font-mono">{value}</div>
      )}
      {change !== undefined && (
        <div className={`text-xs font-medium ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {change >= 0 ? '+' : ''}{change}%
        </div>
      )}
    </motion.div>
  );
};

// Portfolio Detail Panel (Kraken Style)
const PortfolioPanel = ({ portfolioValue, dayChange, dayChangePercent, alpacaData, onClose }) => {
  // Mock data for different balance types
  const spotBalances = [
    { asset: 'USD', symbol: '$', amount: alpacaData?.account?.cash || 45230.50, change: 0 },
    { asset: 'BTC', symbol: '₿', amount: 0.449, usdValue: 37124.82, change: 2.4 },
    { asset: 'ETH', symbol: 'Ξ', amount: 12.5, usdValue: 42770.88, change: -1.2 },
    { asset: 'SOL', symbol: '◎', amount: 85.2, usdValue: 16902.84, change: 3.8 },
  ];
  
  const totalSpot = spotBalances.reduce((sum, b) => sum + (b.usdValue || b.amount), 0);
  
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="overflow-hidden border-b border-[#1e1e2d]"
    >
      <div className="p-6 bg-[#0a0a10]">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Portfolio</h2>
              <p className="text-sm text-[#6b6b80]">Total Balance</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-[#6b6b80] hover:text-white hover:bg-[#1e1e2d] rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Total Balance */}
        <div className="mb-8">
          <div className="text-4xl font-bold text-white font-mono mb-2">
            ${portfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-lg font-medium ${dayChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {dayChange >= 0 ? '+' : ''}${Math.abs(dayChange).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span className={`px-2 py-0.5 rounded text-sm font-medium ${dayChange >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
              {dayChange >= 0 ? '+' : ''}{dayChangePercent}%
            </span>
            <span className="text-[#6b6b80] text-sm">today</span>
          </div>
        </div>
        
        {/* Balance Sections */}
        <div className="grid grid-cols-2 gap-6">
          {/* Spot Balances */}
          <div className="bg-[#06060c] rounded-xl p-4 border border-[#1e1e2d]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-[#6b6b80] uppercase tracking-wider">Spot Balances</h3>
              <span className="text-white font-mono font-medium">${totalSpot.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="space-y-3">
              {spotBalances.map((balance, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-[#1e1e2d] last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#1e1e2d] flex items-center justify-center text-sm font-bold text-white">
                      {balance.symbol}
                    </div>
                    <div>
                      <div className="text-white font-medium">{balance.asset}</div>
                      <div className="text-xs text-[#6b6b80]">{balance.amount.toLocaleString()}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-mono">${(balance.usdValue || balance.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                    {balance.change !== 0 && (
                      <div className={`text-xs ${balance.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {balance.change >= 0 ? '+' : ''}{balance.change}%
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Trading Stats */}
          <div className="bg-[#06060c] rounded-xl p-4 border border-[#1e1e2d]">
            <h3 className="text-sm font-medium text-[#6b6b80] uppercase tracking-wider mb-4">Trading Stats</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[#6b6b80]">Buying Power</span>
                <span className="text-white font-mono">${(alpacaData?.account?.buying_power || 90461).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#6b6b80]">Cash Available</span>
                <span className="text-white font-mono">${(alpacaData?.account?.cash || 45230.50).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#6b6b80]">Open Positions</span>
                <span className="text-white font-mono">{alpacaData?.positions?.length || 4}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#6b6b80]">Day Trades Left</span>
                <span className="text-emerald-400 font-mono">3</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#6b6b80]">Account Type</span>
                <span className="text-purple-400 font-medium">Paper Trading</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Quick Actions */}
        <div className="mt-6 flex gap-3">
          <button className="flex-1 px-4 py-3 bg-purple-500/20 text-purple-400 rounded-xl font-medium hover:bg-purple-500/30 transition-colors">
            Deposit
          </button>
          <button className="flex-1 px-4 py-3 bg-[#1e1e2d] text-white rounded-xl font-medium hover:bg-[#2a2a3d] transition-colors">
            Withdraw
          </button>
          <button className="flex-1 px-4 py-3 bg-[#1e1e2d] text-white rounded-xl font-medium hover:bg-[#2a2a3d] transition-colors">
            Transfer
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// Main Dashboard Component - with ALL existing functionality
export default function KrakenDashboard({ setCurrentPage, alpacaData }) {
  const savedState = loadDashboardState();
  
  // ALL state from original Dashboard
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(savedState?.rightPanelWidth ?? 320);
  const [activeTab, setActiveTab] = useState('strategies');
  const [activeSection, setActiveSection] = useState(savedState?.activeSection ?? 'watchlist');
  const [isDragging, setIsDragging] = useState(false);
  const [theme] = useState('dark'); // Kraken is always dark
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [chartCollapsed, setChartCollapsed] = useState(false);
  const [contentTab, setContentTab] = useState('strategies');
  const [expandedCard, setExpandedCard] = useState(null); // 'portfolio', 'strategies', 'arb', 'bets', 'pnl'
  
  // Panel states
  const [panelStates, setPanelStates] = useState(() => {
    try {
      const saved = localStorage.getItem('stratify-panel-states');
      return saved ? JSON.parse(saved) : {
        strategyBuilder: true,
        arbitrageScanner: true,
        deployedStrategies: true,
      };
    } catch {
      return { strategyBuilder: true, arbitrageScanner: true, deployedStrategies: true };
    }
  });

  useEffect(() => {
    localStorage.setItem('stratify-panel-states', JSON.stringify(panelStates));
  }, [panelStates]);

  const togglePanel = useCallback((panelId) => {
    setPanelStates(prev => ({
      ...prev,
      [panelId]: !prev[panelId],
    }));
  }, []);
  
  // Watchlist state
  const [watchlist, setWatchlist] = useState(() => {
    try {
      const saved = localStorage.getItem('stratify-watchlist');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [selectedStock, setSelectedStock] = useState(null);
  
  // Strategies state
  const [strategies, setStrategies] = useState(() => {
    try {
      const saved = localStorage.getItem('stratify-strategies');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  
  // Deployed strategies
  const [deployedStrategies, setDeployedStrategies] = useState(() => {
    try {
      const saved = localStorage.getItem('stratify-deployed-strategies');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      const staggeredTimes = [
        Date.now() - (14 * 24 * 60 * 60 * 1000) - (3 * 60 * 60 * 1000) + (17 * 60 * 1000),
        Date.now() - (3 * 24 * 60 * 60 * 1000) - (7 * 60 * 60 * 1000) + (42 * 60 * 1000),
        Date.now() - (45 * 60 * 1000),
        Date.now() - (7 * 24 * 60 * 60 * 1000) - (11 * 60 * 60 * 1000),
        Date.now() - (1 * 24 * 60 * 60 * 1000) - (2 * 60 * 60 * 1000),
      ];
      return parsed.map((s, i) => ({
        ...s,
        deployedAt: staggeredTimes[i % staggeredTimes.length]
      }));
    } catch { return []; }
  });
  
  // Saved strategies
  const [savedStrategies, setSavedStrategies] = useState(() => {
    try {
      const saved = localStorage.getItem('stratify-saved-strategies');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  
  const [demoState, setDemoState] = useState('idle');
  const [autoBacktestStrategy, setAutoBacktestStrategy] = useState(null);
  const [editingStrategy, setEditingStrategy] = useState(null);
  const [showNewsletter, setShowNewsletter] = useState(false);
  const [showBrokerModal, setShowBrokerModal] = useState(false);
  const [connectedBrokers, setConnectedBrokers] = useState(() => {
    try {
      const saved = localStorage.getItem('stratify-connected-brokers');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // ALL handlers from original Dashboard
  const handleStrategyGenerated = (strategy) => {
    setStrategies(prev => {
      if (prev.some(s => s.name === strategy.name)) return prev;
      return [...prev, { ...strategy, status: 'draft' }];
    });
  };

  const handleStrategyAdded = (strategy) => {
    setActiveTab('strategies');
    setContentTab('strategies');
    setTimeout(() => {
      setAutoBacktestStrategy(strategy);
    }, 800);
  };

  const handleDeleteStrategy = (strategyId) => {
    setStrategies(prev => prev.filter(s => s.id !== strategyId));
    setTimeout(() => {
      setStrategies(prev => {
        if (prev.length < 3) {
          return [...prev, generateRandomStrategy()];
        }
        return prev;
      });
    }, RESPAWN_DELAY_MS);
  };

  const handleEditStrategy = (strategy) => {
    setEditingStrategy(strategy);
  };

  const handleUpdateStrategy = (strategyId, updates) => {
    setStrategies(prev => prev.map(s => 
      s.id === strategyId 
        ? { ...s, ...updates, metrics: updates.metrics || s.metrics }
        : s
    ));
  };

  const handleSaveToSidebar = (strategy) => {
    setSavedStrategies(prev => {
      if (prev.some(s => s.id === strategy.id)) return prev;
      const maxDrawdown = parseFloat(strategy.metrics?.maxDrawdown) || 15;
      let riskLevel = 'medium';
      if (maxDrawdown <= 10) riskLevel = 'low';
      else if (maxDrawdown >= 18) riskLevel = 'high';
      return [...prev, { ...strategy, savedAt: Date.now(), riskLevel }];
    });
  };

  const handleRemoveSavedStrategy = (strategyId) => {
    setSavedStrategies(prev => prev.filter(s => s.id !== strategyId));
  };

  const handleDeployStrategy = (strategy) => {
    setStrategies(prev => prev.map(s => 
      s.id === strategy.id ? { ...s, status: 'deployed' } : s
    ));
    setDeployedStrategies(prev => {
      if (prev.some(s => s.name === strategy.name)) return prev;
      return [...prev, { ...strategy, status: 'deployed', runStatus: 'running', deployedAt: Date.now() }];
    });
    setAutoBacktestStrategy(null);
  };

  const handleDemoStateChange = (state) => {
    setDemoState(state);
    if (state === 'thinking') {
      setActiveTab('strategies');
    }
  };

  const handleConnectBroker = (broker) => {
    setConnectedBrokers(prev => {
      if (prev.some(b => b.id === broker.id)) return prev;
      return [...prev, broker];
    });
  };

  // Persist all state
  useEffect(() => {
    saveDashboardState({ sidebarExpanded, rightPanelWidth, activeTab, activeSection, theme });
  }, [sidebarExpanded, rightPanelWidth, activeTab, activeSection, theme]);

  useEffect(() => {
    localStorage.setItem('stratify-connected-brokers', JSON.stringify(connectedBrokers));
  }, [connectedBrokers]);

  useEffect(() => {
    localStorage.setItem('stratify-watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    localStorage.setItem('stratify-strategies', JSON.stringify(strategies));
  }, [strategies]);

  // Auto-populate demo data
  useEffect(() => {
    if (strategies.length === 0) {
      const timer = setTimeout(() => {
        setStrategies([
          generateRandomStrategy(),
          generateRandomStrategy(),
          generateRandomStrategy(),
        ]);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [strategies.length]);

  useEffect(() => {
    if (deployedStrategies.length === 0) {
      const timer = setTimeout(() => {
        setDeployedStrategies([
          generateRandomDeployedStrategy(),
          generateRandomDeployedStrategy(),
        ]);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [deployedStrategies.length]);

  useEffect(() => {
    localStorage.setItem('stratify-deployed-strategies', JSON.stringify(deployedStrategies));
  }, [deployedStrategies]);

  useEffect(() => {
    localStorage.setItem('stratify-saved-strategies', JSON.stringify(savedStrategies));
  }, [savedStrategies]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setConnectionStatus(alpacaData?.account ? 'connected' : 'disconnected');
    }, 1500);
    return () => clearTimeout(timer);
  }, [alpacaData]);

  // Watchlist handlers
  const addToWatchlist = (stock) => {
    if (!watchlist.find(s => s.symbol === stock.symbol)) {
      setWatchlist(prev => [...prev, stock]);
    }
  };

  const removeFromWatchlist = (symbol) => {
    setWatchlist(prev => prev.filter(s => s.symbol !== symbol));
  };

  // Kraken theme classes
  const themeClasses = {
    bg: 'bg-[#06060c]',
    surface: 'bg-[#0a0a10]',
    surfaceElevated: 'bg-[#12121a]',
    border: 'border-[#1e1e2d]',
    text: 'text-[#e0e0e6]',
    textMuted: 'text-[#6b6b80]',
    green: 'text-emerald-400',
    red: 'text-red-400',
    greenBg: 'bg-emerald-500/10',
    redBg: 'bg-red-500/10',
  };

  const draftStrategiesCount = strategies.filter(s => s.status !== 'deployed').length;

  // Portfolio stats (calculated)
  const portfolioValue = alpacaData?.account?.equity || 127432.18;
  const dayChange = alpacaData?.account?.equity ? (alpacaData.account.equity - alpacaData.account.last_equity) : 1823.45;
  const dayChangePercent = portfolioValue > 0 ? ((dayChange / portfolioValue) * 100).toFixed(2) : 1.45;

  return (
    <div className={`h-screen w-screen flex overflow-hidden ${themeClasses.bg} ${themeClasses.text}`}>
      
      {/* Left Sidebar - Uses existing Sidebar component */}
      <Sidebar 
        expanded={sidebarExpanded} 
        onToggle={(val) => setSidebarExpanded(val)} 
        activeSection={activeSection} 
        onSectionChange={setActiveSection} 
        theme={theme} 
        themeClasses={themeClasses}
        watchlist={watchlist}
        onRemoveFromWatchlist={removeFromWatchlist}
        onViewChart={(stock) => setSelectedStock(stock)}
        savedStrategies={savedStrategies}
        onRemoveSavedStrategy={handleRemoveSavedStrategy}
        onDeployStrategy={handleDeployStrategy}
        connectedBrokers={connectedBrokers}
        onOpenBrokerModal={() => setShowBrokerModal(true)}
      />
      
      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col overflow-hidden border-x ${themeClasses.border}`}>
        
        {/* Top Header with Index Cards */}
        <header className={`flex-shrink-0 border-b ${themeClasses.border} ${themeClasses.surface}`}>
          {/* Top Bar */}
          <div className={`h-14 px-6 flex items-center justify-between border-b ${themeClasses.border}`}>
            <div className="flex items-center gap-4">
              <h1 className="text-white font-semibold text-lg">Dashboard</h1>
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">PRO</span>
            </div>
            <div className="flex items-center gap-3">
              <button className={`p-2 ${themeClasses.textMuted} hover:text-white hover:bg-[#1e1e2d] rounded-lg transition-colors`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </button>
              <div className={`flex items-center gap-2 px-3 py-1.5 ${connectionStatus === 'connected' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/10 border-amber-500/30'} border rounded-lg`}>
                <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-400' : 'bg-amber-400'} animate-pulse`} />
                <span className={`text-sm font-medium ${connectionStatus === 'connected' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {connectionStatus === 'connected' ? 'Connected' : 'Connecting...'}
                </span>
              </div>
            </div>
          </div>
          
          {/* Index Cards Row */}
          <div className="px-6 py-4 flex gap-4 overflow-x-auto">
            <IndexCard
              title="Portfolio"
              value={`$${portfolioValue.toLocaleString()}`}
              change={parseFloat(dayChangePercent)}
              color="purple"
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>}
              onClick={() => setExpandedCard(expandedCard === 'portfolio' ? null : 'portfolio')}
              active={expandedCard === 'portfolio'}
            />
            <IndexCard
              title="Strategies"
              value={`${deployedStrategies.length} Live`}
              color="blue"
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L15 9L22 12L15 15L12 22L9 15L2 12L9 9L12 2Z"/></svg>}
              onClick={() => setExpandedCard(expandedCard === 'strategies' ? null : 'strategies')}
              active={expandedCard === 'strategies'}
            />
            <IndexCard
              title="Arb Opps"
              value="7 Found"
              color="cyan"
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>}
              onClick={() => setExpandedCard(expandedCard === 'arb' ? null : 'arb')}
              active={expandedCard === 'arb'}
            />
            <IndexCard
              title="Open Bets"
              value={`$${(strategies.length * 580).toLocaleString()}`}
              change={4.2}
              onClick={() => setExpandedCard(expandedCard === 'bets' ? null : 'bets')}
              active={expandedCard === 'bets'}
              color="emerald"
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
            />
            <IndexCard
              title="Today's P&L"
              value={`${dayChange >= 0 ? '+' : ''}$${Math.abs(dayChange).toLocaleString()}`}
              change={parseFloat(dayChangePercent)}
              color="amber"
              icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>}
              onClick={() => setExpandedCard(expandedCard === 'pnl' ? null : 'pnl')}
              active={expandedCard === 'pnl'}
            />
          </div>
          
          {/* Expanded Card Panel */}
          <AnimatePresence>
            {expandedCard === 'portfolio' && (
              <PortfolioPanel 
                portfolioValue={portfolioValue}
                dayChange={dayChange}
                dayChangePercent={dayChangePercent}
                alpacaData={alpacaData}
                onClose={() => setExpandedCard(null)}
              />
            )}
          </AnimatePresence>
        </header>
        
        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          
          {/* Chart Section (Collapsible) - Smooth Animation */}
          <motion.div 
            className={`flex-shrink-0 border-b ${themeClasses.border} overflow-hidden`}
            initial={false}
            animate={chartCollapsed ? "collapsed" : "expanded"}
            variants={chartVariants}
          >
            <div 
              className={`h-12 px-6 flex items-center justify-between ${themeClasses.surface} cursor-pointer hover:bg-[#12121a] transition-colors duration-200`}
              onClick={() => setChartCollapsed(!chartCollapsed)}
            >
              <div className="flex items-center gap-4">
                <motion.svg 
                  className={`w-4 h-4 ${themeClasses.textMuted}`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                  animate={{ rotate: chartCollapsed ? 0 : 90 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </motion.svg>
                <span className="text-white font-medium">Portfolio Growth</span>
                <div className="flex gap-2">
                  {['1D', '1W', '1M', '3M', 'YTD', 'ALL'].map(period => (
                    <button
                      key={period}
                      onClick={(e) => e.stopPropagation()}
                      className={`px-2 py-1 text-xs rounded transition-all duration-200 ${
                        period === '1M' ? 'bg-purple-500/20 text-purple-400' : `${themeClasses.textMuted} hover:text-white hover:bg-[#1e1e2d]`
                      }`}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-white font-mono text-lg">${portfolioValue.toLocaleString()}</span>
                <span className={`text-sm font-medium ${dayChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {dayChange >= 0 ? '+' : ''}{dayChangePercent}% today
                </span>
              </div>
            </div>
            
            <AnimatePresence>
              {!chartCollapsed && (
                <motion.div 
                  className="h-[calc(100%-48px)] px-6 py-4"
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  variants={contentFadeVariants}
                >
                  <PortfolioGrowthChart height={200} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          
          {/* Content Tabs - Smooth hover and active states */}
          <div className={`h-12 px-6 flex items-center gap-1 border-b ${themeClasses.border} ${themeClasses.surface}`}>
            {[
              { id: 'strategies', label: 'Strategies', badge: draftStrategiesCount },
              { id: 'arbitrage', label: 'Arb Scanner' },
              { id: 'deployed', label: 'Deployed', badge: deployedStrategies.length },
            ].map(tab => (
              <motion.button
                key={tab.id}
                onClick={() => setContentTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2 relative ${
                  contentTab === tab.id
                    ? 'text-white'
                    : `${themeClasses.textMuted} hover:text-white`
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
              >
                {contentTab === tab.id && (
                  <motion.div
                    className="absolute inset-0 bg-[#1e1e2d] rounded-lg"
                    layoutId="activeTab"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
                {tab.badge > 0 && (
                  <span className="relative z-10 px-1.5 py-0.5 text-[10px] bg-purple-500/30 text-purple-400 rounded-full">{tab.badge}</span>
                )}
              </motion.button>
            ))}
          </div>
          
          {/* Content Panel - Animated transitions between tabs */}
          <div className={`flex-1 overflow-hidden ${themeClasses.bg}`}>
            <AnimatePresence mode="wait">
              {contentTab === 'strategies' && (
              <motion.div
                key="strategies"
                className="h-full"
                initial="initial"
                animate="animate"
                exit="exit"
                variants={tabContentVariants}
              >
              <DataTable 
                activeTab={activeTab} 
                alpacaData={alpacaData} 
                strategies={strategies} 
                demoState={demoState} 
                theme={theme} 
                themeClasses={themeClasses} 
                onDeleteStrategy={handleDeleteStrategy}
                onDeployStrategy={handleDeployStrategy}
                onEditStrategy={handleEditStrategy}
                onSaveToSidebar={handleSaveToSidebar}
                onUpdateStrategy={handleUpdateStrategy}
                savedStrategies={savedStrategies}
                autoBacktestStrategy={autoBacktestStrategy}
              />
              </motion.div>
            )}
            {contentTab === 'arbitrage' && (
              <motion.div
                key="arbitrage"
                className="h-full"
                initial="initial"
                animate="animate"
                exit="exit"
                variants={tabContentVariants}
              >
                <ArbitragePanel themeClasses={themeClasses} />
              </motion.div>
            )}
            {contentTab === 'deployed' && (
              <motion.div
                key="deployed"
                className="h-full"
                initial="initial"
                animate="animate"
                exit="exit"
                variants={tabContentVariants}
              >
                <TerminalPanel 
                  themeClasses={themeClasses} 
                  deployedStrategies={deployedStrategies} 
                  onRemoveStrategy={(id) => {
                    setDeployedStrategies(prev => prev.filter(s => s.id !== id));
                    setTimeout(() => {
                      setDeployedStrategies(prev => {
                        if (prev.length < 2) {
                          return [...prev, generateRandomDeployedStrategy()];
                        }
                        return prev;
                      });
                    }, RESPAWN_DELAY_MS);
                  }}
                />
              </motion.div>
            )}
            </AnimatePresence>
          </div>

          {/* Settings Full Page Overlay - Smooth slide in */}
          <AnimatePresence>
            {activeSection === 'settings' && (
              <motion.div 
                className="absolute inset-0 z-20 bg-[#06060c] overflow-hidden"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <SettingsPage themeClasses={themeClasses} onClose={() => setActiveSection('watchlist')} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Newsletter Full Page Overlay - Smooth slide in */}
          <AnimatePresence>
            {activeSection === 'newsletter' && (
              <motion.div 
                className="absolute inset-0 z-20 bg-[#06060c] overflow-hidden"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <NewsletterPage themeClasses={themeClasses} onClose={() => setActiveSection('watchlist')} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      {/* Right Panel - Uses existing RightPanel (Atlas AI) */}
      <RightPanel 
        width={rightPanelWidth} 
        alpacaData={alpacaData} 
        theme={theme} 
        themeClasses={themeClasses} 
        onStrategyGenerated={handleStrategyGenerated} 
        onDemoStateChange={handleDemoStateChange}
        onStrategyAdded={handleStrategyAdded}
        editingStrategy={editingStrategy}
        onClearEdit={() => setEditingStrategy(null)}
      />
      
      {/* Stock Detail View Modal */}
      {selectedStock && (
        <StockDetailView 
          symbol={selectedStock.symbol}
          stockName={selectedStock.name}
          onClose={() => setSelectedStock(null)}
          themeClasses={themeClasses}
        />
      )}

      {/* Newsletter Modal */}
      <NewsletterModal 
        isOpen={showNewsletter} 
        onClose={() => setShowNewsletter(false)} 
      />

      {/* Broker Connect Modal */}
      <BrokerConnectModal 
        isOpen={showBrokerModal} 
        onClose={() => setShowBrokerModal(false)}
        onConnect={handleConnectBroker}
        connectedBrokers={connectedBrokers}
      />
    </div>
  );
}
