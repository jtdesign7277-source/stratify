import { Redis } from '@upstash/redis';

import { supabase } from '../lib/supabase.js';
import { BOT_PERSONAS, buildAvatarUrl } from '../lib/botPersonas.js';

export const config = { maxDuration: 60 };

const CLAUDE_MODEL = 'grok-3-mini-fast';
const CLAUDE_MAX_CALLS_PER_EXECUTION = 10;

const MARKET_CONTEXT_TTL_SECONDS = 600;
const PERSONA_LAST_POST_TTL_SECONDS = 3600;
const PERSONA_MIN_POST_GAP_MS = 30 * 60 * 1000;
const LIKE_SET_TTL_SECONDS = 24 * 60 * 60;
const BOT_EMAIL_DOMAIN = process.env.COMMUNITY_BOT_EMAIL_DOMAIN || 'bots.stratify.local';

const MARKET_CONTEXT_CACHE_PREFIX = 'bot:market-context';
const LAST_POST_PREFIX = 'bot:last-post';
const LAST_POSTER_KEY = 'bot:last-poster';
const LAST_TOPIC_KEY = 'bot:last-topic';
const CLAUDE_RATE_LIMIT_PREFIX = 'bot:claude-calls';
const REPLY_DELAY_PREFIX = 'bot:reply-delay';
const LIKE_SET_PREFIX = 'bot:likes';

const BANNED_CONTENT_PATTERN = /\b(ai|bot|automated|generated)\b/i;
const EMOJI_PATTERN = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;
const GENERIC_BLOCKLIST = ['the market is interesting today'];
const FLAIR_VALUES = new Set(['Alert', 'Discussion', 'Trade', 'News']);

const MAX_AUTH_USER_PAGES = 50;
const AUTH_USERS_PER_PAGE = 1000;

let redisClient = null;
let redisDisabled = false;
let botCache = {
  rows: null,
  expiresAt: 0,
};

function authorizeCron(req) {
  if (!process.env.CRON_SECRET) return true;
  const authHeader = req.headers.authorization;
  const xCronSecret = req.headers['x-cron-secret'];
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  return authHeader === expected || xCronSecret === process.env.CRON_SECRET;
}

function getRedisClient() {
  if (redisDisabled) return null;

  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  if (redisClient) return redisClient;

  try {
    redisClient = new Redis({ url, token });
    return redisClient;
  } catch (error) {
    redisDisabled = true;
    redisClient = null;
    console.error('[cron/community-bot] Redis init failed:', error);
    return null;
  }
}

function unwrapPipelineResult(value) {
  return value && typeof value === 'object' && 'result' in value ? value.result : value;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(rows = []) {
  const copy = [...rows];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function maybeArray(value) {
  return Array.isArray(value) ? value : [];
}

function maybeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeTicker(value = '') {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/^\$/, '')
    .replace(/[^A-Z0-9./=-]/g, '')
    .slice(0, 14);
}

function extractTickersFromText(value = '') {
  const matches = String(value || '').match(/\$[A-Z]{1,8}/g) || [];
  return [...new Set(matches.map((token) => normalizeTicker(token.replace('$', ''))).filter(Boolean))];
}

function sanitizeTickerList(rows = []) {
  const seen = new Set();
  const out = [];

  for (const row of maybeArray(rows)) {
    const normalized = normalizeTicker(row);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }

  return out.slice(0, 8);
}

function sanitizeFlair(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;

  const direct = [...FLAIR_VALUES].find((item) => item.toLowerCase() === normalized.toLowerCase());
  return direct || null;
}

function postTypeFromFlair(flair) {
  if (flair === 'Alert') return 'alert_share';
  if (flair === 'Trade') return 'trade_share';
  return 'post';
}

function getTextBlocks(content = []) {
  return maybeArray(content)
    .filter((block) => block?.type === 'text' && typeof block?.text === 'string')
    .map((block) => block.text.trim())
    .filter(Boolean);
}

function tryParseJson(text = '') {
  const cleaned = String(text || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (!cleaned) return null;

  try {
    return JSON.parse(cleaned);
  } catch {
    // Fall through to bracket scanning.
  }

  let depth = 0;
  let start = -1;

  for (let i = 0; i < cleaned.length; i += 1) {
    const ch = cleaned[i];
    if (ch === '{') {
      if (start === -1) start = i;
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        const candidate = cleaned.slice(start, i + 1);
        try {
          return JSON.parse(candidate);
        } catch {
          // Continue scanning in case a later block is valid JSON.
        }
      }
    }
  }

  return null;
}

function extractJsonFromTextBlocks(textBlocks = []) {
  for (const block of textBlocks) {
    const parsed = tryParseJson(block);
    if (parsed && typeof parsed === 'object') return parsed;
  }
  return null;
}

function sanitizeContent(rawContent = '') {
  const withoutHashtags = String(rawContent || '').replace(/#[^\s]+/g, '').trim();
  const withoutEmoji = withoutHashtags.replace(EMOJI_PATTERN, '').trim();
  const content = withoutEmoji.replace(/\s+/g, ' ').trim();
  if (!content) return null;

  const lower = content.toLowerCase();
  if (BANNED_CONTENT_PATTERN.test(content)) return null;
  if (GENERIC_BLOCKLIST.some((phrase) => lower.includes(phrase))) return null;

  return content;
}

function normalizePnl(rawPnl) {
  if (!rawPnl || typeof rawPnl !== 'object') return null;

  const ticker = normalizeTicker(rawPnl.ticker);
  const amount = Number(rawPnl.amount);
  const percent = Number(rawPnl.percent);

  const hasAmount = Number.isFinite(amount);
  const hasPercent = Number.isFinite(percent);

  if (!ticker && !hasAmount && !hasPercent) return null;

  return {
    ticker: ticker || null,
    amount: hasAmount ? amount : null,
    percent: hasPercent ? percent : null,
  };
}

function normalizeMarketCondition(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'bullish' || normalized === 'bearish' || normalized === 'choppy' || normalized === 'flat') {
    return normalized;
  }
  return 'choppy';
}

function normalizeMajorMove(row) {
  if (!row || typeof row !== 'object') return null;
  const ticker = normalizeTicker(row.ticker);
  const move = String(row.move || '').trim().slice(0, 40);
  const reason = String(row.reason || '').trim().slice(0, 220);
  if (!ticker && !reason) return null;
  return {
    ticker: ticker || null,
    move: move || null,
    reason: reason || null,
  };
}

function normalizeMarketContext(raw) {
  const market = maybeObject(raw);

  const majorMoves = maybeArray(market.majorMoves)
    .map((row) => normalizeMajorMove(row))
    .filter(Boolean)
    .slice(0, 10);

  const breakingNews = maybeArray(market.breakingNews)
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 10);

  const indices = maybeObject(market.indices);
  const topTalkedAbout = sanitizeTickerList(market.topTalkedAbout || []);

  return {
    marketCondition: normalizeMarketCondition(market.marketCondition),
    majorMoves,
    breakingNews,
    indices: {
      spy: String(indices.spy || '').trim(),
      qqq: String(indices.qqq || '').trim(),
    },
    sentiment: String(market.sentiment || '').trim(),
    topTalkedAbout,
    fetchedAt: new Date().toISOString(),
  };
}

