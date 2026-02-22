import { useEffect, useMemo, useState } from 'react';
import { normalizeSymbol } from '../../../lib/twelvedata';

const API_BASE = '/api/xray';

const ENDPOINTS_WITHOUT_PERIOD = new Set(['statistics', 'quote', 'profile']);

export function useFundamentals(symbol, endpoint, period = 'annual') {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null);

  const normalizedSymbol = useMemo(() => normalizeSymbol(symbol), [symbol]);

  useEffect(() => {
    if (!normalizedSymbol || !endpoint) {
      setLoading(false);
      setData(null);
      setError(null);
      setSource(null);
      return;
    }

    const controller = new AbortController();

    const query = new URLSearchParams({ symbol: normalizedSymbol });
    if (!ENDPOINTS_WITHOUT_PERIOD.has(endpoint) && period) {
      query.set('period', period);
    }

    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/${endpoint}?${query.toString()}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((payload) => {
        setData(payload?.data ?? null);
        setSource(payload?.source ?? null);
      })
      .catch((fetchError) => {
        if (fetchError.name === 'AbortError') return;
        console.error(`[xray/useFundamentals] ${endpoint} error:`, fetchError);
        setError(fetchError.message || 'Request failed');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [endpoint, normalizedSymbol, period]);

  return { data, loading, error, source };
}

export function useIncomeStatement(symbol, period = 'annual') {
  return useFundamentals(symbol, 'income-statement', period);
}

export function useBalanceSheet(symbol, period = 'annual') {
  return useFundamentals(symbol, 'balance-sheet', period);
}

export function useCashFlow(symbol, period = 'annual') {
  return useFundamentals(symbol, 'cash-flow', period);
}

export function useStatistics(symbol) {
  return useFundamentals(symbol, 'statistics');
}

export function useQuote(symbol) {
  return useFundamentals(symbol, 'quote');
}

export function useProfile(symbol) {
  return useFundamentals(symbol, 'profile');
}
