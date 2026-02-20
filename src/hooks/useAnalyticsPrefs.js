import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

const LOCAL_KEY = 'stratify-analytics-prefs';
const DEBOUNCE_MS = 500;

const DEFAULT_PREFS = {
  symbol: 'AAPL',
  interval: '1day',
  indicators: ['sma20', 'volume'],
  drawings: [],
  chartType: 'candlestick',
};

const loadLocal = () => {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_PREFS };
  } catch {
    return { ...DEFAULT_PREFS };
  }
};

const saveLocal = (prefs) => {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
};

export default function useAnalyticsPrefs() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState(loadLocal);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef(null);
  const latestPrefs = useRef(prefs);

  latestPrefs.current = prefs;

  // Load from Supabase on mount / user change
  useEffect(() => {
    if (!user?.id) {
      setLoaded(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('analytics_preferences')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (cancelled) return;
        if (data) {
          const loaded = {
            symbol: data.symbol || DEFAULT_PREFS.symbol,
            interval: data.interval || DEFAULT_PREFS.interval,
            indicators: Array.isArray(data.indicators) ? data.indicators : DEFAULT_PREFS.indicators,
            drawings: Array.isArray(data.drawings) ? data.drawings : DEFAULT_PREFS.drawings,
            chartType: data.chart_type || DEFAULT_PREFS.chartType,
          };
          setPrefs(loaded);
          saveLocal(loaded);
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoaded(true);
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  // Debounced save
  const persistToSupabase = useCallback((next) => {
    saveLocal(next);
    if (!user?.id) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await supabase.from('analytics_preferences').upsert({
          user_id: user.id,
          symbol: next.symbol,
          interval: next.interval,
          indicators: next.indicators,
          drawings: next.drawings,
          chart_type: next.chartType,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      } catch { /* ignore */ }
    }, DEBOUNCE_MS);
  }, [user?.id]);

  const updatePrefs = useCallback((partial) => {
    setPrefs((prev) => {
      const next = { ...prev, ...partial };
      persistToSupabase(next);
      return next;
    });
  }, [persistToSupabase]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  return { prefs, updatePrefs, loaded };
}
