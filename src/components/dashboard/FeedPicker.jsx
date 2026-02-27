// FeedPicker.jsx — Full-screen overlay for selecting pinned feeds
// Opens from folder icon in Community sidebar
// User selects up to 8 feeds from 50, organized by category

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Check, Search, TrendingUp, Flame, Cpu, Globe,
  Bitcoin, BookOpen, Smile, RotateCcw, Bookmark
} from 'lucide-react'

const CATEGORY_ICONS = {
  'Market Pulse':        TrendingUp,
  'Hot & Trending':      Flame,
  'Tech & Innovation':   Cpu,
  'Macro & Politics':    Globe,
  'Crypto':              Bitcoin,
  'Strategy & Education': BookOpen,
  'Culture & Vibes':     Smile,
}

const CATEGORY_COLORS = {
  'Market Pulse':        'blue',
  'Hot & Trending':      'orange',
  'Tech & Innovation':   'purple',
  'Macro & Politics':    'emerald',
  'Crypto':              'yellow',
  'Strategy & Education': 'cyan',
  'Culture & Vibes':     'pink',
}

const FEED_CATEGORIES = {
  'Market Pulse': [
    'Earnings', 'Momentum', 'Macro', 'Options', 'Sentiment',
    'PreMarket', 'AfterHours', 'Sectors', 'Indices', 'Volume'
  ],
  'Hot & Trending': [
    'Trending', 'MemeStocks', 'Runners', 'Squeezes', 'IPOs',
    'SPACs', 'PennyStocks', 'Breakouts'
  ],
  'Tech & Innovation': [
    'BigTech', 'AI', 'Semis', 'EVs', 'Fintech', 'Biotech', 'SpaceTech'
  ],
  'Macro & Politics': [
    'FedWatch', 'Trump', 'ElonMusk', 'Politics', 'Tariffs',
    'Bonds', 'Commodities', 'Forex', 'Housing', 'Jobs'
  ],
  'Crypto': [
    'Bitcoin', 'Ethereum', 'Altcoins', 'DeFi', 'CryptoNews'
  ],
  'Strategy & Education': [
    'TechnicalAnalysis', 'Fundamentals', 'DayTrading',
    'SwingTrades', 'Dividends', 'RiskManagement'
  ],
  'Culture & Vibes': [
    'LossPorn', 'GainPorn', 'TradingMemes', 'HotTakes'
  ],
}

const FEED_DESCRIPTIONS = {
  Earnings: 'Earnings beats, misses & guidance',
  Momentum: 'Strong directional movers',
  Macro: 'Fed, rates, inflation, GDP',
  Options: 'Unusual flow & sweeps',
  Sentiment: 'Fear/greed, VIX, put/call',
  PreMarket: 'Gap ups/downs, overnight movers',
  AfterHours: 'Post-close earnings moves',
  Sectors: 'Rotation & relative strength',
  Indices: 'SPY, QQQ, DIA, IWM',
  Volume: 'Dark pool prints, block trades',
  Trending: 'Most talked-about tickers',
  MemeStocks: 'GME, AMC, WSB energy',
  Runners: '10%+ intraday movers',
  Squeezes: 'High SI%, covering signals',
  IPOs: 'New listings & first-day movers',
  SPACs: 'DA announcements & mergers',
  PennyStocks: 'Sub-$5 small cap movers',
  Breakouts: 'Breaking key technical levels',
  BigTech: 'AAPL, MSFT, GOOGL, META, AMZN',
  AI: 'NVDA, AI chips, model releases',
  Semis: 'Chip stocks, fab capacity, SOX',
  EVs: 'Tesla, Rivian, Lucid, BYD',
  Fintech: 'SOFI, HOOD, SQ, payments',
  Biotech: 'FDA approvals, trial results',
  SpaceTech: 'SpaceX, RocketLab, satellites',
  FedWatch: 'FOMC, rate decisions, Fedspeak',
  Trump: 'Policy moves, tariffs, trades',
  ElonMusk: 'Tesla, X, SpaceX, xAI',
  Politics: 'Elections, legislation, regulatory',
  Tariffs: 'Trade war, supply chain',
  Bonds: 'Yields, TLT, credit spreads',
  Commodities: 'Gold, oil, copper, ag',
  Forex: 'DXY, EUR/USD, JPY, currencies',
  Housing: 'Mortgage rates, REITs',
  Jobs: 'NFP, unemployment, wages',
  Bitcoin: 'BTC price, ETF flows, halving',
  Ethereum: 'ETH, L2s, staking, upgrades',
  Altcoins: 'SOL, XRP, DOGE, ADA, AVAX',
  DeFi: 'Yield farming, TVL, protocols',
  CryptoNews: 'Regulation, exchange news',
  TechnicalAnalysis: 'Chart patterns & indicators',
  Fundamentals: 'Valuations, DCF, balance sheets',
  DayTrading: 'Scalps, tape reading, L2',
  SwingTrades: 'Multi-day holds & setups',
  Dividends: 'Yield plays, ex-dates',
  RiskManagement: 'Position sizing, hedging',
  LossPorn: 'Spectacular losses & lessons',
  GainPorn: 'Monster wins & big trades',
  TradingMemes: 'Market humor & trader life',
  HotTakes: 'Bold calls & spicy opinions',
}

