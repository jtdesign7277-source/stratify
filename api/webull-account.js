import { createClient } from '@supabase/supabase-js';
import { webullRequest, getWebullToken } from './lib/webull-sign.js';

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

  if (!conn) return res.status(401).json({ error: 'not_connected', message: 'No Webull broker connected' });

  try {
    // Get account list first, then account details
    const accountsData = await webullRequest(
      conn.api_key, conn.api_secret,
      'GET', '/api/trade/account/v2/list'
    );

    const accounts = accountsData?.data || accountsData || [];
    const account = Array.isArray(accounts) ? accounts[0] : accounts;

    if (!account?.account_id) {
      return res.status(200).json({
        equity: 0, cash: 0, buying_power: 0,
        message: 'No Webull accounts found'
      });
    }

    // Get account balance
    const balanceData = await webullRequest(
      conn.api_key, conn.api_secret,
      'GET', `/api/trade/account/v2/${account.account_id}/balance`
    );

    const balance = balanceData?.data || balanceData || {};

    res.status(200).json({
      account_id: account.account_id,
      equity: Number(balance.net_liquidation || balance.total_market_value || 0),
      cash: Number(balance.cash_balance || balance.settled_cash || 0),
      buying_power: Number(balance.buying_power || balance.day_buying_power || 0),
      portfolio_value: Number(balance.net_liquidation || 0),
      last_equity: Number(balance.net_liquidation || 0),
      broker: 'webull',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
