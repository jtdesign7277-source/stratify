// FeedView.jsx — Perplexity Discover-style full-width news feed
// Single column of cards, no split screen, no ticker panel

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Hash, RefreshCw, ExternalLink, Newspaper, BarChart3,
  AlertTriangle, Database, DollarSign, Scale,
  X as XIcon
} from 'lucide-react'
import { useFeed } from '../../hooks/useFeed'

const CATEGORY_STYLES = {
  NEWS:       { bg: 'bg-cyan-500/10', text: 'text-cyan-400', icon: Newspaper },
  ANALYSIS:   { bg: 'bg-purple-500/10', text: 'text-purple-400', icon: BarChart3 },
  DATA:       { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: Database },
  ALERT:      { bg: 'bg-amber-500/10', text: 'text-amber-400', icon: AlertTriangle },
  EARNINGS:   { bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: DollarSign },
  REGULATORY: { bg: 'bg-rose-500/10', text: 'text-rose-400', icon: Scale },
}

const SENTIMENT_BADGE = {
  bullish: 'bg-emerald-500/15 text-emerald-400',
  bearish: 'bg-red-500/15 text-red-400',
  neutral: 'bg-gray-500/15 text-gray-400',
}

// Strip citation tags that leak from Claude web_search
function stripCitations(text) {
  if (!text) return ''
  return text.replace(/<\/?cite[^>]*>/g, '').replace(/<\/?[^>]+(>|$)/g, '').trim()
}

// Highlight $TICKER in text
function highlightTickers(text) {
  if (!text) return ''
  text = stripCitations(text)
  return text.split(/(\$[A-Z]{1,5})/g).map((part, i) => {
    if (part.match(/^\$[A-Z]{1,5}$/)) {
      return (
        <span key={i} className="font-mono text-blue-400 font-medium">
          {part}
        </span>
      )
    }
    return part
  })
}

// Loading skeleton — full-width cards
function FeedSkeleton({ feedName }) {
  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1a2538]">
        <div className="w-5 h-5 bg-[#1a2538] rounded animate-pulse" />
        <div className="w-32 h-5 bg-[#1a2538] rounded animate-pulse" />
        <div className="w-16 h-4 bg-[#1a2538] rounded animate-pulse" />
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Hero card skeleton */}
        <div className="bg-[#0a1628] border border-[#1a2538] rounded-xl p-6 animate-pulse">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-20 h-5 bg-[#1a2538] rounded-full" />
            <div className="w-24 h-3 bg-[#1a2538] rounded" />
          </div>
          <div className="w-full h-6 bg-[#1a2538] rounded mb-3" />
          <div className="w-5/6 h-6 bg-[#1a2538] rounded mb-4" />
          <div className="w-full h-4 bg-[#1a2538] rounded mb-2" />
          <div className="w-3/4 h-4 bg-[#1a2538] rounded mb-5" />
          <div className="flex gap-2">
            <div className="w-16 h-6 bg-[#1a2538] rounded-full" />
            <div className="w-16 h-6 bg-[#1a2538] rounded-full" />
          </div>
        </div>
        {/* Regular card skeletons */}
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-[#0a1628] border border-[#1a2538] rounded-xl p-5 animate-pulse">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-16 h-4 bg-[#1a2538] rounded-full" />
              <div className="w-20 h-3 bg-[#1a2538] rounded" />
            </div>
            <div className="w-full h-5 bg-[#1a2538] rounded mb-2" />
            <div className="w-2/3 h-5 bg-[#1a2538] rounded mb-3" />
            <div className="w-full h-3 bg-[#1a2538] rounded mb-2" />
            <div className="w-4/5 h-3 bg-[#1a2538] rounded mb-4" />
            <div className="flex gap-2">
              <div className="w-14 h-5 bg-[#1a2538] rounded-full" />
              <div className="w-14 h-5 bg-[#1a2538] rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Featured hero card (first item)
function HeroCard({ item }) {
  const [hovered, setHovered] = useState(false)
  const cat = CATEGORY_STYLES[item.category] || CATEGORY_STYLES.NEWS
  const CatIcon = cat.icon
  const sentiment = SENTIMENT_BADGE[item.sentiment] || SENTIMENT_BADGE.neutral

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="bg-[#0a1628] border border-[#1a2538] rounded-xl p-6 hover:border-[#2a3548] hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 transition-all duration-200 relative group"
    >
      {/* Category + source row */}
      <div className="flex items-center gap-2.5 mb-4">
        <span className={`${cat.bg} ${cat.text} px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1.5`}>
          <CatIcon size={12} strokeWidth={2} />
          {item.category}
        </span>
        <span className="text-gray-500 text-xs">{stripCitations(item.source)}</span>
        <span className="text-gray-600 text-xs">{item.time}</span>
      </div>

      {/* Title — larger for hero */}
      <h2 className="text-white text-xl font-semibold leading-snug mb-3">
        {highlightTickers(item.title)}
      </h2>

      {/* Summary */}
      <p className="text-gray-400 text-sm leading-relaxed mb-5">
        {highlightTickers(item.summary)}
      </p>

      {/* Bottom row: tickers + sentiment */}
      <div className="flex items-center gap-2 flex-wrap">
        {item.tickers && item.tickers.map(t => (
          <span key={t} className="font-mono text-xs text-blue-400 bg-blue-500/10 rounded-full px-2.5 py-0.5">
            {stripCitations(t)}
          </span>
        ))}
        {item.sentiment && (
          <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ml-auto ${sentiment}`}>
            {item.sentiment}
          </span>
        )}
      </div>

      {/* External link on hover */}
      {item.url && hovered && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-5 right-5 text-gray-500 hover:text-blue-400 transition-colors"
          onClick={e => e.stopPropagation()}
        >
          <ExternalLink size={15} strokeWidth={1.5} />
        </a>
      )}
    </motion.div>
  )
}

// Regular news card
function NewsCard({ item, index }) {
  const [hovered, setHovered] = useState(false)
  const cat = CATEGORY_STYLES[item.category] || CATEGORY_STYLES.NEWS
  const CatIcon = cat.icon
  const sentiment = SENTIMENT_BADGE[item.sentiment] || SENTIMENT_BADGE.neutral

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="bg-[#0a1628] border border-[#1a2538] rounded-xl p-5 hover:border-[#2a3548] hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 transition-all duration-200 relative group"
    >
      {/* Category + source + time */}
      <div className="flex items-center gap-2.5 mb-3">
        <span className={`${cat.bg} ${cat.text} px-2 py-0.5 rounded-full text-[11px] font-medium inline-flex items-center gap-1`}>
          <CatIcon size={11} strokeWidth={2} />
          {item.category}
        </span>
        <span className="text-gray-500 text-xs">{stripCitations(item.source)}</span>
        <span className="text-gray-600 text-xs">{item.time}</span>
      </div>

      {/* Title */}
      <h3 className="text-white text-lg font-semibold leading-snug mb-2">
        {highlightTickers(item.title)}
      </h3>

      {/* Summary */}
      <p className="text-gray-400 text-sm leading-relaxed mb-4">
        {highlightTickers(item.summary)}
      </p>

      {/* Bottom row: tickers + sentiment */}
      <div className="flex items-center gap-2 flex-wrap">
        {item.tickers && item.tickers.map(t => (
          <span key={t} className="font-mono text-xs text-blue-400 bg-blue-500/10 rounded-full px-2.5 py-0.5">
            {stripCitations(t)}
          </span>
        ))}
        {item.sentiment && (
          <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ml-auto ${sentiment}`}>
            {item.sentiment}
          </span>
        )}
      </div>

      {/* External link on hover */}
      {item.url && hovered && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-4 right-4 text-gray-500 hover:text-blue-400 transition-colors"
          onClick={e => e.stopPropagation()}
        >
          <ExternalLink size={14} strokeWidth={1.5} />
        </a>
      )}
    </motion.div>
  )
}

