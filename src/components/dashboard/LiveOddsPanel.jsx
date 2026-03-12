import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity } from 'lucide-react';

const ODDS_API = '/api/odds/events';
const DRAFTKINGS_URL = 'https://draftkings.com';
// Same book resolution as Sports page
function getBook(bookmakers, preferredKey = 'draftkings') {
  const books = bookmakers || [];
  return books.find((b) => b.key === preferredKey) || books.find((b) => b.key === 'draftkings') || books[0];
}
const LIVE_WINDOW_MS = 3 * 60 * 60 * 1000;
const NBA_LOGO_BASE = 'https://cdn.nba.com/logos/nba';

const NBA_TEAM_IDS = {
  'Atlanta Hawks': 1610612737,
  'Boston Celtics': 1610612738,
  'Brooklyn Nets': 1610612751,
  'Charlotte Hornets': 1610612766,
  'Chicago Bulls': 1610612741,
  'Cleveland Cavaliers': 1610612739,
  'Dallas Mavericks': 1610612742,
  'Denver Nuggets': 1610612743,
  'Detroit Pistons': 1610612765,
  'Golden State Warriors': 1610612744,
  'Houston Rockets': 1610612745,
  'Indiana Pacers': 1610612754,
  'Los Angeles Clippers': 1610612746,
  'Los Angeles Lakers': 1610612747,
  'Memphis Grizzlies': 1610612763,
  'Miami Heat': 1610612748,
  'Milwaukee Bucks': 1610612749,
  'Minnesota Timberwolves': 1610612750,
  'New Orleans Pelicans': 1610612740,
  'New York Knicks': 1610612752,
  'Oklahoma City Thunder': 1610612760,
  'Orlando Magic': 1610612753,
  'Philadelphia 76ers': 1610612755,
  'Phoenix Suns': 1610612756,
  'Portland Trail Blazers': 1610612757,
  'Sacramento Kings': 1610612758,
  'San Antonio Spurs': 1610612759,
  'Toronto Raptors': 1610612761,
  'Utah Jazz': 1610612762,
  'Washington Wizards': 1610612764,
};

const NHL_LOGO_ABBREV = {
  'Anaheim Ducks': 'ANA',
  'Arizona Coyotes': 'ARI',
  'Boston Bruins': 'BOS',
  'Buffalo Sabres': 'BUF',
  'Calgary Flames': 'CGY',
  'Carolina Hurricanes': 'CAR',
  'Chicago Blackhawks': 'CHI',
  'Colorado Avalanche': 'COL',
  'Columbus Blue Jackets': 'CBJ',
  'Dallas Stars': 'DAL',
  'Detroit Red Wings': 'DET',
  'Edmonton Oilers': 'EDM',
  'Florida Panthers': 'FLA',
  'Los Angeles Kings': 'LAK',
  'Minnesota Wild': 'MIN',
  'Montreal Canadiens': 'MTL',
  'Nashville Predators': 'NSH',
  'New Jersey Devils': 'NJD',
  'New York Islanders': 'NYI',
  'New York Rangers': 'NYR',
  'Ottawa Senators': 'OTT',
  'Philadelphia Flyers': 'PHI',
  'Pittsburgh Penguins': 'PIT',
  'San Jose Sharks': 'SJS',
  'Seattle Kraken': 'SEA',
  'St. Louis Blues': 'STL',
  'Tampa Bay Lightning': 'TBL',
  'Toronto Maple Leafs': 'TOR',
  'Utah Hockey Club': 'UTA',
  'Vancouver Canucks': 'VAN',
  'Vegas Golden Knights': 'VGK',
  'Washington Capitals': 'WSH',
  'Winnipeg Jets': 'WPG',
};

function formatTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatAmerican(price) {
  if (price == null || price === '') return '';
  const n = Number(price);
  if (!Number.isFinite(n)) return '';
  return n > 0 ? `+${n}` : String(n);
}

function getMarket(book, key) {
  const market = (book.markets || []).find((m) => m.key === key);
  return market?.outcomes || [];
}

function getMoneylineOutcomes(book) {
  return getMarket(book, 'h2h');
}

function matchOutcome(outcomes, teamName) {
  if (!Array.isArray(outcomes) || !teamName) return null;
  const t = String(teamName).trim().toLowerCase();
  return (
    outcomes.find(
      (o) =>
        o &&
        o.name &&
        (String(o.name).trim().toLowerCase() === t ||
          String(o.name).trim().toLowerCase().includes(t) ||
          t.includes(String(o.name).trim().toLowerCase()))
    ) || null
  );
}

function getSpreadOutcomes(book) {
  return getMarket(book, 'spreads');
}

