import { useCallback, useEffect, useRef, useState } from 'react';

const WS_URL = 'wss://ws.twelvedata.com/v1/quotes/price';

export function useTwelveDataWS() {
  const [prices, setPrices] = useState({});
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const isActiveRef = useRef(true);

  const connect = useCallback(() => {
    if (!isActiveRef.current) return;

    const apiKey = import.meta.env.VITE_TWELVE_DATA_WS_KEY;

    if (!apiKey) {
      console.error('[xray/ws] Missing VITE_TWELVE_DATA_WS_KEY');
      return;
    }

    const ws = new WebSocket(`${WS_URL}?apikey=${encodeURIComponent(apiKey)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isActiveRef.current) return;
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data?.event === 'subscribe-status' || data?.event === 'heartbeat') {
          return;
        }

        if (data?.event === 'price') {
          setPrices((previous) => ({
            ...previous,
            [String(data.symbol || '').toUpperCase()]: {
              price: Number.parseFloat(data.price),
              timestamp: data.timestamp,
              day_volume: Number.parseInt(data.day_volume, 10) || 0,
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
      if (!isActiveRef.current) return;
      setConnected(false);
      reconnectTimerRef.current = setTimeout(connect, 3000);
    };
  }, []);

  useEffect(() => {
    isActiveRef.current = true;
    connect();
    return () => {
      isActiveRef.current = false;
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [connect]);

  const subscribe = useCallback((symbols) => {
    const normalized = Array.isArray(symbols)
      ? symbols.map((symbol) => String(symbol || '').trim().toUpperCase()).filter(Boolean)
      : [];

    if (normalized.length === 0) return;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          action: 'subscribe',
          params: { symbols: normalized.join(',') },
        })
      );
    }
  }, []);

  const unsubscribe = useCallback((symbols) => {
    const normalized = Array.isArray(symbols)
      ? symbols.map((symbol) => String(symbol || '').trim().toUpperCase()).filter(Boolean)
      : [];

    if (normalized.length === 0) return;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          action: 'unsubscribe',
          params: { symbols: normalized.join(',') },
        })
      );
    }
  }, []);

  return { prices, connected, subscribe, unsubscribe };
}

export default useTwelveDataWS;
