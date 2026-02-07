import React, { useMemo, useState } from 'react';
import { Search, Zap, TrendingUp, Activity, BarChart3, Flame, X, Save, AlertTriangle, DollarSign, Target, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const categoryTabs = [
  'All',
  'Featured',
  'Momentum',
  'Mean Reversion',
  'Event-Based',
  'Scalping',
  'Trend Following',
];

const templates = [
  {
    id: 'featured-super-bowl-2026',
    name: 'Super Bowl Stocks 2026',
    category: 'Featured',
    description:
      'Targets brands with heavy Super Bowl ad spend and streaming exposure. Rotates into DIS, GOOGL, META, NFLX, and BUD leading into game week.',
    metrics: { winRate: '64%', avgReturn: '+8.3%', risk: 'Medium' },
    tags: ['DIS', 'GOOGL', 'META', 'NFLX', 'BUD'],
    featured: true,
  },
  {
    id: 'rsi-momentum',
    name: 'RSI Momentum',
    category: 'Momentum',
    description:
      'Buys oversold pullbacks and fades overbought spikes using RSI thresholds with volume confirmation.',
    metrics: { winRate: '58%', avgReturn: '+3.1%', risk: 'Medium' },
  },
  {
    id: 'macd-crossover',
    name: 'MACD Crossover',
    category: 'Trend Following',
    description:
      'Captures trend shifts with MACD signal crossovers and adaptive stop placement for momentum regimes.',
    metrics: { winRate: '55%', avgReturn: '+4.6%', risk: 'Medium' },
  },
  {
    id: 'gap-fill',
    name: 'Gap Fill Strategy',
    category: 'Mean Reversion',
    description:
      'Fades large overnight gaps in liquid equities once early volume confirms a mean-reversion setup.',
    metrics: { winRate: '61%', avgReturn: '+2.4%', risk: 'Low' },
  },
  {
    id: 'bollinger-squeeze',
    name: 'Bollinger Squeeze',
    category: 'Momentum',
    description:
      'Waits for volatility compression then enters on breakout confirmation with ATR-based targets.',
    metrics: { winRate: '52%', avgReturn: '+6.8%', risk: 'High' },
  },
  {
    id: 'mean-reversion-spy',
    name: 'Mean Reversion SPY',
    category: 'Mean Reversion',
    description:
      'Reverts SPY to its 20-day mean using intraday z-score extremes and time-based exits.',
    metrics: { winRate: '66%', avgReturn: '+1.9%', risk: 'Low' },
  },
  {
    id: 'earnings-momentum',
    name: 'Earnings Momentum',
    category: 'Event-Based',
    description:
      'Plays post-earnings drift by riding strong guidance surprises with tight volatility filters.',
    metrics: { winRate: '57%', avgReturn: '+5.4%', risk: 'Medium' },
  },
  {
    id: 'friday-spy-calls',
    name: 'Friday SPY Calls',
    category: 'Event-Based',
    description:
      'If markets bleed all week, buys Friday EOD SPY calls for a mean-reverting squeeze into close.',
    metrics: { winRate: '49%', avgReturn: '+7.2%', risk: 'High' },
  },
  {
    id: 'liquidity-scalp',
    name: 'Liquidity Scalper',
    category: 'Scalping',
    description:
      'Hits short-term liquidity pockets with tight spreads, fast exits, and depth-of-book confirmations.',
    metrics: { winRate: '63%', avgReturn: '+0.9%', risk: 'Medium' },
  },
];

// Template Edit Modal
const TemplateEditModal = ({ template, isOpen, onClose, onSave }) => {
  const [settings, setSettings] = useState({
    name: template?.name || '',
    riskLevel: template?.metrics?.risk || 'Medium',
    stopLoss: 3,
    takeProfit: 6,
    positionSize: 10,
    maxPositions: 3,
    timeframe: '1D',
  });

  if (!isOpen || !template) return null;

  const handleSave = () => {
    const strategy = {
      id: `strategy-${Date.now()}`,
      name: settings.name,
      type: template.category,
      description: template.description,
      status: 'inactive',
      winRate: parseInt(template.metrics.winRate) || 0,
      trades: 0,
      pnl: 0,
      folderId: 'uncategorized',
      settings: { ...settings },
      createdAt: Date.now(),
    };
    onSave(strategy);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        />
        
        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg rounded-2xl border border-[#2a2a3d] bg-[#0d0d12] shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#1e1e2d] p-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Customize Template</h3>
              <p className="text-sm text-gray-400">{template.category}</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
            {/* Strategy Name */}
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Strategy Name</label>
              <input
                type="text"
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                className="w-full rounded-lg border border-[#2a2a3d] bg-[#0a0a0f] px-4 py-2.5 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>

            {/* Risk Level */}
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                Risk Level
              </label>
              <div className="flex gap-2">
                {['Low', 'Medium', 'High'].map((level) => (
                  <button
                    key={level}
                    onClick={() => setSettings({ ...settings, riskLevel: level })}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                      settings.riskLevel === level
                        ? level === 'Low' ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                        : level === 'Medium' ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                        : 'border-red-500 bg-red-500/20 text-red-400'
                        : 'border-[#2a2a3d] bg-[#0a0a0f] text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            {/* Stop Loss & Take Profit */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
                  <Target className="w-3 h-3 inline mr-1" />
                  Stop Loss %
                </label>
                <input
                  type="number"
                  value={settings.stopLoss}
                  onChange={(e) => setSettings({ ...settings, stopLoss: parseFloat(e.target.value) })}
                  className="w-full rounded-lg border border-[#2a2a3d] bg-[#0a0a0f] px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-red-500/40"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
                  <TrendingUp className="w-3 h-3 inline mr-1" />
                  Take Profit %
                </label>
                <input
                  type="number"
                  value={settings.takeProfit}
                  onChange={(e) => setSettings({ ...settings, takeProfit: parseFloat(e.target.value) })}
                  className="w-full rounded-lg border border-[#2a2a3d] bg-[#0a0a0f] px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
            </div>

            {/* Position Size & Max Positions */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
                  <DollarSign className="w-3 h-3 inline mr-1" />
                  Position Size %
                </label>
                <input
                  type="number"
                  value={settings.positionSize}
                  onChange={(e) => setSettings({ ...settings, positionSize: parseFloat(e.target.value) })}
                  className="w-full rounded-lg border border-[#2a2a3d] bg-[#0a0a0f] px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
                  Max Positions
                </label>
                <input
                  type="number"
                  value={settings.maxPositions}
                  onChange={(e) => setSettings({ ...settings, maxPositions: parseInt(e.target.value) })}
                  className="w-full rounded-lg border border-[#2a2a3d] bg-[#0a0a0f] px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
            </div>

            {/* Timeframe */}
            <div>
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
                <Clock className="w-3 h-3 inline mr-1" />
                Timeframe
              </label>
              <div className="flex gap-2 flex-wrap">
                {['1m', '5m', '15m', '1H', '4H', '1D'].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setSettings({ ...settings, timeframe: tf })}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                      settings.timeframe === tf
                        ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                        : 'border-[#2a2a3d] bg-[#0a0a0f] text-gray-400 hover:border-gray-600'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* Template Info */}
            <div className="rounded-lg border border-[#1e1e2d] bg-[#0a0a0f] p-4">
              <p className="text-sm text-gray-400">{template.description}</p>
              <div className="mt-3 flex gap-4 text-xs text-gray-500">
                <span>Win Rate: <span className="text-emerald-400">{template.metrics.winRate}</span></span>
                <span>Avg Return: <span className="text-sky-400">{template.metrics.avgReturn}</span></span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-[#1e1e2d] p-4">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#2a2a3d] text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-medium flex items-center gap-2 transition-colors"
            >
              <Save className="w-4 h-4" />
              Save to Strategies
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

const StrategyTemplatesGallery = ({ onSelectTemplate = () => {}, onSaveToStrategies }) => {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleTemplateClick = (template) => {
    setSelectedTemplate(template);
    setIsModalOpen(true);
  };

  const handleSaveStrategy = (strategy) => {
    if (onSaveToStrategies) {
      onSaveToStrategies(strategy);
    }
  };

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return templates.filter((template) => {
      const matchesCategory =
        activeCategory === 'All' || template.category === activeCategory;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        template.name.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, searchQuery]);

  const featuredTemplate = filteredTemplates.find((template) => template.featured);
  const standardTemplates = filteredTemplates.filter((template) => !template.featured);

  return (
    <div className="h-full overflow-y-auto bg-[#0a0a0f] p-6 text-white" style={{ scrollbarWidth: 'none' }}>
      <style>{`::-webkit-scrollbar { display: none; }`}</style>
      
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Strategy Templates</h2>
          <p className="text-sm text-gray-400">
            Click any template to customize and save to your strategies.
          </p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search templates"
            className="w-full rounded-lg border border-[#1e1e2d] bg-[#0d0d12] py-2 pl-9 pr-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {categoryTabs.map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              activeCategory === category
                ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-200'
                : 'border-[#1e1e2d] bg-[#0d0d12] text-gray-400 hover:text-white'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {featuredTemplate && (
          <div className="md:col-span-2 lg:col-span-3">
            <div 
              onClick={() => handleTemplateClick(featuredTemplate)}
              className="relative h-full rounded-2xl border border-emerald-500/60 bg-gradient-to-br from-[#0a0a0f] via-[#0d0d12] to-[#0f0f14] p-6 cursor-pointer hover:border-emerald-400 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] transition-all"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200">
                  <Zap className="h-3.5 w-3.5" />
                  Featured Playbook
                </span>
                <span className="inline-flex items-center rounded-full border border-[#2a2a3a] px-2.5 py-1 text-xs text-gray-300">
                  {featuredTemplate.category}
                </span>
                <span className="inline-flex items-center rounded-full bg-blue-500/20 px-2.5 py-1 text-xs text-blue-300">
                  Click to customize
                </span>
              </div>
              <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-3">
                  <h3 className="text-2xl font-semibold">{featuredTemplate.name}</h3>
                  <p className="text-sm text-gray-300 max-w-2xl">
                    {featuredTemplate.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {featuredTemplate.tags?.map((ticker) => (
                      <span
                        key={ticker}
                        className="rounded-full border border-[#2a2a3a] bg-[#0d0d12] px-2.5 py-1 text-xs text-gray-300"
                      >
                        {ticker}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3 text-sm text-gray-300">
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                    Win Rate: {featuredTemplate.metrics.winRate}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-300">
                    <BarChart3 className="h-4 w-4 text-sky-400" />
                    Avg Return: {featuredTemplate.metrics.avgReturn}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-300">
                    <Activity className="h-4 w-4 text-amber-400" />
                    Risk Level: {featuredTemplate.metrics.risk}
                  </div>
                </div>
              </div>
              <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald-500/20 blur-2xl" />
            </div>
          </div>
        )}

        {standardTemplates.map((template) => (
          <div
            key={template.id}
            onClick={() => handleTemplateClick(template)}
            className="flex h-full flex-col rounded-2xl border border-[#1e1e2d] bg-[#0d0d12] p-5 cursor-pointer hover:border-emerald-500/40 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)] transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-white">{template.name}</h3>
                <span className="mt-2 inline-flex items-center rounded-full border border-[#2a2a3a] px-2.5 py-1 text-xs text-gray-300">
                  {template.category}
                </span>
              </div>
              <div className="rounded-lg bg-[#0f0f14] p-2 text-gray-300">
                {template.category === 'Momentum' && (
                  <Zap className="h-4 w-4 text-emerald-400" />
                )}
                {template.category === 'Mean Reversion' && (
                  <Activity className="h-4 w-4 text-sky-400" />
                )}
                {template.category === 'Event-Based' && (
                  <Flame className="h-4 w-4 text-amber-400" />
                )}
                {template.category === 'Scalping' && (
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                )}
                {template.category === 'Trend Following' && (
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                )}
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-400">{template.description}</p>

            <div className="mt-4 space-y-2 text-xs text-gray-400">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                  Win Rate
                </span>
                <span className="text-gray-200">{template.metrics.winRate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <BarChart3 className="h-3.5 w-3.5 text-sky-400" />
                  Avg Return
                </span>
                <span className="text-gray-200">{template.metrics.avgReturn}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 text-amber-400" />
                  Risk Level
                </span>
                <span className="text-gray-200">{template.metrics.risk}</span>
              </div>
            </div>

            <div className="mt-4 text-center text-xs text-emerald-400/60">
              Click to customize & save
            </div>
          </div>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-[#1e1e2d] bg-[#0d0d12] p-8 text-center text-sm text-gray-400">
          No templates match your search. Try a different keyword or category.
        </div>
      )}

      {/* Edit Modal */}
      <TemplateEditModal
        template={selectedTemplate}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveStrategy}
      />
    </div>
  );
};

export default StrategyTemplatesGallery;
