// api/sentinel/heartbeat.js — Sentinel cron job (every 60s during market hours)
// Checks open trades, scans for new signals, triggers learn at 4pm ET

import { createClient } from '@supabase/supabase-js';

const TWELVE_DATA_KEY =
  process.env.TWELVEDATA_API_KEY ||
  process.env.TWELVE_DATA_API_KEY ||
  process.env.VITE_TWELVE_DATA_API_KEY;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const SCAN_SYMBOLS = ['SPY', 'QQQ', 'AAPL', 'NVDA', 'TSLA', 'MSFT', 'META', 'AMZN', 'GOOGL'];
const SCAN_CRYPTO = ['BTC/USD', 'ETH/USD'];
const ALL_SYMBOLS = [...SCAN_SYMBOLS, ...SCAN_CRYPTO];
const ACCOUNT_ID = '00000000-0000-0000-0000-000000000001';

function getETTime() {
  const now = new Date();
  const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const et = new Date(etStr);
  return { et, hour: et.getHours(), minute: et.getMinutes(), day: et.getDay() };
}

function isMarketOpen() {
  const { hour, minute, day } = getETTime();
  if (day === 0 || day === 6) return false;
  const mins = hour * 60 + minute;
  return mins >= 570 && mins <= 960; // 9:30am - 4:00pm ET
}

function is4pmET() {
  const { hour, minute } = getETTime();
  return hour === 16 && minute <= 1;
}

async function fetchQuote(symbol) {
  const cleanSymbol = symbol.replace('/', '');
  const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(cleanSymbol)}&apikey=${TWELVE_DATA_KEY}`;
  const resp = await fetch(url);
  const data = await resp.json();
  if (data.status === 'error') throw new Error(data.message || 'Quote error');
  return +data.close;
}

async function fetchBars(symbol) {
  const cleanSymbol = symbol.replace('/', '');
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(cleanSymbol)}&interval=1h&outputsize=100&apikey=${TWELVE_DATA_KEY}`;
  const resp = await fetch(url);
  const data = await resp.json();
  if (data.status === 'error' || !data.values) throw new Error(data.message || 'Bars error');
  return data.values.map(v => ({ open: +v.open, high: +v.high, low: +v.low, close: +v.close, volume: +v.volume })).reverse();
}

// Minimal signal engine (same as scan.js)
function computeEMA(values, period) {
  const ema = new Array(values.length).fill(NaN);
  if (values.length < period) return ema;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  ema[period - 1] = sum / period;
  const k = 2 / (period + 1);
  for (let i = period; i < values.length; i++) ema[i] = values[i] * k + ema[i - 1] * (1 - k);
  return ema;
}

function computeRSI(closes, period = 14) {
  const rsi = new Array(closes.length).fill(NaN);
  if (closes.length <= period) return rsi;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) { const c = closes[i] - closes[i - 1]; if (c > 0) avgGain += c; else avgLoss += Math.abs(c); }
  avgGain /= period; avgLoss /= period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) { const c = closes[i] - closes[i - 1]; avgGain = (avgGain * (period - 1) + (c > 0 ? c : 0)) / period; avgLoss = (avgLoss * (period - 1) + (c < 0 ? Math.abs(c) : 0)) / period; rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss); }
  return rsi;
}

function computeATR(bars, period = 14) {
  const atr = new Array(bars.length).fill(NaN);
  if (bars.length <= period) return atr;
  const trs = bars.map((b, i) => { if (i === 0) return b.high - b.low; const pc = bars[i - 1].close; return Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); });
  let sum = 0; for (let i = 0; i < period; i++) sum += trs[i]; atr[period - 1] = sum / period;
  for (let i = period; i < bars.length; i++) atr[i] = (atr[i - 1] * (period - 1) + trs[i]) / period;
  return atr;
}

