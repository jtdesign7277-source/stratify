import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeSymbol as normalizeTicker } from '../../../lib/twelvedata';

const WS_CONFIG_URL = '/api/lse/ws-config';
const RECONNECT_DELAY_MS = 3000;
const normalizeSymbol = (value) => normalizeTicker(value);

export function useTwelveDataWS() {
  const [prices, setPrices] = useState({});
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const isActiveRef = useRef(true);
  const subscribedSymbolsRef = useRef(new Set());

  const sendSubscription = useCallback((action, symbols) => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    const normalized = Array.isArray(symbols)
      ? symbols.map(normalizeSymbol).filter(Boolean)
      : [];
    if (normalized.length === 0) return;

    socket.send(
      JSON.stringify({
        action,
        params: { symbols: normalized.join(',') },
      })
    );
  }, []);

  const scheduleReconnect = useCallback((connectFn) => {
    if (!isActiveRef.current) return;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      connectFn();
    }, RECONNECT_DELAY_MS);
  }, []);

  const fetchSocketUrl = useCallback(async () => {
    const response = await fetch(WS_CONFIG_URL, { cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || `ws-config failed (${response.status})`);
    }
    const websocketUrl = String(payload?.websocketUrl || '').trim();
    if (!websocketUrl) {
      throw new Error('Missing Twelve Data websocket URL');
    }
    return websocketUrl;
  }, []);

  const connect = useCallback(() => {
    if (!isActiveRef.current) return;
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    (async () => {
      try {
        const socketUrl = await fetchSocketUrl();
        if (!isActiveRef.current) return;

        const ws = new WebSocket(socketUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isActiveRef.current) return;
          setConnected(true);
          const subscribed = [...subscribedSymbolsRef.current];
          sendSubscription('subscribe', subscribed);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data?.event === 'subscribe-status' || data?.event === 'heartbeat') {
              return;
            }

            if (data?.event === 'price') {
              const symbol = normalizeSymbol(data.symbol);
              const price = Number.parseFloat(data.price);
              if (!symbol || !Number.isFinite(price)) return;

              const change = Number.parseFloat(data.change);
              const changePercent = Number.parseFloat(data.percent_change ?? data.change_percent);
              const previousClose = Number.parseFloat(
                data.previous_close ?? data.prev_close ?? data.previousClose
              );

              setPrices((previous) => ({
                ...previous,
                [symbol]: {
                  price,
                  timestamp: data.timestamp,
                  day_volume: Number.parseInt(data.day_volume, 10) || 0,
                  change: Number.isFinite(change) ? change : null,
                  change_percent: Number.isFinite(changePercent) ? changePercent : null,
                  previous_close: Number.isFinite(previousClose) ? previousClose : null,
                  bid: Number.parseFloat(data.bid) || null,
                  ask: Number.parseFloat(data.ask) || null,
                  exchange: data.exchange || null,
                },
              }));
            }
          } catch (error) {
            console.error('[xray/ws] Parse error:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('[xray/ws] Error:', error);
        };

        ws.onclose = () => {
          if (wsRef.current === ws) {
            wsRef.current = null;
          }
          if (!isActiveRef.current) return;
          setConnected(false);
          scheduleReconnect(connect);
        };
      } catch (error) {
        console.error('[xray/ws] Connect error:', error);
        setConnected(false);
        if (isActiveRef.current) {
          scheduleReconnect(connect);
        }
      }
    })();
  }, [fetchSocketUrl, scheduleReconnect, sendSubscription]);

  useEffect(() => {
    isActiveRef.current = true;
    connect();
    return () => {
      isActiveRef.current = false;
      setConnected(false);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const subscribe = useCallback((symbols) => {
    const normalized = Array.isArray(symbols)
      ? symbols.map(normalizeSymbol).filter(Boolean)
      : [];

    if (normalized.length === 0) return;

    normalized.forEach((symbol) => {
      subscribedSymbolsRef.current.add(symbol);
    });
    sendSubscription('subscribe', normalized);
  }, [sendSubscription]);

  const unsubscribe = useCallback((symbols) => {
    const normalized = Array.isArray(symbols)
      ? symbols.map(normalizeSymbol).filter(Boolean)
      : [];

    if (normalized.length === 0) return;

    normalized.forEach((symbol) => {
      subscribedSymbolsRef.current.delete(symbol);
    });
    sendSubscription('unsubscribe', normalized);
  }, [sendSubscription]);

  return { prices, connected, subscribe, unsubscribe };
}

export default useTwelveDataWS;
