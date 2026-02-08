import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import Sidebar from './Sidebar';
import TopMetricsBar from './TopMetricsBar';
import LiveAlertsTicker from './LiveAlertsTicker';
import DataTable from './DataTable';
import RightPanel from './RightPanel';
import GrokPanel from './GrokPanel';
import StatusBar from './StatusBar';
import TerminalPanel from './TerminalPanel';
import ArbitragePanel from './ArbitragePanel';
import StockDetailView from './StockDetailView';
import NewsletterModal from './NewsletterModal';
import BrokerConnectModal from './BrokerConnectModal';
import NewsletterPage from './NewsletterPage';
import SettingsPage from './SettingsPage';
import StrategiesPage from './StrategiesPage';
import CollapsiblePanel, { PanelDivider } from './CollapsiblePanel';
import StrategyBuilder from './StrategyBuilder';
import AIChat from './AIChat';
import CommandPalette, { useCommandPalette, KeyboardShortcutsModal } from './CommandPalette';
import Home from './Home';
import WatchlistPage from './WatchlistPage';
import MarketsPage from './MarketsPage';
import PredictionsPage from './PredictionsPage';
import PortfolioPage from './PortfolioPage';
import HistoryPage from './HistoryPage';
import AnalyticsPage from './AnalyticsPage';
import TradePage from './TradePage';
import DemoPanel from './DemoPanel';
import StrategyTemplatesGallery from './StrategyTemplatesGallery';
import ActiveTrades, { strategiesSeed } from './ActiveTrades';
import ChallengeLeaderboard from './ChallengeLeaderboard';
import TrendScanner from './TrendScanner';
import FloatingGrokChat from './FloatingGrokChat';
import TerminalPage from './TerminalPage';
import TickerPill from './TickerPill';

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

// Demo respawn - Random strategy generator
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

