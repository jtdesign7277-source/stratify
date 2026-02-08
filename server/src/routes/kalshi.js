import express from 'express';

const router = express.Router();

const toPercent = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num <= 1 ? num * 100 : num;
};

const buildMarketFeed = (markets, { category, limit } = {}) => {
  const normalized = (markets || []).map((market) => {
    const yesRaw = market?.yes_ask ?? market?.last_price ?? market?.yes_bid;
    const noRaw = market?.no_ask ?? market?.no_bid;
    const yesPercent = toPercent(yesRaw);
    const noPercent = toPercent(
      noRaw ?? (Number.isFinite(yesPercent) ? 100 - yesPercent : null)
    );
    const volume = Number(market?.volume || market?.dollar_volume || 0);
    const safeYesPercent = Number.isFinite(yesPercent) ? yesPercent : 50;
    const yesVolume = Number.isFinite(volume) ? volume * (safeYesPercent / 100) : 0;
    const noVolume = Number.isFinite(volume) ? volume - yesVolume : 0;

    return {
      id: market?.ticker || market?.id || '',
      title: market?.title || market?.ticker || '',
      ticker: market?.ticker || '',
      category: market?.category || market?.event_category || 'Other',
      yesPercent: Number.isFinite(yesPercent) ? yesPercent : null,
      noPercent: Number.isFinite(noPercent) ? noPercent : null,
      yesVolume,
      noVolume,
      volume,
      closeTime: market?.close_time || market?.expiration_time || market?.end_date || null,
      status: market?.status || market?.result || 'open',
    };
  });

  let filtered = normalized;
  if (category && category !== 'All') {
    filtered = normalized.filter((market) => 
      market.category?.toLowerCase().includes(category.toLowerCase())
    );
  }
  if (Number.isFinite(limit) && limit > 0) {
    filtered = filtered.slice(0, limit);
  }

  return {
    markets: filtered,
    count: filtered.length
  };
};

// Try multiple Kalshi API endpoints
const KALSHI_ENDPOINTS = [
  'https://api.elections.kalshi.com/trade-api/v2/markets',
  'https://trading-api.kalshi.com/trade-api/v2/markets',
  'https://demo-api.kalshi.co/trade-api/v2/markets',
];

router.get('/markets', async (req, res) => {
  const apiKey = process.env.KALSHI_API_KEY;
  const apiSecret = process.env.KALSHI_API_SECRET;

  const rawLimit = Array.isArray(req.query?.limit) ? req.query.limit[0] : req.query?.limit;
  const parsedLimit = Number(rawLimit);
  const requestedLimit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(200, Math.floor(parsedLimit))
    : 100;
  const fetchLimit = Math.min(200, requestedLimit * 2);

  const rawStatus = Array.isArray(req.query?.status) ? req.query.status[0] : req.query?.status;
  const status = rawStatus ? String(rawStatus) : 'open';

  const rawCategory = Array.isArray(req.query?.category) ? req.query.category[0] : req.query?.category;
  const category = rawCategory ? String(rawCategory) : null;

  // Build headers - use auth if available
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey && apiSecret) {
    headers['Authorization'] = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;
  }

  let lastError = null;
  
  // Try each endpoint
  for (const baseUrl of KALSHI_ENDPOINTS) {
    try {
      const url = new URL(baseUrl);
      url.searchParams.set('limit', String(fetchLimit));
      url.searchParams.set('status', status);

      console.log(`[Kalshi] Trying: ${url.toString()}`);
      
      const response = await fetch(url.toString(), { headers });
      
      if (!response.ok) {
        const text = await response.text();
        console.log(`[Kalshi] ${baseUrl} returned ${response.status}: ${text.slice(0, 200)}`);
        lastError = { status: response.status, text };
        continue;
      }

      const data = await response.json();
      
      if (data?.markets && data.markets.length > 0) {
        const { markets, count } = buildMarketFeed(data.markets, { category, limit: requestedLimit });
        console.log(`[Kalshi] Success! Got ${count} markets from ${baseUrl}`);
        return res.json({ success: true, count, markets });
      }
    } catch (error) {
      console.log(`[Kalshi] ${baseUrl} error:`, error.message);
      lastError = { error: error.message };
    }
  }

  // All endpoints failed - return error with details
  console.log('[Kalshi] All endpoints failed');
  return res.status(502).json({ 
    success: false,
    error: 'All Kalshi API endpoints failed',
    details: lastError,
    hint: 'Using mock data on frontend'
  });
});

export default router;
