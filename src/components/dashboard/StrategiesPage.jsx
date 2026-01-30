import { useMemo, useState } from 'react';

const FEATURED_STRATEGIES = [
  {
    name: 'Growth Investing',
    description: 'Stocks with high growth potential',
    risk: 'Medium-High',
    assetType: 'Stocks',
  },
  {
    name: 'Dividend Investing',
    description: 'Companies with regular dividend payouts',
    risk: 'Low-Medium',
    assetType: 'Stocks',
  },
  {
    name: 'Value Investing',
    description: 'Undervalued stocks with strong fundamentals',
    risk: 'Medium',
    assetType: 'Stocks',
  },
  {
    name: 'Index Fund Investing',
    description: 'Broad market index funds for diversification',
    risk: 'Low',
    assetType: 'ETFs',
  },
  {
    name: 'Day Trading',
    description: 'Buy/sell stocks within the same day',
    risk: 'High',
    assetType: 'Stocks',
  },
  {
    name: 'Momentum Trading',
    description: 'Ride trending stocks for quick gains',
    risk: 'High',
    assetType: 'Stocks',
  },
];

const EXPLORE_MORE = [
  { title: 'Risk Management Tools', icon: '🛡️', accent: 'from-emerald-500/20 to-cyan-500/10' },
  { title: 'Portfolio Analyzer', icon: '📈', accent: 'from-cyan-500/20 to-blue-500/10' },
  { title: 'Market News', icon: '📰', accent: 'from-amber-500/20 to-orange-500/10' },
  { title: 'Community Forums', icon: '💬', accent: 'from-purple-500/20 to-fuchsia-500/10' },
];

const riskToneMap = {
  low: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  medium: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  high: 'bg-red-500/15 text-red-300 border-red-500/30',
};

const resolveRiskTone = (label = '') => {
  const normalized = label.toLowerCase();
  if (normalized.includes('high')) return 'high';
  if (normalized.includes('medium')) return 'medium';
  if (normalized.includes('low')) return 'low';
  return 'medium';
};

const matchAssetType = (value = '', filter = 'All') => {
  if (filter === 'All') return true;
  return value.toLowerCase().includes(filter.toLowerCase());
};

const GradientOrb = ({ className }) => (
  <div className={`absolute rounded-full blur-3xl opacity-20 ${className}`} />
);

