import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Activity,
  Clock,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ChevronDown,
} from 'lucide-react';
import SportsBankroll from '../components/dashboard/SportsBankroll';
import PaperBettingSlip from '../components/dashboard/PaperBettingSlip';

const SPRING = { type: 'spring', stiffness: 400, damping: 30 };

const NAV_SECTIONS = [
  {
    label: 'Popular',
    items: [
      { key: 'live', label: 'Live now', icon: '🔴', badge: 29 },
      { key: 'rewards', label: 'Rewards', icon: '🎁' },
      { key: 'basketball_nba', label: 'NBA', icon: '🏀' },
      { key: 'ice_hockey_nhl', label: 'NHL', icon: '🏒' },
      { key: 'basketball_ncaab', label: 'NCAAB', icon: '🏀' },
      { key: 'americanfootball_ncaaf', label: 'NCAAF', icon: '🏈' },
      { key: 'baseball_mlb', label: 'MLB', icon: '⚾' },
      { key: 'americanfootball_nfl', label: 'NFL', icon: '🏈' },
      { key: 'soccer_epl', label: 'Soccer', icon: '⚽' },
      { key: 'basketball_ncaaw', label: 'NCAAW', icon: '🏀' },
      { key: 'golf_pga', label: 'PGA Tour', icon: '⛳' },
      { key: 'mma_mixed_martial_arts', label: 'UFC', icon: '🥊' },
      { key: 'parlay', label: 'Parlay Hub', icon: '⚡' },
      { key: 'popular_bets', label: 'Popular Bets', icon: '🔥' },
      { key: 'womens', label: "Women's", icon: '👟' },
      { key: 'learn', label: 'Learn to Bet', icon: '🎓', labelColor: '#00d455' },
      { key: 'free_play', label: 'Free to Play', icon: '🆓', labelColor: '#00d455' },
    ],
  },
  {
    label: 'All Sports',
    items: [
      { key: 'aussie_rules_afl', label: 'Aussie Rules', icon: '🏉' },
      { key: 'boxing_boxing', label: 'Boxing', icon: '🥊' },
      { key: 'cricket_odi', label: 'Cricket', icon: '🏏' },
      { key: 'cycling_tour_de_france', label: 'Cycling', icon: '🚴' },
      { key: 'darts_pdc', label: 'Darts', icon: '🎯' },
      { key: 'golf_pga', label: 'Golf', icon: '⛳' },
      { key: 'handball_euro', label: 'Handball', icon: '🤾' },
      { key: 'lacrosse_nll', label: 'Lacrosse', icon: '🥍' },
      { key: 'motorsport_f1', label: 'Motorsport', icon: '🏎️' },
      { key: 'tennis_atp', label: 'Tennis', icon: '🎾' },
      { key: 'volleyball_ncaav', label: 'Volleyball', icon: '🏐' },
    ],
  },
];

const API_SPORTS = new Set([
  'basketball_nba',
  'ice_hockey_nhl',
  'baseball_mlb',
  'americanfootball_nfl',
  'americanfootball_ncaaf',
  'mma_mixed_martial_arts',
  'basketball_ncaab',
  'basketball_ncaaw',
  'soccer_epl',
]);

const BOOKS = [
  { key: 'draftkings', label: 'DraftKings', color: '#00d455', deepLink: 'https://www.draftkings.com/lobby#' },
  { key: 'fanduel', label: 'FanDuel', color: '#1493ff', deepLink: 'https://www.fanduel.com/sportsbook' },
  { key: 'betmgm', label: 'BetMGM', color: '#c9a84c', deepLink: 'https://sports.betmgm.com/' },
];

// Vercel env: VITE_DRAFTKINGS_AFFILIATE_TAG, VITE_FANDUEL_AFFILIATE_TAG, VITE_BETMGM_AFFILIATE_TAG
function getAffiliateUrl(bookKey) {
  if (bookKey === 'draftkings') return `https://sportsbook.draftkings.com/?wpcid=${import.meta.env.VITE_DRAFTKINGS_AFFILIATE_TAG || 'stratify'}`;
  if (bookKey === 'fanduel') return `https://www.fanduel.com/sportsbook?pid=${import.meta.env.VITE_FANDUEL_AFFILIATE_TAG || 'stratify'}`;
  if (bookKey === 'betmgm') return `https://sports.betmgm.com/en/sports?rtag=${import.meta.env.VITE_BETMGM_AFFILIATE_TAG || 'stratify'}`;
  return '#';
}

const DETAIL_TABS = [
  'Live SGP',
  'Featured',
  'Quick Bets',
  'Player Points',
  'Player Threes',
  'Player Rebounds',
  'Player Assists',
];

