// api/sentinel/autoresearch.js
// Sentinel Autoresearch Loop — Karpathy-style parameter search for trading
// POST /api/sentinel/autoresearch
// Auth: Bearer CRON_SECRET
//
// Runs N iterations of: tweak one param → backtest → keep/discard based on composite score
// All trades are simulated in-memory. Writes results to sentinel_experiments + sentinel_best_params.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TWELVE_DATA_API_KEY =
  process.env.TWELVE_DATA_API_KEY ||
  process.env.TWELVEDATA_API_KEY ||
  process.env.VITE_TWELVE_DATA_API_KEY ||
  process.env.VITE_TWELVEDATA_API_KEY;

// ─── Tunable parameters ───────────────────────────────────────────────────────

const TUNABLE_PARAMS = {
  bayes_threshold:           { default: 0.45, min: 0.30, max: 0.70, step: 0.02 },
  min_confidence_scalp:      { default: 55,   min: 45,   max: 75,   step: 2 },
  stop_mult_scalp:           { default: 0.75, min: 0.4,  max: 1.2,  step: 0.05 },
  target_mult_scalp:         { default: 1.5,  min: 1.0,  max: 3.0,  step: 0.1 },
  ema_fast:                  { default: 8,    min: 5,    max: 15,   step: 1 },
  ema_slow:                  { default: 21,   min: 15,   max: 35,   step: 1 },
  rsi_oversold:              { default: 32,   min: 25,   max: 40,   step: 1 },
  rsi_overbought:            { default: 68,   min: 60,   max: 75,   step: 1 },
  momentum_burst_threshold:  { default: 0.03, min: 0.01, max: 0.10, step: 0.005 },
  mean_reversion_threshold:  { default: 0.15, min: 0.05, max: 0.30, step: 0.01 },
  spread_cost_pct:           { default: 0.001,min: 0.0005,max: 0.003,step: 0.0002 },
  kelly_max_risk:            { default: 0.005,min: 0.002, max: 0.015,step: 0.001 },
  mc_max_drawdown:           { default: 0.15, min: 0.08,  max: 0.25, step: 0.01 },
};

function getDefaults() {
  const p = {};
  for (const [k, v] of Object.entries(TUNABLE_PARAMS)) p[k] = v.default;
  return p;
}

// ─── Technical indicators (copied exactly from heartbeat-crypto.js) ───────────

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
    if (i > period) {
      ag = (ag * (period - 1) + gains[i - 1]) / period;
      al = (al * (period - 1) + losses[i - 1]) / period;
    }
    result[i] = parseFloat((100 - 100 / (1 + (al === 0 ? 100 : ag / al))).toFixed(2));
  }
  return result;
}

function computeATR(bars, period = 14) {
  if (!bars.length) return [];
  const trs = bars.map((b, i) =>
    i === 0
      ? b.high - b.low
      : Math.max(b.high - b.low, Math.abs(b.high - bars[i - 1].close), Math.abs(b.low - bars[i - 1].close))
  );
  const result = new Array(bars.length).fill(0);
  result[period - 1] = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < bars.length; i++) result[i] = (result[i - 1] * (period - 1) + trs[i]) / period;
  return result;
}

function detectRegime(bars, params) {
  if (bars.length < 50) return { trend: 'NEUTRAL', type: 'RANGING', volatility: 'NORMAL' };
  const closes = bars.map(b => b.close);
  const ema8 = computeEMA(closes, params.ema_fast);
  const ema21 = computeEMA(closes, params.ema_slow);
  const atr = computeATR(bars, 14);
  const last = closes.length - 1, price = closes[last];
  const atrSlice = atr.slice(Math.max(0, last - 20), last + 1).filter(v => v > 0);
  const avgATR = atrSlice.reduce((a, b) => a + b, 0) / atrSlice.length;
  const atrRatio = avgATR > 0 ? atr[last] / avgATR : 1;
  const volatility = atrRatio > 1.5 ? 'HIGH' : atrRatio < 0.6 ? 'LOW' : 'NORMAL';
  if (volatility === 'HIGH' && atrRatio > 2) return { trend: 'NEUTRAL', type: 'VOLATILE', volatility: 'HIGH' };
  const bull = price > ema8[last] && ema8[last] > ema21[last];
  const bear = price < ema8[last] && ema8[last] < ema21[last];
  const trending = Math.abs(last >= 5 ? ema21[last] - ema21[last - 5] : 0) > atr[last] * 0.3;
  if (bull) return { trend: 'BULL', type: trending ? 'TRENDING' : 'RANGING', volatility };
  if (bear) return { trend: 'BEAR', type: trending ? 'TRENDING' : 'RANGING', volatility };
  return { trend: 'NEUTRAL', type: 'RANGING', volatility };
}

