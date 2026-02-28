// /src/hooks/useMarketAux.js
// Custom hook for MarketAux sentiment + news data
// Follows Stratify cache-first pattern: instant from cache → background refresh

import { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || '';

// ─── Sentiment Hook ─────────────────────────────────────────
export function useSentiment(symbols = []) {
  const [sentimentMap, setSentimentMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);

  const fetchSentiment = useCallback(async () => {
    if (!symbols.length) return;

    try {
      const symbolStr = symbols.join(',');
      const res = await fetch(`${API_BASE}/api/marketaux/sentiment?symbols=${symbolStr}`);

      if (!res.ok) throw new Error(`Sentiment API ${res.status}`);

      const data = await res.json();
      setSentimentMap(data.sentimentMap || {});
      setError(null);
    } catch (err) {
      console.error('Sentiment fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [symbols.join(',')]);

  useEffect(() => {
    fetchSentiment();

    // Refresh every 5 minutes (matches cache TTL)
    intervalRef.current = setInterval(fetchSentiment, 5 * 60 * 1000);
    return () => clearInterval(intervalRef.current);
  }, [fetchSentiment]);

  return { sentimentMap, loading, error, refetch: fetchSentiment };
}

// ─── News Hook ──────────────────────────────────────────────
export function useNews(symbol, { limit = 10, page = 1, enabled = true } = {}) {
  const [articles, setArticles] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchNews = useCallback(async () => {
    if (!symbol || !enabled) return;

    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/marketaux/news?symbols=${symbol}&limit=${limit}&page=${page}`
      );

      if (!res.ok) throw new Error(`News API ${res.status}`);

      const data = await res.json();
      setArticles(data.articles || []);
      setMeta(data.meta || {});
      setError(null);
    } catch (err) {
      console.error('News fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [symbol, limit, page, enabled]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  return { articles, meta, loading, error, refetch: fetchNews };
}

// ─── Trending Hook ──────────────────────────────────────────
export function useTrending({ countries = 'us', minDocCount = 5 } = {}) {
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTrending = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BASE}/api/marketaux/trending?countries=${countries}&min_doc_count=${minDocCount}`
      );

      if (!res.ok) throw new Error(`Trending API ${res.status}`);

      const data = await res.json();
      setTrending(data.trending || []);
      setError(null);
    } catch (err) {
      console.error('Trending fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [countries, minDocCount]);

  useEffect(() => {
    fetchTrending();
    const interval = setInterval(fetchTrending, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchTrending]);

  return { trending, loading, error, refetch: fetchTrending };
}

// ─── Sentiment Helpers ──────────────────────────────────────
export function getSentimentLabel(score) {
  if (score === null || score === undefined) return 'N/A';
  if (score >= 0.5) return 'Very Bullish';
  if (score >= 0.2) return 'Bullish';
  if (score >= -0.2) return 'Neutral';
  if (score >= -0.5) return 'Bearish';
  return 'Very Bearish';
}

export function getSentimentColor(score) {
  if (score === null || score === undefined) return { text: 'text-gray-500', bg: 'bg-gray-500/10', border: 'border-gray-500/20' };
  if (score >= 0.5) return { text: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/25' };
  if (score >= 0.2) return { text: 'text-emerald-400/80', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
  if (score >= -0.2) return { text: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/20' };
  if (score >= -0.5) return { text: 'text-red-400/80', bg: 'bg-red-500/10', border: 'border-red-500/20' };
  return { text: 'text-red-400', bg: 'bg-red-500/15', border: 'border-red-500/25' };
}