const NBA_IDS = {
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
const NHL_AB = {
  'Anaheim Ducks': 'ANA',
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
const NFL_AB = {
  'Arizona Cardinals': 'ari',
  'Atlanta Falcons': 'atl',
  'Baltimore Ravens': 'bal',
  'Buffalo Bills': 'buf',
  'Carolina Panthers': 'car',
  'Chicago Bears': 'chi',
  'Cincinnati Bengals': 'cin',
  'Cleveland Browns': 'cle',
  'Dallas Cowboys': 'dal',
  'Denver Broncos': 'den',
  'Detroit Lions': 'det',
  'Green Bay Packers': 'gb',
  'Houston Texans': 'hou',
  'Indianapolis Colts': 'ind',
  'Jacksonville Jaguars': 'jax',
  'Kansas City Chiefs': 'kc',
  'Las Vegas Raiders': 'lv',
  'Los Angeles Chargers': 'lac',
  'Los Angeles Rams': 'lar',
  'Miami Dolphins': 'mia',
  'Minnesota Vikings': 'min',
  'New England Patriots': 'ne',
  'New Orleans Saints': 'no',
  'New York Giants': 'nyg',
  'New York Jets': 'nyj',
  'Philadelphia Eagles': 'phi',
  'Pittsburgh Steelers': 'pit',
  'San Francisco 49ers': 'sf',
  'Seattle Seahawks': 'sea',
  'Tampa Bay Buccaneers': 'tb',
  'Tennessee Titans': 'ten',
  'Washington Commanders': 'wsh',
};
const MLB_AB = {
  'Arizona Diamondbacks': 'ari',
  'Atlanta Braves': 'atl',
  'Baltimore Orioles': 'bal',
  'Boston Red Sox': 'bos',
  'Chicago White Sox': 'cws',
  'Chicago Cubs': 'chi',
  'Cincinnati Reds': 'cin',
  'Cleveland Guardians': 'cle',
  'Colorado Rockies': 'col',
  'Detroit Tigers': 'det',
  'Houston Astros': 'hou',
  'Kansas City Royals': 'kc',
  'Los Angeles Angels': 'laa',
  'Los Angeles Dodgers': 'lad',
  'Miami Marlins': 'mia',
  'Milwaukee Brewers': 'mil',
  'Minnesota Twins': 'min',
  'New York Yankees': 'nyy',
  'New York Mets': 'nym',
  'Oakland Athletics': 'oak',
  'Philadelphia Phillies': 'phi',
  'Pittsburgh Pirates': 'pit',
  'San Diego Padres': 'sd',
  'San Francisco Giants': 'sf',
  'Seattle Mariners': 'sea',
  'St. Louis Cardinals': 'stl',
  'Tampa Bay Rays': 'tb',
  'Texas Rangers': 'tex',
  'Toronto Blue Jays': 'tor',
  'Washington Nationals': 'wsh',
};

function teamInitials(name = '') {
  const w = String(name).trim().split(/\s+/);
  return w.length >= 2 ? w.map((x) => x[0]).join('').slice(0, 3).toUpperCase() : String(name).slice(0, 2).toUpperCase();
}
function teamAbbrev(name = '') {
  const w = String(name).trim().split(/\s+/);
  return w.length >= 2 ? w[w.length - 1].slice(0, 3).toUpperCase() : String(name).slice(0, 3).toUpperCase();
}

function TeamLogo({ teamName, sportKey, size = 32 }) {
  const [err, setErr] = useState(false);
  const url =
    !err &&
    (sportKey === 'basketball_nba' && NBA_IDS[teamName]
      ? `https://cdn.nba.com/logos/nba/${NBA_IDS[teamName]}/primary/L/logo.svg`
      : sportKey === 'ice_hockey_nhl' && NHL_AB[teamName]
        ? `https://assets.nhle.com/logos/nhl/svg/${NHL_AB[teamName]}_light.svg`
        : sportKey === 'americanfootball_nfl' && NFL_AB[teamName]
          ? `https://a.espncdn.com/i/teamlogos/nfl/500/${NFL_AB[teamName]}.png`
          : sportKey === 'baseball_mlb' && MLB_AB[teamName]
            ? `https://a.espncdn.com/i/teamlogos/mlb/500/${MLB_AB[teamName]}.png`
            : null);
  if (url)
    return (
      <img
        src={url}
        alt=""
        style={{ width: size, height: size }}
        className="object-contain flex-shrink-0"
        onError={() => setErr(true)}
      />
    );
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-lg bg-white/[0.06] flex items-center justify-center text-[10px] font-bold text-white/50 flex-shrink-0 border border-white/[0.06]"
    >
      {teamInitials(teamName)}
    </div>
  );
}

function getBook(bm, key) {
  return (bm || []).find((b) => b.key === key) || (bm || []).find((b) => b.key === 'draftkings') || (bm || [])[0];
}
function getMarket(book, key) {
  return (book?.markets || []).find((m) => m.key === key)?.outcomes || [];
}
function matchTeam(outcomes, teamName) {
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
function getSpread(outs, team) {
  const o = matchTeam(outs, team);
  return o ? { point: o.point, price: o.price } : { point: null, price: null };
}
function getTotals(outs) {
  const ov = outs.find((x) => x.name?.toLowerCase() === 'over');
  const un = outs.find((x) => x.name?.toLowerCase() === 'under');
  return { over: ov?.price ?? null, under: un?.price ?? null, point: ov?.point ?? un?.point ?? null };
}
function getMl(outs, team) {
  return matchTeam(outs, team);
}

const LIVE_MS = 4 * 60 * 60 * 1000;
function isLive(t) {
  if (!t) return false;
  const now = Date.now();
  const c = new Date(t).getTime();
  return c <= now && now - c <= LIVE_MS;
}
function formatGameTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  } catch {
    return iso;
  }
}
function fmtAm(price) {
  if (price == null) return '—';
  const n = Number(price);
  if (!Number.isFinite(n)) return '—';
  return n > 0 ? `+${n}` : String(n);
}
function fmtPt(pt) {
  if (pt == null) return null;
  const n = Number(pt);
  return n > 0 ? `+${n}` : String(n);
}

