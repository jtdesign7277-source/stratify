import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const STORAGE_KEY = 'stratify-earnings-alert-state';
const PILL_ANCHOR_ID = 'earnings-alert-pill-anchor';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const revenueFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 2,
});

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const formatEps = (value) => {
  const numeric = toNumber(value);
  if (numeric === null) return '--';
  return numeric.toFixed(2);
};

const formatRevenue = (value) => {
  const numeric = toNumber(value);
  if (numeric === null) return '--';
  return revenueFormatter.format(numeric);
};

const formatLocalDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const readStoredState = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeStoredState = (state) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
};

const clearStoredState = () => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
};

const normalizeWatchlistSymbol = (entry) => {
  if (!entry) return null;
  const symbol = typeof entry === 'string' ? entry : entry.symbol;
  if (!symbol) return null;
  return String(symbol).trim().toUpperCase();
};

const normalizeHour = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized.includes('bmo')) return 'bmo';
  if (normalized.includes('amc')) return 'amc';
  return normalized || 'tbd';
};

const getHourBadge = (hour) => {
  if (hour === 'bmo') return { label: 'Before Market Open (BMO)', tone: 'emerald' };
  if (hour === 'amc') return { label: 'After Market Close (AMC)', tone: 'amber' };
  return { label: 'Reporting Time TBD', tone: 'slate' };
};

export default function EarningsAlert({ watchlist = [], onAddToWatchlist }) {
  const [earnings, setEarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewState, setViewState] = useState('open');
  const [pillAnchor, setPillAnchor] = useState(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const anchor = document.getElementById(PILL_ANCHOR_ID);
    if (anchor) setPillAnchor(anchor);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    const loadEarnings = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/earnings', { signal: controller.signal });
        if (!response.ok) throw new Error('Failed to load earnings');
        const data = await response.json();
        if (!isMounted) return;
        setEarnings(Array.isArray(data?.earnings) ? data.earnings : []);
      } catch (error) {
        if (!controller.signal.aborted && isMounted) {
          setEarnings([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadEarnings();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const watchlistSymbols = useMemo(() => {
    const symbols = watchlist
      .map(normalizeWatchlistSymbol)
      .filter(Boolean);
    return new Set(symbols);
  }, [watchlist]);

  const todayKey = formatLocalDateKey(new Date());
  const tomorrowKey = formatLocalDateKey(new Date(Date.now() + MS_PER_DAY));

  const upcoming = useMemo(() => {
    if (!earnings.length) return [];
    return earnings.filter((item) => item?.date === todayKey || item?.date === tomorrowKey);
  }, [earnings, todayKey, tomorrowKey]);

  const hasToday = useMemo(() => upcoming.some((item) => item.date === todayKey), [upcoming, todayKey]);
  const focusDateKey = hasToday ? todayKey : tomorrowKey;
  const focusedEarnings = useMemo(() => {
    const filtered = upcoming.filter((item) => item.date === focusDateKey);
    return filtered.sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [upcoming, focusDateKey]);

  const subtitle = hasToday ? 'Reporting Today' : 'Reporting Tomorrow';
  const alertKey = `${focusDateKey}-${hasToday ? 'today' : 'tomorrow'}`;

  useEffect(() => {
    if (!focusedEarnings.length) return;
    const stored = readStoredState();
    if (stored?.alertKey === alertKey) {
      const storedState = stored.state === 'minimized' || stored.state === 'dismissed'
        ? stored.state
        : 'open';
      setViewState(storedState);
    } else {
      setViewState('open');
      if (stored) clearStoredState();
    }
  }, [alertKey, focusDateKey, focusedEarnings.length]);

  const handleMinimize = () => {
    setViewState('minimized');
    if (alertKey) {
      writeStoredState({ alertKey, state: 'minimized' });
    }
  };

  const handleDismiss = () => {
    setViewState('dismissed');
    if (alertKey) {
      writeStoredState({ alertKey, state: 'dismissed' });
    }
  };

  const handleOpen = () => {
    setViewState('open');
    clearStoredState();
  };

  if (loading || focusedEarnings.length === 0 || viewState === 'dismissed') {
    return null;
  }

  const pillLabel = `📊 ${focusedEarnings.length} Earnings ${hasToday ? 'Today' : 'Tomorrow'}`;

  const pill = (
    <button
      onClick={handleOpen}
      className="h-8 px-3 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 text-xs font-semibold tracking-wide flex items-center gap-2 shadow-[0_0_12px_rgba(16,185,129,0.15)] animate-pulse hover:bg-emerald-500/20"
    >
      <span className="text-sm">📊</span>
      <span>{pillLabel.replace('📊 ', '')}</span>
    </button>
  );

  return (
    <>
      {viewState === 'minimized' && pillAnchor && createPortal(pill, pillAnchor)}
      <AnimatePresence>
        {viewState === 'open' && (
          <motion.div
            className="fixed inset-0 z-[120] flex items-start justify-end"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleMinimize} />
            <motion.div
              className="relative w-full max-w-md mt-6 mr-6 bg-[#0a1628] border border-gray-700 rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
              initial={{ x: 120, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 120, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            >
              <div className="px-5 pt-5 pb-4 border-b border-gray-700 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">📊 Earnings Alert</h2>
                  <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleMinimize}
                    className="text-xs text-gray-300 border border-gray-600 px-2.5 py-1 rounded-full hover:bg-white/10"
                  >
                    Minimize
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="text-gray-400 hover:text-white transition"
                    aria-label="Dismiss earnings alert"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="max-h-[70vh] overflow-y-auto px-5 py-4 space-y-3">
                {focusedEarnings.map((item) => {
                  const symbol = item.symbol || '';
                  const name = item.name || symbol;
                  const inWatchlist = watchlistSymbols.has(symbol);
                  const hour = normalizeHour(item.hour);
                  const badge = getHourBadge(hour);

                  return (
                    <div
                      key={`${symbol}-${item.date}`}
                      className={`rounded-xl border px-4 py-3 bg-[#0f1f36] ${
                        inWatchlist ? 'border-emerald-500/40' : 'border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-white font-semibold text-sm">{symbol}</div>
                          <div className="text-xs text-gray-400">{name}</div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-wide ${
                              badge.tone === 'emerald'
                                ? 'border-emerald-400/50 text-emerald-200 bg-emerald-500/10'
                                : badge.tone === 'amber'
                                  ? 'border-amber-400/40 text-amber-200 bg-amber-500/10'
                                  : 'border-slate-500/40 text-slate-200 bg-slate-500/10'
                            }`}
                          >
                            {badge.label}
                          </span>
                          {!inWatchlist && onAddToWatchlist && (
                            <button
                              onClick={() => onAddToWatchlist({ symbol, name })}
                              className="text-[11px] font-semibold text-emerald-900 bg-emerald-400 hover:bg-emerald-300 px-2.5 py-1 rounded-full"
                            >
                              Add to Watchlist
                            </button>
                          )}
                          {inWatchlist && (
                            <span className="text-[11px] font-semibold text-emerald-200 bg-emerald-500/15 px-2.5 py-1 rounded-full">
                              In Watchlist
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-slate-500">EPS Estimate</div>
                          <div className="text-sm text-white">{formatEps(item.epsEstimate)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-slate-500">Revenue Estimate</div>
                          <div className="text-sm text-white">{formatRevenue(item.revenueEstimate)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
