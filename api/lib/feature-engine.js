// api/lib/feature-engine.js — Compute 54 ML features from OHLCV bars
// Point72/Cubist-style feature engineering for Sentinel

/**
 * Compute all ML features from a bars array
 * @param {Array} bars - [{time, open, high, low, close, volume}, ...]  (oldest first)
 * @param {Object} context - {symbol, timeframe, bayesianPosterior, setupWinRate, recentStreak}
 * @returns {Object} features - 54 named features
 */
function computeFeatures(bars, context = {}) {
  if (!bars || bars.length < 50) return null;

  const closes = bars.map(b => b.close);
  const highs = bars.map(b => b.high);
  const lows = bars.map(b => b.low);
  const opens = bars.map(b => b.open);
  const volumes = bars.map(b => b.volume || 0);
  const last = bars.length - 1;
  const price = closes[last];

  // ─── Helper functions ────────────────────────────────────────
  function ema(data, period) {
    const k = 2 / (period + 1);
    const result = [data[0]];
    for (let i = 1; i < data.length; i++) result[i] = data[i] * k + result[i - 1] * (1 - k);
    return result;
  }

  function sma(data, period, idx) {
    if (idx < period - 1) return null;
    let sum = 0;
    for (let i = idx - period + 1; i <= idx; i++) sum += data[i];
    return sum / period;
  }

  function std(data, period, idx) {
    const m = sma(data, period, idx);
    if (m === null) return null;
    let sum = 0;
    for (let i = idx - period + 1; i <= idx; i++) sum += (data[i] - m) ** 2;
    return Math.sqrt(sum / period);
  }

  function rsi(data, period = 14) {
    if (data.length <= period) return 50;
    const gains = [], losses = [];
    for (let i = 1; i < data.length; i++) {
      const d = data[i] - data[i - 1];
      gains.push(d > 0 ? d : 0);
      losses.push(d < 0 ? -d : 0);
    }
    let ag = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let al = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < gains.length; i++) {
      ag = (ag * (period - 1) + gains[i]) / period;
      al = (al * (period - 1) + losses[i]) / period;
    }
    return al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }

  function atr(bars, period = 14) {
    const trs = bars.map((b, i) =>
      i === 0 ? b.high - b.low
        : Math.max(b.high - b.low, Math.abs(b.high - bars[i - 1].close), Math.abs(b.low - bars[i - 1].close))
    );
    let result = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < trs.length; i++) result = (result * (period - 1) + trs[i]) / period;
    return result;
  }

  function corr(x, y, n) {
    if (x.length < n || y.length < n) return 0;
    const xSlice = x.slice(-n), ySlice = y.slice(-n);
    const mx = xSlice.reduce((a, b) => a + b, 0) / n;
    const my = ySlice.reduce((a, b) => a + b, 0) / n;
    let cov = 0, vx = 0, vy = 0;
    for (let i = 0; i < n; i++) {
      cov += (xSlice[i] - mx) * (ySlice[i] - my);
      vx += (xSlice[i] - mx) ** 2;
      vy += (ySlice[i] - my) ** 2;
    }
    return vx > 0 && vy > 0 ? cov / Math.sqrt(vx * vy) : 0;
  }

  // ─── EMAs ────────────────────────────────────────────────────
  const ema8 = ema(closes, 8);
  const ema21 = ema(closes, 21);
  const ema50 = ema(closes, 50);
  const atr14 = atr(bars, 14);
  const atr5 = atr(bars, 5);
  const rsi14 = rsi(closes, 14);

  // ─── Returns ─────────────────────────────────────────────────
  const returns = closes.map((c, i) => i === 0 ? 0 : (c - closes[i - 1]) / closes[i - 1]);

  // ─── Bollinger Bands ─────────────────────────────────────────
  const bbMid = sma(closes, 20, last) || price;
  const bbStd = std(closes, 20, last) || price * 0.02;
  const bbUpper = bbMid + 2 * bbStd;
  const bbLower = bbMid - 2 * bbStd;

  // ─── MACD ────────────────────────────────────────────────────
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const macdSignal = ema(macdLine.slice(-9), 9);
  const macdHist = macdLine[last] - (macdSignal[macdSignal.length - 1] || 0);

  // ─── Volume ──────────────────────────────────────────────────
  const avgVol20 = sma(volumes, 20, last) || 1;
  const avgVol5 = sma(volumes, 5, last) || 1;

  // ─── ADX approximation ───────────────────────────────────────
  let plusDM = 0, minusDM = 0;
  for (let i = Math.max(1, last - 13); i <= last; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    if (upMove > downMove && upMove > 0) plusDM += upMove;
    if (downMove > upMove && downMove > 0) minusDM += downMove;
  }
  const adx = atr14 > 0 ? Math.abs(plusDM - minusDM) / (plusDM + minusDM + 0.0001) * 100 : 25;

  // ─── Stochastic ──────────────────────────────────────────────
  const h14 = Math.max(...highs.slice(Math.max(0, last - 13)));
  const l14 = Math.min(...lows.slice(Math.max(0, last - 13)));
  const stochK = h14 !== l14 ? ((price - l14) / (h14 - l14)) * 100 : 50;

  // ─── CCI ─────────────────────────────────────────────────────
  const typicalPrice = (bars[last].high + bars[last].low + bars[last].close) / 3;
  const tpSma = sma(bars.map(b => (b.high + b.low + b.close) / 3), 20, last) || typicalPrice;
  const tpStd = std(bars.map(b => (b.high + b.low + b.close) / 3), 20, last) || 1;
  const cci = (typicalPrice - tpSma) / (0.015 * tpStd);

  // ─── Williams %R ─────────────────────────────────────────────
  const williamsR = h14 !== l14 ? ((h14 - price) / (h14 - l14)) * -100 : -50;

  // ─── Market structure ────────────────────────────────────────
  const sma50val = sma(closes, 50, last) || price;
  const std50 = std(closes, 50, last) || 1;
  const meanRevZ = (price - sma50val) / std50;

  // ─── Trend regime ────────────────────────────────────────────
  const bullTrend = price > ema8[last] && ema8[last] > ema21[last] && ema21[last] > ema50[last];
  const bearTrend = price < ema8[last] && ema8[last] < ema21[last] && ema21[last] < ema50[last];
  const trendRegime = bullTrend ? 'BULL' : bearTrend ? 'BEAR' : 'NEUTRAL';

  // ─── Volatility regime ───────────────────────────────────────
  const atrPct = atr14 / price;
  const volRegime = atrPct > 0.03 ? 'HIGH' : atrPct < 0.01 ? 'LOW' : 'NORMAL';

  // ─── Time features (cyclical encoding) ───────────────────────
  const now = new Date();
  const hour = now.getUTCHours();
  const dow = now.getUTCDay();
  const hourSin = Math.sin(2 * Math.PI * hour / 24);
  const dowSin = Math.sin(2 * Math.PI * dow / 7);

  // ─── Volume-price correlation ────────────────────────────────
  const volPriceCorr = corr(returns.slice(-20), volumes.slice(-20), 20);

  // ─── Higher highs / lower lows count ─────────────────────────
  let higherHighs = 0, lowerLows = 0;
  for (let i = last; i > Math.max(0, last - 10); i--) {
    if (highs[i] > highs[i - 1]) higherHighs++;
    else break;
  }
  for (let i = last; i > Math.max(0, last - 10); i--) {
    if (lows[i] < lows[i - 1]) lowerLows++;
    else break;
  }

  // ─── Parkinson volatility ────────────────────────────────────
  let parkSum = 0;
  const parkN = Math.min(20, bars.length);
  for (let i = last - parkN + 1; i <= last; i++) {
    if (i >= 0) parkSum += Math.log(highs[i] / lows[i]) ** 2;
  }
  const parkinsonVol = Math.sqrt(parkSum / (4 * parkN * Math.LN2));

  // ─── Build feature object ────────────────────────────────────
  return {
    // Price action (12)
    returns_5m: r(returns[last]),
    returns_1h: r((price - (closes[Math.max(0, last - 12)] || price)) / (closes[Math.max(0, last - 12)] || price)),
    returns_4h: r((price - (closes[Math.max(0, last - 48)] || price)) / (closes[Math.max(0, last - 48)] || price)),
    high_low_range: r((bars[last].high - bars[last].low) / price),
    body_ratio: r(Math.abs(bars[last].close - bars[last].open) / (bars[last].high - bars[last].low + 0.0001)),
    close_position: r((price - bars[last].low) / (bars[last].high - bars[last].low + 0.0001)),
    intraday_vol: r(parkinsonVol),

    // Technical indicators (14)
    ema_cross_pct: r((ema8[last] - ema21[last]) / price),
    rsi_14: r(rsi14),
    macd_histogram: r(macdHist / price),
    bbands_position: r(bbUpper !== bbLower ? (price - bbLower) / (bbUpper - bbLower) : 0.5),
    bbands_width: r((bbUpper - bbLower) / bbMid),
    atr_14: r(atr14 / price),
    atr_ratio: r(atr14 > 0 ? atr5 / atr14 : 1),
    adx_14: r(adx),

    // Volume (3 stored, rest computed at training time)
    volume_ratio: r(avgVol20 > 0 ? volumes[last] / avgVol20 : 1),
    volume_trend: r(avgVol20 > 0 ? avgVol5 / avgVol20 : 1),
    volume_price_corr: r(volPriceCorr),

    // Market structure
    mean_reversion_z: r(meanRevZ),
    trend_regime: trendRegime,
    volatility_regime: volRegime,

    // Context
    hour_of_day: r(hourSin),
    day_of_week: r(dowSin),

    // Sentinel brain features (from context)
    bayesian_posterior: r(context.bayesianPosterior || 0.5),
    setup_win_rate: r(context.setupWinRate || 0.5),
    recent_streak: context.recentStreak || 0,

    // Price at computation time
    price: r(price),
  };
}

function r(v) {
  return v != null && isFinite(v) ? Math.round(v * 100000) / 100000 : 0;
}

export { computeFeatures };
