// TodaysNews.jsx — Cache-first news widget for Community page right sidebar
// Follows: Hard Rule #1 (cache-first), #4 (terminal-pro), #5 (Error Boundary), #9 (dedup)

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Newspaper,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  X,
  GripVertical,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

// ── In-flight deduplication (Hard Rule #9) ────────────────────────
let inFlightPromise = null

function dedupFetch(url) {
  if (inFlightPromise) return inFlightPromise
  inFlightPromise = fetch(url)
    .then((res) => res.json())
    .finally(() => {
      inFlightPromise = null
    })
  return inFlightPromise
}

// ── Sentiment icon + color mapping ────────────────────────────────
const sentimentConfig = {
  bullish: {
    icon: TrendingUp,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    dot: 'bg-emerald-400',
  },
  bearish: {
    icon: TrendingDown,
    color: 'text-red-400',
    bg: 'bg-red-400/10',
    dot: 'bg-red-400',
  },
  neutral: {
    icon: Minus,
    color: 'text-gray-400',
    bg: 'bg-gray-400/10',
    dot: 'bg-gray-400',
  },
}

// ── Single news item ──────────────────────────────────────────────
function NewsItem({ article, index, onArticleClick }) {
  const sentiment = sentimentConfig[article.sentiment] || sentimentConfig.neutral

  const handleClick = () => {
    if (onArticleClick) {
      // Normalize to the shape ArticleReader / FeedView expects
      onArticleClick({
        title:     article.title,
        source:    article.source,
        url:       article.url,
        time:      article.time,
        sentiment: article.sentiment,
        summary:   article.description || article.snippet || '',
        image:     article.image || article.imageUrl || null,
        tickers:   article.ticker ? [article.ticker] : (article.tickers || []),
        category:  'NEWS',
      })
    } else if (article.url) {
      window.open(article.url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      onClick={handleClick}
      className="group px-3 py-2.5 hover:bg-[#0f1d32] rounded-lg cursor-pointer transition-colors"
    >
      <div className="flex items-start gap-2.5">
        {/* Sentiment dot */}
        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${sentiment.dot}`} />

        <div className="flex-1 min-w-0">
          {/* Title */}
          <p className="text-sm text-white leading-snug line-clamp-2">
            {article.ticker && (
              <span className="font-mono text-blue-400 mr-1">{article.ticker}</span>
            )}
            {article.title}
          </p>

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] text-gray-500">{article.source}</span>
            <span className="text-[11px] text-gray-600">·</span>
            <span className="text-[11px] text-gray-500">{article.time}</span>
            <span className={`text-[11px] font-medium ${sentiment.color} ml-auto`}>
              {article.sentiment}
            </span>
          </div>
        </div>

        {/* Hover arrow — chevron right when onArticleClick present, external link otherwise */}
        <ExternalLink
          size={12}
          strokeWidth={1.5}
          className="text-gray-600 group-hover:text-gray-400 mt-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        />
      </div>
    </motion.div>
  )
}

// ── Skeleton loader (shown only on true first load, never on cache) ──
function NewsSkeleton() {
  return (
    <div className="px-3 space-y-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="flex items-start gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full mt-1.5 bg-gray-700" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 bg-gray-700/50 rounded w-full" />
              <div className="h-3.5 bg-gray-700/50 rounded w-3/4" />
              <div className="flex gap-2 mt-1">
                <div className="h-2.5 bg-gray-700/30 rounded w-12" />
                <div className="h-2.5 bg-gray-700/30 rounded w-10" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main widget ───────────────────────────────────────────────────
export default function TodaysNews({ onClose, collapsed: collapsedProp, hideHeader, onArticleClick }) {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [collapsed, setCollapsed] = useState(collapsedProp || false)
  const [error, setError] = useState(null)
  const mountedRef = useRef(true)
  const refreshTimeoutRef = useRef(null)

  // ── Fetch news (deduped + cache-first) ──────────────────────
  const fetchNews = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      // Deduped fetch — repeated calls return the same promise
      const data = await dedupFetch(getApiUrl('news'))

      if (!mountedRef.current) return

      if (data.articles && data.articles.length > 0) {
        setArticles(data.articles)
        setLastUpdated(new Date())
        setError(null)
      } else if (!isRefresh) {
        setError('No news available')
      }
    } catch (err) {
      if (mountedRef.current && !isRefresh) {
        setError('Failed to load news')
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  // ── Initial load + auto-refresh every 5 min ────────────────
  useEffect(() => {
    mountedRef.current = true
    fetchNews()

    // Auto-refresh every 30 min to match Redis TTL
    const interval = setInterval(() => fetchNews(true), 30 * 60 * 1000)

    return () => {
      mountedRef.current = false
      clearInterval(interval)
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current)
    }
  }, [fetchNews])

  // ── Debounced manual refresh (Hard Rule #9) ─────────────────
  const handleRefresh = useCallback(() => {
    if (refreshing) return // Already refreshing, ignore
    if (refreshTimeoutRef.current) return // Debounce active

    fetchNews(true)

    // 10s cooldown to prevent spam-clicking refresh
    refreshTimeoutRef.current = setTimeout(() => {
      refreshTimeoutRef.current = null
    }, 10000)
  }, [refreshing, fetchNews])

  // ── Format "Updated X ago" ──────────────────────────────────
  const getUpdatedText = () => {
    if (!lastUpdated) return ''
    const seconds = Math.floor((Date.now() - lastUpdated.getTime()) / 1000)
    if (seconds < 10) return 'just now'
    if (seconds < 60) return `${seconds}s ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  // ── Force re-render for "Updated X ago" ─────────────────────
  const [, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(timer)
  }, [])

  // When hideHeader is set, force collapsed to false so body always shows
  const isCollapsed = hideHeader ? false : collapsed;
import { getApiUrl } from '../../lib/api';

  return (
    <div className={`h-full min-h-0 flex flex-col overflow-hidden ${hideHeader ? '' : 'bg-[#0a1628] border border-[#1a2538] rounded-lg'}`}>
      {/* ── Header (hidden when parent provides its own) ──── */}
      {!hideHeader && (
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#1a2538]">
        <div className="flex items-center gap-2">
          <GripVertical size={14} strokeWidth={1.5} className="text-gray-600 cursor-grab" />
          <div>
            <div className="flex items-center gap-2">
              <Newspaper size={14} strokeWidth={1.5} className="text-blue-400" />
              <span className="text-xs font-semibold text-white tracking-wide uppercase">
                Today's News
              </span>
              {lastUpdated && (
                <span className="text-[10px] text-gray-500">
                  Updated {getUpdatedText()}
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-500 ml-6">Trending on X and the web</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1 text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-30"
            title="Refresh news"
          >
            <RefreshCw
              size={13}
              strokeWidth={1.5}
              className={refreshing ? 'animate-spin' : ''}
            />
          </button>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
          >
            {collapsed ? (
              <ChevronDown size={13} strokeWidth={1.5} />
            ) : (
              <ChevronUp size={13} strokeWidth={1.5} />
            )}
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-gray-500 hover:text-gray-300 transition-colors"
            >
              <X size={13} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>
      )}

      {/* ── Body ────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden flex-1 min-h-0"
          >
            <div className="h-full min-h-0 py-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700">
              {loading && articles.length === 0 ? (
                <NewsSkeleton />
              ) : error && articles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 px-4">
                  <p className="text-sm text-gray-500">{error}</p>
                  <button
                    onClick={() => fetchNews()}
                    className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                articles.map((article, i) => (
                  <NewsItem key={`${article.title}-${i}`} article={article} index={i} onArticleClick={onArticleClick} />
                ))
              )}
            </div>

            {/* Cache indicator (dev only — remove in prod) */}
            {articles.length > 0 && (
              <div className="px-3 py-1.5 border-t border-[#1a2538]">
                <p className="text-[9px] text-gray-600 text-center">
                  {articles.length} stories · Refreshes every 30 min
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