// ─── Parameterized signal generator ──────────────────────────────────────────

function generateSignalParameterized(bars, params, barIndex) {
  // Use bars up to barIndex (walk-forward safe)
  const slice = bars.slice(0, barIndex + 1);
  if (slice.length < 50) return null;

  const closes = slice.map(b => b.close);
  const volumes = slice.map(b => b.volume);
  const ema8arr = computeEMA(closes, params.ema_fast);
  const ema21arr = computeEMA(closes, params.ema_slow);
  const rsiArr = computeRSI(closes, 14);
  const atrArr = computeATR(slice, 14);
  const last = slice.length - 1;
  const price = closes[last];
  const ema8 = ema8arr[last], ema21 = ema21arr[last];
  const rsi = rsiArr[last], atr = atrArr[last];
  if (atr === 0) return null;

  const volSlice = volumes.slice(Math.max(0, last - 20), last + 1);
  const avgVol = volSlice.reduce((a, b) => a + b, 0) / volSlice.length;
  const aboveAvgVol = volumes[last] > avgVol;

  const regime = detectRegime(slice, params);

  let direction = 'WAIT', confidence = 0, setup = 'No Setup';

  // Primary momentum scoring (same logic as heartbeat-crypto.js)
  const longScore = [
    price > ema8, ema8 > ema21, rsi >= 40 && rsi <= 65, aboveAvgVol, regime.trend === 'BULL',
  ].filter(Boolean).length;
  const shortScore = [
    price < ema8, ema8 < ema21, rsi >= 35 && rsi <= 60, aboveAvgVol, regime.trend === 'BEAR',
  ].filter(Boolean).length;

  if (longScore >= 3 || shortScore >= 3) {
    direction = longScore >= shortScore ? 'LONG' : 'SHORT';
    const score = direction === 'LONG' ? longScore : shortScore;
    confidence = Math.min(100, Math.round(
      (score / 5) * 80 +
      (aboveAvgVol ? 10 : 0) +
      ((direction === 'LONG' ? regime.trend === 'BULL' : regime.trend === 'BEAR') ? 10 : 0)
    ));
    setup = direction === 'LONG' ? 'Momentum Long' : 'Momentum Short';
  }

  // Scalp-only setups (parameterized thresholds)
  if (direction === 'WAIT') {
    const pctAboveE8 = ((price - ema8) / ema8) * 100;
    const burstT = params.momentum_burst_threshold * 100; // convert to pct
    if (pctAboveE8 > burstT && pctAboveE8 < burstT * 10 && rsi > 50 && rsi < 72 && ema8 > ema21) {
      direction = 'LONG'; setup = 'Momentum Burst'; confidence = 58;
    }
    if (direction === 'WAIT' && pctAboveE8 < -burstT && pctAboveE8 > -burstT * 10 && rsi < 50 && rsi > 28 && ema8 < ema21) {
      direction = 'SHORT'; setup = 'Momentum Burst'; confidence = 58;
    }
    const pctFromE21 = ((price - ema21) / ema21) * 100;
    const revT = params.mean_reversion_threshold * 100;
    if (direction === 'WAIT' && pctFromE21 < -revT && rsi < params.rsi_oversold) {
      direction = 'LONG'; setup = 'Mean Reversion'; confidence = 57;
    }
    if (direction === 'WAIT' && pctFromE21 > revT && rsi > params.rsi_overbought) {
      direction = 'SHORT'; setup = 'Mean Reversion'; confidence = 57;
    }
    if (direction === 'WAIT' && Math.abs(price - ema8) / atr < 0.3 && ema8 > ema21 && rsi > 45 && rsi < 62) {
      direction = 'LONG'; setup = 'EMA8 Bounce'; confidence = 56;
    }
    if (direction === 'WAIT' && Math.abs(price - ema8) / atr < 0.3 && ema8 < ema21 && rsi > 38 && rsi < 55) {
      direction = 'SHORT'; setup = 'EMA8 Bounce'; confidence = 56;
    }
  }

  if (direction === 'WAIT') return null;
  if (regime.type === 'VOLATILE') confidence = Math.max(0, confidence - 5);

  // Confidence gate
  if (confidence < params.min_confidence_scalp) return null;

  // Bayesian gate (simplified: use posterior from confidence as proxy)
  const posterior = confidence / 100;
  if (posterior < params.bayes_threshold) return null;

  // Entry / stop / target (parameterized)
  const stop = direction === 'LONG'
    ? price - atr * params.stop_mult_scalp
    : price + atr * params.stop_mult_scalp;
  const stopDist = Math.abs(price - stop);
  const target = direction === 'LONG'
    ? price + stopDist * params.target_mult_scalp
    : price - stopDist * params.target_mult_scalp;

  return { direction, confidence, entry: price, stop, target, setup, atr, regime };
}

