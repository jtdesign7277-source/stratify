import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, RefreshCw } from 'lucide-react';

const ECON_CALENDAR_URL = '/api/economic-calendar';

const IMPACT_CONFIG = {
  High: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'HIGH', dot: 'bg-red-400' },
  Medium: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'MED', dot: 'bg-amber-400' },
  Low: { color: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/30', label: 'LOW', dot: 'bg-gray-500' },
  Holiday: { color: 'text-blue-300', bg: 'bg-blue-500/10', border: 'border-blue-500/30', label: 'HOLIDAY', dot: 'bg-blue-400' },
};

const COUNTRY_FLAGS = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', AUD: '🇦🇺', CAD: '🇨🇦', NZD: '🇳🇿', CHF: '🇨🇭', CNY: '🇨🇳',
};

const REGION_TABS = [
  { key: 'US', label: 'United States', shortLabel: 'US', flag: '🇺🇸', currencies: ['USD'] },
  { key: 'LONDON', label: 'London', shortLabel: 'UK', flag: '🇬🇧', currencies: ['GBP'] },
  { key: 'AUSTRALIA', label: 'Australia', shortLabel: 'AU', flag: '🇦🇺', currencies: ['AUD'] },
];

const PAGE_TRANSITION = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
};

const sectionMotion = (index) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.1 + (index * 0.05), duration: 0.3 },
});

const listItemMotion = (index) => ({
  initial: { opacity: 0, x: -8 },
  animate: { opacity: 1, x: 0 },
  transition: { delay: index * 0.03, duration: 0.25 },
});

const interactiveTransition = { type: 'spring', stiffness: 400, damping: 25 };

const getEventCurrency = (event) => String(event?.country || event?.currency || '')
  .trim()
  .toUpperCase();

const formatTime = (dateStr) => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  } catch { return '—'; }
};

const getDateKey = (dateStr) => {
  try {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } catch { return ''; }
};

const formatDateHeader = (dateStr, todayStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.toLocaleDateString('en-US', { weekday: 'long' });
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const isToday = dateStr === todayStr;
  return { label: `${day}, ${month} ${d}`, isToday };
};

