import { Redis } from '@upstash/redis';

const PRO_STATUS_SET = new Set(['pro', 'elite', 'active', 'trialing', 'paid']);
const MONTH_SECONDS = 31 * 24 * 60 * 60;

export const PRO_PLUS_PLAN_NAME = 'PRO PLUS PLAN';
export const PRO_PLUS_MONTHLY_PRICE = 39.99;
export const SOPHIA_USAGE_LIMIT_USD = Number(process.env.SOPHIA_USAGE_LIMIT_USD || 15);
export const PAPER_BUY_NOTIONAL_LIMIT_USD = Number(process.env.PAPER_BUY_NOTIONAL_LIMIT_USD || 300000);

export const PRO_PLUS_FEATURES = [
  'Live breaking news feed (MARKETAUX_API_KEY)',
  'Live stock, crypto, and index tickers from Twelve Data WebSocket',
  'Unlimited Sophia AI chat and strategy builds (Anthropic)',
  'Unlimited paper trading beyond the $300,000 simulation cap',
];

const normalizeStatus = (value) => String(value || '').trim().toLowerCase();

const toFixedMoney = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100) / 100;
};

const resolveSophiaCycleKey = () => {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const getRedisClient = () => {
  const url = String(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').trim();
  const token = String(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();
  if (!url || !token) return null;
  return new Redis({ url, token });
};

export const isPaidStatus = (status) => PRO_STATUS_SET.has(normalizeStatus(status));

export const getSubscriptionStatus = async (supabase, userId) => {
  const id = String(userId || '').trim();
  if (!supabase || !id) return 'free';
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('subscription_status')
      .eq('id', id)
      .single();
    if (error) return 'free';
    return normalizeStatus(data?.subscription_status) || 'free';
  } catch {
    return 'free';
  }
};

export const buildProPlusRequiredPayload = ({
  reason = 'limit_reached',
  message = 'Upgrade to PRO PLUS PLAN to continue.',
  usage = null,
} = {}) => ({
  code: 'PRO_PLUS_PLAN_REQUIRED',
  reason,
  message,
  plan: {
    name: PRO_PLUS_PLAN_NAME,
    monthly_price: PRO_PLUS_MONTHLY_PRICE,
    label: `$${PRO_PLUS_MONTHLY_PRICE.toFixed(2)}/month`,
    features: PRO_PLUS_FEATURES,
  },
  usage,
});

export const resolveSophiaActorKey = ({ userId, req }) => {
  const normalizedUserId = String(userId || '').trim();
  if (normalizedUserId) return `user:${normalizedUserId}`;
  const forwardedFor = String(req?.headers?.['x-forwarded-for'] || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)[0];
  const ip = forwardedFor || String(req?.socket?.remoteAddress || '').trim() || 'guest';
  return `ip:${ip}`;
};

export const getSophiaUsageUsd = async (redis, actorKey) => {
  if (!redis || !actorKey) return 0;
  const key = `limits:sophia:usd:${actorKey}:${resolveSophiaCycleKey()}`;
  const raw = await redis.get(key);
  return toFixedMoney(raw);
};

export const incrementSophiaUsageUsd = async (redis, actorKey, amountUsd) => {
  if (!redis || !actorKey) return 0;
  const safeAmount = Math.max(0, Number(amountUsd) || 0);
  const key = `limits:sophia:usd:${actorKey}:${resolveSophiaCycleKey()}`;
  const value = await redis.incrbyfloat(key, safeAmount);
  try {
    await redis.expire(key, MONTH_SECONDS);
  } catch {
    // ignore TTL write failures
  }
  return toFixedMoney(value);
};

export const estimateSophiaCostUsd = ({
  messages = [],
  responseText = '',
  strategyMode = false,
} = {}) => {
  const inputChars = (Array.isArray(messages) ? messages : [])
    .reduce((sum, message) => sum + String(message?.content || '').length, 0);
  const outputChars = String(responseText || '').length;
  const inputTokens = Math.max(1, Math.round(inputChars / 4));
  const outputTokens = Math.max(1, Math.round(outputChars / 4));
  const inputRatePerMillion = Number(process.env.SOPHIA_INPUT_RATE_PER_MILLION || 3);
  const outputRatePerMillion = Number(process.env.SOPHIA_OUTPUT_RATE_PER_MILLION || 15);
  const base = ((inputTokens * inputRatePerMillion) + (outputTokens * outputRatePerMillion)) / 1_000_000;
  const minimum = strategyMode ? 0.08 : 0.03;
  return toFixedMoney(Math.max(base, minimum));
};

export const getPaperBuyNotionalUsageUsd = async (redis, userId) => {
  const normalizedUserId = String(userId || '').trim();
  if (!redis || !normalizedUserId) return 0;
  const raw = await redis.get(`limits:paper:buy-notional:${normalizedUserId}`);
  return toFixedMoney(raw);
};

export const incrementPaperBuyNotionalUsageUsd = async (redis, userId, amountUsd) => {
  const normalizedUserId = String(userId || '').trim();
  if (!redis || !normalizedUserId) return 0;
  const safeAmount = Math.max(0, Number(amountUsd) || 0);
  const value = await redis.incrbyfloat(`limits:paper:buy-notional:${normalizedUserId}`, safeAmount);
  return toFixedMoney(value);
};

export const buildPaperUsageSnapshot = (totalBuyNotionalUsd) => {
  const used = Math.max(0, Number(totalBuyNotionalUsd) || 0);
  const cyclesCompleted = Math.floor(used / 100000);
  const remaining = Math.max(0, PAPER_BUY_NOTIONAL_LIMIT_USD - used);
  return {
    used_usd: toFixedMoney(used),
    limit_usd: PAPER_BUY_NOTIONAL_LIMIT_USD,
    remaining_usd: toFixedMoney(remaining),
    cycles_completed: cyclesCompleted,
    max_cycles: 3,
  };
};
