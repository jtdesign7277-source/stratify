import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { T, OVERLAY_PANEL_TRANSITION } from './communityConstants';
import { toMaybeFiniteNumber, formatPrice, formatSignedPercent } from './communityHelpers';

const SuggestionPopover = ({
  open,
  mode = 'post',
  loading,
  suggestions,
  activeIndex,
  onPick,
}) => (
  <AnimatePresence initial={false}>
    {open && (
      <motion.div
        initial={{ opacity: 0, y: 8, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.95 }}
        transition={OVERLAY_PANEL_TRANSITION}
        className="absolute left-0 right-0 bottom-full mb-2 z-50"
      >
        <div
          className="rounded-2xl border shadow-2xl shadow-black/40 overflow-hidden"
          style={{
            borderColor: T.border,
            background: 'linear-gradient(180deg, rgba(28,35,51,0.98) 0%, rgba(13,17,23,0.98) 100%)',
          }}
        >
          {loading ? (
            <div className="px-3 py-2.5 text-xs" style={{ color: T.muted }}>
              {mode === 'search' ? 'Preparing suggestions...' : 'Searching symbols...'}
            </div>
          ) : suggestions.length === 0 ? (
            <div className="px-3 py-2.5 text-xs" style={{ color: T.muted }}>
              {mode === 'search' ? 'No suggestions yet.' : 'No symbols found.'}
            </div>
          ) : mode === 'search' ? (
            <div className="max-h-64 overflow-y-auto">
              {suggestions.map((item, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={item.id || `${item.text}-${idx}`}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onPick?.(item)}
                    className="w-full px-3 py-2.5 text-left transition-colors text-sm"
                    style={{
                      backgroundColor: isActive ? 'rgba(88,166,255,0.12)' : 'transparent',
                      borderBottom: idx === suggestions.length - 1 ? 'none' : `1px solid ${T.border}`,
                      color: T.text,
                    }}
                  >
                    {item.text}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {suggestions.map((item, idx) => {
                const isActive = idx === activeIndex;
                const percent = toMaybeFiniteNumber(item?.percentChange);
                const isUp = percent !== null ? percent >= 0 : false;
                return (
                  <button
                    key={`${item.symbol}-${idx}`}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onPick?.(item)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors"
                    style={{
                      backgroundColor: isActive ? 'rgba(88,166,255,0.12)' : 'transparent',
                      borderBottom: idx === suggestions.length - 1 ? 'none' : `1px solid ${T.border}`,
                    }}
                  >
                    <div className="min-w-0 pr-3">
                      <div className="text-sm font-semibold" style={{ color: T.text }}>${item.symbol}</div>
                      <div className="text-[11px] truncate" style={{ color: T.muted }}>{item.name || item.symbol}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs font-mono" style={{ color: T.text }}>
                        {item.price !== null && item.price !== undefined ? formatPrice(item.price) : '--'}
                      </div>
                      <div className="text-[11px] font-mono" style={{ color: percent === null ? T.muted : (isUp ? T.green : T.red) }}>
                        {percent === null ? '--' : formatSignedPercent(percent)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default SuggestionPopover;
