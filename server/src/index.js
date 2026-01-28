import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import YahooFinance from 'yahoo-finance2';
import stocksRouter from './routes/stocks.js';
import { startAlpacaStream } from './services/alpaca.js';

dotenv.config();

// Initialize Yahoo Finance
const yahooFinance = new YahooFinance();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/stocks', stocksRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const server = app.listen(PORT, () => {
  console.log(`🚀 Stratify API running on http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket');
  ws.on('close', () => console.log('Client disconnected'));
});

startAlpacaStream((data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(data));
    }
  });
});

// Yahoo Finance API endpoints (Google Finance style data)
app.get('/api/public/quote/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const sym = symbol.toUpperCase();
    
    const quote = await yahooFinance.quote(sym);
    
    res.json({ 
      symbol: sym,
      name: quote.shortName || quote.longName || sym,
      price: quote.regularMarketPrice || 0,
      change: quote.regularMarketChange || 0,
      changePercent: quote.regularMarketChangePercent || 0,
      prevClose: quote.regularMarketPreviousClose || 0,
      open: quote.regularMarketOpen || 0,
      dayHigh: quote.regularMarketDayHigh || 0,
      dayLow: quote.regularMarketDayLow || 0,
      volume: quote.regularMarketVolume || 0,
      avgVolume: quote.averageDailyVolume3Month || 0,
      marketCap: quote.marketCap || 0,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh || 0,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow || 0,
      exchange: quote.exchange || '',
      currency: quote.currency || 'USD',
      marketState: quote.marketState || 'CLOSED',
      // Pre/Post market data
      preMarketPrice: quote.preMarketPrice,
      preMarketChange: quote.preMarketChange,
      preMarketChangePercent: quote.preMarketChangePercent,
      postMarketPrice: quote.postMarketPrice,
      postMarketChange: quote.postMarketChange,
      postMarketChangePercent: quote.postMarketChangePercent,
    });
  } catch (error) {
    console.error('Yahoo Finance error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get historical data for charts
app.get('/api/public/history/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { period = '1d', interval = '5m' } = req.query;
    const sym = symbol.toUpperCase();
    
    const result = await yahooFinance.chart(sym, {
      period1: getPeriodStart(period),
      interval: interval,
    });
    
    const data = result.quotes.map(q => ({
      time: q.date,
      open: q.open,
      high: q.high,
      low: q.low,
      close: q.close,
      volume: q.volume,
    }));
    
    res.json({
      symbol: sym,
      period,
      interval,
      data,
    });
  } catch (error) {
    console.error('Yahoo Finance history error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Helper function for period calculation
function getPeriodStart(period) {
  const now = new Date();
  switch(period) {
    case '1d': return new Date(now.setDate(now.getDate() - 1));
    case '5d': return new Date(now.setDate(now.getDate() - 5));
    case '1mo': return new Date(now.setMonth(now.getMonth() - 1));
    case '3mo': return new Date(now.setMonth(now.getMonth() - 3));
    case '6mo': return new Date(now.setMonth(now.getMonth() - 6));
    case '1y': return new Date(now.setFullYear(now.getFullYear() - 1));
    case '5y': return new Date(now.setFullYear(now.getFullYear() - 5));
    default: return new Date(now.setDate(now.getDate() - 1));
  }
}

// Search using Yahoo Finance
app.get('/api/public/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 1) {
      return res.json([]);
    }
    
    const results = await yahooFinance.search(q);
    
    const stocks = (results.quotes || [])
      .filter(r => r.quoteType === 'EQUITY' || r.quoteType === 'ETF')
      .slice(0, 15)
      .map(r => ({
        symbol: r.symbol,
        name: r.shortname || r.longname || r.symbol,
        exchange: r.exchange,
        type: r.quoteType,
      }));
    
    res.json(stocks);
  } catch (error) {
    console.error('Yahoo Finance search error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Trending/popular stocks
app.get('/api/public/trending', async (req, res) => {
  try {
    const trending = await yahooFinance.trendingSymbols('US');
    const symbols = trending.quotes.slice(0, 10).map(q => q.symbol);
    
    const quotes = await Promise.all(
      symbols.map(async (sym) => {
        try {
          const quote = await yahooFinance.quote(sym);
          return {
            symbol: sym,
            name: quote.shortName || sym,
            price: quote.regularMarketPrice,
            changePercent: quote.regularMarketChangePercent,
          };
        } catch {
          return null;
        }
      })
    );
    
    res.json(quotes.filter(q => q !== null));
  } catch (error) {
    console.error('Yahoo Finance trending error:', error.message);
    res.status(500).json({ error: error.message });
  }
});
