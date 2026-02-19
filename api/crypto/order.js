import Alpaca from '@alpacahq/alpaca-trade-api';

const alpaca = new Alpaca({
  keyId: process.env.ALPACA_API_KEY,
  secretKey: process.env.ALPACA_SECRET_KEY,
  paper: true, // paper trading
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
