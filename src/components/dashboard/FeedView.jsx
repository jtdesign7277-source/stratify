// FeedView.jsx — Split-screen feed view for Community page
// Left 60%: Social feed posts for the selected hashtag
// Right 40%: Live tickers related to the hashtag, streaming via WebSocket
// Shows loading skeletons during first fetch

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, TrendingDown, ArrowUp, ArrowDown, Heart,
  MessageCircle, Share2, RefreshCw, Hash, Zap, BarChart3,
  AlertTriangle, MessageSquare, Newspaper, Laugh, Activity,
  X as XIcon
} from 'lucide-react'
import { useFeed } from '../../hooks/useFeed'
import FeedTickerPanel from './FeedTickerPanel'

// Tag styling
const TAG_STYLES = {
  'P&L':        { bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: TrendingUp, label: '~ P&L' },
  'TRADE':      { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: Activity, label: '⇄ TRADE' },
  'ALERT':      { bg: 'bg-amber-500/10', text: 'text-amber-400', icon: AlertTriangle, label: '⚠ ALERT' },
  'ANALYSIS':   { bg: 'bg-purple-500/10', text: 'text-purple-400', icon: BarChart3, label: '◎ ANALYSIS' },
  'NEWS':       { bg: 'bg-cyan-500/10', text: 'text-cyan-400', icon: Newspaper, label: '◉ NEWS' },
  'MEME':       { bg: 'bg-pink-500/10', text: 'text-pink-400', icon: Laugh, label: '😂 MEME' },
  'DISCUSSION': { bg: 'bg-gray-500/10', text: 'text-gray-400', icon: MessageSquare, label: '💬 DISCUSSION' },
}

