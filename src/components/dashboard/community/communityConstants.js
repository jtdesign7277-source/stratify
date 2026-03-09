import {
  MessageCircle, TrendingUp, ArrowLeftRight, Bell, BarChart3, Globe,
  Clock3, Newspaper, Hash,
} from 'lucide-react';
import SophiaMark from '../SophiaMark';

// ─── Theme ────────────────────────────────────────────────
export const T = {
  bg: '#0d1117',
  card: '#151b23',
  hover: '#1c2333',
  border: 'rgba(255,255,255,0.06)',
  text: '#e6edf3',
  muted: '#7d8590',
  green: '#3fb950',
  red: '#f85149',
  blue: '#58a6ff',
};

// Hover scale + lift (every card, tab, panel on Community)
export const HOVER_LIFT = {
  whileHover: { scale: 1.03, y: -2 },
  transition: { type: 'spring', stiffness: 400, damping: 30 },
};

// ─── Market Symbols ───────────────────────────────────────
export const MARKET_MOVER_SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'META', 'AMZN', 'AMD', 'GOOGL'];
export const DEFAULT_TICKERS = [...MARKET_MOVER_SYMBOLS, 'BTC/USD', 'ETH/USD', 'SPY', 'QQQ'];

// ─── AI Search Cache ──────────────────────────────────────
export const AI_SEARCH_CLIENT_CACHE_TTL = 15 * 60 * 1000;
export const AI_SEARCH_CLIENT_CACHE = new Map();
export const AI_SEARCH_INFLIGHT = new Map();

// ─── Mood System ──────────────────────────────────────────
export const MOOD_LS_KEY = 'stratify_user_mood';
export const MOOD_CONFIG = {
  confident:  { emoji: '😎', label: 'Confident',  bg: 'bg-blue-500/20',   ring: 'ring-blue-500',   border: 'border border-blue-500/20',   cardBg: 'bg-blue-500/10'   },
  winning:    { emoji: '🤑', label: 'Winning',    bg: 'bg-green-500/20',  ring: 'ring-green-500',  border: 'border border-green-500/20',  cardBg: 'bg-green-500/10'  },
  happy:      { emoji: '😊', label: 'Happy',      bg: 'bg-yellow-500/20', ring: 'ring-yellow-500', border: 'border border-yellow-500/20', cardBg: 'bg-yellow-500/10' },
  neutral:    { emoji: '😐', label: 'Neutral',    bg: 'bg-gray-500/20',   ring: 'ring-gray-500',   border: 'border border-gray-500/20',   cardBg: 'bg-gray-500/10'   },
  frustrated: { emoji: '😤', label: 'Frustrated', bg: 'bg-orange-500/20', ring: 'ring-orange-500', border: 'border border-orange-500/20', cardBg: 'bg-orange-500/10' },
  rage:       { emoji: '🤬', label: 'Rage',       bg: 'bg-red-500/20',    ring: 'ring-red-500',    border: 'border border-red-500/20',    cardBg: 'bg-red-500/10'    },
};
export const DEFAULT_MOOD = 'confident';

// ─── Avatar Config ────────────────────────────────────────
export const PROFILE_AVATAR_STYLES = ['bottts', 'avataaars', 'pixel-art', 'fun-emoji'];
export const PROFILE_AVATAR_SEEDS_PER_STYLE = 24;
export const PROFILE_AVATAR_BACKGROUND_COLORS = 'b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf';
export const PROFILE_AVATAR_FALLBACK_COLOR = '#58a6ff';

const buildProfileAvatarUrl = (style, seed) => (
  `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}&size=128&radius=50&backgroundType=gradientLinear&backgroundColor=${PROFILE_AVATAR_BACKGROUND_COLORS}`
);

export const PROFILE_PICKER_AVATAR_OPTIONS = PROFILE_AVATAR_STYLES.flatMap((style) => (
  Array.from(
    { length: PROFILE_AVATAR_SEEDS_PER_STYLE },
    (_, i) => buildProfileAvatarUrl(style, `stratify-${style}-${i + 1}`),
  )
));

