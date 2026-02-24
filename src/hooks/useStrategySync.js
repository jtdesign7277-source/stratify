import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const LOCAL_STORAGE_KEY = 'stratify-strategy-sync';

const EMPTY_STATE = {
  strategies: [],
  savedStrategies: [],
  deployedStrategies: [],
};

const normalizeList = (value) => (Array.isArray(value) ? value : []);

const strategyIdentityKey = (strategy) => {
  if (!strategy || typeof strategy !== 'object') return '';
  const id = String(strategy.id || '').trim();
  if (id) return `id:${id}`;

  const name = String(strategy.name || '').trim().toLowerCase();
  const ticker = String(
    strategy.ticker ||
      strategy.symbol ||
      strategy.summary?.ticker ||
      strategy.symbols?.[0] ||
      '',
  )
    .trim()
    .toLowerCase();
  const savedAt = String(strategy.savedAt || strategy.createdAt || strategy.updatedAt || '').trim();

  if (!name && !ticker && !savedAt) return '';
  return `sig:${name}|${ticker}|${savedAt}`;
};

const mergeStrategyLists = (preferred, fallback) => {
  const preferredList = normalizeList(preferred).filter((item) => item && typeof item === 'object');
  const fallbackList = normalizeList(fallback).filter((item) => item && typeof item === 'object');

  const mergedByKey = new Map();

  fallbackList.forEach((item) => {
    const key = strategyIdentityKey(item);
    if (!key) return;
    mergedByKey.set(key, item);
  });

  preferredList.forEach((item) => {
    const key = strategyIdentityKey(item);
    if (!key) return;
    const existing = mergedByKey.get(key);
    mergedByKey.set(key, existing ? { ...existing, ...item } : item);
  });

  const used = new Set();
  const ordered = [];

  const appendOrdered = (list) => {
    list.forEach((item) => {
      const key = strategyIdentityKey(item);
      if (!key || used.has(key)) return;
      used.add(key);
      ordered.push(mergedByKey.get(key) || item);
    });
  };

  appendOrdered(preferredList);
  appendOrdered(fallbackList);

  return ordered;
};

const isDeployedStrategy = (strategy) => {
  if (!strategy || typeof strategy !== 'object') return false;
  const status = String(strategy.status ?? '').toLowerCase();
  const runStatus = String(strategy.runStatus ?? '').toLowerCase();
  return (
    strategy.deployed === true ||
    status === 'deployed' ||
    status === 'active' ||
    status === 'live' ||
    status === 'paused' ||
    runStatus === 'running'
    || runStatus === 'paused'
    || Number.isFinite(Number(strategy.activatedAt))
    || Number.isFinite(Number(strategy.deployedAt))
  );
};

const normalizeStrategyPayload = (raw) => {
  if (!raw) return { ...EMPTY_STATE };

  if (Array.isArray(raw)) {
    const base = raw.filter((item) => item && typeof item === 'object');
    const deployedStrategies = base.filter(isDeployedStrategy);
    return {
      strategies: base,
      savedStrategies: base,
      deployedStrategies,
    };
  }

  if (typeof raw !== 'object') return { ...EMPTY_STATE };

  const strategies = normalizeList(raw.strategies ?? raw.draftStrategies ?? raw.drafts ?? raw.items);
  const savedStrategies = normalizeList(raw.savedStrategies ?? raw.saved ?? raw.library);
  const deployedStrategies = normalizeList(
    raw.deployedStrategies ?? raw.deployed ?? raw.activeStrategies,
  );

  return {
    strategies,
    savedStrategies,
    deployedStrategies,
  };
};

const mergeStrategyPayload = (preferredRaw, fallbackRaw) => {
  const preferred = normalizeStrategyPayload(preferredRaw);
  const fallback = normalizeStrategyPayload(fallbackRaw);

  return {
    strategies: mergeStrategyLists(preferred.strategies, fallback.strategies),
    savedStrategies: mergeStrategyLists(preferred.savedStrategies, fallback.savedStrategies),
    deployedStrategies: mergeStrategyLists(preferred.deployedStrategies, fallback.deployedStrategies),
  };
};

const loadLocalState = () => {
  if (typeof window === 'undefined') return { ...EMPTY_STATE };

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return { ...EMPTY_STATE };
    return normalizeStrategyPayload(JSON.parse(raw));
  } catch {
    return { ...EMPTY_STATE };
  }
};

