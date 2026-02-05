// Kalshi API Client - Full Integration
// Supports both public market data and authenticated trading

const KALSHI_API = 'https://api.elections.kalshi.com/trade-api/v2';

// Store credentials in memory (in production, use secure storage)
let kalshiCredentials = null;

/**
 * Set Kalshi API credentials
 * @param {string} apiKey - Your Kalshi API key
 * @param {string} privateKey - Your Kalshi private key (PEM format)
 */
export function setKalshiCredentials(apiKey, privateKey) {
  kalshiCredentials = { apiKey, privateKey };
  // Also store in localStorage for persistence
  try {
    localStorage.setItem('kalshi_api_key', apiKey);
    localStorage.setItem('kalshi_private_key', privateKey);
  } catch (e) {
    console.warn('Could not persist Kalshi credentials:', e);
  }
}

/**
 * Load credentials from localStorage
 */
export function loadKalshiCredentials() {
  try {
    const apiKey = localStorage.getItem('kalshi_api_key');
    const privateKey = localStorage.getItem('kalshi_private_key');
    if (apiKey && privateKey) {
      kalshiCredentials = { apiKey, privateKey };
      return true;
    }
  } catch (e) {
    console.warn('Could not load Kalshi credentials:', e);
  }
  return false;
}

/**
 * Clear stored credentials
 */
export function clearKalshiCredentials() {
  kalshiCredentials = null;
  try {
    localStorage.removeItem('kalshi_api_key');
    localStorage.removeItem('kalshi_private_key');
  } catch (e) {
    console.warn('Could not clear Kalshi credentials:', e);
  }
}

/**
 * Check if credentials are set
 */
export function hasKalshiCredentials() {
  return kalshiCredentials !== null;
}

/**
 * Generate RSA-PSS signature for Kalshi API authentication
 * Kalshi requires signing: timestamp + method + path
 */
async function signRequest(method, path, timestamp) {
  if (!kalshiCredentials) {
    throw new Error('Kalshi credentials not set');
  }

  const message = `${timestamp}${method}${path}`;
  
  try {
    // Import the private key
    const privateKeyPem = kalshiCredentials.privateKey;
    
    // Convert PEM to ArrayBuffer
    const pemHeader = '-----BEGIN PRIVATE KEY-----';
    const pemFooter = '-----END PRIVATE KEY-----';
    const pemContents = privateKeyPem
      .replace(pemHeader, '')
      .replace(pemFooter, '')
      .replace(/\s/g, '');
    const binaryString = atob(pemContents);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Import the key
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      bytes.buffer,
      {
        name: 'RSA-PSS',
        hash: 'SHA-256',
      },
      false,
      ['sign']
    );
    
    // Sign the message
    const encoder = new TextEncoder();
    const signature = await crypto.subtle.sign(
      {
        name: 'RSA-PSS',
        saltLength: 32,
      },
      cryptoKey,
      encoder.encode(message)
    );
    
    // Convert to base64
    const signatureArray = new Uint8Array(signature);
    let signatureBase64 = '';
    for (let i = 0; i < signatureArray.length; i++) {
      signatureBase64 += String.fromCharCode(signatureArray[i]);
    }
    return btoa(signatureBase64);
  } catch (error) {
    console.error('Signature error:', error);
    throw new Error('Failed to sign request: ' + error.message);
  }
}

/**
 * Make authenticated request to Kalshi API
 */
