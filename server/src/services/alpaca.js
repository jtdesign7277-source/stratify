import Alpaca from '@alpacahq/alpaca-trade-api';

const alpaca = new Alpaca({
  keyId: process.env.ALPACA_API_KEY,
  secretKey: process.env.ALPACA_SECRET_KEY,
  paper: true,
});

const SYMBOLS = ['NVDA', 'AAPL', 'TSLA', 'AMD', 'MSFT', 'META', 'GOOGL', 'AMZN'];

export async function getQuotes() {
  try {
    const quotes = await alpaca.getLatestQuotes(SYMBOLS);
    return SYMBOLS.map((symbol) => {
      const quote = quotes.get ? quotes.get(symbol) : quotes[symbol];
      return {
        symbol,
        askPrice: quote?.AskPrice || 0,
        bidPrice: quote?.BidPrice || 0,
        price: quote?.AskPrice || quote?.BidPrice || 0,
      };
    });
  } catch (error) {
    console.error('Error fetching quotes:', error.message);
    throw error;
  }
}

// Get snapshots with previous close for change calculation
export async function getSnapshots(symbols = SYMBOLS) {
  try {
    const snapshots = await alpaca.getSnapshots(symbols);
    
    // DEBUG: Log raw response structure
    console.log('📸 Raw snapshots type:', typeof snapshots, snapshots?.constructor?.name);
    console.log('📸 Raw snapshots keys:', Object.keys(snapshots || {}));
    
    return symbols.map((symbol, index) => {
      // Alpaca returns Array indexed by position, not by symbol name
      const snapshot = Array.isArray(snapshots) ? snapshots[index] : (snapshots.get ? snapshots.get(symbol) : snapshots[symbol]);
      
      // DEBUG: Log first symbol's snapshot structure
      if (index === 0) {
        console.log(`📸 Snapshot for ${symbol}:`, JSON.stringify(snapshot, null, 2));
      }
      
      if (!snapshot) {
        return { symbol, price: 0, prevClose: 0, change: 0, changePercent: 0 };
      }
      
      const latestTrade = snapshot.LatestTrade;
      const dailyBar = snapshot.DailyBar;
      const prevDailyBar = snapshot.PrevDailyBar;
      
      const currentPrice = latestTrade?.Price || dailyBar?.ClosePrice || 0;
      const prevClose = prevDailyBar?.ClosePrice || dailyBar?.OpenPrice || currentPrice;
      const change = currentPrice - prevClose;
      const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
      
      return {
        symbol,
        price: currentPrice,
        prevClose,
        change,
        changePercent,
        open: dailyBar?.OpenPrice || 0,
        high: dailyBar?.HighPrice || 0,
        low: dailyBar?.LowPrice || 0,
        volume: dailyBar?.Volume || 0,
      };
    });
  } catch (error) {
    console.error('Error fetching snapshots:', error.message);
    throw error;
  }
}

// Get single snapshot
export async function getSnapshot(symbol) {
  try {
    const snapshots = await getSnapshots([symbol.toUpperCase()]);
    return snapshots[0] || null;
  } catch (error) {
    console.error('Error fetching snapshot:', error.message);
    throw error;
  }
}

export async function getBars() {
  try {
    const response = await alpaca.getMultiBarsV2(SYMBOLS, {
      timeframe: '1Day',
      limit: 2,
    });

    const barsMap = new Map();
    for await (const bar of response) {
      const symbol = bar.Symbol;
      if (!barsMap.has(symbol)) {
        barsMap.set(symbol, []);
      }
      barsMap.get(symbol).push(bar);
    }

    return SYMBOLS.map((symbol) => {
      const symbolBars = barsMap.get(symbol) || [];
      const latest = symbolBars[symbolBars.length - 1];
      const previous = symbolBars[symbolBars.length - 2] || symbolBars[0];

      const currentPrice = latest?.ClosePrice || 0;
      const previousClose = previous?.ClosePrice || currentPrice;
      const change = previousClose ? ((currentPrice - previousClose) / previousClose) * 100 : 0;

      return {
        symbol,
        price: currentPrice,
        open: latest?.OpenPrice || 0,
        high: latest?.HighPrice || 0,
        low: latest?.LowPrice || 0,
        volume: latest?.Volume || 0,
        change: change.toFixed(2),
      };
    });
  } catch (error) {
    console.error('Error fetching bars:', error.message);
    throw error;
  }
}

export async function getAccount() {
  try {
    const account = await alpaca.getAccount();
    return {
      equity: parseFloat(account.equity) || 0,
      cash: parseFloat(account.cash) || 0,
      buying_power: parseFloat(account.buying_power) || 0,
      portfolio_value: parseFloat(account.portfolio_value) || 0,
      last_equity: parseFloat(account.last_equity) || 0,
      daily_pnl: (parseFloat(account.equity) - parseFloat(account.last_equity)) || 0,
      account_type: account.account_type || 'paper',
      status: account.status,
    };
  } catch (error) {
    console.error('Error fetching account:', error.message);
    throw error;
  }
}

