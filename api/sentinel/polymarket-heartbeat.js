// api/sentinel/polymarket-heartbeat.js — Polymarket BTC paper trading
// Scans live BTC prediction markets, paper trades based on technical signals
// Runs every minute via Vercel cron

import { createClient } from '@supabase/supabase-js';

const TWELVE_DATA_KEY = process.env.TWELVEDATA_API_KEY || process.env.TWELVE_DATA_API_KEY;
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const ACCOUNT_ID = '00000000-0000-0000-0000-000000000001';
const GAMMA_API = 'https://gamma-api.polymarket.com';
const MAX_OPEN_POLY_TRADES = 5;
const BET_SIZE = 500; // $500 per bet

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Fetch live BTC price from Twelve Data
async function fetchBTCPrice() {
  const url = `https://api.twelvedata.com/quote?symbol=BTC/USD&apikey=${TWELVE_DATA_KEY}`;
  const resp = await fetch(url);
  const data = await resp.json();
  return +data.close;
}

// Fetch BTC 5-min bars for momentum analysis
async function fetchBTCBars() {
  const url = `https://api.twelvedata.com/time_series?symbol=BTC/USD&interval=5min&outputsize=50&apikey=${TWELVE_DATA_KEY}`;
  const resp = await fetch(url);
  const data = await resp.json();
  if (!data.values) return null;
  return data.values.map(v => ({ close: +v.close, high: +v.high, low: +v.low })).reverse();
}

function computeEMA(values, period) {
  if (values.length < period) return values.map(() => NaN);
  const ema = [...values];
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  ema[period - 1] = sum / period;
  const k = 2 / (period + 1);
  for (let i = period; i < values.length; i++) ema[i] = values[i] * k + ema[i - 1] * (1 - k);
  return ema;
}

function computeRSI(closes, period = 14) {
  if (closes.length <= period) return 50;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const c = closes[i] - closes[i - 1];
    if (c > 0) avgGain += c; else avgLoss += Math.abs(c);
  }
  avgGain /= period; avgLoss /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const c = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (c > 0 ? c : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (c < 0 ? Math.abs(c) : 0)) / period;
  }
  return avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
}

// Determine BTC momentum: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
function analyzeMomentum(bars) {
  if (!bars || bars.length < 20) return { bias: 'NEUTRAL', confidence: 50 };
  const closes = bars.map(b => b.close);
  const ema8 = computeEMA(closes, 8);
  const ema21 = computeEMA(closes, 21);
  const last = closes.length - 1;
  const rsi = computeRSI(closes);
  const e8 = ema8[last], e21 = ema21[last], price = closes[last];

  let score = 0;
  if (price > e8) score++; else score--;
  if (e8 > e21) score++; else score--;
  if (rsi > 55) score++; else if (rsi < 45) score--;
  // Recent trend (last 5 bars)
  const recent = closes.slice(-5);
  if (recent[4] > recent[0]) score++; else score--;

  if (score >= 2) return { bias: 'BULLISH', confidence: 55 + score * 5, rsi, ema8: e8, ema21: e21 };
  if (score <= -2) return { bias: 'BEARISH', confidence: 55 + Math.abs(score) * 5, rsi, ema8: e8, ema21: e21 };
  return { bias: 'NEUTRAL', confidence: 50, rsi, ema8: e8, ema21: e21 };
}

