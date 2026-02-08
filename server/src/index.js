import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import YahooFinance from 'yahoo-finance2';
import OpenAI from 'openai';
import stocksRouter from './routes/stocks.js';
import chatRouter from './routes/chat.js';
import kalshiRouter from './routes/kalshi.js';
import strategiesRouter from './routes/strategies.js';
import trendsRouter, { setYahooFinance } from './routes/trends.js';
import { startAlpacaStream, submitOrder, getOrder, cancelOrder, getOrders, closePosition, getLatestPrice } from './services/alpaca.js';

dotenv.config();

// Initialize OpenAI (optional)
let openai = null;
if (process.env.OPENAI_API_KEY) {
  try {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  } catch (error) {
    console.warn('OpenAI initialization failed; continuing without it.', error.message);
    openai = null;
  }
} else {
  console.warn('OPENAI_API_KEY not set; OpenAI features disabled.');
}

// Initialize Yahoo Finance
const yahooFinance = new YahooFinance();
setYahooFinance(yahooFinance);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/stocks', stocksRouter);
app.use('/api/v1/kalshi', kalshiRouter);
app.use('/api/kalshi', kalshiRouter);
app.use('/api/claude', chatRouter);
app.use('/api/strategies', strategiesRouter);
app.use('/api/trends', trendsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const buildFallbackSocialFeed = (symbols = []) => {
  const list = Array.isArray(symbols) && symbols.length > 0 ? symbols : ['NVDA', 'TSLA', 'AAPL'];
  const now = Date.now();
  const minutesAgo = (mins) => new Date(now - mins * 60 * 1000).toISOString();
  return [
    {
      handle: 'flowtrader',
      displayName: 'Flow Trader',
      content: `Seeing chunky prints on $${list[0]} into the close. Dark pool activity heating up. 👀`,
      timestamp: minutesAgo(6),
      sentiment: 'bullish',
      ticker: list[0],
    },
    {
      handle: 'gammaqueen',
      displayName: 'Gamma Queen',
      content: `$${list[1]} IV bid again. Dealers hedging hard. Could squeeze if this holds. 🚀`,
      timestamp: minutesAgo(18),
      sentiment: 'bullish',
      ticker: list[1],
    },
    {
      handle: 'trendtactician',
      displayName: 'Trend Tactician',
      content: `Chop city on $${list[2]}. Waiting for break of VWAP before pressing. 🧠`,
      timestamp: minutesAgo(34),
      sentiment: 'neutral',
      ticker: list[2],
    },
    {
      handle: 'tapehunter',
      displayName: 'Tape Hunter',
      content: `$${list[0]} rejecting yesterday's high. Watch for a flush if buyers step away. ⚠️`,
      timestamp: minutesAgo(52),
      sentiment: 'bearish',
      ticker: list[0],
    },
    {
      handle: 'macroace',
      displayName: 'Macro Ace',
      content: `Risk on rotation showing in $${list[1]} + $${list[2]}. Keeping size light ahead of data. 📊`,
      timestamp: minutesAgo(75),
      sentiment: 'neutral',
      ticker: list[1],
    },
  ];
};

const normalizeGrokFeed = (items = [], symbols = []) => {
  const fallbackTicker = symbols.find(Boolean) || 'SPY';
  return items
    .filter(Boolean)
    .map((item, index) => ({
      handle: item.handle || item.authorHandle || item.author || item.user || `trader${index + 1}`,
      displayName: item.displayName || item.authorDisplayName || item.name || item.handle || `Trader ${index + 1}`,
      content: String(item.content || item.text || item.body || '').trim(),
      timestamp: item.timestamp || item.time || new Date().toISOString(),
      sentiment: (item.sentiment || item.bias || 'neutral').toLowerCase(),
      ticker: item.ticker || item.symbol || item.mentionedTicker || fallbackTicker,
    }))
    .filter((item) => item.content);
};

const extractJsonArray = (raw = '') => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }
};

