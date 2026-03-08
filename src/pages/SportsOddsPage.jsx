import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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

function formatGameTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const day = d.getDate();
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${weekday} ${month} ${day} • ${time}`;
  } catch {
    return iso;
  }
}

const LIVE_WINDOW_MS = 3 * 60 * 60 * 1000;
function isGameLive(commenceTime) {
  if (!commenceTime) return false;
  const now = Date.now();
  const commence = new Date(commenceTime).getTime();
  return commence <= now && now - commence <= LIVE_WINDOW_MS;
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

const SPORT_PILLS = [
  { key: 'basketball_nba', label: 'NBA', emoji: '🏀' },
  { key: 'ice_hockey_nhl', label: 'NHL', emoji: '🏒' },
  { key: 'americanfootball_nfl', label: 'NFL', emoji: '🏈' },
  { key: 'baseball_mlb', label: 'MLB', emoji: '⚾' },
];

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

const NHL_ABBREV = {
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
  'Vancouver Canucks': 'VAN',
  'Vegas Golden Knights': 'VGK',
  'Winnipeg Jets': 'WPG',
  'Washington Capitals': 'WSH',
  'Utah Hockey Club': 'UTA',
};

// ESPN CDN: https://a.espncdn.com/i/teamlogos/{league}/500/{abbrev}.png (lowercase)
const NFL_ABBREV = {
  'Arizona Cardinals': 'ari', 'Atlanta Falcons': 'atl', 'Baltimore Ravens': 'bal', 'Buffalo Bills': 'buf',
  'Carolina Panthers': 'car', 'Chicago Bears': 'chi', 'Cincinnati Bengals': 'cin', 'Cleveland Browns': 'cle',
  'Dallas Cowboys': 'dal', 'Denver Broncos': 'den', 'Detroit Lions': 'det', 'Green Bay Packers': 'gb',
  'Houston Texans': 'hou', 'Indianapolis Colts': 'ind', 'Jacksonville Jaguars': 'jax', 'Kansas City Chiefs': 'kc',
  'Las Vegas Raiders': 'lv', 'Los Angeles Chargers': 'lac', 'Los Angeles Rams': 'lar', 'Miami Dolphins': 'mia',
  'Minnesota Vikings': 'min', 'New England Patriots': 'ne', 'New Orleans Saints': 'no', 'New York Giants': 'nyg',
  'New York Jets': 'nyj', 'Philadelphia Eagles': 'phi', 'Pittsburgh Steelers': 'pit', 'San Francisco 49ers': 'sf',
  'Seattle Seahawks': 'sea', 'Tampa Bay Buccaneers': 'tb', 'Tennessee Titans': 'ten', 'Washington Commanders': 'wsh',
};

const MLB_ABBREV = {
  'Arizona Diamondbacks': 'ari', 'Atlanta Braves': 'atl', 'Baltimore Orioles': 'bal', 'Boston Red Sox': 'bos',
  'Chicago White Sox': 'cws', 'Chicago Cubs': 'chi', 'Cincinnati Reds': 'cin', 'Cleveland Guardians': 'cle',
  'Colorado Rockies': 'col', 'Detroit Tigers': 'det', 'Houston Astros': 'hou', 'Kansas City Royals': 'kc',
  'Los Angeles Angels': 'laa', 'Los Angeles Dodgers': 'lad', 'Miami Marlins': 'mia', 'Milwaukee Brewers': 'mil',
  'Minnesota Twins': 'min', 'New York Yankees': 'nyy', 'New York Mets': 'nym', 'Oakland Athletics': 'oak',
  'Philadelphia Phillies': 'phi', 'Pittsburgh Pirates': 'pit', 'San Diego Padres': 'sd', 'San Francisco Giants': 'sf',
  'Seattle Mariners': 'sea', 'St. Louis Cardinals': 'stl', 'Tampa Bay Rays': 'tb', 'Texas Rangers': 'tex',
  'Toronto Blue Jays': 'tor', 'Washington Nationals': 'wsh',
};

function teamInitials(name) {
  if (!name || typeof name !== 'string') return '?';
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return words.map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function TeamLogo({ teamName, sportKey, onError }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const isNba = sportKey === 'basketball_nba';
  const isNhl = sportKey === 'ice_hockey_nhl';
  const isNfl = sportKey === 'americanfootball_nfl';
  const isMlb = sportKey === 'baseball_mlb';

  const logoUrl = isNba && NBA_TEAM_IDS[teamName]
    ? `https://cdn.nba.com/logos/nba/${NBA_TEAM_IDS[teamName]}/primary/L/logo.svg`
    : isNhl && NHL_ABBREV[teamName]
      ? `https://assets.nhle.com/logos/nhl/svg/${NHL_ABBREV[teamName]}_light.svg`
      : isNfl && NFL_ABBREV[teamName]
        ? `https://a.espncdn.com/i/teamlogos/nfl/500/${NFL_ABBREV[teamName]}.png`
        : isMlb && MLB_ABBREV[teamName]
          ? `https://a.espncdn.com/i/teamlogos/mlb/500/${MLB_ABBREV[teamName]}.png`
          : null;

  const handleError = () => {
    setLogoFailed(true);
    onError?.();
  };

  if (logoUrl && !logoFailed) {
    return (
      <img
        src={logoUrl}
        alt=""
        className="w-7 h-7 object-contain flex-shrink-0"
        onError={handleError}
      />
    );
  }
  return (
    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
      {teamInitials(teamName)}
    </div>
  );
}

