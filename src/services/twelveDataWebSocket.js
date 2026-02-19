const RECONNECT_MIN_MS = 1400;
const RECONNECT_MAX_MS = 12000;

const normalizeSymbol = (value) => String(value || '').trim().toUpperCase();
const baseSymbol = (value) => normalizeSymbol(value).split(':')[0].split('.')[0];

class TwelveDataStream {
  constructor() {
    this.socket = null;
    this.socketUrl = null;
    this.connecting = false;
    this.connected = false;
    this.closedByUser = false;
    this.retryCount = 0;
    this.reconnectTimer = null;
    this.subscribedSymbols = new Set();
    this.callbacks = new Map();
    this.statusCallbacks = new Set();
    this.lastError = null;
  }

  emitStatus() {
    const payload = {
      connected: this.connected,
      connecting: this.connecting,
      error: this.lastError,
      retryCount: this.retryCount,
    };
    this.statusCallbacks.forEach((callback) => {
      try {
        callback(payload);
      } catch {}
    });
  }

  async fetchSocketUrl() {
    const response = await fetch('/api/lse/ws-config', { cache: 'no-store' });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.error || `ws-config failed (${response.status})`);
    }
    const payload = await response.json();
    const websocketUrl = String(payload?.websocketUrl || '').trim();
    if (!websocketUrl) throw new Error('Missing Twelve Data websocket URL');
    return websocketUrl;
  }

  async ensureConnection() {
    if (this.socket || this.connecting) return;

    this.connecting = true;
    this.lastError = null;
    this.emitStatus();

    try {
      this.socketUrl = this.socketUrl || (await this.fetchSocketUrl());
      this.closedByUser = false;
      const ws = new WebSocket(this.socketUrl);
      this.socket = ws;

      ws.onopen = () => {
        this.connecting = false;
        this.connected = true;
        this.retryCount = 0;
        this.lastError = null;
        this.emitStatus();
        this.sendSubscribe([...this.subscribedSymbols]);
      };

      ws.onmessage = (event) => {
        const payload = JSON.parse(event.data || '{}');
        this.handleMessage(payload);
      };

      ws.onerror = () => {
        this.lastError = 'Twelve Data websocket error';
        this.emitStatus();
      };

      ws.onclose = () => {
        this.socket = null;
        this.connected = false;
        this.connecting = false;
        this.emitStatus();
        if (!this.closedByUser && this.subscribedSymbols.size > 0) {
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      this.connecting = false;
      this.connected = false;
      this.lastError = error?.message || 'Failed to connect Twelve Data websocket';
      this.emitStatus();
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer || this.closedByUser) return;
    this.retryCount += 1;
    const backoff = Math.min(RECONNECT_MAX_MS, RECONNECT_MIN_MS * 2 ** Math.min(this.retryCount, 4));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.ensureConnection();
    }, backoff);
    this.emitStatus();
  }

  close() {
    this.closedByUser = true;
    this.connecting = false;
    this.connected = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.close(1000, 'client closed');
      this.socket = null;
    }
    this.emitStatus();
  }

  sendSubscribe(symbols) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    if (!Array.isArray(symbols) || symbols.length === 0) return;
    this.socket.send(
      JSON.stringify({
        action: 'subscribe',
        params: {
          symbols: symbols.join(','),
        },
      })
    );
  }

  sendUnsubscribe(symbols) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    if (!Array.isArray(symbols) || symbols.length === 0) return;
    this.socket.send(
      JSON.stringify({
        action: 'unsubscribe',
        params: {
          symbols: symbols.join(','),
        },
      })
    );
  }

  dispatchQuote(payload) {
    const symbol = normalizeSymbol(payload?.symbol || payload?.meta?.symbol);
    if (!symbol) return;
    const base = baseSymbol(symbol);

    const update = {
      symbol,
      price: Number(payload?.price),
      percentChange: Number(payload?.percent_change ?? payload?.percentChange),
      change: Number(payload?.change),
      timestamp: payload?.timestamp || payload?.datetime || new Date().toISOString(),
      raw: payload,
    };

    const callbackSet = new Set();
    const exactListeners = this.callbacks.get(symbol);
    if (exactListeners && exactListeners.size > 0) {
      exactListeners.forEach((callback) => callbackSet.add(callback));
    }
    if (base && base !== symbol) {
      const baseListeners = this.callbacks.get(base);
      if (baseListeners && baseListeners.size > 0) {
        baseListeners.forEach((callback) => callbackSet.add(callback));
      }
    }

    if (callbackSet.size === 0) return;

    callbackSet.forEach((callback) => {
      try {
        callback(update);
      } catch {}
    });
  }

  handleMessage(payload) {
    if (!payload) return;
    if (Array.isArray(payload)) {
      payload.forEach((entry) => this.handleMessage(entry));
      return;
    }

    if (payload?.event === 'price') {
      this.dispatchQuote(payload);
      return;
    }

    if (payload?.symbol && (payload?.price || payload?.close || payload?.last)) {
      this.dispatchQuote(payload);
      return;
    }

    if (payload?.event === 'error') {
      this.lastError = payload?.message || 'Twelve Data stream error';
      this.emitStatus();
    }
  }

  subscribe(symbols, callback) {
    const normalized = Array.isArray(symbols)
      ? symbols.map(normalizeSymbol).filter(Boolean)
      : [normalizeSymbol(symbols)].filter(Boolean);

    if (normalized.length === 0 || typeof callback !== 'function') {
      return () => {};
    }

    normalized.forEach((symbol) => {
      if (!this.callbacks.has(symbol)) this.callbacks.set(symbol, new Set());
      this.callbacks.get(symbol).add(callback);
      this.subscribedSymbols.add(symbol);
    });

    this.ensureConnection();
    this.sendSubscribe(normalized);

    return () => {
      const toRemoveFromStream = [];

      normalized.forEach((symbol) => {
        const listeners = this.callbacks.get(symbol);
        if (!listeners) return;
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.callbacks.delete(symbol);
          this.subscribedSymbols.delete(symbol);
          toRemoveFromStream.push(symbol);
        }
      });

      this.sendUnsubscribe(toRemoveFromStream);

      if (this.subscribedSymbols.size === 0) {
        this.close();
      }
    };
  }

  subscribeStatus(callback) {
    if (typeof callback !== 'function') return () => {};
    this.statusCallbacks.add(callback);
    callback({
      connected: this.connected,
      connecting: this.connecting,
      error: this.lastError,
      retryCount: this.retryCount,
    });
    return () => this.statusCallbacks.delete(callback);
  }
}

const stream = new TwelveDataStream();

export const subscribeTwelveDataQuotes = (symbols, callback) => stream.subscribe(symbols, callback);
export const subscribeTwelveDataStatus = (callback) => stream.subscribeStatus(callback);
export const disconnectTwelveData = () => stream.close();
