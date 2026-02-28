const CACHE_TTL_MS = 2 * 60 * 1000;
const MAX_ITEMS = 20;

let cachedPayload = null;
let cachedAt = 0;

const toPlainText = (value, depth = 0) => {
  if (depth > 3) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => toPlainText(item, depth + 1))
      .filter(Boolean)
      .join(' ')
      .trim();
  }
  if (value && typeof value === 'object') {
    const preferredKeys = ['text', 'title', 'headline', 'summary', 'description', 'name', 'en'];
    for (const key of preferredKeys) {
      const picked = toPlainText(value[key], depth + 1);
      if (picked) return picked;
    }
    for (const nested of Object.values(value)) {
      const picked = toPlainText(nested, depth + 1);
      if (picked) return picked;
    }
  }
  return '';
};

const clampText = (value, max = 200) => {
  const text = toPlainText(value).replace(/\s+/g, ' ').trim();
  if (!text || /^\[object object\]$/i.test(text)) return '';
  return text.slice(0, max);
};

const uniqueList = (list) => {
  const seen = new Set();
  const out = [];
  list.forEach((item) => {
    if (!item) return;
    const key = String(item).toUpperCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(key);
  });
  return out;
};

const normalizeSymbols = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return uniqueList(
      value
        .map((item) => String(item || '').replace(/[^A-Za-z0-9.]/g, '').toUpperCase())
        .filter(Boolean)
    );
  }

  if (typeof value === 'string') {
    return uniqueList(
      value
        .split(/[\s,]+/)
        .map((item) => item.replace(/[^A-Za-z0-9.]/g, '').toUpperCase())
        .filter(Boolean)
    );
  }

  return [];
};

const extractSymbolsFromText = (text) => {
  if (!text) return [];
  const matches = String(text).match(/\$[A-Z]{1,8}(?:[./-][A-Z]{1,8})?\b/g) || [];
  return uniqueList(matches.map((match) => match.replace('$', '').toUpperCase()));
};

const normalizeTimestamp = (value) => {
  if (!value) return new Date().toISOString();
  if (typeof value === 'number') {
    return new Date(value * (value > 1e12 ? 1 : 1000)).toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
};

const finalizeItems = (items, fallbackSource) => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      const text = clampText(item?.text || item?.headline || item?.title || item?.summary);
      if (!text) return null;
      const source = clampText(item?.source || fallbackSource || 'Unknown', 40) || 'Unknown';
      const rawSymbols = normalizeSymbols(item?.symbols || item?.symbol || item?.related);
      const derivedSymbols = extractSymbolsFromText(text);
      const symbols = uniqueList([...rawSymbols, ...derivedSymbols]);
      const timestamp = normalizeTimestamp(item?.timestamp || item?.created_at || item?.updated_at || item?.datetime);

      return {
        text,
        source,
        timestamp,
        symbols,
      };
    })
    .filter(Boolean);
};

const isBreakingNews = (article) => {
  const raw = article?.is_breaking_news;
  if (raw === true || raw === 1) return true;
  if (typeof raw === 'string') return raw.trim().toLowerCase() === 'true';
  return false;
};

const mapMarketauxArticle = (article) => {
  const text = clampText(article?.title || article?.description || article?.snippet, 200);
  if (!text) return null;
  const source = clampText(article?.source || 'Marketaux', 40) || 'Marketaux';
  const entitySymbols = normalizeSymbols((article?.entities || []).map((entity) => entity?.symbol));
  const textSymbols = extractSymbolsFromText(text);
  const symbols = uniqueList([...entitySymbols, ...textSymbols]);
  const timestamp = normalizeTimestamp(article?.published_at || article?.updated_at || article?.created_at);

  return {
    text,
    source,
    timestamp,
    symbols,
  };
};

const fetchMarketauxNews = async ({
  symbols = [],
  breakingOnly = false,
  lookbackHours = 48,
  limit = 50,
  filterEntities = true,
  mustHaveEntities = false,
} = {}) => {
  const apiKey = String(process.env.MARKETAUX_API_KEY || '').trim();
  if (!apiKey) {
    console.error('[trending] Missing MARKETAUX_API_KEY');
    return [];
  }

  const safeHours = Number.isFinite(Number(lookbackHours)) ? Math.max(1, Number(lookbackHours)) : 48;
  const safeLimit = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(100, Number(limit))) : 50;
  const shouldIncludePublishedAfter = Number.isFinite(Number(lookbackHours));
  const publishedAfter = shouldIncludePublishedAfter
    ? new Date(Date.now() - (safeHours * 60 * 60 * 1000)).toISOString()
    : null;
  const params = new URLSearchParams({
    api_token: apiKey,
    language: 'en',
    limit: String(safeLimit),
    sort: 'published_desc',
    filter_entities: filterEntities ? 'true' : 'false',
  });

  if (publishedAfter) {
    params.set('published_after', publishedAfter);
  }

  if (breakingOnly) {
    params.set('is_breaking_news', 'true');
  }

  if (symbols.length > 0) {
    params.set('symbols', symbols.join(','));
    if (mustHaveEntities) {
      params.set('must_have_entities', 'true');
    }
  }

  try {
    const response = await fetch(`https://api.marketaux.com/v1/news/all?${params.toString()}`);
    if (!response.ok) {
      const details = await response.text();
      console.error('[trending] Marketaux fetch error:', response.status, details);
      return [];
    }

    const payload = await response.json().catch(() => ({}));
    const rows = Array.isArray(payload?.data) ? payload.data : [];

    return rows
      .filter((article) => (breakingOnly ? isBreakingNews(article) : true))
      .map(mapMarketauxArticle)
      .filter(Boolean);
  } catch (error) {
    console.error('[trending] Marketaux fetch exception:', error);
    return [];
  }
};

const dedupeItems = (items) => {
  const seen = new Set();
  const out = [];
  items.forEach((item) => {
    const key = String(item?.text || '').toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(item);
  });
  return out;
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const forceRefresh = String(req.query?.force || '').toLowerCase() === 'true';
  const cacheKey = 'global';
  const now = Date.now();
  if (
    !forceRefresh &&
    cachedPayload &&
    cachedPayload?.cacheKey === cacheKey &&
    now - cachedAt < CACHE_TTL_MS
  ) {
    return res.status(200).json(cachedPayload);
  }

  const breakingItems = await fetchMarketauxNews({
    symbols: [],
    breakingOnly: true,
    lookbackHours: 72,
    limit: 50,
    filterEntities: false,
    mustHaveEntities: false,
  });

  let items = dedupeItems(finalizeItems(breakingItems, 'Marketaux')).slice(0, MAX_ITEMS);
  let mode = 'marketaux-breaking-global';

  if (items.length === 0) {
    const latestGlobal = await fetchMarketauxNews({
      symbols: [],
      breakingOnly: false,
      lookbackHours: 168,
      limit: 60,
      filterEntities: false,
      mustHaveEntities: false,
    });
    items = dedupeItems(finalizeItems(latestGlobal, 'Marketaux')).slice(0, MAX_ITEMS);
    mode = 'marketaux-latest-global';
  }

  if (items.length === 0 && cachedPayload?.cacheKey === cacheKey && Array.isArray(cachedPayload?.items) && cachedPayload.items.length > 0) {
    return res.status(200).json({
      ...cachedPayload,
      mode: `${cachedPayload.mode || 'marketaux'}-stale`,
    });
  }

  const payload = { items, source: 'marketaux', mode, cacheKey };
  cachedPayload = payload;
  cachedAt = now;

  return res.status(200).json(payload);
}
