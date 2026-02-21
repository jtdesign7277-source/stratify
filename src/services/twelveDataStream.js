// Twelve Data WebSocket Service
// Centralized crypto price streaming for all users
// Uses shared Twelve Data API key (market data only)

const TWELVE_DATA_WS_URL = 'wss://ws.twelvedata.com/v1/quotes/price';
const TWELVE_DATA_API_KEY = import.meta.env.VITE_TWELVE_DATA_API_KEY;

class TwelveDataStream {
  constructor() {
    this.ws = null;
    this.reconnectTimer = null;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.subscribers = new Map(); // symbol -> Set of callbacks
    this.subscribedSymbols = new Set();
    this.isConnected = false;
    this.isConnecting = false;
    this.heartbeatTimer = null;
  }

  connect() {
    if (this.isConnecting || this.isConnected) {
      console.log('[TwelveData] Already connected or connecting');
      return;
    }

    if (!TWELVE_DATA_API_KEY) {
      console.error('[TwelveData] Missing VITE_TWELVE_DATA_API_KEY');
      return;
    }

    this.isConnecting = true;
    console.log('[TwelveData] Connecting to WebSocket...');

    try {
      this.ws = new WebSocket(`${TWELVE_DATA_WS_URL}?apikey=${TWELVE_DATA_API_KEY}`);

      this.ws.onopen = () => {
        console.log('[TwelveData] WebSocket connected');
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectDelay = 1000;

        // Resubscribe to all symbols
        if (this.subscribedSymbols.size > 0) {
          const symbols = Array.from(this.subscribedSymbols);
          this.send({ action: 'subscribe', params: { symbols } });
          console.log('[TwelveData] Resubscribed to:', symbols);
        }

        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.event === 'subscribe-status') {
            console.log('[TwelveData] Subscribe status:', data);
          } else if (data.event === 'price') {
            // Real-time price update
            const symbol = data.symbol;
            const price = parseFloat(data.price);
            
            if (this.subscribers.has(symbol)) {
              this.subscribers.get(symbol).forEach(callback => {
                callback({ symbol, price, timestamp: data.timestamp });
              });
            }
          } else if (data.event === 'heartbeat') {
            console.log('[TwelveData] Heartbeat received');
          }
        } catch (err) {
          console.error('[TwelveData] Message parse error:', err);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[TwelveData] WebSocket error:', error);
      };

      this.ws.onclose = () => {
        console.log('[TwelveData] WebSocket closed');
        this.isConnected = false;
        this.isConnecting = false;
        this.stopHeartbeat();
        this.scheduleReconnect();
      };
    } catch (err) {
      console.error('[TwelveData] Connection failed:', err);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  send(message) {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(message));
    }
  }

  subscribe(symbols, callback) {
    if (!Array.isArray(symbols)) {
      symbols = [symbols];
    }

    // Normalize symbols to Twelve Data format (e.g., BTC/USD)
    const normalizedSymbols = symbols.map(s => this.normalizeSymbol(s));

    normalizedSymbols.forEach(symbol => {
      if (!this.subscribers.has(symbol)) {
        this.subscribers.set(symbol, new Set());
      }
      this.subscribers.get(symbol).add(callback);
      this.subscribedSymbols.add(symbol);
    });

    // Subscribe via WebSocket if connected
    if (this.isConnected) {
      this.send({ action: 'subscribe', params: { symbols: normalizedSymbols } });
      console.log('[TwelveData] Subscribed to:', normalizedSymbols);
    } else {
      // Connect if not already
      this.connect();
    }

    // Return unsubscribe function
    return () => {
      normalizedSymbols.forEach(symbol => {
        if (this.subscribers.has(symbol)) {
          this.subscribers.get(symbol).delete(callback);
          if (this.subscribers.get(symbol).size === 0) {
            this.subscribers.delete(symbol);
            this.subscribedSymbols.delete(symbol);
            if (this.isConnected) {
              this.send({ action: 'unsubscribe', params: { symbols: [symbol] } });
              console.log('[TwelveData] Unsubscribed from:', symbol);
            }
          }
        }
      });
    };
  }

  normalizeSymbol(symbol) {
    // Convert to Twelve Data format
    // BTC/USD, BTCUSD, BTC-USD → BTC/USD
    return String(symbol || '')
      .trim()
      .toUpperCase()
      .replace(/_/g, '/')
      .replace(/-/g, '/')
      .replace(/([A-Z]{3,4})([A-Z]{3})/, '$1/$2'); // BTCUSD → BTC/USD
  }

  scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    console.log(`[TwelveData] Reconnecting in ${this.reconnectDelay}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    }, this.reconnectDelay);
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected) {
        this.send({ action: 'heartbeat' });
      }
    }, 10000); // Every 10 seconds
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  disconnect() {
    console.log('[TwelveData] Disconnecting...');
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.isConnecting = false;
  }
}

// Singleton instance
const twelveDataStream = new TwelveDataStream();

// Auto-connect on first subscription
export function subscribeCryptoPrices(symbols, callback) {
  return twelveDataStream.subscribe(symbols, callback);
}

export function getTwelveDataConnectionStatus() {
  return {
    connected: twelveDataStream.isConnected,
    connecting: twelveDataStream.isConnecting,
  };
}

export default twelveDataStream;
