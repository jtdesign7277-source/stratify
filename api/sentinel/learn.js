// api/sentinel/learn.js — Post-session Claude analysis + brain update + daily report
// Runs daily at 3am UTC (11pm ET) via Vercel cron

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY_SOPHIA;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Auth check for manual triggers
  if (req.method === 'POST') {
    const auth = req.headers['authorization'];
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    // Support ?date=YYYY-MM-DD for backfilling missing reports
    const today = req.query.date || new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

    // Load all data in parallel
    const [sessionRes, tradesRes, memoryRes, recentSessionsRes, accountRes] = await Promise.all([
      supabase.from('sentinel_sessions').select('*').eq('session_date', today).maybeSingle(),
      supabase.from('sentinel_trades').select('*').eq('session_date', today).eq('status', 'closed'),
      supabase.from('sentinel_memory').select('*').eq('id', 1).single(),
      supabase.from('sentinel_sessions').select('*').order('session_date', { ascending: false }).limit(14),
      supabase.from('sentinel_account').select('*').eq('id', '00000000-0000-0000-0000-000000000001').single(),
    ]);

    const session = sessionRes.data;
    const trades = tradesRes.data || [];
    const memory = memoryRes.data || {};
    const recentSessions = recentSessionsRes.data || [];
    const account = accountRes.data || {};

    if (!trades.length) {
      return res.status(200).json({ success: true, message: 'No closed trades today, skipping learn' });
    }

    const wins = trades.filter(t => t.win).length;
    const losses = trades.length - wins;
    const winRate = trades.length > 0 ? ((wins / trades.length) * 100).toFixed(1) : '0';
    const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const avgWin = wins > 0 ? trades.filter(t => t.win).reduce((s, t) => s + (t.pnl || 0), 0) / wins : 0;
    const avgLoss = losses > 0 ? Math.abs(trades.filter(t => !t.win).reduce((s, t) => s + (t.pnl || 0), 0) / losses) : 0;
    const dayOfWeek = new Date().getDay();
    const isFriday = dayOfWeek === 5;

    // Symbol breakdown
    const bySymbol = {};
    for (const t of trades) {
      if (!bySymbol[t.symbol]) bySymbol[t.symbol] = { wins: 0, losses: 0, pnl: 0, trades: 0 };
      bySymbol[t.symbol].trades++;
      bySymbol[t.symbol].pnl += t.pnl || 0;
      if (t.win) bySymbol[t.symbol].wins++; else bySymbol[t.symbol].losses++;
    }

    // Build Claude prompt
    const systemPrompt = `You are the elite trading intelligence behind Sentinel — an AI trading system with one mission: become the world's greatest trader. You analyze each day's performance with brutal honesty and surgical precision. Your daily reports are read by the system's owner who wants to see Sentinel improve every single day.

You must respond with valid JSON only — no prose outside the JSON, no markdown code blocks.`;

    const userPrompt = `
Today: ${today} | Account Balance: $${(account.current_balance || 0).toLocaleString()} | All-time P&L: $${(account.total_pnl || 0).toFixed(2)}

TODAY'S SESSION:
- Trades: ${trades.length} (${wins}W / ${losses}L)
- Win Rate: ${winRate}%
- Total P&L: $${totalPnl.toFixed(2)}
- Avg Win: $${avgWin.toFixed(2)} | Avg Loss: $${avgLoss.toFixed(2)}
- Win/Loss Ratio: ${avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : 'N/A'}x

BY SYMBOL:
${Object.entries(bySymbol).map(([sym, d]) => `  ${sym}: ${d.trades} trades, ${d.wins}W/${d.losses}L, $${d.pnl.toFixed(2)} P&L`).join('\n')}

TRADE LOG:
${JSON.stringify(trades.map(t => ({
  symbol: t.symbol, direction: t.direction, setup: t.setup,
  entry: t.entry, stop: t.stop, target: t.target, exit_price: t.exit_price,
  result_r: t.result_r, pnl: t.pnl, win: t.win, confidence: t.confidence,
  regime: t.regime, timeframe: t.timeframe
})), null, 2)}

LAST 14 SESSIONS TREND:
${JSON.stringify(recentSessions.map(s => ({
  date: s.session_date, trades: s.trades_fired, wins: s.wins, losses: s.losses, pnl: s.gross_pnl, winRate: s.trades_fired > 0 ? ((s.wins / s.trades_fired) * 100).toFixed(1) + '%' : '0%'
})), null, 2)}

CURRENT BRAIN STATE:
${JSON.stringify({ setup_weights: memory.setup_weights, regime_filters: memory.regime_filters, ticker_weights: memory.ticker_weights, suspended_conditions: memory.suspended_conditions, sessions_processed: memory.sessions_processed }, null, 2)}

Respond with this exact JSON structure:
{
  "confidence_adjustments": {},
  "suspended_conditions": [],
  "setup_weights": {},
  "regime_filters": {},
  "ticker_weights": {},
  "timeframe_weights": {},
  "plain_english_summary": "2-3 sentence brain update summary for internal memory",
  "daily_report": {
    "headline": "one punchy sentence summarizing the day — honest, direct",
    "what_worked": ["bullet 1", "bullet 2"],
    "what_failed": ["bullet 1", "bullet 2"],
    "biggest_mistake": "the single most costly error today and exactly why it happened",
    "adjustment": "one specific rule change Sentinel will implement tomorrow",
    "tomorrow_focus": "one clear tactical priority for tomorrow's trading session",
    "path_to_greatness": "1-2 sentences on what separates today's performance from world-class trading and what it will take to close that gap",
    "signal_health": {
      "bayesian": "1 sentence: how well the Bayesian model's posterior probabilities predicted actual outcomes today. Was the model overconfident? Underconfident? What needs recalibration?",
      "edge_filter": "1 sentence: did the Edge Filter correctly gate bad trades? Were any high-EV trades missed? Any false positives (PASS but lost)?",
      "spread": "1 sentence: were spreads normal or elevated? Did spread conditions affect entry quality?",
      "stoikov": "1 sentence: how did reservation price entries perform vs market entries? Better fills or worse?",
      "monte_carlo": "1 sentence: was Kelly sizing appropriate given today's outcomes? Did actual drawdown match simulated expectations?"
    }
  },
  "weekly_summary": ${isFriday ? '"3-4 sentence weekly review — wins, losses, trend, what changes next week"' : 'null'}
}

Rules:
- Adjust only what has 3+ data points. Small changes beat large ones.
- Win rate < 45% on any setup = suspend it
- Win rate > 70% = boost confidence +3 to +5
- daily_report must be honest and specific — no generic advice
- path_to_greatness must be actionable, not motivational fluff
`;

    // Call Claude
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 2500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    const anthropicData = await anthropicRes.json();
    const rawText = anthropicData.content?.[0]?.text || '{}';

    let parsed;
    try {
      // Strip markdown code fences, then extract the outermost JSON object
      const stripped = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const jsonMatch = stripped.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : stripped;
      parsed = JSON.parse(jsonStr);
    } catch {
      // Fallback: try to extract just the valid JSON prefix
      try {
        const stripped = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        // Find last complete key before truncation
        const lastBrace = stripped.lastIndexOf('}');
        if (lastBrace > 0) {
          // Close any open structures
          const partial = stripped.slice(0, lastBrace + 1);
          parsed = JSON.parse(partial);
        } else {
          throw new Error('no JSON found');
        }
      } catch {
        console.error('[learn] Failed to parse Claude response:', rawText.slice(0, 500));
        return res.status(500).json({ error: 'Failed to parse Claude response', raw: rawText.slice(0, 500) });
      }
    }

    const report = parsed.daily_report || {};

    // Merge adjustments into memory
    const mergedSetupWeights = { ...(memory.setup_weights || {}), ...(parsed.setup_weights || {}) };
    const mergedRegimeFilters = { ...(memory.regime_filters || {}), ...(parsed.regime_filters || {}) };
    const mergedTickerWeights = { ...(memory.ticker_weights || {}), ...(parsed.ticker_weights || {}) };
    const mergedTimeframeWeights = { ...(memory.timeframe_weights || {}), ...(parsed.timeframe_weights || {}) };
    const mergedConfAdjustments = { ...(memory.confidence_adjustments || {}), ...(parsed.confidence_adjustments || {}) };
    const existingSuspended = memory.suspended_conditions || [];
    const mergedSuspended = [...new Set([...existingSuspended, ...(parsed.suspended_conditions || [])])];

    // Update memory
    // Always replace brain_summary with today's fresh summary (not append)
    const freshSummary = parsed.plain_english_summary || memory.brain_summary;

    await supabase.from('sentinel_memory').update({
      setup_weights: mergedSetupWeights,
      regime_filters: mergedRegimeFilters,
      ticker_weights: mergedTickerWeights,
      timeframe_weights: mergedTimeframeWeights,
      confidence_adjustments: mergedConfAdjustments,
      suspended_conditions: mergedSuspended,
      sessions_processed: (memory.sessions_processed || 0) + 1,
      // Store summary + latest report date as JSON in brain_summary for status endpoint
      brain_summary: JSON.stringify({ text: freshSummary, report, date: today }),
      last_updated: new Date().toISOString(),
    }).eq('id', 1);

    // Update model weights for Bayesian priors (feedback loop)
    // Convert setup_weights into Bayesian priors (0-1 range)
    const setupPriors = {};
    for (const [setup, weight] of Object.entries(mergedSetupWeights)) {
      // Weight is typically -20 to +20, convert to 0.3-0.7 prior range
      setupPriors[setup] = Math.min(0.8, Math.max(0.2, 0.5 + (weight / 100)));
    }
    const symbolWeightsNormalized = {};
    for (const [sym, weight] of Object.entries(mergedTickerWeights)) {
      symbolWeightsNormalized[sym] = Math.min(1.5, Math.max(0.5, 1.0 + (weight / 50)));
    }

    await supabase.from('sentinel_model_weights').update({
      setup_priors: setupPriors,
      symbol_weights: symbolWeightsNormalized,
      regime_weights: mergedRegimeFilters,
      timeframe_weights: mergedTimeframeWeights,
      sessions_analyzed: (memory.sessions_processed || 0) + 1,
      updated_at: new Date().toISOString(),
    }).eq('id', 1);

    // Update session with full analysis
    const sessionUpdate = {
      claude_analysis: rawText,
      adjustments_made: parsed,
      wins,
      losses,
      gross_pnl: +totalPnl.toFixed(2),
    };
    if (isFriday && parsed.weekly_summary) {
      sessionUpdate.weekly_summary = parsed.weekly_summary;
    }
    if (session) {
      await supabase.from('sentinel_sessions').update(sessionUpdate).eq('id', session.id);
    }

    // Build notification body — brief summary for the notifications panel
    const notifTitle = `📊 ${today} — ${report.headline || 'Daily Report'}`;
    const notifBody = parsed.plain_english_summary || report.headline || 'Daily report ready.';

    // Notify ALL authenticated users (not just YOLO subscribers)
    // First delete any existing daily_report notifications for today to avoid duplicates
    await supabase.from('sentinel_notifications')
      .delete()
      .eq('type', 'daily_report')
      .like('title', `%${today}%`);

    const { data: allUsers } = await supabase.from('profiles').select('id');
    const userIds = (allUsers || []).map(u => u.id).filter(Boolean);
    if (userIds.length) {
      const notifications = userIds.map((uid) => ({
        user_id: uid,
        type: 'daily_report',
        title: notifTitle,
        body: notifBody,
        metadata: {
          session_date: today,
          session_id: session?.id || null,
          pnl: +totalPnl.toFixed(2),
          win_rate: +winRate,
          trades: trades.length,
          report,
        },
      }));
      await supabase.from('sentinel_notifications').insert(notifications);
    }

    return res.status(200).json({
      success: true,
      date: today,
      trades: trades.length,
      winRate: +winRate,
      pnl: +totalPnl.toFixed(2),
      adjustmentsMade: Object.keys(parsed).length,
      summary: parsed.plain_english_summary,
      report,
    });
  } catch (err) {
    console.error('[sentinel/learn] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
