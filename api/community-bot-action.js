import { supabase } from './lib/supabase.js';
import {
  BOT_PROFILES,
  postAsBots,
  likeRandomPosts,
  commentOnPosts,
} from '../server/src/services/communityBots.js';

const BOT_EMAIL_DOMAIN = process.env.COMMUNITY_BOT_EMAIL_DOMAIN || 'bots.stratify.local';
const BOT_CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_AUTH_USER_PAGES = 50;
const AUTH_USERS_PER_PAGE = 1000;

let botCache = {
  resolvedBots: null,
  expiresAt: 0,
};

const normalizeEmail = (value = '') => String(value).trim().toLowerCase();
const buildBotEmail = (bot) => `${bot.id}@${BOT_EMAIL_DOMAIN}`;
const buildBotPassword = (bot) => `StratifyBot!${bot.id}#2026`;

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

    const users = data?.users || [];
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
  if (botCache.resolvedBots && botCache.expiresAt > now) {
    return botCache.resolvedBots;
  }

  let usersByEmail = await listUsersByEmail();
  const resolved = [];

  for (const bot of BOT_PROFILES) {
    const email = buildBotEmail(bot);
    const normalizedEmail = normalizeEmail(email);
    let userId = usersByEmail.get(normalizedEmail);

    if (!userId) {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password: buildBotPassword(bot),
        email_confirm: true,
        user_metadata: {
          full_name: bot.name,
          avatar_url: bot.avatar_url,
          is_community_bot: true,
        },
        app_metadata: {
          is_community_bot: true,
        },
      });

      if (error) {
        const message = String(error.message || '').toLowerCase();
        if (message.includes('already') || message.includes('registered') || message.includes('exists')) {
          usersByEmail = await listUsersByEmail();
          userId = usersByEmail.get(normalizedEmail);
        } else {
          throw new Error(`Failed to create bot user ${bot.name}: ${error.message}`);
        }
      } else {
        userId = data?.user?.id;
        if (userId) {
          usersByEmail.set(normalizedEmail, userId);
        }
      }
    }

    if (!userId) {
      throw new Error(`Could not resolve auth user_id for bot ${bot.name}`);
    }

    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        id: userId,
        display_name: bot.name,
        avatar_url: bot.avatar_url,
      },
      { onConflict: 'id' }
    );

    if (profileError) {
      // Keep going; author_name on posts still guarantees visible names in feed/replies.
      console.warn(`[community-bot-action] profile upsert skipped for ${bot.name}:`, profileError.message);
    }

    resolved.push({
      ...bot,
      id: userId,
      user_id: userId,
      email,
    });
  }

  botCache = {
    resolvedBots: resolved,
    expiresAt: now + BOT_CACHE_TTL_MS,
  };

  return resolved;
}

async function fetchRecentTopLevelPosts(limit = 80) {
  const { data, error } = await supabase
    .from('community_posts')
    .select('id, user_id, content, ticker_mentions, parent_id, parent_post_id, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch recent posts: ${error.message}`);
  }

  return (data || []).filter((post) => !post.parent_id && !post.parent_post_id);
}

async function insertBotPosts(postDrafts = []) {
  if (postDrafts.length === 0) return [];

  const rows = postDrafts.map((draft) => ({
    user_id: draft.bot.id,
    author_name: draft.bot.name,
    content: draft.content,
    ticker_mentions: draft.ticker_mentions || [],
    post_type: draft.post_type || 'post',
    metadata: {
      ...(draft.metadata || {}),
      source: 'community_bot',
      bot_id: draft.bot.id,
      bot_name: draft.bot.name,
      bot_avatar_url: draft.bot.avatar_url,
    },
  }));

  const { data, error } = await supabase
    .from('community_posts')
    .insert(rows)
    .select('id, user_id, content, ticker_mentions, parent_id, parent_post_id, created_at');

  if (error) {
    throw new Error(`Failed to insert bot posts: ${error.message}`);
  }

  return data || [];
}

async function insertBotLikes(likeActions = []) {
  if (likeActions.length === 0) return [];

  const rows = likeActions.map((action) => ({
    user_id: action.bot.id,
    post_id: action.post_id,
  }));

  const { data, error } = await supabase
    .from('community_likes')
    .upsert(rows, { onConflict: 'user_id,post_id', ignoreDuplicates: true })
    .select('id, user_id, post_id');

  if (error) {
    throw new Error(`Failed to insert bot likes: ${error.message}`);
  }

  return data || [];
}

async function insertBotComments(commentActions = []) {
  if (commentActions.length === 0) return [];

  const rows = commentActions.map((action) => ({
    user_id: action.bot.id,
    author_name: action.bot.name,
    parent_id: action.parent_post_id,
    parent_post_id: action.parent_post_id,
    content: action.content,
    ticker_mentions: action.ticker_mentions || [],
    post_type: 'post',
    metadata: {
      source: 'community_bot',
      is_reply: true,
      bot_id: action.bot.id,
      bot_name: action.bot.name,
      bot_avatar_url: action.bot.avatar_url,
    },
  }));

  const { data, error } = await supabase
    .from('community_posts')
    .insert(rows)
    .select('id, user_id, parent_id, parent_post_id, content, created_at');

  if (error) {
    throw new Error(`Failed to insert bot comments: ${error.message}`);
  }

  return data || [];
}

function authorizeCron(req) {
  if (!process.env.CRON_SECRET) return true;

  const authHeader = req.headers.authorization;
  const xCronSecret = req.headers['x-cron-secret'];
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  return authHeader === expected || xCronSecret === process.env.CRON_SECRET;
}

export default async function handler(req, res) {
  // OpenClaw target: POST /api/community-bot-action every 30 minutes.
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-cron-secret');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  if (!authorizeCron(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const bots = await resolveBotUsers();
    const postDrafts = postAsBots({ bots, minBots: 1, maxBots: 3 });
    const insertedPosts = await insertBotPosts(postDrafts);

    const recentTopLevelPosts = await fetchRecentTopLevelPosts(80);
    const likeActions = likeRandomPosts(recentTopLevelPosts, { bots, maxLikes: 12 });
    const insertedLikes = await insertBotLikes(likeActions);

    const commentActions = commentOnPosts(recentTopLevelPosts, { bots, maxComments: 4 });
    const insertedComments = await insertBotComments(commentActions);

    return res.status(200).json({
      success: true,
      openclaw_schedule: 'POST /api/community-bot-action every 30 minutes',
      totals: {
        posts: insertedPosts.length,
        likes: insertedLikes.length,
        comments: insertedComments.length,
      },
      bots_used: [...new Set(postDrafts.map((draft) => draft.bot.name))],
    });
  } catch (error) {
    console.error('[community-bot-action] failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unexpected bot action failure',
    });
  }
}
