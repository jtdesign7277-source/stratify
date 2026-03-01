// api/paper-trade.js — Execute a paper trade (buy/sell)
// Grabs live price from Redis cache, validates, executes via Supabase RPC

import { createClient } from '@supabase/supabase-js';
import {
  PAPER_BUY_NOTIONAL_LIMIT_USD,
  buildPaperUsageSnapshot,
  buildProPlusRequiredPayload,
  getPaperBuyNotionalUsageUsd,
  getRedisClient,
  getSubscriptionStatus,
  incrementPaperBuyNotionalUsageUsd,
  isPaidStatus,
} from './lib/pro-plus.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const redis = getRedisClient();

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Get user from auth token
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

    const { symbol, side, quantity } = req.body;
    const normalizedSide = String(side || '').toLowerCase();
    const normalizedQuantity = Number(quantity);
    const subscriptionStatus = await getSubscriptionStatus(supabase, user.id);
    const isPaidUser = isPaidStatus(subscriptionStatus);

    // Validate inputs
    if (!symbol || !side || !quantity) {
      return res.status(400).json({ error: 'Missing required fields: symbol, side, quantity' });
    }
    if (!['buy', 'sell'].includes(normalizedSide)) {
      return res.status(400).json({ error: 'Side must be "buy" or "sell"' });
    }
    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
      return res.status(400).json({ error: 'Quantity must be greater than 0' });
    }

    if (normalizedSide === 'buy' && !isPaidUser && redis) {
      const usage = await getPaperBuyNotionalUsageUsd(redis, user.id);
      if (usage >= PAPER_BUY_NOTIONAL_LIMIT_USD) {
        const usageSnapshot = buildPaperUsageSnapshot(usage);
        return res.status(402).json(
          buildProPlusRequiredPayload({
            reason: 'paper_trading_limit_reached',
            message: 'Paper trading limit reached (3 x $100,000 cycles). Upgrade to PRO PLUS PLAN for unlimited paper trades.',
            usage: usageSnapshot,
          })
        );
      }
    }

    // Get current price from Redis cache (your existing price cache)
    const cacheKey = `quote:${symbol.toUpperCase()}`;
    let cached = redis ? await redis.get(cacheKey) : null;
    let price;

    if (cached) {
      // Parse if string
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
      price = parseFloat(data.close || data.price || data.last);
    }

    // Fallback: fetch from Twelve Data if not cached
    if (!price) {
      const tdRes = await fetch(
        `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${process.env.TWELVE_DATA_API_KEY}`
      );
      const tdData = await tdRes.json();
      if (tdData.code) {
        return res.status(400).json({ error: `Invalid symbol: ${symbol}` });
      }
      price = parseFloat(tdData.close);

      // Cache it for next time
      if (redis) {
        await redis.set(cacheKey, JSON.stringify(tdData), { ex: 60 });
      }
    }

    if (!price || isNaN(price)) {
      return res.status(400).json({ error: `Could not get price for ${symbol}` });
    }

    // Execute the atomic trade via Supabase RPC
    const { data, error } = await supabase.rpc('execute_paper_trade', {
      p_user_id: user.id,
      p_symbol: symbol.toUpperCase(),
      p_side: side,
      p_quantity: quantity,
      p_price: price,
    });

    if (error) {
      console.error('RPC error:', error);
      return res.status(500).json({ error: 'Trade execution failed', details: error.message });
    }

    // The RPC returns a JSON object with success/error
    if (!data.success) {
      return res.status(400).json(data);
    }

    if (normalizedSide === 'buy' && !isPaidUser && redis) {
      const buyCost = normalizedQuantity * Number(price || 0);
      if (Number.isFinite(buyCost) && buyCost > 0) {
        await incrementPaperBuyNotionalUsageUsd(redis, user.id, buyCost);
      }
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('Paper trade error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
