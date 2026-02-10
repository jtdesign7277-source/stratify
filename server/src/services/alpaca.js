import Alpaca from '@alpacahq/alpaca-trade-api';

console.log('🔑 Alpaca init - Key ID:', process.env.ALPACA_API_KEY?.slice(0, 8) + '...');
console.log('🔑 Alpaca init - Paper mode: false (LIVE)');

const alpaca = new Alpaca({
  keyId: process.env.ALPACA_API_KEY,
  secretKey: process.env.ALPACA_SECRET_KEY,
  paper: false,
});

const SYMBOLS = ['NVDA', 'AAPL', 'TSLA', 'AMD', 'MSFT', 'META', 'GOOGL', 'AMZN'];
const EASTERN_TIMEZONE = 'America/New_York';
const PRE_MARKET_START_MINUTES = 4 * 60;
const PRE_MARKET_END_MINUTES = 9 * 60 + 30;
const AFTER_HOURS_START_MINUTES = 16 * 60;
const AFTER_HOURS_END_MINUTES = 20 * 60;

const getEasternMinutes = (timestamp) => {
  if (!timestamp) return null;
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIMEZONE,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
};

const getMarketSessionForTimestamp = (timestamp) => {
  if (!timestamp) return null;
  const minutes = getEasternMinutes(timestamp);
  if (minutes === null) return null;
  if (minutes >= PRE_MARKET_START_MINUTES && minutes < PRE_MARKET_END_MINUTES) return 'pre_market';
  if (minutes >= PRE_MARKET_END_MINUTES && minutes < AFTER_HOURS_START_MINUTES) return 'regular';
  if (minutes >= AFTER_HOURS_START_MINUTES && minutes < AFTER_HOURS_END_MINUTES) return 'post_market';
  return 'closed';
};

const getMarketSession = (timestamp = new Date()) => {
  return getMarketSessionForTimestamp(timestamp) || 'closed';
};

const getEasternDateKey = (timestamp) => {
  if (!timestamp) return null;
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-CA', { timeZone: EASTERN_TIMEZONE }); // YYYY-MM-DD
};

const getV2QuotePrice = (quote) => {
  const bid = quote?.bp;
  const ask = quote?.ap;
  if (Number.isFinite(bid) && Number.isFinite(ask) && bid > 0 && ask > 0) {
    return (bid + ask) / 2;
  }
  if (Number.isFinite(bid)) return bid;
  if (Number.isFinite(ask)) return ask;
  return null;
};

const buildExtendedHoursSnapshotData = ({ marketSession, latestTrade, latestQuote, previousClose }) => {
  const empty = {
    extendedHoursPrice: null,
    extendedHoursChangePercent: null,
    preMarketPrice: null,
    preMarketChange: null,
    preMarketChangePercent: null,
    afterHoursPrice: null,
    afterHoursChange: null,
    afterHoursChangePercent: null,
  };

  if (marketSession !== 'pre_market' && marketSession !== 'post_market') return empty;

  const todayKey = getEasternDateKey(new Date());
  const tradeSession = getMarketSessionForTimestamp(latestTrade?.t);
  const tradeDate = getEasternDateKey(latestTrade?.t);
  const quoteSession = getMarketSessionForTimestamp(latestQuote?.t);
  const quoteDate = getEasternDateKey(latestQuote?.t);
  const tradePrice = Number.isFinite(latestTrade?.p) ? latestTrade.p : null;
  const quotePrice = getV2QuotePrice(latestQuote);

  let price = null;
  if (tradePrice !== null && tradeSession === marketSession && tradeDate === todayKey) {
    price = tradePrice;
  } else if (quotePrice !== null && quoteSession === marketSession && quoteDate === todayKey) {
    price = quotePrice;
  }

  if (!Number.isFinite(price)) return empty;

  const change = previousClose > 0 ? price - previousClose : 0;
  const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

  if (marketSession === 'pre_market') {
    return {
      extendedHoursPrice: price,
      extendedHoursChangePercent: changePercent,
      preMarketPrice: price,
      preMarketChange: change,
      preMarketChangePercent: changePercent,
      afterHoursPrice: null,
      afterHoursChange: null,
      afterHoursChangePercent: null,
    };
  }

  if (marketSession === 'post_market') {
    return {
      extendedHoursPrice: price,
      extendedHoursChangePercent: changePercent,
      preMarketPrice: null,
      preMarketChange: null,
      preMarketChangePercent: null,
      afterHoursPrice: price,
      afterHoursChange: change,
      afterHoursChangePercent: changePercent,
    };
  }

  return empty;
};