export const MOCK_AUTHORS = [
  { name: 'AlphaTrader', color: '#58a6ff', handle: '@alphatrader' },
  { name: 'MomentumMike', color: '#3fb950', handle: '@momentummike' },
  { name: 'TechAnalyst', color: '#c297ff', handle: '@techanalyst' },
  { name: 'MarketWatcher', color: '#f0883e', handle: '@marketwatcher' },
  { name: 'DegenTrader', color: '#f85149', handle: '@degentrader' },
  { name: 'QuietBull', color: '#3fb950', handle: '@quietbull' },
  { name: 'OptionFlow', color: '#58a6ff', handle: '@optionflow' },
  { name: 'MacroViews', color: '#d29922', handle: '@macroviews' },
];

// ─── Storage Keys ─────────────────────────────────────────
export const QUICK_POST_HASHTAGS = ['#earnings', '#momentum', '#macro', '#options', '#sentiment'];

// Search query fired when each hashtag pill is clicked
export const HASHTAG_SEARCH_QUERIES = {
  '#earnings':  'earnings report',
  '#momentum':  'momentum stocks',
  '#macro':     'macro economics market',
  '#options':   'options trading flow',
  '#sentiment': 'market sentiment analysis',
};
export const USER_AVATAR_SEED_STORAGE_KEY = 'stratify_user_avatar_seed';
export const USER_AVATAR_URL_STORAGE_KEY = 'stratify_user_avatar_url';
export const DISPLAY_NAME_STORAGE_KEY = 'stratify_display_name';
export const HASHTAG_WEB_CACHE_STORAGE_KEY = 'stratify_hashtag_cache';
export const HASHTAG_WEB_CACHE_TTL_MS = 2 * 60 * 60 * 1000;
export const PRICE_ALERTS_STORAGE_KEY = 'stratify_price_alerts';
export const FEED_HASHTAGS_ENABLED_STORAGE_KEY = 'stratify_feed_hashtags_enabled';
export const COMMUNITY_TWEETS_STORAGE_KEY = 'stratify_community_tweets';

// ─── Post Type Config ─────────────────────────────────────
export const POST_TYPE_CONFIG = {
  general: {
    label: 'General',
    icon: MessageCircle,
    placeholder: 'Quick post... use $ for ticker suggestions',
    badge: null,
  },
  pnl: {
    label: 'P&L',
    icon: TrendingUp,
    placeholder: 'Share your gains or losses...',
    badge: {
      backgroundColor: 'rgba(63,185,80,0.14)',
      borderColor: 'rgba(63,185,80,0.38)',
      color: '#3fb950',
    },
  },
  strategy: {
    label: 'Strategy',
    icon: SophiaMark,
    placeholder: 'Drop a strategy or setup...',
    badge: {
      backgroundColor: 'rgba(163,113,247,0.16)',
      borderColor: 'rgba(163,113,247,0.38)',
      color: '#c297ff',
    },
  },
  trade: {
    label: 'Trade',
    icon: ArrowLeftRight,
    placeholder: 'Log a trade entry or exit...',
    badge: {
      backgroundColor: 'rgba(88,166,255,0.14)',
      borderColor: 'rgba(88,166,255,0.38)',
      color: '#58a6ff',
    },
  },
  alert: {
    label: 'Alert',
    icon: Bell,
    placeholder: 'Share a price alert or signal...',
    badge: {
      backgroundColor: 'rgba(240,136,62,0.16)',
      borderColor: 'rgba(240,136,62,0.4)',
      color: '#f0883e',
    },
  },
  earnings: {
    label: 'Earnings',
    icon: BarChart3,
    placeholder: 'Earnings play or reaction...',
    badge: {
      backgroundColor: 'rgba(210,153,34,0.16)',
      borderColor: 'rgba(210,153,34,0.42)',
      color: '#d29922',
    },
  },
  macro: {
    label: 'Macro',
    icon: Globe,
    placeholder: 'Macro take or market outlook...',
    badge: {
      backgroundColor: 'rgba(88,166,255,0.16)',
      borderColor: 'rgba(88,166,255,0.4)',
      color: '#58a6ff',
    },
  },
};

export const POST_TYPE_ORDER = ['general', 'pnl', 'strategy', 'trade', 'alert', 'earnings', 'macro'];
export const LEGACY_POST_TYPE_MAP = {
  post: 'general',
  pnl_share: 'pnl',
  strategy_share: 'strategy',
  trade_share: 'trade',
  alert_share: 'alert',
};

// ─── Stream Status ────────────────────────────────────────
export const BASE_STREAM_STATUS = {
  connected: false,
  connecting: false,
  error: null,
  retryCount: 0,
};