function generateSignal(symbol, bars, timeframe) {
  if (!bars || bars.length < 50) return { symbol, timeframe, direction: 'WAIT', confidence: 0 };
  const closes = bars.map(b => b.close);
  const last = bars.length - 1, price = closes[last];
  const ema9 = computeEMA(closes, 9), ema21 = computeEMA(closes, 21), ema50 = computeEMA(closes, 50);
  const rsi = computeRSI(closes, 14), atr = computeATR(bars, 14);
  const r = rsi[last], a = atr[last], e9 = ema9[last], e21 = ema21[last], e50 = ema50[last];
  if (isNaN(r) || isNaN(a) || isNaN(e9) || isNaN(e21)) return { symbol, timeframe, direction: 'WAIT', confidence: 0 };
  const reasons = [];
  let direction = 'WAIT', confidence = 50, setup = null, regime = 'RANGING';
  // Regime
  const ema20 = computeEMA(closes, 20); const e20 = ema20[last];
  if (!isNaN(e20) && !isNaN(e50)) {
    const atrPct = (a / price) * 100;
    if (atrPct > 3.5) regime = 'VOLATILE';
    else { const spread = ((e20 - e50) / e50) * 100; if (e20 > e50 && price > e20 && spread > 0.5) regime = 'BULL_TRENDING'; else if (e20 < e50 && price < e20 && spread < -0.5) regime = 'BEAR_TRENDING'; }
  }
  // Signals
  const pe9 = ema9[last - 1], pe21 = ema21[last - 1];
  if (pe9 <= pe21 && e9 > e21 && price > e50) { direction = 'LONG'; setup = 'EMA Crossover'; confidence = 62; reasons.push('EMA9 crossed above EMA21'); }
  if (direction === 'WAIT' && regime === 'BULL_TRENDING' && Math.abs(price - e21) / a < 0.5 && r > 40 && r < 60) { direction = 'LONG'; setup = 'Break & Retest'; confidence = 65; reasons.push('Retesting EMA21 in bull trend'); }
  if (direction === 'WAIT' && r < 35 && price > e50) { direction = 'LONG'; setup = 'RSI Oversold Bounce'; confidence = 58; }
  if (direction === 'WAIT' && pe9 >= pe21 && e9 < e21 && price < e50) { direction = 'SHORT'; setup = 'EMA Crossover'; confidence = 62; }
  if (direction === 'WAIT' && regime === 'BEAR_TRENDING' && Math.abs(price - e21) / a < 0.5 && r > 55 && r < 70) { direction = 'SHORT'; setup = 'Break & Retest'; confidence = 65; }
  if (direction === 'WAIT' && r > 70 && price < e50) { direction = 'SHORT'; setup = 'RSI Overbought Rejection'; confidence = 58; }
  if (regime === 'VOLATILE') confidence = Math.max(0, confidence - 15);
  if (regime === 'RANGING' && setup === 'EMA Crossover') confidence = Math.max(0, confidence - 10);
  let stop = null, target = null;
  if (direction === 'LONG') { stop = price - a * 1.5; target = price + a * 3; }
  else if (direction === 'SHORT') { stop = price + a * 1.5; target = price - a * 3; }
  return { symbol, timeframe, direction, confidence: Math.round(Math.min(100, Math.max(0, confidence))), regime, setup, entry: +price.toFixed(4), stop: stop ? +stop.toFixed(4) : null, target: target ? +target.toFixed(4) : null, rewardR: direction !== 'WAIT' ? 2 : null, reasons, generatedAt: new Date().toISOString() };
}

