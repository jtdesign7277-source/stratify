import React, { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';

function formatAmerican(price) {
  if (price == null || price === '') return '—';
  const n = Number(price);
  if (!Number.isFinite(n)) return '—';
  return n > 0 ? `+${n}` : String(n);
}

function formatCommenceTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  } catch {
    return iso;
  }
}

async function fetchJson(url) {
  const r = await fetch(url);
  const contentType = r.headers.get('content-type') || '';
  const text = await r.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!r.ok) {
    const msg =
      data?.error ||
      (r.status === 404
        ? 'Odds API not found. Run `vercel dev` in another terminal (port 3000), then refresh.'
        : `Odds API error (${r.status}). Run \`vercel dev\` locally and set ODDS_API_KEY in .env or .env.local.`);
    throw new Error(msg);
  }
  if (!contentType.includes('application/json') && data === null) {
    throw new Error('Odds API returned invalid response.');
  }
  return data ?? {};
}

export default function SportsOddsPage({ onBack }) {
  const [sports, setSports] = useState([]);
  const [sportKey, setSportKey] = useState('basketball_nba');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    fetchJson('/api/odds/sports')
      .then((data) => {
        if (cancelled) return;
        if (data?.error) {
          setError(data.error);
          setSports([]);
          return;
        }
        const list = Array.isArray(data) ? data.filter((s) => s.active && !s.has_outrights) : [];
        setSports(list);
        if (list.length && !list.some((s) => s.key === sportKey)) {
          setSportKey(list[0].key);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e?.message || 'Failed to load sports');
          setSports([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!sportKey) return;
    let cancelled = false;
    setEventsLoading(true);
    setError('');
    fetchJson(`/api/odds/events?sport=${encodeURIComponent(sportKey)}&regions=us&oddsFormat=american`)
      .then((data) => {
        if (cancelled) return;
        if (data?.error) {
          setError(data.error);
          setEvents([]);
          return;
        }
        setEvents(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e?.message || 'Failed to load odds');
          setEvents([]);
        }
      })
      .finally(() => {
        if (!cancelled) setEventsLoading(false);
      });
    return () => { cancelled = true; };
  }, [sportKey]);

  const currentSport = sports.find((s) => s.key === sportKey);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/[0.08] transition-colors"
              aria-label="Back to dashboard"
            >
              <ChevronLeft size={18} />
              Back
            </button>
          )}
          <h1 className="text-xl font-semibold text-white">Sports Odds</h1>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-6 text-center text-gray-400 text-sm">
            Loading sports…
          </div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Sport</span>
              <select
                value={sportKey}
                onChange={(e) => setSportKey(e.target.value)}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none"
              >
                {sports.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.title} — {s.description}
                  </option>
                ))}
              </select>
            </div>

            {eventsLoading ? (
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-6 text-center text-gray-400 text-sm">
                Loading odds…
              </div>
            ) : events.length === 0 ? (
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-6 text-center text-gray-400 text-sm">
                No upcoming events for {currentSport?.title || sportKey}.
              </div>
            ) : (
              <div className="space-y-4">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden"
                  >
                    <div className="px-4 py-2 border-b border-white/[0.06] flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-white">
                          {event.away_team} @ {event.home_team}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {formatCommenceTime(event.commence_time)}
                        </div>
                      </div>
                    </div>
                    <div className="p-4 space-y-3">
                      {(event.bookmakers || []).slice(0, 6).map((book) => (
                        <div key={book.key} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm border-b border-white/[0.04] pb-2 last:border-0 last:pb-0">
                          <span className="w-24 shrink-0 font-medium text-gray-400">{book.title}</span>
                          {(book.markets || []).map((market) => (
                            <span key={market.key} className="flex items-center gap-1.5">
                              <span className="text-[10px] uppercase tracking-wider text-gray-500">
                                {market.key === 'h2h' ? 'ML' : market.key === 'spreads' ? 'Spread' : market.key === 'totals' ? 'Total' : market.key}
                              </span>
                              {(market.outcomes || []).map((outcome) => (
                                <span
                                  key={`${outcome.name}-${outcome.price}`}
                                  className="font-mono text-emerald-400/90"
                                >
                                  {outcome.point != null ? `${outcome.name} ${outcome.point}` : outcome.name}: {formatAmerican(outcome.price)}
                                </span>
                              ))}
                            </span>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
