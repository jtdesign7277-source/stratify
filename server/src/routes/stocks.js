import { Router } from 'express';
import { getQuotes, getBars, getAccount, getPositions } from '../services/alpaca.js';

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
    const bars = await getBars();
    res.json(bars);
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