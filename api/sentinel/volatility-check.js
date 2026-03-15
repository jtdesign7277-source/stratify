// api/sentinel/volatility-check.js
// Detects rapid price moves on open positions, analyzes context via Claude,
// decides whether to de-risk, close, hold, or short.
// Called from heartbeat-crypto.js every heartbeat cycle.

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const TWELVE_DATA_API_KEY = process.env.TWELVE_DATA_API_KEY || process.env.TWELVEDATA_API_KEY;
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const SENTINEL_ACCOUNT_ID = '00000000-0000-0000-0000-000000000001';

async function fetchRecentBars(symbol, interval = '5min', outputsize = 72) {
  // 72 x 5min = 6 hours of data
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&outputsize=${outputsize}&apikey=${TWELVE_DATA_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.values || !Array.isArray(data.values)) return [];
  return data.values.reverse().map(v => ({
    time: v.datetime,
    open: +v.open,
    high: +v.high,
    low: +v.low,
    close: +v.close,
    volume: +(v.volume || 0),
  }));
}

function detectRapidMove(bars, thresholds) {
  if (bars.length < 4) return null;

  const current = bars[bars.length - 1].close;
  const lookbackMinutes = thresholds?.lookback_minutes || 15;
  const barsToCheck = Math.ceil(lookbackMinutes / 5); // 5min bars

  // Check multiple windows: 5min, 10min, 15min
  for (const window of [1, 2, 3, barsToCheck]) {
    if (bars.length <= window) continue;
    const pastPrice = bars[bars.length - 1 - window].close;
    const pctChange = ((current - pastPrice) / pastPrice) * 100;
    const dropThreshold = thresholds?.rapid_drop_pct || -1.0;
    const spikeThreshold = thresholds?.rapid_spike_pct || 1.5;

    if (pctChange <= dropThreshold) {
      return {
        type: 'rapid_drop',
        magnitude: pctChange,
        duration: window * 5,
        priceBefore: pastPrice,
        priceNow: current,
      };
    }
    if (pctChange >= spikeThreshold) {
      return {
        type: 'rapid_spike',
        magnitude: pctChange,
        duration: window * 5,
        priceBefore: pastPrice,
        priceNow: current,
      };
    }
  }
  return null;
}

function computeVolumeRatio(bars) {
  if (bars.length < 10) return 1;
  const recent = bars.slice(-3).reduce((a, b) => a + b.volume, 0) / 3;
  const avg = bars.slice(0, -3).reduce((a, b) => a + b.volume, 0) / (bars.length - 3);
  return avg > 0 ? recent / avg : 1;
}

function computeATRFromBars(bars, period = 14) {
  if (bars.length < period + 1) return { current: 0, average: 0, ratio: 1 };
  const trs = bars.map((b, i) =>
    i === 0 ? b.high - b.low : Math.max(b.high - b.low, Math.abs(b.high - bars[i - 1].close), Math.abs(b.low - bars[i - 1].close))
  );
  const atrValues = [];
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  atrValues.push(atr);
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    atrValues.push(atr);
  }
  const currentATR = atrValues[atrValues.length - 1];
  const avgATR = atrValues.reduce((a, b) => a + b, 0) / atrValues.length;
  return { current: currentATR, average: avgATR, ratio: avgATR > 0 ? currentATR / avgATR : 1 };
}

