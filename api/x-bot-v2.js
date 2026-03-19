// X Bot v2 — Stratify (@stratify_hq)
// Data-first pipeline: Real APIs → Verify → AI Formats → Post
// AI NEVER generates facts. AI only formats verified data into tweets.

import crypto from 'crypto';
import { Redis } from '@upstash/redis';
import { postToDiscord } from './lib/discord.js';
import { fetchSnapshotsFromTwelveData, mapSnapshotsToBars } from './lib/stocks-cache.js';

// ============================================================
// APPROVED TICKERS — Bot ONLY posts about these. Period.
// ============================================================
const APPROVED_TICKERS = {
  mag7: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'],
  retail: ['HIMS', 'SOFI', 'FUBO', 'BMNR', 'IREN', 'PLTR', 'HOOD', 'MARA', 'RIVN', 'LCID', 'NIO',
           'COIN', 'LULU', 'NKE', 'CELH', 'ENPH', 'ADBE', 'DUOL', 'EL', 'RBLX', 'PYPL', 'AMD',
           'ELF', 'ORCL', 'MU', 'RKLB', 'RDFN', 'LMND', 'HNST', 'JPM', 'SCHW'],
  meme: ['GME', 'AMC'],
  indices: ['SPY', 'QQQ', 'DIA'],
  crypto: ['BTC/USD', 'ETH/USD', 'SOL/USD', 'XRP/USD', 'DOGE/USD'],
};

const ALL_STOCK_TICKERS = [
  ...APPROVED_TICKERS.mag7,
  ...APPROVED_TICKERS.retail,
  ...APPROVED_TICKERS.meme,
  ...APPROVED_TICKERS.indices,
];

const ALL_CRYPTO_TICKERS = APPROVED_TICKERS.crypto;
const ET_TIME_ZONE = 'America/New_York';
const X_API_BASE = 'https://api.x.com';
const WEBSITE_URL = 'stratifymarket.com';
const WEBSITE_POST_TYPES = new Set(['thought-leader', 'hot-take']);
const WEBSITE_POST_CADENCE = 4;
const WEBSITE_COUNTER_KEY = 'xbot:website:personality_counter';
const SINGLE_POST_PER_DAY_TYPES = new Set([
  'market-open',
  'premarket',
  'mag7',
  'top-movers',
  'market-close',
  'crypto',
  'thought-leader',
  'hot-take',
  'funny',
  'sentinel-pnl',
]);
const SESSION_RULES_BY_TYPE = {
  'market-open': ['regular'],
  premarket: ['premarket'],
  mag7: ['regular'],
  'top-movers': ['regular'],
  'market-close': ['afterhours'],
  'sentinel-pnl': ['afterhours', 'closed'],
};

// ============================================================
// VERIFIED NEWS SOURCES — Only trust these for breaking news
// ============================================================
const TRUSTED_SOURCES = [
  'reuters', 'associated press', 'bloomberg', 'cnbc', 'wall street journal',
  'wsj', 'financial times', 'barrons', 'marketwatch', 'ap news', 'afp',
  'the new york times', 'washington post', 'bbc', 'cnn business',
];

// ============================================================
// BREAKING NEWS — Dynamic hooks and flags (never same hook twice)
// ============================================================
const BREAKING_HOOKS = [
  '🚨 BREAKING:',
  '🚨 BREAKING NEWS:',
  '💥 JUST IN:',
  '⚠️ ALERT:',
  '🔴 DEVELOPING:',
  'BREAKING:',
  'JUST IN:',
];

const FLAG_KEYWORDS = [
  { flags: '🇮🇷', keywords: ['iran', 'tehran', 'persian'] },
  { flags: '🇷🇺', keywords: ['russia', 'moscow', 'putin', 'kremlin'] },
  { flags: '🇺🇦', keywords: ['ukraine', 'kyiv', 'zelensky'] },
  { flags: '🇨🇳', keywords: ['china', 'beijing', 'xi'] },
  { flags: '🇮🇱', keywords: ['israel', 'gaza', 'tel aviv', 'hamas'] },
  { flags: '🇹🇷', keywords: ['turkey', 'ankara', 'erdogan'] },
  { flags: '🇰🇵', keywords: ['north korea', 'kim'] },
  { flags: '🏦', keywords: ['fed', 'treasury', 'powell', 'rates', 'inflation'] },
  { flags: '🪙', keywords: ['crypto', 'bitcoin', 'btc', 'ethereum'] },
  { flags: '🛢️', keywords: ['oil', 'energy', 'opec'] },
  { flags: '🇺🇸', keywords: ['trump', 'white house', 'congress', 'senate'] },
  { flags: '📉', keywords: ['market', 'stocks', 'crash', 'halt', 'circuit'] },
  { flags: '🇺🇸', keywords: ['war', 'attack', 'missile', 'strike', 'troops'] },
];

const CASHTAG_BY_TOPIC = [
  { keywords: ['oil', 'energy', 'opec'], tags: ['$USO', '$XOM'] },
  { keywords: ['fed', 'treasury', 'powell', 'rates', 'inflation'], tags: ['$SPY', '$QQQ', '$TLT'] },
  { keywords: ['crypto', 'bitcoin', 'btc', 'ethereum'], tags: ['$BTC', '$ETH', '$COIN'] },
  { keywords: ['market', 'stocks', 'crash', 'halt', 'circuit'], tags: ['$SPY', '$QQQ'] },
  { keywords: ['trump', 'white house', 'congress', 'senate'], tags: ['$SPY'] },
];

const BREAKING_LAST_HOOK_KEY = 'breaking:last_hook';
const BREAKING_HOURLY_COUNT_KEY = 'breaking:hourly_count';
const BREAKING_SEEN_PREFIX = 'breaking:seen:';
const BREAKING_TTL_1H = 3600;
const BREAKING_SEEN_TTL = 86400; // 24h

// Scheduled post openers (no 🚨). Pick randomly; red/green add market-specific options.
const SCHEDULED_OPENERS_NEUTRAL = [
  'PRE-MARKET UPDATE:',
  '📊 Markets this morning:',
  '🌅 Before the bell:',
  '⚡ What\'s moving:',
  'Morning look at markets:',
];
const SCHEDULED_OPENER_RED = '📉 Tech under pressure:';
const SCHEDULED_OPENER_GREEN = '📈 Markets moving:';

function getTrimmedEnv(name) {
  return String(process.env[name] || '').trim();
}

function getXCredentials() {
  return {
    apiKey: getTrimmedEnv('X_API_KEY'),
    apiSecret: getTrimmedEnv('X_API_SECRET'),
    accessToken: getTrimmedEnv('X_ACCESS_TOKEN'),
    accessTokenSecret: getTrimmedEnv('X_ACCESS_TOKEN_SECRET'),
  };
}

function pickScheduledOpener(quotes = {}) {
  const spy = quotes?.SPY;
  const pct = spy && spy.percent_change != null ? parseFloat(spy.percent_change) : null;
  const pool = [...SCHEDULED_OPENERS_NEUTRAL];
  if (pct != null) {
    if (pct < -0.3) pool.push(SCHEDULED_OPENER_RED);
    else if (pct > 0.3) pool.push(SCHEDULED_OPENER_GREEN);
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

function getETDateKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: ET_TIME_ZONE });
}

function getRedis() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    return new Redis({ url, token });
  } catch {
    return null;
  }
}

