// api/sentinel/scan.js — Scan a symbol for Sentinel signals
// GET ?symbol=AAPL&timeframe=1h

import { createClient } from '@supabase/supabase-js';
import redis from '../lib/redis.js';

const TWELVE_DATA_KEY =
  process.env.TWELVEDATA_API_KEY ||
  process.env.TWELVE_DATA_API_KEY ||
  process.env.VITE_TWELVE_DATA_API_KEY ||
  process.env.VITE_TWELVEDATA_API_KEY;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const INTERVAL_MAP = {
  '5m': '5min',
  '15m': '15min',
  '1h': '1h',
  '4h': '4h',
  '1D': '1day',
};

// Inline signal engine for serverless (ESM import from src/ doesn't work in Vercel API)
function computeEMA(values, period) {
  const ema = new Array(values.length).fill(NaN);
  if (values.length < period) return ema;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  ema[period - 1] = sum / period;
  const k = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    ema[i] = values[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

function computeRSI(closes, period = 14) {
  const rsi = new Array(closes.length).fill(NaN);
  if (closes.length <= period) return rsi;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change; else avgLoss += Math.abs(change);
  }
  avgGain /= period; avgLoss /= period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (change > 0 ? change : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (change < 0 ? Math.abs(change) : 0)) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}

function computeATR(bars, period = 14) {
  const atr = new Array(bars.length).fill(NaN);
  if (bars.length <= period) return atr;
  const trs = bars.map((b, i) => {
    if (i === 0) return b.high - b.low;
    const pc = bars[i - 1].close;
    return Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc));
  });
  let sum = 0;
  for (let i = 0; i < period; i++) sum += trs[i];
  atr[period - 1] = sum / period;
  for (let i = period; i < bars.length; i++) atr[i] = (atr[i - 1] * (period - 1) + trs[i]) / period;
  return atr;
}

function detectPivots(bars, lookback = 3) {
  const pivotHighs = [], pivotLows = [];
  for (let i = lookback; i < bars.length - lookback; i++) {
    let isH = true, isL = true;
    for (let j = 1; j <= lookback; j++) {
      if (bars[i].high <= bars[i - j].high || bars[i].high <= bars[i + j].high) isH = false;
      if (bars[i].low >= bars[i - j].low || bars[i].low >= bars[i + j].low) isL = false;
    }
    if (isH) pivotHighs.push({ index: i, price: bars[i].high });
    if (isL) pivotLows.push({ index: i, price: bars[i].low });
  }
  return { pivotHighs, pivotLows };
}

function detectRegime(closes, bars) {
  const ema20 = computeEMA(closes, 20);
  const ema50 = computeEMA(closes, 50);
  const atr = computeATR(bars, 14);
  const last = closes.length - 1;
  const e20 = ema20[last], e50 = ema50[last], a = atr[last], p = closes[last];
  if (isNaN(e20) || isNaN(e50) || isNaN(a)) return { regime: 'RANGING', detail: 'Insufficient data' };
  const atrPct = (a / p) * 100;
  if (atrPct > 3.5) return { regime: 'VOLATILE', detail: `ATR ${atrPct.toFixed(1)}%` };
  const spread = ((e20 - e50) / e50) * 100;
  if (e20 > e50 && p > e20 && spread > 0.5) return { regime: 'BULL_TRENDING', detail: `Spread ${spread.toFixed(2)}%` };
  if (e20 < e50 && p < e20 && spread < -0.5) return { regime: 'BEAR_TRENDING', detail: `Spread ${spread.toFixed(2)}%` };
  return { regime: 'RANGING', detail: 'EMAs converged' };
}