const DEFAULT_FEEDS = ['Earnings', 'Momentum', 'Trending', 'Options', 'Macro']
const MAX_PINNED = 8

export default function FeedPicker({ isOpen, onClose, currentFeeds = [], onSave }) {
  const [selected, setSelected] = useState(new Set(currentFeeds))
  const [searchQuery, setSearchQuery] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setSelected(new Set(currentFeeds))
      setSearchQuery('')
    }
  }, [isOpen, currentFeeds])

  // Filter feeds by search
  const filterFeeds = (feeds) => {
    if (!searchQuery) return feeds
    return feeds.filter(f =>
      f.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (FEED_DESCRIPTIONS[f] || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
  }

  const toggleFeed = (feed) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(feed)) {
        next.delete(feed)
      } else if (next.size < MAX_PINNED) {
        next.add(feed)
      }
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    const feeds = Array.from(selected)
    try {
      await onSave(feeds)
    } finally {
      setSaving(false)
      onClose()
    }
  }

  const handleReset = () => {
    setSelected(new Set(DEFAULT_FEEDS))
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-3xl max-h-[85vh] bg-[#0a1628] border border-[#1a2538] rounded-xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a2538]">
            <div>
              <h2 className="text-white text-lg font-semibold flex items-center gap-2">
                <Bookmark size={20} strokeWidth={1.5} className="text-blue-400" />
                Customize Your Feed
              </h2>
              <p className="text-gray-500 text-sm mt-0.5">
                Pick up to {MAX_PINNED} feeds — {selected.size}/{MAX_PINNED} selected
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="text-gray-400 hover:text-white px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1.5 hover:bg-[#0f1d32]"
              >
                <RotateCcw size={14} strokeWidth={1.5} />
                Reset
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white p-1.5 rounded-lg transition-colors hover:bg-[#0f1d32]"
              >
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="px-6 py-3 border-b border-[#1a2538]">
            <div className="relative">
              <Search size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search feeds..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#111c2e] border border-[#1a2538] rounded-lg pl-9 pr-3 py-2 text-white text-sm placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none"
              />
            </div>
          </div>

          {/* Selected Preview */}
          {selected.size > 0 && (
            <div className="px-6 py-3 border-b border-[#1a2538] flex items-center gap-2 flex-wrap">
              <span className="text-gray-500 text-xs uppercase tracking-wider">Pinned:</span>
              {Array.from(selected).map(feed => (
                <button
                  key={feed}
                  onClick={() => toggleFeed(feed)}
                  className="flex items-center gap-1 bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full text-xs hover:bg-blue-500/30 transition-colors"
                >
                  #{feed}
                  <X size={12} strokeWidth={2} />
                </button>
              ))}
            </div>
          )}

          {/* Categories Grid */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 custom-scrollbar">
            {Object.entries(FEED_CATEGORIES).map(([category, feeds]) => {
              const filtered = filterFeeds(feeds)
              if (filtered.length === 0) return null

              const IconComponent = CATEGORY_ICONS[category] || TrendingUp
              const color = CATEGORY_COLORS[category] || 'blue'

              return (
                <div key={category}>
                  <div className="flex items-center gap-2 mb-3">
                    <IconComponent size={16} strokeWidth={1.5} className={`text-${color}-400`} />
                    <span className="text-gray-300 text-sm font-medium">{category}</span>
                    <span className="text-gray-600 text-xs">({filtered.length})</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {filtered.map(feed => {
                      const isSelected = selected.has(feed)
                      const isDisabled = !isSelected && selected.size >= MAX_PINNED

                      return (
                        <button
                          key={feed}
                          onClick={() => !isDisabled && toggleFeed(feed)}
                          disabled={isDisabled}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                            isSelected
                              ? 'bg-blue-500/15 border border-blue-500/40 text-white'
                              : isDisabled
                              ? 'bg-[#060d18] border border-[#1a2538] text-gray-600 cursor-not-allowed opacity-50'
                              : 'bg-[#060d18] border border-[#1a2538] text-gray-300 hover:border-[#2a3548] hover:bg-[#0f1d32]'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                            isSelected ? 'bg-blue-500' : 'border border-[#2a3548]'
                          }`}>
                            {isSelected && <Check size={12} strokeWidth={2.5} className="text-white" />}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">#{feed}</div>
                            <div className="text-xs text-gray-500 truncate">{FEED_DESCRIPTIONS[feed]}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#1a2538] bg-[#080e1a]">
            <span className="text-gray-500 text-sm">
              {selected.size === 0
                ? 'Select at least 1 feed'
                : `${selected.size} feed${selected.size !== 1 ? 's' : ''} selected`}
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors hover:bg-[#0f1d32]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={selected.size === 0 || saving}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selected.size === 0 || saving
                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {saving ? 'Saving...' : 'Save Feeds'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1a2538; border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #2a3548; }
      `}</style>
    </AnimatePresence>
  )
}
