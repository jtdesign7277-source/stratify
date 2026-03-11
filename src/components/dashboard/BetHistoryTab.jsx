import { motion, AnimatePresence } from 'framer-motion';
import { GLASS_CARD } from '../../lib/sportsUtils';
import BetHistorySummary from './BetHistorySummary';
import { computeStats } from '../../hooks/useBetHistory';

const RESULT_COLOR = {
  won: 'text-emerald-400',
  lost: 'text-red-400',
  pending: 'text-gray-400',
};

const RESULT_LABEL = {
  won: 'Won',
  lost: 'Lost',
  pending: 'Pending',
};

const COLUMNS = [
  { key: 'date', label: 'Date / Time' },
  { key: 'matchup', label: 'Matchup' },
  { key: 'sport', label: 'Sport' },
  { key: 'stake', label: 'Stake' },
  { key: 'odds', label: 'Odds' },
  { key: 'payout', label: 'Payout' },
  { key: 'result', label: 'Result' },
];

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

function formatMoney(val) {
  if (val == null) return '—';
  return `$${Number(val).toFixed(2)}`;
}

function formatOdds(odds) {
  if (odds == null) return '—';
  const n = Number(odds);
  return n > 0 ? `+${n}` : `${n}`;
}

const rowVariants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0 },
};

export default function BetHistoryTab({ bets = [], loading = false, error = null, stats: statsProp }) {
  const stats = statsProp ?? computeStats(bets);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-sm text-gray-500 animate-pulse">Loading bet history...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <span className="text-sm text-red-400">{error}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 bg-[#0a0a0f]">
      <BetHistorySummary stats={stats} />

      <AnimatePresence>
        {bets.length === 0 ? (
          <motion.div
            key="empty"
            className={`${GLASS_CARD.standard} flex flex-col items-center justify-center py-16 text-center`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <span className="mb-3 text-3xl opacity-40">&#x1f4cb;</span>
            <p className="text-sm font-medium text-gray-400">No bets yet</p>
            <p className="mt-1 text-xs text-gray-500">
              Place your first paper bet to start tracking performance
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="table"
            className={`${GLASS_CARD.standard} overflow-hidden`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-black/20 border-b border-white/[0.06]">
                    {COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-gray-500 uppercase whitespace-nowrap"
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <motion.tbody
                  variants={{ show: { transition: { staggerChildren: 0.04 } } }}
                  initial="hidden"
                  animate="show"
                >
                  {bets.map((bet) => {
                    const status = bet.status ?? 'pending';
                    const payout =
                      status === 'pending'
                        ? bet.potential_payout
                        : bet.actual_payout;

                    return (
                      <motion.tr
                        key={bet.id}
                        variants={rowVariants}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        whileHover={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                        className="border-b border-white/[0.04] last:border-0"
                      >
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                          {formatDate(bet.created_at)}
                        </td>
                        <td className="px-4 py-3 text-white whitespace-nowrap">
                          {bet.away_team && bet.home_team
                            ? `${bet.away_team} @ ${bet.home_team}`
                            : bet.selection ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-300 whitespace-nowrap uppercase">
                          {bet.sport ?? '—'}
                        </td>
                        <td className="px-4 py-3 font-mono font-medium text-white whitespace-nowrap">
                          {formatMoney(bet.stake)}
                        </td>
                        <td className="px-4 py-3 font-mono font-medium text-white whitespace-nowrap">
                          {formatOdds(bet.odds)}
                        </td>
                        <td className="px-4 py-3 font-mono font-medium text-white whitespace-nowrap">
                          {formatMoney(payout)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`${RESULT_COLOR[status] ?? 'text-gray-400'} text-sm font-medium`}>
                            {RESULT_LABEL[status] ?? status}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </motion.tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
