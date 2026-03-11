import { motion } from 'framer-motion';
import CountUp from 'react-countup';
import { GLASS_CARD, DESIGN_COLORS } from '../../lib/sportsUtils';

const STAT_CELLS = [
  { key: 'totalWagered', label: 'Total Wagered', prefix: '$', decimals: 2, suffix: '' },
  { key: 'totalWon', label: 'Total Won', prefix: '$', decimals: 2, suffix: '' },
  { key: 'netPnl', label: 'Net P&L', prefix: '$', decimals: 2, suffix: '', colored: true },
  { key: 'winRate', label: 'Win Rate', prefix: '', decimals: 1, suffix: '%' },
];

export default function BetHistorySummary({ stats = {} }) {
  const { totalWagered = 0, totalWon = 0, netPnl = 0, winRate = 0 } = stats;
  const values = { totalWagered, totalWon, netPnl, winRate };

  return (
    <motion.div
      className={`${GLASS_CARD.standard} p-4`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {STAT_CELLS.map((cell, i) => {
          const value = values[cell.key] ?? 0;
          const colorClass = cell.colored
            ? value >= 0
              ? DESIGN_COLORS.positive
              : DESIGN_COLORS.negative
            : 'text-white';

          return (
            <motion.div
              key={cell.key}
              className="flex flex-col gap-1"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30, delay: i * 0.06 }}
            >
              <span className="text-xs font-semibold tracking-widest text-gray-500 uppercase">
                {cell.label}
              </span>
              <span className={`font-mono font-medium text-sm ${colorClass}`}>
                {cell.prefix}
                <CountUp
                  end={Math.abs(value)}
                  duration={0.8}
                  separator=","
                  decimals={cell.decimals}
                />
                {cell.suffix}
              </span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
