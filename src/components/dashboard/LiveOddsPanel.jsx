import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, ClipboardList, X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { calcPayout } from '../../lib/sportsUtils';
import { getApiUrl } from '../../lib/api';

const ODDS_API = getApiUrl('oddsEvents');
const DRAFTKINGS_URL = 'https://draftkings.com';

// ESPN scoreboard — same source as the top ESPN ticker pills
const ESPN_ENDPOINTS = {
  nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  nhl: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
  nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  mlb: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
  ncaab: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard',
};
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

function getEspnScore(scoresMap, teamName) {
  if (!scoresMap || !teamName) return null;
  const key = String(teamName).trim().toLowerCase();
  const entry = scoresMap[key];
  return entry || null;
}

// Animated score that pulses gold on change then returns to normal
function AnimatedScore({ score, isWinning }) {
  const [flash, setFlash] = useState(false);
  const prevScore = useRef(score);

  useEffect(() => {
    if (score != null && prevScore.current != null && score !== prevScore.current) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 1800);
      prevScore.current = score;
      return () => clearTimeout(timer);
    }
    prevScore.current = score;
  }, [score]);

  if (score == null) return null;

  const baseColor = isWinning ? 'text-emerald-400' : 'text-white';

  return (
    <motion.span
      key={score}
      initial={flash ? { scale: 1.5 } : { scale: 1 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`text-[15px] font-bold font-mono tabular-nums transition-colors duration-700 ${flash ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]' : baseColor}`}
    >
      {score}
    </motion.span>
  );
}

