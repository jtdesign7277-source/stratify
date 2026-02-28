// /api/marketaux/trending.js
// Vercel Serverless Function — MarketAux Trending Entities
// Cache-first with Upstash Redis (5-min TTL)

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const MARKETAUX_TOKEN = process.env.MARKETAUX_API_TOKEN;
const CACHE_TTL = 300; // 5 minutes

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { countries = 'us', min_doc_count = '5', limit = '10' } = req.query;
  const cacheKey = `marketaux:trending:${countries}:${min_doc_count}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.status(200).json({ ...cached, _cached: true });
    }

    const url = new URL('https://api.marketaux.com/v1/entity/trending/aggregation');
    url.searchParams.set('countries', countries);
    url.searchParams.set('min_doc_count', min_doc_count);
    url.searchParams.set('language', 'en');
    url.searchParams.set('limit', limit);
    url.searchParams.set('api_token', MARKETAUX_TOKEN);

    const response = await fetch(url.toString());
    if (!response.ok) {
      return res.status(response.status).json({ error: 'MarketAux API error' });
    }

    const data = await response.json();

    const trending = (data.data || []).map((entity) => ({
      symbol: entity.key,
      totalDocs: entity.total_documents,
      sentiment: entity.sentiment_avg,
      score: entity.score,
    }));

    const result = {
      trending,
      meta: data.meta || {},
      _fetchedAt: new Date().toISOString(),
    };

    await redis.set(cacheKey, result, { ex: CACHE_TTL });
    return res.status(200).json({ ...result, _cached: false });
  } catch (err) {
    console.error('Trending endpoint error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
