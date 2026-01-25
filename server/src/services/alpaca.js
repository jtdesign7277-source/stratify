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