// /api/radar/search.js — Symbol search with Redis cache (24h TTL)
import { Redis } from '@upstash/redis';

let redisClient = null;
let redisDisabled = false;

function getRedis() {
  if (redisDisabled) return null;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (!redisClient) {
    try { redisClient = new Redis({ url, token }); }
    catch { redisDisabled = true; return null; }
  }
  return redisClient;
}

const CACHE_TTL = 86400; // 24 hours

const isUsExchange = (v) => {
  const ex = String(v || '').trim().toUpperCase();
  return ex === 'NYSE' || ex === 'NASDAQ';
};

const getTypePriority = (v) => {
  const t = String(v || '').trim().toLowerCase();
  if (t.includes('common stock') || t.includes('stock')) return 0;
  if (t.includes('etf') || t.includes('etp')) return 1;
  if (t.includes('index')) return 2;
  if (t.includes('crypto')) return 3;
  return 4;
};

const scoreEntry = (entry, query) => {
  const q = String(query || '').trim().toUpperCase();
  const sym = String(entry?.symbol || '').trim().toUpperCase();
  const name = String(entry?.name || '').toUpperCase();
  if (!q) return 99;
  if (sym === q) return 0;
  if (sym.startsWith(q)) return 1;
  if (sym.includes(q)) return 2;
  if (name.startsWith(q)) return 3;
  if (name.includes(q)) return 4;
  return 99;
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const q = String(req.query?.q || '').trim();
  if (!q || q.length < 1) return res.status(200).json([]);

  const cacheKey = `radar:search:${q.toLowerCase()}`;

  // Try Redis cache first
  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return res.status(200).json(cached);
    } catch {}
  }

  // Fetch from Twelve Data
  const apiKey = process.env.TWELVE_DATA_API_KEY || process.env.TWELVEDATA_API_KEY || '';
  if (!apiKey) return res.status(500).json({ error: 'Missing API key' });

  try {
    const url = `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(q)}&outputsize=30`;
    const resp = await fetch(`${url}&apikey=${apiKey}`, { headers: { Accept: 'application/json' } });
    const payload = await resp.json().catch(() => ({}));
    const raw = Array.isArray(payload?.data) ? payload.data : [];

    // Dedupe, score, sort
    const seen = new Map();
    raw.forEach(item => {
      const sym = String(item?.symbol || '').trim().toUpperCase();
      if (sym && !seen.has(sym)) {
        seen.set(sym, {
          symbol: sym,
          name: String(item?.instrument_name || item?.name || '').trim(),
          exchange: String(item?.exchange || '').trim(),
          type: String(item?.instrument_type || item?.type || '').trim(),
        });
      }
    });

    const results = [...seen.values()]
      .map(item => ({ ...item, _score: scoreEntry(item, q), _tp: getTypePriority(item.type) }))
      .filter(item => item._score !== 99)
      .sort((a, b) => {
        if (a._score !== b._score) return a._score - b._score;
        if (a._tp !== b._tp) return a._tp - b._tp;
        const aUs = isUsExchange(a.exchange) ? 0 : 1;
        const bUs = isUsExchange(b.exchange) ? 0 : 1;
        if (aUs !== bUs) return aUs - bUs;
        return a.symbol.localeCompare(b.symbol);
      })
      .slice(0, 10)
      .map(({ _score, _tp, ...item }) => item);

    // Cache in Redis (fire-and-forget)
    if (redis) {
      redis.set(cacheKey, results, { ex: CACHE_TTL }).catch(() => {});
    }

    return res.status(200).json(results);
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
}
