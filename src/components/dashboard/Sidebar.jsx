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
  PanelLeftClose,
  PanelLeft,
  Brain
} from 'lucide-react';

const Sidebar = ({ activeTab = 'home', setActiveTab, onTabChange, onNavigate }) => {
  const [collapsed, setCollapsed] = useState(false);

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

  return (
    <motion.div
      initial={false}
      animate={{ width: collapsed ? 56 : 180 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="h-screen bg-[#0d0d14] flex flex-col flex-shrink-0"
    >
      {/* Logo */}
      <div className="p-3 pb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
            <Brain className="w-4 h-4 text-white" strokeWidth={1.5} />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-1.5 overflow-hidden"
              >
                <span className="text-white font-semibold text-sm whitespace-nowrap">Stratify</span>
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-white/10 text-white/70 rounded">PRO</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 min-h-0 overflow-y-auto px-2">
        <ul className="space-y-0.5">
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
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.div
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.15 }}
                        className="flex items-center gap-2 overflow-hidden"
                      >
                        <span className="whitespace-nowrap">{item.label}</span>
                        {item.isNew && (
                          <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-500/20 text-emerald-400 rounded">
                            New
                          </span>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom Section - Always at bottom */}
      <div className="mt-auto border-t border-white/10 p-2 space-y-0.5">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium text-white/50 hover:text-white/80 hover:bg-white/5 transition-all ${
                collapsed ? 'justify-center px-2' : ''
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.5} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.15 }}
                    className="whitespace-nowrap overflow-hidden"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          );
        })}

        {/* Collapse Button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium text-white/50 hover:text-white/80 hover:bg-white/5 transition-all ${
            collapsed ? 'justify-center px-2' : ''
          }`}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? (
            <PanelLeft className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.5} />
          ) : (
            <PanelLeftClose className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.5} />
          )}
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="whitespace-nowrap overflow-hidden"
              >
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.div>
  );
};

export default Sidebar;
