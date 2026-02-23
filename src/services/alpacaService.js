import { supabase } from '../lib/supabaseClient';

const PAPER_MODE = 'paper';
const LIVE_MODE = 'live';
const DEFAULT_MODE = PAPER_MODE;
const CACHE_TTL_MS = 5000;
const responseCache = new Map();

const normalizeMode = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === LIVE_MODE ? LIVE_MODE : PAPER_MODE;
};

const cacheKeyFor = (mode, key) => `${normalizeMode(mode)}:${key}`;

const now = () => Date.now();

const readCache = (key) => {
  const cached = responseCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= now()) {
    responseCache.delete(key);
    return null;
  }
  return cached.value;
};

const writeCache = (key, value, ttlMs = CACHE_TTL_MS) => {
  responseCache.set(key, {
    value,
    expiresAt: now() + ttlMs,
  });
};

const buildUrlWithMode = (baseUrl, mode) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  const target = new URL(baseUrl, origin);
  target.searchParams.set('mode', normalizeMode(mode));
  return `${target.pathname}${target.search}`;
};

const buildAuthHeaders = async (mode, includeJson = false) => {
  const headers = {
    'X-Trading-Mode': normalizeMode(mode),
  };

  if (includeJson) {
    headers['Content-Type'] = 'application/json';
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  return headers;
};

const parseResponse = async (response) => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error || payload?.message || 'Request failed');
    error.status = response.status;
    error.detail = payload;
    throw error;
  }
  return payload;
};

const requestWithCache = async ({
  path,
  mode,
  method = 'GET',
  body,
  cacheKey,
  forceFresh = false,
  ttlMs = CACHE_TTL_MS,
}) => {
  const normalizedMode = normalizeMode(mode);
  const key = cacheKey ? cacheKeyFor(normalizedMode, cacheKey) : null;

  if (!forceFresh && method === 'GET' && key) {
    const cached = readCache(key);
    if (cached !== null) return cached;
  }

  const headers = await buildAuthHeaders(normalizedMode, method !== 'GET');
  const response = await fetch(buildUrlWithMode(path, normalizedMode), {
    method,
    headers,
    body: method === 'GET' ? undefined : JSON.stringify(body || {}),
  });
  const payload = await parseResponse(response);

  if (method === 'GET' && key) {
    writeCache(key, payload, ttlMs);
  }

  return payload;
};

export const clearAlpacaCache = () => {
  responseCache.clear();
};

export const fetchAccount = async ({ mode = DEFAULT_MODE, forceFresh = false } = {}) => {
  return requestWithCache({
    path: '/api/account',
    mode,
    method: 'GET',
    cacheKey: 'account',
    forceFresh,
  });
};

export const fetchPositions = async ({ mode = DEFAULT_MODE, forceFresh = false } = {}) => {
  const payload = await requestWithCache({
    path: '/api/positions',
    mode,
    method: 'GET',
    cacheKey: 'positions',
    forceFresh,
  });
  return Array.isArray(payload) ? payload : (Array.isArray(payload?.positions) ? payload.positions : []);
};

export const fetchOrders = async ({
  mode = DEFAULT_MODE,
  status = 'all',
  direction = 'desc',
  limit = 200,
  forceFresh = false,
} = {}) => {
  const path = `/api/orders?status=${encodeURIComponent(status)}&direction=${encodeURIComponent(direction)}&limit=${encodeURIComponent(limit)}`;
  return requestWithCache({
    path,
    mode,
    method: 'GET',
    cacheKey: `orders:${status}:${direction}:${limit}`,
    forceFresh,
  });
};

export const placeOrder = async (orderPayload, { mode = DEFAULT_MODE } = {}) => {
  const payload = await requestWithCache({
    path: '/api/orders',
    mode,
    method: 'POST',
    body: {
      ...orderPayload,
      trading_mode: normalizeMode(mode),
    },
    cacheKey: null,
    forceFresh: true,
  });

  // Trading updates make any cached account/positions stale.
  clearAlpacaCache();
  return payload;
};

export const tradingModes = {
  PAPER: PAPER_MODE,
  LIVE: LIVE_MODE,
};
