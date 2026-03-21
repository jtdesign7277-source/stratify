// Market Data Service - connects to Stratify backend
import { getApiUrl } from '../lib/api';

const API_BASE = 'https://stratify-backend-production-3ebd.up.railway.app';

// Fetch a single stock quote
export async function getQuote(symbol) {
  try {
    const response = await fetch(`${API_BASE}/api/public/quote/${symbol}`);
    if (!response.ok) throw new Error('Failed to fetch quote');
    return await response.json();
  } catch (error) {
    console.error(`Error fetching quote for ${symbol}:`, error);
    return null;
  }
}

// Fetch multiple stock quotes
export async function getQuotes(symbols) {
  const quotes = await Promise.all(
    symbols.map(async (symbol) => {
      const quote = await getQuote(symbol);
      return quote;
    })
  );
  return quotes.filter(q => q !== null);
}

// Fetch historical data for charts
export async function getHistory(symbol, period = '1d', interval = '5m') {
  try {
    const response = await fetch(
      `${API_BASE}/api/public/history/${symbol}?period=${period}&interval=${interval}`
    );
    if (!response.ok) throw new Error('Failed to fetch history');
    return await response.json();
  } catch (error) {
    console.error(`Error fetching history for ${symbol}:`, error);
    return null;
  }
}

// Search stocks
export async function searchStocks(query) {
  if (!query || query.length < 1) return [];
  try {
    const response = await fetch(`${API_BASE}/api/public/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Failed to search');
    return await response.json();
  } catch (error) {
    console.error('Error searching stocks:', error);
    return [];
  }
}

// Get trending stocks
export async function getTrending() {
  try {
    const response = await fetch(`${API_BASE}/api/public/trending`);
    if (!response.ok) throw new Error('Failed to fetch trending');
    return await response.json();
  } catch (error) {
    console.error('Error fetching trending:', error);
    return [];
  }
}

// Get broker quotes (requires server-side auth)
export async function getAlpacaQuotes() {
  try {
    const response = await fetch(getApiUrl('stocks'));
    if (!response.ok) throw new Error('Failed to fetch broker quotes');
    return await response.json();
  } catch (error) {
    console.error('Error fetching broker quotes:', error);
    return [];
  }
}

// Get broker bars with change data
export async function getAlpacaBars() {
  try {
    const response = await fetch(`${API_BASE}/api/stocks/bars`);
    if (!response.ok) throw new Error('Failed to fetch broker bars');
    return await response.json();
  } catch (error) {
    console.error('Error fetching broker bars:', error);
    return [];
  }
}

// Get broker snapshot with change data (single symbol)
export async function getSnapshot(symbol) {
  try {
    const response = await fetch(`${API_BASE}/api/snapshot/${symbol}`);
    if (!response.ok) throw new Error('Failed to fetch snapshot');
    return await response.json();
  } catch (error) {
    console.error(`Error fetching snapshot for ${symbol}:`, error);
    return null;
  }
}

// Get broker snapshots for multiple symbols
export async function getSnapshots(symbols) {
  const snapshots = await Promise.all(
    symbols.map(async (symbol) => {
      const snapshot = await getSnapshot(symbol);
      return snapshot;
    })
  );
  return snapshots.filter(s => s !== null);
}

// Get broker account data (equity, buying power, etc.)
export async function getAlpacaAccount() {
  try {
    const response = await fetch(`${API_BASE}/api/stocks/account`);
    if (!response.ok) throw new Error('Failed to fetch broker account');
    return await response.json();
  } catch (error) {
    console.error('Error fetching broker account:', error);
    return null;
  }
}

// Get broker positions (holdings)
export async function getAlpacaPositions() {
  try {
    const response = await fetch(`${API_BASE}/api/stocks/positions`);
    if (!response.ok) throw new Error('Failed to fetch broker positions');
    return await response.json();
  } catch (error) {
    console.error('Error fetching broker positions:', error);
    return [];
  }
}

// Chat with Grok AI
export async function chatWithGrok(message, strategyName) {
  try {
    const response = await fetch(getApiUrl('chatV1'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, strategy_name: strategyName }),
    });
    if (!response.ok) throw new Error('Failed to chat with Grok');
    return await response.json();
  } catch (error) {
    console.error('Error chatting with Grok:', error);
    return null;
  }
}