async function acquireLock(redis, key, ttlSeconds) {
  if (!redis || !key || !ttlSeconds) return true;
  const result = await redis.set(key, '1', { nx: true, ex: ttlSeconds });
  return result === 'OK';
}

function getRunLockKey(type) {
  return `xbot:run:${type}:${getETDateKey()}`;
}

function getPostedKey(type) {
  return `xbot:posted:${type}:${getETDateKey()}`;
}

function getTypeSessionSkipReason(type, session) {
  const allowedSessions = SESSION_RULES_BY_TYPE[type];
  if (!allowedSessions || allowedSessions.includes(session)) return null;
  return `${type} posts only run during ${allowedSessions.join('/')} ET (current: ${session})`;
}

function formatSignedPercent(value) {
  const numeric = Number(value) || 0;
  return `${numeric >= 0 ? '+' : ''}${numeric.toFixed(2)}%`;
}

function formatPrice(value) {
  const numeric = Number(value) || 0;
  return numeric.toFixed(2);
}

function formatTickerForTweet(symbol) {
  return `$${String(symbol || '').replace('/USD', '').split('/')[0]}`;
}

function buildMarketLine(symbol, price, percentChange) {
  return `${formatTickerForTweet(symbol)} ${formatPrice(price)} (${formatSignedPercent(percentChange)})`;
}

function composeTweet(header, lines = [], footer = '') {
  return [header, ...lines, footer].filter(Boolean).join('\n').trim();
}

function buildStructuredTweet(header, lines = [], footer = '') {
  let activeLines = [...lines].filter(Boolean);
  let tweet = composeTweet(header, activeLines, footer);
  if (tweet.length <= 280) return tweet;

  if (footer) {
    tweet = composeTweet(header, activeLines, '');
    if (tweet.length <= 280) return tweet;
  }

  while (tweet.length > 280 && activeLines.length > 1) {
    activeLines = activeLines.slice(0, -1);
    tweet = composeTweet(header, activeLines, '');
  }

  return tweet.length <= 280 ? tweet : `${tweet.slice(0, 277)}…`;
}

