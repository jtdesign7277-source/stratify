import { supabase } from './lib/supabase.js';
import {
  appendTradeHistoryEntry,
  getProfileForTrading,
  getTradingModeFromRequest,
  getUserFromToken,
  normalizeTradingMode,
  readModeDataFromProfile,
  resolveAlpacaCredentialsForMode,
  upsertModeProfileData,
} from './lib/tradingMode.js';

const CRYPTO_SYMBOL_REGEX =
  /^(BTC|ETH|SOL|XRP|DOGE|LINK|ADA|AVAX|DOT|MATIC|UNI|ATOM|LTC|BCH|XLM|ALGO|VET|FIL|AAVE|SAND|MANA|CRO|SHIB)(USD|USDT|EUR|GBP)$/;

const toNumber = (value, fallback = NaN) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const round2 = (value) => Math.round((toNumber(value, 0) + Number.EPSILON) * 100) / 100;
const round6 = (value) => Math.round((toNumber(value, 0) + Number.EPSILON) * 1e6) / 1e6;

const normalizeSymbol = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');

const calculatePriceFallback = (inputOrder, parsedQty, parsedNotional) => {
  const limit = toNumber(inputOrder.limit_price);
  const stop = toNumber(inputOrder.stop_price);
  const provided = toNumber(inputOrder.price ?? inputOrder.market_price ?? inputOrder.reference_price);
  if (Number.isFinite(provided) && provided > 0) return provided;
  if (Number.isFinite(limit) && limit > 0) return limit;
  if (Number.isFinite(stop) && stop > 0) return stop;
  if (parsedQty > 0 && parsedNotional > 0) return parsedNotional / parsedQty;
  return NaN;
};

const normalizePositions = (positionsValue) => {
  if (!Array.isArray(positionsValue)) return [];
  return positionsValue
    .map((position) => {
      const symbol = normalizeSymbol(position.symbol || position.ticker);
      const qty = round6(position.qty ?? position.shares ?? position.quantity);
      const avgEntry = toNumber(position.avg_entry_price ?? position.avgCost ?? position.avgEntryPrice, 0);
      const currentPrice = toNumber(position.current_price ?? position.currentPrice ?? position.price ?? avgEntry, avgEntry);
      if (!symbol || qty <= 0) return null;
      const marketValue = round2(toNumber(position.market_value ?? qty * currentPrice, qty * currentPrice));
      const costBasis = round2(toNumber(position.cost_basis ?? qty * avgEntry, qty * avgEntry));
      const unrealized = round2(toNumber(position.unrealized_pl ?? marketValue - costBasis, marketValue - costBasis));
      return {
        ...position,
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
        unrealized_plpc: costBasis > 0 ? unrealized / costBasis : 0,
      };
    })
    .filter(Boolean);
};

const normalizeAccount = (accountValue, fallback = 100000) => {
  const candidate = accountValue && typeof accountValue === 'object' ? accountValue : {};
  const cash = toNumber(candidate.cash, fallback);
  const buyingPower = toNumber(candidate.buying_power ?? candidate.buyingPower, cash);
  const equity = toNumber(candidate.equity ?? candidate.portfolio_value, cash);
  const lastEquity = toNumber(candidate.last_equity, equity);
  return {
    ...candidate,
    cash: round2(cash),
    buying_power: round2(buyingPower),
    equity: round2(equity),
    portfolio_value: round2(toNumber(candidate.portfolio_value, equity)),
    last_equity: round2(lastEquity),
    daily_pnl: round2(toNumber(candidate.daily_pnl, equity - lastEquity)),
    mode: 'paper',
  };
};

