import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import YahooFinance from 'yahoo-finance2';
import OpenAI from 'openai';
import stocksRouter from './routes/stocks.js';
import chatRouter from './routes/chat.js';
import kalshiRouter from './routes/kalshi.js';
import { startAlpacaStream, submitOrder, getOrder, cancelOrder, getOrders, closePosition, getLatestPrice } from './services/alpaca.js';

dotenv.config();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Yahoo Finance
const yahooFinance = new YahooFinance();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/stocks', stocksRouter);
app.use('/api/v1/kalshi', kalshiRouter);
app.use('/api/claude', chatRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Atlas AI Chat Endpoint - Powered by Grok xAI with Trade Execution
app.post('/api/v1/chat/', async (req, res) => {
  try {
    const { message, strategy_name } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Call Grok xAI API
    const grokResponse = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-beta',
        messages: [
          {
            role: 'system',
            content: `You are Atlas, an AI trading assistant for Stratify. You can:
1. Generate Python trading strategies when asked
2. Execute trades when users say things like "buy 10 shares of AAPL" or "sell TSLA"
3. Answer questions about trading and markets

For trade requests, respond with a trade block like:
\`\`\`trade
{"action":"buy","symbol":"AAPL","qty":10,"type":"market"}
\`\`\`

For strategy requests, respond with Python code in \`\`\`python blocks.
For general questions, just respond conversationally.`
          },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!grokResponse.ok) {
      const err = await grokResponse.text();
      console.error('Grok API error:', err);
      throw new Error('Grok API request failed');
    }

    const grokData = await grokResponse.json();
    const aiResponse = grokData.choices[0].message.content;

    // Check for trade intent
    const tradeMatch = aiResponse.match(/```trade\n([\s\S]*?)```/);
    let tradeResult = null;

    if (tradeMatch) {
      try {
        const tradeIntent = JSON.parse(tradeMatch[1].trim());
        const { action, symbol, qty, type = 'market', limitPrice, stopPrice } = tradeIntent;

        if (action && symbol && qty) {
          const orderResult = await submitOrder({
            symbol: symbol.toUpperCase(),
            qty: parseInt(qty),
            side: action.toLowerCase(),
            type: type.toLowerCase(),
            limitPrice,
            stopPrice,
          });
          tradeResult = { executed: true, intent: tradeIntent, order: orderResult };
        }
      } catch (parseErr) {
        console.error('Trade parse error:', parseErr);
        tradeResult = { executed: false, error: parseErr.message };
      }
    }

    // Extract code if present
    const codeMatch = aiResponse.match(/```python\n([\s\S]*?)```/) ||
                      aiResponse.match(/```\n([\s\S]*?)```/);
    const code = codeMatch ? codeMatch[1].trim() : null;

    // Clean response (remove trade blocks from visible response)
    let cleanResponse = aiResponse.replace(/```trade\n[\s\S]*?```/g, '').trim();
    
    if (tradeResult?.executed) {
      cleanResponse += `\n\n✅ Trade executed: ${tradeResult.intent.action.toUpperCase()} ${tradeResult.intent.qty} ${tradeResult.intent.symbol}`;
    } else if (tradeResult?.error) {
      cleanResponse += `\n\n❌ Trade failed: ${tradeResult.error}`;
    }

    res.json({
      response: cleanResponse,
      code,
      strategy_name: strategy_name || null,
      trade: tradeResult,
      model: 'grok-beta',
    });

  } catch (error) {
    console.error('Atlas AI error:', error);
    res.status(500).json({ error: 'Failed to process request', details: error.message });
  }
});

// Grok AI Chat Endpoint
app.post('/api/atlas/chat', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const GROK_API_KEY = process.env.GROK_API_KEY;
    if (!GROK_API_KEY) return res.status(500).json({ error: 'Grok API key not configured' });

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'grok-3',
        messages: [
          { role: 'system', content: 'You are Grok, a trading strategy AI for Stratify. Be concise. When generating code, use Alpaca API for data and backtesting (alpaca-trade-api package), NOT yfinance. Provide only working Python code with minimal comments. No lengthy explanations.' },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) return res.status(response.status).json({ error: 'Grok API error' });

    const data = await response.json();
    res.json({ response: data.choices?.[0]?.message?.content || 'No response' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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

// ============ PORTFOLIO HISTORY ============
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORTFOLIO_FILE = path.join(__dirname, '../data/portfolio_history.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Load portfolio history
const loadPortfolioHistory = () => {
  try {
    if (fs.existsSync(PORTFOLIO_FILE)) {
      return JSON.parse(fs.readFileSync(PORTFOLIO_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading portfolio history:', e);
  }
  return [];
};

// Save portfolio history
const savePortfolioHistory = (history) => {
  fs.writeFileSync(PORTFOLIO_FILE, JSON.stringify(history, null, 2));
};

// POST /api/portfolio/snapshot - Save daily snapshot
app.post('/api/portfolio/snapshot', (req, res) => {
  try {
    const { totalValue, dailyPnL, accounts } = req.body;
    
    if (totalValue === undefined) {
      return res.status(400).json({ error: 'totalValue is required' });
    }

    const today = new Date().toISOString().split('T')[0];
    const history = loadPortfolioHistory();
    
    // Check if we already have a snapshot for today
    const existingIndex = history.findIndex(h => h.date === today);
    
    const snapshot = {
      date: today,
      timestamp: new Date().toISOString(),
      totalValue: parseFloat(totalValue),
      dailyPnL: parseFloat(dailyPnL) || 0,
      accounts: accounts || [],
    };

    if (existingIndex >= 0) {
      // Update existing snapshot
      history[existingIndex] = snapshot;
    } else {
      // Add new snapshot
      history.push(snapshot);
    }

    // Sort by date
    history.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    savePortfolioHistory(history);
    
    res.json({ success: true, snapshot });
  } catch (error) {
    console.error('Error saving portfolio snapshot:', error);
    res.status(500).json({ error: 'Failed to save snapshot' });
  }
});

// GET /api/portfolio/history - Get historical data
app.get('/api/portfolio/history', (req, res) => {
  try {
    const { days = 365 } = req.query;
    const history = loadPortfolioHistory();
    
    // Filter to requested days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - parseInt(days));
    
    const filtered = history.filter(h => new Date(h.date) >= cutoff);
    
    // Calculate stats
    const latestValue = filtered.length > 0 ? filtered[filtered.length - 1].totalValue : 0;
    const firstValue = filtered.length > 0 ? filtered[0].totalValue : 0;
    const totalChange = latestValue - firstValue;
    const totalChangePercent = firstValue > 0 ? (totalChange / firstValue) * 100 : 0;

    res.json({
      history: filtered,
      stats: {
        latestValue,
        firstValue,
        totalChange,
        totalChangePercent,
        dataPoints: filtered.length,
      }
    });
  } catch (error) {
    console.error('Error fetching portfolio history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// DELETE /api/portfolio/history - Clear history (for testing)
app.delete('/api/portfolio/history', (req, res) => {
  try {
    savePortfolioHistory([]);
    res.json({ success: true, message: 'History cleared' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear history' });
  }
});

// ==================== TRADE EXECUTION ENDPOINTS ====================

// Execute a trade
app.post('/api/trades/execute', async (req, res) => {
  try {
    const { symbol, qty, side, type = 'market', limitPrice, stopPrice } = req.body;
    
    if (!symbol || !qty || !side) {
      return res.status(400).json({ error: 'symbol, qty, and side are required' });
    }
    
    // Get current price for confirmation
    const priceData = await getLatestPrice(symbol);
    const result = await submitOrder({ symbol, qty, side, type, limitPrice, stopPrice });
    
    res.json({
      ...result,
      estimatedPrice: priceData.price,
    });
  } catch (error) {
    console.error('Trade execution error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get order status
app.get('/api/trades/order/:orderId', async (req, res) => {
  try {
    const order = await getOrder(req.params.orderId);
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel order
app.delete('/api/trades/order/:orderId', async (req, res) => {
  try {
    const result = await cancelOrder(req.params.orderId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all orders
app.get('/api/trades/orders', async (req, res) => {
  try {
    const { status = 'all' } = req.query;
    const orders = await getOrders(status);
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Close position
app.post('/api/trades/close/:symbol', async (req, res) => {
  try {
    const result = await closePosition(req.params.symbol);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get price quote
app.get('/api/trades/quote/:symbol', async (req, res) => {
  try {
    const price = await getLatestPrice(req.params.symbol);
    res.json(price);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
