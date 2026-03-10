// api/premarket.js - Vercel serverless function
// Yahoo Finance pre/post market data. Redis cache TTL 60s, key: premarket:${symbols}

const CACHE_TTL = 60;

function getRedisClient() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const { Redis } = require('@upstash/redis');
    return new Redis({ url, token });
  } catch (e) {
    return null;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const symbols = (req.query.symbols || 'AAPL,TSLA,NVDA,MSFT,GOOGL,META,AMZN,SPY,QQQ,COIN').toString().trim();
  const cacheKey = `premarket:${symbols}`;

  const redis = getRedisClient();
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached && typeof cached === 'object') {
        return res.json(cached);
      }
    } catch (e) {
      // ignore cache miss/error
    }
  }

  const url = `https://query1.finance.yahoo.com/v8/finance/quote?symbols=${encodeURIComponent(symbols)}&fields=preMarketPrice,preMarketChange,preMarketChangePercent,postMarketPrice,postMarketChange,postMarketChangePercent,regularMarketPrice,marketState`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Accept: 'application/json',
    },
  });

  const data = await response.json();
  const quotes = data?.quoteResponse?.result || [];

  const result = {};
  for (const quote of quotes) {
    result[quote.symbol] = {
      marketState: quote.marketState,
      preMarketPrice: quote.preMarketPrice || null,
      preMarketChange: quote.preMarketChange || null,
      preMarketChangePercent: quote.preMarketChangePercent || null,
      postMarketPrice: quote.postMarketPrice || null,
      postMarketChange: quote.postMarketChange || null,
      postMarketChangePercent: quote.postMarketChangePercent || null,
    };
  }

  console.log('PREMARKET YAHOO:', JSON.stringify(result));

  if (redis) {
    try {
      await redis.set(cacheKey, result, { ex: CACHE_TTL });
    } catch (e) {
      // ignore
    }
  }

  res.json(result);
};
