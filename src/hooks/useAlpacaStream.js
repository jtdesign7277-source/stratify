import { useEffect, useMemo, useState } from 'react';
import {
  reconnectCryptoStream,
  reconnectStocksStream,
  subscribeAlpacaStatus,
  subscribeCrypto,
  subscribeStocks,
} from '../services/alpacaStream';

const normalizeStockSymbols = (symbols = []) => (
  [...new Set(
    symbols
      .map((symbol) => String(symbol || '').trim().replace(/^\$/, '').toUpperCase())
      .filter(Boolean)
  )]
);

const normalizeCryptoSymbols = (symbols = []) => (
  [...new Set(
    symbols
      .map((symbol) => String(symbol || '').trim().replace(/^\$/, '').toUpperCase().replace(/_/g, '-').replace(/\//g, '-'))
      .filter(Boolean)
  )]
);

/**
 * Shared real-time Alpaca stream hook.
 * Uses a singleton stream manager so the app maintains only one stock + one crypto socket.
 */
export const useAlpacaStream = ({
  stockSymbols = [],
  cryptoSymbols = [],
  enabled = true,
}) => {
  const [stockQuotes, setStockQuotes] = useState({});
  const [cryptoQuotes, setCryptoQuotes] = useState({});
  const [stockConnected, setStockConnected] = useState(false);
  const [cryptoConnected, setCryptoConnected] = useState(false);
  const [error, setError] = useState(null);

  const normalizedStockSymbols = useMemo(() => normalizeStockSymbols(stockSymbols), [stockSymbols]);
  const normalizedCryptoSymbols = useMemo(() => normalizeCryptoSymbols(cryptoSymbols), [cryptoSymbols]);

  const stockSymbolsKey = normalizedStockSymbols.join(',');
  const cryptoSymbolsKey = normalizedCryptoSymbols.join(',');

  useEffect(() => {
    if (!enabled) {
      setStockConnected(false);
      setCryptoConnected(false);
      setError(null);
      return undefined;
    }

    const unsubscribe = subscribeAlpacaStatus((status) => {
      setStockConnected(Boolean(status?.stockConnected));
      setCryptoConnected(Boolean(status?.cryptoConnected));
      setError(status?.error || null);
    });

    return unsubscribe;
  }, [enabled]);

  useEffect(() => {
    if (!enabled || normalizedStockSymbols.length === 0) return undefined;

    return subscribeStocks(normalizedStockSymbols, ({ symbol, quote }) => {
      if (!symbol || !quote) return;

      setStockQuotes((prev) => ({
        ...prev,
        [symbol]: {
          ...prev[symbol],
          ...quote,
        },
      }));
    });
  }, [enabled, stockSymbolsKey]);

  useEffect(() => {
    if (!enabled || normalizedCryptoSymbols.length === 0) return undefined;

    return subscribeCrypto(normalizedCryptoSymbols, ({ symbol, quote }) => {
      if (!symbol || !quote) return;

      setCryptoQuotes((prev) => ({
        ...prev,
        [symbol]: {
          ...prev[symbol],
          ...quote,
        },
      }));
    });
  }, [enabled, cryptoSymbolsKey]);

  return {
    stockQuotes,
    cryptoQuotes,
    stockConnected,
    cryptoConnected,
    isConnected: stockConnected || cryptoConnected,
    error,
    reconnectStock: reconnectStocksStream,
    reconnectCrypto: reconnectCryptoStream,
  };
};

export default useAlpacaStream;
