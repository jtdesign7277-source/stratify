// hooks/useFeed.js — Hook for fetching hashtag feed data
// Cache-first: checks local memory cache before hitting API
// API route handles Redis caching on the backend

import { useState, useEffect, useRef, useCallback } from 'react'

// In-memory cache for instant tab switches (session only)
const feedCache = new Map()
const inFlight = new Map()

export function useFeed(feedName) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [source, setSource] = useState(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const fetchFeed = useCallback(async (feed) => {
    if (!feed) return

    // 1. Check in-memory cache (instant)
    const cached = feedCache.get(feed)
    if (cached && Date.now() - cached.timestamp < 300000) { // 5 min local cache
      setItems(cached.items)
      setSource('memory')
      setLoading(false)
      return
    }

    // 2. Deduplicate in-flight requests
    if (inFlight.has(feed)) {
      setLoading(true)
      try {
        const data = await inFlight.get(feed)
        if (mountedRef.current) {
          setItems(data.items || data.posts || [])
          setSource(data.source || 'dedup')
          setLoading(false)
        }
      } catch (err) {
        if (mountedRef.current) {
          setError(err.message)
          setLoading(false)
        }
      }
      return
    }

    // 3. Fetch from API (backend handles Redis cache)
    setLoading(true)
    setError(null)

    const promise = fetch(`/api/feeds?feed=${encodeURIComponent(feed)}`)
      .then(async (res) => {
        const data = await res.json()
        console.log(`[useFeed] #${feed} response:`, { keys: Object.keys(data), itemCount: (data.items || data.posts || []).length, source: data.source })
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
        return data
      })
      .finally(() => {
        inFlight.delete(feed)
      })

    inFlight.set(feed, promise)

    try {
      const data = await promise
      if (mountedRef.current) {
        const feedItems = data.items || data.posts || []
        setItems(feedItems)
        setSource(data.source || 'api')
        setLoading(false)

        // Store in memory cache
        feedCache.set(feed, {
          items: feedItems,
          timestamp: Date.now(),
        })
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message)
        setItems([])
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    fetchFeed(feedName)
  }, [feedName, fetchFeed])

  const refresh = useCallback(() => {
    feedCache.delete(feedName)
    fetchFeed(feedName)
  }, [feedName, fetchFeed])

  // Return as both "items" and "posts" for backwards compat
  return { items, posts: items, loading, error, source, refresh }
}

// Preload feeds for fast switching
export function usePreloadFeeds(feeds) {
  useEffect(() => {
    if (!feeds || feeds.length === 0) return

    // Start fetching each feed that's not in memory cache
    feeds.forEach(feed => {
      if (!feedCache.has(feed)) {
        fetch(`/api/feeds?feed=${encodeURIComponent(feed)}`)
          .then(r => r.json())
          .then(data => {
            const feedItems = data.items || data.posts || []
            if (feedItems.length > 0) {
              feedCache.set(feed, {
                items: feedItems,
                timestamp: Date.now(),
              })
            }
          })
          .catch(() => {})
      }
    })
  }, [feeds.join(',')])
}
