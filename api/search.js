// api/search.js — Marketaux news search endpoint (Vercel serverless)
// Cache-first with Redis (Upstash) — 15-minute TTL

const MARKETAUX_KEY = process.env.MARKETAUX_API_KEY;
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const CACHE_TTL = 900; // 15 minutes
const MAX_WINDOW_DAYS = 14;
const MAX_LIMIT = 30;
const ALLOWED_SORTS = new Set([
  'published_desc',
  'published_asc',
  'entity_match_score',
  'relevance_score',
  'sentiment_score',
]);

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

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseBool(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
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

function dedupeArticles(rows = []) {
  const seen = new Set();
  const list = Array.isArray(rows) ? rows : [];

  return list.filter((row) => {
    const title = String(row?.title || '').trim().toLowerCase();
    const source = String(row?.source || '').trim().toLowerCase();
    const url = String(row?.url || '').trim().toLowerCase().replace(/[?#].*$/, '');
    const key = `${title}|${source}|${url}`;
    if (!title && !url) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isWithinAge(publishedAt, maxAgeMs) {
  const ts = Date.parse(String(publishedAt || ''));
  if (!Number.isFinite(ts)) return false;
  const ageMs = Date.now() - ts;
  return ageMs >= -60_000 && ageMs <= maxAgeMs;
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
  const days = clamp(parsePositiveInt(req.query?.days, 7), 1, MAX_WINDOW_DAYS);
  const limit = clamp(parsePositiveInt(req.query?.limit, 15), 1, MAX_LIMIT);
  const sort = ALLOWED_SORTS.has(String(req.query?.sort || '').trim())
    ? String(req.query.sort).trim()
    : '';
  const language = String(req.query?.language || 'en').trim().slice(0, 8).toLowerCase() || 'en';
  const countries = String(req.query?.countries || '').trim().toLowerCase().replace(/[^a-z,]/g, '').slice(0, 30);
  const mustHaveEntities = parseBool(req.query?.must_have_entities);

  const cacheVariant = [
    `q=${cleanQuery.toLowerCase()}`,
    `days=${days}`,
    `limit=${limit}`,
    `sort=${sort || 'default'}`,
    `language=${language}`,
    `countries=${countries || 'all'}`,
    `mustHaveEntities=${mustHaveEntities ? '1' : '0'}`,
  ].join('|');
  const cacheKey = `search:v2:${cacheVariant}`;

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
    const params = new URLSearchParams({
      search: cleanQuery,
      filter_entities: 'true',
      language,
      published_after: getDateDaysAgo(days),
      limit: String(limit),
      api_token: MARKETAUX_KEY,
    });
    if (sort) params.set('sort', sort);
    if (countries) params.set('countries', countries);
    if (mustHaveEntities) params.set('must_have_entities', 'true');

    const response = await fetch(`https://api.marketaux.com/v1/news/all?${params.toString()}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Marketaux ${response.status}: ${body.slice(0, 240)}`);
    }
    const data = await response.json();

    const rawArticles = Array.isArray(data.data) ? data.data : [];
    const maxAgeMs = days * 24 * 60 * 60 * 1000;
    const filtered = rawArticles
      .filter((a) => !isPaywalled(a))
      .map(transformArticle)
      .filter((a) => isWithinAge(a.publishedAt, maxAgeMs));
    const articles = dedupeArticles(filtered);

    if (sort === 'published_desc') {
      articles.sort((a, b) => Date.parse(String(b.publishedAt || '')) - Date.parse(String(a.publishedAt || '')));
    }

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
