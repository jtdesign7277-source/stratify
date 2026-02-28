// api/paper-history.js — Get user's trade history
// Returns paginated list of all executed trades

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
    if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

    // Pagination params
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;
    const symbol = req.query.symbol; // optional filter

    let query = supabase
      .from('paper_trades')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Optional symbol filter
    if (symbol) {
      query = query.eq('symbol', symbol.toUpperCase());
    }

    const { data: trades, count, error } = await query;

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch trade history' });
    }

    return res.status(200).json({
      trades: (trades || []).map(t => ({
        id: t.id,
        symbol: t.symbol,
        side: t.side,
        quantity: parseFloat(t.quantity),
        price: parseFloat(t.price),
        total_cost: parseFloat(t.total_cost),
        created_at: t.created_at,
      })),
      total: count,
      limit,
      offset,
    });

  } catch (err) {
    console.error('History error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
