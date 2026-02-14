import { Router } from 'express';
import { getQuotes, getBars, getSnapshots, getAccount, getPositions } from '../services/alpaca.js';

const router = Router();

// Debug route to test if new routes are deployed
router.get('/debug', (req, res) => {
  res.json({ status: 'v2', routes: ['account', 'positions', 'quotes', 'bars'], timestamp: new Date().toISOString() });
});

router.get('/account', async (req, res) => {
  try {
    const account = await getAccount();
    res.json(account);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/positions', async (req, res) => {
  try {
    const positions = await getPositions();
    res.json(positions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/quotes', async (req, res) => {
  try {
    const quotes = await getQuotes();
    res.json(quotes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/bars', async (req, res) => {
  try {
    // Use snapshots for real-time data with change %
    const snapshots = await getSnapshots();
    res.json(snapshots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Historical daily bars for backtesting
router.get('/:symbol/history', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { period = '3mo' } = req.query;
    const sym = symbol.toUpperCase();
    
    // Calculate start date based on period
    const now = new Date();
    let start;
    if (period === '1mo') start = new Date(now - 30 * 86400000);
    else if (period === '3mo') start = new Date(now - 90 * 86400000);
    else if (period === '6mo') start = new Date(now - 180 * 86400000);
    else if (period === '1y') start = new Date(now - 365 * 86400000);
    else start = new Date(now - 90 * 86400000);

    const startStr = start.toISOString().split('T')[0];
    const endStr = now.toISOString().split('T')[0];

    const url = `https://data.alpaca.markets/v2/stocks/${sym}/bars?timeframe=1Day&start=${startStr}&end=${endStr}&limit=500&adjustment=raw&feed=sip`;
    const response = await fetch(url, {
      headers: {
        'APCA-API-KEY-ID': process.env.ALPACA_API_KEY,
        'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: `Alpaca error: ${response.status}`, detail: text });
    }

    const data = await response.json();
    const bars = (data.bars || []).map(b => ({
      date: b.t?.split('T')[0],
      open: b.o,
      high: b.h,
      low: b.l,
      close: b.c,
      volume: b.v,
      vwap: b.vw,
    }));

    res.json({ symbol: sym, period, bars });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const quotes = await getQuotes();
    const bars = await getBars();
    
    const quote = quotes.find(q => q.symbol === symbol.toUpperCase());
    const bar = bars.find(b => b.symbol === symbol.toUpperCase());
    
    if (!quote && !bar) {
      return res.status(404).json({ error: 'Symbol not found' });
    }
    
    res.json({ ...quote, ...bar });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;