const normalizeMarketauxArticles = (items = []) => {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => {
      const rawSymbols = Array.isArray(item.symbols)
        ? item.symbols
        : typeof item.symbols === 'string'
          ? item.symbols.split(',')
          : [];
      const symbols = rawSymbols
        .map((symbol) => (typeof symbol === 'string' ? symbol : symbol?.symbol))
        .map((symbol) => String(symbol || '').trim().toUpperCase())
        .filter(Boolean);

      return {
        title: item.title || '',
        description: item.description || item.snippet || '',
        source: item.source?.name || item.source || item.publisher || '',
        published_at: item.published_at || item.publishedAt || item.published || '',
        url: item.url || item.link || '',
        symbols,
      };
    })
    .filter((article) => article.title || article.description);
};

app.post('/api/social/feed', async (req, res) => {
  const symbols = Array.isArray(req.body?.symbols)
    ? req.body.symbols.map((symbol) => String(symbol || '').trim().toUpperCase()).filter(Boolean)
    : [];
  const fallback = buildFallbackSocialFeed(symbols);
  const querySymbols = symbols.length > 0 ? symbols : ['NVDA', 'TSLA', 'AAPL'];

  try {
    const marketauxToken = process.env.MARKETAUX_API_TOKEN;
    if (!marketauxToken) {
      console.warn('MARKETAUX_API_TOKEN not set; returning fallback social feed.');
      return res.json(fallback);
    }

    let articles = [];
    try {
      const marketauxUrl = new URL('https://api.marketaux.com/v1/news/all');
      marketauxUrl.search = new URLSearchParams({
        symbols: querySymbols.join(','),
        filter_entities: 'true',
        language: 'en',
        limit: '10',
        api_token: marketauxToken,
      }).toString();

      const marketauxResponse = await fetch(marketauxUrl.toString());
      if (!marketauxResponse.ok) {
        const err = await marketauxResponse.text();
        console.error('Marketaux error:', err);
        return res.json(fallback);
      }

      const marketauxData = await marketauxResponse.json();
      articles = normalizeMarketauxArticles(marketauxData?.data);
      if (articles.length === 0) {
        console.warn('Marketaux returned no articles; returning fallback social feed.');
        return res.json(fallback);
      }
    } catch (error) {
      console.error('Marketaux fetch error:', error);
      return res.json(fallback);
    }

    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      console.warn('XAI_API_KEY not set; returning fallback social feed.');
      return res.json(fallback);
    }

    const requestBody = {
      model: 'grok-3',
      messages: [
        {
          role: 'system',
          content:
            'Use only the provided articles. Do not invent facts. If there are too few articles, return fewer posts. You are a financial social media feed generator. Using the articles, generate realistic tweet-style posts. Each post must include: handle, displayName, content (<=280 chars), timestamp (ISO string, within last 2 hours if possible), sentiment (bullish/bearish/neutral), ticker. Make them feel like real trader posts with cashtags, emojis, and trader slang. Return ONLY a JSON array.',
        },
        {
          role: 'user',
          content: `Articles:\n${JSON.stringify(articles, null, 2)}`,
        },
      ],
      temperature: 0.6,
      max_tokens: 800,
    };

    const grokResponse = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!grokResponse.ok) {
      const err = await grokResponse.text();
      console.error('Grok social feed error:', err);
      return res.json(fallback);
    }

    const grokData = await grokResponse.json();
    const rawContent = grokData.choices?.[0]?.message?.content?.trim() || '';
    const parsed = extractJsonArray(rawContent);
    if (!Array.isArray(parsed)) {
      console.warn('Grok social feed response invalid; returning fallback.');
      return res.json(fallback);
    }

    const normalized = normalizeGrokFeed(parsed, querySymbols);
    return res.json(normalized.length > 0 ? normalized : fallback);
  } catch (error) {
    console.error('Social feed error:', error);
    return res.json(fallback);
  }
});