export default function StrategiesPage({ savedStrategies = [], onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('All');
  const [assetFilter, setAssetFilter] = useState('All');

  const filteredFeatured = useMemo(() => {
    return FEATURED_STRATEGIES.filter((strategy) => {
      const matchesSearch =
        strategy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        strategy.description.toLowerCase().includes(searchTerm.toLowerCase());
      const tone = resolveRiskTone(strategy.risk);
      const matchesRisk = riskFilter === 'All' || tone === riskFilter.toLowerCase();
      const matchesAsset = matchAssetType(strategy.assetType, assetFilter);
      return matchesSearch && matchesRisk && matchesAsset;
    });
  }, [searchTerm, riskFilter, assetFilter]);

  const filteredSaved = useMemo(() => {
    return savedStrategies.filter((strategy) => {
      const name = strategy.name || strategy.title || 'Untitled Strategy';
      const description = strategy.description || strategy.type || '';
      const riskLabel = strategy.riskLevel || strategy.risk || '';
      const tone = resolveRiskTone(riskLabel);
      const matchesSearch =
        name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRisk = riskFilter === 'All' || tone === riskFilter.toLowerCase();
      const assetValue = strategy.assetType || strategy.type || '';
      const matchesAsset = matchAssetType(assetValue, assetFilter);
      return matchesSearch && matchesRisk && matchesAsset;
    });
  }, [savedStrategies, searchTerm, riskFilter, assetFilter]);

  return (
    <div className="h-full overflow-y-auto bg-[#0a0a0f]">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <GradientOrb className="w-[28rem] h-[28rem] bg-cyan-500 -top-48 -right-32" />
        <GradientOrb className="w-[26rem] h-[26rem] bg-emerald-500 -bottom-44 -left-32" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 md:px-8 py-10">
        <div className="flex items-start justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Strategies</h1>
            <p className="text-gray-500">Explore premium strategies and manage your saved playbook</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-3 bg-[#1e1e2d] hover:bg-[#2a2a3d] rounded-xl transition-colors"
              aria-label="Close Strategies"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="bg-[#0f0f14] border border-[#1e1e2d] rounded-2xl p-4 md:p-6 mb-10 shadow-[0_0_30px_rgba(56,189,248,0.08)]">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <label className="text-xs text-gray-500">Search strategies</label>
              <div className="mt-2 flex items-center gap-2 bg-[#0a0a0f] border border-[#1e1e2d] rounded-xl px-4 py-3">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search by name, style, or keyword"
                  className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex flex-1 flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="text-xs text-gray-500">Risk level</label>
                <select
                  value={riskFilter}
                  onChange={(event) => setRiskFilter(event.target.value)}
                  className="mt-2 w-full bg-[#0a0a0f] border border-[#1e1e2d] rounded-xl px-4 py-3 text-sm text-gray-200 focus:outline-none focus:border-cyan-500/40"
                >
                  <option>All</option>
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500">Asset type</label>
                <select
                  value={assetFilter}
                  onChange={(event) => setAssetFilter(event.target.value)}
                  className="mt-2 w-full bg-[#0a0a0f] border border-[#1e1e2d] rounded-xl px-4 py-3 text-sm text-gray-200 focus:outline-none focus:border-emerald-500/40"
                >
                  <option>All</option>
                  <option>Stocks</option>
                  <option>Options</option>
                  <option>Crypto</option>
                  <option>ETFs</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">Featured Strategies</p>
              <h2 className="text-xl font-semibold text-white mt-2">Premium playbooks built for performance</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredFeatured.map((strategy) => {
              const tone = resolveRiskTone(strategy.risk);
              return (
                <div
                  key={strategy.name}
                  className="group bg-[#0f0f14] border border-[#1e1e2d] rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/40 hover:shadow-[0_0_30px_rgba(34,211,238,0.18)]"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-1">{strategy.name}</h3>
                      <p className="text-sm text-gray-500">{strategy.description}</p>
                    </div>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${riskToneMap[tone]}`}>
                      {strategy.risk}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-6">
                    <span className="text-xs text-gray-500">Asset: {strategy.assetType}</span>
                    <button className="text-sm font-medium text-cyan-300 hover:text-cyan-200 transition-colors">
                      View Details →
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredFeatured.length === 0 && (
              <div className="col-span-full text-sm text-gray-500 border border-dashed border-[#1e1e2d] rounded-2xl p-8 text-center">
                No featured strategies match your filters.
              </div>
            )}
          </div>
        </section>

        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <span className="text-xl">📊</span>
              <div>
                <h2 className="text-xl font-semibold text-white">Your Saved Strategies</h2>
                <p className="text-sm text-gray-500">Quick access to your personal library</p>
              </div>
            </div>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4" style={{ scrollbarWidth: 'none' }}>
            {filteredSaved.length === 0 && (
              <div className="min-w-[240px] bg-[#0f0f14] border border-[#1e1e2d] rounded-2xl p-5 text-sm text-gray-500">
                No saved strategies yet. Add your first one.
              </div>
            )}
            {filteredSaved.map((strategy) => {
              const name = strategy.name || strategy.title || 'Untitled Strategy';
              const description = strategy.description || strategy.type || 'Custom strategy';
              const riskLabel = strategy.riskLevel || strategy.risk || 'Medium';
              const tone = resolveRiskTone(riskLabel);
              return (
                <div
                  key={strategy.id || name}
                  className="min-w-[240px] bg-[#0f0f14] border border-[#1e1e2d] rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-[0_0_24px_rgba(16,185,129,0.2)]"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-base font-semibold text-white">{name}</h3>
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${riskToneMap[tone]}`}>
                      {riskLabel.toString().toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">{description}</p>
                  <button className="text-xs font-medium text-emerald-300 hover:text-emerald-200 transition-colors">
                    Open Strategy
                  </button>
                </div>
              );
            })}
            <button className="min-w-[200px] bg-[#0a0a0f] border border-dashed border-[#1e1e2d] rounded-2xl p-5 text-sm text-gray-400 hover:text-white hover:border-cyan-500/50 transition-all duration-300 flex items-center justify-center gap-2">
              <span className="text-lg">＋</span>
              Add New
            </button>
          </div>
        </section>

        <section className="mb-6">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-xl">🧩</span>
            <div>
              <h2 className="text-xl font-semibold text-white">Explore More</h2>
              <p className="text-sm text-gray-500">Tools to deepen your strategy research</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {EXPLORE_MORE.map((item) => (
              <div
                key={item.title}
                className={`bg-gradient-to-br ${item.accent} border border-[#1e1e2d] rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/30 hover:shadow-[0_0_24px_rgba(34,211,238,0.15)]`}
              >
                <div className="w-10 h-10 rounded-xl bg-[#0f0f14] border border-[#1e1e2d] flex items-center justify-center text-lg text-white mb-4">
                  {item.icon}
                </div>
                <p className="text-sm font-semibold text-white">{item.title}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
