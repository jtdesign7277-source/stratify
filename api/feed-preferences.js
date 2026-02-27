// api/feed-preferences.js — User feed preferences (Vercel serverless)
// GET: Load user's pinned feeds from Supabase
// POST: Save user's pinned feed selections to Supabase

import { createClient } from '@supabase/supabase-js'

const DEFAULT_FEEDS = ['Earnings', 'Momentum', 'Trending', 'Options', 'Macro']

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key)
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()

  // Extract user ID from auth header or query
  const authHeader = req.headers.authorization
  let userId = req.query.userId

  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const supabase = getSupabase()
      const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
      if (!error && user) userId = user.id
    } catch (_) {}
  }

  if (!userId) {
    return res.status(200).json({ feeds: DEFAULT_FEEDS, source: 'default' })
  }

  const supabase = getSupabase()

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('user_feed_preferences')
        .select('pinned_feeds')
        .eq('user_id', userId)
        .single()

      if (error || !data) {
        return res.status(200).json({ feeds: DEFAULT_FEEDS, source: 'default' })
      }

      return res.status(200).json({ feeds: data.pinned_feeds, source: 'saved' })
    } catch (err) {
      console.error('[feed-prefs] GET error:', err.message)
      return res.status(200).json({ feeds: DEFAULT_FEEDS, source: 'default' })
    }
  }

  if (req.method === 'POST') {
    try {
      const { feeds } = req.body

      if (!Array.isArray(feeds) || feeds.length === 0 || feeds.length > 10) {
        return res.status(400).json({ error: 'feeds must be an array of 1-10 items' })
      }

      const { error } = await supabase
        .from('user_feed_preferences')
        .upsert({
          user_id: userId,
          pinned_feeds: feeds,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

      if (error) throw error

      return res.status(200).json({ success: true, feeds })
    } catch (err) {
      console.error('[feed-prefs] POST error:', err.message)
      return res.status(500).json({ error: 'Failed to save preferences', details: err.message })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
