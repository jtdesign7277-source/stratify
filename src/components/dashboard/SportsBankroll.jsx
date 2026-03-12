import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import CountUp from 'react-countup';
import { supabase } from '../../lib/supabaseClient';

const INITIAL_BANKROLL = 100000;

export default function SportsBankroll() {
  const [open, setOpen] = useState(false);
  const [row, setRow] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id || cancelled) return;
      const { data } = await supabase
        .from('paper_sports_bankroll')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (!cancelled) setRow(data);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let channel;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user?.id) return;
      channel = supabase
        .channel('bankroll')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'paper_sports_bankroll',
            filter: `user_id=eq.${session.user.id}`,
          },
          (payload) => setRow(payload.new)
        )
        .subscribe();
    });
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const balance = row?.balance != null ? Number(row.balance) : INITIAL_BANKROLL;
  const wins = Number(row?.wins) || 0;
  const losses = Number(row?.losses) || 0;
  const pushes = Number(row?.total_pushes) || 0;
  const currentStreak = Number(row?.current_streak) || 0;
  const pnl = balance - INITIAL_BANKROLL;
  const roi = ((pnl / INITIAL_BANKROLL) * 100).toFixed(1);
  const winRate = wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(0) : '0';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.01] shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-xl"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          Bankroll
        </span>
        <svg
          className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <motion.div
        initial={false}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="overflow-hidden"
      >
        <div className="flex flex-wrap items-center gap-6 px-5 pb-5">
          <div className="min-w-0 flex-1">
            <div className="mb-1 text-xs uppercase tracking-widest text-gray-500">PAPER BANKROLL</div>
            <div className="text-2xl font-mono text-white">
              $
              <CountUp
                start={0}
                end={balance}
                duration={0.8}
                separator=","
                decimals={2}
                decimal="."
                useEasing
              />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 text-xs uppercase tracking-widest text-gray-500">TOTAL P&L</div>
            <div className={`text-2xl font-mono ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {pnl >= 0 ? '+' : ''}
              <CountUp start={0} end={pnl} duration={0.8} separator="," decimals={2} useEasing />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 text-xs uppercase tracking-widest text-gray-500">ROI</div>
            <div className={`text-2xl font-mono ${Number(roi) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {Number(roi) >= 0 ? '+' : ''}
              {roi}%
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 text-xs uppercase tracking-widest text-gray-500">RECORD</div>
            <div className="text-2xl font-mono text-white">
              {wins}-{losses}-{pushes}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 text-xs uppercase tracking-widest text-gray-500">WIN RATE</div>
            <div className="text-2xl font-mono text-emerald-400">{winRate}%</div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 text-xs uppercase tracking-widest text-gray-500">STREAK</div>
            <div
              className={`text-2xl font-mono ${currentStreak > 0 ? 'text-emerald-400' : currentStreak < 0 ? 'text-red-400' : 'text-white'}`}
            >
              {currentStreak > 0 ? `W${currentStreak}` : currentStreak < 0 ? `L${Math.abs(currentStreak)}` : '—'}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
