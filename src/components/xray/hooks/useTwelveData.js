import { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE = '/api/xray';

const buildUrl = (endpoint, symbol, period) => {
  const params = new URLSearchParams();
  params.set('symbol', String(symbol || '').toUpperCase());
  if (period) params.set('period', period);
  return `${API_BASE}/${endpoint}?${params.toString()}`;
};

export function useFundamentals(symbol, endpoint, period = 'annual') {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);

  const requestUrl = useMemo(() => {
    const normalizedSymbol = String(symbol || '').trim().toUpperCase();
    if (!normalizedSymbol || !endpoint) return null;
    const shouldSendPeriod = endpoint !== 'quote' && endpoint !== 'statistics' && endpoint !== 'profile';
    return buildUrl(endpoint, normalizedSymbol, shouldSendPeriod ? period : null);
  }, [endpoint, period, symbol]);

  useEffect(() => {
    if (!requestUrl) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    let active = true;

    setLoading(true);
    setError(null);

    fetch(requestUrl, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.error || `HTTP ${response.status}`);
        }
        return payload;
      })
      .then((payload) => {
        if (!active) return;
        setData(payload?.data ?? null);
        setLoading(false);
      })
      .catch((fetchError) => {
        if (!active || fetchError?.name === 'AbortError') return;
        setError(fetchError?.message || 'Request failed');
        setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [requestUrl, refreshToken]);

  const refetch = useCallback(() => setRefreshToken((prev) => prev + 1), []);

  return { data, loading, error, refetch };
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
