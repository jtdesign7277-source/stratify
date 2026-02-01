import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home, 
  Star,
  FolderOpen,
  SlidersHorizontal, 
  Globe, 
  LineChart, 
  Wallet, 
  History, 
  HelpCircle, 
  MoreHorizontal,
  ChevronsLeft,
  ChevronsRight,
  Brain,
  ChevronDown,
  ChevronRight,
  Play,
  Square,
  Trash2,
  Zap
} from 'lucide-react';
import StratifyLogo from './StratifyLogo';

const Sidebar = ({ 
  activeTab = 'home', 
  setActiveTab, 
  onTabChange, 
  onNavigate,
  savedStrategies = [],
  deployedStrategies = [],
  onRemoveSavedStrategy
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [strategiesExpanded, setStrategiesExpanded] = useState(true);
  const [deployedExpanded, setDeployedExpanded] = useState(true);

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'watchlist', label: 'Watchlist', icon: Star },
    { id: 'strategies', label: 'Strategies', icon: FolderOpen },
    { id: 'trade', label: 'Trade', icon: SlidersHorizontal },
    { id: 'markets', label: 'Markets', icon: Globe },
    { id: 'analytics', label: 'Analytics', icon: LineChart },
    { id: 'atlas', label: 'Atlas AI', icon: Brain, isNew: true },
    { id: 'portfolio', label: 'Portfolio', icon: Wallet },
    { id: 'history', label: 'History', icon: History },
  ];

  const bottomItems = [
    { id: 'help', label: 'Help', icon: HelpCircle },
    { id: 'more', label: 'More info', icon: MoreHorizontal },
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
      className="h-full bg-[#0a0a0f] border-r border-white/10 flex flex-col flex-shrink-0"
    >
      {/* Logo */}
      <div className="p-3 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
            <StratifyLogo size={24} />
          </div>
          {!collapsed && (
            <div className="flex items-center gap-1.5 overflow-hidden">
              <span className="text-white font-semibold text-sm whitespace-nowrap">Stratify</span>
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-white/10 text-white/70 rounded">PRO</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-2 overflow-y-auto min-h-0" style={{ scrollbarWidth: 'none' }}>
        <ul className="space-y-px">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <li key={item.id}>
                <button
                  onClick={() => handleTabClick(item.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-600/40 to-purple-500/30 text-white'
                      : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                  } ${collapsed ? 'justify-center px-2' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon 
                    className={`w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-white' : ''}`} 
                    strokeWidth={1.5} 
                  />
                  {!collapsed && (
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="whitespace-nowrap">{item.label}</span>
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

        {/* Saved Strategies Section */}
        {!collapsed && grokStrategies.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setStrategiesExpanded(!strategiesExpanded)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-semibold text-white/40 uppercase tracking-wider hover:text-white/60 transition-colors"
            >
              {strategiesExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <Zap className="w-3 h-3 text-emerald-400" />
              <span>Grok Strategies</span>
              <span className="ml-auto text-[10px] bg-white/10 px-1.5 py-0.5 rounded">{grokStrategies.length}</span>
            </button>
            
            <AnimatePresence>
              {strategiesExpanded && (
                <motion.ul
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-1 space-y-px overflow-hidden"
                >
                  {grokStrategies.map((strategy) => (
                    <li key={strategy.id}>
                      <div className="group flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] text-white/60 hover:text-white hover:bg-white/5 transition-all cursor-pointer">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${strategy.deployed ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                        <span className="flex-1 truncate">{strategy.name}</span>
                        {strategy.deployed && (
                          <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">
                            LIVE
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveSavedStrategy && onRemoveSavedStrategy(strategy.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-red-400 hover:text-red-300 transition-all"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Deployed Strategies Section */}
        {!collapsed && liveStrategies.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setDeployedExpanded(!deployedExpanded)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[11px] font-semibold text-white/40 uppercase tracking-wider hover:text-white/60 transition-colors"
            >
              {deployedExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <Play className="w-3 h-3 text-emerald-400" />
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
                      <div className="group flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] text-white/60 hover:text-white hover:bg-white/5 transition-all cursor-pointer">
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
          {bottomItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  onClick={() => handleTabClick(item.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium text-white/50 hover:text-white/80 hover:bg-white/5 transition-all ${
                    collapsed ? 'justify-center px-2' : ''
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.5} />
                  {!collapsed && (
                    <span className="whitespace-nowrap overflow-hidden">
                      {item.label}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="h-px bg-white/10 mx-2 mb-2" />

        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-white/60 hover:text-white hover:bg-purple-500/20 transition-all border border-white/10 hover:border-purple-500/50 ${
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
