import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import TopMetricsBar from './TopMetricsBar';
import DataTable from './DataTable';
import RightPanel from './RightPanel';
import StatusBar from './StatusBar';
import TerminalPanel from './TerminalPanel';
import StockDetailView from './StockDetailView';

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
  const [activeTab, setActiveTab] = useState(savedState?.activeTab ?? 'positions');
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
  const [strategies, setStrategies] = useState([]);
  const [deployedStrategies, setDeployedStrategies] = useState([]);
  const [demoState, setDemoState] = useState('idle');
  const [autoBacktestStrategy, setAutoBacktestStrategy] = useState(null);

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

  const handleDeployStrategy = (strategy) => {
    // Remove from draft strategies
    setStrategies(prev => prev.filter(s => s.id !== strategy.id));
    // Add to deployed strategies
    setDeployedStrategies(prev => {
      if (prev.some(s => s.name === strategy.name)) return prev;
      return [...prev, { ...strategy, status: 'deployed', runStatus: 'running' }];
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

  useEffect(() => {
    saveDashboardState({ sidebarExpanded, rightPanelWidth, activeTab, activeSection, theme });
  }, [sidebarExpanded, rightPanelWidth, activeTab, activeSection, theme]);

  useEffect(() => {
    localStorage.setItem('stratify-watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

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
    bg: 'bg-[#0D0D0D]',
    surface: 'bg-[#1A1A1A]',
    surfaceElevated: 'bg-[#1E1E1E]',
    border: 'border-[#2A2A2A]',
    text: 'text-[#F5F5F5]',
    textMuted: 'text-[#6B6B6B]'
  } : {
    bg: 'bg-[#FAFAFA]',
    surface: 'bg-white',
    surfaceElevated: 'bg-white',
    border: 'border-[#E5E5E5]',
    text: 'text-[#171717]',
    textMuted: 'text-[#A3A3A3]'
  };

  const draftStrategiesCount = strategies.filter(s => s.status !== 'deployed').length;

  return (
    <div className={`h-screen w-screen flex flex-col ${themeClasses.bg} ${themeClasses.text} overflow-hidden`}>
      <TopMetricsBar alpacaData={alpacaData} onAddToWatchlist={addToWatchlist} theme={theme} themeClasses={themeClasses} onThemeToggle={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} onLogout={() => setCurrentPage('landing')} />
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
        />
        <div id="main-content-area" className={`flex-1 flex flex-col ${themeClasses.surface} border-x ${themeClasses.border} overflow-hidden`}>
          <div className={`h-11 flex items-center justify-between px-4 border-b ${themeClasses.border} ${themeClasses.surfaceElevated}`}>
            <div className="flex gap-1">
              {['positions', 'orders', 'trades', 'balances', 'strategies'].map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-sm font-medium capitalize relative ${activeTab === tab ? themeClasses.text : themeClasses.textMuted}`}>
                  {tab}
                  {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />}
                  {tab === 'strategies' && draftStrategiesCount > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded-full">{draftStrategiesCount}</span>
                  )}
                </button>
              ))}
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
            autoBacktestStrategy={autoBacktestStrategy}
          />
          <TerminalPanel themeClasses={themeClasses} deployedStrategies={deployedStrategies} />
        </div>
        <RightPanel 
          width={rightPanelWidth} 
          alpacaData={alpacaData} 
          theme={theme} 
          themeClasses={themeClasses} 
          onStrategyGenerated={handleStrategyGenerated} 
          onDemoStateChange={handleDemoStateChange}
          onStrategyAdded={handleStrategyAdded}
        />
      </div>
      <StatusBar connectionStatus={connectionStatus} theme={theme} themeClasses={themeClasses} />

      {selectedStock && (
        <StockDetailView 
          symbol={selectedStock.symbol}
          stockName={selectedStock.name}
          onClose={() => setSelectedStock(null)}
          themeClasses={themeClasses}
        />
      )}
    </div>
  );
}