export default function Dashboard({
  setCurrentPage,
  alpacaData,
  isSocialFeedOpen = false,
  onToggleSocialFeed = () => {},
  socialFeedUnread = false,
}) {
  const savedState = loadDashboardState();
  
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(savedState?.rightPanelWidth ?? 320);
  const [activeTab, setActiveTab] = useState('home');
  const [activeSection, setActiveSection] = useState(savedState?.activeSection ?? 'watchlist');
  const [isDragging, setIsDragging] = useState(false);
  const [theme, setTheme] = useState(savedState?.theme ?? 'dark');
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  
  // Terminal backtest state
  const [terminalBacktestResults, setTerminalBacktestResults] = useState(null);
  const [terminalStrategy, setTerminalStrategy] = useState({});
  const [terminalTicker, setTerminalTicker] = useState('TSLA');
  const [isTerminalLoading, setIsTerminalLoading] = useState(false);

  // Panel expanded states - single source of truth
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

  // Persist panel states
  useEffect(() => {
    localStorage.setItem('stratify-panel-states', JSON.stringify(panelStates));
  }, [panelStates]);

  // Toggle panel expanded state
  const togglePanel = useCallback((panelId) => {
    setPanelStates(prev => ({
      ...prev,
      [panelId]: !prev[panelId],
    }));
  }, []);
  
  const [watchlist, setWatchlist] = useState(() => {
    const DEFAULT_WATCHLIST = [
      { symbol: 'AAPL', name: 'Apple Inc.' },
      { symbol: 'GOOGL', name: 'Alphabet Inc.' },
      { symbol: 'AMZN', name: 'Amazon.com, Inc.' },
      { symbol: 'NVDA', name: 'NVIDIA Corporation' },
      { symbol: 'META', name: 'Meta Platforms, Inc.' },
      { symbol: 'TSLA', name: 'Tesla, Inc.' },
      { symbol: 'MSFT', name: 'Microsoft Corporation' },
      { symbol: 'HOOD', name: 'Robinhood Markets, Inc.' },
    ];
    try {
      const saved = localStorage.getItem('stratify-watchlist');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.length > 0 ? parsed : DEFAULT_WATCHLIST;
      }
      return DEFAULT_WATCHLIST;
    } catch { return DEFAULT_WATCHLIST; }
  });
  
  // Mini ticker pills (slots 2-5, slots 0-1 are Grok and Feed)
  const [miniTickers, setMiniTickers] = useState(() => {
    try {
      const saved = localStorage.getItem('stratify-mini-tickers');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  
  // Save mini tickers to localStorage
  useEffect(() => {
    localStorage.setItem('stratify-mini-tickers', JSON.stringify(miniTickers));
  }, [miniTickers]);
  
  // Handle dropping a ticker onto a pill slot
  const handleTickerDrop = (symbol, slotIndex) => {
    if (slotIndex < 2) return; // Slots 0-1 are reserved for Grok/Feed
    const tickerIndex = slotIndex - 2; // Map to miniTickers array
    setMiniTickers(prev => {
      const newTickers = [...prev];
      // Remove if already exists elsewhere
      const existingIndex = newTickers.indexOf(symbol);
      if (existingIndex !== -1) newTickers.splice(existingIndex, 1);
      // Add to new slot (max 4 tickers)
      while (newTickers.length < tickerIndex) newTickers.push(null);
      newTickers[tickerIndex] = symbol;
      return newTickers.slice(0, 4);
    });
  };
  
  // Remove ticker from pill
  const handleRemoveMiniTicker = (symbol) => {
    setMiniTickers(prev => prev.filter(t => t !== symbol));
  };
  
  const [selectedStock, setSelectedStock] = useState(null);
  const [strategies, setStrategies] = useState(() => {
    try {
      const saved = localStorage.getItem('stratify-strategies');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [deployedStrategies, setDeployedStrategies] = useState(() => {
    const staggeredTimes = [
      Date.now() - (14 * 24 * 60 * 60 * 1000) - (3 * 60 * 60 * 1000) + (17 * 60 * 1000),
      Date.now() - (3 * 24 * 60 * 60 * 1000) - (7 * 60 * 60 * 1000) + (42 * 60 * 1000),
      Date.now() - (45 * 60 * 1000),
      Date.now() - (7 * 24 * 60 * 60 * 1000) - (11 * 60 * 60 * 1000),
      Date.now() - (1 * 24 * 60 * 60 * 1000) - (2 * 60 * 60 * 1000),
      Date.now() - (5 * 24 * 60 * 60 * 1000) - (8 * 60 * 60 * 1000),
    ];
    // Always use strategiesSeed as the source of truth for active strategies
    return strategiesSeed.map((s, i) => ({
      ...s,
      deployedAt: staggeredTimes[i % staggeredTimes.length]
    }));
  });
  const [savedStrategies, setSavedStrategies] = useState(() => {
    try {
      const saved = localStorage.getItem('stratify-saved-strategies');
      if (saved) return JSON.parse(saved);
      // Default sample strategies
      return [
        { id: 'sample-1', name: 'Golden Cross NVDA', type: 'Momentum', status: 'active', winRate: 68, trades: 42, pnl: 2847.50, folderId: 'favorites' },
        { id: 'sample-2', name: 'RSI Reversal SPY', type: 'Mean Reversion', status: 'paused', winRate: 54, trades: 156, pnl: 1234.00, folderId: 'active' },
        { id: 'sample-3', name: 'VWAP Bounce QQQ', type: 'Scalping', status: 'active', winRate: 72, trades: 89, pnl: 956.25, folderId: 'grok' },
        { id: 'sample-4', name: 'Breakout Hunter TSLA', type: 'Breakout', status: 'paused', winRate: 45, trades: 23, pnl: -312.00, folderId: 'favorites' },
        { id: 'sample-5', name: 'MACD Crossover AAPL', type: 'Trend', status: 'active', winRate: 61, trades: 67, pnl: 1567.80, folderId: 'grok' },
      ];
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
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [isGrokPanelCollapsed, setIsGrokPanelCollapsed] = useState(false);
  const [isFloatingGrokOpen, setIsFloatingGrokOpen] = useState(false);
  const [grokMessageCount, setGrokMessageCount] = useState(0);

  // Command palette navigation handler
  const handleCommandNavigate = useCallback((target) => {
    switch (target) {
      case 'dashboard':
      case 'watchlist':
        setActiveSection('watchlist');
        break;
      case 'strategies':
        setActiveSection('strategies');
        break;
      case 'builder':
        setActiveSection('watchlist');
        setPanelStates(prev => ({ ...prev, strategyBuilder: true }));
        break;
      case 'arbitrage':
        setActiveSection('watchlist');
        setPanelStates(prev => ({ ...prev, arbitrageScanner: true }));
        break;
      case 'settings':
        setActiveSection('settings');
        break;
      default:
        break;
    }
  }, []);

  // Command palette action handler
  const handleCommandAction = useCallback((action, data) => {
    switch (action) {
      case 'newStrategy':
        setActiveSection('watchlist');
        setPanelStates(prev => ({ ...prev, strategyBuilder: true }));
        break;
      case 'openAI':
        setActiveSection('watchlist');
        // Focus the AI chat input
        setTimeout(() => {
          const aiInput = document.querySelector('[data-ai-chat-input]');
          aiInput?.focus();
        }, 100);
        break;
      case 'runBacktest':
        // Will trigger backtest on selected strategy
        break;
      case 'deployStrategy':
        // Will deploy selected strategy
        break;
      case 'searchStock':
        // Focus the search bar
        setTimeout(() => {
          const searchInput = document.querySelector('[data-search-input]');
          searchInput?.focus();
        }, 100);
        break;
      case 'showShortcuts':
        setShowShortcutsModal(true);
        break;
      case 'editStrategy':
        if (data) setEditingStrategy(data);
        break;
      case 'viewDeployed':
        setActiveSection('watchlist');
        setPanelStates(prev => ({ ...prev, deployedStrategies: true }));
        break;
      default:
        break;
    }
  }, []);

  // Command palette hook
  const commandPalette = useCommandPalette({
    onNavigate: handleCommandNavigate,
    onAction: handleCommandAction,
    onThemeToggle: () => setTheme(t => t === 'dark' ? 'light' : 'dark'),
  });

  const handleStrategyGenerated = (strategy) => {
    setStrategies(prev => {
      if (prev.some(s => s.name === strategy.name)) return prev;
      return [...prev, { ...strategy, status: 'draft' }];
    });
  };

  const handleStrategyAdded = (strategy) => {
    setActiveTab('strategies');
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

  const handleSelectTemplate = (template) => {
    if (!template) return;
    const winRate = parseFloat(template.metrics?.winRate) || 0;
    const templateStrategy = {
      id: template.id,
      name: template.name,
      type: template.category || 'Template',
      status: 'draft',
      winRate,
      trades: 0,
      pnl: 0,
      description: template.description,
      folderId: 'stratify-templates',
      templateId: template.id,
      source: 'template',
      savedAt: Date.now(),
    };

    setSavedStrategies(prev => {
      const existing = prev.find(s => s.id === templateStrategy.id);
      if (existing) {
        return prev.map(s =>
          s.id === templateStrategy.id
            ? { ...templateStrategy, ...s, folderId: 'stratify-templates' }
            : s
        );
      }
      return [...prev, templateStrategy];
    });

    setActiveTab('strategies');
  };

  const handleDeployStrategy = (strategy, navigateToActive = false) => {
    const strategyId = strategy.id || `strat-${Date.now()}`;
    
    // Convert saved strategy to active trade format
    const activeStrategy = {
      id: strategyId,
      symbol: strategy.symbol || strategy.ticker || strategy.name?.split(' ')[0] || 'CUSTOM',
      name: strategy.name,
      status: 'Live',
      pnl: 0,
      pnlPct: 0,
      heat: Math.floor(Math.random() * 40) + 50,
      deployedAt: Date.now(),
    };

    setDeployedStrategies(prev => {
      if (prev.some(s => s.id === activeStrategy.id)) return prev;
      return [...prev, activeStrategy];
    });

    // Auto-save to savedStrategies in "Uncategorized" folder if not already saved
    setSavedStrategies(prev => {
      const exists = prev.some(s => s.id === strategyId);
      if (exists) {
        // Mark as deployed
        return prev.map(s => s.id === strategyId ? { ...s, status: 'active', deployed: true } : s);
      } else {
        // Add new strategy to Uncategorized folder
        const newSavedStrategy = {
          id: strategyId,
          name: strategy.name || `${strategy.ticker || 'Custom'} Strategy`,
          type: strategy.type || 'Custom',
          status: 'active',
          deployed: true,
          winRate: strategy.backtestResults?.winRate || 0,
          trades: strategy.backtestResults?.totalTrades || 0,
          pnl: strategy.backtestResults?.totalPnL || 0,
          folderId: 'uncategorized',
          ticker: strategy.ticker,
          entry: strategy.entry,
          exit: strategy.exit,
          stopLoss: strategy.stopLoss,
          positionSize: strategy.positionSize,
          createdAt: Date.now(),
        };
        return [...prev, newSavedStrategy];
      }
    });

    if (navigateToActive) {
      setActiveTab('active');
    }

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

  // Terminal backtest handler
  const handleTerminalBacktest = async (strategy) => {
    const ticker = (strategy.ticker || terminalTicker || 'TSLA').replace(/\$/g, '').split(',')[0].trim();
    setTerminalStrategy(strategy);
    setTerminalTicker(ticker);
    setIsTerminalLoading(true);
    
    try {
      const response = await fetch('https://stratify-backend-production-3ebd.up.railway.app/api/backtest/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker,
          strategy: {
            entry: strategy.entry || 'Buy when RSI drops below 30',
            exit: strategy.exit || 'Sell when RSI rises above 70',
            stopLoss: strategy.stopLoss || '5%',
            positionSize: strategy.positionSize || '100 shares',
          },
          period: '6mo',
          timeframe: '1Day',
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setTerminalBacktestResults(data);
    } catch (err) {
      console.error('Terminal backtest error:', err);
      setTerminalBacktestResults({ error: err.message });
    } finally {
      setIsTerminalLoading(false);
    }
  };

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
    localStorage.setItem('stratify-deployed-strategies-v2', JSON.stringify(deployedStrategies));
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

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const newWidth = window.innerWidth - e.clientX;
    setRightPanelWidth(Math.min(500, Math.max(280, newWidth)));
  };

  const addToWatchlist = (stock) => {
    // Handle both string (symbol) and object inputs
    const stockObj = typeof stock === 'string' ? { symbol: stock, name: stock } : stock;
    if (!watchlist.find(s => s.symbol === stockObj.symbol)) {
      setWatchlist(prev => [...prev, stockObj]);
    }
  };

  const removeFromWatchlist = (symbol) => {
    setWatchlist(prev => prev.filter(s => {
      // Handle both string items and object items
      const itemSymbol = typeof s === 'string' ? s : s.symbol;
      return itemSymbol !== symbol;
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  };

  useEffect(() => {
    if (isDragging) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const themeClasses = theme === 'dark' ? {
    bg: 'bg-[#0d0d12]',
    surface: 'bg-[#0d0d12]',
    surfaceElevated: 'bg-[#0f0f14]',
    border: 'border-[#1e1e2d]',
    text: 'text-white',
    textMuted: 'text-gray-500',
    green: 'text-emerald-400',
    red: 'text-red-400',
    greenBg: 'bg-emerald-500/10',
    redBg: 'bg-red-500/10',
  } : {
    bg: 'bg-[#FFFFFF]',
    surface: 'bg-white',
    surfaceElevated: 'bg-[#F8F9FA]',
    border: 'border-[#DADCE0]',
    text: 'text-[#202124]',
    textMuted: 'text-[#5f6368]',
    green: 'text-[#137333]',
    red: 'text-[#A50E0E]',
    greenBg: 'bg-[#137333]/10',
    redBg: 'bg-[#A50E0E]/10',
  };

  const draftStrategiesCount = strategies.filter(s => s.status !== 'deployed').length;

  return (
    <div className={`h-screen w-screen flex flex-col ${themeClasses.bg} ${themeClasses.text} overflow-hidden`}>
      <TopMetricsBar 
        alpacaData={alpacaData} 
        onAddToWatchlist={addToWatchlist} 
        theme={theme} 
        themeClasses={themeClasses} 
        onThemeToggle={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} 
        onLogout={() => setCurrentPage('landing')} 
        onLegendClick={() => setActiveTab('legend')}
        connectedBrokers={connectedBrokers}
        miniPills={[
          // Slot 0: Grok pill - ALWAYS visible
          <div
            key="grok-pill"
            onClick={() => setIsFloatingGrokOpen((prev) => !prev)}
            className={`h-8 flex items-center gap-2 pl-2.5 pr-3 rounded-full border bg-black/90 cursor-pointer transition-all ${
              isFloatingGrokOpen
                ? 'border-emerald-400/60 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                : 'border-white/20 hover:border-white/40'
            }`}
          >
            <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-3 h-3 text-emerald-400" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </div>
            <span className="text-white font-medium text-xs">Grok</span>
            {grokMessageCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-medium">
                {grokMessageCount}
              </span>
            )}
          </div>,
          // Slot 1: Kalshi predictions feed pill
          <div
            key="kalshi-pill"
            onClick={onToggleSocialFeed}
            className={`relative h-8 flex items-center gap-2 pl-2.5 pr-3 rounded-full cursor-pointer transition-all ${
              isSocialFeedOpen
                ? 'border border-emerald-400/40 bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                : 'border border-white/20 bg-black/90 hover:border-emerald-400/40'
            }`}
          >
            <div className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
            </div>
            <span className="text-white font-medium text-xs">Kalshi</span>
            {socialFeedUnread && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.9)]" />
            )}
          </div>,
          // Slots 2-5: Draggable ticker pills
          ...[0, 1, 2, 3].map((i) => 
            miniTickers[i] ? (
              <TickerPill 
                key={`ticker-pill-${i}`} 
                symbol={miniTickers[i]} 
                onRemove={handleRemoveMiniTicker}
              />
            ) : null
          )
        ]}
        onTickerDrop={handleTickerDrop}
      />
      <LiveAlertsTicker />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          savedStrategies={savedStrategies}
          deployedStrategies={deployedStrategies}
          onRemoveSavedStrategy={handleRemoveSavedStrategy}
          grokPanelCollapsed={isGrokPanelCollapsed}
        />
        
        {/* Main Content Area - Three Collapsible Panels */}
        <div 
          id="main-content-area" 
          className={`flex-1 flex flex-col ${themeClasses.surface} border-x ${themeClasses.border} overflow-hidden relative`}
        >
          {/* Tab-based Views */}
          {activeTab === 'home' && (
            <Home
              themeClasses={themeClasses}
              connectedBrokers={connectedBrokers}
              onBrokerConnect={(broker) => setConnectedBrokers(prev => [...prev, broker])}
              onBrokerDisconnect={(brokerId) => setConnectedBrokers(prev => prev.filter(b => b.id !== brokerId))}
              onBrokerUpdate={(brokerId, updates) => setConnectedBrokers(prev => 
                prev.map(b => b.id === brokerId ? { ...b, ...updates } : b)
              )}
            />
          )}
          {activeTab === 'watchlist' && <WatchlistPage themeClasses={themeClasses} watchlist={watchlist} onAddToWatchlist={addToWatchlist} onRemoveFromWatchlist={removeFromWatchlist} />}
          {activeTab === 'strategies' && (
            <StrategiesPage 
              themeClasses={themeClasses}
              savedStrategies={savedStrategies}
              deployedStrategies={deployedStrategies}
              onDeployStrategy={handleDeployStrategy}
              onEditStrategy={(strategy) => {
                setActiveTab('builder');
                // Could add edit logic here
              }}
              onRemoveSavedStrategy={handleRemoveSavedStrategy}
            />
          )}
          {activeTab === 'trade' && (
            <TradePage watchlist={watchlist} onAddToWatchlist={addToWatchlist} onRemoveFromWatchlist={removeFromWatchlist} />
          )}
          {activeTab === 'markets' && <MarketsPage themeClasses={themeClasses} />}
          {activeTab === 'predictions' && <PredictionsPage themeClasses={themeClasses} />}
          {activeTab === 'analytics' && <AnalyticsPage themeClasses={themeClasses} />}
          {activeTab === 'grok' && <DemoPanel />}
          {activeTab === 'portfolio' && (
            <PortfolioPage
              themeClasses={themeClasses}
              alpacaData={alpacaData}
              connectedBrokers={connectedBrokers}
              onBrokerConnect={(broker) => setConnectedBrokers(prev => [...prev, broker])}
              onBrokerDisconnect={(brokerId) => setConnectedBrokers(prev => prev.filter(b => b.id !== brokerId))}
            />
          )}
          {activeTab === 'history' && <HistoryPage themeClasses={themeClasses} />}
          {activeTab === 'templates' && (
            <StrategyTemplatesGallery 
              themeClasses={themeClasses} 
              onSelectTemplate={handleSelectTemplate}
              onSaveToStrategies={(strategy) => {
                setSavedStrategies(prev => [...prev, strategy]);
                setActiveTab('strategies');
              }}
            />
          )}
          {activeTab === 'active' && <ActiveTrades setActiveTab={setActiveTab} strategies={deployedStrategies} setStrategies={setDeployedStrategies} />}
          {activeTab === 'legend' && <ChallengeLeaderboard isPaid={true} />}
          {activeTab === 'trends' && <TrendScanner />}
          {activeTab === 'terminal' && (
            <TerminalPage
              backtestResults={terminalBacktestResults}
              strategy={terminalStrategy}
              ticker={terminalTicker}
              onRunBacktest={handleTerminalBacktest}
              isLoading={isTerminalLoading}
              onDeploy={(strategy) => {
                setDeployedStrategies(prev => [...prev, strategy]);
              }}
              onNavigateToActive={() => setActiveTab('active')}
            />
          )}
          {activeTab === 'more' && (
            <div className="h-full overflow-y-auto bg-[#0a0a0f] p-6" style={{ scrollbarWidth: 'none' }}>
              <div className="max-w-2xl mx-auto">
                <h2 className="text-2xl font-semibold text-white mb-2">Account & Contact</h2>
                <p className="text-gray-400 mb-8">Manage your account settings and get in touch with us.</p>
                
                {/* User Info Card */}
                <div className="bg-[#0d0d12] border border-[#1e1e2d] rounded-2xl p-6 mb-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Your Profile
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Name</label>
                      <input type="text" defaultValue="Jeff Thompson" className="w-full rounded-lg border border-[#2a2a3d] bg-[#0a0a0f] px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Email</label>
                      <input type="email" defaultValue="jeff@stratify.associates" className="w-full rounded-lg border border-[#2a2a3d] bg-[#0a0a0f] px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Phone</label>
                      <input type="tel" placeholder="(555) 123-4567" className="w-full rounded-lg border border-[#2a2a3d] bg-[#0a0a0f] px-4 py-2.5 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Timezone</label>
                      <select className="w-full rounded-lg border border-[#2a2a3d] bg-[#0a0a0f] px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40">
                        <option>Eastern (EST)</option>
                        <option>Central (CST)</option>
                        <option>Mountain (MST)</option>
                        <option>Pacific (PST)</option>
                      </select>
                    </div>
                  </div>
                  <button className="mt-4 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-medium transition-colors">
                    Save Profile
                  </button>
                </div>

                {/* Contact Form */}
                <div className="bg-[#0d0d12] border border-[#1e1e2d] rounded-2xl p-6 mb-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Contact Us
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Subject</label>
                      <select className="w-full rounded-lg border border-[#2a2a3d] bg-[#0a0a0f] px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40">
                        <option>General Inquiry</option>
                        <option>Technical Support</option>
                        <option>Billing Question</option>
                        <option>Feature Request</option>
                        <option>Bug Report</option>
                        <option>Partnership</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Message</label>
                      <textarea rows={4} placeholder="How can we help you?" className="w-full rounded-lg border border-[#2a2a3d] bg-[#0a0a0f] px-4 py-2.5 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none" />
                    </div>
                    <button className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-white font-medium transition-colors flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Send Message
                    </button>
                  </div>
                </div>

                {/* Quick Links */}
                <div className="bg-[#0d0d12] border border-[#1e1e2d] rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Quick Links</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#0a0a0f] border border-[#2a2a3d] hover:border-emerald-500/40 transition-colors">
                      <span className="text-2xl">📚</span>
                      <span className="text-white text-sm font-medium">Documentation</span>
                    </a>
                    <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#0a0a0f] border border-[#2a2a3d] hover:border-emerald-500/40 transition-colors">
                      <span className="text-2xl">💬</span>
                      <span className="text-white text-sm font-medium">Discord Community</span>
                    </a>
                    <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#0a0a0f] border border-[#2a2a3d] hover:border-emerald-500/40 transition-colors">
                      <span className="text-2xl">🐦</span>
                      <span className="text-white text-sm font-medium">Follow on X</span>
                    </a>
                    <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#0a0a0f] border border-[#2a2a3d] hover:border-emerald-500/40 transition-colors">
                      <span className="text-2xl">📧</span>
                      <span className="text-white text-sm font-medium">Email Support</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <GrokPanel 
          onCollapsedChange={setIsGrokPanelCollapsed}
          onBacktestResults={(results, strategy, ticker) => {
            // Batch state updates before switching tabs
            setTerminalBacktestResults(results);
            setTerminalStrategy(strategy || {});
            setTerminalTicker(ticker || 'SPY');
            // Use setTimeout to ensure state is set before tab switch
            setTimeout(() => setActiveTab('terminal'), 50);
          }}
          onSaveStrategy={(strategy) => {
            setSavedStrategies(prev => {
              // Don't add if already exists
              if (prev.some(s => s.id === strategy.id)) {
                return prev.map(s => s.id === strategy.id ? { ...s, ...strategy } : s);
              }
              return [...prev, strategy];
            });
          }}
          onDeployStrategy={(strategy) => {
            // Add to saved strategies
            setSavedStrategies(prev => {
              if (prev.some(s => s.id === strategy.id)) {
                return prev.map(s => s.id === strategy.id ? { ...s, ...strategy, deployed: true } : s);
              }
              return [...prev, strategy];
            });
            // Also add to deployed strategies
            setDeployedStrategies(prev => {
              if (prev.some(s => s.id === strategy.id)) {
                return prev.map(s => s.id === strategy.id ? { ...s, ...strategy, runStatus: 'running' } : s);
              }
              return [...prev, { ...strategy, status: 'deployed', runStatus: 'running' }];
            });
          }}
        />
      </div>
      <StatusBar connectionStatus={connectionStatus} theme={theme} themeClasses={themeClasses} onOpenNewsletter={() => setShowNewsletter(true)} />

      {selectedStock && (
        <StockDetailView 
          symbol={selectedStock.symbol}
          stockName={selectedStock.name}
          onClose={() => setSelectedStock(null)}
          themeClasses={themeClasses}
        />
      )}

      <NewsletterModal 
        isOpen={showNewsletter} 
        onClose={() => setShowNewsletter(false)} 
      />

      <BrokerConnectModal 
        isOpen={showBrokerModal} 
        onClose={() => setShowBrokerModal(false)}
        onConnect={handleConnectBroker}
        connectedBrokers={connectedBrokers}
      />

      <FloatingGrokChat
        isOpen={isFloatingGrokOpen}
        onClose={() => setIsFloatingGrokOpen(false)}
        onMessageCountChange={setGrokMessageCount}
      />

      {/* Command Palette - ⌘K to open */}
      <CommandPalette
        isOpen={commandPalette.isOpen}
        onClose={commandPalette.close}
        onNavigate={handleCommandNavigate}
        onAction={handleCommandAction}
        strategies={strategies}
        deployedStrategies={deployedStrategies}
        theme={theme}
        onThemeToggle={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
      />

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />

    </div>
  );
}