async function analyzeWithClaude(symbol, bars, move, trade, pastEvents, memory) {
  const anthropic = new Anthropic();

  const priceAction = bars.slice(-24).map(b =>
    `${b.time} O:${b.open.toFixed(2)} H:${b.high.toFixed(2)} L:${b.low.toFixed(2)} C:${b.close.toFixed(2)} V:${b.volume}`
  ).join('\n');

  const pastEventsSummary = pastEvents.slice(0, 10).map(e =>
    `${e.detected_at}: ${e.symbol} ${e.event_type} ${e.magnitude_pct}% in ${e.duration_minutes}min → Decision: ${e.decision} (conf ${e.decision_confidence}) → Outcome: ${e.outcome || 'pending'} ${e.decision_was_correct != null ? (e.decision_was_correct ? '✓' : '✗') : ''}`
  ).join('\n');

  const volumeRatio = computeVolumeRatio(bars);
  const atrInfo = computeATRFromBars(bars);

  const systemPrompt = `You are Sentinel's volatility analysis engine. You detect rapid price moves and decide the best risk management action.

You have access to:
- Current 5-minute price action (last 2 hours)
- The rapid move details (magnitude, speed)
- Open position details
- Past volatility events and their outcomes (so you can learn from history)
- Volume and ATR context

Your job: Analyze the price action leading up to this move, decide what to do, and explain why.

CRITICAL RULES:
- You must respond with valid JSON only, no markdown
- Be specific about what you see in the price action
- Learn from past events: if similar moves bounced, factor that in
- Volume is key: high volume dumps are more dangerous than low volume
- ATR context matters: is this move unusual for this asset?`;

  const userPrompt = `RAPID MOVE DETECTED on ${symbol}:
Type: ${move.type}
Magnitude: ${move.magnitude.toFixed(2)}%
Duration: ${move.duration} minutes
Price before: $${move.priceBefore.toFixed(2)}
Price now: $${move.priceNow.toFixed(2)}

OPEN POSITION:
Direction: ${trade.direction}
Entry: $${trade.entry}
Stop: $${trade.stop}
Target: $${trade.target}
Size: ${trade.size} units ($${trade.dollar_size})
Current P&L: $${((move.priceNow - trade.entry) * trade.size * (trade.direction === 'SHORT' ? -1 : 1)).toFixed(2)}

MARKET CONTEXT:
Volume ratio: ${volumeRatio.toFixed(2)}x average
ATR ratio: ${atrInfo.ratio.toFixed(2)}x average (current: ${atrInfo.current.toFixed(2)}, avg: ${atrInfo.average.toFixed(2)})

RECENT PRICE ACTION (5min bars, last 2 hours):
${priceAction}

PAST VOLATILITY EVENTS (learn from these):
${pastEventsSummary || 'No past events yet — this is the first.'}

SENTINEL MEMORY PATTERNS:
${JSON.stringify(memory?.volatility_patterns || [], null, 2)}

Respond with this JSON structure:
{
  "context_summary": "2-3 sentence analysis of what led to this move",
  "decision": "reduce | close | hold | short",
  "confidence": 0-100,
  "reasoning": "Why this decision, referencing price action and past events",
  "reduce_pct": 25-75 (only if decision is "reduce"),
  "patterns_learned": ["pattern1", "pattern2"]
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content[0]?.text || '';
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return { decision: 'hold', confidence: 30, reasoning: 'Could not parse Claude response', context_summary: text.slice(0, 200) };
  } catch (err) {
    console.error('[volatility-check] Claude error:', err.message);
    return { decision: 'hold', confidence: 20, reasoning: `Claude error: ${err.message}`, context_summary: 'Analysis failed' };
  }
}

async function executeDecision(analysis, trade, account) {
  const { decision, confidence, reduce_pct } = analysis;
  const minConfidence = 65;

  if (confidence < minConfidence) {
    return { action: 'hold_low_confidence', details: `Confidence ${confidence} < ${minConfidence} threshold` };
  }

  if (decision === 'hold') {
    return { action: 'hold', details: 'Claude decided to hold' };
  }

  if (decision === 'reduce' && trade) {
    const reducePct = (reduce_pct || 50) / 100;
    const newSize = trade.size * (1 - reducePct);
    const removedSize = trade.size - newSize;
    const removedDollar = removedSize * trade.entry;

    await supabase.from('sentinel_trades').update({
      size: parseFloat(newSize.toFixed(6)),
      dollar_size: parseFloat((newSize * trade.entry).toFixed(2)),
    }).eq('id', trade.id);

    return {
      action: 'reduced',
      sizeBefore: trade.size,
      sizeAfter: newSize,
      reducedBy: `${(reducePct * 100).toFixed(0)}%`,
      dollarReduced: removedDollar.toFixed(2),
    };
  }

  if (decision === 'close' && trade) {
    const currentPrice = trade.current_price || analysis.priceNow;
    const isLong = trade.direction === 'LONG';
    const pnl = isLong
      ? (currentPrice - trade.entry) * (trade.dollar_size / trade.entry)
      : (trade.entry - currentPrice) * (trade.dollar_size / trade.entry);

    await supabase.from('sentinel_trades').update({
      status: 'closed',
      closed_at: new Date().toISOString(),
      exit_price: currentPrice,
      pnl: parseFloat(pnl.toFixed(2)),
      result_r: parseFloat((pnl / (account.current_balance * 0.01)).toFixed(2)),
      win: pnl > 0,
      session_date: new Date().toISOString().split('T')[0],
    }).eq('id', trade.id);

    // Update account
    const newBalance = account.current_balance + pnl;
    const win = pnl > 0;
    await supabase.from('sentinel_account').update({
      current_balance: parseFloat(newBalance.toFixed(2)),
      total_pnl: parseFloat((account.total_pnl + pnl).toFixed(2)),
      wins: account.wins + (win ? 1 : 0),
      losses: account.losses + (win ? 0 : 1),
      closed_trades: account.closed_trades + 1,
      win_rate: parseFloat((((account.wins + (win ? 1 : 0)) / (account.closed_trades + 1)) * 100).toFixed(2)),
      updated_at: new Date().toISOString(),
    }).eq('id', SENTINEL_ACCOUNT_ID);

    return { action: 'closed', pnl: pnl.toFixed(2), exitPrice: currentPrice };
  }

  return { action: 'hold', details: 'No matching action' };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { symbol, trade, currentPrice } = req.body || {};
    if (!symbol || !trade) {
      return res.status(400).json({ error: 'symbol and trade required' });
    }

    // Fetch 6 hours of 5min bars
    const bars = await fetchRecentBars(symbol, '5min', 72);
    if (bars.length < 10) {
      return res.status(200).json({ skipped: true, reason: 'Insufficient bar data' });
    }

    // Get volatility thresholds from memory
    const { data: memory } = await supabase.from('sentinel_memory')
      .select('volatility_thresholds, volatility_patterns')
      .eq('id', 1).single();

    const thresholds = memory?.volatility_thresholds || {};

    // Detect rapid move
    const move = detectRapidMove(bars, thresholds);
    if (!move) {
      return res.status(200).json({ skipped: true, reason: 'No rapid move detected' });
    }

    // Check cooldown — don't fire more than once per 15 min per symbol
    const { data: recentEvent } = await supabase.from('sentinel_volatility_events')
      .select('id')
      .eq('symbol', symbol)
      .gte('detected_at', new Date(Date.now() - 15 * 60000).toISOString())
      .limit(1)
      .maybeSingle();

    if (recentEvent) {
      return res.status(200).json({ skipped: true, reason: 'Cooldown — event already fired in last 15min' });
    }

    // Fetch past events for learning
    const { data: pastEvents } = await supabase.from('sentinel_volatility_events')
      .select('*')
      .eq('symbol', symbol)
      .order('detected_at', { ascending: false })
      .limit(10);

    // Get account for execution
    const { data: account } = await supabase.from('sentinel_account')
      .select('*').eq('id', SENTINEL_ACCOUNT_ID).single();

    // Analyze with Claude
    const analysis = await analyzeWithClaude(symbol, bars, move, trade, pastEvents || [], memory);

    // Execute decision
    const execution = await executeDecision(analysis, trade, account);

    // Store event
    const atrInfo = computeATRFromBars(bars);
    const volumeRatio = computeVolumeRatio(bars);

    const { data: event } = await supabase.from('sentinel_volatility_events').insert({
      symbol,
      event_type: move.type,
      magnitude_pct: parseFloat(move.magnitude.toFixed(4)),
      duration_minutes: move.duration,
      price_at_detection: move.priceNow,
      price_before: move.priceBefore,
      atr_ratio: parseFloat(atrInfo.ratio.toFixed(4)),
      volume_ratio: parseFloat(volumeRatio.toFixed(4)),
      context_summary: analysis.context_summary,
      decision: analysis.decision,
      decision_confidence: analysis.confidence,
      reasoning: analysis.reasoning,
      action_taken: execution.action,
      position_size_before: trade.size,
      position_size_after: execution.sizeAfter || trade.size,
      trade_id: trade.id,
    }).select().single();

    // Update memory with new patterns
    if (analysis.patterns_learned?.length) {
      const existingPatterns = memory?.volatility_patterns || [];
      const merged = [...new Set([...existingPatterns, ...analysis.patterns_learned])].slice(-50);
      await supabase.from('sentinel_memory').update({
        volatility_patterns: merged,
      }).eq('id', 1);
    }

    // Notify YOLO subscribers
    if (execution.action !== 'hold' && execution.action !== 'hold_low_confidence') {
      const { data: subs } = await supabase.from('sentinel_user_settings')
        .select('user_id').eq('yolo_active', true)
        .in('subscription_status', ['trialing', 'active']);

      for (const u of (subs || [])) {
        await supabase.from('sentinel_notifications').insert({
          user_id: u.user_id,
          type: 'trade_closed',
          title: `⚠️ Volatility: ${symbol} ${move.magnitude.toFixed(1)}% in ${move.duration}min`,
          body: `Decision: ${analysis.decision} (${analysis.confidence}% confidence). ${analysis.reasoning?.slice(0, 100)}`,
          read: false,
        });
      }
    }

    return res.status(200).json({
      detected: true,
      symbol,
      move,
      analysis: { decision: analysis.decision, confidence: analysis.confidence, reasoning: analysis.reasoning },
      execution,
      eventId: event?.id,
    });

  } catch (err) {
    console.error('[volatility-check] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
