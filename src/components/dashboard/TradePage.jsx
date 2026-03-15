import { useState, useEffect, useCallback } from 'react';
import TraderPage from './TraderPage';
import useTradingMode from '../../hooks/useTradingMode';
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';

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
  paperTotalGainLoss = null,
  onNavigateToSentinel,
}) {
  const { tradingMode, isLive, canUseLiveTrading } = useTradingMode();
  const { user } = useAuth();
  const [yoloActive, setYoloActive] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [showKillConfirm, setShowKillConfirm] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('sentinel_user_settings')
      .select('yolo_active, subscription_status, legal_disclaimer_accepted')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setYoloActive(data.yolo_active || false);
          setIsSubscribed(data.subscription_status === 'active' || data.subscription_status === 'trialing');
          setDisclaimerAccepted(data.legal_disclaimer_accepted || false);
        }
      });
  }, [user?.id]);

  const handleYoloClick = useCallback(async () => {
    if (!isSubscribed || !disclaimerAccepted) {
      // Navigate to Sentinel page
      onNavigateToSentinel?.();
      return;
    }

    if (yoloActive) {
      setShowKillConfirm(true);
      return;
    }

    // Activate
    setYoloActive(true);
    await supabase.from('sentinel_user_settings').upsert({
      user_id: user.id,
      yolo_active: true,
      currently_copying: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  }, [isSubscribed, disclaimerAccepted, yoloActive, user?.id, onNavigateToSentinel]);

  const handleKillYolo = useCallback(async () => {
    setShowKillConfirm(false);
    setYoloActive(false);
    await supabase.from('sentinel_user_settings').upsert({
      user_id: user.id,
      yolo_active: false,
      currently_copying: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  }, [user?.id]);

  return (
    <motion.div {...PAGE_TRANSITION} className="relative flex h-full min-h-0 w-full flex-col overflow-hidden">
      {/* Top badges */}
      <div className="absolute right-3 top-3 z-30 flex items-center gap-2 pointer-events-auto">
        <AnimatePresence initial={false}>
          {isLive && (
            <motion.span
              {...sectionMotion(0)}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-gradient-to-r from-emerald-500/20 to-amber-400/20 px-2.5 py-1 text-[10px] font-semibold tracking-[0.15em] text-emerald-100"
            >
              <span>💰</span>
              <span>LIVE</span>
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <motion.div {...sectionMotion(1)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <TraderPage
          onPinToTop={onPinToTop}
          tradingMode={tradingMode}
          canUseLiveTrading={canUseLiveTrading}
          isLiveScoresOpen={isLiveScoresOpen}
          onOpenLiveScores={onToggleLiveScores}
          pinnedGames={pinnedGames}
          onGameDrop={onGameDrop}
          onRemovePinnedGame={onRemovePinnedGame}
          paperTotalGainLoss={paperTotalGainLoss}
          yoloActive={yoloActive}
          onYoloClick={handleYoloClick}
        />
      </motion.div>

      {/* Kill YOLO Confirmation */}
      <AnimatePresence>
        {showKillConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={() => setShowKillConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white/[0.05] backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-[0_24px_64px_rgba(0,0,0,0.6)] p-6 max-w-sm w-full mx-4"
            >
              <h3 className="text-white font-mono font-bold text-lg mb-3">Kill YOLO?</h3>
              <p className="text-gray-400 text-sm mb-6">Sentinel will stop copying new trades to your portfolio. Existing positions stay open.</p>
              <div className="flex gap-3">
                <motion.button
                  onClick={() => setShowKillConfirm(false)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  className="flex-1 py-2.5 rounded-xl text-gray-400 border border-white/[0.08] bg-white/[0.03] font-mono hover:bg-white/[0.06] transition-all duration-300"
                >
                  Cancel
                </motion.button>
                <motion.button
                  onClick={handleKillYolo}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  className="flex-1 py-2.5 rounded-xl text-red-400 border border-red-500/30 bg-gradient-to-br from-red-500/[0.10] to-red-500/[0.03] font-mono font-semibold shadow-[0_4px_12px_rgba(239,68,68,0.15)] transition-all duration-300"
                >
                  Kill YOLO
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
