import TraderPage from './TraderPage';
import useTradingMode from '../../hooks/useTradingMode';
import { motion, AnimatePresence } from "framer-motion";

const PAGE_TRANSITION = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
};

const sectionMotion = (index) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.1 + (index * 0.05), duration: 0.3 },
});

export default function TradePage({
  onPinToTop,
  isLiveScoresOpen = false,
  onToggleLiveScores = () => {},
  pinnedGames = [],
  onGameDrop = () => {},
  onRemovePinnedGame = () => {},
}) {
  const { tradingMode, isLive, canUseLiveTrading } = useTradingMode();

  return (
    <motion.div {...PAGE_TRANSITION} className="relative min-h-full w-full overflow-y-auto">
      <AnimatePresence initial={false}>
        {isLive && (
          <motion.div
            {...sectionMotion(0)}
            className="pointer-events-none absolute right-3 top-3 z-30"
          >
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-gradient-to-r from-emerald-500/20 to-amber-400/20 px-2.5 py-1 text-[10px] font-semibold tracking-[0.15em] text-emerald-100">
              <span>💰</span>
              <span>LIVE</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div {...sectionMotion(1)} className="h-full min-h-0 w-full overflow-hidden">
        <TraderPage
          onPinToTop={onPinToTop}
          tradingMode={tradingMode}
          canUseLiveTrading={canUseLiveTrading}
          isLiveScoresOpen={isLiveScoresOpen}
          onOpenLiveScores={onToggleLiveScores}
          pinnedGames={pinnedGames}
          onGameDrop={onGameDrop}
          onRemovePinnedGame={onRemovePinnedGame}
        />
      </motion.div>
    </motion.div>
  );
}