function parsePercentFromString(value) {
  const text = String(value || '').trim();
  if (!text) return 0;
  const percentMatch = text.match(/([-+]?\d+(?:\.\d+)?)\s*%/);
  if (percentMatch) return Number(percentMatch[1]) || 0;
  return 0;
}

function isHighVolatility(marketContext) {
  const spy = parsePercentFromString(marketContext?.indices?.spy);
  const qqq = parsePercentFromString(marketContext?.indices?.qqq);
  return Math.max(Math.abs(spy), Math.abs(qqq)) >= 1;
}

function getEtClockParts(now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now).reduce((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});

  const hour = Number(parts.hour || '0');
  const minute = Number(parts.minute || '0');
  const minuteOfDay = hour * 60 + minute;
  const isWeekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(parts.weekday);
  const inPostingWindow = isWeekday && minuteOfDay >= 7 * 60 && minuteOfDay <= 18 * 60;
  const isRegularSession = minuteOfDay >= (9 * 60 + 30) && minuteOfDay <= 16 * 60;

  const dateKey = `${parts.year}${parts.month}${parts.day}`;
  const hourKey = `${dateKey}${String(hour).padStart(2, '0')}`;

  return {
    weekday: parts.weekday,
    hour,
    minute,
    minuteOfDay,
    isWeekday,
    inPostingWindow,
    isRegularSession,
    hourKey,
    dateKey,
    nowEt: `${parts.year}-${parts.month}-${parts.day} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ET`,
  };
}

