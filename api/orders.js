import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getUserFromToken(req) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get user from auth token
  console.log('[Orders] Auth header:', req.headers.authorization ? 'present' : 'missing');
  const user = await getUserFromToken(req);
  
  if (!user) {
    console.log('[Orders] No user found from token');
    return res.status(401).json({ 
      error: 'Authentication failed. Please refresh the page and try again.' 
    });
  }

  console.log('[Orders] User authenticated:', user.id);

  // Fetch user's broker connection
  const { data: conn, error: connError } = await supabase
    .from('broker_connections')
    .select('*')
    .eq('user_id', user.id)
    .eq('broker', 'alpaca')
    .maybeSingle();

  console.log('[Orders] Broker query result:', { found: !!conn, error: connError });

  if (connError) {
    console.error('[Orders] Database error:', connError);
    return res.status(500).json({ error: connError.message });
  }

  if (!conn) {
    console.log('[Orders] No broker connection found for user:', user.id);
    return res.status(401).json({ 
      error: 'No Alpaca broker connected. Please connect your Alpaca account in Portfolio.' 
    });
  }

  console.log('[Orders] Using broker connection:', { is_paper: conn.is_paper });

  const apiKey = conn.api_key;
  const apiSecret = conn.api_secret;
  const baseUrl = conn.is_paper !== false 
    ? 'https://paper-api.alpaca.markets' 
    : 'https://api.alpaca.markets';

  try {
    if (req.method === 'GET') {
      const status = String(req.query?.status || 'all');
      const direction = String(req.query?.direction || 'desc');
      const limit = Math.min(Math.max(Number(req.query?.limit || 100), 1), 500);

      const url = new URL(`${baseUrl}/v2/orders`);
      url.searchParams.set('status', status);
      url.searchParams.set('direction', direction);
      url.searchParams.set('limit', String(limit));

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'APCA-API-KEY-ID': apiKey,
          'APCA-API-SECRET-KEY': apiSecret,
        },
      });

      const payload = await response.json();
      if (!response.ok) {
        return res.status(response.status).json({
          error: payload?.message || 'Failed to fetch orders',
          detail: payload,
        });
      }

      const orders = Array.isArray(payload) ? payload : [];
      return res.status(200).json({ orders, count: orders.length });
    }

    const {
      symbol,
      qty,
      notional,
      side,
      type,
      time_in_force,
      limit_price,
      stop_price,
      trail_price,
    } = req.body || {};

    if (!symbol || !side || !type || !time_in_force || (!qty && !notional)) {
      return res.status(400).json({
        error: 'Missing required fields: symbol, side, type, time_in_force, and qty or notional',
      });
    }

    if (!['buy', 'sell'].includes(String(side).toLowerCase())) {
      return res.status(400).json({ error: 'Side must be buy or sell' });
    }

    const order = {
      symbol: String(symbol).toUpperCase(),
      side: String(side).toLowerCase(),
      type: String(type).toLowerCase(),
      time_in_force: String(time_in_force).toLowerCase(),
    };

    if (qty !== undefined && qty !== null && qty !== '') {
      const parsedQty = Number(qty);
      if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
        return res.status(400).json({ error: 'qty must be a positive number' });
      }
      order.qty = String(parsedQty);
    } else {
      const parsedNotional = Number(notional);
      if (!Number.isFinite(parsedNotional) || parsedNotional <= 0) {
        return res.status(400).json({ error: 'notional must be a positive number' });
      }
      order.notional = String(parsedNotional);
    }

    if (limit_price !== undefined && limit_price !== null && limit_price !== '') {
      order.limit_price = String(limit_price);
    }
    if (stop_price !== undefined && stop_price !== null && stop_price !== '') {
      order.stop_price = String(stop_price);
    }
    if (trail_price !== undefined && trail_price !== null && trail_price !== '') {
      order.trail_price = String(trail_price);
    }

    // Detect crypto symbols (contain / or common crypto pairs)
    const isCrypto = order.symbol.includes('/') || 
                     /^(BTC|ETH|SOL|XRP|DOGE|LINK|ADA|AVAX|DOT|MATIC|UNI|ATOM|LTC|BCH|XLM|ALGO|VET|FIL|AAVE|SAND|MANA|CRO|SHIB)(USD|USDT|EUR|GBP)$/.test(order.symbol);

    let apiEndpoint = `${baseUrl}/v2/orders`;
    let orderPayload = order;

    if (isCrypto) {
      // Use Alpaca crypto endpoint (v1beta3)
      apiEndpoint = `${baseUrl}/v1beta3/crypto/us/orders`;
      // Crypto orders require symbol without slash for Alpaca
      orderPayload = {
        ...order,
        symbol: order.symbol.replace('/', ''),
      };
      console.log('[Orders API] Detected crypto symbol, using v1beta3 endpoint');
    }

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': apiSecret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });

    const payload = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: payload?.message || 'Order failed',
        detail: payload,
      });
    }

    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({
      error: error?.message || 'Unexpected order service failure',
    });
  }
}
