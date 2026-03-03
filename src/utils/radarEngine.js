/**
 * Strategy Radar - MSB and Order Block Detection Engine
 * Converted from LuxAlgo Pine Script v6
 *
 * Fixed: Pivot Lookback 7, MSB Z-Score 0.5, Max OBs 10, Quality Threshold 50
 * User configurable: timeframe, stop_loss_multiplier, take_profit_multiplier, risk_per_trade
 */

const PIVOT_LOOKBACK = 7;
const MSB_ZSCORE_THRESHOLD = 0.5;
const MAX_ACTIVE_OBS = 10;
const OB_QUALITY_THRESHOLD = 50;

function sma(arr, period) {
  if (arr.length < period) return null;
  const slice = arr.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function stdev(arr, period) {
  if (arr.length < period) return null;
  const slice = arr.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const squaredDiffs = slice.map(v => Math.pow(v - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / period);
}

function percentRank(arr, period) {
  if (arr.length < period) return 50;
  const slice = arr.slice(-period);
  const current = slice[slice.length - 1];
  const below = slice.filter(v => v < current).length;
  return (below / period) * 100;
}

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

export function detectSignals(candles, userSettings = {}) {
  const {
    stop_loss_multiplier = 0.5,
    take_profit_multiplier = 2.5,
  } = userSettings;

  if (candles.length < 60) return { signals: [], orderBlocks: [], msbEvents: [], pivots: { highs: [], lows: [] } };

  const priceChanges = candles.map((c, i) => i > 0 ? c.close - candles[i - 1].close : 0);
  const volumes = candles.map(c => c.volume || 0);
  const { pivotHighs, pivotLows } = detectPivots(candles, PIVOT_LOOKBACK);

  let lastPH = null, lastPHIdx = null, lastPL = null, lastPLIdx = null;
  const signals = [];
  const orderBlocks = [];
  const msbEvents = [];

  for (let i = 0; i < candles.length; i++) {
    if (pivotHighs[i] !== null) { lastPH = pivotHighs[i]; lastPHIdx = i; }
    if (pivotLows[i] !== null) { lastPL = pivotLows[i]; lastPLIdx = i; }
    if (lastPH === null || lastPL === null || i < 51) continue;

    const changeSlice = priceChanges.slice(Math.max(0, i - 49), i + 1);
    const avgChange = sma(changeSlice, Math.min(50, changeSlice.length));
    const stdChange = stdev(changeSlice, Math.min(50, changeSlice.length));
    const momentumZ = stdChange > 0 ? (priceChanges[i] - avgChange) / stdChange : 0;
    const volSlice = volumes.slice(Math.max(0, i - 99), i + 1);
    const volPct = percentRank(volSlice, Math.min(100, volSlice.length));

    const isBullMSB = candles[i].close > lastPH && candles[i - 1].close <= lastPH && momentumZ > MSB_ZSCORE_THRESHOLD;
    const isBearMSB = candles[i].close < lastPL && candles[i - 1].close >= lastPL && momentumZ < -MSB_ZSCORE_THRESHOLD;

    if (isBullMSB || isBearMSB) {
      const direction = isBullMSB ? 'long' : 'short';
      const msbLevel = isBullMSB ? lastPH : lastPL;

      msbEvents.push({
        bar: i, time: candles[i].time, price: candles[i].close,
        level: msbLevel, direction, momentumZ,
      });

      let obIdx = 0;
      for (let j = 1; j <= Math.min(10, i); j++) {
        if (isBullMSB && candles[i - j].close < candles[i - j].open) { obIdx = j; break; }
        if (isBearMSB && candles[i - j].close > candles[i - j].open) { obIdx = j; break; }
      }

      if (obIdx > 0) {
        const obTop = candles[i - obIdx].high;
        const obBottom = candles[i - obIdx].low;
        const obPOC = (obTop + obBottom) / 2;
        const score = Math.min(100, (Math.abs(momentumZ) * 20) + (volPct * 0.5));
        const isHPZ = score > 80;
        const obZoneHeight = obTop - obBottom;
        const slDistance = obZoneHeight * stop_loss_multiplier;
        const stopLoss = direction === 'long' ? obBottom - slDistance : obTop + slDistance;
        const riskDistance = Math.abs(obPOC - stopLoss);
        const takeProfit = direction === 'long'
          ? obPOC + (riskDistance * take_profit_multiplier)
          : obPOC - (riskDistance * take_profit_multiplier);

        orderBlocks.push({
          bar: i - obIdx, msbBar: i, time: candles[i - obIdx].time, msbTime: candles[i].time,
          top: obTop, bottom: obBottom, poc: obPOC, score: Math.round(score),
          direction, isHPZ, mitigated: false, mitigatedBar: null, msbLevel, stopLoss, takeProfit,
        });

        if (score >= OB_QUALITY_THRESHOLD) {
          signals.push({
            ticker: null, direction, timeframe: null,
            quality_score: Math.round(score), is_hpz: isHPZ,
            ob_top: obTop, ob_bottom: obBottom, ob_poc: obPOC,
            msb_level: msbLevel, momentum_z: Math.round(momentumZ * 100) / 100,
            stop_loss: Math.round(stopLoss * 100) / 100,
            take_profit: Math.round(takeProfit * 100) / 100,
            entry_price: Math.round(obPOC * 100) / 100,
            detected_at: candles[i].time, status: 'active',
          });
        }
      }
      if (isBullMSB) lastPH = null; else lastPL = null;
    }

    for (const ob of orderBlocks) {
      if (ob.mitigated) continue;
      if (ob.direction === 'long' && candles[i].low < ob.bottom) {
        ob.mitigated = true; ob.mitigatedBar = i; ob.mitigatedTime = candles[i].time;
      }
      if (ob.direction === 'short' && candles[i].high > ob.top) {
        ob.mitigated = true; ob.mitigatedBar = i; ob.mitigatedTime = candles[i].time;
      }
    }

    while (orderBlocks.filter(ob => !ob.mitigated).length > MAX_ACTIVE_OBS) {
      const oldest = orderBlocks.find(ob => !ob.mitigated);
      if (oldest) oldest.mitigated = true;
    }
  }

  const pivotData = {
    highs: pivotHighs.map((v, i) => v !== null ? { time: candles[i].time, price: v } : null).filter(Boolean),
    lows: pivotLows.map((v, i) => v !== null ? { time: candles[i].time, price: v } : null).filter(Boolean),
  };

  // Only return signals detected within the last 10 candles
  const recentSignals = signals.filter(s => {
    const detectedBar = orderBlocks.find(ob =>
      ob.msbTime === s.detected_at && ob.direction === s.direction
    )?.msbBar;
    return detectedBar == null || detectedBar >= candles.length - 10;
  });

  return { signals: recentSignals, orderBlocks, msbEvents, pivots: pivotData };
}

export function createLiveDetector(userSettings = {}) {
  const candles = [];
  let results = { signals: [], orderBlocks: [], msbEvents: [], pivots: { highs: [], lows: [] } };
  return {
    addCandle(candle) {
      if (candles.length > 0 && candles[candles.length - 1].time === candle.time) {
        candles[candles.length - 1] = candle;
      } else { candles.push(candle); }
      results = detectSignals(candles, userSettings);
      return results;
    },
    getResults() { return results; },
    getCandles() { return [...candles]; },
    setCandles(hist) {
      candles.length = 0;
      candles.push(...hist);
      results = detectSignals(candles, userSettings);
      return results;
    },
  };
}
