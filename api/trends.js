import { Redis } from '@upstash/redis';

const CACHE_KEY = 'trends:all';
const CACHE_TTL_SECONDS = 10 * 60; // 10 minutes

let redisClient = null;

function getRedis() {
  if (redisClient) return redisClient;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    redisClient = new Redis({ url, token });
    return redisClient;
  } catch { return null; }
}

// ─── Reddit ───
async function fetchReddit(subreddit, limit = 3) {
  try {
    const res = await fetch(`https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit + 5}&raw_json=1`, {
      headers: { 'User-Agent': 'Stratify/1.0' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.data?.children || [])
      .filter(c => c.data && !c.data.stickied)
      .slice(0, limit)
      .map(c => ({
        id: c.data.id,
        title: c.data.title,
        url: c.data.url?.startsWith('http') ? c.data.url : `https://reddit.com${c.data.permalink}`,
        score: c.data.score || 0,
        comments: c.data.num_comments || 0,
        subreddit: c.data.subreddit_name_prefixed || `r/${subreddit}`,
        flair: c.data.link_flair_text || null,
        created: (c.data.created_utc || 0) * 1000,
      }));
  } catch { return []; }
}

// ─── Hacker News ───
async function fetchHackerNews(limit = 3) {
  try {
    const idsRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    if (!idsRes.ok) return [];
    const ids = (await idsRes.json()).slice(0, limit);
    const stories = await Promise.all(ids.map(async (id) => {
      const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
      return r.ok ? r.json() : null;
    }));
    return stories.filter(Boolean).map(s => ({
      id: s.id,
      title: s.title,
      url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
      hnUrl: `https://news.ycombinator.com/item?id=${s.id}`,
      score: s.score || 0,
      comments: s.descendants || 0,
      author: s.by || 'unknown',
      created: (s.time || 0) * 1000,
    }));
  } catch { return []; }
}

// ─── Financial News (Alpaca) ───
async function fetchFinancialNews(limit = 3) {
  const apiKey = (process.env.ALPACA_API_KEY || '').trim();
  const apiSecret = (process.env.ALPACA_SECRET_KEY || '').trim();
  if (!apiKey || !apiSecret) return [];
  try {
    const res = await fetch(`https://data.alpaca.markets/v1beta1/news?sort=desc&limit=${limit}`, {
      headers: { 'APCA-API-KEY-ID': apiKey, 'APCA-API-SECRET-KEY': apiSecret },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.news || []).slice(0, limit).map(a => ({
      id: a.id || `news-${Date.now()}-${Math.random()}`,
      title: a.headline || a.title || '',
      url: a.url || '#',
      source: a.source || 'Financial News',
      created: a.created_at ? new Date(a.created_at).getTime() : Date.now(),
      symbols: a.symbols || [],
    }));
  } catch { return []; }
}

// ─── X / Twitter trending (via Grok) ───
async function fetchXTrending(limit = 3) {
  const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'grok-3-mini-fast',
        temperature: 0.2,
        max_tokens: 600,
        messages: [
          { role: 'system', content: `Return exactly ${limit} currently trending finance/market topics on X/Twitter. JSON only: {"items":[{"topic":"...","description":"...","category":"stocks|crypto|economy|earnings","engagement":"high|medium"}]}` },
          { role: 'user', content: 'Return JSON now.' },
        ],
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const text = typeof data?.choices?.[0]?.message?.content === 'string' ? data.choices[0].message.content : '';
    let parsed = null;
    try { parsed = JSON.parse(text.trim()); } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) try { parsed = JSON.parse(m[0]); } catch {}
    }
    const items = Array.isArray(parsed) ? parsed : parsed?.items;
    if (!Array.isArray(items)) return [];
    return items.slice(0, limit).map((t, i) => ({
      id: `x-${Date.now()}-${i}`,
      topic: t.topic || '',
      description: t.description || '',
      category: t.category || 'stocks',
      engagement: t.engagement || 'medium',
    }));
  } catch { return []; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Check Redis cache
  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get(CACHE_KEY);
      if (cached) {
        const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
        return res.status(200).json({ ...data, fromCache: true });
      }
    } catch {}
  }

  // Fetch all sources in parallel — 3 items each
  const [reddit, wsb, x, hackerNews, news] = await Promise.all([
    fetchReddit('stocks', 3),
    fetchReddit('wallstreetbets', 3),
    fetchXTrending(3),
    fetchHackerNews(3),
    fetchFinancialNews(3),
  ]);

  const payload = {
    reddit,
    wsb,
    x,
    hackerNews,
    news,
    fetchedAt: new Date().toISOString(),
  };

  // Cache to Redis
  if (redis) {
    redis.set(CACHE_KEY, JSON.stringify(payload), { ex: CACHE_TTL_SECONDS }).catch(() => {});
  }

  return res.status(200).json(payload);
}