function stripWebsiteMentions(text = '') {
  return String(text || '')
    .replace(/\s*(?:https?:\/\/)?(?:www\.)?stratifymarket\.com\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function appendWebsite(text = '') {
  const body = stripWebsiteMentions(text);
  const suffix = `\n\n${WEBSITE_URL}`;
  const maxBodyLength = 280 - suffix.length;
  if (body.length <= maxBodyLength) {
    return `${body}${suffix}`;
  }
  const trimmed = `${body.slice(0, Math.max(maxBodyLength - 1, 0)).trimEnd()}…`;
  return `${trimmed}${suffix}`;
}

async function shouldIncludeWebsite(type) {
  if (!WEBSITE_POST_TYPES.has(type)) return false;

  const redis = getRedis();
  if (!redis) return false;

  try {
    const count = await redis.incr(WEBSITE_COUNTER_KEY);
    return count % WEBSITE_POST_CADENCE === 0;
  } catch (error) {
    console.error('[xbot] Website cadence counter failed:', error?.message || error);
    return false;
  }
}

async function applyWebsitePlacement(type, tweet) {
  const cleaned = stripWebsiteMentions(tweet);
  if (await shouldIncludeWebsite(type)) {
    return appendWebsite(cleaned);
  }
  return cleaned;
}

async function fetchVerifiedStockQuotes(symbols, options = {}) {
  const useExtended = options.useExtended === true;
  const snapshots = await fetchSnapshotsFromTwelveData(symbols);
  const bars = mapSnapshotsToBars(snapshots, symbols);
  const quotes = {};

  for (const bar of bars) {
    const price = useExtended
      ? (bar.preMarketPrice ?? bar.extendedPrice ?? null)
      : bar.price;
    const percentChange = useExtended
      ? (bar.preMarketChangePercent ?? bar.extendedPercentChange ?? null)
      : bar.changePercent;
    const change = useExtended
      ? (bar.preMarketChange ?? bar.extendedChange ?? null)
      : bar.change;

    if (!Number.isFinite(price) || !Number.isFinite(percentChange)) continue;

    quotes[bar.symbol] = {
      price,
      close: price,
      change,
      percent_change: percentChange,
      market_session: bar.marketSession,
    };
  }

  return quotes;
}

function sortQuotesByAbsoluteMove(quotes, symbols) {
  return (symbols || Object.keys(quotes))
    .map((symbol) => [symbol, quotes[symbol]])
    .filter(([_, quote]) => quote && Number.isFinite(Number(quote.percent_change)))
    .sort((a, b) => Math.abs(Number(b[1].percent_change)) - Math.abs(Number(a[1].percent_change)));
}

function sortQuotesByDirectionalMove(quotes, symbols) {
  return (symbols || Object.keys(quotes))
    .map((symbol) => [symbol, quotes[symbol]])
    .filter(([_, quote]) => quote && Number.isFinite(Number(quote.percent_change)))
    .sort((a, b) => Number(b[1].percent_change) - Number(a[1].percent_change));
}

// ============================================================
// X API v2 — OAuth 1.0a signing
// ============================================================
function generateOAuthSignature(method, url, params, consumerSecret, tokenSecret) {
  const signatureBase = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(
    Object.keys(params).sort().map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join('&')
  )}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  return crypto.createHmac('sha1', signingKey).update(signatureBase).digest('base64');
}

async function postTweet(text) {
  return xApiPost(`${X_API_BASE}/2/tweets`, { text });
}

function getOAuthHeader(method, baseUrl, extraParams = {}) {
  const xCreds = getXCredentials();
  const oauthParams = {
    oauth_consumer_key: xCreds.apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: xCreds.accessToken,
    oauth_version: '1.0',
  };
  const allParams = { ...oauthParams, ...extraParams };
  const signature = generateOAuthSignature(
    method, baseUrl, allParams,
    xCreds.apiSecret,
    xCreds.accessTokenSecret
  );
  return 'OAuth ' + Object.entries({ ...oauthParams, oauth_signature: signature })
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
    .join(', ');
}

function formatXApiError(data, status) {
  const raw = JSON.stringify(data);
  if (status === 401) {
    return `X API 401 Unauthorized. The configured X credentials or app permissions were rejected. Check X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET, and regenerate access tokens after any app permission changes. Raw: ${raw}`;
  }
  if (status === 403) {
    return `X API 403 Forbidden. The app is authenticated but lacks permission for this action. Check X app read/write permissions. Raw: ${raw}`;
  }
  if (status === 429) {
    return `X API 429 Rate limit hit. Raw: ${raw}`;
  }
  return `X API error: ${raw}`;
}

async function xApiGet(baseUrl, queryParams = {}) {
  const qs = new URLSearchParams(queryParams).toString();
  const fullUrl = qs ? `${baseUrl}?${qs}` : baseUrl;
  const authHeader = getOAuthHeader('GET', baseUrl, queryParams);
  const response = await fetch(fullUrl, {
    method: 'GET',
    headers: { Authorization: authHeader },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(formatXApiError(data, response.status));
  return data;
}

async function xApiPost(url, body) {
  const authHeader = getOAuthHeader('POST', url, {});
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(formatXApiError(data, response.status));
  return data;
}

async function postReply(inReplyToTweetId, text) {
  return xApiPost(`${X_API_BASE}/2/tweets`, {
    text,
    reply: { in_reply_to_tweet_id: inReplyToTweetId },
  });
}

async function getMe() {
  const data = await xApiGet(`${X_API_BASE}/2/users/me`, { 'user.fields': 'id' });
  return data.data?.id || null;
}

async function searchTweets(query, maxResults = 5) {
  const data = await xApiGet(`${X_API_BASE}/2/tweets/search/recent`, {
    query,
    'tweet.fields': 'public_metrics,text',
    max_results: String(Math.min(maxResults, 10)),
  });
  return data.data || [];
}

async function likeTweet(userId, tweetId) {
  return xApiPost(`${X_API_BASE}/2/users/${userId}/liking`, { tweet_id: tweetId });
}

// ============================================================
// AUTO-ENGAGEMENT — Search, like, reply (30-min cron)
// ============================================================
const ENGAGEMENT_QUERY = 'algotrading OR "algo trading" OR "trading bot" OR "AI trading" OR "trading signals" OR "stock market" OR "options flow" OR "market open" OR "day trading" OR fintech OR "paper trading" OR "trading platform" OR "market data" OR SPY OR NVDA OR TSLA';
const ENGAGEMENT_MAX_PER_SCAN = 10;
const ENGAGEMENT_MIN_LIKES_FOR_REPLY = 20;
const ENGAGEMENT_MAX_REPLIES_PER_DAY = 20;
const ENGAGEMENT_MAX_LIKES_PER_DAY = 80;
const ENGAGED_TTL_DAYS = 7;

function getEngagementDateKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // YYYY-MM-DD
}

function getMidnightTTL() {
  const now = new Date();
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const tomorrow = new Date(et);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return Math.round((tomorrow - et) / 1000);
}

async function generateEngagementReply(tweetText) {
  const system = `You are replying from @stratify_hq. Sound like a professional market operator and builder: high-agency, precise, calm, and well-calibrated.

Your voice:
- Professional, sharp, and intelligent
- Dry wit is fine, but never corny, smug, or try-hard
- Short and punchy: 1-2 sentences max
- You can challenge lazy thinking, but critique ideas, not people
- Never sound like a guru, meme account, or know-it-all
- Never use hashtags
- Never say "as an AI" or anything robotic
- No fake bravado, no chest-thumping, no trader cosplay
- NEVER mention specific price levels or dollar amounts unless they were in the source tweet
- NEVER discuss NFL, MLB, or sports betting content
- If the tweet is about sports betting or off-season sports, return null

LINK STRATEGY:
- Do not include links, URLs, or product plugs in replies
- Do not mention stratifymarket.com in replies
- Keep the reply focused on the market point, process point, or argument at hand

Examples of acceptable replies:
"Reasonable view. The part people miss is how often good setups fail when participation is thin."
"That read is too confident for the information on the table."
"Strong point. The difference is whether the move is broad or just a single-name squeeze."
"We built tooling for exactly this workflow at stratifymarket.com, but the core issue is still process discipline."

Never invent facts. Never invent price levels. Never sound theatrical.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY_XPOST,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 150,
      system,
      messages: [{
        role: 'user',
        content: `Reply to this tweet in 1-2 sentences max: ${tweetText}`,
      }],
    }),
  });
  const data = await res.json();
  const text = data.content?.[0]?.text?.trim() || null;
  if (!text) return null;
  // Reject any reply that contains numeric dollar amounts (hallucinated price levels)
  const numericDollar = /\$\d[\d,]*(\.\d+)?/.test(text);
  if (numericDollar) {
    console.log('[engagement] Rejected reply with hallucinated price:', text);
    return null;
  }
  if (/stratifymarket\.com/i.test(text)) {
    console.log('[engagement] Rejected reply with website link:', text);
    return null;
  }
  const toneCheck = verifyTweet(text, { professionalTone: true });
  if (!toneCheck.approved) {
    console.log('[engagement] Rejected reply with unprofessional tone:', toneCheck.errors, text);
    return null;
  }
  return text.length <= 200 ? text : text.slice(0, 197) + '…';
}

async function runEngagement() {
  const redis = getRedis();
  if (!redis) return { status: 'skipped', reason: 'Redis not configured' };

  const dateKey = getEngagementDateKey();
  const replyCountKey = `engagement:reply_count:${dateKey}`;
  const likeCountKey = `engagement:like_count:${dateKey}`;
  const ttl = getMidnightTTL();

  let replyCount = parseInt(await redis.get(replyCountKey), 10) || 0;
  let likeCount = parseInt(await redis.get(likeCountKey), 10) || 0;

  if (replyCount >= ENGAGEMENT_MAX_REPLIES_PER_DAY && likeCount >= ENGAGEMENT_MAX_LIKES_PER_DAY) {
    return { status: 'skipped', reason: 'Daily engagement caps reached' };
  }

  let meId;
  try {
    meId = await getMe();
  } catch (e) {
    return { status: 'error', reason: e.message };
  }
  if (!meId) return { status: 'skipped', reason: 'Could not get X user id' };

  let tweets;
  try {
    tweets = await searchTweets(ENGAGEMENT_QUERY, ENGAGEMENT_MAX_PER_SCAN);
  } catch (e) {
    return { status: 'error', reason: e.message };
  }

  const results = { liked: 0, replied: 0, errors: [] };

  // Sports that are currently IN SEASON — update each season
  const ACTIVE_SPORTS = ['NBA', 'NHL', 'March Madness', 'college basketball'];
  const OFF_SEASON_SPORTS = ['NFL', 'football', 'Super Bowl', 'touchdown', 'quarterback', 'MLB', 'baseball', 'World Series'];

  for (const tweet of tweets) {
    const id = tweet.id;
    const text = (tweet.text || '').trim();
    const textLower = text.toLowerCase();
    const likeCountTweet = tweet.public_metrics?.like_count ?? 0;

    // Skip tweets about off-season sports — never engage with NFL/MLB content in March
    const isOffSeasonSport = OFF_SEASON_SPORTS.some(s => textLower.includes(s.toLowerCase()));
    if (isOffSeasonSport) continue;

    // Skip pure sports betting content — Stratify is a trading platform
    const isSportsBetting = ['line movement', 'point spread', 'moneyline', 'over/under', 'sportsbook', 'parlay', 'prop bet', 'sharp money', 'public money', 'ats', 'cover the spread'].some(s => textLower.includes(s));
    if (isSportsBetting) continue;

    if (likeCount < ENGAGEMENT_MAX_LIKES_PER_DAY) {
      try {
        await likeTweet(meId, id);
        likeCount++;
        await redis.set(likeCountKey, String(likeCount), { ex: ttl });
        results.liked++;
      } catch (e) {
        results.errors.push(`like ${id}: ${e.message}`);
      }
    }

    if (likeCountTweet > ENGAGEMENT_MIN_LIKES_FOR_REPLY && replyCount < ENGAGEMENT_MAX_REPLIES_PER_DAY) {
      const engagedKey = `engaged:${id}`;
      try {
        const already = await redis.get(engagedKey);
        if (already) continue;
      } catch {
        continue;
      }

      const replyText = await generateEngagementReply(text);
      if (!replyText) continue;

      try {
        await postReply(id, replyText);
        await redis.set(engagedKey, '1', { ex: ENGAGED_TTL_DAYS * 86400 });
        replyCount++;
        await redis.set(replyCountKey, String(replyCount), { ex: ttl });
        results.replied++;
      } catch (e) {
        results.errors.push(`reply ${id}: ${e.message}`);
      }
    }
  }

  return { status: 'ok', ...results };
}

// ============================================================
// DATA FETCHERS — Real data only, no AI involved
// ============================================================
async function fetchTwelveDataQuotes(symbols, options = {}) {
  const symbolStr = symbols.join(',');
  const params = new URLSearchParams({
    symbol: symbolStr,
    apikey: process.env.TWELVE_DATA_API_KEY || '',
  });
  if (options.prepost === true) params.set('prepost', 'true');
  const res = await fetch(
    `https://api.twelvedata.com/quote?${params.toString()}`
  );
  const data = await res.json();

  // Handle single vs multiple symbols
  if (symbols.length === 1) {
    if (data.code && data.code !== 200) return {};
    return { [symbols[0]]: data };
  }

  // Filter out errors
  const clean = {};
  for (const [sym, quote] of Object.entries(data)) {
    if (quote && !quote.code && quote.close) {
      clean[sym] = quote;
    }
  }
  return clean;
}

async function fetchMarketauxNews() {
  const tickers = APPROVED_TICKERS.mag7.join(',');
  const res = await fetch(
    `https://api.marketaux.com/v1/news/all?symbols=${tickers}&filter_entities=true&language=en&api_token=${process.env.MARKETAUX_API_KEY}&limit=5`
  );
  const data = await res.json();
  return data.data || [];
}

// ============================================================
// AI FORMATTER — Claude formats data into tweets, nothing more
// ============================================================
const SYSTEM_PROMPT = `You are the social media writer for @stratify_hq, an AI-powered trading platform.

ABSOLUTE RULES:
1. ONLY use numbers, prices, percentages, and facts from the REAL DATA section provided
2. NEVER generate, estimate, or guess any stock price, percentage, or statistic
3. NEVER claim something happened unless it's explicitly in the provided data
4. NEVER speculate about future price movement (no "could", "might", "expect")
5. NEVER use phrases like "to the moon", "guaranteed", "easy money"
6. If data seems incomplete, write a SHORTER tweet — never fill gaps with guesses
7. Always use $ prefix before ticker symbols ($AAPL not AAPL)
8. Keep it under 280 characters
9. Be punchy, direct, confident — not hype-y or clickbait-y
10. No hashtags. They look desperate.
11. Start with the exact opener provided in the user message (do not add 🚨 unless the opener contains it).
12. NEVER write about NFL, football, Super Bowl, or any sport that is currently out of season (it is March 2026 — NFL season ended in February).
13. NEVER write about sports betting, line movement, point spreads, sharp money, moneylines, parlays, or sportsbook content. Stratify is a trading platform, not a sportsbook.
14. If you find yourself writing anything sports-related, stop and return an empty response instead.

TONE: Think Bloomberg terminal meets fintwit. Smart, fast, credible.
You are a data reporter, not a hype man.

LINK RULE: About 1 in 4 posts, end with "via @stratify_hq" or add "stratifymarket.com" at the very end. ONLY when the tweet is strong enough to stand alone. Never start with the link. Never make the link the focus.`;

async function formatWithClaude(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY_XPOST,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || null;
}

// ============================================================
// VERIFICATION LAYER — Every tweet must pass before posting
// ============================================================
function verifyTweet(tweet, rawData) {
  const errors = [];
  const tweetLower = tweet.toLowerCase();

  // Check length
  if (tweet.length > 280) {
    errors.push(`Too long: ${tweet.length} chars`);
  }

  // Check for unapproved tickers
  const tickerRegex = /\$([A-Z]{1,5})/g;
  const mentioned = [...tweet.matchAll(tickerRegex)].map(m => m[1]);
  const allApproved = [...ALL_STOCK_TICKERS, ...ALL_CRYPTO_TICKERS.map(t => t.split('/')[0])];
  const unapproved = mentioned.filter(t => !allApproved.includes(t));
  if (unapproved.length > 0) {
    errors.push(`Unapproved tickers: ${unapproved.join(', ')}`);
  }

  // Check for prediction language
  const banned = [
    'will surge', 'going to moon', 'about to explode', 'guaranteed',
    'easy money', 'can\'t lose', 'moon', 'rocket', 'lambo',
    'to the moon', 'buy now', 'sell everything', 'crash incoming',
  ];
  for (const phrase of banned) {
    if (tweetLower.includes(phrase)) {
      errors.push(`Banned phrase: "${phrase}"`);
    }
  }

  // Hard block: NFL/sports betting content — Stratify is a trading platform
  const sportsBanned = [
    'nfl game', 'nfl season', 'nfl week', 'tonight\'s nfl', 'tonight\'s game',
    'football game', 'super bowl', 'touchdown', 'quarterback',
    'line movement', 'point spread', 'sharp money', 'public money',
    'moneyline', 'parlay', 'prop bet', 'over/under', 'sportsbook',
    'cover the spread', 'ats', 'opening line', 'closing line',
    'mlb game', 'baseball game',
    'vegas', 'odds shifted', 'live odds', 'injury report',
    'lakers', 'celtics', 'warriors', 'knicks', 'nets',
    'fade the public', 'sports betting', 'betting market',
    'point spreads', 'spread movement', 'handicap',
  ];
  for (const phrase of sportsBanned) {
    if (tweetLower.includes(phrase)) {
      errors.push(`Sports/betting content not allowed: "${phrase}"`);
    }
  }

  // Hard block: Options trading content — Stratify does NOT offer options
  const optionsBanned = ['calls', 'puts', 'options', 'strike', 'expiry', 'contracts', 'premium', 'iron condor', 'straddle', 'strangle', 'covered call', 'naked put'];
  for (const phrase of optionsBanned) {
    if (tweetLower.includes(phrase)) {
      errors.push(`Options content not allowed (Stratify doesn't offer options): "${phrase}"`);
    }
  }

  // Hard block: Fabricated trade stats — if tweet claims specific win rates or P&L without real data
  const fabricatedPatterns = [
    /\d+%\s*win\s*rate/i,
    /win\s*rate[:\s]*\d+/i,
    /\d+\s*trades?[:\s]*\d+\s*wins?/i,
    /\bclosed\s+\d+\/\d+\s+trades?\b/i,
    /\b\d+\/\d+\s+trades?\s+green\b/i,
    /\blost\s+\$[\d,]+(?:\.\d+)?\b/i,
    /\bmade\s+\$[\d,]+(?:\.\d+)?\b/i,
    /\bbooked\s+[+\-]?\$[\d,]+(?:\.\d+)?\b/i,
    /\btook\s+[+\-]?\$[\d,]+(?:\.\d+)?\b/i,
    /paper\s*trading\s*stats/i,
    /today'?s?\s*paper\s*trading/i,
    /total\s*p&?l[:\s]*[+\-]?\$[\d,]+/i,
  ];
  // Only allow these patterns if rawData explicitly contains trade stats
  if (!rawData?.sentinelStats) {
    for (const pattern of fabricatedPatterns) {
      if (pattern.test(tweet)) {
        errors.push(`Possible fabricated trade stats (no real data provided): ${pattern}`);
      }
    }
  }

  // Verify numbers match raw data (spot check prices)
  if (rawData?.quotes) {
    // Basic check: ensure we have data for mentioned tickers
    for (const ticker of mentioned) {
      if (rawData.quotes[ticker] === undefined &&
          !['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'SPY', 'QQQ', 'DIA'].includes(ticker)) {
        // Ticker mentioned but no data — could be hallucinated
        errors.push(`No data for mentioned ticker: $${ticker}`);
      }
    }
  }

  if (rawData?.professionalTone) {
    const toneBanned = [
      'smart money',
      'the crowd',
      'everyone\'s screaming',
      'here\'s what they\'re missing',
      'what they\'re missing',
      'panic-sold',
      'quietly ripped',
      'weak hands',
      'dumb money',
      'morons',
      'idiots',
      'clowns',
      'ape in',
    ];
    for (const phrase of toneBanned) {
      if (tweetLower.includes(phrase)) {
        errors.push(`Unprofessional tone phrase: "${phrase}"`);
      }
    }
  }

  return {
    approved: errors.length === 0,
    errors,
  };
}

// ============================================================
// TWEET GENERATORS — Each type has its own data→format pipeline
// ============================================================

async function generateMarketOpen(options = {}) {
  const isPremarket = options.prepost === true;
  const watchlist = [...APPROVED_TICKERS.mag7, ...APPROVED_TICKERS.indices];
  const quotes = await fetchVerifiedStockQuotes(watchlist, { useExtended: isPremarket });

  if (Object.keys(quotes).length === 0) {
    console.log('No quote data available, skipping');
    return null;
  }

  const sorted = sortQuotesByAbsoluteMove(quotes, watchlist).slice(0, isPremarket ? 5 : 5);
  if (sorted.length < 3) return null;

  const header = isPremarket ? 'Pre-market check:' : 'Opening watch:';
  const lines = sorted.map(([symbol, quote]) => buildMarketLine(symbol, quote.price, quote.percent_change));
  const tweet = buildStructuredTweet(header, lines);

  const verification = verifyTweet(tweet, { quotes });
  if (!verification.approved) {
    console.log('Tweet failed verification:', verification.errors);
    return null;
  }

  return tweet;
}

async function generateTopMovers() {
  const watchlist = [...APPROVED_TICKERS.retail, ...APPROVED_TICKERS.meme];
  const quotes = await fetchVerifiedStockQuotes(watchlist);

  if (Object.keys(quotes).length === 0) return null;

  const topMovers = sortQuotesByAbsoluteMove(quotes, watchlist).slice(0, 5);
  if (topMovers.length === 0) return null;

  const lines = topMovers.map(([symbol, quote]) => buildMarketLine(symbol, quote.price, quote.percent_change));
  const tweet = buildStructuredTweet('Retail movers:', lines);

  const verification = verifyTweet(tweet, { quotes });
  if (!verification.approved) {
    console.log('Tweet failed verification:', verification.errors);
    return null;
  }

  return tweet;
}

async function generateMag7Update() {
  const quotes = await fetchVerifiedStockQuotes(APPROVED_TICKERS.mag7);

  if (Object.keys(quotes).length === 0) return null;

  const sorted = sortQuotesByDirectionalMove(quotes, APPROVED_TICKERS.mag7);
  const lines = sorted.map(([symbol, quote]) => buildMarketLine(symbol, quote.price, quote.percent_change));
  const tweet = buildStructuredTweet('Mag 7 check:', lines);

  const verification = verifyTweet(tweet, { quotes });
  if (!verification.approved) {
    console.log('Tweet failed verification:', verification.errors);
    return null;
  }

  return tweet;
}

async function pickBreakingHook(redis) {
  let lastHook = null;
  if (redis) {
    try {
      lastHook = await redis.get(BREAKING_LAST_HOOK_KEY);
    } catch {
      lastHook = null;
    }
  }
  const others = lastHook ? BREAKING_HOOKS.filter(h => h !== lastHook) : BREAKING_HOOKS;
  const hook = others[Math.floor(Math.random() * others.length)] || BREAKING_HOOKS[0];
  if (redis && hook) {
    try {
      await redis.set(BREAKING_LAST_HOOK_KEY, hook, { ex: BREAKING_TTL_1H });
    } catch {
      // ignore
    }
  }
  return hook;
}

function getFlagsForHeadline(headline) {
  const lower = (headline || '').toLowerCase();
  const flags = new Set();
  for (const { flags: f, keywords } of FLAG_KEYWORDS) {
    if (keywords.some(kw => lower.includes(kw))) flags.add(f);
  }
  return [...flags].join('');
}

function getCashtagsForHeadline(headline, entityTickers) {
  const lower = (headline || '').toLowerCase();
  const tags = new Set();
  for (const { keywords, tags: t } of CASHTAG_BY_TOPIC) {
    if (keywords.some(kw => lower.includes(kw))) t.forEach(tag => tags.add(tag));
  }
  (entityTickers || []).filter(t => ALL_STOCK_TICKERS.includes(t)).forEach(t => tags.add('$' + t));
  return [...tags].slice(0, 5).join(' ');
}

async function generateBreakingNews() {
  const redis = getRedis();

  if (redis) {
    try {
      const count = parseInt(await redis.get(BREAKING_HOURLY_COUNT_KEY), 10) || 0;
      if (count >= 2) {
        console.log('Max 2 breaking posts per hour, skipping');
        return { skipReason: 'Hourly breaking limit reached' };
      }
    } catch {
      // continue
    }
  }

  const articles = await fetchMarketauxNews();
  if (!articles || articles.length === 0) {
    return { skipReason: 'No MarketAux articles available' };
  }

  const trusted = articles.filter(a => {
    const source = (a.source || '').toLowerCase();
    return TRUSTED_SOURCES.some(ts => source.includes(ts));
  });

  const article = trusted[0] || null;
  if (!article) {
    console.log('No trusted source articles found, skipping breaking news');
    return { skipReason: 'No trusted source articles found' };
  }

  const headline = (article.title || '').trim();
  if (!headline) {
    return { skipReason: 'Trusted article missing headline' };
  }

  const headlineHash = crypto.createHash('sha256').update(headline.toLowerCase()).digest('hex').slice(0, 16);
  if (redis) {
    try {
      const seen = await redis.get(BREAKING_SEEN_PREFIX + headlineHash);
      if (seen) {
        console.log('Breaking headline already posted (dedupe), skipping');
        return { skipReason: 'Breaking headline already posted recently' };
      }
      await redis.set(BREAKING_SEEN_PREFIX + headlineHash, '1', { ex: BREAKING_SEEN_TTL });
    } catch {
      // continue
    }
  }

  const hook = await pickBreakingHook(redis);
  const flags = getFlagsForHeadline(headline);
  let body = headline.length <= 100 ? headline.toUpperCase() : headline.slice(0, 200).trim();
  if (headline.length > 100 && body.length < headline.length) body = body + '…';

  const entityTickers = (article.entities || [])
    .filter(e => e.type === 'equity' && ALL_STOCK_TICKERS.includes(e.symbol))
    .map(e => e.symbol);
  const cashtags = getCashtagsForHeadline(headline, entityTickers);
  const tweet = [hook, flags, body, cashtags ? '\n' + cashtags : '']
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (tweet.length > 280) {
    const truncated = tweet.slice(0, 277) + '…';
    const verification = verifyTweet(truncated, {});
    if (!verification.approved) {
      return { skipReason: `Breaking tweet failed verification: ${verification.errors.join(', ')}` };
    }
    if (redis) {
      try {
        const key = BREAKING_HOURLY_COUNT_KEY;
        const n = parseInt(await redis.get(key), 10) || 0;
        await redis.set(key, String(n + 1), { ex: BREAKING_TTL_1H });
      } catch {
        // ignore
      }
    }
    return { tweet: truncated };
  }

  const verification = verifyTweet(tweet, {});
  if (!verification.approved) {
    console.log('Tweet failed verification:', verification.errors);
    return { skipReason: `Breaking tweet failed verification: ${verification.errors.join(', ')}` };
  }

  if (redis) {
    try {
      const key = BREAKING_HOURLY_COUNT_KEY;
      const n = parseInt(await redis.get(key), 10) || 0;
      await redis.set(key, String(n + 1), { ex: BREAKING_TTL_1H });
    } catch {
      // ignore
    }
  }

  return { tweet };
}

async function generateCryptoUpdate() {
  const quotes = await fetchTwelveDataQuotes(ALL_CRYPTO_TICKERS);

  if (Object.keys(quotes).length === 0) return null;

  const sorted = sortQuotesByAbsoluteMove(quotes, ALL_CRYPTO_TICKERS).slice(0, 5);
  const lines = sorted.map(([symbol, quote]) => buildMarketLine(symbol, quote.close, quote.percent_change));
  const tweet = buildStructuredTweet('Crypto check:', lines);

  const verification = verifyTweet(tweet, { quotes });
  if (!verification.approved) {
    console.log('Tweet failed verification:', verification.errors);
    return null;
  }

  return tweet;
}


async function generateTrumpWatch() {
  const redis = getRedis();

  const etDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const countKey = `trump_watch:count:${etDate}`;
  const seenKey = `trump_watch:seen_ids:${etDate}`;

  if (redis) {
    try {
      const count = parseInt(await redis.get(countKey), 10) || 0;
      if (count >= 2) {
        console.log('Trump watch: daily limit of 2 reached');
        return null;
      }
    } catch {}
  }

  let tweets = [];
  try {
    const data = await xApiGet(`${X_API_BASE}/2/users/25073877/tweets`, {
      max_results: '10',
      'tweet.fields': 'created_at,text,id',
      exclude: 'retweets,replies',
    });
    tweets = data.data || [];
  } catch (e) {
    console.error('Trump fetch error:', e.message);
    return null;
  }

  if (tweets.length === 0) return null;

  let seenIds = [];
  if (redis) {
    try {
      const raw = await redis.get(seenKey);
      seenIds = raw ? JSON.parse(raw) : [];
    } catch {}
  }
  const unseen = tweets.filter(t => !seenIds.includes(t.id));
  if (unseen.length === 0) {
    console.log('Trump watch: no new tweets');
    return null;
  }

  const tweetList = unseen.map((t, i) => `${i + 1}. [ID: ${t.id}] ${t.text}`).join('\n');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY_XPOST,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `You monitor Trump tweets for Stratify, a trading platform. Pick the single most market-relevant tweet. Score 1-10. If score < 7, return null.\n\nTweets:\n${tweetList}\n\nReturn ONLY valid JSON, no markdown:\n{"tweetId": "...", "score": 8, "hook": "JUST IN: 8-10 word teaser", "body": "Full post under 280 chars. Start with his exact quote in quotes, then 1 line on market angle — NO PRICES, NO PRICE LEVELS, NO NUMBERS. Only mention direction and ticker. End with $SPY or relevant ticker.", "tickers": ["SPY"]}\n\nCRITICAL: Do NOT include any stock prices, price levels, or numeric targets in body. Never write things like 'TSLA at $220' or 'rejected $400'. Price data is forbidden — direction only.\n\nIf no tweet scores 7+, return: {"tweetId": null, "score": 0}`,
      }],
    }),
  });

  const aiData = await res.json();
  let parsed;
  try {
    const text = aiData.content?.[0]?.text?.trim() || '{}';
    parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    return null;
  }

  if (!parsed.tweetId || parsed.score < 7) {
    console.log('Trump watch: score too low:', parsed.score);
    return null;
  }

  const tweet = parsed.body?.trim();
  if (!tweet || tweet.length > 280) return null;

  // Hard block: if tweet contains a dollar amount that looks like a price (e.g. $220, $1,234)
  // these are hallucinated prices — reject the tweet entirely
  const hallucPriceRegex = /\$\d[\d,]*(\.\d+)?(?!\s*(?:B|M|T|billion|million|trillion))/g;
  const priceMatches = tweet.match(hallucPriceRegex) || [];
  // Allow ticker cashtags like $SPY, $TSLA — reject numeric dollar amounts
  const numericPrices = priceMatches.filter(m => /\$\d/.test(m));
  if (numericPrices.length > 0) {
    console.log('Trump watch: rejected tweet with hallucinated prices:', numericPrices, tweet);
    return null;
  }

  const verification = verifyTweet(tweet, {});
  if (!verification.approved) {
    console.log('Trump watch: tweet failed verification:', verification.errors);
    return null;
  }

  if (redis) {
    try {
      const ttl = getMidnightTTL();
      seenIds.push(parsed.tweetId);
      await redis.set(seenKey, JSON.stringify(seenIds), { ex: ttl });
      const count = parseInt(await redis.get(countKey), 10) || 0;
      await redis.set(countKey, String(count + 1), { ex: ttl });
    } catch {}
  }

  return { tweet, hook: parsed.hook, score: parsed.score };
}