// Grok AI Chat Endpoint - Powered by Grok xAI with Trade Execution
app.post('/api/v1/chat/', async (req, res) => {
  try {
    const { message, strategy_name, stream } = req.body;
    const shouldStream = stream === true;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Call Grok xAI API
    const requestBody = {
      model: 'grok-3',
      messages: [
        {
          role: 'system',
          content: `You are Grok, an AI trading assistant for Stratify. You can:
1. Generate Python trading strategies when asked
2. Execute trades when users say things like "buy 10 shares of AAPL" or "sell TSLA"
3. Answer questions about trading and markets

For trade requests, respond with a trade block like:
\`\`\`trade
{"action":"buy","symbol":"AAPL","qty":10,"type":"market"}
\`\`\`

For strategy requests, respond with Python code in \`\`\`python blocks.
For general questions, just respond conversationally.
Be extremely concise. Maximum 2-3 sentences per response unless asked for more detail.`
        },
        { role: 'user', content: message }
      ],
      temperature: 0.7,
      max_tokens: 500,
    };

    if (shouldStream) {
      requestBody.stream = true;
    }

    const grokResponse = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!grokResponse.ok) {
      const err = await grokResponse.text();
      console.error('Grok API error:', err);
      throw new Error('Grok API request failed');
    }

    if (shouldStream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      if (res.flushHeaders) res.flushHeaders();

      if (!grokResponse.body) {
        res.end();
        return;
      }

      const reader = grokResponse.body.getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) res.write(Buffer.from(value));
      }
      res.end();
      return;
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
      model: 'grok-3',
    });

  } catch (error) {
    console.error('Grok AI error:', error);
    res.status(500).json({ error: 'Failed to process request', details: error.message });
  }
});

