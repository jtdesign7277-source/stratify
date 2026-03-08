import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ODDS_API = '/api/odds/events';
const BOOK_KEYS = ['fanduel', 'draftkings', 'betmgm', 'betonline_ag'];
const BOOK_LABELS = { fanduel: 'FanDuel', draftkings: 'DraftKings', betmgm: 'BetMGM', betonline_ag: 'BetOnline' };

function formatTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function formatAmerican(price) {
  if (price == null || price === '') return '—';
  const n = Number(price);
  if (!Number.isFinite(n)) return '—';
  return n > 0 ? `+${n}` : String(n);
}

function getMoneylineOutcomes(book) {
  const market = (book.markets || []).find((m) => m.key === 'h2h');
  return market?.outcomes || [];
}

function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const today = new Date();
  return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
}

export default function LiveOddsPanel({ selectedGames = [], isArticleOpen = false }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetch(`${ODDS_API}?sport=basketball_nba&regions=us&oddsFormat=american`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.error) {
          setError(data.error);
          setEvents([]);
          return;
        }
        const list = Array.isArray(data) ? data : [];
        setEvents(list.filter((e) => isToday(e.commence_time)));
        setError('');
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e?.message || 'Failed to load odds');
          setEvents([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const toggleExpanded = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div
      className="flex flex-col h-full min-h-0 overflow-hidden bg-[#0a0a0f] rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.05)]"
      style={{ width: '100%' }}
    >
      <div className="shrink-0 px-4 py-3 border-b border-white/[0.06]">
        <h3 className="text-sm font-semibold text-white">Today&apos;s NBA Lines</h3>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {loading ? (
          <div className="py-6 text-center text-gray-500 text-sm">Loading…</div>
        ) : error ? (
          <div className="py-6 text-center text-red-400/80 text-sm">{error}</div>
        ) : events.length === 0 ? (
          <div className="py-6 text-center text-gray-500 text-sm">No games today</div>
        ) : (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {events.map((event, index) => {
                const id = event.id;
                const isExpanded = expandedId === id;
                const books = (event.bookmakers || []).filter((b) => BOOK_KEYS.includes(b.key));
                const homeTeam = event.home_team || 'Home';
                const awayTeam = event.away_team || 'Away';
                const time = formatTime(event.commence_time);

                const outcomesByBook = books.map((book) => {
                  const outcomes = getMoneylineOutcomes(book);
                  return { book, outcomes };
                });

                return (
                  <GameRow
                    key={id}
                    index={index}
                    awayTeam={awayTeam}
                    homeTeam={homeTeam}
                    time={time}
                    isExpanded={isExpanded}
                    onToggle={() => toggleExpanded(id)}
                    outcomesByBook={outcomesByBook}
                    BOOK_LABELS={BOOK_LABELS}
                    formatAmerican={formatAmerican}
                  />
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}

function GameRow({ index, awayTeam, homeTeam, time, isExpanded, onToggle, outcomesByBook, BOOK_LABELS, formatAmerican }) {
  const bestBySide = useMemo(() => {
    const homePrices = [];
    const awayPrices = [];
    outcomesByBook.forEach(({ book, outcomes }) => {
      const home = outcomes.find((o) => o.name === homeTeam);
      const away = outcomes.find((o) => o.name === awayTeam);
      if (home != null && Number.isFinite(Number(home.price))) homePrices.push({ bookKey: book.key, price: Number(home.price) });
      if (away != null && Number.isFinite(Number(away.price))) awayPrices.push({ bookKey: book.key, price: Number(away.price) });
    });
    const bestHome = homePrices.length ? homePrices.reduce((a, b) => (a.price > b.price ? a : b)) : null;
    const bestAway = awayPrices.length ? awayPrices.reduce((a, b) => (a.price > b.price ? a : b)) : null;
    return { bestHome, bestAway };
  }, [outcomesByBook, homeTeam, awayTeam]);

  return (
    <motion.li
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className="rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl overflow-hidden"
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-4 py-3 flex items-center justify-between gap-2 hover:bg-white/[0.03] transition-colors"
      >
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-white truncate">
            {awayTeam} @ {homeTeam}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{time}</div>
        </div>
        <span className="text-xs text-emerald-400/90 shrink-0">{isExpanded ? '−' : '+'}</span>
      </button>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="border-t border-white/[0.06] overflow-hidden"
          >
            <div className="px-4 py-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-gray-500">
                    <th className="text-left font-medium pb-2">Book</th>
                    <th className="text-right font-medium pb-2">{awayTeam}</th>
                    <th className="text-right font-medium pb-2">{homeTeam}</th>
                  </tr>
                </thead>
                <tbody>
                  {outcomesByBook.map(({ book, outcomes }) => {
                    const home = outcomes.find((o) => o.name === homeTeam);
                    const away = outcomes.find((o) => o.name === awayTeam);
                    const homePrice = home?.price != null ? Number(home.price) : null;
                    const awayPrice = away?.price != null ? Number(away.price) : null;
                    const isBestHome = bestBySide?.bestHome?.bookKey === book.key;
                    const isBestAway = bestBySide?.bestAway?.bookKey === book.key;
                    return (
                      <tr key={book.key} className="border-t border-white/[0.04]">
                        <td className="py-1.5 text-gray-400">{BOOK_LABELS[book.key] || book.key}</td>
                        <td className="py-1.5 text-right">
                          <span className={isBestAway ? 'text-emerald-400 font-medium' : awayPrice != null && awayPrice > 0 ? 'text-emerald-400' : 'text-white'}>
                            {formatAmerican(awayPrice)}
                          </span>
                        </td>
                        <td className="py-1.5 text-right">
                          <span className={isBestHome ? 'text-emerald-400 font-medium' : homePrice != null && homePrice > 0 ? 'text-emerald-400' : 'text-white'}>
                            {formatAmerican(homePrice)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
