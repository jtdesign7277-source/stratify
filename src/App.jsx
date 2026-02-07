import { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  Brain,
  Calendar,
  Clock,
  LayoutDashboard,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Settings,
  TrendingUp,
  Trophy,
  Wallet,
} from 'lucide-react';

import DashboardPage from './components/pages/DashboardPage';
import TradePage from './components/pages/TradePage';
import MarketsPage from './components/pages/MarketsPage';
import StrategiesPage from './components/pages/StrategiesPage';
import AnalyticsPage from './components/pages/AnalyticsPage';
import PortfolioPage from './components/pages/PortfolioPage';
import HistoryPage from './components/pages/HistoryPage';
import CalendarPage from './components/pages/CalendarPage';
import ChallengePage from './components/pages/ChallengePage';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'trade', label: 'Trade', icon: ArrowLeftRight },
  { id: 'markets', label: 'Markets', icon: TrendingUp },
  { id: 'strategies', label: 'Strategies', icon: Brain },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'portfolio', label: 'Portfolio', icon: Wallet },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'challenge', label: 'Challenge', icon: Trophy, accent: 'gold' },
];

const PAGE_COMPONENTS = {
  dashboard: DashboardPage,
  trade: TradePage,
  markets: MarketsPage,
  strategies: StrategiesPage,
  analytics: AnalyticsPage,
  portfolio: PortfolioPage,
  history: HistoryPage,
  calendar: CalendarPage,
  challenge: ChallengePage,
};

const App = () => {
  const [activePage, setActivePage] = useState('dashboard');
  const [atlasOpen, setAtlasOpen] = useState(false);

  const ActivePage = useMemo(
    () => PAGE_COMPONENTS[activePage] || DashboardPage,
    [activePage],
  );

  return (
    <div className="min-h-screen bg-[#060d18] text-white flex">
      <aside className="fixed inset-y-0 left-0 w-56 bg-[#0a1628] border-r border-white/10 flex flex-col">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="text-lg font-semibold tracking-wide">Stratify</div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = activePage === item.id;
            const isChallenge = item.accent === 'gold';
            const baseClasses =
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors border';
            const activeClasses = 'bg-blue-500 text-white border-blue-500';
            const inactiveClasses = isChallenge
              ? 'text-amber-300 border-amber-400/40 hover:bg-amber-500/10'
              : 'text-gray-400 border-transparent hover:text-white hover:bg-white/5';
            const accentClasses = isChallenge ? 'ring-1 ring-amber-400/30' : '';
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses} ${accentClasses}`}
              >
                <Icon className="w-4 h-4" strokeWidth={1.5} fill="none" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-white/10 flex items-center justify-between">
          <button className="p-2 rounded-lg hover:bg-white/5 transition-colors" aria-label="Settings">
            <Settings className="w-5 h-5 text-gray-400" strokeWidth={1.5} fill="none" />
          </button>
          <div className="h-9 w-9 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-sm font-semibold">
            JD
          </div>
        </div>
      </aside>

      <div className="flex-1 ml-56 flex flex-col min-h-screen">
        <header className="h-16 border-b border-white/10 bg-[#0a1628] flex items-center px-6 gap-4">
          <div className="flex-1 max-w-xl">
            <div className="flex items-center gap-2 bg-[#060d18] border border-white/10 rounded-lg px-3 py-2">
              <Search className="w-4 h-4 text-gray-400" strokeWidth={1.5} fill="none" />
              <input
                type="text"
                placeholder="Search markets, strategies, assets"
                className="bg-transparent text-sm text-white placeholder-gray-500 flex-1 outline-none"
              />
              <span className="text-[11px] text-gray-400 border border-white/10 rounded px-1.5 py-0.5">⌘K</span>
            </div>
          </div>

          <button className="p-2 rounded-lg hover:bg-white/5 transition-colors" aria-label="Notifications">
            <Bell className="w-5 h-5 text-gray-400" strokeWidth={1.5} fill="none" />
          </button>

          <button
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            onClick={() => setAtlasOpen((prev) => !prev)}
            aria-label="Toggle Atlas AI"
          >
            {atlasOpen ? (
              <PanelRightClose className="w-5 h-5 text-gray-400" strokeWidth={1.5} fill="none" />
            ) : (
              <PanelRightOpen className="w-5 h-5 text-gray-400" strokeWidth={1.5} fill="none" />
            )}
          </button>

          <div className="h-9 w-9 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-sm font-semibold">
            JD
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-y-auto p-6">
            <ActivePage />
          </main>

          {atlasOpen && (
            <aside className="w-80 border-l border-white/10 bg-[#0a1628] p-6 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-white">Atlas AI</h2>
                <button
                  className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                  onClick={() => setAtlasOpen(false)}
                  aria-label="Close Atlas AI"
                >
                  <PanelRightClose className="w-4 h-4 text-gray-400" strokeWidth={1.5} fill="none" />
                </button>
              </div>
              <div className="text-sm text-gray-400">Coming soon.</div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
