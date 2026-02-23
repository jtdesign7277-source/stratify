import { useCallback, useEffect, useRef, useState } from 'react';

const WS_URL = 'wss://ws.twelvedata.com/v1/quotes/price';

const parsePricePayload = (data) => {
  if (data?.event !== 'price' || !data?.symbol) return null;
  const price = Number(data.price);
  if (!Number.isFinite(price)) return null;

  return {
    symbol: String(data.symbol).toUpperCase(),
    price,
    timestamp: data.timestamp,
    day_volume: Number(data.day_volume) || 0,
    bid: Number(data.bid) || null,
    ask: Number(data.ask) || null,
    exchange: data.exchange || null,
  };
};

export function useTwelveDataWS() {
  const [prices, setPrices] = useState({});
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  const connect = useCallback(() => {
    const apiKey =
      import.meta.env.VITE_TWELVE_DATA_WS_KEY ||
      import.meta.env.VITE_TWELVE_DATA_API_KEY ||
      import.meta.env.VITE_TWELVEDATA_API_KEY;

    if (!apiKey) {
      console.warn('[xray] VITE_TWELVE_DATA_WS_KEY is not set');
      return;
    }

    const ws = new WebSocket(`${WS_URL}?apikey=${encodeURIComponent(apiKey)}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.event === 'heartbeat' || payload?.event === 'subscribe-status') {
          return;
        }

        const parsed = parsePricePayload(payload);
        if (!parsed) return;

        setPrices((prev) => ({
          ...prev,
          [parsed.symbol]: parsed,
        }));
      } catch (error) {
        console.error('[xray] websocket parse error', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[xray] websocket error', error);
    };

    ws.onclose = () => {
      setConnected(false);
      reconnectRef.current = setTimeout(connect, 3000);
    };
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  const subscribe = useCallback((symbols) => {
    const normalized = Array.isArray(symbols)
      ? [...new Set(symbols.map((s) => String(s || '').trim().toUpperCase()).filter(Boolean))]
      : [];

    if (normalized.length === 0) return;
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(
      JSON.stringify({
        action: 'subscribe',
        params: { symbols: normalized.join(',') },
      })
    );
  }, []);

  const unsubscribe = useCallback((symbols) => {
    const normalized = Array.isArray(symbols)
      ? [...new Set(symbols.map((s) => String(s || '').trim().toUpperCase()).filter(Boolean))]
      : [];

    if (normalized.length === 0) return;
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(
      JSON.stringify({
        action: 'unsubscribe',
        params: { symbols: normalized.join(',') },
      })
    );
  }, []);

  return { prices, connected, subscribe, unsubscribe };
}

export default useTwelveDataWS;
