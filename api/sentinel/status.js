// api/sentinel/status.js — Public Sentinel status endpoint
// GET — returns everything needed for the Sentinel page

import { createClient } from '@supabase/supabase-js';
import redis from '../lib/redis.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const cacheKey = 'sentinel:status';

  try {
    // Check cache (60s TTL)
    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) {
      return res.status(200).json(cached);
    }

    // Fetch all data in parallel
    const today = new Date().toISOString().slice(0, 10);

    const [accountRes, sessionRes, recentSessionsRes, openTradesRes, closedTradesRes, memoryRes] = await Promise.all([
      supabase.from('sentinel_account').select('*').eq('id', '00000000-0000-0000-0000-000000000001').single(),
      supabase.from('sentinel_sessions').select('*').eq('session_date', today).maybeSingle(),
      supabase.from('sentinel_sessions').select('*').order('session_date', { ascending: false }).limit(10),
      supabase.from('sentinel_trades').select('*').eq('status', 'open').order('opened_at', { ascending: false }),
      supabase.from('sentinel_trades').select('*').eq('status', 'closed').order('closed_at', { ascending: false }).limit(20),
      supabase.from('sentinel_memory').select('brain_summary, sessions_processed, suspended_conditions').eq('id', 1).single(),
    ]);

    const account = accountRes.data || {};
    const closedTrades = account.closed_trades || 0;
    const winRate = account.win_rate || 0;
    const unlocked = closedTrades >= 20 && winRate >= 65;

    const result = {
      account,
      todaySession: sessionRes.data || null,
      recentSessions: recentSessionsRes.data || [],
      openTrades: openTradesRes.data || [],
      recentClosedTrades: closedTradesRes.data || [],
      memory: memoryRes.data || {},
      unlockStatus: {
        closedTrades,
        winRate: +winRate.toFixed(1),
        unlocked,
        tradesNeeded: Math.max(0, 20 - closedTrades),
        winRateNeeded: Math.max(0, 65 - winRate),
      },
    };

    // Cache 60s
    await redis.set(cacheKey, result, { ex: 60 }).catch(() => {});

    return res.status(200).json(result);
  } catch (err) {
    console.error('[sentinel/status] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