const saveLocalState = (payload) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
  } catch {}
};

const hasStrategyData = (payload) => (
  Array.isArray(payload?.strategies) && payload.strategies.length > 0
) || (
  Array.isArray(payload?.savedStrategies) && payload.savedStrategies.length > 0
) || (
  Array.isArray(payload?.deployedStrategies) && payload.deployedStrategies.length > 0
);

export default function useStrategySync(user) {
  const [strategies, setStrategies] = useState([]);
  const [savedStrategies, setSavedStrategies] = useState([]);
  const [deployedStrategies, setDeployedStrategies] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const saveTimer = useRef(null);
  const lastSaved = useRef('');
  const latestPayload = useRef({ ...EMPTY_STATE });

  const saveToSupabase = useCallback(async (userId, payload) => {
    if (!userId || !supabase) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          strategies: payload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) {
        console.warn('[StrategySync] Save error:', error.message);
      } else {
        lastSaved.current = JSON.stringify(payload);
      }
    } catch (error) {
      console.warn('[StrategySync] Save failed:', error);
    }
  }, []);

  useEffect(() => {
    if (!user?.id || !supabase) {
      const local = loadLocalState();
      const resolvedLocal = mergeStrategyPayload(local, latestPayload.current);
      setStrategies(resolvedLocal.strategies);
      setSavedStrategies(resolvedLocal.savedStrategies);
      setDeployedStrategies(resolvedLocal.deployedStrategies);
      saveLocalState(resolvedLocal);
      lastSaved.current = JSON.stringify(resolvedLocal);
      setLoaded(true);
      return;
    }

    let cancelled = false;

    const loadFromSupabase = async () => {
      setLoaded(false);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('strategies')
          .eq('id', user.id)
          .maybeSingle();

        if (error) {
          console.warn('[StrategySync] Load error:', error.message);
          if (!cancelled) {
            const fallback = mergeStrategyPayload(loadLocalState(), latestPayload.current);
            setStrategies(fallback.strategies);
            setSavedStrategies(fallback.savedStrategies);
            setDeployedStrategies(fallback.deployedStrategies);
            saveLocalState(fallback);
            lastSaved.current = JSON.stringify(fallback);
          }
          return;
        }

        const remote = normalizeStrategyPayload(data?.strategies);
        const local = loadLocalState();
        const inMemory = latestPayload.current;
        const resolved = mergeStrategyPayload(mergeStrategyPayload(local, inMemory), remote);
        const serializedResolved = JSON.stringify(resolved);
        if (cancelled) return;

        setStrategies(resolved.strategies);
        setSavedStrategies(resolved.savedStrategies);
        setDeployedStrategies(resolved.deployedStrategies);
        saveLocalState(resolved);
        lastSaved.current = serializedResolved;

        if (serializedResolved !== JSON.stringify(remote)) {
          saveToSupabase(user.id, resolved);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('[StrategySync] Load failed:', error);
          const fallback = mergeStrategyPayload(loadLocalState(), latestPayload.current);
          setStrategies(fallback.strategies);
          setSavedStrategies(fallback.savedStrategies);
          setDeployedStrategies(fallback.deployedStrategies);
          saveLocalState(fallback);
          lastSaved.current = JSON.stringify(fallback);
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };

    loadFromSupabase();

    return () => {
      cancelled = true;
    };
  }, [user?.id, saveToSupabase]);

  useEffect(() => {
    const payload = {
      strategies,
      savedStrategies,
      deployedStrategies,
    };
    latestPayload.current = payload;

    const serialized = JSON.stringify(payload);
    if (!loaded && !hasStrategyData(payload)) return;

    saveLocalState(payload);
    if (!loaded) return;
    if (serialized === lastSaved.current) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (!user?.id || !supabase) {
        lastSaved.current = serialized;
        return;
      }
      saveToSupabase(user.id, payload);
    }, 2000);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [strategies, savedStrategies, deployedStrategies, user?.id, loaded, saveToSupabase]);

  return {
    strategies,
    setStrategies,
    savedStrategies,
    setSavedStrategies,
    deployedStrategies,
    setDeployedStrategies,
    loaded,
  };
}
