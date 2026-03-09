import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap, TrendingUp, ExternalLink, ChevronRight,
  Activity, BarChart3, Clock, RefreshCw, Star,
  ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react'

// ─── Spring presets ───────────────────────────────────────────
const springSnappy = { type: 'spring', stiffness: 400, damping: 30 }
const springSmooth = { type: 'spring', stiffness: 200, damping: 25 }

// ─── Sport config ─────────────────────────────────────────────
const SPORTS = [
  { key: 'americanfootball_nfl',     label: 'NFL',   emoji: '🏈' },
  { key: 'basketball_nba',           label: 'NBA',   emoji: '🏀' },
  { key: 'baseball_mlb',             label: 'MLB',   emoji: '⚾' },
  { key: 'icehockey_nhl',            label: 'NHL',   emoji: '🏒' },
  { key: 'americanfootball_ncaaf',   label: 'CFB',   emoji: '🎓' },
  { key: 'mma_mixed_martial_arts',   label: 'MMA',   emoji: '🥊' },
]

const BOOKS = [
  { key: 'draftkings', label: 'DraftKings', color: '#00d455', deepLink: 'https://www.draftkings.com/lobby#' },
  { key: 'fanduel',    label: 'FanDuel',    color: '#1493ff', deepLink: 'https://www.fanduel.com/sportsbook' },
  { key: 'betmgm',     label: 'BetMGM',     color: '#c9a84c', deepLink: 'https://sports.betmgm.com/' },
]

const ODDS_FORMATS = ['american', 'decimal', 'fractional']

// ─── Oddspedia widget loader ──────────────────────────────────
// The Odds API widget (iframe approach — works in any React app)
function OddsWidget({ sport, bookmaker, oddsFormat, widgetKey }) {
  const containerRef = useRef(null)

  // Build The Odds API widget iframe URL
  // Uses the free widget endpoint — swap accessKey for your key
  const iframeSrc = `https://widget.the-odds-api.com/v1/sports/${sport}/events/?accessKey=${widgetKey || 'demo'}&bookmakerKeys=${bookmaker}&oddsFormat=${oddsFormat}&markets=h2h,spreads,totals&marketNames=h2h:Moneyline,spreads:Spread,totals:Total`

  return (
    <motion.div
      key={`${sport}-${bookmaker}-${oddsFormat}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={springSmooth}
      className="relative w-full"
      style={{ minHeight: 520 }}
    >
      {/* Iframe glow border */}
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-emerald-500/20 via-transparent to-blue-500/10 pointer-events-none z-10" />

      {/* Dark overlay at top to hide iframe header branding */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-[#0a0a0f] z-20 rounded-t-2xl" />

      <iframe
        title="Live Sports Odds"
        src={iframeSrc}
        className="w-full rounded-2xl"
        style={{
          height: 560,
          border: 'none',
          background: 'transparent',
          colorScheme: 'dark',
        }}
        loading="lazy"
      />
    </motion.div>
  )
}

// ─── Live pulse dot ───────────────────────────────────────────
function LivePulse() {
  return (
    <span className="relative flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
      </span>
      <span className="text-xs font-semibold text-emerald-400 tracking-wider uppercase">Live</span>
    </span>
  )
}

// ─── Odds movement pill ───────────────────────────────────────
function OddsMovement({ value }) {
  if (value === 0) return <Minus className="w-3 h-3 text-gray-500" />
  return value > 0
    ? <span className="flex items-center gap-0.5 text-xs text-emerald-400 font-mono">
        <ArrowUpRight className="w-3 h-3" />{value}
      </span>
    : <span className="flex items-center gap-0.5 text-xs text-red-400 font-mono">
        <ArrowDownRight className="w-3 h-3" />{Math.abs(value)}
      </span>
}

// ─── Stat card ────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }) {
  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: '0 16px 48px rgba(0,0,0,0.6)' }}
      transition={springSnappy}
      className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl rounded-2xl border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.05)] p-4 flex-1 min-w-0"
    >
      <div className="text-xs font-semibold tracking-widest text-gray-500 uppercase mb-2">{label}</div>
      <div className={`text-2xl font-bold font-mono ${accent || 'text-white'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </motion.div>
  )
}

// ─── Book deep link card ──────────────────────────────────────
function BookCard({ book, isActive, onClick }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.97 }}
      transition={springSnappy}
      className={`relative flex items-center gap-2.5 px-4 py-2.5 rounded-xl border transition-all duration-200 ${
        isActive
          ? 'bg-gradient-to-br from-white/[0.08] to-white/[0.02] border-white/[0.15] shadow-[0_4px_16px_rgba(0,0,0,0.4)]'
          : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04] hover:border-white/[0.08]'
      }`}
    >
      {/* Active indicator dot */}
      {isActive && (
        <motion.div
          layoutId="book-indicator"
          className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
          style={{ backgroundColor: book.color }}
          transition={springSnappy}
        />
      )}
      <span
        className="text-xs font-bold"
        style={{ color: isActive ? book.color : '#6b7280' }}
      >
        {book.label}
      </span>
    </motion.button>
  )
}

