// api/sentinel/heartbeat-crypto.js
// Sentinel crypto heartbeat — runs every minute 24/7/365
// One shared brain. All users see the same Sentinel trading live.
// Pipeline: Bayesian → Edge Filter → Stoikov → Kelly/Monte Carlo → Execute

import { createClient } from '@supabase/supabase-js';

const TWELVE_DATA_API_KEY = process.env.VITE_TWELVE_DATA_WS_KEY || process.env.TWELVE_DATA_API_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const CRYPTO_SYMBOLS = ['BTC/USD', 'ETH/USD', 'SOL/USD'];
const MAX_OPEN_CRYPTO = 6;
const MAX_POSITION_PCT = 0.05;
const SENTINEL_ACCOUNT_ID = '00000000-0000-0000-0000-000000000001';

// Base confidence thresholds — memory adjustments applied on top
const BASE_MIN_CONFIDENCE_SCALP = 55;
const BASE_MIN_CONFIDENCE_SWING = 60;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Redis helpers ───────────────────────────────────────────────────────────
async function redisGet(key) {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return null;
  try {
    const res = await fetch(`${UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
    });
    const json = await res.json();
    return json.result ? JSON.parse(json.result) : null;
  } catch { return null; }
}

async function redisSet(key, value, ttlSeconds) {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return;
  try {
    await fetch(`${UPSTASH_REDIS_REST_URL}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: JSON.stringify(value), ex: ttlSeconds }),
    });
  } catch {}
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Always use Eastern Time for session dates — never UTC (avoids date flip at 7-8pm ET)
function getETDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // YYYY-MM-DD
}
function getETHour() {
  return parseInt(new Date().toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }), 10);
}
function getETMinute() {
  return parseInt(new Date().toLocaleString('en-US', { timeZone: 'America/New_York', minute: 'numeric' }), 10);
}

// ─── Market data ─────────────────────────────────────────────────────────────
async function fetchBars(symbol, interval = '1h') {
  const intervalMap = { '5m': '5min', '15m': '15min', '1h': '1h', '4h': '4h', '1D': '1day' };
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${intervalMap[interval] || '1h'}&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.values || !Array.isArray(data.values)) throw new Error(`No bars for ${symbol}: ${JSON.stringify(data).slice(0, 100)}`);
  return data.values.reverse().map(v => ({ time: Date.parse(v.datetime), open: +v.open, high: +v.high, low: +v.low, close: +v.close, volume: +(v.volume || 0) }));
}