const buildEmptySnapshot = (symbol, marketSession) => ({
  symbol,
  latestPrice: 0,
  previousClose: 0,
  change: 0,
  changePercent: 0,
  extendedHoursPrice: null,
  extendedHoursChangePercent: null,
  marketSession,
  price: 0,
  prevClose: 0,
  preMarketPrice: null,
  preMarketChange: null,
  preMarketChangePercent: null,
  afterHoursPrice: null,
  afterHoursChange: null,
  afterHoursChangePercent: null,
  open: 0,
  high: 0,
  low: 0,
  volume: 0,
});

const normalizeSnapshot = ({ symbol, snapshot }) => {
  const marketSession = getMarketSession();
  if (!snapshot) return buildEmptySnapshot(symbol, marketSession);

  const latestTrade = snapshot.latestTrade;
  const latestQuote = snapshot.latestQuote;
  const dailyBar = snapshot.dailyBar;
  const prevDailyBar = snapshot.prevDailyBar;

  const tradePrice = Number.isFinite(latestTrade?.p) ? latestTrade.p : null;
  const quotePrice = getV2QuotePrice(latestQuote);
  const fallbackPrice = Number.isFinite(dailyBar?.c)
    ? dailyBar.c
    : Number.isFinite(dailyBar?.o)
      ? dailyBar.o
      : Number.isFinite(prevDailyBar?.c)
        ? prevDailyBar.c
        : 0;
  const latestPrice = Number.isFinite(tradePrice)
    ? tradePrice
    : Number.isFinite(quotePrice)
      ? quotePrice
      : fallbackPrice;
  const previousClose = Number.isFinite(prevDailyBar?.c)
    ? prevDailyBar.c
    : Number.isFinite(dailyBar?.o)
      ? dailyBar.o
      : latestPrice;
  const change = latestPrice - previousClose;
  const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

  const extendedHours = buildExtendedHoursSnapshotData({
    marketSession,
    latestTrade,
    latestQuote,
    previousClose,
  });

  return {
    symbol,
    latestPrice,
    previousClose,
    change,
    changePercent,
    extendedHoursPrice: extendedHours.extendedHoursPrice,
    extendedHoursChangePercent: extendedHours.extendedHoursChangePercent,
    marketSession,
    price: latestPrice,
    prevClose: previousClose,
    preMarketPrice: extendedHours.preMarketPrice,
    preMarketChange: extendedHours.preMarketChange,
    preMarketChangePercent: extendedHours.preMarketChangePercent,
    afterHoursPrice: extendedHours.afterHoursPrice,
    afterHoursChange: extendedHours.afterHoursChange,
    afterHoursChangePercent: extendedHours.afterHoursChangePercent,
    open: dailyBar?.o || 0,
    high: dailyBar?.h || 0,
    low: dailyBar?.l || 0,
    volume: dailyBar?.v || 0,
  };
};

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
    const snapshots = await Promise.all(symbols.map((symbol) => getSnapshot(symbol)));
    return snapshots;
  } catch (error) {
    console.error('Error fetching snapshots:', error.message);
    throw error;
  }
}

// Get single snapshot
export async function getSnapshot(symbol) {
  try {
    // Use direct API call instead of SDK to avoid 401 issues
    const sym = symbol.toUpperCase();
    const response = await fetch(`https://data.alpaca.markets/v2/stocks/${sym}/snapshot`, {
      headers: {
        'APCA-API-KEY-ID': process.env.ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY,
      },
    });
    
    if (!response.ok) {
      console.error('Alpaca snapshot error:', response.status, await response.text());
      throw new Error(`Alpaca API error: ${response.status}`);
    }
    
    const data = await response.json();
    return normalizeSnapshot({ symbol: sym, snapshot: data });
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
    const sym = symbol.toUpperCase();
    const response = await fetch(`https://data.alpaca.markets/v2/stocks/${sym}/quotes/latest`, {
      headers: {
        'APCA-API-KEY-ID': process.env.ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY,
      },
    });
    
    if (!response.ok) {
      console.error('Alpaca quote error:', response.status);
      throw new Error(`Alpaca API error: ${response.status}`);
    }
    
    const data = await response.json();
    const quote = data.quote;
    return {
      symbol: sym,
      askPrice: quote?.ap,
      bidPrice: quote?.bp,
      price: quote?.ap || quote?.bp,
    };
  } catch (error) {
    console.error('Error getting latest price:', error.message);
    throw error;
  }
}