function buildTopicSignature({ mentionedTickers, content }) {
  const tickers = sanitizeTickerList(mentionedTickers || []);
  if (tickers.length > 0) {
    return `tickers:${tickers.slice(0, 3).join('-')}`;
  }

  const words = String(content || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .join('-');

  return words ? `text:${words}` : null;
}

async function enforceClaudeCallBudget({ redis, executionId, state }) {
  state.localClaudeCalls += 1;
  if (state.localClaudeCalls > CLAUDE_MAX_CALLS_PER_EXECUTION) {
    throw new Error(`Claude call budget exceeded (${CLAUDE_MAX_CALLS_PER_EXECUTION})`);
  }

  if (!redis) return state.localClaudeCalls;

  try {
    const key = `${CLAUDE_RATE_LIMIT_PREFIX}:${executionId}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 15 * 60);
    }

    if (count > CLAUDE_MAX_CALLS_PER_EXECUTION) {
      throw new Error(`Redis Claude call budget exceeded (${CLAUDE_MAX_CALLS_PER_EXECUTION})`);
    }

    return count;
  } catch (error) {
    if (String(error?.message || '').includes('budget exceeded')) {
      throw error;
    }
    return state.localClaudeCalls;
  }
}

async function callClaudeJson({ redis, executionId, state, system, userPrompt, useWebSearch = false, maxTokens = 1400 }) {
  const apiKey = String(process.env.XAI_API_KEY || '').trim();
  if (!apiKey) throw new Error('XAI_API_KEY is missing. Please add it in environment variables.');

  await enforceClaudeCallBudget({ redis, executionId, state });

  const payload = {
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userPrompt }],
  };

  if (useWebSearch) {
    // Keep prompt unchanged; xAI chat-completions does not accept Anthropic tool definitions.
  }

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: payload.model,
      max_tokens: payload.max_tokens,
      temperature: 0.8,
      messages: [
        { role: 'system', content: payload.system },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`xAI API error ${response.status}: ${errorBody.slice(0, 240)}`);
  }

  const result = await response.json();
  const assistantText = String(result?.choices?.[0]?.message?.content || '').trim();
  const textBlocks = getTextBlocks(assistantText ? [{ type: 'text', text: assistantText }] : []);
  const parsed = extractJsonFromTextBlocks(textBlocks);

  if (!parsed) {
    throw new Error('Claude response did not contain valid JSON');
  }

  return parsed;
}

async function getCachedMarketContext(redis, hourKey) {
  if (!redis) return null;
  try {
    const key = `${MARKET_CONTEXT_CACHE_PREFIX}:${hourKey}`;
    const cached = await redis.get(key);
    if (!cached) return null;
    return normalizeMarketContext(typeof cached === 'string' ? JSON.parse(cached) : cached);
  } catch {
    return null;
  }
}

async function setCachedMarketContext(redis, hourKey, payload) {
  if (!redis || !payload) return;
  try {
    const key = `${MARKET_CONTEXT_CACHE_PREFIX}:${hourKey}`;
    await redis.set(key, JSON.stringify(payload), { ex: MARKET_CONTEXT_TTL_SECONDS });
  } catch (error) {
    console.error('[cron/community-bot] market context cache write failed:', error);
  }
}

async function loadMarketContext({ redis, executionId, state, hourKey }) {
  const cached = await getCachedMarketContext(redis, hourKey);
  if (cached) {
    return { context: cached, fromCache: true };
  }

  const system = 'You are a market data assistant. Search for what is happening in the US stock market RIGHT NOW. Find: current S&P and NASDAQ movement, any stocks making big moves today, any breaking news affecting markets, any earnings reports today, Fed news, crypto prices. Return JSON only.';
  const userPrompt = 'Search the web for current US stock market conditions right now. What stocks are moving? Any breaking news? What are the major indices doing? Any earnings today? Return JSON: { marketCondition: "bullish/bearish/choppy/flat", majorMoves: [{ ticker, move, reason }], breakingNews: [string], indices: { spy: string, qqq: string }, sentiment: string, topTalkedAbout: [string] }';

  const parsed = await callClaudeJson({
    redis,
    executionId,
    state,
    system,
    userPrompt,
    useWebSearch: true,
    maxTokens: 1600,
  });

  const normalized = normalizeMarketContext(parsed);
  await setCachedMarketContext(redis, hourKey, normalized);
  return { context: normalized, fromCache: false };
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function sanitizeHandleForEmail(handle = '') {
  return String(handle || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function botEmailForPersona(persona) {
  return `${sanitizeHandleForEmail(persona.handle)}@${BOT_EMAIL_DOMAIN}`;
}

function botPasswordForPersona(persona) {
  return `StratifyCommunity!${sanitizeHandleForEmail(persona.handle)}#2026`;
}

async function listUsersByEmail() {
  const usersByEmail = new Map();

  for (let page = 1; page <= MAX_AUTH_USER_PAGES; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: AUTH_USERS_PER_PAGE,
    });

    if (error) {
      throw new Error(`Failed to list auth users: ${error.message}`);
    }

    const users = maybeArray(data?.users);
    users.forEach((user) => {
      if (user?.email) {
        usersByEmail.set(normalizeEmail(user.email), user.id);
      }
    });

    if (users.length < AUTH_USERS_PER_PAGE) break;
  }

  return usersByEmail;
}

