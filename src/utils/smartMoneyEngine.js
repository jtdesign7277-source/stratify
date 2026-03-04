/**
 * Smart Money Structure — CHoCH + BOS + Multi-TF Trend Alignment
 * Converted from GainzAlgo Pine Script indicator
 *
 * Fixed: Pivot Length 5, Min Signal Distance 5, TP/SL Points 10
 * User configurable: stop_loss_multiplier, take_profit_multiplier
 */

const PIVOT_LENGTH = 5;
const MIN_SIGNAL_DISTANCE = 5;
const TP_POINTS = 10;
const SL_POINTS = 10;

// ── Helpers ──────────────────────────────────────────────────────────────────

function sma(arr, period) {
  if (arr.length < period) return null;
  const slice = arr.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function ema(arr, period) {
  if (arr.length === 0) return null;
  if (arr.length < period) {
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
  const k = 2 / (period + 1);
  let val = arr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < arr.length; i++) {
    val = arr[i] * k + val * (1 - k);
  }
  return val;
}

function atr(candles, period) {
  if (candles.length < 2) return 0;
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    trs.push(tr);
  }
  if (trs.length < period) return trs.reduce((a, b) => a + b, 0) / trs.length;
  // EMA-style ATR
  const k = 2 / (period + 1);
  let val = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) {
    val = trs[i] * k + val * (1 - k);
  }
  return val;
}

function rsi(candles, period = 14) {
  const values = [];
  if (candles.length < period + 1) return values;
  const gains = [];
  const losses = [];
  for (let i = 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }
  // First avg
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  // Fill initial slots with null
  for (let i = 0; i < period; i++) values.push(null);
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  values.push(100 - 100 / (1 + rs));
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    const r = avgLoss === 0 ? 100 : avgGain / avgLoss;
    values.push(100 - 100 / (1 + r));
  }
  return values;
}

// ── Pivot Detection ──────────────────────────────────────────────────────────

function detectPivots(candles, lookback) {
  const pivotHighs = new Array(candles.length).fill(null);
  const pivotLows = new Array(candles.length).fill(null);
  for (let i = lookback; i < candles.length - lookback; i++) {
    let isPH = true;
    let isPL = true;
    for (let j = 1; j <= lookback; j++) {
      if (candles[i].high <= candles[i - j].high || candles[i].high <= candles[i + j].high) isPH = false;
      if (candles[i].low >= candles[i - j].low || candles[i].low >= candles[i + j].low) isPL = false;
    }
    if (isPH) pivotHighs[i] = candles[i].high;
    if (isPL) pivotLows[i] = candles[i].low;
  }
  return { pivotHighs, pivotLows };
}

// ── Multi-TF Trend via EMA proxy ─────────────────────────────────────────────

function computeTrend(candles) {
  if (candles.length < 200) {
    return { trendStrength: 0, confidence: 50, trendDetails: [] };
  }
  const closes = candles.map(c => c.close);
  const currentClose = closes[closes.length - 1];

  const periods = [
    { period: 10, label: '5m' },
    { period: 20, label: '15m' },
    { period: 35, label: '30m' },
    { period: 50, label: '1H' },
    { period: 100, label: '4H' },
    { period: 200, label: '1D' },
  ];

  const details = periods.map(({ period, label }) => {
    const val = ema(closes, period);
    const direction = val === null ? 0 : currentClose > val ? 1 : currentClose < val ? -1 : 0;
    return { label, direction, emaValue: val };
  });

  const sum = details.reduce((acc, d) => acc + d.direction, 0);
  const trendStrength = Math.round((sum / details.length) * 100);

  // Confidence: count aligned directions
  const aligned = details.filter(d => d.direction === Math.sign(sum)).length;
  let confidence;
  if (aligned >= 6) confidence = 95;
  else if (aligned >= 5) confidence = 90;
  else if (aligned >= 4) confidence = 80;
  else if (aligned >= 3) confidence = 75;
  else if (aligned >= 2) confidence = 60;
  else confidence = 50;

  return { trendStrength, confidence, trendDetails: details };
}

