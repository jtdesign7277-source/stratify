const STOCK_WS_URL = 'wss://stream.data.alpaca.markets/v2/sip';
const CRYPTO_WS_URL = 'wss://stream.data.alpaca.markets/v1beta3/crypto/us';

const RECONNECT_BASE_DELAY = 2000;
const RECONNECT_MAX_DELAY = 20000;

const normalizeStockSymbol = (symbol) => String(symbol || '').trim().replace(/^\$/, '').toUpperCase();

const normalizeStockSymbols = (symbols = []) => (
  [...new Set(symbols.map(normalizeStockSymbol).filter(Boolean))]
);

const normalizeCryptoSymbol = (symbol) => {
  const normalized = String(symbol || '').trim().replace(/^\$/, '').toUpperCase();
  if (!normalized) return '';
  return normalized.replace(/_/g, '-').replace(/\//g, '-');
};

const normalizeCryptoSymbols = (symbols = []) => (
  [...new Set(symbols.map(normalizeCryptoSymbol).filter(Boolean))]
);

const toCryptoStreamSymbol = (symbol) => {
  const normalized = normalizeCryptoSymbol(symbol);
  if (!normalized) return '';
  const compact = normalized.replace(/-/g, '');
  const compactMatch = compact.match(/^([A-Z0-9]+)(USD|USDT|USDC)$/);
  if (compactMatch) {
    return `${compactMatch[1]}/${compactMatch[2]}`;
  }
  const [base, quote = 'USD'] = normalized.split('-');
  if (!base) return '';
  return `${base}/${quote}`;
};

const fromCryptoStreamSymbol = (symbol) => {
  const normalized = String(symbol || '').trim().toUpperCase();
  if (!normalized) return '';
  if (normalized.includes('/')) return normalized.replace('/', '-');
  if (normalized.includes('-')) return normalized;

  const compact = normalized.replace(/[^A-Z0-9]/g, '');
  const compactMatch = compact.match(/^([A-Z0-9]+)(USD|USDT|USDC)$/);
  if (compactMatch) {
    return `${compactMatch[1]}-${compactMatch[2]}`;
  }

  return compact;
};

const toMessageArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload) return [];
  return [payload];
};

class AlpacaStreamManager {
  constructor() {
    this.stockWs = null;
    this.cryptoWs = null;

    this.stockAuthenticated = false;
    this.cryptoAuthenticated = false;
    this.stockConnected = false;
    this.cryptoConnected = false;
    this.error = null;

    this.keys = null;
    this.keysPromise = null;

    this.stockListeners = new Map();
    this.cryptoListeners = new Map();
    this.statusListeners = new Map();
    this.listenerId = 0;

    this.stockQuotes = new Map();
    this.cryptoQuotes = new Map();

    this.stockSubscribedSymbols = new Set();
    this.cryptoSubscribedSymbols = new Set();

    this.stockReconnectAttempt = 0;
    this.cryptoReconnectAttempt = 0;
    this.stockReconnectTimer = null;
    this.cryptoReconnectTimer = null;
    this.stockConnectPromise = null;
    this.cryptoConnectPromise = null;

    this.stockIntentionalClose = false;
    this.cryptoIntentionalClose = false;
  }

  getStatus() {
    return {
      stockConnected: this.stockConnected,
      cryptoConnected: this.cryptoConnected,
      error: this.error,
      isConnected: this.stockConnected || this.cryptoConnected,
    };
  }

  emitStatus() {
    const snapshot = this.getStatus();
    this.statusListeners.forEach((callback) => {
      try {
        callback(snapshot);
      } catch (error) {
        console.error('[Alpaca Stream] Status listener error:', error);
      }
    });
  }

  setError(error) {
    const nextError = error ? String(error) : null;
    if (this.error === nextError) return;
    this.error = nextError;
    this.emitStatus();
  }

  clearError() {
    this.setError(null);
  }