async function resolveBotUsers() {
  const now = Date.now();
  if (botCache.rows && botCache.expiresAt > now) {
    return botCache.rows;
  }

  let usersByEmail = await listUsersByEmail();
  const resolved = [];

  for (const persona of BOT_PERSONAS) {
    const email = botEmailForPersona(persona);
    const normalizedEmail = normalizeEmail(email);
    let userId = usersByEmail.get(normalizedEmail);
    const avatarUrl = buildAvatarUrl(persona.handle, persona.avatar_color);

    if (!userId) {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: botPasswordForPersona(persona),
        email_confirm: true,
        user_metadata: {
          full_name: persona.handle,
          avatar_url: avatarUrl,
          avatar_color: persona.avatar_color,
          is_community_bot: true,
        },
        app_metadata: {
          is_community_bot: true,
        },
      });

      if (error) {
        const message = String(error.message || '').toLowerCase();
        if (message.includes('already') || message.includes('exists') || message.includes('registered')) {
          usersByEmail = await listUsersByEmail();
          userId = usersByEmail.get(normalizedEmail);
        } else {
          throw new Error(`Failed to create bot user ${persona.handle}: ${error.message}`);
        }
      } else {
        userId = data?.user?.id;
        if (userId) usersByEmail.set(normalizedEmail, userId);
      }
    }

    if (!userId) {
      throw new Error(`Could not resolve auth user for bot ${persona.handle}`);
    }

    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        id: userId,
        display_name: persona.handle,
        avatar_url: avatarUrl,
        email,
      },
      { onConflict: 'id' },
    );

    if (profileError) {
      console.warn(`[cron/community-bot] profile upsert skipped for ${persona.handle}:`, profileError.message);
    }

    resolved.push({
      ...persona,
      user_id: userId,
      avatar_url: avatarUrl,
      email,
    });
  }

  botCache = {
    rows: resolved,
    expiresAt: now + 10 * 60 * 1000,
  };

  return resolved;
}

async function getPersonaLastPostMap(redis, personas) {
  const timestamps = {};

  if (!redis || personas.length === 0) {
    return timestamps;
  }

  try {
    const pipeline = redis.pipeline();
    personas.forEach((persona) => {
      pipeline.get(`${LAST_POST_PREFIX}:${persona.handle}`);
    });

    const results = await pipeline.exec();
    personas.forEach((persona, index) => {
      const raw = unwrapPipelineResult(results[index]);
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) {
        timestamps[persona.handle] = parsed;
      }
    });
  } catch (error) {
    console.error('[cron/community-bot] failed reading persona post timestamps:', error);
  }

  return timestamps;
}

function getEligiblePersonasForPosting({ personas, lastPostMap, nowMs, lastPoster }) {
  const baseEligible = personas.filter((persona) => {
    const lastPostedAt = Number(lastPostMap[persona.handle] || 0);
    if (!lastPostedAt) return true;
    return nowMs - lastPostedAt >= PERSONA_MIN_POST_GAP_MS;
  });

  if (baseEligible.length === 0) return [];

  const withoutLastPoster = baseEligible.filter((persona) => persona.handle !== lastPoster);
  if (withoutLastPoster.length > 0) return withoutLastPoster;

  return [];
}

async function persistPersonaPostState(redis, postedHandles = [], timestampMs = Date.now()) {
  if (!redis || postedHandles.length === 0) return;

  try {
    const uniqueHandles = [...new Set(postedHandles.filter(Boolean))];
    const pipeline = redis.pipeline();
    uniqueHandles.forEach((handle) => {
      pipeline.set(`${LAST_POST_PREFIX}:${handle}`, String(timestampMs), { ex: PERSONA_LAST_POST_TTL_SECONDS });
    });
    await pipeline.exec();
  } catch (error) {
    console.error('[cron/community-bot] failed persisting persona post state:', error);
  }
}

async function shouldReplyThisCycle(redis, postId) {
  if (!redis) {
    return Math.random() < 0.6;
  }

  const key = `${REPLY_DELAY_PREFIX}:${postId}`;
  try {
    const raw = await redis.get(key);
    if (raw === null || raw === undefined) {
      if (Math.random() < 0.55) {
        return true;
      }

      const delayCycles = randomInt(1, 2);
      await redis.set(key, String(delayCycles), { ex: 30 * 60 });
      return false;
    }

    const cyclesLeft = Number(raw);
    if (!Number.isFinite(cyclesLeft) || cyclesLeft <= 1) {
      await redis.del(key);
      return true;
    }

    await redis.set(key, String(cyclesLeft - 1), { ex: 30 * 60 });
    return false;
  } catch {
    return Math.random() < 0.6;
  }
}

function normalizeGeneratedPost(rawPost, selectedPersonaByHandle, fallbackPersona) {
  const source = maybeObject(rawPost);
  const persona = selectedPersonaByHandle.get(source.handle) || fallbackPersona;
  if (!persona) return null;

  const content = sanitizeContent(source.content);
  if (!content) return null;

  const flair = sanitizeFlair(source.flair);
  const pnl = normalizePnl(source.pnl);
  const mentionedTickers = sanitizeTickerList([
    ...maybeArray(source.mentionedTickers),
    ...extractTickersFromText(content),
  ]);

  return {
    persona,
    handle: persona.handle,
    content,
    flair,
    pnl,
    mentionedTickers,
    postType: postTypeFromFlair(flair),
    topicSignature: buildTopicSignature({ mentionedTickers, content }),
  };
}

