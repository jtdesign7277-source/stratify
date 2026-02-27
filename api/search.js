// api/search.js — Marketaux news search endpoint (Vercel serverless)
// Cache-first with Redis (Upstash) — 15-minute TTL

const MARKETAUX_KEY = process.env.MARKETAUX_API_KEY;
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const CACHE_TTL = 900; // 15 minutes

const PAYWALLED_SOURCES = [
  'seekingalpha.com',
  'wsj.com',
  'ft.com',
  'barrons.com',
  'bloomberg.com',
  'economist.com',
  'nytimes.com',
  'washingtonpost.com',
  'reuters.com',
  'businessinsider.com',
];

function isPaywalled(article) {
  const domain = String(article.url || '').toLowerCase();
  const source = String(article.source_domain || article.source || '').toLowerCase();
  return PAYWALLED_SOURCES.some(
    (s) => domain.includes(s) || source.includes(s.replace('.com', ''))
  );
}

function getDateDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function stripHtml(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function transformArticle(article) {
  const tickers = (article.entities || [])
    .filter((e) => e.type === 'equity' || e.type === 'index')
    .map((e) => e.symbol)
    .filter(Boolean)
    .slice(0, 4);

  return {
    id: article.uuid || article.url,
    title: stripHtml(article.title),
    description: stripHtml(article.description || article.snippet),
    url: article.url,
    source: article.source,
    source_domain: article.source_domain,
    publishedAt: article.published_at,
    timeAgo: relativeTime(article.published_at),
    image: article.image_url || null,
    tickers,
    sentiment: article.entities?.[0]?.sentiment_score != null
      ? article.entities[0].sentiment_score > 0.1 ? 'bullish'
        : article.entities[0].sentiment_score < -0.1 ? 'bearish' : 'neutral'
      : 'neutral',
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q } = req.query;
  if (!q || !String(q).trim()) {
    return res.status(400).json({ error: 'Missing query parameter q' });
  }

  const cleanQuery = String(q).trim().slice(0, 200);
  const cacheKey = `search:v1:${cleanQuery.toLowerCase()}`;

  // 1. Try Redis cache
  if (REDIS_URL && REDIS_TOKEN) {
    try {
      const cached = await fetch(`${REDIS_URL}/get/${encodeURIComponent(cacheKey)}`, {
        headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
      });
      const cachedData = await cached.json();
      if (cachedData.result) {
        return res.status(200).json(JSON.parse(cachedData.result));
      }
    } catch { /* cache miss — fall through */ }
  }

  // 2. Fetch from Marketaux
  if (!MARKETAUX_KEY) {
    return res.status(500).json({ error: 'Marketaux API key not configured' });
  }

  try {
    const url = `https://api.marketaux.com/v1/news/all?search=${encodeURIComponent(cleanQuery)}&filter_entities=true&language=en&published_after=${getDateDaysAgo(7)}&limit=15&api_token=${MARKETAUX_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    const rawArticles = Array.isArray(data.data) ? data.data : [];
    const articles = rawArticles
      .filter((a) => !isPaywalled(a))
      .map(transformArticle);

    const result = { articles, query: cleanQuery, count: articles.length };

    // 3. Cache in Redis
    if (REDIS_URL && REDIS_TOKEN) {
      try {
        await fetch(`${REDIS_URL}/set/${encodeURIComponent(cacheKey)}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${REDIS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ value: JSON.stringify(result), ex: CACHE_TTL }),
        });
      } catch { /* cache write failure is non-fatal */ }
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('[api/search] error:', error);
    return res.status(500).json({ error: 'Search failed' });
  }
}
