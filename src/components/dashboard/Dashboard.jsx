import { useState, useEffect, useCallback } from 'react';
import Sidebar from './Sidebar';
import TopMetricsBar from './TopMetricsBar';
import DataTable from './DataTable';
import RightPanel from './RightPanel';
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

export default function Dashboard({ setCurrentPage, alpacaData }) {
  const savedState = loadDashboardState();
  
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(savedState?.rightPanelWidth ?? 320);
  const [activeTab, setActiveTab] = useState('strategies');
  const [activeSection, setActiveSection] = useState(savedState?.activeSection ?? 'watchlist');
  const [isDragging, setIsDragging] = useState(false);
  const [theme, setTheme] = useState(savedState?.theme ?? 'dark');
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  
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
    try {
      const saved = localStorage.getItem('stratify-watchlist');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [selectedStock, setSelectedStock] = useState(null);
  const [strategies, setStrategies] = useState(() => {
    try {
      const saved = localStorage.getItem('stratify-strategies');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
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

  const handleDeployStrategy = (strategy) => {
    const nextStatus = strategy.status === 'paper' ? 'paper' : 'deployed';

    setStrategies(prev => prev.map(s => 
      s.id === strategy.id ? { ...s, status: nextStatus } : s
    ));

    if (nextStatus === 'paper') {
      setDeployedStrategies(prev => prev.filter(s => s.id !== strategy.id));
    } else {
      setDeployedStrategies(prev => {
        if (prev.some(s => s.id === strategy.id)) return prev;
        return [...prev, { ...strategy, status: 'deployed', runStatus: 'running', deployedAt: Date.now() }];
      });
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

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const newWidth = window.innerWidth - e.clientX;
    setRightPanelWidth(Math.min(500, Math.max(280, newWidth)));
  };

  const addToWatchlist = (stock) => {
    if (!watchlist.find(s => s.symbol === stock.symbol)) {
      setWatchlist(prev => [...prev, stock]);
    }
  };

  const removeFromWatchlist = (symbol) => {
    setWatchlist(prev => prev.filter(s => s.symbol !== symbol));
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
    bg: 'bg-[#0a0a0f]',
    surface: 'bg-[#0a0a0f]',
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
        connectedBrokers={connectedBrokers} 
      />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          expanded={sidebarExpanded} 
          onToggle={(val) => setSidebarExpanded(val)} 
          activeSection={activeSection} 
          onSectionChange={setActiveSection} 
          theme={theme} 
          themeClasses={themeClasses}
          watchlist={watchlist}
          onRemoveFromWatchlist={removeFromWatchlist}
          onAddToWatchlist={addToWatchlist}
          onViewChart={(stock) => setSelectedStock(stock)}
          savedStrategies={savedStrategies}
          onRemoveSavedStrategy={handleRemoveSavedStrategy}
          onDeployStrategy={handleDeployStrategy}
          connectedBrokers={connectedBrokers}
          onOpenBrokerModal={() => setShowBrokerModal(true)}
        />
        
        {/* Main Content Area - Three Collapsible Panels */}
        <div 
          id="main-content-area" 
          className={`flex-1 flex flex-col ${themeClasses.surface} border-x ${themeClasses.border} overflow-hidden relative`}
        >
          {/* Settings/Newsletter Overlays */}
          {activeSection === 'settings' && (
            <div className="absolute inset-0 z-20 bg-[#0a0a0f] overflow-hidden">
              <SettingsPage themeClasses={themeClasses} onClose={() => setActiveSection('watchlist')} />
            </div>
          )}
          {activeSection === 'newsletter' && (
            <div className="absolute inset-0 z-20 bg-[#0a0a0f] overflow-hidden">
              <NewsletterPage themeClasses={themeClasses} onClose={() => setActiveSection('watchlist')} />
            </div>
          )}

          {/* Main Content - Show StrategiesPage OR the collapsible panels */}
          {activeSection === 'strategies' ? (
            /* Strategies Page - shows in middle content area */
            <div className="flex-1 overflow-hidden">
              <StrategiesPage savedStrategies={savedStrategies} onClose={() => setActiveSection('watchlist')} />
            </div>
          ) : (
            /* Panel Container - Flex column with proper distribution */
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              
              {/* Strategy Builder Panel */}
              <CollapsiblePanel
                id="strategyBuilder"
                title="Strategy Builder"
                badge={draftStrategiesCount > 0 ? draftStrategiesCount : null}
                badgeColor="bg-purple-500/20 text-purple-400"
                expanded={panelStates.strategyBuilder}
                onToggle={() => togglePanel('strategyBuilder')}
                themeClasses={themeClasses}
              >
                <StrategyBuilder 
                  strategies={strategies} 
                  deployedStrategies={deployedStrategies}
                  onStrategyGenerated={handleStrategyGenerated}
                  onDeleteStrategy={handleDeleteStrategy}
                  onDeployStrategy={handleDeployStrategy}
                  onUpdateStrategy={handleUpdateStrategy}
                  themeClasses={themeClasses}
                />
              </CollapsiblePanel>
              {/* Divider between Strategy Builder and Arb Scanner */}
              {panelStates.strategyBuilder && panelStates.arbitrageScanner && (
                <PanelDivider />
              )}

              {/* Arbitrage Scanner Panel */}
              <CollapsiblePanel
                id="arbitrageScanner"
                title="Arbitrage Scanner"
                badgeColor="bg-amber-500/20 text-amber-400"
                expanded={panelStates.arbitrageScanner}
                onToggle={() => togglePanel('arbitrageScanner')}
                statusDot={true}
                statusColor="amber"
                themeClasses={themeClasses}
              >
                <ArbitragePanel themeClasses={themeClasses} embedded={true} />
              </CollapsiblePanel>

              {/* Divider between Arb Scanner and Deployed Strategies */}
              {panelStates.arbitrageScanner && panelStates.deployedStrategies && (
                <PanelDivider />
              )}

              {/* Deployed Strategies Panel */}
              <CollapsiblePanel
                id="deployedStrategies"
                title="Deployed Strategies"
                badge={deployedStrategies.length > 0 ? `${deployedStrategies.length} active` : null}
                badgeColor="bg-emerald-500/20 text-emerald-400"
                expanded={panelStates.deployedStrategies}
                onToggle={() => togglePanel('deployedStrategies')}
                statusDot={deployedStrategies.length > 0}
                statusColor="emerald"
                themeClasses={themeClasses}
              >
                <TerminalPanel 
                  themeClasses={themeClasses} 
                  deployedStrategies={deployedStrategies} 
                  embedded={true}
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
              </CollapsiblePanel>

              {/* AI Chat Panel */}
              <div className="mt-4 h-96">
                <AIChat />
              </div>
            </div>
          )}
        </div>
        
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
    </div>
  );
}