async function authenticatedFetch(method, path, body = null) {
  if (!kalshiCredentials) {
    throw new Error('Kalshi credentials not set. Call setKalshiCredentials first.');
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = await signRequest(method, path, timestamp);
  
  const headers = {
    'Content-Type': 'application/json',
    'KALSHI-ACCESS-KEY': kalshiCredentials.apiKey,
    'KALSHI-ACCESS-SIGNATURE': signature,
    'KALSHI-ACCESS-TIMESTAMP': timestamp,
  };

  const options = {
    method,
    headers,
  };

  if (body && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${KALSHI_API}${path}`, options);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kalshi API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

// ===================
// PUBLIC ENDPOINTS
// ===================

/**
 * Get public market data (no auth required)
 */
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
      yesPrice: market.yes_bid || 0,
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

/**
 * Get events (no auth required)
 */
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

// ===================
// AUTHENTICATED ENDPOINTS
// ===================

/**
 * Get account balance
 * Returns: { balance, available_balance, ... } (amounts in cents)
 */
export async function getKalshiBalance() {
  try {
    const data = await authenticatedFetch('GET', '/portfolio/balance');
    return {
      balance: (data.balance || 0) / 100, // Convert cents to dollars
      availableBalance: (data.available_balance || 0) / 100,
      bonusBalance: (data.bonus_balance || 0) / 100,
      reservedFees: (data.reserved_fees || 0) / 100,
      raw: data,
    };
  } catch (error) {
    console.error('Kalshi balance error:', error);
    throw error;
  }
}

/**
 * Get current positions
 */
export async function getKalshiPositions() {
  try {
    const data = await authenticatedFetch('GET', '/portfolio/positions');
    return (data.market_positions || []).map(pos => ({
      ticker: pos.ticker,
      eventTicker: pos.event_ticker,
      position: pos.position, // positive = yes, negative = no
      totalCost: (pos.total_cost || 0) / 100,
      realizedPnl: (pos.realized_pnl || 0) / 100,
      restingOrderCount: pos.resting_order_count || 0,
      raw: pos,
    }));
  } catch (error) {
    console.error('Kalshi positions error:', error);
    throw error;
  }
}

/**
 * Get order history
 */
export async function getKalshiOrders(status = 'resting') {
  try {
    const data = await authenticatedFetch('GET', `/portfolio/orders?status=${status}`);
    return (data.orders || []).map(order => ({
      orderId: order.order_id,
      ticker: order.ticker,
      side: order.side, // 'yes' or 'no'
      action: order.action, // 'buy' or 'sell'
      type: order.type,
      status: order.status,
      yesPrice: order.yes_price / 100,
      noPrice: order.no_price / 100,
      count: order.count,
      remainingCount: order.remaining_count,
      createdTime: order.created_time,
      raw: order,
    }));
  } catch (error) {
    console.error('Kalshi orders error:', error);
    throw error;
  }
}

/**
 * Place an order
 * @param {string} ticker - Market ticker
 * @param {string} side - 'yes' or 'no'
 * @param {string} action - 'buy' or 'sell'
 * @param {number} count - Number of contracts
 * @param {number} price - Price in cents (1-99)
 * @param {string} type - 'limit' or 'market'
 */
export async function placeKalshiOrder({ ticker, side, action, count, price, type = 'limit' }) {
  try {
    const body = {
      ticker,
      side,
      action,
      count,
      type,
    };
    
    if (type === 'limit') {
      body.yes_price = side === 'yes' ? price : null;
      body.no_price = side === 'no' ? price : null;
    }

    const data = await authenticatedFetch('POST', '/portfolio/orders', body);
    return {
      success: true,
      orderId: data.order?.order_id,
      order: data.order,
    };
  } catch (error) {
    console.error('Kalshi order error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Cancel an order
 */
export async function cancelKalshiOrder(orderId) {
  try {
    await authenticatedFetch('DELETE', `/portfolio/orders/${orderId}`);
    return { success: true };
  } catch (error) {
    console.error('Kalshi cancel error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Validate credentials by attempting to fetch balance
 * Returns user info if successful
 */
export async function validateKalshiCredentials(apiKey, privateKey) {
  // Temporarily set credentials
  const oldCreds = kalshiCredentials;
  kalshiCredentials = { apiKey, privateKey };
  
  try {
    const balance = await getKalshiBalance();
    // Credentials are valid, keep them
    return {
      valid: true,
      balance: balance.balance,
      availableBalance: balance.availableBalance,
    };
  } catch (error) {
    // Restore old credentials
    kalshiCredentials = oldCreds;
    return {
      valid: false,
      error: error.message,
    };
  }
}

// ===================
// HELPER FUNCTIONS
// ===================

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

// Auto-load credentials on module init
loadKalshiCredentials();