function OddsCell({ topLabel, bottomLabel, selected, onToggle, movingDown, movingUp, bookKey, bookLabel, onAddBetToSlip, betPayload }) {
  const hasTop = topLabel != null && topLabel !== '' && topLabel !== '—';
  const hasBot = bottomLabel != null && bottomLabel !== '' && bottomLabel !== '—';
  const handleClick = () => {
    if (bookKey) {
      window.open(getAffiliateUrl(bookKey), '_blank');
      if (onAddBetToSlip && betPayload) {
        onAddBetToSlip({
          sport: betPayload.sport,
          league: betPayload.league,
          home_team: betPayload.home_team,
          away_team: betPayload.away_team,
          bet_type: betPayload.bet_type,
          selection: betPayload.selection,
          line: betPayload.line,
          odds: betPayload.odds,
          book: bookLabel || BOOKS.find((b) => b.key === bookKey)?.label || bookKey,
        });
      }
    }
    onToggle?.();
  };
  if (!hasTop && !hasBot) {
    return (
      <div className="flex-1 h-[72px] flex items-center justify-center border border-[#1e2028] rounded-lg bg-[#0f1117]">
        <span className="text-gray-600 text-xs">—</span>
      </div>
    );
  }
  const botNum = parseFloat(bottomLabel);
  const isPos = !isNaN(botNum) && botNum > 0;
  return (
    <motion.button
      type="button"
      onClick={handleClick}
      title={bookLabel ? `Bet on ${bookLabel} →` : undefined}
      className={`flex-1 h-[72px] flex flex-col items-center justify-center rounded-lg border transition-colors gap-0.5 relative cursor-pointer ${
        selected
          ? 'bg-blue-500/20 border-blue-400/60 shadow-[0_0_12px_rgba(59,130,246,0.25)]'
          : 'bg-[#0f1117] border-[#1e2028] hover:bg-[#151820] hover:border-[#2a2d35]'
      }`}
      whileHover={{ scale: 1.05, color: '#10b981' }}
      whileTap={{ scale: 0.95 }}
      transition={SPRING}
    >
      {(movingDown || movingUp) && (
        <div className={`absolute top-1 right-1.5 ${movingDown ? 'text-red-400' : 'text-emerald-400'}`}>
          {movingDown ? <span style={{ fontSize: 7 }}>▼</span> : <span style={{ fontSize: 7 }}>▲</span>}
        </div>
      )}
      {hasTop && (
        <span className={`text-[13px] font-bold leading-none font-mono ${selected ? 'text-blue-300' : 'text-white'}`}>
          {topLabel}
        </span>
      )}
      {hasBot && (
        <span
          className={`text-[11px] leading-none font-mono ${selected ? 'text-blue-400' : isPos ? 'text-emerald-400' : 'text-[#8b8fa8]'}`}
        >
          {bottomLabel}
        </span>
      )}
    </motion.button>
  );
}

