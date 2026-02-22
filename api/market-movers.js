// Market Movers API endpoint - Twelve Data integration
// Fetches top gainers, losers, and most active stocks

const TWELVE_DATA_KEY = process.env.TWELVE_DATA_API_KEY || 'b15d4a864f04401085fae2baa50de1b5';

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
    // Map our type to Twelve Data's endpoint
    const endpointMap = {
      gainers: 'gainers',
      losers: 'losers',
      volume: 'active',
    };
    const endpoint = endpointMap[type];

    const url = `https://api.twelvedata.com/market_movers/${endpoint}?apikey=${TWELVE_DATA_KEY}`;
    
    console.log(`[MarketMovers] Fetching ${type} from Twelve Data...`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[MarketMovers] Twelve Data error:`, errorText);
      return res.status(response.status).json({ 
        error: `Twelve Data API error: ${response.statusText}`,
        details: errorText
      });
    }

    const data = await response.json();

    // Twelve Data returns { values: [...] }
    if (!data.values || !Array.isArray(data.values)) {
      console.error('[MarketMovers] Unexpected response format:', data);
      return res.status(500).json({ 
        error: 'Unexpected API response format',
        values: []
      });
    }

    console.log(`[MarketMovers] Fetched ${data.values.length} ${type}`);

    return res.status(200).json({
      type,
      count: data.values.length,
      values: data.values,
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