// ── Filters ──────────────────────────────────────────────────────────────────

function momentumFilter(candles, period = 14) {
  const atrVal = atr(candles, period);
  if (atrVal === 0) return { passes: false, momentum: 0, atrVal: 0 };
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  if (!last || !prev) return { passes: false, momentum: 0, atrVal };
  const momentum = Math.abs(last.close - prev.close);
  return { passes: momentum > atrVal * 0.5, momentum, atrVal };
}

function volumeFilter(candles) {
  if (candles.length < 50) return false;
  const vols = candles.map(c => c.volume || 0);
  const currentVol = vols[vols.length - 1];
  const sma50 = sma(vols, 50);
  const sma5 = sma(vols.slice(-5), 5);
  const sma20 = sma(vols.slice(-20), 20);
  if (sma50 === null) return false;
  return currentVol > sma50 && (sma5 !== null && sma20 !== null && sma5 > sma20);
}

function breakoutFilter(candles, lookback = 20) {
  if (candles.length < lookback + 1) return { bullBreakout: false, bearBreakout: false };
  const slice = candles.slice(-lookback - 1, -1);
  const highestHigh = Math.max(...slice.map(c => c.high));
  const lowestLow = Math.min(...slice.map(c => c.low));
  const current = candles[candles.length - 1];
  return {
    bullBreakout: current.close > highestHigh,
    bearBreakout: current.close < lowestLow,
  };
}

// ── Divergence Scanner ───────────────────────────────────────────────────────

