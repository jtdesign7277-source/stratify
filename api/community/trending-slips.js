import { Redis } from '@upstash/redis';
import { supabase } from '../lib/supabase.js';

export const config = { maxDuration: 15 };

const CACHE_TTL_SECONDS = 60;
const CACHE_KEY_TODAY = 'trending-slips:today';
const CACHE_KEY_TOP_WINS = 'trending-slips:top-wins';
const CACHE_KEY_TOP_LOSSES = 'trending-slips:top-losses';
const MAX_DB_ROWS = 240;
const MAX_SLIP_ROWS = 140;
const MAX_TOP_ROWS = 20;

let redisClient = null;
let redisDisabled = false;

function getRedisClient() {
  if (redisDisabled) return null;

  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  if (redisClient) return redisClient;

  try {
    redisClient = new Redis({ url, token });
    return redisClient;
  } catch (error) {
    redisDisabled = true;
    redisClient = null;
    console.error('[community/trending-slips] Redis init failed:', error);
    return null;
  }
}

const unwrapPipelineResult = (value) => (
  value && typeof value === 'object' && 'result' in value ? value.result : value
);

const toMaybeFiniteNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeTicker = (value) => String(value || '').trim().toUpperCase();

const parseCachedRows = (rawValue) => {
  if (!rawValue) return null;
  try {
    const parsed = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const sortByPnlMagnitude = (rows = []) => (
  [...rows].sort((a, b) => Math.abs(Number(b?.pnl) || 0) - Math.abs(Number(a?.pnl) || 0))
);

const sortTopWins = (rows = []) => (
  [...rows].sort((a, b) => (Number(b?.pnl) || 0) - (Number(a?.pnl) || 0))
);

const sortTopLosses = (rows = []) => (
  [...rows].sort((a, b) => (Number(a?.pnl) || 0) - (Number(b?.pnl) || 0))
);

const getUtcDayRange = () => {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
  return { startIso: start.toISOString(), endIso: end.toISOString() };
};

const normalizeSnapshotRow = (post, displayNamesById = {}) => {
  if (!post || typeof post !== 'object') return null;
  const metadata = post?.metadata && typeof post.metadata === 'object' ? post.metadata : {};
  const pnl = toMaybeFiniteNumber(metadata?.pnl);
  if (pnl === null) return null;

  const ticker = normalizeTicker(metadata?.ticker || metadata?.symbol) || 'TRADE';
  const author = String(
    displayNamesById[post.user_id]
      || post.author_name
      || metadata?.display_name
      || metadata?.author_name
      || metadata?.username
      || 'Trader'
  ).trim() || 'Trader';

  return {
    id: String(post.id || `${ticker}-${post.created_at || Date.now()}`),
    ticker,
    pnl,
    percent: toMaybeFiniteNumber(metadata?.percent),
    author,
    createdAt: post.created_at || null,
    entryPrice: toMaybeFiniteNumber(metadata?.entry_price ?? metadata?.entryPrice),
    exitPrice: toMaybeFiniteNumber(metadata?.exit_price ?? metadata?.exitPrice),
    shares: toMaybeFiniteNumber(metadata?.shares ?? metadata?.qty ?? metadata?.quantity),
    openedAt: metadata?.opened_at ?? metadata?.openedAt ?? null,
    closedAt: metadata?.closed_at ?? metadata?.closedAt ?? post.created_at ?? null,
    note: String(metadata?.note || '').trim(),
  };
};

async function readCachedPayload(redis) {
  if (!redis) return null;

  try {
    const pipeline = redis.pipeline();
    pipeline.get(CACHE_KEY_TODAY);
    pipeline.get(CACHE_KEY_TOP_WINS);
    pipeline.get(CACHE_KEY_TOP_LOSSES);
    const [slipsRaw, winsRaw, lossesRaw] = await pipeline.exec();

    const slips = parseCachedRows(unwrapPipelineResult(slipsRaw));
    const topWins = parseCachedRows(unwrapPipelineResult(winsRaw));
    const topLosses = parseCachedRows(unwrapPipelineResult(lossesRaw));

    if (!slips || !topWins || !topLosses) return null;
    return { slips, topWins, topLosses };
  } catch (error) {
    console.error('[community/trending-slips] Redis read error:', error);
    return null;
  }
}

async function writeCachedPayload(redis, payload) {
  if (!redis || !payload) return;

  try {
    const pipeline = redis.pipeline();
    pipeline.set(CACHE_KEY_TODAY, JSON.stringify(payload.slips || []), { ex: CACHE_TTL_SECONDS });
    pipeline.set(CACHE_KEY_TOP_WINS, JSON.stringify(payload.topWins || []), { ex: CACHE_TTL_SECONDS });
    pipeline.set(CACHE_KEY_TOP_LOSSES, JSON.stringify(payload.topLosses || []), { ex: CACHE_TTL_SECONDS });
    await pipeline.exec();
  } catch (error) {
    console.error('[community/trending-slips] Redis write error:', error);
  }
}

async function fetchTodaySnapshotsFromSupabase() {
  const { startIso, endIso } = getUtcDayRange();

  const { data: posts, error } = await supabase
    .from('community_posts')
    .select('id, user_id, author_name, metadata, created_at')
    .eq('post_type', 'pnl_share')
    .is('parent_id', null)
    .is('parent_post_id', null)
    .gte('created_at', startIso)
    .lt('created_at', endIso)
    .order('created_at', { ascending: false })
    .limit(MAX_DB_ROWS);

  if (error) throw error;

  const userIds = [...new Set((posts || []).map((row) => row.user_id).filter(Boolean))];
  const displayNamesById = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', userIds);

    (profiles || []).forEach((profile) => {
      if (!profile?.id) return;
      displayNamesById[profile.id] = profile.display_name || '';
    });
  }

  const snapshots = (posts || [])
    .map((post) => normalizeSnapshotRow(post, displayNamesById))
    .filter(Boolean);

  const slips = sortByPnlMagnitude(snapshots).slice(0, MAX_SLIP_ROWS);
  const topWins = sortTopWins(snapshots.filter((row) => Number(row?.pnl) > 0)).slice(0, MAX_TOP_ROWS);
  const topLosses = sortTopLosses(snapshots.filter((row) => Number(row?.pnl) < 0)).slice(0, MAX_TOP_ROWS);

  return { slips, topWins, topLosses };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const redis = getRedisClient();
  const cached = await readCachedPayload(redis);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json({
      slips: cached.slips,
      topWins: cached.topWins,
      topLosses: cached.topLosses,
      fromCache: true,
      generatedAt: new Date().toISOString(),
    });
  }

  try {
    const fresh = await fetchTodaySnapshotsFromSupabase();
    await writeCachedPayload(redis, fresh);

    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json({
      slips: fresh.slips,
      topWins: fresh.topWins,
      topLosses: fresh.topLosses,
      fromCache: false,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[community/trending-slips] Failed to fetch trending slips:', error);
    return res.status(500).json({
      error: 'Failed to load trending slips',
      slips: [],
      topWins: [],
      topLosses: [],
      fromCache: false,
    });
  }
}
