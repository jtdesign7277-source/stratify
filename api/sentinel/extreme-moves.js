// api/sentinel/extreme-moves.js
// Sentinel extreme move detection + post-mortem analysis
//
// GET /api/sentinel/extreme-moves?limit=20
//   → returns recent extreme moves, current danger level, and stats (public)
//
// POST /api/sentinel/extreme-moves
//   Auth: Bearer CRON_SECRET
//   Body: { symbol, bars (last 100+ 5-min bars), currentPrice }
//   → detects crashes/rips in the last 30 min, runs post-mortem on pre-move conditions,
//     saves to sentinel_extreme_moves, then updates sentinel_danger_level via cosine similarity.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─── Technical helpers ────────────────────────────────────────────────────────

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
  if (bars.length >= period) {
    result[period - 1] = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < bars.length; i++) result[i] = (result[i - 1] * (period - 1) + trs[i]) / period;
  }
  return result;
}

function detectRegimeString(bars) {
  if (bars.length < 20) return 'NEUTRAL/RANGING';
  const closes = bars.map(b => b.close);
  const ema8 = computeEMA(closes, 8);
  const ema21 = computeEMA(closes, 21);
  const atr = computeATR(bars, 14);
  const last = closes.length - 1;
  const price = closes[last];
  const atrSlice = atr.slice(Math.max(0, last - 20), last + 1).filter(v => v > 0);
  const avgATR = atrSlice.length ? atrSlice.reduce((a, b) => a + b, 0) / atrSlice.length : 0;
  const atrRatio = avgATR > 0 ? atr[last] / avgATR : 1;
  if (atrRatio > 2) return 'NEUTRAL/VOLATILE';
  const bull = price > ema8[last] && ema8[last] > ema21[last];
  const bear = price < ema8[last] && ema8[last] < ema21[last];
  const trending = last >= 5 ? Math.abs(ema21[last] - ema21[last - 5]) > (atr[last] || 0) * 0.3 : false;
  if (bull) return `BULL/${trending ? 'TRENDING' : 'RANGING'}`;
  if (bear) return `BEAR/${trending ? 'TRENDING' : 'RANGING'}`;
  return 'NEUTRAL/RANGING';
}

// ─── Post-mortem: extract pre-move features from the 48 bars before a move ────

