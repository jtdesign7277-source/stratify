// ContentEngine.jsx — Dashboard for managing Stratify's automated social content
// Preview, generate, and manually post content to X and Discord
// Accessible from Stratify dashboard or Mission Control

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, RefreshCw, Clock, CheckCircle, XCircle, Zap,
  Twitter, MessageSquare, Eye, Calendar, TrendingUp,
  BarChart2, Target, Sun, Moon, Activity, Flame
} from 'lucide-react'

const CONTENT_TYPES = [
  { id: 'morning-briefing',  label: 'Morning Briefing',   icon: Sun,        time: '8:30 AM',  color: 'blue' },
  { id: 'technical-setup',   label: 'Technical Setup',    icon: Target,     time: 'Multiple',  color: 'emerald' },
  { id: 'top-movers',        label: 'Top Movers',         icon: TrendingUp, time: '10:00 AM', color: 'amber' },
  { id: 'midday-update',     label: 'Midday Update',      icon: Activity,   time: '12:30 PM', color: 'indigo' },
  { id: 'power-hour',        label: 'Power Hour',         icon: Flame,      time: '3:00 PM',  color: 'red' },
  { id: 'market-recap',      label: 'Market Recap',       icon: BarChart2,  time: '4:15 PM',  color: 'purple' },
  { id: 'afterhours-movers', label: 'AH Movers',          icon: Moon,       time: '5:00 PM',  color: 'orange' },
  { id: 'weekend-watchlist',  label: 'Weekend Watchlist',  icon: Calendar,   time: 'Sat 10 AM', color: 'cyan' },
]

