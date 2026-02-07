import express from 'express';
import {
  fetchAllTrends,
  fetchRedditTrending,
  fetchWSBTrending,
  fetchXTrending,
  fetchHackerNewsTrending,
  fetchFinanceTrending,
  fetchNewsFeeds,
  fetchCryptoTrending,
} from '../services/trends.js';

const router = express.Router();

let yahooFinanceInstance = null;

export function setYahooFinance(yf) {
  yahooFinanceInstance = yf;
}

// GET /api/trends - All trends aggregated
router.get('/', async (req, res) => {
  try {
    const data = await fetchAllTrends(yahooFinanceInstance);
    res.json(data);
  } catch (error) {
    console.error('Trends aggregation error:', error);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

// GET /api/trends/reddit
router.get('/reddit', async (req, res) => {
  try {
    const data = await fetchRedditTrending();
    res.json({ reddit: data, fetchedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Reddit trends' });
  }
});

// GET /api/trends/wsb - WallStreetBets
router.get('/wsb', async (req, res) => {
  try {
    const data = await fetchWSBTrending();
    res.json({ wsb: data, fetchedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch WSB trends' });
  }
});

// GET /api/trends/x - X/Twitter via Grok
router.get('/x', async (req, res) => {
  try {
    const data = await fetchXTrending();
    res.json({ x: data, fetchedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch X trends' });
  }
});

// GET /api/trends/hackernews
router.get('/hackernews', async (req, res) => {
  try {
    const data = await fetchHackerNewsTrending();
    res.json({ hackerNews: data, fetchedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch Hacker News trends' });
  }
});

// GET /api/trends/finance
router.get('/finance', async (req, res) => {
  try {
    const data = await fetchFinanceTrending(yahooFinanceInstance);
    res.json({ finance: data, fetchedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch finance trends' });
  }
});

// GET /api/trends/news
router.get('/news', async (req, res) => {
  try {
    const data = await fetchNewsFeeds();
    res.json({ news: data, fetchedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch news trends' });
  }
});

// GET /api/trends/crypto
router.get('/crypto', async (req, res) => {
  try {
    const data = await fetchCryptoTrending();
    res.json({ crypto: data, fetchedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch crypto trends' });
  }
});

export default router;