export default function LiveOddsPanel({ selectedGames = [], isArticleOpen = false, onLiveLinesExpand, onLiveLinesCollapse, isBottomPanelExpanded }) {
  const [events, setEvents] = useState([]);
  const [scoresMap, setScoresMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeLeague, setActiveLeague] = useState('nba');
  const [activeTab, setActiveTab] = useState('lines'); // 'lines' or 'slip'
  const [slip, setSlip] = useState([]);
  const [toast, setToast] = useState(null);
  const [placing, setPlacing] = useState(false);

  const addBetToSlip = useCallback((payload) => {
    setSlip((prev) => [
      ...prev,
      {
        id: Date.now(),
        team: payload.selection,
        betType: payload.bet_type,
        selection: payload.selection,
        line: payload.line,
        odds: payload.odds,
        book: payload.book,
        stake: 100,
        sport: payload.sport,
        league: payload.league,
        home_team: payload.home_team,
        away_team: payload.away_team,
        game_id: payload.game_id,
      },
    ]);
    setActiveTab('slip');
  }, []);

  const handleSlipStakeChange = useCallback((id, value) => {
    setSlip((prev) => prev.map((b) => (b.id === id ? { ...b, stake: Math.max(1, Number(value) || 0) } : b)));
  }, []);
  const handleSlipRemove = useCallback((id) => setSlip((prev) => prev.filter((b) => b.id !== id)), []);
  const handleSlipClear = useCallback(() => setSlip([]), []);

  const handlePlaceBets = useCallback(async () => {
    if (placing) return;
    setPlacing(true);
    try {
      const { data: { user } } = await Promise.race([
        supabase.auth.getUser(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Auth timeout')), 5000)),
      ]);
      if (!user?.id) return;
      let { data: bankroll } = await supabase
        .from('paper_sports_bankroll')
        .select('balance, total_wagered')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!bankroll) {
        const { data: inserted } = await supabase
          .from('paper_sports_bankroll')
          .upsert({ user_id: user.id, balance: 100000, total_wagered: 0, wins: 0, losses: 0, total_pushes: 0, current_streak: 0 }, { onConflict: 'user_id' })
          .select('balance, total_wagered')
          .single();
        bankroll = inserted;
      }
      const totalStake = slip.reduce((sum, bet) => sum + Number(bet.stake || 0), 0);
      if (!bankroll || totalStake > Number(bankroll.balance)) {
        setToast('Insufficient bankroll');
        setTimeout(() => setToast(null), 3000);
        return;
      }
      const betsToInsert = slip.map((bet) => ({
        user_id: user.id,
        sport: bet.sport,
        league: bet.league,
        game_id: bet.game_id,
        home_team: bet.home_team,
        away_team: bet.away_team,
        bet_type: bet.betType,
        selection: bet.selection,
        line: bet.line,
        odds: bet.odds,
        stake: Number(bet.stake),
        potential_payout: calcPayout(Number(bet.stake), bet.odds),
        book: bet.book,
        status: 'pending',
      }));
      const { error: insertError } = await supabase.from('paper_sports_bets').insert(betsToInsert);
      if (insertError) {
        setToast('Failed to place bet');
        setTimeout(() => setToast(null), 3000);
        return;
      }
      await supabase
        .from('paper_sports_bankroll')
        .update({
          balance: Number(bankroll.balance) - totalStake,
          total_wagered: (Number(bankroll.total_wagered) || 0) + totalStake,
        })
        .eq('user_id', user.id);
      setSlip([]);
      setToast('Bets placed! Good luck');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setPlacing(false);
    }
  }, [slip, placing]);

  // Show Score column if any game is live OR final (so final scores remain visible)
  const hasLiveGame = events.some((e) => {
    const away = getEspnScore(scoresMap, e.away_team);
    const home = getEspnScore(scoresMap, e.home_team);
    return away?.isLive || home?.isLive || away?.isFinal || home?.isFinal || isGameLive(e.commence_time);
  });
  const sportParamMap = { nba: 'basketball_nba', nhl: 'ice_hockey_nhl', nfl: 'americanfootball_nfl', mlb: 'baseball_mlb', ncaab: 'basketball_ncaab' };
  const sportParam = sportParamMap[activeLeague] || 'basketball_nba';

  useEffect(() => {
    if (isBottomPanelExpanded) setIsExpanded(true);
  }, [isBottomPanelExpanded]);

  // Fetch odds
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

  // Fetch live scores from ESPN — poll every 15s for smoother updates
  useEffect(() => {
    let cancelled = false;
    setScoresMap({}); // Clear stale scores on league switch
    const espnUrl = ESPN_ENDPOINTS[activeLeague];
    if (!espnUrl) return;
    const fetchScores = () => {
      fetch(espnUrl)
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          const espnEvents = data?.events || [];
          const map = {};
          espnEvents.forEach((ev) => {
            const comp = ev.competitions?.[0];
            const competitors = comp?.competitors || [];
            const state = comp?.status?.type?.state;
            if (state === 'pre') return; // Skip pre-game
            const shortDetail = comp?.status?.type?.shortDetail || '';
            competitors.forEach((c) => {
              const fullName = c.team?.displayName;
              if (fullName) {
                const key = fullName.toLowerCase();
                // Prefer live game data over finished game data
                if (map[key] && map[key].isLive && state === 'post') return;
                map[key] = {
                  score: c.score || '0',
                  isLive: state === 'in',
                  isFinal: state === 'post',
                  statusDetail: shortDetail,
                };
              }
            });
          });
          setScoresMap(map);
        })
        .catch(() => {});
    };
    fetchScores();
    const interval = setInterval(fetchScores, 15000);
    return () => { cancelled = true; clearInterval(interval); };
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
          onClick={() => { setActiveLeague('nba'); setActiveTab('lines'); }}
          className={`relative text-xs font-medium px-3 py-2 cursor-pointer transition-colors flex-shrink-0 ${activeLeague === 'nba' && activeTab === 'lines' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          aria-label="NBA"
        >
          <span className="inline-block mr-1.5">🏀</span>
          <span>NBA</span>
        </button>
        <button
          type="button"
          onClick={() => { setActiveLeague('nhl'); setActiveTab('lines'); }}
          className={`relative text-xs font-medium px-3 py-2 cursor-pointer transition-colors flex-shrink-0 ${activeLeague === 'nhl' && activeTab === 'lines' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          aria-label="NHL"
        >
          <span className="inline-block mr-1.5">🏒</span>
          <span>NHL</span>
        </button>
        <button
          type="button"
          onClick={() => { setActiveLeague('nfl'); setActiveTab('lines'); }}
          className={`relative text-xs font-medium px-3 py-2 cursor-pointer transition-colors flex-shrink-0 ${activeLeague === 'nfl' && activeTab === 'lines' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          aria-label="NFL"
        >
          <span className="inline-block mr-1.5">🏈</span>
          <span>NFL</span>
        </button>
        <button
          type="button"
          onClick={() => { setActiveLeague('mlb'); setActiveTab('lines'); }}
          className={`relative text-xs font-medium px-3 py-2 cursor-pointer transition-colors flex-shrink-0 ${activeLeague === 'mlb' && activeTab === 'lines' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          aria-label="MLB"
        >
          <span className="inline-block mr-1.5">⚾</span>
          <span>MLB</span>
        </button>
        <button
          type="button"
          onClick={() => { setActiveLeague('ncaab'); setActiveTab('lines'); }}
          className={`relative text-xs font-medium px-3 py-2 cursor-pointer transition-colors flex-shrink-0 ${activeLeague === 'ncaab' && activeTab === 'lines' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          aria-label="NCAAB"
        >
          <span className="inline-block mr-1.5">🏀</span>
          <span>NCAAB</span>
        </button>
        {/* Spacer to push Paper Slip to the right */}
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setActiveTab(activeTab === 'slip' ? 'lines' : 'slip')}
          className={`relative text-xs font-medium px-3 py-2 cursor-pointer transition-colors flex-shrink-0 ${activeTab === 'slip' ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'}`}
          aria-label="Paper Slip"
        >
          <ClipboardList className="w-3.5 h-3.5 inline-block mr-1 align-middle" strokeWidth={1.5} />
          <span>Paper Slip</span>
          {slip.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 text-[10px] font-bold text-black">{slip.length}</span>
          )}
        </button>
      </div>

      {/* Collapsed: minimal content; expanded: full game list or slip */}
      {!isExpanded ? (
        <div className="flex-1 min-h-0" style={{ minHeight: 24 }} aria-hidden />
      ) : activeTab === 'slip' ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {slip.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-12">
              <span className="mb-2 text-2xl opacity-60">📋</span>
              <p className="text-center text-sm text-gray-500">Click any odds to add to slip</p>
            </div>
          ) : (
            <>
              {/* Bet cards */}
              <div className="flex-1 min-h-0 overflow-y-auto p-3 scrollbar-hide">
                <AnimatePresence initial={false}>
                  {slip.map((b) => (
                    <motion.div
                      key={b.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20, height: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className="mb-2 rounded-xl border border-white/[0.04] bg-black/20 p-3"
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-sm font-medium text-white">{b.team}</span>
                        <button
                          type="button"
                          onClick={() => handleSlipRemove(b.id)}
                          className="text-gray-500 transition-colors hover:text-red-400"
                          aria-label="Remove"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="font-mono text-xs text-gray-400">
                        {b.betType} · {b.line != null ? b.line : '—'} · {Number(b.odds) > 0 ? `+${b.odds}` : b.odds}
                      </div>
                      <div className="text-xs text-gray-500">{b.book}</div>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-gray-400">$</span>
                        <input
                          type="number"
                          min={1}
                          value={b.stake}
                          onChange={(e) => handleSlipStakeChange(b.id, e.target.value)}
                          className="w-24 rounded-lg border border-white/[0.04] bg-black/40 px-2 py-1 font-mono text-sm text-white shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)]"
                        />
                      </div>
                      <div className="mt-1 font-mono text-xs text-emerald-400">
                        Payout: ${calcPayout(Number(b.stake) || 0, Number(b.odds)).toFixed(2)}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Footer: totals + place bet */}
              <div className="shrink-0 border-t border-white/[0.06] px-4 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Total stake</span>
                  <span className="font-mono text-white">${slip.reduce((s, b) => s + Number(b.stake || 0), 0).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Potential payout</span>
                  <span className="font-mono text-emerald-400">${slip.reduce((s, b) => s + calcPayout(Number(b.stake) || 0, Number(b.odds)), 0).toFixed(2)}</span>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  <motion.button
                    type="button"
                    onClick={handlePlaceBets}
                    disabled={slip.length === 0 || placing}
                    className="w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  >
                    {placing ? 'Placing...' : 'Place Paper Bet'}
                  </motion.button>
                  <button
                    type="button"
                    onClick={handleSlipClear}
                    className="w-full py-1.5 text-xs text-gray-500 transition-colors duration-200 hover:text-white"
                  >
                    Clear Slip
                  </button>
                </div>
              </div>
            </>
          )}
          {toast && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-emerald-500/90 text-black text-xs font-semibold px-4 py-2 rounded-lg shadow-lg z-50">
              {toast}
            </div>
          )}
        </div>
      ) : (
        <>
      {/* Column headers: Score (if live), Spread, Moneyline, Total */}
      <div className="shrink-0 flex items-center gap-2 px-3 pb-1">
        <div className="flex-1" />
        {hasLiveGame && (
          <div className="flex-shrink-0 w-10 text-center">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Score</span>
          </div>
        )}
        <div className="flex gap-3 flex-shrink-0 w-[240px]">
          <div className="flex-1 text-center">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Spread</span>
          </div>
          <div className="flex-1 text-center">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Moneyline</span>
          </div>
          <div className="flex-1 text-center">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total</span>
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
                    const bookName = book?.title || book?.key || 'DraftKings';
                    const homeTeam = event.home_team || 'Home';
                    const awayTeam = event.away_team || 'Away';
                    const timeStr = formatTime(event.commence_time);
                    const awayEspn = getEspnScore(scoresMap, awayTeam);
                    const homeEspn = getEspnScore(scoresMap, homeTeam);
                    const isFinal = awayEspn?.isFinal || homeEspn?.isFinal;
                    const isEspnLive = awayEspn?.isLive || homeEspn?.isLive;
                    const live = isFinal ? false : (isEspnLive || (!awayEspn && !homeEspn && isGameLive(event.commence_time)));
                    const showScores = live || isFinal;
                    const awayScore = showScores ? (awayEspn?.score ?? null) : null;
                    const homeScore = showScores ? (homeEspn?.score ?? null) : null;
                    const statusDetail = awayEspn?.statusDetail || homeEspn?.statusDetail || '';

                    const mlOutcomes = book ? getMoneylineOutcomes(book) : [];
                    const awayMl = matchOutcome(mlOutcomes, awayTeam);
                    const homeMl = matchOutcome(mlOutcomes, homeTeam);

                    const spreadOutcomes = book ? getSpreadOutcomes(book) : [];
                    const awaySpread = matchOutcome(spreadOutcomes, awayTeam);
                    const homeSpread = matchOutcome(spreadOutcomes, homeTeam);

                    const totals = book ? getTotalsOutcomes(book) : { over: null, under: null, point: null };

                    const fmt = (v) => (v != null && v !== '' && Number.isFinite(Number(v)) ? formatAmerican(v) : '—');
                    const spreadPt = (o) => (o?.point != null && o.point !== '' ? (Number(o.point) > 0 ? `+${o.point}` : String(o.point)) : null);

                    const awayNum = awayScore != null ? Number(awayScore) : null;
                    const homeNum = homeScore != null ? Number(homeScore) : null;
                    const awayWinning = awayNum != null && homeNum != null && awayNum > homeNum;
                    const homeWinning = awayNum != null && homeNum != null && homeNum > awayNum;

                    // Helpers to build bet payload for this game
                    const betBase = { sport: sportParam, league: activeLeague, home_team: homeTeam, away_team: awayTeam, game_id: event.id, book: bookName };
                    const canBet = !isFinal; // Don't allow betting on finished games

                    return (
                      <motion.div
                        key={event.id}
                        variants={itemVariants}
                        className="py-3"
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <TeamLogo teamName={awayTeam} league={activeLeague} />
                              <span className="text-sm font-medium text-white truncate">{awayTeam}</span>
                              {live && (
                                <span className="text-xs font-bold text-emerald-400 uppercase flex-shrink-0 bg-emerald-400/10 px-1.5 py-0.5 rounded">
                                  LIVE{statusDetail && !statusDetail.toLowerCase().startsWith('final') ? ` · ${statusDetail}` : ''}
                                </span>
                              )}
                              {isFinal && (
                                <span className="text-xs font-bold text-gray-400 uppercase flex-shrink-0 bg-white/[0.06] px-1.5 py-0.5 rounded">FINAL</span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5 pl-9">AT</div>
                            <div className="flex items-center gap-2 min-w-0 mt-0.5">
                              <TeamLogo teamName={homeTeam} league={activeLeague} />
                              <span className="text-sm font-medium text-white truncate">{homeTeam}</span>
                            </div>
                          </div>
                          {hasLiveGame && (
                            <div className="flex flex-col items-center justify-between flex-shrink-0 w-10 self-stretch py-0.5">
                              {showScores && awayScore != null ? (
                                <AnimatedScore score={awayScore} isWinning={awayWinning} />
                              ) : <span />}
                              {showScores && homeScore != null ? (
                                <AnimatedScore score={homeScore} isWinning={homeWinning} />
                              ) : <span />}
                            </div>
                          )}
                          <div className="flex gap-3 flex-shrink-0 w-[240px]">
                            {/* Spread column — clickable */}
                            <div className="flex-1 flex flex-col gap-0.5 text-center">
                              <ClickableOddsCell
                                label={spreadPt(awaySpread)}
                                odds={awaySpread?.price}
                                canBet={canBet && awaySpread?.price != null}
                                onClick={() => addBetToSlip({ ...betBase, bet_type: 'spread', selection: awayTeam, line: awaySpread?.point, odds: awaySpread?.price })}
                              />
                              <ClickableOddsCell
                                label={spreadPt(homeSpread)}
                                odds={homeSpread?.price}
                                canBet={canBet && homeSpread?.price != null}
                                onClick={() => addBetToSlip({ ...betBase, bet_type: 'spread', selection: homeTeam, line: homeSpread?.point, odds: homeSpread?.price })}
                                className="mt-1"
                              />
                            </div>
                            {/* Moneyline column — clickable */}
                            <div className="flex-1 flex flex-col gap-0.5 text-center">
                              <ClickableOddsCell
                                label={null}
                                odds={awayMl?.price}
                                isMoneyline
                                canBet={canBet && awayMl?.price != null}
                                onClick={() => addBetToSlip({ ...betBase, bet_type: 'moneyline', selection: awayTeam, line: null, odds: awayMl?.price })}
                              />
                              <ClickableOddsCell
                                label={null}
                                odds={homeMl?.price}
                                isMoneyline
                                canBet={canBet && homeMl?.price != null}
                                onClick={() => addBetToSlip({ ...betBase, bet_type: 'moneyline', selection: homeTeam, line: null, odds: homeMl?.price })}
                                className="mt-1"
                              />
                            </div>
                            {/* Totals column — clickable */}
                            <div className="flex-1 flex flex-col gap-0.5 text-center">
                              <ClickableOddsCell
                                label={totals.point != null ? `O ${totals.point}` : null}
                                odds={totals.over?.price}
                                canBet={canBet && totals.over?.price != null}
                                onClick={() => addBetToSlip({ ...betBase, bet_type: 'total', selection: 'Over', line: totals.point, odds: totals.over?.price })}
                              />
                              <ClickableOddsCell
                                label={totals.point != null ? `U ${totals.point}` : null}
                                odds={totals.under?.price}
                                canBet={canBet && totals.under?.price != null}
                                onClick={() => addBetToSlip({ ...betBase, bet_type: 'total', selection: 'Under', line: totals.point, odds: totals.under?.price })}
                                className="mt-1"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-0 pl-9">
                          <span className="text-[11px] text-gray-500">{timeStr ? `Today ${timeStr}` : 'Today'}</span>
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
      {toast && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-emerald-500/90 text-black text-xs font-semibold px-4 py-2 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}
        </>
      )}
    </div>
  );
}

function ClickableOddsCell({ label, odds, isMoneyline, canBet, onClick, className = '' }) {
  const fmtOdds = odds != null && odds !== '' && Number.isFinite(Number(odds)) ? formatAmerican(odds) : '—';
  const hasOdds = fmtOdds !== '—';

  if (!hasOdds) {
    return (
      <div className={className}>
        <span className="text-[13px] text-gray-500">—</span>
      </div>
    );
  }

  return (
    <div
      className={`${canBet ? 'cursor-pointer hover:bg-emerald-500/10 rounded-md transition-colors' : ''} ${className}`}
      onClick={canBet ? (e) => { e.stopPropagation(); onClick(); } : undefined}
    >
      {label != null && <span className="text-[15px] font-semibold text-white leading-tight">{label}</span>}
      <span className={`text-[${isMoneyline ? '15' : '13'}px] font-mono ${isMoneyline ? 'font-semibold text-emerald-400' : 'text-gray-400'}`}>
        {fmtOdds}
      </span>
    </div>
  );
}
