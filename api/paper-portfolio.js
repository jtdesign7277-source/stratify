// api/paper-portfolio.js — Get user's paper trading portfolio
// Returns cash balance, positions with live P&L, and total account value

import { supabase } from './lib/supabase.js';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('paper-portfolio auth failed:', authError?.message || 'no user');
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get portfolio
    const { data: portfolio, error: portError } = await supabase
      .from('paper_portfolios')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (portError || !portfolio) {
      // Auto-create if missing (for existing users who signed up before migration)
      const { data: newPort, error: createError } = await supabase
        .from('paper_portfolios')
        .insert({ user_id: user.id, cash_balance: 100000, starting_balance: 100000 })
        .select()
        .single();

      if (createError) {
        return res.status(500).json({ error: 'Failed to create portfolio' });
      }
      
      return res.status(200).json({
        cash_balance: 100000,
        starting_balance: 100000,
        positions: [],
        total_market_value: 0,
        total_account_value: 100000,
        total_pnl: 0,
        total_pnl_percent: 0,
      });
    }

    // Get positions
    const { data: positions, error: posError } = await supabase
      .from('paper_positions')
      .select('*')
      .eq('user_id', user.id);

    if (posError) {
      return res.status(500).json({ error: 'Failed to fetch positions' });
    }

    // Enrich positions with live prices from Redis
    let totalMarketValue = 0;
    const enrichedPositions = await Promise.all(
      (positions || []).map(async (pos) => {
        const cacheKey = `quote:${pos.symbol}`;
        let currentPrice = 0;

        try {
          const cached = await redis.get(cacheKey);
          if (cached) {
            const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
            currentPrice = parseFloat(data.close || data.price || data.last) || 0;
          }
        } catch (e) {
          console.warn(`Cache miss for ${pos.symbol}`);
        }

        // If no cached price, fall back to cost basis (better than 0)
        if (!currentPrice) currentPrice = parseFloat(pos.avg_cost_basis);

        const quantity = parseFloat(pos.quantity);
        const avgCost = parseFloat(pos.avg_cost_basis);
        const marketValue = quantity * currentPrice;
        const costBasis = quantity * avgCost;
        const pnl = marketValue - costBasis;
        const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

        totalMarketValue += marketValue;

        return {
          symbol: pos.symbol,
          quantity,
          avg_cost_basis: avgCost,
          current_price: currentPrice,
          market_value: Math.round(marketValue * 100) / 100,
          pnl: Math.round(pnl * 100) / 100,
          pnl_percent: Math.round(pnlPercent * 100) / 100,
        };
      })
    );

    const cashBalance = parseFloat(portfolio.cash_balance);
    const startingBalance = parseFloat(portfolio.starting_balance);
    const totalAccountValue = cashBalance + totalMarketValue;
    const totalPnl = totalAccountValue - startingBalance;
    const totalPnlPercent = startingBalance > 0 ? (totalPnl / startingBalance) * 100 : 0;

    return res.status(200).json({
      cash_balance: Math.round(cashBalance * 100) / 100,
      starting_balance: startingBalance,
      positions: enrichedPositions,
      total_market_value: Math.round(totalMarketValue * 100) / 100,
      total_account_value: Math.round(totalAccountValue * 100) / 100,
      total_pnl: Math.round(totalPnl * 100) / 100,
      total_pnl_percent: Math.round(totalPnlPercent * 100) / 100,
    });

  } catch (err) {
    console.error('Portfolio error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
