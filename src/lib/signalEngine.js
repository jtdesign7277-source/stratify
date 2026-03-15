// Signal Engine — Technical analysis + signal generation for Sentinel AI
// Pure math, no API calls. Used by both frontend preview and serverless scan.

/**
 * Compute Exponential Moving Average
 * @param {number[]} values - Array of numeric values (oldest first)
 * @param {number} period - EMA period
 * @returns {number[]} EMA values (same length, first period-1 are NaN)
 */
export function computeEMA(values, period) {
  const ema = new Array(values.length).fill(NaN);
  if (values.length < period) return ema;

  // Seed with SMA
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  ema[period - 1] = sum / period;

  const k = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    ema[i] = values[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

/**
 * Compute RSI (Relative Strength Index)
 * @param {number[]} closes - Close prices (oldest first)
 * @param {number} period - RSI period (default 14)
 * @returns {number[]} RSI values (same length, first period are NaN)
 */
export function computeRSI(closes, period = 14) {
  const rsi = new Array(closes.length).fill(NaN);
  if (closes.length <= period) return rsi;

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}

/**
 * Compute ATR (Average True Range)
 * @param {Array<{high:number, low:number, close:number}>} bars - OHLC bars (oldest first)
 * @param {number} period - ATR period (default 14)
 * @returns {number[]} ATR values
 */
export function computeATR(bars, period = 14) {
  const atr = new Array(bars.length).fill(NaN);
  if (bars.length <= period) return atr;

  const trueRanges = [];
  for (let i = 0; i < bars.length; i++) {
    if (i === 0) {
      trueRanges.push(bars[i].high - bars[i].low);
    } else {
      const prevClose = bars[i - 1].close;
      const tr = Math.max(
        bars[i].high - bars[i].low,
        Math.abs(bars[i].high - prevClose),
        Math.abs(bars[i].low - prevClose)
      );
      trueRanges.push(tr);
    }
  }

  // Seed with simple average
  let sum = 0;
  for (let i = 0; i < period; i++) sum += trueRanges[i];
  atr[period - 1] = sum / period;

  for (let i = period; i < bars.length; i++) {
    atr[i] = (atr[i - 1] * (period - 1) + trueRanges[i]) / period;
  }
  return atr;
}

/**
 * Detect swing pivots (highs and lows)
 * @param {Array<{high:number, low:number}>} bars
 * @param {number} lookback - Bars to check on each side (default 3)
 * @returns {{pivotHighs: Array, pivotLows: Array}}
 */
export function detectPivots(bars, lookback = 3) {
  const pivotHighs = [];
  const pivotLows = [];

  for (let i = lookback; i < bars.length - lookback; i++) {
    let isHigh = true;
    let isLow = true;

    for (let j = 1; j <= lookback; j++) {
      if (bars[i].high <= bars[i - j].high || bars[i].high <= bars[i + j].high) {
        isHigh = false;
      }
      if (bars[i].low >= bars[i - j].low || bars[i].low >= bars[i + j].low) {
        isLow = false;
      }
    }

    if (isHigh) pivotHighs.push({ index: i, price: bars[i].high });
    if (isLow) pivotLows.push({ index: i, price: bars[i].low });
  }

  return { pivotHighs, pivotLows };
}

/**
 * Detect market regime
 * @param {number[]} closes - Close prices (oldest first)
 * @param {Array<{high:number, low:number, close:number}>} bars - OHLC bars
 * @returns {{regime: string, detail: string}}
 *   regime: 'BULL_TRENDING' | 'BEAR_TRENDING' | 'RANGING' | 'VOLATILE'
 */
export function detectRegime(closes, bars) {
  const ema20 = computeEMA(closes, 20);
  const ema50 = computeEMA(closes, 50);
  const atr = computeATR(bars, 14);
  const rsi = computeRSI(closes, 14);

  const last = closes.length - 1;
  const ema20Val = ema20[last];
  const ema50Val = ema50[last];
  const atrVal = atr[last];
  const rsiVal = rsi[last];
  const price = closes[last];

  if (isNaN(ema20Val) || isNaN(ema50Val) || isNaN(atrVal)) {
    return { regime: 'RANGING', detail: 'Insufficient data for regime detection' };
  }

  // Volatility check: ATR as % of price
  const atrPct = (atrVal / price) * 100;
  if (atrPct > 3.5) {
    return { regime: 'VOLATILE', detail: `ATR ${atrPct.toFixed(1)}% of price — high volatility` };
  }

  // Trend detection
  const emaSpread = ((ema20Val - ema50Val) / ema50Val) * 100;
  if (ema20Val > ema50Val && price > ema20Val && emaSpread > 0.5) {
    return { regime: 'BULL_TRENDING', detail: `Price above EMA20 > EMA50, spread ${emaSpread.toFixed(2)}%` };
  }
  if (ema20Val < ema50Val && price < ema20Val && emaSpread < -0.5) {
    return { regime: 'BEAR_TRENDING', detail: `Price below EMA20 < EMA50, spread ${emaSpread.toFixed(2)}%` };
  }

  return { regime: 'RANGING', detail: `EMAs converged, RSI ${rsiVal?.toFixed(0) || '?'}` };
}

/**
 * Generate trading signal from OHLCV bars
 * @param {string} symbol
 * @param {Array<{open:number, high:number, low:number, close:number, volume:number}>} bars - Oldest first
 * @param {string} timeframe - e.g. '5m', '15m', '1h', '4h', '1D'
 * @returns {Object} signal
 */
export function generateSignal(symbol, bars, timeframe) {
  if (!bars || bars.length < 50) {
    return {
      symbol,
      timeframe,
      direction: 'WAIT',
      confidence: 0,
      regime: 'UNKNOWN',
      setup: null,
      entry: null,
      stop: null,
      target: null,
      reasons: ['Insufficient data (need 50+ bars)'],
    };
  }

  const closes = bars.map((b) => b.close);
  const last = bars.length - 1;
  const price = closes[last];

  // Indicators
  const ema9 = computeEMA(closes, 9);
  const ema21 = computeEMA(closes, 21);
  const ema50 = computeEMA(closes, 50);
  const rsi = computeRSI(closes, 14);
  const atr = computeATR(bars, 14);
  const { pivotHighs, pivotLows } = detectPivots(bars, 3);
  const { regime, detail: regimeDetail } = detectRegime(closes, bars);

  const rsiVal = rsi[last];
  const atrVal = atr[last];
  const ema9Val = ema9[last];
  const ema21Val = ema21[last];
  const ema50Val = ema50[last];

  if (isNaN(rsiVal) || isNaN(atrVal) || isNaN(ema9Val) || isNaN(ema21Val)) {
    return {
      symbol, timeframe, direction: 'WAIT', confidence: 0, regime,
      setup: null, entry: null, stop: null, target: null,
      reasons: ['Indicators not yet computed'],
    };
  }

  const reasons = [];
  let direction = 'WAIT';
  let confidence = 50;
  let setup = null;

  // === LONG SIGNALS ===

  // EMA crossover: 9 crosses above 21 with price above 50
  const prevEma9 = ema9[last - 1];
  const prevEma21 = ema21[last - 1];
  if (prevEma9 <= prevEma21 && ema9Val > ema21Val && price > ema50Val) {
    direction = 'LONG';
    setup = 'EMA Crossover';
    confidence = 62;
    reasons.push('EMA9 crossed above EMA21');
    reasons.push('Price above EMA50');
  }

  // Break & Retest: price pulled back to EMA21 in uptrend
  if (direction === 'WAIT' && regime === 'BULL_TRENDING') {
    const distToEma21 = Math.abs(price - ema21Val) / atrVal;
    if (distToEma21 < 0.5 && rsiVal > 40 && rsiVal < 60) {
      direction = 'LONG';
      setup = 'Break & Retest';
      confidence = 65;
      reasons.push('Price retesting EMA21 in bull trend');
      reasons.push(`RSI neutral at ${rsiVal.toFixed(0)}`);
    }
  }

  // RSI oversold bounce in uptrend
  if (direction === 'WAIT' && rsiVal < 35 && price > ema50Val) {
    direction = 'LONG';
    setup = 'RSI Oversold Bounce';
    confidence = 58;
    reasons.push(`RSI oversold at ${rsiVal.toFixed(0)}`);
    reasons.push('Price still above EMA50');
  }

  // === SHORT SIGNALS ===

  // EMA crossover: 9 crosses below 21 with price below 50
  if (direction === 'WAIT' && prevEma9 >= prevEma21 && ema9Val < ema21Val && price < ema50Val) {
    direction = 'SHORT';
    setup = 'EMA Crossover';
    confidence = 62;
    reasons.push('EMA9 crossed below EMA21');
    reasons.push('Price below EMA50');
  }

  // Break & Retest short: price pulled back to EMA21 in downtrend
  if (direction === 'WAIT' && regime === 'BEAR_TRENDING') {
    const distToEma21 = Math.abs(price - ema21Val) / atrVal;
    if (distToEma21 < 0.5 && rsiVal > 55 && rsiVal < 70) {
      direction = 'SHORT';
      setup = 'Break & Retest';
      confidence = 65;
      reasons.push('Price retesting EMA21 in bear trend');
      reasons.push(`RSI neutral at ${rsiVal.toFixed(0)}`);
    }
  }

  // RSI overbought rejection in downtrend
  if (direction === 'WAIT' && rsiVal > 70 && price < ema50Val) {
    direction = 'SHORT';
    setup = 'RSI Overbought Rejection';
    confidence = 58;
    reasons.push(`RSI overbought at ${rsiVal.toFixed(0)}`);
    reasons.push('Price below EMA50');
  }

  // === REGIME ADJUSTMENTS ===
  if (regime === 'VOLATILE') {
    confidence = Math.max(0, confidence - 15);
    reasons.push('Volatile regime: confidence reduced');
  }
  if (regime === 'RANGING' && setup === 'EMA Crossover') {
    confidence = Math.max(0, confidence - 10);
    reasons.push('Ranging regime: crossover less reliable');
  }

  // Entry, stop, target
  let entry = price;
  let stop = null;
  let target = null;
  let rewardR = null;

  if (direction === 'LONG') {
    stop = price - atrVal * 1.5;
    target = price + atrVal * 3;
    rewardR = 2;
    // Recent pivot low as alternative stop
    if (pivotLows.length > 0) {
      const recentLow = pivotLows[pivotLows.length - 1].price;
      if (recentLow > stop && recentLow < price) {
        stop = recentLow - atrVal * 0.2; // Slight buffer below pivot
      }
    }
  } else if (direction === 'SHORT') {
    stop = price + atrVal * 1.5;
    target = price - atrVal * 3;
    rewardR = 2;
    if (pivotHighs.length > 0) {
      const recentHigh = pivotHighs[pivotHighs.length - 1].price;
      if (recentHigh < stop && recentHigh > price) {
        stop = recentHigh + atrVal * 0.2;
      }
    }
  }

  return {
    symbol,
    timeframe,
    direction,
    confidence: Math.round(Math.min(100, Math.max(0, confidence))),
    regime,
    regimeDetail,
    setup,
    entry: entry ? +entry.toFixed(4) : null,
    stop: stop ? +stop.toFixed(4) : null,
    target: target ? +target.toFixed(4) : null,
    rewardR,
    atr: atrVal ? +atrVal.toFixed(4) : null,
    rsi: rsiVal ? +rsiVal.toFixed(1) : null,
    ema9: ema9Val ? +ema9Val.toFixed(4) : null,
    ema21: ema21Val ? +ema21Val.toFixed(4) : null,
    ema50: ema50Val ? +ema50Val.toFixed(4) : null,
    reasons,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Apply brain memory weights to a signal
 * @param {Object} signal - Output from generateSignal
 * @param {Object} memory - sentinel_memory row from Supabase
 * @returns {Object} Adjusted signal
 */
export function applyMemoryWeights(signal, memory) {
  if (!memory || !signal) return signal;

  const adjusted = { ...signal, reasons: [...(signal.reasons || [])] };

  // Check suspended conditions
  const suspended = memory.suspended_conditions || [];
  for (const condition of suspended) {
    const condLower = (condition || '').toLowerCase();
    const symbolMatch = condLower.includes(signal.symbol?.toLowerCase());
    const regimeMatch = condLower.includes(signal.regime?.toLowerCase());
    const setupMatch = signal.setup && condLower.includes(signal.setup.toLowerCase());

    if (symbolMatch || (regimeMatch && setupMatch)) {
      adjusted.direction = 'WAIT';
      adjusted.confidence = 0;
      adjusted.reasons.push(`Suspended by brain memory: ${condition}`);
      return adjusted;
    }
  }

  if (adjusted.direction === 'WAIT') return adjusted;

  let delta = 0;

  // Setup weights
  const setupWeights = memory.setup_weights || {};
  if (signal.setup && signal.timeframe) {
    const key = `${signal.setup} ${signal.timeframe}`;
    if (typeof setupWeights[key] === 'number') {
      delta += setupWeights[key];
      adjusted.reasons.push(`Brain: ${signal.setup} ${signal.timeframe} ${setupWeights[key] > 0 ? '+' : ''}${setupWeights[key]}`);
    }
    if (typeof setupWeights[signal.setup] === 'number') {
      delta += setupWeights[signal.setup];
    }
  }

  // Regime filters
  const regimeFilters = memory.regime_filters || {};
  if (signal.regime && regimeFilters[signal.regime] === 'avoid') {
    delta -= 15;
    adjusted.reasons.push(`Brain: avoiding ${signal.regime} regime`);
  } else if (signal.regime && regimeFilters[signal.regime] === 'prefer') {
    delta += 5;
  }

  // Ticker weights
  const tickerWeights = memory.ticker_weights || {};
  if (signal.symbol && typeof tickerWeights[signal.symbol] === 'number') {
    delta += tickerWeights[signal.symbol];
    adjusted.reasons.push(`Brain: ${signal.symbol} weight ${tickerWeights[signal.symbol] > 0 ? '+' : ''}${tickerWeights[signal.symbol]}`);
  }

  // Timeframe weights
  const timeframeWeights = memory.timeframe_weights || {};
  if (signal.timeframe && typeof timeframeWeights[signal.timeframe] === 'number') {
    delta += timeframeWeights[signal.timeframe];
  }

  // Confidence adjustments (most specific)
  const confAdj = memory.confidence_adjustments || {};
  for (const [key, val] of Object.entries(confAdj)) {
    if (typeof val !== 'number') continue;
    const keyLower = key.toLowerCase();
    const matchesSetup = signal.setup && keyLower.includes(signal.setup.toLowerCase());
    const matchesTimeframe = signal.timeframe && keyLower.includes(signal.timeframe.toLowerCase());
    const matchesRegime = signal.regime && keyLower.includes(signal.regime.toLowerCase());

    if (matchesSetup && matchesTimeframe) {
      delta += val;
    } else if (matchesSetup && matchesRegime) {
      delta += val;
    }
  }

  adjusted.confidence = Math.round(Math.min(100, Math.max(0, signal.confidence + delta)));

  if (delta !== 0) {
    adjusted.reasons.push(`Brain net adjustment: ${delta > 0 ? '+' : ''}${delta}`);
  }

  return adjusted;
}
