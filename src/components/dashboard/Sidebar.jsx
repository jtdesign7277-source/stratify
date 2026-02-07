import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home, 
  FolderOpen,
  SlidersHorizontal, 
  Globe, 
  LineChart, 
  Wallet, 
  History, 
  MoreHorizontal,
  ChevronsLeft,
  ChevronsRight,
  Brain,
  Layout,
  ChevronDown,
  ChevronRight,
  Play,
  Square,
  Trash2,
  Zap,
  Trophy,
  TrendingUp
} from 'lucide-react';

const Sidebar = ({ 
  activeTab = 'home', 
  setActiveTab, 
  onTabChange, 
  onNavigate,
  savedStrategies = [],
  deployedStrategies = [],
  onRemoveSavedStrategy,
  grokPanelCollapsed = false,
  onOpenFloatingGrok
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [strategiesExpanded, setStrategiesExpanded] = useState(false);
  const [deployedExpanded, setDeployedExpanded] = useState(false);

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'active', label: 'Active', icon: Play, badge: deployedStrategies.length },
    { id: 'strategies', label: 'Strategies', icon: FolderOpen },
    { id: 'templates', label: 'Templates', icon: Layout },
    { id: 'trade', label: 'Trade', icon: SlidersHorizontal },
    { id: 'markets', label: 'Markets', icon: Globe },
    { id: 'predictions', label: 'Predictions', icon: Zap },
    { id: 'trends', label: 'Trends', icon: TrendingUp, isNew: true },
    { id: 'legend', label: 'Legend', icon: Trophy },
    { id: 'analytics', label: 'Analytics', icon: LineChart },
    { id: 'atlas', label: 'Demo', icon: Brain, isNew: true, labelClass: 'font-semibold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-emerald-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.45)] animate-pulse' },
    { id: 'portfolio', label: 'Portfolio', icon: Wallet },
    { id: 'history', label: 'History', icon: History },
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
      className="h-full bg-[#0d0d12] border-r border-white/10 flex flex-col flex-shrink-0"
    >
      {/* Main Navigation */}
      <nav className="flex-1 px-2 overflow-y-auto min-h-0 flex flex-col" style={{ scrollbarWidth: 'none' }}>
        <ul className="flex flex-col flex-1 justify-evenly space-y-2 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isLegend = item.id === 'legend';
            
            return (
              <li key={item.id}>
                <button
                  onClick={() => handleTabClick(item.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 min-h-[36px] rounded-lg text-[13px] font-medium tracking-wide transition-all duration-200 hover:-translate-y-0.5 ${
                    isActive
                      ? isLegend
                        ? 'text-amber-400 bg-amber-500/10 border border-amber-400/20 shadow-[0_0_12px_rgba(251,191,36,0.2)]'
                        : 'bg-gradient-to-r from-emerald-500/30 via-emerald-400/20 to-emerald-500/10 text-white shadow-[0_0_12px_rgba(16,185,129,0.3)] border border-emerald-400/20'
                      : 'text-white/50 hover:text-white/80 hover:bg-white/5 border border-transparent'
                  } ${collapsed ? 'justify-center px-2' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon 
                    className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? (isLegend ? 'text-amber-400' : 'text-emerald-300') : ''}`} 
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

        {/* Deployed Strategies Section */}
        {!collapsed && liveStrategies.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setDeployedExpanded(!deployedExpanded)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-semibold text-white/40 uppercase tracking-wider bg-white/5 backdrop-blur rounded-lg border border-white/10 hover:text-white/60 transition-all duration-200 hover:-translate-y-0.5"
            >
              {deployedExpanded ? (
                <ChevronDown className="w-3 h-3" strokeWidth={1.5} />
              ) : (
                <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
              )}
              <Play className="w-3 h-3 text-emerald-400" strokeWidth={1.5} />
              <span>Live</span>
              <span className="ml-auto text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">{liveStrategies.length}</span>
            </button>
            
            <AnimatePresence>
              {deployedExpanded && (
                <motion.ul
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-1 space-y-px overflow-hidden"
                >
                  {liveStrategies.map((strategy) => (
                    <li key={strategy.id}>
                      <div className="group flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] text-white/60 hover:text-white hover:bg-white/5 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                        <span className="flex-1 truncate">{strategy.name}</span>
                        <span className="text-[9px] text-emerald-400">Running</span>
                      </div>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        )}
      </nav>

      {/* Bottom Section */}
      <div className="flex-shrink-0 px-2 pb-3">
        <div className="h-px bg-white/10 mx-2 mb-2" />
        
        <ul className="space-y-px mb-2">
          {/* More info button */}
          <li>
            <button
              onClick={() => handleTabClick('more')}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium tracking-wide text-white/50 hover:text-white/80 hover:bg-white/5 transition-all duration-200 hover:-translate-y-0.5 ${
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
        </ul>

        <div className="h-px bg-white/10 mx-2 mb-2" />

        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium tracking-wide text-white/60 hover:text-white hover:bg-emerald-500/10 transition-all duration-200 hover:-translate-y-0.5 border border-white/10 hover:border-emerald-400/40 ${
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

        {/* Floating Grok Chat trigger - shown when Grok panel is collapsed */}
              </div>
    </motion.div>
  );
};

export default Sidebar;