// ─── Feed Hashtags ────────────────────────────────────────
export const FEED_HASHTAGS = ['#Earnings', '#Momentum', '#Macro', '#Options', '#Sentiment'];

export const ALL_FEED_HASHTAGS = [
  { id: 'earnings', label: 'Earnings' },
  { id: 'momentum', label: 'Momentum' },
  { id: 'trending', label: 'Trending' },
  { id: 'options', label: 'Options' },
  { id: 'premarket', label: 'PreMarket' },
  { id: 'memestocks', label: 'MemeStocks' },
  { id: 'ipos', label: 'IPOs' },
  { id: 'dividends', label: 'Dividends' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'forex', label: 'Forex' },
  { id: 'commodities', label: 'Commodities' },
  { id: 'bonds', label: 'Bonds' },
  { id: 'macro', label: 'Macro' },
  { id: 'sentiment', label: 'Sentiment' },
  { id: 'technicals', label: 'Technicals' },
  { id: 'fundamentals', label: 'Fundamentals' },
  { id: 'darkpool', label: 'Dark Pool' },
  { id: 'shortinterest', label: 'Short Interest' },
  { id: 'insiders', label: 'Insider Trades' },
  { id: 'etfs', label: 'ETFs' },
  { id: 'smallcaps', label: 'Small Caps' },
  { id: 'largecaps', label: 'Large Caps' },
  { id: 'biotech', label: 'Biotech' },
  { id: 'energy', label: 'Energy' },
  { id: 'ai', label: 'AI & Tech' },
  { id: 'realestate', label: 'Real Estate' },
  { id: 'spacs', label: 'SPACs' },
  { id: 'afterhours', label: 'After Hours' },
  { id: 'upgrades', label: 'Upgrades' },
  { id: 'downgrades', label: 'Downgrades' },
];

export const MAX_VISIBLE_FEED_HASHTAGS = 5;
export const HASHTAG_WEB_MIN_VISIBLE_POSTS = 3;
export const HASHTAG_WEB_MAX_RESULTS = 5;

// ─── Bot Hashtag Context ──────────────────────────────────
export const BOT_HASHTAG_CONTEXT_BY_TAG = {
  earnings: [
    (symbol) => `$${symbol} earnings setup looks active with traders focused on EPS beats versus guidance quality.`,
    (symbol) => `Watching the earnings call for $${symbol}; one soft margin comment can erase a headline beat fast.`,
    (symbol) => `Quarterly results on $${symbol} are lining up for a volatility move right after management Q&A.`,
    (symbol) => `Positioning into $${symbol} with implied move in mind because earnings revisions keep shifting.`,
  ],
  momentum: [
    (symbol) => `$${symbol} is trying to hold trend above key moving averages with momentum flow still firm.`,
    (symbol) => `Breakout watch on $${symbol} if buyers keep pressing highs with steady relative strength.`,
    (symbol) => `Momentum scanner flagged $${symbol} again as volume expands into a higher-high structure.`,
    (symbol) => `Trend followers are leaning long $${symbol} while pullbacks stay shallow above support.`,
  ],
  macro: [
    () => 'Fed path remains the main driver as treasury yields grind higher into the next inflation print.',
    () => 'Macro tape is rate-sensitive right now with bond volatility spilling into broad equities.',
    () => 'CPI and payroll expectations are moving cross-asset positioning faster than single-name headlines.',
    () => 'Dollar strength and front-end yields are steering risk appetite across growth and cyclicals.',
  ],
  options: [
    (symbol) => `Options flow in $${symbol} is tilted toward calls while IV stays elevated ahead of catalysts.`,
    (symbol) => `Risk-defined spreads on $${symbol} look cleaner than stock here with skew still bid.`,
    (symbol) => `Gamma positioning on $${symbol} could accelerate any break if market makers start chasing deltas.`,
    (symbol) => `IV crush risk remains real on $${symbol} so premium buyers need the move quickly.`,
  ],
  sentiment: [
    (symbol) => `Sentiment around $${symbol} is shifting as social buzz picks up with contrarian desks getting interested.`,
    (symbol) => `Fear/greed tone is still cautious, which can fuel squeezes when sentiment flips too bearish.`,
    (symbol) => `Crowd positioning on $${symbol} looks one-sided; contrarian setups improve when everyone agrees.`,
    (symbol) => `Retail chatter is heating up again and sentiment momentum is turning before price confirms.`,
  ],
};