// Grok AI Chat Endpoint
app.post('/api/atlas/chat', async (req, res) => {
  try {
    const { message, stream } = req.body;
    const shouldStream = stream === true;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const GROK_API_KEY = process.env.GROK_API_KEY;
    if (!GROK_API_KEY) return res.status(500).json({ error: 'Grok API key not configured' });

    const requestBody = {
      model: 'grok-3',
      messages: [
        { role: 'system', content: 'You are Grok, a trading strategy AI for Stratify. Be concise. When generating code, use Alpaca API for data and backtesting (alpaca-trade-api package), NOT yfinance. Provide only working Python code with minimal comments. No lengthy explanations. Be extremely concise. Maximum 2-3 sentences per response unless asked for more detail.' },
        { role: 'user', content: message }
      ],
      temperature: 0.7,
      max_tokens: 500,
    };

    if (shouldStream) {
      requestBody.stream = true;
    }

    const grokResponse = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROK_API_KEY}`
      },
      body: JSON.stringify(requestBody),
    });

    if (!grokResponse.ok) return res.status(grokResponse.status).json({ error: 'Grok API error' });

    if (shouldStream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      if (res.flushHeaders) res.flushHeaders();

      if (!grokResponse.body) {
        res.end();
        return;
      }

      const reader = grokResponse.body.getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) res.write(Buffer.from(value));
      }
      res.end();
      return;
    }

    const data = await grokResponse.json();
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

// Get snapshot with change data
app.get('/api/snapshot/:symbol', async (req, res) => {
  try {
    const { getSnapshot } = await import('./services/alpaca.js');
    const data = await getSnapshot(req.params.symbol);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ BACKTESTING API ============

// AI-Powered Backtest - Grok generates the strategy code
app.post('/api/backtest/ai', async (req, res) => {
  try {
    const { 
      ticker, 
      strategy, // { entry, exit, stopLoss, positionSize }
      period = '6mo',
      timeframe = '1Day'
    } = req.body;

    if (!ticker) {
      return res.status(400).json({ error: 'Ticker is required' });
    }

    const symbol = ticker.toUpperCase().replace('$', '');
    
    // Calculate start date
    const now = new Date();
    let startDate;
    switch(period) {
      case '1mo': startDate = new Date(now.setMonth(now.getMonth() - 1)); break;
      case '3mo': startDate = new Date(now.setMonth(now.getMonth() - 3)); break;
      case '6mo': startDate = new Date(now.setMonth(now.getMonth() - 6)); break;
      case '1y': startDate = new Date(now.setFullYear(now.getFullYear() - 1)); break;
      default: startDate = new Date(now.setMonth(now.getMonth() - 6));
    }

    // Fetch historical data from Alpaca
    const Alpaca = (await import('@alpacahq/alpaca-trade-api')).default;
    const alpaca = new Alpaca({
      keyId: process.env.ALPACA_API_KEY,
      secretKey: process.env.ALPACA_SECRET_KEY,
      paper: true,
    });

    const barsIterator = alpaca.getBarsV2(symbol, {
      start: startDate.toISOString(),
      end: new Date().toISOString(),
      timeframe: timeframe,
      limit: 10000,
      feed: 'iex',
    });

    const bars = [];
    for await (const bar of barsIterator) {
      bars.push({
        time: bar.Timestamp,
        open: bar.OpenPrice,
        high: bar.HighPrice,
        low: bar.LowPrice,
        close: bar.ClosePrice,
        volume: bar.Volume,
      });
    }

    if (bars.length < 20) {
      return res.status(400).json({ error: 'Insufficient historical data' });
    }

    // Ask Grok to generate backtest logic
    const strategyPrompt = `
You are a Python trading algorithm expert. Generate a backtest function for this strategy:

TICKER: ${symbol}
ENTRY CONDITION: ${strategy?.entry || 'Buy when RSI drops below 30'}
EXIT CONDITION: ${strategy?.exit || 'Sell when RSI rises above 70'}
STOP LOSS: ${strategy?.stopLoss || '5%'}
POSITION SIZE: ${strategy?.positionSize || '100 shares'}

The function receives 'bars' (list of dicts with keys: time, open, high, low, close, volume).
Starting cash is $100,000.

Return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "trades": [{"entryTime": "ISO", "exitTime": "ISO", "entryPrice": 0, "exitPrice": 0, "shares": 0, "pnl": 0, "pnlPercent": 0, "exitReason": ""}],
  "summary": {"totalTrades": 0, "winningTrades": 0, "losingTrades": 0, "winRate": "0.0", "totalPnL": "0.00", "avgWin": "0.00", "avgLoss": "0.00", "finalCash": "100000.00", "returnPercent": "0.00"}
}

Calculate actual trades based on the entry/exit conditions using real indicator math (RSI, SMA, MACD, etc).
Parse position size from the text. Apply stop loss logic.
`;

    // Call Grok API
    const grokResponse = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-3',
        messages: [
          { role: 'system', content: 'You are a quantitative trading expert. Output ONLY valid JSON, no markdown or explanations.' },
          { role: 'user', content: strategyPrompt + '\n\nHere is the price data:\n' + JSON.stringify(bars.slice(0, 50)) + '\n...(total ' + bars.length + ' bars)' }
        ],
        temperature: 0.1,
      }),
    });

    const grokData = await grokResponse.json();
    let aiResult;
    
    try {
      const content = grokData.choices?.[0]?.message?.content || '{}';
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      aiResult = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (parseErr) {
      console.error('Failed to parse Grok response:', grokData);
      // Fall back to basic calculation
      aiResult = { trades: [], summary: { totalTrades: 0, winRate: "0", totalPnL: "0", returnPercent: "0" } };
    }

    res.json({
      symbol,
      period,
      timeframe,
      barsAnalyzed: bars.length,
      startDate: bars[0]?.time,
      endDate: bars[bars.length - 1]?.time,
      aiPowered: true,
      ...aiResult,
      priceData: bars.filter((_, i) => i % Math.ceil(bars.length / 100) === 0),
    });

  } catch (error) {
    console.error('AI Backtest error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Legacy backtest (hardcoded strategies)
app.post('/api/backtest', async (req, res) => {
  try {
    const { 
      ticker, 
      strategy, // { entry, exit, stopLoss, positionSize }
      period = '6mo', // 1mo, 3mo, 6mo (Alpaca free tier limit)
      timeframe = '1Day' // 1Min, 5Min, 15Min, 1Hour, 1Day
    } = req.body;

    if (!ticker) {
      return res.status(400).json({ error: 'Ticker is required' });
    }

    const symbol = ticker.toUpperCase().replace('$', '');
    
    // Calculate start date based on period
    const now = new Date();
    let startDate;
    switch(period) {
      case '1mo': startDate = new Date(now.setMonth(now.getMonth() - 1)); break;
      case '3mo': startDate = new Date(now.setMonth(now.getMonth() - 3)); break;
      case '6mo': startDate = new Date(now.setMonth(now.getMonth() - 6)); break;
      case '1y': startDate = new Date(now.setFullYear(now.getFullYear() - 1)); break;
      case '2y': startDate = new Date(now.setFullYear(now.getFullYear() - 2)); break;
      default: startDate = new Date(now.setMonth(now.getMonth() - 6));
    }

    // Fetch historical data from Alpaca
    const Alpaca = (await import('@alpacahq/alpaca-trade-api')).default;
    const alpaca = new Alpaca({
      keyId: process.env.ALPACA_API_KEY,
      secretKey: process.env.ALPACA_SECRET_KEY,
      paper: true,
    });

    const barsIterator = alpaca.getBarsV2(symbol, {
      start: startDate.toISOString(),
      end: new Date().toISOString(),
      timeframe: timeframe,
      limit: 10000,
      feed: 'iex', // Use IEX feed (free) instead of SIP (paid)
    });

    const bars = [];
    for await (const bar of barsIterator) {
      bars.push({
        time: bar.Timestamp,
        open: bar.OpenPrice,
        high: bar.HighPrice,
        low: bar.LowPrice,
        close: bar.ClosePrice,
        volume: bar.Volume,
      });
    }

    if (bars.length < 50) {
      return res.status(400).json({ error: 'Insufficient historical data for backtest' });
    }

    // Calculate indicators
    const calculateSMA = (data, period) => {
      const sma = [];
      for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
          sma.push(null);
        } else {
          const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b.close, 0);
          sma.push(sum / period);
        }
      }
      return sma;
    };

    const calculateRSI = (data, period = 14) => {
      const rsi = [];
      const gains = [];
      const losses = [];
      
      for (let i = 0; i < data.length; i++) {
        if (i === 0) {
          rsi.push(null);
          continue;
        }
        
        const change = data[i].close - data[i - 1].close;
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? Math.abs(change) : 0);
        
        if (i < period) {
          rsi.push(null);
          continue;
        }
        
        const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
        const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
        
        if (avgLoss === 0) {
          rsi.push(100);
        } else {
          const rs = avgGain / avgLoss;
          rsi.push(100 - (100 / (1 + rs)));
        }
      }
      return rsi;
    };

    const sma50 = calculateSMA(bars, 50);
    const sma200 = calculateSMA(bars, 200);
    const rsi = calculateRSI(bars, 14);

    // Detect strategy type from entry condition
    const entryLower = (strategy?.entry || '').toLowerCase();
    const isRSIStrategy = entryLower.includes('rsi');
    const isSMAStrategy = entryLower.includes('sma') || entryLower.includes('cross');

    // Simple backtest simulation
    const trades = [];
    let position = null;
    let cash = 100000;
    const positionSize = parseInt(strategy?.positionSize?.match(/\d+/)?.[0]) || 100;
    const stopLossPercent = parseFloat(strategy?.stopLoss?.match(/[\d.]+/)?.[0]) || 5;

    const startIdx = isRSIStrategy ? 14 : 200;

    for (let i = startIdx; i < bars.length; i++) {
      const bar = bars[i];
      const price = bar.close;
      
      if (isRSIStrategy) {
        // RSI Strategy
        const currRSI = rsi[i];
        const prevRSI = rsi[i - 1];
        
        if (!position && currRSI && prevRSI) {
          // Buy when RSI drops below 30 (oversold)
          if (currRSI < 30) {
            const shares = Math.min(positionSize, Math.floor(cash / price));
            if (shares > 0) {
              position = {
                entryPrice: price,
                shares,
                entryTime: bar.time,
                stopLoss: price * (1 - stopLossPercent / 100),
                entryRSI: currRSI,
              };
              cash -= shares * price;
            }
          }
        }
        
        if (position) {
          // Sell when RSI rises above 70 (overbought) or stop loss
          const hitStopLoss = price <= position.stopLoss;
          const rsiExit = currRSI > 70;
          
          if (rsiExit || hitStopLoss) {
            const exitPrice = hitStopLoss ? position.stopLoss : price;
            const pnl = (exitPrice - position.entryPrice) * position.shares;
            const pnlPercent = ((exitPrice - position.entryPrice) / position.entryPrice) * 100;
            
            trades.push({
              entryTime: position.entryTime,
              exitTime: bar.time,
              entryPrice: position.entryPrice,
              exitPrice,
              shares: position.shares,
              pnl,
              pnlPercent,
              exitReason: hitStopLoss ? 'Stop Loss' : 'RSI Overbought',
            });

            cash += position.shares * exitPrice;
            position = null;
          }
        }
      } else {
        // SMA Crossover Strategy (default)
        const prevSma50 = sma50[i - 1];
        const prevSma200 = sma200[i - 1];
        const currSma50 = sma50[i];
        const currSma200 = sma200[i];

        if (!position && prevSma50 && prevSma200 && currSma50 && currSma200) {
          // Golden Cross - BUY signal
          if (prevSma50 <= prevSma200 && currSma50 > currSma200) {
            const shares = Math.min(positionSize, Math.floor(cash / price));
            if (shares > 0) {
              position = {
                entryPrice: price,
                shares,
                entryTime: bar.time,
                stopLoss: price * (1 - stopLossPercent / 100),
              };
              cash -= shares * price;
            }
          }
        }

        if (position) {
          // Death Cross - SELL signal
          const deathCross = prevSma50 >= prevSma200 && currSma50 < currSma200;
          const hitStopLoss = price <= position.stopLoss;

          if (deathCross || hitStopLoss) {
            const exitPrice = hitStopLoss ? position.stopLoss : price;
            const pnl = (exitPrice - position.entryPrice) * position.shares;
            const pnlPercent = ((exitPrice - position.entryPrice) / position.entryPrice) * 100;
            
            trades.push({
              entryTime: position.entryTime,
              exitTime: bar.time,
              entryPrice: position.entryPrice,
              exitPrice,
              shares: position.shares,
              pnl,
              pnlPercent,
              exitReason: hitStopLoss ? 'Stop Loss' : 'Death Cross',
            });

            cash += position.shares * exitPrice;
            position = null;
          }
        }
      }
    }

    // Close any open position at the end
    if (position) {
      const lastBar = bars[bars.length - 1];
      const pnl = (lastBar.close - position.entryPrice) * position.shares;
      const pnlPercent = ((lastBar.close - position.entryPrice) / position.entryPrice) * 100;
      
      trades.push({
        entryTime: position.entryTime,
        exitTime: lastBar.time,
        entryPrice: position.entryPrice,
        exitPrice: lastBar.close,
        shares: position.shares,
        pnl,
        pnlPercent,
        exitReason: 'End of Period',
      });
      cash += position.shares * lastBar.close;
    }

    // Calculate summary statistics
    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl <= 0);
    const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
    const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
    const avgWin = winningTrades.length > 0 ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length : 0;

    res.json({
      symbol,
      period,
      timeframe,
      barsAnalyzed: bars.length,
      startDate: bars[0]?.time,
      endDate: bars[bars.length - 1]?.time,
      summary: {
        totalTrades: trades.length,
        winningTrades: winningTrades.length,
        losingTrades: losingTrades.length,
        winRate: winRate.toFixed(1),
        totalPnL: totalPnL.toFixed(2),
        avgWin: avgWin.toFixed(2),
        avgLoss: avgLoss.toFixed(2),
        finalCash: cash.toFixed(2),
        returnPercent: (((cash - 100000) / 100000) * 100).toFixed(2),
      },
      trades: trades.slice(-20), // Last 20 trades
      priceData: bars.filter((_, i) => i % Math.ceil(bars.length / 100) === 0), // Sampled for chart
    });

  } catch (error) {
    console.error('Backtest error:', error);
    res.status(500).json({ error: error.message });
  }
});
