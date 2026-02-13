import React, { useEffect, useState } from 'react';
import {
  Activity,
  BarChart2,
  ChevronRight,
  Edit3,
  Folder,
  Play,
  Plus,
  Search,
  Star,
  Target,
  Trash2,
  TrendingUp,
  X,
  Zap,
  Layers,
} from 'lucide-react';
import StrategyTemplateFlow from './StrategyTemplateFlow';

const TEMPLATES = [
  { id: 'momentum', name: 'Momentum', icon: TrendingUp, color: '#22d3ee', winRate: '62%', avgReturn: '+18.4%', desc: 'EMA crossover trend following' },
  { id: 'rsi-bounce', name: 'RSI Bounce', icon: Activity, color: '#34d399', winRate: '68%', avgReturn: '+24.1%', desc: 'Mean reversion on RSI extremes' },
  { id: 'macd-cross', name: 'MACD Cross', icon: BarChart2, color: '#f59e0b', winRate: '58%', avgReturn: '+15.7%', desc: 'Signal line confirmation entries' },
  { id: 'mean-reversion', name: 'Mean Reversion', icon: Target, color: '#a78bfa', winRate: '65%', avgReturn: '+21.3%', desc: 'Band stretched pullbacks' },
  { id: 'breakout', name: 'Breakout', icon: Zap, color: '#f472b6', winRate: '52%', avgReturn: '+28.6%', desc: 'Volume-backed expansion' },
  { id: 'scalper', name: 'Scalper', icon: Layers, color: '#fb923c', winRate: '71%', avgReturn: '+31.2%', desc: 'High-frequency micro momentum' },
];

