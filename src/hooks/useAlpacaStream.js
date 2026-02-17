import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Real-time Alpaca WebSocket streaming hook
 * Connects to Alpaca's WebSocket API for live stock and crypto data
 */

const STOCK_WS_URL = 'wss://stream.data.alpaca.markets/v2/sip';
const CRYPTO_WS_URL = 'wss://stream.data.alpaca.markets/v1beta3/crypto/us';

const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 5;

export const useAlpacaStream = ({ 
  stockSymbols = [], 
  cryptoSymbols = [],
  enabled = true 
}) => {
  const [stockQuotes, setStockQuotes] = useState({});
  const [cryptoQuotes, setCryptoQuotes] = useState({});
  const [stockConnected, setStockConnected] = useState(false);
  const [cryptoConnected, setCryptoConnected] = useState(false);
  const [error, setError] = useState(null);

  const stockWsRef = useRef(null);
  const cryptoWsRef = useRef(null);
  const stockReconnectRef = useRef(0);
  const cryptoReconnectRef = useRef(0);
  const keysRef = useRef(null);

  const normalizeStockSymbols = useCallback(
    (symbols = []) =>
      [...new Set(
        symbols
          .map((symbol) => String(symbol || '').trim().replace(/^\$/, '').toUpperCase())
          .filter(Boolean)
      )],
    []
  );

  // Fetch API keys from backend
  const fetchKeys = useCallback(async () => {
    if (keysRef.current) return keysRef.current;
    try {
      const res = await fetch('/api/alpaca-keys');
      if (!res.ok) throw new Error('Failed to fetch keys');
      const data = await res.json();
      keysRef.current = data;
      return data;
    } catch (err) {
      console.error('Failed to fetch Alpaca keys:', err);
      setError('Failed to fetch API keys');
      return null;
    }
  }, []);

  // Connect to stock WebSocket
  const connectStockWs = useCallback(async () => {
    const normalizedStockSymbols = normalizeStockSymbols(stockSymbols);
    if (!enabled || normalizedStockSymbols.length === 0) return;
    
    const keys = await fetchKeys();
    if (!keys) return;

    try {
      const ws = new WebSocket(STOCK_WS_URL);
      stockWsRef.current = ws;

      ws.onopen = () => {
        console.log('[Stock WS] Connected');
        // Authenticate
        ws.send(JSON.stringify({
          action: 'auth',
          key: keys.key,
          secret: keys.secret
        }));
      };

      ws.onmessage = (event) => {
        const messages = JSON.parse(event.data);
        
        for (const msg of messages) {
          if (msg.T === 'success' && msg.msg === 'authenticated') {
            console.log('[Stock WS] Authenticated');
            setStockConnected(true);
            stockReconnectRef.current = 0;
            
            // Subscribe to trades and quotes
            console.log('[Stock WS] Subscribing:', normalizedStockSymbols.join(', '));
            ws.send(JSON.stringify({
              action: 'subscribe',
              trades: normalizedStockSymbols,
              quotes: normalizedStockSymbols
            }));
          }

          if (msg.T === 'subscription') {
            console.log('[Stock WS] Subscription active:', msg);
          }
          
          if (msg.T === 'error') {
            console.error('[Stock WS] Error:', msg.msg);
            setError(msg.msg);
          }

          // Handle trade updates
          if (msg.T === 't') {
            setStockQuotes(prev => ({
              ...prev,
              [msg.S]: {
                ...prev[msg.S],
                symbol: msg.S,
                price: msg.p,
                size: msg.s,
                timestamp: msg.t,
                lastTrade: msg.p
              }
            }));
          }

          // Handle quote updates
          if (msg.T === 'q') {
            setStockQuotes(prev => ({
              ...prev,
              [msg.S]: {
                ...prev[msg.S],
                symbol: msg.S,
                bid: msg.bp,
                ask: msg.ap,
                bidSize: msg.bs,
                askSize: msg.as,
                price: msg.ap || msg.bp || prev[msg.S]?.price,
                timestamp: msg.t
              }
            }));
          }
        }
      };

      ws.onerror = (err) => {
        console.error('[Stock WS] Error:', err);
        setError('Stock WebSocket error');
      };

      ws.onclose = () => {
        console.log('[Stock WS] Disconnected');
        setStockConnected(false);
        stockWsRef.current = null;

        // Attempt reconnect
        if (stockReconnectRef.current < MAX_RECONNECT_ATTEMPTS && enabled) {
          stockReconnectRef.current++;
          console.log(`[Stock WS] Reconnecting... attempt ${stockReconnectRef.current}`);
          setTimeout(connectStockWs, RECONNECT_DELAY);
        }
      };
    } catch (err) {
      console.error('[Stock WS] Connection error:', err);
      setError('Failed to connect to stock stream');
    }
  }, [enabled, stockSymbols, fetchKeys, normalizeStockSymbols]);

  // Connect to crypto WebSocket
  const connectCryptoWs = useCallback(async () => {
    if (!enabled || cryptoSymbols.length === 0) return;
    
    const keys = await fetchKeys();
    if (!keys) return;

    // Format crypto symbols for Alpaca (BTC-USD -> BTC/USD)
    const formattedSymbols = cryptoSymbols.map(s => 
      s.replace('-USD', '/USD').replace('-', '/')
    );

    try {
      const ws = new WebSocket(CRYPTO_WS_URL);
      cryptoWsRef.current = ws;

      ws.onopen = () => {
        console.log('[Crypto WS] Connected');
        // Authenticate
        ws.send(JSON.stringify({
          action: 'auth',
          key: keys.key,
          secret: keys.secret
        }));
      };

      ws.onmessage = (event) => {
        const messages = JSON.parse(event.data);
        
        for (const msg of messages) {
          if (msg.T === 'success' && msg.msg === 'authenticated') {
            console.log('[Crypto WS] Authenticated');
            setCryptoConnected(true);
            cryptoReconnectRef.current = 0;
            
            // Subscribe to trades
            console.log('[Crypto WS] Subscribing:', formattedSymbols.join(', '));
            ws.send(JSON.stringify({
              action: 'subscribe',
              trades: formattedSymbols,
              quotes: formattedSymbols
            }));
          }

          if (msg.T === 'subscription') {
            console.log('[Crypto WS] Subscription active:', msg);
          }
          
          if (msg.T === 'error') {
            console.error('[Crypto WS] Error:', msg.msg);
            setError(msg.msg);
          }

          // Handle trade updates (crypto)
          if (msg.T === 't') {
            // Convert symbol back to our format (BTC/USD -> BTC-USD)
            const symbol = msg.S.replace('/', '-');
            setCryptoQuotes(prev => ({
              ...prev,
              [symbol]: {
                ...prev[symbol],
                symbol,
                price: msg.p,
                size: msg.s,
                timestamp: msg.t,
                lastTrade: msg.p
              }
            }));
          }

          // Handle quote updates (crypto)
          if (msg.T === 'q') {
            const symbol = msg.S.replace('/', '-');
            setCryptoQuotes(prev => ({
              ...prev,
              [symbol]: {
                ...prev[symbol],
                symbol,
                bid: msg.bp,
                ask: msg.ap,
                price: msg.ap || msg.bp || prev[symbol]?.price,
                timestamp: msg.t
              }
            }));
          }
        }
      };

      ws.onerror = (err) => {
        console.error('[Crypto WS] Error:', err);
        setError('Crypto WebSocket error');
      };

      ws.onclose = () => {
        console.log('[Crypto WS] Disconnected');
        setCryptoConnected(false);
        cryptoWsRef.current = null;

        // Attempt reconnect
        if (cryptoReconnectRef.current < MAX_RECONNECT_ATTEMPTS && enabled) {
          cryptoReconnectRef.current++;
          console.log(`[Crypto WS] Reconnecting... attempt ${cryptoReconnectRef.current}`);
          setTimeout(connectCryptoWs, RECONNECT_DELAY);
        }
      };
    } catch (err) {
      console.error('[Crypto WS] Connection error:', err);
      setError('Failed to connect to crypto stream');
    }
  }, [enabled, cryptoSymbols, fetchKeys]);

  // Update subscriptions when symbols change
  const updateStockSubscriptions = useCallback((newSymbols) => {
    const normalizedSymbols = normalizeStockSymbols(newSymbols);
    if (normalizedSymbols.length === 0) return;

    if (stockWsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[Stock WS] Updating subscriptions:', normalizedSymbols.join(', '));
      stockWsRef.current.send(JSON.stringify({
        action: 'subscribe',
        trades: normalizedSymbols,
        quotes: normalizedSymbols
      }));
    }
  }, [normalizeStockSymbols]);

  const updateCryptoSubscriptions = useCallback((newSymbols) => {
    if (cryptoWsRef.current?.readyState === WebSocket.OPEN) {
      const formattedSymbols = newSymbols.map(s => 
        s.replace('-USD', '/USD').replace('-', '/')
      );
      cryptoWsRef.current.send(JSON.stringify({
        action: 'subscribe',
        trades: formattedSymbols,
        quotes: formattedSymbols
      }));
    }
  }, []);

  // Connect on mount
  useEffect(() => {
    if (enabled) {
      connectStockWs();
      connectCryptoWs();
    }

    return () => {
      if (stockWsRef.current) {
        stockWsRef.current.close();
        stockWsRef.current = null;
      }
      if (cryptoWsRef.current) {
        cryptoWsRef.current.close();
        cryptoWsRef.current = null;
      }
    };
  }, [enabled]); // Only reconnect when enabled changes

  // Update subscriptions when symbols change
  useEffect(() => {
    if (stockConnected && stockSymbols.length > 0) {
      updateStockSubscriptions(stockSymbols);
    }
  }, [stockSymbols.join(','), stockConnected]);

  useEffect(() => {
    if (cryptoConnected && cryptoSymbols.length > 0) {
      updateCryptoSubscriptions(cryptoSymbols);
    }
  }, [cryptoSymbols.join(','), cryptoConnected]);

  return {
    stockQuotes,
    cryptoQuotes,
    stockConnected,
    cryptoConnected,
    isConnected: stockConnected || cryptoConnected,
    error,
    reconnectStock: connectStockWs,
    reconnectCrypto: connectCryptoWs
  };
};

export default useAlpacaStream;
