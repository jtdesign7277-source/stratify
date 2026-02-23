const buildAvatarUrl = (initials, background) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${background}&color=ffffff&bold=true&rounded=true&size=256&format=png`;

export const BOT_PROFILES = [
  { id: 'bullrunner', name: 'BullRunner', avatar_url: buildAvatarUrl('BR', 'ff6b35') },
  { id: 'optionssage', name: 'OptionsSage', avatar_url: buildAvatarUrl('OS', '06b6d4') },
  { id: 'daytradeking', name: 'DayTradeKing', avatar_url: buildAvatarUrl('DK', '3b82f6') },
  { id: 'gammascout', name: 'GammaScout', avatar_url: buildAvatarUrl('GS', 'f59e0b') },
  { id: 'tapereader', name: 'TapeReader', avatar_url: buildAvatarUrl('TR', '10b981') },
  { id: 'riskrebalancer', name: 'RiskRebalancer', avatar_url: buildAvatarUrl('RR', 'ef4444') },
  { id: 'premarketpulse', name: 'PremarketPulse', avatar_url: buildAvatarUrl('PP', '8b5cf6') },
  { id: 'swingsniper', name: 'SwingSniper', avatar_url: buildAvatarUrl('SS', '14b8a6') },
  { id: 'vwapviking', name: 'VWAPViking', avatar_url: buildAvatarUrl('VW', '22c55e') },
  { id: 'thetanomad', name: 'ThetaNomad', avatar_url: buildAvatarUrl('TN', 'f97316') },
  { id: 'macromaven', name: 'MacroMaven', avatar_url: buildAvatarUrl('MM', '0ea5e9') },
  { id: 'breakoutbella', name: 'BreakoutBella', avatar_url: buildAvatarUrl('BB', 'ec4899') },
  { id: 'fibofalcon', name: 'FiboFalcon', avatar_url: buildAvatarUrl('FF', '84cc16') },
  { id: 'sectorsurfer', name: 'SectorSurfer', avatar_url: buildAvatarUrl('SR', '6366f1') },
  { id: 'chartchaser', name: 'ChartChaser', avatar_url: buildAvatarUrl('CC', 'f43f5e') },
  { id: 'deltaduke', name: 'DeltaDuke', avatar_url: buildAvatarUrl('DD', '0284c7') },
  { id: 'liquiditylynx', name: 'LiquidityLynx', avatar_url: buildAvatarUrl('LL', '65a30d') },
  { id: 'earningsedge', name: 'EarningsEdge', avatar_url: buildAvatarUrl('EE', '7c3aed') },
  { id: 'momentummara', name: 'MomentumMara', avatar_url: buildAvatarUrl('MO', '0891b2') },
  { id: 'volatilityvera', name: 'VolatilityVera', avatar_url: buildAvatarUrl('VV', 'dc2626') },
];

const LIQUID_TICKERS = [
  'SPY',
  'QQQ',
  'IWM',
  'AAPL',
  'MSFT',
  'NVDA',
  'AMD',
  'META',
  'TSLA',
  'AMZN',
  'GOOGL',
  'NFLX',
  'JPM',
  'BAC',
  'XOM',
  'CVX',
  'SMH',
  'XLK',
  'XLF',
  'XLE',
  'XLV',
  'SOFI',
  'PLTR',
  'COIN',
];

const MACRO_TOPICS = [
  '10Y yields grinding higher',
  'dollar strength picking up',
  'Fed speakers sounding more cautious',
  'Treasury auction demand',
  'oil pushing above resistance',
  'credit spreads widening a touch',
];

const SECTOR_ROTATION = [
  ['tech', 'energy'],
  ['semis', 'healthcare'],
  ['financials', 'utilities'],
  ['consumer discretionary', 'staples'],
  ['growth', 'value'],
];

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max, decimals = 2) =>
  Number((Math.random() * (max - min) + min).toFixed(decimals));
const pickOne = (items) => items[randomInt(0, items.length - 1)];
const shuffle = (items) => {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};
const pickManyUnique = (items, count) => shuffle(items).slice(0, Math.max(0, Math.min(count, items.length)));

const formatSignedPct = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
const formatSignedDollar = (value) => `${value >= 0 ? '+' : '-'}$${Math.abs(value).toLocaleString()}`;

const extractTickerMentions = (text = '') => {
  const matches = text.match(/\$[A-Z]{1,6}/g) || [];
  return [...new Set(matches.map((item) => item.slice(1)))];
};

const buildEarningsPost = () => {
  const ticker = pickOne(LIQUID_TICKERS);
  const move = randomFloat(-4.2, 5.8);
  const bias = move >= 0 ? 'buyers' : 'sellers';

  const content = [
    `Eyes on $${ticker} earnings after the bell.`,
    `Implied move is around ${Math.abs(move).toFixed(1)}% and ${bias} usually show up in the last hour.`,
    'Anyone holding through print or staying flat?',
  ].join(' ');

  return {
    content,
    post_type: 'post',
    ticker_mentions: [ticker],
    metadata: { style: 'earnings' },
  };
};

const buildMarketMovePost = () => {
  const ticker = pickOne(LIQUID_TICKERS);
  const pct = randomFloat(-3.1, 3.8);
  const price = randomFloat(32, 610);

  const content =
    pct >= 0
      ? `$${ticker} squeezed into power hour and I sold a piece at ${formatSignedPct(pct)} around $${price}. Letting a small runner ride with a tight stop.`
      : `Got clipped on $${ticker} for ${formatSignedPct(pct)}. Tape felt heavy after lunch and I respected the stop this time.`;

  return {
    content,
    post_type: 'trade_share',
    ticker_mentions: [ticker],
    metadata: { style: 'market_move', percent: pct },
  };
};

const buildTechnicalPost = () => {
  const ticker = pickOne(LIQUID_TICKERS);
  const support = randomFloat(40, 420);
  const resistance = Number((support * (1 + randomFloat(0.02, 0.08, 3))).toFixed(2));

  const content = `$${ticker} is coiling between $${support} support and $${resistance} resistance. If we reclaim VWAP and close above that range high, I am taking the breakout.`;

  return {
    content,
    post_type: 'strategy_share',
    ticker_mentions: [ticker],
    metadata: { style: 'chart_setup', support, resistance },
  };
};

const buildPnlWinPost = () => {
  const ticker = pickOne(LIQUID_TICKERS);
  const pnl = Math.round(randomFloat(420, 4200, 0));
  const percent = randomFloat(1.2, 6.4);
  const holdMinutes = randomInt(18, 145);

  const content = `Good day. Booked ${formatSignedDollar(pnl)} on $${ticker} after a ${holdMinutes} min hold. Kept size sane and finally waited for confirmation before adding.`;

  return {
    content,
    post_type: 'pnl_share',
    ticker_mentions: [ticker],
    metadata: {
      pnl,
      percent,
      ticker,
      timeframe: `${holdMinutes}m hold`,
      style: 'win',
    },
  };
};

const buildPnlLossPost = () => {
  const ticker = pickOne(LIQUID_TICKERS);
  const pnl = -Math.round(randomFloat(180, 2100, 0));
  const percent = -randomFloat(0.8, 3.8);

  const content = `Took an L on $${ticker}: ${formatSignedDollar(pnl)}. Entered early, ignored my first warning candle, and paid for it. Resetting and keeping risk tighter next session.`;

  return {
    content,
    post_type: 'pnl_share',
    ticker_mentions: [ticker],
    metadata: {
      pnl,
      percent,
      ticker,
      timeframe: 'intraday',
      style: 'loss',
    },
  };
};

const buildMacroPost = () => {
  const ticker = pickOne(['SPY', 'QQQ', 'IWM', 'TLT', 'DXY']);
  const macro = pickOne(MACRO_TOPICS);

  const content = `${macro} is driving risk right now. Watching $${ticker} for confirmation before pressing anything big. Market feels tradable, but only with smaller size.`;

  return {
    content,
    post_type: 'alert_share',
    ticker_mentions: [ticker],
    metadata: { style: 'macro' },
  };
};

const buildSectorRotationPost = () => {
  const [fromSector, toSector] = pickOne(SECTOR_ROTATION);
  const leader = pickOne(['XLE', 'XLV', 'XLF', 'SMH', 'XLK', 'XLI']);
  const lagger = pickOne(['XLK', 'IWM', 'ARKK', 'XLY', 'SOXX']);

  const content = `Seeing money rotate out of ${fromSector} and into ${toSector} this afternoon. $${leader} relative strength looks better while $${lagger} keeps fading on pops.`;

  return {
    content,
    post_type: 'post',
    ticker_mentions: [leader, lagger],
    metadata: { style: 'sector_rotation' },
  };
};

const buildQuestionPost = () => {
  const ticker = pickOne(LIQUID_TICKERS);
  const secondTicker = pickOne(LIQUID_TICKERS.filter((symbol) => symbol !== ticker));

  const content = `Anyone else watching $${ticker} vs $${secondTicker} here? Feels like one breaks first and drags the whole tape. Curious what levels you are keying off tomorrow.`;

  return {
    content,
    post_type: 'post',
    ticker_mentions: [ticker, secondTicker],
    metadata: { style: 'question' },
  };
};

const POST_BUILDERS = [
  buildEarningsPost,
  buildMarketMovePost,
  buildTechnicalPost,
  buildPnlWinPost,
  buildPnlLossPost,
  buildMacroPost,
  buildSectorRotationPost,
  buildQuestionPost,
];

export function generatePost() {
  const builder = pickOne(POST_BUILDERS);
  const draft = builder();
  const tickerMentions =
    Array.isArray(draft.ticker_mentions) && draft.ticker_mentions.length > 0
      ? [...new Set(draft.ticker_mentions)]
      : extractTickerMentions(draft.content);

  return {
    content: draft.content,
    post_type: draft.post_type || 'post',
    ticker_mentions: tickerMentions,
    metadata: draft.metadata || {},
  };
}

export function postAsBots(options = {}) {
  const bots = Array.isArray(options.bots) && options.bots.length > 0 ? options.bots : BOT_PROFILES;
  const minBots = Number.isFinite(options.minBots) ? options.minBots : 1;
  const maxBots = Number.isFinite(options.maxBots) ? options.maxBots : 3;
  const selectionSize = randomInt(Math.max(1, minBots), Math.max(1, Math.min(maxBots, bots.length)));
  const selectedBots = pickManyUnique(bots, selectionSize);

  return selectedBots.map((bot) => ({
    bot,
    ...generatePost(),
  }));
}

export function likeRandomPosts(recentPosts = [], options = {}) {
  if (!Array.isArray(recentPosts) || recentPosts.length === 0) return [];

  const bots = Array.isArray(options.bots) && options.bots.length > 0 ? options.bots : BOT_PROFILES;
  const maxLikes = Math.max(1, Math.min(recentPosts.length * 2, options.maxLikes || 12));
  const lowerBound = Math.min(2, maxLikes);
  const upperBound = Math.max(lowerBound, maxLikes);
  const targetLikes = randomInt(lowerBound, upperBound);

  const actions = [];
  const dedupe = new Set();
  let attempts = 0;

  while (actions.length < targetLikes && attempts < targetLikes * 10) {
    attempts += 1;
    const bot = pickOne(bots);
    const post = pickOne(recentPosts);
    if (!bot || !post || !post.id) continue;
    if (post.user_id && post.user_id === bot.id) continue;

    const key = `${bot.id}:${post.id}`;
    if (dedupe.has(key)) continue;

    dedupe.add(key);
    actions.push({
      bot,
      post_id: post.id,
    });
  }

  return actions;
}

const buildReply = (parentPost = {}) => {
  const mentioned = Array.isArray(parentPost.ticker_mentions) && parentPost.ticker_mentions.length > 0
    ? parentPost.ticker_mentions
    : extractTickerMentions(parentPost.content || '');
  const ticker = mentioned[0] || pickOne(LIQUID_TICKERS);

  const templates = [
    `I like this take on $${ticker}. If buyers hold the first pullback, I might join it.`,
    `Respect for sharing this. I had almost the same setup on $${ticker} and trimmed too early.`,
    `Good point. I am watching $${ticker} around VWAP because that level has been make-or-break all week.`,
    `I took the opposite side earlier and got tagged out. Are you holding $${ticker} overnight or just day trading it?`,
    `Same read here, but I am keeping size half-normal until the macro tape settles down.`,
    `This is exactly why I keep a hard stop. $${ticker} can rip or fade fast depending on flow.`,
    `Rotation note makes sense. I am seeing stronger bids in defensives while momentum names chop.`,
  ];

  const content = pickOne(templates);
  return {
    content,
    ticker_mentions: extractTickerMentions(content),
  };
};

export function commentOnPosts(recentPosts = [], options = {}) {
  if (!Array.isArray(recentPosts) || recentPosts.length === 0) return [];

  const bots = Array.isArray(options.bots) && options.bots.length > 0 ? options.bots : BOT_PROFILES;
  const maxComments = Math.min(Math.max(1, recentPosts.length), options.maxComments || 4);
  const targetComments = randomInt(1, Math.max(1, maxComments));

  const actions = [];
  const dedupe = new Set();
  let attempts = 0;

  while (actions.length < targetComments && attempts < targetComments * 12) {
    attempts += 1;
    const bot = pickOne(bots);
    const post = pickOne(recentPosts);
    if (!bot || !post || !post.id) continue;
    if (post.user_id && post.user_id === bot.id) continue;

    const key = `${bot.id}:${post.id}`;
    if (dedupe.has(key)) continue;
    dedupe.add(key);

    const reply = buildReply(post);
    actions.push({
      bot,
      parent_post_id: post.id,
      ...reply,
    });
  }

  return actions;
}

export default {
  BOT_PROFILES,
  generatePost,
  postAsBots,
  likeRandomPosts,
  commentOnPosts,
};
