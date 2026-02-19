import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crosshair,
  SlidersHorizontal, 
  Bitcoin,
  Globe, 
  LineChart, 
  BarChart3,
  Wallet, 
  History, 
  Landmark,
  Zap,
  MoreHorizontal,
  ChevronsLeft,
  ChevronsRight,
  Layout,
  ChevronDown,
  ChevronRight,
  Play,
  Square,
  Trash2,
  TrendingUp,
  Terminal,
  MessageCircle,
  LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Sidebar = ({ 
  activeTab = 'war-room', 
  setActiveTab, 
  onTabChange, 
  onNavigate,
  expanded,
  onToggle,
  savedStrategies = [],
  deployedStrategies = [],
  activeStrategyCount,
  onRemoveSavedStrategy,
  onLogout
}) => {
  const { signOut, isAuthenticated } = useAuth();
  const [internalCollapsed, setInternalCollapsed] = useState(true);
  const [strategiesExpanded, setStrategiesExpanded] = useState(false);
  const [deployedExpanded, setDeployedExpanded] = useState(false);
  const isControlled = typeof expanded === 'boolean';
  const collapsed = isControlled ? !expanded : internalCollapsed;

  const setCollapsed = (nextCollapsed) => {
    const resolvedNext = typeof nextCollapsed === 'function' ? nextCollapsed(collapsed) : nextCollapsed;

    if (!isControlled) {
      setInternalCollapsed(resolvedNext);
    }

    onToggle?.(!resolvedNext);
  };

  const resolvedActiveCount = Number.isFinite(activeStrategyCount)
    ? activeStrategyCount
    : deployedStrategies.length;

  const navItems = [
    { id: 'war-room', label: 'War Room', icon: Crosshair, isNew: true, labelClass: 'font-semibold text-red-500', iconClass: 'text-red-500' },
    { id: 'active', label: 'Active', icon: Play, badge: resolvedActiveCount },
    { id: 'terminal', label: 'Terminal', icon: Terminal, isNew: true, labelClass: 'font-semibold text-emerald-400' },
    { id: 'trade', label: 'Trade', icon: SlidersHorizontal },
    { id: 'watchlist', label: 'Watchlist', icon: Layout },
    { id: 'global-markets', label: 'Global Markets', icon: Globe },
    { id: 'trends', label: 'Trends', icon: TrendingUp, isNew: true },
    { id: 'analytics', label: 'Analytics', icon: LineChart },
    { id: 'options', label: 'Options Flow', icon: Zap, isNew: true, labelClass: 'font-semibold text-orange-400', iconClass: 'text-orange-400' },
    { id: 'advanced', label: 'Advanced Trading', icon: BarChart3 },
    { id: 'portfolio', label: 'Portfolio', icon: Wallet },
    { id: 'history', label: 'History', icon: History },
    { id: 'fred', label: 'FRED', icon: Landmark },
    { id: 'crypto', label: 'Crypto', icon: Bitcoin },
  ];

  const handleTabClick = (id) => {
    setActiveTab && setActiveTab(id);
    onTabChange && onTabChange(id);
    onNavigate && onNavigate(id);
  };

  // Filter Grok-saved strategies (from GrokPanel)
  const grokStrategies = savedStrategies.filter(s => s.code); // Has code = from Grok
  const liveStrategies = savedStrategies.filter(s => s.deployed);

  return (
    <motion.div
      initial={false}
      animate={{ width: collapsed ? 60 : 220 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="h-full bg-[#0b0b0b] border-r border-[#1f1f1f] flex flex-col flex-shrink-0"
    >
      {/* Main Navigation */}
      <nav className="flex-1 px-2 overflow-y-auto min-h-0 flex flex-col" style={{ scrollbarWidth: 'none' }}>
        <ul className="flex flex-col flex-1 justify-evenly space-y-2 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isLegend = item.id === 'legend';
            const isTrade = item.id === 'trade';
            const isTradeActive = isTrade && isActive;
            const isWarRoom = item.id === 'war-room';
            const activeTabClasses = isLegend
              ? 'text-amber-400 bg-amber-500/10 border border-amber-400/20 shadow-[0_0_12px_rgba(251,191,36,0.2)]'
              : isTradeActive
                ? 'text-white bg-blue-500/10 border border-blue-400/30 trade-tab-active-glow'
                : isWarRoom
                  ? 'text-red-300 bg-red-500/10 border border-red-400/20 shadow-[0_0_12px_rgba(248,113,113,0.25)]'
                  : 'bg-gradient-to-r from-emerald-500/30 via-emerald-400/20 to-emerald-500/10 text-white shadow-[0_0_12px_rgba(16,185,129,0.3)] border border-emerald-400/20';
            const activeIconClass = isLegend
              ? 'text-amber-400'
              : isTradeActive
                ? 'text-blue-300'
                : isWarRoom
                  ? 'text-red-400'
                  : 'text-emerald-300';
            
            return (
              <li key={item.id}>
                <button
                  onClick={() => handleTabClick(item.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 min-h-[36px] rounded-lg text-[13px] font-medium tracking-wide transition-all duration-200 hover:-translate-y-0.5 ${
                    isActive
                      ? activeTabClasses
                      : 'text-white hover:bg-white/5 border border-transparent'
                  } ${collapsed ? 'justify-center px-2' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon 
                    className={`w-[18px] h-[18px] flex-shrink-0 ${item.iconClass || ''} ${isActive ? activeIconClass : ''}`} 
                    strokeWidth={1.5}
                    fill="none"
                  />
                  {!collapsed && (
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className={`whitespace-nowrap ${item.labelClass || ''}`}>{item.label}</span>
                      {item.badge && (
                        <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-500/30 text-emerald-300 rounded-full min-w-[18px] text-center">
                          {item.badge}
                        </span>
                      )}
                      {item.isNew && (
                        <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-500/20 text-emerald-400 rounded">
                          New
                        </span>
                      )}
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

      </nav>

      {/* Bottom Section */}
      <div className="flex-shrink-0 px-2 pb-3">
        <div className="h-px bg-white/10 mx-2 mb-2" />
        
        <ul className="space-y-px mb-2">
          {/* More info button */}
          <li>
            <button
              onClick={() => handleTabClick('more')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium tracking-wide text-white hover:bg-white/5 transition-all duration-200 hover:-translate-y-0.5 ${
                collapsed ? 'justify-center px-2' : ''
              }`}
              title={collapsed ? 'More info' : undefined}
            >
              <MoreHorizontal className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.5} />
              {!collapsed && (
                <span className="whitespace-nowrap overflow-hidden">More info</span>
              )}
            </button>
          </li>
          {/* Logout button */}
          {isAuthenticated && (
            <li>
              <button
                onClick={async () => {
                  await signOut();
                  if (onLogout) onLogout();
                }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium tracking-wide text-red-400 hover:bg-red-500/10 transition-all duration-200 hover:-translate-y-0.5 ${
                  collapsed ? 'justify-center px-2' : ''
                }`}
                title={collapsed ? 'Log out' : undefined}
              >
                <LogOut className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.5} />
                {!collapsed && (
                  <span className="whitespace-nowrap overflow-hidden">Log out</span>
                )}
              </button>
            </li>
          )}
        </ul>

        <div className="h-px bg-white/10 mx-2 mb-2" />

        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium tracking-wide text-white hover:bg-emerald-500/10 transition-all duration-200 hover:-translate-y-0.5 border border-white/10 hover:border-emerald-400/40 ${
            collapsed ? 'justify-center px-2' : ''
          }`}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronsRight className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.5} />
          ) : (
            <ChevronsLeft className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.5} />
          )}
          {!collapsed && (
            <span className="whitespace-nowrap overflow-hidden">
              Collapse
            </span>
          )}
        </button>

      </div>
    </motion.div>
  );
};

export default Sidebar;
