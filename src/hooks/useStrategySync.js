import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const EMPTY_STATE = {
  strategies: [],
  savedStrategies: [],
  deployedStrategies: [],
};

const normalizeList = (value) => (Array.isArray(value) ? value : []);

const isDeployedStrategy = (strategy) => {
  if (!strategy || typeof strategy !== 'object') return false;
  const status = String(strategy.status ?? '').toLowerCase();
  const runStatus = String(strategy.runStatus ?? '').toLowerCase();
  return (
    strategy.deployed === true ||
    status === 'deployed' ||
    status === 'active' ||
    status === 'live' ||
    runStatus === 'running'
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

export default function useStrategySync(user) {
  const [strategies, setStrategies] = useState([]);
  const [savedStrategies, setSavedStrategies] = useState([]);
  const [deployedStrategies, setDeployedStrategies] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const saveTimer = useRef(null);
  const lastSaved = useRef('');

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
      setStrategies([]);
      setSavedStrategies([]);
      setDeployedStrategies([]);
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
            setStrategies([]);
            setSavedStrategies([]);
            setDeployedStrategies([]);
            lastSaved.current = '';
          }
          return;
        }

        const next = normalizeStrategyPayload(data?.strategies);
        if (cancelled) return;

        setStrategies(next.strategies);
        setSavedStrategies(next.savedStrategies);
        setDeployedStrategies(next.deployedStrategies);
        lastSaved.current = JSON.stringify({
          strategies: next.strategies,
          savedStrategies: next.savedStrategies,
          deployedStrategies: next.deployedStrategies,
        });
      } catch (error) {
        if (!cancelled) {
          console.warn('[StrategySync] Load failed:', error);
          setStrategies([]);
          setSavedStrategies([]);
          setDeployedStrategies([]);
          lastSaved.current = '';
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };

    loadFromSupabase();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !supabase || !loaded) return;

    const payload = {
      strategies,
      savedStrategies,
      deployedStrategies,
    };

    const serialized = JSON.stringify(payload);
    if (serialized === lastSaved.current) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveToSupabase(user.id, payload);
    }, 1200);

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

