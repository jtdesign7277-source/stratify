import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, ChevronLeft } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const SPRING = { type: 'spring', stiffness: 400, damping: 30 };

function singlePayout(stake, americanOdds) {
  const n = Number(americanOdds);
  if (!Number.isFinite(n) || stake <= 0) return 0;
  const decimal = n > 0 ? n / 100 + 1 : 100 / Math.abs(n) + 1;
  return stake * decimal;
}

function americanToDecimal(americanOdds) {
  const n = Number(americanOdds);
  if (!Number.isFinite(n)) return 1;
  return n > 0 ? n / 100 + 1 : 100 / Math.abs(n) + 1;
}

export default function PaperBettingSlip({ bets, onRemove, onStakeChange, onClear }) {
  const [open, setOpen] = useState(true);
  const [parlay, setParlay] = useState(false);
  const [bankroll, setBankroll] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id || cancelled) return;
      const { data } = await supabase
        .from('paper_sports_bankroll')
        .select('balance')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (!cancelled && data) setBankroll(data.balance);
    })();
    return () => { cancelled = true; };
  }, []);

  const totalStake = bets.reduce((s, b) => s + (Number(b.stake) || 0), 0);
  const combinedDecimal =
    bets.length === 0
      ? 0
      : bets.reduce((acc, b) => acc * americanToDecimal(b.odds), 1);
  const totalPayoutSingle = bets.reduce((s, b) => s + singlePayout(Number(b.stake) || 0, Number(b.odds)), 0);
  const totalPayoutParlay = parlay && bets.length > 0 ? totalStake * combinedDecimal : totalPayoutSingle;
  const totalPayout = parlay && bets.length > 1 ? totalPayoutParlay : totalPayoutSingle;

  const insufficientBankroll = bankroll != null && totalStake > Number(bankroll);

  const handlePlace = async () => {
    if (insufficientBankroll || bets.length === 0) return;
    setSaving(true);
    setToast(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id ?? null;
      if (!userId) {
        setToast({ type: 'error', message: 'Sign in to place paper bets' });
        return;
      }
      for (const b of bets) {
        const stake = Math.max(1, Number(b.stake) || 0);
        const potentialPayout =
          parlay && bets.length > 1
            ? (stake / totalStake) * totalPayoutParlay
            : singlePayout(stake, Number(b.odds));
        await supabase.from('paper_sports_bets').insert({
          user_id: userId,
          sport: b.sport,
          league: b.league,
          home_team: b.home_team,
          away_team: b.away_team,
          bet_type: b.bet_type,
          selection: b.selection,
          line: b.line,
          odds: b.odds,
          stake,
          potential_payout: Math.round(potentialPayout * 100) / 100,
          book: b.book,
          status: 'pending',
          created_at: new Date().toISOString(),
        });
      }
      let currentBalance = Number(bankroll);
      if (bankroll == null) {
        const { error: insertErr } = await supabase.from('paper_sports_bankroll').insert({
          user_id: userId,
          balance: 100000,
          wins: 0,
          losses: 0,
          total_pushes: 0,
          total_won: 0,
          total_lost: 0,
          current_streak: 0,
          biggest_win: 0,
        });
        if (!insertErr) currentBalance = 100000;
      }
      const newBalance = currentBalance - totalStake;
      await supabase
        .from('paper_sports_bankroll')
        .update({ balance: newBalance })
        .eq('user_id', userId);
      setBankroll(newBalance);
      setToast({ type: 'success', message: 'Paper bet placed' });
      onClear();
    } catch (e) {
      console.error(e);
      setToast({ type: 'error', message: e?.message || 'Failed to place bet' });
    } finally {
      setSaving(false);
    }
  };

  const bankrollDisplay =
    bankroll != null
      ? '$' + Number(bankroll).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '—';

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed z-[50] flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.01] px-4 py-2.5 text-white shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl"
        style={{ right: 16, top: '50%', transform: 'translateY(-50%)' }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={SPRING}
      >
        <span className="font-semibold">📋 Paper Slip</span>
        <span className="text-emerald-400">{bets.length}</span>
        <span className="text-emerald-400 font-mono text-sm">{bankrollDisplay}</span>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={SPRING}
            className="fixed z-[50] flex w-[320px] max-h-[80vh] flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.01] shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl"
            style={{ right: 16, top: '50%', transform: 'translateY(-50%)' }}
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <span className="font-semibold text-white">📋 Paper Slip</span>
              <span className="text-emerald-400">{bets.length}</span>
            </div>
            <div className="border-b border-white/[0.06] px-4 py-2">
              <span className="text-emerald-400 font-mono text-sm">{bankrollDisplay}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {bets.length === 0 ? (
                <p className="py-6 text-center text-xs text-gray-500">Click any odds to add to slip</p>
              ) : (
                <AnimatePresence>
                  {bets.map((b, i) => {
                    const stake = Number(b.stake) || 0;
                    const payout = singlePayout(stake, Number(b.odds));
                    return (
                      <motion.div
                        key={b.id}
                        layout
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ ...SPRING, delay: i * 0.04 }}
                        className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-white">
                            {b.selection} · {b.bet_type}
                          </div>
                          <div className="font-mono text-xs text-gray-400">
                            {b.line ? `${b.line} ` : ''}
                            {Number(b.odds) > 0 ? `+${b.odds}` : b.odds}
                          </div>
                          <div className="text-xs text-gray-500">{b.book}</div>
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-500">$</span>
                            <input
                              type="number"
                              min={1}
                              value={b.stake}
                              onChange={(e) => onStakeChange(b.id, e.target.value)}
                              className="w-20 rounded-xl border border-white/[0.04] bg-black/40 px-2 py-1 font-mono text-xs text-white shadow-[inset_4px_4px_8px_rgba(0,0,0,0.5)]"
                            />
                          </div>
                          <div className="mt-1 font-mono text-xs text-emerald-400">
                            Payout: ${payout.toFixed(2)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemove(b.id)}
                          className="rounded p-1 text-gray-500 transition-colors hover:text-red-400"
                          aria-label="Remove"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>

            {bets.length >= 2 && (
              <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-2">
                <span className="text-xs text-gray-500">Parlay</span>
                <button
                  type="button"
                  role="switch"
                  onClick={() => setParlay((p) => !p)}
                  className={`relative h-5 w-9 rounded-full transition-colors ${parlay ? 'bg-emerald-500' : 'bg-white/[0.1]'}`}
                >
                  <motion.div
                    layout
                    transition={SPRING}
                    className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow"
                    style={{ left: parlay ? 18 : 2 }}
                  />
                </button>
              </div>
            )}

            {bets.length > 0 && (
              <>
                <div className="flex justify-between border-t border-white/[0.06] px-4 py-2 text-sm">
                  <span className="text-gray-500">Total stake</span>
                  <span className="font-mono text-white">${totalStake.toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t border-white/[0.06] px-4 py-2">
                  <span className="text-gray-500">Potential payout</span>
                  <span className="font-mono text-emerald-400">${totalPayout.toFixed(2)}</span>
                </div>
                <AnimatePresence mode="wait">
                  {toast && (
                    <motion.div
                      key={toast.type}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={`px-4 py-2 text-center text-sm ${toast.type === 'error' ? 'text-red-400' : 'text-emerald-400'}`}
                    >
                      {toast.message}
                    </motion.div>
                  )}
                </AnimatePresence>
                {insufficientBankroll && (
                  <p className="px-4 py-2 text-center text-sm text-red-400">Insufficient bankroll</p>
                )}
                <div className="flex flex-col gap-2 p-3">
                  <motion.button
                    type="button"
                    onClick={handlePlace}
                    disabled={saving || insufficientBankroll}
                    className="w-full rounded-xl bg-emerald-500 py-3 font-semibold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    transition={SPRING}
                  >
                    {saving ? 'Placing…' : 'Place Paper Bet'}
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={onClear}
                    className="text-sm text-gray-500 transition-colors hover:text-white"
                    whileTap={{ scale: 0.98 }}
                    transition={SPRING}
                  >
                    Clear Slip
                  </motion.button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
