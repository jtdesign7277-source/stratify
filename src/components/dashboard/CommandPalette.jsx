import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Command, ArrowUp, ArrowDown, CornerDownLeft,
  TrendingUp, BarChart2, Settings, Home, Zap, Play,
  PlusCircle, Eye, Bot, Clock, Layout, Moon, Sun,
  Keyboard, X, ChevronRight, Filter, History
} from 'lucide-react';

// Command categories and their icons
const CATEGORIES = {
  navigation: { label: 'Navigation', icon: Layout },
  actions: { label: 'Quick Actions', icon: Zap },
  strategies: { label: 'Strategies', icon: TrendingUp },
  settings: { label: 'Settings', icon: Settings },
};

// Keyboard shortcut display helper
const formatShortcut = (shortcut) => {
  if (!shortcut) return null;
  const parts = shortcut.split('+');
  return parts.map((part, i) => (
    <span key={i} className="flex items-center">
      {i > 0 && <span className="text-gray-600 mx-0.5">+</span>}
      <kbd className="px-1.5 py-0.5 bg-[#1e1e2d] rounded text-[10px] font-mono text-gray-400 border border-[#2a2a3d]">
        {part === 'Cmd' ? '⌘' : part === 'Shift' ? '⇧' : part === 'Alt' ? '⌥' : part}
      </kbd>
    </span>
  ));
};

// Individual command item
const CommandItem = ({ command, isActive, onSelect }) => {
  const IconComponent = command.icon || ChevronRight;
  
  return (
    <button
      onClick={() => onSelect(command)}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all ${
        isActive 
          ? 'bg-cyan-500/10 border-l-2 border-cyan-500' 
          : 'hover:bg-[#12121a] border-l-2 border-transparent'
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
        isActive ? 'bg-cyan-500/20' : 'bg-[#1e1e2d]'
      }`}>
        <IconComponent 
          size={16} 
          className={isActive ? 'text-cyan-400' : 'text-white/50'} 
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium truncate ${isActive ? 'text-white' : 'text-gray-300'}`}>
          {command.name}
        </div>
        {command.description && (
          <div className="text-xs text-white/50 truncate">{command.description}</div>
        )}
      </div>
      {command.shortcut && (
        <div className="flex items-center gap-1 ml-2">
          {formatShortcut(command.shortcut)}
        </div>
      )}
    </button>
  );
};

