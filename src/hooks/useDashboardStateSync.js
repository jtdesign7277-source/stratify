import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const LOCAL_STORAGE_KEY = 'stratify-dashboard-state';
const DEFAULT_PAPER_BALANCE = 100000;
const DEFAULT_DASHBOARD_STATE = {
  sidebarExpanded: true,
  rightPanelWidth: 320,
  activeTab: 'trade',
  activeSection: 'watchlist',
  theme: 'dark',
  paperTradingBalance: DEFAULT_PAPER_BALANCE,
};

const toFiniteNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeDashboardState = (state) => {
  const candidate = state && typeof state === 'object' ? state : {};
  const theme = candidate.theme === 'light' ? 'light' : 'dark';
  const sidebarExpanded = typeof candidate.sidebarExpanded === 'boolean'
    ? candidate.sidebarExpanded
    : DEFAULT_DASHBOARD_STATE.sidebarExpanded;
  const rightPanelWidth = Math.min(
    500,
    Math.max(280, toFiniteNumber(candidate.rightPanelWidth, DEFAULT_DASHBOARD_STATE.rightPanelWidth)),
  );
  const paperTradingBalance = Math.max(
    0,
    toFiniteNumber(candidate.paperTradingBalance, DEFAULT_DASHBOARD_STATE.paperTradingBalance),
  );

  return {
    sidebarExpanded,
    rightPanelWidth,
    activeTab: String(candidate.activeTab || DEFAULT_DASHBOARD_STATE.activeTab),
    activeSection: String(candidate.activeSection || DEFAULT_DASHBOARD_STATE.activeSection),
    theme,
    paperTradingBalance,
  };
};

const loadLocalDashboardState = () => {
  if (typeof window === 'undefined') return { ...DEFAULT_DASHBOARD_STATE };
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DASHBOARD_STATE };
    return normalizeDashboardState(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_DASHBOARD_STATE };
  }
};

const saveLocalDashboardState = (state) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
};

const stripPaperBalanceForRemoteState = (state) => {
  if (!state || typeof state !== 'object') return {};
  const { paperTradingBalance: _paperTradingBalance, ...rest } = state;
  return rest;
};

const isMissingColumnError = (error, columnName) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes(columnName.toLowerCase()) && message.includes('column');
};

export default function useDashboardStateSync(user, dashboardState, onHydrate) {
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef(null);
  const lastSaved = useRef('');
  const hydrateRef = useRef(onHydrate);

  useEffect(() => {
    hydrateRef.current = onHydrate;
  }, [onHydrate]);

  const saveToSupabase = useCallback(async (userId, payload, serializedPayload) => {
    if (!userId || !supabase) return;

    const userStatePayload = stripPaperBalanceForRemoteState(payload);
    const baseUpdate = {
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          ...baseUpdate,
          user_state: userStatePayload,
        })
        .eq('id', userId);

      if (error) {
        if (isMissingColumnError(error, 'user_state')) {
          const { error: fallbackError } = await supabase
            .from('profiles')
            .update(baseUpdate)
            .eq('id', userId);

          if (fallbackError) {
            console.warn('[DashboardStateSync] Save error:', fallbackError.message);
            return;
          }

          lastSaved.current = serializedPayload;
          return;
        }

        console.warn('[DashboardStateSync] Save error:', error.message);
        return;
      }

      lastSaved.current = serializedPayload;
    } catch (error) {
      console.warn('[DashboardStateSync] Save failed:', error);
    }
  }, []);

  useEffect(() => {
    if (!user?.id || !supabase) {
      const local = normalizeDashboardState(loadLocalDashboardState());
      saveLocalDashboardState(local);
      lastSaved.current = JSON.stringify(local);
      hydrateRef.current?.(local);
      setLoaded(true);
      return;
    }

    let cancelled = false;

    const loadFromSupabase = async () => {
      setLoaded(false);
      const local = normalizeDashboardState(loadLocalDashboardState());

      try {
        let profileData = null;
        const query = await supabase
          .from('profiles')
          .select('user_state, paper_trading_balance')
          .eq('id', user.id)
          .maybeSingle();

        if (query.error) {
          if (!isMissingColumnError(query.error, 'user_state')) {
            console.warn('[DashboardStateSync] Load error:', query.error.message);
          }

          const fallback = await supabase
            .from('profiles')
            .select('paper_trading_balance')
            .eq('id', user.id)
            .maybeSingle();

          if (fallback.error) {
            console.warn('[DashboardStateSync] Fallback load error:', fallback.error.message);
            profileData = null;
          } else {
            profileData = fallback.data;
          }
        } else {
          profileData = query.data;
        }

        const remoteState = profileData?.user_state && typeof profileData.user_state === 'object'
          ? profileData.user_state
          : {};
        const persistedPaperBalance = toFiniteNumber(profileData?.paper_trading_balance, null);

        const hydrated = normalizeDashboardState({
          ...local,
          ...remoteState,
          paperTradingBalance: persistedPaperBalance
            ?? local.paperTradingBalance,
        });

        if (cancelled) return;

        hydrateRef.current?.(hydrated);
        saveLocalDashboardState(hydrated);

        const serialized = JSON.stringify(hydrated);
        lastSaved.current = serialized;

        if (!profileData?.user_state || typeof profileData.user_state !== 'object') {
          saveToSupabase(user.id, hydrated, serialized);
        }
      } catch (error) {
        if (cancelled) return;
        console.warn('[DashboardStateSync] Load failed:', error);
        hydrateRef.current?.(local);
        saveLocalDashboardState(local);
        lastSaved.current = JSON.stringify(local);
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
    const normalized = normalizeDashboardState(dashboardState);
    saveLocalDashboardState(normalized);

    if (!loaded) return;

    const serialized = JSON.stringify(normalized);
    if (serialized === lastSaved.current) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (!user?.id || !supabase) {
        lastSaved.current = serialized;
        return;
      }
      saveToSupabase(user.id, normalized, serialized);
    }, 2000);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [dashboardState, user?.id, loaded, saveToSupabase]);

  return { loaded };
}
