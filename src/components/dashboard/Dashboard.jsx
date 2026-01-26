import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import TopMetricsBar from './TopMetricsBar';
import DataTable from './DataTable';
import RightPanel from './RightPanel';
import StatusBar from './StatusBar';

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
  
  const [sidebarExpanded, setSidebarExpanded] = useState(savedState?.sidebarExpanded ?? false);
  const [rightPanelWidth, setRightPanelWidth] = useState(savedState?.rightPanelWidth ?? 320);
  const [activeTab, setActiveTab] = useState(savedState?.activeTab ?? 'positions');
  const [activeSection, setActiveSection] = useState(savedState?.activeSection ?? 'portfolio');
  const [isDragging, setIsDragging] = useState(false);
  const [theme, setTheme] = useState(savedState?.theme ?? 'dark');
  const [connectionStatus, setConnectionStatus] = useState('connecting');

  useEffect(() => {
    saveDashboardState({ sidebarExpanded, rightPanelWidth, activeTab, activeSection, theme });
  }, [sidebarExpanded, rightPanelWidth, activeTab, activeSection, theme]);

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

  return (
    <div className={`h-screen w-screen flex flex-col ${themeClasses.bg} ${themeClasses.text} overflow-hidden`}>
      <TopMetricsBar alpacaData={alpacaData} theme={theme} themeClasses={themeClasses} onThemeToggle={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} onLogout={() => setCurrentPage('landing')} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar expanded={sidebarExpanded} onToggle={() => setSidebarExpanded(!sidebarExpanded)} activeSection={activeSection} onSectionChange={setActiveSection} theme={theme} themeClasses={themeClasses} />
        <div className={`flex-1 flex flex-col ${themeClasses.surface} border-x ${themeClasses.border} overflow-hidden`}>
          <div className={`h-11 flex items-center justify-between px-4 border-b ${themeClasses.border} ${themeClasses.surfaceElevated}`}>
            <div className="flex gap-1">
              {['positions', 'orders', 'trades', 'balances'].map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-sm font-medium capitalize relative ${activeTab === tab ? themeClasses.text : themeClasses.textMuted}`}>
                  {tab}
                  {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500" />}
                </button>
              ))}
            </div>
          </div>
          <DataTable activeTab={activeTab} alpacaData={alpacaData} theme={theme} themeClasses={themeClasses} />
        </div>
        <div className={`w-1 cursor-col-resize hover:bg-emerald-500/50 ${isDragging ? 'bg-emerald-500' : themeClasses.border}`} onMouseDown={() => setIsDragging(true)} />
        <RightPanel width={rightPanelWidth} alpacaData={alpacaData} theme={theme} themeClasses={themeClasses} />
      </div>
      <StatusBar connectionStatus={connectionStatus} theme={theme} themeClasses={themeClasses} />
    </div>
  );
}