export default function ContentEngine() {
  const [selectedType, setSelectedType] = useState('technical-setup')
  const [preview, setPreview] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [posting, setPosting] = useState(false)
  const [postResult, setPostResult] = useState(null)
  const [history, setHistory] = useState([])

  // Generate preview
  const handleGenerate = async () => {
    setGenerating(true)
    setPreview(null)
    setPostResult(null)
    try {
      const res = await fetch(`/api/x-post?type=${selectedType}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setPreview(data)
      setHistory(prev => [{ ...data, timestamp: new Date().toISOString() }, ...prev].slice(0, 20))
    } catch (err) {
      setPreview({ error: err.message })
    } finally {
      setGenerating(false)
    }
  }

  // Post to X
  const handlePostToX = async () => {
    if (!preview?.content) return
    setPosting(true)
    try {
      const res = await fetch(`/api/x-post?type=${selectedType}&post=true`)
      const data = await res.json()
      setPostResult(data)
    } catch (err) {
      setPostResult({ error: err.message })
    } finally {
      setPosting(false)
    }
  }

  // Format tweet preview
  const renderTweetPreview = (content) => {
    if (!content) return null

    const tweets = Array.isArray(content)
      ? content
      : content.thread
        ? [content.tweet, ...content.thread]
        : [content.tweet || JSON.stringify(content)]

    return tweets.map((tweet, i) => (
      <div
        key={i}
        className={`bg-[#060d18] border border-[#1a2538] rounded-lg p-4 ${i > 0 ? 'ml-8 border-l-2 border-l-blue-500/30' : ''}`}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold">S</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-sm">Stratify</span>
              <span className="text-blue-400 text-sm">✓</span>
              <span className="text-gray-500 text-sm">@stratify_hq</span>
              {i === 0 && <span className="text-gray-600 text-xs">· just now</span>}
            </div>
            <div className="text-gray-200 text-sm mt-1 whitespace-pre-wrap leading-relaxed">
              {highlightTickers(typeof tweet === 'string' ? tweet : tweet.text || JSON.stringify(tweet))}
            </div>
            {/* Technical setup extra info */}
            {i === 0 && !Array.isArray(content) && content.entry && (
              <div className="mt-3 bg-[#0a1628] border border-[#1a2538] rounded-lg p-3 grid grid-cols-4 gap-2">
                <div>
                  <div className="text-gray-500 text-xs">Entry</div>
                  <div className="text-white font-mono text-sm">${content.entry}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Stop</div>
                  <div className="text-red-400 font-mono text-sm">${content.stop}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">Target</div>
                  <div className="text-emerald-400 font-mono text-sm">${content.target}</div>
                </div>
                <div>
                  <div className="text-gray-500 text-xs">R:R</div>
                  <div className="text-blue-400 font-mono text-sm">{content.rr_ratio}</div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-6 mt-3 text-gray-600">
              <span className="text-xs">💬 0</span>
              <span className="text-xs">🔄 0</span>
              <span className="text-xs">❤️ 0</span>
              <span className="text-xs">📊 0</span>
            </div>
          </div>
        </div>
      </div>
    ))
  }

  // Highlight $TICKER in text
  const highlightTickers = (text) => {
    if (!text) return ''
    return text.split(/(\$[A-Z]{1,5})/g).map((part, i) => {
      if (part.match(/^\$[A-Z]{1,5}$/)) {
        return <span key={i} className="text-blue-400 font-medium">{part}</span>
      }
      return part
    })
  }

  const typeConfig = CONTENT_TYPES.find(t => t.id === selectedType)

  return (
    <div className="flex h-full bg-[#060d18] text-white">
      {/* Left: Content Type Selector */}
      <div className="w-64 bg-[#0a1628] border-r border-[#1a2538] flex flex-col">
        <div className="px-4 py-4 border-b border-[#1a2538]">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Zap size={18} strokeWidth={1.5} className="text-blue-400" />
            Content Engine
          </h2>
          <p className="text-gray-500 text-xs mt-1">@stratify_hq auto-posting</p>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {CONTENT_TYPES.map(type => {
            const Icon = type.icon
            const isActive = selectedType === type.id
            return (
              <button
                key={type.id}
                onClick={() => { setSelectedType(type.id); setPreview(null); setPostResult(null) }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                  isActive
                    ? 'bg-[#0f1d32] text-white'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#0f1d32]/50'
                }`}
              >
                <Icon size={16} strokeWidth={1.5} className={isActive ? `text-${type.color}-400` : ''} />
                <div className="min-w-0 flex-1">
                  <div className="truncate">{type.label}</div>
                  <div className="text-gray-600 text-xs">{type.time} EST</div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Schedule Info */}
        <div className="px-4 py-3 border-t border-[#1a2538]">
          <div className="flex items-center gap-2 text-emerald-400 text-xs">
            <Clock size={12} strokeWidth={1.5} />
            <span>Cron active — 10 posts/day</span>
          </div>
        </div>
      </div>

      {/* Right: Preview & Actions */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a2538]">
          <div>
            <h3 className="text-white font-medium">{typeConfig?.label || selectedType}</h3>
            <p className="text-gray-500 text-xs mt-0.5">Generate preview → Review → Post to X</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                generating
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {generating ? (
                <RefreshCw size={14} strokeWidth={1.5} className="animate-spin" />
              ) : (
                <Eye size={14} strokeWidth={1.5} />
              )}
              {generating ? 'Generating...' : 'Generate Preview'}
            </button>
            <button
              onClick={handlePostToX}
              disabled={!preview?.content || posting}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                !preview?.content || posting
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {posting ? (
                <RefreshCw size={14} strokeWidth={1.5} className="animate-spin" />
              ) : (
                <Send size={14} strokeWidth={1.5} />
              )}
              {posting ? 'Posting...' : 'Post to X'}
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {!preview && !generating && (
            <div className="flex flex-col items-center justify-center h-full text-gray-600">
              <Zap size={32} strokeWidth={1} className="mb-3 text-gray-700" />
              <p className="text-sm">Click "Generate Preview" to create content</p>
              <p className="text-xs mt-1 text-gray-700">Content is generated by Claude AI for @stratify_hq</p>
            </div>
          )}

          {generating && (
            <div className="flex flex-col items-center justify-center h-full">
              <RefreshCw size={24} strokeWidth={1.5} className="animate-spin text-blue-400 mb-3" />
              <p className="text-gray-400 text-sm">Generating {typeConfig?.label}...</p>
            </div>
          )}

          {preview?.error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400">
              <div className="flex items-center gap-2 mb-1">
                <XCircle size={16} strokeWidth={1.5} />
                <span className="font-medium">Generation Failed</span>
              </div>
              <p className="text-sm">{preview.error}</p>
            </div>
          )}

          {preview?.content && (
            <div className="space-y-3 max-w-xl">
              <div className="flex items-center gap-2 mb-4">
                <Twitter size={16} strokeWidth={1.5} className="text-blue-400" />
                <span className="text-gray-400 text-sm">Tweet Preview</span>
                {preview.content.chartUrl && (
                  <a
                    href={preview.content.chartUrl}
                    target="_blank"
                    rel="noopener"
                    className="ml-auto text-blue-400 text-xs hover:text-blue-300 flex items-center gap-1"
                  >
                    <BarChart2 size={12} />
                    View Chart
                  </a>
                )}
              </div>
              {renderTweetPreview(preview.content)}
            </div>
          )}

          {postResult && (
            <div className={`mt-4 p-4 rounded-lg border ${
              postResult.error
                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}>
              <div className="flex items-center gap-2">
                {postResult.error ? (
                  <XCircle size={16} strokeWidth={1.5} />
                ) : (
                  <CheckCircle size={16} strokeWidth={1.5} />
                )}
                <span className="font-medium">
                  {postResult.error ? 'Post Failed' : `Posted ${postResult.tweetCount || 0} tweet(s) to X`}
                </span>
              </div>
              {postResult.error && <p className="text-sm mt-1">{postResult.error}</p>}
              {postResult.posted && (
                <div className="mt-2 space-y-1">
                  {postResult.posted.map((p, i) => (
                    <div key={i} className="text-xs flex items-center gap-2">
                      {p.status === 'posted' ? (
                        <CheckCircle size={10} className="text-emerald-400" />
                      ) : (
                        <XCircle size={10} className="text-red-400" />
                      )}
                      <span className="truncate">{p.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