// Command Palette Component
export default function CommandPalette({ 
  isOpen, 
  onClose,
  onNavigate,
  onAction,
  strategies = [],
  deployedStrategies = [],
  theme = 'dark',
  onThemeToggle,
}) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentCommands, setRecentCommands] = useState(() => {
    try {
      const saved = localStorage.getItem('stratify-recent-commands');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Define all available commands
  const allCommands = useMemo(() => {
    const commands = [
      // Navigation
      { id: 'nav-home', name: 'Go to Dashboard', description: 'View main dashboard', category: 'navigation', icon: Home, shortcut: 'Cmd+1', action: () => onNavigate?.('dashboard') },
      { id: 'nav-strategies', name: 'Go to Strategies', description: 'View all strategies', category: 'navigation', icon: TrendingUp, shortcut: 'Cmd+2', action: () => onNavigate?.('strategies') },
      { id: 'nav-builder', name: 'Strategy Builder', description: 'Build or edit strategies', category: 'navigation', icon: Layout, shortcut: 'Cmd+3', action: () => onNavigate?.('builder') },
      { id: 'nav-arbitrage', name: 'Arbitrage Scanner', description: 'View arbitrage opportunities', category: 'navigation', icon: BarChart2, shortcut: 'Cmd+4', action: () => onNavigate?.('arbitrage') },
      { id: 'nav-settings', name: 'Settings', description: 'Configure your account', category: 'navigation', icon: Settings, shortcut: 'Cmd+,', action: () => onNavigate?.('settings') },
      
      // Quick Actions
      { id: 'action-new-strategy', name: 'New Strategy', description: 'Create a new trading strategy', category: 'actions', icon: PlusCircle, shortcut: 'Cmd+N', action: () => onAction?.('newStrategy') },
      { id: 'action-ai-chat', name: 'Ask Grok AI', description: 'Describe a strategy in natural language', category: 'actions', icon: Bot, shortcut: 'Cmd+J', action: () => onAction?.('openAI') },
      { id: 'action-backtest', name: 'Run Backtest', description: 'Backtest selected strategy', category: 'actions', icon: Play, shortcut: 'Cmd+B', action: () => onAction?.('runBacktest') },
      { id: 'action-deploy', name: 'Deploy Strategy', description: 'Deploy strategy to live trading', category: 'actions', icon: Zap, shortcut: 'Cmd+D', action: () => onAction?.('deployStrategy') },
      { id: 'action-search-stock', name: 'Search Stocks', description: 'Find stocks to add to watchlist', category: 'actions', icon: Search, shortcut: 'Cmd+/', action: () => onAction?.('searchStock') },
      
      // Settings
      { id: 'settings-theme', name: theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode', description: 'Toggle color theme', category: 'settings', icon: theme === 'dark' ? Sun : Moon, shortcut: 'Cmd+Shift+T', action: () => onThemeToggle?.() },
      { id: 'settings-shortcuts', name: 'Keyboard Shortcuts', description: 'View all shortcuts', category: 'settings', icon: Keyboard, action: () => onAction?.('showShortcuts') },
    ];

    // Add strategy-specific commands
    strategies.forEach(strategy => {
      commands.push({
        id: `strategy-${strategy.id}`,
        name: `Edit: ${strategy.name}`,
        description: strategy.type || 'Strategy',
        category: 'strategies',
        icon: TrendingUp,
        action: () => onAction?.('editStrategy', strategy),
      });
    });

    deployedStrategies.forEach(strategy => {
      commands.push({
        id: `deployed-${strategy.id}`,
        name: `View: ${strategy.name}`,
        description: 'Deployed strategy',
        category: 'strategies',
        icon: Eye,
        action: () => onAction?.('viewDeployed', strategy),
      });
    });

    return commands;
  }, [strategies, deployedStrategies, theme, onNavigate, onAction, onThemeToggle]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      // Show recent commands first, then all commands
      const recentIds = new Set(recentCommands);
      const recent = allCommands.filter(c => recentIds.has(c.id)).slice(0, 3);
      const rest = allCommands.filter(c => !recentIds.has(c.id));
      return { recent, all: rest };
    }

    const lowerQuery = query.toLowerCase();
    const matches = allCommands.filter(cmd => 
      cmd.name.toLowerCase().includes(lowerQuery) ||
      cmd.description?.toLowerCase().includes(lowerQuery) ||
      cmd.category.toLowerCase().includes(lowerQuery)
    );

    return { recent: [], all: matches };
  }, [query, allCommands, recentCommands]);

  const allFilteredCommands = [...filteredCommands.recent, ...filteredCommands.all];

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current && activeIndex >= 0) {
      const activeItem = listRef.current.children[activeIndex];
      if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [activeIndex]);

  // Handle command execution
  const executeCommand = useCallback((command) => {
    if (command?.action) {
      // Save to recent commands
      setRecentCommands(prev => {
        const updated = [command.id, ...prev.filter(id => id !== command.id)].slice(0, 5);
        localStorage.setItem('stratify-recent-commands', JSON.stringify(updated));
        return updated;
      });
      
      command.action();
      onClose();
    }
  }, [onClose]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => Math.min(prev + 1, allFilteredCommands.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (allFilteredCommands[activeIndex]) {
          executeCommand(allFilteredCommands[activeIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      default:
        break;
    }
  }, [allFilteredCommands, activeIndex, executeCommand, onClose]);

  // Group commands by category for display
  const groupedCommands = useMemo(() => {
    const groups = {};
    filteredCommands.all.forEach(cmd => {
      if (!groups[cmd.category]) {
        groups[cmd.category] = [];
      }
      groups[cmd.category].push(cmd);
    });
    return groups;
  }, [filteredCommands.all]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        transition={{ duration: 0.15 }}
        className="fixed left-1/2 top-[15%] -translate-x-1/2 w-full max-w-xl z-[101]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#0b0b0b] border border-[#1f1f1f] rounded-xl shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1f1f1f]">
            <Search size={18} className="text-white/50" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
              onKeyDown={handleKeyDown}
              placeholder="Type a command or search..."
              className="flex-1 bg-transparent text-white placeholder-gray-500 outline-none text-sm"
            />
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-[#1e1e2d] rounded text-[10px] font-mono text-white/50 border border-[#2a2a3d]">
                esc
              </kbd>
              <span className="text-[10px] text-gray-600 ml-1">to close</span>
            </div>
          </div>

          {/* Command List */}
          <div ref={listRef} className="max-h-[400px] overflow-y-auto scrollbar-hide">
            {allFilteredCommands.length === 0 ? (
              <div className="px-4 py-8 text-center text-white/50 text-sm">
                No commands found for "{query}"
              </div>
            ) : (
              <>
                {/* Recent Commands */}
                {filteredCommands.recent.length > 0 && (
                  <div className="pt-2">
                    <div className="px-4 py-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-gray-600">
                      <History size={12} />
                      Recent
                    </div>
                    {filteredCommands.recent.map((cmd, i) => (
                      <CommandItem
                        key={cmd.id}
                        command={cmd}
                        isActive={i === activeIndex}
                        onSelect={executeCommand}
                      />
                    ))}
                  </div>
                )}

                {/* Grouped Commands */}
                {Object.entries(groupedCommands).map(([category, commands]) => {
                  const CategoryIcon = CATEGORIES[category]?.icon || ChevronRight;
                  const startIndex = filteredCommands.recent.length + 
                    Object.entries(groupedCommands)
                      .slice(0, Object.keys(groupedCommands).indexOf(category))
                      .reduce((acc, [, cmds]) => acc + cmds.length, 0);

                  return (
                    <div key={category} className="pt-2">
                      <div className="px-4 py-2 flex items-center gap-2 text-[10px] uppercase tracking-wider text-gray-600">
                        <CategoryIcon size={12} />
                        {CATEGORIES[category]?.label || category}
                      </div>
                      {commands.map((cmd, i) => (
                        <CommandItem
                          key={cmd.id}
                          command={cmd}
                          isActive={startIndex + i === activeIndex}
                          onSelect={executeCommand}
                        />
                      ))}
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Footer with hints */}
          <div className="px-4 py-2 border-t border-[#1f1f1f] bg-[#08080c] flex items-center justify-between">
            <div className="flex items-center gap-4 text-[10px] text-gray-600">
              <span className="flex items-center gap-1">
                <ArrowUp size={10} />
                <ArrowDown size={10} />
                navigate
              </span>
              <span className="flex items-center gap-1">
                <CornerDownLeft size={10} />
                select
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Command size={10} className="text-gray-600" />
              <span className="text-[10px] text-gray-600">K to open</span>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// Hook to manage keyboard shortcuts
export function useCommandPalette(handlers = {}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      // Cmd+K to open command palette
      if (cmdKey && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
        return;
      }

      // Skip if command palette is open or in an input
      if (document.activeElement?.tagName === 'INPUT' || 
          document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      // Navigation shortcuts (Cmd+1-5)
      if (cmdKey && e.key >= '1' && e.key <= '5') {
        e.preventDefault();
        const tabs = ['dashboard', 'strategies', 'builder', 'arbitrage', 'settings'];
        handlers.onNavigate?.(tabs[parseInt(e.key) - 1]);
        return;
      }

      // Cmd+N - New Strategy
      if (cmdKey && e.key === 'n') {
        e.preventDefault();
        handlers.onAction?.('newStrategy');
        return;
      }

      // Cmd+J - AI Chat
      if (cmdKey && e.key === 'j') {
        e.preventDefault();
        handlers.onAction?.('openAI');
        return;
      }

      // Cmd+B - Backtest
      if (cmdKey && e.key === 'b') {
        e.preventDefault();
        handlers.onAction?.('runBacktest');
        return;
      }

      // Cmd+D - Deploy
      if (cmdKey && e.key === 'd') {
        e.preventDefault();
        handlers.onAction?.('deployStrategy');
        return;
      }

      // Cmd+/ - Search
      if (cmdKey && e.key === '/') {
        e.preventDefault();
        handlers.onAction?.('searchStock');
        return;
      }

      // Cmd+, - Settings
      if (cmdKey && e.key === ',') {
        e.preventDefault();
        handlers.onNavigate?.('settings');
        return;
      }

      // Cmd+Shift+T - Theme toggle
      if (cmdKey && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        handlers.onThemeToggle?.();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(prev => !prev),
  };
}

// Keyboard Shortcuts Modal
export function KeyboardShortcutsModal({ isOpen, onClose }) {
  const shortcuts = [
    { category: 'General', items: [
      { keys: '⌘K', description: 'Open command palette' },
      { keys: 'Esc', description: 'Close modal / Cancel' },
    ]},
    { category: 'Navigation', items: [
      { keys: '⌘1', description: 'Dashboard' },
      { keys: '⌘2', description: 'Strategies' },
      { keys: '⌘3', description: 'Strategy Builder' },
      { keys: '⌘4', description: 'Arbitrage Scanner' },
      { keys: '⌘,', description: 'Settings' },
    ]},
    { category: 'Actions', items: [
      { keys: '⌘N', description: 'New strategy' },
      { keys: '⌘J', description: 'Open AI chat' },
      { keys: '⌘B', description: 'Run backtest' },
      { keys: '⌘D', description: 'Deploy strategy' },
      { keys: '⌘/', description: 'Search stocks' },
    ]},
    { category: 'Appearance', items: [
      { keys: '⌘⇧T', description: 'Toggle dark/light mode' },
    ]},
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg z-[101]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-[#0b0b0b] border border-[#1f1f1f] rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f1f1f]">
            <div className="flex items-center gap-3">
              <Keyboard size={20} className="text-cyan-400" strokeWidth={1.5} />
              <h2 className="text-lg font-semibold text-white">Keyboard Shortcuts</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#1e1e2d] rounded-lg transition-colors"
            >
              <X size={18} className="text-white/50" />
            </button>
          </div>

          <div className="p-6 max-h-[60vh] overflow-y-auto">
            <div className="space-y-6">
              {shortcuts.map(section => (
                <div key={section.category}>
                  <h3 className="text-xs uppercase tracking-wider text-white/50 mb-3">
                    {section.category}
                  </h3>
                  <div className="space-y-2">
                    {section.items.map(item => (
                      <div
                        key={item.keys}
                        className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-[#12121a]"
                      >
                        <span className="text-sm text-gray-300">{item.description}</span>
                        <kbd className="px-2 py-1 bg-[#1e1e2d] rounded text-xs font-mono text-gray-400 border border-[#2a2a3d]">
                          {item.keys}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-[#1f1f1f] bg-[#08080c]">
            <p className="text-xs text-white/50 text-center">
              Press <kbd className="px-1.5 py-0.5 bg-[#1e1e2d] rounded text-[10px] font-mono text-gray-400 border border-[#2a2a3d]">⌘K</kbd> anytime to open the command palette
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
