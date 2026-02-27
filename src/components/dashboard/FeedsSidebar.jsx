// FeedsSidebar.jsx — Customizable feeds section for Community left sidebar
// Replaces the hardcoded 5 hashtags with user's pinned feeds + folder icon to customize
// Drop-in replacement for the existing FEEDS section

import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronRight, FolderOpen, Hash, Loader2 } from 'lucide-react'
import FeedPicker from './FeedPicker'

const DEFAULT_FEEDS = ['Earnings', 'Momentum', 'Trending', 'Options', 'Macro']

export default function FeedsSidebar({ activeFeed, onFeedSelect, userId, supabaseToken }) {
  const [pinnedFeeds, setPinnedFeeds] = useState(DEFAULT_FEEDS)
  const [isExpanded, setIsExpanded] = useState(true)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [loadingFeed, setLoadingFeed] = useState(null)

  // Load user's saved preferences
  useEffect(() => {
    async function loadPreferences() {
      try {
        const headers = {}
        if (supabaseToken) headers['Authorization'] = `Bearer ${supabaseToken}`
        const url = userId
          ? `/api/feed-preferences?userId=${userId}`
          : '/api/feed-preferences'
        const res = await fetch(url, { headers })
        const data = await res.json()
        if (data.feeds && data.feeds.length > 0) {
          setPinnedFeeds(data.feeds)
        }
      } catch (err) {
        console.error('[FeedsSidebar] Failed to load preferences:', err)
      }
    }
    loadPreferences()
  }, [userId, supabaseToken])

  // Save preferences
  const handleSaveFeeds = useCallback(async (feeds) => {
    setPinnedFeeds(feeds)
    // Auto-select first feed if current active isn't in new list
    if (activeFeed && !feeds.includes(activeFeed)) {
      onFeedSelect(feeds[0])
    }
    // Persist to backend
    try {
      const headers = { 'Content-Type': 'application/json' }
      if (supabaseToken) headers['Authorization'] = `Bearer ${supabaseToken}`
      await fetch(`/api/feed-preferences${userId ? `?userId=${userId}` : ''}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ feeds }),
      })
    } catch (err) {
      console.error('[FeedsSidebar] Failed to save preferences:', err)
    }
  }, [userId, supabaseToken, activeFeed, onFeedSelect])

  const handleFeedClick = (feed) => {
    setLoadingFeed(feed)
    onFeedSelect(feed)
    // Clear loading after a short delay (parent component handles actual loading)
    setTimeout(() => setLoadingFeed(null), 500)
  }

  return (
    <>
      {/* Feeds Section Header */}
      <div className="mt-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full px-3 py-1.5 text-gray-500 text-xs uppercase tracking-wider hover:text-gray-300 transition-colors"
        >
          <div className="flex items-center gap-1.5">
            {isExpanded ? (
              <ChevronDown size={12} strokeWidth={1.5} />
            ) : (
              <ChevronRight size={12} strokeWidth={1.5} />
            )}
            <span>Feeds</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsPickerOpen(true)
            }}
            className="text-gray-500 hover:text-blue-400 transition-colors p-0.5 rounded hover:bg-[#0f1d32]"
            title="Customize feeds"
          >
            <FolderOpen size={14} strokeWidth={1.5} />
          </button>
        </button>

        {/* Pinned Feeds List */}
        {isExpanded && (
          <div className="mt-1 space-y-0.5">
            {pinnedFeeds.map(feed => (
              <button
                key={feed}
                onClick={() => handleFeedClick(feed)}
                className={`flex items-center gap-2 w-full px-3 py-1.5 text-sm rounded-md transition-colors ${
                  activeFeed === feed
                    ? 'bg-[#0f1d32] text-blue-400'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#0f1d32]/50'
                }`}
              >
                {loadingFeed === feed ? (
                  <Loader2 size={14} strokeWidth={1.5} className="animate-spin text-blue-400" />
                ) : (
                  <Hash size={14} strokeWidth={1.5} />
                )}
                <span>{feed}</span>
              </button>
            ))}

            {/* "More feeds" button */}
            <button
              onClick={() => setIsPickerOpen(true)}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-600 hover:text-blue-400 transition-colors rounded-md hover:bg-[#0f1d32]/30"
            >
              <span className="text-gray-600">+</span>
              <span>{50 - pinnedFeeds.length} more feeds</span>
            </button>
          </div>
        )}
      </div>

      {/* Feed Picker Modal */}
      <FeedPicker
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        currentFeeds={pinnedFeeds}
        onSave={handleSaveFeeds}
      />
    </>
  )
}