const EconomicsCalendarPage = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeRegionKey, setActiveRegionKey] = useState('US');
  const todayRef = useRef(null);

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const fetchData = useCallback(async () => {
    const hasExistingData = events.length > 0;
    try {
      if (!hasExistingData) setLoading(true);
      setError(null);

      const res = await fetch(ECON_CALENDAR_URL);
      let json = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }

      if (Array.isArray(json)) {
        setEvents(json);
        setLastUpdated(new Date());
        return;
      }

      if (!res.ok) {
        if ((res.status === 429 || res.status >= 500)) {
          if (!hasExistingData) setEvents([]);
          return;
        }
        throw new Error(`Failed to load calendar (${res.status})`);
      }

      if (Array.isArray(json?.data)) {
        setEvents(json.data);
        setLastUpdated(new Date());
        return;
      }

      if (!hasExistingData) setEvents([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [events.length]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (!loading && todayRef.current) {
      setTimeout(() => todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    }
  }, [loading, events]);

  const activeRegion = useMemo(
    () => REGION_TABS.find((tab) => tab.key === activeRegionKey) || REGION_TABS[0],
    [activeRegionKey],
  );

  const filteredGrouped = useMemo(() => {
    const filtered = events.filter((event) => activeRegion.currencies.includes(getEventCurrency(event)));

    const groups = {};
    filtered.forEach((e) => {
      const dk = getDateKey(e.date);
      if (!dk) return;
      if (!groups[dk]) groups[dk] = [];
      groups[dk].push(e);
    });

    return Object.keys(groups).sort().map((date) => ({
      date,
      events: groups[date].sort((a, b) => new Date(a.date) - new Date(b.date)),
    }));
  }, [events, activeRegion]);

  const stats = useMemo(() => {
    const regionEvents = events.filter((event) => activeRegion.currencies.includes(getEventCurrency(event)));
    const high = regionEvents.filter((event) => event.impact === 'High');
    const todayEvents = regionEvents.filter((event) => getDateKey(event.date) === todayStr);
    return { total: regionEvents.length, high: high.length, today: todayEvents.length };
  }, [events, activeRegion, todayStr]);

  return (
    <motion.div {...PAGE_TRANSITION} className="min-h-full w-full bg-transparent text-white overflow-y-auto relative flex flex-col">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: 'linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Header */}
      <motion.div {...sectionMotion(0)} className="relative z-10 px-6 pt-5 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-blue-400" strokeWidth={1.5} />
            <h1 className="text-lg font-semibold">Economic Calendar</h1>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-[11px] text-gray-500">
                Updated {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <motion.button
              onClick={fetchData}
              disabled={loading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={interactiveTransition}
              className="text-gray-400 hover:text-white transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            </motion.button>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 mb-3 text-[11px]">
          <span className="text-gray-500">{stats.today} {activeRegion.shortLabel} events today</span>
          <span className="text-gray-600">•</span>
          <span className="text-gray-500">{stats.high} high impact events</span>
          <span className="text-gray-600">•</span>
          <span className="text-gray-500">{stats.total} total region events</span>
        </div>

        {/* Region tabs */}
        <div className="flex items-center gap-1">
          {REGION_TABS.map((tab) => (
            <motion.button
              key={tab.key}
              onClick={() => setActiveRegionKey(tab.key)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={interactiveTransition}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeRegionKey === tab.key
                  ? 'text-blue-400 bg-blue-500/10 border border-blue-500/30'
                  : 'text-gray-400 hover:text-white border border-transparent'
              }`}
            >
              <span className="mr-1">{tab.flag}</span>
              {tab.label}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Content */}
      <motion.div {...sectionMotion(1)} className="relative z-10 flex-1 overflow-y-auto px-6 pb-6" style={{ scrollbarWidth: 'thin' }}>
        {loading && events.length === 0 && (
          <div className="space-y-4 mt-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 w-40 bg-gray-800 rounded mb-3" />
                <div className="space-y-2">
                  {[1, 2, 3].map((j) => <div key={j} className="h-10 bg-gray-800/50 rounded" />)}
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mt-8 text-center">
            <p className="text-red-400 text-sm mb-3">{error}</p>
            <button onClick={fetchData} className="text-blue-400 hover:text-blue-300 text-sm">Retry</button>
          </div>
        )}

        {!loading && !error && filteredGrouped.length === 0 && (
          <div className="mt-8 text-center text-gray-500 text-sm">No events found for {activeRegion.label}.</div>
        )}

        {filteredGrouped.map(({ date, events: dayEvents }, sectionIndex) => {
          const { label, isToday } = formatDateHeader(date, todayStr);
          return (
            <motion.div
              key={date}
              ref={isToday ? todayRef : undefined}
              {...sectionMotion(sectionIndex + 2)}
              className={`mb-4 rounded-xl overflow-hidden ${
                isToday
                  ? 'bg-blue-500/[0.07] border border-blue-400/30 ring-1 ring-blue-500/20 shadow-lg shadow-black/30'
                  : 'border border-white/8 shadow-lg shadow-black/30'
              }`}
            >
              {/* Date header */}
              <div className={`px-4 py-2.5 flex items-center gap-3 ${isToday ? 'bg-blue-500/10' : 'bg-[#0a0a0a]'}`}>
                <span className="text-sm font-semibold text-white">{label}</span>
                {isToday && (
                  <span className="text-[10px] font-bold tracking-wider text-blue-300 uppercase">Today</span>
                )}
                <span className="text-[11px] text-gray-500 ml-auto">{dayEvents.length} events</span>
              </div>

              {/* Table header */}
              <div className="grid grid-cols-[70px_60px_50px_1fr_90px_90px_90px] gap-2 px-4 py-1.5 text-[10px] uppercase tracking-wider text-gray-500 border-b border-[#1f1f1f]">
                <span>Time</span>
                <span>Impact</span>
                <span></span>
                <span>Event</span>
                <span className="text-right">Forecast</span>
                <span className="text-right">Previous</span>
                <span className="text-right">Actual</span>
              </div>

              {/* Rows */}
              {dayEvents.map((e, i) => {
                const impact = IMPACT_CONFIG[e.impact] || IMPACT_CONFIG.Low;
                const flag = COUNTRY_FLAGS[getEventCurrency(e)] || '';
                const hasActual = e.actual !== undefined && e.actual !== null && e.actual !== '';
                const isPast = new Date(e.date) < new Date();
                
                return (
                  <motion.div
                    key={`${e.title}-${i}`}
                    {...listItemMotion(i)}
                    className={`grid grid-cols-[70px_60px_50px_1fr_90px_90px_90px] gap-2 px-4 py-2.5 border-b border-[#1f1f1f]/40 hover:bg-white/[0.02] transition ${
                      isToday && !isPast ? 'bg-blue-500/[0.03]' : ''
                    }`}
                  >
                    <div className="flex items-center text-[11px] text-gray-400">
                      <span>{formatTime(e.date)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${impact.dot}`} />
                      <span className={`text-[10px] font-semibold uppercase tracking-wider ${impact.color}`}>
                        {impact.label}
                      </span>
                    </div>
                    <span className="text-sm">{flag}</span>
                    <span className={`text-sm truncate ${e.impact === 'High' ? 'text-white font-medium' : 'text-gray-300'}`}>
                      {e.title}
                    </span>
                    <span className="text-sm text-gray-400 text-right">{e.forecast || '—'}</span>
                    <span className="text-sm text-gray-500 text-right">{e.previous || '—'}</span>
                    <span className={`text-sm text-right font-medium ${
                      hasActual ? 'text-white' : 'text-gray-600'
                    }`}>
                      {hasActual ? e.actual : isPast ? '—' : 'Pending'}
                    </span>
                  </motion.div>
                );
              })}
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
};

export default EconomicsCalendarPage;