function GameDetailView({ event, sportKey, bookKey, bookLabel, addBetToSlip, onBack }) {
  const [activeTab, setActiveTab] = useState('Live SGP');
  const [sels, setSels] = useState({});
  const toggle = (k) => setSels((s) => ({ ...s, [k]: !s[k] }));
  const book = getBook(event.bookmakers, bookKey);
  const away = event.away_team || 'Away';
  const home = event.home_team || 'Home';
  const live = isLive(event.commence_time);
  const spreads = getMarket(book, 'spreads');
  const aSpread = getSpread(spreads, away);
  const hSpread = getSpread(spreads, home);
  const tots = getTotals(getMarket(book, 'totals'));
  const mls = getMarket(book, 'h2h');
  const aMl = getMl(mls, away);
  const hMl = getMl(mls, home);
  const awayScore = live ? Math.floor(Math.random() * 40 + 70) : null;
  const homeScore = live ? Math.floor(Math.random() * 40 + 70) : null;
  const sportLabel = NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.key === sportKey)?.label || 'Sport';
  const period =
    sportKey.includes('nba') || sportKey.includes('basketball')
      ? '3rd · 2:02'
      : sportKey.includes('nhl') || sportKey.includes('hockey')
        ? '2nd · 8:14'
        : '2nd Half';

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={SPRING}
      className="bg-[#0f1117] rounded-2xl border border-[#1e2028] overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
    >
      <div className="px-5 pt-4 pb-2 border-b border-[#1e2028] bg-[#0d0f15]">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1.5">
          <button onClick={onBack} className="hover:text-white transition-colors flex items-center gap-1">
            <ChevronLeft className="w-3 h-3" /> {sportLabel}
          </button>
          <ChevronRight className="w-3 h-3" />
          <span>Odds</span>
          <ChevronRight className="w-3 h-3" />
          <span className="text-gray-400">{away} @ {home} Odds</span>
        </div>
        <h2 className="text-[16px] font-bold text-white">{away} @ {home} Odds</h2>
      </div>

      {live && (
        <div className="bg-[#13161e] border-b border-[#1e2028] px-5 py-6">
          <div className="flex items-center justify-center gap-10">
            <div className="flex flex-col items-center gap-2">
              <TeamLogo teamName={away} sportKey={sportKey} size={72} />
              <div className="text-center">
                <div className="text-[11px] font-bold text-gray-400 tracking-widest uppercase mb-1">{teamAbbrev(away)}</div>
                <div className="text-[48px] font-bold text-white font-mono leading-none tabular-nums">{awayScore}</div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="bg-red-600 text-white text-[13px] font-bold px-4 py-2 rounded font-mono tracking-wide">
                {period}
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <TeamLogo teamName={home} sportKey={sportKey} size={72} />
              <div className="text-center">
                <div className="text-[11px] font-bold text-gray-400 tracking-widest uppercase mb-1">{teamAbbrev(home)}</div>
                <div className="text-[48px] font-bold text-white font-mono leading-none tabular-nums">{homeScore}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="border-b border-[#1e2028] bg-[#0d0f15] px-4 overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {DETAIL_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative px-4 py-3 text-[13px] font-semibold whitespace-nowrap transition-colors ${
                activeTab === tab ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <motion.div
                  layoutId="detail-tab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400 rounded-t-full"
                  transition={SPRING}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        <div className="bg-[#13161e] rounded-xl border border-[#1e2028] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2028]">
            <span className="text-[14px] font-bold text-white">Game Lines</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-yellow-400 border border-yellow-400/30 px-2 py-0.5 rounded bg-yellow-400/5">
                SGP
              </span>
              <ChevronDown className="w-4 h-4 text-gray-500" />
            </div>
          </div>
          <div className="flex items-center px-4 py-2 border-b border-[#1a1d24] bg-[#0f1117]">
            <div className="flex-1" />
            <div className="flex gap-1.5" style={{ width: 300 }}>
              {['SPREAD', 'MONEY', 'TOTAL'].map((h) => (
                <div key={h} className="flex-1 text-center">
                  <span className="text-[9px] font-bold tracking-[0.16em] text-[#4a4d5e] uppercase">{h}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center px-4 py-2 border-b border-[#1e2028]">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <TeamLogo teamName={away} sportKey={sportKey} size={24} />
              <span className="text-[13px] font-semibold text-white truncate">{away}</span>
            </div>
            <div className="flex gap-1.5 flex-shrink-0" style={{ width: 300 }}>
              <OddsCell
                topLabel={fmtPt(aSpread.point)}
                bottomLabel={fmtAm(aSpread.price)}
                selected={!!sels['a-spread']}
                onToggle={() => toggle('a-spread')}
                movingDown
                bookKey={bookKey}
                bookLabel={bookLabel}
                onAddBetToSlip={addBetToSlip}
                betPayload={{ sport: sportKey, league: sportKey, home_team: home, away_team: away, bet_type: 'Spread', selection: away, line: fmtPt(aSpread.point) ?? '', odds: aSpread.price }}
              />
              <OddsCell
                topLabel={null}
                bottomLabel={fmtAm(aMl?.price)}
                selected={!!sels['a-ml']}
                onToggle={() => toggle('a-ml')}
                movingDown
                bookKey={bookKey}
                bookLabel={bookLabel}
                onAddBetToSlip={addBetToSlip}
                betPayload={{ sport: sportKey, league: sportKey, home_team: home, away_team: away, bet_type: 'Moneyline', selection: away, line: '', odds: aMl?.price }}
              />
              <OddsCell
                topLabel={tots.point != null ? `O ${tots.point}` : null}
                bottomLabel={fmtAm(tots.over)}
                selected={!!sels['over']}
                onToggle={() => toggle('over')}
                movingDown
                bookKey={bookKey}
                bookLabel={bookLabel}
                onAddBetToSlip={addBetToSlip}
                betPayload={{ sport: sportKey, league: sportKey, home_team: home, away_team: away, bet_type: 'Total', selection: tots.point != null ? `O ${tots.point}` : '', line: tots.point != null ? `O ${tots.point}` : '', odds: tots.over }}
              />
            </div>
          </div>
          <div className="flex items-center px-4 py-1.5 border-b border-[#1e2028]">
            <span className="text-[11px] text-gray-600">@</span>
            <div className="flex-1 ml-3 border-t border-white/[0.04]" />
          </div>
          <div className="flex items-center px-4 py-2">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <TeamLogo teamName={home} sportKey={sportKey} size={24} />
              <span className="text-[13px] font-semibold text-white truncate">{home}</span>
            </div>
            <div className="flex gap-1.5 flex-shrink-0" style={{ width: 300 }}>
              <OddsCell
                topLabel={fmtPt(hSpread.point)}
                bottomLabel={fmtAm(hSpread.price)}
                selected={!!sels['h-spread']}
                onToggle={() => toggle('h-spread')}
                movingUp
                bookKey={bookKey}
                bookLabel={bookLabel}
                onAddBetToSlip={addBetToSlip}
                betPayload={{ sport: sportKey, league: sportKey, home_team: home, away_team: away, bet_type: 'Spread', selection: home, line: fmtPt(hSpread.point) ?? '', odds: hSpread.price }}
              />
              <OddsCell
                topLabel={null}
                bottomLabel={fmtAm(hMl?.price)}
                selected={!!sels['h-ml']}
                onToggle={() => toggle('h-ml')}
                movingUp
                bookKey={bookKey}
                bookLabel={bookLabel}
                onAddBetToSlip={addBetToSlip}
                betPayload={{ sport: sportKey, league: sportKey, home_team: home, away_team: away, bet_type: 'Moneyline', selection: home, line: '', odds: hMl?.price }}
              />
              <OddsCell
                topLabel={tots.point != null ? `U ${tots.point}` : null}
                bottomLabel={fmtAm(tots.under)}
                selected={!!sels['under']}
                onToggle={() => toggle('under')}
                movingUp
                bookKey={bookKey}
                bookLabel={bookLabel}
                onAddBetToSlip={addBetToSlip}
                betPayload={{ sport: sportKey, league: sportKey, home_team: home, away_team: away, bet_type: 'Total', selection: tots.point != null ? `U ${tots.point}` : '', line: tots.point != null ? `U ${tots.point}` : '', odds: tots.under }}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="px-5 py-2.5 border-t border-[#1e2028] flex items-center justify-between bg-[#0d0f15]">
        <span className="text-xs text-[#3a3d4e]">Data via The Odds API</span>
        <span className="text-xs text-[#3a3d4e]">21+ · Gamble responsibly</span>
      </div>
    </motion.div>
  );
}

const rowV = { hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: SPRING } };

function GameCard({ event, sportKey, bookKey, bookLabel, addBetToSlip, onSelect }) {
  const [sels, setSels] = useState({});
  const toggle = (k) => setSels((s) => ({ ...s, [k]: !s[k] }));
  const book = getBook(event.bookmakers, bookKey);
  const away = event.away_team || 'Away';
  const home = event.home_team || 'Home';
  const live = isLive(event.commence_time);
  const spreads = getMarket(book, 'spreads');
  const aSpread = getSpread(spreads, away);
  const hSpread = getSpread(spreads, home);
  const tots = getTotals(getMarket(book, 'totals'));
  const mls = getMarket(book, 'h2h');
  const aMl = getMl(mls, away);
  const hMl = getMl(mls, home);

  return (
    <motion.div
      variants={rowV}
      className="border-b border-[#1e2028] last:border-0 hover:bg-white/[0.01] transition-colors"
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-1.5">
        <div className="flex items-center gap-2">
          {live ? (
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <span className="text-[11px] font-bold text-emerald-400 tracking-widest uppercase">Live</span>
              <span className="text-[11px] text-gray-500 font-medium ml-1">
                · {sportKey.includes('nba') || sportKey.includes('basketball') ? '3RD QTR' : sportKey.includes('nhl') || sportKey.includes('hockey') ? '2ND PER' : '2ND HALF'}
              </span>
            </span>
          ) : (
            <span className="text-[11px] text-gray-500">{formatGameTime(event.commence_time)}</span>
          )}
        </div>
        <button
          onClick={() => onSelect(event)}
          className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-0.5"
        >
          More wagers <ChevronRight className="w-3 h-3" />
        </button>
      </div>
      <div className="px-4 pb-3 flex gap-3">
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <TeamLogo teamName={away} sportKey={sportKey} size={30} />
            <span className="text-[14px] font-semibold text-white truncate flex-1">{away}</span>
            {live && (
              <span className="text-[16px] font-bold text-white font-mono flex-shrink-0 w-8 text-right tabular-nums">
                {Math.floor(Math.random() * 40 + 60)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 pl-1">
            <span className="text-[10px] text-gray-600 font-medium">@</span>
            <div className="flex-1 border-t border-white/[0.04]" />
          </div>
          <div className="flex items-center gap-2.5 min-w-0">
            <TeamLogo teamName={home} sportKey={sportKey} size={30} />
            <span className="text-[14px] font-semibold text-white truncate flex-1">{home}</span>
            {live && (
              <span className="text-[16px] font-bold text-white font-mono flex-shrink-0 w-8 text-right tabular-nums">
                {Math.floor(Math.random() * 40 + 70)}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1.5 flex-shrink-0" style={{ width: 240 }}>
          <div className="flex flex-col gap-1.5 flex-1">
            <OddsCell
              topLabel={fmtPt(aSpread.point)}
              bottomLabel={fmtAm(aSpread.price)}
              selected={!!sels['a-spread']}
              onToggle={() => toggle('a-spread')}
              bookKey={bookKey}
              bookLabel={bookLabel}
              onAddBetToSlip={addBetToSlip}
              betPayload={{ sport: sportKey, league: sportKey, home_team: home, away_team: away, bet_type: 'Spread', selection: away, line: fmtPt(aSpread.point) ?? '', odds: aSpread.price }}
            />
            <OddsCell
              topLabel={fmtPt(hSpread.point)}
              bottomLabel={fmtAm(hSpread.price)}
              selected={!!sels['h-spread']}
              onToggle={() => toggle('h-spread')}
              bookKey={bookKey}
              bookLabel={bookLabel}
              onAddBetToSlip={addBetToSlip}
              betPayload={{ sport: sportKey, league: sportKey, home_team: home, away_team: away, bet_type: 'Spread', selection: home, line: fmtPt(hSpread.point) ?? '', odds: hSpread.price }}
            />
          </div>
          <div className="flex flex-col gap-1.5 flex-1">
            <OddsCell
              topLabel={null}
              bottomLabel={fmtAm(aMl?.price)}
              selected={!!sels['a-ml']}
              onToggle={() => toggle('a-ml')}
              bookKey={bookKey}
              bookLabel={bookLabel}
              onAddBetToSlip={addBetToSlip}
              betPayload={{ sport: sportKey, league: sportKey, home_team: home, away_team: away, bet_type: 'Moneyline', selection: away, line: '', odds: aMl?.price }}
            />
            <OddsCell
              topLabel={null}
              bottomLabel={fmtAm(hMl?.price)}
              selected={!!sels['h-ml']}
              onToggle={() => toggle('h-ml')}
              bookKey={bookKey}
              bookLabel={bookLabel}
              onAddBetToSlip={addBetToSlip}
              betPayload={{ sport: sportKey, league: sportKey, home_team: home, away_team: away, bet_type: 'Moneyline', selection: home, line: '', odds: hMl?.price }}
            />
          </div>
          <div className="flex flex-col gap-1.5 flex-1">
            <OddsCell
              topLabel={tots.point != null ? `O ${tots.point}` : null}
              bottomLabel={fmtAm(tots.over)}
              selected={!!sels['over']}
              onToggle={() => toggle('over')}
              bookKey={bookKey}
              bookLabel={bookLabel}
              onAddBetToSlip={addBetToSlip}
              betPayload={{ sport: sportKey, league: sportKey, home_team: home, away_team: away, bet_type: 'Total', selection: tots.point != null ? `O ${tots.point}` : '', line: tots.point != null ? `O ${tots.point}` : '', odds: tots.over }}
            />
            <OddsCell
              topLabel={tots.point != null ? `U ${tots.point}` : null}
              bottomLabel={fmtAm(tots.under)}
              selected={!!sels['under']}
              onToggle={() => toggle('under')}
              bookKey={bookKey}
              bookLabel={bookLabel}
              onAddBetToSlip={addBetToSlip}
              betPayload={{ sport: sportKey, league: sportKey, home_team: home, away_team: away, bet_type: 'Total', selection: tots.point != null ? `U ${tots.point}` : '', line: tots.point != null ? `U ${tots.point}` : '', odds: tots.under }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function GameSkeleton() {
  return (
    <div className="border-b border-[#1e2028] animate-pulse px-4 py-3 flex gap-3">
      <div className="flex flex-col gap-3 flex-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/[0.05]" />
          <div className="h-4 flex-1 bg-white/[0.05] rounded" />
        </div>
        <div className="h-px bg-white/[0.04]" />
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/[0.05]" />
          <div className="h-4 flex-1 bg-white/[0.05] rounded" />
        </div>
      </div>
      <div className="flex gap-1.5 flex-shrink-0" style={{ width: 240 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-1.5 flex-1">
            <div className="h-[72px] rounded-lg bg-white/[0.04]" />
            <div className="h-[72px] rounded-lg bg-white/[0.04]" />
          </div>
        ))}
      </div>
    </div>
  );
}

const listV = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.02 } } };

function GamesPanel({ sportKey, bookKey, bookLabel, refreshKey, addBetToSlip }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetch(`/api/odds/events?sport=${encodeURIComponent(sportKey)}&regions=us&oddsFormat=american`)
      .then((r) => r.json())
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
        if (!cancelled) setError(e?.message || 'Failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [sportKey, refreshKey]);

  const sorted = [...events].sort((a, b) => {
    const al = isLive(a.commence_time) ? 0 : 1;
    const bl = isLive(b.commence_time) ? 0 : 1;
    if (al !== bl) return al - bl;
    return new Date(a.commence_time) - new Date(b.commence_time);
  });
  const sportLabel = NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.key === sportKey)?.label || 'NBA';

  return (
    <AnimatePresence mode="wait">
      {selected ? (
        <GameDetailView
          key="detail"
          event={selected}
          sportKey={sportKey}
          bookKey={bookKey}
          bookLabel={bookLabel}
          addBetToSlip={addBetToSlip}
          onBack={() => setSelected(null)}
        />
      ) : (
        <motion.div
          key="list"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="bg-[#0f1117] rounded-2xl border border-[#1e2028] overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
        >
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1e2028] bg-[#13161e]">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-bold text-white">{sportLabel} Odds</span>
              {!loading && !error && events.length > 0 && (
                <span className="flex items-center gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                  </span>
                  <span className="text-xs text-emerald-400 font-semibold">Live</span>
                </span>
              )}
            </div>
            <a href="#" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
              More {sportLabel} <ChevronRight className="w-3 h-3" />
            </a>
          </div>
          <div className="flex items-center px-4 py-2 border-b border-[#1a1d24]">
            <div className="flex-1">
              <span className="text-[11px] font-bold text-[#4a4d5e] uppercase tracking-widest">{sportLabel}</span>
            </div>
            <div className="flex gap-1.5 flex-shrink-0" style={{ width: 240 }}>
              {['SPREAD', 'MONEY', 'TOTAL'].map((h) => (
                <div key={h} className="flex-1 text-center">
                  <span className="text-[9px] font-bold tracking-[0.16em] text-[#4a4d5e] uppercase">{h}</span>
                </div>
              ))}
            </div>
          </div>
          {loading ? (
            <div>
              {[1, 2, 3, 4].map((i) => (
                <GameSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center text-amber-400 text-sm">{error}</div>
          ) : !events.length ? (
            <motion.div
              className="flex flex-col items-center justify-center py-16"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={SPRING}
            >
              <span className="text-4xl mb-3">🏆</span>
              <p className="text-gray-400 font-semibold">No games right now</p>
            </motion.div>
          ) : (
            <motion.div variants={listV} initial="hidden" animate="show">
              {sorted.map((ev) => (
                <GameCard
                  key={ev.id}
                  event={ev}
                  sportKey={sportKey}
                  bookKey={bookKey}
                  bookLabel={bookLabel}
                  addBetToSlip={addBetToSlip}
                  onSelect={setSelected}
                />
              ))}
            </motion.div>
          )}
          <div className="px-5 py-2.5 border-t border-[#1e2028] flex items-center justify-between bg-[#0d0f15]">
            <span className="text-xs text-[#3a3d4e]">Data via The Odds API · Powered by Stratify</span>
            <span className="text-xs text-[#3a3d4e]">21+ only</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function LeftNav({ activeKey, onSelect }) {
  return (
    <div className="w-48 shrink-0 flex flex-col gap-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
      {NAV_SECTIONS.map((section) => (
        <div key={section.label} className="mb-1">
          <div className="px-3 py-2 text-xs font-bold text-white/80 tracking-tight">{section.label}</div>
          {section.items.map((item) => {
            const isActive = activeKey === item.key;
            return (
              <motion.button
                key={item.key}
                type="button"
                onClick={() => onSelect(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-xl text-left transition-colors relative ${
                  isActive ? 'text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.02]'
                }`}
                whileHover={{ x: 1 }}
                whileTap={{ scale: 0.98 }}
                transition={SPRING}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-xl bg-white/[0.07] border border-white/[0.08]"
                    transition={SPRING}
                  />
                )}
                <span className="text-base leading-none relative z-10 w-5 text-center flex-shrink-0">{item.icon}</span>
                <span className="text-[13px] font-medium relative z-10 flex-1 truncate" style={item.labelColor ? { color: item.labelColor } : {}}>
                  {item.label}
                </span>
                {item.badge != null && (
                  <span className="relative z-10 text-[10px] font-bold bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                    {item.badge}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function OddsMovement({ value }) {
  if (value === 0) return <Minus className="w-3 h-3 text-gray-500" />;
  return value > 0 ? (
    <span className="flex items-center gap-0.5 text-xs text-emerald-400 font-mono">
      <ArrowUpRight className="w-3 h-3" />
      {value}
    </span>
  ) : (
    <span className="flex items-center gap-0.5 text-xs text-red-400 font-mono">
      <ArrowDownRight className="w-3 h-3" />
      {Math.abs(value)}
    </span>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={SPRING}
      className="bg-[#0f1117] rounded-2xl border border-[#1e2028] p-4 flex-1 min-w-0 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
    >
      <div className="text-xs font-semibold tracking-widest text-gray-500 uppercase mb-2">{label}</div>
      <div className={`text-2xl font-bold font-mono ${accent || 'text-white'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </motion.div>
  );
}

const MOCK_MOVES = [
  { team: 'Chiefs', line: '-6.5', move: -0.5, sport: 'NFL' },
  { team: 'Lakers', line: '+110', move: 15, sport: 'NBA' },
  { team: 'Yankees', line: '-165', move: -10, sport: 'MLB' },
  { team: 'Celtics', line: '-8', move: 1, sport: 'NBA' },
  { team: 'Cowboys', line: '+3.5', move: 0.5, sport: 'NFL' },
  { team: 'Oilers', line: '-145', move: -20, sport: 'NHL' },
  { team: 'Padres', line: '+130', move: 5, sport: 'MLB' },
  { team: 'Panthers', line: '+4', move: -1, sport: 'NFL' },
];

function LineMovementTicker() {
  const doubled = [...MOCK_MOVES, ...MOCK_MOVES];
  return (
    <div className="relative overflow-hidden h-8 flex items-center">
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#0a0a0f] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#0a0a0f] to-transparent z-10 pointer-events-none" />
      <motion.div
        className="flex gap-6 items-center"
        animate={{ x: ['-50%', '0%'] }}
        transition={{ duration: 28, ease: 'linear', repeat: Infinity }}
      >
        {doubled.map((item, i) => (
          <span key={i} className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-xs text-gray-500 font-semibold">{item.sport}</span>
            <span className="text-xs text-white font-mono font-medium">{item.team}</span>
            <span
              className={`text-xs font-mono font-bold ${item.move > 0 ? 'text-emerald-400' : item.move < 0 ? 'text-red-400' : 'text-gray-400'}`}
            >
              {item.line}
            </span>
            <OddsMovement value={item.move} />
            <span className="text-white/10 ml-1">·</span>
          </span>
        ))}
      </motion.div>
    </div>
  );
}

export default function SportsOddsPage() {
  const [activeNavKey, setActiveNavKey] = useState('basketball_nba');
  const [activeBook, setActiveBook] = useState(BOOKS[0]);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [bets, setBets] = useState([]);
  const activeSportKey = API_SPORTS.has(activeNavKey) ? activeNavKey : 'basketball_nba';
  const addBetToSlip = useCallback(
    (payload) =>
      setBets((prev) => [
        ...prev,
        {
          id: Date.now(),
          stake: 100,
          sport: payload.sport,
          league: payload.league,
          home_team: payload.home_team,
          away_team: payload.away_team,
          bet_type: payload.bet_type,
          selection: payload.selection,
          line: payload.line,
          odds: payload.odds,
          book: payload.book,
        },
      ]),
    []
  );
  const handleSlipStakeChange = useCallback((id, value) => {
    setBets((prev) => prev.map((b) => (b.id === id ? { ...b, stake: Math.max(1, Number(value) || 0) } : b)));
  }, []);
  const handleSlipRemove = useCallback((id) => setBets((prev) => prev.filter((b) => b.id !== id)), []);
  const handleSlipClear = useCallback(() => setBets([]), []);
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => {
      setLastUpdated(new Date());
      setRefreshKey((k) => k + 1);
      setIsRefreshing(false);
    }, 900);
  }, []);
  const fmtTime = (d) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={SPRING}
      className="min-h-screen bg-[#0a0a0f] text-white px-4 py-5 flex flex-col gap-4"
    >
      <SportsBankroll />

      {/* Top: Header with Live pulse, Refresh, book selector, Bet CTA */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold tracking-tight">Sports Lines</h1>
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
              <span className="text-xs font-semibold text-emerald-400 tracking-wider uppercase">Live</span>
            </span>
          </div>
          <p className="text-xs text-gray-500">Real-time odds · Line movements update live</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <Clock className="w-3 h-3" />
            <span className="font-mono">{fmtTime(lastUpdated)}</span>
          </div>
          <motion.button
            onClick={handleRefresh}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={SPRING}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-[#1e2028] text-xs text-gray-400 hover:text-white transition-colors"
          >
            <motion.div animate={isRefreshing ? { rotate: 360 } : { rotate: 0 }} transition={{ duration: 0.7, ease: 'easeInOut' }}>
              <RefreshCw className="w-3 h-3" />
            </motion.div>
            Refresh
          </motion.button>
          <div className="flex items-center gap-1 bg-[#0f1117] rounded-xl p-0.5 border border-[#1e2028]">
            {BOOKS.map((book) => (
              <motion.button
                key={book.key}
                onClick={() => setActiveBook(book)}
                whileTap={{ scale: 0.96 }}
                transition={SPRING}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  activeBook.key === book.key ? 'text-white' : 'text-gray-500 hover:text-gray-400'
                }`}
              >
                {activeBook.key === book.key && (
                  <motion.div
                    layoutId="book-tab"
                    className="absolute inset-0 rounded-lg bg-white/[0.08] border border-white/[0.08]"
                    transition={SPRING}
                  />
                )}
                <span className="relative z-10" style={activeBook.key === book.key ? { color: book.color } : {}}>
                  {book.label}
                </span>
              </motion.button>
            ))}
          </div>
          <motion.a
            href={activeBook.deepLink}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.97 }}
            transition={SPRING}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold text-black"
            style={{ backgroundColor: activeBook.color }}
          >
            Bet on {activeBook.label} <ExternalLink className="w-3 h-3" />
          </motion.a>
        </div>
      </div>

      {/* Line movement ticker: x -50% to 0% */}
      <div className="bg-[#0f1117] rounded-xl border border-[#1e2028] px-4 py-1">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold tracking-widest text-gray-600 uppercase shrink-0 flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3" /> Lines
          </span>
          <div className="flex-1 overflow-hidden">
            <LineMovementTicker />
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="flex gap-3">
        <StatCard label="Active Games" value="14" sub="Across all sports" />
        <StatCard label="Best Line" value="-105" sub="DraftKings · NBA spread" accent="text-emerald-400" />
        <StatCard label="Line Moves" value="38" sub="Last 30 minutes" accent="text-amber-400" />
        <StatCard label="Sharp Action" value="76%" sub="Public on Chiefs -6.5" />
      </div>

      {/* Main: Left nav + Center + Right sidebar */}
      <div className="flex gap-4 flex-1 min-h-0">
        <LeftNav activeKey={activeNavKey} onSelect={setActiveNavKey} />
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeSportKey}-${activeBook.key}-${refreshKey}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {API_SPORTS.has(activeNavKey) ? (
                <GamesPanel
                  sportKey={activeSportKey}
                  bookKey={activeBook.key}
                  bookLabel={activeBook.label}
                  refreshKey={refreshKey}
                  addBetToSlip={addBetToSlip}
                />
              ) : (
                <div className="bg-[#0f1117] rounded-2xl border border-[#1e2028] flex flex-col items-center justify-center py-24">
                  <span className="text-5xl mb-4">{NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.key === activeNavKey)?.icon || '🏆'}</span>
                  <p className="text-gray-400 font-semibold">
                    {NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.key === activeNavKey)?.label} coming soon
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right sidebar: Sharp Money, Line Moves, Place Your Bet */}
        <div className="w-56 shrink-0 flex flex-col gap-3">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...SPRING, delay: 0.1 }}
            className="bg-[#0f1117] rounded-2xl border border-[#1e2028] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
          >
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.5} />
              <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase">Sharp Money</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {[
                { game: 'Chiefs -6.5', pct: 76 },
                { game: 'Celtics ML', pct: 68 },
                { game: 'Yankees -165', pct: 61 },
                { game: 'Oilers -145', pct: 58 },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...SPRING, delay: i * 0.05 }}
                  className="flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white font-medium">{item.game}</span>
                    <span className={`text-xs font-mono font-bold ${item.pct >= 65 ? 'text-emerald-400' : 'text-amber-400'}`}>{item.pct}%</span>
                  </div>
                  <div className="relative h-1 bg-white/[0.06] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${item.pct}%` }}
                      transition={{ ...SPRING, delay: 0.2 + i * 0.05 }}
                      className={`absolute top-0 left-0 h-full rounded-full ${item.pct >= 65 ? 'bg-emerald-400' : 'bg-amber-400'}`}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...SPRING, delay: 0.15 }}
            className="bg-[#0f1117] rounded-2xl border border-[#1e2028] p-4 flex-1 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
          >
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-3.5 h-3.5 text-blue-400" strokeWidth={1.5} />
              <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase">Line Moves</span>
            </div>
            <div className="flex flex-col gap-0.5">
              {MOCK_MOVES.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...SPRING, delay: i * 0.04 }}
                  whileHover={{ x: 2, backgroundColor: 'rgba(255,255,255,0.03)' }}
                  className="flex items-center justify-between px-2 py-1.5 rounded-lg cursor-default transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-gray-600 font-semibold w-7 shrink-0">{item.sport}</span>
                    <span className="text-xs text-white font-medium truncate">{item.team}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-mono text-gray-400">{item.line}</span>
                    <OddsMovement value={item.move} />
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...SPRING, delay: 0.2 }}
            className="bg-[#0f1117] rounded-2xl border border-[#1e2028] p-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
          >
            <div className="text-xs font-semibold tracking-widest text-gray-500 uppercase mb-3">Place Your Bet</div>
            <div className="flex flex-col gap-2">
              {BOOKS.map((book, i) => (
                <motion.a
                  key={book.key}
                  href={book.deepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...SPRING, delay: 0.3 + i * 0.05 }}
                  whileHover={{ x: 2, scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center justify-between px-3 py-2 rounded-xl border transition-all duration-200 group"
                  style={{ borderColor: `${book.color}30`, background: `${book.color}10` }}
                >
                  <span className="text-xs font-bold group-hover:opacity-100 opacity-80" style={{ color: book.color }}>
                    {book.label}
                  </span>
                  <ArrowUpRight className="w-3 h-3 opacity-40 group-hover:opacity-100" style={{ color: book.color }} />
                </motion.a>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <div className="text-xs text-gray-700 text-center">
        Sports betting involves risk. Must be 21+ and located in a state where sports betting is legal. Please gamble responsibly.
      </div>

      <PaperBettingSlip
        bets={bets}
        onRemove={handleSlipRemove}
        onStakeChange={handleSlipStakeChange}
        onClear={handleSlipClear}
      />
    </motion.div>
  );
}
