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
      const quote = quotes.get(symbol);
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