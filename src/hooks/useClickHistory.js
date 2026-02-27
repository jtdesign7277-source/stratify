import { useState, useEffect, useCallback } from 'react';
import supabase from '../lib/supabaseClient';

const LOCAL_STORAGE_KEY = 'stratify_click_history';
const MAX_HISTORY_ITEMS = 100;

const normalizeString = (value) => {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
};

const sortByClickedAtDesc = (items) =>
  [...items].sort((a, b) => {
    const aTime = new Date(a?.clicked_at || 0).getTime();
    const bTime = new Date(b?.clicked_at || 0).getTime();
    return bTime - aTime;
  });

const normalizeHistory = (items) => {
  const deduped = [];
  const seen = new Set();

  for (const item of sortByClickedAtDesc(Array.isArray(items) ? items : [])) {
    if (!item || typeof item !== 'object') continue;

    const contentType = normalizeString(item.content_type);
    const contentId = normalizeString(item.content_id);
    if (!contentType || !contentId) continue;

    const dedupeKey = `${contentType}::${contentId}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    deduped.push({
      ...item,
      content_type: contentType,
      content_id: contentId,
      title: normalizeString(item.title),
      source: normalizeString(item.source),
      thumbnail_url: normalizeString(item.thumbnail_url),
      url: normalizeString(item.url),
      clicked_at: item.clicked_at || new Date().toISOString(),
    });

    if (deduped.length >= MAX_HISTORY_ITEMS) break;
  }

  return deduped;
};

const readLocalHistory = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    return normalizeHistory(JSON.parse(raw));
  } catch {
    return [];
  }
};

const writeLocalHistory = (items) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(normalizeHistory(items)));
  } catch {
    // Ignore cache write failures.
  }
};

const mergeClick = (history, entry) => normalizeHistory([entry, ...(Array.isArray(history) ? history : [])]);

export default function useClickHistory() {
  const [history, setHistory] = useState(() => readLocalHistory());
  const [loading, setLoading] = useState(true);

  const setHistoryAndCache = useCallback((nextValue) => {
    setHistory((previous) => {
      const resolved = typeof nextValue === 'function' ? nextValue(previous) : nextValue;
      const normalized = normalizeHistory(resolved);
      writeLocalHistory(normalized);
      return normalized;
    });
  }, []);

  const getCurrentUserId = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) return null;
      return data?.user?.id || null;
    } catch {
      return null;
    }
  }, []);

  const fetchRemoteHistory = useCallback(async (userId) => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('user_click_history')
      .select('id, user_id, content_type, content_id, title, source, thumbnail_url, url, clicked_at')
      .eq('user_id', userId)
      .order('clicked_at', { ascending: false })
      .limit(MAX_HISTORY_ITEMS);

    if (error) {
      throw error;
    }

    setHistoryAndCache(Array.isArray(data) ? data : []);
  }, [setHistoryAndCache]);

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      setLoading(true);

      try {
        const userId = await getCurrentUserId();
        if (cancelled || !userId) return;
        await fetchRemoteHistory(userId);
      } catch (error) {
        if (!cancelled) {
          console.warn('[useClickHistory] Failed to load history:', error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [fetchRemoteHistory, getCurrentUserId]);

  const trackClick = useCallback(
    async (contentType, contentId, title, source, thumbnailUrl, url) => {
      const normalizedContentType = normalizeString(contentType);
      const normalizedContentId = normalizeString(contentId);
      if (!normalizedContentType || !normalizedContentId) return;

      const clickedAt = new Date().toISOString();
      const optimisticEntry = {
        content_type: normalizedContentType,
        content_id: normalizedContentId,
        title: normalizeString(title),
        source: normalizeString(source),
        thumbnail_url: normalizeString(thumbnailUrl),
        url: normalizeString(url),
        clicked_at: clickedAt,
      };

      setHistoryAndCache((previous) => mergeClick(previous, optimisticEntry));

      const userId = await getCurrentUserId();
      if (!userId) return;

      const { data, error } = await supabase
        .from('user_click_history')
        .upsert(
          {
            user_id: userId,
            ...optimisticEntry,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,content_type,content_id' }
        )
        .select('id, user_id, content_type, content_id, title, source, thumbnail_url, url, clicked_at')
        .maybeSingle();

      if (error) {
        console.warn('[useClickHistory] Failed to track click:', error.message || error);
        return;
      }

      if (data) {
        setHistoryAndCache((previous) => mergeClick(previous, data));
      }
    },
    [getCurrentUserId, setHistoryAndCache]
  );

  const clearHistory = useCallback(async () => {
    setHistoryAndCache([]);

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(LOCAL_STORAGE_KEY);
      } catch {
        // Ignore cache delete failures.
      }
    }

    const userId = await getCurrentUserId();
    if (!userId) return;

    const { error } = await supabase.from('user_click_history').delete().eq('user_id', userId);
    if (error) {
      console.warn('[useClickHistory] Failed to clear history:', error.message || error);
    }
  }, [getCurrentUserId, setHistoryAndCache]);

  return {
    history,
    loading,
    trackClick,
    clearHistory,
  };
}
