// X Bot v2 — Stratify (@stratify_hq)
// Data-first pipeline: Real APIs → Verify → AI Formats → Post
// AI NEVER generates facts. AI only formats verified data into tweets.

import crypto from 'crypto';
import { Redis } from '@upstash/redis';
import { postToDiscord } from './lib/discord.js';

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
  const url = 'https://api.twitter.com/2/tweets';
  const method = 'POST';

  const oauthParams = {
    oauth_consumer_key: process.env.X_API_KEY,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: process.env.X_ACCESS_TOKEN,
    oauth_version: '1.0',
  };

  const signature = generateOAuthSignature(
    method, url, oauthParams,
    process.env.X_API_SECRET,
    process.env.X_ACCESS_TOKEN_SECRET
  );

  const authHeader = 'OAuth ' + Object.entries({ ...oauthParams, oauth_signature: signature })
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`)
    .join(', ');

  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`X API error: ${JSON.stringify(data)}`);
  }
  return data;
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
11. Start every tweet with 🚨 JUST IN:

TONE: Think Bloomberg terminal meets fintwit. Smart, fast, credible.
You are a data reporter, not a hype man.`;

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
    if (tweet.toLowerCase().includes(phrase)) {
      errors.push(`Banned phrase: "${phrase}"`);
    }
  }

  // Verify numbers match raw data (spot check prices)
  if (rawData?.quotes) {
    const priceRegex = /\$([A-Z]{1,5})\s+.*?\$?([\d,]+\.?\d*)/g;
    // Basic check: ensure we have data for mentioned tickers
    for (const ticker of mentioned) {
      if (rawData.quotes[ticker] === undefined &&
          !['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'SPY', 'QQQ', 'DIA'].includes(ticker)) {
        // Ticker mentioned but no data — could be hallucinated
        errors.push(`No data for mentioned ticker: $${ticker}`);
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
  // Fetch Mag 7 + top retail (prepost=true for pre-market session)
  const watchlist = [...APPROVED_TICKERS.mag7, ...APPROVED_TICKERS.indices];
  const quotes = await fetchTwelveDataQuotes(watchlist, { prepost: options.prepost === true });

  if (Object.keys(quotes).length === 0) {
    console.log('No quote data available, skipping');
    return null;
  }

  // Sort by percent change
  const sorted = Object.entries(quotes)
    .filter(([_, q]) => q.percent_change)
    .sort((a, b) => Math.abs(parseFloat(b[1].percent_change)) - Math.abs(parseFloat(a[1].percent_change)));

  // Build data block for Claude
  const dataBlock = sorted.slice(0, 8).map(([sym, q]) => {
    const pct = parseFloat(q.percent_change).toFixed(2);
    const price = parseFloat(q.close).toFixed(2);
    const direction = pct >= 0 ? '+' : '';
    return `${sym}: $${price} (${direction}${pct}%)`;
  }).join('\n');

  const isPremarket = options.prepost === true;
  const etTime = new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true });
  const etDate = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' });

  const prompt = isPremarket
    ? `REAL DATA (use ONLY this):
${dataBlock}

These are PRE-MARKET prices as of ${etTime} ET on ${etDate}. Friday's close is shown if no pre-market trading has occurred yet for that ticker.
Write a market update tweet. Label the post PRE-MARKET UPDATE and note if prices reflect Friday's close due to no pre-market activity.
Show the top movers with their exact prices and percentages from the data above. Format prices cleanly. Keep it tight and punchy. Start with 🚨 JUST IN:`
    : `REAL DATA (use ONLY this):
${dataBlock}

Write a market update tweet. Start with 🚨 JUST IN:
Show the top movers with their exact prices and percentages from the data above.
Format prices cleanly. Keep it tight and punchy.`;

  const tweet = await formatWithClaude(prompt);
  if (!tweet) return null;

  const verification = verifyTweet(tweet, { quotes });
  if (!verification.approved) {
    console.log('Tweet failed verification:', verification.errors);
    return null;
  }

  return tweet;
}

async function generateTopMovers() {
  // Fetch retail favorites + meme stocks
  const watchlist = [...APPROVED_TICKERS.retail, ...APPROVED_TICKERS.meme];
  const quotes = await fetchTwelveDataQuotes(watchlist);

  if (Object.keys(quotes).length === 0) return null;

  // Sort by biggest movers
  const sorted = Object.entries(quotes)
    .filter(([_, q]) => q.percent_change)
    .sort((a, b) => Math.abs(parseFloat(b[1].percent_change)) - Math.abs(parseFloat(a[1].percent_change)));

  const topMovers = sorted.slice(0, 5);
  if (topMovers.length === 0) return null;

  const dataBlock = topMovers.map(([sym, q]) => {
    const pct = parseFloat(q.percent_change).toFixed(2);
    const price = parseFloat(q.close).toFixed(2);
    const direction = pct >= 0 ? '+' : '';
    return `${sym}: $${price} (${direction}${pct}%)`;
  }).join('\n');

  const prompt = `REAL DATA (use ONLY this):
${dataBlock}

Write a tweet about the top retail stock movers right now. Start with 🚨 JUST IN:
Show each ticker with exact price and percentage from the data.
These are the stocks retail traders actually care about.`;

  const tweet = await formatWithClaude(prompt);
  if (!tweet) return null;

  const verification = verifyTweet(tweet, { quotes });
  if (!verification.approved) {
    console.log('Tweet failed verification:', verification.errors);
    return null;
  }

  return tweet;
}

async function generateMag7Update() {
  const quotes = await fetchTwelveDataQuotes(APPROVED_TICKERS.mag7);

  if (Object.keys(quotes).length === 0) return null;

  const sorted = Object.entries(quotes)
    .filter(([_, q]) => q.percent_change)
    .sort((a, b) => parseFloat(b[1].percent_change) - parseFloat(a[1].percent_change));

  const dataBlock = sorted.map(([sym, q]) => {
    const pct = parseFloat(q.percent_change).toFixed(2);
    const price = parseFloat(q.close).toFixed(2);
    const direction = pct >= 0 ? '+' : '';
    return `${sym}: $${price} (${direction}${pct}%)`;
  }).join('\n');

  const prompt = `REAL DATA (use ONLY this):
${dataBlock}

Write a Mag 7 update tweet. Start with 🚨 JUST IN:
Show all 7 stocks with their exact prices and percentages.
Note which are leading and lagging today.`;

  const tweet = await formatWithClaude(prompt);
  if (!tweet) return null;

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
        return null;
      }
    } catch {
      // continue
    }
  }

  const articles = await fetchMarketauxNews();
  if (!articles || articles.length === 0) return null;

  const trusted = articles.filter(a => {
    const source = (a.source || '').toLowerCase();
    return TRUSTED_SOURCES.some(ts => source.includes(ts));
  });

  const article = trusted[0] || null;
  if (!article) {
    console.log('No trusted source articles found, skipping breaking news');
    return null;
  }

  const headline = (article.title || '').trim();
  if (!headline) return null;

  const headlineHash = crypto.createHash('sha256').update(headline.toLowerCase()).digest('hex').slice(0, 16);
  if (redis) {
    try {
      const seen = await redis.get(BREAKING_SEEN_PREFIX + headlineHash);
      if (seen) {
        console.log('Breaking headline already posted (dedupe), skipping');
        return null;
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
    if (!verification.approved) return null;
    if (redis) {
      try {
        const key = BREAKING_HOURLY_COUNT_KEY;
        const n = parseInt(await redis.get(key), 10) || 0;
        await redis.set(key, String(n + 1), { ex: BREAKING_TTL_1H });
      } catch {
        // ignore
      }
    }
    return truncated;
  }

  const verification = verifyTweet(tweet, {});
  if (!verification.approved) {
    console.log('Tweet failed verification:', verification.errors);
    return null;
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

  return tweet;
}

async function generateCryptoUpdate() {
  // Twelve Data crypto symbols
  const quotes = await fetchTwelveDataQuotes(ALL_CRYPTO_TICKERS);

  if (Object.keys(quotes).length === 0) return null;

  const dataBlock = Object.entries(quotes)
    .filter(([_, q]) => q.close)
    .map(([sym, q]) => {
      const pct = parseFloat(q.percent_change || 0).toFixed(2);
      const price = parseFloat(q.close).toFixed(2);
      const ticker = sym.split('/')[0];
      const direction = pct >= 0 ? '+' : '';
      return `${ticker}: $${price} (${direction}${pct}%)`;
    }).join('\n');

  const prompt = `REAL DATA (use ONLY this):
${dataBlock}

Write a crypto market update tweet. Start with 🚨 JUST IN:
Show the prices and percentages for each coin from the data above.
Keep it clean and factual.`;

  const tweet = await formatWithClaude(prompt);
  if (!tweet) return null;

  const verification = verifyTweet(tweet, { quotes });
  if (!verification.approved) {
    console.log('Tweet failed verification:', verification.errors);
    return null;
  }

  return tweet;
}

async function generateMarketClose() {
  const watchlist = [...APPROVED_TICKERS.mag7, ...APPROVED_TICKERS.indices];
  const quotes = await fetchTwelveDataQuotes(watchlist);

  if (Object.keys(quotes).length === 0) return null;

  // Separate indices and stocks
  const indices = {};
  const stocks = {};
  for (const [sym, q] of Object.entries(quotes)) {
    if (APPROVED_TICKERS.indices.includes(sym)) {
      indices[sym] = q;
    } else {
      stocks[sym] = q;
    }
  }

  const indicesBlock = Object.entries(indices).map(([sym, q]) => {
    const pct = parseFloat(q.percent_change).toFixed(2);
    const price = parseFloat(q.close).toFixed(2);
    const direction = pct >= 0 ? '+' : '';
    return `${sym}: $${price} (${direction}${pct}%)`;
  }).join('\n');

  const sorted = Object.entries(stocks)
    .filter(([_, q]) => q.percent_change)
    .sort((a, b) => parseFloat(b[1].percent_change) - parseFloat(a[1].percent_change));

  const winner = sorted[0];
  const loser = sorted[sorted.length - 1];

  const prompt = `REAL DATA (use ONLY this):
INDICES:
${indicesBlock}

TODAY'S MAG 7 WINNER: ${winner[0]}: $${parseFloat(winner[1].close).toFixed(2)} (${parseFloat(winner[1].percent_change) >= 0 ? '+' : ''}${parseFloat(winner[1].percent_change).toFixed(2)}%)
TODAY'S MAG 7 LAGGARD: ${loser[0]}: $${parseFloat(loser[1].close).toFixed(2)} (${parseFloat(loser[1].percent_change) >= 0 ? '+' : ''}${parseFloat(loser[1].percent_change).toFixed(2)}%)

Write a market close recap tweet. Start with 🚨 JUST IN:
Show index performance, then call out the day's winner and laggard from Mag 7.
Keep it factual and tight.`;

  const tweet = await formatWithClaude(prompt);
  if (!tweet) return null;

  const verification = verifyTweet(tweet, { quotes });
  if (!verification.approved) {
    console.log('Tweet failed verification:', verification.errors);
    return null;
  }

  return tweet;
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
  // Verify cron secret to prevent unauthorized triggers
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    // Also allow without auth for testing (remove in production)
    if (req.method !== 'GET' && !req.query.type) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const session = getETSession();
  if (session === 'closed') {
    return res.status(200).json({
      status: 'skipped',
      reason: 'Outside posting hours (8:01PM–3:59AM ET)',
    });
  }

  let type = req.query.type || 'market-open';
  if (session === 'premarket') type = 'premarket';
  if (session === 'afterhours') type = 'market-close';

  const redisLock = getRedis();
  if (redisLock) {
    try {
      const lockKey = `xbot:lock:${type}`;
      const existing = await redisLock.get(lockKey);
      if (existing != null) {
        return res.status(200).json({
          status: 'skipped',
          reason: 'Duplicate post prevented (lock active)',
        });
      }
      await redisLock.set(lockKey, '1', { ex: 60 });
    } catch {
      // proceed without lock if Redis fails
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
        tweet = await generateBreakingNews();
        break;
      case 'crypto':
        tweet = await generateCryptoUpdate();
        break;
      case 'market-close':
        tweet = await generateMarketClose();
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

    if (session === 'premarket') tweet = 'PRE-MARKET UPDATE\n' + tweet;
    if (session === 'afterhours') tweet = 'AFTER HOURS\n' + tweet;

    // Post to X
    const result = await postTweet(tweet);

    const discordWebhook = process.env.DISCORD_WEBHOOK_URL;
    if (discordWebhook) {
      try {
        await fetch(discordWebhook, {
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

    if (type === 'breaking') {
      try {
        await postToDiscord('marketTalk', {
          embeds: [{
            title: 'Breaking News',
            description: tweet,
            color: 0xff0000,
          }],
        });
      } catch (discordErr) {
        console.error('Discord breaking post failed:', discordErr);
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
  }
}
