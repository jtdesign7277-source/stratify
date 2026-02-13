import React, { useState, useEffect } from 'react';
import { Search, Plus, FolderOpen, Folder, ChevronRight, Play, Pause, Edit3, Trash2, MoreHorizontal, Star, Zap, TrendingUp, Clock, X, Activity, Target, Layers, BarChart2 } from 'lucide-react';
import StrategyTemplateFlow from './StrategyTemplateFlow';

const TEMPLATES = [
  { id: 'momentum', name: 'Momentum Trend', icon: TrendingUp, color: '#22d3ee', winRate: '62%', avgReturn: '+18.4%', desc: 'EMA crossover trend following' },
  { id: 'rsi-bounce', name: 'RSI Bounce', icon: Activity, color: '#34d399', winRate: '68%', avgReturn: '+24.1%', desc: 'Mean reversion on RSI extremes' },
  { id: 'macd-cross', name: 'MACD Crossover', icon: BarChart2, color: '#f59e0b', winRate: '58%', avgReturn: '+15.7%', desc: 'Momentum signal line cross' },
  { id: 'mean-reversion', name: 'Mean Reversion', icon: Target, color: '#a78bfa', winRate: '65%', avgReturn: '+21.3%', desc: 'RSI band stretched pullbacks' },
  { id: 'breakout', name: 'Breakout Hunter', icon: Zap, color: '#f472b6', winRate: '52%', avgReturn: '+28.6%', desc: 'Volume-confirmed breakouts' },
  { id: 'scalper', name: 'Scalping Engine', icon: Layers, color: '#fb923c', winRate: '71%', avgReturn: '+31.2%', desc: 'High-freq micro momentum' },
];

