// Market Movers API endpoint - Twelve Data integration
// Fetches top gainers, losers, and most active stocks using Twelve Data Pro plan

const TWELVE_DATA_KEY = process.env.VITE_TWELVE_DATA_API_KEY || process.env.TWELVE_DATA_API_KEY || 'b15d4a864f04401085fae2baa50de1b5';

async function fetchMarketMovers(type) {
  try {
    // Map frontend type to Twelve Data direction parameter
    const directionMap = {
      'gainers': 'gainers',
      'losers': 'losers',
      'volume': 'actives'
    };
    
    const direction = directionMap[type] || 'gainers';
    
    const url = `https://api.twelvedata.com/market_movers/stocks?direction=${direction}&outputsize=30&apikey=${TWELVE_DATA_KEY}`;
    
    console.log(`[MarketMovers] Fetching ${type} from Twelve Data...`);
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[MarketMovers] API error:`, errorText);
      throw new Error(`API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status === 'error') {
      throw new Error(data.message || 'API error');
    }
    
    if (!data.values || !Array.isArray(data.values)) {
      console.warn('[MarketMovers] No values in response:', data);
      return [];
    }
    
    // Format for frontend
    return data.values.map(stock => ({
      symbol: stock.symbol || '',
      name: stock.name || stock.symbol || '',
      price: parseFloat(stock.last) || parseFloat(stock.price) || 0,
      change: parseFloat(stock.change) || 0,
      percent_change: parseFloat(stock.percent_change) || 0,
      volume: parseInt(stock.volume) || 0,
      high: parseFloat(stock.high) || 0,
      low: parseFloat(stock.low) || 0,
    }));
    
  } catch (err) {
    console.error('[MarketMovers] Fetch error:', err);
    throw err;
  }
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
    const movers = await fetchMarketMovers(type);
    
    console.log(`[MarketMovers] Returning ${movers.length} ${type}`);

    return res.status(200).json({
      type,
      count: movers.length,
      values: movers,
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
