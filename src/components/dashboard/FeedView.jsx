// FeedView.jsx — Split-screen news feed view for Community page
// Left 60%: Real news cards from web search
// Right 40%: Terminal-pro ticker panel with live prices

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Hash, RefreshCw, ExternalLink, Newspaper, BarChart3,
  AlertTriangle, Database, Bell, DollarSign, Scale,
  X as XIcon
} from 'lucide-react'
import { useFeed } from '../../hooks/useFeed'
import FeedTickerPanel from './FeedTickerPanel'

// Category badge styles
const CATEGORY_STYLES = {
  NEWS:       { bg: 'bg-cyan-500/10', text: 'text-cyan-400', icon: Newspaper },
  ANALYSIS:   { bg: 'bg-purple-500/10', text: 'text-purple-400', icon: BarChart3 },
  DATA:       { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: Database },
  ALERT:      { bg: 'bg-amber-500/10', text: 'text-amber-400', icon: AlertTriangle },
  EARNINGS:   { bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: DollarSign },
  REGULATORY: { bg: 'bg-rose-500/10', text: 'text-rose-400', icon: Scale },
}

const SENTIMENT_DOT = {
  bullish: 'bg-emerald-400',
  bearish: 'bg-red-400',
  neutral: 'bg-gray-500',
}

// Loading skeleton
function FeedSkeleton({ feedName }) {
  return (
    <div className="flex-1 flex">
      <div className="w-[60%] p-4 space-y-3 border-r border-[#1a2538]">
        <div className="flex items-center gap-2 mb-4">
          <Hash size={18} strokeWidth={1.5} className="text-blue-400" />
          <span className="text-white font-medium">{feedName}</span>
          <span className="text-gray-600 text-sm">Loading...</span>
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-[#0a1628] border border-[#1a2538] rounded-lg p-3.5 animate-pulse">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-16 h-4 bg-[#1a2538] rounded-full" />
              <div className="w-20 h-3 bg-[#1a2538] rounded" />
              <div className="w-12 h-3 bg-[#1a2538] rounded" />
            </div>
            <div className="w-full h-4 bg-[#1a2538] rounded mb-2" />
            <div className="w-3/4 h-3 bg-[#1a2538] rounded mb-3" />
            <div className="flex gap-2">
              <div className="w-14 h-5 bg-[#1a2538] rounded" />
              <div className="w-14 h-5 bg-[#1a2538] rounded" />
            </div>
          </div>
        ))}
      </div>
      <div className="w-[40%] p-4">
        <div className="w-24 h-3 bg-[#1a2538] rounded animate-pulse mb-4" />
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center justify-between py-2.5 animate-pulse">
            <div className="flex items-center gap-2">
              <div className="w-12 h-3 bg-[#1a2538] rounded" />
            </div>
            <div className="flex gap-4">
              <div className="w-16 h-3 bg-[#1a2538] rounded" />
              <div className="w-12 h-3 bg-[#1a2538] rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Strip citation tags that may leak from Claude web_search
function stripCitations(text) {
  if (!text) return ''
  return text.replace(/<\/?cite[^>]*>/g, '')
}

// Highlight $TICKER in text
function highlightTickers(text) {
  if (!text) return ''
  text = stripCitations(text)
  return text.split(/(\$[A-Z]{1,5})/g).map((part, i) => {
    if (part.match(/^\$[A-Z]{1,5}$/)) {
      return (
        <span key={i} className="font-mono text-blue-400">
          {part}
        </span>
      )
    }
    return part
  })
}