function applyMemoryWeights(signal, memory) {
  if (!memory || !signal) return signal;
  const adj = { ...signal, reasons: [...(signal.reasons || [])] };
  for (const c of (memory.suspended_conditions || [])) {
    const cl = (c || '').toLowerCase();
    if (cl.includes(signal.symbol?.toLowerCase()) || (signal.regime && cl.includes(signal.regime.toLowerCase()) && signal.setup && cl.includes(signal.setup.toLowerCase()))) {
      adj.direction = 'WAIT'; adj.confidence = 0; return adj;
    }
  }
  if (adj.direction === 'WAIT') return adj;
  let delta = 0;
  const sw = memory.setup_weights || {};
  if (signal.setup) { const k = `${signal.setup} ${signal.timeframe}`; if (typeof sw[k] === 'number') delta += sw[k]; if (typeof sw[signal.setup] === 'number') delta += sw[signal.setup]; }
  const rf = memory.regime_filters || {};
  if (signal.regime && rf[signal.regime] === 'avoid') delta -= 15;
  const tw = memory.ticker_weights || {};
  if (signal.symbol && typeof tw[signal.symbol] === 'number') delta += tw[signal.symbol];
  const tfw = memory.timeframe_weights || {};
  if (signal.timeframe && typeof tfw[signal.timeframe] === 'number') delta += tfw[signal.timeframe];
  adj.confidence = Math.round(Math.min(100, Math.max(0, signal.confidence + delta)));
  return adj;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Auth check for cron
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!isMarketOpen()) {
    return res.status(200).json({ skipped: true, reason: 'outside market hours' });
  }

  try {
    // Load brain memory + account + open trades
    const [memoryRes, accountRes, openTradesRes] = await Promise.all([
      supabase.from('sentinel_memory').select('*').eq('id', 1).single(),
      supabase.from('sentinel_account').select('*').eq('id', ACCOUNT_ID).single(),
      supabase.from('sentinel_trades').select('*').eq('status', 'open'),
    ]);

    const memory = memoryRes.data || {};
    const account = accountRes.data || {};
    const openTrades = openTradesRes.data || [];
    let tradesChecked = 0;
    let tradesClosed = 0;
    let newSignals = 0;

    // === CHECK OPEN TRADES ===
    for (const trade of openTrades) {
      try {
        const currentPrice = await fetchQuote(trade.symbol);
        tradesChecked++;

        const isLong = trade.direction === 'LONG';
        const stopHit = isLong ? currentPrice <= trade.stop : currentPrice >= trade.stop;
        const targetHit = isLong ? currentPrice >= trade.target : currentPrice <= trade.target;

        if (stopHit || targetHit) {
          const exitPrice = currentPrice;
          const riskPerShare = Math.abs(trade.entry - trade.stop);
          const resultR = riskPerShare > 0 ? (isLong ? (exitPrice - trade.entry) : (trade.entry - exitPrice)) / riskPerShare : 0;
          const pnl = (trade.size || 0) * (isLong ? (exitPrice - trade.entry) : (trade.entry - exitPrice));
          const win = resultR > 0;

          // Update trade
          await supabase.from('sentinel_trades').update({
            status: 'closed',
            closed_at: new Date().toISOString(),
            exit_price: exitPrice,
            result_r: +resultR.toFixed(2),
            pnl: +pnl.toFixed(2),
            win,
          }).eq('id', trade.id);

          // Update account
          const newBalance = (account.current_balance || 500000) + pnl;
          const newWins = (account.wins || 0) + (win ? 1 : 0);
          const newLosses = (account.losses || 0) + (win ? 0 : 1);
          const newClosedTrades = (account.closed_trades || 0) + 1;
          const newWinRate = (newWins + newLosses) > 0 ? (newWins / (newWins + newLosses)) * 100 : 0;
          const newTotalPnl = (account.total_pnl || 0) + pnl;

          await supabase.from('sentinel_account').update({
            current_balance: +newBalance.toFixed(2),
            total_pnl: +newTotalPnl.toFixed(2),
            closed_trades: newClosedTrades,
            wins: newWins,
            losses: newLosses,
            win_rate: +newWinRate.toFixed(1),
            updated_at: new Date().toISOString(),
          }).eq('id', ACCOUNT_ID);

          // Update account object for subsequent calculations
          account.current_balance = newBalance;
          account.wins = newWins;
          account.losses = newLosses;
          account.closed_trades = newClosedTrades;
          account.total_pnl = newTotalPnl;

          // Close copied trades for YOLO subscribers
          await supabase.from('sentinel_copied_trades').update({
            status: 'closed',
            closed_at: new Date().toISOString(),
            exit_price: exitPrice,
            result_r: +resultR.toFixed(2),
            pnl: +pnl.toFixed(2),
            win,
          }).eq('sentinel_trade_id', trade.id).eq('status', 'open');

          // Notify all YOLO users
          const { data: yoloUsers } = await supabase.from('sentinel_user_settings')
            .select('user_id')
            .eq('yolo_active', true)
            .in('subscription_status', ['trialing', 'active']);

          if (yoloUsers?.length) {
            const notifications = yoloUsers.map((u) => ({
              user_id: u.user_id,
              type: 'trade_closed',
              title: `Sentinel closed ${trade.symbol}`,
              body: `${win ? '✓' : '✗'} ${trade.direction} ${trade.symbol} — ${resultR > 0 ? '+' : ''}${resultR.toFixed(1)}R ($${pnl.toFixed(0)})`,
              trade_id: trade.id,
            }));
            await supabase.from('sentinel_notifications').insert(notifications);
          }

          tradesClosed++;
        }

        await sleep(200);
      } catch (err) {
        console.error(`[heartbeat] Error checking trade ${trade.symbol}:`, err.message);
      }
    }

    // === SCAN FOR NEW SIGNALS ===
    const openSymbols = new Set(openTrades.filter(t => t.status === 'open').map(t => t.symbol));

    for (const symbol of ALL_SYMBOLS) {
      const cleanSymbol = symbol.replace('/', '');
      if (openSymbols.has(cleanSymbol) || openSymbols.has(symbol)) continue;

      try {
        const bars = await fetchBars(symbol);
        let signal = generateSignal(cleanSymbol, bars, '1h');
        signal = applyMemoryWeights(signal, memory);

        if (signal.direction !== 'WAIT' && signal.confidence >= 65) {
          const riskAmount = (account.current_balance || 500000) * 0.01;
          const riskPerShare = Math.abs(signal.entry - signal.stop);
          const size = riskPerShare > 0 ? Math.floor(riskAmount / riskPerShare) : 0;
          const dollarSize = size * signal.entry;

          if (size > 0) {
            // Insert trade
            const { data: newTrade } = await supabase.from('sentinel_trades').insert({
              symbol: cleanSymbol,
              direction: signal.direction,
              setup: signal.setup,
              timeframe: '1h',
              regime: signal.regime,
              entry: signal.entry,
              stop: signal.stop,
              target: signal.target,
              size,
              dollar_size: +dollarSize.toFixed(2),
              confidence: signal.confidence,
              reasons: signal.reasons,
              reward_r: signal.rewardR,
            }).select().single();

            // Update account total trades
            await supabase.from('sentinel_account').update({
              total_trades: (account.total_trades || 0) + 1,
              updated_at: new Date().toISOString(),
            }).eq('id', ACCOUNT_ID);

            // Copy to YOLO subscribers
            const { data: yoloUsers } = await supabase.from('sentinel_user_settings')
              .select('*')
              .eq('yolo_active', true)
              .in('subscription_status', ['trialing', 'active']);

            if (yoloUsers?.length && newTrade) {
              const copies = [];
              const notifications = [];

              for (const user of yoloUsers) {
                const userRisk = (user.allocated_capital || 5000) * ((user.risk_per_trade_pct || 2) / 100);
                const userSize = riskPerShare > 0 ? Math.floor(userRisk / riskPerShare) : 0;
                if (userSize <= 0) continue;

                // Check max positions
                const { count } = await supabase.from('sentinel_copied_trades')
                  .select('id', { count: 'exact', head: true })
                  .eq('user_id', user.user_id)
                  .eq('status', 'open');

                if ((count || 0) >= (user.max_positions || 3)) continue;

                copies.push({
                  user_id: user.user_id,
                  sentinel_trade_id: newTrade.id,
                  symbol: cleanSymbol,
                  direction: signal.direction,
                  entry: signal.entry,
                  stop: signal.stop,
                  target: signal.target,
                  size: userSize,
                  dollar_size: +(userSize * signal.entry).toFixed(2),
                });

                notifications.push({
                  user_id: user.user_id,
                  type: 'trade_opened',
                  title: `Sentinel ${signal.direction} ${cleanSymbol}`,
                  body: `⚡ ${signal.direction} $${cleanSymbol} @ $${signal.entry} — ${signal.confidence}% confidence — ${signal.setup}`,
                  trade_id: newTrade.id,
                });
              }

              if (copies.length) await supabase.from('sentinel_copied_trades').insert(copies);
              if (notifications.length) await supabase.from('sentinel_notifications').insert(notifications);
            }

            newSignals++;
          }
        }

        await sleep(200);
      } catch (err) {
        console.error(`[heartbeat] Error scanning ${symbol}:`, err.message);
      }
    }

    // === UPDATE SESSION ===
    const today = new Date().toISOString().slice(0, 10);
    const { data: existingSession } = await supabase.from('sentinel_sessions')
      .select('*')
      .eq('session_date', today)
      .maybeSingle();

    if (existingSession) {
      await supabase.from('sentinel_sessions').update({
        trades_fired: (existingSession.trades_fired || 0) + newSignals,
        trades_closed: (existingSession.trades_closed || 0) + tradesClosed,
      }).eq('id', existingSession.id);
    } else {
      await supabase.from('sentinel_sessions').insert({
        session_date: today,
        trades_fired: newSignals,
        trades_closed: tradesClosed,
        session_started_at: new Date().toISOString(),
      });
    }

    // === TRIGGER LEARN AT 4PM ET ===
    if (is4pmET()) {
      const { data: session } = await supabase.from('sentinel_sessions')
        .select('*')
        .eq('session_date', today)
        .maybeSingle();

      if (session && !session.session_ended_at) {
        await supabase.from('sentinel_sessions').update({
          session_ended_at: new Date().toISOString(),
        }).eq('id', session.id);

        // Call learn endpoint
        try {
          const host = req.headers.host || 'localhost:3000';
          const protocol = host.includes('localhost') ? 'http' : 'https';
          await fetch(`${protocol}://${host}/api/sentinel/learn`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (err) {
          console.error('[heartbeat] Failed to trigger learn:', err.message);
        }
      }
    }

    return res.status(200).json({
      processed: true,
      openTradesChecked: tradesChecked,
      tradesClosed,
      newSignals,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[sentinel/heartbeat] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
