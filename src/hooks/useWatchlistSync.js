import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

const LOCAL_KEY = 'stratify-watchlist';

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
 * useWatchlistSync - Manages watchlist with Supabase persistence
 * 
 * - Authenticated users: reads/writes to Supabase `profiles.watchlist` (JSONB)
 * - Guest users: falls back to localStorage
 * - On first login, merges any localStorage watchlist into Supabase
 * - Debounces saves to avoid hammering the DB on rapid changes
 */
export default function useWatchlistSync(user) {
  const [watchlist, setWatchlist] = useState(() => {
    try {
      const saved = localStorage.getItem(LOCAL_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.length > 0 ? parsed : DEFAULT_WATCHLIST;
      }
      return DEFAULT_WATCHLIST;
    } catch {
      return DEFAULT_WATCHLIST;
    }
  });

  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef(null);
  const lastSaved = useRef(null);

  // Load watchlist from Supabase when user logs in
  useEffect(() => {
    if (!user || !supabase) {
      setLoaded(true);
      return;
    }

    const loadFromSupabase = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('watchlist')
          .eq('id', user.id)
          .single();

        if (error) {
          console.warn('[WatchlistSync] Error loading from Supabase:', error.message);
          setLoaded(true);
          return;
        }

        if (data?.watchlist && Array.isArray(data.watchlist) && data.watchlist.length > 0) {
          // Supabase has a saved watchlist — use it
          setWatchlist(data.watchlist);
          localStorage.setItem(LOCAL_KEY, JSON.stringify(data.watchlist));
          console.log('[WatchlistSync] Loaded from Supabase:', data.watchlist.length, 'items');
        } else {
          // No watchlist in Supabase yet — push localStorage version up
          const local = getLocalWatchlist();
          if (local.length > 0) {
            await saveToSupabase(user.id, local);
            console.log('[WatchlistSync] Pushed localStorage watchlist to Supabase');
          }
        }
      } catch (err) {
        console.warn('[WatchlistSync] Failed to load:', err);
      }
      setLoaded(true);
    };

    loadFromSupabase();
  }, [user]);

  // Save to Supabase (debounced)
  const saveToSupabase = useCallback(async (userId, items) => {
    if (!supabase || !userId) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ watchlist: items, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) {
        console.warn('[WatchlistSync] Save error:', error.message);
      } else {
        lastSaved.current = JSON.stringify(items);
        console.log('[WatchlistSync] Saved to Supabase');
      }
    } catch (err) {
      console.warn('[WatchlistSync] Save failed:', err);
    }
  }, []);

  // Debounced save whenever watchlist changes
  useEffect(() => {
    // Always save to localStorage immediately
    localStorage.setItem(LOCAL_KEY, JSON.stringify(watchlist));

    // If logged in, debounce save to Supabase
    if (user && supabase && loaded) {
      const serialized = JSON.stringify(watchlist);
      if (serialized === lastSaved.current) return; // No change

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveToSupabase(user.id, watchlist);
      }, 1500); // 1.5s debounce
    }

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [watchlist, user, loaded, saveToSupabase]);

  // Helper: get localStorage watchlist
  const getLocalWatchlist = () => {
    try {
      const saved = localStorage.getItem(LOCAL_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_WATCHLIST;
    } catch {
      return DEFAULT_WATCHLIST;
    }
  };

  // Watchlist mutation helpers (same API as before)
  const addToWatchlist = useCallback((item) => {
    setWatchlist(prev => {
      const normalized = typeof item === 'string'
        ? { symbol: item, name: item }
        : item;
      const exists = prev.some(w => {
        const symbol = typeof w === 'string' ? w : w.symbol;
        return symbol === normalized.symbol;
      });
      if (exists) return prev;
      return [normalized, ...prev];
    });
  }, []);

  const removeFromWatchlist = useCallback((symbol) => {
    setWatchlist(prev => prev.filter(w => {
      const itemSymbol = typeof w === 'string' ? w : w.symbol;
      return itemSymbol !== symbol;
    }));
  }, []);

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