// ─── Line movement ticker ─────────────────────────────────────
const MOCK_MOVEMENTS = [
  { team: 'Chiefs', line: '-6.5', move: -0.5, sport: 'NFL' },
  { team: 'Lakers', line: '+110', move: 15, sport: 'NBA' },
  { team: 'Yankees', line: '-165', move: -10, sport: 'MLB' },
  { team: 'Celtics', line: '-8', move: 1, sport: 'NBA' },
  { team: 'Cowboys', line: '+3.5', move: 0.5, sport: 'NFL' },
  { team: 'Oilers', line: '-145', move: -20, sport: 'NHL' },
  { team: 'Padres', line: '+130', move: 5, sport: 'MLB' },
  { team: 'Panthers', line: '+4', move: -1, sport: 'NFL' },
]

function LineMovementTicker() {
  const doubled = [...MOCK_MOVEMENTS, ...MOCK_MOVEMENTS]
  return (
    <div className="relative overflow-hidden h-8 flex items-center">
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#0a0a0f] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#0a0a0f] to-transparent z-10 pointer-events-none" />

      <motion.div
        className="flex gap-6 items-center"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 28, ease: 'linear', repeat: Infinity }}
      >
        {doubled.map((item, i) => (
          <span key={i} className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-xs text-gray-500 font-semibold">{item.sport}</span>
            <span className="text-xs text-white font-mono font-medium">{item.team}</span>
            <span className={`text-xs font-mono font-bold ${item.move > 0 ? 'text-emerald-400' : item.move < 0 ? 'text-red-400' : 'text-gray-400'}`}>
              {item.line}
            </span>
            <OddsMovement value={item.move} />
            <span className="text-white/10 ml-1">·</span>
          </span>
        ))}
      </motion.div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────
