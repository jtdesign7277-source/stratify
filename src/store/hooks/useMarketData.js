import { useCallback, useEffect, useRef, useState } from 'react';

const API_BASE = 'https://stratify-backend-production-3ebd.up.railway.app';
const WS_URL = 'wss://stratify-backend-production-3ebd.up.railway.app';

const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

const normalizeSymbol = (value) => {
  if (!value) return null;
  return String(value).trim().toUpperCase();
};

const mergeEntry = (current, update) => ({
  symbol: update.symbol || current.symbol,
  price: update.price ?? current.price,
  change: update.change ?? current.change,
  open: update.open ?? current.open,
  high: update.high ?? current.high,
  low: update.low ?? current.low,
  volume: update.volume ?? current.volume,
  askPrice: update.askPrice ?? current.askPrice,
  bidPrice: update.bidPrice ?? current.bidPrice,
});

const mapQuoteToEntry = (quote) => {
  if (!quote) return null;
  const symbol = normalizeSymbol(quote.symbol || quote.ticker || quote.Symbol);
  if (!symbol) return null;

  return {
    symbol,
    price: quote.price ?? quote.last ?? quote.lastPrice,
    change: quote.change ?? quote.changeToday ?? quote.changePercent,
    askPrice: quote.askPrice ?? quote.ask ?? quote.ask_price,
    bidPrice: quote.bidPrice ?? quote.bid ?? quote.bid_price,
  };
};

const mapBarToEntry = (bar) => {
  if (!bar) return null;
  const symbol = normalizeSymbol(bar.symbol || bar.ticker || bar.Symbol);
  if (!symbol) return null;

  return {
    symbol,
    open: bar.open ?? bar.o,
    high: bar.high ?? bar.h,
    low: bar.low ?? bar.l,
    volume: bar.volume ?? bar.v,
  };
};

const buildInitialMap = (quotes, bars) => {
  const nextMap = new Map();

  if (Array.isArray(quotes)) {
    quotes.forEach((quote) => {
      const entry = mapQuoteToEntry(quote);
      if (!entry) return;
      nextMap.set(entry.symbol, mergeEntry({ symbol: entry.symbol }, entry));
    });
  }

  if (Array.isArray(bars)) {
    bars.forEach((bar) => {
      const entry = mapBarToEntry(bar);
      if (!entry) return;
      const current = nextMap.get(entry.symbol) || { symbol: entry.symbol };
      nextMap.set(entry.symbol, mergeEntry(current, entry));
    });
  }

  return nextMap;
};

const applyQuoteUpdate = (prevMap, update) => {
  const updates = [];

  if (Array.isArray(update)) {
    updates.push(...update);
  } else if (update && typeof update === 'object') {
    if (Array.isArray(update.data)) {
      updates.push(...update.data);
    } else if (update.data) {
      updates.push(update.data);
    } else {
      updates.push(update);
    }
  }

  if (updates.length === 0) return prevMap;

  const nextMap = new Map(prevMap);

  updates.forEach((quote) => {
    const entry = mapQuoteToEntry(quote);
    if (!entry) return;
    const current = nextMap.get(entry.symbol) || { symbol: entry.symbol };
    nextMap.set(entry.symbol, mergeEntry(current, entry));
  });

  return nextMap;
};

const useMarketData = () => {
  const [prices, setPrices] = useState(() => new Map());
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY);
  const reconnectTimerRef = useRef(null);
  const socketRef = useRef(null);

  const getPrice = useCallback((symbol) => {
    if (!symbol) return undefined;
    return prices.get(normalizeSymbol(symbol));
  }, [prices]);

  useEffect(() => {
    let isCancelled = false;
    const controller = new AbortController();

    const loadMarketData = async () => {
      setLoading(true);

      try {
        const [quotesResponse, barsResponse] = await Promise.all([
          fetch(`${API_BASE}/api/stocks/quotes`, { signal: controller.signal }),
          fetch(`${API_BASE}/api/stocks/bars`, { signal: controller.signal }),
        ]);

        if (!quotesResponse.ok || !barsResponse.ok) {
          throw new Error('Failed to load market data.');
        }

        const [quotes, bars] = await Promise.all([
          quotesResponse.json(),
          barsResponse.json(),
        ]);

        if (!isCancelled) {
          setPrices(buildInitialMap(quotes, bars));
        }
      } catch (error) {
        if (!isCancelled) {
          setPrices((prev) => new Map(prev));
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadMarketData();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    let shouldReconnect = true;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const scheduleReconnect = () => {
      if (!shouldReconnect) return;
      clearReconnectTimer();

      const delay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY);
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    const handleMessage = (event) => {
      if (!event?.data) return;

      try {
        const parsed = JSON.parse(event.data);
        setPrices((prev) => applyQuoteUpdate(prev, parsed));
      } catch (error) {
        // Ignore malformed payloads.
      }
    };

    const connect = () => {
      if (!shouldReconnect) return;

      const socket = new WebSocket(WS_URL);
      socketRef.current = socket;

      socket.onopen = () => {
        if (!shouldReconnect) return;
        setConnected(true);
        reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
      };

      socket.onmessage = handleMessage;

      socket.onerror = () => {
        if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
          socket.close();
        }
      };

      socket.onclose = () => {
        if (!shouldReconnect) return;
        setConnected(false);
        scheduleReconnect();
      };
    };

    connect();

    return () => {
      shouldReconnect = false;
      clearReconnectTimer();

      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, []);

  return {
    prices,
    getPrice,
    loading,
    connected,
  };
};

export default useMarketData;
