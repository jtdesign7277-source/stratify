// Arbitrage Scanner - Finds cross-platform opportunities
import { getPolymarketMarkets } from './polymarket';
import { getKalshiMarkets } from './kalshi';

// Keywords to match similar markets across platforms
const MARKET_KEYWORDS = {
  'bitcoin': ['btc', 'bitcoin', '100k', '100,000'],
  'ethereum': ['eth', 'ethereum', '5k', '5,000'],
  'fed': ['fed', 'fomc', 'rate', 'cut', 'hike'],
  'trump': ['trump', 'donald', 'president'],
  'superbowl': ['super bowl', 'superbowl', 'nfl', 'championship'],
  'recession': ['recession', 'gdp', 'economy'],
  'inflation': ['inflation', 'cpi', 'prices'],
  'tesla': ['tesla', 'tsla', 'musk'],
};

// Normalize market question for matching
function normalizeQuestion(q) {
  return (q || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim();
}

// Calculate similarity score between two questions
function getSimilarity(q1, q2) {
  const n1 = normalizeQuestion(q1);
  const n2 = normalizeQuestion(q2);
  
  // Check for keyword matches
  for (const [, keywords] of Object.entries(MARKET_KEYWORDS)) {
    const match1 = keywords.some(k => n1.includes(k));
    const match2 = keywords.some(k => n2.includes(k));
    if (match1 && match2) {
      // Both have same topic keyword - likely related
      const words1 = new Set(n1.split(/\s+/));
      const words2 = new Set(n2.split(/\s+/));
      const intersection = [...words1].filter(w => words2.has(w) && w.length > 3);
      if (intersection.length >= 3) return 0.8;
      if (intersection.length >= 2) return 0.6;
    }
  }
  
  // Fallback: word overlap
  const words1 = new Set(n1.split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(n2.split(/\s+/).filter(w => w.length > 3));
  const intersection = [...words1].filter(w => words2.has(w));
  return intersection.length / Math.max(words1.size, words2.size, 1);
}

// Find arbitrage opportunities
export async function findArbitrageOpportunities() {
  try {
    // Fetch markets from both platforms
    const [polyMarkets, kalshiMarkets] = await Promise.all([
      getPolymarketMarkets(100),
      getKalshiMarkets(100)
    ]);
    
    const opportunities = [];
    
    // Compare each Polymarket with each Kalshi market
    for (const poly of polyMarkets) {
      for (const kalshi of kalshiMarkets) {
        const similarity = getSimilarity(poly.question, kalshi.question);
        
        if (similarity >= 0.5) {
          // Check for arbitrage: YES on one + NO on other < 100
          // Polymarket YES + Kalshi NO
          const arbSpread1 = 100 - poly.yesPrice - kalshi.noPrice;
          // Kalshi YES + Polymarket NO  
          const arbSpread2 = 100 - kalshi.yesPrice - poly.noPrice;
          
          if (arbSpread1 > 1.5) {
            opportunities.push({
              id: `${poly.id}-${kalshi.id}-1`,
              name: poly.question.slice(0, 60),
              category: poly.category || kalshi.category || 'Other',
              polymarket: { side: 'YES', price: Math.round(poly.yesPrice) },
              kalshi: { side: 'NO', price: Math.round(kalshi.noPrice) },
              spread: parseFloat(arbSpread1.toFixed(1)),
              sharpe: parseFloat((arbSpread1 / 10 + 1).toFixed(1)),
              foundAt: Date.now(),
              similarity: similarity,
              polySlug: poly.slug,
              kalshiTicker: kalshi.ticker,
            });
          }
          
          if (arbSpread2 > 1.5) {
            opportunities.push({
              id: `${poly.id}-${kalshi.id}-2`,
              name: kalshi.question.slice(0, 60),
              category: kalshi.category || poly.category || 'Other',
              polymarket: { side: 'NO', price: Math.round(poly.noPrice) },
              kalshi: { side: 'YES', price: Math.round(kalshi.yesPrice) },
              spread: parseFloat(arbSpread2.toFixed(1)),
              sharpe: parseFloat((arbSpread2 / 10 + 1).toFixed(1)),
              foundAt: Date.now(),
              similarity: similarity,
              polySlug: poly.slug,
              kalshiTicker: kalshi.ticker,
            });
          }
        }
      }
    }
    
    // Sort by spread (best opportunities first)
    opportunities.sort((a, b) => b.spread - a.spread);
    
    // Return top 20
    return opportunities.slice(0, 20);
  } catch (error) {
    console.error('Arb scanner error:', error);
    return [];
  }
}

// Get individual platform markets for display
export async function getMarketData() {
  const [polyMarkets, kalshiMarkets] = await Promise.all([
    getPolymarketMarkets(50),
    getKalshiMarkets(50)
  ]);
  
  return {
    polymarket: polyMarkets,
    kalshi: kalshiMarkets,
    timestamp: Date.now()
  };
}