// ─── In-memory backtester ─────────────────────────────────────────────────────

function runBacktest(bars, params) {
  const MAX_TRADES_PER_DAY = 15;
  const MIN_CANDLES_BETWEEN_TRADES = 5; // 25 min at 5-min bars

  const trades = [];
  let openTrade = null;
  let lastTradeCandle = -MIN_CANDLES_BETWEEN_TRADES;
  let dailyTradeCounts = {};
  let equity = 1.0;
  let peak = 1.0;
  let maxDrawdown = 0;

  // Walk candles forward, starting after warmup
  for (let i = 50; i < bars.length; i++) {
    const bar = bars[i];
    const dateKey = new Date(bar.time).toISOString().slice(0, 10);

    // Check open trade first
    if (openTrade) {
      const { direction, entry, stop, target } = openTrade;

      // Check if stop or target hit on this candle (use high/low)
      let closed = false, win = false, exitPrice = 0;
      if (direction === 'LONG') {
        if (bar.low <= stop) { closed = true; win = false; exitPrice = stop; }
        else if (bar.high >= target) { closed = true; win = true; exitPrice = target; }
      } else {
        if (bar.high >= stop) { closed = true; win = false; exitPrice = stop; }
        else if (bar.low <= target) { closed = true; win = true; exitPrice = target; }
      }

      if (closed) {
        const rawPnl = direction === 'LONG' ? (exitPrice - entry) / entry : (entry - exitPrice) / entry;
        const pnl = rawPnl - params.spread_cost_pct;
        const riskPct = params.kelly_max_risk;
        const pnlEquity = pnl * riskPct / Math.abs((stop - entry) / entry);
        equity *= (1 + Math.max(-riskPct * 3, Math.min(riskPct * params.target_mult_scalp * 2, pnlEquity)));
        if (equity > peak) peak = equity;
        const dd = (peak - equity) / peak;
        if (dd > maxDrawdown) maxDrawdown = dd;

        trades.push({ win, pnl, direction: openTrade.direction, setup: openTrade.setup });
        openTrade = null;
        lastTradeCandle = i;
      }
      continue; // one open trade at a time
    }

    // Cooldown check
    if (i - lastTradeCandle < MIN_CANDLES_BETWEEN_TRADES) continue;

    // Daily cap
    const dayCount = dailyTradeCounts[dateKey] || 0;
    if (dayCount >= MAX_TRADES_PER_DAY) continue;

    // Generate signal on bars up to this point
    const signal = generateSignalParameterized(bars, params, i);
    if (!signal) continue;

    // Open trade
    openTrade = {
      direction: signal.direction,
      entry: signal.entry,
      stop: signal.stop,
      target: signal.target,
      setup: signal.setup,
      openCandle: i,
    };
    dailyTradeCounts[dateKey] = dayCount + 1;
  }

  // Close any still-open trade at last price
  if (openTrade) {
    const lastBar = bars[bars.length - 1];
    const exitPrice = lastBar.close;
    const { direction, entry, stop } = openTrade;
    const rawPnl = direction === 'LONG' ? (exitPrice - entry) / entry : (entry - exitPrice) / entry;
    const pnl = rawPnl - params.spread_cost_pct;
    const win = pnl > 0;
    trades.push({ win, pnl, direction, setup: openTrade.setup });
  }

  if (trades.length === 0) {
    return { winRate: 0, totalPnl: 0, maxDrawdown: 0, tradeCount: 0, score: 0 };
  }

  const winCount = trades.filter(t => t.win).length;
  const winRate = winCount / trades.length;
  const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);

  return { winRate, totalPnl, maxDrawdown, tradeCount: trades.length, trades };
}

// ─── Composite scoring ────────────────────────────────────────────────────────