function extractPreMoveFeatures(preBars) {
  if (preBars.length < 10) return null;

  const closes = preBars.map(b => b.close);
  const volumes = preBars.map(b => b.volume || 0);
  const atrArr = computeATR(preBars, 14);
  const rsiArr = computeRSI(closes, 14);
  const ema8arr = computeEMA(closes, 8);
  const ema21arr = computeEMA(closes, 21);
  const last = preBars.length - 1;

  // Volume pattern: compare first-half avg to second-half avg
  const half = Math.floor(volumes.length / 2);
  const volFirst = volumes.slice(0, half).reduce((a, b) => a + b, 0) / Math.max(1, half);
  const volSecond = volumes.slice(half).reduce((a, b) => a + b, 0) / Math.max(1, volumes.length - half);
  const pre_volume_pattern =
    volSecond > volFirst * 1.1 ? 'increasing' :
    volSecond < volFirst * 0.9 ? 'decreasing' : 'stable';

  // ATR compression: recent ATR vs 20-period ATR average (below 0.6 = compressed)
  const recentATR = atrArr[last] || 0;
  const atrWindow = atrArr.slice(Math.max(0, last - 20), last + 1).filter(v => v > 0);
  const avgATR20 = atrWindow.length ? atrWindow.reduce((a, b) => a + b, 0) / atrWindow.length : recentATR;
  const pre_atr_compression = avgATR20 > 0 ? recentATR / avgATR20 : 1;

  // Spread trend: compare candle high-low spans between halves
  const spreadFirst = preBars.slice(0, half).map(b => b.high - b.low).reduce((a, b) => a + b, 0) / Math.max(1, half);
  const spreadSecond = preBars.slice(half).map(b => b.high - b.low).reduce((a, b) => a + b, 0) / Math.max(1, preBars.length - half);
  const pre_spread_trend =
    spreadSecond > spreadFirst * 1.1 ? 'widening' :
    spreadSecond < spreadFirst * 0.9 ? 'narrowing' : 'stable';

  // RSI immediately before the move
  const pre_rsi = rsiArr[last];

  // EMA alignment: are EMAs converging (squeeze) or diverging?
  const emaDiff = Math.abs(ema8arr[last] - ema21arr[last]);
  const emaDiffPrev = last >= 5 ? Math.abs(ema8arr[last - 5] - ema21arr[last - 5]) : emaDiff;
  const pre_ema_alignment =
    emaDiff < emaDiffPrev * 0.85 ? 'converging' :
    emaDiff > emaDiffPrev * 1.15 ? 'diverging' : 'stable';

  // Regime just before the move
  const pre_regime = detectRegimeString(preBars);

  // Volume ratio: last 12 bars (~1 hr at 5-min) vs all pre bars avg
  const lastHourVols = volumes.slice(Math.max(0, last - 11), last + 1);
  const lastHourAvg = lastHourVols.reduce((a, b) => a + b, 0) / Math.max(1, lastHourVols.length);
  const allAvg = volumes.reduce((a, b) => a + b, 0) / Math.max(1, volumes.length);
  const pre_volume_ratio = allAvg > 0 ? lastHourAvg / allAvg : 1;

  // Order flow imbalance: ratio of up-candles to total in last 24 bars
  const ofLookback = preBars.slice(Math.max(0, last - 23), last + 1);
  const upCandles = ofLookback.filter(b => b.close > b.open).length;
  const pre_order_flow_imbalance = ofLookback.length > 0 ? upCandles / ofLookback.length : 0.5;

  // Normalized signature vector (6 dimensions, all 0–1)
  // [atr_compression, rsi_norm, volume_ratio_norm, order_flow, volume_increasing, ema_converging]
  const signature_vector = [
    Math.min(1, Math.max(0, pre_atr_compression)),
    pre_rsi / 100,
    Math.min(1, Math.max(0, pre_volume_ratio / 3)),
    pre_order_flow_imbalance,
    pre_volume_pattern === 'increasing' ? 1 : pre_volume_pattern === 'stable' ? 0.5 : 0,
    pre_ema_alignment === 'converging' ? 1 : pre_ema_alignment === 'stable' ? 0.5 : 0,
  ].map(v => parseFloat(v.toFixed(4)));

  return {
    pre_volume_pattern,
    pre_atr_compression: parseFloat(pre_atr_compression.toFixed(4)),
    pre_spread_trend,
    pre_rsi: parseFloat(pre_rsi.toFixed(2)),
    pre_ema_alignment,
    pre_regime,
    pre_volume_ratio: parseFloat(pre_volume_ratio.toFixed(4)),
    pre_order_flow_imbalance: parseFloat(pre_order_flow_imbalance.toFixed(4)),
    signature_vector,
  };
}

// ─── Cosine similarity between two signature vectors ─────────────────────────

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom > 0 ? parseFloat((dot / denom).toFixed(4)) : 0;
}

// ─── Danger level: compare current signature to all stored extreme moves ──────