// ─── Explore Tabs ─────────────────────────────────────────
export const EXPLORE_TABS = [
  { id: 'history', label: 'History', icon: Clock3 },
  { id: 'discover', label: 'Discover', icon: Newspaper },
  { id: 'spaces', label: 'Spaces', icon: Hash },
  { id: 'finance', label: 'Finance', icon: TrendingUp },
];

// ─── Mock Data ────────────────────────────────────────────
export const CREATIVE_MOCK_AUTHOR_NAMES = [
  'FiboFalcon', 'DayTradeKing', 'MacroMaven', 'VWAPViking',
  'VolatilityVera', 'PremarketPulse', 'EarningsEdge', 'SectorSurfer',
  'MomentumMara', 'OptionsSage', 'DeltaDuke', 'CatalystCobra',
];

export const HUMAN_MOCK_AUTHOR_NAMES = [
  'Amy_4322', 'Richard_55', 'SammySosa88', 'Lamar14', 'Jeff_51',
  'Sarah.trades', 'Mike_NYC', 'ChrisB_2024', 'DanielleK', 'Marcus.J',
  'TraderTom99', 'NikkiWolf',
];

export const MOCK_BASE_SETUPS = [
  { symbol: 'NVDA', post_type: 'trade', note: 'Took the opening range reclaim and scaled into strength above prior day high.' },
  { symbol: 'AAPL', post_type: 'strategy', note: 'Running a simple pullback play: first touch of VWAP after extension.' },
  { symbol: 'TSLA', post_type: 'alert', note: 'Put alert at 5-minute trendline break. Watching for failed bounce into resistance.' },
  { symbol: 'MSFT', post_type: 'general', note: 'Institutional bid looked sticky all session. Not forcing entries into chop.' },
  { symbol: 'AMD', post_type: 'trade', note: 'Broke premarket high with volume expansion. Tight stop under trigger candle.' },
  { symbol: 'SPY', post_type: 'macro', note: 'Breadth divergence while index prints highs. Staying selective on longs.' },
  { symbol: 'QQQ', post_type: 'strategy', note: 'Opening drive setup only if first pullback holds above opening print.' },
  { symbol: 'META', post_type: 'alert', note: 'Potential squeeze setup if call flow keeps hitting offer near highs.' },
  { symbol: 'AMZN', post_type: 'trade', note: 'Executed a continuation entry on one-minute consolidation breakout.' },
  { symbol: 'PLTR', post_type: 'general', note: 'Name is noisy but trend intact on higher timeframe. Waiting for cleaner R/R.' },
  { symbol: 'SMCI', post_type: 'alert', note: 'Halting risk elevated. Size down and respect volatility expansion.' },
  { symbol: 'GOOGL', post_type: 'strategy', note: 'Multi-day flag break candidate with clear invalidation below yesterday low.' },
  { symbol: 'NFLX', post_type: 'trade', note: 'Fade attempt failed. Reversed long once sellers could not push lower.' },
  { symbol: 'COIN', post_type: 'macro', note: 'Crypto beta still leading growth. Correlation with BTC remains tight.' },
  { symbol: 'AVGO', post_type: 'trade', note: 'Impulse up leg followed by orderly base. Entered on expansion candle close.' },
  { symbol: 'INTC', post_type: 'strategy', note: 'Mean-reversion only if weak open flushes into major daily support.' },
  { symbol: 'SNOW', post_type: 'earnings', note: 'Watching for relative strength flip against software basket.' },
  { symbol: 'CRM', post_type: 'earnings', note: 'Slow grind trend day. Let winners work and avoid over-trading midday.' },
];

export const MOCK_REACTION_POOL = ['🔥', '🚀', '💯', '📈', '💰', '👀', '🐂', '🐻', '✅', '⚡'];

// ─── Animation Variants ───────────────────────────────────
export const FEED_VARIANTS = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

export const CARD_VARIANTS = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] } },
};

export const MODAL_BACKDROP_TRANSITION = {
  duration: 0.2,
  ease: 'easeOut',
};

export const MODAL_PANEL_ENTER_TRANSITION = {
  type: 'spring',
  stiffness: 300,
  damping: 25,
  delay: 0.05,
};

