// Polymarket API Client
const POLYMARKET_API = 'https://gamma-api.polymarket.com';

export async function getPolymarketMarkets(limit = 100) {
  try {
    const response = await fetch(
      `${POLYMARKET_API}/markets?closed=false&limit=${limit}&order=volume24hr&ascending=false`
    );
    if (!response.ok) throw new Error('Polymarket API error');
    const data = await response.json();
    
    return data.map(market => ({
      id: market.id,
      source: 'polymarket',
      question: market.question,
      slug: market.slug,
      category: market.events?.[0]?.category || 'Other',
      yesPrice: parseFloat(market.outcomePrices?.[0] || 0) * 100, // Convert to cents
      noPrice: parseFloat(market.outcomePrices?.[1] || 0) * 100,
      volume24h: market.volume24hr || 0,
      liquidity: market.liquidityNum || 0,
      endDate: market.endDate,
    }));
  } catch (error) {
    console.error('Polymarket fetch error:', error);
    return [];
  }
}

export async function searchPolymarketMarkets(query) {
  try {
    const response = await fetch(
      `${POLYMARKET_API}/markets?closed=false&limit=50&tag_all=${encodeURIComponent(query)}`
    );
    if (!response.ok) throw new Error('Polymarket search error');
    return await response.json();
  } catch (error) {
    console.error('Polymarket search error:', error);
    return [];
  }
}
