// /api/marketaux/sentiment.js
// Vercel Serverless Function — MarketAux Sentiment Aggregation
// Cache-first with Upstash Redis (5-min TTL)

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const MARKETAUX_TOKEN = process.env.MARKETAUX_API_TOKEN;
const CACHE_TTL = 300; // 5 minutes

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbols } = req.query;

  if (!symbols) {
    return res.status(400).json({ error: 'symbols parameter required (comma-separated)' });
  }

  // Normalize symbols for cache key
  const normalizedSymbols = symbols.toUpperCase().split(',').sort().join(',');
  const cacheKey = `marketaux:sentiment:${normalizedSymbols}`;

  try {
    // 1. Cache-first — check Redis
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.status(200).json({
        ...cached,
        _cached: true,
        _cachedAt: cached._fetchedAt,
      });
    }

    // 2. Cache miss — fetch from MarketAux
    const url = new URL('https://api.marketaux.com/v1/entity/stats/aggregation');
    url.searchParams.set('symbols', normalizedSymbols);
    url.searchParams.set('language', 'en');
    url.searchParams.set('api_token', MARKETAUX_TOKEN);

    const response = await fetch(url.toString());

    if (!response.ok) {
      const errorText = await response.text();
      console.error('MarketAux API error:', response.status, errorText);
      return res.status(response.status).json({
        error: 'MarketAux API error',
        status: response.status,
      });
    }

    const data = await response.json();

    // Transform into a lookup map: { AAPL: { sentiment: 0.34, docs: 12 }, ... }
    const sentimentMap = {};
    if (data.data && Array.isArray(data.data)) {
      data.data.forEach((entity) => {
        sentimentMap[entity.key] = {
          sentiment: entity.sentiment_avg,
          totalDocs: entity.total_documents,
        };
      });
    }

    const result = {
      sentimentMap,
      symbols: normalizedSymbols.split(','),
      _fetchedAt: new Date().toISOString(),
    };

    // 3. Store in Redis with TTL
    await redis.set(cacheKey, result, { ex: CACHE_TTL });

    return res.status(200).json({ ...result, _cached: false });
  } catch (err) {
    console.error('Sentiment endpoint error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
