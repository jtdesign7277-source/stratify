import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { WebSocketServer } from 'ws';
import stocksRouter from './routes/stocks.js';
import { startAlpacaStream } from './services/alpaca.js';

dotenv.config();

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
// Public API endpoints for Alpaca
app.get('/api/public/quote/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const sym = symbol.toUpperCase();
    const headers = {
      'APCA-API-KEY-ID': process.env.ALPACA_API_KEY,
      'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY
    };
    
    // Fetch both latest quote and previous day bar for change calculation
    const [quoteRes, barRes] = await Promise.all([
      fetch(`https://data.alpaca.markets/v2/stocks/${sym}/quotes/latest`, { headers }),
      fetch(`https://data.alpaca.markets/v2/stocks/${sym}/bars?timeframe=1Day&limit=2`, { headers })
    ]);
    
    const quoteData = await quoteRes.json();
    const barData = await barRes.json();
    
    const bid = quoteData.quote?.bp || 0;
    const ask = quoteData.quote?.ap || 0;
    const price = (bid + ask) / 2;
    
    // Calculate change from previous close
    const bars = barData.bars || [];
    const prevClose = bars.length >= 2 ? bars[bars.length - 2]?.c : (bars[0]?.c || price);
    const changePercent = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
    
    res.json({ 
      symbol: sym, 
      bid, 
      ask, 
      price,
      prevClose,
      changePercent: parseFloat(changePercent.toFixed(2))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/public/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 1) {
      return res.json([]);
    }
    
    const query = q.toUpperCase();
    const response = await fetch(`https://api.alpaca.markets/v2/assets?status=active&asset_class=us_equity`, {
      headers: {
        'APCA-API-KEY-ID': process.env.ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY
      }
    });
    const assets = await response.json();
    
    // Filter matching assets
    const matches = assets.filter(a => 
      a.tradable && (
        a.symbol.includes(query) || 
        (a.name && a.name.toUpperCase().includes(query))
      )
    );
    
    // Sort by relevance: exact symbol > symbol starts with > symbol contains > name contains
    matches.sort((a, b) => {
      const aSymbol = a.symbol;
      const bSymbol = b.symbol;
      const aName = (a.name || '').toUpperCase();
      const bName = (b.name || '').toUpperCase();
      
      // Exact symbol match gets highest priority
      if (aSymbol === query && bSymbol !== query) return -1;
      if (bSymbol === query && aSymbol !== query) return 1;
      
      // Symbol starts with query
      const aStartsWith = aSymbol.startsWith(query);
      const bStartsWith = bSymbol.startsWith(query);
      if (aStartsWith && !bStartsWith) return -1;
      if (bStartsWith && !aStartsWith) return 1;
      
      // Symbol contains query (shorter symbols first)
      const aSymbolContains = aSymbol.includes(query);
      const bSymbolContains = bSymbol.includes(query);
      if (aSymbolContains && !bSymbolContains) return -1;
      if (bSymbolContains && !aSymbolContains) return 1;
      if (aSymbolContains && bSymbolContains) return aSymbol.length - bSymbol.length;
      
      // Name starts with query
      if (aName.startsWith(query) && !bName.startsWith(query)) return -1;
      if (bName.startsWith(query) && !aName.startsWith(query)) return 1;
      
      // Alphabetical by symbol
      return aSymbol.localeCompare(bSymbol);
    });
    
    const results = matches.slice(0, 15);
    res.json(results.map(a => ({ symbol: a.symbol, name: a.name, exchange: a.exchange, tradable: a.tradable })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
