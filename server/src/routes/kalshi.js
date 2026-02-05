/**
 * Kalshi API Routes
 * Endpoints for prediction market data
 */
import express from 'express';
import { getKalshiMarkets, getKalshiEvents, getArbitrageOpportunities, kalshiClient } from '../services/kalshi.js';

const router = express.Router();

const toPercent = (value) => {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num <= 1 ? num * 100 : num;
};

const buildMarketFeed = (market) => {
  const yesPercent = toPercent(market.kalshi?.yes);
  const noPercent = toPercent(market.kalshi?.no) ?? (yesPercent != null ? 100 - yesPercent : null);
  const volume = Number(market.kalshi?.volume || 0);
  const yesVolume = yesPercent != null ? (volume * (yesPercent / 100)) : 0;
  const noVolume = volume - yesVolume;

  return {
    id: market.id,
    title: market.event || market.id,
    ticker: market.id,
    category: market.category || 'Other',
    yesPercent,
    noPercent,
    yesVolume,
    noVolume,
    volume,
    closeTime: market.expiry,
    status: market.status || 'open',
  };
};

// Get live Kalshi markets
router.get('/markets', async (req, res) => {
  try {
    const requestedLimit = Math.min(parseInt(req.query.limit) || 50, 200);
    const fetchLimit = Math.min(Math.max(requestedLimit * 2, requestedLimit), 200);
    const category = req.query.category;
    
    let markets = await getKalshiMarkets(fetchLimit);
    
    if (category && category !== 'All') {
      markets = markets.filter(m => 
        m.category?.toLowerCase().includes(category.toLowerCase())
      );
    }

    const feed = markets
      .map(buildMarketFeed)
      .sort((a, b) => (b.volume || 0) - (a.volume || 0));

    res.json({
      success: true,
      count: feed.slice(0, requestedLimit).length,
      markets: feed.slice(0, requestedLimit)
    });
  } catch (error) {
    console.error('Error fetching markets:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error fetching Kalshi markets' 
    });
  }
});

// Get Kalshi events
router.get('/events', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const events = await getKalshiEvents(limit);
    
    res.json({
      success: true,
      count: events.length,
      events
    });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error fetching Kalshi events' 
    });
  }
});

// Get arbitrage opportunities
router.get('/arbitrage', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const opportunities = await getArbitrageOpportunities(limit);
    
    res.json({
      success: true,
      count: opportunities.length,
      opportunities
    });
  } catch (error) {
    console.error('Error calculating arbitrage:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Error calculating arbitrage opportunities' 
    });
  }
});

// Health check for Kalshi connection
router.get('/health', async (req, res) => {
  try {
    const markets = await kalshiClient.getMarkets(1);
    const connected = markets.length > 0;
    
    res.json({
      success: true,
      kalshi_connected: connected,
      api_key_set: !!kalshiClient.apiKey,
      private_key_loaded: !!kalshiClient.privateKey
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      kalshi_connected: false
    });
  }
});

export default router;
