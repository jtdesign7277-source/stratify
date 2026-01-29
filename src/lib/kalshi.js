// Kalshi API Client
const KALSHI_API = 'https://api.elections.kalshi.com/trade-api/v2';

export async function getKalshiMarkets(limit = 100) {
  try {
    const response = await fetch(
      `${KALSHI_API}/markets?limit=${limit}&status=open`
    );
    if (!response.ok) throw new Error('Kalshi API error');
    const data = await response.json();
    
    return (data.markets || []).map(market => ({
      id: market.ticker,
      source: 'kalshi',
      question: market.title || market.subtitle || market.ticker,
      ticker: market.ticker,
      eventTicker: market.event_ticker,
      category: getCategoryFromTicker(market.event_ticker),
      yesPrice: market.yes_bid || 0, // Already in cents
      noPrice: market.no_bid || 0,
      yesAsk: market.yes_ask || 0,
      noAsk: market.no_ask || 0,
      volume: market.volume || 0,
      liquidity: parseFloat(market.liquidity_dollars) || 0,
      closeTime: market.close_time,
    }));
  } catch (error) {
    console.error('Kalshi fetch error:', error);
    return [];
  }
}

export async function getKalshiEvents(limit = 50) {
  try {
    const response = await fetch(
      `${KALSHI_API}/events?limit=${limit}&status=open`
    );
    if (!response.ok) throw new Error('Kalshi events error');
    const data = await response.json();
    return data.events || [];
  } catch (error) {
    console.error('Kalshi events error:', error);
    return [];
  }
}

function getCategoryFromTicker(ticker) {
  if (!ticker) return 'Other';
  const t = ticker.toUpperCase();
  if (t.includes('NBA') || t.includes('NFL') || t.includes('MLB') || t.includes('SPORT')) return 'Sports';
  if (t.includes('BTC') || t.includes('ETH') || t.includes('CRYPTO')) return 'Crypto';
  if (t.includes('FED') || t.includes('CPI') || t.includes('GDP') || t.includes('ECON')) return 'Economics';
  if (t.includes('TRUMP') || t.includes('BIDEN') || t.includes('ELECT') || t.includes('CONGRESS')) return 'Politics';
  if (t.includes('TSLA') || t.includes('AAPL') || t.includes('NVDA') || t.includes('STOCK')) return 'Stocks';
  return 'Other';
}