// Fetch BTC prediction markets from Polymarket
async function fetchBTCMarkets() {
  const markets = [];
  try {
    // 1. Search for BTC strike events by keyword (events API)
    const searchUrls = [
      `${GAMMA_API}/events?active=true&closed=false&limit=200`,
    ];

    for (const url of searchUrls) {
      const resp = await fetch(url);
      const events = await resp.json();

      // Filter for Bitcoin-related events
      const btcEvents = events.filter(e => {
        const t = (e.title || '').toLowerCase();
        const s = (e.slug || '').toLowerCase();
        return (t.includes('bitcoin') || t.includes('btc')) &&
               (t.includes('above') || t.includes('price') || t.includes('hit') || s.includes('btc'));
      });

      for (const event of btcEvents) {
        if (!event.markets) continue;
        for (const m of event.markets) {
          if (!m.acceptingOrders) continue;
          const prices = m.outcomePrices ? JSON.parse(m.outcomePrices) : null;
          if (!prices || !prices[0]) continue;

          // Extract strike price from question
          const strikeMatch = m.question?.match(/\$?([\d,]+)/);
          const strike = strikeMatch ? +strikeMatch[1].replace(/,/g, '') : null;

          markets.push({
            id: String(m.id),
            conditionId: m.conditionId,
            question: m.question,
            strike,
            yesPrice: +prices[0],
            noPrice: +prices[1],
            bestBid: +(m.bestBid || 0),
            bestAsk: +(m.bestAsk || 0),
            endDate: m.endDate || event.endDate,
            volume: +m.volume || 0,
            liquidity: +m.liquidity || 0,
            closed: m.closed,
          });
        }
      }
    }

    return markets.sort((a, b) => (a.strike || 0) - (b.strike || 0));
  } catch (err) {
    console.error('[polymarket] Error fetching markets:', err.message);
    return [];
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const log = [];
  let newTrades = 0, resolved = 0;

  try {
    // Load account + open polymarket trades
    const [accountRes, openTradesRes] = await Promise.all([
      supabase.from('sentinel_account').select('*').eq('id', ACCOUNT_ID).single(),
      supabase.from('sentinel_polymarket_trades').select('*').eq('status', 'open'),
    ]);

    const account = accountRes.data || {};
    const openTrades = openTradesRes.data || [];

    // === CHECK OPEN TRADES FOR RESOLUTION ===
    for (const trade of openTrades) {
      try {
        // Check if market has resolved by re-fetching from Gamma
        const resp = await fetch(`${GAMMA_API}/markets?id=${trade.market_id}`);
        const markets = await resp.json();
        const market = markets?.[0];

        if (!market) continue;

        // Check if resolved
        const isResolved = market.closed || market.resolved;
        if (isResolved) {
          const outcomes = market.outcomes ? JSON.parse(market.outcomes) : ['Yes', 'No'];
          const prices = market.outcomePrices ? JSON.parse(market.outcomePrices) : null;

          // Determine winning outcome
          let winningOutcome = null;
          if (prices) {
            const yesPrice = +prices[0];
            // If yes price is 1 or very close, Yes won. If 0, No won.
            if (yesPrice >= 0.95) winningOutcome = 'YES';
            else if (yesPrice <= 0.05) winningOutcome = 'NO';
          }

          if (winningOutcome) {
            const win = trade.side === winningOutcome;
            const payout = win ? trade.shares * 1.0 : 0;
            const pnl = payout - trade.dollar_cost;

            await supabase.from('sentinel_polymarket_trades').update({
              resolved: true,
              outcome: winningOutcome,
              payout: +payout.toFixed(2),
              pnl: +pnl.toFixed(2),
              win,
              status: 'resolved',
              resolved_at: new Date().toISOString(),
            }).eq('id', trade.id);

            // Update account balance
            await supabase.from('sentinel_account').update({
              current_balance: +(account.current_balance + pnl).toFixed(2),
              total_pnl: +(account.total_pnl + pnl).toFixed(2),
              updated_at: new Date().toISOString(),
            }).eq('id', ACCOUNT_ID);

            resolved++;
            log.push(`RESOLVED: ${trade.question} — ${winningOutcome} — ${win ? 'WIN' : 'LOSS'} $${pnl.toFixed(2)}`);
          }
        }
        await sleep(200);
      } catch (err) {
        log.push(`Error checking trade ${trade.id}: ${err.message}`);
      }
    }

    // === SCAN FOR NEW TRADES ===
    if (openTrades.length - resolved < MAX_OPEN_POLY_TRADES) {
      const [btcPrice, bars, btcMarkets] = await Promise.all([
        fetchBTCPrice(),
        fetchBTCBars(),
        fetchBTCMarkets(),
      ]);

      const momentum = analyzeMomentum(bars);
      log.push(`BTC: $${btcPrice?.toLocaleString()} | Momentum: ${momentum.bias} (${momentum.confidence}%) | RSI: ${momentum.rsi?.toFixed(1)}`);

      if (momentum.bias !== 'NEUTRAL' && btcMarkets.length > 0) {
        // Find tradeable strike markets
        const openMarketIds = new Set(openTrades.filter(t => t.status === 'open').map(t => t.market_id));

        for (const market of btcMarkets) {
          if (openMarketIds.has(market.id)) continue;
          if (!market.strike || !market.yesPrice) continue;
          if (openTrades.length - resolved + newTrades >= MAX_OPEN_POLY_TRADES) break;

          let side = null;
          let entryPrice = null;
          let confidence = momentum.confidence;
          let setup = null;
          let reasons = [];

          if (momentum.bias === 'BULLISH') {
            // Buy YES on strikes near or below current price (high probability of profit)
            // Look for strikes where YES is underpriced relative to momentum
            if (market.strike <= btcPrice && market.yesPrice < 0.92) {
              // BTC is already above this strike — YES should be high but isn't maxed
              side = 'YES';
              entryPrice = market.yesPrice;
              setup = 'BTC Strike Momentum (Bullish)';
              reasons = [`BTC $${btcPrice.toLocaleString()} already above $${market.strike.toLocaleString()} strike`, `YES at ${(market.yesPrice * 100).toFixed(1)}% — room to profit`, `Momentum: ${momentum.bias}`];
            } else if (market.strike > btcPrice && market.strike <= btcPrice * 1.05 && market.yesPrice >= 0.25 && market.yesPrice <= 0.70) {
              // Strike is slightly above current — a momentum bet
              side = 'YES';
              entryPrice = market.yesPrice;
              setup = 'BTC Strike Breakout Bet';
              reasons = [`BTC $${btcPrice.toLocaleString()} approaching $${market.strike.toLocaleString()} strike`, `YES at ${(market.yesPrice * 100).toFixed(1)}% — good risk/reward`, `Bullish momentum, betting on breakout`];
            }
          } else if (momentum.bias === 'BEARISH') {
            // Buy NO on strikes near or above current price
            if (market.strike >= btcPrice && market.noPrice < 0.92) {
              side = 'NO';
              entryPrice = market.noPrice;
              setup = 'BTC Strike Momentum (Bearish)';
              reasons = [`BTC $${btcPrice.toLocaleString()} below $${market.strike.toLocaleString()} strike`, `NO at ${(market.noPrice * 100).toFixed(1)}% — room to profit`, `Momentum: ${momentum.bias}`];
            } else if (market.strike < btcPrice && market.strike >= btcPrice * 0.95 && market.noPrice >= 0.25 && market.noPrice <= 0.70) {
              side = 'NO';
              entryPrice = market.noPrice;
              setup = 'BTC Strike Breakdown Bet';
              reasons = [`BTC $${btcPrice.toLocaleString()} may drop below $${market.strike.toLocaleString()}`, `NO at ${(market.noPrice * 100).toFixed(1)}% — good risk/reward`, `Bearish momentum, betting on breakdown`];
            }
          }

          if (side && entryPrice && entryPrice > 0.01 && entryPrice < 0.99) {
            const shares = Math.floor(BET_SIZE / entryPrice);
            const dollarCost = +(shares * entryPrice).toFixed(2);

            if (shares > 0 && dollarCost <= account.current_balance * 0.05) {
              await supabase.from('sentinel_polymarket_trades').insert({
                market_id: market.id,
                condition_id: market.conditionId,
                question: market.question,
                market_type: 'strike',
                side,
                entry_price: entryPrice,
                shares,
                dollar_cost: dollarCost,
                confidence,
                setup,
                reasons,
                btc_price_at_entry: btcPrice,
                closes_at: market.endDate,
                session_date: new Date().toISOString().split('T')[0],
              });

              // Deduct from account
              await supabase.from('sentinel_account').update({
                current_balance: +(account.current_balance - dollarCost).toFixed(2),
                total_trades: (account.total_trades || 0) + 1,
                updated_at: new Date().toISOString(),
              }).eq('id', ACCOUNT_ID);

              newTrades++;
              log.push(`OPENED: ${side} "${market.question}" @ $${entryPrice.toFixed(3)} × ${shares} shares ($${dollarCost})`);
            }
          }
        }
      } else {
        log.push(`No trade — momentum is ${momentum.bias}`);
      }
    } else {
      log.push(`Max open polymarket trades reached (${MAX_OPEN_POLY_TRADES})`);
    }

    return res.status(200).json({
      processed: true,
      newTrades,
      resolved,
      openPositions: openTrades.length - resolved + newTrades,
      log,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[polymarket-heartbeat] Error:', err);
    return res.status(500).json({ error: err.message, log });
  }
}