export default function FeedView({ feedName, onClose }) {
  const { items, loading, error, source, refresh } = useFeed(feedName)

  if (!feedName) return null

  if (loading && (!items || items.length === 0)) {
    return <FeedSkeleton feedName={feedName} />
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#1a2538]">
        <div className="flex items-center gap-3">
          <Hash size={18} strokeWidth={1.5} className="text-blue-400" />
          <span className="text-white text-base font-semibold">{feedName}</span>
          <span className="text-gray-600 text-xs">
            {items ? items.length : 0} stories
          </span>
          {source && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              source === 'cache' || source === 'memory'
                ? 'bg-emerald-500/10 text-emerald-500'
                : 'bg-blue-500/10 text-blue-400'
            }`}>
              {source === 'cache' || source === 'memory' ? 'cached' : 'live'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="text-gray-500 hover:text-white p-2 rounded-lg hover:bg-[#0f1d32] transition-colors"
            title="Refresh feed"
          >
            <RefreshCw size={14} strokeWidth={1.5} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-white p-2 rounded-lg hover:bg-[#0f1d32] transition-colors"
              title="Close feed"
            >
              <XIcon size={14} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>

      {/* Feed content — full width single column */}
      <div className="flex-1 overflow-y-auto p-6 feed-scroll">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm mb-4">
            Failed to load feed: {error}
            <button onClick={refresh} className="ml-3 underline hover:text-red-300 transition-colors">
              Retry
            </button>
          </div>
        )}

        <div className="max-w-3xl mx-auto space-y-4">
          <AnimatePresence>
            {(items || []).map((item, i) =>
              i === 0 ? (
                <HeroCard key={item.url || item.title || i} item={item} />
              ) : (
                <NewsCard key={item.url || item.title || i} item={item} index={i} />
              )
            )}
          </AnimatePresence>
        </div>

        {(!items || items.length === 0) && !loading && !error && (
          <div className="flex flex-col items-center justify-center h-48 text-gray-600">
            <Newspaper size={24} strokeWidth={1.5} className="mb-3 text-gray-700" />
            <span className="text-sm">No stories found for #{feedName}</span>
          </div>
        )}
      </div>

      <style>{`
        .feed-scroll::-webkit-scrollbar { width: 6px; }
        .feed-scroll::-webkit-scrollbar-track { background: transparent; }
        .feed-scroll::-webkit-scrollbar-thumb { background: #1a2538; border-radius: 3px; }
        .feed-scroll::-webkit-scrollbar-thumb:hover { background: #2a3548; }
      `}</style>
    </div>
  )
}
