// /api/trade.js — Vercel serverless function
// Executes trades through Alpaca (paper or live)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ALPACA_KEY    = process.env.ALPACA_API_KEY    || process.env.APCA_API_KEY_ID;
  const ALPACA_SECRET = process.env.ALPACA_API_SECRET || process.env.APCA_API_SECRET_KEY;

  if (!ALPACA_KEY || !ALPACA_SECRET) {
    return res.status(500).json({ error: 'Alpaca API keys not configured' });
  }

  // Paper trading base URL — swap to api.alpaca.markets for live
  const BASE_URL = process.env.ALPACA_BASE_URL || 'https://paper-api.alpaca.markets';

  try {
    const { symbol, qty, side, type, time_in_force, limit_price, stop_price } = req.body;

    // Validate required fields
    if (!symbol || !qty || !side || !type || !time_in_force) {
      return res.status(400).json({ error: 'Missing required fields: symbol, qty, side, type, time_in_force' });
    }

    if (!['buy', 'sell'].includes(side)) {
      return res.status(400).json({ error: 'Side must be "buy" or "sell"' });
    }

    if (!['market', 'limit', 'stop', 'stop_limit'].includes(type)) {
      return res.status(400).json({ error: 'Invalid order type' });
    }

    // Build order payload
    const order = {
      symbol: symbol.toUpperCase(),
      qty: String(qty),
      side,
      type,
      time_in_force,
    };

    if (limit_price) order.limit_price = String(limit_price);
    if (stop_price)  order.stop_price  = String(stop_price);

    const response = await fetch(`${BASE_URL}/v2/orders`, {
      method: 'POST',
      headers: {
        'APCA-API-KEY-ID':     ALPACA_KEY,
        'APCA-API-SECRET-KEY': ALPACA_SECRET,
        'Content-Type':        'application/json',
      },
      body: JSON.stringify(order),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.message || `Alpaca order error: ${response.status}`,
        detail: data,
      });
    }

    return res.status(200).json({
      id:          data.id,
      status:      data.status,
      symbol:      data.symbol,
      qty:         data.qty,
      filled_qty:  data.filled_qty,
      side:        data.side,
      type:        data.type,
      time_in_force: data.time_in_force,
      limit_price: data.limit_price,
      stop_price:  data.stop_price,
      created_at:  data.created_at,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