const parseOrderRequest = (body = {}) => {
  const symbol = normalizeSymbol(body.symbol);
  const side = String(body.side || '').trim().toLowerCase();
  const type = String(body.type || '').trim().toLowerCase();
  const timeInForce = String(body.time_in_force || '').trim().toLowerCase();
  const parsedQty = toNumber(body.qty);
  const parsedNotional = toNumber(body.notional);
  const strategyName = typeof body.strategy_name === 'string'
    ? body.strategy_name.trim()
    : typeof body.strategyName === 'string'
      ? body.strategyName.trim()
      : typeof body.strategy === 'string'
        ? body.strategy.trim()
        : '';
  const strategyId = typeof body.strategy_id === 'string'
    ? body.strategy_id.trim()
    : typeof body.strategyId === 'string'
      ? body.strategyId.trim()
      : '';

  if (!symbol || !side || !type || !timeInForce || (!Number.isFinite(parsedQty) && !Number.isFinite(parsedNotional))) {
    return {
      ok: false,
      error: 'Missing required fields: symbol, side, type, time_in_force, and qty or notional',
    };
  }

  if (!['buy', 'sell'].includes(side)) {
    return { ok: false, error: 'Side must be buy or sell' };
  }

  const order = {
    symbol,
    side,
    type,
    time_in_force: timeInForce,
  };

  if (Number.isFinite(parsedQty) && parsedQty > 0) {
    order.qty = String(parsedQty);
  } else if (Number.isFinite(parsedNotional) && parsedNotional > 0) {
    order.notional = String(parsedNotional);
  } else {
    return { ok: false, error: 'qty or notional must be a positive number' };
  }

  const optionalFields = ['limit_price', 'stop_price', 'trail_price', 'trail_percent'];
  optionalFields.forEach((field) => {
    const value = body[field];
    if (value !== undefined && value !== null && value !== '') {
      order[field] = String(value);
    }
  });

  return {
    ok: true,
    order,
    parsedQty: Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : null,
    parsedNotional: Number.isFinite(parsedNotional) && parsedNotional > 0 ? parsedNotional : null,
    strategyName,
    strategyId,
  };
};

const applyPaperTradeToState = ({ account, positions, side, symbol, quantity, price }) => {
  const nextPositions = normalizePositions(positions).map((position) => ({ ...position }));
  const accountState = normalizeAccount(account);

  const positionIndex = nextPositions.findIndex((position) => position.symbol === symbol);
  const existing = positionIndex >= 0 ? nextPositions[positionIndex] : null;
  const existingQty = toNumber(existing?.qty, 0);
  const existingAvg = toNumber(existing?.avg_entry_price ?? existing?.avgCost, 0);

  const tradeValue = round2(quantity * price);
  let nextCash = toNumber(accountState.cash, 100000);

  if (side === 'buy') {
    const totalQty = existingQty + quantity;
    const weightedAvg = totalQty > 0
      ? ((existingQty * existingAvg) + (quantity * price)) / totalQty
      : price;

    const nextPosition = {
      ...(existing || {}),
      symbol,
      qty: round6(totalQty),
      shares: round6(totalQty),
      avg_entry_price: round2(weightedAvg),
      avgCost: round2(weightedAvg),
      current_price: round2(price),
      currentPrice: round2(price),
    };

    if (positionIndex >= 0) {
      nextPositions[positionIndex] = nextPosition;
    } else {
      nextPositions.push(nextPosition);
    }

    nextCash = round2(nextCash - tradeValue);
  } else {
    if (!existing || existingQty <= 0) {
      throw new Error(`No ${symbol} position to sell.`);
    }
    if (quantity > existingQty + 1e-8) {
      throw new Error(`Sell quantity exceeds available shares for ${symbol}.`);
    }

    const remainingQty = round6(existingQty - quantity);
    if (remainingQty <= 0) {
      nextPositions.splice(positionIndex, 1);
    } else {
      nextPositions[positionIndex] = {
        ...existing,
        qty: remainingQty,
        shares: remainingQty,
        current_price: round2(price),
        currentPrice: round2(price),
      };
    }

    nextCash = round2(nextCash + tradeValue);
  }

  const normalizedPositions = normalizePositions(nextPositions).map((position) => {
    const current = toNumber(position.current_price ?? position.currentPrice ?? position.avg_entry_price, 0);
    const qty = toNumber(position.qty, 0);
    const avg = toNumber(position.avg_entry_price ?? position.avgCost, 0);
    const marketValue = round2(qty * current);
    const costBasis = round2(qty * avg);
    const unrealized = round2(marketValue - costBasis);
    return {
      ...position,
      current_price: round2(current),
      currentPrice: round2(current),
      market_value: marketValue,
      marketValue,
      cost_basis: costBasis,
      unrealized_pl: unrealized,
      unrealized_plpc: costBasis > 0 ? unrealized / costBasis : 0,
    };
  });

  const holdingsValue = normalizedPositions.reduce((sum, position) => sum + toNumber(position.market_value, 0), 0);
  const previousEquity = toNumber(accountState.equity ?? accountState.portfolio_value, 100000);
  const nextEquity = round2(nextCash + holdingsValue);
  const nextAccount = {
    ...accountState,
    cash: round2(nextCash),
    buying_power: round2(nextCash),
    equity: nextEquity,
    portfolio_value: nextEquity,
    last_equity: round2(previousEquity),
    daily_pnl: round2(nextEquity - previousEquity),
    mode: 'paper',
    status: 'simulated',
  };

  return {
    account: nextAccount,
    positions: normalizedPositions,
  };
};

