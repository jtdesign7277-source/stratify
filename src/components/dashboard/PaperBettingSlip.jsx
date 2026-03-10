import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

const SPRING = { type: 'spring', stiffness: 500, damping: 30 };

function calcPayout(stake, odds) {
  if (odds > 0) return stake * (odds / 100 + 1);
  return stake * (100 / Math.abs(odds) + 1);
}

export default function PaperBettingSlip({ bets, onRemove, onStakeChange, onClear, onPlace }) {
  const [parlay, setParlay] = useState(false);
  const [bankroll, setBankroll] = useState(null);

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

  const totalStake = bets.reduce((sum, b) => sum + Number(b.stake || 0), 0);
  const parlayDecimal =
    bets.length === 0
      ? 1
      : bets.reduce((acc, bet) => {
          const decimal =
            bet.odds > 0 ? bet.odds / 100 + 1 : 100 / Math.abs(bet.odds) + 1;
          return acc * decimal;
        }, 1);
  const firstStake = bets.length > 0 ? Number(bets[0].stake) || 0 : 0;
  const parlayPayout = firstStake * parlayDecimal;
  const totalPayoutSingle = bets.reduce((sum, b) => sum + calcPayout(Number(b.stake) || 0, Number(b.odds)), 0);
  const totalPayout = parlay && bets.length >= 2 ? parlayPayout : totalPayoutSingle;
  const insufficientBankroll = bankroll != null && totalStake > Number(bankroll);
  const bankrollDisplay =
    bankroll != null
      ? '$' + Number(bankroll).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '$100,000.00';

  return (
    <div className="flex h-full flex-col overflow-y-auto rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.01] shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-[#0a0a0f] py-3 px-4">
        <span className="text-sm font-semibold text-white">📋 Paper Slip</span>
        <span className="text-sm text-emerald-400">{bets.length}</span>
        <span className="font-mono text-xs text-emerald-400">{bankrollDisplay}</span>
      </div>

      {bets.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-12">
          <span className="mb-2 text-2xl opacity-60">📋</span>
          <p className="text-center text-sm text-gray-500">Click any odds to add to slip</p>
        </div>
      ) : (
        <>
          <motion.div
            className="flex-1 overflow-y-auto p-3"
            variants={{ show: { transition: { staggerChildren: 0.04 } } }}
            initial="hidden"
            animate="show"
          >
            <AnimatePresence initial={false}>
              {bets.map((b, i) => (
                <motion.div
                  key={b.id}
                  variants={{ hidden: { opacity: 0, x: 20 }, show: { opacity: 1, x: 0 } }}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0, x: -20, height: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  className="mb-2 rounded-xl border border-white/[0.04] bg-black/20 p-3"
                >
                  <div className="flex items-start justify-between">
                    <span className="text-sm font-medium text-white">{b.team}</span>
                    <button
                      type="button"
                      onClick={() => onRemove(b.id)}
                      className="text-gray-500 transition-colors hover:text-red-400"
                      aria-label="Remove"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="font-mono text-xs text-gray-400">
                    {b.betType} · {b.line || '—'} · {b.odds > 0 ? `+${b.odds}` : b.odds}
                  </div>
                  <div className="text-xs text-gray-500">{b.book}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-gray-400">$</span>
                    <input
                      type="number"
                      min={1}
                      value={b.stake}
                      onChange={(e) => onStakeChange(b.id, e.target.value)}
                      className="w-24 rounded-lg border border-white/[0.04] bg-black/40 px-2 py-1 font-mono text-sm text-white shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5)]"
                    />
                  </div>
                  <div className="mt-1 font-mono text-xs text-emerald-400">
                    Payout: ${calcPayout(Number(b.stake) || 0, Number(b.odds)).toFixed(2)}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>

          {bets.length >= 2 && (
            <div className="border-t border-white/[0.06] px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Parlay</span>
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
              {parlay && (
                <div className="mt-1 font-mono text-sm text-emerald-400">
                  Parlay payout: ${parlayPayout.toFixed(2)}
                </div>
              )}
            </div>
          )}

          <div className="sticky bottom-0 border-t border-white/[0.06] bg-[#0a0a0f] pt-3 pb-4">
            <div className="mb-3 border-white/[0.06]" />
            <div className="flex items-center justify-between px-4 text-sm">
              <span className="text-gray-400">Total stake</span>
              <span className="font-mono text-white">${totalStake.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between px-4 text-sm">
              <span className="text-gray-400">Potential payout</span>
              <span className="font-mono text-emerald-400">${totalPayout.toFixed(2)}</span>
            </div>
            {insufficientBankroll && (
              <p className="mb-2 mt-2 text-center text-xs text-red-400">Insufficient bankroll</p>
            )}
            <div className="mt-3 flex flex-col gap-2 px-4">
              <motion.button
                type="button"
                onClick={onPlace}
                disabled={bets.length === 0 || insufficientBankroll}
                className="w-full rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              >
                Place Paper Bet
              </motion.button>
              <button
                type="button"
                onClick={onClear}
                className="w-full py-2 text-xs text-gray-500 transition-colors duration-200 hover:text-white"
              >
                Clear Slip
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