// Loading skeleton component
function FeedSkeleton({ feedName }) {
  return (
    <div className="flex-1 flex">
      {/* Left: Post skeletons */}
      <div className="w-[60%] p-4 space-y-4 border-r border-[#1a2538]">
        <div className="flex items-center gap-2 mb-4">
          <Hash size={18} strokeWidth={1.5} className="text-blue-400" />
          <span className="text-white font-medium">{feedName}</span>
          <span className="text-gray-600 text-sm">Loading...</span>
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-[#0a1628] border border-[#1a2538] rounded-lg p-4 animate-pulse">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-[#1a2538] rounded-full" />
              <div className="flex-1">
                <div className="w-24 h-3 bg-[#1a2538] rounded" />
                <div className="w-16 h-2 bg-[#1a2538] rounded mt-1.5" />
              </div>
              <div className="w-16 h-5 bg-[#1a2538] rounded-full" />
            </div>
            <div className="space-y-2">
              <div className="w-full h-3 bg-[#1a2538] rounded" />
              <div className="w-3/4 h-3 bg-[#1a2538] rounded" />
            </div>
            {i % 2 === 0 && (
              <div className="mt-3 w-40 h-8 bg-[#1a2538] rounded-lg" />
            )}
            <div className="flex items-center gap-4 mt-3">
              <div className="w-12 h-3 bg-[#1a2538] rounded" />
              <div className="w-12 h-3 bg-[#1a2538] rounded" />
              <div className="w-12 h-3 bg-[#1a2538] rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Right: Ticker skeletons */}
      <div className="w-[40%] p-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-20 h-3 bg-[#1a2538] rounded animate-pulse" />
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-[#1a2538] animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#1a2538] rounded" />
              <div>
                <div className="w-16 h-3 bg-[#1a2538] rounded" />
                <div className="w-24 h-2 bg-[#1a2538] rounded mt-1.5" />
              </div>
            </div>
            <div className="text-right">
              <div className="w-16 h-3 bg-[#1a2538] rounded" />
              <div className="w-12 h-2 bg-[#1a2538] rounded mt-1.5 ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Individual post card
function FeedPost({ post, index }) {
  const [liked, setLiked] = useState(false)
  const tagStyle = TAG_STYLES[post.tag] || TAG_STYLES['DISCUSSION']

  // Generate avatar color from username
  const avatarColor = useMemo(() => {
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f43f5e']
    let hash = 0
    for (let i = 0; i < (post.username || '').length; i++) {
      hash = post.username.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
  }, [post.username])

  // Highlight $TICKER mentions in content
  const highlightTickers = (text) => {
    if (!text) return ''
    return text.split(/(\$[A-Z]{1,5})/g).map((part, i) => {
      if (part.match(/^\$[A-Z]{1,5}$/)) {
        return (
          <span key={i} className="font-mono text-blue-400 cursor-pointer hover:text-blue-300">
            {part}
          </span>
        )
      }
      return part
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.2 }}
      className="bg-[#0a1628] border border-[#1a2538] rounded-lg p-4 hover:border-[#2a3548] transition-colors"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{ backgroundColor: avatarColor }}
        >
          {(post.username || 'U')[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white text-sm font-medium truncate">{post.username}</span>
            <span className="text-gray-600 text-xs">·</span>
            <span className="text-gray-600 text-xs">{post.time}</span>
          </div>
        </div>
        <span className={`${tagStyle.bg} ${tagStyle.text} px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0`}>
          {tagStyle.label}
        </span>
      </div>

      {/* Content */}
      <div className="text-gray-200 text-sm leading-relaxed mb-2">
        {highlightTickers(post.content)}
      </div>

      {/* P&L Card */}
      {post.pnl && (
        <div className="bg-[#060d18] border border-[#1a2538] rounded-lg px-3 py-2 inline-flex items-center gap-3 mb-2">
          <span className="font-mono text-blue-400 text-sm">{post.pnl.ticker}</span>
          <span className={`font-mono text-sm font-medium ${post.pnl.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {post.pnl.amount >= 0 ? '+' : ''}{typeof post.pnl.amount === 'number' ? `$${Math.abs(post.pnl.amount).toLocaleString()}` : post.pnl.amount}
          </span>
          {post.pnl.percent && (
            <span className={`font-mono text-xs ${post.pnl.percent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {post.pnl.percent >= 0 ? '+' : ''}{post.pnl.percent}%
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-5 mt-2">
        <button
          onClick={() => setLiked(!liked)}
          className={`flex items-center gap-1.5 text-xs transition-colors ${
            liked ? 'text-red-400' : 'text-gray-600 hover:text-gray-400'
          }`}
        >
          <Heart size={14} strokeWidth={1.5} fill={liked ? 'currentColor' : 'none'} />
          <span>{(post.likes || 0) + (liked ? 1 : 0)}</span>
        </button>
        <button className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-400 transition-colors">
          <MessageCircle size={14} strokeWidth={1.5} />
          <span>{post.replies || 0}</span>
        </button>
        <button className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-blue-400 transition-colors">
          <XIcon size={14} strokeWidth={1.5} />
          <span>Share</span>
        </button>
        <button className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-400 transition-colors">
          <Share2 size={14} strokeWidth={1.5} />
        </button>
      </div>
    </motion.div>
  )
}

export default function FeedView({ feedName, onClose }) {
  const { posts, loading, error, source, refresh } = useFeed(feedName)

  // Extract tickers mentioned in posts for the ticker panel
  const mentionedTickers = useMemo(() => {
    if (!posts || posts.length === 0) return []
    const tickers = new Set()
    posts.forEach(post => {
      // From post content
      const matches = (post.content || '').match(/\$[A-Z]{1,5}/g)
      if (matches) matches.forEach(t => tickers.add(t.replace('$', '')))
      // From post ticker field
      if (post.ticker) tickers.add(post.ticker.replace('$', ''))
      // From post tickers array
      if (Array.isArray(post.tickers)) {
        post.tickers.forEach(t => tickers.add(t.replace('$', '')))
      }
      // From P&L
      if (post.pnl?.ticker) tickers.add(post.pnl.ticker.replace('$', ''))
    })
    return Array.from(tickers).slice(0, 12) // Max 12 tickers
  }, [posts])

  if (!feedName) return null

  // Loading state
  if (loading && posts.length === 0) {
    return <FeedSkeleton feedName={feedName} />
  }

  return (
    <div className="flex-1 flex h-full">
      {/* Left: Feed Posts (60%) */}
      <div className="w-[60%] flex flex-col border-r border-[#1a2538]">
        {/* Feed Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a2538] bg-[#0a1628]/50">
          <div className="flex items-center gap-2">
            <Hash size={18} strokeWidth={1.5} className="text-blue-400" />
            <span className="text-white font-medium">{feedName}</span>
            <span className="text-gray-600 text-sm">
              {posts.length} post{posts.length !== 1 ? 's' : ''}
            </span>
            {source && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                source === 'cache' || source === 'memory'
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : 'bg-blue-500/10 text-blue-400'
              }`}>
                {source === 'cache' || source === 'memory' ? '⚡ cached' : '🔄 fresh'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="text-gray-500 hover:text-white p-1.5 rounded-lg hover:bg-[#0f1d32] transition-colors"
              title="Refresh feed"
            >
              <RefreshCw size={14} strokeWidth={1.5} />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-white p-1.5 rounded-lg hover:bg-[#0f1d32] transition-colors"
                title="Close feed"
              >
                <XIcon size={14} strokeWidth={1.5} />
              </button>
            )}
          </div>
        </div>

        {/* Posts Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-feed-scroll">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
              Failed to load feed: {error}
              <button onClick={refresh} className="ml-2 text-red-300 underline">Retry</button>
            </div>
          )}

          <AnimatePresence>
            {posts.map((post, i) => (
              <FeedPost key={post.id || i} post={post} index={i} />
            ))}
          </AnimatePresence>

          {posts.length === 0 && !loading && !error && (
            <div className="flex flex-col items-center justify-center h-40 text-gray-600">
              <Hash size={24} strokeWidth={1.5} className="mb-2" />
              <span className="text-sm">No posts yet for #{feedName}</span>
            </div>
          )}
        </div>
      </div>

      {/* Right: Related Tickers (40%) */}
      <div className="w-[40%] flex flex-col">
        <FeedTickerPanel feedName={feedName} mentionedTickers={mentionedTickers} />
      </div>

      <style>{`
        .custom-feed-scroll::-webkit-scrollbar { width: 6px; }
        .custom-feed-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-feed-scroll::-webkit-scrollbar-thumb { background: #1a2538; border-radius: 3px; }
        .custom-feed-scroll::-webkit-scrollbar-thumb:hover { background: #2a3548; }
      `}</style>
    </div>
  )
}
