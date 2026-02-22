// Market Movers API endpoint - Finnhub integration
// Fetches top gainers, losers, and most active stocks

// Use Finnhub free API - no key required for basic endpoints
// Backup: use popular tickers from Twelve Data

const TWELVE_DATA_KEY = process.env.TWELVE_DATA_API_KEY || 'b15d4a864f04401085fae2baa50de1b5';

// Fallback: Popular US stocks for demo
const POPULAR_TICKERS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'BRK.B', 
  'JPM', 'V', 'JNJ', 'WMT', 'PG', 'MA', 'UNH', 'HD', 'DIS', 'BAC',
  'COST', 'ADBE', 'CRM', 'NFLX', 'PEP', 'KO', 'TMO', 'CSCO', 'INTC',
  'AMD', 'AVGO', 'TXN', 'QCOM', 'NKE', 'ORCL', 'ABT', 'MRK'
];

async function fetchBatchQuotes(symbols) {
  try {
    const batchSize = 8; // Twelve Data free tier batch limit
    const results = [];
    
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const symbolString = batch.join(',');
      
      const response = await fetch(
        `https://api.twelvedata.com/quote?symbol=${symbolString}&apikey=${TWELVE_DATA_KEY}`,
        { headers: { 'Accept': 'application/json' } }
      );
      
      if (!response.ok) continue;
      
      const data = await response.json();
      
      // Handle both single and batch responses
      if (Array.isArray(data)) {
        results.push(...data.filter(d => d && d.symbol));
      } else if (data.symbol) {
        results.push(data);
      }
      
      // Rate limit: 8 calls/min on free tier
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  } catch (err) {
    console.error('[MarketMovers] Batch fetch error:', err);
    return [];
  }
}

function calculatePercentChange(quote) {
  const close = parseFloat(quote.close);
  const prevClose = parseFloat(quote.previous_close);
  if (!close || !prevClose || prevClose === 0) return 0;
  return ((close - prevClose) / prevClose) * 100;
}

function formatQuoteForDisplay(quote) {
  const percentChange = calculatePercentChange(quote);
  const change = parseFloat(quote.close) - parseFloat(quote.previous_close || 0);
  
  return {
    symbol: quote.symbol,
    name: quote.name || quote.symbol,
    price: parseFloat(quote.close),
    change: change,
    percent_change: percentChange,
    volume: parseInt(quote.volume) || 0,
    high: parseFloat(quote.high) || 0,
    low: parseFloat(quote.low) || 0,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type = 'gainers' } = req.query;

  // Validate type
  const validTypes = ['gainers', 'losers', 'volume'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: 'Invalid type. Use: gainers, losers, or volume' });
  }

  try {
    console.log(`[MarketMovers] Fetching ${type} using Twelve Data batch quotes...`);
    
    // Fetch quotes for popular tickers
    const quotes = await fetchBatchQuotes(POPULAR_TICKERS);
    
    if (quotes.length === 0) {
      return res.status(500).json({ 
        error: 'No data available',
        values: []
      });
    }
    
    // Format quotes
    const formatted = quotes
      .map(formatQuoteForDisplay)
      .filter(q => q.price > 0 && q.percent_change !== 0);
    
    // Sort based on type
    let sorted;
    if (type === 'gainers') {
      sorted = formatted
        .filter(q => q.percent_change > 0)
        .sort((a, b) => b.percent_change - a.percent_change);
    } else if (type === 'losers') {
      sorted = formatted
        .filter(q => q.percent_change < 0)
        .sort((a, b) => a.percent_change - b.percent_change);
    } else { // volume
      sorted = formatted
        .sort((a, b) => b.volume - a.volume);
    }
    
    const topResults = sorted.slice(0, 30);
    
    console.log(`[MarketMovers] Returning ${topResults.length} ${type}`);

    return res.status(200).json({
      type,
      count: topResults.length,
      values: topResults,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[MarketMovers] Error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to fetch market movers',
      values: []
    });
  }
}