function getTotalsOutcomes(book) {
  const outs = getMarket(book, 'totals');
  const over = outs.find((o) => o.name && String(o.name).toLowerCase() === 'over');
  const under = outs.find((o) => o.name && String(o.name).toLowerCase() === 'under');
  return { over, under, point: over?.point ?? under?.point };
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

function teamAbbrev(name) {
  if (!name || typeof name !== 'string') return '???';
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return words.map((w) => w[0]).join('').slice(0, 3).toUpperCase();
  return name.slice(0, 3).toUpperCase();
}

function TeamLogo({ teamName, league = 'nba' }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const isNHL = league === 'nhl';
  const logoUrl = isNHL
    ? (() => {
        const abbrev = NHL_LOGO_ABBREV[teamName];
        return abbrev ? `https://assets.nhle.com/logos/nhl/svg/${abbrev}_light.svg` : null;
      })()
    : (() => {
        const teamId = NBA_TEAM_IDS[teamName];
        return teamId ? `${NBA_LOGO_BASE}/${teamId}/primary/L/logo.svg` : null;
      })();

  if (logoUrl && !logoFailed) {
    return (
      <img
        src={logoUrl}
        alt=""
        className="w-7 h-7 object-contain mr-2 flex-shrink-0"
        onError={() => setLogoFailed(true)}
      />
    );
  }
  const fallbackAbbrev = isNHL && NHL_LOGO_ABBREV[teamName] ? NHL_LOGO_ABBREV[teamName] : teamAbbrev(teamName);
  return (
    <div className="w-7 h-7 rounded-full bg-[#1a1a1a] border border-white/[0.06] flex items-center justify-center text-xs font-bold text-white mr-2 flex-shrink-0">
      {fallbackAbbrev}
    </div>
  );
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  show: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 400, damping: 30 },
  },
};

