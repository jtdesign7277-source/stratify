// api/sentinel/heartbeat-crypto.js
// Sentinel crypto heartbeat — runs every minute 24/7/365
// Handles BTC/USD, ETH/USD, SOL/USD — no market hours check

const https = require('https');

const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY || process.env.VITE_TWELVE_DATA_WS_KEY;
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CRYPTO_SYMBOLS = ['BTC/USD', 'ETH/USD', 'SOL/USD'];
const CRYPTO_MIN_CONFIDENCE = 70;
const SENTINEL_ACCOUNT_ID = '00000000-0000-0000-0000-000000000001';

// ─── HTTP helpers ────────────────────────────────────────────────────────────

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse error: ' + data.slice(0, 200))); }
      });
    }).on('error', reject);
  });
}

function httpsPost(url, token, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { resolve({}); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ─── Redis helpers ────────────────────────────────────────────────────────────

async function redisGet(key) {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return null;
  try {
    const res = await httpsGet(`${UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}?_token=${UPSTASH_REDIS_REST_TOKEN}`);
    return res.result ? JSON.parse(res.result) : null;
  } catch { return null; }
}

async function redisSet(key, value, ttlSeconds) {
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return;
  try {
    const encoded = encodeURIComponent(JSON.stringify(value));
    await httpsGet(`${UPSTASH_REDIS_REST_URL}/set/${encodeURIComponent(key)}/${encoded}/ex/${ttlSeconds}?_token=${UPSTASH_REDIS_REST_TOKEN}`);
  } catch {}
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

function supabaseHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'apikey': SUPABASE_SERVICE_KEY,
  };
}

function supabaseFetch(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(`${SUPABASE_URL}/rest/v1${path}`);
    const payload = body ? JSON.stringify(body) : null;
    const headers = {
      ...supabaseHeaders(),
      'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal',
    };
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method,
      headers,
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(data ? JSON.parse(data) : {}); }
        catch { resolve({}); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ─── Signal Engine (inline minimal version) ───────────────────────────────────

function computeEMA(prices, period) {
  if (prices.length === 0) return [];
  const k = 2 / (period + 1);
  const result = new Array(prices.length).fill(0);
  result[0] = prices[0];
  for (let i = 1; i < prices.length; i++) {
    result[i] = prices[i] * k + result[i - 1] * (1 - k);
  }
  return result;
}

function computeRSI(prices, period = 14) {
  if (prices.length <= period) return prices.map(() => 50);
  const result = new Array(prices.length).fill(50);
  const gains = [], losses = [];
  for (let i = 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    const gIdx = i - 1;
    if (i > period) {
      avgGain = (avgGain * (period - 1) + gains[gIdx]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[gIdx]) / period;
    }
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result[i] = parseFloat((100 - 100 / (1 + rs)).toFixed(2));
  }
  return result;
}

function computeATR(bars, period = 14) {
  if (bars.length === 0) return [];
  const result = new Array(bars.length).fill(0);
  const trValues = [];
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    if (i === 0) {
      trValues.push(bar.high - bar.low);
    } else {
      const prevClose = bars[i - 1].close;
      trValues.push(Math.max(bar.high - bar.low, Math.abs(bar.high - prevClose), Math.abs(bar.low - prevClose)));
    }
  }
  const seed = trValues.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result[period - 1] = seed;
  for (let i = period; i < bars.length; i++) {
    result[i] = (result[i - 1] * (period - 1) + trValues[i]) / period;
  }
  return result;
}

function detectRegime(bars) {
  if (bars.length < 50) return { trend: 'NEUTRAL', type: 'RANGING', volatility: 'NORMAL', description: 'Insufficient data' };
  const closes = bars.map(b => b.close);
  const ema8 = computeEMA(closes, 8);
  const ema21 = computeEMA(closes, 21);
  const atr = computeATR(bars, 14);
  const last = closes.length - 1;
  const price = closes[last];
  const currentATR = atr[last];
  const atrSlice = atr.slice(Math.max(0, last - 20), last + 1).filter(v => v > 0);
  const avgATR = atrSlice.reduce((a, b) => a + b, 0) / atrSlice.length;
  const atrRatio = avgATR > 0 ? currentATR / avgATR : 1;
  let volatility = 'NORMAL';
  if (atrRatio > 1.5) volatility = 'HIGH';
  else if (atrRatio < 0.6) volatility = 'LOW';
  if (volatility === 'HIGH' && atrRatio > 2) {
    return { trend: 'NEUTRAL', type: 'VOLATILE', volatility: 'HIGH', description: `Extreme volatility (${atrRatio.toFixed(1)}x ATR). Standing aside.` };
  }
  const bullAlignment = price > ema8[last] && ema8[last] > ema21[last];
  const bearAlignment = price < ema8[last] && ema8[last] < ema21[last];
  const ema21Slope = last >= 5 ? ema21[last] - ema21[last - 5] : 0;
  const trending = Math.abs(ema21Slope) > currentATR * 0.3;
  if (bullAlignment) return { trend: 'BULL', type: trending ? 'TRENDING' : 'RANGING', volatility, description: `Bullish ${trending ? 'trend' : 'range'}: EMA8 > EMA21.` };
  if (bearAlignment) return { trend: 'BEAR', type: trending ? 'TRENDING' : 'RANGING', volatility, description: `Bearish ${trending ? 'trend' : 'range'}: EMA8 < EMA21.` };
  return { trend: 'NEUTRAL', type: 'RANGING', volatility, description: 'Neutral — no clear directional bias.' };
}

function generateSignal(symbol, bars, timeframe) {
  const WAIT = { symbol, direction: 'WAIT', confidence: 0, entry: 0, stop: 0, target: 0, riskR: 1, rewardR: 0, setup: 'No Setup', reasons: [], warnings: ['No clear setup'], regime: detectRegime(bars), timeframe, timestamp: new Date().toISOString() };
  if (bars.length < 50) return WAIT;
  const closes = bars.map(b => b.close);
  const volumes = bars.map(b => b.volume);
  const ema8arr = computeEMA(closes, 8);
  const ema21arr = computeEMA(closes, 21);
  const rsiArr = computeRSI(closes, 14);
  const atrArr = computeATR(bars, 14);
  const last = bars.length - 1;
  const price = closes[last];
  const ema8 = ema8arr[last];
  const ema21 = ema21arr[last];
  const rsi = rsiArr[last];
  const atr = atrArr[last];
  const regime = detectRegime(bars);
  const volSlice = volumes.slice(Math.max(0, last - 20), last + 1);
  const avgVol = volSlice.reduce((a, b) => a + b, 0) / volSlice.length;
  const aboveAvgVol = volumes[last] > avgVol;
  const longEMAOk = price > ema8 && ema8 > ema21;
  const longRSIOk = rsi >= 40 && rsi <= 65;
  const shortEMAOk = price < ema8 && ema8 < ema21;
  const shortRSIOk = rsi >= 35 && rsi <= 60;
  const longScore = [longEMAOk, longRSIOk, aboveAvgVol, regime.trend === 'BULL'].filter(Boolean).length;
  const shortScore = [shortEMAOk, shortRSIOk, aboveAvgVol, regime.trend === 'BEAR'].filter(Boolean).length;
  if (longScore < 3 && shortScore < 3) return { ...WAIT, regime };
  const direction = longScore >= shortScore ? 'LONG' : 'SHORT';
  const reasons = [];
  const warnings = [];
  let confidence = 0;
  let stop;
  let setup;
  if (direction === 'LONG') {
    confidence = Math.round((longScore / 4) * 80 + (longRSIOk ? 10 : 0) + (aboveAvgVol ? 10 : 0));
    if (longEMAOk) reasons.push(`EMA8 (${ema8.toFixed(2)}) > EMA21 (${ema21.toFixed(2)})`);
    if (longRSIOk) reasons.push(`RSI ${rsi.toFixed(1)} in momentum zone`);
    if (aboveAvgVol) reasons.push(`Volume ${(volumes[last] / avgVol).toFixed(1)}x above average`);
    stop = price - atr * 1.5;
    setup = 'Momentum Long';
  } else {
    confidence = Math.round((shortScore / 4) * 80 + (shortRSIOk ? 10 : 0) + (aboveAvgVol ? 10 : 0));
    if (shortEMAOk) reasons.push(`EMA8 (${ema8.toFixed(2)}) < EMA21 (${ema21.toFixed(2)})`);
    if (shortRSIOk) reasons.push(`RSI ${rsi.toFixed(1)} in bearish zone`);
    if (aboveAvgVol) reasons.push(`Volume ${(volumes[last] / avgVol).toFixed(1)}x above average`);
    stop = price + atr * 1.5;
    setup = 'Momentum Short';
  }
  if (regime.type === 'VOLATILE') { warnings.push('Volatile regime — reduced confidence'); confidence = Math.max(0, confidence - 15); }
  confidence = Math.min(100, Math.max(0, confidence));
  const stopDistance = Math.abs(price - stop);
  const multiplier = regime.type === 'RANGING' ? 1.5 : 2.0;
  const target = direction === 'LONG' ? price + stopDistance * multiplier : price - stopDistance * multiplier;
  return { symbol, direction, confidence, entry: parseFloat(price.toFixed(2)), stop: parseFloat(stop.toFixed(2)), target: parseFloat(target.toFixed(2)), riskR: 1, rewardR: multiplier, setup, reasons, warnings, regime, timeframe, timestamp: new Date().toISOString() };
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchBars(symbol, interval = '1h') {
  const intervalMap = { '5m': '5min', '15m': '15min', '1h': '1h', '4h': '4h', '1D': '1day' };
  const td_interval = intervalMap[interval] || '1h';
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${td_interval}&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
  const data = await httpsGet(url);
  if (!data.values || !Array.isArray(data.values)) throw new Error(`No bars for ${symbol}: ${JSON.stringify(data).slice(0, 100)}`);
  return data.values.reverse().map(v => ({
    time: Date.parse(v.datetime),
    open: parseFloat(v.open),
    high: parseFloat(v.high),
    low: parseFloat(v.low),
    close: parseFloat(v.close),
    volume: parseFloat(v.volume || '0'),
  }));
}

async function fetchCurrentPrice(symbol) {
  const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${TWELVE_DATA_API_KEY}`;
  const data = await httpsGet(url);
  return parseFloat(data.close || data.price || '0');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Main handler ─────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  const startTime = Date.now();
  let newSignals = 0;
  let tradesClosed = 0;
  const log = [];

  try {
    // ── 1. Load Sentinel account ──────────────────────────────────────────────
    const accountData = await supabaseFetch(
      `/sentinel_account?id=eq.${SENTINEL_ACCOUNT_ID}&select=*`
    );
    const account = Array.isArray(accountData) ? accountData[0] : null;
    if (!account) {
      return res.status(200).json({ skipped: true, reason: 'No sentinel account found. Run DB migration first.' });
    }

    // ── 2. Check & close open crypto trades ───────────────────────────────────
    const openTrades = await supabaseFetch(
      `/sentinel_trades?status=eq.open&select=*`
    );
    const cryptoOpenTrades = Array.isArray(openTrades)
      ? openTrades.filter(t => CRYPTO_SYMBOLS.includes(t.symbol))
      : [];

    for (const trade of cryptoOpenTrades) {
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

          // Close sentinel trade
          await supabaseFetch(`/sentinel_trades?id=eq.${trade.id}`, 'PATCH', {
            status: 'closed',
            closed_at: new Date().toISOString(),
            exit_price: exitPrice,
            result_r: resultR,
            pnl: parseFloat(pnl.toFixed(2)),
            win,
          });

          // Update account
          const newBalance = account.current_balance + pnl;
          const newWins = account.wins + (win ? 1 : 0);
          const newLosses = account.losses + (win ? 0 : 1);
          const closedCount = account.closed_trades + 1;
          const newWinRate = closedCount > 0 ? (newWins / closedCount) * 100 : 0;

          await supabaseFetch(`/sentinel_account?id=eq.${SENTINEL_ACCOUNT_ID}`, 'PATCH', {
            current_balance: parseFloat(newBalance.toFixed(2)),
            total_pnl: parseFloat((account.total_pnl + pnl).toFixed(2)),
            wins: newWins,
            losses: newLosses,
            closed_trades: closedCount,
            win_rate: parseFloat(newWinRate.toFixed(2)),
            updated_at: new Date().toISOString(),
          });

          // Close any copied trades
          await supabaseFetch(
            `/sentinel_copied_trades?sentinel_trade_id=eq.${trade.id}&status=eq.open`,
            'PATCH',
            {
              status: 'closed',
              closed_at: new Date().toISOString(),
              exit_price: exitPrice,
              result_r: resultR,
              win,
            }
          );

          tradesClosed++;
          log.push(`Closed ${trade.direction} ${trade.symbol} @ ${exitPrice} — ${win ? 'WIN' : 'LOSS'} ${resultR}R $${pnl.toFixed(2)}`);
        }

        await sleep(200);
      } catch (err) {
        log.push(`Error checking ${trade.symbol}: ${err.message}`);
      }
    }

    // ── 3. Scan for new signals ────────────────────────────────────────────────
    // Don't open new trade if already have one open for that symbol
    const openSymbols = new Set(cryptoOpenTrades.filter(t => t.status === 'open').map(t => t.symbol));

    for (const symbol of CRYPTO_SYMBOLS) {
      if (openSymbols.has(symbol)) {
        log.push(`${symbol}: skipped — already have open position`);
        await sleep(200);
        continue;
      }

      try {
        // Check Redis cache first
        const cacheKey = `sentinel:crypto:signal:${symbol}:1h`;
        const cached = await redisGet(cacheKey);
        let signal;

        if (cached && cached.direction !== 'WAIT') {
          signal = cached;
          log.push(`${symbol}: using cached signal (${signal.direction} confidence ${signal.confidence})`);
        } else {
          const bars = await fetchBars(symbol, '1h');
          signal = generateSignal(symbol, bars, '1h');
          await redisSet(cacheKey, signal, 300); // 5 min TTL
          log.push(`${symbol}: fresh signal — ${signal.direction} confidence ${signal.confidence}`);
        }

        if (signal.direction !== 'WAIT' && signal.confidence >= CRYPTO_MIN_CONFIDENCE) {
          // Calculate position size: risk 1% of current balance
          const riskAmount = account.current_balance * 0.01;
          const stopDistance = Math.abs(signal.entry - signal.stop);
          const size = stopDistance > 0 ? riskAmount / stopDistance : 0;
          const dollarSize = size * signal.entry;

          // Insert sentinel trade
          const tradeRows = await supabaseFetch('/sentinel_trades', 'POST', {
            symbol,
            direction: signal.direction,
            setup: signal.setup,
            timeframe: '1h',
            regime: `${signal.regime.trend}/${signal.regime.type}`,
            entry: signal.entry,
            stop: signal.stop,
            target: signal.target,
            size: parseFloat(size.toFixed(6)),
            dollar_size: parseFloat(dollarSize.toFixed(2)),
            risk_r: 1,
            reward_r: signal.rewardR,
            confidence: signal.confidence,
            reasons: signal.reasons,
            status: 'open',
            session_date: new Date().toISOString().split('T')[0],
            opened_at: new Date().toISOString(),
          });

          const newTrade = Array.isArray(tradeRows) ? tradeRows[0] : null;

          // Update account total trades
          await supabaseFetch(`/sentinel_account?id=eq.${SENTINEL_ACCOUNT_ID}`, 'PATCH', {
            total_trades: account.total_trades + 1,
            updated_at: new Date().toISOString(),
          });

          // Copy to YOLO subscribers
          if (newTrade) {
            const subscribers = await supabaseFetch(
              `/sentinel_user_settings?yolo_active=eq.true&subscription_status=in.(trialing,active)&select=*`
            );

            if (Array.isArray(subscribers)) {
              for (const user of subscribers) {
                const userRisk = (user.allocated_capital * (user.risk_per_trade_pct / 100));
                const userSize = stopDistance > 0 ? userRisk / stopDistance : 0;
                const userDollarSize = userSize * signal.entry;

                await supabaseFetch('/sentinel_copied_trades', 'POST', {
                  user_id: user.user_id,
                  sentinel_trade_id: newTrade.id,
                  symbol,
                  direction: signal.direction,
                  entry: signal.entry,
                  stop: signal.stop,
                  target: signal.target,
                  size: parseFloat(userSize.toFixed(6)),
                  dollar_size: parseFloat(userDollarSize.toFixed(2)),
                  opened_at: new Date().toISOString(),
                  status: 'open',
                });

                // Notify user
                await supabaseFetch('/sentinel_notifications', 'POST', {
                  user_id: user.user_id,
                  type: 'trade_opened',
                  title: `⚡ Sentinel ${signal.direction} ${symbol.replace('/USD', '')}`,
                  body: `Entry $${signal.entry.toLocaleString()} · Stop $${signal.stop.toLocaleString()} · Target $${signal.target.toLocaleString()} · Confidence ${signal.confidence}`,
                  trade_id: newTrade.id,
                  read: false,
                });
              }
            }
          }

          newSignals++;
          log.push(`✓ OPENED ${signal.direction} ${symbol} @ ${signal.entry} — confidence ${signal.confidence}`);
          openSymbols.add(symbol);
        }

        await sleep(300); // Rate limit protection between symbols
      } catch (err) {
        log.push(`Error scanning ${symbol}: ${err.message}`);
      }
    }

    // ── 4. Daily learn trigger at midnight UTC ─────────────────────────────────
    const nowUTC = new Date();
    if (nowUTC.getUTCHours() === 0 && nowUTC.getUTCMinutes() < 2) {
      // Check if today's session already has a learn run
      const today = nowUTC.toISOString().split('T')[0];
      const sessions = await supabaseFetch(
        `/sentinel_sessions?session_date=eq.${today}&select=session_ended_at`
      );
      const session = Array.isArray(sessions) ? sessions[0] : null;
      if (!session || !session.session_ended_at) {
        // Mark session ended and trigger learn
        await supabaseFetch(
          `/sentinel_sessions?session_date=eq.${today}`,
          'PATCH',
          { session_ended_at: new Date().toISOString() }
        );
        // Fire learn endpoint
        try {
          await httpsGet(`https://stratifymarket.com/api/sentinel/learn`);
          log.push('Daily learn job triggered at midnight UTC');
        } catch {}
      }
    }

    // ── 5. Upsert today's session ──────────────────────────────────────────────
    const today = new Date().toISOString().split('T')[0];
    await supabaseFetch('/sentinel_sessions', 'POST', {
      session_date: today,
      trades_fired: newSignals,
      session_started_at: new Date().toISOString(),
    });

    return res.status(200).json({
      processed: true,
      cryptoSymbols: CRYPTO_SYMBOLS,
      openTradesChecked: cryptoOpenTrades.length,
      tradesClosed,
      newSignals,
      duration: Date.now() - startTime,
      log,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error('Sentinel crypto heartbeat error:', err);
    return res.status(200).json({
      processed: false,
      error: err.message,
      log,
      timestamp: new Date().toISOString(),
    });
  }
};
