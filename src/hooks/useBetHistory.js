/**
 * useBetHistory — fetch paper_sports_bets for the current user (RLS-scoped).
 * computeStats — pure function to derive P&L metrics from a bets array.
 *
 * Verified column names from SportsOddsPage.jsx INSERT (line 1126) and
 * api/settle-sports-bets.js UPDATE:
 *
 *   Core:       id, user_id, created_at, status
 *   Game:       sport, league, game_id, home_team, away_team
 *   Bet detail: bet_type, selection, line, odds, stake
 *   Payout:     potential_payout, actual_payout
 *   Settle:     home_score, away_score, result_resolved_at
 *   Other:      book, parlay_id (nullable)
 *
 * Note: "matchup" is NOT a column — use home_team + away_team instead.
 * "bet_amount" is NOT a column — the column is "stake".
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * useBetHistory()
 *
 * Fetches all paper_sports_bets for the authenticated user, sorted by
 * created_at DESC (most recent first — satisfies HIST-02).
 *
 * Returns { bets: Array, loading: boolean, error: string|null }
 */
export function useBetHistory() {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        if (!session?.user?.id) {
          setBets([]);
          setLoading(false);
          return;
        }
        const { data, error: queryError } = await supabase
          .from('paper_sports_bets')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });
        if (cancelled) return;
        if (queryError) {
          console.warn('useBetHistory query error:', queryError.message);
          setBets([]);
        } else {
          setBets(data || []);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('useBetHistory error:', err?.message);
          setBets([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [refreshKey]);

  // Realtime: listen for inserts/updates to paper_sports_bets
  useEffect(() => {
    let channel;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user?.id) return;
      channel = supabase
        .channel('paper-bets-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'paper_sports_bets',
            filter: `user_id=eq.${session.user.id}`,
          },
          () => refresh()
        )
        .subscribe();
    });
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return { bets, loading, error, refresh };
}

/**
 * computeStats(bets)
 *
 * Pure function — no Supabase calls, no side effects.
 * Accepts any bets array (full or filtered subset — supports STAT-02 future filtering).
 *
 * Definitions:
 *   totalWagered — sum of stake on ALL bets (including pending)
 *   totalWon     — sum of actual_payout on won bets only
 *   netPnl       — (sum actual_payout on won) - (sum stake on won) - (sum stake on lost)
 *                  Pending bets excluded from realized P&L.
 *   winRate      — won.length / (won.length + lost.length) * 100
 *                  Pending bets excluded from denominator (per STATE.md convention).
 *                  Returns 0 when no settled bets exist.
 *
 * Example: 1 won (payout 200, stake 100) + 1 lost (stake 50) =>
 *   { totalWagered: 150, totalWon: 200, netPnl: 50, winRate: 50 }
 *
 * @param {Array} bets
 * @returns {{ totalWagered: number, totalWon: number, netPnl: number, winRate: number }}
 */
export function computeStats(bets) {
  if (!Array.isArray(bets) || bets.length === 0) {
    return { totalWagered: 0, totalWon: 0, netPnl: 0, winRate: 0 };
  }

  const won = bets.filter((b) => b.status === 'won');
  const lost = bets.filter((b) => b.status === 'lost');

  const totalWagered = bets.reduce((sum, b) => sum + Number(b.stake || 0), 0);
  const totalWon = won.reduce((sum, b) => sum + Number(b.actual_payout || 0), 0);

  const wonPayouts = won.reduce((sum, b) => sum + Number(b.actual_payout || 0), 0);
  const wonStakes = won.reduce((sum, b) => sum + Number(b.stake || 0), 0);
  const lostStakes = lost.reduce((sum, b) => sum + Number(b.stake || 0), 0);
  const netPnl = wonPayouts - wonStakes - lostStakes;

  const settledCount = won.length + lost.length;
  const winRate = settledCount > 0 ? (won.length / settledCount) * 100 : 0;

  return { totalWagered, totalWon, netPnl, winRate };
}
