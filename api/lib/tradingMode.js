import { supabase } from './supabase.js';

export const PAPER_TRADING_MODE = 'paper';
export const LIVE_TRADING_MODE = 'live';
export const VALID_TRADING_MODES = new Set([PAPER_TRADING_MODE, LIVE_TRADING_MODE]);

const DEFAULT_PAPER_ACCOUNT = {
  equity: 100000,
  cash: 100000,
  buying_power: 100000,
  last_equity: 100000,
  portfolio_value: 100000,
  status: 'simulated',
  currency: 'USD',
};

const DEFAULT_LIVE_ACCOUNT = {
  equity: 0,
  cash: 0,
  buying_power: 0,
  last_equity: 0,
  portfolio_value: 0,
  status: 'not_connected',
  currency: 'USD',
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asObject = (value) => (value && typeof value === 'object' ? value : {});

export const normalizeTradingMode = (value, fallback = PAPER_TRADING_MODE) => {
  const normalized = String(value || '').trim().toLowerCase();
  return VALID_TRADING_MODES.has(normalized) ? normalized : fallback;
};

export const getTradingModeFromRequest = (req, fallback = PAPER_TRADING_MODE) => {
  const headerMode = req?.headers?.['x-trading-mode'];
  const queryMode = req?.query?.mode;
  const bodyMode = req?.body?.trading_mode || req?.body?.mode;
  return normalizeTradingMode(headerMode || queryMode || bodyMode, fallback);
};

export const getUserFromToken = async (req) => {
  const auth = req?.headers?.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
};

export const getProfileForTrading = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select([
      'id',
      'trading_mode',
      'subscription_status',
      'paper_positions',
      'live_positions',
      'paper_account',
      'live_account',
      'paper_trade_history',
      'live_trade_history',
      'user_state',
      'updated_at',
    ].join(','))
    .eq('id', userId)
    .maybeSingle();

  return { data, error };
};

export const getModeColumns = (mode) => (
  mode === LIVE_TRADING_MODE
    ? {
        mode: LIVE_TRADING_MODE,
        positions: 'live_positions',
        account: 'live_account',
        tradeHistory: 'live_trade_history',
      }
    : {
        mode: PAPER_TRADING_MODE,
        positions: 'paper_positions',
        account: 'paper_account',
        tradeHistory: 'paper_trade_history',
      }
);

export const normalizeAccountForMode = (accountValue, mode) => {
  const defaults = mode === LIVE_TRADING_MODE ? DEFAULT_LIVE_ACCOUNT : DEFAULT_PAPER_ACCOUNT;
  const candidate = asObject(accountValue);

  return {
    ...defaults,
    ...candidate,
    equity: toNumber(candidate.equity ?? candidate.portfolio_value, defaults.equity),
    cash: toNumber(candidate.cash, defaults.cash),
    buying_power: toNumber(candidate.buying_power, defaults.buying_power),
    last_equity: toNumber(candidate.last_equity, defaults.last_equity),
    portfolio_value: toNumber(candidate.portfolio_value ?? candidate.equity, defaults.portfolio_value),
    mode,
  };
};

export const normalizePositionsForMode = (positionsValue) => {
  if (!Array.isArray(positionsValue)) return [];
  return positionsValue
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const symbol = String(item.symbol || item.ticker || '').trim().toUpperCase();
      const qty = toNumber(item.qty ?? item.shares ?? item.quantity, 0);
      const avgEntry = toNumber(item.avg_entry_price ?? item.avgCost ?? item.avgEntryPrice, 0);
      const currentPrice = toNumber(item.current_price ?? item.currentPrice ?? item.price ?? avgEntry, avgEntry);
      const marketValue = toNumber(item.market_value ?? qty * currentPrice, qty * currentPrice);
      const costBasis = toNumber(item.cost_basis ?? qty * avgEntry, qty * avgEntry);
      const unrealized = toNumber(item.unrealized_pl ?? marketValue - costBasis, marketValue - costBasis);
      const unrealizedPc = costBasis > 0 ? unrealized / costBasis : 0;
      return {
        ...item,
        symbol,
        qty,
        shares: qty,
        avg_entry_price: avgEntry,
        avgCost: avgEntry,
        current_price: currentPrice,
        currentPrice,
        market_value: marketValue,
        marketValue,
        cost_basis: costBasis,
        unrealized_pl: unrealized,
        unrealized_plpc: toNumber(item.unrealized_plpc, unrealizedPc),
      };
    })
    .filter((item) => item.symbol && item.qty > 0);
};

export const normalizeTradeHistoryForMode = (historyValue) => {
  if (!Array.isArray(historyValue)) return [];
  return historyValue
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const timestamp = item.timestamp || item.filled_at || item.submitted_at || new Date().toISOString();
      const symbol = String(item.symbol || '').trim().toUpperCase();
      const side = String(item.side || '').toLowerCase() === 'sell' ? 'sell' : 'buy';
      const shares = toNumber(item.shares ?? item.qty ?? item.quantity, 0);
      const price = toNumber(item.price ?? item.filled_avg_price ?? item.avg_price, 0);
      const total = toNumber(item.total ?? shares * price, shares * price);
      return {
        ...item,
        symbol,
        side,
        shares,
        qty: shares,
        price,
        total,
        timestamp,
      };
    })
    .filter((item) => item.symbol && item.shares > 0);
};

