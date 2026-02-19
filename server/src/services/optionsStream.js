// Real-time Options Flow Scanner via Alpaca OPRA WebSocket
// Connects to wss://stream.data.alpaca.markets/v1beta1/options
// Detects unusual activity: sweeps, blocks, high volume, large premium

import WebSocket from 'ws';
import dotenv from 'dotenv';
dotenv.config();

const ALPACA_KEY = (process.env.ALPACA_API_KEY || process.env.APCA_API_KEY_ID || '').trim();
const ALPACA_SECRET = (process.env.ALPACA_SECRET_KEY || process.env.ALPACA_API_SECRET || process.env.APCA_API_SECRET_KEY || '').trim();

const OPTIONS_STREAM_URL = 'wss://stream.data.alpaca.markets/v1beta1/options';

const UNDERLYING_SYMBOLS = [
  'TSLA', 'NVDA', 'SPY', 'QQQ', 'AAPL', 'META', 'AMD', 'AMZN',
  'MSFT', 'GOOGL', 'COIN', 'SOFI', 'HIMS', 'PYPL', 'RKLB', 'AVGO',
  'NKE', 'ADBE', 'FUBO', 'RBLX',
];

// ── State ──────────────────────────────────────────────
const MAX_ALERTS = 200;
let alerts = [];
let contractVolume = new Map();   // OCC symbol → accumulated volume today
let sweepTracker = new Map();     // OCC symbol → [{ exchange, timestamp }]
let lastResetDate = null;
let ws = null;
let reconnectDelay = 1000;
let reconnectTimer = null;
let connected = false;
let alertCallback = null;

// ── OCC Symbol Parser ──────────────────────────────────
// Format: UNDERLYING + YYMMDD + C/P + strike*1000 (zero-padded 8 digits)
// Examples: AAPL240119C00150000, TSLA260221P00250000, SPY260220C00600000
function parseOCC(occ) {
  if (!occ || occ.length < 15) return null;

  // Find where the date portion starts: scan from end backwards
  // The last 15 chars are always: YYMMDD + C/P + 8-digit strike
  const tail = occ.slice(-15);
  const underlying = occ.slice(0, -15);
  if (!underlying) return null;

  const dateStr = tail.slice(0, 6);       // YYMMDD
  const typeChar = tail.slice(6, 7);      // C or P
  const strikeRaw = tail.slice(7);        // 8-digit strike * 1000

  const year = 2000 + parseInt(dateStr.slice(0, 2), 10);
  const month = dateStr.slice(2, 4);
  const day = dateStr.slice(4, 6);
  const expiration = `${year}-${month}-${day}`;
  const type = typeChar === 'C' ? 'call' : 'put';
  const strike = parseInt(strikeRaw, 10) / 1000;

  return { underlying: underlying.trim(), expiration, type, strike };
}

// ── Daily Reset ────────────────────────────────────────
function checkDailyReset() {
  const today = new Date().toISOString().split('T')[0];
  if (lastResetDate !== today) {
    contractVolume.clear();
    sweepTracker.clear();
    alerts = [];
    lastResetDate = today;
    console.log('[OptionsStream] Daily reset — cleared volume/sweep trackers');
  }
}

// ── Sweep Detection ────────────────────────────────────
function checkSweep(symbol, exchange, timestamp) {
  const now = Date.now();
  const cutoff = now - 5000; // 5-second window

  if (!sweepTracker.has(symbol)) {
    sweepTracker.set(symbol, []);
  }

  const entries = sweepTracker.get(symbol);
  // Prune old entries
  while (entries.length > 0 && entries[0].time < cutoff) {
    entries.shift();
  }

  entries.push({ exchange, time: now });

  // Sweep = same contract, 3+ different exchanges in 5 seconds
  const uniqueExchanges = new Set(entries.map((e) => e.exchange));
  return uniqueExchanges.size >= 3;
}

// ── Process Trade ──────────────────────────────────────
function processTrade(trade) {
  checkDailyReset();

  const symbol = trade.S;        // OCC symbol
  const price = trade.p;         // trade price
  const size = trade.s;          // trade size (contracts)
  const exchange = trade.x;      // exchange code
  const timestamp = trade.t;     // ISO timestamp

  if (!symbol || !price || !size) return null;

  const parsed = parseOCC(symbol);
  if (!parsed) return null;

  // Skip if not one of our tracked underlyings
  if (!UNDERLYING_SYMBOLS.includes(parsed.underlying)) return null;

  // Accumulate volume
  const prevVol = contractVolume.get(symbol) || 0;
  const newVol = prevVol + size;
  contractVolume.set(symbol, newVol);

  const estimatedPremium = Math.round(price * size * 100);

  // Detect sweep
  const isSweep = checkSweep(symbol, exchange, timestamp);

  // Determine if unusual
  const isBlock = size > 50;
  const isHighVolume = newVol > 500;
  const isLargePremium = estimatedPremium > 100000;
  const isUnusual = isSweep || isBlock || isHighVolume || isLargePremium;

  if (!isUnusual) return null;

  // Assign badge (priority: SWEEP > BLOCK > UNUSUAL)
  let badge = 'UNUSUAL';
  if (isSweep) badge = 'SWEEP';
  else if (isBlock) badge = 'BLOCK';

  const alert = {
    symbol,
    underlying: parsed.underlying,
    strike: parsed.strike,
    type: parsed.type,
    expiration: parsed.expiration,
    sentiment: parsed.type === 'call' ? 'bullish' : 'bearish',
    lastPrice: price,
    tradeSize: size,
    volume: newVol,
    openInterest: 0,
    volumeOIRatio: 0,
    estimatedPremium,
    badge,
    bid: 0,
    ask: 0,
    timestamp: timestamp || new Date().toISOString(),
  };

  // Add to alerts buffer (sorted by premium desc, capped at MAX_ALERTS)
  alerts.push(alert);
  alerts.sort((a, b) => b.estimatedPremium - a.estimatedPremium);
  if (alerts.length > MAX_ALERTS) {
    alerts = alerts.slice(0, MAX_ALERTS);
  }

  return alert;
}

