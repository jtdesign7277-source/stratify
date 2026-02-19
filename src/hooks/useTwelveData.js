import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  disconnectTwelveData,
  subscribeTwelveDataQuotes,
  subscribeTwelveDataStatus,
} from '../services/twelveDataWebSocket';

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeSymbol = (value) => String(value || '').trim().toUpperCase();

export default function useTwelveData({ symbols = [] } = {}) {
  const targetSymbols = useMemo(
    () =>
      [...new Set((Array.isArray(symbols) ? symbols : []).map(normalizeSymbol).filter(Boolean))],
    [symbols]
  );

  const [quotes, setQuotes] = useState({});
  const [status, setStatus] = useState({
    connected: false,
    connecting: false,
    error: null,
    retryCount: 0,
  });
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [timeseries, setTimeseries] = useState({});
  const [loadingTimeseries, setLoadingTimeseries] = useState(false);
  const [error, setError] = useState(null);

  const loadInitialQuotes = useCallback(async () => {
    if (targetSymbols.length === 0) return;
    setLoadingQuotes(true);
    try {
      const response = await fetch(`/api/lse/quotes?symbols=${encodeURIComponent(targetSymbols.join(','))}`, {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Failed to fetch LSE quotes');

      const next = {};
      (payload?.data || []).forEach((item) => {
        const symbol = normalizeSymbol(item?.symbol);
        if (!symbol) return;
        next[symbol] = {
          symbol,
          name: item?.name || symbol,
          exchange: item?.exchange || '',
          currency: item?.currency || '',
          price: toNumber(item?.price),
          change: toNumber(item?.change),
          percentChange: toNumber(item?.percentChange),
          timestamp: item?.timestamp || null,
          source: 'rest',
        };
      });
      setQuotes((prev) => ({ ...prev, ...next }));
      setError(null);
    } catch (loadError) {
      setError(loadError?.message || 'Failed to load LSE quotes');
    } finally {
      setLoadingQuotes(false);
    }
  }, [targetSymbols]);

  const searchSymbols = useCallback(async (query) => {
    const q = String(query || '').trim();
    if (!q) {
      setSearchResults([]);
      return [];
    }
    setLoadingSearch(true);
    try {
      const response = await fetch(`/api/lse/search?q=${encodeURIComponent(q)}`, {
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Failed to search symbols');
      const data = Array.isArray(payload?.data) ? payload.data : [];
      setSearchResults(data);
      return data;
    } catch (searchError) {
      setError(searchError?.message || 'Search failed');
      return [];
    } finally {
      setLoadingSearch(false);
    }
  }, []);

  const loadTimeSeries = useCallback(async (symbol, interval = '5min') => {
    const normalized = normalizeSymbol(symbol);
    if (!normalized) return [];
    setLoadingTimeseries(true);
    try {
      const response = await fetch(
        `/api/lse/timeseries?symbol=${encodeURIComponent(normalized)}&interval=${encodeURIComponent(interval)}`,
        { cache: 'no-store' }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'Failed to fetch timeseries');
      const values = Array.isArray(payload?.values) ? payload.values : [];
      setTimeseries((prev) => ({ ...prev, [normalized]: values }));
      return values;
    } catch (seriesError) {
      setError(seriesError?.message || 'Timeseries request failed');
      return [];
    } finally {
      setLoadingTimeseries(false);
    }
  }, []);

  useEffect(() => {
    loadInitialQuotes();
  }, [loadInitialQuotes]);

  useEffect(() => {
    if (targetSymbols.length === 0) return undefined;

    const unsubscribeQuotes = subscribeTwelveDataQuotes(targetSymbols, (update) => {
      const symbol = normalizeSymbol(update?.symbol);
      if (!symbol) return;
      setQuotes((prev) => ({
        ...prev,
        [symbol]: {
          ...(prev[symbol] || {}),
          symbol,
          name: prev[symbol]?.name || symbol,
          exchange: prev[symbol]?.exchange || 'LSE',
          currency: prev[symbol]?.currency || 'GBP',
          price: toNumber(update?.price),
          change: toNumber(update?.change),
          percentChange: toNumber(update?.percentChange),
          timestamp: update?.timestamp || new Date().toISOString(),
          source: 'ws',
        },
      }));
    });

    const unsubscribeStatus = subscribeTwelveDataStatus((nextStatus) => {
      setStatus(nextStatus);
      if (nextStatus?.error) {
        setError(nextStatus.error);
      }
    });

    return () => {
      unsubscribeQuotes?.();
      unsubscribeStatus?.();
    };
  }, [targetSymbols]);

  useEffect(() => () => disconnectTwelveData(), []);

  const quoteList = useMemo(
    () => targetSymbols.map((symbol) => quotes[symbol]).filter(Boolean),
    [quotes, targetSymbols]
  );

  return {
    quotes,
    quoteList,
    status,
    error,
    loadingQuotes,
    searchResults,
    loadingSearch,
    timeseries,
    loadingTimeseries,
    searchSymbols,
    loadTimeSeries,
    refreshQuotes: loadInitialQuotes,
  };
}