async function fetchCurrentPrice(symbol) {
  const res = await fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${TWELVE_DATA_API_KEY}`);
  const data = await res.json();
  return parseFloat(data.close || data.price || '0');
}

// ─── Technical indicators ────────────────────────────────────────────────────
function computeEMA(prices, period) {
  if (!prices.length) return [];
  const k = 2 / (period + 1);
  const result = [prices[0]];
  for (let i = 1; i < prices.length; i++) result[i] = prices[i] * k + result[i - 1] * (1 - k);
  return result;
}

function computeRSI(prices, period = 14) {
  if (prices.length <= period) return prices.map(() => 50);
  const result = new Array(prices.length).fill(50);
  const gains = [], losses = [];
  for (let i = 1; i < prices.length; i++) {
    const d = prices[i] - prices[i - 1];
    gains.push(d > 0 ? d : 0);
    losses.push(d < 0 ? -d : 0);
  }
  let ag = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let al = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    if (i > period) { ag = (ag * (period - 1) + gains[i - 1]) / period; al = (al * (period - 1) + losses[i - 1]) / period; }
    result[i] = parseFloat((100 - 100 / (1 + (al === 0 ? 100 : ag / al))).toFixed(2));
  }
  return result;
}

function computeATR(bars, period = 14) {
  if (!bars.length) return [];
  const trs = bars.map((b, i) => i === 0 ? b.high - b.low : Math.max(b.high - b.low, Math.abs(b.high - bars[i - 1].close), Math.abs(b.low - bars[i - 1].close)));
  const result = new Array(bars.length).fill(0);
  result[period - 1] = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < bars.length; i++) result[i] = (result[i - 1] * (period - 1) + trs[i]) / period;
  return result;
}

function detectRegime(bars) {
  if (bars.length < 50) return { trend: 'NEUTRAL', type: 'RANGING', volatility: 'NORMAL', description: 'Insufficient data' };
  const closes = bars.map(b => b.close);
  const ema8 = computeEMA(closes, 8), ema21 = computeEMA(closes, 21), atr = computeATR(bars, 14);
  const last = closes.length - 1, price = closes[last];
  const atrSlice = atr.slice(Math.max(0, last - 20), last + 1).filter(v => v > 0);
  const avgATR = atrSlice.reduce((a, b) => a + b, 0) / atrSlice.length;
  const atrRatio = avgATR > 0 ? atr[last] / avgATR : 1;
  const volatility = atrRatio > 1.5 ? 'HIGH' : atrRatio < 0.6 ? 'LOW' : 'NORMAL';
  if (volatility === 'HIGH' && atrRatio > 2) return { trend: 'NEUTRAL', type: 'VOLATILE', volatility: 'HIGH', description: `Extreme volatility (${atrRatio.toFixed(1)}x ATR).` };
  const bull = price > ema8[last] && ema8[last] > ema21[last];
  const bear = price < ema8[last] && ema8[last] < ema21[last];
  const trending = Math.abs(last >= 5 ? ema21[last] - ema21[last - 5] : 0) > atr[last] * 0.3;
  if (bull) return { trend: 'BULL', type: trending ? 'TRENDING' : 'RANGING', volatility, description: `Bullish ${trending ? 'trend' : 'range'}.` };
  if (bear) return { trend: 'BEAR', type: trending ? 'TRENDING' : 'RANGING', volatility, description: `Bearish ${trending ? 'trend' : 'range'}.` };
  return { trend: 'NEUTRAL', type: 'RANGING', volatility, description: 'Neutral — no clear bias.' };
}

// ─── THE 5 MODELS ─────────────────────────────────────────────────────────────

/**
 * BAYESIAN MODEL
 * Updates prior probability using historical win rates per setup+regime combo.
 * Returns posterior probability (0-1) and EV score.
 */
function bayesianScore(setup, regime, timeframe, memory, recentClosedTrades = []) {
  // Prior: base 50% win rate assumption
  let prior = 0.5;

  // Update prior from memory setup weights (accumulated from learn.js)
  const setupWeight = memory.setup_weights?.[setup] || 0;
  prior = Math.min(0.85, Math.max(0.15, prior + setupWeight / 100));

  // Update from regime filters
  const regimeKey = `${regime.trend}_${regime.type}`;
  const regimeAdj = memory.regime_filters?.[regimeKey] || 0;
  prior = Math.min(0.85, Math.max(0.15, prior + regimeAdj / 100));

  // Update from actual recent trades for this setup+regime combo (last 30 trades)
  const relevant = recentClosedTrades.filter(t =>
    t.setup === setup &&
    t.regime && t.regime.includes(regime.trend)
  ).slice(-30);

  let posterior = prior;
  if (relevant.length >= 3) {
    const observedWinRate = relevant.filter(t => t.win).length / relevant.length;
    // Bayesian update: weight observed data vs prior based on sample size
    const weight = Math.min(0.8, relevant.length / 20); // more data = more weight
    posterior = prior * (1 - weight) + observedWinRate * weight;
  }

  // Timeframe adjustment
  const tfAdj = memory.timeframe_weights?.[timeframe] || 0;
  posterior = Math.min(0.9, Math.max(0.1, posterior + tfAdj / 100));

  return {
    prior: parseFloat(prior.toFixed(3)),
    posterior: parseFloat(posterior.toFixed(3)),
    sampleSize: relevant.length,
    ev: parseFloat((posterior * 2 - 1).toFixed(3)), // simple EV: +1 = strong buy, -1 = strong sell
  };
}

/**
 * EDGE FILTER (EV_net = q - p - c)
 * Returns true only if mathematical edge exists after estimated costs.
 */
function edgeFilter(posterior, avgWinR, avgLossR, spread_cost_pct = 0.001) {
  const winRate = posterior;
  const lossRate = 1 - winRate;
  const q = winRate * (avgWinR || 1.5);  // expected gain
  const p = lossRate * (avgLossR || 1.0); // expected loss
  const c = spread_cost_pct * 10;         // cost in R units (rough)
  const ev_net = q - p - c;
  const zScore = (winRate - 0.5) / Math.sqrt(0.25 / Math.max(1, 10)); // simplified z
  return {
    ev: parseFloat(ev_net.toFixed(3)),
    q: parseFloat(q.toFixed(3)),
    p: parseFloat(p.toFixed(3)),
    cost: parseFloat(c.toFixed(3)),
    zScore: parseFloat(zScore.toFixed(2)),
    pass: ev_net > 0,
  };
}

/**
 * STOIKOV MODEL
 * Computes reservation price to improve entry quality.
 * r = s - q * gamma * sigma^2 * T
 */
function stoikovReservationPrice(midPrice, netInventory, volatility, timeHorizonMins = 5) {
  const gamma = 0.1;  // risk aversion (conservative)
  const T = timeHorizonMins / (24 * 60); // fraction of day
  // sigma^2 approximated from ATR/price ratio
  const sigma2 = Math.pow(volatility / midPrice, 2);
  const reservationPrice = midPrice - netInventory * gamma * sigma2 * T * midPrice;
  return {
    reservationPrice: parseFloat(reservationPrice.toFixed(2)),
    spread: parseFloat((gamma * sigma2 * T * midPrice).toFixed(4)),
    q: parseFloat(netInventory.toFixed(4)),
    gamma,
    sigma2: parseFloat(sigma2.toFixed(6)),
  };
}

/**
 * KELLY CRITERION + MONTE CARLO
 * Computes optimal position size and validates via path simulation.
 */
function kellyMonteCarlo(winRate, avgWinR, avgLossR, currentBalance, maxDrawdownPct = 0.15) {
  if (winRate <= 0 || winRate >= 1) return { fStar: 0, f: 0, dd: 0, safe: false };

  // Kelly fraction: f* = (p*b - q) / b
  const b = avgWinR / avgLossR; // win/loss ratio
  const p = winRate;
  const q = 1 - p;
  const fStar = Math.max(0, (p * b - q) / b);

  // Use half-Kelly for safety
  const f = fStar / 2;

  // Quick Monte Carlo: 500 paths, 50 trades
  const PATHS = 500;
  const TRADES = 50;
  let maxSimDD = 0;
  for (let path = 0; path < PATHS; path++) {
    let equity = 1.0;
    let peak = 1.0;
    for (let t = 0; t < TRADES; t++) {
      const win = Math.random() < winRate;
      equity *= win ? (1 + f * avgWinR) : (1 - f * avgLossR);
      if (equity > peak) peak = equity;
      const dd = (peak - equity) / peak;
      if (dd > maxSimDD) maxSimDD = dd;
    }
  }

  return {
    fStar: parseFloat(fStar.toFixed(4)),
    f: parseFloat(f.toFixed(4)),
    dd: parseFloat((maxSimDD * 100).toFixed(1)),
    safe: maxSimDD < maxDrawdownPct,
    riskPct: parseFloat((f * avgLossR * 100).toFixed(2)),
  };
}

// ─── Signal generator (technical layer) ──────────────────────────────────────
function generateSignal(symbol, bars, timeframe) {
  const regime = detectRegime(bars);
  const WAIT = { symbol, direction: 'WAIT', confidence: 0, entry: 0, stop: 0, target: 0, riskR: 1, rewardR: 0, setup: 'No Setup', reasons: [], warnings: ['No clear setup'], regime, timeframe, timestamp: new Date().toISOString() };
  if (bars.length < 50) return WAIT;

  const closes = bars.map(b => b.close), volumes = bars.map(b => b.volume);
  const ema8arr = computeEMA(closes, 8), ema21arr = computeEMA(closes, 21);
  const rsiArr = computeRSI(closes, 14), atrArr = computeATR(bars, 14);
  const last = bars.length - 1, price = closes[last];
  const ema8 = ema8arr[last], ema21 = ema21arr[last], rsi = rsiArr[last], atr = atrArr[last];
  const volSlice = volumes.slice(Math.max(0, last - 20), last + 1);
  const avgVol = volSlice.reduce((a, b) => a + b, 0) / volSlice.length;
  const aboveAvgVol = volumes[last] > avgVol;
  const isScalp = timeframe === '5min';

  let direction = 'WAIT', confidence = 0, setup = 'No Setup', reasons = [];

  const longScore = [price > ema8, ema8 > ema21, rsi >= 40 && rsi <= 65, aboveAvgVol, regime.trend === 'BULL'].filter(Boolean).length;
  const shortScore = [price < ema8, ema8 < ema21, rsi >= 35 && rsi <= 60, aboveAvgVol, regime.trend === 'BEAR'].filter(Boolean).length;

  if (longScore >= 3 || shortScore >= 3) {
    direction = longScore >= shortScore ? 'LONG' : 'SHORT';
    const score = direction === 'LONG' ? longScore : shortScore;
    confidence = Math.min(100, Math.round((score / 5) * 80 + (aboveAvgVol ? 10 : 0) + ((direction === 'LONG' ? regime.trend === 'BULL' : regime.trend === 'BEAR') ? 10 : 0)));
    setup = direction === 'LONG' ? 'Momentum Long' : 'Momentum Short';
    reasons = [`EMA8 (${ema8.toFixed(2)}) ${direction === 'LONG' ? '>' : '<'} EMA21 (${ema21.toFixed(2)})`, `RSI ${rsi.toFixed(1)}`, aboveAvgVol ? `Volume ${(volumes[last] / avgVol).toFixed(1)}x avg` : 'Volume average'];
  }

  if (isScalp && direction === 'WAIT') {
    const pctAboveE8 = ((price - ema8) / ema8) * 100;
    if (pctAboveE8 > 0.03 && pctAboveE8 < 0.3 && rsi > 50 && rsi < 72 && ema8 > ema21) {
      direction = 'LONG'; setup = 'Momentum Burst'; confidence = 58; reasons = ['Price riding above EMA8 with momentum'];
    }
    if (direction === 'WAIT' && pctAboveE8 < -0.03 && pctAboveE8 > -0.3 && rsi < 50 && rsi > 28 && ema8 < ema21) {
      direction = 'SHORT'; setup = 'Momentum Burst'; confidence = 58; reasons = ['Price sliding below EMA8 with momentum'];
    }
    const pctFromE21 = ((price - ema21) / ema21) * 100;
    if (direction === 'WAIT' && pctFromE21 < -0.15 && rsi < 32) {
      direction = 'LONG'; setup = 'Mean Reversion'; confidence = 57; reasons = ['Price oversold below EMA21'];
    }
    if (direction === 'WAIT' && pctFromE21 > 0.15 && rsi > 68) {
      direction = 'SHORT'; setup = 'Mean Reversion'; confidence = 57; reasons = ['Price overbought above EMA21'];
    }
    if (direction === 'WAIT' && Math.abs(price - ema8) / atr < 0.3 && ema8 > ema21 && rsi > 45 && rsi < 62) {
      direction = 'LONG'; setup = 'EMA8 Bounce'; confidence = 56; reasons = ['Price bouncing off EMA8 support'];
    }
    if (direction === 'WAIT' && Math.abs(price - ema8) / atr < 0.3 && ema8 < ema21 && rsi > 38 && rsi < 55) {
      direction = 'SHORT'; setup = 'EMA8 Bounce'; confidence = 56; reasons = ['Price rejecting off EMA8 resistance'];
    }
  }

  if (direction === 'WAIT') return { ...WAIT, regime };
  if (regime.type === 'VOLATILE') confidence = Math.max(0, confidence - (isScalp ? 5 : 15));

  let stop, stopDist, mult;
  if (isScalp) {
    stop = direction === 'LONG' ? price - atr * 0.75 : price + atr * 0.75;
    stopDist = Math.abs(price - stop);
    mult = 1.5;
  } else {
    stop = direction === 'LONG' ? price - atr * 1.5 : price + atr * 1.5;
    stopDist = Math.abs(price - stop);
    mult = regime.type === 'RANGING' ? 1.5 : 2.0;
  }
  const target = direction === 'LONG' ? price + stopDist * mult : price - stopDist * mult;

  return { symbol, direction, confidence, entry: parseFloat(price.toFixed(2)), stop: parseFloat(stop.toFixed(2)), target: parseFloat(target.toFixed(2)), riskR: 1, rewardR: mult, setup, reasons, atr, warnings: regime.type === 'VOLATILE' ? ['Volatile regime — reduced confidence'] : [], regime, timeframe, timestamp: new Date().toISOString() };
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const startTime = Date.now();
  let newSignals = 0, tradesClosed = 0, sessionWins = 0, sessionLosses = 0, sessionGrossPnl = 0;
  const log = [];

  try {
    // Load account
    const { data: account, error: accErr } = await supabase.from('sentinel_account').select('*').eq('id', SENTINEL_ACCOUNT_ID).single();
    if (accErr || !account) return res.status(200).json({ skipped: true, reason: 'No sentinel_account', error: accErr?.message });

    // ── LOAD SENTINEL BRAIN ─────────────────────────────────────────────────
    // This is the shared brain — same for all users. Updated nightly by learn.js.
    const { data: memory } = await supabase.from('sentinel_memory').select('*').eq('id', 1).single();
    const brain = memory || {};
    const suspended = brain.suspended_conditions || [];
    const tickerWeights = brain.ticker_weights || {};
    const confAdjustments = brain.confidence_adjustments || {};

    // Load recent closed trades for Bayesian posterior calculation
    const { data: recentClosedTrades } = await supabase
      .from('sentinel_trades')
      .select('setup, regime, win, pnl, result_r')
      .eq('status', 'closed')
      .order('closed_at', { ascending: false })
      .limit(100);
    const closedForBayes = recentClosedTrades || [];

    // Compute account-level stats for Kelly
    const allWins = closedForBayes.filter(t => t.win);
    const allLosses = closedForBayes.filter(t => !t.win);
    const accountWinRate = closedForBayes.length > 0 ? allWins.length / closedForBayes.length : 0.5;
    const avgWinR = allWins.length > 0 ? allWins.reduce((s, t) => s + Math.abs(t.result_r || 1.5), 0) / allWins.length : 1.5;
    const avgLossR = allLosses.length > 0 ? allLosses.reduce((s, t) => s + Math.abs(t.result_r || 1.0), 0) / allLosses.length : 1.0;

    // ── MANAGE OPEN TRADES ───────────────────────────────────────────────────
    const { data: openTrades } = await supabase.from('sentinel_trades').select('*').eq('status', 'open').in('symbol', CRYPTO_SYMBOLS);
    const openSymbols = new Set((openTrades || []).map(t => t.symbol));

    for (const trade of (openTrades || [])) {
      try {
        const currentPrice = await fetchCurrentPrice(trade.symbol);
        if (!currentPrice) continue;
        const isLong = trade.direction === 'LONG';
        const stopHit = isLong ? currentPrice <= trade.stop : currentPrice >= trade.stop;
        const targetHit = isLong ? currentPrice >= trade.target : currentPrice <= trade.target;

        if (stopHit || targetHit) {
          const exitPrice = stopHit ? trade.stop : trade.target;
          const pnl = isLong
            ? (exitPrice - trade.entry) * (trade.dollar_size / trade.entry)
            : (trade.entry - exitPrice) * (trade.dollar_size / trade.entry);
          const resultR = stopHit ? -1 : trade.reward_r;
          const win = !stopHit;

          await supabase.from('sentinel_trades').update({
            status: 'closed', closed_at: new Date().toISOString(),
            exit_price: exitPrice, result_r: resultR,
            pnl: parseFloat(pnl.toFixed(2)), win,
            session_date: getETDate(),
          }).eq('id', trade.id);

          // Recompute account metrics
          const { data: allClosed } = await supabase.from('sentinel_trades').select('pnl, result_r, win').eq('status', 'closed');
          const { count: totalTradeCount } = await supabase.from('sentinel_trades').select('id', { count: 'exact', head: true });
          const closedCount = allClosed?.length || 0;
          const newWins = allClosed?.filter(t => t.win).length || 0;
          const newLosses = closedCount - newWins;
          const winRate = closedCount > 0 ? (newWins / closedCount) * 100 : 0;
          const avgR = closedCount > 0 ? allClosed.reduce((s, t) => s + (t.result_r || 0), 0) / closedCount : 0;
          const wR = allClosed?.filter(t => t.win) || [];
          const lR = allClosed?.filter(t => !t.win) || [];
          const avgWin2 = wR.length > 0 ? wR.reduce((s, t) => s + (t.result_r || 0), 0) / wR.length : 0;
          const avgLoss2 = lR.length > 0 ? Math.abs(lR.reduce((s, t) => s + (t.result_r || 0), 0) / lR.length) : 0;
          const expectancy = closedCount > 0 ? ((winRate / 100) * avgWin2) - (((100 - winRate) / 100) * avgLoss2) : 0;

          await supabase.from('sentinel_account').update({
            current_balance: parseFloat((account.current_balance + pnl).toFixed(2)),
            total_pnl: parseFloat((account.total_pnl + pnl).toFixed(2)),
            wins: newWins, losses: newLosses, closed_trades: closedCount,
            total_trades: totalTradeCount || 0,
            win_rate: parseFloat(winRate.toFixed(2)),
            avg_r: parseFloat(avgR.toFixed(2)),
            expectancy: parseFloat(expectancy.toFixed(2)),
            updated_at: new Date().toISOString(),
          }).eq('id', SENTINEL_ACCOUNT_ID);

          await supabase.from('sentinel_copied_trades').update({ status: 'closed', closed_at: new Date().toISOString(), exit_price: exitPrice, result_r: resultR, win }).eq('sentinel_trade_id', trade.id).eq('status', 'open');

          // Notify YOLO subscribers
          const { data: subs } = await supabase.from('sentinel_user_settings').select('user_id').eq('yolo_active', true).in('subscription_status', ['trialing', 'active']);
          for (const u of (subs || [])) {
            await supabase.from('sentinel_notifications').insert({ user_id: u.user_id, type: 'trade_closed', title: `${win ? '✓' : '✗'} Sentinel closed ${trade.symbol.replace('/USD', '')} — ${win ? '+' : ''}${resultR}R`, body: `Exit $${exitPrice.toLocaleString()} · P&L $${pnl.toFixed(2)}`, trade_id: trade.id, read: false });
          }

          openSymbols.delete(trade.symbol);
          tradesClosed++;
          if (win) sessionWins++; else sessionLosses++;
          sessionGrossPnl += parseFloat(pnl.toFixed(2));
          log.push(`Closed ${trade.direction} ${trade.symbol} @ ${exitPrice} — ${win ? 'WIN' : 'LOSS'} ${resultR}R`);
        }

        // Volatility check
        if (!stopHit && !targetHit) {
          try {
            const volRes = await fetch(`${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/sentinel/volatility-check`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ symbol: trade.symbol, trade: { ...trade, current_price: currentPrice }, currentPrice }),
            });
            const volResult = await volRes.json();
            if (volResult.detected) {
              log.push(`⚠️ VOLATILITY ${trade.symbol}: ${volResult.move?.magnitude?.toFixed(1)}% in ${volResult.move?.duration}min → ${volResult.analysis?.decision}`);
              if (volResult.execution?.action === 'closed') openSymbols.delete(trade.symbol);
            }
          } catch (volErr) { log.push(`Vol check error ${trade.symbol}: ${volErr.message}`); }
        }

        await sleep(200);
      } catch (err) { log.push(`Error checking ${trade.symbol}: ${err.message}`); }
    }

    // ── SCAN FOR NEW ENTRIES ─────────────────────────────────────────────────
    const openKeys = new Set((openTrades || []).map(t => `${t.symbol}_${t.timeframe}`));
    const totalOpenCrypto = (openTrades || []).filter(t => t.status === 'open').length;
    const currentMinute = new Date().getMinutes();
    const doSwingScan = currentMinute % 5 === 0;

    const cryptoJobs = [];
    for (const symbol of CRYPTO_SYMBOLS) {
      if (!openKeys.has(`${symbol}_5min`)) cryptoJobs.push({ symbol, timeframe: '5min' });
      if (doSwingScan && !openKeys.has(`${symbol}_1h`)) cryptoJobs.push({ symbol, timeframe: '1h' });
    }

    for (const job of cryptoJobs) {
      if (totalOpenCrypto + newSignals >= MAX_OPEN_CRYPTO) break;
      try {
        const cacheKey = `sentinel:crypto:signal:${job.symbol}:${job.timeframe}`;
        const cacheTTL = job.timeframe === '5min' ? 60 : 300;
        let signal = await redisGet(cacheKey);
        if (!signal) {
          const interval = job.timeframe === '5min' ? '5m' : '1h';
          const bars = await fetchBars(job.symbol, interval);
          signal = generateSignal(job.symbol, bars, job.timeframe);
          await redisSet(cacheKey, signal, cacheTTL);
          log.push(`${job.symbol} ${job.timeframe}: fresh — ${signal.direction} conf ${signal.confidence}`);
        } else {
          log.push(`${job.symbol} ${job.timeframe}: cached — ${signal.direction} conf ${signal.confidence}`);
        }

        if (signal.direction === 'WAIT') {
          // Log SCAN evaluation even when no signal
          try { await supabase.from('sentinel_signals').insert({
            symbol: job.symbol, timeframe: job.timeframe,
            signal_type: 'SCAN', direction: null,
            price_at_signal: signal.entry || 0,
            regime: signal.regime ? `${signal.regime.trend}/${signal.regime.type}` : null,
            composite_score: 0, trade_fired: false,
          }); } catch {}
          continue;
        }

        // ── STEP 1: Check suspended conditions (brain veto) ──────────────────
        const suspendKey = `${signal.setup}_${signal.regime?.trend}`;
        const isSuspended = suspended.some(s =>
          s === signal.setup || s === suspendKey || s === job.symbol
        );
        if (isSuspended) {
          log.push(`⛔ SUSPENDED: ${signal.setup} on ${job.symbol} — brain vetoed`);
          continue;
        }

        // ── STEP 2: Bayesian posterior ────────────────────────────────────────
        const bayes = bayesianScore(signal.setup, signal.regime, job.timeframe, brain, closedForBayes);
        log.push(`[BAYES] ${job.symbol} ${signal.setup}: prior=${bayes.prior} post=${bayes.posterior} n=${bayes.sampleSize}`);

        // Bayesian gate — LEARNING PHASE: threshold 0.30 until 100+ crypto trades
        // Once Sentinel has enough data to make informed decisions, raise to 0.45
        const BAYES_THRESHOLD = closedForBayes.length < 100 ? 0.30 : 0.45;
        if (bayes.posterior < BAYES_THRESHOLD) {
          log.push(`[BAYES] Rejected — posterior ${bayes.posterior} below threshold`);
          try { await supabase.from('sentinel_signals').insert({
            symbol: job.symbol, timeframe: job.timeframe, signal_type: 'BAYES_REJECT',
            direction: signal.direction, bayesian_prior: bayes.prior, bayesian_posterior: bayes.posterior,
            bayesian_ev: bayes.ev, composite_score: Math.round(bayes.posterior * 100),
            price_at_signal: signal.entry, regime: `${signal.regime.trend}/${signal.regime.type}`,
            trade_fired: false,
          }); } catch {}
          continue;
        }

        // ── STEP 3: Edge Filter (EV_net = q - p - c) ─────────────────────────
        const edge = edgeFilter(bayes.posterior, avgWinR, avgLossR);
        log.push(`[EDGE] EV=${edge.ev} pass=${edge.pass}`);

        if (!edge.pass) {
          log.push(`[EDGE] Rejected — no mathematical edge (EV=${edge.ev})`);
          try { await supabase.from('sentinel_signals').insert({
            symbol: job.symbol, timeframe: job.timeframe, signal_type: 'EDGE_REJECT',
            direction: signal.direction, bayesian_prior: bayes.prior, bayesian_posterior: bayes.posterior,
            bayesian_ev: bayes.ev, edge_ev_net: edge.ev, edge_cost: edge.cost, edge_z_score: edge.zScore,
            price_at_signal: signal.entry, regime: `${signal.regime.trend}/${signal.regime.type}`,
            composite_score: Math.round(bayes.posterior * 50), trade_fired: false,
          }); } catch {}
          continue;
        }

        // ── STEP 4: Apply brain confidence adjustments ────────────────────────
        let finalConf = signal.confidence;

        // Ticker weight from memory
        const tickerKey = job.symbol.split('/')[0]; // BTC, ETH, SOL
        const tickerAdj = tickerWeights[tickerKey] || 0;
        finalConf = Math.min(100, Math.max(0, finalConf + tickerAdj));

        // Setup-specific confidence adjustment from memory
        const confAdj = confAdjustments[signal.setup] || 0;
        finalConf = Math.min(100, Math.max(0, finalConf + confAdj));

        // Boost confidence when Bayesian posterior is strong
        if (bayes.posterior > 0.65) finalConf = Math.min(100, finalConf + 5);

        // Dynamic threshold: base threshold adjusted by memory
        const baseThreshold = job.timeframe === '5min' ? BASE_MIN_CONFIDENCE_SCALP : BASE_MIN_CONFIDENCE_SWING;
        const memoryThresholdAdj = brain.setup_weights?.[signal.setup] || 0;
        const effectiveThreshold = Math.max(50, baseThreshold - Math.max(0, memoryThresholdAdj));

        if (finalConf < effectiveThreshold) {
          log.push(`[CONF] Rejected — conf ${finalConf} < threshold ${effectiveThreshold}`);
          continue;
        }

        // ── STEP 5: Stoikov reservation price ────────────────────────────────
        const stoikov = stoikovReservationPrice(
          signal.entry,
          0, // neutral inventory (not a market maker)
          signal.atr || signal.entry * 0.01,
          job.timeframe === '5min' ? 5 : 60
        );
        // Use reservation price for entry if it improves our fill
        const useReservationPrice = Math.abs(stoikov.reservationPrice - signal.entry) / signal.entry < 0.002;
        const entryPrice = useReservationPrice ? stoikov.reservationPrice : signal.entry;
        log.push(`[STOIKOV] r=${stoikov.reservationPrice} entry=${entryPrice}`);

        // ── STEP 6: Kelly + Monte Carlo position sizing ───────────────────────
        const kelly = kellyMonteCarlo(
          Math.max(accountWinRate, bayes.posterior), // use best estimate
          avgWinR,
          avgLossR,
          account.current_balance
        );
        log.push(`[KELLY] f*=${kelly.fStar} f=${kelly.f} dd=${kelly.dd}% safe=${kelly.safe}`);

        // If Monte Carlo says max drawdown too high — reduce size or skip
        if (!kelly.safe && kelly.dd > 25) {
          log.push(`[KELLY] Skipping — Monte Carlo DD ${kelly.dd}% exceeds 25% limit`);
          continue;
        }

        // ── STEP 7: Size the trade ────────────────────────────────────────────
        const bal = account.current_balance || 500000;
        const stopDist = Math.abs(entryPrice - signal.stop);

        // Kelly-informed risk: use kelly.riskPct but cap at hardcoded MAX_POSITION_PCT
        const kellyRiskPct = kelly.f > 0 ? Math.min(kelly.riskPct / 100, 0.02) : (job.timeframe === '5min' ? 0.005 : 0.01);
        const riskAmt = bal * kellyRiskPct;
        let size = stopDist > 0 ? riskAmt / stopDist : 0;
        let dollarSize = size * entryPrice;
        const maxDollar = bal * MAX_POSITION_PCT;
        if (dollarSize > maxDollar) { size = maxDollar / entryPrice; dollarSize = maxDollar; }

        // ── STEP 8: Execute trade ─────────────────────────────────────────────
        const { data: newTrade } = await supabase.from('sentinel_trades').insert({
          symbol: job.symbol,
          direction: signal.direction,
          setup: signal.setup,
          timeframe: job.timeframe,
          regime: `${signal.regime.trend}/${signal.regime.type}`,
          entry: parseFloat(entryPrice.toFixed(2)),
          stop: signal.stop,
          target: signal.target,
          size: parseFloat(size.toFixed(6)),
          dollar_size: parseFloat(dollarSize.toFixed(2)),
          risk_r: 1,
          reward_r: signal.rewardR,
          confidence: finalConf,
          reasons: [
            ...signal.reasons,
            `Bayesian posterior: ${(bayes.posterior * 100).toFixed(0)}%`,
            `Edge EV: ${edge.ev > 0 ? '+' : ''}${edge.ev}`,
            `Kelly size: ${(kelly.f * 100).toFixed(1)}%`,
          ],
          status: 'open',
          session_date: getETDate(),
          opened_at: new Date().toISOString(),
        }).select().single();

        await supabase.from('sentinel_account').update({
          total_trades: account.total_trades + 1,
          updated_at: new Date().toISOString(),
        }).eq('id', SENTINEL_ACCOUNT_ID);

        if (newTrade) {
          const { data: subs } = await supabase.from('sentinel_user_settings').select('*').eq('yolo_active', true).in('subscription_status', ['trialing', 'active']);
          for (const u of (subs || [])) {
            const uRisk = (u.allocated_capital || 5000) * ((u.risk_per_trade_pct || 1) / 100);
            const uSize = stopDist > 0 ? uRisk / stopDist : 0;
            await supabase.from('sentinel_copied_trades').insert({ user_id: u.user_id, sentinel_trade_id: newTrade.id, symbol: job.symbol, direction: signal.direction, entry: entryPrice, stop: signal.stop, target: signal.target, size: parseFloat(uSize.toFixed(6)), dollar_size: parseFloat((uSize * entryPrice).toFixed(2)), opened_at: new Date().toISOString(), status: 'open' });
            await supabase.from('sentinel_notifications').insert({ user_id: u.user_id, type: 'trade_opened', title: `⚡ Sentinel ${signal.direction} ${job.symbol.replace('/USD', '')}`, body: `Entry $${entryPrice.toLocaleString()} · Conf ${finalConf} · EV ${edge.ev > 0 ? '+' : ''}${edge.ev} · ${job.timeframe}`, trade_id: newTrade.id, read: false });
          }
        }

        newSignals++;
        openSymbols.add(job.symbol);
        log.push(`✓ OPENED ${signal.direction} ${job.symbol} ${job.timeframe} @ ${entryPrice} conf=${finalConf} EV=${edge.ev} Kelly=${kelly.f}`);

        // Store signal in sentinel_signals for Training Stream UI
        await supabase.from('sentinel_signals').insert({
          symbol: job.symbol,
          timeframe: job.timeframe,
          signal_type: 'TRADE_FIRED',
          direction: signal.direction,
          bayesian_prior: bayes.prior,
          bayesian_posterior: bayes.posterior,
          bayesian_ev: bayes.ev,
          bayesian_confidence: finalConf,
          edge_ev_net: edge.ev,
          edge_cost: edge.cost,
          edge_z_score: edge.zScore,
          edge_p_sum: edge.q,
          edge_pass: edge.pass,
          stoikov_q: stoikov.q,
          stoikov_gamma: stoikov.gamma,
          stoikov_sigma_sq: stoikov.sigma2,
          stoikov_reservation: stoikov.reservationPrice,
          stoikov_optimal_size: parseFloat(size.toFixed(2)),
          mc_paths_simulated: 500,
          mc_kelly_fraction: kelly.f,
          mc_max_dd_pct: kelly.dd,
          composite_score: finalConf,
          trade_fired: true,
          trade_id: newTrade?.id || null,
          price_at_signal: entryPrice,
          regime: `${signal.regime.trend}/${signal.regime.type}`,
        }).then(r => { if (r.error) log.push(`Signal store error: ${r.error.message}`); });

        await sleep(200);
      } catch (err) { log.push(`Error scanning ${job.symbol} ${job.timeframe}: ${err.message}`); }
    }

    // Also store SCAN signals (evaluations that didn't fire) for Training Stream
    // This shows the models are working even when no trade fires

    // ── Daily session rollover + trigger learn ────────────────────────────────
    const etHour = getETHour();
    const etMinute = getETMinute();
    if (etHour === 0 && etMinute < 2) {
      const today = getETDate();
      const { data: sess } = await supabase.from('sentinel_sessions').select('session_ended_at').eq('session_date', today).single();
      if (!sess?.session_ended_at) {
        await supabase.from('sentinel_sessions').upsert({ session_date: today, session_ended_at: new Date().toISOString() }, { onConflict: 'session_date' });
        fetch('https://stratifymarket.com/api/sentinel/learn');
        log.push('Daily learn triggered');
      }
    }

    // ── Update session record ─────────────────────────────────────────────────
    const today = getETDate();
    const { data: existingSession } = await supabase.from('sentinel_sessions').select('*').eq('session_date', today).maybeSingle();
    // Always recompute session stats from actual closed trades to prevent drift
    const { data: todayClosedTrades } = await supabase
      .from('sentinel_trades')
      .select('pnl, win')
      .eq('session_date', today)
      .eq('status', 'closed');

    const trueTotalPnl = parseFloat((todayClosedTrades || []).reduce((s, t) => s + (t.pnl || 0), 0).toFixed(2));
    const trueWins = (todayClosedTrades || []).filter(t => t.win).length;
    const trueLosses = (todayClosedTrades || []).length - trueWins;
    const trueClosed = (todayClosedTrades || []).length;

    if (existingSession) {
      await supabase.from('sentinel_sessions').update({
        trades_fired: (existingSession.trades_fired || 0) + newSignals,
        trades_closed: trueClosed,
        wins: trueWins,
        losses: trueLosses,
        gross_pnl: trueTotalPnl,
      }).eq('id', existingSession.id);
    } else {
      await supabase.from('sentinel_sessions').insert({ session_date: today, trades_fired: newSignals, trades_closed: trueClosed, wins: trueWins, losses: trueLosses, gross_pnl: trueTotalPnl, session_started_at: new Date().toISOString() });
    }

    return res.status(200).json({
      processed: true,
      cryptoSymbols: CRYPTO_SYMBOLS,
      openTradesChecked: openTrades?.length ?? 0,
      tradesClosed, newSignals,
      brain: {
        sessionsProcessed: brain.sessions_processed || 0,
        suspendedCount: suspended.length,
        accountWinRate: parseFloat((accountWinRate * 100).toFixed(1)),
      },
      duration: Date.now() - startTime,
      log,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('Sentinel crypto heartbeat error:', err);
    return res.status(500).json({ processed: false, error: err.message, log, timestamp: new Date().toISOString() });
  }
}
