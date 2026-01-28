import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import TopMetricsBar from './TopMetricsBar';
import DataTable from './DataTable';
import RightPanel from './RightPanel';
import StatusBar from './StatusBar';
import TerminalPanel from './TerminalPanel';
import StockDetailView from './StockDetailView';
import NewsletterModal from './NewsletterModal';
import BrokerConnectModal from './BrokerConnectModal';

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

export default function Dashboard({ setCurrentPage, alpacaData }) {
  const savedState = loadDashboardState();
  
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [rightPanelWidth, setRightPanelWidth] = useState(savedState?.rightPanelWidth ?? 320);
  const [activeTab, setActiveTab] = useState('strategies');
  const [activeSection, setActiveSection] = useState(savedState?.activeSection ?? 'watchlist');
  const [isDragging, setIsDragging] = useState(false);
  const [theme, setTheme] = useState(savedState?.theme ?? 'dark');
  const [connectionStatus, setConnectionStatus] = useState('connecting');
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
      // Assign varied deployedAt timestamps for demo realism
      const staggeredTimes = [
        Date.now() - (14 * 24 * 60 * 60 * 1000) - (3 * 60 * 60 * 1000) + (17 * 60 * 1000), // ~2 weeks ago
        Date.now() - (3 * 24 * 60 * 60 * 1000) - (7 * 60 * 60 * 1000) + (42 * 60 * 1000),  // ~3 days ago
        Date.now() - (45 * 60 * 1000),  // ~45 minutes ago
        Date.now() - (7 * 24 * 60 * 60 * 1000) - (11 * 60 * 60 * 1000), // ~1 week ago
        Date.now() - (1 * 24 * 60 * 60 * 1000) - (2 * 60 * 60 * 1000),  // ~1 day ago
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

  // Called when strategy is added to center - trigger auto backtest
  const handleStrategyAdded = (strategy) => {
    // Make sure we're on the strategies tab
    setActiveTab('strategies');
    
    // Trigger auto backtest animation after a short delay
    setTimeout(() => {
      setAutoBacktestStrategy(strategy);
    }, 800);
  };

  const handleDeleteStrategy = (strategyId) => {
    setStrategies(prev => prev.filter(s => s.id !== strategyId));
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
      // Determine risk level based on max drawdown
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
    // Update strategy status to deployed (keep in list for modification)
    setStrategies(prev => prev.map(s => 
      s.id === strategy.id ? { ...s, status: 'deployed' } : s
    ));
    // Add to deployed strategies list
    setDeployedStrategies(prev => {
      if (prev.some(s => s.name === strategy.name)) return prev;
      return [...prev, { ...strategy, status: 'deployed', runStatus: 'running', deployedAt: Date.now() }];
    });
    // Clear auto backtest
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

  // Persist connected brokers
  useEffect(() => {
    localStorage.setItem('stratify-connected-brokers', JSON.stringify(connectedBrokers));
  }, [connectedBrokers]);

  useEffect(() => {
    localStorage.setItem('stratify-watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  // Persist strategies to localStorage
  useEffect(() => {
    localStorage.setItem('stratify-strategies', JSON.stringify(strategies));
  }, [strategies]);

  // Persist deployed strategies to localStorage
  useEffect(() => {
    localStorage.setItem('stratify-deployed-strategies', JSON.stringify(deployedStrategies));
  }, [deployedStrategies]);

  // Persist saved strategies to localStorage
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

  // Google Finance color scheme
  const themeClasses = theme === 'dark' ? {
    bg: 'bg-[#202124]',           // Google dark background
    surface: 'bg-[#202124]',
    surfaceElevated: 'bg-[#303134]', // Google surface
    border: 'border-[#5f6368]',
    text: 'text-[#E8EAED]',       // Google primary text
    textMuted: 'text-[#9AA0A6]',  // Google secondary text
    green: 'text-[#00C853]',      // Google Finance green
    red: 'text-[#F44336]',        // Google Finance red
    greenBg: 'bg-[#00C853]/10',
    redBg: 'bg-[#F44336]/10',
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
      <TopMetricsBar alpacaData={alpacaData} onAddToWatchlist={addToWatchlist} theme={theme} themeClasses={themeClasses} onThemeToggle={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} onLogout={() => setCurrentPage('landing')} connectedBrokers={connectedBrokers} />
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
          onViewChart={(stock) => setSelectedStock(stock)}
          savedStrategies={savedStrategies}
          onRemoveSavedStrategy={handleRemoveSavedStrategy}
          connectedBrokers={connectedBrokers}
          onOpenBrokerModal={() => setShowBrokerModal(true)}
        />
        <div id="main-content-area" className={`flex-1 flex flex-col ${themeClasses.surface} border-x ${themeClasses.border} overflow-hidden`}>
          <div className={`h-11 flex items-center justify-between px-4 border-b ${themeClasses.border} ${themeClasses.surfaceElevated}`}>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold ${themeClasses.text}`}>Strategy Builder</span>
              {draftStrategiesCount > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded-full">{draftStrategiesCount}</span>
              )}
            </div>
          </div>
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
          <TerminalPanel 
            themeClasses={themeClasses} 
            deployedStrategies={deployedStrategies} 
            onRemoveStrategy={(id) => setDeployedStrategies(prev => prev.filter(s => s.id !== id))}
          />
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