export default function LiveOddsPanel({ selectedGames = [], isArticleOpen = false, onLiveLinesExpand, onLiveLinesCollapse, isBottomPanelExpanded }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeLeague, setActiveLeague] = useState('nba');

  const hasLiveGame = events.some((e) => isGameLive(e.commence_time));
  const sportParamMap = { nba: 'basketball_nba', nhl: 'ice_hockey_nhl', nfl: 'americanfootball_nfl', mlb: 'baseball_mlb' };
  const sportParam = sportParamMap[activeLeague] || 'basketball_nba';

  useEffect(() => {
    if (isBottomPanelExpanded) setIsExpanded(true);
  }, [isBottomPanelExpanded]);

  // Same feed as Sports page: same URL, no date filter, live-first sort
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetch(`${ODDS_API}?sport=${sportParam}&regions=us&oddsFormat=american`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.error) {
          setError(data.error);
          setEvents([]);
          return;
        }
        const list = Array.isArray(data) ? data : [];
        const sorted = [...list].sort((a, b) => {
          const aLive = isGameLive(a.commence_time) ? 0 : 1;
          const bLive = isGameLive(b.commence_time) ? 0 : 1;
          if (aLive !== bLive) return aLive - bLive;
          return new Date(a.commence_time) - new Date(b.commence_time);
        });
        setEvents(sorted);
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
  }, [activeLeague]);

  const openDraftKings = () => {
    window.open(DRAFTKINGS_URL, '_blank');
  };

  return (
    <div
      className="flex flex-col h-full min-h-0 overflow-hidden"
      style={{
        width: '100%',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      {/* Tab bar: fixed height so horizontal line aligns with News header */}
      <div className="flex flex-row h-10 items-center gap-1 px-3 border-b border-white/[0.06] shrink-0">
        <button
          type="button"
          onClick={() => {
            if (isBottomPanelExpanded) {
              onLiveLinesCollapse?.();
            } else {
              setIsExpanded(true);
              onLiveLinesExpand?.();
            }
          }}
          className={`relative text-xs font-medium px-3 py-2 cursor-pointer transition-colors flex-shrink-0 ${isExpanded ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          aria-label="Live Lines"
        >
          <Activity className="w-3.5 h-3.5 inline-block mr-1.5 align-middle" strokeWidth={1.5} />
          <span>Live Lines</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveLeague('nba')}
          className={`relative text-xs font-medium px-3 py-2 cursor-pointer transition-colors flex-shrink-0 ${activeLeague === 'nba' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          aria-label="NBA"
        >
          <span className="inline-block mr-1.5">🏀</span>
          <span>NBA</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveLeague('nhl')}
          className={`relative text-xs font-medium px-3 py-2 cursor-pointer transition-colors flex-shrink-0 ${activeLeague === 'nhl' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          aria-label="NHL"
        >
          <span className="inline-block mr-1.5">🏒</span>
          <span>NHL</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveLeague('nfl')}
          className={`relative text-xs font-medium px-3 py-2 cursor-pointer transition-colors flex-shrink-0 ${activeLeague === 'nfl' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          aria-label="NFL"
        >
          <span className="inline-block mr-1.5">🏈</span>
          <span>NFL</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveLeague('mlb')}
          className={`relative text-xs font-medium px-3 py-2 cursor-pointer transition-colors flex-shrink-0 ${activeLeague === 'mlb' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          aria-label="MLB"
        >
          <span className="inline-block mr-1.5">⚾</span>
          <span>MLB</span>
        </button>
      </div>

      {/* Collapsed: minimal content; expanded: full game list */}
      {!isExpanded ? (
        <div className="flex-1 min-h-0" style={{ minHeight: 24 }} aria-hidden />
      ) : (
        <>
      {/* Column headers: Spread, Moneyline, Total */}
      <div className="shrink-0 grid grid-cols-[1fr_auto] gap-2 px-3 pb-1">
        <div />
        <div className="flex gap-3 w-[280px]">
          <div className="flex-1 text-center">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Spread</span>
          </div>
          <div className="flex-1 text-center">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Moneyline</span>
          </div>
          <div className="flex-1 text-center">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total</span>
          </div>
        </div>
      </div>

      {/* Game list */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-hide px-3 pb-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12 px-3">
            <span className="text-[11px] text-red-400/80 text-center">{error}</span>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeLeague}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="min-h-0"
            >
              {events.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <span className="text-[11px] text-gray-500">No games today</span>
                </div>
              ) : (
                <motion.div
                  className="divide-y divide-white/[0.06]"
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                >
                  {events.map((event) => {
                    const book = getBook(event.bookmakers, 'draftkings');
                    const homeTeam = event.home_team || 'Home';
                    const awayTeam = event.away_team || 'Away';
                    const timeStr = formatTime(event.commence_time);
                    const live = isGameLive(event.commence_time);

                    const mlOutcomes = book ? getMoneylineOutcomes(book) : [];
                    const awayMl = matchOutcome(mlOutcomes, awayTeam);
                    const homeMl = matchOutcome(mlOutcomes, homeTeam);

                    const spreadOutcomes = book ? getSpreadOutcomes(book) : [];
                    const awaySpread = matchOutcome(spreadOutcomes, awayTeam);
                    const homeSpread = matchOutcome(spreadOutcomes, homeTeam);

                    const totals = book ? getTotalsOutcomes(book) : { over: null, under: null, point: null };

                    const fmt = (v) => (v != null && v !== '' && Number.isFinite(Number(v)) ? formatAmerican(v) : '—');
                    const spreadPt = (o) => (o?.point != null && o.point !== '' ? (Number(o.point) > 0 ? `+${o.point}` : String(o.point)) : null);

                    return (
                      <motion.div
                        key={event.id}
                        variants={itemVariants}
                        className="py-3 cursor-pointer hover:bg-white/[0.03] transition-colors"
                        onClick={openDraftKings}
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <TeamLogo teamName={awayTeam} league={activeLeague} />
                              <span className="text-sm font-medium text-white truncate">{awayTeam}</span>
                              {live && (
                                <span className="text-[10px] font-bold text-emerald-400 uppercase flex-shrink-0">Live</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5 pl-9">AT</div>
                            <div className="flex items-center gap-2 min-w-0 mt-0.5">
                              <TeamLogo teamName={homeTeam} league={activeLeague} />
                              <span className="text-sm font-medium text-white truncate">{homeTeam}</span>
                            </div>
                          </div>
                          <div className="flex gap-3 w-[280px] flex-shrink-0">
                            <div className="flex-1 flex flex-col gap-0.5 text-center">
                              <span className="text-[13px] font-semibold text-white leading-tight">{spreadPt(awaySpread) ?? '—'}</span>
                              <span className="text-[12px] font-mono text-gray-400">{fmt(awaySpread?.price)}</span>
                              <span className="text-[13px] font-semibold text-white leading-tight mt-1">{spreadPt(homeSpread) ?? '—'}</span>
                              <span className="text-[12px] font-mono text-gray-400">{fmt(homeSpread?.price)}</span>
                            </div>
                            <div className="flex-1 flex flex-col gap-0.5 text-center">
                              <span className="text-[12px] text-white/60">—</span>
                              <span className="text-[13px] font-mono font-semibold text-emerald-400">{fmt(awayMl?.price)}</span>
                              <span className="text-[12px] text-white/60 mt-1">—</span>
                              <span className="text-[13px] font-mono font-semibold text-emerald-400">{fmt(homeMl?.price)}</span>
                            </div>
                            <div className="flex-1 flex flex-col gap-0.5 text-center">
                              <span className="text-[13px] font-semibold text-white leading-tight">{totals.point != null ? `O ${totals.point}` : '—'}</span>
                              <span className="text-[12px] font-mono text-gray-400">{fmt(totals.over?.price)}</span>
                              <span className="text-[13px] font-semibold text-white leading-tight mt-1">{totals.point != null ? `U ${totals.point}` : '—'}</span>
                              <span className="text-[12px] font-mono text-gray-400">{fmt(totals.under?.price)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2 pl-9">
                          <span className="border border-emerald-500 text-emerald-400 text-[10px] rounded px-1.5 py-0.5">
                            SGP
                          </span>
                          <span className="text-xs text-gray-500">{timeStr ? `Today ${timeStr}` : 'Today'}</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
        </>
      )}
    </div>
  );
}

function OddsCell({ value, odds }) {
  const oddsClass = odds != null && Number.isFinite(Number(odds)) ? 'text-emerald-400' : 'text-gray-500';

  return (
    <motion.div
      className="bg-[#1a1a1a] rounded-lg border border-white/[0.06] text-center px-3 py-2 text-xs"
      whileHover={{ scale: 1.05 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      {value != null && value !== '' && <div className="text-white">{value}</div>}
      <div className={oddsClass}>{formatAmerican(odds)}</div>
    </motion.div>
  );
}
