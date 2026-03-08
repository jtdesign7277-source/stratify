import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

const DEFAULT_WATCHLIST = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'META', name: 'Meta Platforms, Inc.' },
  { symbol: 'TSLA', name: 'Tesla, Inc.' },
];

/**
 * useWatchlistSync - Manages watchlist with Supabase persistence (watchlist table)
 */
export default function useWatchlistSync(user) {
  const [watchlist, setWatchlist] = useState(DEFAULT_WATCHLIST);
  const [loaded, setLoaded] = useState(false);

  // Load watchlist from Supabase watchlist table when user is available
  useEffect(() => {
    if (!user?.id || !supabase) {
      setLoaded(true);
      return;
    }

    let cancelled = false;

    const loadFromSupabase = async () => {
      try {
        const { data, error } = await supabase
          .from('watchlist')
          .select('symbol, sort_order')
          .eq('user_id', user.id)
          .order('sort_order');

        if (cancelled) return;
        if (error) {
          console.warn('[WatchlistSync] Error loading from Supabase:', error.message);
          setLoaded(true);
          return;
        }

        const symbols = Array.isArray(data) ? data.map((r) => r.symbol) : [];
        setWatchlist(symbols.length > 0 ? symbols.map((s) => ({ symbol: s, name: s })) : DEFAULT_WATCHLIST);
      } catch (err) {
        if (!cancelled) console.warn('[WatchlistSync] Failed to load:', err);
      }
      if (!cancelled) setLoaded(true);
    };

    loadFromSupabase();
    return () => { cancelled = true; };
  }, [user?.id]);

  const addToWatchlist = useCallback(async (item) => {
    const normalized = typeof item === 'string' ? { symbol: item, name: item } : item;
    const newSymbol = (normalized?.symbol || normalized).toString().trim().toUpperCase();
    if (!newSymbol) return;

    setWatchlist((prev) => {
      const exists = prev.some((w) => (typeof w === 'string' ? w : w.symbol) === newSymbol);
      return exists ? prev : [normalized, ...prev];
    });

    if (user?.id && supabase) {
      const sortOrder = watchlist.length;
      const { error } = await supabase.from('watchlist').insert({
        user_id: user.id,
        symbol: newSymbol,
        sort_order: sortOrder,
      });
      if (error) console.warn('[WatchlistSync] Add error:', error.message);
    }
  }, [user?.id, watchlist.length]);

  const removeFromWatchlist = useCallback(async (symbol) => {
    const sym = (symbol || '').toString().trim().toUpperCase();
    if (!sym) return;

    setWatchlist((prev) => prev.filter((w) => (typeof w === 'string' ? w : w.symbol) !== sym));

    if (!user?.id || !supabase) return;
    const { error } = await supabase.from('watchlist').delete().eq('user_id', user.id).eq('symbol', sym);
    if (error) console.warn('[WatchlistSync] Remove error:', error.message);
  }, [user?.id]);

  const reorderWatchlist = useCallback((sourceIndexOrOrder, destIndex) => {
    if (Array.isArray(sourceIndexOrOrder)) {
      setWatchlist(sourceIndexOrOrder);
      return;
    }

    if (typeof sourceIndexOrOrder !== 'number' || typeof destIndex !== 'number') return;

    setWatchlist(prev => {
      const reordered = Array.from(prev);
      const [removed] = reordered.splice(sourceIndexOrOrder, 1);
      if (!removed) return prev;
      reordered.splice(destIndex, 0, removed);
      return reordered;
    });
  }, []);

  const pinToTop = useCallback((symbol) => {
    setWatchlist(prev => {
      const idx = prev.findIndex(w => {
        const itemSymbol = typeof w === 'string' ? w : w.symbol;
        return itemSymbol === symbol;
      });
      if (idx <= 0) return prev;
      const item = prev[idx];
      const rest = prev.filter((_, i) => i !== idx);
      return [item, ...rest];
    });
  }, []);

  return {
    watchlist,
    setWatchlist,
    addToWatchlist,
    removeFromWatchlist,
    reorderWatchlist,
    pinToTop,
    loaded,
  };
}
