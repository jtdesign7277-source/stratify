import express from 'express';
import {
  fetchAllTrends,
  fetchRedditTrending,
  fetchHackerNewsTrending,
  fetchFinanceTrending,
  fetchNewsFeeds,
  fetchCryptoTrending,
} from '../services/trends.js';

const router = express.Router();

// Store reference to yahooFinance instance (injected from index.js)
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

// GET /api/trends/reddit - Reddit only
router.get('/reddit', async (req, res) => {
  try {
    const data = await fetchRedditTrending();
    res.json({ reddit: data, fetchedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Reddit trends error:', error);
    res.status(500).json({ error: 'Failed to fetch Reddit trends' });
  }
});

// GET /api/trends/hackernews - Hacker News only
router.get('/hackernews', async (req, res) => {
  try {
    const data = await fetchHackerNewsTrending();
    res.json({ hackerNews: data, fetchedAt: new Date().toISOString() });
  } catch (error) {
    console.error('HN trends error:', error);
    res.status(500).json({ error: 'Failed to fetch Hacker News trends' });
  }
});

// GET /api/trends/finance - Yahoo Finance trending
router.get('/finance', async (req, res) => {
  try {
    const data = await fetchFinanceTrending(yahooFinanceInstance);
    res.json({ finance: data, fetchedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Finance trends error:', error);
    res.status(500).json({ error: 'Failed to fetch finance trends' });
  }
});

// GET /api/trends/news - News feeds
router.get('/news', async (req, res) => {
  try {
    const data = await fetchNewsFeeds();
    res.json({ news: data, fetchedAt: new Date().toISOString() });
  } catch (error) {
    console.error('News trends error:', error);
    res.status(500).json({ error: 'Failed to fetch news trends' });
  }
});

// GET /api/trends/crypto - Crypto trending
router.get('/crypto', async (req, res) => {
  try {
    const data = await fetchCryptoTrending();
    res.json({ crypto: data, fetchedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Crypto trends error:', error);
    res.status(500).json({ error: 'Failed to fetch crypto trends' });
  }
});

export default router;