async function generateTopLevelPosts({
  redis,
  executionId,
  state,
  marketContext,
  personas,
  targetPostCount,
  lastTopic,
}) {
  if (!marketContext || personas.length === 0 || targetPostCount <= 0) return [];

  const personaPromptPayload = personas.map((persona) => ({
    handle: persona.handle,
    style: persona.style,
    favorite_tickers: persona.favorite_tickers,
  }));

  const system = 'You generate authentic social media posts for a stock trading community. Posts must sound like real human traders, NOT like AI. Never be generic. Reference specific tickers, specific prices, specific moves happening TODAY. Vary post types: some are quick observations, some share a trade they made, some ask the community a question, some react to news. Never use hashtags. Never be promotional. Sometimes include a typo or casual abbreviation to feel human. Match the persona style exactly.';

  const userPrompt = [
    `Here is what is happening in the market right now: ${JSON.stringify(marketContext)}.`,
    `Generate ${targetPostCount} posts from these personas: ${JSON.stringify(personaPromptPayload)}.`,
    'For each post return JSON object fields: { handle: string, content: string, flair: "Alert/Discussion/Trade/News" or null, pnl: { ticker, amount, percent } or null, mentionedTickers: [string] }.',
    'Return JSON only in this wrapper shape: { "posts": [ ... ] }.',
    'Make sure content directly references real things happening in the market right now. Keep posts between 1-3 sentences.',
    'Do not mention AI, bots, automation, or generated content. Do not use hashtags.',
    lastTopic ? `Do not repeat this exact topic signature from the previous post cycle: "${lastTopic}".` : '',
  ].filter(Boolean).join('\n');

  const parsed = await callClaudeJson({
    redis,
    executionId,
    state,
    system,
    userPrompt,
    useWebSearch: false,
    maxTokens: 1400,
  });

  const rows = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.posts)
      ? parsed.posts
      : parsed?.post
        ? [parsed.post]
        : parsed?.handle
          ? [parsed]
          : [];

  const selectedPersonaByHandle = new Map(personas.map((persona) => [persona.handle, persona]));

  const normalized = rows
    .map((row, index) => normalizeGeneratedPost(row, selectedPersonaByHandle, personas[index % personas.length]))
    .filter(Boolean);

  const dedupedByHandle = [];
  const seenHandles = new Set();
  const seenTopics = new Set(lastTopic ? [lastTopic] : []);

  for (const row of normalized) {
    if (seenHandles.has(row.handle)) continue;
    if (row.topicSignature && seenTopics.has(row.topicSignature)) continue;
    seenHandles.add(row.handle);
    if (row.topicSignature) seenTopics.add(row.topicSignature);
    dedupedByHandle.push(row);
    if (dedupedByHandle.length >= targetPostCount) break;
  }

  return dedupedByHandle;
}

function normalizeGeneratedReply(rawReply, persona) {
  if (!persona) return null;

  const source = maybeObject(rawReply);
  const content = sanitizeContent(source.content);
  if (!content) return null;

  return {
    persona,
    handle: persona.handle,
    content,
    mentionedTickers: sanitizeTickerList([
      ...maybeArray(source.mentionedTickers),
      ...extractTickersFromText(content),
    ]),
  };
}

async function generateReplyForPost({
  redis,
  executionId,
  state,
  post,
  persona,
}) {
  const system = 'You generate authentic social media replies for a stock trading community. Replies must sound human, concise, and specific to the post context. Never mention AI, bots, automation, or generated content. Never use hashtags.';

  const userPrompt = `Here is a recent post in a trading community: "${String(post.content || '').slice(0, 700)}" by ${String(post.author_name || 'Trader')}. Generate a reply from ${persona.handle}.
Persona style: ${persona.style}
The reply should be 1-2 sentences max. It can agree, disagree, add context, ask a follow-up question, or share their own experience. Must feel like a natural human reply. Return JSON: { content: string, handle: string }`;

  const parsed = await callClaudeJson({
    redis,
    executionId,
    state,
    system,
    userPrompt,
    useWebSearch: false,
    maxTokens: 500,
  });

  return normalizeGeneratedReply(parsed, persona);
}

function missingColumnError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('column') && message.includes('does not exist');
}

function toLegacyCommunityPostRow(row) {
  const metadata = {
    ...(maybeObject(row.metadata)),
    source: 'community_bot',
  };

  if (row.flair) metadata.flair = row.flair;
  if (row.user_handle) metadata.user_handle = row.user_handle;
  if (row.avatar_color) metadata.avatar_color = row.avatar_color;
  if (row.is_bot !== undefined) metadata.is_bot = Boolean(row.is_bot);
  if (row.pnl_ticker) metadata.pnl_ticker = row.pnl_ticker;
  if (row.pnl_amount !== undefined && row.pnl_amount !== null) metadata.pnl_amount = row.pnl_amount;
  if (row.pnl_percent !== undefined && row.pnl_percent !== null) metadata.pnl_percent = row.pnl_percent;
  if (row.mentioned_tickers) metadata.mentioned_tickers = row.mentioned_tickers;
  if (row.reply_to) metadata.reply_to = row.reply_to;

  return {
    user_id: row.user_id,
    author_name: row.author_name || row.user_handle || 'Trader',
    parent_id: row.parent_id || row.reply_to || null,
    parent_post_id: row.parent_post_id || row.reply_to || null,
    content: row.content,
    ticker_mentions: row.ticker_mentions || row.mentioned_tickers || [],
    post_type: row.post_type || 'post',
    metadata,
    created_at: row.created_at || new Date().toISOString(),
  };
}

