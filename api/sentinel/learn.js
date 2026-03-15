// api/sentinel/learn.js — Post-session Claude analysis + brain update
// Called by heartbeat at 4pm ET

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY_SOPHIA;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const today = new Date().toISOString().slice(0, 10);

    // Load today's data
    const [sessionRes, tradesRes, memoryRes, recentSessionsRes] = await Promise.all([
      supabase.from('sentinel_sessions').select('*').eq('session_date', today).maybeSingle(),
      supabase.from('sentinel_trades').select('*').eq('session_date', today).eq('status', 'closed'),
      supabase.from('sentinel_memory').select('*').eq('id', 1).single(),
      supabase.from('sentinel_sessions').select('*').order('session_date', { ascending: false }).limit(7),
    ]);

    const session = sessionRes.data;
    const trades = tradesRes.data || [];
    const memory = memoryRes.data || {};
    const recentSessions = recentSessionsRes.data || [];

    if (!trades.length) {
      return res.status(200).json({ success: true, message: 'No closed trades today, skipping learn' });
    }

    const wins = trades.filter(t => t.win).length;
    const winRate = trades.length > 0 ? ((wins / trades.length) * 100).toFixed(1) : '0';
    const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);

    const dayOfWeek = new Date().getDay();
    const isFriday = dayOfWeek === 5;

    // Build Claude prompt
    const systemPrompt = `You are the learning engine for Sentinel, an autonomous AI trading system. Your job is to analyze today's trading session and identify specific, actionable rule adjustments that will improve performance. You must respond with valid JSON only — no prose, no markdown, no explanation outside the JSON structure.`;

    const userPrompt = `
Today's session: ${today}
Trades: ${JSON.stringify(trades.map(t => ({ symbol: t.symbol, direction: t.direction, setup: t.setup, timeframe: t.timeframe, regime: t.regime, entry: t.entry, stop: t.stop, target: t.target, exit_price: t.exit_price, result_r: t.result_r, pnl: t.pnl, win: t.win, confidence: t.confidence })), null, 2)}
Results: ${wins}/${trades.length} — ${winRate}% — $${totalPnl.toFixed(2)} P&L
Last 7 days: ${JSON.stringify(recentSessions.map(s => ({ date: s.session_date, trades: s.trades_fired, wins: s.wins, losses: s.losses, pnl: s.gross_pnl })), null, 2)}
Current memory/rules: ${JSON.stringify({ setup_weights: memory.setup_weights, regime_filters: memory.regime_filters, ticker_weights: memory.ticker_weights, timeframe_weights: memory.timeframe_weights, confidence_adjustments: memory.confidence_adjustments, suspended_conditions: memory.suspended_conditions, sessions_processed: memory.sessions_processed }, null, 2)}

Analyze what worked and what didn't. Return this exact JSON:
{
  "confidence_adjustments": {},
  "suspended_conditions": [],
  "setup_weights": {},
  "regime_filters": {},
  "ticker_weights": {},
  "timeframe_weights": {},
  "plain_english_summary": "2-3 sentences: what happened today and what changed",
  "weekly_summary": ${isFriday ? '"3-4 sentence weekly review"' : 'null'}
}

Rules for adjustments:
- Numbers are additive confidence score changes (-10 to +10 range)
- Only adjust things with 3+ data points — never adjust on 1-2 trades
- If win_rate < 50% on a setup today: suggest suspending it
- If win_rate > 75% on a setup today: boost confidence +3 to +5
- Be conservative — small consistent adjustments beat large volatile ones
- plain_english_summary must be written so a regular person understands it
`;

    // Call Claude API
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    const anthropicData = await anthropicRes.json();
    const rawText = anthropicData.content?.[0]?.text || '{}';

    let parsed;
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
    } catch {
      console.error('[learn] Failed to parse Claude response:', rawText);
      return res.status(500).json({ error: 'Failed to parse Claude response' });
    }

    // Merge adjustments into memory (accumulate, don't overwrite)
    const mergedSetupWeights = { ...(memory.setup_weights || {}), ...(parsed.setup_weights || {}) };
    const mergedRegimeFilters = { ...(memory.regime_filters || {}), ...(parsed.regime_filters || {}) };
    const mergedTickerWeights = { ...(memory.ticker_weights || {}), ...(parsed.ticker_weights || {}) };
    const mergedTimeframeWeights = { ...(memory.timeframe_weights || {}), ...(parsed.timeframe_weights || {}) };
    const mergedConfAdjustments = { ...(memory.confidence_adjustments || {}), ...(parsed.confidence_adjustments || {}) };

    // Merge suspended conditions (add new, keep existing)
    const existingSuspended = memory.suspended_conditions || [];
    const newSuspended = parsed.suspended_conditions || [];
    const mergedSuspended = [...new Set([...existingSuspended, ...newSuspended])];

    // Update memory
    await supabase.from('sentinel_memory').update({
      setup_weights: mergedSetupWeights,
      regime_filters: mergedRegimeFilters,
      ticker_weights: mergedTickerWeights,
      timeframe_weights: mergedTimeframeWeights,
      confidence_adjustments: mergedConfAdjustments,
      suspended_conditions: mergedSuspended,
      sessions_processed: (memory.sessions_processed || 0) + 1,
      brain_summary: parsed.plain_english_summary || memory.brain_summary,
      last_updated: new Date().toISOString(),
    }).eq('id', 1);

    // Update session
    const sessionUpdate = {
      claude_analysis: rawText,
      adjustments_made: parsed,
      wins,
      losses: trades.length - wins,
      gross_pnl: +totalPnl.toFixed(2),
    };
    if (isFriday && parsed.weekly_summary) {
      sessionUpdate.weekly_summary = parsed.weekly_summary;
    }

    if (session) {
      await supabase.from('sentinel_sessions').update(sessionUpdate).eq('id', session.id);
    }

    // Notify ALL users (not just YOLO subscribers)
    const { data: allUsers } = await supabase.from('sentinel_user_settings').select('user_id');
    if (allUsers?.length) {
      const notifications = allUsers.map((u) => ({
        user_id: u.user_id,
        type: 'brain_update',
        title: 'Sentinel updated its brain',
        body: parsed.plain_english_summary || 'Brain update completed',
      }));
      await supabase.from('sentinel_notifications').insert(notifications);
    }

    return res.status(200).json({
      success: true,
      adjustmentsMade: Object.keys(parsed).length,
      summary: parsed.plain_english_summary,
    });
  } catch (err) {
    console.error('[sentinel/learn] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
