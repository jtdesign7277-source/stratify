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

// ─── Hacker News (reliable, free, no auth) ───
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

// ─── Financial News (Alpaca — reliable) ───
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

// ─── Grok: Reddit + WSB + X trending in one call ───
async function fetchSocialTrending() {
  const apiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  if (!apiKey) return { reddit: [], wsb: [], x: [] };
  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'grok-3-mini-fast',
        temperature: 0.3,
        max_tokens: 1200,
        messages: [
          {
            role: 'system',
            content: `You are a social media trend aggregator. Return the 3 hottest current posts/topics from each of these sources: Reddit r/stocks, Reddit r/wallstreetbets, and X/Twitter finance. Return JSON ONLY in this exact format:
{"reddit":[{"title":"...","subreddit":"r/stocks","score":1234,"url":"https://reddit.com/..."}],"wsb":[{"title":"...","subreddit":"r/wallstreetbets","score":5678,"url":"https://reddit.com/..."}],"x":[{"topic":"...","description":"...","category":"stocks|crypto|economy|earnings","engagement":"high|medium"}]}
Each array must have exactly 3 items. Use real current trending posts and topics. Do not make up fake URLs — use https://reddit.com/r/stocks and https://reddit.com/r/wallstreetbets as base URLs if you cannot find exact links.`,
          },
          { role: 'user', content: 'Return the JSON now with the 3 hottest items per source.' },
        ],
      }),
    });
    if (!res.ok) {
      console.error('Grok social trending error:', res.status);
      return { reddit: [], wsb: [], x: [] };
    }
    const data = await res.json();
    const text = typeof data?.choices?.[0]?.message?.content === 'string' ? data.choices[0].message.content : '';
    let parsed = null;
    try { parsed = JSON.parse(text.trim()); } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) try { parsed = JSON.parse(m[0]); } catch {}
    }
    if (!parsed) return { reddit: [], wsb: [], x: [] };

    const mapReddit = (items, sub) => (Array.isArray(items) ? items : []).slice(0, 3).map((p, i) => ({
      id: `${sub}-${Date.now()}-${i}`,
      title: p.title || '',
      url: p.url || `https://reddit.com/r/${sub}`,
      score: p.score || 0,
      comments: p.comments || 0,
      subreddit: p.subreddit || `r/${sub}`,
      flair: p.flair || null,
      created: Date.now(),
    }));

    const mapX = (items) => (Array.isArray(items) ? items : []).slice(0, 3).map((t, i) => ({
      id: `x-${Date.now()}-${i}`,
      topic: t.topic || '',
      description: t.description || '',
      category: t.category || 'stocks',
      engagement: t.engagement || 'medium',
    }));

    return {
      reddit: mapReddit(parsed.reddit, 'stocks'),
      wsb: mapReddit(parsed.wsb, 'wallstreetbets'),
      x: mapX(parsed.x),
    };
  } catch (err) {
    console.error('Grok social trending fetch error:', err);
    return { reddit: [], wsb: [], x: [] };
  }
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

  // Fetch all sources in parallel
  const [social, hackerNews, news] = await Promise.all([
    fetchSocialTrending(),
    fetchHackerNews(3),
    fetchFinancialNews(3),
  ]);

  const payload = {
    reddit: social.reddit,
    wsb: social.wsb,
    x: social.x,
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
