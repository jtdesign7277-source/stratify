import { createClient } from '@supabase/supabase-js';
import { webullRequest } from './lib/webull-sign.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getUserFromToken(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const { data: { user }, error } = await supabase.auth.getUser(auth.slice(7));
  if (error || !user) return null;
  return user;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getUserFromToken(req);
  if (!user) return res.status(401).json({ error: 'not_connected' });

  const { data: conn } = await supabase
    .from('broker_connections')
    .select('*')
    .eq('user_id', user.id)
    .eq('broker', 'webull')
    .maybeSingle();

  if (!conn) return res.status(401).json({ error: 'not_connected' });

  try {
    // Get account list first
    const accountsData = await webullRequest(
      conn.api_key, conn.api_secret,
      'GET', '/api/trade/account/v2/list'
    );

    const accounts = accountsData?.data || accountsData || [];
    const account = Array.isArray(accounts) ? accounts[0] : accounts;

    if (!account?.account_id) {
      return res.status(200).json([]);
    }

    // Get positions
    const posData = await webullRequest(
      conn.api_key, conn.api_secret,
      'GET', `/api/trade/account/v2/${account.account_id}/positions`
    );

    const positions = posData?.data || posData || [];
    const normalized = (Array.isArray(positions) ? positions : []).map((p) => ({
      symbol: p.ticker?.symbol || p.symbol || '',
      qty: Number(p.quantity || p.position || 0),
      shares: Number(p.quantity || p.position || 0),
      avg_entry_price: Number(p.cost_price || p.avg_cost || 0),
      avgCost: Number(p.cost_price || p.avg_cost || 0),
      current_price: Number(p.last_price || p.market_price || 0),
      currentPrice: Number(p.last_price || p.market_price || 0),
      market_value: Number(p.market_value || 0),
      marketValue: Number(p.market_value || 0),
      unrealized_pl: Number(p.unrealized_profit_loss || p.unrealized_pl || 0),
      unrealized_plpc: Number(p.unrealized_profit_loss_rate || 0),
      cost_basis: Number(p.cost || 0),
      change_today: 0,
      side: 'long',
      asset_class: 'us_equity',
      broker: 'webull',
    }));

    res.status(200).json(normalized);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
