import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Crosshair,
  SlidersHorizontal,
  Bitcoin,
  Globe,
  Microscope,
  Wallet,
  Landmark,
  Calendar,
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
  LogOut,
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
    { id: 'portfolio', label: 'Portfolio', icon: Wallet },
    { id: 'war-room', label: 'War Room', icon: Crosshair, isNew: true },
    { id: 'trader', label: 'Trader', icon: TrendingUp },
    { id: 'crypto', label: 'Crypto', icon: Bitcoin },
    { id: 'global-markets', label: 'Global Markets', icon: Globe },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'xray', label: 'X-Ray', icon: Microscope },
    { id: 'market', label: 'Market', icon: TrendingUp, isNew: true },
    { id: 'trade', label: 'Community', icon: SlidersHorizontal },
    { id: 'terminal', label: 'Terminal', icon: Terminal, isNew: true },
    { id: 'active', label: 'Active', icon: Play, badge: resolvedActiveCount },
    // { id: 'advanced', label: 'Advanced Trading', icon: BarChart3 },
    { id: 'fred', label: 'FRED', icon: Landmark },
    { id: 'radar', label: 'Strategy Radar', icon: Crosshair },
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
      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
      className="soft-glass-surface h-full bg-[#0a0a0a] border-r border-[#1f1f1f] flex flex-col flex-shrink-0"
    >
      {/* Main Navigation */}
      <nav className="flex-1 px-2 overflow-y-auto min-h-0 flex flex-col" style={{ scrollbarWidth: 'none' }}>
        <ul className="flex flex-col flex-1 justify-evenly space-y-2 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <li key={item.id}>
                <motion.button
                  onClick={() => handleTabClick(item.id)}
                  whileHover={{ x: 2, backgroundColor: 'rgba(255,255,255,0.04)' }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className={`relative w-full flex items-center gap-2.5 px-2.5 py-2 min-h-[36px] rounded-lg text-[13px] tracking-wide border border-transparent ${
                    isActive ? 'text-emerald-300' : 'text-white/85'
                  } ${collapsed ? 'justify-center px-2' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  {isActive && (
                    <motion.div
                      layoutId="tab-indicator"
                      className="absolute inset-0 rounded-lg bg-white/10"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <Icon 
                    className={`relative z-10 w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-emerald-400' : 'text-white/65'}`}
                    strokeWidth={1.5}
                    fill="none"
                  />
                  {!collapsed && (
                    <div className="relative z-10 flex items-center gap-2 overflow-hidden">
                      <span className="whitespace-nowrap font-medium">{item.label}</span>
                      {item.badge ? <span className="text-[10px] text-emerald-400">{item.badge}</span> : null}
                      {item.isNew && (
                        <span className="text-[10px] uppercase tracking-[0.12em] text-emerald-400">new</span>
                      )}
                    </div>
                  )}
                </motion.button>
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
            <motion.button
              onClick={() => handleTabClick('more')}
              whileHover={{ x: 2, backgroundColor: 'rgba(255,255,255,0.04)' }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium tracking-wide text-white ${
                collapsed ? 'justify-center px-2' : ''
              }`}
              title={collapsed ? 'More info' : undefined}
            >
              <MoreHorizontal className="w-[18px] h-[18px] flex-shrink-0 text-emerald-400" strokeWidth={1.5} />
              {!collapsed && (
                <span className="whitespace-nowrap overflow-hidden">More info</span>
              )}
            </motion.button>
          </li>
          {/* Logout button */}
          {isAuthenticated && (
            <li>
              <motion.button
                onClick={async () => {
                  await signOut();
                  if (onLogout) onLogout();
                }}
                whileHover={{ x: 2, backgroundColor: 'rgba(255,255,255,0.04)' }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium tracking-wide text-emerald-300 ${
                  collapsed ? 'justify-center px-2' : ''
                }`}
                title={collapsed ? 'Log out' : undefined}
              >
                <LogOut className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.5} />
                {!collapsed && (
                  <span className="whitespace-nowrap overflow-hidden">Log out</span>
                )}
              </motion.button>
            </li>
          )}
        </ul>

        <div className="h-px bg-white/10 mx-2 mb-2" />

        <motion.button
          onClick={() => setCollapsed(!collapsed)}
          whileHover={{ x: 2, backgroundColor: 'rgba(255,255,255,0.04)' }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium tracking-wide ${
            collapsed
              ? 'text-emerald-300 hover:text-emerald-200'
              : 'text-emerald-300/70 hover:text-emerald-300'
          } ${
            collapsed ? 'justify-center px-2' : ''
          }`}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronsRight className="w-[18px] h-[18px] flex-shrink-0 animate-pulse drop-shadow-[0_0_10px_rgba(16,185,129,0.65)]" strokeWidth={1.5} />
          ) : (
            <ChevronsLeft className="w-[18px] h-[18px] flex-shrink-0 text-emerald-300/70" strokeWidth={1.5} />
          )}
          {!collapsed && (
            <span className="whitespace-nowrap overflow-hidden">
              Collapse
            </span>
          )}
        </motion.button>

      </div>
    </motion.div>
  );
};

export default Sidebar;
