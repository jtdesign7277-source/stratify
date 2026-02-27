// FeedView.jsx — Perplexity Discover-style news feed with article reader
// Full-width card feed + slide-in article reader overlay

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Hash, RefreshCw, ExternalLink, Newspaper, BarChart3,
  AlertTriangle, Database, DollarSign, Scale,
  X as XIcon, ArrowLeft, Globe, Clock, User
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

// Extract hostname for favicon
function getFaviconUrl(url) {
  try {
    const hostname = new URL(url).hostname
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
  } catch (_) {
    return null
  }
}

function getHostname(url) {
  try {
    return new URL(url).hostname.replace('www.', '')
  } catch (_) {
    return ''
  }
}

// ─── Loading skeleton ────────────────────────────────────────────────
function FeedSkeleton({ feedName }) {
  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1a2538]">
        <div className="w-5 h-5 bg-[#1a2538] rounded animate-pulse" />
        <div className="w-32 h-5 bg-[#1a2538] rounded animate-pulse" />
        <div className="w-16 h-4 bg-[#1a2538] rounded animate-pulse" />
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
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

// ─── Article Reader Overlay ──────────────────────────────────────────
function ArticleReader({ item, onBack }) {
  const [article, setArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!item?.url) {
      setError('No article URL')
      setLoading(false)
      return
    }

    let mounted = true
    setLoading(true)
    setError(null)

    fetch(`/api/article?url=${encodeURIComponent(item.url)}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
        return data
      })
      .then((data) => {
        if (mounted) {
          setArticle(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message)
          setLoading(false)
        }
      })

    return () => { mounted = false }
  }, [item?.url])

  const cat = CATEGORY_STYLES[item?.category] || CATEGORY_STYLES.NEWS
  const CatIcon = cat.icon
  const sentiment = SENTIMENT_BADGE[item?.sentiment] || SENTIMENT_BADGE.neutral
  const favicon = getFaviconUrl(item?.url)
  const hostname = getHostname(item?.url)

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="absolute inset-0 z-20 bg-[#060d18] flex flex-col"
    >
      {/* Reader header */}
      <div className="flex items-center gap-3 px-6 py-3.5 border-b border-[#1a2538] flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-[#0f1d32]"
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
          <span className="text-sm">Back to feed</span>
        </button>
        <div className="ml-auto flex items-center gap-2">
          {item?.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-gray-500 hover:text-blue-400 transition-colors text-xs px-2.5 py-1.5 rounded-lg hover:bg-[#0f1d32]"
            >
              <ExternalLink size={12} strokeWidth={1.5} />
              <span>Original</span>
            </a>
          )}
        </div>
      </div>

      {/* Reader body */}
      <div className="flex-1 overflow-y-auto feed-scroll">
        <div className="max-w-[700px] mx-auto px-6 py-8">
          {/* Category + meta row */}
          <div className="flex items-center gap-2.5 mb-5">
            <span className={`${cat.bg} ${cat.text} px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1.5`}>
              <CatIcon size={12} strokeWidth={2} />
              {item?.category}
            </span>
            {item?.sentiment && (
              <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${sentiment}`}>
                {item.sentiment}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-white text-2xl font-bold leading-snug mb-4 antialiased">
            {stripCitations(article?.title || item?.title || '')}
          </h1>

          {/* Source + time + author row */}
          <div className="flex items-center gap-4 mb-8 pb-6 border-b border-[#1a2538]">
            <div className="flex items-center gap-2">
              {favicon && <img src={favicon} alt="" className="w-4 h-4 rounded" />}
              <span className="text-gray-400 text-sm">{stripCitations(article?.source || item?.source || '')}</span>
            </div>
            {(article?.author) && (
              <div className="flex items-center gap-1.5 text-gray-500 text-sm">
                <User size={12} strokeWidth={1.5} />
                <span>{article.author}</span>
              </div>
            )}
            {item?.time && (
              <div className="flex items-center gap-1.5 text-gray-500 text-sm">
                <Clock size={12} strokeWidth={1.5} />
                <span>{item.time}</span>
              </div>
            )}
          </div>

          {/* Ticker pills */}
          {item?.tickers && item.tickers.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap mb-6">
              {item.tickers.map(t => (
                <span key={t} className="font-mono text-xs text-blue-400 bg-blue-500/10 rounded-full px-2.5 py-0.5">
                  {stripCitations(t)}
                </span>
              ))}
            </div>
          )}

          {/* Article content */}
          {loading && (
            <div className="space-y-4 animate-pulse">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="w-full h-4 bg-[#1a2538] rounded" />
                  <div className={`h-4 bg-[#1a2538] rounded ${i % 3 === 0 ? 'w-5/6' : i % 3 === 1 ? 'w-full' : 'w-4/5'}`} />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="space-y-4">
              {/* Show feed summary as fallback */}
              {item?.summary && (
                <p className="text-gray-200 text-base leading-relaxed antialiased">
                  {stripCitations(item.summary)}
                </p>
              )}
              <div className="bg-[#0a1628] border border-[#1a2538] rounded-xl p-4 text-gray-500 text-sm">
                Could not load full article. <a
                  href={item?.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline"
                >Read on {hostname}</a>
              </div>
            </div>
          )}

          {!loading && !error && article && (
            <div className="space-y-5">
              {(article.paragraphs || []).map((p, i) => (
                <p key={i} className="text-gray-200 text-base leading-relaxed antialiased">
                  {highlightTickers(p)}
                </p>
              ))}
              {(!article.paragraphs || article.paragraphs.length === 0) && article.content && (
                <p className="text-gray-200 text-base leading-relaxed antialiased">
                  {highlightTickers(article.content)}
                </p>
              )}
            </div>
          )}

          {/* Related Sources — bottom section */}
          {!loading && (
            <div className="mt-10 pt-6 border-t border-[#1a2538]">
              <h3 className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-4">Sources</h3>
              <div className="flex flex-wrap gap-3">
                {/* Primary source */}
                {item?.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 bg-[#0a1628] border border-[#1a2538] rounded-xl px-4 py-3 hover:border-[#2a3548] transition-all duration-200 group max-w-[280px]"
                  >
                    {favicon && <img src={favicon} alt="" className="w-5 h-5 rounded flex-shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="text-white text-sm font-medium truncate group-hover:text-blue-400 transition-colors">
                        {stripCitations(item.source || hostname)}
                      </div>
                      <div className="text-gray-600 text-[11px] truncate">{hostname}</div>
                    </div>
                    <ExternalLink size={12} strokeWidth={1.5} className="text-gray-600 group-hover:text-blue-400 flex-shrink-0 transition-colors" />
                  </a>
                )}
                {/* Additional source hints from tickers */}
                {item?.tickers && item.tickers.length > 0 && (
                  <a
                    href={`https://finance.yahoo.com/quote/${(item.tickers[0] || '').replace('$', '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 bg-[#0a1628] border border-[#1a2538] rounded-xl px-4 py-3 hover:border-[#2a3548] transition-all duration-200 group max-w-[280px]"
                  >
                    <img src="https://www.google.com/s2/favicons?domain=finance.yahoo.com&sz=32" alt="" className="w-5 h-5 rounded flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-white text-sm font-medium truncate group-hover:text-blue-400 transition-colors">
                        Yahoo Finance
                      </div>
                      <div className="text-gray-600 text-[11px] truncate">{stripCitations(item.tickers[0])} Quote</div>
                    </div>
                    <ExternalLink size={12} strokeWidth={1.5} className="text-gray-600 group-hover:text-blue-400 flex-shrink-0 transition-colors" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Hero Card (first item) ──────────────────────────────────────────
function HeroCard({ item, onClick }) {
  const cat = CATEGORY_STYLES[item.category] || CATEGORY_STYLES.NEWS
  const CatIcon = cat.icon
  const sentiment = SENTIMENT_BADGE[item.sentiment] || SENTIMENT_BADGE.neutral

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onClick={() => onClick(item)}
      className="bg-[#0a1628] border border-[#1a2538] rounded-xl p-6 hover:border-[#2a3548] hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 transition-all duration-200 relative group cursor-pointer"
    >
      <div className="flex items-center gap-2.5 mb-4">
        <span className={`${cat.bg} ${cat.text} px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1.5`}>
          <CatIcon size={12} strokeWidth={2} />
          {item.category}
        </span>
        <span className="text-gray-500 text-xs">{stripCitations(item.source)}</span>
        <span className="text-gray-600 text-xs">{item.time}</span>
      </div>

      <h2 className="text-white text-xl font-semibold leading-snug mb-3">
        {highlightTickers(item.title)}
      </h2>

      <p className="text-gray-400 text-sm leading-relaxed mb-5">
        {highlightTickers(item.summary)}
      </p>

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

      {item.url && (
        <div className="absolute top-5 right-5 text-gray-600 group-hover:text-gray-400 transition-colors">
          <ExternalLink size={14} strokeWidth={1.5} />
        </div>
      )}
    </motion.div>
  )
}

// ─── Regular News Card ───────────────────────────────────────────────
function NewsCard({ item, index, onClick }) {
  const cat = CATEGORY_STYLES[item.category] || CATEGORY_STYLES.NEWS
  const CatIcon = cat.icon
  const sentiment = SENTIMENT_BADGE[item.sentiment] || SENTIMENT_BADGE.neutral

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25 }}
      onClick={() => onClick(item)}
      className="bg-[#0a1628] border border-[#1a2538] rounded-xl p-5 hover:border-[#2a3548] hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 transition-all duration-200 relative group cursor-pointer"
    >
      <div className="flex items-center gap-2.5 mb-3">
        <span className={`${cat.bg} ${cat.text} px-2 py-0.5 rounded-full text-[11px] font-medium inline-flex items-center gap-1`}>
          <CatIcon size={11} strokeWidth={2} />
          {item.category}
        </span>
        <span className="text-gray-500 text-xs">{stripCitations(item.source)}</span>
        <span className="text-gray-600 text-xs">{item.time}</span>
      </div>

      <h3 className="text-white text-lg font-semibold leading-snug mb-2">
        {highlightTickers(item.title)}
      </h3>

      <p className="text-gray-400 text-sm leading-relaxed mb-4">
        {highlightTickers(item.summary)}
      </p>

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

      {item.url && (
        <div className="absolute top-4 right-4 text-gray-600 group-hover:text-gray-400 transition-colors">
          <ExternalLink size={13} strokeWidth={1.5} />
        </div>
      )}
    </motion.div>
  )
}

// ─── Main FeedView ───────────────────────────────────────────────────
export default function FeedView({ feedName, onClose }) {
  const { items, loading, error, source, refresh } = useFeed(feedName)
  const [activeArticle, setActiveArticle] = useState(null)

  const handleCardClick = useCallback((item) => {
    if (item.url) {
      setActiveArticle(item)
    }
  }, [])

  const handleBack = useCallback(() => {
    setActiveArticle(null)
  }, [])

  // Reset article when feed changes
  useEffect(() => {
    setActiveArticle(null)
  }, [feedName])

  if (!feedName) return null

  if (loading && (!items || items.length === 0)) {
    return <FeedSkeleton feedName={feedName} />
  }

  return (
    <div className="flex-1 flex flex-col h-full relative">
      {/* Article reader overlay */}
      <AnimatePresence>
        {activeArticle && (
          <ArticleReader
            key={activeArticle.url}
            item={activeArticle}
            onBack={handleBack}
          />
        )}
      </AnimatePresence>

      {/* Feed header */}
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

      {/* Feed content */}
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
                <HeroCard key={item.url || item.title || i} item={item} onClick={handleCardClick} />
              ) : (
                <NewsCard key={item.url || item.title || i} item={item} index={i} onClick={handleCardClick} />
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