async function generateMarketClose() {
  const watchlist = [...APPROVED_TICKERS.mag7, ...APPROVED_TICKERS.indices];
  const quotes = await fetchVerifiedStockQuotes(watchlist);

  if (Object.keys(quotes).length === 0) return null;

  const mag7Sorted = sortQuotesByDirectionalMove(quotes, APPROVED_TICKERS.mag7);
  const winner = mag7Sorted[0];
  const loser = mag7Sorted[mag7Sorted.length - 1];
  const lines = [
    ...APPROVED_TICKERS.indices
      .filter((symbol) => quotes[symbol])
      .slice(0, 3)
      .map((symbol) => buildMarketLine(symbol, quotes[symbol].price, quotes[symbol].percent_change)),
    winner ? `Leader ${buildMarketLine(winner[0], winner[1].price, winner[1].percent_change)}` : null,
    loser ? `Lag ${buildMarketLine(loser[0], loser[1].price, loser[1].percent_change)}` : null,
  ].filter(Boolean);
  const tweet = buildStructuredTweet('Closing tape:', lines);

  const verification = verifyTweet(tweet, { quotes });
  if (!verification.approved) {
    console.log('Tweet failed verification:', verification.errors);
    return null;
  }

  return tweet;
}

// ============================================================
// PERSONALITY POSTS — Thought leadership, hot takes, humor
// These don't need market data. Pure voice.
// ============================================================

