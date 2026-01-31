import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Watchlist from './Watchlist';
import StockSearch from './StockSearch';

// Animation variants for smooth transitions
const sidebarVariants = {
  collapsed: { width: 56 },
  expanded: { width: 320 }
};

const contentVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.2, ease: "easeOut" }
  },
  exit: { 
    opacity: 0, 
    x: -10,
    transition: { duration: 0.15 }
  }
};

const expandContentVariants = {
  collapsed: { 
    height: 0, 
    opacity: 0,
    transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] }
  },
  expanded: { 
    height: "auto", 
    opacity: 1,
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] }
  }
};

// Stratify Logo - Orbital S design
const StratifyLogo = ({ collapsed }) => {
  if (collapsed) {
    return (
      <svg viewBox="0 0 40 40" className="w-8 h-8">
        {/* Outer orbital ring */}
        <ellipse cx="20" cy="20" rx="18" ry="10" fill="none" stroke="#3B82F6" strokeWidth="0.8" opacity="0.4" transform="rotate(-20 20 20)" />
        {/* Middle orbital ring */}
        <ellipse cx="20" cy="20" rx="16" ry="14" fill="none" stroke="#60A5FA" strokeWidth="0.6" opacity="0.5" transform="rotate(25 20 20)" />
        {/* Inner orbital ring */}
        <ellipse cx="20" cy="20" rx="14" ry="12" fill="none" stroke="#93C5FD" strokeWidth="0.5" opacity="0.3" transform="rotate(-45 20 20)" />
        {/* Orbital dots */}
        <circle cx="36" cy="14" r="1.5" fill="#60A5FA" />
        <circle cx="4" cy="26" r="1.5" fill="#60A5FA" />
        <circle cx="28" cy="34" r="1.2" fill="#3B82F6" opacity="0.7" />
        <circle cx="8" cy="8" r="1" fill="#93C5FD" opacity="0.5" />
        {/* The S */}
        <text x="20" y="26" textAnchor="middle" fill="url(#logoGradient)" fontSize="18" fontWeight="600" fontFamily="system-ui, -apple-system, sans-serif">S</text>
        <defs>
          <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
        </defs>
      </svg>
    );
  }
  
  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 40 40" className="w-7 h-7">
        <ellipse cx="20" cy="20" rx="18" ry="10" fill="none" stroke="#3B82F6" strokeWidth="0.8" opacity="0.4" transform="rotate(-20 20 20)" />
        <ellipse cx="20" cy="20" rx="16" ry="14" fill="none" stroke="#60A5FA" strokeWidth="0.6" opacity="0.5" transform="rotate(25 20 20)" />
        <ellipse cx="20" cy="20" rx="14" ry="12" fill="none" stroke="#93C5FD" strokeWidth="0.5" opacity="0.3" transform="rotate(-45 20 20)" />
        <circle cx="36" cy="14" r="1.5" fill="#60A5FA" />
        <circle cx="4" cy="26" r="1.5" fill="#60A5FA" />
        <circle cx="28" cy="34" r="1.2" fill="#3B82F6" opacity="0.7" />
        <circle cx="8" cy="8" r="1" fill="#93C5FD" opacity="0.5" />
        <text x="20" y="26" textAnchor="middle" fill="url(#logoGradientFull)" fontSize="18" fontWeight="600" fontFamily="system-ui, -apple-system, sans-serif">S</text>
        <defs>
          <linearGradient id="logoGradientFull" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
        </defs>
      </svg>
      <span className="text-lg font-semibold text-white tracking-tight">Stratify</span>
    </div>
  );
};

