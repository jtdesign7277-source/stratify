import express from 'express';

const router = express.Router();

const toPercent = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num <= 1 ? num * 100 : num;
};

const buildMarketFeed = (markets, { category, limit } = {}) => {
  const normalized = (markets || []).map((market) => {
    const yesRaw = market?.yes_ask ?? market?.last_price;
    const noRaw = market?.no_ask;
    const yesPercent = toPercent(yesRaw);
    const noPercent = toPercent(
      noRaw ?? (Number.isFinite(yesPercent) ? 100 - yesPercent : null)
    );
    const volume = Number(market?.volume || 0);
    const safeYesPercent = Number.isFinite(yesPercent) ? yesPercent : 50;
    const yesVolume = Number.isFinite(volume) ? volume * (safeYesPercent / 100) : 0;
    const noVolume = Number.isFinite(volume) ? volume - yesVolume : 0;
    const hasLiveFlag = market
      && (Object.prototype.hasOwnProperty.call(market, 'is_live')
        || Object.prototype.hasOwnProperty.call(market, 'event_live')
        || Object.prototype.hasOwnProperty.call(market, 'live')
        || Object.prototype.hasOwnProperty.call(market, 'in_play')
        || Object.prototype.hasOwnProperty.call(market, 'inPlay'));
    let liveFlags = null;
    if (hasLiveFlag) {
      const isLive = Boolean(market?.is_live)
        || Boolean(market?.event_live)
        || Boolean(market?.live)
        || Boolean(market?.in_play)
        || Boolean(market?.inPlay);
      liveFlags = {
        is_live: isLive,
        live: isLive,
        in_play: Boolean(market?.in_play ?? market?.inPlay),
        event_live: Boolean(market?.event_live)
      };
    }

    return {
      id: market?.ticker || '',
      title: market?.title || market?.ticker || '',
      ticker: market?.ticker || '',
      category: market?.category || 'Other',
      yesPercent: Number.isFinite(yesPercent) ? yesPercent : null,
      noPercent: Number.isFinite(noPercent) ? noPercent : null,
      yesVolume,
      noVolume,
      volume,
      closeTime: market?.close_time || market?.expiration_time || null,
      status: market?.status || 'open',
      ...(liveFlags || {})
    };
  });

  let filtered = normalized;
  if (category && category !== 'All') {
    filtered = normalized.filter((market) => market.category === category);
  }
  if (Number.isFinite(limit) && limit > 0) {
    filtered = filtered.slice(0, limit);
  }

  return {
    markets: filtered,
    count: filtered.length
  };
};

router.get('/markets', async (req, res) => {
  const apiKey = process.env.KALSHI_API_KEY;
  const apiSecret = process.env.KALSHI_API_SECRET;

  if (!apiKey || !apiSecret) {
    return res.status(500).json({
      error: 'KALSHI_API_KEY and KALSHI_API_SECRET must be set'
    });
  }

  const url = new URL('https://trading-api.kalshi.com/trade-api/v2/markets');
  const rawLimit = Array.isArray(req.query?.limit) ? req.query.limit[0] : req.query?.limit;
  const parsedLimit = Number(rawLimit);
  const requestedLimit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(200, Math.floor(parsedLimit))
    : 100;
  const fetchLimit = Math.min(200, requestedLimit * 2);

  const rawStatus = Array.isArray(req.query?.status) ? req.query.status[0] : req.query?.status;
  const status = rawStatus ? String(rawStatus) : 'open';

  url.searchParams.set('limit', String(fetchLimit));
  url.searchParams.set('status', status);

  for (const [key, value] of Object.entries(req.query || {})) {
    if (key === 'limit' || key === 'category' || key === 'status') continue;
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry !== undefined && entry !== null) {
          url.searchParams.append(key, String(entry));
        }
      });
    } else if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  }

  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

  let response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        Authorization: `Basic ${auth}`
      }
    });
  } catch (error) {
    return res.status(502).json({ error: 'Upstream request failed' });
  }

  if (!response.ok) {
    const text = await response.text();
    return res.status(response.status).send(text);
  }

  try {
    const data = await response.json();
    const rawCategory = Array.isArray(req.query?.category)
      ? req.query.category[0]
      : req.query?.category;
    const category = rawCategory ? String(rawCategory) : null;
    const { markets, count } = buildMarketFeed(data?.markets, {
      category,
      limit: requestedLimit
    });
    return res.json({
      success: true,
      count,
      markets
    });
  } catch (error) {
    return res.status(502).json({ error: 'Invalid JSON from upstream' });
  }
});

export default router;