function computeScore(result, pnlMin, pnlMax) {
  const { winRate, totalPnl, maxDrawdown, tradeCount } = result;
  if (tradeCount < 5) return 0; // not enough trades to trust

  // Normalize PnL to [0, 1] range based on observed range across iterations
  const pnlRange = pnlMax - pnlMin;
  const normPnl = pnlRange > 0 ? (totalPnl - pnlMin) / pnlRange : 0.5;

  return winRate * 0.5 + normPnl * 0.3 + (1 - Math.min(1, maxDrawdown)) * 0.2;
}

// ─── Parameter tweaking ───────────────────────────────────────────────────────

function tweakParams(currentParams) {
  const keys = Object.keys(TUNABLE_PARAMS);
  const key = keys[Math.floor(Math.random() * keys.length)];
  const spec = TUNABLE_PARAMS[key];

  // Random perturbation: ±1–3 steps
  const steps = Math.floor(Math.random() * 3) + 1;
  const sign = Math.random() < 0.5 ? 1 : -1;
  const delta = sign * steps * spec.step;

  const raw = currentParams[key] + delta;
  const clamped = Math.min(spec.max, Math.max(spec.min, raw));

  // Round to avoid floating-point drift
  const decimals = spec.step < 0.01 ? 4 : spec.step < 0.1 ? 3 : spec.step < 1 ? 2 : 0;
  const newVal = parseFloat(clamped.toFixed(decimals));

  return { ...currentParams, [key]: newVal }, key, newVal;
}

// Destructuring-friendly wrapper
function applyTweak(currentParams) {
  const keys = Object.keys(TUNABLE_PARAMS);
  const key = keys[Math.floor(Math.random() * keys.length)];
  const spec = TUNABLE_PARAMS[key];

  const steps = Math.floor(Math.random() * 3) + 1;
  const sign = Math.random() < 0.5 ? 1 : -1;
  const delta = sign * steps * spec.step;
  const raw = currentParams[key] + delta;
  const clamped = Math.min(spec.max, Math.max(spec.min, raw));
  const decimals = spec.step < 0.01 ? 4 : spec.step < 0.1 ? 3 : spec.step < 1 ? 2 : 0;
  const newVal = parseFloat(clamped.toFixed(decimals));

  const newParams = { ...currentParams, [key]: newVal };
  return { newParams, tweakedKey: key, tweakedVal: newVal };
}

// ─── Fetch 7 days of 5-min BTC/USD candles ───────────────────────────────────

async function fetchCandles() {
  const url = `https://api.twelvedata.com/time_series?symbol=BTC/USD&interval=5min&outputsize=2016&apikey=${TWELVE_DATA_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Twelve Data HTTP ${res.status}`);
  const data = await res.json();
  if (!data.values || !Array.isArray(data.values)) {
    throw new Error(`No candle data: ${JSON.stringify(data).slice(0, 200)}`);
  }
  // Oldest first
  return data.values.reverse().map(v => ({
    time: Date.parse(v.datetime),
    open: +v.open,
    high: +v.high,
    low: +v.low,
    close: +v.close,
    volume: +(v.volume || 0),
  }));
}

// ─── Load / save best params in Supabase ─────────────────────────────────────

async function loadBestParams() {
  const { data } = await supabase
    .from('sentinel_best_params')
    .select('*')
    .order('composite_score', { ascending: false })
    .limit(1)
    .single();
  return data ? data.parameters : getDefaults();
}

async function saveBestParams(params, score, meta) {
  await supabase.from('sentinel_best_params').upsert(
    { id: 1, parameters: params, composite_score: score, updated_at: new Date().toISOString(), ...meta },
    { onConflict: 'id' }
  );
}

