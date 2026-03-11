// Vercel serverless: auto-settle paper_sports_bets using The Odds API scores.
// Env: ODDS_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DISCORD_WEBHOOK_SHOW_YOUR_PNL

const ODDS_BASE = 'https://api.the-odds-api.com/v4';

function normalizeTeam(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function matchGame(scoreEvent, homeTeam, awayTeam) {
  if (!scoreEvent || !homeTeam || !awayTeam) return false;
  const h = normalizeTeam(scoreEvent.home_team);
  const a = normalizeTeam(scoreEvent.away_team);
  const betH = normalizeTeam(homeTeam);
  const betA = normalizeTeam(awayTeam);
  return (h === betH && a === betA) || (h === betA && a === betH);
}

function settleSpread(selection, line, homeScore, awayScore, homeTeam, awayTeam) {
  const lineNum = parseFloat(String(line).replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(lineNum)) return null;
  const spreadHome = lineNum;
  const spreadAway = -lineNum;
  const homeCovers = homeScore + spreadHome > awayScore;
  const awayCovers = awayScore + spreadAway > homeScore;
  const sel = normalizeTeam(selection);
  const isHome = sel === normalizeTeam(homeTeam) || normalizeTeam(homeTeam).includes(sel) || sel.includes(normalizeTeam(homeTeam));
  return isHome ? (homeCovers ? 'won' : 'lost') : awayCovers ? 'won' : 'lost';
}

function settleMoneyline(selection, homeScore, awayScore, homeTeam, awayTeam) {
  const homeWon = homeScore > awayScore;
  const awayWon = awayScore > homeScore;
  if (homeScore === awayScore) return 'push';
  const sel = normalizeTeam(selection);
  const isHome = sel === normalizeTeam(homeTeam) || normalizeTeam(homeTeam).includes(sel) || sel.includes(normalizeTeam(homeTeam));
  return isHome ? (homeWon ? 'won' : 'lost') : awayWon ? 'won' : 'lost';
}

function settleTotal(selection, line, homeScore, awayScore) {
  const total = homeScore + awayScore;
  const lineNum = parseFloat(String(line).replace(/[^\d.]/g, ''));
  if (!Number.isFinite(lineNum)) return null;
  const isOver = normalizeTeam(selection).includes('over') || String(selection).toUpperCase().startsWith('O');
  if (total > lineNum) return isOver ? 'won' : 'lost';
  if (total < lineNum) return isOver ? 'lost' : 'won';
  return 'push';
}

function payout(stake, americanOdds, result) {
  if (result === 'lost') return 0;
  if (result === 'push') return stake;
  const n = Number(americanOdds);
  const decimal = n > 0 ? n / 100 + 1 : 100 / Math.abs(n) + 1;
  return stake * decimal;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = (process.env.ODDS_API_KEY || process.env.VITE_ODDS_API_KEY || '').trim();
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const discordWebhook = process.env.DISCORD_WEBHOOK_SHOW_YOUR_PNL;

  if (!apiKey || !supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing ODDS_API_KEY, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY' });
  }

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data: pendingBets } = await supabase
      .from('paper_sports_bets')
      .select('*')
      .eq('status', 'pending');

    if (!pendingBets?.length) {
      return res.status(200).json({ settled: 0, message: 'No pending bets' });
    }

    const sportsNeeded = [...new Set(pendingBets.map((b) => b.sport).filter(Boolean))];
    const scoresBySport = {};

    for (const sport of sportsNeeded) {
      const url = `${ODDS_BASE}/sports/${encodeURIComponent(sport)}/scores?apiKey=${encodeURIComponent(apiKey)}&daysFrom=1`;
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      const data = await response.json().catch(() => []);
      scoresBySport[sport] = Array.isArray(data) ? data : [];
    }

    let settled = 0;
    for (const bet of pendingBets) {
      const events = scoresBySport[bet.sport] || [];
      const scoreEvent = events.find((e) => e.completed && matchGame(e, bet.home_team, bet.away_team));
      if (!scoreEvent) continue;

      const homeScore = Number(scoreEvent.home_score ?? scoreEvent.scores?.[1] ?? 0);
      const awayScore = Number(scoreEvent.away_score ?? scoreEvent.scores?.[0] ?? 0);

      let result = null;
      const betType = (bet.bet_type || '').toLowerCase();
      if (betType === 'spread') {
        result = settleSpread(bet.selection, bet.line, homeScore, awayScore, bet.home_team, bet.away_team);
      } else if (betType === 'moneyline') {
        result = settleMoneyline(bet.selection, homeScore, awayScore, bet.home_team, bet.away_team);
      } else if (betType === 'total') {
        result = settleTotal(bet.selection, bet.line, homeScore, awayScore);
      }
      if (!result) continue;

      const actualPayout = payout(Number(bet.stake) || 0, Number(bet.odds), result);

      await supabase
        .from('paper_sports_bets')
        .update({
          status: result,
          actual_payout: actualPayout,
          home_score: homeScore,
          away_score: awayScore,
          result_resolved_at: new Date().toISOString(),
        })
        .eq('id', bet.id);

      const { data: bank } = await supabase
        .from('paper_sports_bankroll')
        .select('balance, wins, losses, total_pushes, total_won, total_lost, current_streak, biggest_win')
        .eq('user_id', bet.user_id)
        .maybeSingle();

      const balance = Number(bank?.balance) ?? 0;
      const wins = Number(bank?.wins) ?? 0;
      const losses = Number(bank?.losses) ?? 0;
      const totalPushes = Number(bank?.total_pushes) ?? 0;
      const totalWon = Number(bank?.total_won) ?? 0;
      const totalLost = Number(bank?.total_lost) ?? 0;
      const currentStreak = Number(bank?.current_streak) ?? 0;
      const biggestWin = Number(bank?.biggest_win) ?? 0;

      const newBalance = balance + actualPayout;
      const updates = {
        balance: newBalance,
        wins: result === 'won' ? wins + 1 : wins,
        losses: result === 'lost' ? losses + 1 : losses,
        total_pushes: result === 'push' ? totalPushes + 1 : totalPushes,
        total_won: result === 'won' ? totalWon + (actualPayout - bet.stake) : totalWon,
        total_lost: result === 'lost' ? totalLost + bet.stake : totalLost,
        current_streak:
          result === 'won' ? (currentStreak >= 0 ? currentStreak + 1 : 1) : result === 'lost' ? (currentStreak <= 0 ? currentStreak - 1 : -1) : currentStreak,
        biggest_win: result === 'won' && actualPayout - bet.stake > biggestWin ? actualPayout - bet.stake : biggestWin,
      };

      await supabase.from('paper_sports_bankroll').upsert(
        {
          user_id: bet.user_id,
          ...updates,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

      if (discordWebhook) {
        const title = result === 'won' ? `✅ WIN — ${bet.selection}` : result === 'lost' ? `❌ LOSS — ${bet.selection}` : `➖ PUSH — ${bet.selection}`;
        const color = result === 'won' ? 0x00ff88 : result === 'lost' ? 0xff4444 : 0x888888;
        await fetch(discordWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            embeds: [
              {
                title,
                color,
                fields: [
                  { name: 'Odds', value: String(bet.odds), inline: true },
                  { name: 'Stake', value: `$${Number(bet.stake).toFixed(2)}`, inline: true },
                  {
                    name: result === 'won' ? 'Payout' : result === 'lost' ? 'Loss' : 'Refund',
                    value: `$${actualPayout.toFixed(2)}`,
                    inline: true,
                  },
                  { name: 'New bankroll', value: `$${newBalance.toFixed(2)}`, inline: false },
                ],
                footer: { text: 'Stratify Paper Sports | Not financial advice' },
              },
            ],
          }),
        }).catch(() => {});
      }

      settled++;
    }

    return res.status(200).json({ settled });
  } catch (e) {
    console.error('[settle-sports-bets]', e);
    return res.status(500).json({ error: String(e?.message || 'Settlement failed') });
  }
}
