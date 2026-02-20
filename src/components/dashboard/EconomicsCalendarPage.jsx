import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Calendar, Clock, RefreshCw, AlertTriangle, Minus, ChevronDown } from 'lucide-react';

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
  const [filter, setFilter] = useState('USD'); // 'ALL', 'USD', 'High'
  const [showFilter, setShowFilter] = useState(false);
  const todayRef = useRef(null);

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(ECON_CALENDAR_URL);
      if (!res.ok) throw new Error(`Failed to load calendar (${res.status})`);
      const json = await res.json();
      if (!Array.isArray(json)) throw new Error('Invalid data format');
      setEvents(json);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const filteredGrouped = useMemo(() => {
    let filtered = events;
    if (filter === 'USD') filtered = events.filter((e) => e.country === 'USD');
    else if (filter === 'High') filtered = events.filter((e) => e.impact === 'High');
    else if (filter === 'Major') filtered = events.filter((e) => ['USD', 'EUR', 'GBP', 'JPY'].includes(e.country));

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
  }, [events, filter]);

  const stats = useMemo(() => {
    const usd = events.filter((e) => e.country === 'USD');
    const high = events.filter((e) => e.impact === 'High');
    const todayEvents = events.filter((e) => getDateKey(e.date) === todayStr && e.country === 'USD');
    return { total: events.length, usd: usd.length, high: high.length, today: todayEvents.length };
  }, [events, todayStr]);

  const FILTERS = [
    { key: 'USD', label: '🇺🇸 USD Only' },
    { key: 'Major', label: 'Major Currencies' },
    { key: 'High', label: '🔴 High Impact' },
    { key: 'ALL', label: 'All Events' },
  ];

  return (
    <div className="h-full w-full bg-transparent text-white overflow-hidden relative flex flex-col">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: 'linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Header */}
      <div className="relative z-10 px-6 pt-5 pb-3">
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
            <button onClick={fetchData} disabled={loading} className="text-gray-400 hover:text-white transition">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 mb-3 text-[11px]">
          <span className="text-gray-500">{stats.today} USD events today</span>
          <span className="text-gray-600">•</span>
          <span className="text-gray-500">{stats.high} high impact this week</span>
          <span className="text-gray-600">•</span>
          <span className="text-gray-500">{stats.total} total events</span>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === f.key
                  ? 'text-blue-400 bg-blue-500/10 border border-blue-500/30'
                  : 'text-gray-400 hover:text-white border border-transparent'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto px-6 pb-6" style={{ scrollbarWidth: 'thin' }}>
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
          <div className="mt-8 text-center text-gray-500 text-sm">No events found for this filter.</div>
        )}

        {filteredGrouped.map(({ date, events: dayEvents }) => {
          const { label, isToday } = formatDateHeader(date, todayStr);
          return (
            <div
              key={date}
              ref={isToday ? todayRef : undefined}
              className={`mb-4 rounded-xl overflow-hidden ${
                isToday
                  ? 'bg-blue-500/[0.07] border border-blue-400/30 ring-1 ring-blue-500/20'
                  : 'border border-[#1f1f1f]'
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
                const flag = COUNTRY_FLAGS[e.country] || '';
                const hasActual = e.actual !== undefined && e.actual !== null && e.actual !== '';
                const isPast = new Date(e.date) < new Date();
                
                return (
                  <div
                    key={`${e.title}-${i}`}
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
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EconomicsCalendarPage;