async function logExperiment(tag, iteration, tweakedKey, tweakedVal, result, score, status, newParams, prevParams) {
  const wins = result.trades ? result.trades.filter(t => t.win).length : 0;
  const losses = result.trades ? result.trades.filter(t => !t.win).length : 0;
  const { error } = await supabase.from('sentinel_experiments').insert({
    experiment_tag: tag,
    iteration,
    parameters: newParams,
    previous_parameters: prevParams || null,
    changed_param: tweakedKey,
    changed_from: prevParams ? prevParams[tweakedKey] : null,
    changed_to: tweakedVal,
    backtest_window_days: 7,
    backtest_trades: result.tradeCount,
    backtest_wins: wins,
    backtest_losses: losses,
    backtest_win_rate: result.winRate,
    backtest_total_pnl: result.totalPnl,
    backtest_max_drawdown: result.maxDrawdown,
    backtest_avg_r: null,
    composite_score: score,
    status,
    created_at: new Date().toISOString(),
  });
  if (error) console.error('[autoresearch] logExperiment error:', error.message, error.details);
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'POST or GET only' });
  }

  // Auth — accept Bearer token (POST) or x-vercel-cron-secret header (GET cron)
  const auth = req.headers.authorization || '';
  const cronHeader = req.headers['x-vercel-cron-secret'] || '';
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || (auth !== `Bearer ${cronSecret}` && cronHeader !== cronSecret)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // For GET (cron), read params from query string; for POST, read from body
  const source = req.method === 'GET' ? req.query : (req.body || {});
  const { tag = 'default', iterations = 10 } = source;
  const maxIter = Math.min(100, Math.max(1, parseInt(iterations, 10) || 10));

  if (!TWELVE_DATA_API_KEY) return res.status(500).json({ error: 'Missing TWELVE_DATA_API_KEY' });

  const runId = `${tag}-${Date.now()}`;
  const log = [];

  try {
    // 1. Fetch candles
    log.push('Fetching 7 days of BTC/USD 5-min candles...');
    const bars = await fetchCandles();
    log.push(`Fetched ${bars.length} candles`);

    // 2. Load current best params
    let bestParams = await loadBestParams();
    log.push(`Loaded params for tag="${tag}"`);

    // 3. Baseline backtest
    const baseResult = runBacktest(bars, bestParams);
    log.push(`Baseline: ${baseResult.tradeCount} trades, WR=${(baseResult.winRate * 100).toFixed(1)}%, PnL=${baseResult.totalPnl.toFixed(4)}, DD=${(baseResult.maxDrawdown * 100).toFixed(1)}%`);

    // Collect PnL range across iterations for normalization
    const allPnls = [baseResult.totalPnl];
    const pendingResults = [];

    // First pass: run all iterations, collect raw results
    const iterData = [];
    let currentParams = { ...bestParams };

    for (let iter = 1; iter <= maxIter; iter++) {
      const prevParams = { ...currentParams };
      const { newParams, tweakedKey, tweakedVal } = applyTweak(currentParams);
      const result = runBacktest(bars, newParams);
      allPnls.push(result.totalPnl);
      iterData.push({ iter, newParams, tweakedKey, tweakedVal, result, prevParams });
    }

    const pnlMin = Math.min(...allPnls);
    const pnlMax = Math.max(...allPnls);

    // Compute baseline score with full normalization range
    let bestScore = computeScore(baseResult, pnlMin, pnlMax);

    // Second pass: apply keep/discard logic and persist
    const summary = { kept: 0, discarded: 0, iterations: maxIter };

    for (const { iter, newParams, tweakedKey, tweakedVal, result, prevParams } of iterData) {
      const score = computeScore(result, pnlMin, pnlMax);
      const improved = score > bestScore;
      const status = improved ? 'keep' : 'discard';

      if (improved) {
        bestScore = score;
        currentParams = { ...newParams };
        summary.kept++;
      } else {
        summary.discarded++;
      }

      // Log to sentinel_experiments
      await logExperiment(tag, iter, tweakedKey, tweakedVal, result, score, status, newParams, prevParams);

      log.push(
        `[${iter}/${maxIter}] tweak ${tweakedKey}=${tweakedVal} → WR=${(result.winRate * 100).toFixed(1)}% PnL=${result.totalPnl.toFixed(4)} DD=${(result.maxDrawdown * 100).toFixed(1)}% score=${score.toFixed(4)} → ${status.toUpperCase()}`
      );
    }

    // Save best params if improved
    if (summary.kept > 0) {
      const finalResult = runBacktest(bars, currentParams);
      await saveBestParams(currentParams, bestScore, {
        win_rate: finalResult.winRate,
      });
      log.push(`Saved improved params (score=${bestScore.toFixed(4)})`);
    } else {
      log.push('No improvement found — best params unchanged');
    }

    return res.status(200).json({
      ok: true,
      tag,
      run_id: runId,
      iterations: maxIter,
      candles: bars.length,
      summary,
      best_score: parseFloat(bestScore.toFixed(4)),
      best_params: currentParams,
      log,
    });
  } catch (err) {
    console.error('[autoresearch] error:', err);
    return res.status(500).json({ ok: false, error: err.message, log });
  }
}