const PERSONALITY_SYSTEM = `You are @stratify_hq on Twitter/X. Write like a serious market operator and builder with real judgment.

Your personality:
- Professional, high-IQ, precise, calm under pressure
- Direct and candid, but never theatrical
- Dry humor is allowed; meme-account energy is not
- You can challenge lazy thinking, but do not sound smug, adolescent, or performatively alpha
- Critique ideas, narratives, and process failures; do not posture or insult for sport
- You think in systems, incentives, probabilities, and market structure
- You sound like someone who has actually built infrastructure and traded through uncertainty
- NEVER use hashtags
- NEVER sound like LinkedIn sludge, guru bait, or motivational wallpaper
- Keep it under 280 characters
- Avoid filler. Every sentence should earn its place
- Avoid chest-thumping phrases like "smart money", "the crowd", "everyone's screaming", "what they're missing", or other retail-theater language
- Do not include links or URLs in the draft. Website placement is handled separately by the publisher
- ABSOLUTELY NEVER write about sports betting, point spreads, parlays, Vegas odds, NFL, MLB, or gambling culture
- NEVER compare trading to sports betting
- NEVER FABRICATE TRADE DATA. Do not invent P&L, win rates, trade counts, or personal trade stories
- NEVER mention options trading. Stratify does not offer options
- NEVER post fake screenshots, fake fills, fake wins, or fake losses
- If the data is not real, do not write it

Reference tone:
- disciplined PM note
- sharp operator memo
- understated desk humor

What good looks like:
- clear observation
- grounded implication
- no bravado
- no cosplay`;

