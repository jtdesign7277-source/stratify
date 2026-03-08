import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield } from 'lucide-react';

const ODDS_API = '/api/odds/events';
const BOOK_KEYS = ['fanduel', 'draftkings', 'betmgm', 'betonline_ag'];
const BOOK_LABELS = { fanduel: 'FanDuel', draftkings: 'DraftKings', betmgm: 'BetMGM', betonline_ag: 'BetOnline' };
const IDLE_TIMEOUT_MS = 60000;
const LOGO_HOLD_MS = 2800;
const LIVE_WINDOW_MS = 3 * 60 * 60 * 1000;

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

function isGameLive(commenceTime) {
  if (!commenceTime) return false;
  const now = Date.now();
  const commence = new Date(commenceTime).getTime();
  return commence <= now && now - commence <= LIVE_WINDOW_MS;
}

export default function LiveOddsPanel({ selectedGames = [], isArticleOpen = false }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const [idleLogoIndex, setIdleLogoIndex] = useState(0);
  const idleTimeoutRef = useRef(null);

  const hasLiveGame = useMemo(
    () => events.some((e) => isGameLive(e.commence_time)),
    [events]
  );

  const showIdle = !loading && !error && !hasLiveGame && !isActive;

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

  useEffect(() => {
    if (!showIdle) return;
    const t = setInterval(() => setIdleLogoIndex((i) => (i === 0 ? 1 : 0)), LOGO_HOLD_MS);
    return () => clearInterval(t);
  }, [showIdle]);

  const clearIdleTimeout = () => {
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
  };

  const scheduleIdleReturn = () => {
    clearIdleTimeout();
    if (hasLiveGame) return;
    idleTimeoutRef.current = setTimeout(() => setIsActive(false), IDLE_TIMEOUT_MS);
  };

  const handlePanelInteraction = () => {
    setIsActive(true);
    scheduleIdleReturn();
  };

  useEffect(() => () => clearIdleTimeout(), []);

  const toggleExpanded = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const renderOddsContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8 gap-2">
          <span className="text-[11px] text-gray-600">Loading…</span>
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <span className="text-[11px] text-red-400/70">{error}</span>
        </div>
      );
    }
    if (events.length === 0) {
      return (
        <div className="flex items-center justify-center py-8">
          <span className="text-[11px] text-gray-600">No games today</span>
        </div>
      );
    }
    return (
      <div className="divide-y divide-white/[0.03]">
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
                muted={showIdle}
              />
            );
          })}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div
      className="flex flex-col h-full min-h-0 overflow-hidden"
      style={{ width: '100%' }}
      onClick={handlePanelInteraction}
      onMouseEnter={handlePanelInteraction}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handlePanelInteraction(); }}
    >
      <div className="flex h-10 shrink-0 items-center justify-between overflow-hidden px-3 border-b border-white/[0.06] relative z-[150]">
        <span className="text-[11px] text-gray-500">Today&apos;s NBA Lines</span>
        {hasLiveGame && (
          <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            LIVE
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-hide pointer-events-auto touch-pan-y pt-2" style={{ flex: '1 1 0%', minHeight: 0, touchAction: 'pan-y' }}>
        {showIdle ? (
          <div className="w-full h-full min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 w-full relative overflow-hidden">
              <AnimatePresence mode="wait">
                {idleLogoIndex === 0 ? (
                  <motion.div
                    key="draftkings"
                    className="absolute inset-0 w-full h-full flex items-center justify-center bg-[#1a1a1a]"
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    variants={{
                      hidden: { opacity: 0, scale: 0.75 },
                      visible: { opacity: 1, scale: 1, transition: { duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] } },
                      exit: { opacity: 0, scale: 1.08, transition: { duration: 0.7, ease: 'easeIn' } },
                    }}
                  >
                    <div className="flex flex-col items-center justify-center">
                      <span className="text-5xl mb-2" aria-hidden>👑</span>
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-5xl font-black text-white tracking-wider">DRAFT</span>
                        <span className="text-5xl font-black text-[#4caf50] tracking-wider">KINGS</span>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="fanduel"
                    className="absolute inset-0 w-full h-full flex items-center justify-center bg-[#1a78c2]"
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    variants={{
                      hidden: { opacity: 0, scale: 0.75 },
                      visible: { opacity: 1, scale: 1, transition: { duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] } },
                      exit: { opacity: 0, scale: 1.08, transition: { duration: 0.7, ease: 'easeIn' } },
                    }}
                  >
                    <div className="flex flex-row items-center justify-center">
                      <Shield className="w-16 h-16 text-white mr-4 shrink-0" strokeWidth={2} />
                      <span className="text-5xl font-bold text-white tracking-wide">FanDuel</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {events.length > 0 && (
              <div className="shrink-0 pt-2 pb-2 px-2 opacity-60">
                {renderOddsContent()}
              </div>
            )}
          </div>
        ) : (
          renderOddsContent()
        )}
      </div>
    </div>
  );
}

function GameRow({ index, awayTeam, homeTeam, time, isExpanded, onToggle, outcomesByBook, BOOK_LABELS, formatAmerican, muted = false }) {
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
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: index * 0.04 }}
      className={`border border-transparent hover:border-white/[0.06] ${muted ? 'opacity-70' : ''}`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left group flex rounded-none hover:bg-white/[0.03] transition-colors cursor-pointer gap-2 px-2.5 py-2"
      >
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-gray-200 leading-snug group-hover:text-white transition-colors break-words text-[13px] line-clamp-2 pr-1">
            {awayTeam} @ {homeTeam}
          </h4>
          <div className="flex items-center gap-2 mt-0.5 text-[11px]">
            <span className="text-gray-500">{time}</span>
          </div>
        </div>
        <span className="text-[11px] text-emerald-400/90 shrink-0">{isExpanded ? '−' : '+'}</span>
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
            <div className="px-2.5 py-2">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-gray-500">
                    <th className="text-left font-medium pb-1.5">Book</th>
                    <th className="text-right font-medium pb-1.5">{awayTeam}</th>
                    <th className="text-right font-medium pb-1.5">{homeTeam}</th>
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
                        <td className="py-1 text-gray-500">{BOOK_LABELS[book.key] || book.key}</td>
                        <td className="py-1 text-right">
                          <span className={isBestAway ? 'text-emerald-400 font-medium' : awayPrice != null && awayPrice > 0 ? 'text-emerald-400' : 'text-gray-200'}>
                            {formatAmerican(awayPrice)}
                          </span>
                        </td>
                        <td className="py-1 text-right">
                          <span className={isBestHome ? 'text-emerald-400 font-medium' : homePrice != null && homePrice > 0 ? 'text-emerald-400' : 'text-gray-200'}>
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
    </motion.div>
  );
}
