import { useEffect, useState } from 'react';

const STORAGE_KEY = 'stratify-watchlist';
const DEFAULT_SYMBOLS = ['NVDA', 'AAPL', 'TSLA', 'AMD', 'MSFT', 'META', 'GOOGL', 'AMZN'];

const normalizeSymbol = (value) => {
  if (!value) return null;
  const raw = typeof value === 'object' ? (value.symbol ?? value.ticker ?? value.Symbol) : value;
  const normalized = String(raw || '').trim().toUpperCase();
  return normalized ? normalized : null;
};

const normalizeList = (list) => {
  if (!Array.isArray(list)) return [];
  const next = [];
  const seen = new Set();

  list.forEach((item) => {
    const symbol = normalizeSymbol(item);
    if (!symbol || seen.has(symbol)) return;
    seen.add(symbol);
    next.push(symbol);
  });

  return next;
};

export const useWatchlist = (initialSymbols = DEFAULT_SYMBOLS) => {
  const [symbols, setSymbols] = useState(() => {
    const fallback = normalizeList(initialSymbols);
    if (typeof window === 'undefined') return fallback;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return fallback;
      const parsed = JSON.parse(stored);
      const normalized = normalizeList(parsed);
      return normalized.length > 0 ? normalized : fallback;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
    } catch {
      // Ignore storage write errors (private mode, quota, SSR).
    }
  }, [symbols]);

  const addSymbol = (symbol) => {
    const normalized = normalizeSymbol(symbol);
    if (!normalized) return;
    setSymbols((prev) => (prev.includes(normalized) ? prev : [...prev, normalized]));
  };

  const removeSymbol = (symbol) => {
    const normalized = normalizeSymbol(symbol);
    if (!normalized) return;
    setSymbols((prev) => prev.filter((item) => item !== normalized));
  };

  return {
    symbols,
    addSymbol,
    removeSymbol,
  };
};

export default useWatchlist;