export default function SportsOddsPage() {
  const [activeSport, setActiveSport] = useState(SPORTS[0])
  const [activeBook, setActiveBook] = useState(BOOKS[0])
  const [oddsFormat, setOddsFormat] = useState('american')
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [hoveredSport, setHoveredSport] = useState(null)

  // Replace with your The Odds API key from the-odds-api.com (free signup)
  const WIDGET_API_KEY = import.meta.env.VITE_ODDS_API_KEY || ''

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => {
      setLastUpdated(new Date())
      setIsRefreshing(false)
    }, 900)
  }

  const formatTime = (date) => date.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="min-h-screen bg-[#0a0a0f] text-white px-6 py-6 flex flex-col gap-5"
    >

      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="relative">
              <Zap className="w-5 h-5 text-emerald-400" strokeWidth={1.5} />
              <div className="absolute inset-0 blur-md bg-emerald-400/40 rounded-full" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Sports Lines</h1>
            <LivePulse />
          </div>
          <p className="text-xs text-gray-500">
            Real-time odds from DraftKings, FanDuel & more · Line movements update live
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Last updated */}
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <Clock className="w-3 h-3" />
            <span className="font-mono">{formatTime(lastUpdated)}</span>
          </div>

          {/* Refresh */}
          <motion.button
            onClick={handleRefresh}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={springSnappy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs text-gray-400 hover:text-white hover:border-white/[0.1] transition-colors"
          >
            <motion.div
              animate={isRefreshing ? { rotate: 360 } : { rotate: 0 }}
              transition={{ duration: 0.7, ease: 'easeInOut' }}
            >
              <RefreshCw className="w-3 h-3" />
            </motion.div>
            Refresh
          </motion.button>

          {/* Deep link CTA */}
          <motion.a
            href={activeBook.deepLink}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.97 }}
            transition={springSnappy}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold text-black transition-all"
            style={{ backgroundColor: activeBook.color }}
          >
            Bet on {activeBook.label}
            <ExternalLink className="w-3 h-3" />
          </motion.a>
        </div>
      </div>

      {/* ── Line movement ticker ───────────────────────────── */}
      <div className="bg-gradient-to-br from-white/[0.02] to-transparent backdrop-blur-xl rounded-xl border border-white/[0.04] shadow-[0_4px_16px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.03)] px-4 py-1">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold tracking-widest text-gray-600 uppercase shrink-0 flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3" />
            Lines
          </span>
          <div className="flex-1 overflow-hidden">
            <LineMovementTicker />
          </div>
        </div>
      </div>

      {/* ── Stats row ─────────────────────────────────────── */}
      <div className="flex gap-3">
        <StatCard label="Active Games" value="14" sub="Across all sports" />
        <StatCard label="Best Line" value="-105" sub="DraftKings · NBA spread" accent="text-emerald-400" />
        <StatCard label="Line Moves" value="38" sub="In the last 30 minutes" accent="text-amber-400" />
        <StatCard label="Sharp Action" value="76%" sub="Public on Chiefs -6.5" />
      </div>

      {/* ── Sport tabs + Controls ──────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">

        {/* Sport selector */}
        <div className="flex items-center gap-1 bg-black/40 rounded-2xl p-1 border border-white/[0.04] shadow-[inset_4px_4px_8px_rgba(0,0,0,0.5),inset_-2px_-2px_6px_rgba(255,255,255,0.02)]">
          {SPORTS.map((sport) => (
            <motion.button
              key={sport.key}
              onClick={() => setActiveSport(sport)}
              onHoverStart={() => setHoveredSport(sport.key)}
              onHoverEnd={() => setHoveredSport(null)}
              whileTap={{ scale: 0.96 }}
              transition={springSnappy}
              className="relative px-3.5 py-1.5 rounded-xl text-sm font-semibold transition-colors duration-150"
              style={{
                color: activeSport.key === sport.key ? '#ffffff' : '#6b7280'
              }}
            >
              {activeSport.key === sport.key && (
                <motion.div
                  layoutId="sport-tab"
                  className="absolute inset-0 bg-gradient-to-br from-white/[0.1] to-white/[0.04] rounded-xl border border-white/[0.1] shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
                  transition={springSnappy}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <span>{sport.emoji}</span>
                <span>{sport.label}</span>
              </span>
            </motion.button>
          ))}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3">

          {/* Book selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-600 font-semibold uppercase tracking-wider mr-1">Book</span>
            {BOOKS.map((book) => (
              <BookCard
                key={book.key}
                book={book}
                isActive={activeBook.key === book.key}
                onClick={() => setActiveBook(book)}
              />
            ))}
          </div>

          {/* Odds format */}
          <div className="flex items-center gap-0.5 bg-black/40 rounded-xl p-0.5 border border-white/[0.04]">
            {ODDS_FORMATS.map((fmt) => (
              <motion.button
                key={fmt}
                onClick={() => setOddsFormat(fmt)}
                whileTap={{ scale: 0.96 }}
                transition={springSnappy}
                className={`relative px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-colors ${
                  oddsFormat === fmt ? 'text-white' : 'text-gray-500 hover:text-gray-400'
                }`}
              >
                {oddsFormat === fmt && (
                  <motion.div
                    layoutId="odds-format"
                    className="absolute inset-0 bg-white/[0.08] rounded-lg border border-white/[0.08]"
                    transition={springSnappy}
                  />
                )}
                <span className="relative z-10">{fmt.slice(0, 3)}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main odds panel ────────────────────────────────── */}
      <div className="flex gap-4 flex-1">

        {/* Widget container */}
        <div className="flex-1 min-w-0">
          <div className="relative bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-xl rounded-2xl border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.05)] overflow-hidden">

            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.05]">
              <div className="flex items-center gap-2.5">
                <BarChart3 className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
                <span className="text-sm font-semibold">
                  {activeSport.label} · {activeBook.label} Odds
                </span>
                <LivePulse />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 font-mono">
                  Moneyline · Spread · Total
                </span>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={springSnappy}
                  className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
                >
                  <Star className="w-3 h-3" strokeWidth={1.5} />
                  Watchlist
                </motion.button>
              </div>
            </div>

            {/* Widget iframe */}
            <div className="p-4">
              <AnimatePresence mode="wait">
                <OddsWidget
                  key={`${activeSport.key}-${activeBook.key}-${oddsFormat}`}
                  sport={activeSport.key}
                  bookmaker={activeBook.key}
                  oddsFormat={oddsFormat}
                  widgetKey={WIDGET_API_KEY}
                />
              </AnimatePresence>
            </div>

            {/* Bottom watermark */}
            <div className="px-5 py-2.5 border-t border-white/[0.04] flex items-center justify-between">
              <span className="text-xs text-gray-700">
                Data via The Odds API · Powered by Stratify
              </span>
              <motion.a
                href={activeBook.deepLink}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ x: 2 }}
                transition={springSnappy}
                className="flex items-center gap-1 text-xs transition-colors"
                style={{ color: activeBook.color }}
              >
                Open {activeBook.label}
                <ChevronRight className="w-3 h-3" />
              </motion.a>
            </div>
          </div>
        </div>

        {/* Right sidebar — Line movement + quick info */}
        <div className="w-64 shrink-0 flex flex-col gap-3">

          {/* Sharp money panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...springSmooth, delay: 0.1 }}
            className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl rounded-2xl border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)] p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-3.5 h-3.5 text-amber-400" strokeWidth={1.5} />
              <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase">Sharp Money</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {[
                { game: 'Chiefs -6.5', pct: 76, direction: 'over', sport: 'NFL' },
                { game: 'Celtics ML', pct: 68, direction: 'over', sport: 'NBA' },
                { game: 'Yankees -165', pct: 61, direction: 'under', sport: 'MLB' },
                { game: 'Oilers -145', pct: 58, direction: 'over', sport: 'NHL' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...springSnappy, delay: i * 0.05 }}
                  className="flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white font-medium">{item.game}</span>
                    <span className={`text-xs font-mono font-bold ${item.pct >= 65 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {item.pct}%
                    </span>
                  </div>
                  <div className="relative h-1 bg-white/[0.06] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${item.pct}%` }}
                      transition={{ ...springSmooth, delay: 0.2 + i * 0.05 }}
                      className={`absolute top-0 left-0 h-full rounded-full ${item.pct >= 65 ? 'bg-emerald-400' : 'bg-amber-400'}`}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Recent line moves */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...springSmooth, delay: 0.15 }}
            className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl rounded-2xl border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)] p-4 flex-1"
          >
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-3.5 h-3.5 text-blue-400" strokeWidth={1.5} />
              <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase">Line Moves</span>
            </div>
            <div className="flex flex-col gap-0.5">
              {MOCK_MOVEMENTS.map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...springSnappy, delay: i * 0.04 }}
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

          {/* Book deep links */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...springSmooth, delay: 0.2 }}
            className="bg-gradient-to-br from-white/[0.04] to-white/[0.01] backdrop-blur-xl rounded-2xl border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)] p-4"
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
                  transition={{ ...springSnappy, delay: 0.3 + i * 0.05 }}
                  whileHover={{ x: 2, scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center justify-between px-3 py-2 rounded-xl border transition-all duration-200 group"
                  style={{
                    borderColor: `${book.color}20`,
                    background: `${book.color}08`,
                  }}
                >
                  <span
                    className="text-xs font-bold group-hover:opacity-100 opacity-80 transition-opacity"
                    style={{ color: book.color }}
                  >
                    {book.label}
                  </span>
                  <ArrowUpRight
                    className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity"
                    style={{ color: book.color }}
                  />
                </motion.a>
              ))}
            </div>
          </motion.div>

        </div>
      </div>

      {/* ── Footer disclaimer ──────────────────────────────── */}
      <div className="text-xs text-gray-700 text-center">
        Sports betting involves risk. Must be 21+ and located in a state where sports betting is legal. Please gamble responsibly.
      </div>

    </motion.div>
  )
}