  async fetchKeys() {
    if (this.keys) return this.keys;
    if (this.keysPromise) return this.keysPromise;

    this.keysPromise = fetch('/api/alpaca-keys')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch Alpaca API keys');
        }
        const data = await response.json();
        this.keys = data;
        return data;
      })
      .catch((error) => {
        this.setError(error.message || 'Failed to fetch Alpaca API keys');
        throw error;
      })
      .finally(() => {
        this.keysPromise = null;
      });

    return this.keysPromise;
  }

  subscribeStatus(callback) {
    if (typeof callback !== 'function') return () => {};

    const id = ++this.listenerId;
    this.statusListeners.set(id, callback);

    try {
      callback(this.getStatus());
    } catch (error) {
      console.error('[Alpaca Stream] Status listener error:', error);
    }

    return () => {
      this.statusListeners.delete(id);
    };
  }

  subscribeStocks(symbols, callback) {
    if (typeof callback !== 'function') return () => {};

    const id = ++this.listenerId;
    const normalizedSymbols = new Set(normalizeStockSymbols(symbols));

    this.stockListeners.set(id, {
      symbols: normalizedSymbols,
      callback,
    });

    normalizedSymbols.forEach((symbol) => {
      const quote = this.stockQuotes.get(symbol);
      if (quote) callback({ symbol, quote });
    });

    this.syncStockStream();

    return () => {
      this.stockListeners.delete(id);
      this.syncStockStream();
    };
  }

  subscribeCrypto(symbols, callback) {
    if (typeof callback !== 'function') return () => {};

    const id = ++this.listenerId;
    const normalizedSymbols = new Set(normalizeCryptoSymbols(symbols));

    this.cryptoListeners.set(id, {
      symbols: normalizedSymbols,
      callback,
    });

    normalizedSymbols.forEach((symbol) => {
      const quote = this.cryptoQuotes.get(symbol);
      if (quote) callback({ symbol, quote });
    });

    this.syncCryptoStream();

    return () => {
      this.cryptoListeners.delete(id);
      this.syncCryptoStream();
    };
  }

  getDesiredStockSymbols() {
    const symbols = new Set();
    this.stockListeners.forEach((listener) => {
      listener.symbols.forEach((symbol) => symbols.add(symbol));
    });
    return symbols;
  }

  getDesiredCryptoSymbols() {
    const symbols = new Set();
    this.cryptoListeners.forEach((listener) => {
      listener.symbols.forEach((symbol) => symbols.add(symbol));
    });
    return symbols;
  }

  emitStockUpdate(symbol, quote) {
    this.stockListeners.forEach(({ symbols, callback }) => {
      if (!symbols.has(symbol)) return;
      try {
        callback({ symbol, quote });
      } catch (error) {
        console.error('[Alpaca Stream] Stock listener error:', error);
      }
    });
  }

  emitCryptoUpdate(symbol, quote) {
    this.cryptoListeners.forEach(({ symbols, callback }) => {
      if (!symbols.has(symbol)) return;
      try {
        callback({ symbol, quote });
      } catch (error) {
        console.error('[Alpaca Stream] Crypto listener error:', error);
      }
    });
  }

  scheduleStockReconnect() {
    if (this.stockReconnectTimer) return;

    const delay = Math.min(RECONNECT_BASE_DELAY * (2 ** this.stockReconnectAttempt), RECONNECT_MAX_DELAY);
    this.stockReconnectAttempt += 1;

    this.stockReconnectTimer = setTimeout(() => {
      this.stockReconnectTimer = null;
      this.connectStockWs();
    }, delay);
  }

  scheduleCryptoReconnect() {
    if (this.cryptoReconnectTimer) return;

    const delay = Math.min(RECONNECT_BASE_DELAY * (2 ** this.cryptoReconnectAttempt), RECONNECT_MAX_DELAY);
    this.cryptoReconnectAttempt += 1;

    this.cryptoReconnectTimer = setTimeout(() => {
      this.cryptoReconnectTimer = null;
      this.connectCryptoWs();
    }, delay);
  }

  stopStockReconnect() {
    if (!this.stockReconnectTimer) return;
    clearTimeout(this.stockReconnectTimer);
    this.stockReconnectTimer = null;
  }

  stopCryptoReconnect() {
    if (!this.cryptoReconnectTimer) return;
    clearTimeout(this.cryptoReconnectTimer);
    this.cryptoReconnectTimer = null;
  }

  teardownStockSocket() {
    this.stopStockReconnect();

    if (this.stockWs) {
      this.stockIntentionalClose = true;
      try {
        this.stockWs.close();
      } catch (error) {
        console.error('[Stock WS] Close error:', error);
      }
    }

    this.stockWs = null;
    this.stockAuthenticated = false;
    this.stockConnected = false;
    this.stockSubscribedSymbols.clear();
    this.emitStatus();
  }

  teardownCryptoSocket() {
    this.stopCryptoReconnect();

    if (this.cryptoWs) {
      this.cryptoIntentionalClose = true;
      try {
        this.cryptoWs.close();
      } catch (error) {
        console.error('[Crypto WS] Close error:', error);
      }
    }

    this.cryptoWs = null;
    this.cryptoAuthenticated = false;
    this.cryptoConnected = false;
    this.cryptoSubscribedSymbols.clear();
    this.emitStatus();
  }

  async connectStockWs() {
    if (this.stockConnectPromise) {
      return this.stockConnectPromise;
    }

    const desiredSymbols = this.getDesiredStockSymbols();
    if (desiredSymbols.size === 0) {
      this.teardownStockSocket();
      return;
    }

    if (this.stockWs && (this.stockWs.readyState === WebSocket.OPEN || this.stockWs.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.stockConnectPromise = (async () => {
      let keys;
      try {
        keys = await this.fetchKeys();
      } catch {
        return;
      }

      if (this.stockWs && (this.stockWs.readyState === WebSocket.OPEN || this.stockWs.readyState === WebSocket.CONNECTING)) {
        return;
      }

      try {
        const ws = new WebSocket(STOCK_WS_URL);
        this.stockIntentionalClose = false;
        this.stockWs = ws;

        ws.onopen = () => {
          ws.send(JSON.stringify({
            action: 'auth',
            key: keys.key,
            secret: keys.secret,
          }));
        };

        ws.onmessage = (event) => {
          let payload;
          try {
            payload = JSON.parse(event.data);
          } catch {
            return;
          }

          toMessageArray(payload).forEach((msg) => {
            if (!msg || typeof msg !== 'object') return;

            if (msg.T === 'success' && msg.msg === 'authenticated') {
              this.stockAuthenticated = true;
              this.stockConnected = true;
              this.stockReconnectAttempt = 0;
              this.clearError();
              this.emitStatus();
              this.syncStockStream();
              return;
            }

            if (msg.T === 'error') {
              this.setError(msg.msg || 'Stock stream error');
              return;
            }

            if (msg.T === 't' || msg.T === 'q') {
              const symbol = normalizeStockSymbol(msg.S);
              if (!symbol) return;

              const previous = this.stockQuotes.get(symbol) || { symbol };
              const update = msg.T === 't'
                ? {
                    symbol,
                    price: msg.p,
                    size: msg.s,
                    timestamp: msg.t,
                    lastTrade: msg.p,
                  }
                : {
                    symbol,
                    bid: msg.bp,
                    ask: msg.ap,
                    bidSize: msg.bs,
                    askSize: msg.as,
                    price: msg.ap || msg.bp || previous.price,
                    timestamp: msg.t,
                  };

              const next = { ...previous, ...update };
              this.stockQuotes.set(symbol, next);
              this.emitStockUpdate(symbol, next);
            }
          });
        };

        ws.onerror = () => {
          this.setError('Stock WebSocket error');
        };

        ws.onclose = () => {
          const intentional = this.stockIntentionalClose;

          this.stockWs = null;
          this.stockAuthenticated = false;
          this.stockConnected = false;
          this.stockSubscribedSymbols.clear();
          this.emitStatus();

          if (intentional) {
            this.stockIntentionalClose = false;
            return;
          }

          if (this.getDesiredStockSymbols().size > 0) {
            this.scheduleStockReconnect();
          }
        };
      } catch (error) {
        this.setError(error.message || 'Failed to connect stock stream');
        this.scheduleStockReconnect();
      }
    })().finally(() => {
      this.stockConnectPromise = null;
    });

    return this.stockConnectPromise;
  }

  async connectCryptoWs() {
    if (this.cryptoConnectPromise) {
      return this.cryptoConnectPromise;
    }

    const desiredSymbols = this.getDesiredCryptoSymbols();
    if (desiredSymbols.size === 0) {
      this.teardownCryptoSocket();
      return;
    }

    if (this.cryptoWs && (this.cryptoWs.readyState === WebSocket.OPEN || this.cryptoWs.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.cryptoConnectPromise = (async () => {
      let keys;
      try {
        keys = await this.fetchKeys();
      } catch {
        return;
      }

      if (this.cryptoWs && (this.cryptoWs.readyState === WebSocket.OPEN || this.cryptoWs.readyState === WebSocket.CONNECTING)) {
        return;
      }

      try {
        const ws = new WebSocket(CRYPTO_WS_URL);
        this.cryptoIntentionalClose = false;
        this.cryptoWs = ws;

        ws.onopen = () => {
          ws.send(JSON.stringify({
            action: 'auth',
            key: keys.key,
            secret: keys.secret,
          }));
        };

        ws.onmessage = (event) => {
          let payload;
          try {
            payload = JSON.parse(event.data);
          } catch {
            return;
          }

          toMessageArray(payload).forEach((msg) => {
            if (!msg || typeof msg !== 'object') return;

            if (msg.T === 'success' && msg.msg === 'authenticated') {
              this.cryptoAuthenticated = true;
              this.cryptoConnected = true;
              this.cryptoReconnectAttempt = 0;
              this.clearError();
              this.emitStatus();
              this.syncCryptoStream();
              return;
            }

            if (msg.T === 'error') {
              this.setError(msg.msg || 'Crypto stream error');
              return;
            }

            if (msg.T === 't' || msg.T === 'q' || msg.T === 'b' || msg.T === 'u') {
              const symbol = fromCryptoStreamSymbol(msg.S);
              if (!symbol) return;

              const previous = this.cryptoQuotes.get(symbol) || { symbol };
              const update = msg.T === 't'
                ? {
                    symbol,
                    price: msg.p,
                    size: msg.s,
                    timestamp: msg.t,
                    lastTrade: msg.p,
                  }
                : msg.T === 'b' || msg.T === 'u'
                  ? {
                      symbol,
                      price: msg.c ?? msg.close ?? previous.price,
                      open: msg.o ?? msg.open ?? previous.open,
                      high: msg.h ?? msg.high ?? previous.high,
                      low: msg.l ?? msg.low ?? previous.low,
                      volume: msg.v ?? msg.volume ?? previous.volume,
                      timestamp: msg.t ?? msg.timestamp ?? previous.timestamp,
                    }
                  : {
                      symbol,
                      bid: msg.bp ?? msg.bid ?? msg.BP,
                      ask: msg.ap ?? msg.ask ?? msg.AP,
                      price: msg.ap ?? msg.bp ?? msg.ask ?? msg.bid ?? msg.AP ?? msg.BP ?? previous.price,
                      timestamp: msg.t ?? msg.timestamp,
                    };

              const next = { ...previous, ...update };
              this.cryptoQuotes.set(symbol, next);
              this.emitCryptoUpdate(symbol, next);
            }
          });
        };

        ws.onerror = () => {
          this.setError('Crypto WebSocket error');
        };

        ws.onclose = () => {
          const intentional = this.cryptoIntentionalClose;

          this.cryptoWs = null;
          this.cryptoAuthenticated = false;
          this.cryptoConnected = false;
          this.cryptoSubscribedSymbols.clear();
          this.emitStatus();

          if (intentional) {
            this.cryptoIntentionalClose = false;
            return;
          }

          if (this.getDesiredCryptoSymbols().size > 0) {
            this.scheduleCryptoReconnect();
          }
        };
      } catch (error) {
        this.setError(error.message || 'Failed to connect crypto stream');
        this.scheduleCryptoReconnect();
      }
    })().finally(() => {
      this.cryptoConnectPromise = null;
    });

    return this.cryptoConnectPromise;
  }

  syncStockStream() {
    const desiredSymbols = this.getDesiredStockSymbols();

    if (desiredSymbols.size === 0) {
      this.teardownStockSocket();
      return;
    }

    if (!this.stockWs || this.stockWs.readyState !== WebSocket.OPEN || !this.stockAuthenticated) {
      this.connectStockWs();
      return;
    }

    const nextSymbols = [...desiredSymbols];
    const symbolsToAdd = nextSymbols.filter((symbol) => !this.stockSubscribedSymbols.has(symbol));
    const symbolsToRemove = [...this.stockSubscribedSymbols].filter((symbol) => !desiredSymbols.has(symbol));

    if (symbolsToAdd.length > 0) {
      this.stockWs.send(JSON.stringify({
        action: 'subscribe',
        trades: symbolsToAdd,
        quotes: symbolsToAdd,
      }));
      symbolsToAdd.forEach((symbol) => this.stockSubscribedSymbols.add(symbol));
    }

    if (symbolsToRemove.length > 0) {
      this.stockWs.send(JSON.stringify({
        action: 'unsubscribe',
        trades: symbolsToRemove,
        quotes: symbolsToRemove,
      }));
      symbolsToRemove.forEach((symbol) => this.stockSubscribedSymbols.delete(symbol));
    }
  }

  syncCryptoStream() {
    const desiredInternalSymbols = this.getDesiredCryptoSymbols();

    if (desiredInternalSymbols.size === 0) {
      this.teardownCryptoSocket();
      return;
    }

    if (!this.cryptoWs || this.cryptoWs.readyState !== WebSocket.OPEN || !this.cryptoAuthenticated) {
      this.connectCryptoWs();
      return;
    }

    const desiredStreamSymbols = [...desiredInternalSymbols]
      .map(toCryptoStreamSymbol)
      .filter(Boolean);

    const desiredStreamSet = new Set(desiredStreamSymbols);

    const symbolsToAdd = desiredStreamSymbols.filter((symbol) => !this.cryptoSubscribedSymbols.has(symbol));
    const symbolsToRemove = [...this.cryptoSubscribedSymbols].filter((symbol) => !desiredStreamSet.has(symbol));

    if (symbolsToAdd.length > 0) {
      this.cryptoWs.send(JSON.stringify({
        action: 'subscribe',
        trades: symbolsToAdd,
        quotes: symbolsToAdd,
        bars: symbolsToAdd,
      }));
      symbolsToAdd.forEach((symbol) => this.cryptoSubscribedSymbols.add(symbol));
    }

    if (symbolsToRemove.length > 0) {
      this.cryptoWs.send(JSON.stringify({
        action: 'unsubscribe',
        trades: symbolsToRemove,
        quotes: symbolsToRemove,
        bars: symbolsToRemove,
      }));
      symbolsToRemove.forEach((symbol) => this.cryptoSubscribedSymbols.delete(symbol));
    }
  }

  reconnectStock() {
    this.teardownStockSocket();
    this.connectStockWs();
  }

  reconnectCrypto() {
    this.teardownCryptoSocket();
    this.connectCryptoWs();
  }
}

const GLOBAL_KEY = '__stratifyAlpacaStreamManager';

const getSingleton = () => {
  if (typeof globalThis === 'undefined') {
    return new AlpacaStreamManager();
  }

  if (!globalThis[GLOBAL_KEY]) {
    globalThis[GLOBAL_KEY] = new AlpacaStreamManager();
  }

  return globalThis[GLOBAL_KEY];
};

const manager = getSingleton();

export const subscribeStocks = (symbols, callback) => manager.subscribeStocks(symbols, callback);
export const subscribeCrypto = (symbols, callback) => manager.subscribeCrypto(symbols, callback);
export const subscribeAlpacaStatus = (callback) => manager.subscribeStatus(callback);
export const reconnectStocksStream = () => manager.reconnectStock();
export const reconnectCryptoStream = () => manager.reconnectCrypto();
export const getAlpacaStreamStatus = () => manager.getStatus();

export default manager;