async function insertCommunityPosts(rows = []) {
  if (rows.length === 0) return [];

  const selectClause = 'id, user_id, author_name, content, parent_id, parent_post_id, created_at';

  const primary = await supabase
    .from('community_posts')
    .insert(rows)
    .select(selectClause);

  if (!primary.error) {
    return primary.data || [];
  }

  if (!missingColumnError(primary.error)) {
    throw new Error(`Failed to insert community posts: ${primary.error.message}`);
  }

  const fallbackRows = rows.map((row) => toLegacyCommunityPostRow(row));
  const fallback = await supabase
    .from('community_posts')
    .insert(fallbackRows)
    .select(selectClause);

  if (fallback.error) {
    throw new Error(`Failed to insert community posts (fallback): ${fallback.error.message}`);
  }

  return fallback.data || [];
}

async function fetchRecentTopLevelPosts(limit = 10) {
  const primary = await supabase
    .from('community_posts')
    .select('id, user_id, author_name, content, created_at, comments_count, likes, like_count')
    .is('parent_id', null)
    .is('parent_post_id', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!primary.error) {
    return primary.data || [];
  }

  if (!missingColumnError(primary.error)) {
    throw new Error(`Failed to fetch recent posts: ${primary.error.message}`);
  }

  const fallback = await supabase
    .from('community_posts')
    .select('id, user_id, author_name, content, created_at, comments_count, likes')
    .is('parent_id', null)
    .is('parent_post_id', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (fallback.error) {
    throw new Error(`Failed to fetch recent posts (fallback): ${fallback.error.message}`);
  }

  return fallback.data || [];
}

async function fetchParentIdsWithReplies(postIds = []) {
  if (postIds.length === 0) return new Set();

  const inList = postIds.join(',');
  const { data, error } = await supabase
    .from('community_posts')
    .select('id, parent_id, parent_post_id')
    .or(`parent_id.in.(${inList}),parent_post_id.in.(${inList})`)
    .limit(200);

  if (error) {
    return new Set();
  }

  const repliedParentIds = new Set();
  (data || []).forEach((row) => {
    if (row?.parent_id) repliedParentIds.add(row.parent_id);
    if (row?.parent_post_id) repliedParentIds.add(row.parent_post_id);
  });

  return repliedParentIds;
}

async function fetchBotLikeStateByPost(postIds = [], botUserIds = []) {
  const map = new Map();
  postIds.forEach((postId) => {
    map.set(postId, new Set());
  });

  if (postIds.length === 0 || botUserIds.length === 0) {
    return map;
  }

  const { data, error } = await supabase
    .from('community_likes')
    .select('post_id, user_id')
    .in('post_id', postIds)
    .in('user_id', botUserIds);

  if (error) {
    throw new Error(`Failed to fetch existing bot likes: ${error.message}`);
  }

  (data || []).forEach((row) => {
    if (!map.has(row.post_id)) map.set(row.post_id, new Set());
    map.get(row.post_id).add(row.user_id);
  });

  return map;
}

async function loadRedisLikeSet(redis, postId) {
  if (!redis) return new Set();

  try {
    const members = await redis.smembers(`${LIKE_SET_PREFIX}:${postId}`);
    return new Set(maybeArray(members).map((member) => String(member)));
  } catch {
    return new Set();
  }
}

async function persistRedisLikeSets(redis, likeRows = []) {
  if (!redis || likeRows.length === 0) return;

  try {
    const byPost = new Map();
    likeRows.forEach((row) => {
      if (!row.post_id || !row.user_id) return;
      if (!byPost.has(row.post_id)) byPost.set(row.post_id, []);
      byPost.get(row.post_id).push(String(row.user_id));
    });

    const pipeline = redis.pipeline();
    for (const [postId, userIds] of byPost.entries()) {
      if (userIds.length === 0) continue;
      pipeline.sadd(`${LIKE_SET_PREFIX}:${postId}`, ...userIds);
      pipeline.expire(`${LIKE_SET_PREFIX}:${postId}`, LIKE_SET_TTL_SECONDS);
    }

    await pipeline.exec();
  } catch (error) {
    console.error('[cron/community-bot] failed persisting Redis like sets:', error);
  }
}

async function insertLikes(likeRows = []) {
  if (likeRows.length === 0) return [];

  const { data, error } = await supabase
    .from('community_likes')
    .upsert(likeRows, { onConflict: 'user_id,post_id', ignoreDuplicates: true })
    .select('id, user_id, post_id');

  if (error) {
    throw new Error(`Failed to insert likes: ${error.message}`);
  }

  return data || [];
}

function buildTopLevelPostRow(draft, createdAtIso) {
  return {
    user_id: draft.persona.user_id,
    author_name: draft.persona.handle,
    user_handle: draft.persona.handle,
    avatar_color: draft.persona.avatar_color,
    content: draft.content,
    flair: draft.flair,
    pnl_ticker: draft.pnl?.ticker || null,
    pnl_amount: draft.pnl?.amount ?? null,
    pnl_percent: draft.pnl?.percent ?? null,
    mentioned_tickers: draft.mentionedTickers,
    ticker_mentions: draft.mentionedTickers,
    post_type: draft.postType,
    is_bot: true,
    created_at: createdAtIso,
    metadata: {
      source: 'community_bot',
      is_bot: true,
      bot_handle: draft.persona.handle,
      bot_avatar_url: draft.persona.avatar_url,
      bot_avatar_color: draft.persona.avatar_color,
      bot_style: draft.persona.style,
      flair: draft.flair,
      pnl: draft.pnl || null,
      topic_signature: draft.topicSignature,
      posted_at: createdAtIso,
    },
  };
}

function buildReplyRow(draft, parentPostId, createdAtIso) {
  return {
    user_id: draft.persona.user_id,
    author_name: draft.persona.handle,
    user_handle: draft.persona.handle,
    avatar_color: draft.persona.avatar_color,
    content: draft.content,
    reply_to: parentPostId,
    parent_id: parentPostId,
    parent_post_id: parentPostId,
    mentioned_tickers: draft.mentionedTickers,
    ticker_mentions: draft.mentionedTickers,
    post_type: 'post',
    is_bot: true,
    created_at: createdAtIso,
    metadata: {
      source: 'community_bot',
      is_bot: true,
      is_reply: true,
      bot_handle: draft.persona.handle,
      bot_avatar_url: draft.persona.avatar_url,
      bot_avatar_color: draft.persona.avatar_color,
      bot_style: draft.persona.style,
      posted_at: createdAtIso,
    },
  };
}

function buildExecutionId(req) {
  return String(
    req.headers['x-vercel-id']
      || req.headers['x-request-id']
      || `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  ).slice(0, 120);
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-cron-secret');
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!authorizeCron(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const redis = getRedisClient();
  if (!redis) {
    return res.status(500).json({
      success: false,
      error: 'Redis is required for community bot cron (missing or invalid Upstash credentials).',
    });
  }

  const executionId = buildExecutionId(req);
  const runtimeState = { localClaudeCalls: 0 };

  const et = getEtClockParts(new Date());
  if (!et.inPostingWindow) {
    return res.status(200).json({
      success: true,
      skipped: true,
      reason: 'outside-posting-window',
      nowEt: et.nowEt,
    });
  }

  try {
    const bots = await resolveBotUsers();
    const botUserIds = bots.map((bot) => bot.user_id).filter(Boolean);

    const marketResult = await loadMarketContext({
      redis,
      executionId,
      state: runtimeState,
      hourKey: et.hourKey,
    });
    const marketContext = marketResult.context;

    const highVolatility = isHighVolatility(marketContext);
    const postProbability = highVolatility ? 0.74 : 0.66;
    const shouldAttemptPosting = Math.random() < postProbability;

    let targetPostCount = 0;
    if (shouldAttemptPosting) {
      const roll = Math.random();
      if (highVolatility) {
        targetPostCount = roll < 0.52 ? 1 : roll < 0.97 ? 2 : 0;
      } else {
        targetPostCount = roll < 0.7 ? 1 : roll < 0.95 ? 2 : 0;
      }
    }

    const lastPostMap = await getPersonaLastPostMap(redis, bots);
    const lastPoster = redis ? String((await redis.get(LAST_POSTER_KEY)) || '') : '';
    const lastTopic = redis ? String((await redis.get(LAST_TOPIC_KEY)) || '') : '';

    const eligiblePostPersonas = getEligiblePersonasForPosting({
      personas: bots,
      lastPostMap,
      nowMs: Date.now(),
      lastPoster,
    });

    const selectedPostPersonas = shuffle(eligiblePostPersonas).slice(0, targetPostCount);

    const generatedPosts = await generateTopLevelPosts({
      redis,
      executionId,
      state: runtimeState,
      marketContext,
      personas: selectedPostPersonas,
      targetPostCount: selectedPostPersonas.length,
      lastTopic,
    });

    const postRows = generatedPosts.map((draft) => buildTopLevelPostRow(draft, new Date().toISOString()));
    const insertedPosts = await insertCommunityPosts(postRows);

    const postedHandles = generatedPosts.map((row) => row.persona.handle);
    generatedPosts.forEach((row) => {
      lastPostMap[row.persona.handle] = Date.now();
    });
    if (redis && generatedPosts.length > 0) {
      const newest = generatedPosts[generatedPosts.length - 1];
      if (newest?.handle) {
        await redis.set(LAST_POSTER_KEY, newest.handle, { ex: 24 * 60 * 60 });
      }
      if (newest?.topicSignature) {
        await redis.set(LAST_TOPIC_KEY, newest.topicSignature, { ex: 24 * 60 * 60 });
      }
    }

    const recentTopLevelPosts = await fetchRecentTopLevelPosts(10);

    const replyCandidatesSource = recentTopLevelPosts.slice(0, 5);
    const repliedParentIds = await fetchParentIdsWithReplies(replyCandidatesSource.map((post) => post.id));
    const unrepliedPosts = replyCandidatesSource.filter((post) => {
      const commentsCount = Number(post?.comments_count || 0);
      if (commentsCount > 0) return false;
      return !repliedParentIds.has(post.id);
    });

    const replyTargetCount = Math.random() < 0.62 ? randomInt(1, 2) : 0;
    const replyRows = [];
    const replyDrafts = [];

    for (const post of shuffle(unrepliedPosts)) {
      if (replyDrafts.length >= replyTargetCount) break;

      const shouldReply = await shouldReplyThisCycle(redis, post.id);
      if (!shouldReply) continue;

      const originalHandle = String(post.author_name || '').trim();
      const eligibleReplyPersonas = bots.filter((persona) => {
        if (persona.user_id === post.user_id) return false;
        if (originalHandle && persona.handle === originalHandle) return false;

        const lastPostedAt = Number(lastPostMap[persona.handle] || 0);
        return !lastPostedAt || Date.now() - lastPostedAt >= PERSONA_MIN_POST_GAP_MS;
      });

      if (eligibleReplyPersonas.length === 0) continue;

      const replyPersona = shuffle(eligibleReplyPersonas)[0];

      try {
        const generatedReply = await generateReplyForPost({
          redis,
          executionId,
          state: runtimeState,
          post,
          persona: replyPersona,
        });

        if (!generatedReply) continue;

        replyDrafts.push(generatedReply);
        replyRows.push(buildReplyRow(generatedReply, post.id, new Date().toISOString()));

        lastPostMap[replyPersona.handle] = Date.now();
      } catch (error) {
        console.error('[cron/community-bot] reply generation failed:', error?.message || error);
      }
    }

    const insertedReplies = await insertCommunityPosts(replyRows);

    const likedPostsPool = recentTopLevelPosts.slice(0, 10);
    const likeRows = [];

    if (likedPostsPool.length > 0 && botUserIds.length > 0) {
      const likeStateByPost = await fetchBotLikeStateByPost(likedPostsPool.map((post) => post.id), botUserIds);

      for (const post of likedPostsPool) {
        if (Math.random() > 0.65) continue;

        const dbLikedSet = likeStateByPost.get(post.id) || new Set();
        const redisLikedSet = await loadRedisLikeSet(redis, post.id);

        const availableLikers = bots.filter((persona) => {
          if (!persona.user_id) return false;
          if (persona.user_id === post.user_id) return false;
          if (dbLikedSet.has(persona.user_id)) return false;
          if (redisLikedSet.has(String(persona.user_id))) return false;
          return true;
        });

        if (availableLikers.length === 0) continue;

        const likeCountForPost = randomInt(1, Math.min(3, availableLikers.length));
        const chosenLikers = shuffle(availableLikers).slice(0, likeCountForPost);

        chosenLikers.forEach((persona) => {
          likeRows.push({
            user_id: persona.user_id,
            post_id: post.id,
          });

          dbLikedSet.add(persona.user_id);
          redisLikedSet.add(String(persona.user_id));
        });
      }
    }

    const insertedLikes = await insertLikes(likeRows);
    await persistRedisLikeSets(redis, insertedLikes);

    const allPostedHandles = [...postedHandles, ...replyDrafts.map((row) => row.persona.handle)];
    await persistPersonaPostState(redis, allPostedHandles, Date.now());

    return res.status(200).json({
      success: true,
      nowEt: et.nowEt,
      marketContextFromCache: marketResult.fromCache,
      highVolatility,
      postProbability,
      totals: {
        generated_posts: generatedPosts.length,
        inserted_posts: insertedPosts.length,
        generated_replies: replyDrafts.length,
        inserted_replies: insertedReplies.length,
        inserted_likes: insertedLikes.length,
      },
      personas_posted: [...new Set(postedHandles)],
      claude_calls: runtimeState.localClaudeCalls,
      execution_id: executionId,
    });
  } catch (error) {
    console.error('[cron/community-bot] failed:', error);
    return res.status(500).json({
      success: false,
      error: String(error?.message || 'Unexpected community bot failure'),
      execution_id: executionId,
    });
  }
}