// Clean folder icon - just lines
const FolderIcon = ({ open, className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
    {open ? (
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
    ) : (
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    )}
  </svg>
);

// Chevron icon
const ChevronIcon = ({ open, className = "w-3 h-3" }) => (
  <svg className={`${className} transition-transform duration-150 ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

// Strategy Folders Component - Clean design
const StrategiesFolders = ({ savedStrategies, deployedStrategies = [], onRemoveSavedStrategy, onUpdateStrategy, onDeployStrategy, onEditStrategy, sidebarExpanded }) => {
  // Custom folders stored in localStorage
  const [folders, setFolders] = useState(() => {
    const saved = localStorage.getItem('stratify-strategy-folders');
    return saved ? JSON.parse(saved) : [
      { id: 'favorites', name: 'Favorites', color: '#F59E0B', icon: 'star' },
      { id: 'active', name: 'Active', color: '#10B981', icon: 'play' },
    ];
  });
  
  const [expandedFolders, setExpandedFolders] = useState({ favorites: true, active: true, uncategorized: true });
  const [draggedStrategy, setDraggedStrategy] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [editingFolder, setEditingFolder] = useState(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderInput, setNewFolderInput] = useState('');
  const [selectedStrategy, setSelectedStrategy] = useState(null);

  // Save folders to localStorage
  useEffect(() => {
    localStorage.setItem('stratify-strategy-folders', JSON.stringify(folders));
  }, [folders]);

  // Save strategy-folder assignments
  const [strategyFolders, setStrategyFolders] = useState(() => {
    const saved = localStorage.getItem('stratify-strategy-folder-map');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('stratify-strategy-folder-map', JSON.stringify(strategyFolders));
  }, [strategyFolders]);

  const toggleFolder = (folderId) => {
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const getStrategiesInFolder = (folderId) => {
    // Active folder shows deployed strategies
    if (folderId === 'active') {
      return deployedStrategies;
    }
    if (folderId === 'uncategorized') {
      return savedStrategies.filter(s => !strategyFolders[s.id]);
    }
    return savedStrategies.filter(s => strategyFolders[s.id] === folderId);
  };

  const handleDragStart = (e, strategy) => {
    setDraggedStrategy(strategy);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, folderId) => {
    e.preventDefault();
    setDropTarget(folderId);
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = (e, folderId) => {
    e.preventDefault();
    if (draggedStrategy) {
      setStrategyFolders(prev => ({
        ...prev,
        [draggedStrategy.id]: folderId === 'uncategorized' ? null : folderId
      }));
    }
    setDraggedStrategy(null);
    setDropTarget(null);
  };

  const createFolder = () => {
    if (!newFolderInput.trim()) return;
    const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];
    const newFolder = {
      id: `folder-${Date.now()}`,
      name: newFolderInput.trim(),
      color: colors[folders.length % colors.length],
      icon: 'folder'
    };
    setFolders(prev => [...prev, newFolder]);
    setExpandedFolders(prev => ({ ...prev, [newFolder.id]: true }));
    setNewFolderInput('');
    setShowNewFolder(false);
  };

  const renameFolder = (folderId) => {
    if (!newFolderName.trim()) {
      setEditingFolder(null);
      return;
    }
    setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name: newFolderName.trim() } : f));
    setEditingFolder(null);
    setNewFolderName('');
  };

  const deleteFolder = (folderId) => {
    setFolders(prev => prev.filter(f => f.id !== folderId));
    // Move strategies to uncategorized
    setStrategyFolders(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(stratId => {
        if (updated[stratId] === folderId) updated[stratId] = null;
      });
      return updated;
    });
  };

  const FolderIconSvg = ({ icon, color }) => {
    const icons = {
      star: <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={color}/>,
      play: <path d="M5 3l14 9-14 9V3z" fill={color}/>,
      flask: <path d="M9 3v8.5c0 .83-.67 1.5-1.5 1.5S6 12.33 6 11.5V3M15 3v8.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V3M6 14c-1.66 0-3 1.34-3 3v2c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-2c0-1.66-1.34-3-3-3" stroke={color} fill="none" strokeWidth="2"/>,
      folder: <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" fill={color}/>,
    };
    return <svg className="w-4 h-4" viewBox="0 0 24 24">{icons[icon] || icons.folder}</svg>;
  };

  const renderFolder = (folder, isUncategorized = false) => {
    const strategies = getStrategiesInFolder(folder.id);
    const isOpen = expandedFolders[folder.id];
    const isDropping = dropTarget === folder.id;

    return (
      <div 
        key={folder.id}
        onDragOver={(e) => handleDragOver(e, folder.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, folder.id)}
      >
        <div className={`flex items-center gap-2 px-3 py-2.5 rounded transition-colors ${isDropping ? 'bg-blue-500/20 border border-blue-500/50' : 'hover:bg-[#1e1e2d]'}`}>
          <button onClick={() => toggleFolder(folder.id)} className="text-gray-500 hover:text-gray-300">
            <ChevronIcon open={isOpen} className="w-3 h-3" />
          </button>
          
          <FolderIconSvg icon={folder.icon} color={folder.color} />
          
          {editingFolder === folder.id ? (
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onBlur={() => renameFolder(folder.id)}
              onKeyDown={(e) => e.key === 'Enter' && renameFolder(folder.id)}
              className="flex-1 bg-transparent text-sm text-white border-b border-blue-500 outline-none px-1"
            />
          ) : (
            <span 
              className="flex-1 text-sm text-gray-300 truncate cursor-default"
              onDoubleClick={() => {
                if (!isUncategorized) {
                  setEditingFolder(folder.id);
                  setNewFolderName(folder.name);
                }
              }}
            >
              {folder.name}
            </span>
          )}
          
          <span className="text-xs text-gray-500">{strategies.length}</span>
          
          {!isUncategorized && (
            <button
              onClick={() => deleteFolder(folder.id)}
              className="opacity-0 group-hover:opacity-100 hover:opacity-100 text-gray-600 hover:text-red-400 p-0.5"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {isOpen && (
          <div className="ml-5 pl-3 border-l border-[#2a2a3d]">
            {strategies.length === 0 ? (
              <div className="py-2 px-2 text-xs text-gray-600 italic">
                {isDropping ? 'Drop here' : 'Empty'}
              </div>
            ) : (
              strategies.map(strategy => {
                const isActiveFolder = folder.id === 'active';
                const isRunning = strategy.runStatus === 'running' || strategy.status === 'deployed';
                
                return (
                  <div
                    key={strategy.id}
                    draggable={!isActiveFolder}
                    onDragStart={(e) => !isActiveFolder && handleDragStart(e, strategy)}
                    className="group flex flex-col py-2 px-2 rounded cursor-pointer transition-colors hover:bg-[#2a2a3d]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        {isActiveFolder ? (
                          /* Running indicator for active/deployed strategies */
                          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                        ) : (
                          <svg className="w-3 h-3 text-gray-600 flex-shrink-0 cursor-grab" fill="currentColor" viewBox="0 0 24 24">
                            <circle cx="5" cy="6" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="12" cy="18" r="2"/>
                          </svg>
                        )}
                        <span className={`text-sm truncate group-hover:text-gray-200 ${isActiveFolder ? 'text-gray-300' : 'text-gray-400'}`}>{strategy.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {isActiveFolder ? (
                          /* Running status for deployed strategies */
                          <span className="text-xs text-emerald-400 font-medium">Running</span>
                        ) : (
                          /* Edit, Deploy and delete buttons for saved strategies */
                          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditStrategy?.(strategy);
                              }}
                              className="text-cyan-400 hover:text-cyan-300 text-xs font-medium px-2 py-1 rounded hover:bg-cyan-500/20 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeployStrategy?.(strategy);
                              }}
                              className="text-emerald-400 hover:text-emerald-300 text-xs font-medium px-2 py-1 rounded hover:bg-emerald-500/20 transition-colors"
                            >
                              Deploy
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onRemoveSavedStrategy?.(strategy.id); }}
                              className="text-gray-600 hover:text-red-400 p-1"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="py-2 group">
      {/* Custom folders */}
      {folders.map(folder => renderFolder(folder))}
      
      {/* Uncategorized */}
      {renderFolder({ id: 'uncategorized', name: 'Uncategorized', color: '#6B7280', icon: 'folder' }, true)}

      {/* New folder input */}
      {showNewFolder ? (
        <div className="flex items-center gap-2 px-3 py-2 mt-1">
          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          <input
            autoFocus
            value={newFolderInput}
            onChange={(e) => setNewFolderInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') createFolder();
              if (e.key === 'Escape') setShowNewFolder(false);
            }}
            onBlur={() => { if (!newFolderInput) setShowNewFolder(false); }}
            placeholder="Folder name..."
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 outline-none"
          />
          <button onClick={createFolder} className="text-blue-400 hover:text-blue-300 p-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowNewFolder(true)}
          className="w-full mt-2 py-2 text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center justify-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Folder
        </button>
      )}
    </div>
  );
};

// Nav items - customizable
const defaultNavItems = [
  { id: 'watchlist', label: 'Watchlist', icon: 'eye', hasContent: true },
  { id: 'strategies', label: 'Strategies', icon: 'chart', hasContent: true },
  { id: 'brokers', label: 'Brokers', icon: 'link', hasContent: true },
  { id: 'newsletter', label: 'Newsletter', icon: 'mail' },
];

const defaultBottomItems = [
  { id: 'settings', label: 'Settings', icon: 'gear', hasContent: false },
  { id: 'help', label: 'Help', icon: 'question' },
];

// Icon component - clean outlined icons, no backgrounds
const Icon = ({ name, className = "w-4 h-4" }) => {
  const icons = {
    eye: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    chart: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    ),
    flask: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611l-.002 0a9.002 9.002 0 01-6.766-1.604 9.002 9.002 0 00-6.766 1.604l-.002 0c-1.717-.293-2.299-2.379-1.067-3.611L5 14.5" />
      </svg>
    ),
    spark: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    ),
    document: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
    mail: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
    ),
    gear: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    question: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
      </svg>
    ),
    link: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
    ),
  };
  return icons[name] || null;
};

// Settings Panel Component - Clean design
const SettingsPanel = () => {
  const [userInfo, setUserInfo] = useState(() => {
    const saved = localStorage.getItem('stratify-user-info');
    return saved ? JSON.parse(saved) : { firstName: '', lastName: '', email: '' };
  });

  const handleChange = (field, value) => {
    setUserInfo(prev => {
      const updated = { ...prev, [field]: value };
      localStorage.setItem('stratify-user-info', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <div className="px-3 py-3 space-y-3">
      <div className="space-y-2">
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wide">First Name</label>
          <input
            type="text"
            value={userInfo.firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
            placeholder="Enter first name"
            className="w-full bg-transparent border-b border-[#1e1e2d] focus:border-blue-500 px-0 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none transition-colors"
          />
        </div>
        
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wide">Last Name</label>
          <input
            type="text"
            value={userInfo.lastName}
            onChange={(e) => handleChange('lastName', e.target.value)}
            placeholder="Enter last name"
            className="w-full bg-transparent border-b border-[#1e1e2d] focus:border-blue-500 px-0 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none transition-colors"
          />
        </div>
        
        <div>
          <label className="text-[10px] text-gray-500 uppercase tracking-wide">Email</label>
          <input
            type="email"
            value={userInfo.email}
            onChange={(e) => handleChange('email', e.target.value)}
            placeholder="Enter email address"
            className="w-full bg-transparent border-b border-[#1e1e2d] focus:border-blue-500 px-0 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none transition-colors"
          />
        </div>
      </div>
    </div>
  );
};

// Mini broker icons for sidebar - Modern styled icons
// Premium circular broker icons
const PremiumBrokerIcon = ({ broker, size = 48 }) => {
  const icons = {
    // Alpaca - Blue crescent smile
    alpaca: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path d="M5 12c0 3.5 3 6.5 7 6.5s7-3 7-6.5" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    ),
    // Coinbase - Black square with brackets
    coinbase: (
      <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-5 h-5">
          <path d="M6 8v8M6 8h3M6 16h3M18 8v8M18 8h-3M18 16h-3" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>
    ),
    // Robinhood - Green feather
    robinhood: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path d="M20 4c-1.5 0-3 .5-4.5 1.5L12 9l-1-4c-.5-2-2-3-4-3-1 0-2 .5-2.5 1.5-.5 1 0 2 .5 2.5l6 6c1 1 2.5 1.5 4 1.5 2.5 0 5-2 6-4.5.5-1.5 0-3-1-4z" fill="#00C805"/>
      </svg>
    ),
    // Polymarket - Purple hexagon
    polymarket: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <polygon points="12,2 21,7 21,17 12,22 3,17 3,7" fill="none" stroke="#8B5CF6" strokeWidth="2"/>
        <circle cx="12" cy="12" r="3" fill="#8B5CF6"/>
      </svg>
    ),
    // Kalshi - Teal K
    kalshi: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path d="M8 4v16M8 12l8-8M8 12l8 8" fill="none" stroke="#00D4AA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    // Webull - Orange W
    webull: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path d="M4 6l4 12 4-8 4 8 4-12" fill="none" stroke="#FF5722" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    // IBKR - Red globe
    ibkr: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <circle cx="12" cy="12" r="9" fill="none" stroke="#D32F2F" strokeWidth="2"/>
        <path d="M12 3v18M3 12h18M5 7h14M5 17h14" stroke="#D32F2F" strokeWidth="1.5"/>
      </svg>
    ),
    // Binance - Yellow diamond
    binance: (
      <svg viewBox="0 0 24 24" className="w-6 h-6">
        <path d="M12 4l2.5 2.5L12 9 9.5 6.5 12 4z" fill="#F3BA2F"/>
        <path d="M6 10l2.5 2.5L6 15 3.5 12.5 6 10z" fill="#F3BA2F"/>
        <path d="M18 10l2.5 2.5L18 15l-2.5-2.5L18 10z" fill="#F3BA2F"/>
        <path d="M12 16l2.5 2.5L12 21l-2.5-2.5L12 16z" fill="#F3BA2F"/>
        <path d="M12 10l2.5 2.5L12 15l-2.5-2.5L12 10z" fill="#F3BA2F"/>
      </svg>
    ),
  };
  
  return (
    <div 
      className="rounded-full bg-white/5 border border-indigo-500/30 flex items-center justify-center hover:border-indigo-400/50 transition-all"
      style={{ width: size, height: size }}
    >
      {icons[broker] || null}
    </div>
  );
};

const availableBrokers = [
  { id: 'alpaca', name: 'Alpaca' },
  { id: 'coinbase', name: 'Coinbase' },
  { id: 'robinhood', name: 'Robinhood' },
  { id: 'polymarket', name: 'Polymarket' },
  { id: 'kalshi', name: 'Kalshi' },
  { id: 'webull', name: 'Webull' },
  { id: 'ibkr', name: 'IBKR' },
  { id: 'binance', name: 'Binance' },
];

// Premium Brokers Grid Component
const BrokersGrid = ({ connectedBrokers = [], onOpenBrokerModal }) => {
  const isConnected = (brokerId) => connectedBrokers.some(b => b.id === brokerId);
  
  return (
    <div className="p-4">
      <div className="grid grid-cols-3 gap-4">
        {availableBrokers.map(broker => {
          const connected = isConnected(broker.id);
          return (
            <button
              key={broker.id}
              onClick={() => !connected && onOpenBrokerModal?.()}
              className="relative flex flex-col items-center gap-2 p-2 rounded-xl transition-all hover:bg-white/5"
            >
              {connected && (
                <div className="absolute top-0 right-1">
                  <div className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}
              <PremiumBrokerIcon broker={broker.id} size={48} />
              <span className="text-xs text-gray-400">{broker.name}</span>
            </button>
          );
        })}
      </div>
      <button
        onClick={() => onOpenBrokerModal?.()}
        className="w-full mt-2 py-1.5 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
      >
        + Connect New Broker
      </button>
    </div>
  );
};

export default function Sidebar({ 
  expanded, 
  onToggle, 
  activeSection, 
  onSectionChange, 
  theme, 
  themeClasses, 
  watchlist = [], 
  onRemoveFromWatchlist,
  onAddToWatchlist,
  onViewChart, 
  savedStrategies = [], 
  deployedStrategies = [],
  onRemoveSavedStrategy,
  onDeployStrategy,
  onEditStrategy,
  connectedBrokers = [],
  onOpenBrokerModal,
  customNavItems,
  customBottomItems
}) {
  const [hoveredItem, setHoveredItem] = useState(null);
  
  // Use custom items if provided, otherwise defaults
  const navItems = customNavItems || defaultNavItems;
  const bottomItems = customBottomItems || defaultBottomItems;
  
  // Track which sections are expanded (multiple can be open)
  const [expandedSections, setExpandedSections] = useState(() => {
    const saved = localStorage.getItem('stratify-expanded-sections');
    return saved ? JSON.parse(saved) : { watchlist: true, strategies: false };
  });

  // Save expanded sections to localStorage
  useEffect(() => {
    localStorage.setItem('stratify-expanded-sections', JSON.stringify(expandedSections));
  }, [expandedSections]);

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => {
      // If clicking the already open section, close it
      if (prev[sectionId]) {
        return { ...prev, [sectionId]: false };
      }
      // Otherwise, close all sections and open only the clicked one (accordion behavior)
      const allClosed = Object.keys(prev).reduce((acc, key) => ({ ...acc, [key]: false }), {});
      return { ...allClosed, [sectionId]: true };
    });
  };

  // Expand on hover, collapse on leave
  const handleMouseEnter = () => onToggle(true);
  const handleMouseLeave = () => onToggle(false);

  return (
    <motion.div 
      id="sidebar-container"
      initial={false}
      animate={expanded ? "expanded" : "collapsed"}
      variants={sidebarVariants}
      transition={{ 
        type: "spring", 
        stiffness: 300, 
        damping: 30,
        mass: 0.8
      }}
      className="flex flex-col bg-[#0f0f14] border-r border-[#1e1e2d]"
      onMouseEnter={handleMouseEnter} 
      onMouseLeave={handleMouseLeave}
    >
      {/* Logo */}
      <div className="h-14 flex items-center justify-center px-3">
        <StratifyLogo collapsed={!expanded} />
      </div>

      {/* Divider */}
      <div className="mx-3 border-t border-[#1e1e2d]" />

      {/* Stock Search */}
      <StockSearch collapsed={!expanded} watchlist={watchlist} onAddToWatchlist={onAddToWatchlist} />

      {/* Navigation */}
      <nav className="flex-1 py-3 flex flex-col overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {/* Expanded sections at top */}
        {navItems.filter(item => expandedSections[item.id]).map((item) => {
          const isExpanded = expandedSections[item.id];
          const isActive = activeSection === item.id;
          
          return (
            <div key={item.id} className="border-b border-white/5">
              {/* Nav item */}
              <button 
                onClick={() => {
                  onSectionChange(item.id);
                  if (item.hasContent && expanded) {
                    toggleSection(item.id);
                  }
                }}
                onMouseEnter={() => setHoveredItem(item.id)} 
                onMouseLeave={() => setHoveredItem(null)}
                className={`w-full flex items-center gap-3 px-4 py-2 transition-colors relative group ${
                  isActive 
                    ? 'text-white' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-blue-500 rounded-r" />
                )}
                <Icon name={item.icon} className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-400' : ''}`} />
                {expanded && (
                  <>
                    <span className="text-sm flex-1 text-left">{item.label}</span>
                    {item.hasContent && (
                      <ChevronIcon open={isExpanded} className="w-3 h-3 text-gray-600" />
                    )}
                  </>
                )}
                {!expanded && hoveredItem === item.id && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-[#3c4043] text-white text-xs rounded shadow-lg whitespace-nowrap z-50 border border-[#1e1e2d]">
                    {item.label}
                  </div>
                )}
              </button>

              {/* Watchlist content */}
              {expanded && item.id === 'watchlist' && isExpanded && (
                <div className="ml-4 border-l border-[#1e1e2d]">
                  <div className="overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    <Watchlist 
                      stocks={watchlist} 
                      onRemove={onRemoveFromWatchlist}
                      onViewChart={onViewChart}
                      themeClasses={themeClasses}
                      compact={true}
                    />
                  </div>
                </div>
              )}

              {/* Strategies content */}
              {expanded && item.id === 'strategies' && isExpanded && (
                <div className="ml-4 border-l border-[#1e1e2d]">
                  <div className="overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    <StrategiesFolders 
                      savedStrategies={savedStrategies} 
                      deployedStrategies={deployedStrategies}
                      onRemoveSavedStrategy={onRemoveSavedStrategy}
                      onDeployStrategy={onDeployStrategy}
                      onEditStrategy={onEditStrategy}
                      sidebarExpanded={expanded}
                    />
                  </div>
                </div>
              )}

              {/* Brokers content */}
              {expanded && item.id === 'brokers' && isExpanded && (
                <div className="ml-4 border-l border-[#1e1e2d]">
                  <BrokersGrid 
                    connectedBrokers={connectedBrokers}
                    onOpenBrokerModal={onOpenBrokerModal}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Spacer pushes collapsed items to bottom */}
        <div className="flex-1" />

        {/* Collapsed sections at bottom */}
        {navItems.filter(item => !expandedSections[item.id]).map((item, index, arr) => {
          const isExpanded = expandedSections[item.id];
          const isActive = activeSection === item.id;
          const isLast = index === arr.length - 1;
          
          return (
            <div key={item.id} className={!isLast ? 'border-b border-white/5' : ''}>
              {/* Nav item */}
              <button 
                onClick={() => {
                  onSectionChange(item.id);
                  if (item.hasContent && expanded) {
                    toggleSection(item.id);
                  }
                }}
                onMouseEnter={() => setHoveredItem(item.id)} 
                onMouseLeave={() => setHoveredItem(null)}
                className={`w-full flex items-center gap-3 px-4 py-2 transition-colors relative group ${
                  isActive 
                    ? 'text-white' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-blue-500 rounded-r" />
                )}
                <Icon name={item.icon} className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-400' : ''}`} />
                {expanded && (
                  <>
                    <span className="text-sm flex-1 text-left">{item.label}</span>
                    {item.hasContent && (
                      <ChevronIcon open={isExpanded} className="w-3 h-3 text-gray-600" />
                    )}
                  </>
                )}
                {!expanded && hoveredItem === item.id && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-[#3c4043] text-white text-xs rounded shadow-lg whitespace-nowrap z-50 border border-[#1e1e2d]">
                    {item.label}
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-3 border-t border-[#1e1e2d]" />

      {/* Bottom items */}
      <div className="py-3">
        {bottomItems.map((item) => {
          const isExpanded = expandedSections[item.id];
          const isActive = activeSection === item.id;
          
          return (
            <div key={item.id}>
              <button 
                onClick={() => {
                  onSectionChange(item.id);
                  if (item.hasContent && expanded) {
                    toggleSection(item.id);
                  }
                }} 
                onMouseEnter={() => setHoveredItem(item.id)} 
                onMouseLeave={() => setHoveredItem(null)}
                className={`w-full flex items-center gap-3 px-4 py-2 transition-colors relative group ${
                  isActive 
                    ? 'text-white' 
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-blue-500 rounded-r" />
                )}
                
                <Icon name={item.icon} className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-400' : ''}`} />
                
                {expanded && (
                  <>
                    <span className="text-sm flex-1 text-left">{item.label}</span>
                    {item.hasContent && (
                      <ChevronIcon open={isExpanded} className="w-3 h-3 text-gray-600" />
                    )}
                  </>
                )}
                
                {!expanded && hoveredItem === item.id && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-[#3c4043] text-white text-xs rounded shadow-lg whitespace-nowrap z-50 border border-[#1e1e2d]">
                    {item.label}
                  </div>
                )}
              </button>
              
{/* Settings opens as full page now */}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