export async function getPositions() {
  try {
    const positions = await alpaca.getPositions();
    return positions.map(pos => ({
      symbol: pos.symbol,
      qty: parseFloat(pos.qty) || 0,
      avg_entry_price: parseFloat(pos.avg_entry_price) || 0,
      current_price: parseFloat(pos.current_price) || 0,
      market_value: parseFloat(pos.market_value) || 0,
      cost_basis: parseFloat(pos.cost_basis) || 0,
      unrealized_pl: parseFloat(pos.unrealized_pl) || 0,
      unrealized_plpc: parseFloat(pos.unrealized_plpc) || 0,
      change_today: parseFloat(pos.change_today) || 0,
      side: pos.side,
    }));
  } catch (error) {
    console.error('Error fetching positions:', error.message);
    throw error;
  }
}

export function startAlpacaStream(onData) {
  console.log('📊 Alpaca polling mode enabled');

  setInterval(async () => {
    try {
      const quotes = await getQuotes();
      quotes.forEach((quote) => {
        onData({
          type: 'quote',
          symbol: quote.symbol,
          askPrice: quote.askPrice,
          bidPrice: quote.bidPrice,
          price: quote.price,
          timestamp: new Date().toISOString(),
        });
      });
    } catch (err) {
      console.error('Polling error:', err.message);
    }
  }, 5000);
}

// ==================== TRADE EXECUTION ====================

export async function submitOrder({ symbol, qty, side, type = 'market', limitPrice = null, stopPrice = null }) {
  try {
    const orderParams = {
      symbol: symbol.toUpperCase(),
      qty: Math.abs(qty),
      side: side.toLowerCase(),
      type: type.toLowerCase(),
      time_in_force: 'day',
    };

    if (type === 'limit' && limitPrice) {
      orderParams.limit_price = limitPrice;
    }
    if ((type === 'stop' || type === 'stop_limit') && stopPrice) {
      orderParams.stop_price = stopPrice;
    }

    console.log('📤 Submitting order:', orderParams);
    const order = await alpaca.createOrder(orderParams);
    
    return {
      success: true,
      orderId: order.id,
      clientOrderId: order.client_order_id,
      symbol: order.symbol,
      qty: order.qty,
      side: order.side,
      type: order.type,
      status: order.status,
      filledQty: order.filled_qty,
      filledAvgPrice: order.filled_avg_price,
      createdAt: order.created_at,
    };
  } catch (error) {
    console.error('Error submitting order:', error.message);
    return { success: false, error: error.message };
  }
}

export async function getOrder(orderId) {
  try {
    const order = await alpaca.getOrder(orderId);
    return {
      orderId: order.id,
      symbol: order.symbol,
      qty: order.qty,
      side: order.side,
      type: order.type,
      status: order.status,
      filledQty: order.filled_qty,
      filledAvgPrice: order.filled_avg_price,
      createdAt: order.created_at,
      filledAt: order.filled_at,
    };
  } catch (error) {
    console.error('Error getting order:', error.message);
    throw error;
  }
}

export async function cancelOrder(orderId) {
  try {
    await alpaca.cancelOrder(orderId);
    return { success: true, orderId };
  } catch (error) {
    console.error('Error canceling order:', error.message);
    return { success: false, error: error.message };
  }
}

export async function getOrders(status = 'open') {
  try {
    const orders = await alpaca.getOrders({ status });
    return orders.map(order => ({
      orderId: order.id,
      symbol: order.symbol,
      qty: order.qty,
      side: order.side,
      type: order.type,
      status: order.status,
      filledQty: order.filled_qty,
      filledAvgPrice: order.filled_avg_price,
      createdAt: order.created_at,
    }));
  } catch (error) {
    console.error('Error getting orders:', error.message);
    throw error;
  }
}

export async function closePosition(symbol) {
  try {
    const result = await alpaca.closePosition(symbol.toUpperCase());
    return { success: true, symbol, result };
  } catch (error) {
    console.error('Error closing position:', error.message);
    return { success: false, error: error.message };
  }
}

export async function getLatestPrice(symbol) {
  try {
    const quote = await alpaca.getLatestQuote(symbol.toUpperCase());
    return {
      symbol: symbol.toUpperCase(),
      askPrice: quote.AskPrice,
      bidPrice: quote.BidPrice,
      price: quote.AskPrice || quote.BidPrice,
    };
  } catch (error) {
    console.error('Error getting latest price:', error.message);
    throw error;
  }
}
