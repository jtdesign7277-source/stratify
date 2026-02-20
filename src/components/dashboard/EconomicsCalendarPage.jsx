import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Calendar, TrendingUp, TrendingDown, Clock, RefreshCw } from 'lucide-react';

const US_EXCHANGES = new Set(['NASDAQ', 'NYSE', 'AMEX', 'XNAS', 'XNYS', 'XASE']);

const formatDateHeader = (dateStr, todayStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.toLocaleDateString('en-US', { weekday: 'long' });
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const isToday = dateStr === todayStr;
  return { label: `${day}, ${month} ${d}`, isToday };
};

const getDateRange = () => {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 3);
  const end = new Date(now);
  end.setDate(now.getDate() + 4);
  const fmt = (d) => d.toISOString().split('T')[0];
  return { start_date: fmt(start), end_date: fmt(end) };
};

const SurpriseBadge = ({ surprise_prc }) => {
  const val = parseFloat(surprise_prc);
  if (!Number.isFinite(val)) return null;
  const beat = val >= 0;
  return (
    <span className={`text-[11px] font-semibold ${beat ? 'text-emerald-400' : 'text-red-400'}`}>
      {beat ? 'BEAT' : 'MISS'} {beat ? '+' : ''}{val.toFixed(1)}%
    </span>
  );
};

const EconomicsCalendarPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const todayRef = useRef(null);

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { start_date, end_date } = getDateRange();
      const url = `https://api.twelvedata.com/earnings_calendar?apikey=${import.meta.env.VITE_TWELVE_DATA_API_KEY}&start_date=${start_date}&end_date=${end_date}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const json = await res.json();
      if (json.status === 'error') throw new Error(json.message || 'API error');
      setData(json);
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
      setTimeout(() => todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    }
  }, [loading, data]);

  // Parse and filter data
  const groupedDates = useMemo(() => {
    if (!data || typeof data !== 'object') return [];
    // The API returns an object with date keys, or an "earnings" object
    const earnings = data.earnings || data;
    const dates = Object.keys(earnings)
      .filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k))
      .sort();

    return dates.map((date) => {
      const events = (earnings[date] || []).filter((e) => {
        const ex = (e.exchange || '').toUpperCase();
        const mic = (e.mic_code || '').toUpperCase();
        return US_EXCHANGES.has(ex) || US_EXCHANGES.has(mic);
      });
      return { date, events };
    }).filter((g) => g.events.length > 0);
  }, [data]);

  return (
    <div className="h-full w-full bg-transparent text-white overflow-hidden relative flex flex-col">
      {/* Grid bg */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: 'linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-blue-400" strokeWidth={1.5} />
          <h1 className="text-lg font-semibold">Earnings Calendar</h1>
          <span className="text-[11px] text-gray-500">US Exchanges</span>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[11px] text-gray-500">
              Updated {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="text-gray-400 hover:text-white transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto px-6 pb-6" style={{ scrollbarWidth: 'thin' }}>
        {loading && !data && (
          <div className="space-y-4 mt-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 w-40 bg-gray-800 rounded mb-3" />
                <div className="space-y-2">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-10 bg-gray-800/50 rounded" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mt-8 text-center">
            <p className="text-red-400 text-sm mb-3">{error}</p>
            <button onClick={fetchData} className="text-blue-400 hover:text-blue-300 text-sm">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && groupedDates.length === 0 && (
          <div className="mt-8 text-center text-gray-500 text-sm">No earnings events found for this period.</div>
        )}

        {groupedDates.map(({ date, events }) => {
          const { label, isToday } = formatDateHeader(date, todayStr);
          return (
            <div
              key={date}
              ref={isToday ? todayRef : undefined}
              className={`mb-5 rounded-xl border ${
                isToday
                  ? 'bg-blue-500/10 border-l-2 border-blue-400'
                  : 'border-[#1f1f1f]'
              } overflow-hidden`}
            >
              {/* Date header */}
              <div className={`px-4 py-2.5 flex items-center gap-3 ${isToday ? 'bg-blue-500/5' : 'bg-[#0b0b0b]'}`}>
                <span className="text-sm font-semibold text-white">{label}</span>
                {isToday && (
                  <span className="text-[10px] font-bold tracking-wider text-blue-300 uppercase">Today</span>
                )}
                <span className="text-[11px] text-gray-500 ml-auto">{events.length} earnings</span>
              </div>

              {/* Table header */}
              <div className="grid grid-cols-[80px_100px_1fr_90px_90px_120px] gap-2 px-4 py-1.5 text-[10px] uppercase tracking-wider text-gray-500 border-b border-[#1f1f1f]">
                <span>Time</span>
                <span>Symbol</span>
                <span>Company</span>
                <span className="text-right">EPS Est.</span>
                <span className="text-right">EPS Act.</span>
                <span className="text-right">Surprise</span>
              </div>

              {/* Rows */}
              {events.map((e, i) => {
                const timeLabel = e.time === 'before_open' ? 'Pre-Market'
                  : e.time === 'after_close' ? 'After Hours'
                  : e.time || '—';
                const hasActual = e.eps_actual !== null && e.eps_actual !== undefined && e.eps_actual !== '';
                return (
                  <div
                    key={`${e.symbol}-${i}`}
                    className="grid grid-cols-[80px_100px_1fr_90px_90px_120px] gap-2 px-4 py-2 border-b border-[#1f1f1f]/50 hover:bg-white/[0.02] transition"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                      <Clock className="w-3 h-3" strokeWidth={1.5} />
                      <span>{timeLabel}</span>
                    </div>
                    <span className="text-sm font-bold text-white">{e.symbol}</span>
                    <span className="text-sm text-gray-400 truncate">{e.name || '—'}</span>
                    <span className="text-sm text-gray-300 text-right">
                      {e.eps_estimate != null ? `$${Number(e.eps_estimate).toFixed(2)}` : '—'}
                    </span>
                    <span className={`text-sm text-right font-medium ${hasActual ? 'text-white' : 'text-gray-500'}`}>
                      {hasActual ? `$${Number(e.eps_actual).toFixed(2)}` : '—'}
                    </span>
                    <div className="text-right">
                      {hasActual ? (
                        <div className="flex items-center justify-end gap-1">
                          {parseFloat(e.surprise_prc) >= 0 ? (
                            <TrendingUp className="w-3 h-3 text-emerald-400" strokeWidth={1.5} />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-red-400" strokeWidth={1.5} />
                          )}
                          <SurpriseBadge surprise_prc={e.surprise_prc} />
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-500">Pending</span>
                      )}
                    </div>
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
