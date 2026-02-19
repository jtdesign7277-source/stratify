export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ALPACA_API_KEY || process.env.APCA_API_KEY_ID;
  const apiSecret = process.env.ALPACA_API_SECRET || process.env.APCA_API_SECRET_KEY;

  if (!apiKey || !apiSecret) {
    return res.status(500).json({ error: 'Alpaca API keys not configured' });
  }

  const baseUrl = process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets';

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

    const response = await fetch(`${baseUrl}/v2/orders`, {
      method: 'POST',
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': apiSecret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(order),
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