function scanDivergences(candles, rsiValues) {
  const divergences = [];
  const scanLen = Math.min(30, candles.length - 1);
  if (scanLen < 5 || rsiValues.length < candles.length) return divergences;

  for (let i = candles.length - scanLen; i < candles.length - 2; i++) {
    const j = candles.length - 1;
    const rsiI = rsiValues[i];
    const rsiJ = rsiValues[j];
    if (rsiI === null || rsiJ === null) continue;

    // Bullish divergence: price lower low, RSI higher low
    if (candles[j].low < candles[i].low && rsiJ > rsiI && rsiJ < 40) {
      divergences.push({ type: 'bullish', bar: j, time: candles[j].time, price: candles[j].low, rsi: rsiJ });
    }
    // Bearish divergence: price higher high, RSI lower high
    if (candles[j].high > candles[i].high && rsiJ < rsiI && rsiJ > 60) {
      divergences.push({ type: 'bearish', bar: j, time: candles[j].time, price: candles[j].high, rsi: rsiJ });
    }
  }

  // Deduplicate — keep one per type at the latest bar
  const seen = new Set();
  return divergences.filter(d => {
    const key = `${d.type}-${d.bar}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Liquidity Zones ──────────────────────────────────────────────────────────

function findLiquidityZones(candles, lookback = 50) {
  if (candles.length < lookback) return [];
  const slice = candles.slice(-lookback);
  const levels = [];

  slice.forEach(c => {
    levels.push(c.high);
    levels.push(c.low);
  });

  levels.sort((a, b) => a - b);

  // Cluster nearby levels (within 0.05% of each other)
  const zones = [];
  let i = 0;
  while (i < levels.length) {
    const cluster = [levels[i]];
    let j = i + 1;
    while (j < levels.length && (levels[j] - levels[i]) / levels[i] < 0.0005) {
      cluster.push(levels[j]);
      j++;
    }
    if (cluster.length >= 3) {
      const avg = cluster.reduce((a, b) => a + b, 0) / cluster.length;
      zones.push({ price: Math.round(avg * 100) / 100, count: cluster.length });
    }
    i = j;
  }

  return zones;
}

// ── Quality Score ────────────────────────────────────────────────────────────

function computeQualityScore(trendStrength, momentum, atrVal, volumePasses, confidence) {
  const trendAlignment = Math.min(1, Math.abs(trendStrength) / 100) * 0.4;
  const momentumStrength = atrVal > 0 ? Math.min(1, momentum / (atrVal * 2)) * 0.2 : 0;
  const volumeConfirmation = (volumePasses ? 1.0 : 0.3) * 0.2;
  const confidenceLevel = (confidence / 100) * 0.2;
  return Math.round((trendAlignment + momentumStrength + volumeConfirmation + confidenceLevel) * 100);
}

// ── Main Detection ───────────────────────────────────────────────────────────

export function detectSmartMoney(candles, userSettings = {}) {
  const {
    stop_loss_multiplier = 0.5,
    take_profit_multiplier = 2.5,
  } = userSettings;

  const empty = {
    signals: [], chochEvents: [], bosEvents: [],
    trendStrength: 0, confidence: 50, trendDetails: [],
    divergences: [], liquidityZones: [],
  };

  if (candles.length < 60) return empty;

  const { pivotHighs, pivotLows } = detectPivots(candles, PIVOT_LENGTH);
  const { trendStrength, confidence, trendDetails } = computeTrend(candles);
  const rsiValues = rsi(candles, 14);
  const divergences = scanDivergences(candles, rsiValues);
  const liquidityZones = findLiquidityZones(candles);

  // Track pivot history: last two pivot highs and lows
  let lastPH = null, prevPH = null;
  let lastPL = null, prevPL = null;

  const signals = [];
  const chochEvents = [];
  const bosEvents = [];
  let lastSignalBar = -MIN_SIGNAL_DISTANCE;

  for (let i = 0; i < candles.length; i++) {
    if (pivotHighs[i] !== null) {
      prevPH = lastPH;
      lastPH = { price: pivotHighs[i], bar: i };
    }
    if (pivotLows[i] !== null) {
      prevPL = lastPL;
      lastPL = { price: pivotLows[i], bar: i };
    }

    if (!lastPH || !lastPL || i < 20) continue;
    if (i - lastSignalBar < MIN_SIGNAL_DISTANCE) continue;

    const c = candles[i];
    const prev = candles[i - 1];
    if (!prev) continue;

    // ── CHoCH Detection ──────────────────────────────────────────────
    // CHoCH Sell: close breaks below last pivot high with bearish candle
    const chochSell = c.close < lastPH.price && prev.close >= lastPH.price && c.close < c.open;
    // CHoCH Buy: close breaks above last pivot low with bullish candle
    const chochBuy = c.close > lastPL.price && prev.close <= lastPL.price && c.close > c.open;

    if (chochSell || chochBuy) {
      const direction = chochBuy ? 'long' : 'short';
      const level = chochBuy ? lastPL.price : lastPH.price;

      chochEvents.push({
        bar: i, time: c.time, price: c.close,
        level, direction,
      });

      lastSignalBar = i;

      // Generate signal
      const momResult = momentumFilter(candles.slice(0, i + 1));
      const volPasses = volumeFilter(candles.slice(0, i + 1));
      const qualityScore = computeQualityScore(trendStrength, momResult.momentum, momResult.atrVal, volPasses, confidence);

      if (qualityScore >= 40) {
        const slDistance = momResult.atrVal * SL_POINTS * stop_loss_multiplier;
        const tpDistance = momResult.atrVal * TP_POINTS * take_profit_multiplier;
        const stopLoss = direction === 'long' ? c.close - slDistance : c.close + slDistance;
        const takeProfit = direction === 'long' ? c.close + tpDistance : c.close - tpDistance;

        signals.push({
          ticker: null, direction, timeframe: null,
          quality_score: qualityScore,
          is_hpz: qualityScore >= 80,
          entry_price: Math.round(c.close * 100) / 100,
          stop_loss: Math.round(stopLoss * 100) / 100,
          take_profit: Math.round(takeProfit * 100) / 100,
          ob_top: Math.round(Math.max(c.high, prev.high) * 100) / 100,
          ob_bottom: Math.round(Math.min(c.low, prev.low) * 100) / 100,
          msb_level: Math.round(level * 100) / 100,
          momentum_z: Math.round((momResult.momentum / (momResult.atrVal || 1)) * 100) / 100,
          detected_at: c.time, status: 'active',
          signal_type: 'CHoCH',
        });
      }
    }

    // ── BOS Detection ────────────────────────────────────────────────
    // BOS Sell: close breaks below previous pivot low (not most recent)
    const bosSell = prevPL && c.close < prevPL.price && prevPL.bar !== (lastPL?.bar);
    // BOS Buy: close breaks above previous pivot high (not most recent)
    const bosBuy = prevPH && c.close > prevPH.price && prevPH.bar !== (lastPH?.bar);

    if ((bosSell || bosBuy) && !chochSell && !chochBuy) {
      const direction = bosBuy ? 'long' : 'short';
      const level = bosBuy ? prevPH.price : prevPL.price;

      bosEvents.push({
        bar: i, time: c.time, price: c.close,
        level, direction,
      });

      lastSignalBar = i;

      const momResult = momentumFilter(candles.slice(0, i + 1));
      const volPasses = volumeFilter(candles.slice(0, i + 1));
      const qualityScore = computeQualityScore(trendStrength, momResult.momentum, momResult.atrVal, volPasses, confidence);

      if (qualityScore >= 40) {
        const slDistance = momResult.atrVal * SL_POINTS * stop_loss_multiplier;
        const tpDistance = momResult.atrVal * TP_POINTS * take_profit_multiplier;
        const stopLoss = direction === 'long' ? c.close - slDistance : c.close + slDistance;
        const takeProfit = direction === 'long' ? c.close + tpDistance : c.close - tpDistance;

        signals.push({
          ticker: null, direction, timeframe: null,
          quality_score: qualityScore,
          is_hpz: qualityScore >= 80,
          entry_price: Math.round(c.close * 100) / 100,
          stop_loss: Math.round(stopLoss * 100) / 100,
          take_profit: Math.round(takeProfit * 100) / 100,
          ob_top: Math.round(Math.max(c.high, prev.high) * 100) / 100,
          ob_bottom: Math.round(Math.min(c.low, prev.low) * 100) / 100,
          msb_level: Math.round(level * 100) / 100,
          momentum_z: Math.round((momResult.momentum / (momResult.atrVal || 1)) * 100) / 100,
          detected_at: c.time, status: 'active',
          signal_type: 'BOS',
        });
      }
    }
  }

  // Only return signals detected within the last 10 candles
  const recentSignals = signals.filter(s => {
    const bar = chochEvents.find(e => e.time === s.detected_at)?.bar
      || bosEvents.find(e => e.time === s.detected_at)?.bar;
    return bar == null || bar >= candles.length - 10;
  });

  return {
    signals: recentSignals,
    chochEvents,
    bosEvents,
    trendStrength,
    confidence,
    trendDetails,
    divergences,
    liquidityZones,
  };
}

export function createSmartMoneyDetector(userSettings = {}) {
  const candles = [];
  let results = {
    signals: [], chochEvents: [], bosEvents: [],
    trendStrength: 0, confidence: 50, trendDetails: [],
    divergences: [], liquidityZones: [],
  };
  return {
    addCandle(candle) {
      if (candles.length > 0 && candles[candles.length - 1].time === candle.time) {
        candles[candles.length - 1] = candle;
      } else {
        candles.push(candle);
      }
      results = detectSmartMoney(candles, userSettings);
      return results;
    },
    getResults() { return results; },
    getCandles() { return [...candles]; },
    setCandles(hist) {
      candles.length = 0;
      candles.push(...hist);
      results = detectSmartMoney(candles, userSettings);
      return results;
    },
  };
}