export const MODAL_PANEL_EXIT_TRANSITION = {
  duration: 0.15,
  ease: 'easeInOut',
};

export const OVERLAY_PANEL_TRANSITION = {
  type: 'spring',
  stiffness: 320,
  damping: 26,
  mass: 0.75,
};

export const modalSectionMotion = (index = 0) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: {
    delay: 0.1 + (index * 0.03),
    duration: 0.2,
    ease: 'easeOut',
  },
});

export const AI_REWRITE_ACTION_ROW_VARIANTS = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.03 },
  },
};

export const AI_REWRITE_ACTION_ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 3 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.18, ease: 'easeOut' },
  },
};

// ─── AI Rewrite Options ───────────────────────────────────
export const AI_REWRITE_STYLE_OPTIONS = [
  { id: 'sharpen', label: 'Sharpen', prompt: 'tighten and make concise' },
  { id: 'professional', label: 'Professional', prompt: 'formal, institutional tone' },
  { id: 'casual', label: 'Casual', prompt: 'relaxed trader slang' },
  { id: 'add-context', label: 'Add Context', prompt: 'Claude adds relevant market data' },
];

export const AI_REWRITE_PERSONALITY_OPTIONS = [
  { id: 'confident', label: 'Confident', prompt: 'bold, high conviction, alpha energy' },
  { id: 'big-brain', label: 'Big Brain', prompt: 'analytical, high IQ, data-driven' },
  { id: 'hyped', label: 'Hyped', prompt: 'excited, bullish energy, exclamation points' },
  { id: 'angry', label: 'Angry', prompt: 'frustrated, pissed off, blunt and aggressive' },
  { id: 'chill', label: 'Chill', prompt: 'laid back, zen, unbothered' },
  { id: 'sarcastic', label: 'Sarcastic', prompt: 'witty, dry humor, sharp' },
  { id: 'motivational', label: 'Motivational', prompt: 'inspiring, rally the troops energy' },
  { id: 'degen', label: 'Degen', prompt: 'full WSB degen mode, YOLO energy' },
];

// ─── Slip Emoji Presets ───────────────────────────────────
export const SLIP_EMOJI_PRESETS = ['🚀', '💰', '🔥', '📈', '💯', '✅', '⚡', '🧠'];

// ─── Page Styles ──────────────────────────────────────────
export const COMMUNITY_PAGE_STYLES = `
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }

  @keyframes shimmerGradient {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  @keyframes premiumShimmer {
    0% { background-position: 0% 50%; }
    25% { background-position: 50% 100%; }
    50% { background-position: 100% 50%; }
    75% { background-position: 50% 0%; }
    100% { background-position: 0% 50%; }
  }

  @keyframes communityPulse {
    0%, 100% { opacity: 0.18; transform: scale(1); }
    50% { opacity: 0.34; transform: scale(1.08); }
  }

  @keyframes pulseGlow {
    0%, 100% { filter: drop-shadow(0 0 2px rgba(88,166,255,0.3)); }
    50% { filter: drop-shadow(0 0 8px rgba(88,166,255,0.6)); }
  }

  @keyframes alertBellRing {
    0% { transform: rotate(0deg); }
    20% { transform: rotate(16deg); }
    40% { transform: rotate(-12deg); }
    60% { transform: rotate(8deg); }
    80% { transform: rotate(-4deg); }
    100% { transform: rotate(0deg); }
  }

  .community-pulse {
    animation: communityPulse 3.6s ease-in-out infinite;
  }

  .alert-toast-bell {
    transform-origin: top center;
    animation: alertBellRing 0.8s ease-in-out 1;
  }

  #dashboard-topbar-ticker-tape-widget {
    min-height: 36px !important;
    padding-bottom: 0 !important;
    overflow: visible !important;
  }

  .community-minimal-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: rgba(255,255,255,0.1) transparent;
  }

  .community-minimal-scrollbar::-webkit-scrollbar {
    width: 4px;
    height: 4px;
  }

  .community-minimal-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.1);
    border-radius: 999px;
  }

  .community-minimal-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
`;

export const RAIL_TRENDS_PLACEHOLDER = [
  '#Earnings', '#Momentum', '#NVDA', '#SPY', '#Crypto',
  '#Macro', '#Options', '#Technicals', '#Degen', '#Premarket',
];
