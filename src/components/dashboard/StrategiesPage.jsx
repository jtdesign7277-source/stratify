import { useMemo, useState } from 'react';
import FeaturedStrategies from '../strategies/FeaturedStrategies';

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

const GradientOrb = ({ className }) => (
  <div className={`absolute rounded-full blur-3xl opacity-20 ${className}`} />
);

export default function StrategiesPage({ savedStrategies = [], onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState('All');
  const [assetFilter, setAssetFilter] = useState('All');

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
      const matchesAsset = assetFilter === 'All' || assetValue.toLowerCase().includes(assetFilter.toLowerCase());
      return matchesSearch && matchesRisk && matchesAsset;
    });
  }, [savedStrategies, searchTerm, riskFilter, assetFilter]);

  return (
    <div className="h-full overflow-y-auto bg-[#060d18]">
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
              className="p-3 bg-[#0a1628] hover:bg-[#1a2a4a] rounded-xl transition-colors"
              aria-label="Close Strategies"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Featured Strategies - Now with real data and modals */}
        <section className="mb-12">
          <FeaturedStrategies />
        </section>

        {/* Your Saved Strategies */}
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
              <div className="min-w-[240px] bg-[#0a1628] border border-white/10 rounded-2xl p-5 text-sm text-gray-500">
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
                  className="min-w-[240px] bg-[#0a1628] border border-white/10 rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-[0_0_24px_rgba(16,185,129,0.2)]"
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
            <button className="min-w-[200px] bg-[#060d18] border border-dashed border-white/10 rounded-2xl p-5 text-sm text-gray-400 hover:text-white hover:border-cyan-500/50 transition-all duration-300 flex items-center justify-center gap-2">
              <span className="text-lg">＋</span>
              Add New
            </button>
          </div>
        </section>

        {/* Explore More */}
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
                className={`bg-gradient-to-br ${item.accent} border border-white/10 rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/30 hover:shadow-[0_0_24px_rgba(34,211,238,0.15)]`}
              >
                <div className="w-10 h-10 rounded-xl bg-[#0a1628] border border-white/10 flex items-center justify-center text-lg text-white mb-4">
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
