import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GLASS_CARD } from '../../lib/sportsUtils';
import BetHistorySummary from './BetHistorySummary';
import { computeStats } from '../../hooks/useBetHistory';

const SPRING = { type: 'spring', stiffness: 400, damping: 30 };

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
  { key: 'date', label: 'Date / Time', sortable: true, sortKey: 'date' },
  { key: 'matchup', label: 'Matchup', sortable: false },
  { key: 'sport', label: 'Sport', sortable: false },
  { key: 'stake', label: 'Stake', sortable: true, sortKey: 'stake' },
  { key: 'odds', label: 'Odds', sortable: false },
  { key: 'payout', label: 'Payout', sortable: false },
  { key: 'result', label: 'Result', sortable: true, sortKey: 'result' },
];

const RESULT_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'won', label: 'Win' },
  { key: 'lost', label: 'Loss' },
  { key: 'pending', label: 'Pending' },
];

const SPORT_FILTERS = ['all', 'NFL', 'NBA', 'MLB', 'NHL'];

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
  const [resultFilter, setResultFilter] = useState('all');
  const [sportFilter, setSportFilter] = useState('all');
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  const filteredBets = useMemo(() => {
    let out = bets;

    if (resultFilter !== 'all') {
      out = out.filter((b) => b.status === resultFilter);
    }

    if (sportFilter !== 'all') {
      out = out.filter(
        (b) =>
          (b.league ?? '').toUpperCase().includes(sportFilter) ||
          (b.sport ?? '').toUpperCase().includes(sportFilter)
      );
    }

    out = [...out].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'date') {
        cmp = (a.created_at ?? '') < (b.created_at ?? '') ? -1 : 1;
      } else if (sortKey === 'stake') {
        cmp = Number(a.stake) < Number(b.stake) ? -1 : 1;
      } else if (sortKey === 'result') {
        cmp = (a.status ?? '') < (b.status ?? '') ? -1 : 1;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return out;
  }, [bets, resultFilter, sportFilter, sortKey, sortDir]);

  const stats = computeStats(filteredBets);

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function clearFilters() {
    setResultFilter('all');
    setSportFilter('all');
  }

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

      {/* Filter controls */}
      <div className="flex flex-col gap-3">
        {/* Result filter row */}
        <div className="flex items-center gap-1">
          {RESULT_FILTERS.map((f) => (
            <div key={f.key} className="relative">
              {resultFilter === f.key && (
                <motion.div
                  layoutId="result-indicator"
                  className="absolute inset-0 rounded-lg bg-white/[0.08] border border-white/[0.08]"
                  transition={SPRING}
                />
              )}
              <motion.button
                onClick={() => setResultFilter(f.key)}
                whileTap={{ scale: 0.96 }}
                transition={SPRING}
                className={`relative z-10 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  resultFilter === f.key
                    ? 'text-white'
                    : 'text-gray-500 hover:text-gray-400'
                }`}
              >
                {f.label}
              </motion.button>
            </div>
          ))}
        </div>

        {/* Sport filter row */}
        <div className="flex items-center gap-1">
          {SPORT_FILTERS.map((s) => (
            <div key={s} className="relative">
              {sportFilter === s && (
                <motion.div
                  layoutId="sport-indicator"
                  className="absolute inset-0 rounded-lg bg-white/[0.08] border border-white/[0.08]"
                  transition={SPRING}
                />
              )}
              <motion.button
                onClick={() => setSportFilter(s)}
                whileTap={{ scale: 0.96 }}
                transition={SPRING}
                className={`relative z-10 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  sportFilter === s
                    ? 'text-white'
                    : 'text-gray-500 hover:text-gray-400'
                }`}
              >
                {s === 'all' ? 'All' : s}
              </motion.button>
            </div>
          ))}
        </div>
      </div>

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
        ) : filteredBets.length === 0 ? (
          <motion.div
            key="empty-filtered"
            className={`${GLASS_CARD.standard} flex flex-col items-center justify-center py-16 text-center`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <span className="mb-3 text-3xl opacity-40">&#x1f50d;</span>
            <p className="text-sm font-medium text-gray-400">No bets match your filters</p>
            <button
              onClick={clearFilters}
              className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              Clear filters
            </button>
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
                    {COLUMNS.map((col) =>
                      col.sortable ? (
                        <th
                          key={col.key}
                          onClick={() => handleSort(col.sortKey)}
                          className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-gray-500 uppercase whitespace-nowrap cursor-pointer hover:text-gray-300 transition-colors select-none"
                        >
                          {col.label}
                          {sortKey === col.sortKey && (
                            <motion.span
                              key={`${col.sortKey}-${sortDir}`}
                              initial={{ opacity: 0, y: sortDir === 'asc' ? 4 : -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={SPRING}
                              className="ml-1 inline-block"
                            >
                              {sortDir === 'asc' ? '↑' : '↓'}
                            </motion.span>
                          )}
                        </th>
                      ) : (
                        <th
                          key={col.key}
                          className="px-4 py-3 text-left text-xs font-semibold tracking-widest text-gray-500 uppercase whitespace-nowrap"
                        >
                          {col.label}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <motion.tbody
                  variants={{ show: { transition: { staggerChildren: 0.04 } } }}
                  initial="hidden"
                  animate="show"
                >
                  {filteredBets.map((bet) => {
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
