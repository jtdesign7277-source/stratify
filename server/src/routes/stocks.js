import { Router } from 'express';
import { getQuotes, getBars } from '../services/alpaca.js';

const router = Router();

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