/**
 * Kalshi API Service
 * Fetches live prediction market data from Kalshi
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class KalshiClient {
  constructor() {
    this.apiKey = process.env.KALSHI_API_KEY;
    this.privateKeyPath = process.env.KALSHI_PRIVATE_KEY_PATH || path.join(__dirname, '../../kalshi_private_key.pem');
    this.baseUrl = process.env.KALSHI_API_URL || 'https://api.elections.kalshi.com/trade-api/v2';
    this.privateKey = this.loadPrivateKey();
  }

  loadPrivateKey() {
    try {
      // Try multiple paths
      const paths = [
        this.privateKeyPath,
        path.join(__dirname, '../../kalshi_private_key.pem'),
        './kalshi_private_key.pem',
        '/app/kalshi_private_key.pem'
      ];
      
      for (const p of paths) {
        try {
          if (fs.existsSync(p)) {
            return fs.readFileSync(p, 'utf8');
          }
        } catch {}
      }
      
      // Try from environment variable (base64 encoded)
      if (process.env.KALSHI_PRIVATE_KEY) {
        return Buffer.from(process.env.KALSHI_PRIVATE_KEY, 'base64').toString('utf8');
      }
      
      console.warn('Kalshi private key not found');
      return null;
    } catch (error) {
      console.error('Error loading Kalshi private key:', error);
      return null;
    }
  }

  signRequest(timestamp, method, path) {
    if (!this.privateKey) return '';
    
    try {
      const message = `${timestamp}${method}${path}`;
      const sign = crypto.createSign('RSA-SHA256');
      sign.update(message);
      return sign.sign(this.privateKey, 'base64');
    } catch (error) {
      console.error('Error signing request:', error);
      return '';
    }
  }

  getHeaders(method, path) {
    const timestamp = Date.now().toString();
    const signature = this.signRequest(timestamp, method, path);
    
    return {
      'KALSHI-ACCESS-KEY': this.apiKey || '',
      'KALSHI-ACCESS-SIGNATURE': signature,
      'KALSHI-ACCESS-TIMESTAMP': timestamp,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  async getMarkets(limit = 100, status = 'open') {
    const path = `/markets?limit=${limit}&status=${status}`;
    const url = `${this.baseUrl}${path}`;
    
    try {
      const headers = this.getHeaders('GET', path);
      const response = await fetch(url, { 
        headers,
        timeout: 10000 
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.markets || [];
      } else {
        console.error(`Kalshi API error: ${response.status}`);
        return [];
      }
    } catch (error) {
      console.error('Error fetching Kalshi markets:', error);
      return [];
    }
  }

  async getEvents(limit = 50, status = 'open') {
    const path = `/events?limit=${limit}&status=${status}`;
    const url = `${this.baseUrl}${path}`;
    
    try {
      const headers = this.getHeaders('GET', path);
      const response = await fetch(url, { 
        headers,
        timeout: 10000 
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.events || [];
      } else {
        console.error(`Kalshi API error: ${response.status}`);
        return [];
      }
    } catch (error) {
      console.error('Error fetching Kalshi events:', error);
      return [];
    }
  }

  formatMarketForArb(market) {
    const yesPrice = (market.yes_ask || market.last_price || 50) / 100;
    const noPrice = (market.no_ask || (100 - (market.yes_ask || market.last_price || 50))) / 100;
    
    return {
      id: market.ticker,
      event: market.title || market.ticker,
      category: market.category || 'Other',
      kalshi: {
        yes: yesPrice,
        no: noPrice,
        volume: market.volume || 0,
        openInterest: market.open_interest || 0
      },
      expiry: market.close_time || market.expiration_time,
      status: market.status || 'open'
    };
  }
}

export const kalshiClient = new KalshiClient();

export async function getKalshiMarkets(limit = 50) {
  const markets = await kalshiClient.getMarkets(limit);
  return markets.map(m => kalshiClient.formatMarketForArb(m));
}

export async function getKalshiEvents(limit = 30) {
  return kalshiClient.getEvents(limit);
}

export async function getArbitrageOpportunities(limit = 20) {
  const kalshiMarkets = await getKalshiMarkets(100);
  const opportunities = [];
  
  for (const market of kalshiMarkets.slice(0, limit)) {
    const kalshiYes = market.kalshi?.yes || 0.5;
    
    // Simulate Polymarket spread (in production, fetch from Polymarket API)
    const polySpread = (Math.random() - 0.5) * 0.1;
    const polyYes = Math.max(0.01, Math.min(0.99, kalshiYes + polySpread));
    
    const spread = Math.abs(kalshiYes - polyYes) * 100;
    
    if (spread >= 2.0) {
      opportunities.push({
        id: market.id,
        event: market.event,
        category: market.category,
        kalshi: {
          yes: Math.round(kalshiYes * 100) / 100,
          volume: market.kalshi?.volume || 0
        },
        polymarket: {
          yes: Math.round(polyYes * 100) / 100,
          volume: `${Math.floor(Math.random() * 5000 + 100)}K`
        },
        spread: Math.round(spread * 10) / 10,
        profit: `$${Math.round(spread * 10)} per $1000`,
        confidence: spread >= 4 ? 'High' : spread >= 3 ? 'Medium' : 'Low',
        expiry: market.expiry
      });
    }
  }
  
  // Sort by spread (highest first)
  opportunities.sort((a, b) => b.spread - a.spread);
  
  return opportunities.slice(0, limit);
}
