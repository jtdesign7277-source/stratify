// api/sentinel/heartbeat-crypto.js
// Sentinel crypto heartbeat — runs every minute 24/7/365
// BTC/USD, ETH/USD, SOL/USD — no market hours restriction

import { createClient } from '@supabase/supabase-js';

const TWELVE_DATA_API_KEY = process.env.VITE_TWELVE_DATA_WS_KEY || process.env.TWELVE_DATA_API_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const CRYPTO_SYMBOLS = ['BTC/USD', 'ETH/USD', 'SOL/USD'];
const CRYPTO_MIN_CONFIDENCE = 60;
const SENTINEL_ACCOUNT_ID = '00000000-0000-0000-0000-000000000001';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function redisGet(key) {
    if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return null;
    try {
          const res = await fetch(`${UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`, {
                  headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` },
          });
          const json = await res.json();
          return json.result ? JSON.parse(json.result) : null;
    } catch { return null; }
}

async function redisSet(key, value, ttlSeconds) {
    if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) return;
    try {
          await fetch(`${UPSTASH_REDIS_REST_URL}/set/${encodeURIComponent(key)}`, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ value: JSON.stringify(value), ex: ttlSeconds }),
          });
    } catch {}
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchBars(symbol, interval = '1h') {
    const intervalMap = { '5m': '5min', '15m': '15min', '1h': '1h', '4h': '4h', '1D': '1day' };
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${intervalMap[interval] || '1h'}&outputsize=100&apikey=${TWELVE_DATA_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.values || !Array.isArray(data.values)) throw new Error(`No bars for ${symbol}: ${JSON.stringify(data).slice(0, 100)}`);
    return data.values.reverse().map(v => ({ time: Date.parse(v.datetime), open: +v.open, high: +v.high, low: +v.low, close: +v.close, volume: +(v.volume || 0) }));
}

async function fetchCurrentPrice(symbol) {
    const res = await fetch(`https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${TWELVE_DATA_API_KEY}`);
    const data = await res.json();
    return parseFloat(data.close || data.price || '0');
}

function computeEMA(prices, period) {
    if (!prices.length) return [];
    const k = 2 / (period + 1);
    const result = [prices[0]];
    for (let i = 1; i < prices.length; i++) result[i] = prices[i] * k + result[i-1] * (1-k);
    return result;
}

function computeRSI(prices, period = 14) {
    if (prices.length <= period) return prices.map(() => 50);
    const result = new Array(prices.length).fill(50);
    const gains = [], losses = [];
    for (let i = 1; i < prices.length; i++) {
          const d = prices[i] - prices[i-1];
          gains.push(d > 0 ? d : 0); losses.push(d < 0 ? -d : 0);
    }
    let ag = gains.slice(0, period).reduce((a,b)=>a+b,0)/period;
    let al = losses.slice(0, period).reduce((a,b)=>a+b,0)/period;
    for (let i = period; i < prices.length; i++) {
          if (i > period) { ag = (ag*(period-1)+gains[i-1])/period; al = (al*(period-1)+losses[i-1])/period; }
          result[i] = parseFloat((100 - 100/(1+(al===0?100:ag/al))).toFixed(2));
    }
    return result;
}

function computeATR(bars, period = 14) {
    if (!bars.length) return [];
    const trs = bars.map((b,i) => i===0 ? b.high-b.low : Math.max(b.high-b.low, Math.abs(b.high-bars[i-1].close), Math.abs(b.low-bars[i-1].close)));
    const result = new Array(bars.length).fill(0);
    result[period-1] = trs.slice(0,period).reduce((a,b)=>a+b,0)/period;
    for (let i = period; i < bars.length; i++) result[i] = (result[i-1]*(period-1)+trs[i])/period;
    return result;
}

function detectRegime(bars) {
    if (bars.length < 50) return { trend: 'NEUTRAL', type: 'RANGING', volatility: 'NORMAL', description: 'Insufficient data' };
    const closes = bars.map(b=>b.close);
    const ema8 = computeEMA(closes, 8), ema21 = computeEMA(closes, 21), atr = computeATR(bars, 14);
    const last = closes.length-1, price = closes[last];
    const atrSlice = atr.slice(Math.max(0,last-20),last+1).filter(v=>v>0);
    const avgATR = atrSlice.reduce((a,b)=>a+b,0)/atrSlice.length;
    const atrRatio = avgATR > 0 ? atr[last]/avgATR : 1;
    const volatility = atrRatio > 1.5 ? 'HIGH' : atrRatio < 0.6 ? 'LOW' : 'NORMAL';
    if (volatility === 'HIGH' && atrRatio > 2) return { trend: 'NEUTRAL', type: 'VOLATILE', volatility: 'HIGH', description: `Extreme volatility (${atrRatio.toFixed(1)}x ATR).` };
    const bull = price > ema8[last] && ema8[last] > ema21[last];
    const bear = price < ema8[last] && ema8[last] < ema21[last];
    const trending = Math.abs(last >= 5 ? ema21[last]-ema21[last-5] : 0) > atr[last]*0.3;
    if (bull) return { trend: 'BULL', type: trending ? 'TRENDING' : 'RANGING', volatility, description: `Bullish ${trending?'trend':'range'}.` };
    if (bear) return { trend: 'BEAR', type: trending ? 'TRENDING' : 'RANGING', volatility, description: `Bearish ${trending?'trend':'range'}.` };
    return { trend: 'NEUTRAL', type: 'RANGING', volatility, description: 'Neutral — no clear bias.' };
}

function generateSignal(symbol, bars, timeframe) {
    const regime = detectRegime(bars);
    const WAIT = { symbol, direction: 'WAIT', confidence: 0, entry: 0, stop: 0, target: 0, riskR: 1, rewardR: 0, setup: 'No Setup', reasons: [], warnings: ['No clear setup'], regime, timeframe, timestamp: new Date().toISOString() };
    if (bars.length < 50) return WAIT;
    const closes = bars.map(b=>b.close), volumes = bars.map(b=>b.volume);
    const ema8arr = computeEMA(closes,8), ema21arr = computeEMA(closes,21);
    const rsiArr = computeRSI(closes,14), atrArr = computeATR(bars,14);
    const last = bars.length-1, price = closes[last];
    const ema8=ema8arr[last], ema21=ema21arr[last], rsi=rsiArr[last], atr=atrArr[last];
    const volSlice = volumes.slice(Math.max(0,last-20),last+1);
    const avgVol = volSlice.reduce((a,b)=>a+b,0)/volSlice.length;
    const aboveAvgVol = volumes[last] > avgVol;
    const longScore = [price>ema8, ema8>ema21, rsi>=40&&rsi<=65, aboveAvgVol, regime.trend==='BULL'].filter(Boolean).length;
    const shortScore = [price<ema8, ema8<ema21, rsi>=35&&rsi<=60, aboveAvgVol, regime.trend==='BEAR'].filter(Boolean).length;
    if (longScore < 3 && shortScore < 3) return { ...WAIT, regime };
    const direction = longScore >= shortScore ? 'LONG' : 'SHORT';
    const score = direction === 'LONG' ? longScore : shortScore;
    let confidence = Math.min(100, Math.round((score/5)*80 + (aboveAvgVol?10:0) + (direction==='LONG'?regime.trend==='BULL':regime.trend==='BEAR'?10:0)));
    if (regime.type === 'VOLATILE') confidence = Math.max(0, confidence-15);
    const stop = direction === 'LONG' ? price - atr*1.5 : price + atr*1.5;
    const stopDist = Math.abs(price-stop);
    const mult = regime.type === 'RANGING' ? 1.5 : 2.0;
    const target = direction === 'LONG' ? price + stopDist*mult : price - stopDist*mult;
    const reasons = [`EMA8 (${ema8.toFixed(2)}) ${direction==='LONG'?'>':'<'} EMA21 (${ema21.toFixed(2)})`, `RSI ${rsi.toFixed(1)}`, aboveAvgVol ? `Volume ${(volumes[last]/avgVol).toFixed(1)}x avg` : 'Volume average'].filter(Boolean);
    return { symbol, direction, confidence, entry: parseFloat(price.toFixed(2)), stop: parseFloat(stop.toFixed(2)), target: parseFloat(target.toFixed(2)), riskR: 1, rewardR: mult, setup: direction==='LONG'?'Momentum Long':'Momentum Short', reasons, warnings: regime.type==='VOLATILE'?['Volatile regime — reduced confidence']:[], regime, timeframe, timestamp: new Date().toISOString() };
}

export default async function handler(req, res) {
    const startTime = Date.now();
    let newSignals = 0, tradesClosed = 0, sessionWins = 0, sessionLosses = 0, sessionGrossPnl = 0;
    const log = [];

  try {
        const { data: account, error: accErr } = await supabase.from('sentinel_account').select('*').eq('id', SENTINEL_ACCOUNT_ID).single();
        if (accErr || !account) return res.status(200).json({ skipped: true, reason: 'No sentinel_account. Run DB migration first.', error: accErr?.message });

      const { data: openTrades } = await supabase.from('sentinel_trades').select('*').eq('status', 'open').in('symbol', CRYPTO_SYMBOLS);
        const openSymbols = new Set((openTrades||[]).map(t=>t.symbol));

      for (const trade of (openTrades||[])) {
              try {
                        const currentPrice = await fetchCurrentPrice(trade.symbol);
                        if (!currentPrice) continue;
                        const isLong = trade.direction === 'LONG';
                        const stopHit = isLong ? currentPrice <= trade.stop : currentPrice >= trade.stop;
                        const targetHit = isLong ? currentPrice >= trade.target : currentPrice <= trade.target;
                        if (stopHit || targetHit) {
                                    const exitPrice = stopHit ? trade.stop : trade.target;
                                    const pnl = isLong ? (exitPrice-trade.entry)*(trade.dollar_size/trade.entry) : (trade.entry-exitPrice)*(trade.dollar_size/trade.entry);
                                    const resultR = stopHit ? -1 : trade.reward_r;
                                    const win = !stopHit;
                                    await supabase.from('sentinel_trades').update({ status:'closed', closed_at:new Date().toISOString(), exit_price:exitPrice, result_r:resultR, pnl:parseFloat(pnl.toFixed(2)), win, session_date:new Date().toISOString().split('T')[0] }).eq('id', trade.id);
                                    const newWins = account.wins+(win?1:0), newLosses = account.losses+(win?0:1), closedCount = account.closed_trades+1;
                                    await supabase.from('sentinel_account').update({ current_balance:parseFloat((account.current_balance+pnl).toFixed(2)), total_pnl:parseFloat((account.total_pnl+pnl).toFixed(2)), wins:newWins, losses:newLosses, closed_trades:closedCount, win_rate:parseFloat(((newWins/closedCount)*100).toFixed(2)), updated_at:new Date().toISOString() }).eq('id', SENTINEL_ACCOUNT_ID);
                                    await supabase.from('sentinel_copied_trades').update({ status:'closed', closed_at:new Date().toISOString(), exit_price:exitPrice, result_r:resultR, win }).eq('sentinel_trade_id', trade.id).eq('status','open');
                                    const { data: subs } = await supabase.from('sentinel_user_settings').select('user_id').eq('yolo_active',true).in('subscription_status',['trialing','active']);
                                    for (const u of (subs||[])) {
                                                  await supabase.from('sentinel_notifications').insert({ user_id:u.user_id, type:'trade_closed', title:`${win?'✓':'✗'} Sentinel closed ${trade.symbol.replace('/USD','')} — ${win?'+':''}${resultR}R`, body:`Exit $${exitPrice.toLocaleString()} · P&L $${pnl.toFixed(2)}`, trade_id:trade.id, read:false });
                                    }
                                    openSymbols.delete(trade.symbol);
                                    tradesClosed++;
                                    if (win) sessionWins++; else sessionLosses++;
                                    sessionGrossPnl += parseFloat(pnl.toFixed(2));
                                    log.push(`Closed ${trade.direction} ${trade.symbol} @ ${exitPrice} — ${win?'WIN':'LOSS'} ${resultR}R`);
                        }
                        // Volatility check — even if stop/target not hit, check for rapid moves
                        if (!stopHit && !targetHit) {
                          try {
                            const volRes = await fetch(`${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/sentinel/volatility-check`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ symbol: trade.symbol, trade: { ...trade, current_price: currentPrice }, currentPrice }),
                            });
                            const volResult = await volRes.json();
                            if (volResult.detected) {
                              log.push(`⚠️ VOLATILITY ${trade.symbol}: ${volResult.move?.magnitude?.toFixed(1)}% in ${volResult.move?.duration}min → ${volResult.analysis?.decision} (${volResult.analysis?.confidence}%)`);
                              if (volResult.execution?.action === 'closed') {
                                openSymbols.delete(trade.symbol);
                                tradesClosed++;
                              }
                            }
                          } catch (volErr) { log.push(`Vol check error ${trade.symbol}: ${volErr.message}`); }
                        }
                        await sleep(200);
              } catch (err) { log.push(`Error checking ${trade.symbol}: ${err.message}`); }
      }

      for (const symbol of CRYPTO_SYMBOLS) {
              if (openSymbols.has(symbol)) { log.push(`${symbol}: skipped — open position`); continue; }
              try {
                        const cacheKey = `sentinel:crypto:signal:${symbol}:1h`;
                        let signal = await redisGet(cacheKey);
                        if (!signal) {
                                    const bars = await fetchBars(symbol, '1h');
                                    signal = generateSignal(symbol, bars, '1h');
                                    await redisSet(cacheKey, signal, 300);
                                    log.push(`${symbol}: fresh — ${signal.direction} conf ${signal.confidence}`);
                        } else {
                                    log.push(`${symbol}: cached — ${signal.direction} conf ${signal.confidence}`);
                        }
                        if (signal.direction !== 'WAIT' && signal.confidence >= CRYPTO_MIN_CONFIDENCE) {
                                    const riskAmt = account.current_balance * 0.01;
                                    const stopDist = Math.abs(signal.entry - signal.stop);
                                    const size = stopDist > 0 ? riskAmt/stopDist : 0;
                                    const dollarSize = size * signal.entry;
                                    const { data: newTrade } = await supabase.from('sentinel_trades').insert({ symbol, direction:signal.direction, setup:signal.setup, timeframe:'1h', regime:`${signal.regime.trend}/${signal.regime.type}`, entry:signal.entry, stop:signal.stop, target:signal.target, size:parseFloat(size.toFixed(6)), dollar_size:parseFloat(dollarSize.toFixed(2)), risk_r:1, reward_r:signal.rewardR, confidence:signal.confidence, reasons:signal.reasons, status:'open', session_date:new Date().toISOString().split('T')[0], opened_at:new Date().toISOString() }).select().single();
                                    await supabase.from('sentinel_account').update({ total_trades:account.total_trades+1, updated_at:new Date().toISOString() }).eq('id', SENTINEL_ACCOUNT_ID);
                                    if (newTrade) {
                                                  const { data: subs } = await supabase.from('sentinel_user_settings').select('*').eq('yolo_active',true).in('subscription_status',['trialing','active']);
                                                  for (const u of (subs||[])) {
                                                                  const uRisk = u.allocated_capital*(u.risk_per_trade_pct/100);
                                                                  const uSize = stopDist > 0 ? uRisk/stopDist : 0;
                                                                  await supabase.from('sentinel_copied_trades').insert({ user_id:u.user_id, sentinel_trade_id:newTrade.id, symbol, direction:signal.direction, entry:signal.entry, stop:signal.stop, target:signal.target, size:parseFloat(uSize.toFixed(6)), dollar_size:parseFloat((uSize*signal.entry).toFixed(2)), opened_at:new Date().toISOString(), status:'open' });
                                                                  await supabase.from('sentinel_notifications').insert({ user_id:u.user_id, type:'trade_opened', title:`⚡ Sentinel ${signal.direction} ${symbol.replace('/USD','')}`, body:`Entry $${signal.entry.toLocaleString()} · Stop $${signal.stop.toLocaleString()} · Target $${signal.target.toLocaleString()} · Conf ${signal.confidence}`, trade_id:newTrade.id, read:false });
                                                  }
                                    }
                                    newSignals++; openSymbols.add(symbol);
                                    log.push(`✓ OPENED ${signal.direction} ${symbol} @ ${signal.entry} conf ${signal.confidence}`);
                        }
                        await sleep(300);
              } catch (err) { log.push(`Error scanning ${symbol}: ${err.message}`); }
      }

      const nowUTC = new Date();
        if (nowUTC.getUTCHours() === 0 && nowUTC.getUTCMinutes() < 2) {
                const today = nowUTC.toISOString().split('T')[0];
                const { data: sess } = await supabase.from('sentinel_sessions').select('session_ended_at').eq('session_date',today).single();
                if (!sess?.session_ended_at) {
                          await supabase.from('sentinel_sessions').upsert({ session_date:today, session_ended_at:new Date().toISOString() }, { onConflict:'session_date' });
                          fetch('https://stratifymarket.com/api/sentinel/learn').catch(()=>{});
                          log.push('Daily learn triggered');
                }
        }

      const today = new Date().toISOString().split('T')[0];
        const { data: existingSession } = await supabase.from('sentinel_sessions').select('*').eq('session_date', today).maybeSingle();
        if (existingSession) {
          await supabase.from('sentinel_sessions').update({
            trades_fired: (existingSession.trades_fired || 0) + newSignals,
            trades_closed: (existingSession.trades_closed || 0) + tradesClosed,
            wins: (existingSession.wins || 0) + sessionWins,
            losses: (existingSession.losses || 0) + sessionLosses,
            gross_pnl: parseFloat(((existingSession.gross_pnl || 0) + sessionGrossPnl).toFixed(2)),
          }).eq('id', existingSession.id);
        } else {
          await supabase.from('sentinel_sessions').insert({
            session_date: today,
            trades_fired: newSignals,
            trades_closed: tradesClosed,
            wins: sessionWins,
            losses: sessionLosses,
            gross_pnl: parseFloat(sessionGrossPnl.toFixed(2)),
            session_started_at: new Date().toISOString(),
          });
        }

      return res.status(200).json({ processed:true, cryptoSymbols:CRYPTO_SYMBOLS, openTradesChecked:openTrades?.length??0, tradesClosed, newSignals, duration:Date.now()-startTime, log, timestamp:new Date().toISOString() });

  } catch (err) {
        console.error('Sentinel crypto heartbeat error:', err);
        return res.status(500).json({ processed:false, error:err.message, log, timestamp:new Date().toISOString() });
  }
}
