import React, { useState, useEffect } from 'react';
import { Search, Plus, FolderOpen, Folder, ChevronRight, Play, Pause, Edit3, Trash2, MoreHorizontal, Star, Zap, TrendingUp, Clock, X } from 'lucide-react';

const StrategiesPage = ({ savedStrategies = [], deployedStrategies = [], onDeployStrategy, onEditStrategy, onRemoveSavedStrategy, setActiveTab }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [draggedStrategy, setDraggedStrategy] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  // Folders state
  const [folders, setFolders] = useState(() => {
    const saved = localStorage.getItem('stratify-strategy-folders');
    return saved ? JSON.parse(saved) : [
      { id: 'favorites', name: 'Favorites', color: '#F59E0B', icon: 'star' },
      { id: 'active', name: 'Active', color: '#10B981', icon: 'play' },
      { id: 'grok', name: 'Grok Strategies', color: '#10B981', icon: 'zap' },
    ];
  });

  const [expandedFolders, setExpandedFolders] = useState({ 'stratify-templates': false, favorites: false, active: false, grok: false, uncategorized: false });

  const [strategyFolders, setStrategyFolders] = useState(() => {
    const saved = localStorage.getItem('stratify-strategy-folder-map');
    return saved ? JSON.parse(saved) : {};
  });

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('stratify-strategy-folders', JSON.stringify(folders));
  }, [folders]);

  useEffect(() => {
    localStorage.setItem('stratify-strategy-folder-map', JSON.stringify(strategyFolders));
  }, [strategyFolders]);

  // Default strategies if none provided
  const defaultStrategies = [
    { id: '1', name: 'RSI Momentum', type: 'Momentum', status: 'active', winRate: 68, trades: 142, pnl: 2340.50 },
    { id: '2', name: 'MACD Crossover', type: 'Trend', status: 'paused', winRate: 54, trades: 89, pnl: 890.25 },
    { id: '3', name: 'Mean Reversion SPY', type: 'Mean Reversion', status: 'active', winRate: 72, trades: 56, pnl: 1567.80 },
    { id: '4', name: 'Breakout Scanner', type: 'Breakout', status: 'draft', winRate: 0, trades: 0, pnl: 0 },
    { id: '5', name: 'Scalping BTC', type: 'Scalping', status: 'active', winRate: 61, trades: 234, pnl: 4521.90 },
  ];

  const strategies = savedStrategies.length > 0 ? savedStrategies : defaultStrategies;

  const getStrategiesInFolder = (folderId) => {
    if (folderId === 'active') {
      return strategies.filter(s => s.status === 'active' || deployedStrategies.some(d => d.id === s.id));
    }
    if (folderId === 'grok') {
      return strategies.filter(s => s.code || strategyFolders[s.id] === 'grok' || s.folderId === 'grok');
    }
    if (folderId === 'stratify-templates') {
      return strategies.filter(s => strategyFolders[s.id] === 'stratify-templates' || s.folderId === 'stratify-templates');
    }
    if (folderId === 'favorites') {
      return strategies.filter(s => strategyFolders[s.id] === 'favorites' || s.folderId === 'favorites');
    }
    if (folderId === 'uncategorized') {
      return strategies.filter(s => !strategyFolders[s.id] && !s.folderId && s.status !== 'active' && !s.code);
    }
    return strategies.filter(s => strategyFolders[s.id] === folderId || s.folderId === folderId);
  };

  const toggleFolder = (folderId) => {
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
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
    if (!newFolderName.trim()) return;
    const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];
    const newFolder = {
      id: `folder-${Date.now()}`,
      name: newFolderName.trim(),
      color: colors[folders.length % colors.length],
      icon: 'folder'
    };
    setFolders(prev => [...prev, newFolder]);
    setExpandedFolders(prev => ({ ...prev, [newFolder.id]: true }));
    setNewFolderName('');
    setShowNewFolder(false);
  };

  const deleteFolder = (folderId) => {
    setFolders(prev => prev.filter(f => f.id !== folderId));
    setStrategyFolders(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(stratId => {
        if (updated[stratId] === folderId) updated[stratId] = null;
      });
      return updated;
    });
  };

  const FolderIcon = ({ icon, color }) => {
    if (icon === 'star') return <Star className="w-4 h-4" fill="none" stroke={color} strokeWidth={1.5} />;
    if (icon === 'play') return <Play className="w-4 h-4" fill="none" stroke={color} strokeWidth={1.5} />;
    if (icon === 'zap') return <Zap className="w-4 h-4" fill="none" stroke={color} strokeWidth={1.5} />;
    return <Folder className="w-4 h-4" stroke={color} fill={color} fillOpacity={0.2} strokeWidth={1.5} />;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-emerald-500/20 text-emerald-400';
      case 'paused': return 'bg-yellow-500/20 text-yellow-400';
      case 'draft': return 'bg-gray-500/20 text-gray-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const renderFolder = (folder, isSystem = false) => {
    const folderStrategies = getStrategiesInFolder(folder.id);
    const isExpanded = expandedFolders[folder.id];
    const isDropping = dropTarget === folder.id;

    return (
      <div 
        key={folder.id}
        className="mb-2"
        onDragOver={(e) => handleDragOver(e, folder.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, folder.id)}
      >
        {/* Folder Header */}
        <button
          onClick={() => toggleFolder(folder.id)}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
            isDropping ? 'bg-emerald-500/20 border border-emerald-500/50' : 'bg-[#111118] hover:bg-white/5'
          }`}
        >
          <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} strokeWidth={1.5} />
          <FolderIcon icon={folder.icon} color={folder.color} />
          <span className="flex-1 text-left text-white text-sm font-medium">{folder.name}</span>
          {!isSystem && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteFolder(folder.id);
              }}
              className="p-1 hover:bg-red-500/20 rounded text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          )}
          <span className="ml-auto text-xs text-gray-500 bg-[#1a2438] px-2 py-0.5 rounded min-w-[28px] text-center">
            {folderStrategies.length}
          </span>
        </button>

        {/* Folder Content */}
        {isExpanded && (
          <div className="mt-1 ml-4 pl-4 border-l border-gray-800">
            {folderStrategies.length === 0 ? (
              <div className="py-4 text-center text-gray-500 text-sm">
                {isDropping ? 'Drop strategy here' : 'No strategies'}
              </div>
            ) : (
              folderStrategies.map((strategy) => (
                <div
                  key={strategy.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, strategy)}
                  onDoubleClick={() => {
                    if (strategy.status !== 'active') {
                      onDeployStrategy?.(strategy, true);
                    }
                  }}
                  className="group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors cursor-grab active:cursor-grabbing"
                  title="Double-click to deploy"
                >
                  {/* Strategy Icon */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    strategy.status === 'active' ? 'bg-emerald-500/20' : 'bg-gray-800'
                  }`}>
                    {strategy.status === 'active' ? (
                      <Zap className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
                    ) : (
                      <TrendingUp className="w-4 h-4 text-gray-500" strokeWidth={1.5} />
                    )}
                  </div>

                  {/* Strategy Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-medium truncate">{strategy.name}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getStatusColor(strategy.status)}`}>
                        {strategy.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{strategy.type}</span>
                      {strategy.winRate > 0 && <span>{strategy.winRate}% win</span>}
                      {strategy.trades > 0 && <span>{strategy.trades} trades</span>}
                    </div>
                  </div>

                  {/* PnL */}
                  {strategy.pnl !== 0 && (
                    <div className="text-sm font-mono flex items-center">
                      <span className="text-emerald-400">$</span>
                      <span className={strategy.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {strategy.pnl >= 0 ? '+' : ''}{Math.abs(strategy.pnl)?.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {/* Actions - Edit & Delete only (double-click to deploy) */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => { e.stopPropagation(); onEditStrategy?.(strategy); }}
                      className="p-1.5 hover:bg-emerald-500/20 rounded text-gray-400 hover:text-emerald-400" 
                      title="Edit"
                    >
                      <Edit3 className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onRemoveSavedStrategy?.(strategy.id); }}
                      className="p-1.5 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400" 
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0d0d12] p-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Strategies</h1>
          <p className="text-gray-400 text-sm">Manage and deploy your trading strategies</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowNewFolder(!showNewFolder)}
            className="px-4 py-2 bg-[#1a2438] hover:bg-[#243048] text-gray-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <FolderOpen className="w-4 h-4" strokeWidth={1.5} />
            New Folder
          </button>
        </div>
      </div>

      {/* New Folder Input */}
      {showNewFolder && (
        <div className="mb-4 bg-[#111118] border border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Folder className="w-5 h-5 text-emerald-400" strokeWidth={1.5} />
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createFolder()}
              placeholder="Enter folder name..."
              className="flex-1 bg-transparent text-white placeholder-gray-500 text-sm outline-none"
              autoFocus
            />
            <button
              onClick={createFolder}
              disabled={!newFolderName.trim()}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Create
            </button>
            <button
              onClick={() => setShowNewFolder(false)}
              className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}

      {/* Folders List */}
      <div className="flex-1 overflow-auto">
        {/* System Folders */}
        {renderFolder({ id: 'stratify-templates', name: 'STRATIFY', color: '#EF4444', icon: 'zap' }, true)}
        {renderFolder({ id: 'active', name: 'Active Strategies', color: '#10B981', icon: 'play' }, true)}
        {renderFolder({ id: 'favorites', name: 'Favorites', color: '#F59E0B', icon: 'star' }, true)}
        
        {/* Custom Folders */}
        {folders.filter(f => f.id !== 'favorites' && f.id !== 'active' && f.id !== 'stratify-templates').map(folder => renderFolder(folder))}
        
        {/* Uncategorized */}
        {renderFolder({ id: 'uncategorized', name: 'Uncategorized', color: '#6B7280', icon: 'folder' }, true)}
      </div>

      {/* Stats Footer */}
      <div className="mt-4 pt-4 border-t border-gray-800 flex items-center justify-between text-sm">
        <span className="text-gray-400">{strategies.length} total strategies</span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-gray-500">{strategies.filter(s => s.status === 'active').length} active</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
            <span className="text-gray-500">{strategies.filter(s => s.status === 'paused').length} paused</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-gray-500"></span>
            <span className="text-gray-500">{strategies.filter(s => s.status === 'draft').length} drafts</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default StrategiesPage;
