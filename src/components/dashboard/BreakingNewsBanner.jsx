import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

const formatTickerMove = (symbol, change) => {
  if (!symbol) return '';
  const value = typeof change === 'number' ? change : Number(change || 0);
  const sign = value > 0 ? '+' : value < 0 ? '' : '';
  const percent = Number.isFinite(value) ? value.toFixed(2) : '0.00';
  return `$${symbol} ${sign}${percent}% pre-market`;
};

const BreakingNewsBanner = ({
  headline,
  tickerSymbol,
  tickerChange,
  newsUrl,
  isLive = true,
  onDismiss,
}) => {
  const [isFresh, setIsFresh] = useState(true);
  const tickerText = useMemo(
    () => formatTickerMove(tickerSymbol, tickerChange),
    [tickerSymbol, tickerChange]
  );

  useEffect(() => {
    setIsFresh(true);
    const timeout = setTimeout(() => setIsFresh(false), 900);
    return () => clearTimeout(timeout);
  }, [headline, tickerSymbol, tickerChange]);

  const handleClick = () => {
    if (newsUrl && typeof window !== 'undefined') {
      window.open(newsUrl, '_blank', 'noopener,noreferrer');
    }
    if (onDismiss) onDismiss();
  };

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -24, opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="relative w-full overflow-hidden rounded-xl border border-red-500/30 bg-[#0b0b12] px-4 py-3 text-left shadow-[0_12px_40px_rgba(239,68,68,0.18)]"
      style={{
        boxShadow:
          '0 10px 30px rgba(9,10,15,0.9), 0 0 25px rgba(239,68,68,0.18)',
      }}
    >
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0.25, 0.65, 0.25] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(239,68,68,0.24),transparent_55%),radial-gradient(circle_at_80%_30%,rgba(16,185,129,0.08),transparent_60%)]"
      />

      {isFresh && (
        <motion.div
          aria-hidden="true"
          initial={{ x: '-120%', opacity: 0.35 }}
          animate={{ x: '120%', opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="pointer-events-none absolute top-0 h-full w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent"
        />
      )}

      <div className="relative flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-red-200">
            {isLive && (
              <motion.span
                className="h-2 w-2 rounded-full bg-red-500"
                animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
            Live
          </div>
          <span className="text-xs font-semibold text-emerald-200/80">
            Breaking News
          </span>
        </div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200/70">
          Tap to read →
        </div>
      </div>

      <div className="relative mt-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="text-sm font-semibold text-white md:text-base">
          {headline}
        </div>
        {tickerText && (
          <div className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
            {tickerText}
          </div>
        )}
      </div>
    </motion.button>
  );
};

export default BreakingNewsBanner;