// Individual news card
function NewsCard({ item, index }) {
  const [hovered, setHovered] = useState(false)
  const cat = CATEGORY_STYLES[item.category] || CATEGORY_STYLES.NEWS
  const CatIcon = cat.icon
  const sentimentDot = SENTIMENT_DOT[item.sentiment] || SENTIMENT_DOT.neutral

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="bg-[#0a1628] border border-[#1a2538] rounded-lg p-3.5 hover:border-[#2a3548] transition-colors relative group"
    >
      {/* Top row: category badge + source + time + sentiment dot */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`${cat.bg} ${cat.text} px-2 py-0.5 rounded-full text-[10px] font-medium inline-flex items-center gap-1`}>
          <CatIcon size={10} strokeWidth={2} />
          {item.category}
        </span>
        <span className="text-gray-500 text-xs">{item.source}</span>
        <span className="text-gray-600 text-xs">{item.time}</span>
        <span className={`w-1.5 h-1.5 rounded-full ${sentimentDot} ml-auto flex-shrink-0`} title={item.sentiment} />
      </div>

      {/* Title */}
      <div className="text-sm text-gray-100 font-medium leading-snug mb-1.5">
        {highlightTickers(item.title)}
      </div>

      {/* Summary */}
      <div className="text-xs text-gray-400 leading-relaxed mb-2.5">
        {highlightTickers(item.summary)}
      </div>

      {/* Ticker tags */}
      {item.tickers && item.tickers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {item.tickers.map(t => (
            <span key={t} className="font-mono text-[10px] text-blue-400 bg-blue-500/8 border border-blue-500/15 px-1.5 py-0.5 rounded">
              {t}
            </span>
          ))}
        </div>
      )}

      {/* External link on hover */}
      {item.url && hovered && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-3 right-3 text-gray-500 hover:text-blue-400 transition-colors"
          onClick={e => e.stopPropagation()}
        >
          <ExternalLink size={13} strokeWidth={1.5} />
        </a>
      )}
    </motion.div>
  )
}

export default function FeedView({ feedName, onClose }) {
  const { posts: items, loading, error, source, refresh } = useFeed(feedName)

  // Extract tickers from news items for the ticker panel
  const mentionedTickers = useMemo(() => {
    if (!items || items.length === 0) return []
    const tickers = new Set()
    items.forEach(item => {
      if (item.ticker) tickers.add(item.ticker.replace('$', ''))
      if (Array.isArray(item.tickers)) {
        item.tickers.forEach(t => tickers.add(t.replace('$', '')))
      }
      const matches = (item.title + ' ' + (item.summary || '')).match(/\$[A-Z]{1,5}/g)
      if (matches) matches.forEach(t => tickers.add(t.replace('$', '')))
    })
    return Array.from(tickers).slice(0, 12)
  }, [items])

  if (!feedName) return null

  if (loading && (!items || items.length === 0)) {
    return <FeedSkeleton feedName={feedName} />
  }

  return (
    <div className="flex-1 flex h-full">
      {/* Left: News Cards (60%) */}
      <div className="w-[60%] flex flex-col border-r border-[#1a2538]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1a2538] bg-[#0a1628]/50">
          <div className="flex items-center gap-2">
            <Hash size={16} strokeWidth={1.5} className="text-blue-400" />
            <span className="text-white text-sm font-medium">{feedName}</span>
            <span className="text-gray-600 text-xs">
              {items ? items.length : 0} stories
            </span>
            {source && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                source === 'cache' || source === 'memory'
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : 'bg-blue-500/10 text-blue-400'
              }`}>
                {source === 'cache' || source === 'memory' ? 'cached' : 'live'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={refresh}
              className="text-gray-500 hover:text-white p-1.5 rounded-lg hover:bg-[#0f1d32] transition-colors"
              title="Refresh"
            >
              <RefreshCw size={13} strokeWidth={1.5} />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-white p-1.5 rounded-lg hover:bg-[#0f1d32] transition-colors"
                title="Close"
              >
                <XIcon size={13} strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>

        {/* News Feed */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 feed-scroll">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-xs">
              Failed to load: {error}
              <button onClick={refresh} className="ml-2 underline">Retry</button>
            </div>
          )}

          <AnimatePresence>
            {(items || []).map((item, i) => (
              <NewsCard key={item.url || item.title || i} item={item} index={i} />
            ))}
          </AnimatePresence>

          {(!items || items.length === 0) && !loading && !error && (
            <div className="flex flex-col items-center justify-center h-40 text-gray-600">
              <Newspaper size={20} strokeWidth={1.5} className="mb-2" />
              <span className="text-xs">No stories found for #{feedName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Right: Ticker Panel (40%) */}
      <div className="w-[40%] flex flex-col">
        <FeedTickerPanel feedName={feedName} mentionedTickers={mentionedTickers} />
      </div>

      <style>{`
        .feed-scroll::-webkit-scrollbar { width: 5px; }
        .feed-scroll::-webkit-scrollbar-track { background: transparent; }
        .feed-scroll::-webkit-scrollbar-thumb { background: #1a2538; border-radius: 3px; }
        .feed-scroll::-webkit-scrollbar-thumb:hover { background: #2a3548; }
      `}</style>
    </div>
  )
}