const StrategiesPage = ({
  savedStrategies = [],
  deployedStrategies = [],
  onDeployStrategy,
  onEditStrategy,
  onRemoveSavedStrategy,
  setActiveTab,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [draggedStrategy, setDraggedStrategy] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  const [folders, setFolders] = useState(() => {
    const saved = localStorage.getItem('stratify-strategy-folders');
    return saved
      ? JSON.parse(saved)
      : [
          { id: 'favorites', name: 'Favorites', color: '#F59E0B', icon: 'star' },
          { id: 'active', name: 'Active', color: '#10B981', icon: 'play' },
          { id: 'grok', name: 'Grok Strategies', color: '#10B981', icon: 'zap' },
        ];
  });

  const [expandedFolders, setExpandedFolders] = useState({
    'stratify-templates': false,
    favorites: false,
    active: false,
    grok: false,
    uncategorized: true,
  });

  const [strategyFolders, setStrategyFolders] = useState(() => {
    const saved = localStorage.getItem('stratify-strategy-folder-map');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('stratify-strategy-folders', JSON.stringify(folders));
  }, [folders]);
  useEffect(() => {
    localStorage.setItem('stratify-strategy-folder-map', JSON.stringify(strategyFolders));
  }, [strategyFolders]);

  const defaultStrategies = [
    { id: '1', name: 'RSI Momentum', type: 'Momentum', status: 'active', winRate: 68, trades: 142, pnl: 2340.5 },
    { id: '2', name: 'MACD Crossover', type: 'Trend', status: 'paused', winRate: 54, trades: 89, pnl: 890.25 },
    { id: '3', name: 'Mean Reversion SPY', type: 'Mean Reversion', status: 'active', winRate: 72, trades: 56, pnl: 1567.8 },
    { id: '4', name: 'Breakout Scanner', type: 'Breakout', status: 'draft', winRate: 0, trades: 0, pnl: 0 },
    { id: '5', name: 'Scalping BTC', type: 'Scalping', status: 'active', winRate: 61, trades: 234, pnl: 4521.9 },
  ];

  const strategies = savedStrategies.length > 0 ? savedStrategies : defaultStrategies;

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const matchesSearch = (s) => {
    if (!normalizedQuery) return true;
    return (
      s.name?.toLowerCase().includes(normalizedQuery) ||
      s.type?.toLowerCase().includes(normalizedQuery) ||
      s.status?.toLowerCase().includes(normalizedQuery)
    );
  };

  const getStrategiesInFolder = (folderId) => {
    if (folderId === 'active')
      return strategies.filter(
        (s) => s.status === 'active' || deployedStrategies.some((d) => d.id === s.id)
      );
    if (folderId === 'grok')
      return strategies.filter((s) => s.code || strategyFolders[s.id] === 'grok' || s.folderId === 'grok');
    if (folderId === 'stratify-templates')
      return strategies.filter(
        (s) => strategyFolders[s.id] === 'stratify-templates' || s.folderId === 'stratify-templates'
      );
    if (folderId === 'favorites')
      return strategies.filter((s) => strategyFolders[s.id] === 'favorites' || s.folderId === 'favorites');
    if (folderId === 'uncategorized')
      return strategies.filter(
        (s) =>
          s.folderId === 'uncategorized' ||
          (!strategyFolders[s.id] && !s.folderId && s.status !== 'active' && !s.code)
      );
    return strategies.filter((s) => strategyFolders[s.id] === folderId || s.folderId === folderId);
  };

  const toggleFolder = (folderId) =>
    setExpandedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));

  const handleDragStart = (e, strategy) => {
    setDraggedStrategy(strategy);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e, folderId) => {
    e.preventDefault();
    setDropTarget(folderId);
  };
  const handleDragLeave = () => setDropTarget(null);
  const handleDrop = (e, folderId) => {
    e.preventDefault();
    if (draggedStrategy)
      setStrategyFolders((prev) => ({
        ...prev,
        [draggedStrategy.id]: folderId === 'uncategorized' ? null : folderId,
      }));
    setDraggedStrategy(null);
    setDropTarget(null);
  };

  const createFolder = () => {
    if (!newFolderName.trim()) return;
    const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];
    const nf = {
      id: `folder-${Date.now()}`,
      name: newFolderName.trim(),
      color: colors[folders.length % colors.length],
      icon: 'folder',
    };
    setFolders((prev) => [...prev, nf]);
    setExpandedFolders((prev) => ({ ...prev, [nf.id]: true }));
    setNewFolderName('');
    setShowNewFolder(false);
  };

  const deleteFolder = (folderId) => {
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    setStrategyFolders((prev) => {
      const u = { ...prev };
      Object.keys(u).forEach((k) => {
        if (u[k] === folderId) u[k] = null;
      });
      return u;
    });
  };

  const FolderIcon = ({ icon, color }) => {
    if (icon === 'star') return <Star className="w-3.5 h-3.5" fill="none" stroke={color} strokeWidth={1.5} />;
    if (icon === 'play') return <Play className="w-3.5 h-3.5" fill="none" stroke={color} strokeWidth={1.5} />;
    if (icon === 'zap') return <Zap className="w-3.5 h-3.5" fill="none" stroke={color} strokeWidth={1.5} />;
    return <Folder className="w-3.5 h-3.5" stroke={color} fill={color} fillOpacity={0.2} strokeWidth={1.5} />;
  };

  const statusStyle = (s) => {
    if (s === 'active') return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20';
    if (s === 'paused') return 'bg-amber-500/15 text-amber-400 border border-amber-500/20';
    return 'bg-white/5 text-white/40 border border-white/5';
  };

  const filteredFolderItems = (folderId) => getStrategiesInFolder(folderId).filter(matchesSearch);

  const renderFolder = (folder, isSystem = false) => {
    const items = filteredFolderItems(folder.id);
    const open = expandedFolders[folder.id];
    const dropping = dropTarget === folder.id;

    return (
      <div
        key={folder.id}
        onDragOver={(e) => handleDragOver(e, folder.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, folder.id)}
        className="mb-1"
      >
        <button
          onClick={() => toggleFolder(folder.id)}
          className={`group w-full flex items-center gap-2 px-3 py-1.5 rounded-md transition-all text-[11px] tracking-wide ${
            dropping ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30' : 'hover:bg-white/[0.03]'
          }`}
        >
          <ChevronRight
            className={`w-3 h-3 text-white/30 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
            strokeWidth={2}
          />
          <FolderIcon icon={folder.icon} color={folder.color} />
          <span className="flex-1 text-left text-white/70 font-medium truncate">{folder.name}</span>
          <span className="text-[10px] text-white/20 tabular-nums">{items.length}</span>
          {!isSystem && (
            <Trash2
              onClick={(e) => {
                e.stopPropagation();
                deleteFolder(folder.id);
              }}
              className="w-3 h-3 text-white/0 group-hover:text-white/20 hover:!text-red-400 cursor-pointer transition-colors"
              strokeWidth={1.5}
            />
          )}
        </button>

        {open && items.length > 0 && (
          <div className="ml-4 mt-1 border-l border-white/[0.04] pl-2">
            {items.map((s) => (
              <div
                key={s.id}
                draggable
                onDragStart={(e) => handleDragStart(e, s)}
                onDoubleClick={() => {
                  if (s.status !== 'active') onDeployStrategy?.(s, true);
                }}
                className="group flex items-center gap-2 px-2 py-1 rounded-md hover:bg-white/[0.03] cursor-grab active:cursor-grabbing transition-colors"
              >
                <span className="text-white/85 text-[11px] font-medium truncate flex-1">{s.name}</span>
                <span className={`px-1.5 py-px rounded text-[9px] font-medium leading-tight ${statusStyle(s.status)}`}>{s.status}</span>
                <span className="text-[10px] text-white/25 w-16 text-right">{s.type}</span>
                <span className={`text-[11px] font-mono tabular-nums w-20 text-right ${s.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {s.pnl >= 0 ? '+' : ''}{s.pnl?.toFixed(2)}
                </span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeployStrategy?.(s, true);
                  }}
                  className="text-[9px] text-emerald-500/60 hover:text-emerald-400 uppercase tracking-wider font-semibold cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Deploy
                </span>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Edit3
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditStrategy?.(s);
                    }}
                    className="w-3 h-3 text-white/20 hover:text-emerald-400 cursor-pointer"
                    strokeWidth={1.5}
                  />
                  <Trash2
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveSavedStrategy?.(s.id);
                    }}
                    className="w-3 h-3 text-white/20 hover:text-red-400 cursor-pointer"
                    strokeWidth={1.5}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        {open && items.length === 0 && (
          <div className="ml-4 pl-2 py-2 text-[10px] text-white/15 border-l border-white/[0.04]">
            {dropping ? 'Drop here' : normalizedQuery ? 'No matches' : 'Empty'}
          </div>
        )}
      </div>
    );
  };

  if (selectedTemplate) {
    return (
      <div className="flex-1 flex flex-col h-full bg-[#0b0b0b] overflow-hidden">
        <StrategyTemplateFlow initialTemplate={selectedTemplate} onBack={() => setSelectedTemplate(null)} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0b0b] overflow-hidden">
      <div className="shrink-0 px-6 pt-5 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-semibold text-white tracking-tight">Strategy Templates</h1>
            <p className="text-[11px] text-white/25 mt-0.5">Premium blueprints for rapid deployment</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" strokeWidth={1.5} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search strategies..."
                className="pl-8 pr-3 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-xs text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/30 w-48 transition-colors"
              />
            </div>
            <button
              onClick={() => setShowNewFolder(!showNewFolder)}
              className="p-1.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-lg text-white/40 hover:text-white/60 transition-colors"
              title="New Folder"
            >
              <Plus className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {TEMPLATES.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setSelectedTemplate(t.id)}
                className="group relative text-left p-4 rounded-2xl transition-all duration-300 hover:scale-[1.02]"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 40%, rgba(255,255,255,0.01) 100%)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(10px)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = `${t.color}55`;
                  e.currentTarget.style.boxShadow = `0 0 26px ${t.color}2a, 0 8px 24px rgba(0,0,0,0.45)`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div
                  className="absolute -top-8 -right-10 w-28 h-28 rounded-full opacity-[0.06] group-hover:opacity-[0.12] transition-opacity duration-500"
                  style={{ background: `radial-gradient(circle, ${t.color}, transparent)` }}
                />
                <div className="relative flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ background: `${t.color}1f`, boxShadow: `inset 0 0 0 1px ${t.color}33` }}
                    >
                      <Icon className="w-4 h-4" style={{ color: t.color }} fill="none" strokeWidth={1.5} />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-white/90 block leading-tight">{t.name}</span>
                      <span className="text-[10px] text-white/30 leading-tight">{t.desc}</span>
                    </div>
                  </div>
                </div>
                <div className="relative mt-3 flex items-center gap-4">
                  <div>
                    <span className="text-[9px] text-white/25 uppercase tracking-wider">Avg Return</span>
                    <span className="block text-sm font-bold text-emerald-400 leading-tight font-mono">{t.avgReturn}</span>
                  </div>
                  <div className="w-px h-7 bg-white/[0.08]" />
                  <div>
                    <span className="text-[9px] text-white/25 uppercase tracking-wider">Win Rate</span>
                    <span className="block text-sm font-bold text-white/70 leading-tight font-mono">{t.winRate}</span>
                  </div>
                  <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-4 h-4" style={{ color: t.color }} fill="none" strokeWidth={1.5} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-h-0 px-6 pb-3">
        {showNewFolder && (
          <div className="mb-2 flex items-center gap-2 px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg">
            <Folder className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createFolder()}
              placeholder="Folder name..."
              className="flex-1 bg-transparent text-white placeholder-white/20 text-xs outline-none"
              autoFocus
            />
            <button
              onClick={createFolder}
              disabled={!newFolderName.trim()}
              className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded text-[10px] font-medium disabled:opacity-30 transition-colors"
            >
              Create
            </button>
            <X onClick={() => setShowNewFolder(false)} className="w-3.5 h-3.5 text-white/20 hover:text-white/50 cursor-pointer" strokeWidth={1.5} />
          </div>
        )}

        <div
          className="h-full overflow-y-auto pr-1"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#222 transparent' }}
        >
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/25 mb-2">Folders</div>
          {renderFolder({ id: 'stratify-templates', name: 'STRATIFY', color: '#EF4444', icon: 'zap' }, true)}
          {renderFolder({ id: 'active', name: 'Active Strategies', color: '#10B981', icon: 'play' }, true)}
          {renderFolder({ id: 'favorites', name: 'Favorites', color: '#F59E0B', icon: 'star' }, true)}
          {folders.filter((f) => !['favorites', 'active', 'stratify-templates'].includes(f.id)).map((f) => renderFolder(f))}
          {renderFolder({ id: 'uncategorized', name: 'Uncategorized', color: '#6B7280', icon: 'folder' }, true)}
        </div>
      </div>

      <div className="shrink-0 px-6 py-2 border-t border-white/[0.04] flex items-center justify-between">
        <span className="text-[10px] text-white/20">{strategies.length} strategies</span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-[10px] text-white/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {deployedStrategies.filter((s) => s.status !== 'Paused').length} live
          </span>
          <span className="flex items-center gap-1 text-[10px] text-white/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {deployedStrategies.filter((s) => s.status === 'Paused').length} paused
          </span>
          <span className="flex items-center gap-1 text-[10px] text-white/30">
            <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
            {strategies.filter((s) => s.status === 'draft' || s.status === 'inactive').length} drafts
          </span>
        </div>
      </div>
    </div>
  );
};

export default StrategiesPage;
