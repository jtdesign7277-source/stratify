import React, { useMemo, useState } from 'react';
import { Search, Zap, TrendingUp, Activity, BarChart3, Flame } from 'lucide-react';

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

const StrategyTemplatesGallery = ({ onSelectTemplate = () => {} }) => {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

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
    <div className="bg-[#060d18] border border-gray-800 rounded-2xl p-6 text-white">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Strategy Templates</h2>
          <p className="text-sm text-gray-400">
            Spin up pre-built strategies or remix them into your own edge.
          </p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search templates"
            className="w-full rounded-lg border border-gray-800 bg-[#0a1628] py-2 pl-9 pr-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
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
                ? 'border-purple-500/60 bg-purple-500/20 text-purple-200'
                : 'border-gray-800 bg-[#0a1628] text-gray-400 hover:text-white'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {featuredTemplate && (
          <div className="md:col-span-2 lg:col-span-3">
            <div className="relative h-full rounded-2xl border border-purple-500/80 bg-gradient-to-br from-[#0a1628] via-[#0d1930] to-[#111a2d] p-6">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/20 px-3 py-1 text-xs font-semibold text-purple-200">
                  <Zap className="h-3.5 w-3.5" />
                  Featured Playbook
                </span>
                <span className="inline-flex items-center rounded-full border border-gray-700 px-2.5 py-1 text-xs text-gray-300">
                  {featuredTemplate.category}
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
                        className="rounded-full border border-gray-700 bg-[#0a1628] px-2.5 py-1 text-xs text-gray-300"
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
                  <button
                    onClick={() => onSelectTemplate(featuredTemplate)}
                    className="mt-2 inline-flex items-center justify-center rounded-lg bg-purple-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-400"
                  >
                    Use Template
                  </button>
                </div>
              </div>
              <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-purple-500/20 blur-2xl" />
            </div>
          </div>
        )}

        {standardTemplates.map((template) => (
          <div
            key={template.id}
            className="flex h-full flex-col rounded-2xl border border-gray-800 bg-[#0a1628] p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-white">{template.name}</h3>
                <span className="mt-2 inline-flex items-center rounded-full border border-gray-700 px-2.5 py-1 text-xs text-gray-300">
                  {template.category}
                </span>
              </div>
              <div className="rounded-lg bg-[#111d33] p-2 text-gray-300">
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
                  <TrendingUp className="h-4 w-4 text-purple-400" />
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

            <button
              onClick={() => onSelectTemplate(template)}
              className="mt-5 inline-flex items-center justify-center rounded-lg border border-gray-700 bg-[#101d33] px-4 py-2 text-sm font-medium text-white transition hover:border-purple-500/60 hover:bg-purple-500/10"
            >
              Use Template
            </button>
          </div>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-gray-800 bg-[#0a1628] p-8 text-center text-sm text-gray-400">
          No templates match your search. Try a different keyword or category.
        </div>
      )}
    </div>
  );
};

export default StrategyTemplatesGallery;