const buildTradeHistoryEntry = ({
  orderLike,
  symbol,
  side,
  quantity,
  price,
  mode,
  simulated,
  strategyName = '',
  strategyId = '',
  fallbackOrderType = '',
  fallbackTimeInForce = '',
}) => {
  const resolvedStrategyName = String(strategyName || '').trim();
  const resolvedStrategyId = String(strategyId || '').trim();
  const resolvedOrderType = String(
    orderLike?.order_type
    || orderLike?.type
    || fallbackOrderType
    || 'market',
  ).trim().toLowerCase();
  const resolvedTimeInForce = String(
    orderLike?.time_in_force
    || fallbackTimeInForce
    || '',
  ).trim().toUpperCase();
  const resolvedClientOrderId = String(orderLike?.client_order_id || '').trim();
  const resolvedFees = Math.abs(toNumber(
    orderLike?.fees
    ?? orderLike?.fee
    ?? orderLike?.commission
    ?? orderLike?.commissions
    ?? orderLike?.filled_fees,
    0,
  ));

  return {
    id: String(orderLike?.id || orderLike?.order_id || `trade_${Date.now()}_${Math.random().toString(16).slice(2)}`),
    symbol,
    side,
    shares: round6(quantity),
    qty: round6(quantity),
    price: round2(price),
    total: round2(quantity * price),
    timestamp: orderLike?.filled_at || orderLike?.submitted_at || new Date().toISOString(),
    status: String(orderLike?.status || 'filled').toLowerCase(),
    mode,
    simulated: Boolean(simulated),
    order_type: resolvedOrderType || 'market',
    time_in_force: resolvedTimeInForce || undefined,
    client_order_id: resolvedClientOrderId || undefined,
    fees: resolvedFees,
    commission: resolvedFees,
    strategy_name: resolvedStrategyName || undefined,
    strategy_id: resolvedStrategyId || undefined,
  };
};

const isCryptoSymbol = (symbol) => symbol.includes('/') || CRYPTO_SYMBOL_REGEX.test(symbol);

const fetchAlpacaOrderList = async ({ baseUrl, apiKey, apiSecret, status, direction, limit }) => {
  const url = new URL(`${baseUrl}/v2/orders`);
  url.searchParams.set('status', status);
  url.searchParams.set('direction', direction);
  url.searchParams.set('limit', String(limit));

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'APCA-API-KEY-ID': apiKey,
      'APCA-API-SECRET-KEY': apiSecret,
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMessage = payload?.message || payload?.error || 'Failed to fetch orders';
    const error = new Error(errorMessage);
    error.status = response.status;
    error.detail = payload;
    throw error;
  }

  return Array.isArray(payload) ? payload : [];
};

