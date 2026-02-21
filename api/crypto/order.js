import { createClient } from '@supabase/supabase-js';
import Alpaca from '@alpacahq/alpaca-trade-api';

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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getUserFromToken(req);
  if (!user) {
    return res.status(401).json({ 
      success: false, 
      error: 'No broker connected. Please connect your Alpaca paper account in Portfolio.' 
    });
  }

  // Fetch user's broker connection
  const { data: conn, error: connError } = await supabase
    .from('broker_connections')
    .select('*')
    .eq('user_id', user.id)
    .eq('broker', 'alpaca')
    .maybeSingle();

  if (connError) {
    return res.status(500).json({ success: false, error: connError.message });
  }

  if (!conn) {
    return res.status(401).json({ 
      success: false, 
      error: 'No Alpaca broker connected. Please connect your Alpaca paper account in Portfolio.' 
    });
  }

  // Initialize Alpaca with USER'S keys
  const alpaca = new Alpaca({
    keyId: conn.api_key,
    secretKey: conn.api_secret,
    paper: conn.is_paper !== false, // default to paper if not specified
  });

  try {
    const { symbol, side, orderType, quantity, notionalAmount, limitPrice, stopPrice, timeInForce } = req.body;
    const normalizedTimeInForce = String(timeInForce || 'gtc').toLowerCase() === 'day'
      ? 'gtc'
      : String(timeInForce || 'gtc').toLowerCase();

    const orderParams = {
      symbol: symbol.replace('/', ''), // BTC/USD → BTCUSD
      side,
      type: orderType === 'stop_limit' ? 'stop_limit' : orderType,
      time_in_force: normalizedTimeInForce,
    };

    const parsedQuantity = Number(quantity);
    const parsedNotional = Number(notionalAmount);
    if (Number.isFinite(parsedQuantity) && parsedQuantity > 0) {
      orderParams.qty = parsedQuantity;
    } else if (orderType === 'market' && Number.isFinite(parsedNotional) && parsedNotional > 0) {
      orderParams.notional = parsedNotional;
    } else {
      throw new Error('Order quantity is required');
    }

    if (orderType === 'limit' || orderType === 'stop_limit') {
      orderParams.limit_price = limitPrice;
    }
    if (orderType === 'stop_limit') {
      orderParams.stop_price = stopPrice;
    }

    const order = await alpaca.createOrder(orderParams);

    return res.status(200).json({
      success: true,
      order_id: order.id,
      status: order.status,
      filled_avg_price: order.filled_avg_price,
    });
  } catch (error) {
    console.error('Order error:', error);
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }
}