// ── Summary Builder ────────────────────────────────────
export function getFlowSummary() {
  let totalCallPremium = 0;
  let totalPutPremium = 0;
  const byTicker = {};

  for (const alert of alerts) {
    const u = alert.underlying;
    if (!byTicker[u]) byTicker[u] = { calls: 0, puts: 0, premium: 0 };

    if (alert.type === 'call') {
      totalCallPremium += alert.estimatedPremium;
      byTicker[u].calls++;
    } else {
      totalPutPremium += alert.estimatedPremium;
      byTicker[u].puts++;
    }
    byTicker[u].premium += alert.estimatedPremium;
  }

  let topBullish = null;
  let topBearish = null;
  let maxBull = 0;
  let maxBear = 0;

  for (const [ticker, data] of Object.entries(byTicker)) {
    if (data.calls > maxBull) { maxBull = data.calls; topBullish = ticker; }
    if (data.puts > maxBear) { maxBear = data.puts; topBearish = ticker; }
  }

  const totalPremium = totalCallPremium + totalPutPremium;
  const callPutRatio = totalPutPremium > 0
    ? Math.round((totalCallPremium / totalPutPremium) * 100) / 100
    : totalCallPremium > 0 ? 999 : 0;

  return {
    totalAlerts: alerts.length,
    totalCallPremium,
    totalPutPremium,
    totalPremium,
    callPutRatio,
    topBullish,
    topBearish,
    byTicker,
  };
}

export function getRecentAlerts() {
  return [...alerts];
}

// ── WebSocket Connection ───────────────────────────────
function connect() {
  if (!ALPACA_KEY || !ALPACA_SECRET) {
    console.error('[OptionsStream] Alpaca API keys not configured — skipping options stream');
    return;
  }

  console.log('[OptionsStream] Connecting to Alpaca options stream...');

  ws = new WebSocket(OPTIONS_STREAM_URL);

  ws.on('open', () => {
    console.log('[OptionsStream] WebSocket connected, authenticating...');
    ws.send(JSON.stringify({
      action: 'auth',
      key: ALPACA_KEY,
      secret: ALPACA_SECRET,
    }));
  });

  ws.on('message', (raw) => {
    let messages;
    try {
      messages = JSON.parse(raw.toString());
    } catch {
      return;
    }

    // Alpaca sends arrays of messages
    if (!Array.isArray(messages)) messages = [messages];

    for (const msg of messages) {
      // Auth success
      if (msg.T === 'success' && msg.msg === 'authenticated') {
        console.log('[OptionsStream] Authenticated ✓ — subscribing to trades...');
        connected = true;
        reconnectDelay = 1000;

        // Subscribe to all option trades for our underlyings using wildcard
        // Alpaca options stream supports subscribing to all trades with ["*"]
        // or specific OCC symbols. Wildcard "*" gets ALL options trades.
        ws.send(JSON.stringify({
          action: 'subscribe',
          trades: ['*'],
        }));
      }

      // Subscription confirmation
      if (msg.T === 'subscription') {
        console.log('[OptionsStream] Subscribed:', JSON.stringify(msg));
      }

      // Trade message
      if (msg.T === 't') {
        const alert = processTrade(msg);
        if (alert && alertCallback) {
          alertCallback(alert);
        }
      }

      // Error
      if (msg.T === 'error') {
        console.error('[OptionsStream] Error from Alpaca:', msg.msg, msg.code);
        // Auth failure — don't reconnect
        if (msg.code === 402 || msg.code === 406) {
          console.error('[OptionsStream] Auth failed or subscription denied. Check your Alpaca plan includes OPRA options data.');
          return;
        }
      }
    }
  });

  ws.on('error', (err) => {
    console.error('[OptionsStream] WebSocket error:', err.message);
  });

  ws.on('close', (code, reason) => {
    connected = false;
    console.log(`[OptionsStream] Disconnected (code=${code}). Reconnecting in ${reconnectDelay}ms...`);
    scheduleReconnect();
  });
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    connect();
  }, reconnectDelay);
}

// ── Public API ─────────────────────────────────────────
export function startOptionsStream(onAlert) {
  alertCallback = onAlert || null;
  checkDailyReset();
  connect();
}

export function isOptionsStreamConnected() {
  return connected;
}