function getPreferredBookmaker(bookmakers) {
  const list = bookmakers || [];
  const fd = list.find((b) => b.key === 'fanduel' || (b.title && b.title.toLowerCase().includes('fanduel')));
  return fd || list[0];
}

function getMarketOutcomes(book, marketKey) {
  const market = (book.markets || []).find((m) => m.key === marketKey);
  return market?.outcomes || [];
}

function getSpreadForTeam(outcomes, teamName) {
  const o = outcomes.find((x) => x.name === teamName || (typeof x.name === 'string' && (x.name.includes(teamName) || teamName.includes(x.name))));
  return o ? { point: o.point, price: o.price } : { point: null, price: null };
}

function getTotals(outcomes) {
  const over = outcomes.find((x) => x.name && x.name.toLowerCase() === 'over');
  const under = outcomes.find((x) => x.name && x.name.toLowerCase() === 'under');
  const point = over?.point ?? under?.point ?? null;
  return { over: over ? { price: over.price } : { price: null }, under: under ? { price: under.price } : { price: null }, point };
}

function getMoneylineOutcomes(book) {
  return getMarketOutcomes(book, 'h2h');
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 400, damping: 30 },
  },
};

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
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-[#0a0a0f]/95 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 rounded-lg p-1.5 text-gray-400 hover:text-white transition-colors"
              aria-label="Back to dashboard"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <h1 className="text-lg font-semibold text-white">Sports Betting</h1>
        </div>
        <span className="text-xs text-gray-500">Powered by Live Odds</span>
      </div>

      {error && (
        <div className="mx-4 mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-6 text-center text-gray-500 text-sm">Loading sports…</div>
      ) : (
        <>
          {/* Sport selector pills */}
          <div className="px-4 pt-4 pb-2">
            <div className="flex flex-wrap items-center gap-2">
              {SPORT_PILLS.map((pill) => {
                const isActive = sportKey === pill.key;
                return (
                  <button
                    key={pill.key}
                    type="button"
                    onClick={() => setSportKey(pill.key)}
                    className={`relative rounded-full px-4 py-1.5 text-sm font-medium cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className="mr-1.5">{pill.emoji}</span>
                    {pill.label}
                    {isActive && (
                      <motion.div
                        layoutId="sport-tab"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 rounded-full"
                        style={{ originX: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-4 pb-8">
            {eventsLoading ? (
              <div className="space-y-3 pt-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-28 rounded-2xl bg-white/[0.03] animate-pulse" />
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <span className="text-4xl mb-3">🏆</span>
                <p className="text-gray-500 font-medium">No games today</p>
                <p className="text-gray-600 text-sm mt-1">Check back later for upcoming lines</p>
              </div>
            ) : (
              <motion.div
                className="space-y-3 pt-4"
                variants={containerVariants}
                initial="hidden"
                animate="show"
              >
                {events.map((event) => {
                  const book = getPreferredBookmaker(event.bookmakers);
                  const awayTeam = event.away_team || 'Away';
                  const homeTeam = event.home_team || 'Home';
                  const live = isGameLive(event.commence_time);

                  const spreadOutcomes = getMarketOutcomes(book, 'spreads');
                  const awaySpread = getSpreadForTeam(spreadOutcomes, awayTeam);
                  const homeSpread = getSpreadForTeam(spreadOutcomes, homeTeam);

                  const totalsOutcomes = getMarketOutcomes(book, 'totals');
                  const totals = getTotals(totalsOutcomes);

                  const mlOutcomes = getMoneylineOutcomes(book);
                  const awayMl = mlOutcomes.find((o) => o.name === awayTeam || (typeof o.name === 'string' && (o.name.includes(awayTeam) || awayTeam.includes(o.name))));
                  const homeMl = mlOutcomes.find((o) => o.name === homeTeam || (typeof o.name === 'string' && (o.name.includes(homeTeam) || homeTeam.includes(o.name))));

                  const bookTitle = book?.title || '';

                  return (
                    <motion.div
                      key={event.id}
                      variants={itemVariants}
                      className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl rounded-2xl border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)] p-5 mb-3 hover:border-white/10 transition-all duration-200"
                    >
                      {/* Top row: time + live */}
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs text-gray-500">{formatGameTime(event.commence_time)}</span>
                        {live && (
                          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                            </span>
                            LIVE
                          </span>
                        )}
                      </div>

                      {/* Column headers */}
                      <div className="flex items-center gap-3 mb-1">
                        <div className="w-7 flex-shrink-0" />
                        <div className="flex-1 min-w-0" />
                        <div className="flex items-center gap-2 flex-shrink-0 text-[10px] uppercase tracking-widest font-semibold text-gray-500">
                          <span className="min-w-[72px] text-center">Spread</span>
                          <span className="min-w-[72px] text-center">Total</span>
                          <span className="min-w-[72px] text-center">ML</span>
                        </div>
                      </div>

                      {/* Away team row */}
                      <div className="flex items-center gap-3">
                        <TeamLogo teamName={awayTeam} sportKey={sportKey} />
                        <span className="text-sm font-semibold text-white flex-1 min-w-0 truncate">{awayTeam}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <OddsButton line={awaySpread.point} odds={awaySpread.price} />
                          <OddsButton line={totals.point != null ? `O ${totals.point}` : null} odds={totals.over.price} />
                          <OddsButton line={null} odds={awayMl?.price} />
                        </div>
                      </div>
                      {/* Home team row */}
                      <div className="flex items-center gap-3 mt-2">
                        <TeamLogo teamName={homeTeam} sportKey={sportKey} />
                        <span className="text-sm font-semibold text-white flex-1 min-w-0 truncate">{homeTeam}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <OddsButton line={homeSpread.point} odds={homeSpread.price} />
                          <OddsButton line={totals.point != null ? `U ${totals.point}` : null} odds={totals.under.price} />
                          <OddsButton line={null} odds={homeMl?.price} />
                        </div>
                      </div>

                      {/* Bookmaker strip */}
                      {bookTitle && (
                        <p className="text-[10px] text-gray-600 text-right mt-2">{bookTitle}</p>
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function OddsButton({ line, odds }) {
  const hasValue = odds != null && odds !== '' && Number.isFinite(Number(odds));
  const hasLine = line != null && line !== '';

  return (
    <motion.button
      type="button"
      className={`min-w-[72px] rounded-xl px-3 py-2 text-center border transition-all duration-150 ${
        hasValue || hasLine
          ? 'bg-white/[0.06] border-white/[0.08] text-white hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400'
          : 'bg-transparent border-white/[0.04] text-gray-600 cursor-default'
      }`}
      whileHover={hasValue || hasLine ? { scale: 1.03 } : undefined}
      whileTap={hasValue || hasLine ? { scale: 0.97 } : undefined}
    >
      <div className="text-xs font-medium text-white">{hasLine ? String(line) : '—'}</div>
      <div className={`text-xs ${hasValue ? 'text-gray-400' : 'text-gray-600'}`}>
        {hasValue ? formatAmerican(odds) : '—'}
      </div>
    </motion.button>
  );
}