function generateSignal(symbol, bars, timeframe) {
  if (!bars || bars.length < 50) {
    return { symbol, timeframe, direction: 'WAIT', confidence: 0, regime: 'UNKNOWN', setup: null, entry: null, stop: null, target: null, reasons: ['Insufficient data'] };
  }
  const closes = bars.map(b => b.close);
  const last = bars.length - 1;
  const price = closes[last];
  const ema9 = computeEMA(closes, 9), ema21 = computeEMA(closes, 21), ema50 = computeEMA(closes, 50);
  const rsi = computeRSI(closes, 14), atr = computeATR(bars, 14);
  const { pivotHighs, pivotLows } = detectPivots(bars, 3);
  const { regime } = detectRegime(closes, bars);
  const r = rsi[last], a = atr[last], e9 = ema9[last], e21 = ema21[last], e50 = ema50[last];
  if (isNaN(r) || isNaN(a) || isNaN(e9) || isNaN(e21)) {
    return { symbol, timeframe, direction: 'WAIT', confidence: 0, regime, setup: null, entry: null, stop: null, target: null, reasons: ['Indicators not computed'] };
  }
  const reasons = [];
  let direction = 'WAIT', confidence = 50, setup = null;
  const pe9 = ema9[last - 1], pe21 = ema21[last - 1];
  if (pe9 <= pe21 && e9 > e21 && price > e50) { direction = 'LONG'; setup = 'EMA Crossover'; confidence = 62; reasons.push('EMA9 crossed above EMA21', 'Price above EMA50'); }
  if (direction === 'WAIT' && regime === 'BULL_TRENDING') { const d = Math.abs(price - e21) / a; if (d < 0.5 && r > 40 && r < 60) { direction = 'LONG'; setup = 'Break & Retest'; confidence = 65; reasons.push('Retesting EMA21 in bull trend'); } }
  if (direction === 'WAIT' && r < 35 && price > e50) { direction = 'LONG'; setup = 'RSI Oversold Bounce'; confidence = 58; reasons.push(`RSI oversold ${r.toFixed(0)}`); }
  if (direction === 'WAIT' && pe9 >= pe21 && e9 < e21 && price < e50) { direction = 'SHORT'; setup = 'EMA Crossover'; confidence = 62; reasons.push('EMA9 crossed below EMA21'); }
  if (direction === 'WAIT' && regime === 'BEAR_TRENDING') { const d = Math.abs(price - e21) / a; if (d < 0.5 && r > 55 && r < 70) { direction = 'SHORT'; setup = 'Break & Retest'; confidence = 65; reasons.push('Retesting EMA21 in bear trend'); } }
  if (direction === 'WAIT' && r > 70 && price < e50) { direction = 'SHORT'; setup = 'RSI Overbought Rejection'; confidence = 58; reasons.push(`RSI overbought ${r.toFixed(0)}`); }
  if (regime === 'VOLATILE') { confidence = Math.max(0, confidence - 15); reasons.push('Volatile regime'); }
  if (regime === 'RANGING' && setup === 'EMA Crossover') { confidence = Math.max(0, confidence - 10); reasons.push('Ranging regime'); }
  let entry = price, stop = null, target = null;
  if (direction === 'LONG') { stop = price - a * 1.5; target = price + a * 3; if (pivotLows.length) { const pl = pivotLows[pivotLows.length - 1].price; if (pl > stop && pl < price) stop = pl - a * 0.2; } }
  else if (direction === 'SHORT') { stop = price + a * 1.5; target = price - a * 3; if (pivotHighs.length) { const ph = pivotHighs[pivotHighs.length - 1].price; if (ph < stop && ph > price) stop = ph + a * 0.2; } }
  return { symbol, timeframe, direction, confidence: Math.round(Math.min(100, Math.max(0, confidence))), regime, setup, entry: entry ? +entry.toFixed(4) : null, stop: stop ? +stop.toFixed(4) : null, target: target ? +target.toFixed(4) : null, rewardR: direction !== 'WAIT' ? 2 : null, atr: a ? +a.toFixed(4) : null, rsi: r ? +r.toFixed(1) : null, reasons, generatedAt: new Date().toISOString() };
}

function applyMemoryWeights(signal, memory) {
  if (!memory || !signal) return signal;
  const adj = { ...signal, reasons: [...(signal.reasons || [])] };
  const suspended = memory.suspended_conditions || [];
  for (const c of suspended) {
    const cl = (c || '').toLowerCase();
    if (cl.includes(signal.symbol?.toLowerCase()) || (cl.includes(signal.regime?.toLowerCase()) && signal.setup && cl.includes(signal.setup.toLowerCase()))) {
      adj.direction = 'WAIT'; adj.confidence = 0; adj.reasons.push(`Suspended: ${c}`); return adj;
    }
  }
  if (adj.direction === 'WAIT') return adj;
  let delta = 0;
  const sw = memory.setup_weights || {};
  if (signal.setup) { const k = `${signal.setup} ${signal.timeframe}`; if (typeof sw[k] === 'number') delta += sw[k]; if (typeof sw[signal.setup] === 'number') delta += sw[signal.setup]; }
  const rf = memory.regime_filters || {};
  if (signal.regime && rf[signal.regime] === 'avoid') delta -= 15;
  else if (signal.regime && rf[signal.regime] === 'prefer') delta += 5;
  const tw = memory.ticker_weights || {};
  if (signal.symbol && typeof tw[signal.symbol] === 'number') delta += tw[signal.symbol];
  const tfw = memory.timeframe_weights || {};
  if (signal.timeframe && typeof tfw[signal.timeframe] === 'number') delta += tfw[signal.timeframe];
  adj.confidence = Math.round(Math.min(100, Math.max(0, signal.confidence + delta)));
  if (delta !== 0) adj.reasons.push(`Brain adjustment: ${delta > 0 ? '+' : ''}${delta}`);
  return adj;
}

async function fetchBars(symbol, interval) {
  const tdInterval = INTERVAL_MAP[interval] || interval;
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${tdInterval}&outputsize=100&apikey=${TWELVE_DATA_KEY}`;
  const resp = await fetch(url);
  const data = await resp.json();
  if (data.status === 'error' || !data.values) {
    throw new Error(data.message || 'Twelve Data error');
  }
  return data.values
    .map((v) => ({
      open: +v.open,
      high: +v.high,
      low: +v.low,
      close: +v.close,
      volume: +v.volume,
    }))
    .reverse(); // oldest first
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const symbol = (req.query.symbol || 'SPY').toUpperCase();
  const timeframe = req.query.timeframe || '1h';
  const cacheKey = `sentinel:signal:${symbol}:${timeframe}`;

  try {
    // Check cache
    const cached = await redis.get(cacheKey).catch(() => null);
    if (cached) {
      return res.status(200).json({ signal: cached, cached: true, cachedAt: cached.generatedAt });
    }

    // Fetch bars
    const bars = await fetchBars(symbol, timeframe);

    // Load brain memory
    const { data: memory } = await supabase
      .from('sentinel_memory')
      .select('*')
      .eq('id', 1)
      .single();

    // Generate & adjust signal
    let signal = generateSignal(symbol, bars, timeframe);
    signal = applyMemoryWeights(signal, memory);

    // Cache 5 minutes
    await redis.set(cacheKey, signal, { ex: 300 }).catch(() => {});

    return res.status(200).json({ signal, cached: false, fetchedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[sentinel/scan] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