async function generateThoughtLeader() {
  const topics = [
    'building trading systems', 'why most traders lose', 'the difference between edge and luck',
    'what retail traders get wrong', 'algo trading vs manual trading', 'risk management',
    'why backtesting lies to you', 'position sizing', 'the psychology of drawdowns',
    'building in public as a fintech', 'why speed matters in markets', 'data vs intuition in trading',
    'the myth of passive income from trading', 'how institutions actually trade',
    'why most trading bots fail', 'the real cost of slippage', 'market structure',
    'why volatility is opportunity', 'compounding small edges', 'the sleep-deprived coder problem',
    'technical debt in trading systems', 'why your stop loss placement sucks',
    'the difference between a strategy and a system', 'survivorship bias in trading results',
    'why paper trading matters more than people think', 'building resilient infrastructure',
  ];
  const topic = topics[Math.floor(Math.random() * topics.length)];

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY_XPOST,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: PERSONALITY_SYSTEM,
      messages: [{ role: 'user', content: `Write a thought-leader tweet about: ${topic}\n\nThis should read like a disciplined operator memo, not a guru thread. Make one sharp observation, explain the implication cleanly, and stop. Professional, concise, screenshot-worthy, zero bravado.\n\nJust the tweet text, nothing else. Under 280 chars.` }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || null;
}

async function generateHotTake() {
  const takes = [
    'unpopular opinion about retail trading', 'hot take about crypto culture',
    'contrarian view on a popular trading strategy', 'why a common market belief is wrong',
    'something most traders are afraid to say', 'a hard truth about algo trading',
    'why most fintwit advice is dangerous', 'the uncomfortable truth about win rates',
    'why following trades is a losing strategy', 'what people get wrong about AI in trading',
    'why your favorite indicator is useless', 'the real reason most traders quit',
    'why trading is harder than people think', 'hot take on meme stocks',
    'why most trading courses are scams', 'unpopular opinion about diversification',
  ];
  const take = takes[Math.floor(Math.random() * takes.length)];

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY_XPOST,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: PERSONALITY_SYSTEM,
      messages: [{ role: 'user', content: `Write a sharp contrarian tweet about: ${take}\n\nBe firm and intelligent, not loud. Challenge lazy consensus without sounding smug or juvenile. No fake edge, no rage-bait, no caricature.\n\nJust the tweet text, nothing else. Under 280 chars.` }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || null;
}

async function generateFunnyTweet() {
  const themes = [
    'the pain of watching your position go red immediately after entry',
    'refreshing your portfolio 47 times a day', 'the copium of bag holders',
    'explaining to your partner why you need another monitor',
    'the duality of being a dev and a trader', 'when your algo does the exact opposite of what you coded',
    'checking futures at 3am', 'the stages of grief during a drawdown',
    'when someone asks what you do and you say algo trading', 'paper trading confidence vs real money anxiety',
    'the audacity of people who say trading is easy', 'when your backtest shows 90% win rate',
    'portfolio screenshots on green days only', 'the market closing right before your setup triggers',
    'when you build a bot that loses money faster than you can manually',
    'buying the dip that keeps dipping', 'telling yourself this time is different',
  ];
  const theme = themes[Math.floor(Math.random() * themes.length)];

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY_XPOST,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: PERSONALITY_SYSTEM,
      messages: [{ role: 'user', content: `Write a dry, understated trading tweet about: ${theme}\n\nThe humor should come from recognition, not exaggeration. Keep it professional and smart. No meme-account voice, no clowning, no cringe, no emojis.\n\nJust the tweet text, nothing else. Under 280 chars.` }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || null;
}

async function generateSentinelPnl() {
  const supabase = (await import('@supabase/supabase-js')).createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const [accountRes, todaySessionRes] = await Promise.all([
    supabase.from('sentinel_account').select('*').eq('id', '00000000-0000-0000-0000-000000000001').single(),
    supabase.from('sentinel_sessions').select('*').eq('session_date', new Date().toISOString().slice(0, 10)).maybeSingle(),
  ]);

  const account = accountRes.data;
  const session = todaySessionRes.data;
  if (!account || !session) return null;
  if (session.trades_closed === 0) return null; // No trades today, skip

  const totalPnl = account.total_pnl || 0;
  const winRate = account.win_rate || 0;
  const todayPnl = session.gross_pnl || 0;
  const todayTrades = session.trades_closed || 0;
  const todayWins = session.wins || 0;

  const prompt = `Write a short tweet reporting Sentinel's daily trading results. Use ONLY this data:

TODAY: ${todayPnl >= 0 ? '+' : ''}$${todayPnl.toFixed(2)} P&L | ${todayTrades} trades | ${todayWins} wins
ALL-TIME: ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)} total P&L | ${winRate.toFixed(1)}% win rate

This is Sentinel, our AI trading bot learning to trade in real time. Sound like a disciplined desk recap: candid, concise, no chest-thumping. Dry humor is acceptable only if it stays professional.
Start with "Sentinel daily report:" or similar. Under 280 chars.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY_XPOST,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: PERSONALITY_SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || null;
}

// ============================================================
// TIME-AWARENESS — ET session: premarket / regular / afterhours / closed
// ============================================================
function getETSession() {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: false });
  const parts = formatter.formatToParts(new Date());
  const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
  const minute = parseInt(parts.find(p => p.type === 'minute').value, 10);
  const etMinutes = hour * 60 + minute;
  // 4:00AM-9:29AM → premarket; 9:30AM-4:00PM → regular; 4:01PM-8:00PM → afterhours; 8:01PM-3:59AM → closed
  if (etMinutes >= 4 * 60 && etMinutes < 9 * 60 + 30) return 'premarket';
  if (etMinutes >= 9 * 60 + 30 && etMinutes < 16 * 60) return 'regular';
  if (etMinutes >= 16 * 60 + 1 && etMinutes <= 20 * 60) return 'afterhours';
  return 'closed';
}

// ============================================================
// MAIN HANDLER — Vercel serverless function
// ============================================================
export default async function handler(req, res) {
  const cronSecret = String(process.env.CRON_SECRET || '').trim();
  const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  if (!cronSecret) {
    if (isProduction) {
      return res.status(500).json({ error: 'CRON_SECRET is required in production' });
    }
  } else if (req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Auto-engagement: run every 30 min via cron (?type=engagement); no session check
  if (req.query.type === 'engagement') {
    try {
      const result = await runEngagement();
      return res.status(200).json(result);
    } catch (error) {
      console.error('Engagement error:', error);
      return res.status(500).json({ status: 'error', error: error.message });
    }
  }

  const session = getETSession();
  const isAuthenticated = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  const forcePost = req.query.force === 'true' && isAuthenticated;

  if (session === 'closed' && !forcePost) {
    return res.status(200).json({
      status: 'skipped',
      reason: 'Outside posting hours (8:01PM–3:59AM ET)',
    });
  }

  let type = req.query.type || 'market-open';

  const sessionSkipReason = getTypeSessionSkipReason(type, session);
  if (sessionSkipReason) {
    return res.status(200).json({
      status: 'skipped',
      reason: sessionSkipReason,
    });
  }

  const redisLock = getRedis();
  const runLockKey = getRunLockKey(type);
  let runLockAcquired = false;
  const postedKey = SINGLE_POST_PER_DAY_TYPES.has(type) ? getPostedKey(type) : null;

  try {
    if (redisLock && postedKey) {
      const alreadyPosted = await redisLock.get(postedKey);
      if (alreadyPosted != null) {
        return res.status(200).json({
          status: 'skipped',
          reason: `Daily post already sent for ${type}`,
        });
      }
    }
  } catch (error) {
    console.error('[xbot] Posted-key check error:', error?.message || error);
  }

  if (redisLock) {
    try {
      runLockAcquired = await acquireLock(redisLock, runLockKey, 300);
      if (!runLockAcquired) {
        return res.status(200).json({
          status: 'skipped',
          reason: 'Duplicate post prevented (run lock active)',
        });
      }
    } catch (error) {
      console.error('[xbot] Run-lock error:', error?.message || error);
    }
  }

  try {
    let tweet = null;

    switch (type) {
      case 'market-open':
        tweet = await generateMarketOpen();
        break;
      case 'premarket':
        tweet = await generateMarketOpen({ prepost: true });
        break;
      case 'mag7':
        tweet = await generateMag7Update();
        break;
      case 'top-movers':
        tweet = await generateTopMovers();
        break;
      case 'breaking':
        const breakingResult = await generateBreakingNews();
        if (breakingResult?.skipReason) {
          return res.status(200).json({
            status: 'skipped',
            reason: breakingResult.skipReason,
            type,
          });
        }
        tweet = breakingResult?.tweet || null;
        break;
      case 'crypto':
        tweet = await generateCryptoUpdate();
        break;
      case 'market-close':
        tweet = await generateMarketClose();
        break;
      case 'trump-watch':
        const trumpResult = await generateTrumpWatch();
        tweet = trumpResult?.tweet || null;
        break;
      case 'thought-leader':
        tweet = await generateThoughtLeader();
        break;
      case 'hot-take':
        tweet = await generateHotTake();
        break;
      case 'funny':
        tweet = await generateFunnyTweet();
        break;
      case 'sentinel-pnl':
        tweet = await generateSentinelPnl();
        break;
      default:
        return res.status(400).json({ error: `Unknown type: ${type}` });
    }

    if (!tweet) {
      return res.status(200).json({
        status: 'skipped',
        reason: 'No data available or verification failed',
      });
    }

    tweet = await applyWebsitePlacement(type, tweet);

    // ── GLOBAL VERIFICATION — catches sports/betting content from ALL post types ──
    const verifyData = {
      sentinelStats: type === 'sentinel-pnl',
      professionalTone: true,
    };
    const verification = verifyTweet(tweet, verifyData);
    if (!verification.approved) {
      console.log(`[xbot] Tweet REJECTED by global verify (${type}):`, verification.errors, tweet.slice(0, 100));
      return res.status(200).json({ status: 'skipped', reason: `Global verification failed: ${verification.errors.join(', ')}` });
    }

    // ── GLOBAL DEDUP — prevent posting similar content back to back ──
    const redisDedup = getRedis();
    if (redisDedup) {
      try {
        // Check last 3 tweets for similarity
        const lastTweetsKey = 'xbot:recent_tweets';
        const recentRaw = await redisDedup.get(lastTweetsKey);
        const recentTweets = recentRaw ? (typeof recentRaw === 'string' ? JSON.parse(recentRaw) : recentRaw) : [];

        // Simple keyword overlap check — extract key words and compare
        const getKeywords = (text) => text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 4);
        const tweetWords = new Set(getKeywords(tweet));

        for (const prev of recentTweets) {
          const prevWords = new Set(getKeywords(prev));
          const overlap = [...tweetWords].filter(w => prevWords.has(w)).length;
          const similarity = overlap / Math.max(tweetWords.size, 1);
          if (similarity > 0.4) {
            console.log(`[xbot] Tweet REJECTED — too similar to recent post (${(similarity * 100).toFixed(0)}% overlap)`);
            return res.status(200).json({ status: 'skipped', reason: `Too similar to recent tweet (${(similarity * 100).toFixed(0)}% keyword overlap)` });
          }
        }

        // Store this tweet in recent list (keep last 5, expire in 6 hours)
        recentTweets.unshift(tweet);
        await redisDedup.set(lastTweetsKey, JSON.stringify(recentTweets.slice(0, 5)), { ex: 21600 });
      } catch (e) {
        console.error('[xbot] Dedup check error:', e.message);
      }
    }

    // Post to X
    const result = await postTweet(tweet);

    if (redisLock && postedKey) {
      try {
        await redisLock.set(postedKey, result.data?.id || tweet, { ex: getMidnightTTL() });
      } catch (error) {
        console.error('[xbot] Failed to persist posted-key:', error?.message || error);
      }
    }

    let webhookUrl;
    if (type === 'premarket' || type === 'market-open' || type === 'midday' || type === 'market-close') {
      webhookUrl = process.env.DISCORD_WEBHOOK_MARKET_TALK;
    } else if (type === 'breaking') {
      webhookUrl = process.env.DISCORD_WEBHOOK_ANNOUNCEMENTS;
    } else if (type === 'signal' || type === 'trade-setup') {
      webhookUrl = process.env.DISCORD_WEBHOOK_TRADE_SETUPS;
    } else if (type === 'sentinel-pnl') {
      webhookUrl = process.env.DISCORD_WEBHOOK_TRADE_SETUPS;
    } else {
      webhookUrl = process.env.DISCORD_WEBHOOK_MARKET_TALK;
    }
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embeds: [{
              description: tweet,
              color: 0x00ff88,
              footer: {
                text: '⏰ ' + new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York' }) + ' ET | Stratify | Not financial advice'
              },
              timestamp: new Date().toISOString()
            }]
          })
        });
      } catch (e) {
        console.error('Discord webhook failed:', e.message);
      }
    }

    return res.status(200).json({
      status: 'posted',
      tweet,
      tweetId: result.data?.id,
      type,
    });

  } catch (error) {
    console.error('X Bot v2 error:', error);
    return res.status(500).json({
      status: 'error',
      error: error.message,
    });
  } finally {
    if (redisLock && runLockAcquired) {
      try {
        await redisLock.del(runLockKey);
      } catch (error) {
        console.error('[xbot] Failed to release run-lock:', error?.message || error);
      }
    }
  }
}