const fetchLiveAccountAndPositions = async ({ baseUrl, apiKey, apiSecret }) => {
  const headers = {
    'APCA-API-KEY-ID': apiKey,
    'APCA-API-SECRET-KEY': apiSecret,
  };

  const [accountResponse, positionsResponse] = await Promise.all([
    fetch(`${baseUrl}/v2/account`, { headers }),
    fetch(`${baseUrl}/v2/positions`, { headers }),
  ]);

  const accountPayload = await accountResponse.json().catch(() => null);
  const positionsPayload = await positionsResponse.json().catch(() => []);

  return {
    account: accountResponse.ok ? accountPayload : null,
    positions: positionsResponse.ok && Array.isArray(positionsPayload) ? positionsPayload : null,
  };
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Trading-Mode');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getUserFromToken(req);
  if (!user) {
    return res.status(401).json({
      error: 'Authentication failed. Please refresh the page and try again.',
    });
  }

  const { data: profile, error: profileError } = await getProfileForTrading(user.id);
  if (profileError) {
    return res.status(500).json({ error: profileError.message });
  }

  const profileMode = normalizeTradingMode(profile?.trading_mode);
  const mode = getTradingModeFromRequest(req, profileMode);
  const { account: modeAccount, positions: modePositions, tradeHistory: modeTradeHistory } = readModeDataFromProfile(profile, mode);

  try {
    if (req.method === 'GET') {
      if (mode === 'paper') {
        return res.status(200).json({
          mode,
          source: 'paper_simulated',
          orders: modeTradeHistory,
          count: modeTradeHistory.length,
        });
      }

      const { data: conn, error: connError } = await supabase
        .from('broker_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('broker', 'alpaca')
        .maybeSingle();

      if (connError) {
        return res.status(500).json({ error: connError.message, mode });
      }

      const credentials = resolveAlpacaCredentialsForMode(conn, mode);
      if (!credentials.apiKey || !credentials.apiSecret) {
        return res.status(200).json({
          mode,
          source: 'profile_cache',
          orders: modeTradeHistory,
          count: modeTradeHistory.length,
        });
      }

      const status = String(req.query?.status || 'all');
      const direction = String(req.query?.direction || 'desc');
      const limit = Math.min(Math.max(Number(req.query?.limit || 100), 1), 500);

      const orders = await fetchAlpacaOrderList({
        baseUrl: credentials.baseUrl,
        apiKey: credentials.apiKey,
        apiSecret: credentials.apiSecret,
        status,
        direction,
        limit,
      });

      let nextHistory = modeTradeHistory;
      orders.forEach((entry) => {
        const filledQty = toNumber(entry.filled_qty ?? entry.qty, 0);
        const fallbackPrice = calculatePriceFallback(entry, filledQty, 0);
        const price = toNumber(entry.filled_avg_price, fallbackPrice);
        if (!Number.isFinite(price) || price <= 0 || filledQty <= 0) return;
        nextHistory = appendTradeHistoryEntry(nextHistory, buildTradeHistoryEntry({
          orderLike: entry,
          symbol: entry.symbol,
          side: entry.side,
          quantity: filledQty,
          price,
          mode,
          simulated: false,
        }));
      });

      await upsertModeProfileData(user.id, mode, {
        tradeHistory: nextHistory,
        tradingMode: mode,
      });

      return res.status(200).json({ orders, count: orders.length, mode, source: 'alpaca_live' });
    }

    const parsed = parseOrderRequest(req.body || {});
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error, mode });
    }

    const {
      order,
      parsedQty,
      parsedNotional,
      strategyName,
      strategyId,
    } = parsed;
    const marketPriceFallback = calculatePriceFallback(req.body || {}, parsedQty || 0, parsedNotional || 0);
    const resolvedPrice = toNumber(marketPriceFallback);

    if (mode === 'paper') {
      const simulatedPrice = Number.isFinite(resolvedPrice) && resolvedPrice > 0
        ? resolvedPrice
        : Number.isFinite(parsedNotional) && Number.isFinite(parsedQty) && parsedQty > 0
          ? parsedNotional / parsedQty
          : NaN;

      if (!Number.isFinite(simulatedPrice) || simulatedPrice <= 0) {
        return res.status(400).json({
          error: 'Unable to simulate paper trade without a valid price. Provide limit/stop price or reference market price.',
          mode,
        });
      }

      const simulatedQty = Number.isFinite(parsedQty) && parsedQty > 0
        ? parsedQty
        : Number.isFinite(parsedNotional) && parsedNotional > 0
          ? parsedNotional / simulatedPrice
          : NaN;

      if (!Number.isFinite(simulatedQty) || simulatedQty <= 0) {
        return res.status(400).json({ error: 'Unable to resolve paper order quantity.', mode });
      }

      const simulatedState = applyPaperTradeToState({
        account: modeAccount,
        positions: modePositions,
        side: order.side,
        symbol: order.symbol,
        quantity: simulatedQty,
        price: simulatedPrice,
      });

      const simulatedOrder = {
        id: `paper_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        client_order_id: `paper_${Date.now()}`,
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        time_in_force: order.time_in_force,
        qty: String(round6(simulatedQty)),
        filled_qty: String(round6(simulatedQty)),
        filled_avg_price: String(round2(simulatedPrice)),
        submitted_at: new Date().toISOString(),
        filled_at: new Date().toISOString(),
        status: 'filled',
        simulated: true,
        trading_mode: mode,
      };

      const historyEntry = buildTradeHistoryEntry({
        orderLike: simulatedOrder,
        symbol: order.symbol,
        side: order.side,
        quantity: simulatedQty,
        price: simulatedPrice,
        mode,
        simulated: true,
        strategyName,
        strategyId,
        fallbackOrderType: order.type,
        fallbackTimeInForce: order.time_in_force,
      });

      const nextHistory = appendTradeHistoryEntry(modeTradeHistory, historyEntry);
      await upsertModeProfileData(user.id, mode, {
        account: simulatedState.account,
        positions: simulatedState.positions,
        tradeHistory: nextHistory,
        tradingMode: mode,
      });

      return res.status(200).json(simulatedOrder);
    }

    const { data: conn, error: connError } = await supabase
      .from('broker_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('broker', 'alpaca')
      .maybeSingle();

    if (connError) {
      return res.status(500).json({ error: connError.message, mode });
    }

    const credentials = resolveAlpacaCredentialsForMode(conn, mode);
    if (!credentials.apiKey || !credentials.apiSecret) {
      return res.status(401).json({
        error: 'No live broker connected. Connect a live broker in Portfolio before placing live trades.',
        mode,
      });
    }

    let apiEndpoint = `${credentials.baseUrl}/v2/orders`;
    let orderPayload = order;

    if (isCryptoSymbol(order.symbol)) {
      apiEndpoint = `${credentials.baseUrl}/v1beta3/crypto/us/orders`;
      orderPayload = {
        ...order,
        symbol: order.symbol.replace('/', ''),
      };
    }

    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        'APCA-API-KEY-ID': credentials.apiKey,
        'APCA-API-SECRET-KEY': credentials.apiSecret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({
        error: payload?.message || payload?.error || 'Order failed',
        detail: payload,
        mode,
      });
    }

    const finalQty = toNumber(payload?.filled_qty ?? payload?.qty, parsedQty || 0);
    const finalPrice = toNumber(
      payload?.filled_avg_price,
      Number.isFinite(resolvedPrice) && resolvedPrice > 0
        ? resolvedPrice
        : Number.isFinite(parsedNotional) && finalQty > 0
          ? parsedNotional / finalQty
          : NaN
    );

    let nextHistory = modeTradeHistory;
    if (finalQty > 0 && finalPrice > 0) {
      nextHistory = appendTradeHistoryEntry(modeTradeHistory, buildTradeHistoryEntry({
        orderLike: payload,
        symbol: order.symbol,
        side: order.side,
        quantity: finalQty,
        price: finalPrice,
        mode,
        simulated: false,
        strategyName,
        strategyId,
        fallbackOrderType: order.type,
        fallbackTimeInForce: order.time_in_force,
      }));
    }

    const refreshed = await fetchLiveAccountAndPositions({
      baseUrl: credentials.baseUrl,
      apiKey: credentials.apiKey,
      apiSecret: credentials.apiSecret,
    });

    await upsertModeProfileData(user.id, mode, {
      account: refreshed.account || modeAccount,
      positions: refreshed.positions || modePositions,
      tradeHistory: nextHistory,
      tradingMode: mode,
    });

    return res.status(200).json({
      ...payload,
      trading_mode: mode,
      simulated: false,
    });
  } catch (error) {
    return res.status(error?.status || 500).json({
      error: error?.message || 'Unexpected order service failure',
      detail: error?.detail,
      mode,
    });
  }
}
