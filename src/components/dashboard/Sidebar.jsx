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
    { id: 'sports', label: 'Sports', icon: Zap },
  ];

  const handleTabClick = (id) => {
    setActiveTab && setActiveTab(id);
    onTabChange && onTabChange(id);
    onNavigate && onNavigate(id);
  };

  // Filter Grok-saved strategies (from GrokPanel)
  const grokStrategies = savedStrategies.filter(s => s.code); // Has code = from Grok
  const liveStrategies = savedStrategies.filter(s => s.deployed);

  // Soft-glass (same as watchlist): gradient + base so it matches content panel; layered shadow + inset highlight
  const glassStyle = {
    background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%), #0a0a0a',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
  };

  return (
    <motion.div
      initial={false}
      animate={{ width: collapsed ? 56 : 220 }}
      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="h-full flex flex-col flex-shrink-0 rounded-none"
      style={glassStyle}
    >
      {/* Main Navigation — Linear-style spacing and hierarchy */}
      <nav className="flex-1 px-1.5 overflow-y-auto min-h-0 flex flex-col pt-1" style={{ scrollbarWidth: 'none' }}>
        <ul className="flex flex-col flex-1 space-y-0.5 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            
            return (
              <li key={item.id}>
                <motion.button
                  onClick={() => handleTabClick(item.id)}
                  whileHover={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                  whileTap={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                  transition={{ duration: 0.15 }}
                  className={`relative w-full flex items-center gap-3 px-2.5 py-2.5 min-h-[36px] rounded-md text-linear-sm font-medium border border-transparent ${
                    isActive ? 'text-linear-text bg-linear-surface-hover' : 'text-linear-text-secondary hover:text-linear-text'
                  } ${collapsed ? 'justify-center px-0' : ''}`}
                  title={collapsed ? item.label : undefined}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-linear-accent rounded-r-full" aria-hidden />
                  )}
                  <Icon 
                    className={`relative z-10 w-[18px] h-[18px] flex-shrink-0 ${isActive ? 'text-linear-accent' : 'text-linear-text-muted'}`}
                    strokeWidth={1.5}
                    fill="none"
                  />
                  {!collapsed && (
                    <div className="relative z-10 flex items-center gap-2 overflow-hidden">
                      <span className="whitespace-nowrap">{item.label}</span>
                      {item.badge ? <span className="text-linear-xs text-linear-accent">{item.badge}</span> : null}
                      {item.isNew && (
                        <span className="text-linear-xs uppercase tracking-wider text-linear-accent">new</span>
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
      <div className="flex-shrink-0 px-1.5 pb-3">
        <div className="h-px bg-[rgba(255,255,255,0.06)] mx-2 mb-2" />
        
        <ul className="space-y-0.5 mb-2">
          {/* More info button */}
          <li>
            <motion.button
              onClick={() => handleTabClick('more')}
              whileHover={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
              whileTap={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
              transition={{ duration: 0.15 }}
              className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-linear-sm font-medium text-linear-text-secondary ${
                collapsed ? 'justify-center px-0' : ''
              }`}
              title={collapsed ? 'More info' : undefined}
            >
              <MoreHorizontal className="w-[18px] h-[18px] flex-shrink-0 text-linear-text-muted" strokeWidth={1.5} />
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
                whileHover={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                whileTap={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                transition={{ duration: 0.15 }}
                className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-linear-sm font-medium text-linear-accent ${
                  collapsed ? 'justify-center px-0' : ''
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

        <div className="h-px bg-[rgba(255,255,255,0.06)] mx-2 mb-2" />

        <motion.button
          onClick={() => setCollapsed(!collapsed)}
          whileHover={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
          whileTap={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
          transition={{ duration: 0.15 }}
          className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-linear-sm font-medium text-linear-text-muted hover:text-linear-text-secondary ${
            collapsed ? 'justify-center px-0' : ''
          }`}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronsRight className="w-[18px] h-[18px] flex-shrink-0 text-linear-accent" strokeWidth={1.5} />
          ) : (
            <ChevronsLeft className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.5} />
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