async function computeDangerLevel(currentSig) {
  const { data: allMoves } = await supabase
    .from('sentinel_extreme_moves')
    .select('signature_vector, type, magnitude_pct')
    .not('signature_vector', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (!allMoves || allMoves.length === 0) {
    return { score: 0, label: 'NORMAL', factors: ['No historical extremes on record'], nearest_similarity: 0 };
  }

  let maxSim = 0;
  let nearestType = 'CRASH';
  for (const move of allMoves) {
    const sim = cosineSimilarity(currentSig, move.signature_vector);
    if (sim > maxSim) { maxSim = sim; nearestType = move.type; }
  }

  const score = Math.round(maxSim * 100);
  const factors = [];
  let label = 'NORMAL';

  if (maxSim > 0.70) {
    label = 'EXTREME';
    factors.push(`Conditions ${(maxSim * 100).toFixed(0)}% similar to prior ${nearestType} — do not enter`);
  } else if (maxSim > 0.50) {
    label = 'HIGH';
    factors.push(`Conditions ${(maxSim * 100).toFixed(0)}% similar to prior ${nearestType} — reduce confidence`);
  } else if (maxSim > 0.30) {
    label = 'ELEVATED';
    factors.push(`Partial match (${(maxSim * 100).toFixed(0)}%) to prior ${nearestType} — watch closely`);
  } else {
    factors.push('Current conditions differ from known extreme move signatures');
  }

  return { score, label, factors, nearest_similarity: maxSim };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {

  // ── GET: public dashboard read ────────────────────────────────────────────
  if (req.method === 'GET') {
    const limit = Math.min(100, parseInt(req.query.limit || '20', 10));

    const [movesRes, dangerRes] = await Promise.all([
      supabase
        .from('sentinel_extreme_moves')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('sentinel_danger_level')
        .select('*')
        .eq('id', 1)
        .single(),
    ]);

    const moves = movesRes.data || [];
    const danger = dangerRes.data || { score: 0, label: 'NORMAL', factors: [] };

    const crashes = moves.filter(m => m.type === 'CRASH').length;
    const rips = moves.filter(m => m.type === 'RIP').length;
    const avgMagnitude =
      moves.length > 0
        ? parseFloat((moves.reduce((s, m) => s + Math.abs(m.magnitude_pct || 0), 0) / moves.length).toFixed(2))
        : 0;

    return res.status(200).json({
      moves,
      dangerLevel: {
        score: danger.score || 0,
        label: danger.label || 'NORMAL',
        factors: danger.factors || [],
      },
      stats: { totalMoves: moves.length, crashes, rips, avgMagnitude },
    });
  }

  // ── POST: detect extreme move + update danger level ───────────────────────
  if (req.method === 'POST') {
    const auth = req.headers.authorization || '';
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { symbol, bars, currentPrice } = req.body || {};
    if (!symbol || !Array.isArray(bars) || bars.length < 10) {
      return res.status(400).json({ error: 'symbol and bars (10+ candles) required' });
    }

    const result = { symbol, detected: false, moveType: null, magnitude_pct: null, dangerLevel: null };

    // ── Step 1: Check last 6 bars (30 min) for an extreme move ───────────
    const recentBars = bars.slice(-6);
    const windowOpen = recentBars[0].open;
    const windowClose = recentBars[recentBars.length - 1].close;
    const movePct = ((windowClose - windowOpen) / windowOpen) * 100;
    const absMove = Math.abs(movePct);

    if (absMove > 2) {
      result.detected = true;
      result.moveType = movePct < 0 ? 'CRASH' : 'RIP';
      result.magnitude_pct = parseFloat(movePct.toFixed(4));

      // ── Step 2: Post-mortem — 48 bars before the move window ──────────
      const preBars = bars.slice(
        Math.max(0, bars.length - 54),  // 48 pre + 6 move bars
        bars.length - 6
      );
      const features = extractPreMoveFeatures(preBars);

      // ── Step 3: Save to sentinel_extreme_moves ─────────────────────────
      if (features) {
        const startBar = recentBars[0];
        const endBar = recentBars[recentBars.length - 1];
        await supabase.from('sentinel_extreme_moves').insert({
          symbol,
          type: result.moveType,
          magnitude_pct: result.magnitude_pct,
          start_price: startBar.open,
          end_price: endBar.close,
          start_time: new Date(startBar.time).toISOString(),
          end_time: new Date(endBar.time).toISOString(),
          pre_volume_pattern: features.pre_volume_pattern,
          pre_atr_compression: features.pre_atr_compression,
          pre_spread_trend: features.pre_spread_trend,
          pre_rsi: features.pre_rsi,
          pre_ema_alignment: features.pre_ema_alignment,
          pre_regime: features.pre_regime,
          pre_volume_ratio: features.pre_volume_ratio,
          pre_order_flow_imbalance: features.pre_order_flow_imbalance,
          signature_vector: features.signature_vector,
          created_at: new Date().toISOString(),
        });
      }
    }

    // ── Step 4: Compute danger level from CURRENT conditions ─────────────
    // Use the 48 bars before the recent 6 as a proxy for "right now"
    const currentPreBars = bars.slice(
      Math.max(0, bars.length - 54),
      bars.length - 6
    );
    const currentFeatures = extractPreMoveFeatures(
      currentPreBars.length >= 10 ? currentPreBars : bars.slice(-48)
    );

    if (currentFeatures) {
      const danger = await computeDangerLevel(currentFeatures.signature_vector);
      result.dangerLevel = danger;

      // ── Step 5: Upsert sentinel_danger_level ──────────────────────────
      await supabase.from('sentinel_danger_level').upsert(
        {
          id: 1,
          score: danger.score,
          label: danger.label,
          factors: danger.factors,
          nearest_similarity: danger.nearest_similarity,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    }

    return res.status(200).json({ ok: true, ...result });
  }

  return res.status(405).json({ error: 'GET or POST only' });
}