const StrategiesPage = ({ savedStrategies = [], deployedStrategies = [], onDeployStrategy, onEditStrategy, onRemoveSavedStrategy, setActiveTab }) => {
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [draggedStrategy, setDraggedStrategy] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  const [folders, setFolders] = useState(() => {
    const saved = localStorage.getItem('stratify-strategy-folders');
    return saved ? JSON.parse(saved) : [
      { id: 'favorites', name: 'Favorites', color: '#F59E0B', icon: 'star' },
      { id: 'active', name: 'Active', color: '#10B981', icon: 'play' },
      { id: 'grok', name: 'Grok Strategies', color: '#10B981', icon: 'zap' },
    ];
  });

  const [expandedFolders, setExpandedFolders] = useState({ 'stratify-templates': false, favorites: false, active: false, grok: false, uncategorized: true });

  const [strategyFolders, setStrategyFolders] = useState(() => {
    const saved = localStorage.getItem('stratify-strategy-folder-map');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => { localStorage.setItem('stratify-strategy-folders', JSON.stringify(folders)); }, [folders]);
  useEffect(() => { localStorage.setItem('stratify-strategy-folder-map', JSON.stringify(strategyFolders)); }, [strategyFolders]);

  const defaultStrategies = [
    { id: '1', name: 'RSI Momentum', type: 'Momentum', status: 'active', winRate: 68, trades: 142, pnl: 2340.50 },
    { id: '2', name: 'MACD Crossover', type: 'Trend', status: 'paused', winRate: 54, trades: 89, pnl: 890.25 },
    { id: '3', name: 'Mean Reversion SPY', type: 'Mean Reversion', status: 'active', winRate: 72, trades: 56, pnl: 1567.80 },
    { id: '4', name: 'Breakout Scanner', type: 'Breakout', status: 'draft', winRate: 0, trades: 0, pnl: 0 },
    { id: '5', name: 'Scalping BTC', type: 'Scalping', status: 'active', winRate: 61, trades: 234, pnl: 4521.90 },
  ];

  const strategies = savedStrategies.length > 0 ? savedStrategies : defaultStrategies;

  const getStrategiesInFolder = (folderId) => {
    if (folderId === 'active') return strategies.filter(s => s.status === 'active' || deployedStrategies.some(d => d.id === s.id));
    if (folderId === 'grok') return strategies.filter(s => s.code || strategyFolders[s.id] === 'grok' || s.folderId === 'grok');
    if (folderId === 'stratify-templates') return strategies.filter(s => strategyFolders[s.id] === 'stratify-templates' || s.folderId === 'stratify-templates');
    if (folderId === 'favorites') return strategies.filter(s => strategyFolders[s.id] === 'favorites' || s.folderId === 'favorites');
    if (folderId === 'uncategorized') return strategies.filter(s => s.folderId === 'uncategorized' || (!strategyFolders[s.id] && !s.folderId && s.status !== 'active' && !s.code));
    return strategies.filter(s => strategyFolders[s.id] === folderId || s.folderId === folderId);
  };

  const toggleFolder = (folderId) => setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));

  const handleDragStart = (e, strategy) => { setDraggedStrategy(strategy); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver = (e, folderId) => { e.preventDefault(); setDropTarget(folderId); };
  const handleDragLeave = () => setDropTarget(null);
  const handleDrop = (e, folderId) => {
    e.preventDefault();
    if (draggedStrategy) setStrategyFolders(prev => ({ ...prev, [draggedStrategy.id]: folderId === 'uncategorized' ? null : folderId }));
    setDraggedStrategy(null);
    setDropTarget(null);
  };

  const createFolder = () => {
    if (!newFolderName.trim()) return;
    const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];
    const nf = { id: `folder-${Date.now()}`, name: newFolderName.trim(), color: colors[folders.length % colors.length], icon: 'folder' };
    setFolders(prev => [...prev, nf]);
    setExpandedFolders(prev => ({ ...prev, [nf.id]: true }));
    setNewFolderName('');
    setShowNewFolder(false);
  };

  const deleteFolder = (folderId) => {
    setFolders(prev => prev.filter(f => f.id !== folderId));
    setStrategyFolders(prev => { const u = { ...prev }; Object.keys(u).forEach(k => { if (u[k] === folderId) u[k] = null; }); return u; });
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

  const renderFolder = (folder, isSystem = false) => {
    const items = getStrategiesInFolder(folder.id);
    const open = expandedFolders[folder.id];
    const dropping = dropTarget === folder.id;

    return (
      <div key={folder.id} onDragOver={(e) => handleDragOver(e, folder.id)} onDragLeave={handleDragLeave} onDrop={(e) => handleDrop(e, folder.id)}>
        <button
          onClick={() => toggleFolder(folder.id)}
          className={`group w-full flex items-center gap-2 px-3 py-1.5 rounded-md transition-all text-xs ${
            dropping ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30' : 'hover:bg-white/[0.03]'
          }`}
        >
          <ChevronRight className={`w-3 h-3 text-white/30 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} strokeWidth={2} />
          <FolderIcon icon={folder.icon} color={folder.color} />
          <span className="flex-1 text-left text-white/70 font-medium truncate">{folder.name}</span>
          <span className="text-[10px] text-white/20 tabular-nums">{items.length}</span>
          {!isSystem && (
            <Trash2
              onClick={(e) => { e.stopPropagation(); deleteFolder(folder.id); }}
              className="w-3 h-3 text-white/0 group-hover:text-white/20 hover:!text-red-400 cursor-pointer transition-colors"
              strokeWidth={1.5}
            />
          )}
        </button>

        {open && items.length > 0 && (
          <div className="ml-5 mt-0.5 border-l border-white/[0.04] pl-2">
            {items.map((s) => (
              <div
                key={s.id}
                draggable
                onDragStart={(e) => handleDragStart(e, s)}
                onDoubleClick={() => { if (s.status !== 'active') onDeployStrategy?.(s, true); }}
                className="group flex items-center gap-2 px-2 py-[5px] rounded-md hover:bg-white/[0.03] cursor-grab active:cursor-grabbing transition-colors"
              >
                <span className="text-white/80 text-xs font-medium truncate flex-1">{s.name}</span>
                <span className={`px-1.5 py-px rounded text-[9px] font-medium leading-tight ${statusStyle(s.status)}`}>{s.status}</span>
                <span className="text-[10px] text-white/25 w-16 text-right">{s.type}</span>
                {s.pnl !== 0 && (
                  <span className={`text-[11px] font-mono tabular-nums w-20 text-right ${s.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {s.pnl >= 0 ? '+' : ''}{s.pnl?.toFixed(2)}
                  </span>
                )}
                <span
                  onClick={(e) => { e.stopPropagation(); onDeployStrategy?.(s, true); }}
                  className="text-[9px] text-emerald-500/60 hover:text-emerald-400 uppercase tracking-wider font-semibold cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Deploy
                </span>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Edit3 onClick={(e) => { e.stopPropagation(); onEditStrategy?.(s); }} className="w-3 h-3 text-white/20 hover:text-emerald-400 cursor-pointer" strokeWidth={1.5} />
                  <Trash2 onClick={(e) => { e.stopPropagation(); onRemoveSavedStrategy?.(s.id); }} className="w-3 h-3 text-white/20 hover:text-red-400 cursor-pointer" strokeWidth={1.5} />
                </div>
              </div>
            ))}
          </div>
        )}
        {open && items.length === 0 && (
          <div className="ml-5 pl-2 py-2 text-[10px] text-white/15 border-l border-white/[0.04]">
            {dropping ? 'Drop here' : 'Empty'}
          </div>
        )}
      </div>
    );
  };

  // ── Template selected → show full detail ──
  if (selectedTemplate) {
    return (
      <div className="flex-1 flex flex-col h-full bg-[#0b0b0b] overflow-hidden">
        <StrategyTemplateFlow initialTemplate={selectedTemplate} onBack={() => setSelectedTemplate(null)} />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0b0b0b] overflow-hidden">
      {/* ── Header ── */}
      <div className="shrink-0 px-5 pt-4 pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white tracking-tight">Strategies</h1>
          <p className="text-[11px] text-white/25 mt-0.5">Templates &amp; saved strategies</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" strokeWidth={1.5} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="pl-8 pr-3 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg text-xs text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/30 w-44 transition-colors"
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

      {/* ── Template Cards ── */}
      <div className="shrink-0 px-5 pb-3">
        <div className="grid grid-cols-3 gap-2">
          {TEMPLATES.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setSelectedTemplate(t.id)}
                className="group relative text-left p-3 rounded-xl transition-all duration-300 hover:scale-[1.015] overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.005) 100%)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = t.color + '40';
                  e.currentTarget.style.boxShadow = `0 0 20px ${t.color}08, inset 0 1px 0 ${t.color}10`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Subtle gradient orb */}
                <div
                  className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-500"
                  style={{ background: `radial-gradient(circle, ${t.color}, transparent)` }}
                />
                <div className="relative flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: t.color + '12' }}
                    >
                      <Icon className="w-3.5 h-3.5" style={{ color: t.color }} fill="none" strokeWidth={1.5} />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-white/90 block leading-tight">{t.name}</span>
                      <span className="text-[9px] text-white/25 leading-tight">{t.desc}</span>
                    </div>
                  </div>
                </div>
                <div className="relative flex items-center gap-3">
                  <div>
                    <span className="text-[9px] text-white/20 uppercase tracking-wider">Return</span>
                    <span className="block text-sm font-bold text-emerald-400 leading-tight font-mono">{t.avgReturn}</span>
                  </div>
                  <div className="w-px h-6 bg-white/[0.06]" />
                  <div>
                    <span className="text-[9px] text-white/20 uppercase tracking-wider">Win Rate</span>
                    <span className="block text-sm font-bold text-white/70 leading-tight font-mono">{t.winRate}</span>
                  </div>
                  <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-3.5 h-3.5" style={{ color: t.color }} fill="none" strokeWidth={1.5} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── New Folder Input ── */}
      {showNewFolder && (
        <div className="shrink-0 mx-5 mb-2 flex items-center gap-2 px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg">
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
          <button onClick={createFolder} disabled={!newFolderName.trim()} className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded text-[10px] font-medium disabled:opacity-30 transition-colors">
            Create
          </button>
          <X onClick={() => setShowNewFolder(false)} className="w-3.5 h-3.5 text-white/20 hover:text-white/50 cursor-pointer" strokeWidth={1.5} />
        </div>
      )}

      {/* ── Folders ── */}
      <div className="flex-1 overflow-y-auto px-5 pb-3" style={{ scrollbarWidth: 'thin', scrollbarColor: '#222 transparent' }}>
        {renderFolder({ id: 'stratify-templates', name: 'STRATIFY', color: '#EF4444', icon: 'zap' }, true)}
        {renderFolder({ id: 'active', name: 'Active Strategies', color: '#10B981', icon: 'play' }, true)}
        {renderFolder({ id: 'favorites', name: 'Favorites', color: '#F59E0B', icon: 'star' }, true)}
        {folders.filter(f => !['favorites', 'active', 'stratify-templates'].includes(f.id)).map(f => renderFolder(f))}
        {renderFolder({ id: 'uncategorized', name: 'Uncategorized', color: '#6B7280', icon: 'folder' }, true)}
      </div>

      {/* ── Stats Footer ── */}
      <div className="shrink-0 px-5 py-2 border-t border-white/[0.04] flex items-center justify-between">
        <span className="text-[10px] text-white/20">{strategies.length} strategies</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[10px] text-white/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {deployedStrategies.filter(s => s.status !== 'Paused').length} live
          </span>
          <span className="flex items-center gap-1 text-[10px] text-white/30">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {deployedStrategies.filter(s => s.status === 'Paused').length} paused
          </span>
          <span className="flex items-center gap-1 text-[10px] text-white/30">
            <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
            {strategies.filter(s => s.status === 'draft' || s.status === 'inactive').length} drafts
          </span>
        </div>
      </div>
    </div>
  );
};

export default StrategiesPage;