export const upsertModeProfileData = async (userId, mode, payload = {}) => {
  const columns = getModeColumns(mode);
  const updatePayload = {
    updated_at: new Date().toISOString(),
  };

  if (Object.hasOwn(payload, 'account')) {
    updatePayload[columns.account] = payload.account;
  }
  if (Object.hasOwn(payload, 'positions')) {
    updatePayload[columns.positions] = payload.positions;
  }
  if (Object.hasOwn(payload, 'tradeHistory')) {
    updatePayload[columns.tradeHistory] = payload.tradeHistory;
  }
  if (Object.hasOwn(payload, 'tradingMode')) {
    updatePayload.trading_mode = normalizeTradingMode(payload.tradingMode, mode);
  }
  if (Object.hasOwn(payload, 'userState')) {
    updatePayload.user_state = payload.userState;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('id', userId)
    .select('*')
    .maybeSingle();

  return { data, error };
};

const parseLegacyJsonKeys = (value) => {
  const candidate = asObject(value);
  const apiKey = String(
    candidate.api_key
    || candidate.apiKey
    || candidate.key
    || '',
  ).trim();
  const apiSecret = String(
    candidate.api_secret
    || candidate.apiSecret
    || candidate.secret
    || '',
  ).trim();

  return {
    apiKey: apiKey || null,
    apiSecret: apiSecret || null,
  };
};

export const resolveAlpacaCredentialsForMode = (connection, mode) => {
  if (!connection || typeof connection !== 'object') {
    return {
      apiKey: null,
      apiSecret: null,
      baseUrl: mode === LIVE_TRADING_MODE ? 'https://api.alpaca.markets' : 'https://paper-api.alpaca.markets',
      mode,
    };
  }

  const paperJson = parseLegacyJsonKeys(connection.paper_api_keys);
  const liveJson = parseLegacyJsonKeys(connection.live_api_keys);
  const legacyKey = String(connection.api_key || '').trim() || null;
  const legacySecret = String(connection.api_secret || '').trim() || null;

  const paperKey = String(connection.paper_api_key || '').trim() || paperJson.apiKey;
  const paperSecret = String(connection.paper_api_secret || '').trim() || paperJson.apiSecret;
  const liveKey = String(connection.live_api_key || '').trim() || liveJson.apiKey;
  const liveSecret = String(connection.live_api_secret || '').trim() || liveJson.apiSecret;

  if (mode === LIVE_TRADING_MODE) {
    const fallbackKey = connection.is_paper === false ? legacyKey : null;
    const fallbackSecret = connection.is_paper === false ? legacySecret : null;
    return {
      apiKey: liveKey || fallbackKey || null,
      apiSecret: liveSecret || fallbackSecret || null,
      baseUrl: 'https://api.alpaca.markets',
      mode: LIVE_TRADING_MODE,
    };
  }

  const fallbackKey = connection.is_paper !== false ? legacyKey : null;
  const fallbackSecret = connection.is_paper !== false ? legacySecret : null;
  return {
    apiKey: paperKey || fallbackKey || null,
    apiSecret: paperSecret || fallbackSecret || null,
    baseUrl: 'https://paper-api.alpaca.markets',
    mode: PAPER_TRADING_MODE,
  };
};

export const appendTradeHistoryEntry = (history, trade, maxEntries = 500) => {
  const normalizedHistory = normalizeTradeHistoryForMode(history);
  const normalizedTradeList = normalizeTradeHistoryForMode([trade]);
  if (normalizedTradeList.length === 0) return normalizedHistory;

  const nextTrade = normalizedTradeList[0];
  const alreadyExists = normalizedHistory.some((entry) => (
    (entry.id && nextTrade.id && entry.id === nextTrade.id)
    || (
      entry.symbol === nextTrade.symbol
      && entry.side === nextTrade.side
      && Number(entry.shares) === Number(nextTrade.shares)
      && Number(entry.price) === Number(nextTrade.price)
      && String(entry.timestamp) === String(nextTrade.timestamp)
    )
  ));

  if (alreadyExists) return normalizedHistory;

  const next = [...normalizedHistory, nextTrade];
  return next.slice(Math.max(0, next.length - maxEntries));
};

export const readModeDataFromProfile = (profile, mode) => {
  const columns = getModeColumns(mode);
  const account = normalizeAccountForMode(profile?.[columns.account], mode);
  const positions = normalizePositionsForMode(profile?.[columns.positions]);
  const tradeHistory = normalizeTradeHistoryForMode(profile?.[columns.tradeHistory]);
  return { account, positions, tradeHistory };
};

export const isProSubscription = (subscriptionStatus) => {
  const normalized = String(subscriptionStatus || '').toLowerCase();
  return normalized === 'pro' || normalized === 'elite';
};
